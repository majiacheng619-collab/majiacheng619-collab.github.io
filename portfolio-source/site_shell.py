"""Shared page shell and the single cross-device navigation."""
from pathlib import Path
import re

def build_renderer(ROOT,CSS,JS,ICON,TOUCH_ICON,MONOGRAM,media):
 nav=[('首页','index.html'),('作品','projects/index.html'),('经历','experience/index.html'),('荣誉','honor/index.html'),('近况','updates/index.html')]
 def glass_dock(path):
  icons = {
   'home':'<path d="m3.5 10 8.5-7 8.5 7v9a1.5 1.5 0 0 1-1.5 1.5h-4.5v-7h-6v7H5A1.5 1.5 0 0 1 3.5 19Z"/>',
   'work':'<rect x="3" y="6.5" width="18" height="14" rx="3"/><path d="M8.5 6.5V5A1.5 1.5 0 0 1 10 3.5h4A1.5 1.5 0 0 1 15.5 5v1.5M3.5 11.5a24 24 0 0 0 17 0M10 12.5v3h4v-3"/>',
   'journey':'<path d="M4 5h12a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h12M7 2 4 5l3 3m10 6 3 3-3 3"/>',
   'award':'<path d="M8 3.5h8v5a4 4 0 0 1-8 0Zm0 1H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 12.5v5m-4 3h8m-7.5-3h7v3h-7Z"/>',
   'contact':'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4.5 7 7.5 6 7.5-6"/>'
  }
  entries=[('首页','index.html','home'),('作品','projects/index.html','work'),('经历','experience/index.html','journey'),('荣誉','honor/index.html','award'),('联系','index.html#about','contact')]
  links=[]
  group_path='projects/index.html' if path.startswith('poster/') else 'experience/index.html' if path.startswith('updates/') else path
  for label,href,icon in entries:
   active=group_path==href or (href!='index.html' and '#' not in href and group_path.startswith(href.removesuffix('index.html')))
   current=' aria-current="page"' if active else ''
   links.append(f'<a class="glass-dock__link" data-dock-item data-dock-link href="{href}"{current}><svg viewBox="0 0 24 24" aria-hidden="true">{icons[icon]}</svg><span>{label}</span></a>')
  links.append('<button type="button" class="glass-dock__link" data-dock-item data-dock-search data-search-open aria-label="搜索" aria-haspopup="dialog" aria-controls="search-dialog" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><span>搜索</span></button>')
  return '<nav class="glass-dock" data-glass-dock aria-label="快捷导航"><span class="glass-dock__lens" data-dock-lens aria-hidden="true"></span>'+''.join(links)+'</nav>'


 def render(path,title,desc,body):
  depth=len(Path(path).parts)-1; prefix='../'*depth
  footer='<footer class="site-footer"><div class="footer-bottom">© 2026 马嘉程</div></footer>'
  results=nav+[('萌芽保卫队 · 网页塔防游戏','projects/sprout-patrol/index.html'),('AI 叙事短视频 · 独立创作','projects/ai-content/index.html'),('知识付费 · 用户增长与运营','experience/index.html#ecommerce'),('直播 · 内容与用户运营','experience/index.html#livestream'),('Word、Excel、Canva · 工具技能','experience/index.html#skills'),('面包挑战 · 活动视觉','poster/index.html'),('24秒作品介绍','index.html#introduction'),('项目思考 · 需求与设计判断','index.html#approach'),('成长机制 · 萌芽、成株与开花','projects/sprout-patrol/index.html#mechanism')]
  search=''.join(f'<a data-search-item href="{u}">{l}</a>' for l,u in results)
  dialogs=f'<dialog id="search-dialog" class="search-dialog" aria-labelledby="search-title"><button type="button" class="dialog-close" data-dialog-close aria-label="关闭搜索">×</button><div class="search-heading"><h2 id="search-title">搜索</h2></div><label class="sr-only" for="search-input">搜索作品与经历</label><input id="search-input" data-search-input type="search" placeholder="作品、经历、联系方式" autocomplete="off" enterkeyhint="search"/><p class="sr-only" data-search-count aria-live="polite"></p><div class="search-results">{search}</div><p data-search-empty hidden>没有找到相关内容</p></dialog><dialog id="image-dialog" class="image-dialog" aria-label="作品与照片大图"><button type="button" class="dialog-close" data-dialog-close aria-label="关闭大图">×</button><img data-dialog-image src="assets/portrait-white-960.b8bfe698eef3.webp" alt="马嘉程证件照" width="960" height="960"/></dialog>'

  doc=f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/><title>{title if path=="index.html" else title+"｜马嘉程"}</title><meta name="description" content="{desc}"/><meta property="og:title" content="{title if path=="index.html" else title+"｜马嘉程"}"/><meta property="og:description" content="{desc}"/><meta name="theme-color" content="#f7f8fa"/><link rel="canonical" href="https://majiacheng619-collab.github.io/{"" if path=="index.html" else path.replace("index.html","")}"/><link rel="icon" href="{ICON}" type="image/svg+xml"/><link rel="apple-touch-icon" href="{TOUCH_ICON}"/><link rel="stylesheet" href="{CSS}"/><script defer src="{JS}"></script></head><body class="{'home-page' if path=='index.html' else 'inner-page'}"><a class="skip-link" href="#main">跳转到正文</a><main id="main" tabindex="-1">{body}{footer}</main>{dialogs}{glass_dock(path)}<audio data-ambient loop preload="none" src="{media["music"]}"></audio><p class="sr-only" data-sound-status aria-live="polite"></p></body></html>'
  doc=doc.replace('</head>', '<meta name="color-scheme" content="light"/><meta name="format-detection" content="telephone=no"/> <meta property="og:locale" content="zh_CN"/></head>')
  doc=doc.replace(f'{footer}</main>',f'</main>{footer}')
  ambient='<div class="ambient-field" aria-hidden="true"></div>'
  doc=doc.replace('<a class="skip-link"',ambient+'<a class="skip-link"')
  canonical=re.search(r'<link rel="canonical" href="([^"]+)"',doc).group(1)
  doc=doc.replace('</head>',f'<meta property="og:url" content="{canonical}"/><meta property="og:image" content="https://majiacheng619-collab.github.io/assets/portrait-white-960.b8bfe698eef3.webp"/></head>')
  def relative(match):
   attr,value=match.groups()
   return f'{attr}="{value if re.match(r"^(?:https?:|mailto:|tel:|#|data:)",value) else prefix+value}"'
  doc=re.sub(r'(href|src|poster)="([^"]+)"',relative,doc)
  target=ROOT/path; target.parent.mkdir(parents=True,exist_ok=True); target.write_text(doc)
  return doc

 return render
