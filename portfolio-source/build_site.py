"""Render the static portfolio from the approved profile and existing artwork."""
from html import escape
from pathlib import Path

from contact import EMAIL, PHONE
from delivery_assets import fingerprint
from profile_data import PROFILE

ORIGIN = 'https://majiacheng619-collab.github.io'
HERE = Path(__file__).resolve().parent
CASES = {case['id']: case for case in PROFILE['cases']}
BUSINESS = ('ecommerce', 'printing', 'store', 'livestream')
METRICS = (
    ('50 万+', '多项目净利润（元）'),
    ('近 1,000', '电商去重学员'),
    ('30 万+', '直播最高曝光'),
)
WORKS = (
    ('/projects/sprout-patrol/', '萌芽保卫队', '网页游戏', '把植物成长与资源分配做成可以直接上手的塔防游戏。',
     'Sprout Patrol', 'Web game', 'A playable tower-defense game built around plant growth and resource choices.', 'game', 'sprout-work'),
    ('/ice/', '冰之圣殿', '3D 短片', '从极光下的冰峡到鲸鱼跃出海面，一次用实时 3D 做成的极地航行。',
     'Cathedral of Ice', '3D short film', 'A real-time 3D voyage through an arctic fjord, from the northern lights to a breaching whale.', 'ice', 'cathedral'),
    ('/poster/', '面包挑战', '线下活动', '和朋友一起设计挑战规则、准备海报，并根据实际人流调整活动场地。',
     'Bread Challenge', 'Live event', 'I helped design the rules, prepare the poster and adjust the event location to foot traffic.', 'poster', 'field-work'),
)
ALIASES = {
    'projects/ai-content/index.html': ('/projects/', '作品'),
    'standby/index.html': ('/', '首页'),
    'story/index.html': ('/#selected-work', '作品'),
    'updates/index.html': ('/#recent-work', '面包挑战近况'),
}
NAV = (
    ('/projects/', '作品', 'Work'),
    ('/experience/', '经历', 'Career'),
    ('/honor/', '荣誉', 'Honors'),
    ('/contact/', '联系', 'Contact'),
)


def link(href, label, style='link', download=False):
    return f'<a class="{style}" href="{escape(href, quote=True)}"{" download" if download else ""}>{escape(label)}</a>'


def list_cards(rows):
    return '<dl class="rows">' + ''.join(
        f'<div><dt>{escape(label)}</dt><dd>{value}</dd></div>' for label, value in rows) + '</dl>'


def number_list(rows, style='metrics'):
    return f'<dl class="{style}">' + ''.join(
        f'<div><dt>{escape(label)}</dt><dd>{escape(value)}</dd></div>' for value, label in rows) + '</dl>'


def intro(title, label='', text='', extra=''):
    tag = f'<p class="meta">{escape(label)}</p>' if label else ''
    copy = f'<p class="intro-copy">{escape(text)}</p>' if text else ''
    return f'<div class="page-intro">{tag}<h1>{escape(title)}</h1>{copy}{extra}</div>'


class Portfolio:
    def __init__(self, root, assets, release):
        self.root = root
        self.assets = assets
        self.release = release
        self.resume = '/' + release['resume']['file']
        css = fingerprint(root, 'assets', 'portfolio', 'css', (HERE / 'portfolio.css').read_bytes())
        scripts = ('portfolio-interactions.js', 'pwa-client.js')
        js = fingerprint(root, 'assets', 'portfolio', 'js', b'\n'.join((HERE / name).read_bytes() for name in scripts))
        self.css, self.js = '/' + css, '/' + js
        self.html = []
        self.locale = (HERE / 'appearance-init.js').read_text().strip()

    def write(self, output, content):
        page = self.root / output
        page.parent.mkdir(parents=True, exist_ok=True)
        page.write_text(content, encoding='utf-8')
        self.html.append('/' + output)

    def image(self, key, alt, *, eager=False, style='', decorative=False):
        image = self.assets[key]
        sources = image.get('srcset')
        responsive = f' srcset="{sources}" sizes="{image["sizes"]}"' if sources else ''
        policy = 'fetchpriority="high"' if eager else ('loading="lazy" decoding="async"' if not decorative else 'loading="lazy" decoding="async" fetchpriority="low"')
        return (f'<img class="{style}" src="{image["src"]}"{responsive} width="{image["width"]}" '
                f'height="{image["height"]}" alt="{escape(alt, quote=True)}" {policy}>')

    def settings(self, english, plain):
        theme, size, language = ('Appearance', 'Text size', 'Language') if english else ('外观', '字号', '语言')
        automatic, light, dark = ('System', 'Light', 'Dark') if english else ('跟随系统', '浅色', '深色')
        normal, large = ('Default', 'Large') if english else ('标准', '加大')
        lang_link = link('/', '简体中文') if english else '<a class="link" href="/en/" lang="en" hreflang="en">English</a>'
        plain_link = link('/', '图文版') if plain else link('/plain/', 'Text only' if english else '纯文字版')
        return f'''<details class="settings">
          <summary>{'Settings' if english else '设置'}</summary>
          <div class="settings-panel">
            <label hidden data-setting>{theme}<select data-theme-choice><option value="auto">{automatic}</option><option value="light">{light}</option><option value="dark">{dark}</option></select></label>
            <label hidden data-setting>{size}<select data-size-choice><option value="normal">{normal}</option><option value="large">{large}</option></select></label>
            <div class="settings-language"><span>{language}</span>{lang_link}{plain_link}</div>
          </div>
        </details>'''

    def page(self, output, title, description, body, *, active='', english=False, plain=False, home=False):
        name = PROFILE['en']['name'] if english else PROFILE['name']
        lang = 'en' if english else 'zh-CN'
        page_title = name if home else f'{title} · {name}'
        skip = 'Skip to content' if english else '跳到正文'
        nav_name = 'Main navigation' if english else '主导航'
        nav = ''.join(
            f'<a href="{path}"{" aria-current=\x22page\x22" if path == active else ""}>{en if english else zh}</a>'
            for path, zh, en in NAV)
        navigation = f'<nav aria-label="{nav_name}">{nav}</nav>'
        icon = self.assets['icon']['src']
        touch = self.assets['touch']['src']
        preload = ''
        if home and not english:
            image = self.assets['portrait']
            preload = (f'<link rel="preload" as="image" href="{image["src"]}" '
                       f'imagesrcset="{image["srcset"]}" imagesizes="{image["sizes"]}">')
        footer = f'<footer class="site-footer"><div class="wrap"><span>© 2026 {name}</span><button class="link" type="button" data-pwa-update hidden>{"Reload to update" if english else "有新版本，刷新页面"}</button></div></footer>'
        document = f'''<!doctype html>
<html lang="{lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,follow"><meta name="portfolio-revision" content="{self.release["siteRevision"]}">
<title>{escape(page_title)}</title><meta name="description" content="{escape(description, quote=True)}">
<meta property="og:title" content="{escape(page_title, quote=True)}"><meta property="og:description" content="{escape(description, quote=True)}">
<meta name="color-scheme" content="light dark"><link rel="icon" href="{icon}" type="image/svg+xml">
<link rel="apple-touch-icon" href="{touch}"><link rel="manifest" href="/manifest.webmanifest">
<script>{self.locale}</script>{preload}<link rel="stylesheet" href="{self.css}"><script defer src="{self.js}"></script>
</head>
<body{" class=\x22text-edition\x22" if plain else ""}>
<a class="skip" href="#main">{skip}</a>
<header class="site-header"><div class="wrap header-inner"><a class="brand" href="{"/en/" if english else "/"}"{" aria-current=\x22page\x22" if home else ""}>{name}</a>{navigation}{self.settings(english, plain)}</div></header>
<main id="main" tabindex="-1">{body}</main>
{footer}
</body></html>
'''
        self.write(output, document)

    def alias(self, output, target, title):
        # GitHub Pages serves static aliases with HTTP 200. Keep a native link for
        # readers who disable refresh; its page uses the same navigation as any other.
        description = f'此网址已移至{title}。'
        route = (self.root / output)
        self.page(output, {'standby/index.html': '展台已合并', 'story/index.html': '故事已合并', 'updates/index.html': '近况已合并', 'projects/ai-content/index.html': '旧作品入口'}[output], description, f'<section class="wrap">{intro(f"前往{title}", text=description, extra=link(target, title, "button"))}</section>')
        html = route.read_text()
        route.write_text(html.replace('</head>', f'<meta http-equiv="refresh" content="0; url={escape(target, quote=True)}"></head>'))

    def download(self, english=False, secondary=False):
        return link(self.resume, 'Download résumé' if english else '下载简历', 'button soft' if secondary else 'button', download=True)

    def work_list(self, english=False, direct=False):
        heading_tag = 'h2' if direct else 'h3'
        parts = []
        alt = {
            'game': ('《萌芽保卫队》黄昏关卡实战截图', 'A dusk level in Sprout Patrol'),
            'ice': ('绿极光下，科考船驶入蓝色峡湾', 'A research vessel sails under the northern lights'),
            'poster': ('面包挑战现场使用的红色宣传海报', 'The red poster used at the Bread Challenge'),
        }
        for route, title, category, desc, en_title, en_category, en_desc, key, section in WORKS:
            picture = self.image(key, alt[key][english], style='work-image')
            label, heading, copy = (en_category, en_title, en_desc) if english else (category, title, desc)
            note = '<p class="meta recent" id="recent-work">2026 年 10 月起，与朋友继续开展线下活动。</p>' if key == 'poster' and not english else ''
            parts.append(f'''<article class="work" id="{section}">
<div class="work-visual {key}">{picture}</div>
<div class="work-caption"><p class="meta">{label}</p><{heading_tag}>{link(route,heading,"work-title")}</{heading_tag}><p>{copy}</p>{note}</div></article>''')
        return '<div class="work-list">' + ''.join(parts) + '</div>'

    def home(self):
        portrait = self.image('portrait', '马嘉程的个人照片', eager=True, style='portrait')
        ribbon = self.image('ribbon', '', style='ribbon', decorative=True)
        hero = f'''<section class="hero"><div class="wrap hero-inner">
<div class="hero-copy"><p class="meta">{PROFILE["cohort"]}</p><h1>{PROFILE["name"]}</h1>
<p class="tagline">{PROFILE["headline"]}</p></div>
<div class="portrait-frame">{ribbon}{portrait}</div>
{number_list(METRICS)}
<div class="actions hero-actions">{link("#selected-work", "查看作品", "button")}{self.download(secondary=True)}</div>
</div></section>'''
        values = (('40 万+', '项目净利润（元）'), ('0.2 元', '每张黑白打印'), ('50%', '合伙持股'), ('1 万+', '抖音粉丝'))
        notes = (
            '我招募推广伙伴，并把店铺经验整理成课程、操作手册和售后答疑。',
            '我在宿舍提供低价打印和上门配送，跑通盈利后将业务交给同学。',
            '我和朋友推进一家韩式炸鸡店从选址、采购到开业，并参与定价和出餐。',
            '我独立准备主题、封面和开播场地，并用社群与私信维系观众。',
        )
        business = ''
        for key, (value, label), note in zip(BUSINESS, values, notes):
            case = CASES[key]
            business += f'''<article class="chapter" id="{key}">
<div><p class="meta">{escape(case['time'])}</p><h3>{escape(case['summary']['title'])}</h3><p>{note}</p>
{link('/experience/#' + key, '查看详情', 'link') }</div>
{number_list(((value, label),), 'chapter-number')}</article>'''
        preview = self.image('resume', '马嘉程简历第一页预览', style='resume-image')
        self.page('index.html', PROFILE['name'], PROFILE['headline'], f'''{hero}
<section class="wrap sequence" id="experience"><h2>业务经历</h2><div class="chapters">{business}</div></section>
<section class="wrap sequence" id="selected-work"><h2>作品</h2>{self.work_list()}</section>
<section class="wrap sequence resume-section" id="resume"><div><h2>简历与联系</h2>
<p>{PROFILE['school']}</p>{link('/contact/', '联系我', 'button soft')}</div>
<details class="resume-preview"><summary>预览简历</summary>{preview}</details></section>''', home=True)

    def cases(self, *, english=False, text=False):
        cases = []
        for case in CASES.values():
            copy = case['en'] if english else case
            key = case['id']
            title = copy['title']
            dates = copy.get('time', case['time'])
            heading = f'<p class="meta">{escape(dates)} · {escape(copy["role"])}</p><h{"3" if english or text else "2"}>{escape(title)}</h{"3" if english or text else "2"}>'
            actions = list_cards((label, escape(value)) for label, value in copy['actions'])
            facts = number_list(copy['facts'], 'case-numbers')
            cases.append(f'''<article class="case" id="{key}">{heading}
<p>{escape(copy['context'])}</p>{facts}<div id="case-{key}">{actions}</div><p>{escape(copy['result'])}</p></article>''')
        return ''.join(cases)

    def education(self, english=False):
        profile = PROFILE['en'] if english else PROFILE
        return f'''<section class="sequence" id="{'en-education' if english else 'education'}">
<h2>{'Education' if english else '教育经历'}</h2>{list_cards(profile['education'])}</section>
<section class="sequence" id="{'en-skills' if english else 'skills'}">
<h2>{'Skills' if english else '技能'}</h2>{list_cards((label, escape(value)) for label, value in profile['skills'])}</section>'''

    def rest(self):
        self.page('projects/index.html', '作品', '网页游戏、3D 短片和线下活动。', f'<section class="wrap" id="selected-work">{intro("作品")}{self.work_list(direct=True)}</section>', active='/projects/')
        self.page('experience/index.html', '经历', '业务、教育及技能经历。', f'''<div class="wrap reading">{intro('经历')}
<p id="roles">{escape(PROFILE['roles'])}</p><div class="cases">{self.cases()}</div>{self.education()}</div>''', active='/experience/')
        self.page('contact/index.html', '联系', '马嘉程公开的联系邮箱和手机。', f'''<section class="wrap reading">{intro('联系')}
<dl class="rows" id="contact-card-back"><div id="contact-email"><dt>邮箱</dt><dd>{link('mailto:' + EMAIL, EMAIL)}</dd></div>
<div id="contact-phone"><dt>手机</dt><dd>{link('tel:' + PHONE, '198 7004 3434')}</dd></div></dl>
<div class="actions">{self.download()}</div></section>''', active='/contact/')
        certificate = self.image('certificate', '抖音家乡荣耀季青山湖区区县 100 强荣誉凭证', style='evidence-image')
        self.page('honor/index.html', '荣誉', '直播与校园服务所获荣誉。', f'''<div class="wrap reading">{intro('荣誉')}
<section class="case" id="livestream-honor"><p class="meta">2026 年 · 抖音家乡荣耀季</p><h2>青山湖区区县 100 强</h2>
<details class="evidence"><summary>查看荣誉凭证</summary>{certificate}</details></section>
<section class="case" id="campus-honor"><p class="meta">2023 年 · 华东交通大学</p><h2>校优秀学生干部</h2></section></div>''', active='/honor/')

        self.page('projects/sprout-patrol/index.html', '萌芽保卫队', WORKS[0][3], f'''<div class="wrap">
{intro('萌芽保卫队', '网页游戏', '我独立策划玩法与关卡，用 AI 辅助实现，并验收从新手引导到存档恢复的完整流程。',
         f'<div class="actions">{link("/game/", "开始游戏", "button")}</div>')}
<div id="overview" class="work-visual game">{self.image('game', '《萌芽保卫队》黄昏关卡实战截图', eager=True, style='work-image')}</div>
<section class="sequence reading" id="product-process"><h2>从想法到可玩</h2>
{list_cards((label, escape(value)) for label, value in CASES['digital-work']['actions'])}
<div id="journey">{number_list(CASES['digital-work']['facts'], 'case-numbers')}</div>
<p id="mechanism">植物经历萌芽、成株、开花三个阶段，玩家需要在等待成长和布置防御之间做取舍。</p>
<div id="decisions" class="actions">{link('/game/guide.html', '游戏指南', 'button soft')}<span id="app-version">{link('/game/updates.html', '游戏更新记录', 'button soft')}</span></div>
</section></div>''', active='/projects/')

        poster = self.image('poster', '面包挑战现场海报，说明定价、时限和奖励', eager=True, style='work-image')
        field = CASES['field']
        self.page('poster/index.html', '面包挑战', WORKS[2][3], f'''<div class="wrap">
{intro('面包挑战', field['time'], field['context'])}
<div id="visual" class="work-visual poster">{poster}</div>
<div class="actions">{link('/poster/poster.png', '查看海报原件', 'button soft')}</div>
<section class="sequence reading" id="thinking"><h2>从规则到现场</h2>
{list_cards((label, escape(value)) for label, value in field['actions'])}
<p>{escape(field['result'])}</p></section></div>''', active='/projects/')

        film = self.release['film']
        transcript = (self.root / 'assets/media/intro-script.txt').read_text()
        paragraphs = ''.join(f'<p>{escape(line)}</p>' for line in transcript.splitlines() if line.strip())
        self.page('ice/index.html', '冰之圣殿', WORKS[1][3], f'''<div class="wrap">
{intro('冰之圣殿', 'Cathedral of Ice', WORKS[1][3])}
<figure id="introduction" class="film"><video controls preload="none" playsinline width="{film['width']}" height="{film['height']}" aria-label="冰之圣殿短片" poster="{self.assets['ice']['src']}">
<source src="/{film['compact']}" type="video/mp4"><track kind="captions" label="简体中文" srclang="zh-CN" src="/{film['captions']}">
</video><figcaption>25 秒短片 · Three.js / GLSL</figcaption></figure>
<details class="reading evidence"><summary>阅读文字稿</summary>{paragraphs}</details></div>''', active='/projects/')

        english = PROFILE['en']
        self.page('en/index.html', english['name'], english['headline'], f'''<div class="wrap reading">
{intro(english['name'], english['cohort'], english['headline'], f'<div class="actions">{self.download(english=True)}</div>')}
<section class="sequence" id="selected-work"><h2>Selected work</h2>{self.work_list(english=True)}</section>
<section class="sequence"><h2>Experience</h2><p id="en-roles">{escape(english['roles'])}</p>{self.cases(english=True)}</section>
{self.education(english=True)}</div>''', english=True, home=True)
        self.page('plain/index.html', '纯文字版', '马嘉程个人站纯文字版。', f'''<div class="wrap reading">
{intro('纯文字版', PROFILE['name'], PROFILE['headline'], f'<div class="actions">{self.download()}</div>')}
<section class="sequence" id="selected-work"><h2>作品</h2>{list_cards((title, link(url, description)) for url, title, _, description, *_ in WORKS)}</section>
<section class="sequence"><h2>经历</h2>{self.cases(text=True)}</section>{self.education()}</div>''', plain=True)
        self.page('404.html', '找不到页面', '这个地址可能已更新。', f'''<section class="wrap reading">{intro('找不到页面', '404', '这个地址可能已更新。')}
<div class="actions">{link('/', '返回首页', 'button')}{link('/projects/', '查看作品', 'button soft')}</div></section>''')
        self.page('offline.html', '当前离线', '网络恢复前，可以阅读已保存的纯文字版。', f'''<section class="wrap reading">{intro('当前离线', text='可以继续阅读已保存的纯文字版。')}
<div class="actions">{link('/plain/', '阅读纯文字版', 'button')}{link('/', '返回首页', 'button soft')}</div></section>''')
        for route, (target, title) in ALIASES.items():
            self.alias(route, target, title)
