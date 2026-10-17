(function(root){
'use strict';

// Original procedural score and locally synthesized samples; no borrowed assets.
const THEMES=Object.freeze([
 {id:'morning',name:{zh:'晨露小调',en:'Dew on the leaves'},bpm:88,root:60,scale:[0,2,4,7,9],melody:[0,2,4,-1,3,2,1,-1,0,1,3,-1,4,2,0,-1],chords:[0,3,1,4],decay:.74,tone:'pluck'},
 {id:'noon',name:{zh:'树影午后',en:'Under the noon shade'},bpm:98,root:62,scale:[0,2,4,7,9],melody:[2,4,-1,3,1,-1,0,2,3,4,2,-1,1,3,0,-1],chords:[0,2,4,1],decay:.57,tone:'pluck'},
 {id:'dusk',name:{zh:'晚风门廊',en:'Porch at dusk'},bpm:78,root:57,scale:[0,2,3,7,10],melody:[4,-1,2,1,0,-1,3,-1,2,3,1,-1,0,2,1,-1],chords:[0,2,3,1],decay:.91,tone:'sine'},
 {id:'night',name:{zh:'雾中的灯',en:'A light in the fog'},bpm:70,root:55,scale:[0,2,5,7,10],melody:[0,-1,3,-1,4,2,-1,1,3,-1,2,-1,0,1,-1,-1],chords:[0,3,1,2],decay:1.08,tone:'sine'}
]);
const MAX_VOICES=44,MAX_MUSIC=18,LOOKAHEAD=.18;
let ctx=null,master=null,musicBus=null,soundBus=null,musicFilter=null,room=null,roomGain=null,limiter=null,pluckWave=null,noiseBuffer=null;
let layerBuses={},samples=new Map(),samplePromise=null,threat=0,lastThreat=-1,duckUntil=0,duckDepth=1,duckActive=false;
// No audio context exists until unlock() runs inside the player's gesture.
let prefs={sound:true,music:true,volume:1,soundVolume:.65,musicVolume:.2},activeState=null,mode='',world=0,nextStep=0,stepIndex=0,disposed=false,musicGate=false;
const voices=new Set(),cooldowns=new Map();
let eventIndex=0;
const midi=n=>440*Math.pow(2,(n-69)/12),clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function time(){return ctx?ctx.currentTime:0;}
function param(p,value,at=time(),smooth=.012){
 if(!p)return;try{p.cancelScheduledValues(at);p.setTargetAtTime(value,at,smooth);}catch{p.value=value;}
}
function forget(v){if(!voices.has(v))return;voices.delete(v);for(const n of v.nodes)try{n.disconnect();}catch{}}
function stop(v,at=time()){
 if(!voices.has(v))return;try{v.gain.gain.cancelScheduledValues(at);v.gain.gain.setTargetAtTime(.0001,at,.004);v.source.stop(at+.02);}catch{}forget(v);
}
function stopGroup(group){for(const v of [...voices])if(v.group===group)stop(v);}
function stopAll(){for(const v of [...voices])stop(v);}
function gateMusic(enabled,force=false){if(musicGate===enabled&&!force)return;musicGate=enabled;const duck=time()<duckUntil?duckDepth:1;param(musicBus?.gain,enabled?.48*prefs.musicVolume*duck:0);param(roomGain?.gain,enabled?.11*duck:0);}
function duck(seconds,depth=.42){duckUntil=Math.max(duckUntil,time()+seconds);duckDepth=Math.min(duckDepth,depth);duckActive=true;gateMusic(musicGate,true);}
function onVisibility(){if(root.document?.hidden){gateMusic(false);stopAll();mode='';nextStep=0;stepIndex=0;}}
function canPlay(group){return !!ctx&&ctx.state==='running'&&!disposed&&!root.document?.hidden&&prefs.volume>0&&(group==='music'?prefs.music&&prefs.musicVolume>0:prefs.sound&&prefs.soundVolume>0);}
function sweep(){for(const v of [...voices])if(v.end<time()-.05)forget(v);}
function voice(group,note,at,duration=.3,level=.12,tone='pluck',pan=0,endNote,layer='calm'){
 if(!canPlay(group))return;
 sweep();const members=[...voices].filter(v=>v.group===group);
 if(group==='music'&&members.length>=MAX_MUSIC)return;
 if(voices.size>=MAX_VOICES){const oldest=[...voices].sort((a,b)=>a.end-b.end)[0];if(oldest)stop(oldest);}
 at=Math.max(time()+.002,at);duration=clamp(duration,.045,3.3);
 const oscillator=ctx.createOscillator(),gain=ctx.createGain(),nodes=[oscillator,gain];
 if(tone==='pluck'&&pluckWave)oscillator.setPeriodicWave(pluckWave);else oscillator.type=tone==='bass'?'triangle':tone==='metal'?'triangle':'sine';
 oscillator.frequency.setValueAtTime(midi(note),at);
 if(Number.isFinite(endNote))oscillator.frequency.exponentialRampToValueAtTime(midi(endNote),at+duration*.8);
 gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(Math.max(.0002,level),at+.009);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
 oscillator.connect(gain);let output=gain;
 if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.setValueAtTime(clamp(pan,-.3,.3),at);gain.connect(p);output=p;nodes.push(p);}
 output.connect(group==='music'?(layerBuses[layer]||musicBus):soundBus);
 const v={source:oscillator,gain,nodes,group,layer:group==='music'?layer:null,end:at+duration+.02};voices.add(v);oscillator.onended=()=>forget(v);
 oscillator.start(at);oscillator.stop(v.end);
}
function noise(at,duration=.16,level=.09,frequency=1200,pan=0){
 if(!canPlay('sound')||!noiseBuffer)return;
 sweep();if(voices.size>=MAX_VOICES)return;
 at=Math.max(time()+.002,at);const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
 source.buffer=noiseBuffer;filter.type='bandpass';filter.frequency.setValueAtTime(frequency,at);filter.Q.value=.7;
 gain.gain.setValueAtTime(level,at);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
 source.connect(filter);filter.connect(gain);const nodes=[source,filter,gain];let output=gain;
 if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.setValueAtTime(clamp(pan,-.3,.3),at);gain.connect(p);output=p;nodes.push(p);}
 output.connect(soundBus);const v={source,gain,nodes,group:'sound',end:at+duration+.01};voices.add(v);source.onended=()=>forget(v);source.start(at);source.stop(v.end);
}
function samplePCM(kind){
 const rate=22050,durations={leaf:.09,wood:.13,metal:.21,stone:.17,glow:.24,coin:.18,boom:.46,kick:.18,hat:.065,brush:.14,action:.045},duration=durations[kind]||.12,length=Math.ceil(rate*duration),pcm=new Float32Array(length);let seed=7919,low=0,last=0;
 for(const ch of kind)seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;
 for(let i=0;i<length;i++){
  const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=seed/4294967296*2-1;low=low*.84+n*.16;const high=n-last;last=n;let value=0;
  if(kind==='leaf')value=(high*.25+Math.sin(t*6800)*.11)*Math.exp(-t*48);
  else if(kind==='wood')value=(low*.55+Math.sin(t*1040)*.3)*Math.exp(-t*30);
  else if(kind==='metal')value=(Math.sin(t*3299)+Math.sin(t*8677)*.43+Math.sin(t*13804)*.2)*.24*Math.exp(-t*18);
  else if(kind==='stone')value=(low*.8+Math.sin(t*540)*.23)*Math.exp(-t*24);
  else if(kind==='glow')value=(Math.sin(t*3141)+Math.sin(t*4712)*.4)*.26*Math.exp(-t*14);
  else if(kind==='coin')value=(Math.sin(t*8293)+Math.sin(t*12189)*.4)*.25*Math.exp(-t*22);
  else if(kind==='boom')value=(low*.9+Math.sin(t*(420-t*200))*.2)*Math.exp(-t*8);
  else if(kind==='kick')value=Math.sin(t*(850-t*1900))*.35*Math.exp(-t*27);
  else if(kind==='hat')value=high*.25*Math.exp(-t*62);
  else if(kind==='brush')value=low*.42*Math.exp(-t*22);
  else value=Math.sin(t*2701)*.22*Math.exp(-t*72);
  pcm[i]=clamp(value,-.9,.9)*Math.min(1,t/.002);
 }
 return {rate,pcm,duration};
}
function wav(pcm,rate){
 const buffer=new ArrayBuffer(44+pcm.length*2),view=new DataView(buffer),word=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
 word(0,'RIFF');view.setUint32(4,36+pcm.length*2,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,pcm.length*2,true);for(let i=0;i<pcm.length;i++)view.setInt16(44+i*2,Math.round(pcm[i]*32767),true);return buffer;
}
function prepareSamples(){
 if(samplePromise)return samplePromise;const target=ctx;
 samplePromise=Promise.all(['leaf','wood','metal','stone','glow','coin','boom','kick','hat','brush','action'].map(async kind=>{
  const rendered=samplePCM(kind);let buffer;
  try{if(target.decodeAudioData)buffer=await target.decodeAudioData(wav(rendered.pcm,rendered.rate));}catch{}
  if(!buffer&&target.createBuffer){buffer=target.createBuffer(1,rendered.pcm.length,rendered.rate);buffer.getChannelData(0).set(rendered.pcm);}
  if(ctx===target&&!disposed&&buffer)samples.set(kind,buffer);
 }));return samplePromise;
}
function bufferVoice(kind,group,at,level=.2,pan=0,rate=1,layer='percussion'){
 if(!canPlay(group))return false;const buffer=samples.get(kind);if(!buffer)return false;sweep();
 if(group==='music'&&[...voices].filter(v=>v.group==='music').length>=MAX_MUSIC)return false;
 if(voices.size>=MAX_VOICES){if(group==='music')return false;const oldest=[...voices].sort((a,b)=>a.end-b.end)[0];if(oldest)stop(oldest);}
 const source=ctx.createBufferSource(),gain=ctx.createGain(),nodes=[source,gain];source.buffer=buffer;rate=clamp(rate,.55,1.65);source.playbackRate.setValueAtTime(rate,time());at=Math.max(time()+.002,at);
 const duration=(buffer.duration||buffer.length/(buffer.sampleRate||22050))/rate;gain.gain.setValueAtTime(level,at);gain.gain.setTargetAtTime(.0001,at+duration*.65,Math.max(.008,duration*.14));source.connect(gain);let output=gain;
 if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.setValueAtTime(clamp(pan,-.3,.3),at);gain.connect(p);output=p;nodes.push(p);}
 output.connect(group==='music'?(layerBuses[layer]||musicBus):soundBus);const v={source,gain,nodes,group,layer:group==='music'?layer:null,end:at+duration+.02};voices.add(v);source.onended=()=>forget(v);source.start(at);source.stop(v.end);return true;
}
function panFor(ev){const row=Number.isFinite(ev?.row)?ev.row:Number.isFinite(ev?.y)?Math.floor((ev.y-120)/86):2;return (clamp(row,0,4)-2)*.12;}
function impact(ev,state,kind='hit'){
 const nearby=ev.enemyType||state?.enemies?.find(e=>Math.hypot(e.x-(ev.x||0),e.y-(ev.y||0))<40)?.type,d=root.GardenEngine?.ENEMIES?.[nearby],p=root.GardenEngine?.PLANTS?.[ev.plantType];
 const material=['leaf','wood','metal','stone','glow'].includes(ev.material)?ev.material:d?.armor?'metal':d?.boss||nearby==='brute'?'stone':p?.class==='defense'?(ev.plantType==='ironwall'?'metal':'wood'):p?.class==='light'||p?.class==='air'?'glow':'leaf';
 const size=clamp(Number(ev.size)||(ev.size==='large'?1.6:ev.size==='small'?.7:d?.boss?1.6:nearby==='brute'?1.35:.85),.6,1.8),pan=panFor(ev),now=time()+.003,notes={leaf:61,wood:48,metal:74,stone:38,glow:82};
 if(!bufferVoice(material,'sound',now,(kind==='kill'?.31:.2)*size,pan,1/Math.sqrt(size)))noise(now,.075,.04*size,material==='metal'?2200:material==='stone'?250:850,pan);
 voice('sound',notes[material]-Math.round((size-1)*5),now,.055+size*.05,(kind==='kill'?.065:.036)*size,material==='metal'?'metal':material==='stone'?'bass':'pluck',pan,notes[material]-7);
}
function initialize(){
 const Constructor=root.AudioContext||root.webkitAudioContext;if(!Constructor)return false;
 ctx=new Constructor();master=ctx.createGain();musicBus=ctx.createGain();soundBus=ctx.createGain();musicFilter=ctx.createBiquadFilter();
 musicFilter.type='lowpass';musicFilter.frequency.value=2200;musicFilter.Q.value=.35;
 layerBuses={};for(const [id,value] of Object.entries({calm:.96,pulse:.12,percussion:.04})){const bus=ctx.createGain();bus.gain.value=value;bus.connect(musicBus);layerBuses[id]=bus;}threat=0;lastThreat=-1;duckUntil=0;duckDepth=1;duckActive=false;
 master.gain.value=prefs.volume;musicBus.gain.value=0;soundBus.gain.value=prefs.sound?.62*prefs.soundVolume:0;musicGate=false;
 musicBus.connect(musicFilter);musicFilter.connect(master);soundBus.connect(master);
 if(ctx.createDynamicsCompressor){limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-10;limiter.knee.value=16;limiter.ratio.value=6;limiter.attack.value=.003;limiter.release.value=.13;master.connect(limiter);limiter.connect(ctx.destination);}else master.connect(ctx.destination);
 if(ctx.createDelay){room=ctx.createDelay(.4);room.delayTime.value=.17;roomGain=ctx.createGain();roomGain.gain.value=0;musicFilter.connect(room);room.connect(roomGain);roomGain.connect(master);}
 if(ctx.createPeriodicWave){const real=new Float32Array(6),imag=new Float32Array([0,1,.22,.08,.028,.012]);pluckWave=ctx.createPeriodicWave(real,imag);}
 if(ctx.createBuffer){noiseBuffer=ctx.createBuffer(1,Math.max(1,Math.floor(ctx.sampleRate*.8)),ctx.sampleRate);const data=noiseBuffer.getChannelData(0);let seed=7919;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*.6;}}
 root.document?.addEventListener?.('visibilitychange',onVisibility);disposed=false;return true;
}
async function unlock(){
 try{if(!ctx&&!initialize())return false;if(ctx.state!=='running'&&ctx.resume)await ctx.resume();disposed=false;await prepareSamples();return !!ctx&&ctx.state==='running';}catch{return false;}
}
function set(options={}){
 if(typeof options.sound==='boolean')prefs.sound=options.sound;
 if(typeof options.music==='boolean')prefs.music=options.music;
 if(Number.isFinite(options.volume))prefs.volume=clamp(options.volume,0,1);
 if(Number.isFinite(options.soundVolume))prefs.soundVolume=clamp(options.soundVolume,0,1);
 if(Number.isFinite(options.musicVolume))prefs.musicVolume=clamp(options.musicVolume,0,1);
 if(!ctx)return;
 param(master.gain,prefs.volume);param(soundBus.gain,prefs.sound?.62*prefs.soundVolume:0);gateMusic(canPlay('music')&&activeState?.status==='playing'&&!root.document?.hidden,true);
 if(!prefs.sound||prefs.volume===0||prefs.soundVolume===0)stopGroup('sound');
 if(!prefs.music||prefs.volume===0||prefs.musicVolume===0){stopGroup('music');mode='';nextStep=0;stepIndex=0;}
}
function worldOf(state){const w=Number(state?.level?.world);return Number.isInteger(w)?clamp(w,0,3):clamp(Math.floor((state?.levelIndex||0)/3),0,3);}
function stateMode(state){
 const defs=root.GardenEngine?.ENEMIES||{};
 if(state?.enemies?.some(e=>e.hp>0&&(defs[e.type]?.boss||/boss|king|queen|lord|overlord/.test(e.type))))return 'boss';
 return state?.phase==='flag'?'flag':'normal';
}
function sequence(theme,kind,index,at){
 const beat=60/(kind==='boss'?96:kind==='flag'?108:theme.bpm),step=beat*.5;
 const chord=theme.chords[Math.floor(index/16)%theme.chords.length];
 if(kind==='normal'){
  const degree=theme.melody[index%theme.melody.length];
  if(degree>=0)voice('music',theme.root+12+theme.scale[degree],at,theme.decay,.068+(index%4===0?.015:0),theme.tone,Math.sin(index*.9)*.18,undefined,'calm');
  if(index%8===0){voice('music',theme.root+theme.scale[chord],at,Math.min(2.8,beat*3),.039,'sine',-.12,undefined,'calm');voice('music',theme.root+7+theme.scale[chord],at,Math.min(2.8,beat*3),.028,'sine',.12,undefined,'calm');}
  if(index%2===0)voice('music',theme.root-12+theme.scale[chord]+(index%4===2?7:0),at,beat*.72,.09,'bass',0,undefined,'pulse');
 }else if(kind==='flag'){
  const motif=[0,7,3,10,0,7,5,3];voice('music',theme.root-12+motif[index%8],at,step*.9,.105,'bass',0,undefined,'pulse');
  if(index%2===0)voice('music',theme.root+12+motif[(index+2)%8],at,.28,.057,'pluck',.16,undefined,'calm');
 }else{
  const motif=[0,-1,7,3,0,10,7,-1];if(motif[index%8]>=0)voice('music',theme.root-19+motif[index%8],at,.4,.112,'bass',0,undefined,'pulse');
  if(index%4===2)voice('music',theme.root+5+(index%16===14?1:0),at,.84,.06,'sine',-.16,theme.root+3,'calm');
 }
 const percussion=index%4===0?'kick':index%2===0?(theme.id==='night'?'brush':'hat'):'brush';
 if(!bufferVoice(percussion,'music',at,index%4===0?.27:.16,index%2?.1:-.1,theme.id==='dusk'?.87:1,'percussion'))voice('music',index%4===0?35:89,at,.07,.025,'sine',0,undefined,'percussion');
 return step;
}
function mixLayers(state){
 const enemies=(state.enemies||[]).filter(e=>e.hp>0),near=enemies.filter(e=>e.x<520).length,fragile=(state.plants||[]).some(p=>p.stage==='sprout'&&p.hit>0&&p.hp/p.maxHp<.65);
 threat=clamp(mode==='boss'?.96:mode==='flag'?.76:enemies.length*.034+near*.12+(fragile?.22:0),0,1);
 if(Math.abs(threat-lastThreat)>.025){lastThreat=threat;param(layerBuses.calm?.gain,.96-threat*.29,time(),.08);param(layerBuses.pulse?.gain,.12+threat*.85,time(),.08);param(layerBuses.percussion?.gain,.04+threat*.78,time(),.08);}
 if(duckActive&&time()>=duckUntil){duckActive=false;duckDepth=1;gateMusic(musicGate,true);}
}
function update(state){
 activeState=state||null;if(!ctx)return;
 const inactive=!state||state.status!=='playing'||root.document?.hidden;
 if(inactive||!canPlay('music')){gateMusic(false);if(mode||[...voices].some(v=>v.group==='music'))stopGroup('music');mode='';nextStep=0;stepIndex=0;return;}
 gateMusic(true);
 sweep();const newWorld=worldOf(state),newMode=stateMode(state);
 if(mode!==newMode||world!==newWorld){stopGroup('music');world=newWorld;mode=newMode;nextStep=time()+.03;stepIndex=0;lastThreat=-1;if(newMode==='boss')duck(1.9,.4);if(newMode==='flag')duck(3,.43);}
 mixLayers(state);
 if(nextStep<time()-.05)nextStep=time()+.015;
 let scheduled=0;while(nextStep<time()+LOOKAHEAD&&scheduled++<4){nextStep+=sequence(THEMES[world],mode,stepIndex++,nextStep);}
}
function category(id){
 const d=root.GardenEngine?.ENEMIES?.[id]||{},key=String(id||'').toLowerCase();
 if(/boss_morning/.test(key))return 'boss_morning';if(/boss_noon/.test(key))return 'boss_noon';if(/boss_dusk/.test(key))return 'boss_dusk';
 if(d.boss||/boss|king|queen|lord|overlord|colossus/.test(key))return 'boss';
 if(/burrow|digger|miner/.test(key))return 'burrow';
 if(/push|bulldozer|trolley/.test(key))return 'pusher';
 if(/bat/.test(key))return 'bat';
 if(d.flying||/wisp|ghost|bat|fly|specter|phantom/.test(key))return 'flying';
 if(/summon|caller|witch|necrom|spore/.test(key)||d.summon)return 'summoner';
 if(/heal|medic|doctor|nurse/.test(key)||d.heal)return 'healer';
 if(/leap|vault|jump|pole|hopper/.test(key))return 'leaper';
 if(/brute|giant|tank|armor|tin|bucket|shield|knight|heavy/.test(key)||d.armor)return 'armored';
 if(/dash|run|sprint|fast|skate|sport/.test(key)||Number(d.speed)>35)return 'runner';
 return 'walker';
}
const ENEMY_CUES=Object.freeze({
 walker:[42,45],runner:[58,63,67],armored:[33,45,34],leaper:[47,59,52],
 healer:[61,68,64],summoner:[40,43,35],flying:[77,84,79],bat:[72,78,75,82],
 pusher:[38,42,37],burrow:[31,34,28],boss:[28,35,29,40],
 boss_morning:[34,41,38,46],boss_noon:[29,36,33,41],boss_dusk:[37,40,30,35]
});
function enemyCue(id,row,hidden=false){
 const kind=category(id),notes=ENEMY_CUES[kind],boss=kind==='boss'||kind.startsWith('boss_'),pan=Number.isFinite(row)?(clamp(row,0,4)-2)*.17:0,now=time()+.006;
 const spacing=boss?.22:kind==='runner'||kind==='bat'?.085:kind==='flying'?.17:kind==='burrow'?.19:.14;
 notes.forEach((n,i)=>voice('sound',n,now+i*spacing,hidden?.31:.22,hidden?.13:.12,kind==='flying'||kind==='healer'||kind==='boss_dusk'?'sine':kind==='armored'||kind==='boss_noon'?'metal':'pluck',pan));
 if(kind==='armored'||boss||kind==='burrow'||kind==='pusher')noise(now,.24,hidden?.1:.08,boss||kind==='burrow'?180:kind==='pusher'?650:950,pan);
 if(hidden&&kind==='walker')noise(now+.12,.21,.075,420,pan);
}
function allowed(key,seconds){const now=time();if((cooldowns.get(key)??-999)>now-seconds)return false;cooldowns.set(key,now);if(cooldowns.size>100)cooldowns.delete(cooldowns.keys().next().value);return true;}
function event(ev,state=activeState){
 if(!canPlay('sound'))return;
 if(typeof ev==='string')ev={type:ev};if(!ev||typeof ev!=='object')return;
 const type=String(ev.type||''),now=time()+.005;eventIndex++;
 if(['presence','warning','newzombie','newZombie','new-zombie','newEnemy','encounter','spawn','emerge','bossEntrance'].includes(type)||root.GardenEngine?.ENEMIES?.[type]){
  const id=ev.enemyType||(root.GardenEngine?.ENEMIES?.[type]?type:ev.zombieType||'moss'),hidden=type==='presence';
  if(type==='bossEntrance')duck(2.4,.36);
  if(allowed(`${hidden?'fog':'enemy'}:${id}:${Number.isFinite(ev.row)?ev.row:'all'}`,hidden?1.3:2.1))enemyCue(id,ev.row,hidden);return;
 }
 if(type==='chooseBranch'||type==='branch'){if(allowed('branch',.04)){const base=ev.branch==='b'?64:67;[0,5,9].forEach((n,i)=>voice('sound',base+n,now+i*.055,.26,.09,'pluck',panFor(ev)));bufferVoice('glow','sound',now,.17,panFor(ev));}return;}
 if(type==='bond'){if(allowed('bond',.08)){voice('sound',68,now,.31,.095,'sine',-.1);voice('sound',75,now+.06,.34,.095,'sine',.1);bufferVoice('glow','sound',now,.22);}return;}
 if(type==='draft'||type==='choosePerk'){if(allowed(type,.035)){bufferVoice('leaf','sound',now,.2);voice('sound',65,now,.105,.068,'pluck',0,72);}return;}
 if(type==='action'||type==='focus'){if(allowed('action',.025)){if(!bufferVoice('action','sound',now,.24,panFor(ev)))voice('sound',64,now,.045,.049,'pluck',panFor(ev));}return;}
 if(type==='error'){if(allowed('error',.12)){voice('sound',52,now,.085,.082,'pluck');voice('sound',48,now+.075,.115,.075,'pluck');}return;}
 if(['flag','big-wave','flagWave'].includes(type)){
  if(!allowed('flag',2.8))return;
  duck(3.05,.42);
  [0,.85,1.7].forEach((offset,i)=>{voice('sound',40+i*2,now+offset,.42,.14,'bass');voice('sound',64-i,now+offset+.06,.19,.09,'metal');});
  voice('sound',47,now+2.55,.45,.17,'bass');noise(now+2.55,.43,.13,360);return;
 }
 if(type==='wave'){if(allowed('wave',1)){voice('sound',52,now,.24,.105,'pluck');voice('sound',59,now+.18,.32,.115,'pluck');}return;}
 if(type==='plant'||type==='upgrade'||type==='grown'){if(allowed(type,.035)){impact(ev,state,'plant');voice('sound',type==='upgrade'||type==='grown'?74:64,now+.04,.19,.082,'pluck',panFor(ev));if(type!=='plant')bufferVoice('glow','sound',now,.22,panFor(ev));if(type==='upgrade'&&ev.branch){const base=ev.branch==='b'?64:67;voice('sound',base+5,now+.085,.26,.064,'pluck',panFor(ev));voice('sound',base+9,now+.135,.26,.064,'pluck',panFor(ev));}}return;}
 if(type==='collect'){if(allowed('collect',.035)){if(!bufferVoice('coin','sound',now,.26))voice('sound',76+(eventIndex%3)*2,now,.12,.085,'sine');voice('sound',88,now+.025,.11,.033,'sine');}return;}
 if(type==='combo'){if(allowed('combo',.23)){const level=clamp(Number(ev.combo||ev.count||2),2,8);[0,4,7].forEach((n,i)=>voice('sound',65+level+n,now+i*.055,.22,.095,'pluck'));}return;}
 if(type==='shot'){if(allowed('shot',.14))voice('sound',ev.plantType==='frost'?86:64,now,.075,.037,'pluck',panFor(ev),ev.plantType==='frost'?77:55);return;}
 if(type==='hit'||type==='kill'||type==='bite'){if(allowed(type+':'+Math.round((ev.y||0)/86),.065))impact(ev,state,type);return;}
 if(type==='boom'||type==='sweep'){if(allowed(type,.25)){if(!bufferVoice('boom','sound',now,type==='boom'?.8:.5,panFor(ev)))noise(now,type==='boom'?.62:.5,.23,type==='boom'?190:650,panFor(ev));voice('sound',type==='boom'?30:38,now,.58,.18,'bass',panFor(ev),24);}return;}
 if(type==='enrage'){if(allowed('enrage',2)){enemyCue(ev.enemyType||'boss',2);voice('sound',32,now+.5,.9,.17,'bass',0,26);}return;}
 if(type==='darkness'){if(allowed('darkness',2)){voice('sound',40,now,.65,.14,'sine',0,31);noise(now,.55,.075,280);}return;}
 if(type==='chain'){if(allowed('chain',.2)){noise(now,.11,.085,2100);voice('sound',83,now,.16,.062,'sine',0,76);}return;}
 if(type==='push'||type==='shove'){if(allowed(type,.2)){noise(now,.14,.058,650);voice('sound',52,now,.13,.052,'sine',0,46);}return;}
 if(type==='bind'){if(allowed('bind',.3))voice('sound',47,now,.15,.06,'pluck');return;}
 if(type==='shield'){if(allowed('shield',.15)){bufferVoice('wood','sound',now,.23,panFor(ev));voice('sound',70,now,.2,.075,'sine',panFor(ev));}return;}
 if(type==='plantLost'){if(allowed('plantLost:'+panFor(ev),.08)){bufferVoice('leaf','sound',now,.25,panFor(ev),.8);voice('sound',48,now,.15,.05,'pluck',panFor(ev),36);}return;}
 if(type==='portal'||type==='jump'){if(allowed(type,.2))voice('sound',61,now,.14,.06,'sine',panFor(ev),73);return;}
 if(type==='summon'){if(allowed('summon',.5)){voice('sound',42,now,.19,.067,'sine');voice('sound',37,now+.12,.24,.062,'sine');}return;}
 if(type==='remove'){if(allowed('remove',.1))noise(now,.12,.08,650);return;}
 if(type==='win'||type==='clear'){
  if(!allowed(type,1))return;const notes=type==='win'?[60,64,67,72,76,79]:[60,64,67];notes.forEach((n,i)=>voice('sound',n,now+i*.12,type==='win'?.53:.25,.115,'pluck'));return;
 }
 if(type==='loss'){if(allowed('loss',1)){[55,52,48,43].forEach((n,i)=>voice('sound',n,now+i*.18,.65,.12,'sine'));}return;}
}
async function dispose(){
 disposed=true;stopAll();mode='';activeState=null;musicGate=false;cooldowns.clear();root.document?.removeEventListener?.('visibilitychange',onVisibility);
 if(ctx){const old=ctx;ctx=null;for(const n of [master,musicBus,soundBus,musicFilter,room,roomGain,limiter,...Object.values(layerBuses)])try{n?.disconnect();}catch{}master=musicBus=soundBus=musicFilter=room=roomGain=limiter=null;try{await old.close?.();}catch{}}
 layerBuses={};samples=new Map();samplePromise=null;duckUntil=0;duckDepth=1;duckActive=false;threat=0;lastThreat=-1;
}
function info(){return {unlocked:!!ctx&&ctx.state==='running',...prefs,world:THEMES[world].id,mode:mode||'silent',voices:voices.size,musicVoices:[...voices].filter(v=>v.group==='music').length,threat,ducking:time()<duckUntil,buffersDecoded:samples.size,layers:Object.fromEntries(Object.entries(layerBuses).map(([id,bus])=>[id,{gain:bus.gain.value,voices:[...voices].filter(v=>v.group==='music'&&v.layer===id).length}]))};}
root.GardenAudio=Object.freeze({unlock,set,update,event,dispose,info,THEMES,ENEMY_CUES});
})(typeof globalThis!=='undefined'?globalThis:this);
