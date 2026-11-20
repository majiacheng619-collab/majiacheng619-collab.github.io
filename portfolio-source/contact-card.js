(() => {
  const card = document.querySelector('[data-contact-book]');
  if (!card) return;
  const front = card.querySelector('[data-card-front]');
  const back = card.querySelector('[data-card-back]');
  const flip = card.querySelector('[data-contact-flip]');
  const vcard = card.querySelector('[data-vcard]');
  const name = front.querySelector('h2').textContent;
  let showing = false, animation = null;
  flip.hidden = vcard.hidden = false;
  back.hidden = true;

  flip.addEventListener('click', () => {
    showing = !showing;
    animation?.cancel();
    front.hidden = showing;
    back.hidden = !showing;
    flip.setAttribute('aria-expanded', String(showing));
    flip.textContent = showing ? '返回名片' : '翻到联系方式';
    if (document.documentElement.dataset.motion !== 'reduced' && card.animate) {
      animation = card.animate([
        { transform: 'perspective(900px) rotateY(' + (showing ? '-78deg' : '78deg') + ')', opacity: .42 },
        { transform: 'perspective(900px) rotateY(0deg)', opacity: 1 },
      ], { duration: 370, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
  });

  vcard.addEventListener('click', () => {
    const value = kind => atob(card.querySelector('[data-contact-row="' + kind + '"] button[data-contact-reveal]').dataset.contactReveal);
    const body = ['BEGIN:VCARD','VERSION:3.0','FN:' + name,'TEL;TYPE=CELL:' + value('phone'),
      'EMAIL;TYPE=INTERNET:' + value('email'),'END:VCARD',''].join('\r\n');
    const url = URL.createObjectURL(new Blob([body], { type:'text/vcard;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name + '.vcf';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
})();
