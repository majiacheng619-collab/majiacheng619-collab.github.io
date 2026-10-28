"""我以真实作品、业务证据和可直接操作的预览组织首页。"""
from device_frames import device_frame
from silk_art import silk_art


def practice():
    """I render every business with the same frame, rhythm and action position."""
    businesses = [
        ('commerce','2022.06—2024.12 · 独立操盘','电商教学与用户增长',
         '设计“先赚钱、后交学费＋经营分红”的服务模式，开发推广伙伴，负责教学、经营辅导与售后。',
         [('40 万+','项目净利润（元）'),('近 1,000','去重学员（人）'),('40–50','推广伙伴（人）')],
         'ecommerce','电商项目详情'),
        ('printing','2023.09—2024.12 · 校园创业','宿舍打印店创业',
         '针对校内打印排队久、价格高、离宿舍远的需求，在宿舍提供低价打印与送货上门，验证盈利后交接经营。',
         [('0.2 元','黑白打印'),('0.4 元','彩色打印'),('1 份','起送数量')],
         'printing','校园打印创业'),
        ('live','2026.02—2026.09 · 独立运营','直播内容与用户运营',
         '独立完成主题、封面、场景与开播筹备，通过社群和私信维护用户，持续调整内容与互动。',
         [('1 万+','抖音粉丝'),('30 万+','单场最高曝光'),('约 3 小时','日均直播')],
         'livestream','直播运营经历'),
        ('store','2025.08—2025.11 · 合伙经营','加盟门店筹备与经营',
         '参与韩式炸鸡加盟门店的选址、设备与食材采购、开业统筹，营业后承担定价、出餐和日常经营。',
         [('50%','合伙持股'),('筹备至营业','参与阶段')],
         'store','门店经营经历'),
    ]
    cards=[]
    for key,period,title,description,stats,anchor,label in businesses:
        facts=''.join(f'<div><dt>{name}</dt><dd>{value}</dd></div>' for value,name in stats)
        cards.append(f'<article class="practice-card practice-{key} practice-glass" aria-labelledby="{key}-title"><p class="practice-period">{period}</p><h3 id="{key}-title">{title}</h3><p class="practice-summary">{description}</p><dl class="practice-stats">{facts}</dl><a class="practice-link" href="experience/index.html#{anchor}">{label}</a></article>')
    return '<section class="practice-section premium-shell" id="career-lens" aria-labelledby="practice-title"><div class="practice-heading"><h2 id="practice-title">我做过的业务</h2><p class="practice-outcome"><strong>50 万+</strong><span>多项目累计净利润（元）</span></p></div><div class="practice-layout">'+''.join(cards)+'</div></section>'


def build_home(img, cta, media, transcript, film_cover):
    return f'''
<div class="premium-home studio-home">
<section class="premium-hero studio-hero era-hero" aria-labelledby="identity-title" data-era-hero>
 {silk_art()}
 <div class="era-hero-shade" aria-hidden="true"></div>
 <div class="era-masthead premium-shell"><span class="era-wordmark">{img('assets/portrait-white-960.b8bfe698eef3.webp','马嘉程个人照片',eager=True)}<span>马嘉程</span></span></div>
 <div class="premium-shell era-hero-layout">
  <div class="era-hero-content">
   <div class="premium-hero-copy"><p class="hero-intro"><span class="hero-signal" aria-hidden="true"></span> 2027 届本科</p><h1 id="identity-title">从获客到交付，<br/><span>我都亲自做过。</span></h1></div>
   <div class="hero-career"><span>电商与用户运营</span><span>内容策划</span><span>产品执行</span></div>
   <div class="actions hero-actions">{cta('#selected-work','查看作品')}</div>
  </div>

 </div>
 <div class="era-hero-foot premium-shell"><span>南昌理工学院 · 智能制造工程</span><a href="resume.pdf" download="马嘉程_个人简历.pdf">下载简历</a></div>
</section>
{practice()}
<section class="studio-preview premium-shell" id="selected-work" aria-labelledby="preview-title">
 <div class="studio-preview-heading"><div><h2 id="preview-title">精选作品</h2></div></div>
 <div class="studio-workbench" data-studio-preview>
  <div class="studio-workbench-top"><div class="studio-tabs" role="tablist" aria-label="选择作品预览" hidden><button type="button" role="tab" id="preview-tab-product" aria-controls="preview-panel-product" aria-selected="true" tabindex="0" data-studio-tab="product">萌芽保卫队</button><button type="button" role="tab" id="preview-tab-film" aria-controls="preview-panel-film" aria-selected="false" tabindex="-1" data-studio-tab="film">三支短片</button><button type="button" role="tab" id="preview-tab-field" aria-controls="preview-panel-field" aria-selected="false" tabindex="-1" data-studio-tab="field">面包挑战</button></div></div>
  <article class="studio-panel studio-panel-product" id="preview-panel-product" role="tabpanel" aria-labelledby="preview-tab-product" data-studio-panel="product">
   <div class="studio-panel-copy premium-game-heading"><p class="project-kicker">独立策划 · AI 辅助实现</p><h2>让植物成长，<br/>成为守住花园的策略。</h2><p>我把玩法拆成植物、敌人、关卡与成长规则，推进实现，再逐项验收引导、操作和存档。</p><div class="studio-product-facts"><div><strong>4</strong><span>个世界</span></div><div><strong>20</strong><span>个关卡</span></div></div><div class="actions">{cta('game/index.html','开始游戏')}{cta('projects/sprout-patrol/index.html','我的产品分工',True)}</div></div>
   <div class="premium-game-display device-preview studio-panel-media">{device_frame(img('assets/garden-current-home.webp','萌芽保卫队当前版本真实游戏截图',eager=True), 'ipad')}</div>
  </article>
  <article class="studio-panel studio-panel-film" id="preview-panel-film" role="tabpanel" aria-labelledby="preview-tab-film" data-studio-panel="film">
   <div class="studio-panel-copy"><p class="project-kicker">独立创作 · AI 素材与后期剪辑</p><h2>选择、风险、陪伴。</h2><p>三个主题，三支已发布的叙事短片。我负责选题、脚本、分镜与剪辑，保留完整原作供观看。</p><div class="actions">{cta('projects/ai-content/index.html','观看三支原作')}</div></div>
   <div class="studio-film-cover studio-panel-media">{img(film_cover,'影像栏目概念封面，非作品截图')}</div>
  </article>
  <article class="studio-panel studio-panel-field" id="preview-panel-field" role="tabpanel" aria-labelledby="preview-tab-field" data-studio-panel="field">
   <div class="studio-panel-copy"><p class="project-kicker">与朋友共同开展 · 策划与现场执行</p><h2>面包挑战</h2><p>共同设计收费、奖励和参与规则，准备 A3 宣传物料，再根据实际人流调整场地与组织方式。</p><div class="actions">{cta('poster/index.html','活动方案与实际物料')}</div></div>
   <div class="studio-poster-cover studio-panel-media event-preview"><h3>现场参与规则</h3><strong>19.9 元 / 次</strong><p>收费、挑战要求与奖励，向参与者清楚说明。</p></div>
  </article>
 </div>
</section>

<section class="premium-film premium-shell" id="introduction" aria-labelledby="film-title">
 <div class="premium-section-head"><div><h2 id="film-title">24 秒作品速览</h2></div></div>
 <div class="premium-film-player"><video id="intro-video" controls playsinline preload="none" poster="{media['poster']}" aria-label="马嘉程24秒作品介绍，无旁白，含授权器乐配乐和画面文字"><source src="{media['video']}" type="video/mp4"><track src="{media['captions']}" kind="captions" srclang="zh" label="中文字幕">你的浏览器无法播放此视频，<a href="{media['video']}" download>下载观看</a>。</video></div>
 <details class="premium-transcript"><summary>阅读文字稿</summary><p>{transcript}</p></details>
</section>
</div>'''
