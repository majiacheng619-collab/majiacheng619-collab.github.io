"""Build one MJC monogram for navigation, tab icons and home-screen icons."""
from pathlib import Path
import hashlib
from PIL import Image, ImageDraw
PATH='M8 29V11h4l8 12 8-12h4v18h-5V20l-7 10-7-10v9Z'
def build(root):
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="#1d2331"/><path d="{PATH}" fill="#fff"/></svg>'
    icon='assets/identity.'+hashlib.sha256(svg.encode()).hexdigest()[:12]+'.svg'
    (root/icon).write_text(svg)
    image=Image.new('RGB',(720,720),'#edf0f7');d=ImageDraw.Draw(image)
    d.rounded_rectangle((45,45,675,675),radius=165,fill='#1d2331')
    # 我以姓名拼音首字母 M 构成同一枚折线标识。
    points=[(8,29),(8,11),(12,11),(20,23),(28,11),(32,11),(32,29),(27,29),(27,20),(20,30),(13,20),(13,29)]
    d.polygon([(int(x*15+60),int(y*15+60)) for x,y in points],fill='white')
    import io
    output=io.BytesIO();image.resize((180,180),Image.Resampling.LANCZOS).save(output,format='PNG')
    content=output.getvalue();touch='assets/identity-touch.'+hashlib.sha256(content).hexdigest()[:12]+'.png';(root/touch).write_bytes(content)
    for old in (root/'assets').glob('identity*'):
        if old.name not in {Path(icon).name,Path(touch).name}:old.unlink()
    return icon,touch,PATH
