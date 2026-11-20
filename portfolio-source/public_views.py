"""Build the accessible text, English and landscape views."""

from html import escape
from profile_data import PROFILE


def list_items(entries):
    return ''.join(f'<li>{escape(value)} · {escape(label)}</li>' for value, label in entries)


def translated_case(record):
    case = record['en']
    date = case.get('time', record['time'])
    action = ''.join(f'<li><strong>{escape(title)}</strong><p>{escape(copy)}</p></li>' for title, copy in case['actions'])
    return f'''
    <article class="en-case" id="{record['id']}" data-case-id="{record['id']}">
      <h2>{escape(case['title'])}</h2>
      <p class="en-role">{escape(date)} · {escape(case['role'])}</p>
      <p>{escape(case['context'])}</p>
      <ul>{list_items(case['facts'])}</ul><h3>What I did</h3><ol>{action}</ol>
      <h3>Outcome</h3><p>{escape(case['result'])}</p>
    </article>
    '''


def english(cta):
    personal = PROFILE['en']
    edu = ''.join(f'<li><strong>{escape(title)}</strong><p>{escape(body)}</p></li>' for title, body in personal['education'])
    skills = ''.join(f'<li><strong>{escape(title)}</strong><p>{escape(body)}</p></li>' for title, body in personal['skills'])
    cases = ''.join(translated_case(item) for item in PROFILE['cases'])
    return f'''
    <div class="en-profile">
      <section class="detail-hero"><div class="detail-shell"><h1>{personal['name']}</h1>
        <p>{personal['cohort']}</p><p class="detail-intro">{personal['headline']}</p>
        <div class="actions">{cta('resume.pdf','Download résumé')}{cta('index.html','中文',True)}</div>
      </div></section>
      <div class="detail-shell">
        <section aria-labelledby="en-roles"><h2 id="en-roles">Career interests</h2><p>{personal['roles']}</p></section>
        <div class="en-sources">
          <a href="projects/sprout-patrol/index.html">Sprout Patrol</a>
          <a href="ice/index.html">Cathedral of Ice</a>
          <a href="poster/index.html">Bread Challenge</a>
          <a href="contact/index.html">Contact</a>
        </div>
      </div>
      <div class="detail-shell">{cases}</div>
      <section class="detail-shell" aria-labelledby="en-education"><h2 id="en-education">Education and campus service</h2><ul>{edu}</ul></section>
      <section class="detail-shell" aria-labelledby="en-skills"><h2 id="en-skills">Tools and working methods</h2><ul>{skills}</ul></section>
    </div>
    '''


def text_document(title, body):
    return f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex,nofollow,noarchive"/>
<title>{escape(title)}</title>
<style>
  html {{color-scheme:light dark;background:#fff;color:#132c46;font:100%/1.65 system-ui,sans-serif}}
  body {{max-width:72ch;margin:2rem auto;padding:0 1rem}}
  a {{color:#135c99;text-underline-offset:.2em}}
  @media (prefers-color-scheme: dark) {{html {{background:#071625;color:#eff7ff}} a {{color:#9dd4ff}}}}
  :focus-visible {{outline:3px solid currentColor;outline-offset:3px}}
  @media print {{nav {{display:none}} article {{break-inside:avoid}}}}
</style>
<main id="main">{body}</main></html>
'''


def plain(resume):
    cases = []
    for case in PROFILE['cases']:
        actions = ''.join(f'<li><strong>{escape(title)}</strong> {escape(copy)}</li>' for title, copy in case['actions'])
        cases.append(f'<article id="{case["id"]}"><h2>{escape(case["title"])}</h2>'
                     f'<p>{escape(case["time"])} · {escape(case["role"])}</p><p>{escape(case["context"])}</p>'
                     f'<ul>{list_items(case["facts"])}</ul><ol>{actions}</ol><p>{escape(case["result"])}</p></article>')
    education = ''.join(f'<li>{title}　{body}</li>' for title, body in PROFILE['education'])
    body = (f'<h1>{PROFILE["name"]}</h1><p>{PROFILE["cohort"]} · {PROFILE["school"]}</p>'
            f'<p>{PROFILE["headline"]}</p><p>{PROFILE["roles"]}</p>'
            f'<nav aria-label="网站入口"><a href="../index.html">主屏</a> · <a href="../{resume}" download>简历</a>'
            ' · <a href="../contact/index.html">联系</a></nav>' + ''.join(cases) +
            f'<h2>教育与校园服务</h2><ul>{education}</ul>')
    return text_document('马嘉程 · 纯文字版', body)


def standby():
    return '''
    <section class="standby-page premium-shell" aria-label="展台">
      <div class="standby-clock"><h1>马嘉程 OS</h1><p class="standby-time" data-standby-time>展台</p>
      <p data-standby-date></p></div>
      <div class="standby-links"><a href="projects/index.html">作品</a><a href="ice/index.html">冰之圣殿</a>
      <a href="story/index.html">一分钟故事</a><a href="index.html">返回主屏</a></div>
    </section>
    '''


def offline():
    return text_document('马嘉程 OS · 离线', '<h1>当前离线</h1><p><a href="/plain/">阅读纯文字版</a></p><p><a href="/">返回主屏</a></p>')
