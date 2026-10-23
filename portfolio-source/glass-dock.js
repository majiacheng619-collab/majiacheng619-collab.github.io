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
  let dockLeft = 0, measuredRect = null;
  let boxes = [], current = 0, target = 0, width = 0, targetWidth = 0;
  let velocity = 0, frame = 0, lastTime = 0, gesture = null;
  let suppressClickUntil = 0, navigationTimer = 0, dragActivation = false;
  let heldScale = 0, heldVelocity = 0;
  let resizeObserver = null, contrastObserver = null, pendingHref = '';
  const contrastSources = [...document.querySelectorAll('video, .dark, [data-dock-tone=dark]')];
  function observeContrast() {
    contrastObserver?.disconnect();
    if (!contrastSources.length || !('IntersectionObserver' in window)) return;
    const box = dock.getBoundingClientRect();
    const viewportHeight = window.innerHeight, viewportWidth = window.innerWidth;
    const center = box.top + box.height / 2;
    const active = new Set();
    contrastObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) active.add(entry.target); else active.delete(entry.target); });
      dock.toggleAttribute('data-over-media', active.size > 0);
    }, {rootMargin:`${-center}px ${-(viewportWidth - box.right)}px ${-(viewportHeight - center - 1)}px ${-box.left}px`, threshold:0});
    contrastSources.forEach(node => contrastObserver.observe(node));
  }
  const handoffKey = 'portfolio-dock-handoff-v2';
  const normalizedPath = pathname => pathname.replace(/\/index\.html$/, '/');
  function samePage(a, b) {
    return a.origin === b.origin && normalizedPath(a.pathname) === normalizedPath(b.pathname) && a.search === b.search;
  }
  function clearHandoff() {
    pendingHref = '';
    try { sessionStorage.removeItem(handoffKey); } catch (_) { /* Storage may be disabled. */ }
  }
  function saveHandoff() {
    if (!pendingHref || reduce.matches || boxes.length < 2) return;
    const span = boxes.at(-1).x - boxes[0].x;
    if (span <= 0) return;
    try {
      sessionStorage.setItem(handoffKey, JSON.stringify({
        href: pendingHref, at: Date.now(), fraction: (current - boxes[0].x) / span,
        speed: clamp(velocity / span, -3, 3), lift: heldScale
      }));
    } catch (_) { /* Ordinary anchor navigation remains available without storage. */ }
  }
  function restoreHandoff() {
    let state;
    try {
      state = JSON.parse(sessionStorage.getItem(handoffKey));
      sessionStorage.removeItem(handoffKey);
    } catch (_) { return; }
    if (reduce.matches || !state || typeof state.href !== 'string' ||
        !Number.isFinite(state.at) || Date.now() - state.at < 0 || Date.now() - state.at > 10000 ||
        !Number.isFinite(state.fraction) || state.fraction < -.1 || state.fraction > 1.1 ||
        !Number.isFinite(state.speed) || !Number.isFinite(state.lift)) return;
    try { if (!samePage(new URL(state.href, location.href), new URL(location.href))) return; } catch (_) { return; }
    const span = boxes.at(-1).x - boxes[0].x;
    current = boxes[0].x + state.fraction * span;
    velocity = clamp(state.speed, -3, 3) * span;
    heldScale = clamp(state.lift, 0, 1);
    paint(1 + heldScale * .09, 1 + heldScale * .16);
    animate();
  }

  // The shell alone samples the backdrop. The empty lens is one composited
  // surface: no filters, cloned labels, width animation or per-item frame writes.
  function paint(stretch = 1, squash = 1) {
    lens.style.setProperty('--lens-x', `${current.toFixed(3)}px`);
    lens.style.setProperty('--lens-stretch', stretch.toFixed(4));
    lens.style.setProperty('--lens-squash', squash.toFixed(4));
    lens.style.setProperty('--lens-glint-shift', `${clamp(velocity * .008, -10, 10).toFixed(3)}px`);
    lens.style.setProperty('--lens-glint-alpha', (.2 + Math.min(.45, Math.abs(velocity) * .0003 + Math.abs(heldScale) * .24)).toFixed(3));
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
    // Closed-form damped droplet response: one restrained release ripple,
    // independent of display refresh rate and with no geometry/filter animation.
    const frequency = 30, damping = .72, decayLift = Math.exp(-damping * frequency * dt);
    const damped = frequency * Math.sqrt(1 - damping * damping);
    const liftOffset = heldScale - heldTarget;
    const liftB = (heldVelocity + damping * frequency * liftOffset) / damped;
    const liftCos = Math.cos(damped * dt), liftSin = Math.sin(damped * dt);
    heldScale = heldTarget + decayLift * (liftOffset * liftCos + liftB * liftSin);
    heldVelocity = decayLift * ((-damping * frequency * liftOffset + damped * liftB) * liftCos
      + (-damping * frequency * liftB - damped * liftOffset) * liftSin);
    const strain = Math.min(.15, Math.abs(velocity) * .00013);
    paint(1 + strain + heldScale * .09, 1 - strain * .32 + heldScale * .16);
    if (Math.abs(current - target) > .03 || Math.abs(velocity) > .15 || Math.abs(heldTarget - heldScale) > .002 || Math.abs(heldVelocity) > .04) {
      frame = requestAnimationFrame(tick);
    } else {
      current = target; velocity = 0; lastTime = 0; heldScale = heldTarget; heldVelocity = 0;
      dock.removeAttribute('data-settling');
      paint(1 + heldScale * .09, 1 + heldScale * .16);
    }
  }
  function animate() {
    if (reduce.matches) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; velocity = 0; lastTime = 0; current = target; width = targetWidth; heldScale = 0; heldVelocity = 0;
      paint(); return;
    }
    if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function measure(snap = false) {
    const rect = dock.getBoundingClientRect();
    measuredRect = {left:rect.left, width:rect.width, height:rect.height};
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
    // Keep desktop link menus (including Ctrl-click on macOS) available. Only
    // the touch hold needs suppression to avoid callouts and selected labels.
    if (event.button === 2 || event.ctrlKey || event.pointerType === 'mouse') return;
    event.preventDefault();
    if (gesture && !gesture.dragging) { suppressClickUntil = performance.now() + 900; cancelGesture(); }
  }, {signal});
  dock.addEventListener('selectstart', event => event.preventDefault(), {signal});
  dock.addEventListener('dragstart', event => event.preventDefault(), {signal});
  dock.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || event.target.closest('a')?.hasAttribute('download')) return;
    if (navigationTimer) { clearTimeout(navigationTimer); navigationTimer = 0; clearHandoff(); }
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
      // A held press can already have settled and stopped its frame loop.
      // Always restart on release, even when no click follows the long hold.
      animate();
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
        !samePage(url, currentURL)) {
      event.preventDefault();
      if (navigationTimer) clearTimeout(navigationTimer);
      pendingHref = url.href;
      if (reduce.matches) { clearHandoff(); location.assign(url.href); }
      else navigationTimer = setTimeout(() => {
        navigationTimer = 0;
        saveHandoff();
        location.assign(url.href);
      }, 110);
    }
  }, {signal, capture: true});
  dock.addEventListener('pointercancel', cancelGesture, {signal});
  // A mouse press has no implicit capture. If it leaves the dock before a
  // horizontal drag begins, its release never reaches the dock listener.
  // Clear that held state without activating an unrelated destination.
  addEventListener('pointerup', event => {
    if (gesture && event.pointerId === gesture.id && !dock.contains(event.target)) cancelGesture();
  }, {signal});
  addEventListener('blur', () => { if (gesture) cancelGesture(); }, {signal});
  dock.addEventListener('lostpointercapture', event => {
    // Touch starts with implicit capture on the anchor. Moving capture to the
    // dock emits a bubbling lostpointercapture for that anchor; it is not loss
    // of the dock's newly acquired pointer and must not cancel the drag.
    if (gesture && event.pointerId === gesture.id && !dock.hasPointerCapture?.(gesture.id)) cancelGesture();
  }, {signal});
  // Native Tab/Enter activation and the focus-visible ring provide keyboard
  // navigation. Focus alone never moves the page-selection lens to a different
  // destination, so a focused control cannot look like a second current page.
  const onResize = event => {
    // ResizeObserver delivers an initial notification even without a resize.
    // Snapping that notification would erase a just-restored cross-page spring.
    const rect = dock.getBoundingClientRect();
    const changed = !measuredRect || rect.left !== measuredRect.left || rect.width !== measuredRect.width || rect.height !== measuredRect.height;
    if (!changed && !event?.type) return;
    if (gesture) cancelGesture();
    measure(true);
    observeContrast();
  };
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
  // Each tab now names a separate page, including contact. Scrolling inside a
  // document never changes its current-page semantics or runs a section observer.
  measure(true); select(selected, true); restoreHandoff(); observeContrast();
  addEventListener('pagehide', event => {
    // Capture the actual departure position after loading time, rather than the
    // earlier click position, so the next document continues the same movement.
    saveHandoff();
    cancelGesture();
    if (frame) cancelAnimationFrame(frame);
    frame = 0; velocity = 0; lastTime = 0;
    if (navigationTimer) clearTimeout(navigationTimer);
    navigationTimer = 0;
    if (event.persisted) return;
    aborter.abort(); resizeObserver?.disconnect(); contrastObserver?.disconnect();
    if (frame) cancelAnimationFrame(frame);
  }, {signal});
  addEventListener('pageshow', event => {
    if (!event.persisted) return;
    suppressClickUntil = 0;
    heldScale = 0; heldVelocity = 0; velocity = 0;
    measure(true); select(selected, true);
  }, {signal});
})();
