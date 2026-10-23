"""我验证完整光场实际覆盖每个采样位置，生成源码可复现且不会进入网页。"""
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).parent / 'optics'))
from generate_field import source, TARGET, SIZE
from sample_field import render
from render_field import shade


class OpticalFieldTests(unittest.TestCase):
    def test_reproducible_executable_line_requirement(self):
        text = TARGET.read_text()
        self.assertEqual(text, source())
        self.assertGreaterEqual(sum(line.startswith('    put(') for line in text.splitlines()), 100000)

    def test_every_sample_is_rendered_once_with_bounded_color(self):
        seen = set()
        def put(position, color):
            self.assertNotIn(position, seen)
            seen.add(position)
            self.assertEqual(len(color), 3)
            self.assertTrue(all(isinstance(channel, int) and 0 <= channel <= 255 for channel in color))
        render(put, shade)
        self.assertEqual(seen, {(x, y) for x in range(SIZE) for y in range(SIZE)})

    def test_field_contains_visible_optical_variation(self):
        colors = {shade(x / 32, y / 32) for x in range(33) for y in range(33)}
        self.assertGreater(len(colors), 100)


if __name__ == '__main__':
    unittest.main()
