#!/usr/bin/env python3
"""Build the complete current website and its single publication archive."""
from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import subprocess
import zipfile

REPO=Path(__file__).resolve().parent.parent
SOURCE=REPO/'portfolio-source'
SITE=SOURCE/'site'
REVISION='2026-10-24-direct-touch-depth'

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

def prepare():
    # Every release starts from the sole current archive, never a stale build folder.
    if SITE.exists(): shutil.rmtree(SITE)
    SITE.mkdir(parents=True)
    with zipfile.ZipFile(REPO/'deploy.zip') as archive:
        for name in archive.namelist():
            target=(SITE/name).resolve()
            if not target.is_relative_to(SITE.resolve()): raise RuntimeError('Unsafe archive entry')
        archive.extractall(SITE)
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
    run('python3','portfolio-source/film/render.py')
    from film.cache_probe import write_provenance
    write_provenance(SITE)
    media=json.loads((SOURCE/'film-manifest.json').read_text())
    for pattern,key in [('intro.*.mp4','video'),('intro.*.vtt','captions'),('intro-poster.*.jpg','poster')]:
        for old in (SITE/'assets/media').glob(pattern):
            if old != SITE/media[key]: old.unlink()
    run('python3','portfolio-source/build_site.py')
    fingerprint_portfolio_artwork(SITE)
    film=json.loads((SOURCE/'film-manifest.json').read_text())
    release={'commit':os.environ.get('GITHUB_SHA','local-review'),'siteRevision':REVISION,'film':{k:film[k] for k in ('video','poster','captions','duration','width','height','fps','master_fps','master_frames')},'visitorAnalytics':{'enabled':False},'filmSHA256':hashlib.sha256((SITE/film['video']).read_bytes()).hexdigest()}
    (SITE/'release.json').write_text(json.dumps(release,ensure_ascii=False))
    run('python3','validate_site.py',str(SITE),'--pdf','resume.pdf')
    if (SOURCE/'audit_release.py').exists(): run('python3','portfolio-source/audit_release.py',str(SITE))
    temporary=REPO/'deploy.next.zip'
    with zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for path in sorted(SITE.rglob('*')):
            if path.is_file():
                item=zipfile.ZipInfo(path.relative_to(SITE).as_posix(),date_time=(2026,1,1,0,0,0))
                item.compress_type=zipfile.ZIP_DEFLATED
                item.external_attr=0o100644 << 16
                archive.writestr(item,path.read_bytes())
    temporary.replace(REPO/'deploy.zip')
    published=REPO/'_site'
    if published.exists(): shutil.rmtree(published)
    shutil.copytree(SITE,published)
    pdf=REPO/'resume.pdf'
    name='resume-'+hashlib.sha256(pdf.read_bytes()).hexdigest()[:12]+'.pdf'
    shutil.copy2(pdf,published/'resume.pdf')
    shutil.copy2(pdf,published/name)
    pattern=r'''(href=["'])([^"']*?)resume\.pdf(?:\?[^"']*)?(["'])'''
    for page in published.rglob('*.html'):
        text=page.read_text(encoding='utf-8')
        page.write_text(re.sub(pattern,lambda m:m[1]+m[2]+name+m[3],text),encoding='utf-8')
    run('python3','validate_site.py',str(published),'--published','--pdf','resume.pdf')

if __name__=='__main__': prepare()
