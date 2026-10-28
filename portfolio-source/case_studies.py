"""我以真实职责和已确认结果组织案例，把岗位能力放在具体行动之后。"""
from html import escape


CASES = [{'id': 'ecommerce',
  'title': '电商知识付费与用户增长',
  'time': '2022.06—2024.12',
  'role': '项目创始人 · 独立操盘',
  'context': '面向有创收需求的在校学生，从带教几位高中同学起步，将电商经验转化为教学与经营辅导服务。',
  'actions': [('设计服务模式', '采用“先赚钱、后交学费＋经营分红”模式，降低学员开始尝试的门槛。'),
              ('发展推广伙伴', '将早期学员与朋友发展为推广伙伴，采用单层引荐分成，伙伴获 6 成；学员主要由伙伴带来，我负责伙伴开发。'),
              ('完成教学与经营辅导', '沉淀教学视频、操作手册与 FAQ，持续提供教学、店铺经营辅导与售后答疑。'),
              ('优化学员店铺', '指导调整活动策略、SKU 与投流。一个新店案例中，仅设置 1 个 SKU、未付费投流，截至当晚获得百余笔已付款订单。')],
  'result': '沉淀 1,000 余位微信好友，其中熟人不足 100 人。',
  'facts': [('40 万元以上', '该项目累计净利润'), ('近 1,000 人', '累计去重学员'), ('40–50 人', '推广合作伙伴'), ('288 元/人', '教学服务学费')]},
 {'id': 'printing',
  'title': '宿舍打印店创业：从校园需求到服务交付',
  'time': '2023.09—2024.12',
  'role': '创始人 · 校园服务与项目引流',
  'context': '校内仅有 1 家打印店，存在排队久、价格高、离宿舍远的问题。我在宿舍开店，为周边同学提供打印服务。',
  'actions': [('设计价格与配送', '以校内打印店黑白 0.5 元、彩印 1 元的 4 折定价，并提供送货上门。'),
              ('验证并交接经营', '经营半年多验证可盈利后，交由同学接手并获得分红，毕业前出售设备收尾。'),
              ('衔接其他业务', '通过打印服务沉淀学生资源，向电商知识付费等多个项目导流。')],
  'result': '单日最高收益数百元。',
  'facts': [('0.2 元', '黑白打印价格'), ('0.4 元', '彩印价格'), ('1 份起送', '送货上门')]},
 {'id': 'livestream',
  'title': '抖音直播内容策划与用户维护',
  'time': '2026.02—2026.09',
  'role': '独立主播 · 内容与用户运营',
  'context': '在直播之外，通过持续沟通延续与用户的联系。',
  'actions': [('准备开播', '独立策划主题、制作封面，筹备软硬件、场地与户外专场。'),
              ('调整内容与场景', '学习才艺，根据反馈调整直播风格、设备与呈现形式。'),
              ('维护用户关系', '通过社群、私信和个性化关怀延续直播中的互动。')],
  'result': '约 1 小时的直播达成单场最高曝光，获 2026 年“家乡荣耀季”区县 100 强。',
  'facts': [('1 万+', '抖音粉丝'), ('30 万+', '单场最高曝光'), ('日均约 3 小时', '直播时长')]},
 {'id': 'store',
  'title': '韩式炸鸡加盟门店筹备与经营',
  'time': '2025.08—2025.11',
  'role': '合伙人 · 开业统筹与线下运营',
  'context': '与朋友合伙开展韩式炸鸡加盟门店项目，从筹备推进到实际营业。',
  'actions': [('推进开业准备', '参与加盟比选、门店选址和租赁签约，协调装修与开业安排。'),
              ('采购设备与食材', '比较批发和网购渠道，采购冰箱、空调等设备，通过美菜采购食品。'),
              ('参与日常经营', '参与定价、订单出餐与卫生维护，复盘实际经营问题。')],
  'result': '与朋友共同完成门店开业。',
  'facts': [('50%', '合伙持股比例')]},
 {'id': 'field',
  'title': '面包挑战：活动规则与现场组织',
  'time': '2025.07—2025.08 / 2026.10 起',
  'role': '与朋友共同开展 · 策划与执行',
  'context': '与朋友在南昌开展低投入的互动挑战活动，向现场人群说明收费、规则与奖励。',
  'actions': [('设计规则与宣传物料', '参与收费、奖励和挑战要求设计，面包成本 1.2 元/片，每日限量备货 20 片；准备宣传物料并在现场解释活动方式。'),
              ('组织现场', '选择人流较大的场地，统筹物料与现场安排。'),
              ('按人流调整', '调整经营位置与组织方式，包括流动经营。')],
  'result': '现场吸引了参与者和围观人群，网站保留实际活动海报。',
  'facts': [('A3 物料', '现场宣传与规则说明'), ('2–3 小时', '通常的当场安排'), ('19.9 元/次', '参与价格')]},
 {'id': 'ai-work',
  'title': 'AI 叙事影像：从选题到成片',
  'time': '2026.09 起',
  'role': '独立策划 · AI 素材制作 · 后期剪辑',
  'context': '以完整成片练习视听叙事。',
  'actions': [('拆分镜头任务', '使用 ChatGPT 梳理选题与脚本，拆分分镜和素材生成提示词。'),
              ('制作与剪辑', '使用 Seedream、Seedance 生成素材，在剪映完成配音、字幕和剪辑，调整叙事节奏。'),
              ('发布与归档', '整理作品集并保留原作入口。')],
  'result': '主题涵盖升学就业、风险代价和家庭陪伴。故事为虚构创作，非个人经历。',
  'facts': [('3 支', '已发布叙事作品')]},
 {'id': 'digital-work',
  'title': '网页游戏策划与产品交付',
  'time': '2026.10 发布游戏并持续迭代',
  'role': '独立策划与验收 · AI 辅助实现',
  'context': '把植物成长与资源分配转化为塔防玩法。',
  'actions': [('定义玩法与范围', '设计“萌芽—成株—开花”机制，规划植物、敌人和关卡。'),
              ('推进实现', '拆解需求、设计提示词并提出反馈，完善引导、资源、暂停与存档。'),
              ('交付与验收', '公开发布网站和游戏，持续检查页面、操作与发布资源。')],
  'result': '个人网站与《萌芽保卫队》均已公开发布，可直接访问和操作。',
  'facts': [('4 个世界', '公开游戏内容'), ('20 个关卡', '完整关卡推进')]}]

def case_section(case, cta):
    e = escape
    facts = ''.join(f'<div><strong>{e(value)}</strong><span>{e(label)}</span></div>' for value, label in case['facts'])
    actions = ''.join(f'<li><h4>{e(title)}</h4><p>{e(copy)}</p></li>' for title, copy in case['actions'])
    links = ''
    if case['id'] == 'livestream': links = cta('honor/index.html', '查看荣誉凭证', True)
    if case['id'] == 'field': links = cta('poster/index.html', '查看现场宣传物料', True)
    if case['id'] == 'ai-work': links = cta('projects/ai-content/index.html', '观看原作', True)
    if case['id'] == 'digital-work': links = cta('projects/sprout-patrol/index.html', '体验与产品案例', True)
    return f'''<section class="case-study detail-shell" id="{e(case['id'])}" aria-labelledby="case-{e(case['id'])}">
<div class="case-overview"><div class="case-heading"><p class="case-meta">{e(case['time'])}<span>{e(case['role'])}</span></p><h2 id="case-{e(case['id'])}">{e(case['title'])}</h2></div>
<div class="case-facts case-facts-{len(case["facts"])}">{facts}</div></div>
<div class="case-reading"><div class="star-grid"><article class="star-result"><h3>实际结果</h3><p>{e(case['result'])}</p></article><article class="star-actions"><h3>我做了什么</h3><ol>{actions}</ol></article></div>
<details class="case-context"><summary>项目背景</summary><p>{e(case['context'])}</p></details>
{f'<div class="case-evidence">{links}</div>' if links else ''}</div></section>'''


def build_experience(cta, detail_rows):
    index=[('ecommerce','电商业务'),('printing','校园打印'),('livestream','直播'),('store','门店'),('field','活动'),('digital-work','数字产品')]
    links = ''.join(f'<a href="#{anchor}">{label}</a>' for anchor,label in index)
    result = '<div class="detail-page detail-experience"><section class="detail-hero"><div class="detail-shell"><h1>实践经历</h1><p class="detail-intro">做过的业务、承担的职责与实际结果。</p></div></section><div class="case-index detail-shell"><div class="case-jump" aria-label="经历目录">'+links+'</div></div>'
    result += '<section class="career-section detail-shell" id="roles"><h2>求职方向</h2><p class="career-intro">2027 届本科校招，意向一线及新一线城市。求职方向包括产品、用户与内容运营、电商、新媒体、活动策划、市场、销售商务与管培生。</p></section>'
    result += ''.join(case_section(case,cta) for case in CASES)
    result += detail_rows('skills','工具与工作方法',[
        ('业务与用户','咨询承接、用户沟通、服务交付、渠道合作、经营问题梳理。'),
        ('产品与 AI 应用','LLM 应用（ChatGPT、Claude）、提示词设计、Codex 与 Claude Code 辅助开发；通过需求拆解和迭代反馈推进产品交付。'),
        ('内容与视觉','Seedream、Seedance、剪映、Canva；覆盖脚本、分镜、素材、配音字幕与视觉材料。'),
        ('办公与数据','Word 文档编排、PowerPoint 演示材料；Excel 常用公式、查找匹配和数据透视表，用于信息整理和分类汇总。')])
    result += detail_rows('education','教育与校园服务',[
        ('南昌理工学院','智能制造工程 · 全日制本科在读（专升本）<br/>2025.09—2027.07（预计）'),
        ('华东交通大学','铁道信号自动控制 · 专科<br/>2022.09—2025.07'),
        ('校园服务','两校就读期间均担任学习委员，负责班级沟通与学习事务。'),
        ('语言证书','普通话二级甲等。')])
    return result + '</div>'
