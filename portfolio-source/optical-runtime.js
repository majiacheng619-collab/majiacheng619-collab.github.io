/* Live light field. The generated 1,228,800 samples supply height and normals;
 * time, pointer input and game actions change their refraction every frame. */
(() => {
  'use strict';
  if (document.querySelector('[data-optical-scene]')) return;
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
    depth: false, stencil: false, powerPreference: 'low-power'});
  if (!gl) { canvas.remove(); return; } // The authored CSS field stays visible.
  const vertex = 'attribute vec2 a; varying vec2 uv; void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
  const fragment = `precision mediump float;
    varying vec2 uv; uniform sampler2D field; uniform float clock;
    uniform vec2 pointer; uniform vec3 pulse; uniform float aspect;
    void main(){
      vec2 q=vec2(uv.x,1.-uv.y);
      vec2 drift=vec2(sin(clock*.18),cos(clock*.13))*.055;
      vec3 sampleA=texture2D(field,clamp(q*.88+drift+.06,.001,.999)).rgb;
      vec2 normal=(sampleA.gb-.5)*1.7;
      float age=max(0.,clock-pulse.z);
      float radius=length((q-pulse.xy)*vec2(aspect,1.));
      float ripple=sin(radius*30.-age*5.)*exp(-radius*2.8-age*.9)*step(0.,pulse.z);
      vec2 refracted=q+normal*.07+(pointer-.5)*.025+drift*.35+ripple*.015;
      vec3 sampleB=texture2D(field,clamp(refracted,.001,.999)).rgb;
      float lens=pow(max(0.,1.-abs(sampleB.r-.47)*2.1),3.);
      float glint=pow(max(0.,dot(normal,normalize(vec2(.6,-.8)))+.3),2.);
      float wash=.5+.5*sin(refracted.x*4.+refracted.y*3.+clock*.14);
      vec3 sky=vec3(.76,.87,.97),mint=vec3(.72,.90,.85);
      vec3 color=mix(sky,mint,clamp(refracted.y*.7+wash*.25,0.,1.));
      color=mix(color,vec3(.98,.99,1.),.28+lens*.26+glint*.13);
      color+=ripple*.035;
      gl_FragColor=vec4(clamp(color,0.,1.),1.);
    }`;
  function shader(type, text) {
    const result = gl.createShader(type); gl.shaderSource(result, text); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw Error('Optical shader compilation failed');
    return result;
  }
  let program, texture, frame = 0, last = 0, elapsed = 0, ready = false, lost = false;
  const pointer = [.5, .5], pulse = [.5, .5, -1];
  function stopped() { return document.hidden || contrast.matches || transparency.matches || lost; }
  function resize() {
    // This is a low resolution background, independent of the gameplay canvas.
    const scale = Math.min(1, 960 / innerWidth, 720 / innerHeight);
    canvas.width = Math.max(1, Math.round(innerWidth * scale));
    canvas.height = Math.max(1, Math.round(innerHeight * scale));
  }
  function draw(now = 0) {
    frame = 0;
    if (!ready || stopped()) { last = 0; return; }
    if (last && now - last < 48 && !motion.matches) { frame = requestAnimationFrame(draw); return; }
    if (last && !motion.matches) elapsed += Math.min(.1, (now - last) / 1000);
    last = now;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.uniform1f(gl.getUniformLocation(program, 'clock'), elapsed);
    gl.uniform1f(gl.getUniformLocation(program, 'aspect'), canvas.width / canvas.height);
    gl.uniform2fv(gl.getUniformLocation(program, 'pointer'), pointer);
    gl.uniform3fv(gl.getUniformLocation(program, 'pulse'), pulse);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    canvas.dataset.opticalFrames = String(Number(canvas.dataset.opticalFrames || 0) + 1);
    if (!motion.matches) frame = requestAnimationFrame(draw);
  }
  function resume() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; last = 0;
    canvas.dataset.opticalMotion = motion.matches ? 'still' : 'live';
    if (ready && !stopped()) frame = requestAnimationFrame(draw);
  }
  const image = new Image();
  function initialize() {
    try {
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
