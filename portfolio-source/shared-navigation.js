(() => {
  const key = 'mjc-shared-card';
  const root = document.documentElement;
  const pathKey = path => path.replace(/(?:index\.html)?$/, '').replace(/\/$/, '');
  const disabled = () => root.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const native = 'onpageswap' in window && 'onpagereveal' in window;
  const heading = document.querySelector('[data-shared-target], .detail-hero, .ice-theater .film-heading, .story-page h1');
  let active, lastCard, outgoing = false;

  function settleNativeTransition(event) {
    const transition = event.viewTransition;
    if (!transition) return;
    // Keep the CSS opt-in stable. Cancel the current transition when the
    // motion preference changes, without leaving a rejected browser promise.
    transition.ready.catch(() => {});
    transition.finished.catch(() => {});
    transition.updateCallbackDone.catch(() => {});
    if (disabled()) transition.skipTransition();
  }
  addEventListener('pageswap', settleNativeTransition);
  addEventListener('pagereveal', settleNativeTransition);

  function remember(element, path, card, from, returning) {
    const { left, top, width, height } = element.getBoundingClientRect();
    const record = { path, x: left, y: top, width, height, start: Date.now(), card, from, returning };
    try { sessionStorage.setItem(key, JSON.stringify(record)); } catch {}
    if (native) {
      if (active && active !== element) active.style.removeProperty('view-transition-name');
      active = element;
      element.style.viewTransitionName = 'portfolio-card';
    }
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey ||
        event.metaKey || event.altKey || event.shiftKey || disabled()) return;
    const url = new URL(link.href, location.href);
    const path = pathKey(url.pathname);
    if (url.origin !== location.origin || path === pathKey(location.pathname)) return;
    if (link.dataset.sharedCard) {
      remember(link, path, link.dataset.sharedCard, pathKey(location.pathname), false);
      outgoing = true;
    } else if (lastCard && heading && path === lastCard.from) {
      remember(heading, path, lastCard.card, pathKey(location.pathname), true);
      outgoing = true;
    }
  }, { passive: true });

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

  function arrive(useNative) {
    const record = take();
    if (!record || disabled()) return;
    const target = record.returning && typeof record.card === 'string'
      ? [...document.querySelectorAll('a[data-shared-card]')].find(link => link.dataset.sharedCard === record.card)
      : heading;
    if (!target) return;
    if (!record.returning) lastCard = record;
    if (!useNative) { flip(target, record); return; }
    target.style.viewTransitionName = 'portfolio-card';
    addEventListener('pagereveal', event => {
      const clear = () => target.style.removeProperty('view-transition-name');
      const fallback = () => { clear(); if (!disabled()) flip(target, record); };
      if (event.viewTransition) {
        event.viewTransition.ready.catch(fallback);
        event.viewTransition.finished.then(clear, clear);
      } else fallback();
    }, { once: true });
  }

  function flip(destination, record) {
    if (!destination.animate) return;
    const current = destination.getBoundingClientRect();
    if (current.width < 1 || current.height < 1) return;
    const scaleX = Math.max(.35, Math.min(1.3, record.width / current.width));
    const scaleY = Math.max(.35, Math.min(1.3, record.height / current.height));
    const x = Math.max(-180, Math.min(180, record.x - current.x));
    const y = Math.max(-180, Math.min(180, record.y - current.y));
    const animation = destination.animate([
      { transformOrigin: '0 0', transform: 'translate(' + x + 'px,' + y + 'px) scale(' + scaleX + ',' + scaleY + ')', opacity: .55 },
      { transformOrigin: '0 0', transform: 'none', opacity: 1 },
    ], { duration: 360, easing: 'cubic-bezier(.19,1,.22,1)' });
    for (const name of ['pointerdown', 'keydown', 'portfolio:settings']) addEventListener(name, () => animation.cancel(), { once: true });
  }
  arrive(native);
  addEventListener('pagehide', () => {
    if (!outgoing && !disabled() && heading && lastCard) {
      remember(heading, lastCard.from, lastCard.card, pathKey(location.pathname), true);
    }
  });
  addEventListener('pageshow', event => {
    outgoing = false;
    active?.style.removeProperty('view-transition-name');
    if (event.persisted) arrive(false);
  });
})();
