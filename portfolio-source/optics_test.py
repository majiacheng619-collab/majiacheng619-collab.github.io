"""我验证完整采样覆盖，并与已发布采样结果的逐像素摘要比较。"""
from pathlib import Path
import hashlib
import sys
import unittest
sys.path.insert(0, str(Path(__file__).parent / 'optics'))
from generate_field import WIDTH, HEIGHT
from render_field import shade, render_samples


class OpticalFieldTests(unittest.TestCase):
    def test_sampler_matches_the_published_material(self):
        # The baseline comes from the previously published sampling programs.
        # Keep this regression independent of optional image/build packages.
        pixels = bytearray(WIDTH * HEIGHT * 3)
        def put(position, color):
            x, y = position
            offset = (y * WIDTH + x) * 3
            pixels[offset:offset + 3] = bytes(color)
        render_samples(put)
        self.assertEqual(hashlib.sha256(pixels).hexdigest(),
                         '54835b1e2d6dd8a1f8b48deaae78bc3ade532de3d2ac9b2ecec462941a7239bd')

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
