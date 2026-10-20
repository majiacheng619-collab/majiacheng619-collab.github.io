"""A direct contact destination with native mail, telephone and resume links."""


def build_contact(img, cta):
    return (
        '<div class="detail-page contact-page">'
        '<section class="detail-hero"><div class="detail-shell"><h1>联系</h1></div></section>'
        '<section class="contact-layout detail-shell" aria-label="联系方式">'
        '<div class="contact-identity"><h2>马嘉程</h2><p>产品与运营 · 2027 届</p>'
        '<div class="actions">' + cta('resume.pdf', '下载简历') + '</div></div>'
        '<dl class="contact-methods">'
        '<div><dt>邮箱</dt><dd><a href="mailto:19870043434@163.com">19870043434@163.com</a></dd></div>'
        '<div><dt>手机</dt><dd><a href="tel:19870043434">19870043434</a></dd></div>'
        '</dl></section></div>'
    )
