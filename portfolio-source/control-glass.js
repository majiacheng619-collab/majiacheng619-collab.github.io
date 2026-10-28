/* Direct manipulation of a single glass selection. Drag previews stay local;
 * release invokes the existing button or anchor exactly once. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const engines = [];
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  for (const group of document.querySelectorAll('.case-jump,.growth-steps,.studio-tabs')) {
    if (group.hasAttribute('data-control-glass')) continue;
    const controls = [...group.querySelectorAll(':scope > a[href],:scope > button')];
    if (!controls.length) continue;
    const lens = document.createElement('span');
    lens.className = 'control-lens';
    lens.setAttribute('aria-hidden','true');
    lens.hidden = true;
    group.prepend(lens);
    group.dataset.controlGlass = '';
    const current = {x:0,y:0,width:0,height:0}, target = {...current}, velocity = {...current};
    let selected = null, ready = false, visible = true, frame = 0, measuredFrame = 0, lastTime = 0;
    let glint = .16, glintTarget = .16, contact = null, gesture = null;
    let suppressClickUntil = 0;
    controls.forEach(control=>{control.draggable=false;});
    const activeControl = () => controls.find(control =>
      control.getAttribute('aria-pressed') === 'true' ||
      control.getAttribute('aria-selected') === 'true' ||
      (control.hasAttribute('aria-current') && control.getAttribute('aria-current') !== 'false'));
    function stop() { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
    function paint(stretch=1,squash=1) {
      for (const [property,value] of Object.entries(current)) lens.style.setProperty('--control-'+property,value.toFixed(3)+'px');
      lens.style.setProperty('--control-stretch',stretch.toFixed(4));
      lens.style.setProperty('--control-squash',squash.toFixed(4));
      lens.style.setProperty('--control-glint',glint.toFixed(3));
    }
    function settle() {
      stop();Object.assign(current,target);
      for (const key of Object.keys(velocity)) velocity[key] = 0;
      glint = glintTarget;paint();
      group.dataset.controlMotion = 'idle';
    }
    function animate(time) {
      frame = 0;
      if (document.hidden || !visible || reduced.matches || !selected) { settle(); return; }
      const dt = Math.min(.032,(time-(lastTime || time-16.67))/1000);lastTime=time;
      let remaining = 0, speed = 0;
      for (const key of Object.keys(current)) {
        if(gesture?.dragging){
          velocity[key]=(target[key]-current[key])/dt;current[key]=target[key];
          if(key==='x'||key==='y')speed+=velocity[key]*velocity[key];
          continue;
        }
        velocity[key] += ((target[key]-current[key])*330-velocity[key]*28)*dt;
        current[key] += velocity[key]*dt;
        remaining += Math.abs(target[key]-current[key])+Math.abs(velocity[key])*.025;
        if (key === 'x' || key === 'y') speed += velocity[key]*velocity[key];
      }
      glint += (glintTarget-glint)*(1-Math.exp(-dt*13));
      const stretch = Math.min(.13,Math.sqrt(speed)/Math.max(44,current.width)*.018);
      paint(1+stretch+(contact ? .02 : 0),1-stretch*.42+(contact ? .015 : 0));
      if (remaining < .055 && Math.abs(glint-glintTarget)<.003) { settle(); return; }
      frame = requestAnimationFrame(animate);
    }
    function wake() {
      if(gesture?.dragging&&reduced.matches){Object.assign(current,target);paint();return;}
      if (!ready || document.hidden || !visible || reduced.matches) { settle(); return; }
      group.dataset.controlMotion = 'moving';
      if (!frame) frame = requestAnimationFrame(animate);
    }
    function measure(animateSelection=true) {
      measuredFrame=0;
      if(gesture?.dragging)return;
      const next = activeControl();
      if (!next || !next.getClientRects().length) {
        selected=null;lens.hidden=true;ready=false;stop();
        delete group.dataset.controlReady;return;
      }
      const changed = next !== selected;
      selected = next;
      // Layout offsets ignore the selected control's transient press transform.
      // The positioned group is the lens's containing block, including wrapped rows.
      Object.assign(target,{x:next.offsetLeft-group.scrollLeft,y:next.offsetTop-group.scrollTop,width:next.offsetWidth,height:next.offsetHeight});
      lens.hidden=false;group.dataset.controlReady='';
      if (!ready || !animateSelection) { ready=true;settle();return; }
      if (changed) { glint=.92;glintTarget=contact ? .76 : .16; }
      wake();
    }
    const scheduleMeasure = () => {
      if (!measuredFrame) measuredFrame=requestAnimationFrame(()=>measure(false));
    };
    new MutationObserver(()=>measure()).observe(group,{subtree:true,attributes:true,attributeFilter:['aria-current','aria-pressed','aria-selected']});
    if ('ResizeObserver' in window) {
      const resize = new ResizeObserver(scheduleMeasure);
      resize.observe(group);controls.forEach(control=>resize.observe(control));
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(entries=>{
      visible=entries[0].isIntersecting;
      if (!visible) { finishDrag();contact=null;glintTarget=.16;settle(); }
      else measure(false);
    },{rootMargin:'40px'}).observe(group);
    group.addEventListener('scroll',scheduleMeasure,{passive:true});
    const geometry=control=>({x:control.offsetLeft-group.scrollLeft,y:control.offsetTop-group.scrollTop,width:control.offsetWidth,height:control.offsetHeight});
    function preview(control){
      controls.forEach(item=>item.toggleAttribute('data-control-preview',item===control));
    }
    function finishDrag(event,commit=false){
      if(!gesture || event&&event.pointerId!==gesture.id)return;
      const ended=gesture;gesture=null;contact=null;glintTarget=.16;
      delete group.dataset.controlDragging;preview(null);
      if(ended.dragging){
        suppressClickUntil=performance.now()+600;
        const r=group.getBoundingClientRect();
        const inside=commit&&event.clientX>=r.left-14&&event.clientX<=r.right+14&&event.clientY>=r.top-14&&event.clientY<=r.bottom+14;
        if(inside&&ended.candidate){
          // Existing handlers update panels/ARIA, and anchors keep native history.
          ended.candidate.focus({preventScroll:true});ended.candidate.click();
        }
      }
      if(group.hasPointerCapture?.(ended.id))group.releasePointerCapture(ended.id);
      measure();
    }
    group.addEventListener('pointerdown',event=>{
      if(gesture||!event.isPrimary||event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
      const control=controls.find(control=>control.contains(event.target));
      if(!control)return;
      suppressClickUntil=0;
      const rect=group.getBoundingClientRect(),start=geometry(control);
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY,dragging:false,candidate:control,rect,
        grabX:event.clientX-rect.left-group.clientLeft-start.x,
        grabY:event.clientY-rect.top-group.clientTop-start.y,
        boxes:controls.map(item=>({control:item,...geometry(item)}))};
      contact={id:event.pointerId,x:event.clientX,y:event.clientY};glint=.95;glintTarget=.76;wake();
    },{passive:true});
    group.addEventListener('pointermove',event=>{
      if(!gesture||event.pointerId!==gesture.id)return;
      const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
      if(!gesture.dragging){
        // Vertical intent belongs to native page scrolling. Once horizontal
        // intent wins, diagonal motion can reach a wrapped second row.
        if(Math.abs(dy)>9&&Math.abs(dy)>Math.abs(dx)){finishDrag(event);return;}
        if(Math.abs(dx)<7||Math.abs(dx)<Math.abs(dy)*1.15)return;
        gesture.dragging=true;group.dataset.controlDragging='true';
        group.setPointerCapture?.(event.pointerId);
        ready=true;lens.hidden=false;group.dataset.controlReady='';
      }
      if(event.cancelable)event.preventDefault();
      const x=event.clientX-gesture.rect.left-group.clientLeft,y=event.clientY-gesture.rect.top-group.clientTop;
      const closest=gesture.boxes.reduce((best,box)=>Math.hypot(x-box.x-box.width/2,y-box.y-box.height/2)<Math.hypot(x-best.x-best.width/2,y-best.y-best.height/2)?box:best);
      gesture.candidate=closest.control;preview(closest.control);
      const rawX=x-gesture.grabX,rawY=y-gesture.grabY;
      const maxX=group.clientWidth-closest.width,maxY=group.clientHeight-closest.height;
      const resist=(n,max)=>n<0?n*.14:n>max?max+(n-max)*.14:n;
      Object.assign(target,{x:resist(rawX,maxX),y:resist(rawY,maxY),width:closest.width,height:closest.height});
      // Direct touch never chases a spring; only release uses the spring.
      Object.assign(current,target);paint(reduced.matches?1:1.05,reduced.matches?1:1.025);wake();
    },{passive:false});
    group.addEventListener('click',event=>{
      if(event.isTrusted&&event.detail>0&&performance.now()<suppressClickUntil){
        suppressClickUntil=0;event.preventDefault();event.stopImmediatePropagation();
      }
    },true);
    group.addEventListener('dragstart',event=>event.preventDefault());
    group.addEventListener('lostpointercapture',event=>{
      if(gesture?.id===event.pointerId&&!group.hasPointerCapture?.(event.pointerId))finishDrag(event);
    });
    group.addEventListener('keydown',event=>{
      if (event.repeat || event.isComposing || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || !['Enter',' '].includes(event.key))return;
      const control=controls.find(control=>control.contains(event.target));
      if (!control || (event.key===' ' && control.matches('a')))return;
      contact={id:'keyboard'};glint=.95;glintTarget=.76;wake();
    });
    const release = () => { finishDrag();if(contact){contact=null;glintTarget=.16;wake();} };
    document.addEventListener('pointerup',event=>{if(gesture?.id===event.pointerId)finishDrag(event,true);},{passive:true});
    document.addEventListener('pointercancel',event=>{if(gesture?.id===event.pointerId)finishDrag(event);},{passive:true});
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&gesture){event.preventDefault();finishDrag();}
    });
    document.addEventListener('keyup',event=>{if(contact?.id==='keyboard' && ['Enter',' '].includes(event.key))release();});
    group.addEventListener('focusout',()=>{if(contact?.id==='keyboard')release();});
    const releasePointer = () => { if(contact?.id!=='keyboard')release(); };
    engines.push({measure,scheduleMeasure,release,releasePointer,settle});
    measure(false);
  }
  const sync = () => engines.forEach(engine=>{engine.release();engine.measure(false);});
  addEventListener('resize',()=>engines.forEach(engine=>{engine.release();engine.scheduleMeasure();}),{passive:true});
  addEventListener('scroll',()=>engines.forEach(engine=>engine.releasePointer()),{passive:true,capture:true});
  addEventListener('blur',sync);
  addEventListener('pagehide',()=>engines.forEach(engine=>{engine.release();engine.settle();}));
  addEventListener('pageshow',sync);
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  document.fonts?.ready.then(sync);
})();
