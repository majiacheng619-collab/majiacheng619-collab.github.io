import * as THREE from './three.module.min.js';

export function randomSeed(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const noise = /* glsl */`
float hash(vec3 p) {
  p = fract(p * .3183099 + vec3(.137, .719, .421));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  return .57 * noise3(p) + .28 * noise3(2.04 * p + 19.4) + .15 * noise3(4.11 * p - 8.2);
}
vec3 mist(vec3 from, vec3 to, vec3 color) {
  float delta = (max(to.y, 0.0) - max(from.y, 0.0)) * 0.035;
  float integral = abs(delta) < .001 ? 1.0 : (1.0 - exp(-delta)) / delta;
  float density = exp(-max(from.y, 0.0) * .035) * integral;
  float breakup = .8 + .35 * noise3(to * vec3(.012, .023, .007));
  float veil = 1.0 - exp(-distance(from, to) * .0022 * density * breakup);
  return mix(color, vec3(.065, .119, .184), min(veil, .62));
}
`;

const atmosphere = /* glsl */`
vec3 curtain(float az, float alt, float t, float seed, float altitude, vec3 tint) {
  float phase = az * 3.2 + seed + t * .10;
  float foot = altitude + .063 * sin(phase) + .034 * sin(phase * 2.07)
             + .014 * sin(phase * 4.12 + sin(az * 8.5));
  float y = alt - foot;
  float fold = az * 57.0 + 2.8 * sin(az * 12.0 + seed) + y * 7.0 - t * .40;
  float fibres = mix(.23, 1.0, noise3(vec3(fold, y * 5.0, seed)));
  fibres *= .63 + .37 * noise3(vec3(az * 164.0 + y * 12.0, seed, t * .14));
  float breaks = smoothstep(.11, .66, noise3(vec3(az * 4.0 + seed, t * .07, 1.0)));
  float veil = smoothstep(-.018, .016, y) * exp(-max(y, 0.0) * 12.0);
  float core = exp(-abs(y + .001) * 91.0) * .29;
  return mix(tint, vec3(.052, .19, .62), smoothstep(.025, .30, y) * .88)
         * (veil + core) * fibres * breaks;
}
vec3 skyColor(vec3 direction, float t) {
  vec3 d = normalize(direction);
  float up = max(d.y, 0.0);
  float az = atan(d.x, -d.z), alt = asin(clamp(d.y, -.999, .999));
  vec3 sky = mix(vec3(.045, .084, .143), vec3(.0035, .009, .029), 1.0 - exp(-up * 7.0));
  vec3 moon = normalize(vec3(-.59, .28, -.81));
  sky += vec3(.067, .072, .106) * pow(max(dot(d, moon), 0.0), 7.0);
  float crescent = distance(d, moon);
  sky += vec3(.10, .18, .39) * exp(-crescent * 34.0);
  float moonGrain = .56 + .42 * fbm((d - moon) * 449.0 + 12.0);
  sky += vec3(.93, 1.05, 1.28) * moonGrain * (1.0 - smoothstep(.0108, .0126, crescent));
  vec3 p = d * 281.0;
  vec3 cell = floor(p);
  float star = hash(cell);
  float sparkle = exp(-dot(fract(p) - .5, fract(p) - .5) * 59.0);
  sky += vec3(.56, .71, .94) * sparkle * smoothstep(.955, .999, star) * smoothstep(.015, .28, up);
  sky += vec3(.122, .73, .43) * 0.085 * exp(-pow((alt - .32) * 4.7, 2.0));
  sky += curtain(az, alt, t, .7, .253, vec3(.026, .79, .37)) * 1.15;
  sky += curtain(az, alt, t, 4.7, .382, vec3(.035, .37, .68)) * .80;
  sky += curtain(az, alt, t, 8.4, .174, vec3(.043, .52, .30)) * .48;
  float cloud = fbm(vec3(az * 5.0 + .013 * t, alt * 26.0, 4.2));
  cloud = smoothstep(.41, .74, cloud) * exp(-pow((alt - .11) * 7.1, 2.0));
  return mix(sky, vec3(.038, .071, .131), .75 * cloud);
}
`;

export function makeSky(time) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: time },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec3 vDirection;
      ${noise}
      ${atmosphere}
      void main() {
        gl_FragColor = vec4(skyColor(vDirection, uTime), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3500, 36, 20), material);
  sky.frustumCulled = false;
  sky.renderOrder = 8;
  return sky;
}

function iceMaterial(time) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .63, metalness: .05, emissive: 0xffffff });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `varying vec3 vTerrain;\n${shader.vertexShader}`.replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvTerrain = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    );
    shader.fragmentShader = `uniform float uTime; varying vec3 vTerrain;\n${noise}\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', /* glsl */`
      #include <normal_fragment_begin>
      vec3 p = vTerrain;
      vec3 face = inverseTransformDirection(normal, viewMatrix);
      float large = fbm(p * .055);
      float tall = noise3(p * vec3(.52, .047, .56) + large * 1.37);
      float chipped = noise3(p * .86 + tall * .54);
      float grain = noise3(p * 2.1);
      float bed = p.y * .19 + p.x * .039 + p.z * .088 + large * 2.75;
      float lines = max(.05, fwidth(bed));
      float laminate = 1.0 - smoothstep(.035, min(.45, .12 + lines), abs(fract(bed) - .5));
      float split = 1.0 - smoothstep(.022, .12, abs(tall - .50));
      float cracks = split * smoothstep(.45, .71, large);
      float summit = smoothstep(-2.0, 53.0, p.y);
      float snow = smoothstep(.19, .76, face.y + (large - .55) * .64 + summit * .12);
      vec3 blue = mix(vec3(.037,.089,.162), vec3(.12,.257,.389), smoothstep(.18,.79,large));
      blue = mix(blue, vec3(.040,.213,.301), smoothstep(.58,.88,tall) * .67);
      blue *= (1.0 - .36 * cracks) * (.81 + .24 * chipped + .057 * laminate);
      vec3 snowTint = mix(vec3(.31,.446,.60), vec3(.57,.71,.83), grain);
      diffuseColor.rgb *= mix(blue, snowTint, snow);
      float relief = .37 * tall + .27 * chipped + .039 * laminate + .072 * grain;
      vec3 viewX = dFdx(-vViewPosition), viewY = dFdy(-vViewPosition);
      vec3 r1 = cross(viewY, normal), r2 = cross(normal, viewX);
      float determinant = dot(viewX, r1);
      normal = normalize(abs(determinant) * normal - .86 * sign(determinant)
                        * (dFdx(relief) * r1 + dFdy(relief) * r2));
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', /* glsl */`
      #include <emissivemap_fragment>
      float scattered = (1.0 - snow) * smoothstep(.28, .79, large) * (1.0 - .6 * cracks);
      float wetBase = exp(-abs(vTerrain.y - 1.0) * .076);
      float pulse = .79 + .21 * sin(uTime * .33 + vTerrain.x * .009);
      totalEmissiveRadiance *= vec3(.010, .052, .098) * scattered * (.62 + .38 * pulse)
                               + vec3(.002, .022, .036) * wetBase;
    `);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      'outgoingLight = mist(cameraPosition, vTerrain, outgoingLight);\n#include <opaque_fragment>',
    );
  };
  return material;
}

function indexedSurface(positions, indices) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function ridge(angle, scale, seed) {
  return Math.sin(angle * 3 - seed) * .32 + Math.sin(angle * 7 + seed * .72) * .23
    + Math.cos(angle * 13 + scale * 3 + seed) * .13 + Math.sin(angle * 27 - scale * 7) * .075;
}

function glacier(ice, { x, z, width, depth, height, seed, slope = .4 }) {
  const positions = [], indices = [];
  const sides = 106, layers = 29;
  const offset = seed * 1.68;
  for (let row = 0; row <= layers; row++) {
    const v = row / layers;
    const contour = v < .69 ? 1 - v * slope - .04 * Math.sin(v * 23)
      : (1 - .69 * slope) * Math.pow((1 - v) / .31, .71);
    for (let column = 0; column < sides; column++) {
      const a = column / sides * Math.PI * 2;
      const r = ridge(a + v * .19, v, offset);
      const radius = Math.max(.001, contour) * (1 + r * .55 + .054 * Math.sin(a * 31 + v * 9 + seed));
      const edge = Math.sin(a + offset) * .14 + Math.sin(a * 3.0 - offset) * .080;
      const fall = (ridge(a + .9, v, offset + 6) * .13 + edge) * Math.sin(v * Math.PI * .90);
      positions.push(
        x + width * (Math.cos(a) * radius + v * .27 * Math.cos(offset)),
        -4 + height * (v + fall),
        z + depth * (Math.sin(a) * radius + v * .33 * Math.sin(offset)),
      );
      if (row === layers) continue;
      const j = row * sides + column;
      const k = row * sides + (column + 1) % sides;
      indices.push(j, j + sides, k, k, j + sides, k + sides);
    }
  }
  const mesh = new THREE.Mesh(indexedSurface(positions, indices), ice);
  mesh.receiveShadow = true;
  return mesh;
}

function iceArch(ice) {
  const positions = [], indices = [];
  const rings = 111, sides = 56;
  for (let row = 0; row <= rings; row++) {
    const angle = Math.PI * row / rings;
    const centralX = 3 + 124 * Math.cos(angle) + 12 * Math.sin(angle * 2.0);
    const centralY = -16 + 150 * Math.pow(Math.sin(angle), .84);
    const centralZ = -318 + 25 * Math.sin(angle * 2.2);
    const shaft = 22 + 16 * (1.0 - Math.sin(angle)) + 6 * Math.sin(angle * 3 - .6);
    const normalAngle = Math.atan2(150 * Math.cos(angle), 124 * Math.sin(angle));
    for (let point = 0; point < sides; point++) {
      const a = point * Math.PI * 2 / sides;
      const gouge = 1 + .19 * Math.sin(a * 4 - angle * 13) + .105 * Math.sin(a * 11 + angle * 19)
        + .07 * Math.sin(a * 23 - angle * 32) + .09 * Math.sin(angle * 29 + a);
      positions.push(
        centralX + Math.cos(a) * shaft * gouge * Math.sin(normalAngle),
        centralY + Math.cos(a) * shaft * gouge * Math.cos(normalAngle) * 1.18,
        centralZ + Math.sin(a) * shaft * gouge * 1.91 + Math.sin(angle * 17 + a) * 2.1,
      );
      if (row === rings) continue;
      const j = row * sides + point, k = row * sides + (point + 1) % sides;
      indices.push(j, j + sides, k, k, j + sides, k + sides);
    }
  }
  const geometry = indexedSurface(positions, indices);
  const mesh = new THREE.Mesh(geometry, ice);
  mesh.receiveShadow = true;
  return mesh;
}

function mountainRidge(ice, cx, cz, width, depth, height, seed) {
  const positions = [], indices = [];
  const across = 171, rows = 30;
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    for (let column = 0; column <= across; column++) {
      const u = column / across;
      const phase = u * 21.4 + seed;
      const center = .49 + .10 * Math.sin(phase * .73) + .06 * Math.sin(phase * 2.1);
      const ridgeline = .46 + .24 * Math.sin(phase) + .17 * Math.sin(phase * 1.7 + .6)
        + .105 * Math.cos(phase * 3.83) + .065 * Math.sin(phase * 10.37);
      const rise = Math.max(0, 1 - Math.abs(v - center) * 2.09);
      const envelope = Math.pow(Math.sin(u * Math.PI), .50);
      const ravine = .87 + .1 * Math.cos(phase * 10.34 - v * 16) + .05 * Math.sin(phase * 31 + v * 21);
      positions.push(cx + (u - .5) * width, -5 + height * Math.pow(rise, .90) * envelope * ridgeline * ravine,
        cz + (v - .5) * depth);
      if (column === across || row === rows) continue;
      const j = row * (across + 1) + column;
      indices.push(j, j + across + 1, j + 1, j + 1, j + across + 1, j + across + 2);
    }
  }
  return new THREE.Mesh(indexedSurface(positions, indices), ice);
}

function floeSurface(seed) {
  const random = randomSeed(seed);
  const corners = 13;
  const edge = Array.from({ length: corners }, (_, i) => {
    const angle = (i + .38 * (random() - .5)) * Math.PI * 2 / corners;
    const radius = .72 + .40 * random();
    return [Math.cos(angle) * radius, Math.sin(angle) * radius, random() - .5];
  });
  const rings = [
    [.22, .65, 0xc4dce5], [.64, .63, 0xcde6eb], [.87, .58, 0xb5d4df],
    [1, .23, 0x76b4c6], [.88, -.35, 0x508da7], [.58, -.73, 0x356982],
  ];
  const positions = [], colors = [], indices = [];
  const color = new THREE.Color();
  for (const [ring, [radius, height, tint]] of rings.entries()) {
    for (const [i, [x, z, roughness]] of edge.entries()) {
      positions.push(x * radius, height + roughness * (.14 + .28 * radius), z * radius);
      color.setHex(tint).multiplyScalar(.87 + .23 * random());
      colors.push(color.r, color.g, color.b);
      if (ring === rings.length - 1) continue;
      const a = ring * corners + i, b = ring * corners + (i + 1) % corners;
      indices.push(a, b, a + corners, b, b + corners, a + corners);
    }
  }
  const top = positions.length / 3, bottom = top + 1;
  positions.push(0, .67, 0, 0, -.76, 0);
  color.setHex(0xc4dce5);
  colors.push(color.r, color.g, color.b);
  color.setHex(0x356982);
  colors.push(color.r, color.g, color.b);
  const last = (rings.length - 1) * corners;
  for (let i = 0; i < corners; i++) {
    const next = (i + 1) % corners;
    indices.push(top, next, i, last + i, last + next, bottom);
  }
  const surface = indexedSurface(positions, indices);
  surface.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return surface;
}

export function makeIce(scene, time) {
  const ice = iceMaterial(time);
  scene.add(mountainRidge(ice, 20, -1490, 2270, 590, 341, 5.2));
  scene.add(mountainRidge(ice, -691, -950, 1280, 390, 272, 18.9));
  scene.add(mountainRidge(ice, 775, -866, 1060, 330, 225, 1.4));
  const forms = [
    [-273,  80, 122, 118, 158, 19], [-202, -115, 102, 110, 167, 16],
    [-225, -231, 132, 123, 229, 42], [-349, -319, 132, 157, 262, 51],
    [ 256, -77, 105, 100, 124, 81], [ 216, -224, 90, 102, 150, 36],
    [ 243, -392, 130, 131, 246, 27], [ 128, -375, 62, 68, 87, 25],
    [-133, -360, 59, 69, 93, 43], [-174, -465, 128, 91, 197, 82],
    [ 310, -458, 112, 141, 224, 33], [-336, -87, 85, 119, 113, 76],
    [-85, -230, 24, 27, 32, 60], [90, -279, 25, 21, 34, 62],
    [ 145, -115, 25, 30, 29, 56], [-113, 16, 24, 34, 23, 74],
    [-61, -177, 13, 21, 12, 39], [120, -16, 17, 26, 12, 52],
  ];
  for (const [x, z, width, depth, height, seed] of forms) {
    scene.add(glacier(ice, { x, z, width, depth, height, seed }));
  }
  scene.add(iceArch(ice));

  const random = randomSeed(79231);
  const floeIce = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .67, flatShading: true });
  const packs = [31, 80, 141].map((seed, i) => new THREE.InstancedMesh(floeSurface(seed), floeIce, i === 2 ? 42 : 43));
  const piece = new THREE.Object3D();
  const shades = [0xc6dce5, 0xe0ebef, 0xbedcdd, 0xf1f0ef, 0xc1d9e4].map(value => new THREE.Color(value));
  for (let i = 0; i < 128; i++) {
    const pack = packs[i % packs.length];
    const index = Math.floor(i / packs.length);
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (45 + Math.pow(random(), 1.75) * 154);
    const z = 225 - random() * 760;
    const scale = .34 + Math.pow(random(), 3) * 4.8;
    piece.position.set(x, -.10 + scale * .03, z);
    piece.scale.set(scale * (1.0 + random()), .14 + scale * .21, scale * (.62 + random() * .7));
    piece.rotation.set(random() * .20, random() * Math.PI, random() * .14);
    piece.updateMatrix();
    pack.setMatrixAt(index, piece.matrix);
    pack.setColorAt(index, shades[i % shades.length]);
  }
  scene.add(...packs);
}

const swell = /* glsl */`
vec3 waves(vec2 p, float t) {
  float a = dot(p, vec2(.52, .85)) * .29 + t * 1.66;
  float b = dot(p, vec2(-.89, .45)) * .48 + t * 2.04;
  float c = dot(p, vec2(.21, -.98)) * .82 + t * 2.85;
  float h = .46 * sin(a) + .22 * sin(b) + .091 * sin(c);
  vec2 gradient = .1334 * cos(a) * vec2(.52,.85) + .1056 * cos(b) * vec2(-.89,.45)
                + .0746 * cos(c) * vec2(.21,-.98);
  return vec3(h, gradient);
}
vec2 disturbance(float radius, float age) {
  if (age <= 0.0 || age >= 5.8) return vec2(0.0);
  float front = radius - (1.9 + age * 8.2);
  float width = sqrt(front * front + .42);
  float angle = front * 1.74 + 1.57;
  float pulse = smoothstep(0.0, .21, age) * (1.0 - smoothstep(4.3, 5.8, age));
  float amplitude = pulse * exp(-width * .30 - age * .46);
  return amplitude * vec2(sin(angle), 1.74 * cos(angle) - .30 * front / width * sin(angle));
}
`;

export function oceanHeight(x, z, time) {
  return .46 * Math.sin((x * .52 + z * .85) * .29 + time * 1.66)
    + .22 * Math.sin((x * -.89 + z * .45) * .48 + time * 2.04)
    + .091 * Math.sin((x * .21 + z * -.98) * .82 + time * 2.85);
}

function seaGrid() {
  const coords = [0];
  for (let i = 1; i < 83; i++) coords.push(i * 2.55 + Math.pow(Math.max(0, (i - 44) / 38), 5) * 2590);
  const axes = coords.slice(1).reverse().map((value) => -value).concat(coords);
  const positions = [], indices = [];
  for (let z = 0; z < axes.length; z++) {
    for (let x = 0; x < axes.length; x++) {
      positions.push(axes[x], 0, axes[z]);
      if (x === axes.length - 1 || z === axes.length - 1) continue;
      const j = z * axes.length + x;
      indices.push(j, j + axes.length, j + 1, j + 1, j + axes.length, j + axes.length + 1);
    }
  }
  return indexedSurface(positions, indices);
}

export function makeSea(time, reflection) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: time,
      uReflection: { value: reflection.texture },
      uReflectionProjection: { value: new THREE.Matrix4() },
      uShip: { value: new THREE.Vector3() },
      uBreach: { value: new THREE.Vector3() },
      uLanding: { value: new THREE.Vector3() },
      uMoon: { value: new THREE.Vector3(-.59,.28,-.81).normalize() },
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uBreach, uLanding;
      varying vec3 vSea;
      ${swell}
      void main() {
        vSea = position;
        vSea.y = waves(position.xz, uTime).x
          + .22 * disturbance(length(position.xz - uBreach.xy), uTime - uBreach.z).x
          + .64 * disturbance(length(position.xz - uLanding.xy), uTime - uLanding.z).x;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(vSea, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform sampler2D uReflection;
      uniform mat4 uReflectionProjection;
      uniform vec3 uShip, uBreach, uLanding, uMoon;
      varying vec3 vSea;
      ${noise}
      ${swell}
      float aftermath(vec2 delta, float radius, float age) {
        if (age <= 0.0 || age >= 5.8) return 0.0;
        vec2 drift = delta - vec2(.39, -.54) * age;
        float broken = noise3(vec3(drift * .65, age * .55));
        float filaments = 1.0 - smoothstep(.037, .20, abs(broken - .53));
        float front = radius - (1.9 + 8.2 * age) + 2.4 * (broken - .5);
        float edge = exp(-abs(front) * (.88 - .065 * age));
        float trailing = exp(-abs(front + 3.3 + age) * .93) * .25;
        float pool = exp(-length(drift * vec2(1.0, .74)) / (3.4 + age * 1.7));
        return smoothstep(0.0, .21, age) * (1.0 - smoothstep(4.3, 5.8, age))
          * (exp(-age * .55) * (.76 * edge + trailing) * (.24 + .76 * filaments)
          + exp(-age * .71) * pool * (.24 + .76 * smoothstep(.28, .73, broken)));
      }
      void main() {
        vec2 p = vSea.xz;
        vec3 view = normalize(cameraPosition - vSea);
        float dist = length(cameraPosition - vSea);
        float t = uTime;
        vec3 surface = waves(p,t);
        vec2 splay = vec2(sin(p.x*.137 + p.y*.24), cos(p.y*.26 - p.x*.19));
        vec2 fine = cos(vec2(dot(p,vec2(.96,-2.33)) - t*3.3, dot(p,vec2(2.80,.83)) + t*4.2) + splay*2.7);
        fine += .34 * cos(p * vec2(4.52,7.1) - p.yx * 2.17 + vec2(t*6.1,-t*7.3) + splay.yx*4.2);
        float detail = 1.0 - smoothstep(70.0,425.0,dist);
        vec2 fromBreach = p - uBreach.xy, fromLanding = p - uLanding.xy;
        float breachRadius = length(fromBreach), landingRadius = length(fromLanding);
        float breachAge = t - uBreach.z, landingAge = t - uLanding.z;
        vec2 impact = .22 * disturbance(breachRadius, breachAge).y * fromBreach / max(.15, breachRadius)
                    + .64 * disturbance(landingRadius, landingAge).y * fromLanding / max(.15, landingRadius);
        vec2 slope = surface.yz * (.36 + .64 * detail) + fine * .060 * detail + impact;
        vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
        float angle = max(dot(view,n),0.0);
        float fresnel = .052 + .948 * pow(1.0-angle, 4.4);
        vec4 projected = uReflectionProjection * vec4(vSea.x,0.0,vSea.z,1.0);
        vec2 uv = projected.xy / projected.w * .5 + .5;
        vec2 distortion = (n.xz * vec2(.049,.064) + fine * .0032 * detail)
                       * (.55 + .45 * cos(angle)) * min(1.0, 150.0 / dist);
        vec2 reflectedUv = clamp(uv + distortion, .001, .999);
        float blur = .0008 + smoothstep(58.0,260.0,dist) * .0029;
        vec3 reflectColor = texture2D(uReflection, reflectedUv).rgb * .49
          + (texture2D(uReflection, reflectedUv + vec2(blur,0)).rgb
             + texture2D(uReflection, reflectedUv - vec2(blur,0)).rgb) * .255;
        vec3 refracted = refract(-view, n, .750);
        float seabed = fbm(vec3((p + refracted.xz * 12.0) * .042, .5));
        float depth = mix(7.0, 34.0, smoothstep(.22,.76,seabed));
        vec3 transmittance = exp(-vec3(.26,.087,.054) * depth / max(.25,-refracted.y));
        vec3 sea = vec3(.006,.032,.058) + transmittance * vec3(.042,.092,.124);
        float aft = p.y - uShip.y;
        float across = p.x - uShip.x - aft * uShip.z;
        float behind = smoothstep(15.0,24.0,aft) * exp(-max(aft-22.0,0.0) * .017);
        float wakeV = abs(abs(across) - (3.0 + aft * .207));
        float side = abs(abs(across) - 5.4) + max(abs(aft - 5.0) - 20.0,0.0) * 1.9;
        float foamNoise = noise3(vec3(p.x*.64,p.y*.42-t*1.4,2.9));
        float filaments = smoothstep(.43,.76,foamNoise + .16*sin(aft*1.16 - abs(across)*.68 - t*2.1));
        float turbulent = behind * (exp(-wakeV*.80) * .70 + exp(-abs(across)*(.23 + .002*aft))*.46);
        float bowSurf = exp(-side * .60) * .38;
        float foam = (turbulent + bowSurf) * filaments;
        float turbulence = .58 * aftermath(fromBreach, breachRadius, breachAge)
                         + 1.12 * aftermath(fromLanding, landingRadius, landingAge);
        float breaking = smoothstep(.60,.76,surface.x) * smoothstep(.63,.88,foamNoise) * .055;
        foam = clamp(foam + breaking, 0.0, .9);
        vec3 color = mix(sea, reflectColor * vec3(.80,.91,1.04), fresnel * .89);
        float gloss = pow(max(dot(reflect(-uMoon, n), view),0.0), 96.0);
        color += vec3(.21,.36,.56) * gloss * (.16 + .84 * fresnel);
        color = mix(color, vec3(.35,.58,.69), foam) * (.94 + .06 * n.y);
        color = mix(color, vec3(.59,.78,.89), clamp(turbulence, 0.0, .84));
        gl_FragColor = vec4(mist(cameraPosition,vSea,color),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(seaGrid(), material);
}
