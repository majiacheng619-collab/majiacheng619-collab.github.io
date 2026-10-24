/* Direct contact: show which real control is pressed without owning its click or scroll. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const interactive = 'a.capability-card,a.premium-story,a.button,button:not([disabled]),summary,.role-path a,.premium-experience-list>a,.contact-methods a,[data-dialog-open],[data-portrait-open],[data-image-open]';
  const surfaces = '.capability-card,.case-study,.role-path,.premium-story,.home-field';
  const releaseTimers = new WeakMap();
  let active = null, frame = 0, point = null;
  try { localStorage.removeItem('portfolio-glass-appearance-v1'); } catch { /* Private mode. */ }
  function syncMotion() {
    root.dataset.sceneMotion = reduced.matches ? 'off' : 'on';
    root.dataset.scenePaused = document.hidden ? 'true' : 'false';
    if (document.hidden || reduced.matches) clearContact(false);
  }
  function controlFor(target) {
    const control = target.closest?.(interactive);
    // The dock owns its own drag spring; disabled and dialog-close controls stay native.
    return control && !control.matches('.dialog-close,[data-dialog-close]') && !control.closest('[data-glass-dock]') ? control : null;
  }
  document.querySelectorAll(interactive).forEach(control => {
    if (!control.matches('.dialog-close,[data-dialog-close]') && !control.closest('[data-glass-dock]')) control.dataset.glassControl = '';
  });
  function locate(control, x, y) {
    const r = control.getBoundingClientRect();
    const localX = Math.max(0, Math.min(r.width, x-r.left));
    const localY = Math.max(0, Math.min(r.height, y-r.top));
    control.style.setProperty('--press-x', `${localX}px`);
    control.style.setProperty('--press-y', `${localY}px`);
    control.style.setProperty('--press-rx', `${-(localY/Math.max(1,r.height)-.5)*7}deg`);
    control.style.setProperty('--press-ry', `${(localX/Math.max(1,r.width)-.5)*7}deg`);
    control.style.setProperty('--light-x', `${localX}px`);
    control.style.setProperty('--light-y', `${localY}px`);
  }
  function clearContact(activate) {
    if (!active) return;
    const {control} = active;
    active = null;
    delete control.dataset.glassPressed;
    if (activate && !reduced.matches) {
      control.dataset.glassReleased = 'true';
      clearTimeout(releaseTimers.get(control));
      releaseTimers.set(control, setTimeout(() => { delete control.dataset.glassReleased; }, 700));
    } else delete control.dataset.glassReleased;
  }
  function begin(control, x, y, id) {
    clearContact(false);
    clearTimeout(releaseTimers.get(control));
    control.dataset.glassControl = '';
    delete control.dataset.glassReleased;
    locate(control, x, y);
    control.dataset.glassPressed = 'true';
    active = {control, x, y, id};
  }
  document.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const control = controlFor(event.target);
    if (control) begin(control, event.clientX, event.clientY, event.pointerId);
  }, {passive:true});
  document.addEventListener('pointermove', event => {
    if (active && event.pointerId === active.id) {
      // A vertical swipe always belongs to the browser, never to this material effect.
      if (Math.hypot(event.clientX-active.x,event.clientY-active.y)>12) clearContact(false);
    }
    if (reduced.matches || document.hidden) return;
    point = {x:event.clientX,y:event.clientY,target:event.target};
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!point || reduced.matches || document.hidden) return;
      root.style.setProperty('--scene-x', `${(point.x/innerWidth-.5)*24}px`);
      root.style.setProperty('--scene-y', `${(point.y/innerHeight-.5)*18}px`);
      const surface = point.target.closest?.(surfaces);
      if (surface) {
        const r = surface.getBoundingClientRect();
        surface.style.setProperty('--light-x', `${point.x-r.left}px`);
        surface.style.setProperty('--light-y', `${point.y-r.top}px`);
      }
    });
  }, {passive:true});
  document.addEventListener('pointerup', event => { if (active?.id===event.pointerId) clearContact(true); }, {passive:true});
  document.addEventListener('pointercancel', () => clearContact(false), {passive:true});
  document.addEventListener('keydown', event => {
    if (event.repeat || !['Enter',' '].includes(event.key)) return;
    const control = controlFor(event.target);
    if (!control || (event.key===' ' && control.matches('a'))) return;
    const r = control.getBoundingClientRect();
    begin(control,r.left+r.width/2,r.top+r.height/2,'keyboard');
  });
  document.addEventListener('keyup', event => { if (['Enter',' '].includes(event.key) && active?.id==='keyboard') clearContact(true); });
  for (const event of ['blur','pagehide','resize','scroll','contextmenu']) addEventListener(event, () => clearContact(false), {passive:true});
  reduced.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  addEventListener('pageshow', syncMotion);
  syncMotion();
})();
