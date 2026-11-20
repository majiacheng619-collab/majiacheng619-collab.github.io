(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const small = navigator.connection;
  const loader = document.currentScript.src;
  let loaded = document.readyState === 'complete', queued = false, activated = false;

  function allowed() {
    return loaded && !document.hidden && !reduced.matches &&
      root.dataset.motion !== 'reduced' && !small?.saveData;
  }

  function update() {
    if (!allowed()) {
      root.removeAttribute('data-polish');
      return;
    }
    if (queued || root.hasAttribute('data-polish')) return;
    queued = true;
    // Let the stable first frame paint before requesting decorative GPU work.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const activate = () => {
        queued = false;
        if (!allowed()) return;
        root.dataset.polish = 'ready';
        if (!activated) {
          activated = true;
          if (document.querySelector('[data-era-hero]')) {
            import(new URL('POLISH_ART_ASSET', loader)).catch(() => {});
          }
        }
        window.dispatchEvent(new Event('portfolio:polish'));
      };
      if ('requestIdleCallback' in window) requestIdleCallback(activate, { timeout: 2000 });
      else setTimeout(activate, 120);
    }));
  }

  if (!loaded) addEventListener('load', () => { loaded = true; update(); }, { once: true });
  document.addEventListener('visibilitychange', update);
  reduced.addEventListener?.('change', update);
  small?.addEventListener?.('change', update);
  addEventListener('portfolio:settings', update);
  update();
})();
