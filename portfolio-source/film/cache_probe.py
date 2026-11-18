#!/usr/bin/env python3
"""Verify the archive input and outputs of Cathedral of Ice."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent
REPO = SOURCE.parent
CACHE = 'assets/media/film-build.json'
GAME_FRAME = SOURCE / 'assets-overrides/garden-current-play.webp'
RUNTIME = (
    'scene.mjs', 'environment.mjs', 'vessels.mjs', 'preview.mjs',
    'three.module.min.js', 'three.core.min.js', 'three-LICENSE.txt',
)
RENDER_INPUTS = (
    'export.mjs', 'cards.mjs', 'score.mjs', 'inputs/ice-title.woff',
    *(f'ice/{name}' for name in RUNTIME if name not in ('preview.mjs', 'three-LICENSE.txt')),
)
OUTPUTS = ('video', 'poster', 'captions')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def source_hashes():
    return {name: digest((ROOT / name).read_bytes()) for name in RENDER_INPUTS}


def signature():
    inputs = {**source_hashes(), 'game-frame': digest(GAME_FRAME.read_bytes())}
    return digest(json.dumps(inputs, sort_keys=True).encode())


def artifacts_valid(read, manifest):
    extensions = {'video': 'mp4', 'poster': 'jpg', 'captions': 'vtt'}
    for key, extension in extensions.items():
        name = manifest.get(key, '')
        hashed = re.fullmatch(rf'assets/media/intro(?:-poster)?\.([0-9a-f]{{12}})\.{extension}', name)
        if not hashed or digest(read(name))[:12] != hashed[1]:
            return False
    return True


def provenance_valid(read, paths):
    cache = json.loads(read(CACHE))
    manifest = cache['manifest']
    expected = {
        'renderKey': signature(),
        'sources': source_hashes(),
        'gameFrameSHA256': digest(GAME_FRAME.read_bytes()),
        'outputs': {manifest[key]: digest(read(manifest[key])) for key in OUTPUTS},
    }
    return all(manifest[key] in paths for key in OUTPUTS) and expected == json.loads((ROOT / 'provenance.json').read_text())


def cached():
    try:
        with zipfile.ZipFile(REPO / 'deploy.zip') as archive:
            info = json.loads(archive.read(CACHE))
            return info['renderKey'] == signature() and artifacts_valid(archive.read, info['manifest'])
    except (OSError, ValueError, KeyError, zipfile.BadZipFile):
        return False


def probe_video(file, timeline):
    data = json.loads(subprocess.check_output(
        ['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(file)],
    ))
    video = next(track for track in data['streams'] if track['codec_type'] == 'video')
    audio = next(track for track in data['streams'] if track['codec_type'] == 'audio')
    assert (video['width'], video['height'], int(video['nb_frames'])) == (
        timeline['width'], timeline['height'], timeline['frames'],
    ), 'Exported video size or frame count does not match timeline'
    assert video['r_frame_rate'] == f'{timeline["fps"]}/1', 'Exported video has an unexpected frame rate'
    assert abs(float(data['format']['duration']) - timeline['duration']) < .015, 'Exported video duration is wrong'
    assert (video['codec_name'], video['pix_fmt'], audio['codec_name'], audio['channels']) == (
        'h264', 'yuv420p', 'aac', 2,
    ), 'Expected an iPhone-compatible H.264 and stereo AAC export'


def timestamp(seconds):
    ms = round(seconds * 1000)
    return f'00:{ms // 60000:02}:{ms // 1000 % 60:02}.{ms % 1000:03}'


def card_text(card):
    if card['heading'] == '马嘉程':
        return '我是马嘉程，关注产品与运营。'
    return card['heading'] + '　' + '　'.join(card['lines'])


def register_export(site, output, render_key):
    timeline = json.loads((output / 'timeline.json').read_text())
    probe_video(output / 'film.mp4', timeline)
    from PIL import Image
    with Image.open(output / 'poster.jpg') as poster:
        assert poster.size == (timeline['width'], timeline['height']), 'Poster dimensions differ from the film'
        poster.verify()
    cue_lines = ['WEBVTT', '', '00:00:00.000 --> 00:00:00.300', '［器乐与海浪声］', '']
    for card in timeline['cards']:
        cue_lines.extend((
            f'{timestamp(card["start"])} --> {timestamp(card["end"])}',
            card_text(card), '',
        ))
        if card['end'] == 12.53:
            cue_lines.extend(('00:00:14.800 --> 00:00:16.500', '［鲸鱼落水与海浪声］', ''))
    assets = {
        'video': ('intro', 'mp4', (output / 'film.mp4').read_bytes()),
        'poster': ('intro-poster', 'jpg', (output / 'poster.jpg').read_bytes()),
        'captions': ('intro', 'vtt', '\n'.join(cue_lines).encode()),
    }
    manifest = {key: timeline[key] for key in ('title', 'title_zh', 'duration', 'width', 'height', 'fps', 'frames', 'chapters')}
    for key, (prefix, suffix, data) in assets.items():
        name = f'assets/media/{prefix}.{digest(data)[:12]}.{suffix}'
        (site / name).write_bytes(data)
        manifest[key] = name
    (ROOT / 'timeline.json').write_text(json.dumps(timeline, ensure_ascii=False, indent=2) + '\n')
    (site / CACHE).write_text(json.dumps({'renderKey': render_key, 'manifest': manifest}, ensure_ascii=False, indent=2) + '\n')
    return manifest


def install_film(site, output=None):
    render_key = signature()
    read = lambda name: (site / name).read_bytes()
    if output:
        manifest = register_export(site, Path(output).resolve(), render_key)
    else:
        cache = json.loads(read(CACHE))
        manifest = cache['manifest']
        if cache['renderKey'] != render_key or not artifacts_valid(read, manifest):
            raise RuntimeError('The film archive does not match its sources. Run film/export.mjs and pass --film-output.')
    timeline = json.loads((ROOT / 'timeline.json').read_text())
    media = site / 'assets/media'
    for pattern, key in [('intro.*.mp4', 'video'), ('intro.*.vtt', 'captions'), ('intro-poster.*.jpg', 'poster')]:
        for asset in media.glob(pattern):
            if asset != site / manifest[key]:
                asset.unlink()
    (media / 'intro-script.txt').write_text('\n'.join(card_text(card) for card in timeline['cards']) + '\n')
    shutil.copy2(ROOT / 'credits.md', media / 'CREDITS.md')
    provenance = {
        'renderKey': render_key,
        'sources': source_hashes(),
        'gameFrameSHA256': digest(GAME_FRAME.read_bytes()),
        'outputs': {manifest[key]: digest(read(manifest[key])) for key in OUTPUTS},
    }
    (ROOT / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
    runtime_key = digest(b''.join((ROOT / 'ice' / name).read_bytes() for name in RUNTIME))[:12]
    route = f'assets/ice.{runtime_key}'
    target = site / route
    for retired in (site / 'assets').glob('ice.*'):
        if retired.is_dir() and retired != target:
            shutil.rmtree(retired)
    target.mkdir(exist_ok=True)
    for name in RUNTIME:
        shutil.copy2(ROOT / 'ice' / name, target / name)
    manifest['preview'] = f'{route}/preview.mjs'
    return manifest


if __name__ == '__main__':
    print('true' if cached() else 'false')
