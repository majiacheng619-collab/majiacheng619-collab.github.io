"""我在构建时逐块渲染水波光场，浏览器只下载压缩后的背景纹理。"""
from pathlib import Path
from math import sin, cos, exp, pi, sqrt
import hashlib
import gc
import runpy
from generate_field import WIDTH, HEIGHT, TILES, tile_path


def shade(u, v):
    # Curved wave fronts and grazing highlights produce a clear, quiet lens field.
    warped = u + .065 * sin(v * pi * 2.4) + .018 * sin(v * pi * 7)
    crest = exp(-((warped - .38) / .017) ** 2)
    echo = exp(-((warped - .62) / .055) ** 2)
    radius = sqrt(((u - .68) * 1.1) ** 2 + ((v - .32) * .8) ** 2)
    ring = exp(-((radius - .35) / .024) ** 2)
    pearl = sin((warped + v * .12) * pi * 6) * .5 + .5
    return tuple(round(min(255, max(0, channel))) for channel in (
        222 + 19 * crest + 9 * echo + 8 * ring + 4 * pearl,
        234 + 15 * crest + 5 * echo + 7 * ring,
        246 + 8 * crest + 4 * ring,
    ))


def render_samples(put, color=shade):
    # Clear the executed namespace after each tile; do not retain twelve code objects.
    for index in range(TILES):
        namespace = runpy.run_path(str(tile_path(index)))
        namespace['render'](put, color)
        namespace.clear()
        gc.collect()


def build(root):
    from PIL import Image, ImageFilter
    import io
    image = Image.new('RGB', (WIDTH, HEIGHT))
    render_samples(image.putpixel)
    image = image.filter(ImageFilter.GaussianBlur(.7))
    buffer = io.BytesIO()
    image.save(buffer, 'WEBP', quality=88, method=6)
    payload = buffer.getvalue()
    name = 'glass-field.' + hashlib.sha256(payload).hexdigest()[:12] + '.webp'
    assets = root / 'assets'
    assets.mkdir(parents=True, exist_ok=True)
    (assets / name).write_bytes(payload)
    for prior in assets.glob('glass-field.*.webp'):
        if prior.name != name:
            prior.unlink()
    print(f'Optical scene: {WIDTH}x{HEIGHT}, {len(payload):,} bytes; {name}')
    return name


if __name__ == '__main__':
    import sys
    build(Path(sys.argv[1]))
