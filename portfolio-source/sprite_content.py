"""Build the companion's passages from the actual published portfolio copy."""
from html.parser import HTMLParser
from pathlib import Path
import re

# Discovery vocabulary is separate from the source copy. It helps visitors ask
# in their own words without presenting aliases as claims about the candidate.
SECTIONS = {
    'education': ('教育经历', '学历 学厉 教育背景 学校 院校 毕业院校 毕业学校 大学 本科 专科 专业 毕业时间 什么时候毕业 哪里读书 在哪上学 读什么专业 第几届 应届生 education degree university college'),
    'roles': ('求职方向', '求职 应聘 招聘 职业方向 工作方向 岗位匹配 适合什么工作 能做什么岗位 找工作 招人 候选人 career job hiring'),
    'skills': ('工具与工作方法', '技能 能力 工作方法 擅长什么 会什么软件 办公软件 数据整理 数据透视表 查找匹配 提示词 ai工具 skills tools excel word powerpoint ppt canva'),
    'ecommerce': ('电商教学', '电商 教学 课程运营 教育运营 学费 收费 盈利 利润 收入 成本 经营分红 288 学员 获客 转化 增长 私域 社群 渠道 分销 推广伙伴 咨询 售后 答疑 客户成功 销售支持 选品 定价 sku commerce growth customer success'),
    'printing': ('校园打印创业', '打印 宿舍打印 校园创业 寝室打印店 黑白 彩印 低价 一份起送 送货上门 校园服务 引流 学生资源 交接 printing campus print shop'),
    'livestream': ('直播运营', '直播 抖音 主播 内容运营 新媒体 用户维护 曝光量 直播间 社群 私信 粉丝 互动 传播 封面 直播策划 livestream content'),
    'store': ('门店经营', '门店 餐饮 炸鸡 加盟 实体店 餐厅 零售 开业 选址 采购 供应商 食材 设备 商务支持 资源协调 store retail procurement'),
    'field': ('活动实践', '活动 面包 挑战 策划 执行 地推 线下推广 现场组织 规则设计 宣传物料 海报 统筹 event campaign'),
    'ai-work': ('AI 影像', 'ai影像 ai视频 短视频 叙事 影片 剪辑 脚本 分镜 提示词 素材 配音 字幕 成片 内容策划 seedance seedream 剪映 video storytelling'),
    'digital-work': ('数字产品交付', '游戏 萌芽 保卫队 塔防 数字产品 网站 产品助理 产品运营 项目助理 项目执行 需求拆解 交付 验收 人工智能 辅助开发 codex game product project'),
}
ROUTES = {
    'projects/index.html': ('作品与项目', '作品 项目 作品集 做过什么 项目经历 portfolio projects'),
    'projects/sprout-patrol/index.html': ('萌芽保卫队', SECTIONS['digital-work'][1]),
    'projects/ai-content/index.html': ('AI 影像', SECTIONS['ai-work'][1]),
    'poster/index.html': ('面包挑战', SECTIONS['field'][1]),
    'honor/index.html': ('荣誉与证书', '荣誉 证书 获奖 奖项 奖励 凭证 学生干部 家乡荣耀季 区县100强 award certificate'),
    'contact/index.html': ('联系与合作', '联系 联系方式 怎么联系 联络 邮箱 邮件 电话 手机号码 微信 合作 简历 履历 下载简历 contact email resume cv'),
    'updates/index.html': ('最近更新', '更新 最近动态 新版 发布 迭代 上线 updates release'),
    'index.html': ('认识嘉程', '马嘉程 嘉程 自我介绍 个人介绍 认识嘉程 关于我 about introduction'),
}


def discovery_metadata(route, anchor):
    section, keywords = SECTIONS.get(anchor, ROUTES.get(route, ('实践经历', '实践 经历 experience')))
    return {'section': section, 'keywords': keywords}


class Passages(HTMLParser):
    def __init__(self, route):
        super().__init__()
        self.route, self.records = route, []
        self.main = False
        self.stack = []
        self.capture = None
        self.buffer = []
        self.title = ''
        self.section_title = ''
        self.anchor = ''
        self.parts = []
        self.facts_depth = None
        self.facts = []
        self.section_contexts = {}
        self.contact_depth = None
        self.contact_label = ''
        self.contact_values = []
        self.contact_capture = None
        self.contact_buffer = []

    def flush(self):
        text = '\n\n'.join(dict.fromkeys(self.parts))
        if text and self.title:
            self.records.append({'title': self.title, 'text': text,
                                 'url': self.route + ('#'+self.anchor if self.anchor else ''),
                                 **discovery_metadata(self.route, self.anchor)})
        self.parts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'main': self.main = True
        if not self.main: return
        if tag == 'section':
            self.flush()
            self.section_contexts[len(self.stack) + 1] = (self.title, self.section_title, self.anchor)
            self.title = self.section_title = self.anchor = ''
        if tag in ('section', 'article', 'div'):
            self.stack.append((tag, attrs.get('id', '')))
        if 'data-contact-row' in attrs:
            self.contact_depth = len(self.stack)
            self.contact_label, self.contact_values = '', []
        if self.contact_depth is not None and (tag == 'dt' or tag == 'a' and attrs.get('href', '').startswith(('mailto:', 'tel:'))):
            self.contact_capture, self.contact_buffer = tag, []
        if tag == 'br' and self.capture:
            self.buffer.append(' ')
        if 'case-facts' in attrs.get('class', '').split():
            self.facts_depth = len(self.stack)
            self.facts = []
        if tag in ('h1', 'h2', 'h3', 'p', 'li') and self.capture is None:
            self.capture, self.buffer = tag, []

    def handle_data(self, value):
        if self.contact_capture:
            self.contact_buffer.append(value)
        if self.capture: self.buffer.append(value)
        elif self.facts_depth is not None and value.strip(): self.facts.append(value.strip())

    def handle_endtag(self, tag):
        if not self.main: return
        if tag == self.contact_capture:
            value = re.sub(r'\s+', ' ', ''.join(self.contact_buffer)).strip()
            if tag == 'dt': self.contact_label = value
            elif value: self.contact_values.append(value)
            self.contact_capture = None
        if tag == 'div' and self.contact_depth == len(self.stack):
            if self.contact_label and self.contact_values:
                self.parts.append(self.contact_label + '：' + ' / '.join(self.contact_values))
            self.contact_depth = None
        if tag == 'div' and self.facts_depth == len(self.stack):
            value = ' · '.join(self.facts)
            if value: self.parts.append(value)
            self.facts_depth, self.facts = None, []
        if tag == 'strong' and self.capture:
            self.buffer.append(' ')
        if tag == self.capture:
            value = re.sub(r'\s+', ' ', ''.join(self.buffer)).strip()
            if tag.startswith('h'):
                pending = self.parts[:] if not self.title else []
                self.flush()
                self.parts = pending
                if tag == 'h2': self.section_title = value
                self.title = (self.section_title+' · '+value) if tag == 'h3' and self.section_title else value
                self.anchor = next((a for _, a in reversed(self.stack) if a), '')
            elif value: self.parts.append(value)
            self.capture = None
        if tag in ('section', 'article', 'div') and self.stack and self.stack[-1][0] == tag:
            if tag == 'section':
                self.flush()
                self.title, self.section_title, self.anchor = self.section_contexts.pop(len(self.stack), ('', '', ''))
            self.stack.pop()
        if tag == 'main':
            self.flush()
            self.main = False


def build(root):
    records = []
    for route in ('index.html', 'experience/index.html', 'projects/index.html',
                  'projects/sprout-patrol/index.html', 'projects/ai-content/index.html',
                  'poster/index.html', 'honor/index.html', 'updates/index.html', 'contact/index.html'):
        parser = Passages(route)
        parser.feed((Path(root)/route).read_text())
        records.extend(parser.records)
    return records
