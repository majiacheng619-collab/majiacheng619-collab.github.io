/* One optical field lights the hero and the lighter reading surfaces. */
(() => {
  'use strict';
  const ambient = document.querySelector('.ambient-field');
  if (!ambient || ambient.querySelector('[data-optical-scene]')) return;
  const root = document.documentElement;
  const hero = document.querySelector('.era-hero');
  const profiles = {
    home: [-.35, .63, .3, [.57,.74,.97]],
    work: [-.48, .57, 1.8, [.55,.72,.96]],
    experience: [.48, .62, 3.9, [.49,.80,.70]],
    honor: [-.74, .55, 5.7, [.91,.68,.45]],
    contact: [.78, .59, 7.4, [.72,.58,.92]],
  };
  const profile = profiles[document.body.dataset.atmosphere] || profiles.work;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const reducedTransparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const moreContrast = matchMedia('(prefers-contrast: more)');
  const forcedColors = matchMedia('(forced-colors: active)');
  const coarsePointer = matchMedia('(pointer: coarse)');
  const opaque = () => reducedTransparency.matches || moreContrast.matches || forcedColors.matches;

  function drops(className, positions) {
    const layer = document.createElement('div');
    layer.className = className;
    layer.setAttribute('aria-hidden', 'true');
    for (const [x, y, delay] of positions) {
      const drop = document.createElement('span');
      drop.className = 'water-event';
      drop.style.setProperty('--water-x', x + '%');
      drop.style.setProperty('--water-y', y + '%');
      drop.style.setProperty('--water-delay', delay + 's');
      drop.innerHTML = '<i class="water-drop"></i><i class="water-ring"></i><i class="water-ring water-ring-echo"></i>';
      layer.append(drop);
    }
    return layer;
  }

  const water = drops('water-events', [[23,31,-.2],[81,67,-2.6]]);
  const heroWater = hero && drops('hero-water', [[91,30,-.3],[73,62,-2.7]]);
  ambient.append(water);
  if (heroWater) hero.querySelector('.era-silk').append(heroWater);

  const canvas = document.createElement('canvas');
  canvas.className = 'optical-scene';
  canvas.hidden = true;
  canvas.dataset.opticalScene = 'loading';
  canvas.setAttribute('aria-hidden', 'true');
  ambient.prepend(canvas);

  const fallbackLens = document.createElement('span');
  fallbackLens.className = 'surface-touch';
  fallbackLens.setAttribute('aria-hidden', 'true');
  document.body.append(fallbackLens);

  const gl = canvas.getContext('webgl', {
    alpha: false, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: true, powerPreference: 'low-power',
  });
  const renderer = gl?.getExtension('WEBGL_debug_renderer_info');
  const software = renderer && /SwiftShader|llvmpipe|software/i.test(gl.getParameter(renderer.UNMASKED_RENDERER_WEBGL));
  const vertex = 'attribute vec2 a; varying vec2 uv; void main(){uv=a*.5+.5; gl_Position=vec4(a,0.,1.);}';
  const fragment = `precision highp float;
    varying vec2 uv;
    uniform sampler2D field;
    uniform float clock;
    uniform vec2 pointer;
    uniform vec3 pulses[4];
    uniform float aspect;
    uniform float pressure;
    uniform float contactRadius;
    uniform vec3 scene;
    uniform vec3 accent;
    uniform float heroEdge;

    float bell(float x){ return exp(-x*x); }

    vec3 environment(vec2 q, float night){
      float t=clock*scene.y+scene.z;
      float c=cos(scene.x),s=sin(scene.x);
      vec2 p=mat2(c,-s,s,c)*(q-.5)+.5;
      float fold=p.y-(.39+.24*sin(p.x*3.5+t)+.11*cos(t*.69));
      float back=p.y-(.88-.38*p.x+.17*sin(p.x*3.9-t*.74));
      float body=bell((fold-.045)/.16);
      float returnFlow=bell((back-.032)/.12);
      float brightEdge=bell((fold+.027)/.023)*.70+bell((back+.045)/.024)*.50;
      float cut=bell((fold-.092)/.033);
      vec3 lightTint=mix(vec3(.972,.986,1.),accent,.22+.34*body+.19*returnFlow);
      lightTint+=vec3(.101,.078,.049)*brightEdge-cut*.021;
      lightTint=clamp(lightTint,vec3(.72),vec3(.997));
      vec3 beam=mix(vec3(.10,.41,.71),vec3(.29,.18,.58),smoothstep(.15,.97,p.x));
      vec3 darkTint=vec3(.023,.044,.089)+beam*(.23*body+.15*returnFlow);
      darkTint+=vec3(.17,.29,.42)*brightEdge*mix(.24,.78,smoothstep(.02,1.,q.x));
      return mix(lightTint,darkTint,night);
    }

    vec3 packet(vec2 delta,float age){
      float radius=length(delta),front=radius-age*.33;
      float envelope=bell(front*17.)*exp(-age*1.65)*smoothstep(0.,.075,age);
      float ridge=sin(front*57.);
      vec2 normal=delta/max(radius,.002)*ridge*envelope;
      return vec3(normal,cos(front*57.)*envelope);
    }

    vec2 beadCenter(float index, float night){
      vec2 lightCenter=vec2(.16+index*.65,.25+index*.38);
      vec2 darkCenter=vec2(.94-index*.22,.34+index*.32);
      return mix(lightCenter,darkCenter,night);
    }

    void main(){
      vec2 q=vec2(uv.x,1.-uv.y),metric=vec2(aspect,1.);
      float night=1.-smoothstep(heroEdge-.017,heroEdge+.010,q.y);
      vec2 p=q*metric+(pointer-.5)*.026;
      vec2 waveA=vec2(1.4,4.2),waveB=vec2(3.4,-1.7);
      vec2 slope=.31*waveA*cos(dot(p,waveA)-clock*.69)
                +.17*waveB*cos(dot(p,waveB)+clock*.56);
      float sheen=0.,split=0.;
      for(int i=0;i<4;i++){
        if(pulses[i].z>=0.){
          vec3 ripple=packet((q-pulses[i].xy)*metric,max(0.,clock-pulses[i].z));
          slope+=ripple.xy*7.;
          sheen+=ripple.z*.102;
          split+=ripple.x*.060;
        }
      }

      // The same height field bends around a bead on impact and around a finger.
      vec2 localBead=vec2(9.);
      float visibility=0.;
      for(int i=0;i<2;i++){
        float id=float(i),age=mod(clock+.52+id*2.5,5.)-.90;
        vec2 center=beadCenter(id,step(q.y,heroEdge));
        if(age>=0. && age<2.){
          vec3 ripple=packet((q-center)*metric,age);
          slope+=ripple.xy*3.1;
          sheen+=ripple.z*mix(.043,.081,night);
        }else if(age<0.){
          float fall=clamp((age+.9)/.9,0.,1.);
          center.y-=.23*(1.-fall*fall);
          localBead=(q-center)*metric/vec2(.019,.028-.010*fall);
          visibility=smoothstep(0.,.22,fall);
        }
      }

      vec2 finger=(q-pointer)*metric/max(.025,contactRadius);
      float dimple=exp(-dot(finger,finger)*2.1)*pressure;
      slope+=finger*dimple*7.;
      vec2 drift=vec2(sin(clock*.09),cos(clock*.075))*.018;
      vec3 sampled=texture2D(field,clamp(q*.84+.08+drift,.001,.999)).rgb;
      vec2 normal=-slope*.14+(sampled.gb-.5)*.055;
      vec3 color=environment(q+normal*.18/metric,night);
      float shine=pow(max(dot(normalize(vec3(normal,1.)),normalize(vec3(-.25,-.35,1.))),0.),12.);
      color+=shine*mix(.011,.017,night)+vec3(.74,.90,1.)*sheen+sampled.r*.003;
      color+=vec3(split*.7,split*.28,-split*.5)-dimple*.063;
      color+=bell((length(finger)-.84)*7.)*pressure*mix(.10,.19,night);

      float distance=length(localBead);
      if(distance<1.075){
        float mask=1.-smoothstep(.92,1.075,distance);
        float curve=sqrt(max(.001,1.-distance*distance));
        vec3 bead=environment(q+localBead*.040/metric,night);
        float reflection=pow(max(dot(vec3(localBead,curve),vec3(-.34,-.51,.79)),0.),24.);
        float rim=smoothstep(.68,1.02,distance);
        bead+=vec3(.74,.90,1.)*(reflection*.55+rim*.24);
        bead-=smoothstep(.43,.78,distance)*.041;
        color=mix(color,bead,mask*visibility);
      }
      gl_FragColor=vec4(clamp(color,0.,1.),1.);
    }`;

  let program, texture, buffer, locations;
  let frame = 0, last = 0, elapsed = 0, ready = false, suspended = false;
  let needsPaint = true, heroEdge = -1, edgeDirty = true;
  let contactId = null, contactOrigin = null, fallbackAnimation = null, pressure = 0, lastTrail = 0;
  const pointer = new Float32Array([.5,.5]);
  const pulses = new Float32Array([0,0,-1,0,0,-1,0,0,-1,0,0,-1]);
  let pulseIndex = 0;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const inactive = () => suspended || document.hidden || opaque();

  function showField(visible) {
    canvas.hidden = !visible;
    water.hidden = visible;
    if (heroWater) heroWater.hidden = visible;
    document.body.dataset.atmosphereRenderer = visible ? 'webgl' : 'fallback';
  }

  function sizeField() {
    const small = coarsePointer.matches || navigator.connection?.saveData;
    const widthCap = software ? 660 : small ? 900 : 1600;
    const heightCap = software ? 500 : small ? 1000 : 1200;
    const scale = Math.min(devicePixelRatio || 1, small ? 1 : 1.25, widthCap / innerWidth, heightCap / innerHeight);
    const width = Math.max(1, Math.round(innerWidth * scale));
    const height = Math.max(1, Math.round(innerHeight * scale));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    edgeDirty = needsPaint = true;
  }

  function schedule() {
    if (!frame && ready && !inactive() && (!reducedMotion.matches || needsPaint)) {
      frame = requestAnimationFrame(draw);
    }
  }

  function draw(now) {
    frame = 0;
    if (!ready || inactive()) return;
    const motion = reducedMotion.matches ? 'still' : 'live';
    if (canvas.dataset.opticalMotion !== motion) {
      needsPaint = true;
      resume();
      return;
    }
    if (reducedMotion.matches && !needsPaint) return;
    const pulseActive = contactId !== null || pulses.some((t, i) => i % 3 === 2 && t >= 0 && elapsed - t < 1.2);
    const interval = software ? 33 : pulseActive ? 16 : 30;
    if (last && now - last < interval && !needsPaint) { schedule(); return; }
    const delta = last ? (now - last) / 1000 : 1/60;
    if (last && !reducedMotion.matches) elapsed += delta;
    last = now;
    if (edgeDirty) {
      heroEdge = hero ? clamp(hero.getBoundingClientRect().bottom / innerHeight, -1, 2) : -1;
      edgeDirty = false;
    }
    for (let i = 2; i < pulses.length; i += 3) if (elapsed - pulses[i] > 2.8) pulses[i] = -1;
    pressure += ((contactId !== null ? 1 : 0) - pressure) * (1 - Math.exp(-delta * 19));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(locations.clock, elapsed);
    gl.uniform1f(locations.aspect, canvas.width / canvas.height);
    gl.uniform1f(locations.heroEdge, heroEdge);
    gl.uniform2fv(locations.pointer, pointer);
    gl.uniform1f(locations.pressure, pressure);
    gl.uniform1f(locations.contactRadius, 74 / innerHeight);
    gl.uniform3fv(locations.pulses, pulses);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (canvas.hidden) showField(true);
    needsPaint = false;
    canvas.dataset.opticalSeconds = elapsed.toFixed(3);
    canvas.dataset.opticalFrames = String(Number(canvas.dataset.opticalFrames || 0) + 1);
    schedule();
  }

  function clearContact() {
    contactId = contactOrigin = null;
    fallbackAnimation?.cancel();
    fallbackLens.removeAttribute('data-held');
  }

  function resume() {
    if (frame) cancelAnimationFrame(frame);
    frame = last = 0;
    if (inactive() || reducedMotion.matches) {
      clearContact();
      pressure = 0;
      for (let i = 2; i < pulses.length; i += 3) pulses[i] = -1;
    }
    if (opaque() && !canvas.hidden) showField(false);
    root.dataset.waterPaused = String(suspended || document.hidden);
    canvas.dataset.opticalMotion = reducedMotion.matches ? 'still' : 'live';
    schedule();
  }

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      throw new Error('Optical shader compilation failed');
    }
    return shader;
  }

  const image = gl && new Image();
  function initialize() {
    try {
      program = gl.createProgram();
      const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision;
      const vs = compile(gl.VERTEX_SHADER, vertex);
      const fs = compile(gl.FRAGMENT_SHADER, precision ? fragment : fragment.replace('highp', 'mediump'));
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Optical shader linking failed');

      gl.useProgram(program);
      locations = Object.fromEntries(
        ['clock','aspect','heroEdge','pointer','pressure','contactRadius','scene','accent','pulses[0]']
          .map(name => [name, gl.getUniformLocation(program, name)]),
      );
      locations.pulses = locations['pulses[0]'];
      gl.uniform3f(locations.scene, profile[0], profile[1], profile[2]);
      gl.uniform3fv(locations.accent, profile[3]);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]), gl.STATIC_DRAW);
      const attribute = gl.getAttribLocation(program, 'a');
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);

      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      gl.uniform1i(gl.getUniformLocation(program, 'field'), 0);
      canvas.dataset.opticalScene = 'webgl';
      canvas.dataset.opticalSamples = String(image.width * image.height);
      ready = true;
      sizeField();
      resume();
    } catch {
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
      ready = false;
      canvas.dataset.opticalScene = 'fallback';
      showField(false);
    }
  }

  if (gl) {
    image.onload = initialize;
    image.onerror = () => { canvas.dataset.opticalScene = 'fallback'; };
    image.src = new URL('OPTICAL_FLOW_ASSET', document.currentScript.src).href;
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      ready = false;
      clearContact();
      canvas.dataset.opticalScene = 'fallback';
      showField(false);
      resume();
    });
    canvas.addEventListener('webglcontextrestored', initialize);
  } else {
    canvas.dataset.opticalScene = 'fallback';
  }

  function position(event) {
    pointer[0] = clamp(event.clientX / innerWidth, 0, 1);
    pointer[1] = clamp(event.clientY / innerHeight, 0, 1);
  }

  function ripple() {
    const offset = (pulseIndex++ % 4) * 3;
    pulses.set([pointer[0], pointer[1], elapsed], offset);
    canvas.dataset.opticalInputs = String(Number(canvas.dataset.opticalInputs || 0) + 1);
    needsPaint = true;
    schedule();
  }

  document.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || inactive() || reducedMotion.matches) return;
    if (event.target.closest?.('a,button,summary,input,select,textarea,video,dialog,[role=dialog],[data-material-surface]')) return;
    position(event);
    clearContact();
    contactId = event.pointerId;
    contactOrigin = [event.clientX, event.clientY];
    lastTrail = event.timeStamp;
    if (canvas.hidden) {
      fallbackLens.style.left = event.clientX + 'px';
      fallbackLens.style.top = event.clientY + 'px';
      fallbackLens.setAttribute('data-held', '');
    } else {
      ripple();
    }
  }, {passive: true});
  document.addEventListener('pointermove', event => {
    if (!event.isPrimary || inactive() || reducedMotion.matches) return;
    if (contactId === null) {
      if (event.pointerType === 'mouse') position(event);
      return;
    }
    if (event.pointerId !== contactId) return;
    const distance = Math.hypot(event.clientX - contactOrigin[0], event.clientY - contactOrigin[1]);
    if ((event.pointerType === 'touch' || canvas.hidden) && distance > 12) {
      clearContact();
      return;
    }
    position(event);
    if (!canvas.hidden && event.timeStamp - lastTrail > 110 && distance > 12) {
      lastTrail = event.timeStamp;
      contactOrigin = [event.clientX, event.clientY];
      ripple();
    }
  }, {passive: true});
  addEventListener('pointerup', event => {
    if (event.pointerId !== contactId) return;
    const fallback = fallbackLens.hasAttribute('data-held');
    position(event);
    clearContact();
    if (!canvas.hidden) {
      ripple();
    } else if (fallback) {
      fallbackAnimation = fallbackLens.animate([
        {opacity: .88, scale: .94},
        {opacity: .46, scale: 1.55, offset: .45},
        {opacity: 0, scale: 2.15},
      ], {duration: 740, easing: 'cubic-bezier(.18,.62,.25,1)'});
    }
  }, {passive: true});
  addEventListener('pointercancel', event => { if (contactId === event.pointerId) clearContact(); }, {passive: true});
  addEventListener('blur', clearContact);
  addEventListener('scroll', () => {
    clearContact();
    if (!hero) return;
    edgeDirty = true;
    if (reducedMotion.matches) needsPaint = true;
    schedule();
  }, {passive: true});
  addEventListener('resize', () => { sizeField(); schedule(); }, {passive: true});
  if (hero && 'ResizeObserver' in window) {
    new ResizeObserver(() => { edgeDirty = needsPaint = true; schedule(); }).observe(hero);
  }
  document.addEventListener('visibilitychange', resume);
  addEventListener('pagehide', event => {
    suspended = true;
    resume();
    if (!event.persisted) gl?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  addEventListener('pageshow', () => { suspended = false; resume(); });
  function refreshPreference() {
    needsPaint = true;
    resume();
  }
  for (const preference of [reducedMotion,reducedTransparency,moreContrast,forcedColors]) {
    preference.onchange = refreshPreference;
  }
  resume();
})();
