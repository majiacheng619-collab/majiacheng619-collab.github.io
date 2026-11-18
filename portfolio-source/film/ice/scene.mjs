import * as THREE from './three.module.min.js';
import { makeIce, makeSea, makeSky } from './environment.mjs';
import { animateShip, animateWildlife, breach, landing, makeShip, makeWildlife } from './vessels.mjs';

export const duration = 25;
export const width = 1920;
export const height = 1080;
export const fps = 30;
export const chapters = [
  { start: 0, label: '极夜入海' },
  { start: 4, label: '跟随科考船' },
  { start: 10, label: '峡谷鲸跃' },
  { start: 17, label: '驶向冰拱' },
];

// Time, focal length as vertical field of view, and eye/target offsets from the ship.
const cameraKeys = [
  [0,    57,  81, 79, 116, -62, 83, -177],
  [2.3,  53,  86, 62,  87, -43, 49, -124],
  [4,    46,  79, 37,  45, -14, 20,  -49],
  [6.9,  40,  62, 16, -14,  -1,  8,   -8],
  [9.1,  42,  63, 13,   4,  -4,  8,  -12],
  [10,   43,  66, 15,  17,  -5, 10,  -23],
  [11.8, 47,  69, 19,  36,   3,  9,  -29],
  [13.8, 47,  70, 19,  42,   9,  9,  -38],
  [15.8, 46,  71, 21,  47,   8, 10,  -47],
  [17,   47,  72, 24,  54,   3, 14,  -57],
  [20.7, 51,  67, 46, 101,  -5, 55, -128],
  [25,   59,  47, 63, 165, -10, 79, -183],
];

function pose(time, result) {
  const edge = cameraKeys.findIndex(key => key[0] > time);
  const i = edge < 0 ? cameraKeys.length - 2 : Math.max(0, edge - 1);
  const a = cameraKeys[i];
  const b = cameraKeys[i + 1];
  const prev = cameraKeys[Math.max(0, i - 1)];
  const next = cameraKeys[Math.min(cameraKeys.length - 1, i + 2)];
  const interval = b[0] - a[0];
  const s = (time - a[0]) / interval;
  const s2 = s * s;
  const s3 = s * s2;
  for (let k = 1; k < a.length; k++) {
    const aVelocity = (b[k] - prev[k]) / (b[0] - prev[0]);
    const bVelocity = (next[k] - a[k]) / (next[0] - a[0]);
    result[k - 1] = (2 * s3 - 3 * s2 + 1) * a[k] + (-2 * s3 + 3 * s2) * b[k]
      + interval * ((s3 - 2 * s2 + s) * aVelocity + (s3 - s2) * bVelocity);
  }
}

export function createCathedral(canvas, { capture = false, reflectionScale = .40, antialias = true } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias, alpha: false, powerPreference: 'high-performance',
    preserveDrawingBuffer: capture,
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x3e5776, .00103);
  const camera = new THREE.PerspectiveCamera(46, width / height, .38, 6400);
  const reflectedCamera = camera.clone();
  const target = new THREE.Vector3();
  const reflectedTarget = new THREE.Vector3();
  const shipPosition = new THREE.Vector3();
  const framing = new Float32Array(7);
  const mainOffset = new THREE.Vector3(-84, 93, -98);
  const mirrorClip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), .20)];

  const main = new THREE.DirectionalLight(0xc4dbff, 1.8);
  main.castShadow = true;
  main.shadow.mapSize.set(capture ? 1024 : 512, capture ? 1024 : 512);
  Object.assign(main.shadow.camera, { left: -41, right: 41, top: 39, bottom: -39, near: 38, far: 273 });
  main.shadow.bias = -.00034;
  main.shadow.normalBias = .075;
  main.shadow.radius = 2.4;
  const fill = new THREE.DirectionalLight(0x61e4cc, .51);
  fill.position.set(74, 95, -159);
  scene.add(main, main.target, fill, new THREE.HemisphereLight(0xb2ccf7, 0x283853, 1.32));

  const time = { value: 0 };
  const pixelHeight = { value: height };
  const sky = makeSky(time);
  scene.add(sky);
  makeIce(scene, time);
  const reflection = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true,
  });
  const sea = makeSea(time, reflection);
  sea.material.uniforms.uBreach.value.set(breach.x, breach.z, breach.time);
  sea.material.uniforms.uLanding.value.set(landing.x, landing.z, landing.time);
  scene.add(sea);
  const ship = makeShip(scene);
  const wildlife = makeWildlife(scene, time, pixelHeight);

  function setSize(w, h) {
    renderer.setSize(w, h, false);
    pixelHeight.value = h;
    camera.aspect = w / h;
    reflectedCamera.aspect = camera.aspect;
    reflection.setSize(Math.max(1, Math.round(w * reflectionScale)), Math.max(1, Math.round(h * reflectionScale)));
  }

  function renderAt(seconds) {
    const t = THREE.MathUtils.clamp(seconds, 0, duration);
    time.value = t;
    animateShip(ship, t, shipPosition);
    animateWildlife(wildlife, t);
    sea.material.uniforms.uShip.value.set(shipPosition.x, shipPosition.z, Math.tan(ship.root.rotation.y));
    fill.intensity = .54 + .16 * Math.sin(t * .36 - .7);
    main.target.position.copy(shipPosition);
    main.position.copy(shipPosition).add(mainOffset);

    pose(t, framing);
    const [fov, ex, ey, ez, tx, ty, tz] = framing;
    camera.position.set(shipPosition.x + ex, ey, shipPosition.z + ez);
    target.set(shipPosition.x + tx, ty, shipPosition.z + tz);
    camera.lookAt(target);
    camera.fov = reflectedCamera.fov = fov;
    camera.updateProjectionMatrix();
    reflectedCamera.updateProjectionMatrix();
    reflectedCamera.position.copy(camera.position);
    reflectedCamera.position.y *= -1;
    reflectedTarget.copy(target);
    reflectedTarget.y *= -1;
    reflectedCamera.lookAt(reflectedTarget);
    reflectedCamera.updateMatrixWorld();
    sea.material.uniforms.uReflectionProjection.value.multiplyMatrices(reflectedCamera.projectionMatrix, reflectedCamera.matrixWorldInverse);

    const showSpray = wildlife.spray.visible;
    wildlife.spray.visible = sea.visible = false;
    sky.position.copy(reflectedCamera.position);
    renderer.shadowMap.autoUpdate = true;
    renderer.clippingPlanes = mirrorClip;
    renderer.setRenderTarget(reflection);
    renderer.render(scene, reflectedCamera);
    renderer.setRenderTarget(null);
    renderer.clippingPlanes = [];
    renderer.shadowMap.autoUpdate = false;
    sky.position.copy(camera.position);
    wildlife.spray.visible = showSpray;
    sea.visible = true;
    renderer.render(scene, camera);
  }

  function dispose() {
    scene.traverse(object => {
      object.geometry?.dispose();
      if (object.material) {
        object.material.map?.dispose();
        object.material.dispose();
      }
    });
    reflection.dispose();
    renderer.dispose();
  }

  return { setSize, renderAt, dispose };
}
