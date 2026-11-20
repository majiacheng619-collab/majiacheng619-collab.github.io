(() => {
  const serviceWorker = navigator.serviceWorker;
  const update = document.querySelector('[data-pwa-update]');
  if (!serviceWorker || !update || navigator.connection?.saveData || !isSecureContext) return;
  let updating = false;
  let returned = false;
  const check = () => {
    if (!document.hidden && navigator.onLine) serviceWorker.controller?.postMessage({ type: 'CHECK_RELEASE' });
  };
  serviceWorker.addEventListener('message', event => {
    if (returned || event.source?.scriptURL !== new URL('/sw.js', location.origin).href || event.data?.type !== 'OS_ROLLBACK') return;
    returned = true;
    location.replace('/');
  });
  addEventListener('pageshow', check);
  addEventListener('online', check);
  document.addEventListener('visibilitychange', check);
  setInterval(check, 60000);
  function watch(registration) {
    function show() { update.hidden = !(registration.waiting && serviceWorker.controller); }
    function watchInstaller() {
      registration.installing?.addEventListener('statechange', event => {
        if (event.target.state === 'installed') show();
      });
    }
    show();
    check();
    watchInstaller();
    registration.addEventListener('updatefound', watchInstaller);
    update.addEventListener('click', () => {
      if (!registration.waiting || updating) return;
      updating = true; update.disabled = true;
      registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
    });
    serviceWorker.addEventListener('controllerchange', () => {
      if (updating) location.reload();
      else show();
    });
  }
  function register() {
    serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(watch).catch(() => {});
  }
  let scheduled = false;
  let fallback;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    clearTimeout(fallback);
    removeEventListener('pointerup', schedule);
    removeEventListener('keydown', schedule);
    if ('requestIdleCallback' in window) requestIdleCallback(register, { timeout: 3500 });
    else setTimeout(register, 200);
  }
  function defer() {
    addEventListener('pointerup', schedule, { once: true, passive: true });
    addEventListener('keydown', schedule, { once: true });
    fallback = setTimeout(schedule, 8000);
  }
  if (document.readyState === 'complete') defer();
  else addEventListener('load', defer, { once: true });
})();
