"""我用具体项目介绍自己，把完整过程留在案例内页。"""
from device_frames import device_frame


def build_home(img, cta, media, transcript):
    return f'''
<div class="premium-home">
<section class="premium-hero" aria-labelledby="identity-title">
 <div class="premium-shell hero-layout">
  <div class="premium-hero-copy">
   <p class="hero-kicker">2027 届本科 · 南昌理工学院</p>
   <h1 id="identity-title">马嘉程</h1>
   <p class="hero-positioning">从一门生意，<br/>到一个能用的产品。</p>

  </div>
   <p class="hero-summary">做过电商教学、直播、实体经营与活动，也用 Codex 把想法落成网站和游戏。希望在运营、市场、商务及项目执行岗位继续实践。</p>
  <div class="actions hero-actions">{cta('resume.pdf','下载简历')}{cta('experience/index.html#roles','查看求职方向',True)}</div>
  <div class="hero-visual"><div class="hero-profile-image">{img('assets/portrait-white-960.b8bfe698eef3.webp','马嘉程个人照片',eager=True)}</div></div>
 </div>
</section>
<section class="capabilities premium-shell" aria-labelledby="capabilities-title">
 <div class="premium-section-head"><h2 id="capabilities-title">先看三段真实实践。</h2></div>
 <div class="capability-grid">
  <a class="capability-card" href="experience/index.html#ecommerce"><span class="capability-index">2022—2024 · 独立操盘</span><h3>把电商经验<br/>做成教学服务</h3><p>设计学费与经营辅导模式，承接咨询、报名和交付，把早期学员与朋友发展为推广伙伴。</p><span class="capability-proof">约 1,000 名学员 · 40–50 名推广伙伴</span><span class="capability-link">看业务如何运转</span></a>
  <a class="capability-card" href="experience/index.html#livestream"><span class="capability-index">2026 · 独立策划与运营</span><h3>让直播有内容，<br/>让互动能延续</h3><p>从主题、封面到场地和户外专场持续调整，通过社群与私信维护用户关系。</p><span class="capability-proof">约 1 小时单场 · 最高曝光 30 万余</span><span class="capability-link">看内容与用户维护</span></a>
  <a class="capability-card" href="experience/index.html#store"><span class="capability-index">2025 · 与朋友合伙</span><h3>从选址采购，<br/>做到门店营业</h3><p>比较加盟方案和设备渠道，推进租赁、开业准备，再进入定价、出餐与日常运营。</p><span class="capability-proof">筹备、开业、经营的完整参与</span><span class="capability-link">看线下经营过程</span></a>
 </div>
</section>
<section class="premium-selected" id="selected" aria-labelledby="selected-title">
 <article class="premium-game premium-shell" id="product">
  <div class="premium-game-heading" data-reveal>
   <p class="project-kicker">AI 辅助开发 · 已公开发布</p>
   <h2 id="selected-title">萌芽保卫队</h2>
   <p>我负责玩法、需求与验收，用 Codex 辅助实现。<br/>4 个世界、20 个关卡，从构想到可体验的产品。</p>
   <div class="actions">{cta('game/index.html','开始游戏')}{cta('projects/sprout-patrol/index.html','阅读产品案例',True)}</div>
  </div>
  <a class="premium-game-display device-preview" href="game/index.html" aria-label="体验萌芽保卫队">{device_frame(img('assets/garden-current-home.webp','萌芽保卫队当前版本真实游戏截图'), 'ipad')}</a>
 </article>
</section>
<section class="premium-content premium-shell" id="content" aria-labelledby="content-title">
 <div class="premium-section-head" data-reveal><h2 id="content-title">把三个故事，做成影像。</h2>{cta('projects/ai-content/index.html','查看创作过程',True)}</div>
 <div class="premium-story-list">
  <a class="premium-story premium-story-choice" href="projects/ai-content/index.html#film-choice"><h3>选择</h3><p>升学与就业之间的人物抉择。</p></a>
  <a class="premium-story premium-story-risk" href="projects/ai-content/index.html#film-risk"><h3>风险</h3><p>用叙事转折呈现下注的代价。</p></a>
  <a class="premium-story premium-story-care" href="projects/ai-content/index.html#film-care"><h3>陪伴</h3><p>以画面与声音表达家庭关系。</p></a>
 </div>
 <p class="premium-content-note">独立完成选题、脚本、分镜、AI 素材与剪辑。作品为虚构叙事，非个人亲历。</p>
</section>
<section class="home-field premium-shell" id="service">
 <div><p class="project-kicker">还有一段现场经历</p><h2>面包挑战：<br/>把规则带到人群中。</h2><p>与朋友共同策划收费、奖励和参与规则，准备 A3 物料，根据现场人流调整组织方式。活动通常在 2–3 小时完成当场安排。</p></div>
 <div class="actions">{cta('poster/index.html','查看活动与物料',True)}</div>
</section>
<section class="premium-film premium-shell" id="introduction" aria-labelledby="film-title">
 <div class="premium-section-head" data-reveal><h2 id="film-title">24 秒作品速览。</h2></div>
 <div class="premium-film-player"><video id="intro-video" controls playsinline preload="none" poster="{media['poster']}" aria-label="马嘉程24秒作品介绍，无旁白，含授权器乐配乐和画面文字"><source src="{media['video']}" type="video/mp4"><track src="{media['captions']}" kind="captions" srclang="zh" label="中文字幕">你的浏览器无法播放此视频，<a href="{media['video']}" download>下载观看</a>。</video></div>
 <details class="premium-transcript"><summary>文字稿</summary><p>{transcript}</p></details>
</section>
</div>'''
