from pathlib import Path
import hashlib, html, json, re
ROOT=Path(__file__).resolve().parent/'site'
from identity import build as build_identity
ICON, TOUCH_ICON, MONOGRAM = build_identity(ROOT)
transcript=html.escape((ROOT/'assets/media/intro-script.txt').read_text())
media=json.loads((Path(__file__).parent/'film-manifest.json').read_text())
STYLE_SOURCES = ('device-frame.css','glass-dock.css','sprite.css','control-glass.css','water-events.css','portfolio.css')
SCRIPT_SOURCES = ('interactions.js','glass-dock.js','portfolio-interactions.js','portfolio-studio.js','portfolio-sculpture.js','sprite-brain.js','sprite.js','control-glass.js','editorial-gallery.js','portfolio-material.js')
css='\n'.join((Path(__file__).parent/name).read_text() for name in STYLE_SOURCES)
resume_sha=hashlib.sha256((Path(__file__).resolve().parent.parent/'resume.pdf').read_bytes()).hexdigest()
resume_asset='resume-'+resume_sha[:12]+'.pdf'
js='\n'.join((Path(__file__).parent/name).read_text() for name in SCRIPT_SOURCES).replace('RESUME_PDF_ASSET',resume_asset)
def asset(text,stem,ext):
 name=f'assets/{stem}.{hashlib.sha256(text.encode()).hexdigest()[:12]}.{ext}'
 (ROOT/name).write_text(text)
 return name
# Retire the model worker from inherited release archives as well as this build.
for old in (ROOT/'assets').glob('companion-worker.*.js'):
 old.unlink()
import sys
sys.path.insert(0,str(Path(__file__).parent/'optics'))
optical_manifest=json.loads((ROOT/'assets/optical-field.json').read_text())
optical_asset=optical_manifest['fallback']
js+='\n'+(Path(__file__).parent/'portfolio-optical.js').read_text().replace('OPTICAL_FLOW_ASSET',optical_manifest['flow'])
css=css.replace('GLASS_FIELD_ASSET',optical_asset)
CSS=asset(css,'portfolio','css'); JS=asset(js,'portfolio','js')
def img(src,alt,classes='',eager=False):
 width,height=dimensions.get(src,(1280,720))
 return f'<img class="{classes}" src="{src}" alt="{alt}" width="{width}" height="{height}" decoding="async" '+('fetchpriority="high"' if eager else 'loading="lazy"')+'/>'
def cta(url,label,secondary=False): return f'<a class="button {"secondary" if secondary else "primary"}" href="{url}"'+(' download="马嘉程_个人简历.pdf"' if url.endswith('.pdf') else '')+f'>{label}</a>'
from device_frames import device_frame
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



editorial=json.loads((Path(__file__).parent/'editorial-assets.json').read_text())
film_cover=editorial['filmCover']
from home import build_home
home=build_home(img, cta, media, transcript, film_cover)
render('index.html','马嘉程','马嘉程，2027届本科生。独立开展电商教学、校园打印与直播，参与门店经营和线下活动，策划并交付网页产品。',home)

# A shared, quiet layout for every portfolio destination.
def detail_open(name): return f'<div class="detail-page detail-{name}">'
def detail_close(): return '</div>'
def detail_hero(title,desc,actions=''):
 return f'<section class="detail-hero"><div class="detail-shell"><h1>{title}</h1>'+(f'<p class="detail-intro">{desc}</p>' if desc else '')+ (f'<div class="actions">{actions}</div>' if actions else '')+'</div></section>'
def detail_split(anchor,title,text,visual='',theme=''):
 return f'<section class="detail-split {theme}{" detail-copy-only" if not visual else ""}" id="{anchor}"><div class="detail-shell"><div class="detail-split-copy"><h2>{title}</h2>{text}</div>'+ (f'<div class="detail-split-media">{visual}</div>' if visual else '')+'</div></section>'
def detail_rows(anchor,title,entries):
 return f'<section class="detail-rows" id="{anchor}"><div class="detail-shell"><h2>{title}</h2><div class="detail-row-list">'+''.join(f'<article class="detail-row"><h3>{t}</h3><p>{d}</p></article>' for t,d in entries)+'</div></div></section>'
projects=detail_open('projects')+detail_hero('作品','网页产品、叙事影像与现场活动。')
projects+='<section class="work-gallery detail-shell" aria-label="作品与项目">'
projects+='<article class="work-card work-feature" id="selected-work" data-dock-tone="dark"><div class="work-copy"><p class="work-meta">交互产品 · 独立策划 · AI 辅助实现</p><h2>萌芽保卫队</h2><p>把植物成长与资源分配做成可玩的网页产品。我负责玩法设计、需求拆解与迭代验收。</p><dl class="work-metrics"><div><dt>世界</dt><dd>4</dd></div><div><dt>关卡</dt><dd>20</dd></div></dl><div class="actions">'+cta('game/index.html','开始游戏')+cta('projects/sprout-patrol/index.html','产品分工',True)+'</div></div><figure class="work-art" data-gallery-reveal>'+device_frame(img('assets/garden-current-play.webp','萌芽保卫队实际游戏画面',eager=True),'ipad')+'</figure></article>'
projects+='<article class="work-card work-film" id="content-work"><div class="work-copy"><p class="work-meta">影像创作 · 独立完成</p><h2>AI 叙事影像</h2><p>升学就业、风险与陪伴。三支短片，覆盖选题、脚本、分镜、素材与剪辑。</p><div class="actions">'+cta('projects/ai-content/index.html','观看三支作品')+'</div></div><figure class="work-art" data-gallery-reveal>'+img(film_cover,'电影胶片与镜头的栏目概念封面，非作品截图')+'</figure></article>'
projects+='<article class="work-card work-event" id="field-work"><div class="work-copy"><p class="work-meta">线下活动 · 与朋友共同开展</p><h2>面包挑战</h2><p>查看活动方案和现场实际使用的 A3 宣传物料。</p><div class="actions">'+cta('poster/index.html','活动方案与原件')+'</div></div></article>'
projects+='</section>'+detail_close()
render('projects/index.html','作品','马嘉程的网页产品、叙事影像与线下活动作品。',projects)

from case_studies import build_experience
experience=build_experience(cta,detail_rows)
render('experience/index.html','实践经历','马嘉程的电商教学、直播运营、线下经营与教育经历。',experience)

game=detail_open('game')+detail_hero('萌芽保卫队','种下、守护、成长。',cta('game/index.html','开始游戏'))
game+='<section class="detail-game-visual"><div class="detail-shell"><a class="product-visual device-preview" href="game/index.html">'+device_frame(img('assets/garden-current-play.webp','萌芽保卫队7.0黄昏实战截图',eager=True),'ipad')+'</a></div></section>'
game+=detail_split('overview','我的分工','<p id="product-process">独立负责玩法策划、需求拆解、交互与迭代验收，通过 Codex 辅助实现代码。</p>','<div class="detail-game-facts"><div><strong>4</strong><span>个世界</span></div><div><strong>20</strong><span>个关卡</span></div></div>')
game+='<section class="detail-growth" id="mechanism"><div class="detail-shell"><h2>成长机制</h2><p class="detail-intro">用阳光补充防线，或等待现有植物成长。</p><div class="growth-demo"><div class="growth-steps">'
for i,t in enumerate(['萌芽','成株','开花']):
 game+=f'<button type="button" data-growth-step="{i}" aria-controls="growth-panel-{i}" aria-pressed="{str(i==0).lower()}"><strong>{t}</strong></button>'
game+='</div>'
for i,(t,d) in enumerate([('争取时间','保护萌芽，等待它长成。'),('形成防线','成株获得作战能力。'),('强化能力','投入阳光，让植物开花。')]):
 growth_image=['assets/growth-seed-sprout.da294e149655.png','assets/growth-seed-adult.01b9f733e3e8.png','assets/growth-seed-flower.3fb952bbfb40.png'][i]
 game+=f'<div id="growth-panel-{i}" data-growth-panel="{i}"'+f'><img class="growth-real" src="{growth_image}" alt="种子投手的{["萌芽","成株","开花"][i]}阶段" width="384" height="384" loading="lazy" decoding="async"/><div><h3>{t}</h3><p>{d}</p></div></div>'
game+='</div></div></section>'
game+=detail_split('journey','花园旅程','<p>完成当前关卡后解锁下一关，可在旅程中查看进度。</p>','<a class="product-visual device-preview" href="game/journal.html">'+device_frame(img("assets/garden-current-journey.webp","萌芽保卫队7.0花园旅程与关卡进度"),'ipad')+'</a>')
game+=detail_rows('decisions','随时继续',[('引导与图鉴','首关引导帮助理解操作，图鉴用于查阅植物和敌人信息；将学习规则与进入玩法的过程衔接起来。'),('存档与继续','本机自动保存进度，也可导出存档码，让玩家能够中断后继续已有旅程。')])

game+=detail_close()
render('projects/sprout-patrol/index.html','萌芽保卫队','网页塔防游戏：体验植物成长与资源分配，了解马嘉程的项目分工。',game)

ai=detail_open('ai')+detail_hero('AI 影像','独立完成的三支叙事短片。')
ai+='<figure class="film-collection-cover" data-gallery-reveal>'+img(film_cover,'透明胶片与钛金属镜头的栏目概念视觉',eager=True)+'</figure>'
ai+='<div id="originals" class="film-program detail-shell">'
for index,(kind,full,url,desc) in enumerate([
 ('choice','升学与就业选择','https://v.douyin.com/M8uV_tAxKlk/','围绕升学与就业方向，呈现人物的犹豫与决定。'),
 ('risk','从赢两千到欠八十万','https://v.douyin.com/_yDmgMzvSqE/','通过转折与节奏，呈现风险逐步累积的代价。'),
 ('care','陪家人抗癌','https://v.douyin.com/BIuX2Tb5rvM/','以人物关系、画面与声音表达家庭陪伴。')],1):
 ai+=f'<section class="film-entry" id="film-{kind}"><span class="film-sequence" aria-hidden="true">{index:02d}</span><div class="film-copy"><h2>{full}</h2><p>{desc}</p></div><a class="button primary film-watch" href="{url}" target="_blank" rel="noopener noreferrer">观看原作<span class="sr-only">（新标签页）</span></a></section>'
ai+='</div><div class="detail-shell detail-note"><p>故事为创作，非个人经历。封面为栏目概念视觉。</p></div>'
ai+=detail_rows('process','创作流程',[('脚本与分镜','使用 ChatGPT 梳理脚本，将故事拆成分镜、镜头要求与素材提示词。'),('素材与剪辑','使用 Seedream、Seedance 生成素材，在剪映完成配音、字幕与剪辑，调整叙事节奏。')])+detail_close()
render('projects/ai-content/index.html','AI叙事视频','马嘉程独立完成的三支AI叙事作品与原作入口。',ai)

poster=detail_open('poster')+detail_hero('面包挑战','2025.07—2025.08、2026.10 起，与朋友共同开展。')
poster+=detail_split('visual','现场参与方式','<p>收费、挑战要求与分档奖励均在现场宣传海报中说明。</p><dl class="event-facts"><div><dt>参与价格</dt><dd>19.9 元 / 次</dd></div></dl>')
poster+='<section class="detail-shell evidence-section"><details class="proof-disclosure"><summary>查看现场使用的海报</summary><div class="proof-content"><a class="detail-poster-original" data-image-open data-image-target="image-dialog" href="poster/poster.png">'+img(poster_preview,'面包挑战实际使用的活动宣传海报，原始物料')+'</a></div></details></section>'
poster+=detail_rows('thinking','策划与执行',[('场景与目标','基于南昌当地市场观察，与朋友将互动挑战整理为可以在现场开展的低投入活动。'),('规则与物料','参与规则设计，准备 A3 海报，让参与者能在现场了解挑战要求。'),('组织与调整','统筹物料与现场安排，向参与者说明规则，根据人流调整场地与经营方式。'),('实际交付','完成策划与现场执行，吸引参与及围观，通常在 2–3 小时完成当场挑战安排。')])
poster+=detail_close()
render('poster/index.html','面包挑战','面包挑战的实际宣传物料与马嘉程参与的规则设计、筹备和现场执行。',poster)

honor=detail_open('honor')+detail_hero('荣誉','')
honor+=detail_split('livestream-honor','青山湖区区县 100 强','<p>2026 年抖音家乡荣耀季</p><div class="actions">'+cta('experience/index.html#livestream','相关经历',True)+'</div>',f'<a class="detail-certificate" data-image-open data-image-target="image-dialog" href="honor/live-honor-2026.jpeg">{img("honor/live-honor-2026.jpeg","2026抖音家乡荣耀季青山湖区区县100强荣誉凭证",eager=True)}</a>')
honor+=detail_split('campus-honor','校优秀学生干部','<p>2023 年 · 华东交通大学</p><div class="actions">'+cta('experience/index.html#education','教育经历')+'</div>')+detail_close()
render('honor/index.html','荣誉','马嘉程的抖音家乡荣耀季荣誉凭证与校园服务荣誉。',honor)

updates=detail_open('updates')+detail_hero('近况','')
updates+=detail_rows('recent-work','2026 年秋',[('面包挑战','2026 年 10 月起与朋友继续开展线下活动。<a href="poster/index.html">查看活动方案与物料</a>')])+detail_close()
render('updates/index.html','近况','马嘉程的近期作品与实践。',updates)

from contact import build_contact
render('contact/index.html','联系','联系马嘉程：邮箱、电话与个人简历。',build_contact(img,cta))

# Keep only the current generated portfolio CSS and JS.
for item in (ROOT/'assets').glob('portfolio.*'):
 if item.name not in [Path(CSS).name,Path(JS).name]: item.unlink()
print('Rebuilt portfolio pages with standalone contact and a shared minimal layout.')


# Stable entry points, crawl metadata and a useful destination for retired links.
not_found = '<section class="page-hero"><h1>换个入口，<br>继续探索。</h1><p class="lead">这个地址可能已更新。我的作品与经历都在这里。</p><div class="actions" style="margin-top:30px">'+cta('index.html','返回首页')+cta('projects/index.html','浏览作品',True)+'</div></section>'
render('404.html', '页面未找到', '返回马嘉程的个人网站，继续浏览作品与实践经历。', not_found)
page = ROOT/'404.html'
# Absolute site-root URLs remain valid for any missing multi-level route.
text = page.read_text()
text = re.sub(r'(href|src|poster)="(?!https?:|mailto:|tel:|#|data:|/)([^"]+)"', r'\1="/\2"', text)
page.write_text(text.replace('</head>', '<meta name="robots" content="noindex"/></head>'))
origin='https://majiacheng619-collab.github.io/'
urls=['','projects/','experience/','projects/sprout-patrol/','projects/ai-content/','poster/','honor/','updates/','contact/','game/','game/guide.html','game/codex.html','game/about.html']
(ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+origin+u+'</loc></url>' for u in urls)+'</urlset>\n')
(ROOT/'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: '+origin+'sitemap.xml\n')
# Metadata does not require JavaScript or remote fonts to be useful.
profile={'@context':'https://schema.org','@type':'Person','name':'马嘉程','url':origin,'description':'2027届本科校招；电商教学、校园打印、内容运营、线下经营与AI辅助数字产品实践。'}
page=ROOT/'index.html'
page.write_text(page.read_text().replace('</head>', '<script type="application/ld+json">'+json.dumps(profile,ensure_ascii=False)+'</script></head>'))

# Bind the companion to the same copy visitors actually read in this release.
from sprite_content import build as build_sprite_content
companion_js = js.replace('[]/*SPRITE_CONTENT*/', json.dumps(build_sprite_content(ROOT), ensure_ascii=False))
companion_asset = asset(companion_js, 'portfolio', 'js')
for page in ROOT.rglob('*.html'):
 if page.parts[len(ROOT.parts)] != 'game':
  page.write_text(page.read_text().replace(Path(JS).name, Path(companion_asset).name))
(ROOT/JS).unlink()
