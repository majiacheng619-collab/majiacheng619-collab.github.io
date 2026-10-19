from pathlib import Path
import hashlib, html, json, re
from editorial import ECOMMERCE_INSIGHTS, GAME_DECISIONS, AI_DECISIONS, FIELD_INSIGHTS, SCOPE_NOTES
ROOT=Path(__file__).resolve().parent/'site'
from identity import build as build_identity
ICON, TOUCH_ICON, MONOGRAM = build_identity(ROOT)
transcript=html.escape((ROOT/'assets/media/intro-script.txt').read_text())
media=json.loads((Path(__file__).parent/'film-manifest.json').read_text())
music=sorted((ROOT/'assets/media').glob('ambient.*.mp3'))
if len(music)!=1: raise RuntimeError('Expected exactly one current ambient track')
media['music']=music[0].relative_to(ROOT).as_posix()
nav=[('首页','index.html'),('作品','projects/index.html'),('经历','experience/index.html'),('荣誉','honor/index.html'),('近况','updates/index.html')]
detail_path=Path(__file__).parent/'detail.css'
css=(Path(__file__).parent/'site.css').read_text()+'\n'+detail_path.read_text()+'\n'+(Path(__file__).parent/'foundation.css').read_text()+'\n'+(Path(__file__).parent/'experience.css').read_text()+'\n'+(Path(__file__).parent/'detail-premium.css').read_text()+'\n'+(Path(__file__).parent/'home-premium.css').read_text()+'\n'+(Path(__file__).parent/'liquid.css').read_text()
js=(Path(__file__).parent/'interactions.js').read_text()+'\n'+(Path(__file__).parent/'liquid.js').read_text()
def asset(text,stem,ext):
 name=f'assets/{stem}.{hashlib.sha256(text.encode()).hexdigest()[:12]}.{ext}'
 (ROOT/name).write_text(text)
 return name
CSS=asset(css,'portfolio','css'); JS=asset(js,'portfolio','js')
def img(src,alt,classes='',eager=False):
 width,height=dimensions.get(src,(1280,720))
 return f'<img class="{classes}" src="{src}" alt="{alt}" width="{width}" height="{height}" decoding="async" '+('fetchpriority="high"' if eager else 'loading="lazy"')+'/>'
def cta(url,label,secondary=False): return f'<a class="button {"secondary" if secondary else "primary"}" href="{url}"'+(' download="马嘉程_个人简历.pdf"' if url.endswith('.pdf') else '')+f'>{label}</a>'
def render(path,title,desc,body):
 depth=len(Path(path).parts)-1; prefix='../'*depth
 links=''.join(f'<a href="{url}" '+('aria-current="page" ' if path==url or (url!='index.html' and path.startswith(str(Path(url).parent)+'/')) else '')+f'>{label}</a>' for label,url in nav)
 header=f'<header class="site-header"><div class="nav-inner"><a class="brand" href="index.html" aria-label="马嘉程首页"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="{MONOGRAM}"/></svg><span>马嘉程</span></a><nav class="desktop-nav" aria-label="主要导航">{links}</nav><div class="nav-tools"><a href="resume.pdf" download class="pdf-link">简历 PDF</a><button class="icon-button" data-search-open aria-label="搜索作品与经历" aria-haspopup="dialog" aria-controls="search-dialog" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg></button><button class="icon-button" data-menu-open aria-label="打开导航" aria-haspopup="dialog" aria-controls="menu-dialog" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg></button></div></div></header>'
 footer=f'<footer class="site-footer"><div class="footer-main"><div><strong>马嘉程</strong><p>2027 届本科 · 产品与运营方向</p></div><div class="footer-links">{links}<a href="poster/index.html">活动视觉</a><a href="projects/ai-content/index.html">AI 视频</a><a href="projects/sprout-patrol/index.html">游戏案例</a><a href="resume.pdf" download>下载中文简历</a></div><div class="footer-contact"><a href="mailto:19870043434@163.com">19870043434@163.com</a><br/><a href="tel:19870043434">19870043434</a></div></div><div class="footer-bottom">© 2026 马嘉程<span><a href="visitors/index.html">访客记录</a> · <a href="privacy/index.html">统计与隐私</a></span></div></footer>'
 results=nav+[('萌芽保卫队 · 网页塔防游戏','projects/sprout-patrol/index.html'),('AI 叙事短视频 · 独立创作','projects/ai-content/index.html'),('知识付费 · 用户增长与运营','experience/index.html#ecommerce'),('直播 · 内容与用户运营','experience/index.html#livestream'),('Word、Excel、Canva · 工具技能','experience/index.html#skills'),('面包挑战 · 活动视觉','poster/index.html'),('24秒作品介绍','index.html#introduction'),('项目思考 · 需求与设计判断','index.html#approach'),('成长机制 · 萌芽、成株与开花','projects/sprout-patrol/index.html#mechanism')]
 search=''.join(f'<a data-search-item href="{u}">{l}</a>' for l,u in results)
 dialogs=f'<dialog id="menu-dialog" data-menu-dialog class="menu-dialog" aria-labelledby="menu-title"><button class="dialog-close" data-dialog-close aria-label="关闭导航">×</button><h2 id="menu-title">马嘉程</h2><p class="menu-intro">从一项作品，了解我的实践。</p><nav aria-label="页面导航">{links}<a href="experience/index.html#education">教育背景</a><a href="mailto:19870043434@163.com">联系我</a><a href="resume.pdf" download>下载简历</a></nav><p>产品、内容与运营实践。</p></dialog><dialog id="search-dialog" class="search-dialog" aria-labelledby="search-title"><button class="dialog-close" data-dialog-close aria-label="关闭搜索">×</button><div class="search-heading"><h2 id="search-title">搜索网站</h2><kbd data-search-shortcut>Ctrl K</kbd></div><label for="search-input">搜索我的网站</label><input id="search-input" data-search-input type="search" placeholder="学历、项目、技能、联系方式…" autocomplete="off"/><div class="search-suggestions" aria-label="常用搜索"><button type="button" data-search-query="学历">学历</button><button type="button" data-search-query="项目">项目</button><button type="button" data-search-query="技能">技能</button><button type="button" data-search-query="联系方式">联系</button></div><p data-search-count aria-live="polite"></p><div class="search-results">{search}</div><p data-search-empty hidden>没有找到相关内容。可以换个关键词，或通过导航查看经历与作品。</p></dialog><dialog id="image-dialog" class="image-dialog" aria-label="作品与照片大图"><button class="dialog-close" data-dialog-close aria-label="关闭大图">×</button><img data-dialog-image src="assets/portrait-white-960.b8bfe698eef3.webp" alt="马嘉程证件照" width="960" height="960"/></dialog>'
 doc=f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/><title>{title if path=="index.html" else title+"｜马嘉程"}</title><meta name="description" content="{desc}"/><meta property="og:title" content="{title if path=="index.html" else title+"｜马嘉程"}"/><meta property="og:description" content="{desc}"/><meta name="theme-color" content="{ '#050d1c' if path=='index.html' else '#eaf1fb' }"/><link rel="canonical" href="https://majiacheng619-collab.github.io/{"" if path=="index.html" else path.replace("index.html","")}"/><link rel="icon" href="{ICON}" type="image/svg+xml"/><link rel="apple-touch-icon" href="{TOUCH_ICON}"/><link rel="stylesheet" href="{CSS}"/><script defer src="{JS}"></script></head><body class="{'home-page' if path=='index.html' else 'inner-page'}"><a class="skip-link" href="#main">跳转到正文</a>{header}<div class="reading-progress" data-reading-progress aria-hidden="true"></div><main id="main" tabindex="-1">{body}{footer}</main>{dialogs}<audio data-ambient loop preload="none" src="{media["music"]}"></audio><p class="sr-only" data-sound-status aria-live="polite"></p></body></html>'
 doc=doc.replace('</head>', '<meta name="color-scheme" content="light"/><meta name="format-detection" content="telephone=no"/> <meta property="og:locale" content="zh_CN"/></head>')
 if path!='index.html':
  parent='<a href="projects/index.html">作品</a><span aria-hidden="true">/</span>' if path.startswith('projects/') and path!='projects/index.html' else ''
  breadcrumb=f'<div class="page-context"><a href="index.html">马嘉程</a><span aria-hidden="true">/</span>{parent}<span aria-current="page">{title}</span></div>'
  doc=doc.replace('<main id="main" tabindex="-1">','<main id="main" tabindex="-1">'+breadcrumb)
 doc=doc.replace(f'{footer}</main>',f'</main>{footer}')
 ambient='<div class="ambient-field" aria-hidden="true"><div class="ambient-grid"></div><div class="ambient-orb orb-a"></div><div class="ambient-orb orb-b"></div><div class="ambient-droplet"></div><div class="ambient-droplet drop-two"></div></div>'
 doc=doc.replace('<a class="skip-link"',ambient+'<a class="skip-link"')
 canonical=re.search(r'<link rel="canonical" href="([^"]+)"',doc).group(1)
 doc=doc.replace('</head>',f'<meta property="og:url" content="{canonical}"/><meta property="og:image" content="https://majiacheng619-collab.github.io/assets/portrait-white-960.b8bfe698eef3.webp"/></head>')
 def relative(match):
  attr,value=match.groups()
  return f'{attr}="{value if re.match(r"^(?:https?:|mailto:|tel:|#|data:)",value) else prefix+value}"'
 doc=re.sub(r'(href|src|poster)="([^"]+)"',relative,doc)
 target=ROOT/path; target.parent.mkdir(parents=True,exist_ok=True); target.write_text(doc)
 return doc
dimensions=json.loads((Path(__file__).parent/'image-dimensions.json').read_text())
from PIL import Image
preview=Image.open(ROOT/'poster/poster.png').convert('RGB')
preview.thumbnail((1100,1600))
import io
preview_bytes=io.BytesIO(); preview.save(preview_bytes,format='WEBP',quality=86,method=6)
poster_preview='assets/poster-preview.'+hashlib.sha256(preview_bytes.getvalue()).hexdigest()[:12]+'.webp'
(ROOT/poster_preview).write_bytes(preview_bytes.getvalue())
dimensions[poster_preview]=preview.size
for old in (ROOT/'assets').glob('poster-preview.*.webp'):
 if old.name!=Path(poster_preview).name: old.unlink()


def chapters(items):
 return '<nav class="chapter-nav" aria-label="本页章节">'+''.join(f'<a href="#{anchor}">{label}</a>' for anchor,label in items)+'</nav>'
def note(text,label='关于这项实践的说明'):
 return f'<details class="editorial-note"><summary>{label}</summary><p>{text}</p></details>'
gamevisual=f'<a class="product-visual" href="game/index.html">{img("assets/game-cover.jpg","萌芽保卫队实际游戏画面：植物防线与关卡",eager=True)}<span class="screen-label">萌芽保卫队 · 打开游戏</span></a>'

from home import build_home
home=build_home(img, cta, media, transcript)
render('index.html','马嘉程','我是马嘉程，2027届本科生，求职方向为产品与运营。体验我的网页游戏，观看AI叙事视频，了解电商教学与经营实践。',home)

# Secondary pages share the same editorial scale, material treatment and reading rhythm.
def detail_hero(k,title,desc,theme='',actions=''):
 return f'<section class="detail-hero {theme}" data-reveal><div class="detail-shell"><p class="eyebrow">{k}</p><h1>{title}</h1><p class="detail-intro">{desc}</p>'+ (f'<div class="actions">{actions}</div>' if actions else '')+'</div></section>'
def detail_open(name): return f'<div class="detail-page detail-{name}">'
def detail_close(): return '</div>'
def detail_end(title,url,label,k='下一个值得了解的实践'):
 return f'<section class="detail-next" data-reveal><div class="detail-shell"><p class="eyebrow">{k}</p><h2>{title}</h2><div class="actions">{cta(url,label)}{cta("resume.pdf","下载中文简历",True)}</div></div></section>'
def detail_split(anchor,k,title,text,visual='',theme=''):
 return f'<section class="detail-split {theme}" id="{anchor}"><div class="detail-shell"><div class="detail-split-copy" data-reveal><p class="eyebrow">{k}</p><h2>{title}</h2>{text}</div><div class="detail-split-media" data-reveal>{visual}</div></div></section>'
def detail_rows(anchor,k,title,entries,theme=''):
 return f'<section class="detail-rows {theme}" id="{anchor}"><div class="detail-shell"><div class="detail-section-head" data-reveal><p class="eyebrow">{k}</p><h2>{title}</h2></div><div class="detail-row-list">'+''.join(f'<article class="detail-row" data-reveal><span class="detail-index">0{i+1}</span><h3>{t}</h3><p>{d}</p></article>' for i,(t,d) in enumerate(entries))+'</div></div></section>'
def theme_art(kind,title,sub):
 if kind=='choice':
  motif='<svg class="theme-art-svg" viewBox="0 0 800 560" aria-hidden="true"><path d="M400 550V340Q400 260 320 210L110 80M400 340Q400 260 480 210L690 80"/><circle cx="400" cy="465" r="12"/><circle cx="110" cy="80" r="12"/><circle cx="690" cy="80" r="12"/></svg>'
 elif kind=='risk':
  motif='<svg class="theme-art-svg" viewBox="0 0 800 560" aria-hidden="true"><path d="M80 120H190L280 180H380L455 280H535L650 440H720"/><path class="theme-art-thin" d="M80 440H720M80 330H720M80 220H720M80 110H720"/><circle cx="650" cy="440" r="12"/></svg>'
 else:
  motif='<svg class="theme-art-svg" viewBox="0 0 800 560" aria-hidden="true"><circle cx="330" cy="280" r="150"/><circle cx="470" cy="280" r="150"/><circle class="theme-art-thin" cx="400" cy="280" r="235"/></svg>'
 return f'<div class="theme-art theme-art-{kind}" aria-label="{title}的主题视觉，非视频截图">{motif}<div class="theme-art-type"><span>{sub}</span><strong>{title}</strong></div><span class="theme-art-credit">主题视觉 · 非原作画面</span></div>'

projects=detail_open('projects')
projects+=detail_hero('作品与实践','把想法，<br/>做成作品。','游戏可以打开，故事可以观看，经历可以核对。<br/>这是我在产品、内容与运营中的几次具体实践。',actions=cta('projects/index.html#selected-work','浏览作品'))
projects+=chapters([('selected-work','游戏'),('content-work','视频'),('service-work','教学服务'),('field-work','线下活动')])
projects+='<section class="detail-product dark" id="selected-work" data-scene><div class="detail-shell"><div class="detail-product-copy" data-reveal><p class="eyebrow">01 / 产品策划与迭代</p><h2>萌芽保卫队。<br/><span>把成长，做成策略。</span></h2><p>一款可在线游玩的网页塔防游戏。<br/>4 个世界、20 关，从第一场教学到夜战。</p><div class="actions">'+cta('projects/sprout-patrol/index.html','了解产品案例')+cta('game/index.html','直接体验',True)+'</div></div><div class="detail-screen" data-reveal>'+gamevisual.replace('class="product-visual"','class="product-visual" data-parallax="0.04"')+'</div><div class="detail-meta"><span>我负责玩法、需求、交互与迭代验收</span><span>AI 辅助实现代码</span></div></div></section>'
projects+=detail_split('content-work','02 / 独立内容创作','先有故事。<br/>再有每一个镜头。','<p>从选题、脚本到配音与后期，我独立完成并发布了三支 AI 叙事作品。选择、风险、陪伴，是这三次创作各自的起点。</p><div class="actions">'+cta('projects/ai-content/index.html','观看视频作品')+'</div>',theme_art('choice','选择','AI 叙事作品 / 主题之一'),'detail-paper')
projects+=detail_split('service-work','03 / 服务与经营实践','约千名学员。<br/>不止于报名。','<p>我发起电商教学项目，承接咨询与报名，也负责教学、经营辅导和后续答疑。服务的价值，需要在报名之后继续交付。</p><div class="actions">'+cta('experience/index.html#ecommerce','了解教学服务')+'</div>','<div class="detail-number"><strong>1,000<span>左右</span></strong><p>累计去重学员</p><div class="detail-service-line"><span>咨询</span><span>教学</span><span>辅导</span><span>答疑</span></div></div>')
projects+=detail_split('field-work','04 / 线下活动实践','让路过的人，<br/>愿意停下来。','<p>我与朋友共同开展面包挑战，把活动规则、宣传物料和现场组织放在一起考虑。这里保留实际使用的物料，也记录现场执行中的思考。</p><div class="actions">'+cta('poster/index.html','查看活动视觉')+'</div>',f'<a class="detail-poster-preview" href="poster/index.html">{img(poster_preview,"面包挑战实际使用的宣传海报")}</a>','detail-paper')
projects+=detail_end('作品之外，<br/>还有我做事的过程。','experience/index.html','查看实践经历')+detail_close()
render('projects/index.html','作品','我的网页游戏、AI叙事视频、教学服务与线下活动：体验作品，了解设计与执行中的判断。',projects)

experience=detail_open('experience')
experience+=detail_hero('实践经历 · 产品与运营方向','走进业务现场。<br/>把事情做好。','咨询、教学、直播与线下经营。<br/>不同的场景，让我开始关注需求背后的约束，以及交付之后的结果。')
experience+=chapters([('ecommerce','教学服务'),('livestream','直播运营'),('field','线下实践'),('skills','工具选择'),('education','教育经历')])
experience+=detail_split('ecommerce','2022.06—2024.12 / 电商教学与用户增长','报名之后，<br/>服务才刚刚开始。','<p>我发起项目并负责咨询、教学、经营辅导与答疑，将电商经验转化为“学费＋经营分红”的服务。</p><p>从基础操作，到选品、定价和运费，我需要把抽象的方法放回具体店铺，帮助学员理解下一步怎么做。</p>','<div class="detail-number"><strong>1,000<span>左右</span></strong><p>累计去重学员</p><div class="detail-stat-small"><strong>40–50<span>名</span></strong><p>推广合作伙伴</p></div></div>','detail-paper')
experience+=detail_rows('service-thinking','教学服务 / 我的判断','把重复的问题，<br/>整理成可重复使用的帮助。',ECOMMERCE_INSIGHTS)
experience+='<div class="detail-shell detail-note-space">'+note(SCOPE_NOTES['ecommerce']+' 我将早期学员和朋友发展为推广伙伴，通过引荐分利拓展渠道。一位学员的新店仅有 1 个 SKU、未付费投流，截至当晚获得百余笔已付款订单；该案例不等于利润或整体经营表现。','数据口径、推广合作与单店案例')+'</div>'
experience+=detail_split('livestream','2026.02—2026.09 / 内容与用户运营','一次观看，<br/>如何变成下一次交流。','<p>我独立负责直播内容、场地与软硬件调整，策划主题、封面和户外专场，并通过社群、私信和个性化关怀维护用户关系。</p><p>我的单场直播约 1 小时，最高曝光 30 万余。这让我开始关注曝光之后：观众为什么愿意交流，什么内容值得继续，以及如何维护后续联系。</p><a class="text-link" href="honor/index.html">查看区县 100 强凭证</a>',f'<a class="detail-certificate" data-image-open data-image-target="image-dialog" href="honor/live-honor-2026.jpeg">{img("honor/live-honor-2026.jpeg","抖音家乡荣耀季青山湖区区县100强实际凭证")}</a>','dark')
experience+=detail_rows('field','线下活动与门店经营','纸面上的方案，<br/>要走到真实的现场。',FIELD_INSIGHTS,'detail-paper')
experience+='<div class="detail-shell detail-note-space">'+note('面包挑战：2025.07—2025.08、2026.10 起；我与朋友共同开展，通常在 2–3 小时完成当场安排。韩式炸鸡门店：2025.08—2025.11；我与朋友合伙，承担加盟方案比选、选址签约、筹备采购与线下日常运营。'+SCOPE_NOTES['field'],'项目时间与我的实际分工')+'<a class="text-link" href="poster/index.html">查看实际活动物料</a></div>'
experience+=detail_rows('skills','任务与工具','先想清楚要完成什么。<br/>再决定用什么。',[
 ('需求与实现','我通过需求拆解、提示词和迭代反馈开展 AI 辅助开发，用可运行的游戏和页面检查实现。'),
 ('脚本与镜头','我使用 ChatGPT 梳理脚本，以 Seedream、Seedance 生成素材，在剪映中完成配音、字幕与剪辑。'),
 ('信息与数据','我使用 Word、PowerPoint 编排内容与展示思路，用 Excel 常用公式、查找匹配和数据透视表整理信息。'),
 ('规则与视觉','我使用 Canva 制作活动材料，关注信息顺序、可读性，以及参与前需要了解的规则。')])
experience+=detail_split('education','教育与校园经历','持续学习。<br/>也持续实践。','<div class="detail-education"><h3>南昌理工学院</h3><p>智能制造工程 · 本科在读<br/>2025.09—2027.07（预计）</p><h3>华东交通大学</h3><p>铁道信号自动控制 · 专科<br/>2022.09—2025.07</p></div><p>我在两校就读期间均担任学习委员。2023 年获华东交通大学“校优秀学生干部”，持有普通话二级甲等证书。</p><div class="actions">'+cta('resume.pdf','下载完整履历')+cta('mailto:19870043434@163.com','邮件联系我',True)+'</div>',f'<div class="detail-portrait">{img("assets/portrait-white-960.b8bfe698eef3.webp","马嘉程白底半身证件照")}</div>','detail-paper')
experience+=detail_close()
render('experience/index.html','实践经历','我在电商教学、直播与线下经营中的具体分工、服务判断、工具选择与教育经历。',experience)

game=detail_open('game')
game+=detail_hero('萌芽保卫队 / 网页塔防游戏','先保护成长。<br/>再选择进化。','我把等待、保护与再投入，<br/>做成一款可以打开就玩的策略游戏。','dark',cta('game/index.html','开始体验')+cta('projects/sprout-patrol/index.html#mechanism','了解核心机制',True))
game+='<section class="detail-game-visual dark" data-scene><div class="detail-shell"><div class="detail-screen" data-reveal>'+gamevisual.replace('class="product-visual"','class="product-visual" data-parallax="0.04"')+'</div><p class="detail-visual-caption">实际游戏画面 · 2026.10 公开发布 · 4 个世界，20 关</p></div></section>'
game+=chapters([('overview','我的分工'),('mechanism','成长机制'),('decisions','设计判断'),('scope','交付与复盘')])
game+=detail_split('overview','从需求到可玩版本','一个想法，<br/>需要一套完整的规则。','<p>我独立负责玩法策划、需求拆解、交互和迭代验收，通过 AI 辅助实现程序。成长是核心，引导、图鉴、暂停和存档，则让这个核心可以被理解、被继续体验。</p>','<div class="detail-game-facts"><div><strong>4</strong><span>个世界</span></div><div><strong>20</strong><span>个关卡</span></div><p>清晨 · 正午 · 黄昏 · 夜战</p></div>','detail-paper')
game+='<section class="detail-growth" id="mechanism"><div class="detail-shell"><div class="detail-section-head" data-reveal><p class="eyebrow">核心机制 / 三次选择</p><h2>同一株植物。<br/>不止一次决策。</h2><p class="detail-intro">先种谁，保护谁，又把阳光投给谁。<br/>三个阶段，让早期布置与之后的防线发生关联。</p></div><div class="growth-demo" data-reveal><div class="growth-steps">'
for i,(t,k) in enumerate([('萌芽','先种下，也先保护'),('成株','等待成长，建立防线'),('开花','再次投入，选择进化')]):
 game+=f'<button type="button" data-growth-step="{i}" aria-controls="growth-panel-{i}" aria-pressed="{str(i==0).lower()}"><span>0{i+1}</span><strong>{t}</strong><span>{k}</span></button>'
for i,(t,d) in enumerate([('眼前的空位，还是之后的能力？','植物从萌芽开始成长。种下只是第一步，玩家还要安排保护，为未来的能力争取时间。'),('存活下来，成长才有意义。','成长带来能力变化，让早期布置与后续防线有关联。等待的价值，需要和僵尸推进的压力一起考虑。'),('更多资源，投给谁？','开花需要额外阳光。玩家需要比较补充防线与强化现有植物的价值，而不只是重复种植。')]):
 if i==0: game+='</div>'
 growth_image=['assets/growth-seed-sprout.da294e149655.png', 'assets/growth-seed-adult.01b9f733e3e8.png', 'assets/growth-seed-flower.3fb952bbfb40.png'][i]
 game+=f'<div id="growth-panel-{i}" data-growth-panel="{i}"><img class="growth-real growth-real-{i}" src="{growth_image}" alt="种子投手的{["萌芽","成株","开花"][i]}阶段，直接由游戏渲染器导出" width="384" height="384" loading="lazy" decoding="async"/><div><h3>{t}</h3><p>{d}</p></div></div>'
game+='</div></div></section>'
game+=detail_rows('decisions','设计判断','每条规则，<br/>都需要回答一个问题。',GAME_DECISIONS,'detail-paper')
game+=detail_split('scope','交付与复盘','可以玩。<br/>也值得继续检查。','<p>公开版本包含 4 个世界、20 关，并提供引导、图鉴、暂停及本机存档与存档码。</p><p>我接下来关注：第一次进入是否知道下一步；阳光是否始终构成有意义的资源约束；新植物与敌人是否带来不同的组合选择。</p>'+note(SCOPE_NOTES['game'],'我的分工与体验边界'),'<div class="detail-review-list"><span>01<strong>操作引导</strong><small>下一步，是否足够清楚。</small></span><span>02<strong>资源分配</strong><small>每一份阳光，是否有取舍。</small></span><span>03<strong>组合策略</strong><small>不同搭配，是否带来变化。</small></span></div>')
game+=detail_end('带着这些问题，<br/>实际玩一局。','game/index.html','打开游戏','现在，轮到你来布置防线')+detail_close()
render('projects/sprout-patrol/index.html','萌芽保卫队','我的网页塔防游戏：体验萌芽、成株与开花的成长决策，了解玩法取舍、引导和存档背后的思考。',game)

ai=detail_open('ai')
ai+=detail_hero('AI 叙事 / 独立创作','三个故事。<br/>三种视角。','选择、风险与陪伴。<br/>我从主题出发，把脚本、镜头与声音组织成三支完整作品。','dark',cta('projects/ai-content/index.html#originals','选择一支观看'))
ai+=chapters([('originals','观看作品'),('decisions','创作判断'),('process','制作过程')])
ai+='<section class="detail-film-intro dark"><div class="detail-shell"><p>2026.09 起独立创作</p><p>我负责选题、脚本、分镜、素材生成、配音、字幕与后期剪辑。</p></div></section><div id="originals">'
for i,(kind,title,full,url,desc) in enumerate([
 ('choice','选择','升学与就业选择','https://v.douyin.com/M8uV_tAxKlk/','当人物站在不同的方向之间，我用情节组织选择，让每条路可能意味着什么逐步被看见。'),
 ('risk','风险','从赢两千到欠八十万','https://v.douyin.com/_yDmgMzvSqE/','从一次看似微小的决定，到不断累积的代价。我尝试用转折与节奏，呈现风险如何改变人物的处境。'),
 ('care','陪伴','陪家人抗癌','https://v.douyin.com/BIuX2Tb5rvM/','围绕家庭陪伴表达情感。我尝试把人物关系转为画面与声音，让故事的重心落在人与人之间。')]):
 ai+=f'<section class="detail-film detail-film-{kind}" id="film-{kind}"><div class="detail-shell"><div class="detail-film-art" data-reveal>{theme_art(kind,title,"AI 叙事 / 作品 0"+str(i+1))}</div><div class="detail-film-copy" data-reveal><p class="eyebrow">独立作品 0{i+1}</p><h2>{full}</h2><p>{desc}</p><a class="button primary" href="{url}" target="_blank" rel="noopener noreferrer">在抖音观看原作<span class="sr-only">（在新标签页打开）</span></a><p class="detail-link-note">前往抖音原作，观看完整视频。</p></div></div></section>'
ai+='</div>'
ai+=detail_rows('decisions','我的创作判断','一个镜头是否成立，<br/>要放回整个故事里看。',AI_DECISIONS)
ai+=detail_rows('process','从意图到成片','每个环节，<br/>都回到故事本身。',[
 ('主题与脚本','我以 ChatGPT 梳理内容，再将故事拆成分镜，明确每个镜头需要表达的信息。'),
 ('素材与生成','我将镜头要求转为提示词，使用 Seedream、Seedance 生成图像和视频素材。'),
 ('剪辑与交付','我在剪映中完成配音、字幕与剪辑，结合整支作品调整节奏与视觉呈现，最终发布三支叙事视频。')],'detail-paper')
ai+='<div class="detail-shell detail-note-space">'+note(SCOPE_NOTES['ai'],'作品形式与叙事情节说明')+'</div>'
ai+=detail_end('回到故事里，<br/>看看镜头如何展开。','projects/ai-content/index.html#originals','观看作品','观看原作')+detail_close()
render('projects/ai-content/index.html','AI 叙事视频','我的三支AI叙事作品，以及我对镜头任务、素材取舍与剪辑节奏的思考。',ai)

poster=detail_open('poster')
poster+=detail_hero('面包挑战 / 线下活动实践','停下来看。<br/>看懂，再参与。','我与朋友共同开展的现场活动。<br/>从一张实际使用的海报，讲讲规则、物料和现场组织。')
poster+=chapters([('visual','实际物料'),('thinking','现场思考'),('execution','个人分工')])
poster+=detail_split('visual','实际活动物料 / 点击查看原图','注意力之后，<br/>是对规则的理解。','<p>我与朋友使用 A3 宣传物料说明收费方式、挑战要求与奖励。它需要让参与者在加入之前，先了解需要付出什么、遵守什么，以及可能获得什么。</p><a class="text-link" data-image-open data-image-target="image-dialog" href="poster/poster.png">放大查看实际海报</a><p class="detail-link-note">2025.07—2025.08 / 2026.10 起<br/>我参与规则设计、宣传物料准备与现场执行。</p>',f'<a class="detail-poster-original" data-image-open data-image-target="image-dialog" href="poster/poster.png">{img(poster_preview,"面包挑战实际使用的活动宣传海报")}</a>','detail-paper')
poster+=detail_rows('thinking','现场里的思考','创意落地时，<br/>细节会成为约束。',[FIELD_INSIGHTS[0],('为现场，留出调整的余地。','我与朋友选择人流较大的场地，并依据人流情况调整为流动经营。场地、物料与组织方式，需要一起考虑；活动方案也需要留出临场调整的空间。')])
poster+=detail_split('execution','我的分工与交付','从策划，<br/>走到真实现场。','<p>我与朋友共同完成活动规则、物料准备及现场执行。活动吸引人群参与和围观，通常在 2–3 小时完成当场安排。</p><p>纸面上的规则，需要在一次次实际交流中讲清楚。宣传物料与现场执行，是同一段参与体验的前后两步。</p>'+note(SCOPE_NOTES['field'],'合作项目与个人贡献说明'),'<div class="detail-review-list"><span>01<strong>规则</strong><small>把参与前的信息讲清。</small></span><span>02<strong>物料</strong><small>让路过的人看得明白。</small></span><span>03<strong>执行</strong><small>跟随现场情况调整。</small></span></div>','detail-paper')
poster+=detail_end('更多实践，<br/>也发生在现场。','experience/index.html#field','了解线下经营经历')+detail_close()
render('poster/index.html','活动视觉与现场思考','面包挑战的实际活动物料：收费、挑战与奖励规则，以及人流和现场执行的约束。',poster)

honor=detail_open('honor')
honor+=detail_hero('荣誉与凭证','做过的事情。<br/>留下的记录。','与直播运营和校园服务对应的荣誉，<br/>和它们背后的实践一起呈现。')
honor+=detail_split('livestream-honor','2026 / 抖音家乡荣耀季','青山湖区。<br/>区县 100 强。','<p>我在独立开展直播期间，获得 2026 年抖音“家乡荣耀季”青山湖区区县 100 强。</p><p>这份凭证对应我的直播内容与用户运营实践。关于我负责的工作、单场曝光与用户维护方式，可在经历页继续了解。</p><div class="actions">'+cta('experience/index.html#livestream','阅读直播实践')+'</div><a class="text-link" data-image-open data-image-target="image-dialog" href="honor/live-honor-2026.jpeg">放大核对凭证</a>',f'<a class="detail-certificate detail-honor-certificate" data-image-open data-image-target="image-dialog" href="honor/live-honor-2026.jpeg">{img("honor/live-honor-2026.jpeg","2026抖音家乡荣耀季青山湖区区县100强实际荣誉凭证",eager=True)}</a>','dark')
honor+=detail_split('campus-honor','2023 / 华东交通大学','校优秀学生干部。','<p>我在两校就读期间均担任学习委员，承担班级沟通与学习事务服务。2023 年，我获华东交通大学“校优秀学生干部”。</p><p>这段经历让我练习倾听、整理信息，也练习把事项向同学讲清楚。</p><a class="text-link" href="experience/index.html#education">了解教育与校园经历</a>','<div class="detail-campus-mark"><span>校园服务</span><strong>2023</strong><p>华东交通大学<br/>校优秀学生干部</p><small>荣誉文字记录</small></div>','detail-paper')
honor+=detail_end('记录之外，<br/>看看我做过什么。','projects/index.html','浏览作品与项目')+detail_close()
render('honor/index.html','荣誉凭证','我的抖音家乡荣耀季青山湖区区县100强实际凭证与校园服务荣誉。',honor)

updates=detail_open('updates')
updates+=detail_hero('近况与更新','继续做。<br/>把细节做好。','我把近期交付与正在关注的问题，记录在这里。')
updates+='<section class="detail-journal"><div class="detail-shell">'
for date,k,t,d,u,l in [
 ('2026.10','作品网站','让作品有入口，<br/>让判断有上下文。','我重新梳理网站：作品页提供体验与原作入口，案例页说明取舍，简历保留履历摘要。我会继续补充可查阅的过程材料，让每项实践的来龙去脉更清楚。','projects/index.html','浏览作品'),
 ('2026.10','萌芽保卫队','关卡完成之后，<br/>继续检查策略是否成立。','我已交付 4 个世界、20 关。下一步继续关注初次操作、阳光资源约束，以及植物组合的差异。功能完成，只是体验检查的开始。','projects/sprout-patrol/index.html#scope','阅读交付与复盘'),
 ('2026.09 起','AI 叙事创作','让每个镜头，<br/>服务完整的故事。','我已完成并发布三支作品，继续关注镜头衔接、字幕阅读与声音表达。画面需要放回故事里，节奏也需要在完整观看中判断。','projects/ai-content/index.html','观看视频作品')]:
 updates+=f'<article class="detail-journal-entry" data-reveal><div class="detail-journal-date"><span>{date}</span><p>{k}</p></div><div><h2>{t}</h2><p>{d}</p><a class="text-link" href="{u}">{l}</a></div></article>'
updates+='</div></section>'+detail_end('我在寻找，<br/>下一次认真交付的机会。','mailto:19870043434@163.com','邮件联系我','2027 届本科 / 产品与运营方向')+detail_close()
render('updates/index.html','近况与更新','我的近期交付和后续关注的问题：网站内容、游戏策略和AI叙事表达。',updates)

# Keep only the current generated portfolio CSS and JS.
for item in (ROOT/'assets').glob('portfolio.*'):
 if item.name not in [Path(CSS).name,Path(JS).name]: item.unlink()
print('Rebuilt eight portfolio pages with editorial case studies and progressive interactions.')

from analytics.install import install as install_analytics
install_analytics(ROOT, render, asset)

# Stable entry points, crawl metadata and a useful destination for retired links.
not_found = '<section class="page-hero"><p class="eyebrow">404 / 页面未找到</p><h1>换个入口，<br>继续探索。</h1><p class="lead">这个地址可能已更新。我的作品与经历都在这里。</p><div class="actions" style="margin-top:30px">'+cta('index.html','返回首页')+cta('projects/index.html','浏览作品',True)+'</div></section>'
render('404.html', '页面未找到', '返回马嘉程的个人网站，继续浏览作品与实践经历。', not_found)
page = ROOT/'404.html'
# Absolute site-root URLs remain valid for any missing multi-level route.
text = page.read_text()
text = re.sub(r'(href|src|poster)="(?!https?:|mailto:|tel:|#|data:|/)([^"]+)"', r'\1="/\2"', text)
page.write_text(text.replace('</head>', '<meta name="robots" content="noindex"/></head>'))
origin='https://majiacheng619-collab.github.io/'
urls=['','projects/','experience/','projects/sprout-patrol/','projects/ai-content/','poster/','honor/','updates/','privacy/','game/','game/guide.html','game/codex.html','game/about.html']
(ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+origin+u+'</loc></url>' for u in urls)+'</urlset>\n')
(ROOT/'robots.txt').write_text('User-agent: *\nAllow: /\nDisallow: /visitors/\nSitemap: '+origin+'sitemap.xml\n')
# Metadata does not require JavaScript or remote fonts to be useful.
profile={'@context':'https://schema.org','@type':'Person','name':'马嘉程','url':origin,'description':'2027届本科，产品与运营方向；电商教学、AI叙事视频与网页游戏实践。'}
page=ROOT/'index.html'
page.write_text(page.read_text().replace('</head>', '<script type="application/ld+json">'+json.dumps(profile,ensure_ascii=False)+'</script></head>'))

# 我从最终页面生成搜索数据，避免导航标签代替正文搜索。
from search_index import install
install(ROOT)
