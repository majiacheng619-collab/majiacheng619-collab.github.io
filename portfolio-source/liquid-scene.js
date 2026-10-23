/* A fixed clear material, with motion controlled by operating-system preferences. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Retired controls must not restore a visitor's old opacity choice.
  try { localStorage.removeItem('portfolio-glass-appearance-v1'); } catch { /* Private mode. */ }
  function syncMotion() {
    root.dataset.sceneMotion = reduced.matches ? 'off' : 'on';
    root.dataset.scenePaused = document.hidden ? 'true' : 'false';
  }
  reduced.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  addEventListener('pageshow', syncMotion);
  syncMotion();
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  let frame = 0;
  let point;
  document.addEventListener('pointermove', event => {
    if (reduced.matches || document.hidden) return;
    point = { x: event.clientX, y: event.clientY, target: event.target };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!point || reduced.matches || document.hidden) return;
      root.style.setProperty('--scene-x', `${(point.x / innerWidth - .5) * 14}px`);
      root.style.setProperty('--scene-y', `${(point.y / innerHeight - .5) * 10}px`);
      const surface = point.target.closest?.('.capability-card,.case-study,.role-path,.premium-story,.home-field');
      if (!surface) return;
      const rect = surface.getBoundingClientRect();
      surface.style.setProperty('--light-x', `${point.x - rect.left}px`);
      surface.style.setProperty('--light-y', `${point.y - rect.top}px`);
    });
  }, { passive: true });
})();
