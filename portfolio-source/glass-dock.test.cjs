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
function fixture({reduced=false,sections=false,pathname='/'}={}){
 const dock=new Surface(),lens=new Surface(),media=new Surface(),doc=new Surface(),host=new Surface();
 let left=20,itemWidth=80,time=0,id=0;
 const frames=new Map(),navigations=[],captures=new Set(),observed=[],sectionNodes=new Map();
 const links=Array.from({length:4},(_,i)=>{const link=new Surface();link.href=`https://example.test/#section-${i}`;link.setAttribute('href',`#section-${i}`);link.closest=s=>s==='a'||s==='[data-dock-link]'?link:null;link.getBoundingClientRect=()=>({left:left+i*itemWidth,width:itemWidth});link.click=()=>{const e=dock.emit('click',{target:link});if(!e.defaultPrevented)navigations.push(link.href);};return link;});
 links.forEach((link,i)=>{link.append(new Surface());link.append(new Surface());if(sections){link.href=`https://example.test/index.html${i?'#section-'+i:''}`;link.setAttribute('href',new URL(link.href).pathname+new URL(link.href).hash);sectionNodes.set('section-'+i,new Surface());}});
 links[0].setAttribute('aria-current','location');
 dock.clientLeft=0;dock.querySelector=()=>lens;dock.querySelectorAll=()=>links;dock.getBoundingClientRect=()=>({left,width:itemWidth*4});dock.contains=n=>links.includes(n)||n===dock;dock.closest=()=>null;
 dock.setPointerCapture=n=>captures.add(n);dock.hasPointerCapture=n=>captures.has(n);dock.releasePointerCapture=n=>{captures.delete(n);dock.emit('lostpointercapture',{pointerId:n});};
 media.matches=reduced;doc.hidden=false;doc.querySelector=()=>dock;doc.getElementById=id=>sectionNodes.get(id)||null;doc.createElement=()=>new Surface();
 class IntersectionObserver {constructor(callback){this.callback=callback;observed.push(this);}observe(node){(this.nodes??=[]).push(node);}disconnect(){this.disconnected=true;}}
 host.IntersectionObserver=IntersectionObserver;
 const context=vm.createContext({window:host,document:doc,IntersectionObserver,matchMedia:()=>media,AbortController,URL,location:{href:'https://example.test'+pathname,origin:'https://example.test',pathname},scrollY:0,performance:{now:()=>time},addEventListener:host.addEventListener.bind(host),requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:n=>frames.delete(n)});
 vm.runInContext(source,context);
 function settle(){for(let n=0;frames.size&&n<600;n++){const batch=[...frames];frames.clear();time+=16.667;for(const [,fn]of batch)fn(time);}assert.equal(frames.size,0,'animation must stop after settling');}
 return {dock,lens,links,media,doc,host,context,frames,navigations,captures,observed,sectionNodes,settle,step(){const batch=[...frames];frames.clear();time+=16.667;for(const [,fn]of batch)fn(time);},paint:key=>parseFloat(dock.values.get(key)),resize(width){itemWidth=width;host.emit('resize');},boot(){vm.runInContext(source,context);},motion(value){media.matches=value;media.emit('change');}};
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
test('pointercancel restores the selected destination without activating a link',()=>{
 const f=fixture();f.dock.emit('pointerdown');f.dock.emit('pointermove',{clientX:290});f.dock.emit('pointercancel');f.settle();assert.equal(f.paint('--lens-x'),0);assert.equal(f.navigations.length,0);assert.equal(f.captures.size,0);assert.ok(!f.dock.hasAttribute('data-dragging'));
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
test('focus previews the lens without changing destination and blur restores it',()=>{
 const f=fixture({reduced:true});f.dock.emit('focusin',{target:f.links[3]});assert.equal(f.paint('--lens-x'),240);assert.equal(f.navigations.length,0);assert.equal(f.links[0].getAttribute('aria-current'),'location');f.dock.emit('focusout',{relatedTarget:null});assert.equal(f.paint('--lens-x'),0);
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
test('optical source wrapper preserves content and the mask follows the stretched lens bounds',()=>{
 const f=fixture();assert.ok(f.links.every(link=>link.childNodes.length===1&&link.childNodes[0].className==='glass-dock__source'&&link.childNodes[0].childNodes.length===2));const projection=f.lens.childNodes[0];assert.equal(projection.getAttribute('aria-hidden'),'true');assert.equal(projection.childNodes.length,4);
 f.dock.emit('pointerdown');f.dock.emit('pointermove',{clientX:170});f.step();const x=f.paint('--lens-x'),width=f.paint('--lens-width'),stretch=f.paint('--lens-stretch');assert.ok(stretch>1);assert.ok(Math.abs(f.paint('--lens-mask-left')-(x+width*(1-stretch)/2))<.004);assert.ok(Math.abs(f.paint('--lens-mask-right')-(x+width*(1+stretch)/2))<.004);assert.equal(projection.childNodes.filter(copy=>copy.hasAttribute('data-active')).length,1,'Only the nearest projected label is active');
 f.dock.emit('pointercancel');f.settle();assert.equal(f.paint('--lens-mask-left'),0);assert.equal(f.paint('--lens-mask-right'),80);assert.equal(f.links[2].values.get('--dock-link-x'),'160px');
});
