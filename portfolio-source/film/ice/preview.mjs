const theater = document.querySelector('[data-ice-theater]');
if (theater) {
  const canvas = theater.querySelector('canvas');
  const poster = theater.querySelector('[data-ice-poster]');
  const play = theater.querySelector('[data-ice-play]');
  const gyro = theater.querySelector('[data-ice-gyro]');
  const chapters = theater.querySelector('[data-ice-chapters]');
  const scrub = theater.querySelector('input');
  const clock = theater.querySelector('[data-ice-clock]');
  const status = theater.querySelector('[data-ice-status]');
  const screen = theater.querySelector('.ice-screen');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const duration = Number(scrub.max);
  const view = { yaw: 0, pitch: 0 };
  const clamp = (value, extent) => Math.max(-extent, Math.min(extent, value));
  let activeCanvas = canvas, renderer, resize, battery, drag, frame, renderFrame;
  let running = false, loading = false, failedImport = false, orientation, time = 0, anchor = 0, lastPaint = 0;
  let quality = 1, slowFrames = 0, quickFrames = 0;

  function limited() {
    return reduced.matches || document.documentElement.dataset.motion === 'reduced' ||
      navigator.connection?.saveData || (battery && !battery.charging && battery.level <= .15);
  }

  function position() {
    scrub.value = time;
    scrub.style.setProperty('--film-progress', (100 * time / duration) + '%');
    clock.textContent = '0:' + Math.floor(time).toString().padStart(2, '0');
    scrub.setAttribute('aria-valuetext', Math.floor(time) + ' 秒，共 ' + duration + ' 秒');
  }

  function size() {
    const pixels = Math.min(1440, screen.clientWidth * Math.min(1.5, devicePixelRatio));
    const width = Math.max(256, Math.round(pixels * quality));
    renderer.setSize(width, Math.round(width * 9 / 16));
  }

  function render() {
    renderer?.renderAt(time, view);
    position();
  }

  function repaint() {
    if (renderer && !running && !renderFrame) renderFrame = requestAnimationFrame(() => {
      renderFrame = undefined;
      if (!document.hidden) render();
    });
  }

  function pause() {
    cancelAnimationFrame(frame);
    running = false;
    if (renderer) play.textContent = time >= duration ? '重播实时场景' : '继续播放';
  }

  function showPoster() {
    pause();
    cancelAnimationFrame(renderFrame);
    renderFrame = undefined;
    resize?.disconnect();
    renderer?.dispose();
    renderer = undefined;
    activeCanvas.hidden = true;
    poster.hidden = false;
    scrub.disabled = true;
    screen.removeAttribute('data-looking');
    screen.removeAttribute('tabindex');
    gyro.hidden = true;
    orientation = undefined;
    gyro.setAttribute('aria-pressed', 'false');
  }

  function updateMode() {
    play.disabled = Boolean(limited() || loading);
    chapters.querySelectorAll('button').forEach(button => { button.disabled = Boolean(limited() || loading); });
    if (limited()) {
      showPoster();
      play.textContent = '播放实时场景';
      status.textContent = '当前使用静态预览，可返回观看影片。';
    } else if (!renderer && !loading) status.textContent = '';
  }

  function tick(now) {
    if (!running) return;
    if (!lastPaint || now - lastPaint >= 31) {
      const began = performance.now();
      time = Math.min(duration, (now - anchor) / 1000);
      render();
      const delay = performance.now() - began;
      const interval = now - lastPaint;
      slowFrames = delay > 43 || (lastPaint && interval > 65) ? slowFrames + 1 : 0;
      quickFrames = delay < 17 && interval < 45 ? quickFrames + 1 : 0;
      if (slowFrames >= 5 && quality > .53) {
        quality = Math.max(.53, quality * .83);
        size(); slowFrames = quickFrames = 0;
      } else if (quickFrames >= 80 && quality < 1) {
        quality = Math.min(1, quality * 1.1);
        size(); quickFrames = 0;
      }
      lastPaint = now;
    }
    if (time >= duration) pause();
    else frame = requestAnimationFrame(tick);
  }

  async function openRenderer() {
    if (renderer) return true;
    if (loading || limited()) return false;
    loading = true;
    updateMode();
    play.textContent = '载入场景';
    status.textContent = '正在载入实时场景。';
    try {
      const module = await import(failedImport ? './scene.mjs?retry=1' : './scene.mjs');
      if (limited()) return false;
      const replacement = activeCanvas.cloneNode(false);
      activeCanvas.replaceWith(replacement);
      activeCanvas = replacement;
      activeCanvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        showPoster();
        play.textContent = '重新加载场景';
        status.textContent = '图形连接中断。可重试或观看影片。';
      }, { once: true });
      quality = matchMedia('(pointer: coarse)').matches ? .79 : 1;
      renderer = module.createCathedral(activeCanvas, { antialias: quality === 1 });
      size();
      activeCanvas.hidden = false;
      poster.hidden = true;
      scrub.disabled = false;
      screen.setAttribute('data-looking', '');
      screen.tabIndex = 0;
      gyro.hidden = typeof DeviceOrientationEvent === 'undefined';
      if ('ResizeObserver' in window) {
        resize = new ResizeObserver(() => { if (renderer) { size(); repaint(); } });
        resize.observe(screen);
      }
      render();
      status.textContent = '';
      return true;
    } catch {
      failedImport = true;
      showPoster();
      play.textContent = '重新加载场景';
      return false;
    } finally {
      loading = false;
      updateMode();
      if (failedImport && !renderer && !limited()) status.textContent = '此设备暂时无法载入实时场景。可观看影片。';
    }
  }

  async function start(at) {
    if (loading || limited()) return;
    if (Number.isFinite(at)) time = at;
    if (!await openRenderer() || document.hidden) return;
    if (time >= duration) time = 0;
    running = true;
    lastPaint = 0;
    anchor = performance.now() - time * 1000;
    play.textContent = '暂停实时场景';
    if (!frame || Number.isFinite(at)) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  }

  play.addEventListener('click', () => running ? pause() : start());
  chapters.addEventListener('click', event => {
    const chapter = event.target.closest('[data-ice-chapter]');
    if (!chapter) return;
    chapters.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button === chapter)));
    pause();
    start(Number(chapter.dataset.iceChapter));
  });
  scrub.addEventListener('input', () => {
    time = scrub.valueAsNumber;
    anchor = performance.now() - time * 1000;
    render();
    if (time === duration) pause();
  });
  screen.addEventListener('pointerdown', event => {
    if (!renderer || !event.isPrimary || event.button !== 0 || event.clientX < 26 || innerWidth - event.clientX < 26) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: view.yaw, pitch: view.pitch };
    screen.setPointerCapture(event.pointerId);
    screen.setAttribute('data-dragging','');
  });
  screen.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    view.yaw = clamp(drag.yaw + (drag.x - event.clientX) * .003, .49);
    view.pitch = clamp(drag.pitch + (drag.y - event.clientY) * .002, .27);
    repaint();
  });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) {
    screen.addEventListener(name, () => { drag = undefined; screen.removeAttribute('data-dragging'); });
  }
  screen.addEventListener('keydown', event => {
    if (!renderer || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') view.yaw = view.pitch = 0;
    if (event.key === 'ArrowLeft') view.yaw = clamp(view.yaw + .08, .49);
    if (event.key === 'ArrowRight') view.yaw = clamp(view.yaw - .08, .49);
    if (event.key === 'ArrowUp') view.pitch = clamp(view.pitch + .06, .27);
    if (event.key === 'ArrowDown') view.pitch = clamp(view.pitch - .06, .27);
    repaint();
  });
  gyro.addEventListener('click', async () => {
    if (orientation) {
      orientation = undefined;
      gyro.setAttribute('aria-pressed','false');
      return;
    }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function' &&
          await DeviceOrientationEvent.requestPermission() !== 'granted') throw new Error('permission');
      orientation = { reference: null };
      gyro.setAttribute('aria-pressed','true');
    } catch { status.textContent = '方向传感器暂不可用，可拖动画面环视。'; }
  });
  addEventListener('deviceorientation', event => {
    if (!orientation || !renderer || drag || event.gamma === null || event.beta === null) return;
    orientation.reference ??= { gamma: event.gamma, beta: event.beta };
    view.yaw = clamp((event.gamma - orientation.reference.gamma) * .012, .49);
    view.pitch = clamp((event.beta - orientation.reference.beta) * .01, .27);
    repaint();
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  addEventListener('pagehide', pause);
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) pause(); }).observe(screen);
  navigator.getBattery?.().then(info => {
    battery = info;
    for (const name of ['chargingchange','levelchange']) battery.addEventListener(name, updateMode);
    updateMode();
  }).catch(() => {});
  reduced.addEventListener?.('change', updateMode);
  navigator.connection?.addEventListener?.('change', updateMode);
  addEventListener('portfolio:settings', updateMode);
  play.hidden = scrub.hidden = chapters.hidden = false;
  updateMode();
}
