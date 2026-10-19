'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/portfolio-source/game-runtime/garden-audio.js','utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function harness({pendingResume=false,pendingDecode=false}={}){
 const contexts=[],listeners=new Set();
 class Param {
  constructor(){this.value=1;this.calls=[];}
  call(name,...args){this.calls.push([name,...args]);this.value=args[0];}
  setValueAtTime(...a){this.call('set',...a);}
  setTargetAtTime(...a){this.call('target',...a);}
  linearRampToValueAtTime(...a){this.call('linear',...a);}
  exponentialRampToValueAtTime(...a){this.call('exponential',...a);}
  cancelScheduledValues(...a){this.calls.push(['cancel',...a]);}
  cancelAndHoldAtTime(...a){this.calls.push(['hold',...a]);}
 }
 class Node {
  constructor(context,kind){this.context=context;this.kind=kind;this.connections=[];this.disconnects=0;this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.pan=new Param();this.playbackRate=new Param();}
  connect(target){assert.equal(target.context,this.context,'graphs cannot cross contexts');this.connections.push(target);}
  disconnect(){this.disconnects++;}
  setPeriodicWave(){}
  start(at){this.started=at;}
  stop(at){this.stopped=at;}
 }
 class Context {
  constructor(){this.state=pendingResume?'suspended':'running';this.currentTime=4;this.sampleRate=22050;this.nodes=[];this.destination=new Node(this,'destination');this.closing=deferred();this.resuming=deferred();this.decoding=deferred();contexts.push(this);}
  node(kind){const n=new Node(this,kind);this.nodes.push(n);return n;}
  createGain(){return this.node('gain');}
  createBiquadFilter(){return this.node('filter');}
  createOscillator(){return this.node('oscillator');}
  createBufferSource(){return this.node('sample');}
  createStereoPanner(){return this.node('panner');}
  createBuffer(channels,length,sampleRate){return {length,sampleRate,duration:length/sampleRate,getChannelData:()=>new Float32Array(length)};}
  async decodeAudioData(){if(pendingDecode)await this.decoding.promise;return this.createBuffer(1,2205,22050);}
  async resume(){await this.resuming.promise;this.state='running';}
  async close(){await this.closing.promise;this.state='closed';}
 }
 const sandbox={AudioContext:Context,document:{hidden:false,addEventListener:(type,cb)=>listeners.add(cb),removeEventListener:(type,cb)=>listeners.delete(cb)}};
 vm.runInNewContext(source,sandbox);
 return {audio:sandbox.GardenAudio,contexts,listeners};
}
test('old dispose completion preserves a newly unlocked graph, voices and decoded samples',async()=>{
 const {audio,contexts,listeners}=harness();
 assert.equal(await audio.unlock(),true);
 audio.event('action');
 assert.ok(audio.info().voices>0);
 const closing=audio.dispose();
 assert.equal(audio.info().voices,0);
 assert.equal(audio.info().buffersDecoded,0);
 assert.equal(listeners.size,0);
 assert.equal(await audio.unlock(),true);
 audio.update({status:'playing',enemies:[],plants:[],levelIndex:0});
 audio.event('swap');
 const before=audio.info();
 assert.equal(before.buffersDecoded,11);
 assert.ok(before.voices>0);
 assert.equal(Object.keys(before.layers).length,3);
 contexts[0].closing.resolve();await closing;
 assert.equal(audio.info().voices,before.voices);
 assert.equal(audio.info().buffersDecoded,11);
 assert.equal(Object.keys(audio.info().layers).length,3);
 assert.equal(listeners.size,1);
 assert.ok(contexts[1].nodes.every(n=>n.disconnects===0));
});
test('unlock waiting on resume cannot revive a disposed context',async()=>{
 const {audio,contexts}=harness({pendingResume:true});
 const unlocking=audio.unlock();
 const closing=audio.dispose();
 contexts[0].resuming.resolve();
 assert.equal(await unlocking,false);
 assert.equal(audio.info().unlocked,false);
 assert.equal(audio.info().buffersDecoded,0);
 contexts[0].closing.resolve();await closing;
});
test('late sample decode cannot populate the next audio generation',async()=>{
 const {audio,contexts}=harness({pendingDecode:true});
 const firstUnlock=audio.unlock();
 const closing=audio.dispose();
 const nextUnlock=audio.unlock();
 contexts[0].decoding.resolve();
 assert.equal(await firstUnlock,false);
 assert.equal(audio.info().buffersDecoded,0);
 contexts[1].decoding.resolve();
 assert.equal(await nextUnlock,true);
 assert.equal(audio.info().buffersDecoded,11);
 contexts[0].closing.resolve();await closing;
 assert.equal(audio.info().buffersDecoded,11);
});
test('pause releases active oscillators before disconnecting, avoiding hard audio edges',async()=>{
 const {audio,contexts}=harness();await audio.unlock();
 audio.event('swap');
 const oscillators=contexts[0].nodes.filter(n=>n.kind==='oscillator');
 assert.ok(oscillators.length>0);
 for(const oscillator of oscillators){
  const gain=oscillator.connections[0];
  assert.ok(gain.gain.calls.some(c=>c[0]==='set'&&c[1]===.0001));
  assert.ok(gain.gain.calls.some(c=>c[0]==='linear'));
 }
 audio.update({status:'paused'});
 for(const oscillator of oscillators){
  const gain=oscillator.connections[0];
  assert.equal(gain.disconnects,0);
  assert.ok(gain.gain.calls.some(c=>c[0]==='hold'));
  assert.ok(gain.gain.calls.some(c=>c[0]==='target'&&c[1]===.0001&&c[3]===.006));
  assert.equal(oscillator.stopped,4.035);
 }
});

test('dewfall has a quiet pitched cue, throttles repeats and releases every voice',async()=>{
 const {audio,contexts}=harness();await audio.unlock();
 const context=contexts[0],before=context.nodes.length;
 audio.event({type:'tactic',row:0},{status:'playing'});
 const added=context.nodes.slice(before),oscillators=added.filter(n=>n.kind==='oscillator');
 assert.ok(oscillators.length>1,'dewfall has a chord rather than a generic click');
 assert.equal(added.some(n=>n.kind==='sample'||n.kind==='filter'),false,'no noise source is used');
 assert.ok(oscillators.some(n=>n.frequency.calls.some(c=>c[0]==='exponential')),'droplet falls in pitch');
 for(const oscillator of oscillators){
  assert.equal(oscillator.type,'sine');
  assert.ok(oscillator.stopped>oscillator.started&&oscillator.stopped-oscillator.started<.5);
  const gain=oscillator.connections[0];
  assert.ok(gain.gain.calls.some(c=>c[0]==='linear'&&c[1]>0&&c[1]<=.05));
  assert.ok(gain.gain.calls.some(c=>c[0]==='exponential'&&c[1]===.0001));
 }
 const count=context.nodes.length;
 audio.event({type:'tactic',row:4},{status:'playing'});
 assert.equal(context.nodes.length,count,'repeated input cannot stack the cue');
 for(const oscillator of oscillators)oscillator.onended();
 assert.equal(audio.info().voices,0);
 assert.ok(added.every(n=>n.disconnects===1),'ended voices release the entire graph');
 context.currentTime+=1;
 audio.event({type:'tactic',row:4},{status:'playing'});
 assert.ok(audio.info().voices>0,'cooldown allows a later cue');
 audio.update({status:'paused'});
 const latest=context.nodes.slice(count).filter(n=>n.kind==='oscillator');
 assert.ok(latest.every(n=>n.stopped===context.currentTime+.035),'pause fades active dewfall voices');
});
test('dewfall obeys sound, master and volume gates, and cannot start while paused',async()=>{
 const {audio,contexts}=harness();await audio.unlock();
 const context=contexts[0];
 for(const options of [{sound:false},{sound:true,volume:0},{volume:1,soundVolume:0}]){
  audio.set(options);const count=context.nodes.length;
  audio.event({type:'tactic',row:2},{status:'playing'});
  assert.equal(context.nodes.length,count);
 }
 audio.set({soundVolume:.65});
 const count=context.nodes.length;
 audio.update({status:'paused'});
 audio.event({type:'tactic',row:2});
 assert.equal(context.nodes.length,count);
 audio.event({type:'tactic',row:2},{status:'playing'});
 assert.ok(context.nodes.length>count,'paused events do not consume the cue cooldown');
});
