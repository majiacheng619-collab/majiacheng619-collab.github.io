(() => {
  function selectValue(node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  for (const row of document.querySelectorAll('[data-contact-row]')) {
    const reveal = row.querySelector('[data-contact-reveal]');
    const value = row.querySelector('[data-contact-value]');
    const copy = row.querySelector('[data-contact-copy]');
    const status = row.querySelector('[data-copy-status]');
    reveal.hidden = false;
    reveal.addEventListener('click', () => {
      const showing = value.hidden;
      value.textContent = showing ? atob(reveal.dataset.contactReveal) : '';
      value.hidden = !showing;
      copy.hidden = !showing;
      reveal.setAttribute('aria-expanded', String(showing));
      reveal.textContent = reveal.textContent.replace(showing ? '显示' : '隐藏', showing ? '隐藏' : '显示');
      status.textContent = '';
    });
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(value.textContent);
        status.textContent = '已复制';
        window.dispatchEvent(new CustomEvent('portfolio:feedback', { detail: '已复制' }));
      } catch {
        selectValue(value);
        status.textContent = '已选中，可手动复制';
      }
    });
  }
})();
