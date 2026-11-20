(() => {
  const dialog = document.getElementById('image-dialog');
  if (!dialog) return;
  const area = dialog.querySelector('[data-image-area]');
  const image = dialog.querySelector('[data-dialog-image]');
  const zoom = dialog.querySelector('[data-image-zoom]');
  const previous = dialog.querySelector('[data-image-prev]');
  const next = dialog.querySelector('[data-image-next]');
  const entries = [...document.querySelectorAll('[data-image-open][href]')];
  let selected = 0, scale = 1, x = 0, y = 0, gesture;
  const pointers = new Map();

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  function paint() {
    const spanX = Math.max(0, (scale - 1) * area.clientWidth / 2);
    const spanY = Math.max(0, (scale - 1) * area.clientHeight / 2);
    x = clamp(x, -spanX, spanX);
    y = clamp(y, -spanY, spanY);
    image.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
    zoom.setAttribute('aria-pressed', String(scale > 1));
  }
  function choose(index) {
    selected = clamp(index, 0, entries.length - 1);
    const entry = entries[selected];
    if (!entry) return;
    image.src = entry.dataset.imageSrc || entry.href;
    image.alt = entry.dataset.imageAlt || entry.querySelector('img')?.alt || '作品图片';
    previous.disabled = selected === 0;
    next.disabled = selected === entries.length - 1;
    scale = 1; x = y = 0; paint();
  }

  previous.hidden = next.hidden = entries.length < 2;
  entries.forEach((entry, i) => entry.addEventListener('click', () => choose(i)));
  previous.addEventListener('click', () => choose(selected - 1));
  next.addEventListener('click', () => choose(selected + 1));
  zoom.addEventListener('click', () => { scale = scale > 1 ? 1 : 2; x = y = 0; paint(); });
  dialog.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    if (scale > 1) { x += event.key === 'ArrowLeft' ? 35 : -35; paint(); }
    else choose(selected + (event.key === 'ArrowLeft' ? -1 : 1));
  });
  area.addEventListener('pointerdown', event => {
    if (event.clientX < 24 || innerWidth - event.clientX < 24 || event.button !== 0) return;
    area.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) gesture = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY };
    if (pointers.size === 2) gesture = { distance: distance(), scale };
  });
  function distance() {
    const [a, b] = pointers.values();
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  area.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2 && gesture.distance) scale = clamp(gesture.scale * distance() / gesture.distance, 1, 3);
    else if (pointers.size === 1 && !gesture.distance && scale > 1) {
      x += event.clientX - gesture.lastX; y += event.clientY - gesture.lastY;
      gesture.lastX = event.clientX; gesture.lastY = event.clientY;
    }
    paint();
  });
  function finish(event) {
    if (!pointers.delete(event.pointerId)) return;
    if (gesture && !gesture.distance && scale === 1 && event.type === 'pointerup' &&
        Math.abs(event.clientY - gesture.y) < 45 && Math.abs(event.clientX - gesture.x) > 55) {
      choose(selected + (event.clientX < gesture.x ? 1 : -1));
    }
    if (!pointers.size) gesture = null;
  }
  area.addEventListener('pointerup', finish);
  area.addEventListener('pointercancel', finish);
  dialog.addEventListener('close', () => { gesture = null; pointers.clear(); scale = 1; x = y = 0; paint(); });
})();
