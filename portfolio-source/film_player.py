"""The overview pairs the local film with a progressively enhanced player."""
from html import escape


ICONS = {
    'play': '<path fill="currentColor" stroke="none" d="M8 5.2a1 1 0 0 0-1.5.86v11.88a1 1 0 0 0 1.5.86l10.2-5.94a1 1 0 0 0 0-1.72Z"/>',
    'pause': '<path d="M9 5v14m6-14v14" stroke-width="3.3"/>',
    'replay': '<path d="M5 8a8 8 0 1 1-1 7M5 4v4h4"/>',
    'volume': '<path d="M3 9v6h4l5 4V5L7 9Zm13 0a4 4 0 0 1 0 6m2.8-8.8a8 8 0 0 1 0 11.6"/>',
    'mute': '<path d="M3 9v6h4l5 4V5L7 9Zm13 0 5 6m0-6-5 6"/>',
    'captions': '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 10.2a2 2 0 1 0 0 3.6m7-3.6a2 2 0 1 0 0 3.6"/>',
    'fullscreen': '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
    'restore': '<path d="M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5"/>',
}


def icon(name):
    return (f'<svg data-film-icon="{name}" aria-hidden="true" viewBox="0 0 24 24" fill="none" '
            f'stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</svg>')


def build_film(media, transcript):
    duration = media['duration']
    clock = f'{duration // 60}:{duration % 60:02}'
    chapters = ''.join(
        f'<button type="button" data-film-start="{chapter["start"]}" '
        f'aria-label="播放{escape(chapter["label"])}">{escape(chapter["label"])}</button>'
        for chapter in media['chapters']
    )
    return f'''
<section class="premium-film premium-shell" id="introduction" aria-labelledby="film-title">
 <div class="premium-section-head"><h2 id="film-title">{duration} 秒作品速览</h2></div>
 <div class="premium-film-player" data-intro-player data-dock-tone="dark">
  <div class="film-stage">
   <video id="intro-video" controls playsinline preload="none" width="{media['width']}" height="{media['height']}"
    poster="{media['poster']}" aria-label="马嘉程{duration}秒作品介绍，无旁白，含器乐配乐和画面文字">
    <source src="{media['video']}" type="video/mp4">
    <track src="{media['captions']}" kind="captions" srclang="zh" label="中文字幕">
    你的浏览器无法播放此视频，<a href="{media['video']}" download>下载观看</a>。
   </video>
   <button type="button" class="film-button film-play" data-film-play aria-label="播放影片" hidden>
    {icon('play')}{icon('pause')}{icon('replay')}
   </button>
   <span class="film-loading" data-film-loading role="status" hidden>正在缓冲</span>
  </div>
  <div class="film-transport" data-film-controls role="group" aria-label="播放控制" hidden>
   <input type="range" class="film-scrub" data-film-scrub min="0" max="{duration}" step="0.1" value="0"
    aria-label="播放进度" aria-valuetext="0 秒，共 {duration} 秒">
   <span class="film-clock" aria-hidden="true"><span data-film-clock>0:00</span><span class="film-clock-total"> / {clock}</span></span>
   <div class="film-tools">
    <button type="button" class="film-button" data-film-mute aria-label="静音" aria-pressed="false">{icon('volume')}{icon('mute')}</button>
    <button type="button" class="film-button" data-film-captions aria-label="中文字幕" aria-pressed="false">{icon('captions')}</button>
    <button type="button" class="film-button" data-film-fullscreen aria-label="全屏播放">{icon('fullscreen')}{icon('restore')}</button>
   </div>
  </div>
  <div class="film-chapters" data-film-chapters role="group" aria-label="影片章节" hidden>{chapters}</div>
  <div class="film-error" data-film-error hidden>
   <span role="status">影片加载失败。</span><button type="button" data-film-retry>重新加载</button>
   <a href="{media['video']}" download>下载影片</a>
  </div>
 </div>
 <details class="premium-transcript"><summary>阅读文字稿</summary><p>{transcript}</p></details>
</section>'''
