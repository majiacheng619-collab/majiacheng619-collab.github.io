#!/usr/bin/env python3
"""Build the complete current website and its single publication archive."""
from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import zipfile

REPO=Path(__file__).resolve().parent.parent
SOURCE=REPO/'portfolio-source'
SITE=SOURCE/'site'
REVISION='2026-11-20-ios27-publication'

def run(*args):
    subprocess.run(args,cwd=REPO,check=True)

def fingerprint_portfolio_artwork(root):
    """Give mutable game previews immutable URLs on every portfolio page."""
    replacements = {}
    current = set()
    for source in sorted((root/'assets').glob('garden-current-*.webp')):
        # Overrides carry the canonical unversioned inputs. Inherited hashes are
        # removed only after all generated page references have been updated.
        if re.search(r'\.[a-f0-9]{12}\.webp$', source.name):
            continue
        name = source.stem + '.' + hashlib.sha256(source.read_bytes()).hexdigest()[:12] + '.webp'
        target = source.with_name(name)
        target.write_bytes(source.read_bytes())
        replacements[source.name] = name
        current.add(name)
    if not replacements:
        return
    for page in root.rglob('*.html'):
        content = page.read_text()
        for previous, name in replacements.items():
            stem = re.escape(previous.removesuffix('.webp'))
            content = re.sub(stem + r'(?:\.[a-f0-9]{12})?\.webp', name, content)
        page.write_text(content)
    for old in (root/'assets').glob('garden-current-*.webp'):
        if old.name not in current:
            old.unlink()

def source_fingerprint():
    digest = hashlib.sha256()
    ignored = {'site', '__pycache__', 'film-manifest.json', 'provenance.json', '.build'}
    for base in (SOURCE, REPO / 'data'):
        for path in sorted(base.rglob('*')):
            if not path.is_file() or ignored.intersection(path.relative_to(base).parts):
                continue
            digest.update(path.relative_to(REPO).as_posix().encode() + b'\0')
            digest.update(hashlib.sha256(path.read_bytes()).digest())
    for name in ('resume.pdf', 'requirements-build.txt'):
        digest.update(hashlib.sha256((REPO / name).read_bytes()).digest())
    return digest.hexdigest()


def extract_archive(archive, target):
    if target.exists(): shutil.rmtree(target)
    target.mkdir(parents=True)
    root = target.resolve()
    for entry in archive.infolist():
        path = (root / entry.filename).resolve()
        if not path.is_relative_to(root) or stat.S_ISLNK(entry.external_attr >> 16):
            raise RuntimeError('Unsafe archive entry')
    archive.extractall(root)


def publish(site):
    published = REPO / '_site'
    if published.exists(): shutil.rmtree(published)
    shutil.copytree(site, published)
    pdf = REPO / 'resume.pdf'
    name = 'resume-' + hashlib.sha256(pdf.read_bytes()).hexdigest()[:12] + '.pdf'
    shutil.copy2(pdf, published / name)
    run('python3', 'validate_site.py', str(published), '--published', '--pdf', 'resume.pdf')
    return published


def publish_current_archive():
    with zipfile.ZipFile(REPO / 'deploy.zip') as archive:
        metadata = json.loads(archive.read('release.json'))
        if metadata.get('sourceFingerprint') != source_fingerprint():
            return False
        extract_archive(archive, SITE)
    run('python3', 'portfolio-source/audit_release.py', str(SITE))
    publish(SITE)
    print('Published the validated, committed archive without rebuilding assets.')
    return True


def prepare(preserve_game=False, film_output=None, keep_archive=False):
    # Always begin with the current tracked archive, never a stale build folder.
    with zipfile.ZipFile(REPO/'deploy.zip') as archive:
        frozen_game = {name: archive.read(name) for name in archive.namelist()
                       if name.startswith('game/') and not name.endswith('/')} if preserve_game else None
        if preserve_game and not frozen_game:
            raise RuntimeError('Portfolio-only release requires the published game snapshot')
        extract_archive(archive, SITE)
    artwork=SOURCE/'assets-overrides'
    if artwork.exists(): shutil.copytree(artwork,SITE/'assets',dirs_exist_ok=True)
    overrides=SOURCE/'game-overrides'
    if overrides.exists(): shutil.copytree(overrides,SITE/'game',dirs_exist_ok=True)
    import sys
    sys.path.insert(0, str(SOURCE/'optics'))
    from render_field import build as build_optical_field
    build_optical_field(SITE)
    from game_release import fingerprint
    fingerprint(SITE/'game')
    from clean_release import clean
    clean(SITE)
    for retired in (SITE/'assets').glob('search-index*.json'):
        retired.unlink()
    from film.cache_probe import install_film
    film = install_film(SITE, film_output)
    (SOURCE/'film-manifest.json').write_text(json.dumps(film, ensure_ascii=False))
    run('python3','portfolio-source/build_site.py')
    fingerprint_portfolio_artwork(SITE)
    # A portfolio-only release keeps the published game and its offline cache exact.
    # Build tools may normalize aliases, so restore the input snapshot at the boundary.
    if frozen_game is not None:
        shutil.rmtree(SITE/'game')
        for name, payload in frozen_game.items():
            target = SITE/name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
    release={'commit':os.environ.get('GITHUB_SHA','local-review'),'siteRevision':REVISION,'film':{k:film[k] for k in ('video','mobileVideo','poster','captions','duration','width','height','fps','frames','title','title_zh','chapters')},'resume':{'file':'resume-'+hashlib.sha256((REPO/'resume.pdf').read_bytes()).hexdigest()[:12]+'.pdf','sha256':hashlib.sha256((REPO/'resume.pdf').read_bytes()).hexdigest()},'visitorAnalytics':{'enabled':False},'filmSHA256':hashlib.sha256((SITE/film['video']).read_bytes()).hexdigest()}
    release['sourceFingerprint'] = source_fingerprint()
    (SITE/'release.json').write_text(json.dumps(release,ensure_ascii=False))
    if (SOURCE/'audit_release.py').exists(): run('python3','portfolio-source/audit_release.py',str(SITE))
    published = publish(SITE)
    if frozen_game is not None:
        current = {path.relative_to(published).as_posix(): path.read_bytes()
                   for path in (published/'game').rglob('*') if path.is_file()}
        if current != frozen_game:
            raise RuntimeError('Published game changed during a portfolio-only release')
    if not keep_archive:
        temporary=REPO/'deploy.next.zip'
        with zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
            for path in sorted(SITE.rglob('*')):
                if path.is_file():
                    item=zipfile.ZipInfo(path.relative_to(SITE).as_posix(),date_time=(2026,1,1,0,0,0))
                    item.compress_type=zipfile.ZIP_DEFLATED
                    item.external_attr=0o100644 << 16
                    archive.writestr(item,path.read_bytes())
        temporary.replace(REPO/'deploy.zip')

if __name__=='__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preserve-game', action='store_true',
                        help='Publish portfolio changes while retaining every current game file byte-for-byte')
    parser.add_argument('--film-output', type=Path, help='Use a freshly rendered film export')
    parser.add_argument('--keep-archive', action='store_true', help='Build and check without replacing the tracked input archive')
    parser.add_argument('--use-archive-if-current', action='store_true',
                        help='Publish the committed build if it matches the source fingerprint')
    args = parser.parse_args()
    if args.use_archive_if_current and args.film_output is None and publish_current_archive():
        raise SystemExit(0)
    prepare(preserve_game=args.preserve_game, film_output=args.film_output, keep_archive=args.keep_archive)
