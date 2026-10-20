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
function fixture({reduced=false,sections=false,pathname='/',search=false}={}){
 const dock=new Surface(),lens=new Surface(),media=new Surface(),doc=new Surface(),host=new Surface();
 let left=20,itemWidth=80,time=0,id=0;
 const frames=new Map(),navigations=[],captures=new Set(),observed=[],resizes=[],sectionNodes=new Map();
 const links=Array.from({length:search?5:4},(_,i)=>{const link=new Surface();link.setAttribute('data-dock-item','');link.setAttribute('data-dock-link','');link.href=`https://example.test/#section-${i}`;link.setAttribute('href',`#section-${i}`);link.closest=s=>s==='a'||s==='[data-dock-item]'?link:null;link.getBoundingClientRect=()=>({left:left+i*itemWidth,width:itemWidth});link.click=()=>{const e=dock.emit('click',{target:link});if(!e.defaultPrevented)navigations.push(link.href);};return link;});
 links.forEach((link,i)=>{link.append(new Surface());link.append(new Surface());if(sections){link.href=`https://example.test/index.html${i?'#section-'+i:''}`;link.setAttribute('href',new URL(link.href).pathname+new URL(link.href).hash);sectionNodes.set('section-'+i,new Surface());}});
 if(search){const button=new Surface();button.setAttribute('data-dock-item','');button.setAttribute('data-dock-search','');button.closest=s=>s==='[data-dock-item]'?button:null;button.getBoundingClientRect=()=>({left:left+5*itemWidth,width:itemWidth});button.click=()=>{const e=dock.emit('click',{target:button});if(!e.defaultPrevented)navigations.push('search');};links.push(button);}
 links[0].setAttribute('aria-current','location');
 dock.clientLeft=0;dock.querySelector=()=>lens;dock.querySelectorAll=()=>links;dock.getBoundingClientRect=()=>({left,width:itemWidth*4});dock.contains=n=>links.includes(n)||n===dock;dock.closest=()=>null;
 dock.setPointerCapture=n=>captures.add(n);dock.hasPointerCapture=n=>captures.has(n);dock.releasePointerCapture=n=>{captures.delete(n);dock.emit('lostpointercapture',{pointerId:n});};
 media.matches=reduced;doc.hidden=false;doc.querySelector=()=>dock;doc.getElementById=id=>sectionNodes.get(id)||null;doc.createElement=()=>new Surface();
 class IntersectionObserver {constructor(callback){this.callback=callback;observed.push(this);}observe(node){(this.nodes??=[]).push(node);}disconnect(){this.disconnected=true;}}
 class ResizeObserver {constructor(callback){this.callback=callback;resizes.push(this);}observe(node){this.node=node;}disconnect(){this.disconnected=true;}}
 host.IntersectionObserver=IntersectionObserver;
 host.ResizeObserver=ResizeObserver;
 const context=vm.createContext({window:host,document:doc,IntersectionObserver,ResizeObserver,matchMedia:()=>media,AbortController,URL,location:{href:'https://example.test'+pathname,origin:'https://example.test',pathname},scrollY:0,performance:{now:()=>time},addEventListener:host.addEventListener.bind(host),requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:n=>frames.delete(n)});
 vm.runInContext(source,context);
 function settle(){for(let n=0;frames.size&&n<600;n++){const batch=[...frames];frames.clear();time+=16.667;for(const [,fn]of batch)fn(time);}assert.equal(frames.size,0,'animation must stop after settling');}
 return {dock,lens,links,media,doc,host,context,frames,navigations,captures,observed,resizes,sectionNodes,settle,step(){const batch=[...frames];frames.clear();time+=16.667;for(const [,fn]of batch)fn(time);},paint:key=>parseFloat(dock.values.get(key)),resize(width){itemWidth=width;host.emit('resize');},boot(){vm.runInContext(source,context);},motion(value){media.matches=value;media.emit('change');}};
}

test('initial lens aligns to the current real anchor and repeated initialization adds no handlers',()=>{
 const f=fixture();assert.equal(f.paint('--lens-x'),0);assert.equal(f.paint('--lens-width'),80);assert.equal(f.links.filter(a=>a.hasAttribute('aria-current')).length,1);
 assert.deepEqual(f.links.map(a=>a.getAttribute('href')),['#section-0','#section-1','#section-2','#section-3']);
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
test('contact observer treats root and index.html as the same document and restores home on exit',()=>{
 for(const pathname of ['/','/index.html']){const f=fixture({sections:true,reduced:true,pathname});assert.equal(f.observed.length,1);const observer=f.observed[0];assert.equal(observer.nodes.length,3);const node=f.sectionNodes.get('section-3');observer.callback([{target:node,isIntersecting:true,intersectionRatio:.5}]);assert.equal(f.links[3].getAttribute('aria-current'),'location');assert.equal(f.paint('--lens-x'),240);observer.callback([{target:node,isIntersecting:false,intersectionRatio:0}]);assert.equal(f.links[0].getAttribute('aria-current'),'page');assert.equal(f.paint('--lens-x'),0);assert.equal(f.navigations.length,0);}
});
test('observer retains still-visible sections when an unrelated intersection entry changes',()=>{
 const f=fixture({sections:true,reduced:true}),observer=f.observed[0],second=f.sectionNodes.get('section-2'),third=f.sectionNodes.get('section-3');
 observer.callback([{target:second,isIntersecting:true,intersectionRatio:.8},{target:third,isIntersecting:true,intersectionRatio:.4}]);assert.equal(f.paint('--lens-x'),160);
 observer.callback([{target:third,isIntersecting:false,intersectionRatio:0}]);assert.equal(f.paint('--lens-x'),160,'An absent entry is not evidence that the selected section left view');
 observer.callback([{target:second,isIntersecting:false,intersectionRatio:0}]);assert.equal(f.paint('--lens-x'),0);
});
test('real labels are never cloned, masked or overlaid with a second selected destination',()=>{
 const f=fixture();assert.ok(f.links.every(link=>link.childNodes.length===2),'real icon and label remain intact');assert.equal(f.lens.childNodes.length,0,'lens contains no cloned content');
 f.dock.emit('pointerdown');f.dock.emit('pointermove',{clientX:250});f.step();assert.ok(f.paint('--lens-stretch')>1);assert.equal(f.links.filter(link=>link.hasAttribute('data-active')).length,1);assert.equal(f.links[0].getAttribute('aria-current'),'location');
 assert.ok(!source.includes('cloneNode'),'controller never duplicates text');assert.ok(!source.includes('mask-left'),'no per-frame content mask');
 f.dock.emit('pointercancel');f.settle();assert.equal(f.frames.size,0);
});
test('search button can tap and drag-activate without gaining current-page semantics',()=>{
 const f=fixture({search:true});assert.equal(f.links.length,6);const search=f.links.at(-1);search.click();assert.deepEqual(f.navigations,['search']);assert.ok(!search.hasAttribute('aria-current'));
 f.dock.emit('pointerdown');f.dock.emit('pointermove',{clientX:460});f.dock.emit('pointerup',{clientX:460});f.settle();assert.deepEqual(f.navigations,['search','search']);assert.ok(!search.hasAttribute('aria-current'));assert.equal(f.links[0].getAttribute('aria-current'),'location');assert.equal(f.paint('--lens-x'),0);
});
test('context menu and long holds suppress text selection and accidental navigation',()=>{
 const f=fixture();assert.equal(f.dock.emit('selectstart').defaultPrevented,true);f.dock.emit('pointerdown',{target:f.links[0]});assert.equal(f.dock.emit('contextmenu').defaultPrevented,true);const held=f.dock.emit('click',{target:f.links[0],isTrusted:true,detail:1});assert.equal(held.defaultPrevented,true);assert.equal(f.navigations.length,0);
 const g=fixture();g.dock.emit('pointerdown');for(let n=0;n<40;n++)g.step();g.dock.emit('pointerup');assert.equal(g.dock.emit('click',{target:g.links[0],isTrusted:true,detail:1}).defaultPrevented,true);
});
test('stationary drag settles and schedules no perpetual animation frames',()=>{
 const f=fixture();f.dock.emit('pointerdown');f.dock.emit('pointermove',{clientX:220});f.settle();assert.equal(f.frames.size,0);assert.equal(f.dock.getAttribute('data-dragging'),'true');f.dock.emit('pointerup',{clientX:220});f.settle();
});
