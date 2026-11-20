(() => {
  const clock = document.querySelector('[data-standby-time]');
  if (clock) {
    const date = document.querySelector('[data-standby-date]');
    const time = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const day = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
    function sync() {
      const now = new Date();
      clock.textContent = time.format(now);
      date.textContent = day.format(now);
    }
    sync();
    const timer = setInterval(() => { if (!document.hidden) sync(); }, 1000);
    addEventListener('pagehide', event => { if (!event.persisted) clearInterval(timer); });
    document.addEventListener('visibilitychange', sync);
  }

  const avatar = document.querySelector('[data-avatar-seed]');
  const sprout = document.querySelector('[data-avatar-sprout]');
  if (avatar && sprout) {
    let count = 0, last = 0, timer;
    avatar.addEventListener('click', () => {
      const now = performance.now();
      count = now - last < 1000 ? count + 1 : 1;
      last = now;
      if (count < 5) return;
      count = 0;
      clearTimeout(timer);
      sprout.hidden = false;
      window.dispatchEvent(new CustomEvent('portfolio:feedback', { detail: '萌芽生长了' }));
      timer = setTimeout(() => { sprout.hidden = true; }, 2900);
    });
  }
  const print = document.querySelector('[data-print-page]');
  if (print) {
    print.hidden = false;
    print.addEventListener('click', () => window.print());
  }
  let closed = [];
  addEventListener('beforeprint', () => {
    closed = [...document.querySelectorAll('main details:not([open])')];
    for (const item of closed) item.open = true;
  });
  addEventListener('afterprint', () => {
    for (const item of closed) item.open = false;
    closed = [];
  });
})();
