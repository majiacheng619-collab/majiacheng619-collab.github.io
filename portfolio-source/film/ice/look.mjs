import { Euler, Vector3 } from './three.module.min.js';

const offset = new Vector3();
const angle = new Euler(0, 0, 0, 'YXZ');

export function applyLook(camera, target, view) {
  if (!view?.yaw && !view?.pitch) return;
  angle.set(view.pitch || 0, view.yaw || 0, 0);
  offset.copy(target).sub(camera.position).applyEuler(angle);
  target.copy(camera.position).add(offset);
}
