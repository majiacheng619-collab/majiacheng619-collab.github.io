/* Live light field. The generated 1,228,800 samples supply height and normals;
 * time, pointer input and game actions change their refraction every frame. */
(() => {
  'use strict';
  if (document.querySelector('[data-optical-scene]')) return;
  const water = document.createElement('div');
  water.className = 'water-events';
  water.setAttribute('aria-hidden', 'true');
  // Each event has an actual falling lens followed by two expanding surface rings.
  for (const [x, y, delay] of [[16,28,0],[77,52,-1.3],[34,78,-2.6],[87,18,-3.9]]) {
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
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const contrast = matchMedia('(prefers-contrast: more)');
  const transparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const gl = canvas.getContext('webgl', {alpha: false, antialias: false,
    depth: false, stencil: false, powerPreference: 'high-performance'});
  if (!gl) { canvas.remove(); return; } // The authored CSS field stays visible.
  const vertex = 'attribute vec2 a; varying vec2 uv; void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
  // Analytic waves animate the sampled surface; highlights follow its normals.
  // Everything lives behind the page, so refraction never distorts readable type.
  const fragment = `precision highp float;
    varying vec2 uv; uniform sampler2D field; uniform float clock;
    uniform vec2 pointer; uniform vec3 pulse; uniform float aspect;
    void main(){
      vec2 q=vec2(uv.x,1.-uv.y), p=q*vec2(aspect,1.)+(pointer-.5)*.025;
      float a=p.x*5.+p.y*3.-clock*.6;
      float b=p.x*-3.+p.y*8.+clock*.43;
      float h=sin(a)*.36+sin(b)*.22;
      // Analytic gradients avoid repeated height evaluation and quantization bands.
      vec2 slope=vec2(cos(a)*1.8-cos(b)*.66,cos(a)*1.08+cos(b)*1.76);
      float age=max(0.,clock-pulse.z);
      vec2 delta=p-pulse.xy*vec2(aspect,1.);
      float radius=length(delta),front=radius-age*.28;
      float ripple=sin(front*44.)*exp(-front*front*40.-age*.9)*step(0.,pulse.z);
      slope+=delta/max(radius,.001)*ripple*2.;
      vec2 drift=vec2(sin(clock*.16),cos(clock*.13))*.04;
      vec3 optical=texture2D(field,clamp(q*.88+.06+drift,.001,.999)).rgb;
      vec3 normal=normalize(vec3(-slope*.16+(optical.gb-.5)*.18,1.));
      vec2 refracted=q+normal.xy*.12;
      vec3 color=mix(vec3(.74,.86,.94),vec3(.83,.94,.91),smoothstep(.1,.95,refracted.y));
      color=mix(color,vec3(.87,.87,.97),smoothstep(.35,1.,refracted.x)*.3);
      float caustic=pow(.5+.5*sin(h*7.+clock*.16),16.);
      float light=pow(max(dot(normal,normalize(vec3(-.45,-.6,1.))),0.),15.);
      color+=caustic*.075+light*.11+ripple*.035;
      gl_FragColor=vec4(clamp(color,0.,1.),1.);
    }`;
  function shader(type, text) {
    const result = gl.createShader(type);
    if (type === gl.FRAGMENT_SHADER && !gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision) text = text.replace('precision highp float;', 'precision mediump float;');
    gl.shaderSource(result, text); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw Error('Optical shader compilation failed');
    return result;
  }
  let program, texture, frame = 0, last = 0, elapsed = 0, ready = false, lost = false, needsPaint = true;
  const pointer = [.5, .5], pulse = [.5, .5, -1];
  function stopped() { return document.hidden || contrast.matches || transparency.matches || lost; }
  function resize() {
    // Crisp on phones and tablets; bound the full-screen fragment workload.
    const scale = Math.min(devicePixelRatio || 1, 1.5, 1920 / innerWidth, 1440 / innerHeight);
    needsPaint = true;
    canvas.width = Math.max(1, Math.round(innerWidth * scale));
    canvas.height = Math.max(1, Math.round(innerHeight * scale));
  }
  function draw(now = 0) {
    frame = 0;
    if (!ready || stopped() || (motion.matches && !needsPaint)) { last = 0; return; }
    if (last && now - last < 15 && !motion.matches) { frame = requestAnimationFrame(draw); return; }
    if (last && !motion.matches) elapsed += Math.min(.1, (now - last) / 1000);
    last = now;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.uniform1f(gl.getUniformLocation(program, 'clock'), elapsed);
    gl.uniform1f(gl.getUniformLocation(program, 'aspect'), canvas.width / canvas.height);
    gl.uniform2fv(gl.getUniformLocation(program, 'pointer'), pointer);
    gl.uniform3fv(gl.getUniformLocation(program, 'pulse'), pulse);
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
  for (const preference of [motion, contrast, transparency]) preference.addEventListener('change', resume);
  document.addEventListener('pointermove', event => {
    if (motion.matches || stopped()) return;
    pointer[0] = event.clientX / innerWidth; pointer[1] = event.clientY / innerHeight;
  }, {passive: true});
  function ripple(x, y) {
    if (motion.matches || stopped()) return;
    pulse[0] = x; pulse[1] = y; pulse[2] = elapsed;
    canvas.dataset.opticalInputs = String(Number(canvas.dataset.opticalInputs || 0) + 1);
  }
  document.addEventListener('pointerdown', event => ripple(event.clientX / innerWidth, event.clientY / innerHeight), {passive: true});
  addEventListener('gardenoptics', event => ripple(event.detail?.x ?? .5, event.detail?.y ?? .5));
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; resume(); });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; initialize(); });
})();
