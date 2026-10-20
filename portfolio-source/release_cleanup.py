#!/usr/bin/env python3
"""Retire obsolete records only after the current site has been deployed and checked.

Run from the repository root, with gh authenticated and git origin configured.
Defaults to a read-only plan. --apply executes; --rewrite-main additionally severs
main's ancestor history while preserving its complete tree. This cannot purge
GitHub's unreachable object storage, third-party clones or edge caches.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit

REPOSITORY = 'majiacheng619-collab/majiacheng619-collab.github.io'
ORIGIN = 'https://majiacheng619-collab.github.io'
AUTHORIZATION = '.github/retire-history-once.json'


def command(args, *, data=None, env=None):
    result = subprocess.run(args, input=data, capture_output=True, text=True, env=env)
    if result.returncode:
        raise RuntimeError(f'{args[0]} {args[1]} failed: {result.stderr.strip()}')
    return result.stdout.strip()


def api(path, method='GET', data=None):
    args = ['gh', 'api', '--method', method, f'repos/{REPOSITORY}/{path}']
    if data is not None:
        args += ['--input', '-']
    raw = command(args, data=json.dumps(data) if data is not None else None)
    return json.loads(raw) if raw else None


def collection(path, key=None):
    """Read every page before deleting; mutation never shifts a live page cursor."""
    rows = []
    for page in range(1, 10001):
        separator = '&' if '?' in path else '?'
        result = api(f'{path}{separator}per_page=100&page={page}')
        batch = result[key] if key else result
        if not isinstance(batch, list):
            raise RuntimeError(f'Unexpected collection response: {path}')
        rows += batch
        if len(batch) < 100:
            return rows
    raise RuntimeError(f'Pagination limit reached: {path}')


def remote_head():
    return api('git/ref/heads/main')['object']['sha']


def assert_head(expected):
    if remote_head() != expected:
        raise RuntimeError('main advanced during cleanup; stop and inspect the new head.')


def verify_public(sha, revision):
    # Pages can report success before its CDN serves the new manifest everywhere.
    # All retries still happen before deletion, and a mismatch always fails closed.
    failure = None
    for attempt in range(6):
        try:
            request = urllib.request.Request(ORIGIN + '/release.json?release=' + sha,
                                             headers={'Cache-Control': 'no-cache'})
            with urllib.request.urlopen(request, timeout=10) as response:
                proof = json.load(response)
            if proof.get('commit') == sha and proof.get('siteRevision') == revision:
                return
            failure = 'the public commit or site revision still differs'
        except (OSError, ValueError) as exc:
            failure = str(exc)
        if attempt < 5:
            time.sleep(5)
    raise RuntimeError('Public release.json does not match the deployed release: ' + str(failure))


def verify_checkout(head):
    remote = command(['git', 'remote', 'get-url', 'origin'])
    if remote.startswith('git@github.com:'):
        repository_path = remote.split(':', 1)[1]
    else:
        parsed = urlsplit(remote)
        if parsed.hostname not in ('github.com', 'git.chatgpt-team.site'):
            raise RuntimeError('Git origin host does not match the portfolio repository host.')
        repository_path = parsed.path.strip('/')
        if repository_path.startswith('github/'):
            repository_path = repository_path[len('github/'):]
    if repository_path.removesuffix('.git') != REPOSITORY:
        raise RuntimeError('Git origin does not match the portfolio repository.')
    if command(['git', 'status', '--porcelain', '--untracked-files=no']):
        raise RuntimeError('Tracked changes are present; cannot preserve a verified release tree.')
    if command(['git', 'rev-parse', 'HEAD']) != head:
        raise RuntimeError('Checkout must point to the current remote main head before rewriting history.')
    command(['git', 'var', 'GIT_AUTHOR_IDENT'])
    command(['git', 'var', 'GIT_COMMITTER_IDENT'])


def plan(args):
    if os.getenv('GITHUB_REPOSITORY', REPOSITORY) != REPOSITORY:
        raise RuntimeError('This cleanup is restricted to the portfolio repository.')
    verify_public(args.deployed_sha, args.site_revision)
    head = remote_head()
    expected_head = getattr(args, 'expected_head', None)
    if expected_head and head != expected_head:
        raise RuntimeError('main advanced after the deployment archive was verified.')
    if args.rewrite_main:
        verify_checkout(head)
    authorization = getattr(args, 'authorization_file', None)
    if authorization:
        if authorization != AUTHORIZATION:
            raise RuntimeError('Unexpected cleanup authorization path.')
        marker = json.loads(Path(authorization).read_text())
        if marker != {'siteRevision': args.site_revision, 'branch': 'main'}:
            raise RuntimeError('Cleanup authorization does not match this release.')
    refs = collection('git/matching-refs/')
    managed = [r for r in refs if r['ref'] != 'refs/heads/main' and
               (r['ref'].startswith(('refs/heads/', 'refs/tags/', 'refs/notes/')) or r['ref'] == 'refs/stash')]
    # Hidden pull-request references are not removable repository refs.
    unmanaged = [r['ref'] for r in refs if r['ref'] != 'refs/heads/main' and r not in managed]
    releases = collection('releases')
    runs = collection('actions/runs', 'workflow_runs')
    current = next((run for run in runs if run['id'] == args.run_id), None)
    if not current or current['head_sha'] != args.deployed_sha:
        raise RuntimeError('The preserved workflow run must be the run for the deployed SHA.')
    if current.get('conclusion') not in (None, 'success'):
        raise RuntimeError('The preserved workflow run is not successful/in progress.')
    older_runs = [run for run in runs if run['id'] != args.run_id]
    if any(run['status'] != 'completed' for run in older_runs):
        raise RuntimeError('An older workflow run is still active; wait for it to finish.')
    deployments = collection('deployments')
    page_deployments = [d for d in deployments if d.get('environment') == 'github-pages']
    statuses = {}
    for deployment in page_deployments:
        entries = collection(f"deployments/{deployment['id']}/statuses")
        statuses[deployment['id']] = entries[0] if entries else {}
    matching = [d for d in page_deployments if d['sha'] == args.deployed_sha
                and statuses[d['id']].get('state') == 'success'
                and statuses[d['id']].get('environment_url', '').rstrip('/') == ORIGIN]
    if not matching:
        raise RuntimeError('No successful Pages deployment matches the public release.')
    keep_deployment = max(matching, key=lambda d: d['id'])['id']
    newer = [d for d in deployments if d['id'] > keep_deployment]
    if newer:
        raise RuntimeError('A newer Pages deployment exists; inspect it before cleanup.')
    artifacts = collection('actions/artifacts', 'artifacts')
    caches = collection('actions/caches', 'actions_caches')
    return {
        'repository': REPOSITORY, 'head': head, 'deployed_sha': args.deployed_sha,
        'keep_run': args.run_id, 'keep_deployment': keep_deployment,
        'remove_runs': [run['id'] for run in older_runs],
        'remove_refs': [{'ref': r['ref'], 'sha': r['object']['sha']} for r in managed],
        'unmanaged_refs': unmanaged,
        'remove_releases': [{'id': r['id'], 'updated_at': r.get('updated_at'),
                             'assets': [a['id'] for a in r.get('assets', [])]} for r in releases],
        'authorization_file': authorization,
        # The verified Pages deployment has already consumed its upload.
        'remove_artifacts': [a['id'] for a in artifacts],
        'remove_caches': [c['id'] for c in caches],
        'remove_deployments': [d['id'] for d in deployments if d['id'] != keep_deployment],
        'rewrite_main': args.rewrite_main,
    }


def root_tree(head, authorization):
    """Preserve every current file except the consumed authorization marker."""
    tree = command(['git', 'rev-parse', head + '^{tree}'])
    if not authorization:
        return tree
    with tempfile.TemporaryDirectory(prefix='portfolio-retire-') as temporary:
        env = {**os.environ, 'GIT_INDEX_FILE': str(Path(temporary) / 'index')}
        command(['git', 'read-tree', head], env=env)
        command(['git', 'update-index', '--force-remove', '--', authorization], env=env)
        return command(['git', 'write-tree'], env=env)


def apply(args, work):
    head = work['head']
    assert_head(head)
    verify_public(args.deployed_sha, args.site_revision)
    for release in work['remove_releases']:
        assert_head(head)
        current = api(f"releases/{release['id']}")
        if current.get('updated_at') != release['updated_at'] or [a['id'] for a in current.get('assets', [])] != release['assets']:
            raise RuntimeError('A release changed during cleanup; stop before deleting it.')
        for identifier in release['assets']:
            assert_head(head)
            api(f'releases/assets/{identifier}', 'DELETE')
        api(f"releases/{release['id']}", 'DELETE')
    for ref in work['remove_refs']:
        assert_head(head)
        command(['git', 'push', 'origin', ':' + ref['ref'],
                 f"--force-with-lease={ref['ref']}:{ref['sha']}"])
    # Remove artifacts before runs: deleting a run can remove its artifacts too.
    for resource, identifiers in [('actions/artifacts', work['remove_artifacts']),
                                  ('actions/caches', work['remove_caches']),
                                  ('actions/runs', work['remove_runs'])]:
        for identifier in identifiers:
            assert_head(head)
            api(f'{resource}/{identifier}', 'DELETE')
    for identifier in work['remove_deployments']:
        assert_head(head)
        api(f'deployments/{identifier}/statuses', 'POST', {'state': 'inactive'})
        api(f'deployments/{identifier}', 'DELETE')
    if args.rewrite_main:
        assert_head(head)
        verify_checkout(head)
        tree = root_tree(head, work['authorization_file'])
        # No -p argument: the new root retains all files and has no old parents.
        root = command(['git', 'commit-tree', tree], data='我的个人网站与作品\n')
        command(['git', 'push', 'origin', f'{root}:refs/heads/main',
                 f'--force-with-lease=refs/heads/main:{head}'])
        if remote_head() != root:
            raise RuntimeError('Remote main did not move to the preserved release root.')
        commit = api('git/commits/' + root)
        if commit.get('parents') or commit['tree']['sha'] != tree:
            raise RuntimeError('Rewritten main did not retain the identical tree as a root commit.')
        work['new_head'] = root
    # Verify all pages again, rather than checking just page 1 after mutation.
    remaining = collection('actions/runs', 'workflow_runs')
    if len(remaining) != 1 or remaining[0]['id'] != args.run_id:
        raise RuntimeError('The current workflow run must be the only remaining run.')
    if collection('actions/caches', 'actions_caches'):
        raise RuntimeError('Actions caches remain after cleanup.')
    artifacts = collection('actions/artifacts', 'artifacts')
    if artifacts:
        raise RuntimeError('Deployment upload artifacts remain after cleanup.')
    deployments = collection('deployments')
    if (len(deployments) != 1 or deployments[0].get('environment') != 'github-pages'
            or deployments[0]['id'] != work['keep_deployment']):
        raise RuntimeError('The current Pages deployment must be the only remaining deployment.')
    kept_statuses = collection(f"deployments/{work['keep_deployment']}/statuses")
    if (not kept_statuses or kept_statuses[0].get('state') != 'success'
            or kept_statuses[0].get('environment_url', '').rstrip('/') != ORIGIN):
        raise RuntimeError('Preserved Pages deployment no longer has a successful live status.')
    refs = collection('git/matching-refs/')
    expected_refs = {'refs/heads/main', *work['unmanaged_refs']}
    if {r['ref'] for r in refs} != expected_refs or collection('releases'):
        raise RuntimeError('Unexpected refs/releases appeared during cleanup.')
    if args.rewrite_main:
        assert_head(work['new_head'])
        if work['authorization_file'] and command(['git', 'ls-tree', work['new_head'], '--', work['authorization_file']]):
            raise RuntimeError('The consumed authorization remains in the root tree.')
    verify_public(args.deployed_sha, args.site_revision)
    print(json.dumps({'verified': True, 'remaining_artifacts': len(artifacts),
                      'remaining_runs': len(remaining), 'remaining_deployments': len(deployments),
                      'remaining_caches': 0, **work}, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-id', type=int, required=True)
    parser.add_argument('--deployed-sha', required=True)
    parser.add_argument('--site-revision', required=True)
    parser.add_argument('--rewrite-main', action='store_true')
    parser.add_argument('--expected-head')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--authorization-file', choices=[AUTHORIZATION])
    args = parser.parse_args()
    work = plan(args)
    print(json.dumps({'dry_run': not args.apply, **work}, ensure_ascii=False, indent=2))
    if args.apply:
        apply(args, work)


if __name__ == '__main__':
    main()
