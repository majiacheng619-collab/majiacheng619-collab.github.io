"""One compact local search surface, shared by portfolio pages."""


def companion():
    creature = '''<span class="sprite-creature" aria-hidden="true"><span class="sprite-aura"></span><span class="sprite-body"><span class="sprite-ribbon"></span><span class="sprite-face"><i></i><i></i></span><span class="sprite-shine"></span></span><span class="sprite-shadow"></span></span>'''
    return '''<aside class="sprite" data-sprite data-sprite-state="welcome" data-sprite-view="answer" aria-label="小程悬浮精灵">
<button class="sprite-launcher" type="button" hidden aria-label="打开小程悬浮窗" aria-expanded="false" aria-controls="sprite-panel">'''+creature+'''</button>
<section class="sprite-panel" id="sprite-panel" role="dialog" aria-modal="false" aria-labelledby="sprite-title" hidden inert>
<div class="sprite-top"><h2 id="sprite-title">小程</h2><button type="button" class="sprite-close" aria-label="收起小程">完成</button></div>
<form class="sprite-form" role="search" aria-label="搜索站内内容"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input type="search" name="query" aria-label="搜索经历、作品和联系方式" placeholder="想了解嘉程的什么？" maxlength="140" autocomplete="off" enterkeyhint="search"/><button type="button" data-sprite-clear-input class="sprite-clear-input" aria-label="清除搜索" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button><button type="submit" aria-label="搜索" disabled>搜索</button></form>
<span class="sprite-status" data-sprite-status role="status" aria-live="polite"></span>
<div class="sprite-scroll" role="region" aria-label="搜索结果" tabindex="0"><div class="sprite-results"></div></div>
</section></aside>'''
