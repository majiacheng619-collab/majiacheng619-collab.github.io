'use strict';
// Run the shipped controller against a small DOM/animation host. Assertions use
// observable navigation, pointer ownership and painted geometry, not its helpers.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'glass-dock.js'),'utf8');

class Surface {
 constructor(){this.listeners=new Map();this.attrs=new Map();this.dataset={};this.values=new Map();this.childNodes=[];this.style={setProperty:(k,v)=>this.values.set(k,v)};}
 append(node){if(node.parentNode)node.parentNode.childNodes.splice(node.parentNode.childNodes.indexOf(node),1);this.childNodes.push(node);node.parentNode=this;} querySelectorAll(){return [];} cloneNode(){return new Surface();}
 addEventListener(type,fn,options={}){const list=this.listeners.get(type)||[];list.push({fn,options});this.listeners.set(type,list);}
 emit(type,properties={}){const event={type,target:this,isTrusted:false,cancelable:true,button:0,isPrimary:true,pointerId:1,clientX:50,clientY:10,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...properties};for(const item of this.listeners.get(type)||[]){if(item.options.signal?.aborted)continue;item.fn(event);if(event.stopped)break;}return event;}
 setAttribute(k,v){this.attrs.set(k,String(v));} removeAttribute(k){this.attrs.delete(k);} hasAttribute(k){return this.attrs.has(k);} getAttribute(k){return this.attrs.get(k)??null;}
 toggleAttribute(k,on){if(on)this.setAttribute(k,'');else this.removeAttribute(k);}
}
function fixture({reduced=false,sections=false,pathname='/',frameDuration=16.667,storage=new Map(),active=0,storageBlocked=false,mediaSources=[]}={}){
 const dock=new Surface(),lens=new Surface(),media=new Surface(),doc=new Surface(),host=new Surface();
 let left=20,itemWidth=80,time=0,id=0;
 const timers=new Map(),frames=new Map(),navigations=[],captures=new Set(),observed=[],resizes=[],sectionNodes=new Map();
 const links=Array.from({length:5},(_,i)=>{const link=new Surface();link.setAttribute('data-dock-item','');link.setAttribute('data-dock-link','');link.href=`https://example.test/#section-${i}`;link.setAttribute('href',`#section-${i}`);link.closest=s=>s==='a'||s==='[data-dock-item]'?link:null;link.getBoundingClientRect=()=>({left:left+i*itemWidth,width:itemWidth});link.click=()=>{const e=dock.emit('click',{target:link});if(!e.defaultPrevented)navigations.push(link.href);};return link;});
 links.forEach((link,i)=>{link.append(new Surface());link.append(new Surface());if(sections){link.href=`https://example.test/index.html${i?'#section-'+i:''}`;link.setAttribute('href',new URL(link.href).pathname+new URL(link.href).hash);sectionNodes.set('section-'+i,new Surface());}});
 links[active].setAttribute('aria-current','location');
 dock.clientLeft=0;dock.querySelector=()=>lens;dock.querySelectorAll=()=>links;dock.getBoundingClientRect=()=>({left,right:left+itemWidth*5,top:700,height:70,width:itemWidth*5});dock.contains=n=>links.includes(n)||n===dock;dock.closest=()=>null;
 dock.setPointerCapture=n=>captures.add(n);dock.hasPointerCapture=n=>captures.has(n);dock.releasePointerCapture=n=>{captures.delete(n);dock.emit('lostpointercapture',{pointerId:n});};
 media.matches=reduced;doc.hidden=false;doc.querySelectorAll=()=>mediaSources;doc.querySelector=()=>dock;doc.getElementById=id=>sectionNodes.get(id)||null;doc.createElement=()=>new Surface();
 class IntersectionObserver {constructor(callback){this.callback=callback;observed.push(this);}observe(node){(this.nodes??=[]).push(node);}disconnect(){this.disconnected=true;}}
 class ResizeObserver {constructor(callback){this.callback=callback;resizes.push(this);}observe(node){this.node=node;}disconnect(){this.disconnected=true;}}
 host.innerWidth=440;host.innerHeight=800;host.IntersectionObserver=IntersectionObserver;
 host.ResizeObserver=ResizeObserver;
 const sessionStorage={getItem:key=>{if(storageBlocked)throw new Error('Blocked');return storage.get(key)||null;},setItem:(key,value)=>{if(storageBlocked)throw new Error('Blocked');storage.set(key,value);},removeItem:key=>{if(storageBlocked)throw new Error('Blocked');storage.delete(key);}};
 const context=vm.createContext({sessionStorage,window:host,document:doc,IntersectionObserver,ResizeObserver,matchMedia:()=>media,AbortController,URL,location:{href:'https://example.test'+pathname,origin:'https://example.test',pathname,assign:url=>navigations.push(url)},setTimeout:(fn,delay)=>{timers.set(++id,{fn,at:time+delay});return id;},clearTimeout:n=>timers.delete(n),scrollY:0,performance:{now:()=>time},addEventListener:host.addEventListener.bind(host),requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:n=>frames.delete(n)});
 vm.runInContext(source,context);
 function runTimers(){for(const [key,timer]of timers){if(timer.at<=time){timers.delete(key);timer.fn();}}}
 function settle(){for(let n=0;frames.size&&n<600;n++){const batch=[...frames];frames.clear();time+=frameDuration;for(const [,fn]of batch)fn(time);}assert.equal(frames.size,0,'animation must stop after settling');}
 return {storage,timers,advance(milliseconds){time+=milliseconds;runTimers();},dock,lens,links,media,doc,host,context,frames,navigations,captures,observed,resizes,sectionNodes,settle,step(){const batch=[...frames];frames.clear();time+=frameDuration;for(const [,fn]of batch)fn(time);},paint:key=>parseFloat(lens.values.get(key)),resize(width){itemWidth=width;host.emit('resize');},boot(){vm.runInContext(source,context);},motion(value){media.matches=value;media.emit('change');}};
}

test('initial lens aligns to the current real anchor and repeated initialization adds no handlers',()=>{
 const f=fixture();assert.equal(f.paint('--lens-x'),0);assert.equal(f.paint('--lens-width'),80);assert.equal(f.links.filter(a=>a.hasAttribute('aria-current')).length,1);
 assert.deepEqual(f.links.map(a=>a.getAttribute('href')),['#section-0','#section-1','#section-2','#section-3','#section-4']);
 const count=f.dock.listeners.get('pointerdown').length;f.boot();assert.equal(f.dock.listeners.get('pointerdown').length,count);
});
test('vertical touch intent preserves native scrolling and never captures or navigates',()=>{
 const f=fixture();f.dock.emit('pointerdown');const move=f.dock.emit('pointermove',{clientX:53,clientY:45});f.dock.emit('pointerup',{clientX:53,clientY:45});f.settle();
 assert.ok(!move.defaultPrevented);assert.equal(f.captures.size,0);assert.equal(f.navigations.length,0);assert.equal(f.paint('--lens-x'),0);
});
test('horizontal drag tracks between items then commits exactly one nearest real anchor',()=>{
 const f=fixture();f.dock.emit('pointerdown');const move=f.dock.emit('pointermove',{clientX:226});assert.equal(move.defaultPrevented,true);assert.equal(f.captures.size,1);assert.ok(f.dock.hasAttribute('data-dragging'));
 f.dock.emit('pointerup',{clientX:226});const keyboard=f.dock.emit('click',{target:f.links[2],isTrusted:true,detail:0});assert.ok(!keyboard.defaultPrevented,'drag must not swallow a keyboard activation');const compatibility=f.dock.emit('click',{target:f.links[2],isTrusted:true,detail:1});assert.equal(compatibility.defaultPrevented,true,'compatibility click must not navigate a second time');f.settle();assert.deepEqual(f.navigations,['https://example.test/#section-2']);assert.equal(f.paint('--lens-x'),160);assert.equal(f.captures.size,0);assert.ok(!f.dock.hasAttribute('data-dragging'));assert.equal(f.links.filter(a=>a.hasAttribute('aria-current')).length,1);
});
test('drag begun over an unselected destination follows the absolute finger position before release',()=>{
 for(const {start,move,cancel} of [{start:300,move:280,cancel:true},{start:220,move:240,cancel:false}]){
  const f=fixture();f.dock.emit('pointerdown',{target:f.links[cancel?3:2],clientX:start});f.dock.emit('pointermove',{clientX:move});
  for(let frame=0;frame<40;frame++)f.step();
  const expected=move-20-80/2;assert.ok(Math.abs(f.paint('--lens-x')-expected)<1,'Lens center must reach the finger over a non-current item, independent of the previous selection');assert.equal(f.links[0].getAttribute('aria-current'),'location','A drag preview must not commit its destination');assert.equal(f.navigations.length,0);
  if(cancel){f.dock.emit('pointercancel');f.settle();assert.equal(f.paint('--lens-x'),0);assert.equal(f.navigations.length,0);}
  else{f.dock.emit('pointerup',{clientX:move});f.settle();assert.equal(f.paint('--lens-x'),160);assert.deepEqual(f.navigations,['https://example.test/#section-2']);}
  assert.equal(f.captures.size,0);assert.ok(!f.dock.hasAttribute('data-dragging'));
 }
});
test('native anchor drag is disabled so HTML drag-and-drop cannot steal the liquid gesture',()=>{
 const f=fixture();assert.ok(f.links.every(link=>(link.getAttribute('draggable')??String(link.draggable))==='false'),'Every real dock anchor disables browser drag-and-drop');
 f.dock.emit('pointerdown',{target:f.links[0]});const nativeDrag=f.dock.emit('dragstart',{target:f.links[0]});assert.equal(nativeDrag.defaultPrevented,true,'Native dragstart must be canceled before it can cancel pointer input');
 f.dock.emit('pointermove',{clientX:226});assert.equal(f.captures.size,1);f.dock.emit('pointerup',{clientX:226});f.settle();assert.deepEqual(f.navigations,['https://example.test/#section-2']);assert.equal(f.paint('--lens-x'),160);
});
test('pointercancel restores the selected destination without activating a link',()=>{
 const f=fixture();f.dock.emit('pointerdown');f.dock.emit('pointermove',{clientX:290});f.dock.emit('pointercancel');f.settle();assert.equal(f.paint('--lens-x'),0);assert.equal(f.navigations.length,0);assert.equal(f.captures.size,0);assert.ok(!f.dock.hasAttribute('data-dragging'));
});
test('touch capture transfer keeps the drag alive and genuine capture loss restores selection',()=>{
 const f=fixture();f.dock.emit('pointerdown',{target:f.links[0]});f.dock.emit('pointermove',{clientX:226});assert.equal(f.captures.size,1);
 f.dock.emit('lostpointercapture',{target:f.links[0],pointerId:1});assert.equal(f.dock.getAttribute('data-dragging'),'true','Losing implicit anchor capture is harmless after the dock owns capture');
 f.dock.emit('lostpointercapture',{pointerId:9});assert.equal(f.dock.getAttribute('data-dragging'),'true','A different pointer cannot cancel the gesture');
 f.captures.delete(1);f.dock.emit('lostpointercapture',{pointerId:1});f.settle();assert.ok(!f.dock.hasAttribute('data-dragging'));assert.equal(f.paint('--lens-x'),0);assert.equal(f.navigations.length,0);
});
test('right button and secondary touch cannot begin a drag',()=>{
 for(const properties of [{button:2},{isPrimary:false}]){const f=fixture();f.dock.emit('pointerdown',properties);const e=f.dock.emit('pointermove',{clientX:290});f.dock.emit('pointerup',{clientX:290});assert.ok(!e.defaultPrevented);assert.equal(f.navigations.length,0);assert.equal(f.captures.size,0);}
});
test('motion preference switches cancel in-flight drag and remove animation work',()=>{
 const f=fixture();f.dock.emit('pointerdown');f.dock.emit('pointermove',{clientX:220});f.motion(true);assert.equal(f.frames.size,0);assert.equal(f.paint('--lens-x'),0);assert.equal(f.captures.size,0);f.links[3].click();assert.equal(f.paint('--lens-x'),240);assert.equal(f.frames.size,0);assert.equal(f.navigations.length,1);
});
test('resize cancels pointer ownership and measures fresh link widths',()=>{
 const f=fixture({reduced:true});f.links[2].click();f.dock.emit('pointerdown',{clientX:210});f.dock.emit('pointermove',{clientX:290});f.resize(65);assert.equal(f.captures.size,0);assert.equal(f.paint('--lens-x'),130);assert.equal(f.paint('--lens-width'),65);assert.equal(f.navigations.length,1);
});
test('keyboard focus stays distinct from page selection and Enter activates normally',()=>{
 const f=fixture({reduced:true});f.doc.activeElement=f.links[3];f.dock.emit('focusin',{target:f.links[3]});assert.equal(f.paint('--lens-x'),0);assert.equal(f.links[0].getAttribute('aria-current'),'location');assert.ok(!f.links[3].hasAttribute('data-active'));
 f.links[3].click();assert.equal(f.paint('--lens-x'),240);assert.equal(f.links[3].getAttribute('aria-current'),'location');assert.equal(f.navigations.length,1);
});
test('motion changes and ResizeObserver keep current-page geometry even with another item focused',()=>{
 const f=fixture();f.links[1].click();f.doc.activeElement=f.links[2];f.dock.emit('focusin',{target:f.links[2]});f.motion(true);assert.equal(f.paint('--lens-x'),80);assert.equal(f.frames.size,0);
 assert.equal(f.resizes.length,1);f.resizes[0].callback([{target:f.dock}]);assert.equal(f.paint('--lens-x'),80);f.resize(65);assert.equal(f.paint('--lens-x'),65);assert.equal(f.paint('--lens-width'),65);assert.equal(f.links[1].getAttribute('aria-current'),'location');assert.ok(!f.links[2].hasAttribute('aria-current'));
});
test('pagehide cancels animation and unregisters controller handlers',()=>{
 const f=fixture();f.links[2].click();assert.ok(f.frames.size);f.host.emit('pagehide',{persisted:false});assert.equal(f.frames.size,0);f.dock.emit('pointerdown');f.dock.emit('pointermove',{clientX:250});assert.equal(f.captures.size,0);
});
test('BFCache suspension stops drag and animation while restoration preserves a working controller',()=>{
 const f=fixture();f.links[2].click();f.dock.emit('pointerdown',{clientX:210});f.dock.emit('pointermove',{clientX:290});assert.equal(f.captures.size,1);assert.ok(f.frames.size);
 f.host.emit('pagehide',{persisted:true});assert.equal(f.frames.size,0);assert.equal(f.captures.size,0);assert.ok(!f.dock.hasAttribute('data-dragging'));
 f.host.emit('pageshow',{persisted:true});assert.equal(f.paint('--lens-x'),160);assert.equal(f.paint('--lens-stretch'),1);f.links[1].click();f.settle();assert.equal(f.paint('--lens-x'),80);assert.equal(f.navigations.length,2,'BFCache resume must retain the navigation handlers');
});
test('scrolling never changes the current page or registers section observers',()=>{
 const f=fixture({sections:true,reduced:true});assert.equal(f.observed.length,0);f.context.scrollY=1000;f.host.emit('scroll');assert.equal(f.paint('--lens-x'),0);assert.equal(f.links[0].getAttribute('aria-current'),'page');assert.equal(f.frames.size,0);
});
test('real labels are never cloned, masked or overlaid with a second selected destination',()=>{
 const f=fixture();assert.ok(f.links.every(link=>link.childNodes.length===2),'real icon and label remain intact');assert.equal(f.lens.childNodes.length,0,'lens contains no cloned content');
 f.dock.emit('pointerdown');f.dock.emit('pointermove',{clientX:250});f.step();assert.ok(f.paint('--lens-stretch')>1);assert.equal(f.links.filter(link=>link.hasAttribute('data-active')).length,1);assert.equal(f.links[0].getAttribute('aria-current'),'location');
 assert.ok(!source.includes('cloneNode'),'controller never duplicates text');assert.ok(!source.includes('mask-left'),'no per-frame content mask');
 f.dock.emit('pointercancel');f.settle();assert.equal(f.frames.size,0);
});
test('context menu and long holds suppress text selection and accidental navigation',()=>{
 const f=fixture();assert.equal(f.dock.emit('selectstart').defaultPrevented,true);f.dock.emit('pointerdown',{target:f.links[0]});assert.equal(f.dock.emit('contextmenu').defaultPrevented,true);const held=f.dock.emit('click',{target:f.links[0],isTrusted:true,detail:1});assert.equal(held.defaultPrevented,true);assert.equal(f.navigations.length,0);
 const g=fixture();g.dock.emit('pointerdown');for(let n=0;n<40;n++)g.step();g.dock.emit('pointerup');assert.equal(g.dock.emit('click',{target:g.links[0],isTrusted:true,detail:1}).defaultPrevented,true);
});
test('stationary drag settles and schedules no perpetual animation frames',()=>{
 const f=fixture();f.dock.emit('pointerdown');f.dock.emit('pointermove',{clientX:220});f.settle();assert.equal(f.frames.size,0);assert.equal(f.dock.getAttribute('data-dragging'),'true');f.dock.emit('pointerup',{clientX:220});f.settle();
});

test('the same elapsed time gives the same spring position at 60 and 120 Hz',()=>{
 const slow=fixture(),fast=fixture({frameDuration:8.3335});slow.links[3].click();fast.links[3].click();
 // First callback establishes each clock. Compare the following 200ms.
 slow.step();fast.step();for(let i=0;i<12;i++)slow.step();for(let i=0;i<24;i++)fast.step();
 assert.ok(Math.abs(slow.paint('--lens-x')-fast.paint('--lens-x'))<2,'Frame rate must not change the perceived spring speed');slow.settle();fast.settle();
});
test('cross-page activation paints a transition before one delayed handoff',()=>{
 const f=fixture();f.links[1].href='https://example.test/projects/';f.links[2].href='https://example.test/experience/';
 const first=f.dock.emit('click',{target:f.links[1],isTrusted:true,detail:1});assert.equal(first.defaultPrevented,true);assert.equal(f.navigations.length,0);f.step();assert.ok(f.paint('--lens-x')>0);f.advance(70);assert.equal(f.navigations.length,0);
 f.dock.emit('click',{target:f.links[2],isTrusted:true,detail:1});assert.equal(f.timers.size,1,'A newer destination replaces the pending handoff');f.advance(180);assert.deepEqual(f.navigations,['https://example.test/experience/']);
});
test('reduced motion and modified cross-page clicks preserve immediate native intent',()=>{
 const f=fixture({reduced:true});f.links[1].href='https://example.test/projects/';const click=f.dock.emit('click',{target:f.links[1],isTrusted:true,detail:1});assert.equal(click.defaultPrevented,true);assert.deepEqual(f.navigations,['https://example.test/projects/']);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
 const g=fixture();g.links[1].href='https://example.test/projects/';assert.ok(!g.dock.emit('click',{target:g.links[1],isTrusted:true,ctrlKey:true,detail:1}).defaultPrevented);assert.equal(g.timers.size,0);
});
test('scrolling alone schedules no decorative animation or backdrop work',()=>{
 const f=fixture();f.context.scrollY=300;f.host.emit('scroll');assert.equal(f.frames.size,0);
});

test('the dragging lens reaches the latest finger location on its first display frame',()=>{
 const f=fixture();f.dock.emit('pointerdown',{clientX:60});f.dock.emit('pointermove',{clientX:260});f.step();assert.equal(f.paint('--lens-x'),200);f.dock.emit('pointermove',{clientX:150});f.step();assert.equal(f.paint('--lens-x'),90);f.dock.emit('pointercancel');f.settle();assert.equal(f.paint('--lens-x'),0);
});

test('a settled long press always shrinks back after release without a click',()=>{
 const f=fixture();f.dock.emit('pointerdown');f.settle();assert.equal(f.frames.size,0);assert.ok(f.paint('--lens-stretch')>1);f.advance(700);f.dock.emit('pointerup');assert.ok(f.frames.size,'Release must restart the stopped frame loop');f.settle();assert.equal(f.paint('--lens-stretch'),1);assert.equal(f.paint('--lens-squash'),1);assert.equal(f.navigations.length,0);
});
test('the next document resumes the departure position, then settles to its own selected tab',()=>{
 const storage=new Map(),old=fixture({storage});old.links[3].href='https://example.test/contact/index.html';old.dock.emit('click',{target:old.links[3],isTrusted:true,detail:1});for(let n=0;n<4;n++)old.step();old.advance(110);const departure=old.paint('--lens-x');old.host.emit('pagehide',{persisted:false});assert.ok(storage.size);
 const next=fixture({storage,pathname:'/contact/index.html',active:3});assert.equal(next.paint('--lens-x'),departure,'Boot must use the departure coordinate rather than reset to the destination');assert.equal(storage.size,0,'The handoff is consumed once');next.resizes[0].callback([{target:next.dock}]);assert.equal(next.paint('--lens-x'),departure,'Initial ResizeObserver delivery must not erase the incoming animation');next.settle();assert.equal(next.paint('--lens-x'),240);
});
test('unrelated or stale handoffs never change the current page and blocked storage keeps navigation working',()=>{
 for(const state of [{href:'https://example.test/unrelated/',at:Date.now(),fraction:.5,speed:0,lift:0},{href:'https://example.test/',at:Date.now()-11000,fraction:.5,speed:0,lift:0},{href:'http://[',at:Date.now(),fraction:.5,speed:0,lift:0}]){
  const storage=new Map([['portfolio-dock-handoff-v2',JSON.stringify(state)]]),f=fixture({storage});assert.equal(f.paint('--lens-x'),0);assert.equal(storage.size,0);assert.equal(f.frames.size,0);
 }
 const f=fixture({storageBlocked:true});f.links[1].href='https://example.test/projects/';f.dock.emit('click',{target:f.links[1],isTrusted:true,detail:1});f.advance(110);assert.deepEqual(f.navigations,['https://example.test/projects/']);
});
test('a three-second page load still restores the one-time destination handoff',()=>{
 const storage=new Map([['portfolio-dock-handoff-v2',JSON.stringify({href:'https://example.test/contact/',at:Date.now()-3000,fraction:.2,speed:1,lift:1})]]);
 const f=fixture({storage,pathname:'/contact/',active:4});assert.equal(f.paint('--lens-x'),64);assert.equal(storage.size,0);f.settle();assert.equal(f.paint('--lens-x'),320);
});
test('the destination discards handoff motion when reduced motion is requested',()=>{
 const storage=new Map([['portfolio-dock-handoff-v2',JSON.stringify({href:'https://example.test/contact/',at:Date.now(),fraction:.2,speed:1,lift:1})]]),f=fixture({storage,reduced:true,pathname:'/contact/',active:4});assert.equal(f.paint('--lens-x'),320);assert.equal(f.paint('--lens-stretch'),1);assert.equal(f.frames.size,0);assert.equal(storage.size,0);
});

test('a narrow media intersection switches contrast without per-scroll animation work',()=>{
 const video=new Surface(),dark=new Surface(),f=fixture({mediaSources:[video,dark]});assert.equal(f.observed.length,1);const observer=f.observed[0];assert.equal(observer.nodes.length,2);observer.callback([{target:video,isIntersecting:true}]);assert.equal(f.dock.hasAttribute('data-over-media'),true);assert.equal(f.frames.size,0);observer.callback([{target:dark,isIntersecting:true},{target:video,isIntersecting:false}]);assert.equal(f.dock.hasAttribute('data-over-media'),true);observer.callback([{target:dark,isIntersecting:false}]);assert.equal(f.dock.hasAttribute('data-over-media'),false);f.host.emit('pagehide',{persisted:false});assert.equal(observer.disconnected,true);
});

test('water-drop release crosses rest slightly, then stops all animation work',()=>{
 const f=fixture();f.dock.emit('pointerdown');f.settle();assert.ok(f.paint('--lens-stretch')>1.07);
 f.dock.emit('pointerup');let minimum=Infinity;for(let n=0;n<90;n++){f.step();minimum=Math.min(minimum,f.paint('--lens-stretch'));}
 assert.ok(minimum<1,'A small release recoil must be visible');f.settle();assert.equal(f.paint('--lens-stretch'),1);assert.equal(f.paint('--lens-squash'),1);assert.equal(f.frames.size,0);
});
test('droplet response follows elapsed time at 60 and 120 Hz',()=>{
 const a=fixture(),b=fixture({frameDuration:8.3335});a.dock.emit('pointerdown');b.dock.emit('pointerdown');a.step();b.step();
 for(let n=0;n<12;n++)a.step();for(let n=0;n<24;n++)b.step();
 assert.ok(Math.abs(a.paint('--lens-stretch')-b.paint('--lens-stretch'))<.002);a.settle();b.settle();
});
test('BFCache restoration clears a settled held droplet before new input',()=>{
 const f=fixture();f.dock.emit('pointerdown');f.settle();assert.ok(f.paint('--lens-squash')>1.1);
 f.host.emit('pagehide',{persisted:true});f.host.emit('pageshow',{persisted:true});
 assert.equal(f.paint('--lens-stretch'),1);assert.equal(f.paint('--lens-squash'),1);f.links[1].click();f.settle();assert.equal(f.paint('--lens-x'),80);
});


test('releasing outside the dock or leaving the window clears a held press without navigation',()=>{
 for(const event of ['pointerup','blur']){
  const f=fixture();f.dock.emit('pointerdown');f.settle();assert.ok(f.paint('--lens-stretch')>1);
  f.host.emit(event);f.settle();assert.equal(f.paint('--lens-stretch'),1);assert.equal(f.captures.size,0);assert.equal(f.navigations.length,0);
  f.links[1].click();f.settle();assert.equal(f.paint('--lens-x'),80);assert.equal(f.navigations.length,1);
 }
});
test('desktop context menus keep native open-in-new-tab actions available',()=>{
 for(const properties of [{button:2},{ctrlKey:true},{pointerType:'mouse'}]){
  const f=fixture();assert.ok(!f.dock.emit('contextmenu',{target:f.links[1],...properties}).defaultPrevented);
 }
});


test('a release settles within real time even when display frames arrive at 5 Hz',()=>{
 const f=fixture({frameDuration:200});
 f.dock.emit('pointerdown');f.settle();f.advance(700);f.dock.emit('pointerup');
 for(let n=0;n<6;n++)f.step();
 assert.equal(f.frames.size,0,'Dropped frames must not keep an idle navigation spring alive');
 assert.equal(f.paint('--lens-stretch'),1);
 assert.equal(f.paint('--lens-squash'),1);
 assert.equal(f.navigations.length,0);
});
