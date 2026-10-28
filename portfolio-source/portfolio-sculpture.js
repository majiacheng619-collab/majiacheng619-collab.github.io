/* The optical-glass artwork keeps its geometry, native loading and motion lifecycle. */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  for(const scene of document.querySelectorAll('.era-silk')){
    const image=scene.querySelector('.spatial-hero-art');if(!image)continue;
    const ready=()=>{if(image.naturalWidth>0){scene.dataset.artState='ready';scene.removeAttribute('data-art-error');}};
    const fallback=()=>{scene.dataset.artState='fallback';scene.setAttribute('data-art-error','');image.hidden=true;};
    image.addEventListener('load',ready,{once:true});image.addEventListener('error',fallback,{once:true});
    if(image.complete){if(image.naturalWidth)ready();else fallback();}
  }
  const hero=document.querySelector('.home-page [data-era-hero]');if(!hero)return;
  let frame=0,active=true,contact=null,last=0;
  const state={x:0,y:0,z:0,read:0},target={x:0,y:0,z:0,read:0};
  function render(now){
    const seconds=last?Math.min((now-last)/1000,.1):1/60;last=now;const damping=1-Math.exp(-seconds*16);
    frame=0;if(document.hidden||!active||reduced.matches)return;
    let remaining=0;
    for(const axis of ['x','y','z','read']){const delta=target[axis]-state[axis];state[axis]+=delta*damping;remaining+=Math.abs(delta);}
    hero.style.setProperty('--art-rotate-x',state.x.toFixed(3)+'deg');
    hero.style.setProperty('--art-rotate-y',state.y.toFixed(3)+'deg');
    hero.style.setProperty('--art-lift',state.z.toFixed(3)+'px');
    hero.style.setProperty('--art-read',state.read.toFixed(4));
    if(remaining>.015)frame=requestAnimationFrame(render);else last=0;
  }
  function schedule(){if(!frame&&active&&!document.hidden&&!reduced.matches)frame=requestAnimationFrame(render);}
  function reset(){
    target.x=target.y=target.z=0;contact=null;
    if(reduced.matches||document.hidden||!active)target.read=0;
    if(reduced.matches||document.hidden||!active){
      if(frame)cancelAnimationFrame(frame);frame=0;last=0;state.x=state.y=state.z=state.read=0;
      hero.style.setProperty('--art-read','0');
      hero.style.setProperty('--hero-light-x','78%');hero.style.setProperty('--hero-light-y','45%');
      hero.style.setProperty('--art-rotate-x','0deg');hero.style.setProperty('--art-rotate-y','0deg');hero.style.setProperty('--art-lift','0px');
    }else schedule();
  }
  function position(event){
    const box=hero.getBoundingClientRect();
    target.x=(Math.max(0,Math.min(1,(event.clientY-box.top)/box.height))-.5)*-9;
    target.y=(Math.max(0,Math.min(1,(event.clientX-box.left)/box.width))-.5)*12;
    hero.style.setProperty('--hero-light-x',((event.clientX-box.left)/box.width*100).toFixed(1)+'%');
    hero.style.setProperty('--hero-light-y',((event.clientY-box.top)/box.height*100).toFixed(1)+'%');
    schedule();
  }
  const read=()=>{if(reduced.matches||document.hidden||!active)return;const box=hero.getBoundingClientRect();target.read=Math.max(0,Math.min(1,-box.top/Math.max(1,box.height)));schedule();};
  addEventListener('scroll',read,{passive:true});addEventListener('resize',read,{passive:true});
  hero.addEventListener('pointermove',event=>{
    if(!event.isPrimary||reduced.matches||(event.pointerType==='touch'&&contact!==event.pointerId))return;
    position(event);
  },{passive:true});
  hero.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0||reduced.matches)return;
    contact=event.pointerId;target.z=14;position(event);
  },{passive:true});
  function release(event){if(contact===event.pointerId)reset();}
  addEventListener('pointerup',release,{passive:true});addEventListener('pointercancel',release,{passive:true});
  hero.addEventListener('pointerleave',reset);
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{active=entries[0].isIntersecting;if(!active)reset();},{rootMargin:'40px'}).observe(hero);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  reduced.addEventListener('change',reset);
  addEventListener('blur',reset);addEventListener('pagehide',reset);
})();
