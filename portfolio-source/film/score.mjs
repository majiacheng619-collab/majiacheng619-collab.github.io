import { writeFileSync } from 'node:fs';
import { randomSeed } from './ice/environment.mjs';
import { breach, landing } from './ice/vessels.mjs';

const TAU = 2 * Math.PI;
const rate = 48000;
const chordCues = [
  { start: 0, length: 8.8, pitches: [38, 50, 57, 64, 65] },
  { start: 5.7, length: 9.0, pitches: [36, 48, 55, 62, 64] },
  { start: 12.5, length: 8.9, pitches: [34, 46, 53, 57, 60] },
  { start: 18.2, length: 9.1, pitches: [38, 50, 57, 60, 64] },
];

export function writeScore(file, duration) {
  const frames = Math.round(rate * duration);
  const wav = Buffer.alloc(44 + frames * 4);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 4, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(frames * 4, 40);

  const chords = chordCues.map(cue => ({
    ...cue,
    voices: cue.pitches.map(pitch => TAU * 440 * 2 ** ((pitch - 69) / 12)),
  }));
  const random = randomSeed(68220);
  let breeze = 0, swell = 0, droplets = 0;
  for (let i = 0; i < frames; i++) {
    const t = i / rate;
    const white = random() * 2 - 1;
    breeze += (white - breeze) * .030;
    swell += (white - swell) * .0051;
    droplets += (white - droplets) * .17;
    const sea = (breeze - swell) * (.040 + .021 * Math.sin(t * 1.67)) + swell * .117;
    let left = sea, right = sea * .92 + (droplets - breeze) * .006;
    for (const { start, length, voices } of chords) {
      const elapsed = t - start;
      if (elapsed <= 0 || elapsed >= length) continue;
      const gain = Math.pow(Math.sin(Math.PI * elapsed / length), 1.38) * .126;
      for (let n = 0; n < voices.length; n++) {
        const p = voices[n] * elapsed + n * .83 + Math.sin(t * .85 + n) * .49;
        const drift = .11 * Math.sin(t * (1.14 + n * .14));
        const tone = (Math.sin(p) + .18 * Math.sin(p * 2.002 + drift) + .085 * Math.sin(p * 3.998)) * gain / (2.35 + n * .62);
        left += tone * (.80 + .2 * Math.cos(n * 1.7));
        right += tone * (.81 + .19 * Math.sin(n * 2.0 + 1.1)) + Math.sin(p + elapsed * .25) * gain * .037;
      }
    }
    for (const hit of [breach, landing]) {
      const age = t - hit.time + .11;
      if (age <= 0 || age > 3.3) continue;
      const touch = Math.min(1, age * 9) * Math.exp(-age * 1.42);
      const pressure = hit === breach ? .60 : 1;
      const splash = ((droplets - swell) * .39 + (breeze - swell) * .30 + swell * .24) * touch * pressure;
      const thump = Math.sin(TAU * (43 * age + 5.8 * (1 - Math.exp(-age * 2.2)))) * Math.exp(-age * 6.6) * .135 * Math.min(age * 20, 1) * pressure;
      left += (splash + thump) * .82;
      right += splash + thump;
    }
    const fade = Math.max(0, Math.min(1, t / 1.3, (duration - t) / 2.1));
    const offset = 44 + i * 4;
    wav.writeInt16LE(Math.round(Math.tanh(left * 2.18) * fade * 30000), offset);
    wav.writeInt16LE(Math.round(Math.tanh(right * 2.18) * fade * 30000), offset + 2);
  }
  writeFileSync(file, wav);
}
