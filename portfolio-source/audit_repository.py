#!/usr/bin/env python3
"""我在发布前核对当前源码、正式简历、文档与归档清理状态。"""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

ROOT=Path(__file__).resolve().parent.parent
OBSOLETE_SOURCE=('visitor-service','portfolio-source/analytics','portfolio-source/analytics-config.json','portfolio-source/editorial.py','portfolio-source/detail.css','portfolio-source/game-runtime/garden-legacy6.js','portfolio-source/content.py','visitor-service/setup.py','visitor-service/activate.py','visitor-service/wrangler.jsonc','portfolio-source/game-overrides/replay-view.js','portfolio-source/game-runtime/garden-cloud.js')
OBSOLETE_ARCHIVE=('assets/fonts/OFL.txt', '.gitignore','assets/favicon.99c44e666ff1.svg','assets/apple-touch-icon.e2c55cba898e.png','assets/game-cover.jpg','assets/portrait-white-480.d1f641e10fd2.webp')
# 我逐次发现全部自撰文档，避免新增说明漏过固定名单。
DOCS=tuple(sorted(p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*.md')
                  if '.git' not in p.parts and not any(x in p.parts for x in ('site','_site','node_modules')))) + ('portfolio-source/game-overrides/LICENSE.txt',)


def document_errors(name, text):
    errors=[]
    if '我' not in text: errors.append('Missing first-person documentation: '+name)
    if re.search(r'该用户|为用户撰写|你可以|请你|your website|the user',text,re.I):
        errors.append('Review document viewpoint: '+name)
    return errors



def audit():
    errors=[]
    names=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard'],cwd=ROOT,text=True).splitlines()
    files=sorted({ROOT/name for name in names if (ROOT/name).is_file()})
    for relative in OBSOLETE_SOURCE:
        if (ROOT/relative).exists(): errors.append('Obsolete source remains: '+relative)
    pdfs=[p.relative_to(ROOT).as_posix() for p in files if p.suffix.lower()=='.pdf']
    if pdfs!=['resume.pdf']: errors.append('Expected only the current resume.pdf: '+repr(pdfs))
    for file in files:
        relative=file.relative_to(ROOT).as_posix()
        if file.stat().st_size==0: errors.append('Empty tracked file: '+relative)
        if re.search(r'(?:^|[._-])(?:backup|obsolete|old|bak)(?:[._-]|$)',file.name,re.I):
            errors.append('Review obsolete-looking filename: '+relative)
        if file.suffix in ('.py','.js','.mjs','.cjs','.md','.json','.yml','.yaml','.html','.txt'):
            text=file.read_text()
            # I report only paths, never matched secret values.
            if re.search(r'(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|cfat_[A-Za-z0-9_-]{25,})',text):
                errors.append('Possible embedded access token: '+relative)
    for relative in DOCS:
        text=(ROOT/relative).read_text()
        errors.extend(document_errors(relative,text))
    with zipfile.ZipFile(ROOT/'deploy.zip') as archive:
        entries=archive.infolist();paths=archive.namelist()
        for entry in entries:
            if entry.is_dir(): errors.append('Directory entry in publication archive: '+entry.filename)
            if entry.file_size==0 and entry.filename!='.nojekyll': errors.append('Empty publication file: '+entry.filename)
        if any(re.search(r'(?:^|/)garden-cloud(?:\.[a-f0-9]{12})?\.js$',name) for name in paths):
            errors.append('Disabled cloud runtime remains in archive')
        if any(re.search(r'(?:^|/)replay-view(?:\.[a-f0-9]{12})?\.js$',name) for name in paths):
            errors.append('Retired duplicate replay code remains in archive')
        for name in paths:
            if re.search(r'(?:^|/)garden-legacy[^/]*\.js$', name):
                errors.append('Historical game runtime remains: '+name)
            if name.startswith('assets/vendor/diyoriko-portfolio/'):
                errors.append('Retired template metadata remains: '+name)
            if re.search(r'(?:^|/)ambient\.[^/]+\.mp3$', name):
                errors.append('Unused ambient track remains: '+name)
        retired = re.compile(r'^(?:visitors|privacy)/|(?:^|/)(?:visitor-(?:tracker|privacy|config)|visitors\.|analytics-config)')
        for name in paths:
            if retired.search(name): errors.append('Retired visitor module remains in archive: '+name)
            if re.search(r'(?:^|/)search-index(?:\.[a-f0-9]+)?\.json$', name):
                errors.append('Retired website search index remains in archive: '+name)
            if not name.startswith('game/') and name.endswith(('.html', '.js', '.json')) and re.search(r'data-search-open|id=[\"\']search-dialog|data-search-index', archive.read(name).decode()):
                errors.append('Retired website search reference in archive: '+name)
            if name.endswith(('.html', '.js', '.json')) and re.search(r'visitor-tracker|visitor-config|mjc-visitor-records-619\.pages\.dev|data-privacy-toggle', archive.read(name).decode()):
                errors.append('Retired analytics reference in archive: '+name)
        if json.loads(archive.read('release.json')).get('visitorAnalytics',{}).get('enabled') is not False:
            errors.append('Archive must explicitly disable visitor analytics')
        for name in paths:
            if name.endswith('.md') or name in ('game/LICENSE.txt','assets/media/intro-script.txt'):
                errors.extend(document_errors(name,archive.read(name).decode()))
        for name in OBSOLETE_ARCHIVE:
            if name in paths: errors.append('Obsolete archived asset: '+name)
        if any(Path(name).suffix.lower()=='.pdf' for name in paths): errors.append('Resume must come from the single root source')
        for prefix,suffix in [('assets/portfolio.','.css'),('assets/portfolio.','.js'),('assets/media/intro.','.mp4'),('assets/media/intro.','.vtt'),('assets/media/intro-poster.','.jpg'),('assets/identity.','.svg'),('assets/identity-touch.','.png')]:
            matches=[name for name in paths if name.startswith(prefix) and name.endswith(suffix)]
            if len(matches)!=1: errors.append('Expected one current asset: '+prefix+suffix)
        if archive.read('assets/media/CREDITS.md')!=(ROOT/'portfolio-source/film/credits.md').read_bytes():
            errors.append('Published credits differ from my current source')
        if archive.read('game/LICENSE.txt')!=(ROOT/'portfolio-source/game-overrides/LICENSE.txt').read_bytes():
            errors.append('My game permission notice differs from its source')
        from film.cache_probe import signature,artifacts_valid,provenance_valid
        cache=json.loads(archive.read('assets/media/film-build.json'))
        if cache.get('renderKey')!=signature(archive.read,paths): errors.append('Film cache signature is stale')
        if not artifacts_valid(archive.read,cache.get('manifest',{})): errors.append('Current film hash validation failed')
        if not provenance_valid(archive.read,paths): errors.append('Current film provenance differs from the archive')
    report={'ok':not errors,'sourceFiles':len(files),'authoredDocuments':len(DOCS),'currentResumeSHA256':hashlib.sha256((ROOT/'resume.pdf').read_bytes()).hexdigest(),'archiveFiles':len(entries),'archiveDirectoryEntries':sum(entry.is_dir() for entry in entries),'errors':errors}
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return not errors

if __name__=='__main__':
    raise SystemExit(0 if audit() else 1)
