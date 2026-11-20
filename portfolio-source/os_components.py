"""Shared chrome and local app surfaces for the portfolio."""

from html import escape
from profile_data import PROFILE


PATHS = {
    'settings': '<path d="M4 7h16M4 17h16M9 4v6m6 4v6"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
    'search': '<circle cx="10.8" cy="10.8" r="5.7"/><path d="m15 15 4.8 4.8"/>',
    'work': '<rect x="4" y="7" width="16" height="13" rx="3"/><path d="M9 7V5h6v2m-11 5h16"/>',
    'experience': '<path d="M5 18h14M7 14l4-4 3 1 4-5"/><circle cx="7" cy="14" r="1"/><circle cx="18" cy="6" r="1"/>',
    'honor': '<path d="M8 3h8l2 6-6 6-6-6zm1 10-3 7 6-2 6 2-3-7"/>',
    'contact': '<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="m5 7 7 5 7-5"/>',
    'ice': '<path d="m3 17 7-12 4 7 3-4 4 9H3zm5-8 2 1 2-1"/>',
    'seed': '<path d="M12 21V11m0 3C5 14 3 11 3 6c5 0 9 2 9 8Zm0-1c0-6 4-9 9-9 0 6-4 9-9 9Z"/>',
    'file': '<path d="M7 3h7l4 4v13H7zM14 3v5h4m-8 4h5m-5 4h5"/>',
    'bell': '<path d="M6 16h12l-2-3V9a4 4 0 0 0-8 0v4zm4 3a2 2 0 0 0 4 0"/>',
}


def icon(name):
    return (f'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" '
            f'stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">{PATHS[name]}</svg>')


def close_button(label='关闭'):
    return (f'<button class="os-icon-button os-sheet-close" type="button" data-dialog-close aria-label="{label}">'
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" '
            'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>')


def sheet(id_, title, body, class_=''):
    return (f'<dialog class="os-sheet {class_}" id="{id_}" aria-labelledby="{id_}-title" data-sheet>'
            '<button type="button" class="os-grabber" data-sheet-handle aria-label="切换半屏与全屏" aria-pressed="false">'
            '<span aria-hidden="true"></span></button>'
            f'<div class="os-sheet-heading"><h2 id="{id_}-title">{title}</h2>{close_button()}</div>'
            f'<div class="os-sheet-content">{body}</div></dialog>')


def chrome(title, is_home=False):
    splash = ('<div class="os-lockscreen" data-lockscreen hidden><div class="os-lock-time" aria-hidden="true"></div>'
              '<button type="button" data-lock-skip>跳过</button></div>') if is_home else ''
    return (
        '<div class="os-rail" data-os-rail>'
        f'<span class="os-rail-title" aria-hidden="true">{escape(title)}</span>'
        '<div class="os-island" data-os-island hidden><span role="status" data-os-notice></span>'
        '<progress value="0" max="1" aria-label="播放进度" hidden></progress></div>'
        '<div class="os-rail-actions">'
        f'<button type="button" class="os-icon-button" aria-label="Spotlight 搜索" aria-keyshortcuts="Meta+K Control+K" data-open-companion hidden>{icon("search")}</button>'
        f'<button type="button" class="os-icon-button" aria-label="控制中心" data-dialog-open="control-center" data-os-enhancement hidden>{icon("settings")}</button>'
        '</div></div>' + splash
    )


def shared_dialogs(media, is_home, resume):
    control_content = f'''
        <div class="os-options">
          <label><span data-lang-en="Appearance">外观</span><select data-appearance><option value="auto">自动</option><option value="light">浅色</option><option value="dark">深色</option></select></label>
          <label><span data-lang-en="Accent">强调色</span><select data-os-setting="accent"><option value="ice">冰蓝</option><option value="mint">海绿</option><option value="violet">淡紫</option></select></label>
          <label><span data-lang-en="Text size">字号</span><select data-os-setting="text"><option value="normal">标准</option><option value="large">较大</option><option value="wide">最大</option></select></label>
          <label><span data-lang-en="Language">语言</span><select data-os-setting="language"><option value="zh">中文</option><option value="en">EN</option></select></label>
          <label class="os-switch"><span data-lang-en="Reduce motion">减弱动效</span><input type="checkbox" data-os-setting="reduce"></label>
          <label class="os-switch"><span data-lang-en="Haptics">触感</span><input type="checkbox" data-os-setting="haptics"></label>
        </div>
        <button type="button" class="os-action" data-os-music="{media.get("siteMusic", "")}" aria-pressed="false">播放音乐</button>
    '''
    controls = sheet('control-center', '控制中心', control_content)
    actions = sheet('dock-actions', '快捷操作', '<div class="os-shortcuts" data-dock-shortcuts></div>')
    if not is_home or 'quickLook' not in media:
        return controls + actions
    preview = media['quickLook']
    quick_look = (f'<img class="quicklook-preview" loading="lazy" src="{preview["src"]}" width="{preview["width"]}" '
                  f'height="{preview["height"]}" alt="简历的教育与经历预览"/>'
                  f'<a class="os-action" href="{resume}" download="马嘉程_个人简历.pdf">下载简历</a>')
    return controls + actions + sheet('resume-sheet', '简历预览', quick_look, 'os-resume-sheet')


def lenses():
    parts = ['<button type="button" data-lens="all" aria-pressed="true" data-glass-press>全部</button>']
    for lens in PROFILE['lenses']:
        parts.append(f'<button type="button" data-lens="{lens["id"]}" data-lens-order="{" ".join(lens["first"])}" aria-pressed="false" data-glass-press>{lens["label"]}</button>')
    return ('<div class="os-lenses" data-lenses role="group" aria-label="经历视角" hidden>'
            + ''.join(parts) + '</div>')


def shared_card(link, icon_name, title, style, extra=''):
    return (
        f'<a class="os-app" href="{link}" data-shared-card="{style}" data-glass-press {extra}>'
        f'<span class="os-app-icon os-tint-{style}">{icon(icon_name)}</span><span>{title}</span></a>'
    )


def launchpad(img, media):
    metrics = PROFILE['widgets']
    stats = ''.join(f'<div><dt>{item["label"]}</dt><dd data-roll>{item["value"]}</dd></div>' for item in metrics)
    cards = ''.join((
        shared_card('projects/index.html', 'work', '作品', 'work'),
        shared_card('experience/index.html', 'experience', '经历', 'experience'),
        shared_card('honor/index.html', 'honor', '荣誉', 'honor'),
        shared_card('contact/index.html', 'contact', '联系', 'contact'),
        shared_card('projects/sprout-patrol/index.html', 'seed', '萌芽保卫队', 'sprout'),
        shared_card('ice/index.html', 'ice', '冰之圣殿', 'ice'),
    ))
    return f'''
    <section class="os-launchpad premium-shell" aria-label="主屏">
      <div class="os-launch-grid"><div class="os-app-grid" role="group" aria-label="应用">{cards}</div>
        <dl class="os-stats">{stats}</dl>
      </div>
      <div class="os-widget-grid">
        <a class="os-widget os-widget-ice" href="ice/index.html" data-shared-card="ice" data-glass-press>
          {img(media['poster'], '', 'os-widget-image')}<strong>冰之圣殿</strong>
        </a>
        <a class="os-widget" href="resume.pdf" data-resume-entry data-dialog-open="resume-sheet"
          download="马嘉程_个人简历.pdf" data-glass-press>{icon('file')}<strong>简历预览</strong></a>
        <details class="os-widget os-notifications">
          <summary>{icon('bell')}<strong>近况</strong></summary>
          <div class="os-notification"><div>面包挑战</div><p>2026 年 10 月起与朋友继续开展线下活动。</p>
          <a href="updates/index.html">查看近况</a></div>
        </details>
        <a class="os-widget" data-continue-game hidden href="game/index.html" data-glass-press>
          {icon('seed')}<strong>继续游戏</strong></a>
      </div>
    </section>
    '''
