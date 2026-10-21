"""我从当前发布树中清除已确认停用的资源，并防止旧数据再次归档。"""
from pathlib import Path
import re
import shutil

OBSOLETE=(
    'assets/macbook-pro-photo.ad19aaf9d78e.jpg',
    'assets/macbook-pro-m5.7929d47ee078.jpg',
    '.gitignore',
    'assets/favicon.99c44e666ff1.svg',
    'assets/apple-touch-icon.e2c55cba898e.png',
    'assets/fonts/OFL.txt',
    'assets/game-cover.jpg',
    'assets/portrait-white-480.d1f641e10fd2.webp',
)

def remove_retired(root):
    for relative in ('visitors', 'privacy', 'assets/vendor/diyoriko-portfolio'):
        folder = root / relative
        if folder.is_dir():
            shutil.rmtree(folder)
    assets = root / 'assets'
    for pattern in ('visitors.*', 'visitor-tracker.*', 'visitor-privacy.*', 'visitor-config.json', 'analytics-config.json', 'ambient.*.mp3'):
        for old in assets.rglob(pattern):
            if old.is_file():
                old.unlink()
    # The archive is also the seed for future builds. Remove injected tracking
    # from every inherited HTML document, including the game companion pages.
    for page in root.rglob('*.html'):
        text = page.read_text()
        cleaned = re.sub(r'<script\b[^>]*\bsrc=["\'][^"\']*(?:visitor-tracker|visitor-privacy|visitors)\.[a-f0-9]+\.js["\'][^>]*>\s*</script>', '', text, flags=re.I)
        cleaned = re.sub(r'<link\b[^>]*\bhref=["\'][^"\']*visitors\.[a-f0-9]+\.css["\'][^>]*>', '', cleaned, flags=re.I)
        # Game privacy documents retain their save/storage policies, but the
        # retired site-wide statistics notice has no destination or purpose.
        cleaned = re.sub(r'<aside\b[^>]*>(?:(?!</aside>).)*href=["\'][^"\']*\.\./privacy/index\.html["\'](?:(?!</aside>).)*</aside>', '', cleaned, flags=re.I | re.S)
        if cleaned != text:
            page.write_text(cleaned)


def clean(root):
    from film.cache_probe import refresh_documentation
    refresh_documentation(root)
    remove_retired(root)
    for relative in OBSOLETE:
        file=root/relative
        if file.is_file(): file.unlink()
    (root/'game/version.json').unlink(missing_ok=True)
    for file in (root/'game').glob('garden-secondary*.js'): file.unlink()
    # Git does not retain empty folders; my publication archive follows the same rule.
    for folder in sorted((p for p in root.rglob('*') if p.is_dir()),key=lambda p:len(p.parts),reverse=True):
        if not any(folder.iterdir()): folder.rmdir()
