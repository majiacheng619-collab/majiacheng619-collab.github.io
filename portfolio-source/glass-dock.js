/* The dock keeps real links and native vertical scrolling. Only a deliberate
   horizontal drag becomes a liquid selection gesture. No page-wide effects. */
(() => {
  'use strict';
  const dock = document.querySelector('[data-glass-dock]');
  if (!dock || dock.dataset.glassReady) return;
  const lens = dock.querySelector('[data-dock-lens]');
  const links = [...dock.querySelectorAll('[data-dock-item]')];
  const isLink = item => item.hasAttribute('data-dock-link');
  if (!lens || !links.length) return;
  dock.dataset.glassReady = 'true';
  // Anchors remain ordinary links, but their browser drag ghost would cancel
  // the pointer stream before our horizontal liquid gesture can take ownership.
  links.forEach(link => {
    link.setAttribute('draggable', 'false');
    link.querySelectorAll('svg,img').forEach(node => node.setAttribute('draggable', 'false'));
  });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const aborter = new AbortController();
  const signal = aborter.signal;
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  let selected = Math.max(0, links.findIndex(link => link.hasAttribute('aria-current')));
  let dockLeft = 0;
  let boxes = [], current = 0, target = 0, width = 0, targetWidth = 0;
  let velocity = 0, frame = 0, lastTime = 0, gesture = null;
  let scrollImpulse = 0, previousScroll = scrollY, suppressClickUntil = 0;
  let observer = null, resizeObserver = null;

  function paint(stretch = 1, squash = 1) {
    dock.style.setProperty('--lens-x', `${current.toFixed(3)}px`);
    dock.style.setProperty('--lens-width', `${width.toFixed(3)}px`);
    dock.style.setProperty('--lens-stretch', stretch.toFixed(4));
    dock.style.setProperty('--lens-squash', squash.toFixed(4));

    dock.style.setProperty('--lens-velocity', String(clamp(velocity / 22, -1, 1)));
    // Each icon and label is drawn once. Magnify the real content, never a
    // duplicate hidden behind a moving mask (which tears in mobile Safari).
    const center = current + width / 2;
    links.forEach((item, index) => {
      const box = boxes[index];
      const proximity = box ? Math.max(0, 1 - Math.abs(box.x + box.width / 2 - center) / box.width) : 0;
      item.style.setProperty('--dock-scale', String(reduce.matches ? 1 : 1 + proximity * (gesture?.dragging ? .1 : .035)));
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
    if (Math.abs(delta) > .035 || Math.abs(velocity) > .035 || Math.abs(width - targetWidth) > .035 || Math.abs(scrollImpulse) > .02) {
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
    dockLeft = rect.left + dock.clientLeft;
    boxes = links.map(link => {
      const box = link.getBoundingClientRect();
      return {x: box.left - rect.left - dock.clientLeft, width: box.width, center: box.left + box.width / 2};
    });
    const geometryIndex = selected;
    target = boxes[geometryIndex].x; targetWidth = boxes[geometryIndex].width;
    if (snap || !width) { current = target; width = targetWidth; velocity = 0; paint(); }
    else animate();
  }
  function select(index, snap = false) {
    selected = clamp(index, 0, links.length - 1);
    links.forEach((link, i) => {
      if (i === selected && isLink(link)) link.setAttribute('data-active', 'true');
      else link.removeAttribute('data-active');
      if (i === selected && isLink(link)) link.setAttribute('aria-current', new URL(link.href, location.href).hash ? 'location' : 'page');
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
  dock.addEventListener('contextmenu', event => {
    event.preventDefault();
    if (gesture && !gesture.dragging) { suppressClickUntil = performance.now() + 900; cancelGesture(); }
  }, {signal});
  dock.addEventListener('selectstart', event => event.preventDefault(), {signal});
  dock.addEventListener('dragstart', event => event.preventDefault(), {signal});
  dock.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || event.target.closest('a')?.hasAttribute('download')) return;
    measure();
    gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, started: performance.now(), dragging: false};
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
    targetWidth = boxes[nearest(event.clientX)].width;
    // Once horizontal intent is established, the lens belongs underneath the
    // finger even if the gesture began over an unselected destination.
    const raw = event.clientX - dockLeft - width / 2;
    target = raw < first ? first + (raw - first) * .16 : raw > last ? last + (raw - last) * .16 : raw;
    animate();
  }, {signal, passive: false});
  dock.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const wasDragging = gesture.dragging;
    const held = performance.now() - gesture.started;
    gesture = null;
    dock.removeAttribute('data-dragging');
    releaseCapture(event.pointerId);
    if (!wasDragging) {
      if (held > 550) suppressClickUntil = performance.now() + 450;
      return;
    }
    const next = nearest(event.clientX);
    if (isLink(links[next])) select(next);
    else select(selected);
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
    const link = event.target.closest('[data-dock-item]');
    if (link && isLink(link) && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) select(links.indexOf(link));
  }, {signal, capture: true});
  dock.addEventListener('pointercancel', cancelGesture, {signal});
  dock.addEventListener('lostpointercapture', event => {
    // Touch starts with implicit capture on the anchor. Moving capture to the
    // dock emits a bubbling lostpointercapture for that anchor; it is not loss
    // of the dock's newly acquired pointer and must not cancel the drag.
    if (gesture && event.pointerId === gesture.id && !dock.hasPointerCapture?.(gesture.id)) cancelGesture();
  }, {signal});
  // Native Tab/Enter activation and the focus-visible ring provide keyboard
  // navigation. Focus alone never moves the page-selection lens to a different
  // destination, so a focused control cannot look like a second current page.
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
  const onMotion = () => { cancelGesture(); scrollImpulse = 0; measure(true); animate(); };
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
  const homeIndex = links.findIndex(link => { if (!isLink(link)) return false; const url = new URL(link.href, location.href); return sameDocument(url) && !url.hash; });
  const localSections = links.map((link, index) => {
    if (!isLink(link)) return null;
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
