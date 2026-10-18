#!/usr/bin/env python3
"""我校验当前影片输入，确认可复用后再跳过完整渲染依赖。"""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT=Path(__file__).resolve().parent
REPO=ROOT.parent.parent
SOURCES=('render.py','scenes_v3.py','mix_v3.py','inputs/game-demo.mp4','inputs/film-font.otf','inputs/score-license.json')

def signature(read_asset, names, credits=None):
    assets=['poster/poster.png','honor/live-honor-2026.jpeg']
    assets+=sorted(x for x in names if x.startswith('assets/portrait-white-960') and x.endswith('.webp'))
    source=b''.join((ROOT/x).read_bytes() for x in SOURCES)
    source+=(ROOT/'credits.md').read_bytes() if credits is None else credits
    return hashlib.sha256(source+b''.join(read_asset(x) for x in assets)).hexdigest()

def artifacts_valid(read_asset, manifest):
    for key in ('video','poster','captions'):
        name=manifest.get(key,'')
        parts=Path(name).name.split('.')
        if len(parts)<3 or hashlib.sha256(read_asset(name)).hexdigest()[:12]!=parts[-2]:
            return False
    return True

def provenance_valid(read_asset, names):
    """我用当前输入与输出的完整哈希，核对不改变成片的维护更新。"""
    file=ROOT/'provenance.json'
    if not file.exists(): return False
    data=json.loads(file.read_text())
    required=set(SOURCES)|{'credits.md'}
    if set(data.get('sources',{}))!=required: return False
    for name,expected in data['sources'].items():
        if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=expected: return False
    for group in ('assets','outputs'):
        for name,expected in data.get(group,{}).items():
            if name not in names or hashlib.sha256(read_asset(name)).hexdigest()!=expected: return False
    return data.get('renderKey')==signature(read_asset,names)

def status(archive):
    if (ROOT.parent/'release-seed').exists(): return 'miss'
    names=archive.namelist()
    for override in (ROOT.parent/'assets-overrides').glob('growth-seed-*.png'):
        name='assets/'+override.name
        if name not in names or override.read_bytes()!=archive.read(name): return 'miss'
    data=json.loads(archive.read('assets/media/film-build.json'))
    if not artifacts_valid(archive.read,data.get('manifest',{})): return 'miss'
    if data.get('renderKey')==signature(archive.read,names): return 'current'
    # I only refresh a documentation signature after all visual/audio inputs match.
    old_credits=archive.read('assets/media/CREDITS.md')
    if data.get('renderKey')==signature(archive.read,names,old_credits): return 'documentation'
    if provenance_valid(archive.read,names): return 'verified-maintenance'
    return 'miss'

def cached():
    try:
        with zipfile.ZipFile(REPO/'deploy.zip') as archive:
            return status(archive) in ('current','documentation','verified-maintenance')
    except (OSError,ValueError,KeyError,zipfile.BadZipFile):
        return False

def refresh_documentation(site):
    """我仅在其余输入与成片校验一致时更新素材说明和缓存签名。"""
    cache=site/'assets/media/film-build.json'
    credits=site/'assets/media/CREDITS.md'
    if not cache.exists() or not credits.exists(): return
    names=[p.relative_to(site).as_posix() for p in site.rglob('*') if p.is_file()]
    read=lambda name:(site/name).read_bytes()
    data=json.loads(cache.read_text())
    if not artifacts_valid(read,data.get('manifest',{})): return
    if data.get('renderKey')!=signature(read,names,credits.read_bytes()) and not provenance_valid(read,names): return
    current=(ROOT/'credits.md').read_bytes()
    if credits.read_bytes()==current and data.get('renderKey')==signature(read,names,current): return
    data['renderKey']=signature(read,names,current)
    credits.write_bytes(current)
    cache.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

def write_provenance(site):
    """我在构建验证通过后记录当前输入与输出，不沿用过期的校验清单。"""
    names=[p.relative_to(site).as_posix() for p in site.rglob('*') if p.is_file()]
    read=lambda name:(site/name).read_bytes()
    cache=json.loads((site/'assets/media/film-build.json').read_text())
    if cache.get('renderKey')!=signature(read,names) or not artifacts_valid(read,cache.get('manifest',{})):
        raise RuntimeError('Cannot record provenance for an unverified film')
    assets=['poster/poster.png','honor/live-honor-2026.jpeg']
    assets+=sorted(x for x in names if x.startswith('assets/portrait-white-960') and x.endswith('.webp'))
    proof={
        'description':'我用这些哈希核对当前影片的输入与成片，确认维护更新没有改变已发布画面、声音和字幕。',
        'renderKey':cache['renderKey'],
        'sources':{x:hashlib.sha256((ROOT/x).read_bytes()).hexdigest() for x in (*SOURCES,'credits.md')},
        'assets':{x:hashlib.sha256(read(x)).hexdigest() for x in assets},
        'outputs':{cache['manifest'][key]:hashlib.sha256(read(cache['manifest'][key])).hexdigest() for key in ('video','poster','captions')},
    }
    (ROOT/'provenance.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':
    print('true' if cached() else 'false')
