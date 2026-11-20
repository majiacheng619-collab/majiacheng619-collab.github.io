"""我以真实作品、业务证据和可直接操作的预览组织首页。"""
from device_frames import device_frame
from film_player import build_film
from silk_art import silk_art
from os_components import launchpad, lenses
from profile_data import PROFILE


def practice():
    """I render every business with the same frame, rhythm and action position."""
    businesses = [(case['id'], case['summary']) for case in PROFILE['cases'] if 'summary' in case]
    cards=[]
    for anchor, summary in businesses:
        key, period, title, description, stats, label = (
            summary[field] for field in ('key', 'period', 'title', 'description', 'stats', 'label'))
        stats = [(value, name) for value, name in stats if name != '去重学员（人）']
        facts=''.join(f'<div><dt>{name}</dt><dd>{value}</dd></div>' for value,name in stats)
        cards.append(f'<article class="practice-card practice-{key} practice-glass" aria-labelledby="{key}-title" data-case-id="{anchor}"><p class="practice-period">{period}</p><h3 id="{key}-title">{title}</h3><p class="practice-summary">{description}</p><dl class="practice-stats">{facts}</dl><a class="practice-link" href="experience/index.html#{anchor}">{label}</a></article>')
    return '<section class="practice-section premium-shell" id="career-lens" aria-labelledby="practice-title"><div class="practice-heading"><h2 id="practice-title">我做过的业务</h2></div>'+lenses()+'<div class="practice-layout" data-lens-list>'+''.join(cards)+'</div></section>'


def build_home(img, cta, media, transcript, artwork):
    return f'''
<div class="premium-home studio-home">
<section class="premium-hero studio-hero era-hero os-hero" aria-labelledby="identity-title" data-era-hero data-dock-tone="dark">
 {silk_art(artwork['ribbon'])}
 <div class="era-hero-shade" aria-hidden="true"></div>
 <div class="era-masthead premium-shell"><span class="era-wordmark os-pull-region" data-pull-search>{img(artwork['avatar']['src'],'马嘉程个人照片',eager=True)}<span>马嘉程 OS</span></span></div>
 <div class="premium-shell era-hero-layout">
  <div class="era-hero-content">
   <div class="premium-hero-copy"><p class="hero-intro">{PROFILE["cohort"]}</p><h1 id="identity-title">马嘉程 <span>OS</span></h1><p class="os-hero-intro">{PROFILE["headline"]}</p></div>
   <div class="hero-career"><span>电商与用户运营</span><span>内容策划</span><span>产品执行</span></div>
   <div class="actions hero-actions">{cta('#selected-work','查看作品')}{cta('resume.pdf','下载简历',True)}</div>
  </div>

 </div>
 <div class="era-hero-foot premium-shell">南昌理工学院 · 智能制造工程</div>
</section>
{launchpad(img, media)}
{practice()}
<section class="studio-preview premium-shell" id="selected-work" aria-labelledby="preview-title">
 <div class="studio-preview-heading"><h2 id="preview-title">精选作品</h2></div>
 <div class="studio-workbench" data-studio-preview>
  <div class="studio-workbench-top"><div class="studio-tabs" role="tablist" aria-label="选择作品预览" hidden><button type="button" role="tab" id="preview-tab-product" aria-controls="preview-panel-product" aria-selected="true" tabindex="0" data-studio-tab="product">萌芽保卫队</button><button type="button" role="tab" id="preview-tab-field" aria-controls="preview-panel-field" aria-selected="false" tabindex="-1" data-studio-tab="field">面包挑战</button></div></div>
  <div class="studio-panel studio-panel-product" id="preview-panel-product" role="tabpanel" aria-labelledby="preview-tab-product" data-studio-panel="product">
   <div class="studio-panel-copy premium-game-heading"><p class="project-kicker">独立策划 · AI 辅助实现</p><h2>让植物成长，<br/>成为守住花园的策略。</h2><p>我把玩法拆成植物、敌人、关卡与成长规则，推进实现，再逐项验收引导、操作和存档。</p><div class="studio-product-facts"><div><strong>4</strong><span>个世界</span></div><div><strong>20</strong><span>个关卡</span></div></div><div class="actions">{cta('game/index.html','开始游戏')}{cta('projects/sprout-patrol/index.html','我的产品分工',True)}</div></div>
   <div class="premium-game-display device-preview studio-panel-media">{device_frame(img(artwork['gamePreview']['src'],'萌芽保卫队当前版本真实游戏截图'))}</div>
  </div>
  <div class="studio-panel studio-panel-field" id="preview-panel-field" role="tabpanel" aria-labelledby="preview-tab-field" data-studio-panel="field">
   <div class="studio-panel-copy"><p class="project-kicker">与朋友共同开展 · 策划与现场执行</p><h2>面包挑战</h2><p>共同设计收费、奖励和参与规则，准备 A3 宣传物料，再根据实际人流调整场地与组织方式。</p><div class="actions">{cta('poster/index.html','活动方案与实际物料')}</div></div>
   {event_preview('studio-panel-media')}
  </div>
 </div>
</section>

{build_film(media, transcript)}
</div>'''


def event_preview(extra_class=''):
    return f'<div class="event-preview {extra_class}"><span>现场参与价格</span><strong>19.9<small> 元／次</small></strong></div>'
