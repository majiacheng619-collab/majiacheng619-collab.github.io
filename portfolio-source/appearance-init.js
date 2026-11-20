try {
  const theme = localStorage.getItem('portfolio-theme');
  const size = localStorage.getItem('portfolio-size');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  if (size === 'large') document.documentElement.dataset.textSize = size;
} catch {}
