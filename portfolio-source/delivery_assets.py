"""Generate compact viewing assets from the original, tracked inputs."""

import hashlib
import io
import json
from pathlib import Path
import subprocess
import tempfile

from PIL import Image


def fingerprint(root, directory, stem, extension, data):
    name = f'{directory}/{stem}.{hashlib.sha256(data).hexdigest()[:12]}.{extension}'
    output = root / name
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(data)
    return name


def webp(root, source, stem, width, quality):
    with Image.open(root / source) as image:
        image.thumbnail((width, width * 2), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, format='WEBP', quality=quality, method=6)
        target = fingerprint(root, 'assets', stem, 'webp', buffer.getvalue())
        return {'src': target, 'width': image.width, 'height': image.height}


def compact_images(root, ribbon, poster):
    return {
        'ribbon': [webp(root, ribbon, f'ribbon-{width}', width, quality)
                   for width, quality in ((480, 78), (800, 79))],
        'avatar': webp(root, 'assets/portrait-white-960.b8bfe698eef3.webp', 'avatar', 144, 83),
        'filmPoster': webp(root, poster, 'ice-cover', 800, 78),
        'gamePreview': webp(root, 'assets/garden-current-home.webp', 'game-preview', 680, 77),
    }


def viewing_video(root, media):
    """Serve compact H.264 renditions and keep the original as a download."""
    manifest = root / 'assets/media/viewing-video.json'
    source = media['video']
    for candidate in (root, root.parents[1] / '_site'):
        try:
            current = json.loads((candidate / 'assets/media/viewing-video.json').read_text())
            if current['version'] != 1 or current['source'] != source:
                continue
            payloads = {}
            for key in ('standard', 'compact'):
                path = Path(current[key])
                if path.parent != Path('assets/media') or not path.name.startswith(f'film-{key}.'):
                    raise ValueError('Invalid cached rendition path')
                payload = (candidate / path).read_bytes()
                if path.name != f'film-{key}.{hashlib.sha256(payload).hexdigest()[:12]}.mp4':
                    raise ValueError('Invalid cached rendition digest')
                payloads[path] = payload
            for path, payload in payloads.items():
                (root / path).write_bytes(payload)
            manifest.write_text(json.dumps(current, sort_keys=True))
            return current
        except (OSError, ValueError, KeyError):
            continue

    result = {'version': 1, 'source': source}
    with tempfile.TemporaryDirectory() as temporary:
        for name, width, crf in (('standard', 1440, 24), ('compact', 960, 27)):
            output = Path(temporary) / f'{name}.mp4'
            subprocess.run([
                'ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
                '-i', str(root / source), '-vf', f'scale={width}:-2:flags=lanczos',
                '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', str(crf),
                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', str(output),
            ], check=True)
            result[name] = fingerprint(root, 'assets/media', f'film-{name}', 'mp4', output.read_bytes())
    for asset in (root / 'assets/media').glob('film-*.mp4'):
        if asset.name not in {Path(result['standard']).name, Path(result['compact']).name}:
            asset.unlink()
    manifest.write_text(json.dumps(result, sort_keys=True))
    return result


def quick_look(root, original):
    """Rasterize the first page below its contact line."""
    from xml.etree import ElementTree

    box = ElementTree.fromstring(subprocess.check_output([
        'pdftotext', '-f', '1', '-l', '1', '-bbox', str(original), '-',
    ]))
    page = next(box.iterfind('.//{*}page'))
    private_bottom = []
    for word in page.iterfind('.//{*}word'):
        value = word.text or ''
        if '@' in value or (value.isdecimal() and len(value) == 11):
            private_bottom.append(float(word.attrib['yMax']))
    if not private_bottom:
        raise RuntimeError('Unable to identify the contact line for the resume preview')
    pixels = subprocess.check_output([
        'pdftoppm', '-f', '1', '-l', '1', '-scale-to', '880', '-singlefile', '-png', str(original),
    ])
    with Image.open(io.BytesIO(pixels)) as image:
        crop = int(image.height * (max(private_bottom) + 10) / float(page.attrib['height']))
        preview = image.crop((0, crop, image.width, image.height)).convert('RGB')
        data = io.BytesIO()
        preview.save(data, 'WEBP', quality=81, method=6)
    return {'src': fingerprint(root, 'assets', 'resume-preview', 'webp', data.getvalue()),
            'width': preview.width, 'height': preview.height}


def site_music(root, source):
    """Keep the approved local soundtrack available as an opt-in media file."""
    output = subprocess.check_output([
        'ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-i', str(root / source),
        '-map', '0:a:0', '-c:a', 'aac', '-b:a', '64k', '-f', 'adts', 'pipe:1',
    ])
    return fingerprint(root, 'assets/media', 'site-music', 'aac', output)
