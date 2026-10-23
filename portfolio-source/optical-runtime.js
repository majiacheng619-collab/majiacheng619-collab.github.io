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
    depth: false, stencil: false, powerPreference: 'high-performance'});
  if (!gl) { canvas.remove(); return; } // The authored CSS field stays visible.
  const vertex = 'attribute vec2 a; varying vec2 uv; void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
  // Analytic waves animate the sampled surface; highlights follow its normals.
  // Everything lives behind the page, so refraction never distorts readable type.
  const fragment = `precision highp float;
    varying vec2 uv; uniform sampler2D field; uniform float clock;
    uniform vec2 pointer; uniform vec3 pulse; uniform float aspect;
    float ring(vec2 p, vec2 center, float age){
      float d=length(p-center);
      float front=d-age*.19;
      return sin(front*65.)*exp(-front*front*85.)*exp(-age*.85)
        *smoothstep(0.,.16,age);
    }
    float height(vec2 p){
      vec2 bend=p+vec2(sin(p.y*2.8+clock*.32),cos(p.x*2.4-clock*.27))*.24;
      float h=sin(bend.x*7.+bend.y*4.-clock*.7)*.38;
      h+=sin(bend.x*-3.+bend.y*9.+clock*.53)*.24;
      h+=sin(bend.x*13.-bend.y*7.+clock*.41)*.10;
      // Staggered water drops keep the scene alive without requiring input.
      for(int i=0;i<3;i++){
        float id=float(i), cycle=floor((clock+id*2.7)/8.1);
        float age=mod(clock+id*2.7,8.1);
        vec2 center=vec2(.15+fract(sin(cycle*12.7+id*9.2)*437.1)*.7,
                         .12+fract(cos(cycle*7.9+id*4.8)*231.7)*.76);
        h+=ring(p,center*vec2(aspect,1.),age)*.22;
      }
      if(pulse.z>=0.) h+=ring(p,pulse.xy*vec2(aspect,1.),max(0.,clock-pulse.z))*.48;
      return h;
    }
    void main(){
      vec2 q=vec2(uv.x,1.-uv.y), p=q*vec2(aspect,1.);
      p+=(pointer-.5)*.035;
      float h=height(p), e=.003;
      vec2 slope=vec2(height(p+vec2(e,0.))-h,height(p+vec2(0.,e))-h)/e;
      vec2 drift=vec2(sin(clock*.13),cos(clock*.11))*.04;
      vec3 optical=texture2D(field,clamp(q*.88+.06+drift,.001,.999)).rgb;
      // Use the baked normals directly: differentiating 8-bit heights causes bands.
      vec3 normal=normalize(vec3(-slope*.18+(optical.gb-.5)*.32,1.));
      vec2 refracted=q+normal.xy*.10;
      vec3 color=mix(vec3(.66,.84,.94),vec3(.82,.94,.90),smoothstep(.1,.95,refracted.y));
      color=mix(color,vec3(.86,.88,.98),smoothstep(.45,1.,refracted.x)*.32);
      // Narrow dancing caustics make the moving water legible through glass.
      float beam=pow(.5+.5*sin(h*9.+slope.x*.22+slope.y*.18),12.);
      float light=pow(max(dot(normal,normalize(vec3(-.45,-.6,1.))),0.),18.);
      color+=beam*.12+light*.13;
      color-=smoothstep(.1,.9,length(normal.xy))*.035;
      // Slow, lens-shaped beads with a lit rim and a small specular reflection.
      for(int i=0;i<5;i++){
        float id=float(i);
        vec2 center=vec2(.09+fract(id*.618)*.84,.12+fract(id*.381+clock*(.009+id*.0015))*.80);
        center.x+=sin(clock*.23+id*2.)*.025;
        vec2 bead=(p-center*vec2(aspect,1.))/vec2(.037+id*.005,.054+id*.004);
        float d=length(bead), mask=1.-smoothstep(.91,1.04,d);
        float rim=exp(-pow((d-.90)*17.,2.));
        float shine=exp(-dot(bead-vec2(-.30,-.38),bead-vec2(-.30,-.38))*26.);
        color=mix(color,color*.91+vec3(.05,.07,.08),mask*.65);
        color+=rim*.19+shine*.35*mask;
      }
      // Pearl illumination behind the central reading column.
      float pearl=exp(-pow((q.x-.48)*2.,2.))*.14;
      color=mix(color,vec3(.97,.985,1.),pearl);
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
    if (!ready || stopped()) { last = 0; return; }
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
