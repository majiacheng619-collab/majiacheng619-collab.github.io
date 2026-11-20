#!/usr/bin/env python3
"""Check the active GitHub Pages publication against its committed deployment archive."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import sys
from time import time
from urllib.error import HTTPError
from urllib.parse import quote, urljoin, urlsplit
from urllib.request import Request, urlopen
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from validate_site import Document

ORIGIN = 'https://majiacheng619-collab.github.io'
OLD_PDF = '/resume-e320d240bb78.pdf'
OLD_PROJECT = '/projects/ai-content/'
CHECK_QUERY = '?mjc-release-check=' + str(int(time()))


def request(origin, path, method='GET', headers=None):
    req = Request(origin + path, headers={'User-Agent': 'Portfolio release verification', **(headers or {})},
                  method=method)
    try:
        response = urlopen(req, timeout=25)
    except HTTPError as error:
        response = error
    with response:
        return response.status, response.headers, response.read() if method != 'HEAD' else b''


def require(condition, description):
    if not condition:
        raise RuntimeError(description)


def paths_in(origin, url, document, tags):
    hostname = urlsplit(origin).netloc
    for tag, attr, value in document.refs:
        if tag not in tags or attr != 'href':
            continue
        target = urlsplit(urljoin(origin + url, value))
        if target.netloc == hostname and target.scheme in ('https', 'http'):
            yield target.path or '/'


def verify(origin, archive_path):
    with ZipFile(archive_path) as archive:
        saved = {name: archive.read(name) for name in archive.namelist() if name.endswith('.html')}
        meta = archive.read('release.json')
        metadata = json.loads(meta)
        for name in ('release.json', 'sw.js', 'sw-state.json', 'robots.txt', 'manifest.webmanifest'):
            status, _, body = request(origin, '/' + name + CHECK_QUERY)
            require(status == 200 and body == archive.read(name), 'Publish mismatch: /' + name)
        version = json.loads(archive.read('sw-state.json'))['version']
        require(version.encode() in archive.read('sw.js'), 'SW version mismatch')
        require(b'Sitemap:' not in archive.read('robots.txt'), 'Unexpected sitemap')

    resume = '/' + metadata['resume']['file']
    status, headers, body = request(origin, resume)
    require(status == 200 and headers.get_content_type() == 'application/pdf', 'Resume is unavailable')
    require(hashlib.sha256(body).hexdigest() == metadata['resume']['sha256'], 'Resume has changed')
    status, _, body = request(origin, OLD_PDF + CHECK_QUERY)
    require(status == 404 and body == saved['404.html'], 'Old resume fails to show the custom 404')
    status, _, body = request(origin, '/missing-portfolio-page/' + CHECK_QUERY)
    require(status == 404 and body == saved['404.html'], 'Unknown URL fails to show the custom 404')
    status, _, body = request(origin, OLD_PROJECT)
    require(status == 200 and b'0; url=/projects/' in body, 'Old project does not redirect')
    fallback = Document(saved['404.html'].decode('utf-8'))
    require({'/', '/projects/', resume} <= set(paths_in(origin, '/404.html', fallback, {'a'})),
            '404 recovery links are incomplete')

    def page_links(item):
        name, local = item
        path = '/' + quote(name.removesuffix('index.html') if name.endswith('/index.html') or name == 'index.html' else name)
        status, _, remote = request(origin, path)
        require(status == 200, f'{path} returned {status}')
        require(remote == local, 'Published HTML differs from archive: ' + path)
        document = Document(remote.decode('utf-8'))
        if not name.startswith('game/'):
            require('noindex' in document.meta.get('robots', '').split(','), 'Missing noindex: ' + path)
        # Relative anchors are published at both the directory and explicit paths.
        return set(paths_in(origin, path, document, {'a'}))

    with ThreadPoolExecutor(max_workers=6) as pool:
        links = set().union(*pool.map(page_links, sorted(saved.items())))
        require('/404.html' not in links and OLD_PDF not in links, 'Found a retired internal link')

        def check_link(link):
            status, _, _ = request(origin, link, 'HEAD')
            require(status == 200, f'Internal link {link} returned {status}')

        list(pool.map(check_link, sorted(links)))
    return {'pages200': len(saved), 'internalTargets200': len(links), 'resume': resume,
            'serviceWorker': version, 'siteRevision': metadata['siteRevision'],
            'buildCommit': metadata['commit'], 'mainSiteNoindex': True,
            'styled404': True, 'legacyProjectRedirect': True}


def homepage_weight(origin, resources):
    paths = sorted(set(resources))
    sizes = []
    for path in paths:
        status, _, body = request(origin, path, headers={'Accept-Encoding': 'br, gzip'})
        require(status == 200, 'Cold-start resource unavailable: ' + path)
        sizes.append(len(body))
    return {'homeEncodedBodyBytes': sum(sizes), 'homeRequests': len(paths)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('--origin', default=ORIGIN)
    parser.add_argument('--resources', type=Path, help='JSON list of cold mobile homepage request paths')
    args = parser.parse_args()
    origin = args.origin.rstrip('/')
    result = verify(origin, args.archive)
    if args.resources:
        result.update(homepage_weight(origin, json.loads(args.resources.read_text())))
    print(json.dumps(result, ensure_ascii=False, indent=2))
