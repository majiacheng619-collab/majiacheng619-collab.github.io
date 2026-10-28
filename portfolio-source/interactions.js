/* Progressive portfolio interactions. Include once with defer; no dependencies. */
(() => {
  'use strict';
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const byId = id => id ? document.getElementById(id.replace(/^#/, '')) : null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const isOpen = dialog => Boolean(dialog?.hasAttribute('open'));
  const canFocus = node => node && !node.hidden && node.getClientRects().length > 0;
  const fallbackStates = new WeakMap();
  const modalSupported = typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal === 'function';
  const openers = new WeakMap();
  const triggers = new WeakMap();
  let activeDialog = null;
  let priorOverflow = '';
  let priorGutter = '';
  const outsideStarts = new WeakMap();

  function finishClose(dialog, restoreFocus = true) {
    if (isOpen(dialog) || activeDialog !== dialog) return;
    all('video, audio', dialog).forEach(media => media.pause());
    const opener = openers.get(dialog);
    triggers.get(dialog)?.setAttribute('aria-expanded', 'false');
    const fallback = fallbackStates.get(dialog);
    if (fallback) {
      fallback.backdrop.remove();
      fallback.background.forEach(({ node, inert, hidden }) => {
        if ('inert' in node) node.inert = inert;
        if (hidden === null) node.removeAttribute('aria-hidden'); else node.setAttribute('aria-hidden', hidden);
      });
      if (fallback.style === null) dialog.removeAttribute('style'); else dialog.setAttribute('style', fallback.style);
      if (fallback.role === null) dialog.removeAttribute('role'); else dialog.setAttribute('role', fallback.role);
      dialog.removeAttribute('aria-modal');
      fallbackStates.delete(dialog);
    }
    document.documentElement.style.overflow = priorOverflow;
    document.documentElement.style.scrollbarGutter = priorGutter;
    activeDialog = null;
    if (restoreFocus && opener?.isConnected && canFocus(opener) && !opener.closest('dialog:not([open])')) opener.focus({ preventScroll: true });
  }
  function close(dialog, restoreFocus = true) {
    if (!isOpen(dialog)) return;
    if (fallbackStates.has(dialog)) dialog.removeAttribute('open');
    else dialog.close();
    // Native close events are queued: settle this session before opening another.
    finishClose(dialog, restoreFocus);
  }
  function open(dialog, opener) {
    if (!dialog || dialog.tagName !== 'DIALOG') return false;
    if (isOpen(dialog)) return true;
    const returnOpener = activeDialog && opener?.closest('dialog') === activeDialog ? openers.get(activeDialog) : opener;
    if (activeDialog && activeDialog !== dialog) close(activeDialog, false);
    openers.set(dialog, returnOpener);
    triggers.set(dialog, opener);
    priorOverflow = document.documentElement.style.overflow;
    priorGutter = document.documentElement.style.scrollbarGutter;
    // Reserve the scrollbar lane so opening a dialog does not shift the page.
    document.documentElement.style.scrollbarGutter = 'stable';
    document.documentElement.style.overflow = 'hidden';
    // Older WebViews still receive a usable, focus-contained dialog.
    let nativeOpened = false;
    if (modalSupported) {
      try { dialog.showModal(); nativeOpened = true; } catch (_) { /* Use the local fallback. */ }
    }
    if (!nativeOpened) {
      const backdrop = document.createElement('div');
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(12,20,32,.45);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)';
      const background = all('body > *').filter(node => node !== dialog && !['SCRIPT', 'STYLE'].includes(node.tagName))
        .map(node => ({ node, inert: node.inert, hidden: node.getAttribute('aria-hidden') }));
      fallbackStates.set(dialog, { backdrop, background, style: dialog.getAttribute('style'), role: dialog.getAttribute('role') });
      background.forEach(({ node }) => { if ('inert' in node) node.inert = true; else node.setAttribute('aria-hidden', 'true'); });
      document.body.append(backdrop);
      backdrop.addEventListener('click', () => close(dialog));
      dialog.setAttribute('open', '');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      Object.assign(dialog.style, { display: 'block', position: 'fixed', zIndex: '9999', inset: '0', margin: 'auto', overflow: 'auto', maxHeight: 'calc(100% - 24px)' });
    }
    activeDialog = dialog;
    opener?.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      if (activeDialog !== dialog || !isOpen(dialog)) return;
      const target = dialog.querySelector('[autofocus]') ||
        dialog.querySelector('[data-dialog-close], button, a[href], input');
      if (target) target.focus({ preventScroll: true });
      else { dialog.tabIndex = -1; dialog.focus({ preventScroll: true }); }
    });
    return true;
  }

  all('dialog').forEach(dialog => {
    if (!modalSupported) dialog.style.display = 'none';
    dialog.addEventListener('close', () => {
      // Ignore an older queued close if this dialog has already reopened.
      finishClose(dialog);
    });
    const outside = event => {
      const box = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
    };
    dialog.addEventListener('pointerdown', event => { outsideStarts.set(dialog, outside(event)); });
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(dialog); });
    dialog.addEventListener('click', event => {
      // A drag starting inside the dialog must never dismiss it on release.
      const startedOutside = outsideStarts.get(dialog);
      outsideStarts.delete(dialog);
      if (!startedOutside || event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close(dialog);
    });
    all('[data-dialog-close], [data-portrait-close]', dialog).forEach(button => button.addEventListener('click', () => close(dialog)));
  });

  all('[data-dialog-open], [data-portrait-open], [data-image-open]').forEach(opener => {
    const id = opener.dataset.dialogOpen || opener.dataset.imageTarget || 'portrait-dialog';
    const dialog = byId(id);
    if (!dialog) {
      // Keep real hrefs operational; dead buttons should not appear interactive.
      if (opener.tagName === 'BUTTON') opener.hidden = true;
      return;
    }
    opener.setAttribute('aria-controls', dialog.id);
    opener.setAttribute('aria-haspopup', 'dialog');
    opener.setAttribute('aria-expanded', 'false');
    opener.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (opener.hasAttribute('data-image-open')) {
        const image = dialog.querySelector('[data-dialog-image]');
        const source = opener.dataset.imageSrc || opener.getAttribute('href');
        if (image && source) {
          let url;
          try { url = new URL(source, location.href); } catch (_) { return; }
          if (!['https:', 'http:'].includes(url.protocol)) return;
          image.src = url.href;
          image.alt = opener.dataset.imageAlt || opener.querySelector('img')?.alt || '作品图片';
        }
      }
      if (open(dialog, opener)) event.preventDefault();
    });
  });

  document.addEventListener('keydown', event => {
    if (event.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
    if (activeDialog && event.key === 'Escape') { event.preventDefault(); close(activeDialog); return; }
    if (!activeDialog || !fallbackStates.has(activeDialog)) return;
    if (event.key === 'Tab') {
      const targets = all(focusable, activeDialog).filter(canFocus);
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (!first) { event.preventDefault(); activeDialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !activeDialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !activeDialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
  });

  // No autoplay, scroll hijacking, or automatic audio resumption.
  // Native video controls remain the single playback surface.
  const pauseMedia = () => all('video').forEach(media => media.pause());
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseMedia(); });
  window.addEventListener('pagehide', pauseMedia);

  // A small, explicit choice illustrates the mechanism; no timed advancement.
  all('.growth-demo').forEach(demo => {
    const buttons = all('button[data-growth-step]', demo);
    const panels = all('[data-growth-panel]', demo);
    if (!buttons.length || !panels.length) return;
    let growthMotion=null;
    const select = (step,animate=true) => {
      growthMotion?.cancel();
      const chosen = panels.find(panel => panel.dataset.growthPanel === step);
      if (!chosen) return;
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.growthStep === step)));
      panels.forEach(panel => { panel.hidden = panel !== chosen; });
      if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
        const plant=chosen.querySelector('img');
        if(plant){growthMotion=plant.animate([{opacity:.45,transform:'translateY(10px) scale(.86)'},{opacity:1,transform:'none'}],{duration:300,easing:'cubic-bezier(.2,.8,.2,1)'});growthMotion.finished.catch(()=>{});}
      }
    };
    buttons.forEach(button => button.addEventListener('click', () => select(button.dataset.growthStep)));
    const initial = buttons.find(button => button.getAttribute('aria-pressed') === 'true') || buttons[0];
    select(initial.dataset.growthStep,false);
    demo.classList.add('is-enhanced');
  });

  document.documentElement.classList.add('js-ready');

  // Content remains visible if JS fails or IntersectionObserver is unsupported.
  const reveal = all('[data-reveal]');
  let observer;
  const settleReveal = () => {
    observer?.disconnect();
    reveal.forEach(node => { node.classList.remove('reveal-pending'); node.classList.add('is-visible'); });
  };
  if (!reduce.matches && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('reveal-pending');
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.08 });
    reveal.forEach(node => {
      // Above-the-fold content is immediately readable, even on a slow device.
      const box = node.getBoundingClientRect();
      if (box.top < innerHeight && box.bottom > 0) node.classList.add('is-visible');
      else { observer.observe(node); node.classList.add('reveal-pending'); }
    });
    document.addEventListener('focusin', event => {
      const section = event.target.closest?.('[data-reveal]');
      if (section) { section.classList.remove('reveal-pending'); section.classList.add('is-visible'); observer.unobserve(section); }
    });
    window.addEventListener('beforeprint', settleReveal);
    window.addEventListener('pageshow', event => { if (event.persisted) settleReveal(); });
  } else settleReveal();
  // Only active reveal effects respond to the motion preference.
  const motionChanged = () => { if (reduce.matches) settleReveal(); };
  if (reduce.addEventListener) reduce.addEventListener('change', motionChanged);
  else reduce.addListener(motionChanged);
})();
