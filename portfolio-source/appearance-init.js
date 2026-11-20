(() => {
  const key = 'mjc-appearance';
  const choices = ['auto', 'light', 'dark'];
  const system = matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;

  function apply(mode, persist = false) {
    if (!choices.includes(mode)) mode = 'auto';
    const dark = mode === 'dark' || (mode === 'auto' && system.matches);
    root.dataset.appearance = mode;
    root.dataset.tone = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#071625' : '#ecf5ff';
    if (persist) {
      try { localStorage.setItem(key, mode); } catch {}
    }
    window.dispatchEvent(new Event('portfolio:appearance'));
  }

  let initial;
  try { initial = localStorage.getItem(key); } catch {}
  apply(initial);
  system.addEventListener?.('change', () => {
    if (root.dataset.appearance === 'auto') apply('auto');
  });
  window.PortfolioAppearance = { apply };
})();
