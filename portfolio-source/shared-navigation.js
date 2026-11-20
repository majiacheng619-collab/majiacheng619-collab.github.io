(() => {
  const key = 'mjc-shared-card';
  const root = document.documentElement;
  const pathKey = path => path.replace(/(?:index\.html)?$/, '').replace(/\/$/, '');
  const disabled = () => root.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const native = 'onpageswap' in window && 'onpagereveal' in window;
  let active;

  document.addEventListener('click', event => {
    const card = event.target.closest('a[data-shared-card]');
    if (!card || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || disabled()) return;
    const url = new URL(card.href, location.href);
    if (url.origin !== location.origin || pathKey(url.pathname) === pathKey(location.pathname)) return;
    const bounds = card.getBoundingClientRect();
    const record = { path: pathKey(url.pathname), x: bounds.left, y: bounds.top, width: bounds.width,
      height: bounds.height, start: Date.now() };
    try { sessionStorage.setItem(key, JSON.stringify(record)); } catch {}
    if (native) {
      if (active && active !== card) active.style.removeProperty('view-transition-name');
      active = card;
      card.style.viewTransitionName = 'portfolio-card';
    }
  }, { passive: true });

  const destination = document.querySelector('[data-shared-target], .detail-hero, .ice-theater .film-heading');
  function take() {
    try {
      const previous = JSON.parse(sessionStorage.getItem(key));
      if (previous?.path === pathKey(location.pathname) && Date.now() - previous.start < 3500) {
        sessionStorage.removeItem(key);
        return previous;
      }
    } catch {}
    return null;
  }

  const record = take();
  if (record && destination && !disabled()) {
    if (native) {
      destination.style.viewTransitionName = 'portfolio-card';
      addEventListener('pagereveal', event => {
        if (event.viewTransition) event.viewTransition.finished.catch(() => {}).finally(() => destination.style.removeProperty('view-transition-name'));
        else { destination.style.removeProperty('view-transition-name'); flip(); }
      }, { once: true });
    } else flip();
  }

  function flip() {
    if (!destination.animate || !record) return;
    const current = destination.getBoundingClientRect();
    if (current.width < 1 || current.height < 1) return;
    const scaleX = Math.max(.35, Math.min(1, record.width / current.width));
    const scaleY = Math.max(.35, Math.min(1, record.height / current.height));
    const x = Math.max(-180, Math.min(180, record.x - current.x));
    const y = Math.max(-180, Math.min(180, record.y - current.y));
    const animation = destination.animate([
      { transformOrigin: '0 0', transform: 'translate(' + x + 'px,' + y + 'px) scale(' + scaleX + ',' + scaleY + ')', opacity: .55 },
      { transformOrigin: '0 0', transform: 'none', opacity: 1 },
    ], { duration: 360, easing: 'cubic-bezier(.19,1,.22,1)' });
    for (const name of ['pointerdown', 'keydown', 'portfolio:settings']) addEventListener(name, () => animation.cancel(), { once: true });
  }
  addEventListener('pageshow', () => active?.style.removeProperty('view-transition-name'));
})();
