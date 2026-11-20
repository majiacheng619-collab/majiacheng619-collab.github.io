(() => {
  const select = document.querySelector('select[data-appearance]');
  if (!select) return;
  select.value = document.documentElement.dataset.appearance;
  select.addEventListener('change', () => window.PortfolioAppearance.apply(select.value, true));
  window.addEventListener('portfolio:appearance', () => {
    select.value = document.documentElement.dataset.appearance;
  });
})();
