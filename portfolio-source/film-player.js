(() => {
  'use strict';
  const player = document.querySelector('[data-intro-player]');
  if (!player) return;
  const video = player.querySelector('video');
  if (typeof video.play !== 'function') return;
  const find = name => player.querySelector('[data-film-' + name + ']');
  const play = find('play');
  const scrub = find('scrub');
  const clock = find('clock');
  const mute = find('mute');
  const captions = find('captions');
  const fullscreen = find('fullscreen');
  const loading = find('loading');
  const error = find('error');
  const retry = find('retry');
  const chapters = [...player.querySelectorAll('[data-film-start]')];
  const track = video.textTracks?.[0];
  const duration = Number(scrub.max);
  const supportsFullscreen = Boolean(document.fullscreenEnabled && player.requestFullscreen);
  let nativeFullscreen = false;
  let loadingTimer;
  let pendingSeek;

  const formatTime = time => Math.floor(time / 60) + ':' + String(Math.floor(time % 60)).padStart(2, '0');
  function updatePosition() {
    const time = pendingSeek ?? video.currentTime;
    const label = formatTime(time);
    if (clock.textContent !== label) {
      clock.textContent = label;
      scrub.setAttribute('aria-valuetext', Math.floor(time) + ' 秒，共 ' + duration + ' 秒');
    }
    scrub.value = time;
    scrub.style.setProperty('--film-progress', Math.min(100, 100 * time / duration) + '%');
    const current = chapters.findLast(chapter => time >= Number(chapter.dataset.filmStart));
    for (const chapter of chapters) {
      if (chapter === current) chapter.setAttribute('aria-current', 'true');
      else chapter.removeAttribute('aria-current');
    }
  }

  function stopBuffering() {
    clearTimeout(loadingTimer);
    loading.hidden = true;
  }
  function startBuffering() {
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => { loading.hidden = false; }, 550);
  }
  function updatePlayback() {
    const state = video.ended ? 'replay' : video.paused ? 'play' : 'pause';
    player.dataset.filmPlayback = state;
    play.setAttribute('aria-label', {play: '播放影片', pause: '暂停影片', replay: '重播影片'}[state]);
    updatePosition();
  }
  function showError() {
    stopBuffering();
    error.hidden = false;
    updatePlayback();
  }
  function start() {
    error.hidden = true;
    startBuffering();
    video.play().catch(failure => {
      if (failure.name !== 'AbortError') showError();
    });
    updatePlayback();
  }
  function seek(time) {
    if (video.readyState) {
      video.currentTime = time;
    } else {
      pendingSeek = time;
      video.preload = 'metadata';
    }
    updatePosition();
  }
  function updateFullscreen() {
    const active = document.fullscreenElement === player || nativeFullscreen;
    player.toggleAttribute('data-film-fullscreen-active', active);
    fullscreen.setAttribute('aria-label', active ? '退出全屏' : '全屏播放');
    fullscreen.hidden = !supportsFullscreen && !(video.readyState && video.webkitSupportsFullscreen);
  }

  play.addEventListener('click', () => {
    if (video.paused || video.ended) start();
    else video.pause();
  });
  video.addEventListener('click', () => {
    if (!player.hasAttribute('data-film-engaged')) return;
    if (video.paused || video.ended) start();
    else video.pause();
  });
  scrub.addEventListener('input', () => { seek(scrub.valueAsNumber); });
  for (const chapter of chapters) {
    chapter.addEventListener('click', () => {
      seek(Number(chapter.dataset.filmStart));
      if (video.paused) start();
    });
  }
  mute.addEventListener('click', () => { video.muted = !video.muted; });
  captions.addEventListener('click', () => {
    track.mode = track.mode === 'showing' ? 'disabled' : 'showing';
  });
  fullscreen.addEventListener('click', async () => {
    try {
      if (nativeFullscreen) video.webkitExitFullscreen();
      else if (document.fullscreenElement === player) await document.exitFullscreen();
      else if (supportsFullscreen) await player.requestFullscreen();
      else if (video.webkitSupportsFullscreen) video.webkitEnterFullscreen();
    } catch {
      if (video.webkitSupportsFullscreen) video.webkitEnterFullscreen();
    }
  });
  retry.addEventListener('click', () => {
    if (video.currentTime > 0) pendingSeek = video.currentTime;
    video.load();
    start();
    play.focus({preventScroll: true});
  });

  video.addEventListener('play', () => {
    player.setAttribute('data-film-engaged', '');
    updatePlayback();
  });
  for (const event of ['playing', 'pause', 'ended']) {
    video.addEventListener(event, () => {
      stopBuffering();
      updatePlayback();
    });
  }
  video.addEventListener('waiting', () => { if (!video.paused) startBuffering(); });
  for (const event of ['timeupdate', 'seeked']) video.addEventListener(event, updatePosition);
  video.addEventListener('loadedmetadata', () => {
    if (pendingSeek !== undefined) {
      video.currentTime = pendingSeek;
      pendingSeek = undefined;
    }
    updatePosition();
    updateFullscreen();
  });
  video.addEventListener('volumechange', () => mute.setAttribute('aria-pressed', String(video.muted)));
  video.textTracks?.addEventListener('change', () => {
    captions.setAttribute('aria-pressed', String(track?.mode === 'showing'));
  });
  video.addEventListener('error', showError);
  video.querySelector('source').addEventListener('error', showError);
  document.addEventListener('fullscreenchange', updateFullscreen);
  video.addEventListener('webkitbeginfullscreen', () => { nativeFullscreen = true; updateFullscreen(); });
  video.addEventListener('webkitendfullscreen', () => { nativeFullscreen = false; updateFullscreen(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && !nativeFullscreen && !document.fullscreenElement) video.pause();
    }).observe(player);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !nativeFullscreen && !document.fullscreenElement) video.pause();
  });
  window.addEventListener('pagehide', () => { if (!nativeFullscreen) video.pause(); });

  player.setAttribute('data-film-ready', '');
  video.controls = false;
  play.hidden = find('controls').hidden = find('chapters').hidden = false;
  captions.hidden = !track;
  updateFullscreen();
  updatePlayback();
})();
