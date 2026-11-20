(() => {
  const serviceWorker = navigator.serviceWorker;
  const update = document.querySelector('[data-pwa-update]');
  if (!serviceWorker || !update || navigator.connection?.saveData || !isSecureContext) return;
  let updating = false;
  function watch(registration) {
    function show() { update.hidden = !(registration.waiting && serviceWorker.controller); }
    function watchInstaller() {
      registration.installing?.addEventListener('statechange', event => {
        if (event.target.state === 'installed') show();
      });
    }
    show();
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
  const defer = () => setTimeout(() => {
    if ('requestIdleCallback' in window) requestIdleCallback(register, { timeout: 3500 });
    else register();
  }, 2300);
  if (document.readyState === 'complete') defer();
  else addEventListener('load', defer, { once: true });
})();
