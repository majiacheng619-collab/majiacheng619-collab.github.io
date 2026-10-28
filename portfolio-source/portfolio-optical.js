/* Portfolio-only live atmosphere. The generated 1,228,800 samples supply
 * height and normals to broad pearl planes and direct touch refraction. */
(() => {
  'use strict';
  if (/(?:^|\/)game(?:\/|$)/.test(location.pathname) || document.querySelector('[data-optical-scene]')) return;
  document.body.dataset.atmosphereRenderer = 'fallback';
  const profiles = {
    home: [0, .72, .0, [.76,.86,.99]],
    work: [-.45, .78, 1.8, [.69,.82,.99]],
    experience: [.55, .66, 3.9, [.70,.89,.83]],
    honor: [-.82, .58, 5.7, [.96,.83,.65]],
    contact: [.9, .70, 7.4, [.82,.74,.96]],
  };
  const scene = profiles[document.body.dataset.atmosphere] || profiles.work;
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
  // Put the water in front of the hero's own tinted backdrop as well.
  const heroScene=document.querySelector('.home-page .era-silk');
  if(heroScene){
    const heroWater=water.cloneNode(true);heroWater.className='hero-water';
    [...heroWater.children].forEach((event,index)=>{
      if(index>1){event.remove();return;}
      event.style.setProperty('--water-x',index===0?'73%':'91%');
      event.style.setProperty('--water-y',index===0?'62%':'30%');
    });
    heroScene.append(heroWater);
  }

  const source = new URL('OPTICAL_FLOW_ASSET', document.currentScript.src).href;
  const canvas = document.createElement('canvas');
  canvas.className = 'optical-scene';
  // An opaque WebGL buffer is black before its first draw. Keep the CSS field
  // visible during texture decoding, initialization and context restoration.
  canvas.hidden = true;
  canvas.dataset.opticalScene = 'loading';
  canvas.setAttribute('aria-hidden', 'true');
  (document.querySelector('.ambient-field') || document.body).prepend(canvas);
  const gameplay = !!document.querySelector('#garden');
  const arenaOverlay = gameplay ? document.querySelector('#overlay') : null;
  let battleActive = !!arenaOverlay?.hidden;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const contrast = matchMedia('(prefers-contrast: more)');
  const transparency = matchMedia('(prefers-reduced-transparency: reduce)');
  // One contact lens is shared by blank-space touches, including the CSS fallback.
  // It never owns a gesture or delays navigation; controls have their own material.
  const contact = document.createElement('span');
  contact.className = 'surface-touch';contact.setAttribute('aria-hidden','true');
  (document.querySelector('.ambient-field') || document.body).append(contact);
  let contactPointer=null, contactOrigin=null, contactAnimation=null;
  const clearContact = () => {
    contactPointer=null;contactOrigin=null;contactAnimation?.cancel();
    contact.removeAttribute('data-held');contact.style.opacity='';
  };
  document.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0||contrast.matches||transparency.matches||
       event.target.closest?.('a,button,summary,input,select,textarea,[role=dialog]'))return;
    contactAnimation?.cancel();contactPointer=event.pointerId;
    contactOrigin={x:event.clientX,y:event.clientY};
    contact.style.left=event.clientX+'px';contact.style.top=event.clientY+'px';
    contact.setAttribute('data-held','');
  },{passive:true});
  document.addEventListener('pointermove',event=>{
    if(event.pointerId===contactPointer&&contactOrigin&&Math.hypot(event.clientX-contactOrigin.x,event.clientY-contactOrigin.y)>12)clearContact();
  },{passive:true});
  addEventListener('pointerup',event=>{
    if(event.pointerId!==contactPointer)return;
    contactPointer=null;contactOrigin=null;contact.removeAttribute('data-held');
    if(motion.matches)return;
    contactAnimation=contact.animate([{opacity:.85,scale:1},{opacity:.38,scale:1.65,offset:.45},{opacity:0,scale:2.2}],{duration:850,easing:'cubic-bezier(.18,.62,.25,1)'});
  },{passive:true});
  for(const name of ['pointercancel','blur','pagehide','scroll'])addEventListener(name,clearContact,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearContact();});
  for(const preference of [motion,contrast,transparency])preference.addEventListener('change',clearContact);
  const gl = canvas.getContext('webgl', {alpha: false, antialias: false,
    depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'default'});
  if (!gl) { canvas.remove(); return; } // The authored CSS field stays visible.
  const rendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const software = !!rendererInfo && /SwiftShader|llvmpipe|software/i.test(gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL));
  const vertex = 'attribute vec2 a; varying vec2 uv; void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
  // Broad pearl planes and finite refractive waves belong to the portfolio.
  // The game continues loading its unchanged optical-runtime.js separately.
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

    // Visible silk-like currents: the broad moving folds supply the contrast
    // that lets a refracted ripple read through an otherwise clear surface.
    vec3 environment(vec2 q){
      float t=clock*scene.y+scene.z;
      float c=cos(scene.x),s=sin(scene.x);
      vec2 p=mat2(c,-s,s,c)*(q-.5)+.5;
      vec3 pearl=vec3(.972,.984,.998);
      vec3 color=mix(pearl,accent,smoothstep(-.10,1.30,p.y)*.42);
      // A broad moving lens with a defined caustic edge gives clear glass
      // something to refract. The palette stays light enough for reading.
      float fold=p.y-(.36+.23*sin(p.x*3.4+t)+.11*cos(t*.68));
      color=mix(color,accent,exp(-pow((fold-.07)/.16,2.))*.42);
      color+=exp(-pow((fold+.035)/.026,2.))*.075;
      color-=exp(-pow((fold-.105)/.055,2.))*.035;
      float returnFold=p.y-(.88-.30*p.x+.19*sin(p.x*4.-t*.78));
      color=mix(color,accent,exp(-pow((returnFold-.035)/.14,2.))*.30);
      color+=exp(-pow((returnFold+.05)/.032,2.))*.065;
      return clamp(color,vec3(.77),vec3(.997));
    }
    float surface(vec2 p){
      return sin(p.y*4.2+p.x*1.4-clock*.85)*.36
           +sin(p.x*3.4-p.y*1.7+clock*.61)*.19;
    }
    vec3 packet(vec2 delta,float age){
      float radius=length(delta),front=radius-age*.34;
      float envelope=exp(-front*front*155.-age*.72)*smoothstep(0.,.10,age);
      float ridge=sin(front*48.);
      vec2 normal=delta/max(radius,.002)*ridge*envelope;
      return vec3(normal*2.5,cos(front*48.)*envelope);
    }
    void main(){
      vec2 q=vec2(uv.x,1.-uv.y),metric=vec2(aspect,1.);
      vec2 p=q*metric+(pointer-.5)*.012;
      float height=surface(p);
      vec2 slope=vec2(surface(p+vec2(.006,0.))-height,
                      surface(p+vec2(0.,.006))-height)/.006;
      float sheen=0.;
      for(int i=0;i<4;i++){
        if(pulses[i].z>=0.){
          vec3 ripple=packet((q-pulses[i].xy)*metric,max(0.,clock-pulses[i].z));
          slope+=ripple.xy*5.2;
          sheen+=ripple.z*.065;
        }
      }
      // A sparse falling bead and its wake share one clock and one impact point.
      // The wake bends the same planes; it is never an independent bright ring.
      for(int i=0;i<3;i++){
        float id=float(i),age=mod(clock+id*1.8,5.4)-.9;
        vec2 center=vec2(.18+id*.32,.30+mod(id*.35,.50));
        if(age>=0.){
          vec3 ripple=packet((q-center)*metric,age);
          slope+=ripple.xy*1.7;
          sheen+=ripple.z*.027;
        }
      }
      vec2 finger=(q-pointer)*metric/max(.025,contactRadius);
      float dimple=exp(-dot(finger,finger)*2.1)*pressure;
      slope+=finger*dimple*5.0;
      vec2 drift=vec2(sin(clock*.09),cos(clock*.075))*.018;
      vec3 sampled=texture2D(field,clamp(q*.84+.08+drift,.001,.999)).rgb;
      vec2 normal=-slope*.19+(sampled.gb-.5)*.020;
      vec2 refracted=q+normal*.20/metric;
      vec3 color=environment(refracted);
      // A broad specular response reads as depth without hard neon-like ridges.
      float softLight=pow(max(dot(normalize(vec3(normal,1.)),normalize(vec3(-.25,-.35,1.))),0.),12.);
      color+=softLight*.018+sheen+sampled.r*.0015;
      color-=dimple*.042;
      color+=exp(-pow((length(finger)-.85)*7.,2.))*pressure*.060;
      for(int i=0;i<3;i++){
        float id=float(i),age=mod(clock+id*1.8,5.4)-.9;
        if(age<0.){
          float fall=clamp((age+.9)/.9,0.,1.);
          vec2 center=vec2(.18+id*.32,.30+mod(id*.35,.50)-.22*(1.-fall*fall));
          vec2 local=(q-center)*metric/vec2(.018,.028-.010*fall);
          float distance=length(local),mask=1.-smoothstep(.90,1.06,distance);
          float curve=sqrt(max(.001,1.-min(distance*distance,1.)));
          vec3 bead=environment(q+local*.035/metric);
          float reflection=pow(max(dot(normalize(vec3(local,curve)),normalize(vec3(-.45,-.7,1.))),0.),30.);
          bead+=reflection*.26;
          bead-=smoothstep(.60,1.,distance)*.035;
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
      : software ? Math.min(1, 640 / innerWidth, 480 / innerHeight)
      : matchMedia('(pointer: coarse)').matches || navigator.connection?.saveData
        ? Math.min(devicePixelRatio || 1, 1.25, 1152 / innerWidth, 1152 / innerHeight)
        : Math.min(devicePixelRatio || 1, 1.5, 1920 / innerWidth, 1440 / innerHeight);
    needsPaint = true;
    canvas.width = Math.max(1, Math.round(innerWidth * scale));
    canvas.height = Math.max(1, Math.round(innerHeight * scale));
  }
  function draw(now = 0) {
    frame = 0;
    if (!ready || stopped() || (motion.matches && !needsPaint)) { last = 0; return; }
    if (last && now - last < (held ? 15 : 32) && !motion.matches && !needsPaint) { frame = requestAnimationFrame(draw); return; }
    // Analytic waves follow wall time even on a busy or low-refresh device.
    // resume() resets last, so hidden time never causes a catch-up jump.
    const delta = last ? Math.max(0, (now-last)/1000) : 1/60;
    if (last && !motion.matches) elapsed += delta;
    last = now;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.uniform1f(locations.clock, elapsed);
    gl.uniform1f(locations.aspect, canvas.width / canvas.height);
    gl.uniform3f(locations.scene, scene[0], scene[1], scene[2]);
    gl.uniform3fv(locations.accent, scene[3]);
    gl.uniform2fv(locations.pointer, pointer);
    pressure += ((held ? 1 : 0) - pressure) * (1-Math.exp(-delta*18));
    gl.uniform1f(locations.pressure, pressure);
    gl.uniform1f(locations.contactRadius, 72 / innerHeight);
    gl.uniform3fv(locations.pulses, pulses);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    canvas.hidden = false;
    document.body.dataset.atmosphereRenderer = 'webgl';
    water.hidden = true;
    needsPaint = false;
    canvas.dataset.opticalSeconds = elapsed.toFixed(3);
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
      locations = Object.fromEntries(['clock','aspect','pointer','pressure','contactRadius','scene','accent'].map(name => [name, gl.getUniformLocation(program, name)]));
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
      canvas.dataset.opticalScene = 'webgl';
      canvas.dataset.opticalMaterial = 'responsive-current-v29';
      canvas.dataset.opticalSamples = String(image.width * image.height);
      ready = true; resize(); resume();
    } catch { ready = false; canvas.hidden = true; water.hidden = false; document.body.dataset.atmosphereRenderer = 'fallback'; }
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
    if(event.target.closest?.('a,button,summary,input,select,textarea,[role=dialog]'))return;
    position(event); contactId = event.pointerId;needsPaint=true;
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
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; canvas.hidden = true; water.hidden = false; document.body.dataset.atmosphereRenderer = 'fallback'; resume(); });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; initialize(); });
})();
