/* Scroll-linked water response. The browser retains native scrolling. */
(() => {
  'use strict';
  const field = document.querySelector('.ambient-field');
  if (!field) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const drops = [...field.querySelectorAll('.ambient-droplet')];
  let frame = 0, prior = scrollY, impulse = 0, displacement = 0, previousTime = 0;
  function animate(time) {
    frame = 0;
    if (reduce.matches || document.hidden) return;
    const dt = Math.min(3, (time - (previousTime || time - 16.67)) / 16.67);
    previousTime = time;
    impulse *= Math.pow(.83, dt);
    displacement += (impulse * .55 - displacement) * .11;
    drops.forEach((drop, index) => {
      drop.style.setProperty('--drop-y', `${displacement * (index ? -.7 : 1)}px`);
      drop.style.setProperty('--drop-stretch', String(1 + Math.min(.28, Math.abs(impulse) * .004)));
    });
    if (Math.abs(impulse) > .05 || Math.abs(displacement) > .1) frame = requestAnimationFrame(animate);
    else previousTime = 0;
  }
  function reset() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; impulse = 0; displacement = 0; previousTime = 0; prior = scrollY;
    drops.forEach(drop => {drop.style.removeProperty('--drop-y'); drop.style.removeProperty('--drop-stretch');});
  }
  addEventListener('scroll', () => {
    const next = scrollY, delta = next - prior; prior = next;
    if (reduce.matches || document.hidden) return;
    impulse = Math.max(-65, Math.min(65, impulse + delta * .22));
    if (!frame) frame = requestAnimationFrame(animate);
  }, {passive:true});
  reduce.addEventListener('change', reset);
  document.addEventListener('visibilitychange', reset);
  let lastPulse = 0;
  document.addEventListener('pointerdown', event => {
    if (reduce.matches || event.button !== 0 || event.target.closest('dialog,video,audio,input,textarea,button,a')) return;
    const now = performance.now();
    if (now - lastPulse < 180) return;
    lastPulse = now;
    const pulse = document.createElement('span');
    pulse.className = 'water-pulse'; pulse.setAttribute('aria-hidden','true');
    pulse.style.left = `${event.clientX}px`; pulse.style.top = `${event.clientY}px`;
    document.body.append(pulse);
    pulse.addEventListener('animationend', () => pulse.remove(), {once:true});
    setTimeout(() => pulse.remove(), 1000);
  }, {passive:true});
})();
