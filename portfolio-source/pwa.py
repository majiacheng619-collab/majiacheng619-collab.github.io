"""Generate the install manifest and versioned, same-origin offline shell."""

from pathlib import Path
import hashlib
import io
import json
import re

from PIL import Image
from delivery_assets import fingerprint


def pwa_manifest(root, touch):
    icons = []
    with Image.open(root / touch) as original:
        for dimension in (192, 512):
            output = io.BytesIO()
            original.resize((dimension, dimension), Image.Resampling.LANCZOS).save(output, format='PNG')
            filename = fingerprint(root, 'assets', f'pwa-icon-{dimension}', 'png', output.getvalue())
            icons.append({'src': '/' + filename, 'sizes': f'{dimension}x{dimension}',
                          'type': 'image/png', 'purpose': 'any maskable'})
    manifest = {'id': '/', 'name': '马嘉程 OS', 'short_name': '马嘉程 OS', 'lang': 'zh-CN',
                'start_url': '/', 'scope': '/', 'display': 'standalone', 'background_color': '#071625',
                'theme_color': '#071625', 'icons': icons}
    (root / 'manifest.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False))


def service_worker(root):
    # HTML and essential first-view assets only. Large media, the PDF and the
    # game have their own user-initiated paths.
    pages = [item for item in sorted(root.rglob('*.html')) if not item.is_relative_to(root / 'game') and item.relative_to(root).as_posix() != 'projects/ai-content/index.html']
    cores = {'/' + item.relative_to(root).as_posix() for item in pages}
    cores.add('/manifest.webmanifest')
    assets = root / 'assets'
    for path in assets.iterdir():
        if re.fullmatch(r'(?:portfolio|capture|home-media|identity|avatar|ribbon-480|ribbon-800|apps|control-input|contact-reveal|story|case-preview|gallery|image-viewer)\.[0-9a-f]{12}\.[a-z]+', path.name):
            cores.add('/assets/' + path.name)
    payloads = [item for item in sorted(root.rglob('*'))
                if item.is_file() and not item.is_relative_to(root / 'game') and item.suffix != '.pdf'
                and item.name not in ('sw.js', 'sw-state.json', 'release.json')]
    source = Path(__file__).with_name('sw-template.js').read_text()
    digest = hashlib.sha256(source.encode())
    for item in payloads:
        digest.update(item.relative_to(root).as_posix().encode())
        digest.update(hashlib.sha256(item.read_bytes()).digest())
    version = digest.hexdigest()[:16]
    (root / 'sw-state.json').write_text(json.dumps({'enabled': True, 'version': version},
                                                  separators=(',', ':')))
    (root / 'sw.js').write_text(source.replace('CACHE_VERSION', version).replace('CACHE_FILES', json.dumps(sorted(cores))))
