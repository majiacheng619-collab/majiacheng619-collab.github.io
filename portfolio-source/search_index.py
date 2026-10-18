"""我从发布正文生成带章节锚点的搜索索引，并补充招聘常用词。"""
from html.parser import HTMLParser
from pathlib import Path
import html, re

class Reader(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip=0; self.active=False; self.parts=[]; self.sections=[]; self.current=None; self.title=''; self.in_title=False
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='title': self.in_title=True
        if tag in ('script','style','nav','footer','dialog'): self.skip+=1
        if tag=='main': self.active=True
        if self.active and not self.skip and a.get('id') and tag in ('section','article'):
            self.current=[a['id'],[]]; self.sections.append(self.current)
    def handle_endtag(self, tag):
        if tag=='title': self.in_title=False
        if tag in ('script','style','nav','footer','dialog'): self.skip=max(0,self.skip-1)
        if tag=='main': self.active=False
    def handle_data(self, data):
        if self.in_title: self.title+=data
        if self.active and not self.skip:
            self.parts.append(data)
            if self.current: self.current[1].append(data)

def install(root):
    records=[]
    aliases={'education':'学历 教育背景 学校 大学 专业 毕业 毕业时间 本科 专升本 学位 2027 应届生','skills':'技能 能力 软件 工具 IT Excel AI','ecommerce':'创业 电商 教学 项目 学员 增长 转化 运营','livestream':'抖音 直播 运营 荣誉'}
    # 我将常用招聘问题放在首屏，具体数值来自当前公开正文。
    records.append(('教育背景 · 南昌理工学院','experience/index.html#education','智能制造工程 · 本科在读 · 预计 2027 年 7 月毕业。此前就读华东交通大学。',aliases['education']))
    records.append(('联系马嘉程','index.html#about','求职方向：产品与运营。邮箱 19870043434@163.com，电话 19870043434。','联系 联系方式 电话 手机 邮箱 email 求职 产品经理 运营 简历'))
    for page in sorted(root.rglob('*.html')):
        rel=page.relative_to(root).as_posix()
        if rel in ('404.html','visitors/index.html') or '.en.' in rel or rel.endswith('index.en.html'): continue
        reader=Reader();reader.feed(page.read_text())
        title=reader.title.split('｜')[0].strip()
        text=re.sub(r'\s+',' ',' '.join(reader.parts)).strip()
        if not text: continue
        records.append((title,rel,text[:180],text))
        for anchor,parts in reader.sections:
            text=re.sub(r'\s+',' ',' '.join(parts)).strip()
            if len(text)<30 or anchor=='education': continue
            records.append((title+' · '+text[:30],rel+'#'+anchor,text[:160],text+' '+aliases.get(anchor,'')))
    for page in root.rglob('*.html'):
        doc=page.read_text()
        if 'id="search-dialog"' not in doc: continue
        prefix='../'*(len(page.relative_to(root).parts)-1)
        if page.name=='404.html': prefix='/'
        result=''.join('<a data-search-item data-search-keywords="'+html.escape(key,quote=True)+'" href="'+prefix+url+'"><strong>'+html.escape(title)+'</strong><small>'+html.escape(desc)+'</small></a>' for title,url,desc,key in records)
        doc=re.sub(r'(<div class="search-results">).*?(</div>)',lambda m:m[1]+result+m[2],doc,flags=re.S)
        page.write_text(doc)
    print(f'Search: {len(records)} current page and section records')
