(() => {
  const dialog = document.getElementById('case-sheet');
  if (!dialog) return;
  const title = dialog.querySelector('#case-sheet-title');
  const content = dialog.querySelector('[data-case-sheet-content]');
  for (const button of document.querySelectorAll('[data-case-preview]')) {
    button.hidden = false;
    button.addEventListener('click', () => {
      const record = button.closest('[data-case-id]');
      title.textContent = record.querySelector('h2').textContent;
      const body = record.querySelector('.case-reading').cloneNode(true);
      body.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      body.querySelectorAll('details').forEach(detail => { detail.open = true; });
      content.replaceChildren(body);
      dialog.setAttribute('data-full','');
      dialog.querySelector('[data-sheet-handle]').setAttribute('aria-pressed','true');
      window.PortfolioDialogs.open(dialog, button);
    });
  }
})();
