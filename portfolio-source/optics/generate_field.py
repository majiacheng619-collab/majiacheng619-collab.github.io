"""我按需导出光场采样程序；正式构建直接计算，不保存展开文件。"""
from pathlib import Path
import argparse

WIDTH, HEIGHT, TILE = 1280, 960, 320
DIRECTORY = Path(__file__).parent
TILES = (WIDTH // TILE) * (HEIGHT // TILE)


def tile_path(index):
    return DIRECTORY / f'sample_tile_{index:02d}.py'


def source(index):
    column, row = index % (WIDTH // TILE), index // (WIDTH // TILE)
    lines = [f'"""Generated optical tile {index:02d}; regenerate with generate_field.py."""',
             'def render(put, shade):']
    for y in range(row * TILE, (row + 1) * TILE):
        for x in range(column * TILE, (column + 1) * TILE):
            u, v = (x + .5) / WIDTH, (y + .5) / HEIGHT
            lines.append(f'    put(({x}, {y}), shade({u:.9f}, {v:.9f}))')
    return '\n'.join(lines) + '\n'


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for index in range(TILES):
        expected, target = source(index), tile_path(index)
        if args.check:
            if target.exists() and target.read_text() != expected:
                raise SystemExit(f'Optical tile {index:02d} differs; run generate_field.py.')
        else:
            target.write_text(expected)
    expected_names = {tile_path(i).name for i in range(TILES)}
    if {p.name for p in DIRECTORY.glob('sample_tile_*.py')} - expected_names:
        raise SystemExit('Unexpected optical sampling tile.')
    print(f'{"Checked optional exports for" if args.check else "Generated"} {WIDTH * HEIGHT:,} samples in {TILES} tiles.')
