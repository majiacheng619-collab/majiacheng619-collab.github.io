(() => {
  'use strict';

  const root = document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const settingsKey = 'mjc-os-settings';
  const defaults = { accent: 'ice', text: 'normal', language: 'zh', reduce: false, haptics: false, music: false };
  const choices = { accent: ['ice', 'mint', 'violet'], text: ['normal', 'large', 'wide'], language: ['zh', 'en'] };
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(settingsKey)) || {}; } catch {}
  const preferences = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (choices[key]?.includes(stored[key]) || typeof stored[key] === 'boolean' && typeof defaults[key] === 'boolean') {
      preferences[key] = stored[key];
    }
  }

  if (root.lang === 'en') preferences.language = 'en';

  const reduced = () => motion.matches || preferences.reduce;
  const saveData = () => navigator.connection?.saveData === true;
  function applySettings() {
    root.dataset.accent = preferences.accent;
    root.dataset.textSize = preferences.text;
    root.dataset.motion = reduced() ? 'reduced' : 'full';
    root.dataset.osLanguage = preferences.language;
    document.querySelectorAll('[data-lang-en]').forEach(node => {
      if (!node.dataset.langZh) node.dataset.langZh = node.textContent;
      node.textContent = preferences.language === 'en' ? node.dataset.langEn : node.dataset.langZh;
    });
    window.dispatchEvent(new Event('portfolio:settings'));
  }
  const savePreferences = () => { try { localStorage.setItem(settingsKey, JSON.stringify(preferences)); } catch {} };
  const settings = document.querySelectorAll('[data-os-setting]');
  for (const field of settings) {
    const key = field.dataset.osSetting;
    if (field.type === 'checkbox') field.checked = preferences[key];
    else field.value = preferences[key];
    field.addEventListener('change', () => {
      preferences[key] = field.type === 'checkbox' ? field.checked : field.value;
      savePreferences();
      applySettings();
      if (key === 'language') {
        if (preferences.language === 'en' && root.lang !== 'en') location.assign('/en/');
        if (preferences.language === 'zh' && root.lang === 'en') location.assign('/');
      }
    });
  }
  applySettings();
  motion.addEventListener?.('change', applySettings);
  document.querySelectorAll('[data-os-enhancement]').forEach(node => { node.hidden = false; });

  const rail = document.querySelector('[data-os-rail]');
  const dock = document.querySelector('[data-glass-dock]');
  function scrollState() {
    const compact = scrollY > 90;
    rail?.toggleAttribute('data-compact', compact);
    dock?.toggleAttribute('data-compact', compact);
  }
  scrollState();
  addEventListener('scroll', scrollState, { passive: true });

  const island = document.querySelector('[data-os-island]');
  const notice = island?.querySelector('[data-os-notice]');
  const progress = island?.querySelector('progress');
  const film = document.querySelector('#intro-video');
  const musicButton = document.querySelector('[data-os-music]');
  let audio, expiry, message = '';
  function islandState() {
    if (!island) return;
    const filmPlaying = film && !film.paused && !film.ended;
    const musicPlaying = audio && !audio.paused && !audio.ended;
    island.hidden = !(message || filmPlaying || musicPlaying);
    notice.textContent = message || (filmPlaying ? '冰之圣殿' : musicPlaying ? '音乐播放中' : '');
    progress.hidden = !filmPlaying || !Number.isFinite(film.duration);
    if (!progress.hidden) {
      progress.max = film.duration;
      progress.value = film.currentTime;
    }
  }
  addEventListener('portfolio:feedback', event => {
    message = String(event.detail);
    clearTimeout(expiry);
    islandState();
    expiry = setTimeout(() => { message = ''; islandState(); }, 2400);
  });
  if (musicButton?.dataset.osMusic) {
    if (preferences.music) musicButton.textContent = '继续播放音乐';
    musicButton.addEventListener('click', async () => {
      if (!audio) {
        audio = new Audio(musicButton.dataset.osMusic);
        audio.loop = true;
        for (const event of ['play', 'pause', 'ended']) audio.addEventListener(event, () => {
          const playing = !audio.paused;
          musicButton.setAttribute('aria-pressed', String(playing));
          musicButton.textContent = playing ? '暂停音乐' : '播放音乐';
          islandState();
        });
      }
      if (!audio.paused) { preferences.music = false; savePreferences(); audio.pause(); }
      else {
        film?.pause();
        try { await audio.play(); preferences.music = true; savePreferences(); }
        catch { window.dispatchEvent(new CustomEvent('portfolio:feedback', { detail: '音乐暂不可播放' })); }
      }
    });
  } else if (musicButton) musicButton.hidden = true;
  for (const event of ['play', 'pause', 'ended', 'timeupdate']) film?.addEventListener(event, () => {
    if (event === 'play') audio?.pause();
    islandState();
  });
  addEventListener('pagehide', () => audio?.pause());
  document.addEventListener('visibilitychange', () => { if (document.hidden) audio?.pause(); });

  function detent(sheet, full) {
    sheet.toggleAttribute('data-full', full);
    sheet.querySelector('[data-sheet-handle]').setAttribute('aria-pressed', String(full));
  }
  for (const sheet of document.querySelectorAll('[data-sheet]')) {
    const handle = sheet.querySelector('[data-sheet-handle]');
    let drag, dragged = false;
    const clear = () => sheet.style.removeProperty('--sheet-offset');
    handle.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      dragged = false;
      drag = { id: event.pointerId, y: event.clientY, lastY: event.clientY, lastAt: performance.now(), velocity: 0 };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const now = performance.now(), delta = event.clientY - drag.y;
      drag.velocity = (event.clientY - drag.lastY) / Math.max(1, now - drag.lastAt);
      drag.lastY = event.clientY;
      drag.lastAt = now;
      if (Math.abs(delta) > 8) dragged = true;
      const distance = delta < 0 ? -Math.sqrt(Math.abs(delta)) * 3 : Math.min(delta, sheet.clientHeight * .70);
      if (!reduced() && dragged) sheet.style.setProperty('--sheet-offset', distance + 'px');
    });
    handle.addEventListener('pointerup', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const delta = event.clientY - drag.y;
      const glide = performance.now() - drag.lastAt < 80 ? Math.max(-50, Math.min(50, drag.velocity * 80)) : 0;
      const distance = delta + glide;
      drag = null;
      clear();
      if (!dragged) return;
      if (distance < -36) detent(sheet, true);
      if (distance > 52 && sheet.hasAttribute('data-full')) detent(sheet, false);
      else if (distance > 76) sheet.querySelector('[data-dialog-close]').click();
    });
    handle.addEventListener('pointercancel', () => { drag = null; dragged = false; clear(); });
    handle.addEventListener('click', event => {
      if (event.detail !== 0 && dragged) { dragged = false; return; }
      detent(sheet, !sheet.hasAttribute('data-full'));
    });
    sheet.addEventListener('close', () => detent(sheet, false));
  }

  const shortcutSheet = document.getElementById('dock-actions');
  const shortcuts = shortcutSheet?.querySelector('[data-dock-shortcuts]');
  let press, timer, consumed;
  function cancelPress() { clearTimeout(timer); press = null; }
  function showShortcuts(link) {
    if (!shortcuts) return;
    const current = document.createElement('a');
    current.href = link.href;
    current.textContent = link.textContent.trim();
    const all = [...dock.querySelectorAll('a[data-dock-link]')].filter(item => item !== link).map(item => {
      const button = document.createElement('a');
      button.href = item.href;
      button.textContent = item.textContent.trim();
      return button;
    });
    shortcuts.replaceChildren(current, ...all);
    if (window.PortfolioDialogs?.open(shortcutSheet, link) && preferences.haptics) navigator.vibrate?.(14);
  }
  dock?.addEventListener('pointerdown', event => {
    const link = event.target.closest('a[data-dock-link]');
    if (!link || !event.isPrimary || event.button !== 0) return;
    consumed = false;
    press = { x: event.clientX, y: event.clientY };
    timer = setTimeout(() => { cancelPress(); consumed = true; showShortcuts(link); }, 490);
  }, { passive: true });
  dock?.addEventListener('pointermove', event => {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) cancelPress();
  }, { passive: true });
  for (const event of ['pointerup', 'pointercancel', 'pointerleave']) addEventListener(event, cancelPress, { passive: true });
  dock?.addEventListener('click', event => {
    if (consumed && event.detail !== 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      consumed = false;
    }
  }, true);
  dock?.addEventListener('keydown', event => {
    const link = event.target.closest('a[data-dock-link]');
    if (link && (event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey)) {
      event.preventDefault();
      showShortcuts(link);
    }
  });

  const searchTrigger = document.querySelector('.os-rail [data-open-companion]');
  document.addEventListener('keydown', event => {
    if (event.isComposing || event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
    if (!searchTrigger || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    searchTrigger.click();
  });
  const pull = document.querySelector('[data-pull-search]');
  let starting;
  pull?.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' && event.clientX > 30 && event.clientX < innerWidth - 30) {
      starting = { x: event.clientX, y: event.clientY };
      pull.setPointerCapture(event.pointerId);
    }
  });
  pull?.addEventListener('pointerup', event => {
    if (starting && event.clientY - starting.y > 42 && Math.abs(event.clientX - starting.x) < 40) searchTrigger?.click();
    starting = null;
  });
  pull?.addEventListener('pointercancel', () => { starting = null; });

  const continueGame = document.querySelector('[data-continue-game]');
  if (continueGame) {
    function hasSave() {
      try {
        return ['sprout-story-v5', 'sprout-story-v4'].some(key => {
          const save = JSON.parse(localStorage.getItem(key));
          return save && [4, 5, 6].includes(save.schema) && Number.isInteger(save.cleared) &&
            save.cleared > 0 && save.cleared <= (save.schema === 4 ? 12 : 20) &&
            (save.stars === undefined || Array.isArray(save.stars) && save.stars.every(n => Number.isInteger(n) && n >= 0 && n <= 3));
        });
      } catch { return false; }
    }
    const updateContinue = () => { continueGame.hidden = !hasSave(); };
    updateContinue();
    addEventListener('pageshow', updateContinue);
    addEventListener('storage', updateContinue);
  }

  addEventListener('portfolio:polish', () => {
    if (reduced() || saveData() || !('IntersectionObserver' in window)) return;
    const observeStats = new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        observeStats.unobserve(target);
        const original = target.textContent;
        const token = original.match(/\d[\d,]*/)?.[0];
        if (!token) continue;
        const number = Number(token.replaceAll(',', ''));
        target.setAttribute('aria-label', original);
        const start = performance.now();
        function animate(now) {
          const elapsed = Math.min(1, (now - start) / 620);
          if (elapsed === 1 || reduced() || document.hidden) { target.textContent = original; return; }
          const current = Math.round(number * (1 - (1 - elapsed) ** 3));
          target.textContent = original.replace(token, token.includes(',') ? current.toLocaleString('zh-CN') : String(current));
          requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);
      }
    }, { threshold: .65 });
    document.querySelectorAll('[data-roll]').forEach(value => observeStats.observe(value));
  }, { once: true });

  const splash = document.querySelector('[data-lockscreen]');
  if (splash && !reduced() && !saveData() && !location.hash) {
    let first = false;
    try {
      first = !localStorage.getItem('mjc-lockscreen-seen');
      if (first) localStorage.setItem('mjc-lockscreen-seen', '1');
    } catch {}
    if (first) {
      splash.querySelector('.os-lock-time').textContent = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date());
      splash.hidden = false;
      const dismiss = () => { splash.hidden = true; };
      splash.querySelector('[data-lock-skip]').addEventListener('click', dismiss);
      setTimeout(dismiss, 1120);
      document.addEventListener('focusin', event => { if (!splash.contains(event.target)) dismiss(); }, { once: true });
    }
  }
})();
