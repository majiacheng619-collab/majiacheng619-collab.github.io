"""Regression checks for the shared recruiting-site navigation contract."""
from html.parser import HTMLParser
from pathlib import Path
import tempfile
import unittest

from site_shell import build_renderer


class Elements(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.nodes = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        self.nodes.append((tag, dict(attrs)))

    def matching(self, predicate):
        return [(tag, attrs) for tag, attrs in self.nodes if predicate(tag, attrs)]


class SharedNavigationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.render = build_renderer(self.root, 'assets/site.css', 'assets/site.js',
                                     'favicon.svg', 'touch.png', 'M', {'music': 'assets/music.mp3'})

    def page(self, route):
        source = self.render(route, '马嘉程', '个人作品与经历', '<h1>马嘉程</h1>')
        self.assertEqual((self.root / route).read_text(), source)
        return Elements(source)

    def test_every_portfolio_route_has_one_navigation_and_six_native_controls(self):
        for route in ['index.html', 'projects/index.html', 'experience/index.html',
                      'honor/index.html', 'updates/index.html', 'poster/index.html',
                      'projects/sprout-patrol/index.html', 'projects/ai-content/index.html', '404.html']:
            with self.subTest(route=route):
                page = self.page(route)
                self.assertEqual(len(page.matching(lambda tag, attrs: tag == 'nav')), 1)
                self.assertEqual(len(page.matching(lambda tag, attrs: 'data-glass-dock' in attrs)), 1)
                items = page.matching(lambda tag, attrs: 'data-dock-item' in attrs)
                self.assertEqual([tag for tag, _ in items], ['a'] * 5 + ['button'])
                self.assertEqual(len(page.matching(lambda tag, attrs: 'data-search-open' in attrs)), 1)
                self.assertEqual(items[-1][1]['aria-controls'], 'search-dialog')
                self.assertEqual(items[-1][1]['type'], 'button')
                self.assertTrue(all(attrs.get('href') for _, attrs in items[:5]))
                self.assertLessEqual(sum('aria-current' in attrs for _, attrs in items), 1)

    def test_primary_routes_mark_one_corresponding_current_destination(self):
        for route, expected in [('index.html', 'index.html'), ('projects/index.html', '../projects/index.html'),
                                ('projects/ai-content/index.html', '../../projects/index.html'),
                                ('experience/index.html', '../experience/index.html'), ('honor/index.html', '../honor/index.html'),
                                ('poster/index.html', '../projects/index.html'), ('updates/index.html', '../experience/index.html')]:
            with self.subTest(route=route):
                current = self.page(route).matching(lambda tag, attrs: 'aria-current' in attrs)
                self.assertEqual(len(current), 1)
                self.assertEqual(current[0][1]['href'], expected)

    def test_removed_navigation_and_analytics_are_not_rendered(self):
        page = self.page('projects/ai-content/index.html')
        forbidden = page.matching(lambda tag, attrs: tag == 'header' or 'data-menu-open' in attrs
                                  or 'data-visitor-count' in attrs or 'data-privacy-toggle' in attrs
                                  or attrs.get('id') == 'menu-dialog'
                                  or 'chapter-nav' in attrs.get('class', '').split()
                                  or 'visitor-tracker' in attrs.get('src', ''))
        self.assertEqual(forbidden, [])
        self.assertEqual(len(page.matching(lambda tag, attrs: 'data-dock-lens' in attrs)), 1)
        self.assertEqual(len(page.matching(lambda tag, attrs: 'data-dock-projection' in attrs)), 0)

    def test_search_has_accessible_label_and_modal_controls(self):
        page = self.page('index.html')
        self.assertEqual(len(page.matching(lambda tag, attrs: tag == 'dialog' and attrs.get('id') == 'search-dialog')), 1)
        self.assertEqual(len(page.matching(lambda tag, attrs: tag == 'label' and attrs.get('for') == 'search-input')), 1)
        search = page.matching(lambda tag, attrs: 'data-search-input' in attrs)
        self.assertEqual(len(search), 1)
        self.assertEqual(search[0][1]['type'], 'search')
        self.assertTrue(page.matching(lambda tag, attrs: 'data-dialog-close' in attrs and attrs.get('aria-label') == '关闭搜索'))
        self.assertEqual(len(page.matching(lambda tag, attrs: tag == 'main')), 1)
        self.assertTrue(page.matching(lambda tag, attrs: tag == 'a' and attrs.get('href') == '#main'))


if __name__ == '__main__':
    unittest.main()
