/* One local search surface. No model, account or download is required. */
(() => {
  'use strict';
  const root = document.querySelector('[data-sprite]');
  if (!root) return;
  const records = []/*SPRITE_CONTENT*/;
  const siteURL = new URL('../', document.currentScript.src);
  const launcher=root.querySelector('.sprite-launcher'), panel=root.querySelector('.sprite-panel');
  const input=root.querySelector('input'), results=root.querySelector('.sprite-results');
  const scroller=root.querySelector('.sprite-scroll'), status=root.querySelector('[data-sprite-status]');
  const clear=root.querySelector('[data-sprite-clear-input]'), submit=root.querySelector('button[type="submit"]');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let opened=false,timer,closing,previousFocus,composing=false,committedContext=null;
  const normalize=value=>String(value || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
  function markText(element, text, query) {
    const terms = [...new Set(query.trim().split(/\s+/).filter(Boolean))].sort((a,b)=>b.length-a.length);
    if (!terms.length) { element.textContent = text; return; }
    const escaped = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const expression = new RegExp('(' + escaped.join('|') + ')', 'gi');
    for (const part of text.split(expression)) {
      const match = terms.some(term => part.toLocaleLowerCase() === term.toLocaleLowerCase());
      const node = match ? document.createElement('mark') : document.createTextNode(part);
      if (match) node.textContent = part;
      element.append(node);
    }
  }
  function snippet(text, query) {
    const key = query.trim().split(/\s+/).find(term => text.toLowerCase().includes(term.toLowerCase()));
    const match = key ? text.toLowerCase().indexOf(key.toLowerCase()) : 0;
    const start = Math.max(0, match - 32);
    const end = Math.min(text.length, start + 180);
    return (start ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }

  function safeSourceURL(value) {
    try {const url=new URL(value,siteURL);return url.origin===siteURL.origin && ['http:','https:'].includes(url.protocol) ? url.href : null;}
    catch {return null;}
  }
  function focusContent() {
    const target=results.querySelector('h3,h4,.sprite-empty strong');
    if(target){target.tabIndex=-1;target.focus({preventScroll:true});}
  }
  function appendSources(card,sources) {
    const destinations=new Set([...card.querySelectorAll('a[href]')].map(link=>link.href));
    const evidence=sources.filter(record=>{
      const destination=safeSourceURL(record.url);
      if(!destination || destinations.has(destination))return false;
      destinations.add(destination);return true;
    }).slice(0,3);
    if(!evidence.length)return;
    const box=document.createElement('nav');box.className='sprite-sources';box.setAttribute('aria-label','相关内容');
    for(const record of evidence){
      const link=document.createElement('a');link.className='sprite-answer-source';
      link.href=safeSourceURL(record.url);link.textContent=record.title || '查看相关经历';box.append(link);
    }
    card.append(box);
  }
  function drawAnswer(answer,query) {
    const card=document.createElement('article');card.className='sprite-answer';card.dataset.spriteTopic=answer.topic || '';
    const title=document.createElement('h3');title.className='sprite-answer-title';title.textContent=answer.title || '搜索结果';card.append(title);
    const facts=(answer.facts || []).slice(0,4);
    const paragraphs=(answer.paragraphs || []).filter(text=>!facts.some(fact=>normalize(text).includes(normalize(fact.value)))).slice(0,Math.min(4,(answer.title || '').split(' · ').length));
    for(const paragraph of paragraphs){
      const p=document.createElement('p');p.className='sprite-answer-paragraph';
      const clean=paragraph.trim();
      const boundary=Math.max(clean.slice(0,180).lastIndexOf('。'),clean.slice(0,180).lastIndexOf('；'));
      p.textContent=clean.length<=180?clean:clean.slice(0,boundary>50?boundary+1:180).trim()+'…';card.append(p);
    }
    if(facts.length){
      const list=document.createElement('dl');list.className='sprite-facts';
      for(const fact of facts){const row=document.createElement('div'),label=document.createElement('dt'),value=document.createElement('dd');label.textContent=fact.label;value.textContent=fact.value;row.append(label,value);list.append(row);}
      card.append(list);
    }
    if(/简历|履历|resume|\bcv\b/i.test(query)){
      const link=document.createElement('a');link.className='sprite-resume';link.dataset.spriteAction='resume';link.textContent='下载简历';
      const existing=[...document.querySelectorAll('a[href]')].map(a=>safeSourceURL(a.href)).find(url=>url && /\/resume(?:-[a-f0-9]{12})?\.pdf$/.test(new URL(url).pathname));
      link.href=existing || new URL('RESUME_PDF_ASSET',siteURL).href;link.download='马嘉程_个人简历.pdf';card.append(link);
    }
    appendSources(card,answer.sources || []);return card;
  }
  function render(query,{commit=false}={}) {
    clearTimeout(timer);
    const value=query.trim().slice(0,140);
    clear.hidden=!input.value;submit.disabled=!value;
    results.replaceChildren();results.setAttribute('aria-busy','false');
    root.dataset.spriteState=value?'results':'welcome';
    if(!value){status.textContent='';committedContext=null;return;}
    if(!window.XiaoChengBrain?.search){
      root.dataset.spriteState='empty';status.textContent='搜索暂不可用';
      const message=document.createElement('p');message.className='sprite-unavailable';message.textContent='搜索暂不可用，请刷新后重试。';results.append(message);return;
    }
    let answer=null;
    try{answer=window.XiaoChengBrain?.answer(value,records,committedContext || {}) || null;}catch{}
    const found=window.XiaoChengBrain?.search?.(answer?.resolvedQuery || value,records,{limit:4}) || [];
    if(answer){
      results.append(drawAnswer(answer,value));
      status.textContent='已找到'+answer.title;
      if(commit)committedContext={topic:answer.topic,query:answer.resolvedQuery || value};
    }else if(found.length){
      status.textContent='找到'+found.length+'条相关内容';
      for(const [i,record] of found.entries()){
        const card=document.createElement('article'),title=document.createElement('h4'),link=document.createElement('a'),text=document.createElement('p');
        card.className='sprite-result';card.style.animationDelay=`${i*25}ms`;
        link.href=safeSourceURL(record.url);markText(link,record.title,value);title.append(link);
        markText(text,snippet(record.text,value),value);card.append(title,text);results.append(card);
      }
    }else{
      root.dataset.spriteState='empty';status.textContent='暂无结果';
      const card=document.createElement('div'),title=document.createElement('strong'),text=document.createElement('p');
      card.className='sprite-empty';title.textContent='暂无结果';text.textContent='换个关键词，或描述想找的内容。';card.append(title,text);results.append(card);
    }
    scroller.scrollTop=0;
  }
  function syncTone(){
    if(!opened)return;
    const hero=document.querySelector('.home-page .era-hero'),box=panel.getBoundingClientRect();
    const scene=hero?.getBoundingClientRect(),center=box.top+Math.min(box.height/2,180);
    root.dataset.spriteTone=scene&&scene.top<=center&&scene.bottom>=center?'dark':'light';
  }
  function open() {
    if(document.querySelector('dialog[open]'))return;
    if (opened) { input.focus({preventScroll:true}); return; }
    opened = true; clearTimeout(closing); previousFocus = document.activeElement;
    panel.hidden = false; panel.inert = false;
    launcher.setAttribute('aria-expanded','true');
    requestAnimationFrame(() => {if (opened) root.setAttribute('data-open','');});
    // Focus in the original gesture so the iOS keyboard can open naturally.
    input.focus({preventScroll:true}); fitKeyboard();syncTone();
  }
  function close(restoreFocus=true) {
    if (!opened) return;
    opened = false; root.removeAttribute('data-open'); panel.inert = true;
    launcher.setAttribute('aria-expanded','false'); input.blur();
    if(restoreFocus)(previousFocus && previousFocus.isConnected && previousFocus!==document.body && previousFocus!==document.documentElement ? previousFocus : launcher).focus({preventScroll:true});
    closing = setTimeout(() => { if (!opened) panel.hidden = true; }, reduced.matches ? 0 : 240);
    ['max-height','height','bottom','top','min-height'].forEach(property=>panel.style.removeProperty(property));root.removeAttribute('data-keyboard');
  }

  for(const trigger of document.querySelectorAll('[data-open-companion]')){
    trigger.hidden=false;trigger.setAttribute('aria-controls',panel.id);trigger.setAttribute('aria-haspopup','dialog');
    trigger.addEventListener('click',()=>{open();const query=trigger.dataset.openCompanion?.trim();if(query){input.value=query;render(query,{commit:true});input.blur();focusContent();}});
  }
  root.querySelector('.sprite-close').addEventListener('click',close);
  document.addEventListener('pointerdown',event=>{if(opened && !panel.contains(event.target) && !launcher.contains(event.target))close();});
  // This is a nonmodal search: Tab can return to the page, and the surface
  // dismisses without pulling focus away from the visitor's next control.
  document.addEventListener('focusin',event=>{if(opened && !panel.contains(event.target))close(false);});
  results.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(!link || event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    const destination=new URL(link.href);
    if(destination.origin!==siteURL.origin || link.hasAttribute('download'))return;
    close(false);
    // Native anchors own scrolling and history. Also focus a repeated same-page
    // destination, where hashchange may not fire a second time.
    if(destination.pathname===location.pathname && destination.hash){
      requestAnimationFrame(()=>{
        let section;try{section=document.getElementById(decodeURIComponent(destination.hash.slice(1)));}catch{return;}
        const target=section?.querySelector('h1,h2,h3') || section;
        if(!target)return;
        const old=target.getAttribute('tabindex');target.tabIndex=-1;target.focus({preventScroll:true});
        target.addEventListener('blur',()=>{if(old===null)target.removeAttribute('tabindex');else target.setAttribute('tabindex',old);},{once:true});
      });
    }
  });
  launcher.addEventListener('click',event=>{if(suppressClick){event.preventDefault();return;}opened?close():open();});
  root.querySelector('form').addEventListener('submit',event=>{
    event.preventDefault();clearTimeout(timer);if(composing || event.isComposing || !input.value.trim())return;
    render(input.value,{commit:true});input.blur();focusContent();
  });
  input.addEventListener('input',()=>{
    clear.hidden=!input.value;submit.disabled=!input.value.trim();
    if(composing)return;clearTimeout(timer);results.setAttribute('aria-busy','true');timer=setTimeout(()=>render(input.value),120);
  });
  input.addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer);});
  input.addEventListener('compositionend',()=>{composing=false;render(input.value);});
  clear.addEventListener('click',()=>{clearTimeout(timer);input.value='';committedContext=null;render('');input.focus({preventScroll:true});});
  panel.addEventListener('keydown',event=>{
    if(event.altKey || event.metaKey || event.ctrlKey || event.isComposing || composing || !['ArrowDown','ArrowUp'].includes(event.key))return;
    const targets=[...results.querySelectorAll('summary,a')].filter(element=>{
      if(!element.getClientRects().length)return false;
      for(let owner=element.parentElement;owner && owner!==results;owner=owner.parentElement)if(owner.tagName==='DETAILS' && !owner.open && owner.querySelector('summary')!==element)return false;
      return true;
    });
    if(!targets.length)return;
    const index=targets.indexOf(document.activeElement),headingFocused=document.activeElement?.matches('h3,h4,.sprite-empty strong');
    if(document.activeElement!==input && index<0 && !headingFocused)return;
    if(document.activeElement===input && event.key==='ArrowUp')return;
    event.preventDefault();const next=index+(event.key==='ArrowDown'?1:-1);
    if(next<0)input.focus({preventScroll:true});else{const target=targets[Math.min(next,targets.length-1)];target.focus({preventScroll:true});target.scrollIntoView({block:'nearest'});}
  });
  document.addEventListener('keydown',event=>{
    if(event.isComposing || composing || event.defaultPrevented)return;
    if(event.key==='Escape' && opened){event.preventDefault();close();}
    if((event.metaKey || event.ctrlKey) && event.key.toLowerCase()==='k'){event.preventDefault();open();}
  });
  render('');
  launcher.hidden=false;
  const pauseCharacter=()=>root.toggleAttribute('data-sprite-paused',document.hidden);
  document.addEventListener('visibilitychange',pauseCharacter);pauseCharacter();
  // Keep the search field above the software keyboard without scrolling the page.
  function fitKeyboard() {
    if (!opened || !window.visualViewport) return;
    const viewport=window.visualViewport;
    const overlap=Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop);
    const keyboard=overlap>100;
    root.toggleAttribute('data-keyboard',keyboard);
    if (keyboard || window.innerWidth<800) {
      const gutter=viewport.height<280?8:12;
      panel.style.top=`${Math.max(0,viewport.offsetTop)+gutter}px`;
      panel.style.bottom='auto';
      panel.style.maxHeight=`${Math.max(0,viewport.height-2*gutter)}px`;
    } else {['top','bottom','max-height'].forEach(property=>panel.style.removeProperty(property));}
  }
  window.visualViewport?.addEventListener('resize',fitKeyboard);
  window.visualViewport?.addEventListener('scroll',fitKeyboard);
  window.visualViewport?.addEventListener('resize',syncTone);
  addEventListener('scroll',syncTone,{passive:true});addEventListener('resize',syncTone,{passive:true});
  // The outer anchor stays still for tapping; only the inner pearl floats.
  let drag, suppressClick = false, draggedPosition = false;
  function boundaries() {
    const dock = document.querySelector('[data-glass-dock]')?.getBoundingClientRect();
    const floor = dock && dock.top > innerHeight / 2 ? dock.top - 12 : innerHeight - 12;
    return {minX:8,maxX:Math.max(8,innerWidth-launcher.offsetWidth-8),minY:8,maxY:Math.max(8,floor-launcher.offsetHeight)};
  }
  function position(x,y) {
    const b = boundaries();
    root.style.left = `${Math.min(b.maxX,Math.max(b.minX,x))}px`;
    root.style.top = `${Math.min(b.maxY,Math.max(b.minY,y))}px`;
    root.style.right = 'auto';root.style.bottom = 'auto';draggedPosition = true;
  }
  launcher.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const box = launcher.getBoundingClientRect();
    drag = {id:event.pointerId,x:event.clientX,y:event.clientY,left:box.left,top:box.top,moved:false};
    suppressClick = false; launcher.setPointerCapture(event.pointerId);
  });
  launcher.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX-drag.x,dy = event.clientY-drag.y;
    if (!drag.moved && Math.hypot(dx,dy) < 7) return;
    drag.moved = true;suppressClick = true;root.setAttribute('data-dragging','');
    position(drag.left+dx,drag.top+dy);
  });
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;drag = null;root.removeAttribute('data-dragging');
    if (moved) {
      const box = launcher.getBoundingClientRect();
      position(box.left+box.width/2 < innerWidth/2 ? 10 : innerWidth-box.width-10,box.top);
      try {sessionStorage.setItem('mjc-sprite-position',JSON.stringify({side:box.left+box.width/2<innerWidth/2?'left':'right',ratio:box.top/Math.max(1,innerHeight)}));} catch {}
      setTimeout(()=>{suppressClick=false;},100);
    }
  }
  launcher.addEventListener('pointerup', finishDrag);
  launcher.addEventListener('pointercancel', finishDrag);
  launcher.addEventListener('lostpointercapture', event => {if(drag)finishDrag(event);});
  try {
    const saved = JSON.parse(sessionStorage.getItem('mjc-sprite-position'));
    if (saved && ['left','right'].includes(saved.side) && Number.isFinite(saved.ratio)) position(saved.side==='left'?10:innerWidth-launcher.offsetWidth-10,saved.ratio*innerHeight);
  } catch {}
  window.addEventListener('resize', () => {
    if(draggedPosition){const box=launcher.getBoundingClientRect();position(box.left,box.top);} fitKeyboard();
  });
  launcher.addEventListener('pointermove', event => {
    if (drag || reduced.matches) return;
    const box = launcher.getBoundingClientRect();
    launcher.style.setProperty('--sprite-eye-x',`${(event.clientX-box.left-box.width/2)/14}px`);
    launcher.style.setProperty('--sprite-eye-y',`${(event.clientY-box.top-box.height/2)/18}px`);
  });
  launcher.addEventListener('pointerleave',()=>{launcher.style.setProperty('--sprite-eye-x','0px');launcher.style.setProperty('--sprite-eye-y','0px');});
})();
