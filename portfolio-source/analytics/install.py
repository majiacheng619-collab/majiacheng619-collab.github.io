"""Add anonymous analytics and the private owner interface to the static release."""
from pathlib import Path
import hashlib
import json
import os
import re

HERE = Path(__file__).resolve().parent

def install(root, render, asset):
    css = asset((HERE/'dashboard.css').read_text(), 'visitors', 'css')
    js = asset((HERE/'dashboard.js').read_text(), 'visitors', 'js')
    tracker = asset((HERE/'tracker.js').read_text(), 'visitor-tracker', 'js')
    config = json.loads((HERE.parent/'analytics-config.json').read_text())
    endpoint = config.get('endpoint', '')
    if endpoint and not re.fullmatch(r'https://[a-z0-9.-]+\.(?:workers\.dev|pages\.dev)', endpoint):
        raise ValueError('Invalid visitor endpoint')
    (root/'assets/visitor-config.json').write_text(json.dumps({'endpoint': endpoint}))
    render('visitors/index.html', '访客记录', '私密查看站点每日独立访客、累计访客与访问趋势。', (HERE/'dashboard.html').read_text())
    dashboard = root/'visitors/index.html'
    text = dashboard.read_text().replace('</head>', f'<meta name="robots" content="noindex,nofollow"/><link rel="stylesheet" href="../{css}"/><script defer src="../{js}"></script></head>')
    dashboard.write_text(text)
    privacy = '''<section class="page-hero"><p class="eyebrow">统计与隐私</p><h1>只了解访问。<br>不识别你是谁。</h1><p class="lead">匿名统计帮助我了解网站是否被看见。</p></section><section class="editorial-section wrap privacy-copy"><h2>记录哪些数据</h2><p>统计服务接通后，本网站会在当前浏览器保存随机匿名标识。服务器仅保存该标识的哈希值和到访日期，用于每日访客与累计访客去重，不保存姓名、手机号、页面浏览路径或来源网址。</p><p>统计接口通过 Cloudflare Workers 与 D1 处理数据。我的统计数据库不保存 IP 地址；网络服务提供商仍需处理连接请求并可能保留其自身的安全记录。</p><h2>如何计算人数</h2><p>按北京时间划分日期。同一浏览器当天多次打开、刷新或浏览不同页面，只记一位每日访客；同一标识在累计访客中只计一次。Cookie 有效期约 400 天，匿名标识也保存在本机网站存储中，直到被清除或被浏览器回收。</p><p>更换设备、浏览器、无痕访问或清除网站数据，会被视为新访客。因此这里的访客数是独立浏览器数，无法保证是独立自然人数。数据从服务接通后开始，不能回溯历史访问。</p><h2>你可以选择不参与</h2><p>本网站遵循浏览器的 Global Privacy Control 和 Do Not Track 退出信号。你也可以在下方关闭本浏览器的统计。关闭不会影响查看作品、观看视频或游玩游戏，也不会删除此前已经形成的匿名统计。</p><button class="button secondary" type="button" data-privacy-toggle>关闭本浏览器的统计</button><p data-privacy-status role="status" aria-live="polite"></p><h2>谁可以查看</h2><p>统计数字需要站主访问密钥才能查看。公开页面不展示单个访客记录，不提供身份识别或跨设备追踪。</p></section>'''
    render('privacy/index.html', '统计与隐私', '了解本网站匿名访客统计的记录范围、去重边界和退出方式。', privacy)
    privacy_js = """(()=>{const b=document.querySelector('[data-privacy-toggle]'),s=document.querySelector('[data-privacy-status]');if(!b)return;function draw(){const off=localStorage.getItem('mjc-visitor-opt-out')==='1';b.textContent=off?'允许本浏览器的匿名统计':'关闭本浏览器的统计';s.textContent=off?'已关闭，本浏览器的后续访问不再发送统计。':'已允许；浏览器的隐私退出信号仍会受到尊重。';}try{draw();b.addEventListener('click',()=>{try{localStorage.setItem('mjc-visitor-opt-out',localStorage.getItem('mjc-visitor-opt-out')==='1'?'0':'1');draw();}catch{s.textContent='浏览器未允许保存偏好，可启用浏览器的 Do Not Track 或 Global Privacy Control 退出信号。';}});}catch{b.disabled=true;s.textContent='浏览器已限制网站存储，本站将跳过匿名统计。';}})();"""
    privacy_asset = asset(privacy_js, 'visitor-privacy', 'js')
    privacy_page = root/'privacy/index.html'
    privacy_page.write_text(privacy_page.read_text().replace('</head>', f'<script defer src="../{privacy_asset}"></script></head>'))
    for page in root.rglob('*.html'):
        text = page.read_text()
        # Remove the previous hashed tracker from a reused release archive.
        text = re.sub(r'<script\s+defer\s+src="[^"]*visitor-tracker\.[a-f0-9]+\.js"></script>', '', text)
        relative = os.path.relpath(root/tracker, page.parent).replace(os.sep, '/')
        text = text.replace('</head>', f'<script defer src="{relative}"></script></head>')
        page.write_text(text)
    current = {Path(css).name, Path(js).name, Path(tracker).name, Path(privacy_asset).name}
    for pattern in ('visitors.*', 'visitor-tracker.*', 'visitor-privacy.*'):
        for old in (root/'assets').glob(pattern):
            if old.name not in current: old.unlink()
