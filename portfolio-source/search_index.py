"""我从发布正文生成带章节锚点的搜索索引，并补充招聘常用词。"""
from html.parser import HTMLParser
from pathlib import Path
import html, re

class Reader(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip=0; self.active=False; self.parts=[]; self.sections=[]
        self.scopes=[]; self.heading=None; self.title=''; self.in_title=False
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag=='title': self.in_title=True
        if tag in ('script','style','nav','footer','dialog'): self.skip+=1
        if tag=='main': self.active=True
        if not self.active or self.skip: return
        if tag in ('section','article'):
            section=[attrs['id'],[],[]] if attrs.get('id') else None
            self.scopes.append(section)
            if section is not None: self.sections.append(section)
        if tag in ('h2','h3'):
            section=next((scope for scope in reversed(self.scopes) if scope is not None),None)
            self.heading=section if section is not None and not section[2] else None
    def handle_endtag(self, tag):
        if tag=='title': self.in_title=False
        if tag in ('script','style','nav','footer','dialog'): self.skip=max(0,self.skip-1)
        if not self.active or self.skip: return
        if tag in ('h2','h3'): self.heading=None
        if tag in ('section','article') and self.scopes: self.scopes.pop()
        if tag=='main': self.active=False; self.scopes=[]
    def handle_data(self, data):
        if self.in_title: self.title+=data
        if self.active and not self.skip:
            self.parts.append(data)
            for section in self.scopes:
                if section is not None: section[1].append(data)
            if self.heading is not None: self.heading[2].append(data)

def compact_title(value, limit=32):
    value=re.sub(r'\s+',' ',value).strip()
    return value if len(value)<=limit else value[:limit-1].rstrip(' ·，。')+'…'

def install(root):
    records=[]
    aliases={'education':'学历 教育背景 学校 大学 专业 毕业 毕业时间 本科 专升本 学位 2027 应届生','skills':'技能 能力 软件 工具 IT Excel AI','ecommerce':'创业 电商 教学 项目 学员 增长 转化 运营','livestream':'抖音 直播 运营 荣誉'}
    # 我将常用招聘问题放在首屏，具体数值来自当前公开正文。
    records.append(('教育背景 · 南昌理工学院 · 本科','experience/index.html#education','智能制造工程 · 本科在读 · 预计 2027 年 7 月毕业。此前就读华东交通大学。',aliases['education']))
    records.append(('联系马嘉程','index.html#about','求职方向：产品与运营。邮箱 19870043434@163.com，电话 19870043434。','联系 联系方式 电话 手机 邮箱 email 求职 产品经理 运营 简历'))
    for page in sorted(root.rglob('*.html')):
        rel=page.relative_to(root).as_posix()
        if rel in ('404.html','visitors/index.html') or '.en.' in rel or rel.endswith('index.en.html'): continue
        reader=Reader();reader.feed(page.read_text())
        title=compact_title(reader.title.split('｜')[0].strip())
        text=re.sub(r'\s+',' ',' '.join(reader.parts)).strip()
        if not text: continue
        records.append((title,rel,text[:180],text))
        for anchor,parts,heading in reader.sections:
            text=re.sub(r'\s+',' ',' '.join(parts)).strip()
            if len(text)<30 or anchor=='education': continue
            section_title=compact_title(''.join(heading)) or title
            records.append((section_title,rel+'#'+anchor,text[:160],text+' '+aliases.get(anchor,'')))
    for page in root.rglob('*.html'):
        doc=page.read_text()
        if 'id="search-dialog"' not in doc: continue
        prefix='../'*(len(page.relative_to(root).parts)-1)
        if page.name=='404.html': prefix='/'
        result=''.join('<a data-search-item data-search-keywords="'+html.escape(key+' '+desc,quote=True)+'" href="'+prefix+url+'"><strong>'+html.escape(title)+'</strong></a>' for title,url,desc,key in records)
        doc=re.sub(r'(<div class="search-results">).*?(</div>)',lambda m:m[1]+result+m[2],doc,flags=re.S)
        page.write_text(doc)
    print(f'Search: {len(records)} current page and section records')
