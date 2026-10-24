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
    vec3 waterColor(vec2 q){
      vec3 c=mix(vec3(.62,.80,.94),vec3(.83,.95,.91),smoothstep(.0,1.,q.y));
      vec2 pool=q-vec2(.75+.14*sin(clock*.3),.3);
      c=mix(c,vec3(.76,.73,.94),exp(-dot(pool,pool)*7.)*.36);
      float flow=sin(q.x*7.+q.y*4.+sin(q.y*5.-clock*.6)-clock*.9);
      return c+flow*.035;
    }
    void main(){
      vec2 q=vec2(uv.x,1.-uv.y), p=q*vec2(aspect,1.)+(pointer-.5)*.05;
      float a=p.x*5.+p.y*3.-clock*.9;
      float b=p.x*-3.+p.y*8.+clock*.65;
      float h=sin(a)*.36+sin(b)*.22;
      vec2 slope=vec2(cos(a)*1.8-cos(b)*.66,cos(a)*1.08+cos(b)*1.76);
      float ripple=0.;
      for(int i=0;i<4;i++){
        if(pulses[i].z>=0.){
        float age=max(0.,clock-pulses[i].z);
        vec2 delta=p-pulses[i].xy*vec2(aspect,1.);
        float radius=length(delta),front=radius-age*.42;
        float wave=sin(front*48.)*exp(-front*front*60.-age*.7)*step(0.,pulses[i].z);
        ripple+=wave;
        slope+=delta/max(radius,.001)*wave*3.2;
        }
      }
      vec2 contact=(q-pointer)*vec2(aspect,1.);
      slope+=contact*exp(-dot(contact,contact)*35.)*pressure*24.;
      vec2 drift=vec2(sin(clock*.24),cos(clock*.21))*.045;
      vec3 optical=texture2D(field,clamp(q*.88+.06+drift,.001,.999)).rgb;
      vec3 normal=normalize(vec3(-slope*.20+(optical.gb-.5)*.2,1.));
      vec2 refracted=q+normal.xy*.16;
      vec3 color=waterColor(refracted);
      float caustic=pow(.5+.5*sin(h*7.+clock*.23),14.);
      float light=pow(max(dot(normal,normalize(vec3(-.45,-.6,1.))),0.),18.);
      color+=caustic*.11+light*.12+ripple*.045;
      // Three curved transparent lenses refract the same underlying water field.
      // Their different sizes and speeds make foreground, water and glass distinct.
      for(int i=0;i<3;i++){
        float id=float(i),r=.085+id*.03;
        vec2 center=vec2(.15+id*.34+sin(clock*(.32-id*.055)+id*3.)*.075,
                         .22+id*.25+cos(clock*.27+id*2.)*.075);
        vec2 local=(q-center)*vec2(aspect,1.)/r;
        float d=length(local),mask=1.-smoothstep(.96,1.015,d);
        float curve=sqrt(max(0.,1.-min(d*d,1.)));
        vec2 bend=local*r*(.42+.25*curve);
        vec3 lens=waterColor(refracted+bend/vec2(aspect,1.));
        lens+=pow(max(0.,dot(normalize(vec3(local*.7,curve)),normalize(vec3(-.5,-.7,1.)))),36.)*.3;
        color=mix(color,lens,mask*.82);
        float edge=exp(-pow((d-.97)*70.,2.));
        color+=edge*.105;
        color-=exp(-pow((d-1.025)*34.,2.))*.06;
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
  let pulseIndex = 0, held = false, pressure = 0, lastTrail = 0;
  function stopped() { return suspended || document.hidden || contrast.matches || transparency.matches || lost; }
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
    gl.uniform1f(gl.getUniformLocation(program, 'clock'), elapsed);
    gl.uniform1f(gl.getUniformLocation(program, 'aspect'), canvas.width / canvas.height);
    gl.uniform2fv(gl.getUniformLocation(program, 'pointer'), pointer);
    pressure += ((held ? 1 : 0) - pressure) * .24;
    gl.uniform1f(gl.getUniformLocation(program, 'pressure'), pressure);
    gl.uniform3fv(gl.getUniformLocation(program, 'pulses[0]'), pulses);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    needsPaint = false;
    canvas.dataset.opticalFrames = String(Number(canvas.dataset.opticalFrames || 0) + 1);
    if (!motion.matches) frame = requestAnimationFrame(draw);
  }
  function resume() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; last = 0;
    document.documentElement.dataset.waterPaused = document.hidden ? 'true' : 'false';
    canvas.dataset.opticalMotion = motion.matches ? 'still' : 'live';
    if (ready && !stopped() && (!motion.matches || needsPaint)) frame = requestAnimationFrame(draw);
  }
  const image = new Image();
  function initialize() {
    try {
      if (program && !lost) { gl.deleteProgram(program); gl.deleteTexture(texture); }
      program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Optical shader linking failed');
      gl.useProgram(program);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
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
      canvas.dataset.opticalScene = 'webgl';
      canvas.dataset.opticalSamples = String(image.width * image.height);
      ready = true; resize(); resume();
    } catch { ready = false; canvas.hidden = true; }
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
  for (const preference of [motion, contrast, transparency]) preference.addEventListener('change', resume);
  document.addEventListener('pointermove', event => {
    if (motion.matches || stopped()) return;
    pointer[0] = event.clientX / innerWidth; pointer[1] = event.clientY / innerHeight;
    if (held && event.timeStamp - lastTrail > 90) { lastTrail = event.timeStamp; ripple(pointer[0], pointer[1]); }
  }, {passive: true});
  function ripple(x, y) {
    if (motion.matches || stopped()) return;
    const offset = (pulseIndex++ % 4) * 3;
    pulses[offset] = x; pulses[offset+1] = y; pulses[offset+2] = elapsed;
    canvas.dataset.opticalInputs = String(Number(canvas.dataset.opticalInputs || 0) + 1);
  }
  document.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer[0] = event.clientX / innerWidth; pointer[1] = event.clientY / innerHeight;
    held = true; ripple(pointer[0], pointer[1]);
  }, {passive: true});
  for (const event of ['pointerup','pointercancel','blur','pagehide']) addEventListener(event, () => { held = false; }, {passive: true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) held = false; });
  addEventListener('gardenoptics', event => ripple(event.detail?.x ?? .5, event.detail?.y ?? .5));
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; resume(); });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; initialize(); });
})();
