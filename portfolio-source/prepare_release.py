#!/usr/bin/env python3
"""Build GitHub Pages with the approved résumé and the archived game unchanged."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import stat
import tempfile
import zipfile

from PIL import Image
from build_site import ALIASES, Portfolio
from delivery_assets import webp

REPO = Path(__file__).resolve().parent.parent
SOURCE = REPO / 'portfolio-source'
REVISION = '2026-11-20-portfolio-redo'


def source_fingerprint():
    inputs = [REPO / 'data/profile.json', REPO / 'resume.pdf', REPO / 'requirements-build.txt']
    inputs += [SOURCE / filename for filename in (
        'prepare_release.py', 'build_site.py', 'profile_data.py', 'contact.py', 'delivery_assets.py',
        'portfolio.css', 'portfolio-interactions.js', 'appearance-init.js', 'pwa-client.js', 'sw-template.js',
    )]
    digest = hashlib.sha256()
    for path in inputs:
        digest.update(path.relative_to(REPO).as_posix().encode() + b'\0')
        digest.update(hashlib.sha256(path.read_bytes()).digest())
    return digest.hexdigest()


def extract_archive(archive, target):
    root = target.resolve()
    for entry in archive.infolist():
        path = (root / entry.filename).resolve()
        if not path.is_relative_to(root) or stat.S_ISLNK(entry.external_attr >> 16):
            raise RuntimeError('Unsafe publication archive entry')
    archive.extractall(root)


def choose(root, pattern):
    paths = sorted(root.glob(pattern))
    if len(paths) != 1:
        raise RuntimeError(f'Expected one approved asset for {pattern}, found {len(paths)}')
    return paths[0]


def asset(root, path):
    entry = {'src': '/' + path.relative_to(root).as_posix()}
    if path.suffix in {'.png', '.jpeg', '.webp', '.jpg'}:
        with Image.open(path) as image:
            entry.update(width=image.width, height=image.height)
    return entry


def portfolio_assets(root, release):
    retained = {
        'icon': choose(root, 'assets/identity.*.svg'),
        'touch': choose(root, 'assets/identity-touch.*.png'),
        'icon192': choose(root, 'assets/pwa-icon-192.*.png'),
        'icon512': choose(root, 'assets/pwa-icon-512.*.png'),
        'portrait': choose(root, 'assets/portrait-white-960.*.webp'),
        'ribbon': choose(root, 'assets/ribbon-480.*.webp'),
        'game': choose(root, 'assets/garden-current-play.*.webp'),
        'ice': choose(root, 'assets/ice-cover.*.webp'),
        'poster': choose(root, 'assets/poster-preview.*.webp'),
        'resume': choose(root, 'assets/resume-preview.*.webp'),
        'certificate': root / 'honor/live-honor-2026.jpeg',
    }
    preserved = set(retained.values())
    preserved.update(root / name for name in (
        'assets/fonts/Noto-OFL.txt', 'assets/media/CREDITS.md', 'assets/media/intro-script.txt', 'poster/poster.png',
        release['film']['compact'], release['film']['captions'], release['film']['video'],
        release['film']['mobileVideo'], release['film']['poster'],
    ))
    for path in root.rglob('*'):
        if path.is_file() and path not in preserved and path.relative_to(root).parts[0] != 'game':
            path.unlink()
    images = {key: asset(root, path) for key, path in retained.items()}
    responsive = {
        'portrait': (480, 80, '(max-width: 520px) 64vw, (max-width: 799px) 336px, 408px'),
        'ribbon': (256, 66, '(max-width: 799px) 40vw, 288px'),
        'game': (680, 76, '(max-width: 928px) calc(100vw - 48px), 880px'),
        'poster': (512, 76, '312px'),
    }
    for key, (width, quality, sizes) in responsive.items():
        smaller = webp(root, retained[key], f'{key}-compact', width, quality)
        images[key + '_mobile'] = {**smaller, 'src': '/' + smaller['src']}
        images[key].update(
            srcset=f'/{smaller["src"]} {smaller["width"]}w, {images[key]["src"]} {images[key]["width"]}w',
            sizes=sizes,
        )
    return images


def write_metadata(root, site, release, assets):
    (root / 'release.json').write_text(json.dumps(release, ensure_ascii=False) + '\n')
    manifest = {
        'name': '马嘉程', 'short_name': '马嘉程', 'lang': 'zh-CN', 'start_url': '/', 'scope': '/',
        'display': 'standalone', 'background_color': '#f6f8fa', 'theme_color': '#f6f8fa',
        'icons': [{'src': assets[key]['src'], 'sizes': f'{size}x{size}', 'type': 'image/png'}
                  for key, size in (('icon192', 192), ('icon512', 512))],
    }
    (root / 'manifest.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False) + '\n')
    (root / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /game/\nDisallow: /{release["resume"]["file"]}\n')
    (root / '.nojekyll').touch()
    image_keys = ('icon', 'touch', 'portrait', 'portrait_mobile', 'ribbon', 'game', 'ice', 'poster', 'resume', 'certificate', 'ribbon_mobile', 'game_mobile', 'poster_mobile')
    cache_pages = [url for url in site.html if url.lstrip('/') not in ALIASES]
    files = sorted([*cache_pages, site.css, site.js, '/manifest.webmanifest',
                    *(assets[key]['src'] for key in image_keys)])
    cache_id = hashlib.sha256(b''.join((root / url[1:]).read_bytes() for url in files)).hexdigest()[:16]
    worker = (SOURCE / 'sw-template.js').read_text()
    worker = worker.replace('CACHE_VERSION', cache_id).replace('CACHE_FILES', json.dumps(files))
    (root / 'sw.js').write_text(worker)
    (root / 'sw-state.json').write_text(json.dumps({'enabled': True, 'version': cache_id}) + '\n')


def prepare(keep_archive=False, use_archive_if_current=False):
    release_zip = REPO / 'deploy.zip'
    with tempfile.TemporaryDirectory(prefix='portfolio-build-', dir=REPO) as temporary:
        root = Path(temporary)
        with zipfile.ZipFile(release_zip) as archive:
            release = json.loads(archive.read('release.json'))
            extract_archive(archive, root)

        if not (use_archive_if_current and release.get('sourceFingerprint') == source_fingerprint()):
            release['commit'] = os.environ.get('GITHUB_SHA', 'local-review')
            release['siteRevision'] = REVISION
            release['sourceFingerprint'] = source_fingerprint()
            release['film']['compact'] = choose(root, 'assets/media/film-compact.*.mp4').relative_to(root).as_posix()
            assets = portfolio_assets(root, release)
            site = Portfolio(root, assets, release)
            site.home()
            site.rest()
            write_metadata(root, site, release, assets)

        pdf = REPO / 'resume.pdf'
        if hashlib.sha256(pdf.read_bytes()).hexdigest() != release['resume']['sha256']:
            raise RuntimeError('Repository résumé does not match the approved version')
        shutil.copy2(pdf, root / release['resume']['file'])
        subprocess.run(['python3', 'validate_site.py', str(root), '--published', '--pdf', str(pdf)], cwd=REPO, check=True)
        subprocess.run(['python3', 'portfolio-source/audit_release.py', str(root)], cwd=REPO, check=True)
        published = REPO / '_site'
        if published.exists():
            shutil.rmtree(published)
        shutil.copytree(root, published)

        if not keep_archive:
            (root / release['resume']['file']).unlink()
            next_archive = REPO / 'deploy.next.zip'
            with zipfile.ZipFile(next_archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
                for path in sorted(root.rglob('*')):
                    if path.is_file():
                        entry = zipfile.ZipInfo(path.relative_to(root).as_posix(), date_time=(2026, 1, 1, 0, 0, 0))
                        entry.compress_type = zipfile.ZIP_DEFLATED
                        entry.external_attr = 0o100644 << 16
                        archive.writestr(entry, path.read_bytes())
            next_archive.replace(release_zip)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preserve-game', action='store_true', help='Retained for existing build commands. The game is always preserved.')
    parser.add_argument('--keep-archive', action='store_true', help='Validate without changing the tracked asset archive.')
    parser.add_argument('--use-archive-if-current', action='store_true', help='Reuse a validated archive with the same build inputs.')
    args = parser.parse_args()
    prepare(args.keep_archive, args.use_archive_if_current)
