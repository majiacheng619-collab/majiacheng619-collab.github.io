"""我验证发布后的清理范围，避免误删当前部署或在验证失败时继续删除。"""
import unittest
import json
import os
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
from unittest.mock import patch
import release_cleanup as cleanup


class CleanupSafeguards(unittest.TestCase):
    def setUp(self):
        self.args = SimpleNamespace(deployed_sha='published', site_revision='current',
                                    run_id=7, rewrite_main=False)
        self.data = {
            'git/matching-refs/': [{'ref': 'refs/heads/main'}],
            'releases': [],
            'actions/runs': [
                {'id': 7, 'head_sha': 'published', 'status': 'completed', 'conclusion': 'success'},
                {'id': 6, 'head_sha': 'previous', 'status': 'completed', 'conclusion': 'success'},
            ],
            'deployments': [
                {'id': 10, 'sha': 'published', 'environment': 'github-pages'},
                {'id': 9, 'sha': 'previous', 'environment': 'github-pages'},
            ],
            'deployments/10/statuses': [{'state': 'success', 'environment_url': cleanup.ORIGIN}],
            'deployments/9/statuses': [{'state': 'inactive', 'environment_url': cleanup.ORIGIN}],
            'actions/artifacts': [
                {'id': 70, 'workflow_run': {'id': 7}},
                {'id': 60, 'workflow_run': {'id': 6}},
            ],
            'actions/caches': [{'id': 100}],
        }

    def plan(self):
        with patch.object(cleanup, 'verify_public'), \
             patch.object(cleanup, 'remote_head', return_value='head'), \
             patch.object(cleanup, 'collection', side_effect=lambda path, key=None: self.data[path]):
            return cleanup.plan(self.args)

    def test_deployed_upload_is_disposable_while_live_deployment_is_preserved(self):
        work = self.plan()
        self.assertEqual(work['remove_artifacts'], [70, 60])
        self.assertEqual(work['remove_runs'], [6])
        self.assertEqual(work['remove_deployments'], [9])
        self.assertEqual(work['keep_run'], 7)
        self.assertEqual(work['keep_deployment'], 10)

    def test_older_preview_records_are_retired_after_current_pages_is_verified(self):
        self.data['deployments'].append({'id': 8, 'sha': 'other', 'environment': 'preview'})
        self.assertEqual(self.plan()['remove_deployments'], [9, 8])

    def test_public_release_mismatch_stops_before_inventory_or_mutation(self):
        with patch.object(cleanup, 'verify_public', side_effect=RuntimeError('public mismatch')), \
             patch.object(cleanup, 'collection') as inventory, \
             patch.object(cleanup, 'api') as api:
            with self.assertRaisesRegex(RuntimeError, 'public mismatch'):
                cleanup.plan(self.args)
            inventory.assert_not_called()
            api.assert_not_called()

    def test_branch_change_stops_before_deleting_any_upload(self):
        work = self.plan()
        with patch.object(cleanup, 'remote_head', return_value='newer-head'), \
             patch.object(cleanup, 'api') as api:
            with self.assertRaisesRegex(RuntimeError, 'main advanced'):
                cleanup.apply(self.args, work)
            api.assert_not_called()

    def apply_with_post_cleanup_inventory(self, work):
        with patch.object(cleanup, 'remote_head', return_value='head'), \
             patch.object(cleanup, 'api'), patch.object(cleanup, 'verify_public'), \
             patch.object(cleanup, 'collection', side_effect=lambda path, key=None: self.data[path]):
            cleanup.apply(self.args, work)

    def set_post_cleanup_inventory(self):
        self.data['actions/runs'] = self.data['actions/runs'][:1]
        self.data['deployments'] = self.data['deployments'][:1]
        self.data['actions/artifacts'] = []
        self.data['actions/caches'] = []

    def test_current_run_cannot_disappear_during_cleanup(self):
        work = self.plan()
        self.set_post_cleanup_inventory()
        self.data['actions/runs'] = []
        with self.assertRaisesRegex(RuntimeError, 'current workflow run'):
            self.apply_with_post_cleanup_inventory(work)

    def test_live_deployment_cannot_disappear_during_cleanup(self):
        work = self.plan()
        self.set_post_cleanup_inventory()
        self.data['deployments'] = []
        with self.assertRaisesRegex(RuntimeError, 'current Pages deployment'):
            self.apply_with_post_cleanup_inventory(work)

    def test_live_deployment_must_still_be_successful(self):
        work = self.plan()
        self.set_post_cleanup_inventory()
        self.data['deployments/10/statuses'] = [{'state': 'failure'}]
        with self.assertRaisesRegex(RuntimeError, 'successful live status'):
            self.apply_with_post_cleanup_inventory(work)


    def test_refs_keep_hidden_pull_requests_but_retire_branches_and_tags_with_shas(self):
        self.data['git/matching-refs/'] += [
            {'ref': 'refs/heads/retired', 'object': {'sha': 'branch-sha'}},
            {'ref': 'refs/tags/previous', 'object': {'sha': 'tag-sha'}},
            {'ref': 'refs/pull/1/head', 'object': {'sha': 'hidden'}},
        ]
        work = self.plan()
        self.assertEqual(work['remove_refs'], [
            {'ref': 'refs/heads/retired', 'sha': 'branch-sha'},
            {'ref': 'refs/tags/previous', 'sha': 'tag-sha'}])
        self.assertEqual(work['unmanaged_refs'], ['refs/pull/1/head'])

    def test_mismatched_marker_stops_before_inventory(self):
        self.args.authorization_file = cleanup.AUTHORIZATION
        with patch.object(cleanup, 'verify_public'), \
             patch.object(cleanup, 'remote_head', return_value='head'), \
             patch.object(cleanup.Path, 'read_text', return_value=json.dumps({'siteRevision': 'wrong', 'branch': 'main'})), \
             patch.object(cleanup, 'collection') as inventory:
            with self.assertRaisesRegex(RuntimeError, 'does not match'):
                cleanup.plan(self.args)
            inventory.assert_not_called()

    def test_authorization_path_is_not_arbitrary(self):
        self.args.authorization_file = 'another-file.json'
        with patch.object(cleanup, 'verify_public'), \
             patch.object(cleanup, 'remote_head', return_value='head'), \
             patch.object(cleanup.Path, 'read_text') as read:
            with self.assertRaisesRegex(RuntimeError, 'Unexpected cleanup authorization path'):
                cleanup.plan(self.args)
            read.assert_not_called()

    def test_release_asset_ids_and_revision_are_snapshotted(self):
        self.data['releases'] = [{'id': 4, 'updated_at': 'known', 'assets': [{'id': 40}]}]
        self.assertEqual(self.plan()['remove_releases'], [{'id': 4, 'updated_at': 'known', 'assets': [40]}])

    def test_a_newer_deployment_stops_cleanup_even_in_another_environment(self):
        self.data['deployments'].append({'id': 11, 'sha': 'other', 'environment': 'preview'})
        with self.assertRaisesRegex(RuntimeError, 'newer Pages deployment'):
            self.plan()

    def test_an_active_older_workflow_is_not_deleted(self):
        self.data['actions/runs'][1]['status'] = 'in_progress'
        with self.assertRaisesRegex(RuntimeError, 'still active'):
            self.plan()

    def test_release_changed_since_inventory_stops_before_delete(self):
        self.data['releases'] = [{'id': 4, 'updated_at': 'known', 'assets': [{'id': 40}]}]
        work = self.plan()
        with patch.object(cleanup, 'remote_head', return_value='head'), \
             patch.object(cleanup, 'verify_public'), \
             patch.object(cleanup, 'api', return_value={'updated_at': 'newer', 'assets': [{'id': 40}]}) as api:
            with self.assertRaisesRegex(RuntimeError, 'release changed'):
                cleanup.apply(self.args, work)
            self.assertEqual([call.args[1] for call in api.call_args_list if len(call.args) > 1], [])

    def test_real_git_root_preserves_current_files_only_consumes_marker_and_does_not_move_checkout(self):
        previous = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            try:
                os.chdir(directory)
                def git(*args, data=None):
                    return subprocess.run(['git', '-c', 'user.name=Portfolio Test', '-c', 'user.email=test@example.invalid', *args],
                                          input=data, text=True, capture_output=True, check=True).stdout.strip()
                git('init', '-q')
                Path('current.txt').write_text('current website')
                Path('.github').mkdir()
                Path(cleanup.AUTHORIZATION).write_text('one-shot')
                git('add', '.')
                git('commit', '-qm', 'current')
                before = git('rev-parse', 'HEAD')
                tree = cleanup.root_tree(before, cleanup.AUTHORIZATION)
                root = git('commit-tree', tree, data='current only\n')
                self.assertEqual(git('rev-list', '--parents', '-n', '1', root), root)
                self.assertEqual(git('show', root + ':current.txt'), 'current website')
                self.assertEqual(git('ls-tree', root, '--', cleanup.AUTHORIZATION), '')
                self.assertEqual(git('diff', '--name-status', before, root), 'D\t' + cleanup.AUTHORIZATION)
                self.assertEqual(git('rev-parse', 'HEAD'), before)
            finally:
                os.chdir(previous)


    def test_main_advanced_after_deploy_stops_before_inventory(self):
        self.args.expected_head = 'verified-archive-head'
        with patch.object(cleanup, 'verify_public'), \
             patch.object(cleanup, 'remote_head', return_value='new-user-work'), \
             patch.object(cleanup, 'verify_checkout') as checkout, \
             patch.object(cleanup, 'collection') as inventory:
            with self.assertRaisesRegex(RuntimeError, 'advanced after the deployment'):
                cleanup.plan(self.args)
            inventory.assert_not_called()
            checkout.assert_not_called()


class PublishedAssetCleanup(unittest.TestCase):
    def test_updated_previews_change_url_and_keep_nested_routes_consistent(self):
        from prepare_release import fingerprint_portfolio_artwork
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'assets').mkdir()
            (root/'projects').mkdir()
            source = root/'assets/garden-current-home.webp'
            source.write_bytes(b'current screen')
            (root/'assets/garden-current-home.000000000000.webp').write_bytes(b'old screen')
            (root/'index.html').write_text('<img src="assets/garden-current-home.webp">')
            (root/'projects/index.html').write_text('<img src="../assets/garden-current-home.000000000000.webp">')
            fingerprint_portfolio_artwork(root)
            first = next((root/'assets').iterdir())
            self.assertRegex(first.name, r'^garden-current-home\.[a-f0-9]{12}\.webp$')
            self.assertEqual(first.read_bytes(), b'current screen')
            self.assertIn('assets/'+first.name, (root/'index.html').read_text())
            self.assertIn('../assets/'+first.name, (root/'projects/index.html').read_text())
            fingerprint_portfolio_artwork(root)
            self.assertEqual(list((root/'assets').iterdir()), [first])
            source.write_bytes(b'updated screen')
            fingerprint_portfolio_artwork(root)
            second = next((root/'assets').iterdir())
            self.assertNotEqual(first.name, second.name)
            self.assertIn(second.name, (root/'index.html').read_text())
            self.assertIn(second.name, (root/'projects/index.html').read_text())
            self.assertFalse(first.exists())

    def test_local_cache_cleanup_preserves_current_assets_and_game_data(self):
        from clean_release import clean
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'assets').mkdir()
            (root/'game').mkdir()
            (root/'game/save-policy.txt').write_text('Current save policy')
            (root/'assets/current.webp').write_bytes(b'current image')
            for folder in ('__MACOSX', 'game/__pycache__', '.pytest_cache'):
                (root/folder).mkdir()
                (root/folder/'cache').write_bytes(b'local cache')
            (root/'assets/.DS_Store').write_bytes(b'finder metadata')
            (root/'game/unused.pyc').write_bytes(b'python cache')
            with patch('film.cache_probe.refresh_documentation'):
                clean(root)
            self.assertEqual(sorted(p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()),
                             ['assets/current.webp', 'game/save-policy.txt'])


if __name__ == '__main__':
    unittest.main()
