"""Execute every sample, producing a fallback and a runtime height/normal field."""
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
    import numpy as np
    import io
    import json
    image = Image.new('RGB', (WIDTH, HEIGHT))
    render_samples(image.putpixel)
    # Every generated sample contributes to the height field. Its finite
    # differences become normals used by the live refractive renderer.
    pixels = np.asarray(image, dtype=np.float32)
    height = (pixels[:, :, 0] - 222) / 40
    dy, dx = np.gradient(height)
    flow = np.stack((np.clip(height, 0, 1),
                     np.clip(.5 + dx * 28, 0, 1),
                     np.clip(.5 + dy * 28, 0, 1)), axis=-1)
    flow_image = Image.fromarray(np.rint(flow * 255).astype('uint8'))
    flow_buffer = io.BytesIO()
    flow_image.save(flow_buffer, 'PNG', optimize=True)
    flow_payload = flow_buffer.getvalue()
    flow_name = 'glass-flow.' + hashlib.sha256(flow_payload).hexdigest()[:12] + '.png'
    image = image.filter(ImageFilter.GaussianBlur(.7))
    buffer = io.BytesIO()
    image.save(buffer, 'WEBP', quality=88, method=6)
    payload = buffer.getvalue()
    name = 'glass-field.' + hashlib.sha256(payload).hexdigest()[:12] + '.webp'
    assets = root / 'assets'
    assets.mkdir(parents=True, exist_ok=True)
    (assets / name).write_bytes(payload)
    (assets / flow_name).write_bytes(flow_payload)
    for prior in assets.glob('glass-flow.*.png'):
        if prior.name != flow_name:
            prior.unlink()
    manifest = {'fallback': name, 'flow': flow_name, 'width': WIDTH,
                'height': HEIGHT, 'samples': WIDTH * HEIGHT,
                'channels': ['height', 'normalX', 'normalY']}
    (assets / 'optical-field.json').write_text(json.dumps(manifest))
    for prior in assets.glob('glass-field.*.webp'):
        if prior.name != name:
            prior.unlink()
    print(f'Optical scene: {WIDTH}x{HEIGHT}, {len(payload):,} fallback bytes, {len(flow_payload):,} live field bytes')
    return name


if __name__ == '__main__':
    import sys
    build(Path(sys.argv[1]))
