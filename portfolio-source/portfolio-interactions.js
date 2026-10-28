/* Small portfolio-only keyboard improvements. Existing springs, pointer input,
 * native scrolling, dialogs and click activation each keep their single owner. */
(() => {
  'use strict';
  if (!document.body.matches('.home-page,.inner-page')) return;

  // Preserve saved links to business cards whose full cases now live in Experience.
  if (/\/projects\/(?:index\.html)?$/.test(location.pathname)) {
    const destination = {'#service-work':'ecommerce','#campus-work':'printing'}[location.hash];
    if (destination) { location.replace(new URL('../experience/index.html#'+destination,location.href)); return; }
  }

  const dock = document.querySelector('[data-glass-dock]');
  if (dock && !dock.dataset.keyboardNavigation) {
    dock.dataset.keyboardNavigation = 'ready';
    dock.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
      const links = [...dock.querySelectorAll('a[data-dock-link][href]')];
      const current = links.indexOf(event.target);
      if (current < 0) return;
      const reverse = getComputedStyle(dock).direction === 'rtl' ? -1 : 1;
      let next;
      if (event.key === 'ArrowRight') next = (current + reverse + links.length) % links.length;
      else if (event.key === 'ArrowLeft') next = (current - reverse + links.length) % links.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = links.length - 1;
      else return;
      // Arrow keys only move focus. Current-page semantics and the material
      // selection remain truthful until the user activates a real destination.
      event.preventDefault();
      links[next].focus({preventScroll:true});
    });
  }

  const focusDeepLink = () => {
    if (!location.hash || document.querySelector('dialog[open]')) return;
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target || !target.closest('main') || !target.getClientRects().length) return;
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement && active.tagName !== 'A') return;
    if (active?.tagName === 'A') {
      let destination;
      try { destination = new URL(active.href,location.href); } catch { return; }
      if (destination.pathname !== location.pathname || destination.hash !== location.hash) return;
    }
    const heading = target.matches('h1,h2,h3') ? target : target.querySelector('h1,h2,h3');
    const destination = heading || target;
    const previous = destination.getAttribute('tabindex');
    destination.setAttribute('tabindex','-1');
    destination.dataset.anchorFocus = '';
    // The browser owns the anchor scroll. This moves only the reading/focus
    // position, so keyboard and screen-reader users arrive at the same section.
    destination.focus({preventScroll:true});
    destination.addEventListener('blur', () => {
      if (previous === null) destination.removeAttribute('tabindex');
      else destination.setAttribute('tabindex',previous);
      delete destination.dataset.anchorFocus;
    }, {once:true});
  };
  addEventListener('hashchange',focusDeepLink);
  addEventListener('pageshow',event => { if (!event.persisted) focusDeepLink(); });
  // Once-only reading transitions: content is visible before JavaScript and
  // pressure/focus always wins over an entrance that is still in progress.
  const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
  const entranceAnimations=new Map();
  let entranceObserver;
  function clearEntrances(){
    entranceObserver?.disconnect();
    for(const animation of entranceAnimations.values())animation.cancel();
    entranceAnimations.clear();
  }
  function observeEntrances(){
    if(motionPreference.matches||!('IntersectionObserver' in window))return;
    const nodes=[...document.querySelectorAll('.practice-glass,.work-card,.detail-row-list,.case-study,.detail-split,.contact-identity')];
    entranceObserver=new IntersectionObserver(entries=>{
      if(motionPreference.matches)return;
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        const node=entry.target;entranceObserver.unobserve(node);
        if(node.dataset.motionEntered)continue;
        node.dataset.motionEntered='true';
        if(node.matches(':focus-within,[data-glass-pressed="true"]'))continue;
        const animation=node.animate([{opacity:.65,translate:'0 20px'},{opacity:1,translate:'0 0'}],{duration:650,easing:'cubic-bezier(.22,1,.36,1)'});
        entranceAnimations.set(node,animation);
        animation.finished.catch(()=>{}).finally(()=>{if(entranceAnimations.get(node)===animation)entranceAnimations.delete(node);});
      }
    },{threshold:.12});
    nodes.filter(node=>!node.dataset.motionEntered&&!node.closest('[data-reveal]')).forEach(node=>entranceObserver.observe(node));
  }
  function yieldToInput(event){
    for(const [node,animation] of entranceAnimations)if(node.contains(event.target)){animation.cancel();entranceAnimations.delete(node);}
  }
  document.addEventListener('pointerdown',yieldToInput,{passive:true,capture:true});
  document.addEventListener('focusin',yieldToInput,{passive:true});
  motionPreference.addEventListener('change',()=>{clearEntrances();observeEntrances();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearEntrances();else observeEntrances();});
  addEventListener('pagehide',clearEntrances);
  addEventListener('pageshow',event=>{if(event.persisted)observeEntrances();});
  observeEntrances();
})();
