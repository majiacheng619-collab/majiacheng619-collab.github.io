/* Actual previews and direct contact utilities, progressively enhanced. */
(() => {
  'use strict';
  if (!document.body.matches('.home-page,.inner-page')) return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  for(const workbench of document.querySelectorAll('[data-studio-preview]')) {
    const tabs=[...workbench.querySelectorAll('[data-studio-tab]')];
    const panels=[...workbench.querySelectorAll('[data-studio-panel]')];
    if(!tabs.length||tabs.length!==panels.length)continue;
    let active=0,transition=null,heightTransition=null;
    const tablist=workbench.querySelector('[role="tablist"]');
    function measureSelection(){
      const selected=tabs[active];
      tablist.style.setProperty('--studio-tab-x',selected.offsetLeft+'px');
      tablist.style.setProperty('--studio-tab-width',selected.offsetWidth+'px');
    }
    function select(index,focus=false,animate=true){
      if(index<0||index>=tabs.length)return;
      const before=workbench.getBoundingClientRect().height;
      transition?.cancel();heightTransition?.cancel();
      active=index;
      tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});
      panels.forEach((panel,i)=>{panel.hidden=i!==index;panel.tabIndex=i===index?0:-1;});
      measureSelection();
      if(focus)tabs[index].focus({preventScroll:true});
      if(animate&&!reduced.matches&&panels[index].animate){
        const after=workbench.getBoundingClientRect().height;
        heightTransition=workbench.animate([{height:before+'px'},{height:after+'px'}],{duration:460,easing:'cubic-bezier(.22,1,.36,1)'});
        heightTransition.finished.catch(()=>{});
        transition=panels[index].animate([{opacity:.45,transform:'perspective(1000px) translate3d(0,16px,-18px) scale(.985)'},{opacity:1,transform:'none'}],{duration:460,easing:'cubic-bezier(.22,1,.36,1)'});
        transition.finished.catch(()=>{});
      }
    }
    tabs.forEach((tab,index)=>{
      tab.addEventListener('click',()=>select(index));
      tab.addEventListener('keydown',event=>{
        if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
        const focused=tabs.indexOf(event.currentTarget);
        const current=focused<0?active:focused;
        let index;
        if(event.key==='ArrowRight')index=(current+1)%tabs.length;
        else if(event.key==='ArrowLeft')index=(current-1+tabs.length)%tabs.length;
        else if(event.key==='Home')index=0;
        else if(event.key==='End')index=tabs.length-1;
        else return;
        event.preventDefault();select(index,true);
      });
    });
    workbench.querySelector('[role="tablist"]').hidden=false;
    workbench.classList.add('is-interactive');
    select(0,false,false);
    workbench.dataset.studioReady='true';
    if('ResizeObserver' in window)new ResizeObserver(measureSelection).observe(tablist);
    document.fonts?.ready.then(measureSelection);
    // A horizontal gesture changes the actual work preview; vertical scrolling stays native.
    let gesture=null,suppressClick=false,clickTimer;
    const clearGesture=()=>{
      if(gesture){gesture.panel.style.removeProperty('translate');gesture.panel.removeAttribute('data-studio-dragging');}
      gesture=null;
    };
    workbench.addEventListener('pointerdown',event=>{
      if(gesture||!event.isPrimary||event.button!==0||!['touch','pen'].includes(event.pointerType))return;
      const panel=event.target.closest('[data-studio-panel]');
      if(!panel||panel.hidden||event.target.closest('button,input,video,summary'))return;
      transition?.cancel();gesture={id:event.pointerId,x:event.clientX,y:event.clientY,panel,dx:0,locked:false};
    },{passive:true});
    workbench.addEventListener('pointermove',event=>{
      if(!gesture||event.pointerId!==gesture.id)return;
      const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
      if(!gesture.locked){
        if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){clearGesture();return;}
        if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.25)return;
        gesture.locked=true;
        try{gesture.panel.setPointerCapture(event.pointerId);}catch{/* Synthetic inputs do not own native capture. */}
        gesture.panel.setAttribute('data-studio-dragging','');
      }
      gesture.dx=dx;
      if(!reduced.matches)gesture.panel.style.translate=Math.max(-55,Math.min(55,dx*.25))+'px 0';
    },{passive:true});
    const finishGesture=event=>{
      if(!gesture||event.pointerId!==gesture.id)return;
      const ended=gesture,commit=event.type==='pointerup'&&ended.locked&&Math.abs(ended.dx)>55;
      if(ended.locked){
        suppressClick=true;clearTimeout(clickTimer);clickTimer=setTimeout(()=>{suppressClick=false;},400);
      }
      clearGesture();
      if(commit){
        const direction=getComputedStyle(workbench).direction==='rtl'?-1:1;
        const next=Math.max(0,Math.min(tabs.length-1,active+(ended.dx<0?1:-1)*direction));
        if(next!==active)select(next);
      }
    };
    workbench.addEventListener('pointerup',finishGesture);
    workbench.addEventListener('pointercancel',finishGesture);
    workbench.addEventListener('lostpointercapture',event=>{if(gesture?.id===event.pointerId&&event.target===gesture.panel)clearGesture();});
    workbench.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopPropagation();suppressClick=false;}},true);
    reduced.addEventListener('change',()=>{transition?.cancel();heightTransition?.cancel();clearGesture();measureSelection();});
    addEventListener('pagehide',()=>{heightTransition?.cancel();transition?.cancel();clearGesture();clearTimeout(clickTimer);suppressClick=false;});
  }
  document.addEventListener('click',event=>{
    const trigger=event.target.closest?.('[data-play-intro]');
    if(!trigger||event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const video=document.querySelector('#intro-video');if(!video)return;
    event.preventDefault();
    video.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'center'});
    video.play().catch(()=>{video.tabIndex=0;video.focus({preventScroll:true});});
  });
  // Material follows the surface beneath the dock; no extra navigation layer.
  const hero=document.querySelector('[data-era-hero]');
  const dock=document.querySelector('[data-glass-dock]');
  if(hero&&dock){
    let scheduled=false;
    const update=()=>{
      scheduled=false;
      const scene=hero.getBoundingClientRect(),control=dock.getBoundingClientRect();
      document.body.dataset.eraDark=String(scene.top<=control.top&&scene.bottom>=control.bottom);
    };
    const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}};
    addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});
    update();
  }
  // Offscreen geometry pauses instead of running unseen for the full page.
  if('IntersectionObserver' in window){
    const scenes=new IntersectionObserver(entries=>{
      for(const entry of entries)entry.target.toggleAttribute('data-paused',!entry.isIntersecting);
    },{rootMargin:'80px'});
    document.querySelectorAll('.era-silk').forEach(scene=>scenes.observe(scene));
  }
  // Native anchor links keep their URL and keyboard behavior; the index follows reading.
  const caseIndex=document.querySelector('.case-index');
  if(caseIndex){
    const links=[...caseIndex.querySelectorAll('a[href^="#"]')];
    const entries=links.map(link=>({link,section:document.querySelector(link.getAttribute('href'))})).filter(item=>item.section);
    let scheduled=false,intent=null;
    const update=()=>{
      scheduled=false;const edge=Math.max(160,innerHeight*.25);
      const atEdge=entries.filter(item=>item.section.getBoundingClientRect().top<=edge).at(-1);
      if(intent&&(performance.now()>intent.until||atEdge===intent.item))intent=null;
      const current=intent?.item||atEdge;
      for(const item of entries){if(item===current)item.link.setAttribute('aria-current','location');else item.link.removeAttribute('aria-current');}
    };
    const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}};
    caseIndex.addEventListener('click',event=>{
      if(event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
      const link=event.target.closest('a[href]'),item=entries.find(item=>item.link===link);
      if(item){intent={item,until:performance.now()+2000};update();}
    });
    const clearIntent=()=>{if(intent){intent=null;schedule();}};
    addEventListener('scrollend',clearIntent,{passive:true});
    addEventListener('wheel',clearIntent,{passive:true});
    addEventListener('pointerdown',clearIntent,{passive:true});
    addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});update();
  }
  for(const button of document.querySelectorAll('[data-copy-value]')){
    button.hidden=false;
    let timer;
    button.addEventListener('click',async()=>{
      const status=button.closest('[data-contact-row]')?.querySelector('[data-copy-status]');
      try{
        if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');
        await navigator.clipboard.writeText(button.dataset.copyValue);
        button.textContent='已复制';if(status)status.textContent='已复制到剪贴板';
      }catch{if(status)status.textContent='可长按上方地址复制';}
      clearTimeout(timer);timer=setTimeout(()=>{button.textContent='复制';if(status)status.textContent='';},3500);
    });
  }
})();
