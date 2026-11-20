"""Dedicated pages built from the existing works, profile and evidence."""

from html import escape
from os_components import icon
from profile_data import PROFILE


def honor_wall(img, cta):
    image = img('honor/live-honor-2026.jpeg', '青山湖区区县 100 强荣誉凭证')
    return f'''
    <div class="detail-page detail-honor"><section class="detail-hero"><div class="detail-shell"><h1>荣誉</h1></div></section>
      <section class="wallet detail-shell" aria-label="荣誉通行证">
        <details class="wallet-pass wallet-blue" id="livestream-honor">
          <summary><span class="wallet-symbol">{icon('honor')}</span><span><small>2026 年抖音家乡荣耀季</small><strong>青山湖区区县 100 强</strong></span></summary>
          <div class="wallet-body"><a class="detail-certificate" data-image-open data-image-target="image-dialog"
            href="honor/live-honor-2026.jpeg">{image}</a><div class="actions">{cta('experience/index.html#livestream','相关经历',True)}</div></div>
        </details>
        <details class="wallet-pass wallet-teal" id="campus-honor">
          <summary><span class="wallet-symbol">{icon('honor')}</span><span><small>2023 年 · 华东交通大学</small><strong>校优秀学生干部</strong></span></summary>
          <div class="wallet-body">{cta('experience/index.html#education','教育经历')}</div>
        </details>
      </section></div>
    '''


def sprout_screens(img):
    items = [
        ('play', '萌芽保卫队7.0黄昏实战截图'),
        ('journey', '萌芽保卫队7.0花园旅程与关卡进度'),
        ('home', '萌芽保卫队当前版本真实游戏截图'),
    ]
    images = ''.join(f'<li>{img(f"assets/garden-current-{key}.webp", label)}</li>' for key, label in items)
    return f'''
    <section class="detail-game-visual detail-shell">
      <h2>游戏截图</h2>
      <ul class="app-captures" tabindex="0" aria-label="横向滚动查看游戏截图">{images}</ul>
    </section>
    '''


def game_version(release):
    from html.parser import HTMLParser

    class UpdateCopy(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.chinese = False
            self.parts = []

        def handle_starttag(self, tag, attrs):
            if tag == 'span' and dict(attrs).get('class') == 'zh':
                self.chinese = True

        def handle_endtag(self, tag):
            if tag == 'span':
                self.chinese = False

        def handle_data(self, data):
            if self.chinese and len(data) > 35:
                self.parts.append(data)

    log = UpdateCopy()
    log.feed((release / 'game/updates.html').read_text())
    prefixes = ('“花园旅程”展示', '阵容可以按', '新增“战术雨露”', '战后复盘呈现')
    features = [line for line in log.parts if line.startswith(prefixes)]
    if len(features) != len(prefixes):
        raise RuntimeError('The 7.0.0 game release notes could not be matched')
    parts = ''.join(f'<li>{escape(line)}</li>' for line in features)
    return (f'<section class="app-version detail-shell" aria-labelledby="app-version"><h2 id="app-version">7.0.0 更新</h2>'
            f'<ul>{parts}</ul><a class="button secondary" href="game/updates.html">查看完整更新日志</a></section>')


def story(img, artwork, media):
    cases = PROFILE['cases']
    slides = [
        ('马嘉程', PROFILE['headline'], artwork['avatar']['src'], ''),
        *( (case['title'], case['summary']['description'] if 'summary' in case else case['context'], None,
             f'experience/index.html#{case["id"]}') for case in cases ),
        ('冰之圣殿', '科考船在极光下航行，鲸鱼穿过冰川峡谷的海面。', media['poster'], 'ice/index.html'),
        ('南昌理工学院', PROFILE['education'][0][1], None, 'experience/index.html#education'),
        ('华东交通大学', PROFILE['education'][1][1], None, 'experience/index.html#education'),
        ('校优秀学生干部', '2023 年 · 华东交通大学', None, 'honor/index.html#campus-honor'),
        ('联系', '运营与增长 · 产品与项目 · 内容与市场', None, 'contact/index.html'),
    ]
    cards = []
    for index, (title, copy, asset, location) in enumerate(slides, 1):
        visual = img(asset, '', 'story-visual') if asset else ''
        link = f'<a class="os-action" href="{location}">查看详情</a>' if location else ''
        cards.append(f'<li class="story-slide" data-story-slide="{index}">{visual}<div><h2>{title}</h2><p>{copy}</p>{link}</div></li>')
    return f'''
    <section class="story-page detail-shell" data-story><h1>一分钟故事</h1>
      <div class="story-progress" aria-hidden="true" data-story-progress hidden></div>
      <ol class="story-slides" data-story-slides>{''.join(cards)}</ol>
      <div class="story-tools" hidden data-story-tools>
        <button type="button" class="os-action" data-story-prev>上一张</button>
        <button type="button" class="os-action" data-story-toggle>暂停</button>
        <button type="button" class="os-action" data-story-next>下一张</button>
        <span class="sr-only" role="status" data-story-status></span>
      </div>
    </section>
    '''
