#!/usr/bin/env python3
"""Validate the publishable portfolio tree without dependencies or network access.

Usage: python3 validate_site.py portfolio --zip deploy.zip
       python3 validate_site.py _site --published --pdf resume.pdf
The ZIP excludes PDFs; the repository root owns the approved PDF. Game contents
are checked for missing resources but their inherited filenames are not rehashed.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
import re
import stat
import sys
from urllib.parse import unquote, urlsplit
import zipfile

PAGES = ('index.html', 'projects/index.html', 'experience/index.html',
         'updates/index.html', 'projects/ai-content/index.html',
         'projects/sprout-patrol/index.html', 'poster/index.html', 'honor/index.html')
APPROVED_PDF = '45d0c1771c091dc7e3342ca07ddc3effce3ae9282c1954e1fe2df9d93681cc74'
ORIGIN = 'majiacheng619-collab.github.io'


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.ids = set(); self.duplicates = []; self.refs = []; self.meta = {}
        self.lang = ''; self.h1 = 0; self.main = 0; self.title = ''
        self.in_title = False; self.nav_depth = 0; self.nav_links = []
        self.pdf_links = []; self.images = []; self.blank_links = []; self.empty_links = []
        self.actions = []; self.active_anchor = None
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            if a['id'] in self.ids: self.duplicates.append(a['id'])
            self.ids.add(a['id'])
        if tag == 'html': self.lang = a.get('lang', '')
        if tag == 'main': self.main += 1
        if tag == 'h1': self.h1 += 1
        if tag == 'title': self.in_title = True
        if tag == 'meta': self.meta[a.get('name') or a.get('property')] = a.get('content', '')
        if tag == 'nav':
            label = a.get('aria-label', '')
            if '主要' in label or '主导航' in label or label.lower() in ('primary', 'main navigation'):
                self.nav_depth = 1
            elif self.nav_depth: self.nav_depth += 1
        if tag == 'a':
            self.active_anchor = {'label': '', 'href': a.get('href', '')}
            if not a.get('href', '').strip() or a.get('href') == '#': self.empty_links.append(a.get('href', ''))
        if tag == 'a' and self.nav_depth: self.nav_links.append(a.get('href', ''))
        if tag == 'a' and a.get('target') == '_blank': self.blank_links.append(a)
        for key in ('href', 'src', 'poster'):
            if a.get(key): self.refs.append((tag, key, a[key]))
        if a.get('srcset'):
            for part in a['srcset'].split(','):
                value = part.strip().split()[0] if part.strip() else ''
                if value and not value.startswith('data:'): self.refs.append((tag, 'srcset', value))
        if tag == 'a' and '.pdf' in a.get('href', '').lower(): self.pdf_links.append(a)
        if tag == 'img': self.images.append(a)

    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False
        if tag == 'a' and self.active_anchor is not None:
            self.active_anchor['label'] = ' '.join(self.active_anchor['label'].split())
            self.actions.append(self.active_anchor); self.active_anchor = None
        if tag == 'nav' and self.nav_depth: self.nav_depth -= 1

    def handle_data(self, data):
        if self.in_title: self.title += data
        if self.active_anchor is not None: self.active_anchor['label'] += ' ' + data


def validate(root, archive=None, pdf=None, published=False, allow_unfingerprinted=False):
    errors = []; warnings = []; counts = {'main_pages': 0, 'html_pages': 0, 'local_references': 0, 'pdf_links': 0, 'fingerprints': 0}
    root = root.resolve()
    docs = {}
    referenced = set()
    def err(message): errors.append(message)
    def warn(message): warnings.append(message)
    def local(base, value):
        u = urlsplit(value)
        if u.scheme in ('mailto', 'tel', 'data', 'javascript', 'blob'): return None
        if u.netloc and u.netloc != ORIGIN: return None
        if u.scheme and u.scheme not in ('http', 'https'): return None
        p = unquote(u.path)
        target = root / p.lstrip('/') if p.startswith('/') or u.netloc else base.parent / p
        target = target.resolve()
        if not target.is_relative_to(root):
            err(f'{base.relative_to(root)}: resource escapes site root: {value}'); return None
        if target.is_dir() or p.endswith('/'):
            target = target / 'index.html'
        return target, unquote(u.fragment)

    for page in root.rglob('*.html'):
        try: docs[page.resolve()] = Document(page.read_text(encoding='utf-8'))
        except (UnicodeError, OSError) as exc: err(f'{page.relative_to(root)}: cannot parse HTML: {exc}')
    counts['html_pages'] = len(docs)
    titles = set(); nav_signature = None
    for relative in PAGES:
        page = root / relative
        doc = docs.get(page)
        if not doc: err(f'Missing main page: {relative}'); continue
        counts['main_pages'] += 1
        if not doc.lang.lower().startswith('zh'): err(f'{relative}: Chinese lang missing')
        if doc.main != 1 or 'main' not in doc.ids: err(f'{relative}: requires one main and a static #main target')
        if doc.h1 != 1: err(f'{relative}: expected one h1, found {doc.h1}')
        if not doc.title.strip(): err(f'{relative}: title missing')
        elif doc.title in titles: err(f'{relative}: duplicate title')
        titles.add(doc.title)
        for key in ('description', 'viewport'):
            if not doc.meta.get(key, '').strip(): err(f'{relative}: {key} missing')
        if not doc.meta.get('og:title') or not doc.meta.get('og:description'):
            warn(f'{relative}: social sharing title/description incomplete')
        if not doc.nav_links: err(f'{relative}: labelled primary navigation missing')
        else:
            targets = tuple(str(result[0].relative_to(root)) for value in doc.nav_links if (result := local(page, value)))
            if nav_signature is None: nav_signature = targets
            elif targets != nav_signature: err(f'{relative}: primary navigation differs: {targets}')
        if doc.duplicates: err(f'{relative}: duplicate IDs {doc.duplicates}')
        if doc.empty_links: err(f'{relative}: empty/placeholder hrefs: {doc.empty_links}')
        for image in doc.images:
            if 'alt' not in image: err(f'{relative}: image lacks alt: {image.get("src", "")}')
        for anchor in doc.blank_links:
            if 'noopener' not in anchor.get('rel', '').split(): err(f'{relative}: new-window link lacks noopener')
        if not doc.pdf_links: err(f'{relative}: resume PDF entry missing')
        for anchor in doc.pdf_links:
            counts['pdf_links'] += 1
            parsed = urlsplit(anchor['href'])
            name = PurePosixPath(parsed.path).name
            expected = r'resume-[a-f0-9]{12}\.pdf' if published else r'resume\.pdf'
            if not re.fullmatch(expected, name): err(f'{relative}: PDF link is not the single resume source: {anchor["href"]}')
            if 'download' not in anchor: err(f'{relative}: PDF link lacks download attribute')
    for page, doc in docs.items():
        main_page = str(page.relative_to(root)) in PAGES
        for tag, attr, value in doc.refs:
            result = local(page, value)
            if not result: continue
            target, fragment = result
            counts['local_references'] += 1
            referenced.add(target)
            # Source ZIP intentionally lacks the PDF inserted by the publishing workflow.
            if target.suffix.lower() == '.pdf' and not published: continue
            if not target.is_file(): err(f'{page.relative_to(root)}: missing {attr}: {value}'); continue
            if main_page and fragment and target.suffix == '.html':
                destination = docs.get(target)
                if destination and fragment not in destination.ids:
                    if target.is_relative_to(root / 'game'):
                        warn(f'{page.relative_to(root)}: game runtime anchor cannot be verified: {value}')
                    else: err(f'{page.relative_to(root)}: missing static anchor: {value}')
    # Include local CSS URLs, which the HTML parser cannot see.
    for css in (root / 'assets').rglob('*.css'):
        text = css.read_text(encoding='utf-8')
        for value in re.findall(r'url\(\s*[\"\']?([^\)\"\']+)', text):
            if value.strip().startswith('#'):
                # Fragment filters live in the HTML document, not on disk.
                fragment = value.strip()[1:]
                if not any(fragment in doc.ids for doc in docs.values()):
                    err(f'{css.relative_to(root)}: missing SVG filter: {value}')
                continue
            result = local(css, value.strip())
            if result:
                target, _ = result; referenced.add(target); counts['local_references'] += 1
                if not target.is_file(): err(f'{css.relative_to(root)}: missing CSS url: {value}')
    # Fingerprints apply to the new portfolio assets, never the inherited game build.
    for asset in (root / 'assets').rglob('*'):
        if not asset.is_file(): continue
        match = re.search(r'\.([a-f0-9]{12})\.[^.]+$', asset.name)
        if match:
            counts['fingerprints'] += 1
            actual = hashlib.sha256(asset.read_bytes()).hexdigest()[:12]
            if match.group(1) != actual: err(f'{asset.relative_to(root)}: fingerprint mismatch {match.group(1)} != {actual}')
        elif asset.parent == root / 'assets' and asset.suffix in ('.js', '.css') and not allow_unfingerprinted:
            err(f'{asset.relative_to(root)}: production CSS/JS lacks content fingerprint')
        if asset.parent == root / 'assets' and asset.suffix in ('.js', '.css') and asset not in referenced:
            warn(f'Unreferenced root asset; review before cleanup: {asset.relative_to(root)}')
    site_pdfs = list(root.rglob('*.pdf'))
    if not published and site_pdfs: err('Source site must not contain PDFs: ' + ', '.join(str(p.relative_to(root)) for p in site_pdfs))
    if published:
        allowed_pdf_names = {'resume.pdf', 'resume-' + APPROVED_PDF[:12] + '.pdf'}
        for item in site_pdfs:
            if item.parent != root or item.name not in allowed_pdf_names:
                err(f'Unexpected published PDF: {item.relative_to(root)}')
            elif hashlib.sha256(item.read_bytes()).hexdigest() != APPROVED_PDF:
                err(f'Published PDF differs from approved source: {item.name}')
        if {p.name for p in site_pdfs} != allowed_pdf_names:
            err('Published tree requires canonical and fingerprinted copies of the same approved PDF')
    if pdf:
        if not pdf.is_file(): err(f'Approved repository PDF missing: {pdf}')
        elif hashlib.sha256(pdf.read_bytes()).hexdigest() != APPROVED_PDF: err('Approved PDF SHA-256 changed')
    if archive:
        try:
            with zipfile.ZipFile(archive) as z:
                entries = z.infolist(); seen = set(); archive_names = set()
                if sum(i.file_size for i in entries) > 512 * 1024 * 1024:
                    err('ZIP expanded size exceeds 512 MiB')
                    return {'ok': False, 'counts': counts, 'errors': errors, 'warnings': warnings}
                for item in entries:
                    name = item.filename; path = PurePosixPath(name)
                    if name in seen: err(f'ZIP duplicate entry: {name}')
                    seen.add(name)
                    if path.is_absolute() or '..' in path.parts or '\\' in name: err(f'ZIP unsafe path: {name}')
                    if stat.S_ISLNK(item.external_attr >> 16): err(f'ZIP symlink is not allowed: {name}')
                    if name.endswith('/'): continue
                    archive_names.add(name)
                    if name.lower().endswith('.pdf') or name in ('README.md', 'validate_site.py', '.github/workflows/pages.yml'):
                        err(f'ZIP contains duplicate repository-owned file: {name}')
                    target = root / name
                    if not target.is_file(): err(f'ZIP contains unexpected file: {name}')
                    elif hashlib.sha256(z.read(item)).digest() != hashlib.sha256(target.read_bytes()).digest(): err(f'ZIP differs from source: {name}')
                expected_names = {str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}
                for name in sorted(expected_names - archive_names): err(f'ZIP omits source file: {name}')
                counts['zip_files'] = len(archive_names)
        except (OSError, zipfile.BadZipFile) as exc: err(f'Cannot read ZIP: {exc}')
    return {'ok': not errors, 'counts': counts, 'errors': errors, 'warnings': warnings}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('site', type=Path)
    ap.add_argument('--zip', type=Path)
    ap.add_argument('--pdf', type=Path)
    ap.add_argument('--actions', action='store_true', help='Include main-page link labels and targets for manual QA')
    ap.add_argument('--published', action='store_true', help='Check a tree after PDF injection')
    ap.add_argument('--allow-unfingerprinted', action='store_true', help='Allow work-in-progress CSS/JS names')
    args = ap.parse_args()
    report = validate(args.site, args.zip, args.pdf, args.published, args.allow_unfingerprinted)
    if args.actions:
        report['actions'] = {p: Document((args.site / p).read_text(encoding='utf-8')).actions for p in PAGES if (args.site / p).is_file()}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report['ok'] else 1

if __name__ == '__main__': sys.exit(main())

