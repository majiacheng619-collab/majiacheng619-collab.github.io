"""我验证发布后的清理范围，避免误删当前部署或在验证失败时继续删除。"""
import unittest
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

    def test_unexpected_environment_stops_cleanup_for_review(self):
        self.data['deployments'].append({'id': 11, 'sha': 'other', 'environment': 'preview'})
        with self.assertRaisesRegex(RuntimeError, 'Unexpected deployment environments'):
            self.plan()

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


if __name__ == '__main__':
    unittest.main()
