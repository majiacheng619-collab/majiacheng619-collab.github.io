/* The dock keeps real links and native vertical scrolling. Only a deliberate
   horizontal drag becomes a liquid selection gesture. No page-wide effects. */
(() => {
  'use strict';
  const dock = document.querySelector('[data-glass-dock]');
  if (!dock || dock.dataset.glassReady) return;
  const lens = dock.querySelector('[data-dock-lens]');
  const links = [...dock.querySelectorAll('[data-dock-link]')];
  if (!lens || !links.length) return;
  dock.dataset.glassReady = 'true';
  // A clipped optical projection gives Safari the same visible magnification
  // as browsers supporting SVG backdrop filters. It never duplicates controls.
  const projection = document.createElement('span');
  projection.className = 'glass-dock__projection';
  projection.setAttribute('aria-hidden', 'true');
  const projected = links.map(link => {
    const copy = document.createElement('span');
    copy.className = 'glass-dock__projected-link';
    for (const child of link.childNodes) copy.append(child.cloneNode(true));
    copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    projection.append(copy);
    const original = document.createElement('span');
    original.className = 'glass-dock__source';
    for (const child of [...link.childNodes]) original.append(child);
    link.append(original);
    return copy;
  });
  lens.append(projection);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const aborter = new AbortController();
  const signal = aborter.signal;
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  let selected = Math.max(0, links.findIndex(link => link.hasAttribute('aria-current')));
  let boxes = [], current = 0, target = 0, width = 0, targetWidth = 0;
  let velocity = 0, frame = 0, lastTime = 0, gesture = null;
  let scrollImpulse = 0, previousScroll = scrollY, suppressClickUntil = 0;
  let observer = null, resizeObserver = null;

  function paint(stretch = 1, squash = 1) {
    dock.style.setProperty('--lens-x', `${current.toFixed(3)}px`);
    dock.style.setProperty('--lens-width', `${width.toFixed(3)}px`);
    dock.style.setProperty('--lens-stretch', stretch.toFixed(4));
    dock.style.setProperty('--lens-squash', squash.toFixed(4));
    dock.style.setProperty('--lens-mask-left', `${(current + width * (1 - stretch) / 2).toFixed(3)}px`);
    dock.style.setProperty('--lens-mask-right', `${(current + width * (1 + stretch) / 2).toFixed(3)}px`);
    dock.style.setProperty('--lens-velocity', String(clamp(velocity / 22, -1, 1)));
    const magnify = gesture?.dragging && !reduce.matches ? 1.16 : 1.08;
    projection.style.transform = `translateX(${-current}px) scale(${magnify})`;
    projection.style.transformOrigin = `${current + width / 2}px 50%`;
    const opticalIndex = boxes.length ? boxes.reduce((best, box, index) => Math.abs(box.x + box.width / 2 - current - width / 2) < Math.abs(boxes[best].x + boxes[best].width / 2 - current - width / 2) ? index : best, 0) : selected;
    projected.forEach((copy, index) => {
      if (index === opticalIndex) copy.setAttribute('data-active', 'true');
      else copy.removeAttribute('data-active');
    });
  }
  function tick(time) {
    frame = 0;
    if (document.hidden) return;
    const dt = clamp((time - (lastTime || time - 16.667)) / 16.667, .3, 2);
    lastTime = time;
    const delta = target - current;
    velocity = (velocity + delta * .13 * dt) * Math.pow(.66, dt);
    current += velocity * dt;
    width += (targetWidth - width) * (1 - Math.pow(.73, dt));
    scrollImpulse *= Math.pow(.78, dt);
    const strain = Math.min(.20, Math.abs(velocity) * .0055);
    const held = gesture?.dragging ? .045 : 0;
    paint(1 + strain + held, 1 - strain * .43 + held * .45 - Math.min(.012, Math.abs(scrollImpulse) * .0005));
    if (Math.abs(delta) > .035 || Math.abs(velocity) > .035 || Math.abs(width - targetWidth) > .035 || Math.abs(scrollImpulse) > .02 || gesture?.dragging) {
      frame = requestAnimationFrame(tick);
    } else {
      current = target; width = targetWidth; velocity = 0; lastTime = 0;
      dock.removeAttribute('data-settling'); paint();
    }
  }
  function animate() {
    if (reduce.matches) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; velocity = 0; lastTime = 0; current = target; width = targetWidth;
      paint(); return;
    }
    if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function measure(snap = false) {
    const rect = dock.getBoundingClientRect();
    boxes = links.map(link => {
      const box = link.getBoundingClientRect();
      return {x: box.left - rect.left - dock.clientLeft, width: box.width, center: box.left + box.width / 2};
    });
    projection.style.width = `${dock.clientWidth}px`;
    projected.forEach((copy, index) => {
      copy.style.left = `${boxes[index].x}px`;
      copy.style.width = `${boxes[index].width}px`;
      links[index].style.setProperty('--dock-link-x', `${boxes[index].x}px`);
    });
    target = boxes[selected].x; targetWidth = boxes[selected].width;
    if (snap || !width) { current = target; width = targetWidth; velocity = 0; paint(); }
    else animate();
  }
  function select(index, snap = false) {
    selected = clamp(index, 0, links.length - 1);
    links.forEach((link, i) => {
      if (i === selected) link.setAttribute('data-active', 'true');
      else link.removeAttribute('data-active');
      if (i === selected) link.setAttribute('aria-current', new URL(link.href, location.href).hash ? 'location' : 'page');
      else link.removeAttribute('aria-current');
    });
    if (!boxes.length) return;
    target = boxes[selected].x; targetWidth = boxes[selected].width;
    if (snap) { current = target; width = targetWidth; velocity = 0; paint(); }
    else { dock.setAttribute('data-settling', ''); animate(); }
  }
  function nearest(clientX) {
    return boxes.reduce((best, box, index) => Math.abs(clientX - box.center) < Math.abs(clientX - boxes[best].center) ? index : best, 0);
  }
  function releaseCapture(pointerId) {
    if (dock.hasPointerCapture?.(pointerId)) dock.releasePointerCapture(pointerId);
  }
  function cancelGesture() {
    const old = gesture; gesture = null;
    dock.removeAttribute('data-dragging');
    if (old) releaseCapture(old.id);
    select(selected, reduce.matches);
  }
  dock.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || event.target.closest('a')?.hasAttribute('download')) return;
    measure();
    gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, start: target, dragging: false};
  }, {signal, passive: true});
  dock.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx)) { cancelGesture(); return; }
      if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
      gesture.dragging = true;
      dock.setPointerCapture?.(event.pointerId);
      dock.setAttribute('data-dragging', 'true');
    }
    if (event.cancelable) event.preventDefault();
    const first = boxes[0].x, last = boxes.at(-1).x;
    const raw = gesture.start + dx;
    target = raw < first ? first + (raw - first) * .16 : raw > last ? last + (raw - last) * .16 : raw;
    targetWidth = boxes[nearest(event.clientX)].width;
    animate();
  }, {signal, passive: false});
  dock.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const wasDragging = gesture.dragging;
    gesture = null;
    dock.removeAttribute('data-dragging');
    releaseCapture(event.pointerId);
    if (!wasDragging) return;
    const next = nearest(event.clientX);
    select(next);
    // Consume only the compatibility click generated by this drag. Dispatch a
    // real anchor click first so existing navigation handlers remain in charge.
    links[next].click();
    suppressClickUntil = performance.now() + 450;
  }, {signal});
  dock.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil && event.isTrusted && event.detail > 0) {
      suppressClickUntil = 0;
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    const link = event.target.closest('[data-dock-link]');
    if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) select(links.indexOf(link));
  }, {signal, capture: true});
  dock.addEventListener('pointercancel', cancelGesture, {signal});
  dock.addEventListener('lostpointercapture', () => { if (gesture) cancelGesture(); }, {signal});
  dock.addEventListener('focusin', event => {
    const index = links.indexOf(event.target.closest('[data-dock-link]'));
    if (index >= 0) {
      target = boxes[index]?.x ?? target; targetWidth = boxes[index]?.width ?? targetWidth; animate();
    }
  }, {signal});
  dock.addEventListener('focusout', event => {
    if (!dock.contains(event.relatedTarget)) select(selected);
  }, {signal});
  addEventListener('scroll', () => {
    const next = scrollY, difference = next - previousScroll; previousScroll = next;
    if (reduce.matches || document.hidden || gesture) return;
    scrollImpulse = clamp(scrollImpulse + difference * .12, -18, 18);
    animate();
  }, {signal, passive: true});
  const onResize = () => { if (gesture) cancelGesture(); measure(true); };
  addEventListener('resize', onResize, {signal, passive: true});
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(onResize); resizeObserver.observe(dock);
  }
  const onMotion = () => { cancelGesture(); scrollImpulse = 0; animate(); };
  reduce.addEventListener('change', onMotion, {signal});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; lastTime = 0; scrollImpulse = 0; cancelGesture();
    } else { previousScroll = scrollY; measure(true); }
  }, {signal});
  // Mark in-page destinations as the reader moves through the portfolio.
  const normalizedPath = pathname => pathname.replace(/\/index\.html$/, '/');
  const sameDocument = url => url.origin === location.origin && normalizedPath(url.pathname) === normalizedPath(location.pathname);
  const homeIndex = links.findIndex(link => { const url = new URL(link.href, location.href); return sameDocument(url) && !url.hash; });
  const localSections = links.map((link, index) => {
    const url = new URL(link.href, location.href);
    return sameDocument(url) && url.hash ? {node: document.getElementById(decodeURIComponent(url.hash.slice(1))), index} : null;
  }).filter(item => item?.node);
  if ('IntersectionObserver' in window && localSections.length) {
    const sectionVisibility = new Map();
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => sectionVisibility.set(entry.target, entry));
      if (gesture || dock.contains(document.activeElement)) return;
      const visible = [...sectionVisibility.values()].filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible.length) select(localSections.find(item => item.node === visible[0].target).index);
      else if (homeIndex >= 0) select(homeIndex);
    }, {rootMargin: '-15% 0px -45% 0px', threshold: [0, .15, .4]});
    localSections.forEach(item => observer.observe(item.node));
  }
  measure(true); select(selected, true);
  addEventListener('pagehide', event => {
    cancelGesture();
    if (frame) cancelAnimationFrame(frame);
    frame = 0; velocity = 0; lastTime = 0; scrollImpulse = 0;
    if (event.persisted) return;
    aborter.abort(); observer?.disconnect(); resizeObserver?.disconnect();
    if (frame) cancelAnimationFrame(frame);
  }, {signal});
  addEventListener('pageshow', event => {
    if (!event.persisted) return;
    suppressClickUntil = 0; previousScroll = scrollY;
    measure(true); select(selected, true);
  }, {signal});
})();
