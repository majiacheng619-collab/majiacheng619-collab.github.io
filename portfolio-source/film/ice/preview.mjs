const theater = document.querySelector('[data-ice-theater]');
if (theater) {
  const canvas = theater.querySelector('canvas');
  const poster = theater.querySelector('img');
  const button = theater.querySelector('[data-ice-play]');
  const scrub = theater.querySelector('input');
  const clock = theater.querySelector('[data-ice-clock]');
  const status = theater.querySelector('[data-ice-status]');
  const screen = theater.querySelector('.ice-screen');
  const runTime = Number(scrub.max);
  const pageUrl = new URL(location.href);
  let renderer, resize, frame, running = false, time = 0, anchor, last = 0;
  let quality = 1, slowFrames = 0, resizeFrame;
  let activeCanvas = canvas;
  let moduleLoadFailed = false;

  function position() {
    scrub.value = time;
    scrub.style.setProperty('--film-progress', `${100 * time / runTime}%`);
    clock.textContent = `0:${Math.floor(time).toString().padStart(2, '0')}`;
    scrub.setAttribute('aria-valuetext', `${Math.floor(time)} 秒，共 ${runTime} 秒`);
  }

  function size() {
    const pixels = Math.min(1480, screen.clientWidth * Math.min(1.5, devicePixelRatio));
    const width = Math.max(256, Math.round(pixels * quality));
    renderer.setSize(width, Math.round(width * 9 / 16));
  }

  function render() {
    renderer.renderAt(time);
    position();
  }

  function pause() {
    cancelAnimationFrame(frame);
    running = false;
    if (renderer) button.textContent = time >= runTime ? '重播实时场景' : '继续播放';
  }

  function lost(event) {
    event.preventDefault();
    pause();
    cancelAnimationFrame(resizeFrame);
    resize?.disconnect();
    renderer?.dispose();
    renderer = undefined;
    activeCanvas.hidden = true;
    poster.hidden = false;
    scrub.disabled = true;
    button.textContent = '重新加载场景';
    status.textContent = '图形连接中断。可重试或观看影片。';
  }

  function tick(now) {
    if (!running) return;
    if (!last || now - last >= 31) {
      const renderStart = performance.now();
      time = Math.min(runTime, (now - anchor) / 1000);
      render();
      slowFrames = performance.now() - renderStart > 44 || (last && now - last > 63) ? slowFrames + 1 : 0;
      if (slowFrames >= 5 && quality > .51) {
        quality *= .83;
        size();
        slowFrames = 0;
      }
      last = now;
    }
    if (time >= runTime) pause();
    else frame = requestAnimationFrame(tick);
  }

  async function toggle() {
    if (running) {
      pause();
      return;
    }
    if (moduleLoadFailed) {
      // The browser remembers failed module loads for this document.
      pageUrl.searchParams.set('load-scene', '1');
      location.replace(pageUrl);
      return;
    }
    if (!renderer) {
      button.disabled = true;
      button.textContent = '载入场景';
      status.textContent = '正在载入实时场景。';
      try {
        const next = activeCanvas.cloneNode(false);
        activeCanvas.replaceWith(next);
        activeCanvas = next;
        activeCanvas.addEventListener('webglcontextlost', lost, { once: true });
        const { createCathedral } = await import('./scene.mjs').catch(error => {
          moduleLoadFailed = true;
          throw error;
        });
        renderer = createCathedral(activeCanvas);
        size();
        render();
        resize = new ResizeObserver(() => {
          cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => {
            if (renderer) { size(); render(); }
          });
        });
        resize.observe(screen);
        activeCanvas.hidden = false;
        poster.hidden = true;
        scrub.disabled = false;
        status.textContent = '';
      } catch {
        renderer?.dispose();
        renderer = undefined;
        button.textContent = '重新加载场景';
        status.textContent = '此设备暂时无法载入实时场景。可观看影片。';
        return;
      } finally {
        button.disabled = false;
      }
    }
    if (time >= runTime) time = 0;
    if (document.hidden) { pause(); return; }
    running = true;
    last = 0;
    anchor = performance.now() - time * 1000;
    button.textContent = '暂停实时场景';
    frame = requestAnimationFrame(tick);
  }

  button.addEventListener('click', toggle);
  scrub.addEventListener('input', () => {
    time = scrub.valueAsNumber;
    anchor = performance.now() - time * 1000;
    render();
    if (time === runTime) pause();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', pause);
  new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) pause(); }).observe(screen);
  button.hidden = false;
  scrub.hidden = false;
  if (pageUrl.searchParams.get('load-scene') === '1') {
    pageUrl.searchParams.delete('load-scene');
    history.replaceState(history.state, '', pageUrl);
    toggle();
  }
}
