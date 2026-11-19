#!/usr/bin/env node
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { duration, width, height, fps } from './ice/scene.mjs';
import { cards, chapters } from './cards.mjs';
import { writeScore } from './score.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const { values } = parseArgs({ options: {
  output: { type: 'string', default: '.build' },
  workers: { type: 'string', default: '1' },
  clean: { type: 'boolean' },
  software: { type: 'boolean' },
  frames: { type: 'boolean' },
}});
const directory = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(values.output);
const total = duration * fps;
const workers = Number(values.workers);
if (!Number.isInteger(workers) || workers < 1 || workers > 12) throw new Error('Choose 1–12 workers.');

const boot = `<!doctype html><meta charset="utf-8"><style>body{margin:0}</style><canvas></canvas>
<script type="module">
import { createCathedral, width, height, fps } from '/ice/scene.mjs';
import { drawCards } from '/cards.mjs';
const gl = document.querySelector('canvas');
const film = createCathedral(gl, {capture:true});
film.setSize(width,height);
const clean = new URL(location.href).searchParams.has('clean');
const out = document.createElement('canvas');
out.width = width;
out.height = height;
const context = out.getContext('2d', { alpha: false });
let gameFrame;
if (!clean) {
  const font = new FontFace('Film Noto', 'url(/inputs/ice-title.woff)');
  document.fonts.add(await font.load());
  gameFrame = new Image();
  gameFrame.src = '/game.webp';
  await gameFrame.decode();
}
window.captureFrame = (number, poster = false) => {
  const time = number / fps;
  film.renderAt(time);
  if (clean || poster) return gl.toDataURL('image/jpeg', .97).split(',')[1];
  context.drawImage(gl, 0, 0);
  drawCards(context, time, gameFrame);
  return out.toDataURL('image/jpeg', .97).split(',')[1];
};
</script>`;

const sources = new Set([
  'ice/scene.mjs', 'ice/environment.mjs', 'ice/vessels.mjs',
  'ice/three.module.min.js', 'ice/three.core.min.js', 'cards.mjs', 'inputs/ice-title.woff',
]);
const server = createServer(async (request, response) => {
  const name = new URL(request.url, 'http://localhost').pathname.slice(1);
  try {
    if (name === '') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(boot);
    } else if (name === 'game.webp') {
      response.setHeader('Content-Type', 'image/webp');
      response.end(await readFile(path.join(directory, '../assets-overrides/garden-current-play.webp')));
    } else if (sources.has(name)) {
      response.setHeader('Content-Type', name.endsWith('.woff') ? 'font/woff' : 'text/javascript');
      response.end(await readFile(path.join(directory, name)));
    } else {
      response.writeHead(404).end();
    }
  } catch (error) {
    response.writeHead(500).end(String(error.message));
  }
});

function startFFmpeg(args, stdin = 'ignore') {
  const process = spawn('ffmpeg', ['-nostdin', '-y', '-hide_banner', '-loglevel', 'error', ...args],
    { stdio: [stdin, 'inherit', 'inherit'] });
  const finished = once(process, 'exit').then(([code]) => {
    if (code !== 0) throw new Error(`ffmpeg exited with status ${code}`);
  });
  // A render error may arrive before the caller starts awaiting the encoder.
  finished.catch(() => {});
  return { process, finished };
}

async function renderChunk(index, from, to, url) {
  const args = ['--disable-dev-shm-usage', '--no-sandbox'];
  if (values.software) args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  if (process.env.FILM_SINGLE_PROCESS === '1') args.push('--single-process', '--no-zygote');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH, args });
  const segment = path.join(output, `part-${index}.mp4`);
  const encoder = startFFmpeg([
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-threads', '1', '-i', '-',
    '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'veryfast',
    '-threads', '2', '-vf', 'scale=out_color_matrix=bt709:out_range=tv',
    '-color_primaries', 'bt709', '-colorspace', 'bt709', '-color_trc', 'bt709', segment,
  ], 'pipe');
  encoder.process.stdin.on('error', () => {});
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (/Shader Error|GL_INVALID|INVALID_OPERATION|context lost/i.test(message.text())) errors.push(message.text());
    });
    await page.goto(url);
    await page.waitForFunction(() => typeof window.captureFrame === 'function', undefined, { timeout: 60000 });
    for (let frame = from; frame < to; frame++) {
      const jpg = await page.evaluate(number => window.captureFrame(number), frame);
      if (errors.length) throw new Error(errors.join('\n'));
      const image = Buffer.from(jpg, 'base64');
      if (image.length < 1000) throw new Error(`Frame ${frame} has no usable pixels`);
      if (values.frames) await writeFile(path.join(output, 'frames', `frame-${String(frame).padStart(4,'0')}.jpg`), image);
      await new Promise((resolve, reject) => encoder.process.stdin.write(image, error => error ? reject(error) : resolve()));
      if ((frame - from + 1) % 25 === 0 || frame === to - 1) console.log(`Segment ${index + 1}: ${frame - from + 1}/${to - from}`);
    }
    if (index === 0) {
      const still = await page.evaluate(() => window.captureFrame(52, true));
      await writeFile(path.join(output, 'poster.jpg'), Buffer.from(still, 'base64'));
    }
    encoder.process.stdin.end();
    await encoder.finished;
    return segment;
  } catch (error) {
    encoder.process.kill();
    throw error;
  } finally {
    await browser.close();
  }
}

await mkdir(output, { recursive: true });
if (values.frames) await mkdir(path.join(output, 'frames'), { recursive: true });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const url = `http://127.0.0.1:${server.address().port}/${values.clean ? '?clean' : ''}`;
  const parts = await Promise.all(Array.from({ length: workers }, (_, index) =>
    renderChunk(index, Math.round(total * index / workers), Math.round(total * (index + 1) / workers), url),
  ));
  const audio = path.join(output, 'score.wav');
  writeScore(audio, duration);
  const concat = path.join(output, 'segments.txt');
  await writeFile(concat, parts.map(file => `file '${path.basename(file)}'`).join('\n') + '\n');
  const master = path.join(output, values.clean ? 'cathedral-of-ice.mp4' : 'film.mp4');
  await startFFmpeg([
    '-f', 'concat', '-safe', '1', '-i', concat, '-i', audio, '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', String(duration), master,
  ]).finished;
  if (!values.clean) {
    await writeFile(path.join(output,'timeline.json'), JSON.stringify({
      title: 'Cathedral of Ice', title_zh: '冰之圣殿', duration, width, height, fps,
      frames: total, chapters, cards: cards.map(({ kind, ...card }) => card),
    }, null, 2) + '\n');
  }
  await Promise.all([...parts, audio, concat].map(file => rm(file)));
  console.log(`Exported ${master}`);
} finally {
  server.close();
}
