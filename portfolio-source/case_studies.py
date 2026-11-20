"""我以真实职责和已确认结果组织案例，把岗位能力放在具体行动之后。"""
from html import escape


from profile_data import PROFILE
from os_components import lenses

CASES = PROFILE['cases']

def case_section(case, cta):
    e = escape
    facts = ''.join(f'<div><strong>{e(value)}</strong><span>{e(label)}</span></div>' for value, label in case['facts'])
    actions = ''.join(f'<li><h4>{e(title)}</h4><p>{e(copy)}</p></li>' for title, copy in case['actions'])
    links = ''
    if case['id'] == 'livestream': links = cta('honor/index.html', '查看荣誉凭证', True)
    if case['id'] == 'field': links = cta('poster/index.html', '查看现场宣传物料', True)
    if case['id'] == 'digital-work': links = cta('projects/sprout-patrol/index.html', '体验与产品案例', True)
    return f'''<section class="case-study detail-shell" id="{e(case['id'])}" data-case-id="{e(case['id'])}" aria-labelledby="case-{e(case['id'])}">
<div class="case-overview"><div class="case-heading"><p class="case-meta">{e(case['time'])}<span>{e(case['role'])}</span></p><h2 id="case-{e(case['id'])}">{e(case['title'])}</h2></div>
<div class="case-facts case-facts-{len(case["facts"])}">{facts}</div></div>
<div class="case-reading"><div class="star-grid"><article class="star-result"><h3>实际结果</h3><p>{e(case['result'])}</p></article><article class="star-actions"><h3>我做了什么</h3><ol>{actions}</ol></article></div>
<details class="case-context"><summary>项目背景</summary><p>{e(case['context'])}</p></details>
{f'<div class="case-evidence">{links}</div>' if links else ''}</div></section>'''


def build_experience(cta, detail_rows):
    index=[('ecommerce','电商业务'),('printing','校园打印'),('livestream','直播'),('store','门店'),('field','活动'),('digital-work','数字产品')]
    links = ''.join(f'<a href="#{anchor}">{label}</a>' for anchor,label in index)
    result = '<div class="detail-page detail-experience"><section class="detail-hero"><div class="detail-shell"><h1>实践经历</h1><p class="detail-intro">做过的业务、承担的职责与实际结果。</p></div></section><div class="case-index detail-shell"><div class="case-jump" role="group" aria-label="经历目录">'+links+'</div></div>'
    result += '<section class="career-section detail-shell" id="roles"><h2>求职方向</h2><p class="career-intro">' + PROFILE['roles'] + '</p>' + lenses() + '</section>'
    result += '<div data-lens-list>' + ''.join(case_section(case,cta) for case in CASES) + '</div>'
    result += detail_rows('skills', '工具与工作方法', PROFILE['skills'])
    result += detail_rows('education', '教育与校园服务', PROFILE['education'])
    return result + '</div>'
