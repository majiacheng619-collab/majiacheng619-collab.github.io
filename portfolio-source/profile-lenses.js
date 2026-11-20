(() => {
  const optionGroups = document.querySelectorAll('[data-lenses]');
  if (!optionGroups.length) return;
  const list = document.querySelector('[data-lens-list]');
  if (!list) return;
  const cards = [...list.querySelectorAll(':scope > [data-case-id]')];
  if (!cards.length) return;
  for (const group of optionGroups) {
    group.hidden = false;
    group.addEventListener('click', event => {
      const active = event.target.closest('[data-lens]');
      if (!active) return;
      const priority = (active.dataset.lensOrder || '').split(' ').filter(Boolean);
      const rank = id => priority.includes(id) ? priority.indexOf(id) : priority.length;
      const order = [...cards].sort((a, b) => rank(a.dataset.caseId) - rank(b.dataset.caseId));
      for (const card of order) {
        card.toggleAttribute('data-lens-highlight', priority.includes(card.dataset.caseId));
        list.appendChild(card);
      }
      group.querySelectorAll('[data-lens]').forEach(item => item.setAttribute('aria-pressed', String(item === active)));
    });
  }
})();
