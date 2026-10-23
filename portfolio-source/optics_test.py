"""我验证百万行分块源码可复现，且所有独立采样都实际参与场景渲染。"""
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).parent / 'optics'))
from generate_field import WIDTH, HEIGHT, TILES, source, tile_path
from render_field import shade, render_samples


class OpticalFieldTests(unittest.TestCase):
    def test_reproducible_million_executable_statements(self):
        count = 0
        for index in range(TILES):
            text = tile_path(index).read_text()
            self.assertEqual(text, source(index))
            count += sum(line.startswith('    put(') for line in text.splitlines())
        self.assertEqual(count, WIDTH * HEIGHT)
        self.assertGreaterEqual(count, 1000000)

    def test_every_coordinate_rendered_once(self):
        visited = bytearray(WIDTH * HEIGHT)
        def put(position, color):
            x, y = position
            self.assertTrue(0 <= x < WIDTH and 0 <= y < HEIGHT)
            index = y * WIDTH + x
            self.assertFalse(visited[index])
            visited[index] = 1
            self.assertEqual(len(color), 3)
            self.assertTrue(all(isinstance(channel, int) and 0 <= channel <= 255 for channel in color))
        render_samples(put)
        self.assertEqual(sum(visited), WIDTH * HEIGHT)

    def test_material_contains_nonconstant_optical_detail(self):
        colors = {shade(x / 32, y / 32) for x in range(33) for y in range(33)}
        self.assertGreater(len(colors), 100)


if __name__ == '__main__':
    unittest.main()
