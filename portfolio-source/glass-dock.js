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
  let suppressClickUntil = 0, navigationTimer = 0, dragActivation = false;
  let heldScale = 0;
  let observer = null, resizeObserver = null;

  // The shell alone samples the backdrop. The empty lens is one composited
  // surface: no filters, cloned labels, width animation or per-item frame writes.
  function paint(stretch = 1, squash = 1) {
    lens.style.setProperty('--lens-x', `${current.toFixed(3)}px`);
    lens.style.setProperty('--lens-stretch', stretch.toFixed(4));
    lens.style.setProperty('--lens-squash', squash.toFixed(4));
  }
  function tick(time) {
    frame = 0;
    if (document.hidden) return;
    const dt = clamp((time - (lastTime || time - 16.667)) / 1000, .001, .04);
    lastTime = time;
    // Exact critically damped spring; its response is independent of 60/120 Hz.
    if (gesture?.dragging) {
      // Coalesce input into one paint per display frame; do not make the finger
      // chase a spring. Only the released lens settles with inertia.
      velocity = (target - current) / dt;
      current = target;
    } else {
      const omega = 24;
      const offset = current - target, c = velocity + omega * offset;
      const decay = Math.exp(-omega * dt);
      current = target + (offset + c * dt) * decay;
      velocity = (velocity - omega * c * dt) * decay;
    }
    const heldTarget = gesture ? 1 : 0;
    heldScale += (heldTarget - heldScale) * (1 - Math.exp(-24 * dt));
    const strain = Math.min(.15, Math.abs(velocity) * .00013);
    paint(1 + strain + heldScale * .055, 1 - strain * .32 + heldScale * .09);
    if (Math.abs(current - target) > .03 || Math.abs(velocity) > .15 || Math.abs(heldTarget - heldScale) > .002) {
      frame = requestAnimationFrame(tick);
    } else {
      current = target; velocity = 0; lastTime = 0; heldScale = heldTarget;
      dock.removeAttribute('data-settling');
      paint(1 + heldScale * .055, 1 + heldScale * .09);
    }
  }
  function animate() {
    if (reduce.matches) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; velocity = 0; lastTime = 0; current = target; width = targetWidth; heldScale = 0;
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
    width = targetWidth;
    lens.style.setProperty('--lens-width', `${width.toFixed(3)}px`);
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
    velocity = 0;
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
    if (navigationTimer) { clearTimeout(navigationTimer); navigationTimer = 0; }
    measure();
    gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, started: performance.now(), dragging: false};
    animate();
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
    velocity = clamp(velocity, -750, 750);
    const next = nearest(event.clientX);
    if (isLink(links[next])) select(next);
    else select(selected);
    // Consume only the compatibility click generated by this drag. Dispatch a
    // real anchor click first so existing navigation handlers remain in charge.
    dragActivation = event.isTrusted;
    links[next].click();
    dragActivation = false;
    suppressClickUntil = performance.now() + 450;
  }, {signal});
  dock.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil && event.isTrusted && event.detail > 0) {
      suppressClickUntil = 0;
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    const link = event.target.closest('[data-dock-item]');
    if (!link || !isLink(link) || link.hasAttribute('download') || link.getAttribute('target') === '_blank' || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
    select(links.indexOf(link));
    const url = new URL(link.href, location.href);
    const currentURL = new URL(location.href);
    // Native cross-document navigation otherwise destroys the selection animation
    // before its first frame. A short, cancellable handoff makes it visible.
    if ((event.isTrusted || dragActivation) && url.origin === location.origin &&
        (url.pathname !== currentURL.pathname || url.search !== currentURL.search)) {
      event.preventDefault();
      if (navigationTimer) clearTimeout(navigationTimer);
      if (reduce.matches) location.assign(url.href);
      else navigationTimer = setTimeout(() => { navigationTimer = 0; location.assign(url.href); }, 180);
    }
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
  const onResize = () => { if (gesture) cancelGesture(); measure(true); };
  addEventListener('resize', onResize, {signal, passive: true});
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(onResize); resizeObserver.observe(dock);
  }
  const onMotion = () => { cancelGesture(); measure(true); animate(); };
  reduce.addEventListener('change', onMotion, {signal});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; lastTime = 0; cancelGesture();
    } else { measure(true); }
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
    frame = 0; velocity = 0; lastTime = 0;
    if (navigationTimer) clearTimeout(navigationTimer);
    navigationTimer = 0;
    if (event.persisted) return;
    aborter.abort(); observer?.disconnect(); resizeObserver?.disconnect();
    if (frame) cancelAnimationFrame(frame);
  }, {signal});
  addEventListener('pageshow', event => {
    if (!event.persisted) return;
    suppressClickUntil = 0;
    measure(true); select(selected, true);
  }, {signal});
})();
