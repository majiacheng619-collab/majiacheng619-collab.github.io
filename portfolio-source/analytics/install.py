"""Retire the former visitor module when rebuilding from a publication archive.

No analytics assets or pages are installed. Existing remote records are untouched.
"""
import re
import shutil


def remove(root):
    for relative in ('visitors', 'privacy'):
        folder = root / relative
        if folder.is_dir():
            shutil.rmtree(folder)
    assets = root / 'assets'
    for pattern in ('visitors.*', 'visitor-tracker.*', 'visitor-privacy.*', 'visitor-config.json', 'analytics-config.json'):
        for old in assets.glob(pattern):
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


def install(root, render=None, asset=None):
    """Compatibility hook for an older local build caller; always remove."""
    remove(root)
