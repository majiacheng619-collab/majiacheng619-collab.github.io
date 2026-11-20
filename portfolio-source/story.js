(() => {
  const story = document.querySelector('[data-story]');
  if (!story) return;
  const stages = [...story.querySelectorAll('[data-story-slide]')];
  const tools = story.querySelector('[data-story-tools]');
  const meter = story.querySelector('[data-story-progress]');
  const status = story.querySelector('[data-story-status]');
  const previous = tools.querySelector('[data-story-prev]');
  const next = tools.querySelector('[data-story-next]');
  const toggle = tools.querySelector('[data-story-toggle]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const duration = 5000;
  let index = 0, timer, started = 0, remaining = duration;
  let autoplay = !reduced.matches && document.documentElement.dataset.motion !== 'reduced' && !navigator.connection?.saveData;

  for (const stage of stages) {
    const segment = document.createElement('span');
    meter.append(segment);
  }
  tools.hidden = meter.hidden = false;

  function stop() {
    clearTimeout(timer);
    if (timer) remaining = Math.max(0, remaining - (performance.now() - started));
    timer = undefined;
    meter.removeAttribute('data-playing');
  }
  function schedule() {
    if (!autoplay || document.hidden || timer) return;
    started = performance.now();
    meter.style.setProperty('--story-time', remaining + 'ms');
    meter.setAttribute('data-playing', '');
    timer = setTimeout(() => {
      timer = undefined;
      if (index < stages.length - 1) show(index + 1);
      else { autoplay = false; remaining = 0; refresh(); }
    }, remaining);
  }
  function refresh() {
    toggle.textContent = autoplay ? '暂停' : index === stages.length - 1 && remaining <= 0 ? '重播' : '自动播放';
    if (autoplay) schedule();
    else stop();
  }
  function show(position) {
    stop();
    index = Math.min(stages.length - 1, Math.max(0, position));
    remaining = duration;
    stages.forEach((slide, i) => { slide.hidden = i !== index; });
    [...meter.children].forEach((bar, i) => {
      bar.toggleAttribute('data-done', i < index);
      bar.toggleAttribute('data-current', i === index);
    });
    status.textContent = stages[index].querySelector('h2').textContent + ' · ' + (index + 1) + '/' + stages.length;
    previous.disabled = index === 0;
    next.disabled = index === stages.length - 1;
    refresh();
  }

  previous.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  toggle.addEventListener('click', () => {
    autoplay = !autoplay;
    if (autoplay && index === stages.length - 1) show(0);
    else refresh();
  });
  story.querySelector('[data-story-slides]').addEventListener('click', event => {
    if (event.target.closest('a,button') || event.clientX < 24 || innerWidth - event.clientX < 24) return;
    const box = story.getBoundingClientRect();
    show(index + (event.clientX < box.left + box.width / 2 ? -1 : 1));
  });
  story.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : schedule());
  window.addEventListener('portfolio:settings', () => {
    if (document.documentElement.dataset.motion === 'reduced') { autoplay = false; refresh(); }
  });
  show(0);
})();
