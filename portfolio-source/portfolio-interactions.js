(() => {
  const settings = document.querySelector('.settings');
  const theme = settings.querySelector('[data-theme-choice]');
  const size = settings.querySelector('[data-size-choice]');
  const root = document.documentElement;
  theme.value = root.dataset.theme || 'auto';
  size.value = root.dataset.textSize || 'normal';
  function change(control, property, key, fallback) {
    control.addEventListener('change', () => {
      if (control.value === fallback) delete root.dataset[property];
      else root.dataset[property] = control.value;
      try { localStorage.setItem(key, control.value); } catch {}
    });
  }
  change(theme, 'theme', 'portfolio-theme', 'auto');
  change(size, 'textSize', 'portfolio-size', 'normal');
  settings.querySelectorAll('[data-setting]').forEach(label => { label.hidden = false; });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !settings.open) return;
    settings.open = false;
    settings.querySelector('summary').focus();
  });
  document.addEventListener('pointerdown', event => {
    if (settings.open && !settings.contains(event.target)) settings.open = false;
  });
})();
