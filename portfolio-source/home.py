"""求职首页：以真实作品、清晰履历和直接联系为主。"""


def build_home(img, cta, media, transcript):
    return f'''
<div class="premium-home">
<section class="premium-hero" aria-labelledby="identity-title">
 <div class="premium-shell hero-layout">
  <div class="premium-hero-copy">
   <p class="premium-kicker">2027 届 · 产品与运营</p>
   <h1 id="identity-title">马嘉程<span class="hero-outline">把想法，<br>做成作品。</span></h1>
   <p class="premium-hero-intro">南昌理工学院 · 智能制造工程</p>
   <div class="actions">{cta('#selected','查看作品')}{cta('resume.pdf','下载简历',True)}</div>
   <a class="hero-film-link" href="#introduction"><span aria-hidden="true">▷</span> 播放 24 秒作品介绍</a>
  </div>
  <div class="hero-visual">
   <div class="hero-profile-image">{img('assets/portrait-white-480.d1f641e10fd2.webp','马嘉程个人照片')}</div>
  </div>
 </div>
 <div class="hero-evidence premium-shell" aria-label="实践成果">
  <a href="experience/index.html#ecommerce"><strong>≈ 1,000<span>名</span></strong><p>累计服务学员</p></a>
  <a href="projects/sprout-patrol/index.html"><strong>20<span>关</span></strong><p>网页塔防游戏</p></a>
  <a href="projects/ai-content/index.html"><strong>3<span>支</span></strong><p>AI 叙事作品</p></a>
 </div>
</section>
<section class="premium-selected premium-shell" id="selected" aria-labelledby="selected-title">
 <div class="premium-section-head" data-reveal><h2 id="selected-title">代表作品</h2><a class="text-link" href="projects/index.html">全部作品 <span aria-hidden="true">↗</span></a></div>
 <article class="premium-game" id="product">
  <div class="premium-game-heading" data-reveal><h3>萌芽保卫队</h3><p>4 个世界，20 个关卡。<br>我负责玩法策划、交互与迭代验收。</p><div class="actions">{cta('game/index.html','立即体验')}{cta('projects/sprout-patrol/index.html','产品案例',True)}</div></div>
  <a class="premium-game-display" href="game/index.html" data-reveal>{img('assets/game-cover.jpg','萌芽保卫队实际游戏画面，点击打开完整游戏')}</a>
 </article>
</section>
<section class="premium-content premium-shell" id="content" aria-labelledby="content-title">
 <div class="premium-section-head" data-reveal><h2 id="content-title">AI 叙事作品</h2><a class="text-link" href="projects/ai-content/index.html">观看作品 <span aria-hidden="true">↗</span></a></div>
 <div class="premium-story-list">
  <a class="premium-story premium-story-choice" href="projects/ai-content/index.html#film-choice" data-reveal><span class="premium-story-title">选择</span><span class="premium-story-subtitle">升学与就业选择</span><span class="premium-story-action" aria-hidden="true">↗</span></a>
  <a class="premium-story premium-story-risk" href="projects/ai-content/index.html#film-risk" data-reveal><span class="premium-story-title">风险</span><span class="premium-story-subtitle">从赢两千到欠八十万</span><span class="premium-story-action" aria-hidden="true">↗</span></a>
  <a class="premium-story premium-story-care" href="projects/ai-content/index.html#film-care" data-reveal><span class="premium-story-title">陪伴</span><span class="premium-story-subtitle">陪家人抗癌</span><span class="premium-story-action" aria-hidden="true">↗</span></a>
 </div>
 <p class="premium-content-note">我独立完成选题、脚本、配音与剪辑。以上为 AI 叙事题材，并非个人亲历。</p>
</section>
<section class="premium-service premium-shell" id="service" aria-labelledby="service-title">
 <div class="premium-section-head" data-reveal><h2 id="service-title">实践经历</h2><a class="text-link" href="experience/index.html">完整经历 <span aria-hidden="true">↗</span></a></div>
 <div class="premium-experience-list" id="approach">
  <a href="experience/index.html#ecommerce" data-reveal><div><p class="premium-experience-date">2022.06—2024.12</p><h3>电商教学与用户运营</h3><p>发起项目，负责咨询、教学、经营辅导与答疑。</p></div><span aria-hidden="true">↗</span></a>
  <a href="poster/index.html" data-reveal><div><h3>线下活动与视觉</h3><p>面包挑战 · 活动规则与海报设计</p></div><span aria-hidden="true">↗</span></a>
  <a href="experience/index.html#livestream" data-reveal><div><h3>直播内容与互动</h3><p>内容策划、直播执行与用户互动</p></div><span aria-hidden="true">↗</span></a>
 </div>
</section>
<section class="premium-film premium-shell" id="introduction" aria-labelledby="film-title">
 <div class="premium-section-head" data-reveal><h2 id="film-title">24 秒，认识我的作品。</h2></div>
 <div class="premium-film-player" data-video-player data-reveal><video id="intro-video" controls playsinline preload="none" poster="{media['poster']}" aria-label="马嘉程24秒作品介绍，无旁白，含授权器乐配乐和画面文字"><source src="{media['video']}" type="video/mp4"><track src="{media['captions']}" kind="captions" srclang="zh" label="中文字幕">你的浏览器无法播放此视频，请下载观看。</video><div class="premium-film-control"><button class="button primary" data-video-play aria-controls="intro-video"><span data-video-label>播放介绍</span></button><a class="text-link" download href="{media['video']}">下载影片 <span aria-hidden="true">↓</span></a></div></div>
 <details class="premium-transcript"><summary>视频文字稿</summary><p>{transcript}</p></details>
</section>
<section class="premium-contact premium-shell" id="about" aria-labelledby="contact-title">
 <div class="premium-contact-copy" data-reveal><h2 id="contact-title">期待与你共事。</h2><p>正在寻找产品与运营方向的机会。</p><div class="actions">{cta('mailto:19870043434@163.com','邮件联系')}{cta('resume.pdf','下载简历',True)}</div><a class="premium-contact-email" href="mailto:19870043434@163.com">19870043434@163.com</a></div>
</section>
</div>'''
