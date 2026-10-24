/* Live light field. The generated 1,228,800 samples supply height and normals;
 * time, pointer input and game actions change their refraction every frame. */
(() => {
  'use strict';
  if (document.querySelector('[data-optical-scene]')) return;
  const water = document.createElement('div');
  water.className = 'water-events';
  water.setAttribute('aria-hidden', 'true');
  // Each event has an actual falling lens followed by two expanding surface rings.
  for (const [x, y, delay] of [[16,28,0],[77,52,-1.05],[34,78,-2.1],[87,18,-3.15]]) {
    const event = document.createElement('span');
    event.className = 'water-event';
    event.style.cssText = `--water-x:${x}%;--water-y:${y}%;--water-delay:${delay}s`;
    event.innerHTML = '<i class="water-drop"></i><i class="water-ring"></i><i class="water-ring water-ring-echo"></i>';
    water.append(event);
  }
  (document.querySelector('.ambient-field') || document.body).append(water);
  const source = new URL('OPTICAL_FLOW_ASSET', document.currentScript.src).href;
  const canvas = document.createElement('canvas');
  canvas.className = 'optical-scene';
  canvas.dataset.opticalScene = 'loading';
  canvas.setAttribute('aria-hidden', 'true');
  (document.querySelector('.ambient-field') || document.body).prepend(canvas);
  const gameplay = !!document.querySelector('#garden');
  const arenaOverlay = gameplay ? document.querySelector('#overlay') : null;
  let battleActive = !!arenaOverlay?.hidden;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const contrast = matchMedia('(prefers-contrast: more)');
  const transparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const gl = canvas.getContext('webgl', {alpha: false, antialias: false,
    depth: false, stencil: false, powerPreference: 'high-performance'});
  if (!gl) { canvas.remove(); return; } // The authored CSS field stays visible.
  const rendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const software = !!rendererInfo && /SwiftShader|llvmpipe|software/i.test(gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL));
  const vertex = 'attribute vec2 a; varying vec2 uv; void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
  // Analytic waves animate the sampled surface; highlights follow its normals.
  // Everything lives behind the page, so refraction never distorts readable type.
  const fragment = `precision highp float;
    varying vec2 uv; uniform sampler2D field; uniform float clock;
    uniform vec2 pointer; uniform vec3 pulses[4]; uniform float aspect; uniform float pressure;
    uniform float contactRadius;
    // Champagne, pearl and blue-grey folds: a luminous adaptation of the
    // supplied wallpaper. The floor preserves contrast under transparent type.
    vec3 waterColor(vec2 q){
      float breath=sin(clock*.30)*.055;
      vec3 pearl=vec3(.94,.925,.90);
      vec3 champagne=vec3(.86,.74,.57);
      vec3 blueGrey=vec3(.62,.69,.79);
      vec3 c=mix(pearl,champagne,exp(-length((q-vec2(.12,.13))*vec2(1.1,1.6))*2.4)*.68);
      c=mix(c,blueGrey,smoothstep(.42,1.12,q.y)*.57);
      // Broad S-shaped sheets have an illuminated lip and a graduated shadow.
      // They drift independently; all lenses sample the same moving environment.
      for(int j=0;j<3;j++){
        float id=float(j);
        float curve=.14+id*.34+.20*sin(q.x*3.9+id*.85+clock*.19)
                    -.32*q.x+breath*sin(q.x*3.+id*1.7);
        float distance=q.y-curve;
        float sheet=exp(-pow((distance-.075)/.115,2.));
        float edge=exp(-pow(distance/.006,2.));
        float glow=exp(-pow((distance+.018)/.045,2.));
        c-=sheet*vec3(.105,.098,.084);
        c+=glow*vec3(.065,.061,.055)+edge*vec3(.12,.115,.105);
      }
      vec2 amber=(q-vec2(.17+sin(clock*.21)*.12,.27))*vec2(1.,1.7);
      c+=exp(-dot(amber,amber)*9.)*vec3(.048,.018,-.018);
      return clamp(c,vec3(.69,.70,.72),vec3(.98));
    }
    float surface(vec2 p){
      return sin(p.x*4.8+p.y*3.2-clock*.67)*.46
        +sin(p.x*-2.7+p.y*7.1+clock*.53)*.28
        +sin(p.x*8.2-p.y*2.4+sin(p.y*3.-clock*.31))*.08;
    }
    // A wave packet has a finite front and a trailing wake, rather than a
    // CSS outline expanding independently from the refracted environment.
    vec2 waveSlope(vec2 delta,float age){
      float radius=length(delta),front=radius-age*.36;
      float envelope=exp(-front*front*145.-age*.72)*smoothstep(0.,.12,age);
      // A narrow leading ridge and softer wake catch opposite sides of the light.
      float ridge=cos(front*72.)+cos((front+.035)*48.)*.32;
      return delta/max(radius,.002)*ridge*envelope*3.15;
    }
    void main(){
      vec2 q=vec2(uv.x,1.-uv.y), metric=vec2(aspect,1.);
      vec2 p=q*metric+(pointer-.5)*.028;
      float h=surface(p);
      vec2 slope=vec2(surface(p+vec2(.003,0.))-h,surface(p+vec2(0.,.003))-h)/.003;
      for(int i=0;i<4;i++){
        if(pulses[i].z>=0.){
          float age=max(0.,clock-pulses[i].z);
          slope+=waveSlope((q-pulses[i].xy)*metric,age)*1.45;
        }
      }
      // Automatic droplets share one clock with their impact waves. They land
      // in the same coordinate system; refraction continues into the wake.
      for(int i=0;i<3;i++){
        float id=float(i),age=mod(clock+id*1.83,5.5)-1.05;
        vec2 center=vec2(.17+id*.32,.25+mod(id*.29,.6));
        if(age>=0.) slope+=waveSlope((q-center)*metric,age);
      }
      vec2 contact=(q-pointer)*metric;
      // Keep the fingertip lens a consistent physical size on phones and desktops.
      float contactSize=max(.025,contactRadius);
      vec2 finger=contact/contactSize;
      float fingerDepth=exp(-dot(finger,finger)*1.8)*pressure;
      slope+=finger*fingerDepth*3.8;
      vec2 drift=vec2(sin(clock*.16),cos(clock*.13))*.035;
      vec3 optical=texture2D(field,clamp(q*.88+.06+drift,.001,.999)).rgb;
      vec3 normal=normalize(vec3(-slope*.18+(optical.gb-.5)*.045,1.));
      vec2 refracted=q+normal.xy*.24/metric;
      vec3 color=waterColor(refracted);
      vec3 key=normalize(vec3(-.48,-.62,1.));
      float light=pow(max(dot(normal,key),0.),42.);
      float caustic=pow(.5+.5*sin(h*6.+optical.r*.6),26.);
      color+=light*.19+caustic*.045;
      // Pressure forms a shallow clear dimple with an illuminated meniscus.
      float meniscus=exp(-pow((length(finger)-.84)*9.,2.))*pressure;
      color+=meniscus*.075-fingerDepth*.026;
      // Three shallow, noncircular lenses have thickness, dispersion and a
      // grazing reflection. Their centers remain transparent to the water.
      for(int i=0;i<3;i++){
        float id=float(i),r=.12+id*.045;
        vec2 center=vec2(.14+id*.35+sin(clock*(.23-id*.025)+id*3.)*.065,
                         .20+id*.27+cos(clock*.20+id*2.)*.065);
        vec2 local=(q-center)*metric/vec2(r*1.35,r);
        float angle=atan(local.y,local.x);
        float d=length(local)/(1.+.055*sin(angle*3.+clock*.22+id));
        float mask=1.-smoothstep(.985,1.015,d);
        float curve=sqrt(max(.001,1.-min(d*d,1.)));
        vec2 bend=local*r*(.18+.38*curve)/metric;
        vec3 lens=waterColor(refracted+bend);
        float rim=pow(smoothstep(.63,1.,d),5.);
        lens.r=waterColor(refracted+bend*(1.+rim*.055)).r;
        lens.b=waterColor(refracted+bend*(1.-rim*.055)).b;
        vec3 ln=normalize(vec3(local*.82,curve));
        float highlight=pow(max(dot(ln,key),0.),64.);
        float fresnel=pow(1.-curve,4.);
        lens=mix(lens,vec3(.99,1.,1.),fresnel*.36)+highlight*.34;
        color=mix(color,lens,mask);
        float edge=exp(-pow((d-.994)*145.,2.));
        float direction=dot(normalize(local+vec2(.001)),normalize(vec2(-.5,-.8)));
        color+=edge*(.035+.075*direction);
        color-=exp(-pow((d-1.025)*48.,2.))*.028;
      }
      // A falling bead shrinks into its impact; no decorative overlay covers text.
      for(int i=0;i<3;i++){
        float id=float(i),age=mod(clock+id*1.83,5.5)-1.05;
        if(age<0.){
          float fall=clamp((age+1.05)/1.05,0.,1.);
          vec2 center=vec2(.17+id*.32,.25+mod(id*.29,.6)-.26*(1.-fall*fall));
          vec2 local=(q-center)*metric/vec2(.021,.037-.013*fall);
          float d=length(local),mask=1.-smoothstep(.94,1.04,d);
          vec3 bead=waterColor(q+local*.035/metric);
          bead+=pow(max(dot(normalize(vec3(local,sqrt(max(.001,1.-d*d)))),key),0.),24.)*.4;
          color=mix(color,bead,mask*smoothstep(0.,.22,fall));
        }
      }
      gl_FragColor=vec4(clamp(color,0.,1.),1.);
    }`;
  function shader(type, text) {
    const result = gl.createShader(type);
    if (type === gl.FRAGMENT_SHADER && !gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision) text = text.replace('precision highp float;', 'precision mediump float;');
    gl.shaderSource(result, text); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw Error('Optical shader compilation failed');
    return result;
  }
  let program, texture, frame = 0, last = 0, elapsed = 0, ready = false, lost = false, needsPaint = true, suspended = false;
  const pointer = [.5, .5], pulses = new Float32Array([.5,.5,-1,.5,.5,-1,.5,.5,-1,.5,.5,-1]);
  let pulseIndex = 0, held = false, pressure = 0, lastTrail = 0, contactId = null;
  let buffer = null, locations = null;
  function clearPressure() { held = false; pressure = 0; contactId = null; }
  function clearWaves() { for (let i = 2; i < pulses.length; i += 3) pulses[i] = -1; }
  function position(event) {
    pointer[0] = Math.max(0, Math.min(1, event.clientX / innerWidth));
    pointer[1] = Math.max(0, Math.min(1, event.clientY / innerHeight));
  }
  function stopped() { return suspended || battleActive || document.hidden || contrast.matches || transparency.matches || lost; }
  function resize() {
    // Native GPUs keep the full-resolution field. CPU-only rasterizers get a
    // smaller backing buffer so material never competes with direct manipulation.
    const scale = gameplay
      ? Math.min(.75, 640 / innerWidth, 480 / innerHeight)
      : software ? Math.min(1, 960 / innerWidth, 720 / innerHeight)
      : Math.min(devicePixelRatio || 1, 1.5, 1920 / innerWidth, 1440 / innerHeight);
    needsPaint = true;
    canvas.width = Math.max(1, Math.round(innerWidth * scale));
    canvas.height = Math.max(1, Math.round(innerHeight * scale));
  }
  function draw(now = 0) {
    frame = 0;
    if (!ready || stopped() || (motion.matches && !needsPaint)) { last = 0; return; }
    if (last && now - last < (gameplay ? 50 : software ? 32 : 15) && !motion.matches) { frame = requestAnimationFrame(draw); return; }
    if (last && !motion.matches) elapsed += Math.min(.1, (now - last) / 1000);
    last = now;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.uniform1f(locations.clock, elapsed);
    gl.uniform1f(locations.aspect, canvas.width / canvas.height);
    gl.uniform2fv(locations.pointer, pointer);
    pressure += ((held ? 1 : 0) - pressure) * .24;
    gl.uniform1f(locations.pressure, pressure);
    gl.uniform1f(locations.contactRadius, 72 / innerHeight);
    gl.uniform3fv(locations.pulses, pulses);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    needsPaint = false;
    canvas.dataset.opticalFrames = String(Number(canvas.dataset.opticalFrames || 0) + 1);
    if (!motion.matches) frame = requestAnimationFrame(draw);
  }
  function resume() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; last = 0;
    if (stopped() || motion.matches) { clearPressure(); clearWaves(); }
    document.documentElement.dataset.waterPaused = document.hidden || battleActive ? 'true' : 'false';
    canvas.dataset.opticalMotion = motion.matches ? 'still' : 'live';
    if (ready && !stopped() && (!motion.matches || needsPaint)) frame = requestAnimationFrame(draw);
  }
  if (arenaOverlay) new MutationObserver(() => {
    const next = arenaOverlay.hidden;
    if (next === battleActive) return;
    battleActive = next; resume();
  }).observe(arenaOverlay, {attributes:true, attributeFilter:['hidden']});
  const image = new Image();
  function initialize() {
    try {
      if (program && !lost) { gl.deleteProgram(program); gl.deleteTexture(texture); gl.deleteBuffer(buffer); }
      program = gl.createProgram();
      const vs = shader(gl.VERTEX_SHADER, vertex), fs = shader(gl.FRAGMENT_SHADER, fragment);
      gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Optical shader linking failed');
      gl.useProgram(program);
      locations = Object.fromEntries(['clock','aspect','pointer','pressure','contactRadius'].map(name => [name, gl.getUniformLocation(program, name)]));
      locations.pulses = gl.getUniformLocation(program, 'pulses[0]');
      buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const attribute = gl.getAttribLocation(program, 'a');
      gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
      texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      gl.uniform1i(gl.getUniformLocation(program, 'field'), 0);
      canvas.hidden = false;
      canvas.dataset.opticalScene = 'webgl';
      water.hidden = true; // CSS droplets are only the no-WebGL fallback.
      canvas.dataset.opticalSamples = String(image.width * image.height);
      ready = true; resize(); resume();
    } catch { ready = false; canvas.hidden = true; water.hidden = false; }
  }
  image.onload = initialize;
  image.onerror = () => canvas.remove();
  image.src = source;
  addEventListener('resize', () => { resize(); resume(); }, {passive: true});
  document.addEventListener('visibilitychange', resume);
  addEventListener('pagehide', event => {
    suspended = true; held = false; resume();
    if (!event.persisted) gl.getExtension('WEBGL_lose_context')?.loseContext();
  });
  addEventListener('pageshow', () => { suspended = false; resume(); });
  for (const preference of [motion, contrast, transparency]) preference.addEventListener('change', () => { needsPaint = true; resume(); });
  document.addEventListener('pointermove', event => {
    if (!event.isPrimary || motion.matches || stopped() || (contactId !== null && event.pointerId !== contactId)) return;
    position(event);
    if (held && event.timeStamp - lastTrail > 90) { lastTrail = event.timeStamp; ripple(pointer[0], pointer[1]); }
  }, {passive: true});
  function ripple(x, y) {
    if (motion.matches || stopped()) return;
    const offset = (pulseIndex++ % 4) * 3;
    pulses[offset] = x; pulses[offset+1] = y; pulses[offset+2] = elapsed;
    canvas.dataset.opticalInputs = String(Number(canvas.dataset.opticalInputs || 0) + 1);
  }
  document.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || motion.matches || stopped()) return;
    position(event); contactId = event.pointerId;
    held = true; ripple(pointer[0], pointer[1]);
  }, {passive: true});
  addEventListener('pointerup', event => {
    if (event.pointerId !== contactId) return;
    position(event); held = false; contactId = null;
    ripple(pointer[0], pointer[1]);
  }, {passive: true});
  addEventListener('pointercancel', event => { if (event.pointerId === contactId) clearPressure(); }, {passive: true});
  for (const event of ['blur','pagehide']) addEventListener(event, clearPressure, {passive: true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) held = false; });
  addEventListener('gardenoptics', event => ripple(event.detail?.x ?? .5, event.detail?.y ?? .5));
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; canvas.hidden = true; water.hidden = false; resume(); });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; initialize(); });
})();
