/* One input owner for surface lighting and pressure; no scroll interception. */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const coarse=matchMedia('(hover: none)');
  const root=document.documentElement;
  const surfaces=[...document.querySelectorAll('.practice-glass,.work-card,.contact-identity,.event-preview')];
  for(const surface of surfaces)surface.dataset.materialSurface='';
  const timers=new Map();
  let held=null,surfaceHeld=null,frame=0,pending=null;
  const selector='.button,.practice-link,summary,.contact-copy,.dialog-close,.sprite-close,.sprite-form button,.sprite-answer-source,.sprite-resume,.era-hero-foot a,[data-control-glass] a,[data-control-glass] button';
  const targetFor=target=>target?.closest?.(selector);
  function illuminate(node,x,y){
    const b=node.getBoundingClientRect();
    const nx=Math.max(0,Math.min(1,(x-b.left)/Math.max(1,b.width)));
    const ny=Math.max(0,Math.min(1,(y-b.top)/Math.max(1,b.height)));
    node.style.setProperty('--press-x',(nx*100).toFixed(1)+'%');
    node.style.setProperty('--press-y',(ny*100).toFixed(1)+'%');
    node.style.setProperty('--press-rx',((.5-ny)*3).toFixed(2)+'deg');
    node.style.setProperty('--press-ry',((nx-.5)*4).toFixed(2)+'deg');
  }
  function finish(animate=false){
    if(!held)return;
    const node=held.node;held=null;node.removeAttribute('data-glass-pressed');
    clearTimeout(timers.get(node));timers.delete(node);
    if(animate&&!reduced.matches&&!document.hidden){
      node.dataset.glassReleased='true';
      timers.set(node,setTimeout(()=>{node.removeAttribute('data-glass-released');timers.delete(node);},500));
    }else node.removeAttribute('data-glass-released');
  }
  function releaseSurface(animate=false){
    if(!surfaceHeld)return;
    const node=surfaceHeld.node;surfaceHeld=null;node.removeAttribute('data-surface-pressed');
    clearTimeout(timers.get(node));timers.delete(node);
    if(animate&&!reduced.matches&&!document.hidden){
      node.setAttribute('data-surface-released','');
      timers.set(node,setTimeout(()=>{node.removeAttribute('data-surface-released');timers.delete(node);},650));
    }
  }
  function press(node,id,x,y){
    finish();clearTimeout(timers.get(node));timers.delete(node);node.removeAttribute('data-glass-released');
    illuminate(node,x,y);held={node,id,x,y};node.dataset.glassPressed='true';
  }
  document.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0)return;
    const node=targetFor(event.target);
    if(!node){
      const surface=event.target.closest?.('[data-material-surface]');
      if(surface&&!event.target.closest('input,select,textarea,video,a,button')){
        releaseSurface();const box=surface.getBoundingClientRect();
        surface.style.setProperty('--surface-x',((event.clientX-box.left)/box.width*100)+'%');
        surface.style.setProperty('--surface-y',((event.clientY-box.top)/box.height*100)+'%');
        surfaceHeld={node:surface,id:event.pointerId,x:event.clientX,y:event.clientY};surface.setAttribute('data-surface-pressed','');
      }
      return;
    }
    if(node.disabled)return;
    press(node,event.pointerId,event.clientX,event.clientY);
  },{passive:true});
  document.addEventListener('pointermove',event=>{
    if(surfaceHeld?.id===event.pointerId&&Math.hypot(event.clientX-surfaceHeld.x,event.clientY-surfaceHeld.y)>10)releaseSurface();
    if(held?.id===event.pointerId){
      if(Math.hypot(event.clientX-held.x,event.clientY-held.y)>12){finish();return;}
      illuminate(held.node,event.clientX,event.clientY);
    }
    if(reduced.matches||coarse.matches||document.hidden||event.pointerType!=='mouse')return;
    const surface=event.target.closest?.('[data-material-surface]');if(!surface)return;
    pending={surface,x:event.clientX,y:event.clientY};
    if(!frame)frame=requestAnimationFrame(()=>{
      frame=0;if(!pending||document.hidden||reduced.matches)return;
      const {surface,x,y}=pending,b=surface.getBoundingClientRect();pending=null;
      const nx=Math.max(0,Math.min(1,(x-b.left)/b.width)),ny=Math.max(0,Math.min(1,(y-b.top)/b.height));
      surface.style.setProperty('--surface-x',(nx*100).toFixed(1)+'%');surface.style.setProperty('--surface-y',(ny*100).toFixed(1)+'%');
      surface.style.setProperty('--surface-rx',((.5-ny)*1.2).toFixed(2)+'deg');surface.style.setProperty('--surface-ry',((nx-.5)*1.6).toFixed(2)+'deg');
    });
  },{passive:true});
  document.addEventListener('pointerup',event=>{if(held?.id===event.pointerId)finish(true);if(surfaceHeld?.id===event.pointerId)releaseSurface(true);},{passive:true});
  document.addEventListener('pointercancel',()=>{finish();releaseSurface();},{passive:true});
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.repeat||event.isComposing||event.metaKey||event.ctrlKey||event.altKey||!['Enter',' '].includes(event.key))return;
    const node=targetFor(event.target);if(!node||node.disabled||node.matches('a')&&event.key===' ')return;
    const b=node.getBoundingClientRect();press(node,'keyboard',b.left+b.width/2,b.top+b.height/2);
  });
  document.addEventListener('keyup',event=>{if(held?.id==='keyboard'&&['Enter',' '].includes(event.key))finish(true);});
  document.addEventListener('focusout',()=>{if(held?.id==='keyboard')finish();});
  for(const surface of surfaces){
    surface.addEventListener('pointerleave',()=>{surface.style.setProperty('--surface-rx','0deg');surface.style.setProperty('--surface-ry','0deg');});
  }
  function clear(){
    finish();releaseSurface();cancelAnimationFrame(frame);frame=0;pending=null;
    for(const [node,timer]of timers){clearTimeout(timer);node.removeAttribute('data-glass-released');node.removeAttribute('data-surface-released');}timers.clear();
    for(const surface of surfaces){surface.style.setProperty('--surface-rx','0deg');surface.style.setProperty('--surface-ry','0deg');}
  }
  function lifecycle(){root.dataset.scenePaused=String(document.hidden);if(document.hidden)clear();}
  document.addEventListener('visibilitychange',lifecycle);
  addEventListener('scroll',()=>{finish();releaseSurface();},{passive:true,capture:true});
  addEventListener('blur',clear);addEventListener('pagehide',()=>{root.dataset.scenePaused='true';clear();});
  addEventListener('pageshow',lifecycle);reduced.addEventListener('change',clear);coarse.addEventListener('change',clear);lifecycle();
})();
