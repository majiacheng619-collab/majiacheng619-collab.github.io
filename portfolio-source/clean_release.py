"""我从当前发布树中清除已确认停用的资源，并防止旧数据再次归档。"""
from pathlib import Path

OBSOLETE=(
    '.gitignore',
    'assets/favicon.99c44e666ff1.svg',
    'assets/apple-touch-icon.e2c55cba898e.png',
)

def clean(root):
    from film.cache_probe import refresh_documentation
    refresh_documentation(root)
    for relative in OBSOLETE:
        file=root/relative
        if file.is_file(): file.unlink()
    # Git does not retain empty folders; my publication archive follows the same rule.
    for folder in sorted((p for p in root.rglob('*') if p.is_dir()),key=lambda p:len(p.parts),reverse=True):
        if not any(folder.iterdir()): folder.rmdir()
