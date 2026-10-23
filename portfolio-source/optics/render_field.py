"""我离线渲染折射波纹与焦散，让大规模场景计算不进入浏览器主线程。"""
from pathlib import Path
from math import sin, cos, exp, pi
import hashlib
from sample_field import render


def shade(u, v):
    # Two curved wave fronts model an illuminated, rippled glass sheet.
    warp = u + .09 * sin(v * pi * 2.4) + .025 * sin(v * pi * 7)
    crest = exp(-((warp - .42) / .032) ** 2)
    second = exp(-((warp - .58) / .09) ** 2)
    glow = exp(-(((u - .7) / .47) ** 2 + ((v - .3) / .7) ** 2))
    ripple = sin((warp + v * .12) * pi * 8) * .5 + .5
    # A gentle blue/pearl palette keeps text contrast stable over the scene.
    red = 216 + 22 * crest + 10 * second + 5 * ripple
    green = 230 + 18 * crest + 6 * second + 5 * glow
    blue = 243 + 10 * crest + 6 * glow
    return tuple(round(min(255, max(0, value))) for value in (red, green, blue))


def build(root):
    from PIL import Image, ImageFilter
    image = Image.new('RGB', (320, 320))
    render(image.putpixel, shade)
    image = image.resize((960, 960), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
    import io
    buffer = io.BytesIO()
    image.save(buffer, 'WEBP', quality=88, method=6)
    payload = buffer.getvalue()
    name = 'glass-field.' + hashlib.sha256(payload).hexdigest()[:12] + '.webp'
    assets = root / 'assets'
    assets.mkdir(parents=True, exist_ok=True)
    (assets / name).write_bytes(payload)
    for old in assets.glob('glass-field.*.webp'):
        if old.name != name:
            old.unlink()
    print(f'Optical scene: {len(payload):,} bytes; {name}')
    return name


if __name__ == '__main__':
    import sys
    build(Path(sys.argv[1]))
