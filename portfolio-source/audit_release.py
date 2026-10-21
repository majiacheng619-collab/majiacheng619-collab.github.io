#!/usr/bin/env python3
"""Supplemental dependency audit for the built site; run after validate_site.py.

Checks dynamic game resource maps, boot scripts, service-worker precaches, PWA
icons, legal notices and local media captions. It does not replace visual QA.
"""
from __future__ import annotations
import argparse
import ast
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.images = []
        self.device_spans = []
        self.capture_devices = []
        self.scripts = []
        self.videos = []
        self.tracks = []
        self.anchors = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'span':
            self.device_spans.append(attrs if 'data-device-frame' in attrs else None)
        if tag == 'script' and attrs.get('src'):
            self.scripts.append(attrs['src'])
        if tag == 'a':
            self.anchors.append(attrs)
        if tag == 'img':
            self.images.append(attrs)
            if re.search(r'garden-current-[^/]+\.webp$', attrs.get('src', '')):
                device = next((item for item in reversed(self.device_spans) if item is not None), {})
                self.capture_devices.append((attrs.get('src'), device))
        elif tag == 'video':
            self.videos.append(attrs)
        elif tag == 'track':
            self.tracks.append(attrs)

    def handle_endtag(self, tag):
        if tag == 'span' and self.device_spans:
            self.device_spans.pop()


def audit(root):
    root = root.resolve()
    errors, counts = [], {'asset_maps': 0, 'dynamic_assets': 0, 'precache_assets': 0,
                          'portfolio_pages': 0, 'captions': 0}

    def exists(base, value, label):
        parsed = urlsplit(value)
        if parsed.scheme or parsed.netloc or value.startswith('#'):
            return
        path = root / unquote(parsed.path).lstrip('/') if parsed.path.startswith('/') else base.parent / unquote(parsed.path)
        path = path.resolve()
        if not path.is_relative_to(root) or not path.is_file():
            errors.append(f'{label}: missing/unsafe dynamic asset {value}')

    retired = re.compile(r'^(?:visitors|privacy)/|(?:^|/)(?:visitor-(?:tracker|privacy|config)|visitors\.|analytics-config)')
    for path in root.rglob('*'):
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        if path.name in ('.DS_Store', 'Thumbs.db') or path.suffix == '.pyc' or any(part in ('__MACOSX', '__pycache__', '.pytest_cache') for part in path.parts):
            errors.append('Local build cache remains in publication: ' + relative)
        if relative.startswith('assets/garden-current-') and path.suffix == '.webp':
            fingerprint = re.search(r'\.([a-f0-9]{12})\.webp$', path.name)
            if not fingerprint or hashlib.sha256(path.read_bytes()).hexdigest()[:12] != fingerprint[1]:
                errors.append('Game preview needs a valid content fingerprint: ' + relative)
        if retired.search(relative):
            errors.append('Retired visitor module remains: ' + relative)
        if path.suffix in ('.html', '.js', '.json'):
            text = path.read_text()
            if not relative.startswith('game/') and re.search(r'data-search-open|id=[\"\']search-dialog|data-search-index|search-index\.[a-f0-9]+\.json', text):
                errors.append('Retired website search remains: ' + relative)
        if re.search(r'(?:^|/)search-index(?:\.[a-f0-9]+)?\.json$', relative):
            errors.append('Retired website search index remains: ' + relative)
        if path.suffix in ('.html', '.js', '.json'):
            if re.search(r'visitor-tracker|visitor-config|mjc-visitor-records-619\.pages\.dev|data-privacy-toggle', text):
                errors.append('Retired analytics reference remains: ' + relative)
    release = root / 'release.json'
    if release.is_file() and json.loads(release.read_text()).get('visitorAnalytics', {}).get('enabled') is not False:
        errors.append('Release must explicitly disable visitor analytics')

    if not (root / 'contact/index.html').is_file():
        errors.append('Standalone contact page is missing')
    game = root / 'game'
    for asset in game.rglob('*'):
        match=re.search(r'\.([a-f0-9]{12})\.(?:js|css|svg|png)$',asset.name)
        if asset.is_file() and match and hashlib.sha256(asset.read_bytes()).hexdigest()[:12]!=match[1]:
            errors.append('Game asset fingerprint differs from its content: '+str(asset.relative_to(root)))
    for path in sorted([*game.glob('*.html'), *game.glob('*.js')]):
        text = path.read_text(encoding='utf-8')
        for match in re.finditer(r'(?:globalThis\.)?GardenAssets\s*=\s*(\{[^;]+\})', text):
            try:
                mapping = json.loads(match.group(1))
            except json.JSONDecodeError:
                errors.append(f'{path.relative_to(root)}: asset map is not valid JSON')
                continue
            counts['asset_maps'] += 1
            if any(re.search(r'\.[a-f0-9]{12}\.', key) for key in mapping):
                errors.append(f'{path.relative_to(root)}: logical asset keys must remain stable')
            for value in mapping.values():
                counts['dynamic_assets'] += 1
                exists(path, value, str(path.relative_to(root)))
        if re.search(r'garden-boot\.[a-f0-9]+\.js$', path.name):
            match = re.search(r'const files=(\[[^;]+?\])', text)
            if not match:
                errors.append('Game boot script has no auditable dependency list')
            else:
                for value in ast.literal_eval(match.group(1)):
                    counts['dynamic_assets'] += 1
                    exists(path, value, str(path.relative_to(root)))
    worker = game / 'sw.js'
    if worker.is_file():
        match = re.search(r'const CORE\s*=\s*(\[[^;]+\])', worker.read_text())
        if not match:
            errors.append('Game service worker has no auditable precache list')
        else:
            for value in json.loads(match.group(1)):
                counts['precache_assets'] += 1
                exists(worker, value, 'game/sw.js')
    manifest = game / 'manifest.webmanifest'
    if manifest.is_file():
        data = json.loads(manifest.read_text())
        for icon in data.get('icons', []):
            exists(manifest, icon['src'], 'game/manifest.webmanifest')
    for relative in ('game/LICENSE.txt', 'assets/fonts/Noto-OFL.txt'):
        if not (root / relative).is_file():
            errors.append('Required original license is missing: ' + relative)
    for path in root.rglob('*.html'):
        doc = Page(path.read_text())
        duplicates={src for src in doc.scripts if doc.scripts.count(src)>1}
        if duplicates: errors.append(f'{path.relative_to(root)}: duplicate script includes {sorted(duplicates)}')
        if path.is_relative_to(game):
            continue
        counts['portfolio_pages'] += 1
        relative = path.relative_to(root).as_posix()
        pdfs = [anchor for anchor in doc.anchors if '.pdf' in anchor.get('href', '').lower()]
        expected = 1 if relative in ('index.html', 'contact/index.html') else 0
        if len(pdfs) != expected:
            errors.append(f'{relative}: expected {expected} resume download, found {len(pdfs)}')
        for capture, device in doc.capture_devices:
            if device.get('data-device-frame') != 'ipad' or device.get('data-device-model') != 'ipad-pro-2025':
                errors.append(f'{relative}: screenshot must use the iPad Pro 2025 component: {capture}')
        for image in doc.images:
            if not all(image.get(key, '').isdigit() and int(image[key]) > 0 for key in ('width', 'height')):
                errors.append(f'{path.relative_to(root)}: image lacks positive intrinsic dimensions: {image.get("src")}')
        for track in doc.tracks:
            exists(path, track.get('src', ''), str(path.relative_to(root)))
    for path in (root / 'assets' / 'media').glob('*.vtt'):
        counts['captions'] += 1
        text = path.read_text()
        if not text.startswith('WEBVTT'):
            errors.append(f'{path.relative_to(root)}: invalid WEBVTT header')
        cues = re.findall(r'(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})', text)
        previous = 0
        for start, end in cues:
            def seconds(value):
                hours, minutes, rest = value.split(':')
                return 3600 * int(hours) + 60 * int(minutes) + float(rest)
            begin, finish = seconds(start), seconds(end)
            if begin < previous or finish <= begin or finish > 61:
                errors.append(f'{path.relative_to(root)}: overlapping/out-of-range caption {start} --> {end}')
            previous = finish
        if not cues:
            errors.append(f'{path.relative_to(root)}: captions contain no cues')
    return {'ok': not errors, 'counts': counts, 'errors': errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('site', type=Path)
    args = parser.parse_args()
    report = audit(args.site)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report['ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
