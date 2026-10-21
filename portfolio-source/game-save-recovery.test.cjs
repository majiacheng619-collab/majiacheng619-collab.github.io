'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const E=require('./game-runtime/garden-engine.js');
const primary='sprout-story-v5';
function storage(values={}){
 const data=new Map(Object.entries(values).map(([key,value])=>[key,typeof value==='string'?value:JSON.stringify(value)]));
 return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),data};
}
function setup(values={},sessionValues={},blind=false){
 const local=storage(values),session=storage(sessionValues);
 const context=vm.createContext({GardenEngine:E,GardenCopy:{},URL,URLSearchParams,TextEncoder,Buffer,localStorage:local,sessionStorage:session,location:{href:'https://example.com/game.html',pathname:'/game.html',search:blind?'?blindtest=1':''},document:{readyState:'loading',addEventListener(){}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'game-runtime/garden-shared.js'),'utf8'),context);
 return {ui:context.GardenUI,local,session};
}
function progress(cleared=7){const p=E.freshProgress();p.cleared=cleared;p.stars.fill(3,0,cleared);return p;}
const checkpoint=data=>({data,crc:E.crc(JSON.stringify(data))});
for(const raw of [{schema:999,cleared:0},{schema:6,cleared:'7'},{schema:6,cleared:-1},{schema:6,cleared:21},{schema:6,cleared:null},{schema:6,cleared:7,stars:{}},[],true,'{broken']){
 test('recover valid checkpoint from invalid primary '+JSON.stringify(raw),()=>{
  const backup=checkpoint(progress());const {ui,local}=setup({[primary]:raw,[primary+'-checkpoint']:backup});
  assert.equal(ui.progress().cleared,7);
  assert.deepEqual(JSON.parse(local.getItem(primary+'-checkpoint')),backup,'reads must preserve the checkpoint');
 });
}
test('healthy current primary wins over older checkpoint',()=>{const {ui}=setup({[primary]:progress(9),[primary+'-checkpoint']:checkpoint(progress(7))});assert.equal(ui.progress().cleared,9);});
test('checksum cannot make an unsupported checkpoint valid',()=>{const {ui}=setup({[primary]:{schema:999},[primary+'-checkpoint']:checkpoint({schema:999,cleared:7})});assert.equal(ui.progress().cleared,0);});
test('checksum corruption falls back to legacy without losing its museum record',()=>{const {ui}=setup({[primary]:{schema:6,cleared:'bad'},[primary+'-checkpoint']:{data:progress(),crc:'wrong'},'sprout-story-v4':{schema:4,cleared:5,stars:[3,3,3,3,3]}});assert.equal(ui.progress().legacy.cleared,5);});
test('version 5 migration retains cleared chapters and earned plants',()=>{const p=progress(18);p.schema=5;const {ui}=setup({[primary]:p});const result=ui.progress();assert.equal(result.cleared,18);assert.equal(result.schema,6);assert.ok(result.earned.includes('storm'));assert.ok(result.earned.includes('mint'));});
test('optional legacy fields may be missing and are sanitized',()=>{const {ui}=setup({[primary]:{schema:5,cleared:2}});assert.equal(ui.progress().cleared,2);assert.equal(ui.progress().stars.length,20);});
test('blind test recovers only from isolated session progress',()=>{const key='sprout-blind-story-v5';const {ui}=setup({[primary]:progress(15)},{[key]:{schema:999},[key+'-checkpoint']:checkpoint(progress(3))},true);assert.equal(ui.progress().cleared,3);});

for(const difficulty of ['toString','constructor','__proto__'])test('stored prototype name cannot become a difficulty: '+difficulty,()=>{
 const {ui}=setup({'sprout-settings-v5':{difficulty}});
 assert.equal(ui.prefs().difficulty,'standard');
});
for(const raw of [{},true,'"broken"',[null,{},true,{date:1,version:'5.0.0',code:'bad'}]])test('corrupt backup history does not block migration or a recoverable reset: '+JSON.stringify(raw),()=>{
 const p=progress(7);p.schema=5;
 const {ui,local}=setup({[primary]:p,'sprout-backups-v5':raw});
 assert.equal(ui.progress().cleared,7);
 assert.doesNotThrow(()=>ui.backup(ui.progress(),null));
 const records=JSON.parse(local.getItem('sprout-backups-v5'));
 assert.ok(Array.isArray(records));assert.ok(records.length<=3);
 assert.ok(records.every(record=>typeof record.date==='string'&&typeof record.code==='string'));
});
test('backup sanitation preserves valid records and isolates blind-test history',()=>{
 const good={date:'2026-10-21T10:00:00.000Z',version:'7.0.0',code:'SP6-valid'};
 const {ui}=setup({'sprout-backups-v5':[good]},{'sprout-blind-backups-v5':[null,good,{}]},true);
 assert.equal(ui.backups().length,1);assert.equal(ui.backups()[0].code,good.code);
});
test('update button activates the latest waiting worker after successive installations',async()=>{
 const events={},workerEvents={},sent=[];let click,box=null;
 const first={postMessage:()=>sent.push('first')},second={state:'installed',postMessage:()=>sent.push('second'),addEventListener:(name,fn)=>workerEvents[name]=fn};
 const registration={waiting:first,installing:second,addEventListener:(name,fn)=>workerEvents[name]=fn};
 const context=vm.createContext({navigator:{serviceWorker:{controller:{},register:async()=>registration,addEventListener(){}}},location:{protocol:'https:',search:''},URLSearchParams,Event,window:{addEventListener:(name,fn)=>events[name]=fn,dispatchEvent(){}},document:{getElementById:()=>box,createElement:()=>({setAttribute(){},querySelector:()=>({set onclick(fn){click=fn;}})}),body:{appendChild(value){box=value;}},addEventListener(){}},setInterval(){}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'game-runtime/garden-pwa.js'),'utf8'),context);
 await events.load();workerEvents.updatefound();workerEvents.statechange();click();
 assert.deepEqual(sent,['second']);
});
