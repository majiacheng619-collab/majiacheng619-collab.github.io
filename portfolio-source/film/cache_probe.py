#!/usr/bin/env python3
"""Verify the archive input and outputs of Cathedral of Ice."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
from tempfile import TemporaryDirectory
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
RENDERED_OUTPUTS = ('video', 'poster', 'captions')
ASSETS = {
    'video': ('intro', 'mp4'),
    'mobileVideo': ('intro-mobile', 'mp4'),
    'poster': ('intro-poster', 'jpg'),
    'captions': ('intro', 'vtt'),
}
MOBILE_PROFILE = 1
MOBILE_SIZE = (1280, 720)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def source_hashes():
    return {name: digest((ROOT / name).read_bytes()) for name in RENDER_INPUTS}


def signature():
    inputs = {**source_hashes(), 'game-frame': digest(GAME_FRAME.read_bytes())}
    return digest(json.dumps(inputs, sort_keys=True).encode())


def artifacts_valid(read, manifest, keys=ASSETS):
    for key in keys:
        prefix, extension = ASSETS[key]
        name = manifest.get(key, '')
        hashed = re.fullmatch(rf'assets/media/{prefix}\.([0-9a-f]{{12}})\.{extension}', name)
        try:
            if not hashed or digest(read(name))[:12] != hashed[1]:
                return False
        except (FileNotFoundError, KeyError):
            return False
    return True


def mobile_current(read, cache):
    return cache.get('mobileProfile') == MOBILE_PROFILE and artifacts_valid(
        read, cache['manifest'], ('mobileVideo',),
    )


def provenance_valid(read, paths):
    cache = json.loads(read(CACHE))
    manifest = cache['manifest']
    if cache.get('mobileProfile') != MOBILE_PROFILE or any(manifest.get(key) not in paths for key in ASSETS):
        return False
    expected = {
        'renderKey': signature(),
        'sources': source_hashes(),
        'gameFrameSHA256': digest(GAME_FRAME.read_bytes()),
        'outputs': {manifest[key]: digest(read(manifest[key])) for key in ASSETS},
    }
    return expected == json.loads((ROOT / 'provenance.json').read_text())


def cached(*, master_only=False):
    try:
        with zipfile.ZipFile(REPO / 'deploy.zip') as archive:
            info = json.loads(archive.read(CACHE))
            return (info['renderKey'] == signature()
                    and artifacts_valid(archive.read, info['manifest'], RENDERED_OUTPUTS)
                    and (master_only or mobile_current(archive.read, info)))
    except (OSError, ValueError, KeyError, zipfile.BadZipFile):
        return False


def probe_video(file, timeline, size=None):
    data = json.loads(subprocess.check_output(
        ['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(file)],
    ))
    video = next(track for track in data['streams'] if track['codec_type'] == 'video')
    audio = next(track for track in data['streams'] if track['codec_type'] == 'audio')
    width, height = size or (timeline['width'], timeline['height'])
    assert (video['width'], video['height'], int(video['nb_frames'])) == (width, height, timeline['frames']), (
        'Exported video size or frame count does not match timeline'
    )
    assert video['r_frame_rate'] == f'{timeline["fps"]}/1', 'Exported video has an unexpected frame rate'
    assert abs(float(data['format']['duration']) - timeline['duration']) < .015, 'Exported video duration is wrong'
    assert (video['codec_name'], video['pix_fmt'], audio['codec_name'], audio['channels']) == (
        'h264', 'yuv420p', 'aac', 2,
    ), 'Expected an iPhone-compatible H.264 and stereo AAC export'


def timestamp(seconds):
    ms = round(seconds * 1000)
    return f'00:{ms // 60000:02}:{ms // 1000 % 60:02}.{ms % 1000:03}'


def card_text(card):
    heading = card['heading']
    if card.get('byline'):
        heading = f'我是{card["byline"]}。{heading}'
    return '　'.join((heading, *card['lines']))


def register_asset(site, key, data):
    prefix, suffix = ASSETS[key]
    name = f'assets/media/{prefix}.{digest(data)[:12]}.{suffix}'
    (site / name).write_bytes(data)
    return name


def register_mobile(site, master, timeline):
    width, height = MOBILE_SIZE
    with TemporaryDirectory() as temporary:
        file = Path(temporary) / 'film.mp4'
        subprocess.run([
            'ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-filter_threads', '2',
            '-i', str(site / master), '-map', '0:v:0', '-map', '0:a:0',
            '-vf', f'scale={width}:{height}:flags=lanczos', '-c:v', 'libx264',
            '-threads', '4', '-preset', 'medium', '-crf', '20', '-maxrate', '1800k', '-bufsize', '1100k',
            '-g', str(timeline['fps']), '-sc_threshold', '0', '-pix_fmt', 'yuv420p',
            '-profile:v', 'high', '-level:v', '3.1', '-c:a', 'copy', '-movflags', '+faststart', str(file),
        ], check=True)
        probe_video(file, timeline, MOBILE_SIZE)
        return register_asset(site, 'mobileVideo', file.read_bytes())


def register_export(site, output):
    timeline = json.loads((output / 'timeline.json').read_text())
    probe_video(output / 'film.mp4', timeline)
    from PIL import Image
    with Image.open(output / 'poster.jpg') as poster:
        assert poster.size == (timeline['width'], timeline['height']), 'Poster dimensions differ from the film'
        poster.verify()
    cues = [(card['start'], card['end'], card_text(card)) for card in timeline['cards']]
    start, end, text = cues[0]
    cues[0] = start, end, f'［器乐与海浪声］\n{text}'
    cues.append((14.53, 16.50, '［鲸鱼落水与海浪声］'))
    cue_lines = ['WEBVTT', '']
    for start, end, text in sorted(cues):
        cue_lines.extend((f'{timestamp(start)} --> {timestamp(end)}', text, ''))
    assets = {
        'video': (output / 'film.mp4').read_bytes(),
        'poster': (output / 'poster.jpg').read_bytes(),
        'captions': '\n'.join(cue_lines).encode(),
    }
    manifest = {key: timeline[key] for key in ('title', 'title_zh', 'duration', 'width', 'height', 'fps', 'frames', 'chapters')}
    for key, data in assets.items():
        manifest[key] = register_asset(site, key, data)
    (ROOT / 'timeline.json').write_text(json.dumps(timeline, ensure_ascii=False, indent=2) + '\n')
    return manifest


def install_film(site, output=None):
    render_key = signature()
    read = lambda name: (site / name).read_bytes()
    cache = {'manifest': register_export(site, Path(output).resolve())} if output else json.loads(read(CACHE))
    manifest = cache['manifest']
    if not output and (cache['renderKey'] != render_key or not artifacts_valid(read, manifest, RENDERED_OUTPUTS)):
        raise RuntimeError('The film archive does not match its sources. Run film/export.mjs and pass --film-output.')
    timeline = json.loads((ROOT / 'timeline.json').read_text())
    if not mobile_current(read, cache):
        manifest['mobileVideo'] = register_mobile(site, manifest['video'], timeline)
    cache = {'renderKey': render_key, 'mobileProfile': MOBILE_PROFILE, 'manifest': manifest}
    (site / CACHE).write_text(json.dumps(cache, ensure_ascii=False, indent=2) + '\n')
    media = site / 'assets/media'
    for key, (prefix, suffix) in ASSETS.items():
        for asset in media.glob(f'{prefix}.*.{suffix}'):
            if asset != site / manifest[key]:
                asset.unlink()
    (media / 'intro-script.txt').write_text('\n'.join(card_text(card) for card in timeline['cards']) + '\n')
    shutil.copy2(ROOT / 'credits.md', media / 'CREDITS.md')
    provenance = {
        'renderKey': render_key,
        'sources': source_hashes(),
        'gameFrameSHA256': digest(GAME_FRAME.read_bytes()),
        'outputs': {manifest[key]: digest(read(manifest[key])) for key in ASSETS},
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
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--master-only', action='store_true', help='Check whether the 3D scene needs a new render')
    args = parser.parse_args()
    print('true' if cached(master_only=args.master_only) else 'false')
