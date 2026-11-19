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

export const breach = { x: 29, z: -31, time: 11.78 };
export const landing = { x: 44, z: -66, time: 14.53 };

const flightStart = 12.38, flightEnd = 15.08;
const flightTime = flightEnd - flightStart;
const flightX = 14 / flightTime, flightZ = -33 / flightTime;
const whaleScale = 1.24;
const tailWag = 3.4;

const whaleProfile = [
  [-11.45, .02, .05], [-11.0, 1.30, .64], [-9.0, 2.09, 1.38],
  [-6.25, 2.91, 2.03], [-3.0, 3.28, 2.54], [.2, 2.74, 2.28],
  [3.0, 1.88, 1.65], [6.0, .92, .82], [8.8, .52, .36], [10.5, .30, .15],
];
const whaleSpine = new THREE.CatmullRomCurve3(whaleProfile.map(point => new THREE.Vector3(...point)));

function whalePose(root, time) {
  const age = time - flightStart;
  const ratio = age / flightTime;
  const turn = Math.sin(Math.PI * clamp(ratio, 0, 1));
  root.position.set(29 + age * flightX, 4.9 * age * (flightTime - age) - .32, -31 + age * flightZ);
  root.rotation.set(.92 - 1.82 * THREE.MathUtils.smoothstep(ratio, .10, .92),
    Math.atan2(-flightX, -flightZ) - .16 * turn, .13 + .52 * turn, 'YXZ');
}

function whaleBody(material) {
  const positions = [], colors = [], indices = [];
  const pale = new THREE.Color(0xbad0d5), dark = new THREE.Color(0x263646), side = new THREE.Color(0x5b7480);
  const shade = new THREE.Color();
  const smooth = THREE.MathUtils.smoothstep;
  const longitudinal = 84, around = 60;
  for (let i = 0; i <= longitudinal; i++) {
    const { x: z, y: width, z: height } = whaleSpine.getPoint(i / longitudinal);
    const crown = .44 * Math.exp(-Math.pow((z + 10.2) * .46, 2)) + .11 * Math.sin(z * .43);
    const throat = smooth(z, -11.2, -9.8) * (1 - smooth(z, -5, .9));
    const dorsal = .94 * Math.exp(-Math.pow((z - 2.25) * .65, 2));
    for (let j = 0; j < around; j++) {
      const a = j / around * tau;
      const g = Math.sin(a), k = Math.cos(a);
      const grooves = throat * smooth(-g, .07, .44) * Math.cos(a * 13 + z * .21);
      const mottling = Math.sin(z * 1.73 + a * 13) * Math.sin(z * 2.93 - a * 8);
      positions.push(width * k, crown + (height + .10 * grooves) * g + dorsal * Math.pow(Math.max(0, g), 91), z);
      const ivory = smooth(-g + .099 * mottling, .25, .78) * (.78 + .16 * throat);
      const mouth = (1 - smooth(Math.abs(g + .22 + (z + 9) * .037), .040, .128)) * (1 - smooth(z, -6.0, -4.6));
      shade.copy(dark).lerp(side, clamp((1 - g) * .43, 0, 1)).lerp(pale, ivory)
        .multiplyScalar((1 + .11 * mottling + .15 * grooves) * (1 - .61 * mouth));
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
      const width = Math.pow(1 - t, .69) * (fluke ? .65 + .92 * Math.sin(t * 2.95) : .84 + .48 * Math.sin(t * 2.82));
      const x = t * (fluke ? 5.4 : 7.55);
      const y = fluke ? .37 * Math.sin(t * 2.27) : -.81 * t - 1.27 * t * t;
      const z = fluke ? -.34 + t * t * 1.36 : -.92 * t + 3.75 * t * t;
      const lump = (fluke ? .03 : .095) * Math.sin(t * 26) * (Math.cos(a) < 0 ? 1 : .32);
      positions.push(x, y + Math.sin(a) * width * (fluke ? .27 : .37),
        z + Math.cos(a) * width * (fluke ? 1.86 : 1.36) + lump);
      const pale = fluke ? -.66 * Math.sin(a) : -.94 * Math.sin(a) + .39 * t;
      shade.copy(dark).lerp(white, clamp(pale + .08 * Math.sin(39 * t + a * 4), 0, 1));
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
  root.scale.setScalar(whaleScale);
  const skin = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: .37, clearcoat: .56,
    clearcoatRoughness: .24, side: THREE.DoubleSide,
  });
  const animated = skin.clone();
  animated.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float flex = smoothstep(-2.0, 10.5, position.z);
      transformed.y += .72 * flex * flex * sin((uTime - ${flightStart}) * ${tailWag} + position.z * .065);
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
  fittings.finish();
  scene.add(root);
  return { root, attachments };
}

const standardBarnacle = standard(0x3a5061, .58);

function spray(scene, time, pixelHeight) {
  const random = randomSeed(19646);
  const positions = [], speeds = [], events = [];
  for (const hit of [breach, landing]) {
    const falls = hit === landing;
    const count = falls ? 2140 : 1340;
    const startDelay = falls ? .34 : .23;
    for (let i = 0; i < count; i++) {
      const mist = i % 4 === 0;
      const crest = (.5 + .5 * Math.cos(i * .021)) ** 2;
      const angle = random() * tau;
      const spread = .65 + (falls ? 6.1 : 3.6) * random() ** 2.2;
      const delay = startDelay * crest + random() * (mist ? .75 : .41);
      const jet = (2.0 + (falls ? 14.6 : 9.4) * random() ** 1.42) * (.65 + .35 * crest);
      const x = hit.x + Math.cos(angle) * spread + delay * (falls ? -.8 : 1.6);
      const z = hit.z + Math.sin(angle) * spread * 1.34 - delay * (falls ? 1.3 : 3.6);
      positions.push(x, oceanHeight(x, z, hit.time + delay) + .04, z);
      speeds.push(Math.cos(angle) * jet + 1.45, (jet * .89 + random() * 3.4) * (mist ? .63 : 1.0),
        Math.sin(angle) * jet * .84 - 1.8);
      events.push(hit.time + delay, 1.05 + random() * (mist ? 2.0 : 1.06),
        mist ? 1.32 + random() * 2.14 : .14 + random() * .26, mist ? 1 : 0);
    }
  }

  // Sample the animated skin at emission time so seeking produces the same falling droplets.
  const emitter = new THREE.Object3D();
  emitter.scale.setScalar(whaleScale);
  const point = new THREE.Vector3();
  for (let i = 0; i < 1010; i++) {
    const launch = breach.time + .22 + (landing.time - breach.time - .22) * random() ** 1.32;
    const { x: z, y: radius, z: height } = whaleSpine.getPoint(.05 + .79 * random());
    const angle = Math.PI * (1.04 + .92 * random());
    whalePose(emitter, launch);
    emitter.updateMatrix();
    point.set(radius * Math.cos(angle), height * Math.sin(angle), z).applyMatrix4(emitter.matrix);
    if (point.y < oceanHeight(point.x, point.z, launch)) continue;
    positions.push(point.x, point.y, point.z);
    const rise = 4.9 * (flightTime - 2 * (launch - flightStart));
    speeds.push(flightX * .68 + 2.5 * Math.cos(angle), rise * .42 - .75 - 3.1 * random(), flightZ * .69 + 2.0 * random());
    events.push(launch, .39 + 1.36 * random(), .10 + .17 * random(), 0);
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
      varying vec2 vFall;
      void main() {
        float t = uTime - event.x;
        float drag = (1.0 - exp(-t * .53)) / .53;
        vec3 p = position + velocity * drag + vec3(t * .72, -4.9 * t * t, t * .74);
        vAlpha = smoothstep(0.0,.055,t) * (1.0 - smoothstep(.17,event.y,t)) * smoothstep(-.45,.12,p.y);
        vMist = event.w;
        vFall = vec2(0.0, 1.0);
        if (t < 0.0 || t > event.y || p.y < -.45) {
          gl_Position = vec4(0.0,0.0,2.0,1.0);
          gl_PointSize = 1.0;
        } else {
          vec4 view = modelViewMatrix * vec4(p,1.0);
          gl_Position = projectionMatrix * view;
          vec3 motion = velocity * exp(-t * .53) + vec3(.72, -9.8*t, .74);
          vec3 viewMotion = mat3(modelViewMatrix) * motion;
          vFall = normalize(vec2(viewMotion.x, -viewMotion.y) + vec2(.001, .001));
          gl_PointSize = clamp(event.z * (1.0 + .69*t*vMist) * uHeight * projectionMatrix[1][1] / (-2.0 * view.z), 1.0, 58.0);
        }
      }`,
    fragmentShader: `
      varying float vAlpha, vMist;
      varying vec2 vFall;
      void main() {
        vec2 q = gl_PointCoord - .5;
        vec2 p = mix(vec2(dot(q, vec2(-vFall.y, vFall.x)) * 4.1, dot(q, vFall) * 2.0), q * 2.0, vMist);
        float radius = dot(p,p);
        float halo = max(0.0, 1.0 - radius);
        vec3 color = vec3(.54,.75,.92) + vec3(.43,.35,.25) * exp(-distance(p,vec2(-.17,-.26))*3.5);
        gl_FragColor = vec4(color, vAlpha * pow(halo, 1.46 + 1.5 * vMist) * mix(.96,.17,vMist));
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
  whale.root.visible = time > flightStart - .88 && time < flightEnd + .88;
  spray.visible = time >= breach.time && time < landing.time + 4.2;
  if (!whale.root.visible) return;
  whalePose(whale.root, time);
  const tailPhase = (time - flightStart) * tailWag + .66;
  for (const { sign, flipper, tail } of whale.attachments) {
    flipper.rotation.z = sign * (.12 + .29 * Math.sin(age * 2.44 - .6 + sign * .39));
    flipper.rotation.y = sign * (.22 + .20 * Math.cos(age * 2.44 + sign * .29));
    tail.position.set(0, .72 * Math.sin(tailPhase), 10.18);
    tail.rotation.x = -.16 * Math.cos(tailPhase);
  }
}
