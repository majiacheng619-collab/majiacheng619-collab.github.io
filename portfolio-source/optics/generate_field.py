"""我生成可复现的逐采样光场程序，构建时渲染，浏览器只下载压缩背景。"""
from pathlib import Path
import argparse

SIZE = 320
TARGET = Path(__file__).with_name('sample_field.py')


def source():
    lines = [
        '"""Generated optical sampling program; regenerate with generate_field.py."""',
        'def render(put, shade):',
    ]
    for y in range(SIZE):
        for x in range(SIZE):
            # Each statement computes one distinct sample of the optical field.
            u = (x + .5) / SIZE
            v = (y + .5) / SIZE
            lines.append(f'    put(({x}, {y}), shade({u:.9f}, {v:.9f}))')
    return '\n'.join(lines) + '\n'


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    expected = source()
    if args.check:
        if TARGET.read_text() != expected:
            raise SystemExit('Optical sampling code differs; run generate_field.py.')
        print(f'Verified {SIZE * SIZE:,} executable optical sample statements.')
    else:
        TARGET.write_text(expected)
        print(f'Generated {SIZE * SIZE:,} executable optical sample statements.')
