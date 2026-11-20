"""Render contact labels with an explicit reveal and copy action."""

from base64 import b64encode


PHONE = '19870043434'
EMAIL = '19870043434@163.com'


def contact_row(label, kind, value):
    encoded = b64encode(value.encode()).decode()
    return (f'<div data-contact-row="{kind}"><dt>{label}</dt><dd>'
            f'<button class="contact-copy contact-reveal" type="button" data-contact-reveal="{encoded}" '
            f'aria-expanded="false" aria-controls="contact-{kind}" hidden>显示{label}</button>'
            f'<span id="contact-{kind}" data-contact-value hidden></span>'
            f'<button class="contact-copy" type="button" data-contact-copy hidden>复制{label}</button>'
            '<span class="copy-status" role="status" data-copy-status></span></dd></div>')


def build_contact(img, cta, qr):
    return (
        '<div class="detail-page contact-page">'
        '<section class="detail-hero"><div class="detail-shell"><h1>联系</h1></div></section>'
        '<section class="contact-book detail-shell" data-contact-book aria-label="通讯录名片">'
        '<div class="contact-identity" data-card-front><div class="contact-profile">'
        + img('assets/portrait-white-960.b8bfe698eef3.webp','马嘉程个人照片',eager=True) +
        '<div><p class="contact-eyebrow">2027 届本科 · 南昌理工学院</p><h2>马嘉程</h2></div></div>'
        '<p>运营与增长 · 产品与项目 · 内容与市场</p>'
        '<div class="actions">' + cta('resume.pdf', '下载简历') + '</div></div>'
        '<div class="contact-back" id="contact-card-back" data-card-back>' +
        ('<noscript><details class="contact-methods"><summary>显示联系方式</summary>'
         f'<ul><li><a href="mailto:{EMAIL}">{EMAIL}</a></li>'
         f'<li><a href="tel:{PHONE}">{PHONE}</a></li></ul></details></noscript>') +
        '<dl class="contact-methods">' + contact_row('邮箱', 'email', EMAIL) +
        contact_row('手机', 'phone', PHONE) + '</dl>'
        f'<figure class="contact-qr"><img src="{qr}" alt="打开联系页的二维码" width="132" height="132" '
        'loading="lazy"/><figcaption>联系页二维码</figcaption></figure></div>'
        '<div class="actions contact-card-actions"><button type="button" class="os-action" '
        'data-contact-flip aria-controls="contact-card-back" aria-expanded="false" hidden>翻到联系方式</button>'
        '<button type="button" class="os-action" data-vcard hidden>下载通讯录名片</button></div>'
        '</section></div>'
    )
