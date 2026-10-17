/* Progressive portfolio interactions. Include once with defer; no dependencies. */
(() => {
  'use strict';
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const byId = id => id ? document.getElementById(id.replace(/^#/, '')) : null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const modalSupported = typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal === 'function';
  const openers = new WeakMap();
  const triggers = new WeakMap();
  let activeDialog = null;
  let priorOverflow = '';
  let priorGutter = '';
  let pointerStartedOutside = false;
  const announce = (selector, message) => { const node = document.querySelector(selector); if (node) node.textContent = message; };

  function finishClose(dialog, restoreFocus = true) {
    if (dialog.open || activeDialog !== dialog) return;
    all('video, audio', dialog).forEach(media => media.pause());
    const opener = openers.get(dialog);
    triggers.get(dialog)?.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = priorOverflow;
    document.documentElement.style.scrollbarGutter = priorGutter;
    activeDialog = null;
    if (restoreFocus && opener?.isConnected && !opener.closest('dialog:not([open])')) opener.focus({ preventScroll: true });
  }
  function close(dialog, restoreFocus = true) {
    if (!dialog?.open) return;
    dialog.close();
    // Native close events are queued: settle this session before opening another.
    finishClose(dialog, restoreFocus);
  }
  function open(dialog, opener) {
    if (!modalSupported || !(dialog instanceof HTMLDialogElement)) return false;
    if (dialog.open) return true;
    const returnOpener = activeDialog && opener?.closest('dialog') === activeDialog ? openers.get(activeDialog) : opener;
    if (activeDialog && activeDialog !== dialog) close(activeDialog, false);
    openers.set(dialog, returnOpener);
    triggers.set(dialog, opener);
    priorOverflow = document.documentElement.style.overflow;
    priorGutter = document.documentElement.style.scrollbarGutter;
    // Reserve the scrollbar lane so opening navigation does not shift the page.
    document.documentElement.style.scrollbarGutter = 'stable';
    document.documentElement.style.overflow = 'hidden';
    try { dialog.showModal(); } catch (_) {
      document.documentElement.style.overflow = priorOverflow;
      document.documentElement.style.scrollbarGutter = priorGutter;
      returnOpener?.focus({ preventScroll: true });
      return false;
    }
    activeDialog = dialog;
    opener?.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      if (activeDialog !== dialog || !dialog.open) return;
      // A selector list follows DOM order; explicitly prioritize the search field.
      const target = dialog.querySelector('[autofocus]') || dialog.querySelector('[data-search-input]') ||
        dialog.querySelector('[data-dialog-close], button, a[href], input');
      target?.focus({ preventScroll: true });
    });
    return true;
  }

  all('dialog').forEach(dialog => {
    dialog.addEventListener('close', () => {
      // Ignore an older queued close if this dialog has already reopened.
      finishClose(dialog);
    });
    const outside = event => {
      const box = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
    };
    dialog.addEventListener('pointerdown', event => { pointerStartedOutside = outside(event); });
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(dialog); });
    dialog.addEventListener('click', event => {
      // A drag starting inside the dialog must never dismiss it on release.
      if (!pointerStartedOutside || event.target !== dialog) return;
      pointerStartedOutside = false;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close(dialog);
    });
    all('[data-dialog-close], [data-menu-close], [data-search-close], [data-portrait-close]', dialog).forEach(button => button.addEventListener('click', () => close(dialog)));
    if (dialog.hasAttribute('data-menu-dialog')) {
      all('a[href]', dialog).forEach(anchor => anchor.addEventListener('click', event => navigateFromDialog(event, anchor, dialog)));
    }
  });

  function navigateFromDialog(event, anchor, dialog) {
    // Modified clicks keep the current modal and preserve native new-tab behavior.
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
    if (anchor.matches('[data-search-open], [data-menu-open], [data-dialog-open], [data-portrait-open], [data-image-open]')) return;
    const url = new URL(anchor.href, location.href);
    const pagePath = pathname => pathname.replace(/\/index\.html$/, '/');
    const samePage = url.origin === location.origin && pagePath(url.pathname) === pagePath(location.pathname) && url.search === location.search;
    let target = null;
    if (samePage && url.hash) {
      try { target = byId(decodeURIComponent(url.hash.slice(1))); } catch (_) { /* Preserve malformed native URLs. */ }
    }
    // Downloads and new windows leave this document in place: restore its focus.
    if (anchor.target === '_blank' || anchor.hasAttribute('download')) { close(dialog); return; }
    close(dialog, !target);
    if (!target) return;
    event.preventDefault();
    if (location.hash !== url.hash) history.pushState(null, '', url.href);
    // Move both the reading position and keyboard focus to the selected section.
    const temporaryTabIndex = !target.hasAttribute('tabindex') && target.tabIndex < 0;
    if (temporaryTabIndex) {
      target.setAttribute('tabindex', '-1');
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    }
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  all('[data-menu-open], [data-search-open], [data-dialog-open], [data-portrait-open], [data-image-open]').forEach(opener => {
    const id = opener.dataset.dialogOpen || opener.dataset.menuTarget || opener.dataset.searchTarget || opener.dataset.imageTarget ||
      (opener.hasAttribute('data-menu-open') ? 'menu-dialog' : opener.hasAttribute('data-search-open') ? 'search-dialog' : 'portrait-dialog');
    const dialog = byId(id);
    if (!modalSupported || !dialog) {
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
          const url = new URL(source, location.href);
          if (!['https:', 'http:'].includes(url.protocol)) return;
          image.src = url.href;
          image.alt = opener.dataset.imageAlt || opener.querySelector('img')?.alt || '作品图片';
        }
      }
      if (dialog.open && opener.hasAttribute('data-menu-open')) { event.preventDefault(); close(dialog); }
      else if (open(dialog, opener)) event.preventDefault();
    });
  });

  const normalize = value => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  all('[data-search-input]').forEach(input => {
    const scope = input.closest('dialog') || input.closest('[data-search]');
    if (!scope) return;
    const results = all('a[data-search-item]', scope);
    const empty = scope.querySelector('[data-search-empty]');
    const count = scope.querySelector('[data-search-count]');
    const filter = () => {
      const terms = normalize(input.value).split(' ').filter(Boolean);
      let found = 0;
      let shown = 0;
      results.forEach(anchor => {
        const haystack = normalize(`${anchor.textContent} ${anchor.dataset.searchKeywords || ''}`);
        const match = terms.every(term => haystack.includes(term));
        if (match) found++;
        anchor.hidden = !match || (!terms.length && shown >= 6);
        if (!anchor.hidden) shown++;
      });
      if (empty) empty.hidden = found > 0;
      if (count) count.textContent = terms.length ? `${found} 项结果` : '常用信息 · 输入关键词搜索全站';
    };
    input.addEventListener('input', filter);
    all('[data-search-query]', scope).forEach(button => button.addEventListener('click', () => { input.value=button.dataset.searchQuery; filter(); input.focus(); }));
    input.addEventListener('keydown', event => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'ArrowDown') {
        const first = results.find(anchor => !anchor.hidden);
        if (first) { event.preventDefault(); first.focus(); }
      }
      if (event.key === 'Enter') {
        const first = results.find(anchor => !anchor.hidden);
        if (first) { event.preventDefault(); first.click(); }
      }
    });
    results.forEach(anchor => {
      anchor.addEventListener('click', event => navigateFromDialog(event, anchor, scope));
      anchor.addEventListener('keydown', event => {
        if (!['ArrowDown', 'ArrowUp'].includes(event.key) || event.isComposing) return;
        const visible = results.filter(result => !result.hidden);
        const index = visible.indexOf(anchor);
        event.preventDefault();
        if (event.key === 'ArrowUp' && index === 0) input.focus();
        else visible[Math.min(visible.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
      });
    });
    filter();
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.isComposing) {
      const trigger = document.querySelector('[data-search-open]');
      if (trigger && !trigger.hidden) { event.preventDefault(); trigger.click(); }
    }
  });

  // No autoplay, scroll hijacking, or automatic audio resumption.
  const audio = document.querySelector('audio[data-ambient]');
  all('[data-sound]').forEach(button => {
    if (!audio) { button.hidden = true; return; }
    button.addEventListener('click', async () => {
      if (!audio.paused) { audio.pause(); return; }
      if (all('video').some(video => !video.paused && !video.muted)) {
        announce('[data-sound-status]', '请先暂停视频，再开启轻音乐。');
        return;
      }
      try { await audio.play(); } catch (_) { announce('[data-sound-status]', '音乐暂时无法播放，请稍后再试。'); }
    });
  });
  if (audio) ['play', 'pause', 'ended'].forEach(type => audio.addEventListener(type, () => {
    const playing = !audio.paused;
    all('[data-sound]').forEach(button => {
      button.setAttribute('aria-pressed', String(playing));
      const label = button.querySelector('[data-sound-label]');
      if (label) label.textContent = playing ? '暂停轻音乐' : '开启轻音乐';
    });
  }));
  document.addEventListener('play', event => {
    const media = event.target;
    if (!(media instanceof HTMLVideoElement)) return;
    audio?.pause();
    all('video').filter(video => video !== media).forEach(video => video.pause());
  }, true);
  const pauseMedia = () => all('video, audio').forEach(media => media.pause());
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseMedia(); });
  window.addEventListener('pagehide', pauseMedia);

  all('[data-video-play], [data-preview-toggle]').forEach(button => {
    const video = byId(button.getAttribute('aria-controls')) || button.closest('[data-video-player], [data-preview-film]')?.querySelector('video');
    if (!video) { button.hidden = true; return; }
    let status = button.closest('[data-video-player], [data-preview-film], section')?.querySelector('[data-video-status]');
    if (!status) {
      status = document.createElement('p');
      status.className = 'sr-only';
      status.dataset.videoStatus = '';
      status.setAttribute('role', 'status');
      button.parentNode.insertBefore(status, button.nextSibling);
    }
    video.addEventListener('error', () => { status.textContent = '视频暂时无法加载，请尝试下载观看。'; });
    const refresh = () => {
      const playing = !video.paused;
      button.setAttribute('aria-pressed', String(playing));
      const label = button.querySelector('[data-preview-label], [data-video-label]');
      if (label) label.textContent = playing ? '暂停播放' : '播放视频';
      else button.textContent = playing ? '暂停播放' : '播放视频';
    };
    ['play', 'pause', 'ended'].forEach(type => video.addEventListener(type, refresh));
    button.addEventListener('click', async () => {
      if (!video.paused) video.pause();
      else try { status.textContent = ''; await video.play(); } catch (_) { status.textContent = '播放暂时失败，可使用视频原生控件或下载观看。'; }
    });
    refresh();
  });

  // Chapter links retain their native anchor navigation and browser history.
  all('.chapter-nav').forEach(nav => {
    const chapters = all('a[href^="#"]', nav).map(link => {
      let section;
      try { section = byId(decodeURIComponent(link.hash.slice(1))); } catch (_) { return null; }
      return section ? { link, section } : null;
    }).filter(Boolean);
    if (!chapters.length || !('IntersectionObserver' in window)) return;
    const visible = new Set();
    const mark = current => chapters.forEach(({ link }) => {
      if (link === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    const chapterObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target));
      const reading = chapters.filter(({ section }) => visible.has(section))
        .sort((a, b) => Math.abs(a.section.getBoundingClientRect().top - 120) - Math.abs(b.section.getBoundingClientRect().top - 120))[0];
      if (reading) mark(reading.link);
    }, { rootMargin: '-112px 0px -45% 0px', threshold: 0 });
    chapters.forEach(({ section }) => chapterObserver.observe(section));
  });

  // A small, explicit choice illustrates the mechanism; no timed advancement.
  all('.growth-demo').forEach(demo => {
    const buttons = all('button[data-growth-step]', demo);
    const panels = all('[data-growth-panel]', demo);
    if (!buttons.length || !panels.length) return;
    const select = step => {
      const chosen = panels.find(panel => panel.dataset.growthPanel === step);
      if (!chosen) return;
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.growthStep === step)));
      panels.forEach(panel => { panel.hidden = panel !== chosen; });
    };
    buttons.forEach(button => button.addEventListener('click', () => select(button.dataset.growthStep)));
    const initial = buttons.find(button => button.getAttribute('aria-pressed') === 'true') || buttons[0];
    select(initial.dataset.growthStep);
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
  // Scroll motion is restricted to visible artwork; native scrolling stays intact.
  const artwork = all('[data-parallax], [data-drift]');
  const moving = new Set();
  let driftFrame = 0;
  const drawDrift = () => {
    driftFrame = 0;
    moving.forEach(node => {
      const box = node.getBoundingClientRect();
      const progress = Math.max(-1, Math.min(1, (box.top + box.height / 2 - innerHeight / 2) / innerHeight));
      node.style.setProperty('--drift', `${(reduce.matches ? 0 : progress * -24).toFixed(2)}px`);
    });
  };
  const queueDrift = () => { if (!driftFrame && moving.size && !reduce.matches) driftFrame = requestAnimationFrame(drawDrift); };
  if ('IntersectionObserver' in window && artwork.length) {
    const artworkObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.isIntersecting ? moving.add(entry.target) : moving.delete(entry.target));
      queueDrift();
    }, { rootMargin: '100px' });
    artwork.forEach(node => artworkObserver.observe(node));
    addEventListener('scroll', queueDrift, { passive: true });
    addEventListener('resize', queueDrift, { passive: true });
  }
  // A preference change immediately settles animations already in progress.
  const motionChanged = () => { if (reduce.matches) { settleReveal(); artwork.forEach(node => node.style.setProperty('--drift', '0px')); } else queueDrift(); };
  if (reduce.addEventListener) reduce.addEventListener('change', motionChanged);
  else reduce.addListener(motionChanged);
})();

/* Reading position is passive: one scheduled update, no animation loop. */
(() => {
  if (document.querySelector('.reading-progress')) return;
  const progress = document.createElement('div');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);
  let frame = 0;
  function draw() {
    frame = 0;
    const length = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${length > 0 ? Math.min(1, Math.max(0, scrollY / length)) : 0})`;
  }
  const queue = () => { if (!frame) frame = requestAnimationFrame(draw); };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue, { passive: true });
  addEventListener('pageshow', queue);
  queue();
})();

/* 我让触摸、鼠标与键盘使用相同的材质反馈；离开页面后不留下循环。 */
(() => {
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const selector='.button,.icon-button,.desktop-nav a,.chapter-nav a,[data-growth-step]';
 function wave(target,x,y){
  if(reduce.matches)return;
  const box=target.getBoundingClientRect();
  const node=document.createElement('i');node.className='liquid-wave';node.setAttribute('aria-hidden','true');
  node.style.setProperty('--wave-size',Math.max(box.width,box.height)*1.4+'px');
  node.style.setProperty('--wave-x',x-box.left+'px');node.style.setProperty('--wave-y',y-box.top+'px');
  target.querySelectorAll('.liquid-wave').forEach(n=>n.remove());target.append(node);
  node.addEventListener('animationend',()=>node.remove(),{once:true});
 }
 document.addEventListener('pointerdown',e=>{const t=e.target.closest(selector);if(t && e.button===0)wave(t,e.clientX,e.clientY);},{passive:true});
 document.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key)||e.repeat)return;const t=e.target.closest(selector);if(t){const r=t.getBoundingClientRect();wave(t,r.left+r.width/2,r.top+r.height/2);}});
 let frame=0;
 addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(()=>{document.body.classList.toggle('has-scrolled',scrollY>20);frame=0;});},{passive:true});
})();
