"""A quiet portfolio homepage built around identity and actual work."""
from device_frames import device_frame


def build_home(img, cta, media, transcript):
    return f'''
<div class="premium-home">
<section class="premium-hero" aria-labelledby="identity-title">
 <div class="premium-shell hero-layout">
  <div class="premium-hero-copy">
   <h1 id="identity-title">马嘉程</h1>
   <p class="premium-hero-intro">2027 届 · 产品与运营</p>
  </div>
  <div class="actions hero-actions">{cta('resume.pdf','下载简历')}{cta('#selected','查看作品',True)}</div>
  <div class="hero-visual"><div class="hero-profile-image">{img('assets/portrait-white-960.b8bfe698eef3.webp','马嘉程个人照片',eager=True)}</div></div>
 </div>
</section>
<section class="premium-selected" id="selected" aria-labelledby="selected-title">
 <article class="premium-game premium-shell" id="product">
  <div class="premium-game-heading" data-reveal>
   <h2 id="selected-title">萌芽保卫队</h2>
   <p>种下防线，守住一座花园。</p>
   <div class="actions">{cta('game/index.html','开始游戏')}{cta('projects/sprout-patrol/index.html','查看项目',True)}</div>
  </div>
  <a class="premium-game-display device-preview" href="game/index.html" aria-label="体验萌芽保卫队">{device_frame(img('assets/garden-current-home.webp','萌芽保卫队当前版本真实游戏截图'), 'mac')}</a>
 </article>
</section>
<section class="premium-content premium-shell" id="content" aria-labelledby="content-title">
 <div class="premium-section-head" data-reveal><h2 id="content-title">三个故事。</h2>{cta('projects/ai-content/index.html','观看影像',True)}</div>
 <div class="premium-story-list">
  <a class="premium-story premium-story-choice" href="projects/ai-content/index.html#film-choice"><h3>选择</h3><p>升学，还是就业。</p></a>
  <a class="premium-story premium-story-risk" href="projects/ai-content/index.html#film-risk"><h3>风险</h3><p>一次失控的下注。</p></a>
  <a class="premium-story premium-story-care" href="projects/ai-content/index.html#film-care"><h3>陪伴</h3><p>留在家人身边。</p></a>
 </div>
 <p class="premium-content-note">AI 叙事短片，非个人亲历。</p>
</section>
<section class="premium-service" id="service" aria-labelledby="service-title">
 <div class="premium-shell">
  <div class="premium-section-head" data-reveal><h2 id="service-title">在真实场景里实践。</h2>{cta('experience/index.html','了解经历',True)}</div>
  <div class="premium-experience-list" id="approach">
   <a href="experience/index.html#ecommerce"><h3>电商教学</h3><p>从咨询，到持续辅导。</p></a>
   <a href="experience/index.html#livestream"><h3>直播运营</h3><p>从内容，到用户互动。</p></a>
   <a href="poster/index.html"><h3>线下活动</h3><p>从规则，到现场执行。</p></a>
  </div>
 </div>
</section>
<section class="premium-film premium-shell" id="introduction" aria-labelledby="film-title">
 <div class="premium-section-head" data-reveal><h2 id="film-title">24 秒，看我做过什么。</h2></div>
 <div class="premium-film-player"><video id="intro-video" controls playsinline preload="none" poster="{media['poster']}" aria-label="马嘉程24秒作品介绍，无旁白，含授权器乐配乐和画面文字"><source src="{media['video']}" type="video/mp4"><track src="{media['captions']}" kind="captions" srclang="zh" label="中文字幕">你的浏览器无法播放此视频，<a href="{media['video']}" download>下载观看</a>。</video></div>
 <details class="premium-transcript"><summary>文字稿</summary><p>{transcript}</p></details>
</section>

</div>'''
