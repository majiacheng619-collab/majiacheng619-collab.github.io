"""我保留原生联系入口，并提供清楚的复制反馈。"""

def build_contact(img, cta):
    return (
        '<div class="detail-page contact-page">'
        '<section class="detail-hero"><div class="detail-shell"><h1>联系</h1></div></section>'
        '<section class="contact-layout detail-shell" aria-label="联系方式">'
        '<div class="contact-identity"><div class="contact-profile">'+img('assets/portrait-white-960.b8bfe698eef3.webp','马嘉程个人照片',eager=True)+'<div><p class="contact-eyebrow">2027 届本科 · 南昌理工学院</p><h2>马嘉程</h2></div></div><p>运营与增长 · 产品与项目 · 内容与市场</p>'
        '<div class="actions">' + cta('resume.pdf', '下载简历') + '</div></div>'
        '<dl class="contact-methods">'
        '<div data-contact-row><dt>邮箱</dt><dd><a href="mailto:19870043434@163.com">19870043434@163.com</a><button class="contact-copy" type="button" data-copy-value="19870043434@163.com" aria-label="复制邮箱" hidden>复制</button><span class="copy-status" role="status" aria-live="polite" data-copy-status></span></dd></div>'
        '<div data-contact-row><dt>手机</dt><dd><a href="tel:19870043434">19870043434</a><button class="contact-copy" type="button" data-copy-value="19870043434" aria-label="复制手机号" hidden>复制</button><span class="copy-status" role="status" aria-live="polite" data-copy-status></span></dd></div>'
        '</dl></section></div>'
    )
