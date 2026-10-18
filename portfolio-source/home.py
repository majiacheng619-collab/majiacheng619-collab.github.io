"""我的首页：先看见作品，再了解作品背后的判断。"""


def build_home(img, cta, media, transcript):
    return f'''
<div class="premium-home">
<section class="premium-hero" aria-labelledby="identity-title">
 <div class="premium-shell premium-hero-copy">
  <p class="premium-kicker">马嘉程 <span aria-hidden="true">/</span> 2027 届 · 产品与运营</p>
  <h1 id="identity-title">把想法，<br><span>带进真实世界。</span></h1>
  <p class="premium-hero-intro">我做过电商教学，也创作内容、打磨产品。<br class="premium-desktop-break">比起描述自己，我更愿意先让你看见我做的事。</p>
  <div class="actions">{cta('#selected','探索我的作品')}{cta('#introduction','观看24秒作品影片',True)}</div>
 </div>
 <div class="premium-hero-art premium-shell">
  <a class="premium-hero-window" href="game/index.html" aria-label="体验我的网页游戏萌芽保卫队">
   <div class="premium-window-bar" aria-hidden="true"><span class="premium-window-dots"><i></i><i></i><i></i></span><span>萌芽保卫队</span><span class="premium-window-live">网页即玩</span></div>
   {img('assets/game-cover.jpg','萌芽保卫队实际游戏画面：五条草坪上的植物防线与来袭敌人',eager=True)}
   <span class="premium-window-caption"><span>从一个规则，到一款可以玩的游戏。</span><span class="premium-round-link" aria-hidden="true">↗</span></span>
  </a>
  <div class="premium-hero-note"><span>我的作品 01 / 萌芽保卫队</span><span>策划 · 交互 · 迭代验收</span></div>
 </div>
</section>
<nav class="premium-work-nav premium-shell" aria-label="我的三类实践">
 <a href="#product"><span class="premium-nav-number">01</span><span><strong>产品</strong><small>把规则变成体验</small></span><span aria-hidden="true">↓</span></a>
 <a href="#content"><span class="premium-nav-number">02</span><span><strong>内容</strong><small>把主题变成故事</small></span><span aria-hidden="true">↓</span></a>
 <a href="#service"><span class="premium-nav-number">03</span><span><strong>运营</strong><small>把需求变成服务</small></span><span aria-hidden="true">↓</span></a>
</nav>
<section class="premium-selected premium-shell" id="selected" aria-labelledby="selected-title">
 <div class="premium-section-head" data-reveal><div><p class="premium-kicker">我的作品与实践</p><h2 id="selected-title">先看看，<br><span>我做过什么。</span></h2></div><a class="text-link" href="projects/index.html">浏览完整作品集 <span aria-hidden="true">↗</span></a></div>
 <article class="premium-game" id="product">
  <div class="premium-game-heading" data-reveal><p class="premium-kicker">01 / 产品策划与迭代</p><h3>萌芽保卫队。<br><span>成长，就是策略。</span></h3><p>先种谁，保护谁，何时进化。<br>我把资源与时间的取舍，放进每一次防线布置。</p><div class="actions">{cta('game/index.html','立即体验')}{cta('projects/sprout-patrol/index.html','阅读产品案例',True)}</div></div>
  <a class="premium-game-display" href="game/index.html" data-reveal>{img('assets/game-cover.jpg','萌芽保卫队实际游戏画面，点击打开完整游戏')}<span>实际游戏画面 <span aria-hidden="true">↗</span></span></a>
  <div class="premium-game-footer"><p>我的工作<span>玩法策划、需求拆解、交互与迭代验收</span></p><p>4 个世界<span>清晨 · 正午 · 黄昏 · 夜战</span></p><p>20 个关卡<span>从第一次种植，到夜战防线</span></p></div>
 </article>
</section>
<section class="premium-content" id="content" aria-labelledby="content-title"><div class="premium-shell">
 <div class="premium-section-head" data-reveal><div><p class="premium-kicker">02 / AI 叙事创作</p><h2 id="content-title">故事先行。<br><span>镜头，随后。</span></h2></div><p class="premium-section-intro">从选题与脚本，到配音、字幕和剪辑，<br class="premium-desktop-break">我独立完成了三支 AI 叙事视频。</p></div>
 <div class="premium-story-list">
  <a class="premium-story" href="projects/ai-content/index.html#film-choice" data-reveal><span class="premium-story-index">01</span><div class="premium-story-type"><span>选择</span><small>升学与就业选择</small></div><p>站在不同方向之间，<br>每个决定，都有它的分量。</p><span class="premium-story-action">了解作品 <span aria-hidden="true">↗</span></span></a>
  <a class="premium-story" href="projects/ai-content/index.html#film-risk" data-reveal><span class="premium-story-index">02</span><div class="premium-story-type"><span>风险</span><small>从赢两千到欠八十万</small></div><p>从一次微小的决定，<br>看见代价如何逐渐累积。</p><span class="premium-story-action">了解作品 <span aria-hidden="true">↗</span></span></a>
  <a class="premium-story" href="projects/ai-content/index.html#film-care" data-reveal><span class="premium-story-index">03</span><div class="premium-story-type"><span>陪伴</span><small>陪家人抗癌</small></div><p>让画面与声音，<br>回到人与人之间。</p><span class="premium-story-action">了解作品 <span aria-hidden="true">↗</span></span></a>
 </div><p class="premium-content-note">以上为 AI 叙事作品题材，不代表我的个人亲历。</p>
</div></section>
<section class="premium-service premium-shell" id="service" aria-labelledby="service-title">
 <div class="premium-service-copy" data-reveal><p class="premium-kicker">03 / 电商教学与用户运营</p><h2 id="service-title">报名之后，<br><span>才是服务的开始。</span></h2><p>我发起电商教学项目，负责咨询转化、教学与经营辅导。面对不同店铺，我需要把方法讲清楚，也把具体问题跟进下去。</p><a class="text-link" href="experience/index.html#ecommerce">了解这段实践 <span aria-hidden="true">↗</span></a></div>
 <div class="premium-service-evidence" data-reveal><p class="premium-evidence-label">我的服务实践</p><p class="premium-service-number">1,000<span>左右</span></p><p class="premium-evidence-description">累计去重学员</p><ol class="premium-service-steps"><li><span>01</span><strong>咨询</strong><p>先了解问题与预期</p></li><li><span>02</span><strong>教学</strong><p>让方法变得可以执行</p></li><li><span>03</span><strong>辅导</strong><p>回到具体店铺与经营</p></li><li><span>04</span><strong>答疑</strong><p>继续跟进使用中的问题</p></li></ol><a href="experience/index.html#service-thinking">阅读服务判断与数据说明</a></div>
</section>
<section class="premium-approach" id="approach" aria-labelledby="approach-title"><div class="premium-shell">
 <div class="premium-section-head" data-reveal><div><p class="premium-kicker">这些实践背后</p><h2 id="approach-title">我在意的，<br><span>是事情怎么做成。</span></h2></div><p class="premium-section-intro">场景不同，做事的起点相同。<br>理解人，厘清问题，再去交付。</p></div>
 <div class="premium-principles"><article data-reveal><span>01</span><h3>先把问题看清楚。</h3><p>从咨询中的疑问、现场的反馈和游戏里的选择，理解需求发生的具体场景。</p></article><article data-reveal><span>02</span><h3>让想法可以被体验。</h3><p>把判断整理成规则、脚本和流程，再通过实际作品检查它是否成立。</p></article><article data-reveal><span>03</span><h3>在交付之后继续打磨。</h3><p>关注使用中的问题，调整引导、信息和细节，让下一次体验更清楚。</p></article></div>
 <div class="premium-more-practice"><span>还有一些实践，发生在线下。</span><a href="poster/index.html">面包挑战与活动视觉 <span aria-hidden="true">↗</span></a><a href="honor/index.html">直播运营与荣誉凭证 <span aria-hidden="true">↗</span></a></div>
</div></section>
<section class="premium-film premium-shell" id="introduction" aria-labelledby="film-title">
 <div class="premium-section-head" data-reveal><div><p class="premium-kicker">24秒认识我</p><h2 id="film-title">把这些实践，<br><span>连成一段故事。</span></h2></div><button class="text-button" data-sound aria-pressed="false"><span data-sound-label>开启轻音乐</span></button></div>
 <div class="premium-film-player" data-video-player data-reveal><video id="intro-video" controls playsinline preload="none" poster="{media['poster']}" aria-label="马嘉程24秒作品介绍，无旁白，含授权器乐配乐和画面文字"><source src="{media['video']}" type="video/mp4"><track src="{media['captions']}" kind="captions" srclang="zh" label="中文字幕">你的浏览器无法播放此视频，请使用下面的下载入口观看。</video><div class="premium-film-control"><button class="button primary" data-video-play aria-controls="intro-video"><span data-video-label>播放介绍</span></button><span>无旁白 · 授权器乐配乐</span><a class="text-link" download href="{media['video']}">下载影片 <span aria-hidden="true">↓</span></a></div></div>
 <details class="premium-transcript"><summary>阅读视频文字稿</summary><p>{transcript}</p></details>
</section>
<section class="premium-contact" id="about" aria-labelledby="contact-title"><div class="premium-shell premium-contact-grid">
 <div class="premium-contact-identity" data-reveal><a class="premium-portrait" href="assets/portrait-white-960.b8bfe698eef3.webp" data-image-open data-image-target="image-dialog">{img('assets/portrait-white-480.d1f641e10fd2.webp','马嘉程证件照')}</a><p>南昌理工学院<br><span>智能制造工程 · 2027 届本科</span></p></div>
 <div class="premium-contact-copy" data-reveal><p class="premium-kicker">下一段实践</p><h2 id="contact-title">期待一起，<br><span>把事情做得更好。</span></h2><p>我正在寻找产品与运营方向的机会。<br>欢迎聊聊作品，也聊聊可以一起解决的问题。</p><div class="actions">{cta('mailto:19870043434@163.com','邮件联系我')}{cta('resume.pdf','下载中文简历',True)}</div><a class="premium-contact-email" href="mailto:19870043434@163.com">19870043434@163.com</a></div>
</div></section>
</div>'''
