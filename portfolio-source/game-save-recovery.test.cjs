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
