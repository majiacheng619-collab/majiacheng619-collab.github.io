import * as THREE from './three.module.min.js';
import { oceanHeight, randomSeed } from './environment.mjs';

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const tau = 2 * Math.PI;
const standard = (color, roughness = .55, metalness = .10) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

function geometry(positions, indices, colors) {
  const surface = new THREE.BufferGeometry();
  surface.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (colors) surface.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  surface.setIndex(indices);
  surface.computeVertexNormals();
  return surface;
}

function hardware(root) {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const tube = new THREE.CylinderGeometry(1, 1, 1, 8);
  const beads = new THREE.SphereGeometry(1, 12, 7);
  const parts = new Map();
  const object = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const end = new THREE.Vector3();
  const start = new THREE.Vector3();
  function put(shape, material) {
    object.updateMatrix();
    if (!parts.has(shape)) parts.set(shape, new Map());
    const batch = parts.get(shape);
    if (!batch.has(material)) batch.set(material, []);
    batch.get(material).push(object.matrix.clone());
  }
  return {
    box(material, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
      object.position.set(x, y, z);
      object.rotation.set(rx, ry, rz);
      object.scale.set(w, h, d);
      put(box, material);
    },
    bead(material, x, y, z, w, h, d, ry = 0) {
      object.position.set(x, y, z);
      object.rotation.set(0, ry, 0);
      object.scale.set(w, h, d);
      put(beads, material);
    },
    tube(material, a, b, radius) {
      start.fromArray(a);
      end.fromArray(b);
      object.position.copy(start).lerp(end, .5);
      end.sub(start);
      object.scale.set(radius, end.length(), radius);
      object.quaternion.setFromUnitVectors(up, end.normalize());
      put(tube, material);
    },
    finish() {
      for (const [shape, batch] of parts) {
        for (const [material, matrices] of batch) {
          const mesh = new THREE.InstancedMesh(shape, material, matrices.length);
          matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          root.add(mesh);
        }
      }
    },
  };
}

const hullStations = [
  [-26.6, .02, 4.8], [-25.0, .99, 4.5], [-22.1, 2.70, 4.02], [-17, 4.85, 3.66],
  [-10, 6.08, 3.38], [-2, 6.45, 3.20], [8, 6.40, 2.71], [15, 6.09, 2.70],
  [20.8, 5.62, 2.77], [22.8, 4.74, 2.82], [23.3, .05, 2.84],
];
const hullCurve = new THREE.CatmullRomCurve3(hullStations.map(([z, width, deck]) => new THREE.Vector3(z, width, deck)));
const black = new THREE.Color(0x142439), band = new THREE.Color(0x263242), oxide = new THREE.Color(0x783a37);

function hull(ship) {
  const sides = 46, rows = 94;
  const positions = [], indices = [], colors = [], deckPositions = [], deckIndices = [];
  const surfaceColor = new THREE.Color();
  for (let row = 0; row <= rows; row++) {
    const { x: z, y: width, z: top } = hullCurve.getPoint(row / rows);
    const taper = clamp(width * .95, .001, 1);
    const draft = lerp(top + .18, 3.18, taper);
    for (let j = 0; j < sides; j++) {
      const angle = -Math.PI / 2 + Math.PI * j / (sides - 1);
      const y = top - (top + draft) * Math.pow(Math.cos(angle), .72);
      const x = width * Math.sin(angle) * (.60 + .40 * (y + draft) / (top + draft));
      const keelRake = Math.pow(clamp((-z - 16) / 11, 0, 1), 1.6) * (top - y) * .98;
      positions.push(x, y, z + keelRake);
      surfaceColor.copy(black).lerp(band, .22 + .22 * Math.sin(z * .25) + clamp(y / 16, 0, .2))
        .lerp(oxide, 1.0 - THREE.MathUtils.smoothstep(y, -.77, -.07));
      colors.push(surfaceColor.r, surfaceColor.g, surfaceColor.b);
      if (row < rows && j < sides - 1) {
        const k = row * sides + j;
        indices.push(k, k + 1, k + sides, k + 1, k + sides + 1, k + sides);
      }
    }
    deckPositions.push(-width, top, z, 0, top + .072, z, width, top, z);
    if (row < rows) {
      const j = 3 * row;
      deckIndices.push(j, j + 3, j + 1, j + 1, j + 3, j + 4,
        j + 1, j + 4, j + 2, j + 2, j + 4, j + 5);
    }
  }
  const shell = new THREE.Mesh(geometry(positions, indices, colors),
    new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .27, roughness: .39, side: THREE.DoubleSide }));
  const deck = new THREE.Mesh(geometry(deckPositions, deckIndices), standard(0x56676b, .79, .09));
  shell.castShadow = deck.castShadow = true;
  shell.receiveShadow = deck.receiveShadow = true;
  ship.add(shell, deck);
}

function vesselName(ship, sign) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 80;
  const context = canvas.getContext('2d');
  context.font = '600 51px sans-serif';
  context.fillStyle = '#d8e5ec';
  context.fillText('A U R O R A', 12, 61);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const name = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 1.22),
    new THREE.MeshBasicMaterial({ map, transparent: true, opacity: .87, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  name.rotation.y = sign * (Math.PI / 2 + .14);
  name.position.set(sign * 5.87, 2.61, -12.4);
  ship.add(name);
}

export function makeShip(scene) {
  const ship = new THREE.Group();
  hull(ship);
  const b = hardware(ship);
  const white = standard(0xd7e1e2, .46), pale = standard(0xaababc, .55);
  const steel = standard(0xc2d0d6, .37, .62), charcoal = standard(0x202d36, .53);
  const window = new THREE.MeshPhysicalMaterial({
    color: 0x194858, roughness: .21, metalness: .25, clearcoat: .8, emissive: 0x19302b, emissiveIntensity: .32,
  });
  const warm = new THREE.MeshStandardMaterial({ color: 0xc3b27b, emissive: 0xffb469, emissiveIntensity: .73, roughness: .38 });
  const orange = standard(0xb5441d, .38), rescue = standard(0xe3762d, .43);
  const deckRed = standard(0x7a3c34, .73), cable = standard(0x1a2530, .44, .36);

  b.box(white, 0, 4.85, -5.4, 10.55, 3.31, 19.1);
  b.box(deckRed, 0, 6.51, -6.5, 11.01, .25, 17.7);
  b.box(white, 0, 7.82, -8.0, 9.45, 2.58, 13.7);
  b.box(white, 0, 9.21, -8.4, 10.68, .40, 14.80);
  b.box(pale, 0, 9.38, -8.55, 10.22, .13, 14.3);
  b.box(white, 0, 10.57, -10.07, 9.40, 2.19, 7.16);
  b.box(charcoal, 0, 11.5, -10.24, 9.76, .25, 7.58);
  b.box(white, 0, 11.72, -10.23, 10.11, .36, 7.78);
  b.box(deckRed, 0, 12.0, -10.36, 9.54, .22, 7.47);
  b.box(white, 0, 7.55, 1.43, 3.67, 4.25, 3.1);
  b.box(charcoal, 0, 10.30, 1.50, 3.86, 1.29, 3.16);
  b.box(orange, 0, 9.74, 1.51, 3.9, .37, 3.2);
  b.box(charcoal, 0, 4.17, 8.64, 4.00, 2.08, 6.2);
  b.box(pale, 0, 5.26, 8.60, 4.20, .15, 6.36);

  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 1.00;
    b.box(charcoal, x, 10.71, -13.689, .91, 1.25, .14, -.10);
    b.box(i === 3 || i === 6 ? warm : window, x, 10.73, -13.779, .72, .94, .09, -.10);
  }
  for (const sign of [-1, 1]) {
    const nav = new THREE.MeshStandardMaterial({
      color: sign === 1 ? 0x18d59a : 0xf0483f, emissive: sign === 1 ? 0x27ffad : 0xff3631, emissiveIntensity: 1.4,
    });
    b.box(pale, sign * 5.32, 9.45, -10.4, 2.12, .32, 3.93);
    b.box(nav, sign * 6.51, 10.40, -11.6, .21, .30, .39);
    for (let i = 0; i < 6; i++) {
      const z = -13.0 + i * 1.16;
      b.box(charcoal, sign * 4.74, 10.74, z, .14, 1.27, 1.04);
      b.box(i === 3 ? warm : window, sign * 4.834, 10.79, z, .058, .97, .87);
    }
    for (let i = 0; i < 9; i++) {
      const z = -14.75 + i * 1.97;
      b.box(charcoal, sign * 5.309, 5.25, z, .11, .79, 1.20);
      b.box(i % 4 === 0 ? warm : window, sign * 5.377, 5.27, z, .058, .62, 1.02);
      if (i > 6) continue;
      b.box(window, sign * 4.761, 8.03, z + .18, .12, .71, .87);
    }
    b.box(charcoal, sign * 5.33, 4.67, 2.30, .15, 2.10, .94);
    b.box(pale, sign * 5.43, 4.67, 2.30, .07, 1.91, .78);
    b.box(deckRed, sign * 4.47, 5.53, .05, 2.27, .35, 6.61);
    b.bead(charcoal, sign * 4.50, 5.74, .10, 1.03, .55, 3.10);
    b.bead(rescue, sign * 4.50, 6.05, .14, 1.06, .71, 3.18);
    b.bead(white, sign * 4.51, 6.38, .50, .61, .40, 2.22);
    for (const z of [-2.98, 2.88]) {
      b.tube(white, [sign * 4.25, 5.52, z], [sign * 4.27, 7.25, z], .142);
      b.tube(steel, [sign * 4.27, 7.25, z], [sign * 5.58, 7.25, z], .091);
      b.tube(cable, [sign * 5.51, 7.25, z], [sign * 5.51, 6.26, z], .026);
    }
    for (const z of [-20.4, -17.9, 17.0, 20.3]) {
      const x = sign * (Math.abs(z) > 19 ? 3.0 : 4.56), y = z < 0 ? 3.68 : 2.75;
      b.tube(charcoal, [x, y, z], [x, y + .65, z], .23);
      b.tube(steel, [x - .22, y + .55, z], [x + .22, y + .55, z], .14);
    }
    let previous = null;
    for (let step = 0; step <= 40; step++) {
      const { x: z, y: width, z: deckY } = hullCurve.getPoint(step / 40);
      const x = (width - .15) * sign;
      const post = [x, deckY + 1.16, z];
      b.tube(steel, [x, deckY, z], post, .051);
      if (previous) {
        b.tube(steel, previous, post, .052);
        b.tube(pale, [previous[0], previous[1] - .47, previous[2]], [x, deckY + .69, z], .038);
      }
      previous = post;
    }
    for (let j = 0; j < 7; j++) {
      b.box(pale, sign * 5.01, 2.94 + j * .38, 4.02 - j * .37, 1.13, .11, .43);
    }
    b.tube(steel, [sign * 5.6, 3.96, 4.12], [sign * 5.6, 6.24, 1.88], .047);
    b.tube(orange, [sign * 5.12, 2.79, 18.4], [sign * 4.11, 8.36, 20.8], .28);
    b.tube(cable, [sign * 4.1, 8.27, 20.8], [sign * 4.9, 3.32, 16.05], .042);
    b.tube(steel, [sign * 1.7, 13.0, -8.50], [0, 18.74, -8.53], .058);
    b.tube(cable, [sign * 4.06, 11.9, -12.6], [0, 21.7, -8.53], .025);
    b.bead(white, sign * 2.52, 12.45, -12.68, .61, .52, .61);
    b.box(warm, sign * 4.9, 7.03, -1.96, .24, .31, .39);
    vesselName(ship, sign);
  }
  b.tube(orange, [-4.2, 8.35, 20.8], [4.2, 8.35, 20.8], .32);
  b.tube(charcoal, [-1.86, 4.16, 13.9], [1.86, 4.16, 13.9], .59);
  b.tube(orange, [-1.49, 4.16, 13.9], [1.49, 4.16, 13.9], .69);
  b.tube(pale, [0, 11.90, -8.47], [0, 18, -8.47], .265);
  b.tube(steel, [0, 17.7, -8.47], [0, 22.1, -8.47], .078);
  b.tube(white, [-2.66, 16.09, -8.47], [2.66, 16.09, -8.47], .089);
  b.tube(white, [-1.71, 18.03, -8.47], [1.71, 18.03, -8.47], .079);
  b.tube(warm, [0, 20.42, -8.47], [0, 20.72, -8.47], .115);
  for (const x of [-2.0, -1, 1.0, 2.0]) {
    b.tube(charcoal, [x, 16.0, -8.47], [x, 17.83, -8.47], .031);
  }
  for (const x of [-3.5, 0, 3.5]) {
    b.box(pale, x, 3.34, 9.0, 1.87, 1.28, 2.57);
    b.box(white, x, 4.03, 9.0, 1.95, .13, 2.72);
  }
  b.finish();
  const radar = new THREE.Mesh(new THREE.BoxGeometry(3.42, .16, .24), white);
  radar.position.set(0, 18.7, -8.47);
  ship.add(radar);
  scene.add(ship);
  return { root: ship, radar };
}

export function shipAt(time, target = new THREE.Vector3()) {
  const x = 5.0 + 6.6 * Math.sin(time * .118);
  const z = 164 - 12.20 * time;
  return target.set(x, oceanHeight(x, z, time) * .36 - .35, z);
}

export function animateShip(ship, time, position) {
  shipAt(time, position);
  ship.root.position.copy(position);
  ship.root.rotation.set(.018 * Math.sin(time * 1.67) + .009 * Math.sin(time * .69),
    -.0638 * Math.cos(time * .118), .027 * Math.sin(time * 1.24) + .009 * Math.cos(time * .80));
  ship.radar.rotation.y = time * 1.60;
}

export const breach = { x: 29, z: -31, time: 12.28 };
export const landing = { x: 43, z: -64, time: 15.03 };

const whaleProfile = [
  [-11.4, .02, .03, .53], [-10.9, 1.03, .74, .53], [-9.0, 1.99, 1.29, .22],
  [-6.25, 2.91, 1.95, .01], [-3.0, 3.21, 2.49, .12], [.2, 2.74, 2.32, .03],
  [3.0, 1.88, 1.70, .07], [6.0, .86, .83, -.03], [8.8, .51, .37, .04], [10.5, .30, .15, .12],
];

function whaleBody(material) {
  const curve = new THREE.CatmullRomCurve3(whaleProfile.map(([z, x, y]) => new THREE.Vector3(z, x, y)));
  const positions = [], colors = [], indices = [];
  const pale = new THREE.Color(0xb0cbd4), dark = new THREE.Color(0x293e4b), side = new THREE.Color(0x486678);
  const shade = new THREE.Color();
  const longitudinal = 84, around = 60;
  for (let i = 0; i <= longitudinal; i++) {
    const { x: z, y: width, z: height } = curve.getPoint(i / longitudinal);
    const hump = .49 * Math.exp(-Math.pow((z + 10.2) * .55, 2)) + .12 * Math.sin(z * .43);
    for (let j = 0; j < around; j++) {
      const a = j / around * tau;
      const g = Math.sin(a), k = Math.cos(a);
      const ripple = Math.sin(a * 13 + z * .75) * .04 * Math.exp(-Math.pow((z + 6) * .24, 2)) * clamp(-g, 0, 1);
      const pepper = Math.sin(z * 6.3 + a * 13) * Math.sin(z * 16.03 + a * 19) * .12;
      positions.push(width * k, hump + (height + ripple) * g, z);
      const ivory = THREE.MathUtils.smoothstep(-g + .09 * Math.sin(z * 1.4), .31, .81);
      shade.copy(dark).lerp(side, clamp((1 - g) * .27, 0, 1))
        .lerp(pale, ivory * .80).multiplyScalar(1 + pepper);
      colors.push(shade.r, shade.g, shade.b);
      if (i < longitudinal) {
        const n = i * around + j, m = i * around + (j + 1) % around;
        indices.push(n, m, n + around, m, m + around, n + around);
      }
    }
  }
  return new THREE.Mesh(geometry(positions, indices, colors), material);
}

function fin(material, fluke) {
  const positions = [], indices = [], colors = [];
  const dark = new THREE.Color(0x233a49), white = new THREE.Color(0xbfdae5), shade = new THREE.Color();
  const rows = 24, around = 21;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    for (let side = 0; side < around; side++) {
      const a = side / around * tau;
      const width = Math.pow(1 - t, .72) * (.80 + .42 * Math.sin(t * 3.42));
      const x = t * (fluke ? 5.6 : 6.15);
      const y = fluke ? .29 * Math.sin(t * 2.27) : -.61 * t - 1.19 * t * t;
      const z = fluke ? -.53 + t * t * 1.61 : -1.1 * t + 3.72 * t * t;
      const lump = (fluke ? .03 : .095) * Math.sin(t * 26) * (Math.cos(a) < 0 ? 1 : .32);
      positions.push(x, y + Math.sin(a) * width * (fluke ? .27 : .37),
        z + Math.cos(a) * width * (fluke ? 1.86 : 1.36) + lump);
      shade.copy(dark).lerp(white, clamp(-Math.sin(a) * (fluke ? .56 : 1.37) + .10, 0, 1));
      colors.push(shade.r, shade.g, shade.b);
      if (row < rows) {
        const j = row * around + side, k = row * around + (side + 1) % around;
        indices.push(j, j + around, k, k, j + around, k + around);
      }
    }
  }
  return new THREE.Mesh(geometry(positions, indices, colors), material);
}

function makeWhale(scene, time) {
  const root = new THREE.Group();
  root.scale.setScalar(1.24);
  const skin = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: .32, metalness: .15, clearcoat: .50,
    clearcoatRoughness: .27, side: THREE.DoubleSide,
  });
  const animated = skin.clone();
  animated.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float flex = smoothstep(-2.0, 10.5, position.z);
      transformed.y += .81 * flex * flex * sin(uTime * 5.5 + position.z * .065);
    `);
  };
  root.add(whaleBody(animated));
  const attachments = [];
  const eyes = standard(0x080d15, .22);
  const fittings = hardware(root);
  for (const sign of [-1, 1]) {
    const flipper = fin(skin, false), tail = fin(skin, true);
    flipper.position.set(sign * 2.21, -1.14, -3.5);
    flipper.scale.x = sign;
    tail.scale.x = sign;
    root.add(flipper, tail);
    attachments.push({ sign, flipper, tail });
    fittings.bead(eyes, sign * 2.115, .27, -8.60, .17, .136, .21);
    for (let i = 0; i < 6; i++) {
      const x = sign * (1.05 + i * .12);
      fittings.bead(standardBarnacle, x, .93 - i * .042, -10.55 + .30 * i, .18, .14, .19);
    }
  }
  fittings.bead(standardBarnacle, 0, 2.37, 1.54, .32, .74, 1.28, 0);
  fittings.finish();
  scene.add(root);
  return { root, attachments };
}

const standardBarnacle = standard(0x3a5061, .58);

function spray(scene, time, pixelHeight) {
  const count = 2960;
  const random = randomSeed(19646);
  const positions = [], speeds = [], events = [];
  for (let i = 0; i < count; i++) {
    const hit = i % 5 < 2 ? breach : landing;
    const mist = i % 3 === 0;
    const a = random() * tau;
    const spread = .5 + 5.3 * Math.pow(random(), 3);
    const launch = hit.time - .18 + random() * (mist ? .87 : .48);
    const pressure = hit === landing ? 1.0 : .78;
    const jet = .8 + Math.pow(random(), 1.48) * 14.7;
    const directional = .83 + .17 * Math.sin(a);
    positions.push(hit.x + Math.cos(a) * spread, -.11 + random() * .42, hit.z + Math.sin(a) * spread * 1.32);
    speeds.push(Math.cos(a) * jet * .85 * directional + 1.65, pressure * (jet * .72 + random() * 6.2),
      Math.sin(a) * jet - 1.6);
    events.push(launch, .8 + random() * (mist ? 2.2 : 1.28), mist ? .50 + random() * 1.76 : .11 + random() * .19, mist ? 1 : 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('velocity', new THREE.Float32BufferAttribute(speeds, 3));
  geometry.setAttribute('event', new THREE.Float32BufferAttribute(events, 4));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: time, uHeight: pixelHeight },
    vertexShader: `
      uniform float uTime, uHeight;
      attribute vec3 velocity;
      attribute vec4 event;
      varying float vAlpha, vMist;
      void main() {
        float t = uTime - event.x;
        float drag = (1.0 - exp(-t * .53)) / .53;
        vec3 p = position + velocity * drag + vec3(t * .72, -4.9 * t * t, t * .74);
        vAlpha = smoothstep(0.0,.06,t) * (1.0 - smoothstep(.23,event.y,t)) * smoothstep(-.16,.14,p.y);
        vMist = event.w;
        if (t < 0.0 || t > event.y || p.y < -.45) {
          gl_Position = vec4(0.0,0.0,2.0,1.0);
          gl_PointSize = 1.0;
        } else {
          vec4 view = modelViewMatrix * vec4(p,1.0);
          gl_Position = projectionMatrix * view;
          gl_PointSize = clamp(event.z * (1.0 + .69*t*vMist) * uHeight * projectionMatrix[1][1] / (-2.0 * view.z), 1.0, 55.0);
        }
      }`,
    fragmentShader: `
      varying float vAlpha, vMist;
      void main() {
        vec2 p = (gl_PointCoord - .5) * vec2(2.8 - .8 * vMist, 2.0);
        float radius = dot(p,p);
        float halo = max(0.0, 1.0 - radius);
        vec3 color = vec3(.42,.65,.84) + vec3(.45,.38,.26) * exp(-distance(p,vec2(-.21,-.30))*3.5);
        gl_FragColor = vec4(color, vAlpha * pow(halo, 1.75 + 1.3 * vMist) * mix(.91,.105,vMist));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = false;
  particles.renderOrder = 3;
  scene.add(particles);
  return particles;
}

export function makeWildlife(scene, time, pixelHeight) {
  return { whale: makeWhale(scene, time), spray: spray(scene, time, pixelHeight) };
}

export function animateWildlife({ whale, spray }, time) {
  const age = time - breach.time;
  const flight = landing.time - breach.time;
  const ratio = age / flight;
  whale.root.visible = time > 11.70 && time < 15.60;
  spray.visible = time > 12.05 && time < 17.65;
  if (!whale.root.visible) return;
  const y = 4.65 * age * (flight - age) - .29;
  whale.root.position.set(lerp(breach.x, landing.x, ratio), y, lerp(breach.z, landing.z, ratio));
  whale.root.rotation.set(.98 - 1.83 * THREE.MathUtils.smoothstep(ratio, .11, .96),
    -.54 - .22 * Math.sin(Math.PI * ratio), .22 + .62 * Math.sin(Math.PI * ratio));
  for (const { sign, flipper, tail } of whale.attachments) {
    flipper.rotation.z = sign * (.15 + .25 * Math.sin(age * 2.7 - .6));
    flipper.rotation.y = sign * (.29 + .16 * Math.cos(age * 2.7));
    tail.position.set(0, .12 + .81 * Math.sin(time * 5.50 + .66), 10.18);
    tail.rotation.x = -.12 * Math.cos(time * 5.50 + .66);
  }
}
