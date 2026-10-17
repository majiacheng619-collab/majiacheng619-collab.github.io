"""我从可维护源码构建游戏，为所有运行资源生成内容地址与离线缓存。"""
from pathlib import Path
import hashlib
import json
import re


def fingerprint(game):
    source = Path(__file__).parent / 'game-runtime'
    aliases=json.loads((source/'asset-names.json').read_text())
    runtime = {alias:(source/name).read_text() for alias,name in aliases.items()}
    for stem in ('presentation.css','presentation.js'):
        runtime[stem]=(game/stem).read_text()
    icon=Path(__file__).parent/'game-overrides/favicon.svg'
    if icon.exists():
        runtime['favicon.09a0d5017eeb.svg']=icon.read_text()
        for size,old in [(192,'458cf4f70713'),(512,'cf15a8e8caf9')]:
            runtime[f'assets/pwa-{size}.{old}.png']=(icon.parent/f'pwa-{size}.png').read_bytes()
    # Resolve dependencies first, so the boot loader's own hash includes its children.
    resolved={}
    pending=dict(runtime)
    while pending:
        advanced=False
        for name,content in list(pending.items()):
            deps=[other for other in runtime if other!=name and isinstance(content,str) and other in content]
            if any(dep not in resolved for dep in deps): continue
            if isinstance(content,str):
                for old in sorted(resolved,key=len,reverse=True): content=content.replace(old,resolved[old])
            base=re.sub(r'\.[a-f0-9]{12}(?=\.)','',name)
            stem,ext=base.rsplit('.',1)
            payload=content.encode() if isinstance(content,str) else content
            target=stem+'.'+hashlib.sha256(payload).hexdigest()[:12]+'.'+ext
            (game/target).write_bytes(payload)
            resolved[name]=target
            del pending[name]
            advanced=True
        if not advanced: raise RuntimeError('Cyclic game asset references: '+', '.join(pending))
    # Replace older publication hashes as well as source aliases on every page.
    bybase={re.sub(r'\.[a-f0-9]{12}(?=\.)','',k):v for k,v in resolved.items()}
    for page in [*game.glob('*.html'),game/'sw.js',game/'manifest.webmanifest']:
        content=page.read_text()
        for base,target in bybase.items():
            stem,ext=base.rsplit('.',1)
            pattern=re.escape(stem)+r'(?:\.[a-f0-9]{12})?\.'+re.escape(ext)+r'(?:\?v=[A-Za-z0-9-]+)?'
            content=re.sub(pattern+r'''(?!["']\s*:)''',target,content)
        if page.suffix=='.html':
            touch=resolved.get('assets/pwa-192.458cf4f70713.png')
            if touch and 'apple-touch-icon' not in content:content=content.replace('</head>',f'<link rel="apple-touch-icon" href="{touch}"></head>')
        if page.name=='manifest.webmanifest':
            manifest=json.loads(content);manifest['theme_color']='#edf4e9';manifest['background_color']='#f5f7f1';content=json.dumps(manifest,ensure_ascii=False,indent=2)
        page.write_text(content)
    current=set(resolved.values())
    for base in bybase:
        stem,ext=base.rsplit('.',1)
        for old in game.glob(stem+'*.'+ext):
            if re.sub(r'\.[a-f0-9]{12}(?=\.)','',old.relative_to(game).as_posix())==base and old.relative_to(game).as_posix() not in current:old.unlink()
    for stale in game.glob('replay-view*.js'):stale.unlink()
    for size in (192,512):
        (game/f'pwa-{size}.png').unlink(missing_ok=True)
    worker=game/'sw.js'
    content=worker.read_text()
    core=json.loads(re.search(r'const CORE=(\[[^;]+\])',content).group(1))
    digest=hashlib.sha256(b''.join(name.encode()+b'\0'+(game/name).read_bytes() for name in sorted(core))).hexdigest()[:12]
    content=re.sub(r"const CACHE=PREFIX\+'[^']+'", "const CACHE=PREFIX+'6.3.0-"+digest+"'",content)
    worker.write_text(content)
