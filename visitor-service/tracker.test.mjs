import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../portfolio-source/analytics/tracker.js',import.meta.url),'utf8');
async function browser({store=new Map(),path='/',privacy=false,disabled=false,configured=true,fail=false,endpoint='https://mjc-visitors.test.workers.dev'}={}){
 const calls=[];const timers=[];const win={};const doc={cookie:'',visibilityState:'visible',addEventListener(){}};
 const localStorage={getItem(key){if(disabled)throw new Error('denied');return store.get(key)||null},setItem(key,value){if(disabled)throw new Error('denied');store.set(key,value)}};
 const context={location:{hostname:'majiacheng619-collab.github.io',pathname:path},navigator:{globalPrivacyControl:privacy,locks:{request:async(_,fn)=>fn()}},window:win,document:doc,localStorage,crypto,Date,setTimeout:fn=>timers.push(fn),setInterval(){},fetch:async(url,options)=>{calls.push({url,options});if(url.startsWith('/assets/'))return{ok:true,json:async()=>({endpoint:configured?endpoint:''})};if(fail)throw new Error('offline');return{ok:true,json:async()=>({ok:true,day:new Date(Date.now()+28800000).toISOString().slice(0,10)})}}};win.top=win.self=win;vm.runInNewContext(source,context);for(const fn of timers)await fn();return{calls,store};
}
test('reloads and page switches produce only one successful daily write',async()=>{const store=new Map();const first=await browser({store});assert.equal(first.calls.filter(c=>c.options?.method==='POST').length,1);const second=await browser({store,path:'/game/'});assert.equal(second.calls.length,0);});
test('persistent ID is reused on later days',async()=>{const store=new Map();await browser({store});const id=store.get('mjc-visitor-id-v1');store.set('mjc-visitor-day-v1','2000-01-01');const next=await browser({store});assert.equal(JSON.parse(next.calls.at(-1).options.body).visitorId,id);});
test('private dashboard and privacy pages never count',async()=>{for(const path of ['/visitors/','/privacy/'])assert.equal((await browser({path})).calls.length,0);});
test('privacy signal, owner exclusion and opt-out skip tracking',async()=>{assert.equal((await browser({privacy:true})).calls.length,0);for(const key of ['mjc-visitor-owner','mjc-visitor-opt-out'])assert.equal((await browser({store:new Map([[key,'1']])})).calls.length,0);});
test('blocked storage skips instead of inventing a new ID on reload',async()=>{assert.equal((await browser({disabled:true})).calls.length,0);});
test('unconfigured service makes no collection request',async()=>{const {calls,store}=await browser({configured:false});assert.equal(calls.length,1);assert.equal(store.size,0);});
test('failed writes are retryable with the same identifier',async()=>{const store=new Map();await browser({store,fail:true});const id=store.get('mjc-visitor-id-v1');assert(!store.has('mjc-visitor-day-v1'));const retry=await browser({store});assert.equal(JSON.parse(retry.calls.at(-1).options.body).visitorId,id);});

test('Pages-hosted endpoint records visits with the same identity contract',async()=>{const {calls}=await browser({endpoint:'https://mjc-visitor-records-619.pages.dev'});assert.equal(calls.filter(c=>c.options?.method==='POST').length,1);assert.equal(calls.at(-1).url,'https://mjc-visitor-records-619.pages.dev/visit');});
