/* Local appearance preferences; no network requests or visitor tracking. */
(() => {
  'use strict';
  const root = document.documentElement;
  const slider = document.querySelector('#glass-clarity');
  const output = document.querySelector('#glass-clarity-value');
  const motion = document.querySelector('#glass-motion');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const key = 'portfolio-glass-appearance-v1';
  let settings = { clarity: 82, motion: !reduced.matches };
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && Number.isFinite(saved.clarity)) settings.clarity = Math.max(0, Math.min(100, saved.clarity));
    if (saved && typeof saved.motion === 'boolean') settings.motion = saved.motion;
  } catch { /* Storage may be unavailable in a private browsing session. */ }
  function apply() {
    root.style.setProperty('--glass-alpha', String(.72 - settings.clarity * .0066));
    root.dataset.sceneMotion = settings.motion && !reduced.matches ? 'on' : 'off';
    if (slider) slider.value = settings.clarity;
    if (output) output.value = `${settings.clarity}%`;
    if (motion) {
      motion.checked = settings.motion && !reduced.matches;
      motion.disabled = reduced.matches;
    }
  }
  function save() {
    apply();
    try { localStorage.setItem(key, JSON.stringify(settings)); } catch { /* Preferences still work for this visit. */ }
  }
  slider?.addEventListener('input', () => { settings.clarity = Number(slider.value); save(); });
  motion?.addEventListener('change', () => { settings.motion = motion.checked; save(); });
  reduced.addEventListener('change', apply);
  apply();
  const preferences = document.querySelector('.glass-preferences');
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && preferences?.open) {
      preferences.open = false;
      preferences.querySelector('summary').focus();
    }
  });
  document.addEventListener('click', event => {
    if (preferences?.open && !preferences.contains(event.target)) preferences.open = false;
  });
  // Only schedule a frame after a pointer event; never run a continuous JS loop.
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  let frame = 0;
  let point = null;
  document.addEventListener('pointermove', event => {
    if (root.dataset.sceneMotion !== 'on' || document.hidden) return;
    point = { x: event.clientX, y: event.clientY, target: event.target };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!point || root.dataset.sceneMotion !== 'on') return;
      root.style.setProperty('--scene-x', `${(point.x / innerWidth - .5) * 18}px`);
      root.style.setProperty('--scene-y', `${(point.y / innerHeight - .5) * 12}px`);
      const card = point.target.closest?.('.capability-card');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--light-x', `${point.x - rect.left}px`);
      card.style.setProperty('--light-y', `${point.y - rect.top}px`);
    });
  }, { passive: true });
})();
