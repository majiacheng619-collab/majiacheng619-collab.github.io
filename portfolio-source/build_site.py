from pathlib import Path
import hashlib, html, json, re
ROOT=Path(__file__).resolve().parent/'site'
from identity import build as build_identity
ICON, TOUCH_ICON, MONOGRAM = build_identity(ROOT)
transcript=html.escape((ROOT/'assets/media/intro-script.txt').read_text())
media=json.loads((Path(__file__).parent/'film-manifest.json').read_text())
music=sorted((ROOT/'assets/media').glob('ambient.*.mp3'))
if len(music)!=1: raise RuntimeError('Expected exactly one current ambient track')
media['music']=music[0].relative_to(ROOT).as_posix()
detail_path=Path(__file__).parent/'detail.css'
css=(Path(__file__).parent/'site.css').read_text()+'\n'+detail_path.read_text()+'\n'+(Path(__file__).parent/'foundation.css').read_text()+'\n'+(Path(__file__).parent/'experience.css').read_text()+'\n'+(Path(__file__).parent/'detail-premium.css').read_text()+'\n'+(Path(__file__).parent/'home-premium.css').read_text()+'\n'+(Path(__file__).parent/'liquid.css').read_text()+'\n'+(Path(__file__).parent/'glass-dock.css').read_text()
js=(Path(__file__).parent/'interactions.js').read_text()+'\n'+(Path(__file__).parent/'glass-dock.js').read_text()
def asset(text,stem,ext):
 name=f'assets/{stem}.{hashlib.sha256(text.encode()).hexdigest()[:12]}.{ext}'
 (ROOT/name).write_text(text)
 return name
CSS=asset(css,'portfolio','css'); JS=asset(js,'portfolio','js')
def img(src,alt,classes='',eager=False):
 width,height=dimensions.get(src,(1280,720))
 return f'<img class="{classes}" src="{src}" alt="{alt}" width="{width}" height="{height}" decoding="async" '+('fetchpriority="high"' if eager else 'loading="lazy"')+'/>'
def cta(url,label,secondary=False): return f'<a class="button {"secondary" if secondary else "primary"}" href="{url}"'+(' download="马嘉程_个人简历.pdf"' if url.endswith('.pdf') else '')+f'>{label}</a>'
from site_shell import build_renderer
render=build_renderer(ROOT,CSS,JS,ICON,TOUCH_ICON,MONOGRAM,media)
dimensions=json.loads((Path(__file__).parent/'image-dimensions.json').read_text())
from PIL import Image
for current in (Path(__file__).parent/'assets-overrides').glob('garden-current-*.webp'):
 dimensions['assets/'+current.name]=Image.open(current).size
preview=Image.open(ROOT/'poster/poster.png').convert('RGB')
preview.thumbnail((1100,1600))
import io
preview_bytes=io.BytesIO(); preview.save(preview_bytes,format='WEBP',quality=86,method=6)
poster_preview='assets/poster-preview.'+hashlib.sha256(preview_bytes.getvalue()).hexdigest()[:12]+'.webp'
(ROOT/poster_preview).write_bytes(preview_bytes.getvalue())
dimensions[poster_preview]=preview.size
for old in (ROOT/'assets').glob('poster-preview.*.webp'):
 if old.name!=Path(poster_preview).name: old.unlink()


gamevisual=f'<a class="product-visual" href="game/index.html">{img("assets/garden-current-home.webp","萌芽保卫队7.0清晨实战截图",eager=True)}</a>'

from home import build_home
home=build_home(img, cta, media, transcript)
render('index.html','马嘉程','我是马嘉程，2027届本科生，求职方向为产品与运营。体验我的网页游戏，观看AI叙事视频，了解电商教学与经营实践。',home)

# A shared, quiet layout for every portfolio destination.
def detail_open(name): return f'<div class="detail-page detail-{name}">'
def detail_close(): return '</div>'
def detail_hero(title,desc,actions=''):
 return f'<section class="detail-hero"><div class="detail-shell"><h1>{title}</h1>'+(f'<p class="detail-intro">{desc}</p>' if desc else '')+ (f'<div class="actions">{actions}</div>' if actions else '')+'</div></section>'
def detail_split(anchor,title,text,visual='',theme=''):
 return f'<section class="detail-split {theme}" id="{anchor}"><div class="detail-shell"><div class="detail-split-copy"><h2>{title}</h2>{text}</div>'+ (f'<div class="detail-split-media">{visual}</div>' if visual else '')+'</div></section>'
def detail_rows(anchor,title,entries):
 return f'<section class="detail-rows" id="{anchor}"><div class="detail-shell"><h2>{title}</h2><div class="detail-row-list">'+''.join(f'<article class="detail-row"><h3>{t}</h3><p>{d}</p></article>' for t,d in entries)+'</div></div></section>'
def detail_end(url,label):
 return f'<section class="detail-next" aria-label="继续浏览"><div class="detail-shell"><div class="actions">{cta(url,label)}{cta("resume.pdf","下载简历",True)}</div></div></section>'
def theme_art(kind,title):
 return f'<div class="theme-art theme-art-{kind}" role="img" aria-label="{title}，主题视觉，非视频截图"><strong>{title}</strong></div>'

projects=detail_open('projects')+detail_hero('作品','游戏、影像与线下实践。')
projects+=detail_split('selected-work','萌芽保卫队','<p>让每一次成长，成为守住花园的策略。</p><div class="actions">'+cta('game/index.html','开始游戏')+cta('projects/sprout-patrol/index.html','查看项目',True)+'</div>',gamevisual,'detail-feature')
projects+=detail_split('content-work','AI 叙事影像','<p>从选择、风险到陪伴，独立完成三支叙事短片。</p><div class="actions">'+cta('projects/ai-content/index.html','观看作品')+'</div>',theme_art('choice','选择'))
projects+=detail_split('service-work','电商教学','<p>独立发起项目，负责咨询、教学与经营辅导。</p><div class="actions">'+cta('experience/index.html#ecommerce','了解经历')+'</div>','<div class="detail-number"><strong>1,000<span>左右</span></strong><p>累计去重学员</p></div>')
projects+=detail_split('field-work','面包挑战','<p>参与规则设计、物料准备与现场执行。</p><div class="actions">'+cta('poster/index.html','查看活动')+'</div>',f'<a class="detail-poster-preview" href="poster/index.html">{img(poster_preview,"面包挑战实际使用的宣传海报")}</a>')
projects+=detail_end('experience/index.html','实践经历')+detail_close()
render('projects/index.html','作品','马嘉程的网页游戏、AI叙事视频、教学服务与线下活动。',projects)

experience=detail_open('experience')+detail_hero('经历','产品与运营实践。')
experience+=detail_split('ecommerce','电商教学与用户增长','<p>2022.06—2024.12</p><p>独立发起项目，负责咨询、教学与经营辅导，与 40–50 名推广伙伴协作。</p>','<div class="detail-number"><strong>1,000<span>左右</span></strong><p>累计去重学员</p></div>')
experience+=detail_rows('service-thinking','服务与交付',[('教学内容','制作教学视频、操作手册与 FAQ。'),('经营辅导','围绕选品、定价、运费与投流，结合店铺实际情况持续答疑。')])
experience+=detail_split('livestream','直播内容与用户运营','<p>2026.02—2026.09</p><p>独立负责策划、封面与直播筹备，组织户外专场，通过社群与私信维护用户。</p><p>约 1 小时的单场直播，最高曝光 30 万余。</p><div class="actions">'+cta('honor/index.html','查看荣誉')+'</div>',f'<a class="detail-certificate" data-image-open data-image-target="image-dialog" href="honor/live-honor-2026.jpeg">{img("honor/live-honor-2026.jpeg","抖音家乡荣耀季青山湖区区县100强实际凭证")}</a>')
experience+=detail_rows('field','线下实践',[('面包挑战','2025.07—2025.08、2026.10 起。与朋友共同开展，参与规则设计、物料准备与现场执行，通常在 2–3 小时完成当场安排。'),('韩式炸鸡门店','2025.08—2025.11。与朋友合伙，承担加盟方案比选、选址签约、筹备采购与日常运营。')])
experience+=detail_rows('skills','技能',[('产品与开发','需求拆解、AI 辅助开发与迭代验收。'),('内容与视觉','ChatGPT、Seedream、Seedance、剪映、Canva。'),('办公与数据','Word、PowerPoint、Excel 常用公式、查找匹配及数据透视表。')])
experience+=detail_split('education','教育经历','<div class="detail-education"><h3>南昌理工学院</h3><p>智能制造工程 · 本科在读<br/>2025.09—2027.07（预计）</p><h3>华东交通大学</h3><p>铁道信号自动控制 · 专科<br/>2022.09—2025.07</p></div><p>两校就读期间均担任学习委员。2023 年获校优秀学生干部，持普通话二级甲等证书。</p><div class="actions">'+cta('resume.pdf','下载简历')+'</div>',f'<div class="detail-portrait">{img("assets/portrait-white-960.b8bfe698eef3.webp","马嘉程白底半身证件照")}</div>')+detail_close()
render('experience/index.html','实践经历','马嘉程的电商教学、直播运营、线下经营与教育经历。',experience)

game=detail_open('game')+detail_hero('萌芽保卫队','种下、守护、成长。',cta('game/index.html','开始游戏'))
game+='<section class="detail-game-visual"><div class="detail-shell"><a class="product-visual" href="game/index.html">'+img('assets/garden-current-play.webp','萌芽保卫队7.0黄昏实战截图',eager=True)+'</a></div></section>'
game+=detail_split('overview','我的分工','<p>独立负责玩法策划、需求拆解、交互与迭代验收，通过 AI 辅助实现代码。</p>','<div class="detail-game-facts"><div><strong>4</strong><span>个世界</span></div><div><strong>20</strong><span>个关卡</span></div></div>')
game+='<section class="detail-growth" id="mechanism"><div class="detail-shell"><h2>成长机制</h2><p class="detail-intro">用阳光补充防线，或等待现有植物成长。</p><div class="growth-demo"><div class="growth-steps">'
for i,t in enumerate(['萌芽','成株','开花']):
 game+=f'<button type="button" data-growth-step="{i}" aria-controls="growth-panel-{i}" aria-pressed="{str(i==0).lower()}"><strong>{t}</strong></button>'
game+='</div>'
for i,(t,d) in enumerate([('争取时间','保护萌芽，等待它长成。'),('形成防线','成株获得作战能力。'),('强化能力','投入阳光，让植物开花。')]):
 growth_image=['assets/growth-seed-sprout.da294e149655.png','assets/growth-seed-adult.01b9f733e3e8.png','assets/growth-seed-flower.3fb952bbfb40.png'][i]
 game+=f'<div id="growth-panel-{i}" data-growth-panel="{i}"'+f'><img class="growth-real" src="{growth_image}" alt="种子投手的{["萌芽","成株","开花"][i]}阶段" width="384" height="384" loading="lazy" decoding="async"/><div><h3>{t}</h3><p>{d}</p></div></div>'
game+='</div></div></section>'
game+=detail_split('journey','花园旅程','<p>四个世界，20 关，完成一关再走向下一关。</p>',f'<a class="product-visual" href="game/journal.html">{img("assets/garden-current-journey.webp","萌芽保卫队7.0花园旅程与关卡进度")}</a>')
game+=detail_rows('decisions','随时继续',[('引导与图鉴','首关引导入门，图鉴随时查阅。'),('存档','本机自动保存，也可导出存档码。')])

game+=detail_end('game/index.html','打开游戏')+detail_close()
render('projects/sprout-patrol/index.html','萌芽保卫队','网页塔防游戏：体验植物成长与资源分配，了解马嘉程的项目分工。',game)

ai=detail_open('ai')+detail_hero('AI 影像','三个故事，三种视角。')
ai+='<div id="originals">'
for kind,title,full,url,desc in [
 ('choice','选择','升学与就业选择','https://v.douyin.com/M8uV_tAxKlk/','从不同方向的选择，呈现人物的犹豫与决定。'),
 ('risk','风险','从赢两千到欠八十万','https://v.douyin.com/_yDmgMzvSqE/','通过转折与节奏，呈现风险逐步累积的代价。'),
 ('care','陪伴','陪家人抗癌','https://v.douyin.com/BIuX2Tb5rvM/','以人物关系、画面与声音表达家庭陪伴。')]:
 ai+=f'<section class="detail-film" id="film-{kind}"><div class="detail-shell"><div class="detail-film-art">{theme_art(kind,title)}</div><div class="detail-film-copy"><h2>{full}</h2><p>{desc}</p><a class="button primary" href="{url}" target="_blank" rel="noopener noreferrer">观看原作<span class="sr-only">（新标签页）</span></a></div></div></section>'
ai+='</div><div class="detail-shell detail-note"><p>AI 叙事作品，非个人经历；配图为主题视觉。</p></div>'
ai+=detail_rows('process','创作流程',[('脚本与分镜','使用 ChatGPT 梳理主题与脚本，拆分镜头任务。'),('素材与剪辑','以 Seedream、Seedance 生成素材，在剪映完成配音、字幕与剪辑。')])+'<div class="detail-shell"><div class="actions">'+cta('resume.pdf','下载简历',True)+'</div></div>'+detail_close()
render('projects/ai-content/index.html','AI叙事视频','马嘉程独立完成的三支AI叙事作品与原作入口。',ai)

poster=detail_open('poster')+detail_hero('面包挑战','与朋友共同策划的线下活动。')
poster+=detail_split('visual','活动海报','<p>2025.07—2025.08、2026.10 起。</p><p>我参与规则设计、A3 宣传物料准备与现场执行，向参与者说明收费、挑战要求与奖励。</p><div class="actions"><a class="button primary" data-image-open data-image-target="image-dialog" href="poster/poster.png">查看海报原图</a></div>',f'<a class="detail-poster-original" data-image-open data-image-target="image-dialog" href="poster/poster.png">{img(poster_preview,"面包挑战实际使用的活动宣传海报")}</a>')
poster+=detail_rows('thinking','策划与执行',[('共同策划','与朋友共同准备活动规则和宣传物料。'),('现场执行','根据人流调整经营位置与组织方式，通常在 2–3 小时完成当场安排。')])
poster+=detail_end('experience/index.html#field','查看经历')+detail_close()
render('poster/index.html','面包挑战','面包挑战的实际宣传物料与马嘉程参与的规则设计、筹备和现场执行。',poster)

honor=detail_open('honor')+detail_hero('荣誉','')
honor+=detail_split('livestream-honor','青山湖区区县 100 强','<p>2026 年抖音家乡荣耀季</p><div class="actions"><a class="button primary" data-image-open data-image-target="image-dialog" href="honor/live-honor-2026.jpeg">查看凭证</a>'+cta('experience/index.html#livestream','相关经历',True)+'</div>',f'<a class="detail-certificate" data-image-open data-image-target="image-dialog" href="honor/live-honor-2026.jpeg">{img("honor/live-honor-2026.jpeg","2026抖音家乡荣耀季青山湖区区县100强荣誉凭证",eager=True)}</a>')
honor+=detail_split('campus-honor','校优秀学生干部','<p>2023 年 · 华东交通大学</p><p>在两校就读期间均担任学习委员，负责班级沟通与学习事务。</p><div class="actions">'+cta('experience/index.html#education','教育经历')+cta('resume.pdf','下载简历',True)+'</div>','<div class="detail-campus-mark"><strong>2023</strong><p>华东交通大学<br/>校优秀学生干部</p></div>')+detail_close()
render('honor/index.html','荣誉','马嘉程的抖音家乡荣耀季荣誉凭证与校园服务荣誉。',honor)

updates=detail_open('updates')+detail_hero('近况','')
updates+=detail_rows('recent-work','2026 年秋',[('萌芽保卫队','已公开 4 个世界、20 个关卡的网页游戏，持续迭代操作与策略体验。'),('AI 叙事影像','独立完成并发布三支叙事视频。'),('面包挑战','2026 年 10 月起与朋友继续开展线下活动。')])+detail_end('mailto:19870043434@163.com','邮件联系')+detail_close()
render('updates/index.html','近况','马嘉程的近期作品与实践。',updates)

# Keep only the current generated portfolio CSS and JS.
for item in (ROOT/'assets').glob('portfolio.*'):
 if item.name not in [Path(CSS).name,Path(JS).name]: item.unlink()
print('Rebuilt eight portfolio pages with a shared minimal layout.')


# Stable entry points, crawl metadata and a useful destination for retired links.
not_found = '<section class="page-hero"><h1>换个入口，<br>继续探索。</h1><p class="lead">这个地址可能已更新。我的作品与经历都在这里。</p><div class="actions" style="margin-top:30px">'+cta('index.html','返回首页')+cta('projects/index.html','浏览作品',True)+'</div></section>'
render('404.html', '页面未找到', '返回马嘉程的个人网站，继续浏览作品与实践经历。', not_found)
page = ROOT/'404.html'
# Absolute site-root URLs remain valid for any missing multi-level route.
text = page.read_text()
text = re.sub(r'(href|src|poster)="(?!https?:|mailto:|tel:|#|data:|/)([^"]+)"', r'\1="/\2"', text)
page.write_text(text.replace('</head>', '<meta name="robots" content="noindex"/></head>'))
origin='https://majiacheng619-collab.github.io/'
urls=['','projects/','experience/','projects/sprout-patrol/','projects/ai-content/','poster/','honor/','updates/','game/','game/guide.html','game/codex.html','game/about.html']
(ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+origin+u+'</loc></url>' for u in urls)+'</urlset>\n')
(ROOT/'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: '+origin+'sitemap.xml\n')
# Metadata does not require JavaScript or remote fonts to be useful.
profile={'@context':'https://schema.org','@type':'Person','name':'马嘉程','url':origin,'description':'2027届本科，产品与运营方向；电商教学、AI叙事视频与网页游戏实践。'}
page=ROOT/'index.html'
page.write_text(page.read_text().replace('</head>', '<script type="application/ld+json">'+json.dumps(profile,ensure_ascii=False)+'</script></head>'))
