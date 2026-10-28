/* Local, source-bound answer composition. Every biographical statement comes
   from the supplied release records; this module makes no network requests. */
(() => {
  'use strict';
  const normalize = value => String(value || '').normalize('NFKC').toLowerCase()
    .replace(/[學歷畢業專聯繫郵電話獎榮譽證書職項經驗戲製營銷視頻軟體華東鐵號絡門點實資頒選擇]/g, c => ({'學':'学','歷':'历','畢':'毕','業':'业','專':'专','聯':'联','繫':'系','郵':'邮','電':'电','話':'话','獎':'奖','榮':'荣','譽':'誉','證':'证','書':'书','職':'职','項':'项','經':'经','驗':'验','戲':'戏','製':'制','營':'营','銷':'销','視':'视','頻':'频','軟':'软','體':'体','華':'华','東':'东','鐵':'铁','號':'号','絡':'络','門':'门','點':'点','實':'实','資':'资','頒':'颁','選':'选','擇':'择'}[c] || c))
    .replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g,'$1');
  const topics = [
    {id:'education', title:'教育背景', section:'教育经历', test:/学历|学厉|教育|学校|院校|大学|本科|专科|专业|毕业|读书|上学|\b(?:degree|education|educational|university|college|school|graduat(?:e|ion)|stud(?:y|ied))\b/, path:/#education$/, followups:['什么时候毕业？','会用哪些工具？','适合什么岗位？']},
    {id:'career', title:'求职方向与已有实践', section:'求职方向', test:/求职|岗位|找工作|应聘|招聘|职业|什么工作|(?:适合|能做|可以做|能胜任|能应聘).*(?:工作|运营|商务|市场|产品|项目执行)|\b(?:career|job|hiring|position)\b/, path:/#roles$/, followups:['有哪些项目成果？','会用哪些工具？','联系方式与简历']},
    {id:'tools', title:'工具与工作方法', section:'工具与工作方法', test:/工具|技能|软件|擅长|能力|会用|办公|\b(?:excel|word|powerpoint|ppt|canva|skills?|tools?|software)\b/, path:/#skills$/, followups:['AI 影像是怎么做的？','有哪些项目成果？','适合什么岗位？']},
    {id:'ecommerce', title:'电商教学与用户增长', section:'电商教学', test:/电商|网店|开店|教学|课程|288|学员|学费|收费|盈利|利润|收入|推广伙伴|获客|分红|\b(?:commerce|tuition|profit)\b/, path:/#ecommerce$/, followups:['具体做了哪些行动？','有哪些实际成果？','适合什么岗位？']},
    {id:'printing', title:'宿舍打印店创业', section:'校园打印创业', test:/打印|彩印|宿舍|寝室|送货上门|一份起送|\bprinting\b/, path:/#printing$/, followups:[]},
    {id:'business', title:'多项目经营成果', section:'经营成果', test:/多项目|所有项目|全部项目|一共赚|总共赚|创业总/, path:/^index\.html#career-lens$/, followups:[]},
    {id:'contact', title:'联系与个人简历', section:'联系与合作', test:/联系|邮箱|电话|手机|微信|合作|简历|履历|\b(?:contact|email|resume|cv)\b|reach you|get in touch/, path:/^contact\//, followups:['适合什么岗位？','30秒了解嘉程','有哪些项目成果？']},
    {id:'ai', title:'AI 影像与内容制作', section:'AI 影像', test:/ai\s*(?:影像|视频)|短视频|影片|剪辑|分镜|seedance|seedream|视频作品/, path:/projects\/ai-content\/|#ai-work$/, followups:['会用哪些工具？','有哪些项目成果？','联系方式与简历']},
    {id:'game', title:'萌芽保卫队与数字产品', section:'萌芽保卫队', test:/萌芽|游戏|塔防|codex|\bgame\b/, path:/projects\/sprout-patrol\/|#digital-work$/, followups:['项目是如何交付的？','会用哪些工具？','AI 影像']},
    {id:'livestream', title:'直播运营实践', section:'直播运营', test:/直播|主播|直播间|抖音/, path:/#livestream$/, followups:['有哪些实际成果？','电商教学','适合什么岗位？']},
    {id:'store', title:'门店经营实践', section:'门店经营', test:/门店|餐饮|餐厅|炸鸡|加盟|采购|实体店/, path:/#store$/, followups:['具体做了哪些行动？','活动策划','适合什么岗位？']},
    {id:'events', title:'活动策划与执行', section:'活动实践', test:/活动|面包|挑战|线下|地推/, path:/#field$/, followups:['有哪些实际成果？','门店经营','联系方式与简历']},
    {id:'honors', title:'荣誉与证书', section:'荣誉与证书', test:/荣誉|获奖|奖项|证书|普通话|学生干部|\b(?:awards?|certificates?)\b/, path:/^honor\//, followups:['教育经历','适合什么岗位？','联系方式与简历']},
    {id:'projects', title:'作品与项目成果', section:'作品与项目', test:/作品|项目|做过什么|成果|\b(?:portfolio|projects?)\b/, path:/^projects\/|#ecommerce$|#printing$|#livestream$|#store$|#field$/, followups:['电商教学有哪些成果？','萌芽保卫队','AI 影像']}
  ];
  // A small vocabulary resolves visitors' own wording to published sections.
  // It never supplies facts: every answer and every hit still comes from records.
  const vocabulary = {
    education:['教育背景','教育经历','毕业院校','毕业学校','学业经历','学厉','学藉','学籍','最高文凭','文凭','学位','哪个学校','哪所学校','哪年毕业','学的什么','读的什么','大学学什么','在哪上过学','在哪读过书','大专','education','degree','university','college','school','graduation'],
    career:['职业规划','职业方向','工作方向','求职意向','意向岗位','就业方向','想找什么','想做什么','愿意做什么','能干什么','适合做什么','career','position','hiring'],
    tools:['技术栈','办公软件','办公能力','工作方法','操作什么','熟悉什么','拿手什么','skills','tools','software','powerpoint'],
    ecommerce:['电子商务','电子商物','电商教课','招生','招学生','教开店','教网店','售后辅导','培训','培训费','商业变现','推广合作','拉新','转化','用户增长','营销','ecommerce','e-commerce','tuition','profit'],
    printing:['打印店','宿舍打印','寝室打印','校园打印','校园创业','校园服务','送货上门','一份起送','黑白打印','彩色打印','彩印','printing'],
    business:['多项目经营','创业总成果','所有项目利润','总共赚了多少'],
    contact:['联络','联糸','邮相','邮件','邮件地址','电话号码','手机号码','手机号','微信号','联系方试','联系方法','个人资料','投递简历','下载简历','resume','contact','email','wechat'],
    ai:['人工智能影像','人工智能视频','叙事短片','影像制作','内容创作','视频制作','成片','剪映','seedance','seedream'],
    game:['网页开发','网站开发','平台开发','软件开发','数字产品','产品开发','做网站','写网站','开发游戏','萌牙保卫队','萌芽保卫对','萌芽保卫','sprout','codex','game'],
    livestream:['直播策划','直播互动','开播','家乡荣耀季','短视频直播','livestream'],
    store:['开店经营','店铺经营','线下经营','实体经营','门店运营','选址','加盟店','炸鸡店','餐馆'],
    events:['线下活动','活动执行','现场执行','活动组织','面包挑战','活动策化','地推活动'],
    honors:['资格证','资格证书','获奖经历','竞赛奖项','荣誉证书','荣誉证件','获奖情况','奖状','awards','certificate'],
    projects:['实践经历','工作经历','项目经历','项目成果','案例','做过哪些事','做过哪些事情','做过什么事','portfolio','projects']
  };
  function oneEditApart(a,b) {
    if (Math.abs(a.length-b.length)>1) return false;
    if (a.length===b.length) {
      const different=[];
      for(let i=0;i<a.length;i++) if(a[i]!==b[i]) different.push(i);
      if(different.length===2) {
        const [i,j]=different;
        if(j===i+1 && a[i]===b[j] && a[j]===b[i]) return true;
      }
    }
    let i=0,j=0,edits=0;
    while(i<a.length && j<b.length) {
      if(a[i]===b[j]) {i++;j++;continue;}
      if(++edits>1) return false;
      if(a.length>=b.length)i++;
      if(b.length>=a.length)j++;
    }
    return edits+(i<a.length || j<b.length ? 1 : 0)<=1;
  }
  function questionWords(key) {
    const core=key.replace(/^(?:你好|小程|请问|请|我想了解一下|我想了解|想了解|我想知道|想知道|告诉我|介绍一下|能不能介绍一下|你能介绍一下|你的|你|嘉程的|马嘉程的)+/,'')
      .replace(/(?:是什么|有哪些|有什么|怎么样|如何|吗|呢|呀|啊|一下|介绍一下|[？?！!。\s])+$/,'');
    return [...new Set([core,...(key.match(/[a-z]+(?:-[a-z]+)?|[\u3400-\u9fff]+/g)||[])])];
  }
  function wordMatch(key,term) {
    if (/^[a-z-]+$/.test(term)) return new RegExp('(?:^|[^a-z])'+term+'(?:$|[^a-z])').test(key);
    return key.includes(term);
  }
  function matchTopics(key) {
    const words=questionWords(key);
    const rejected=[];
    const selected=topics.filter(topic=>{
      const terms=vocabulary[topic.id] || [];
      const exact=topic.test.test(key) || terms.some(term=>wordMatch(key,term)) || (topic.id==='events' && words[0]==='策划');
      const fuzzy=!exact && words.some(word=>terms.some(term=>term.length>=(/^[a-z-]+$/.test(term)?5:4) && oneEditApart(word,term)));
      if(!exact && !fuzzy)return false;
      // Only a clause-local, explicit refusal suppresses a topic. Other words,
      // such as “不太了解学历”, are not negative search filters.
      const clauses=key.split(/[，,。；;！!？?]|(?:只看|只想看|改看|而是)/);
      const refusal=clauses.some(clause=>{
        const scope=clause.trim().split(/还有|以外|之外/)[0];
        return /^(?:我)?(?:不要|不看|排除|不用|别看|不是|除了)/.test(scope) && (topic.test.test(scope) || terms.some(term=>wordMatch(scope,term)));
      });
      if(refusal){rejected.push(topic.id);return false;}
      return true;
    });
    return {selected,rejected};
  }
  const overviewTest = /(?:30|三十)\s*秒|认识嘉程|了解嘉程|介绍(?:一下)?(?:马)?嘉程|自我介绍|你是谁|嘉程是谁|关于(?:你|嘉程)|\b(?:overview|introduce yourself|about you)\b/;
  const contextualTest = /^(?:那|那么|这个|这段|它|他|还有|再|具体|详细|能否|可以)|(?:呢|怎么样|多少|成果|结果|行动|流程|费用|成本|时间|多久|什么时候|怎么做|如何做|收获|职责|分工|交付)[？?！!。\s]*$/;
  const excludedTest = /身份证|家庭住址|家庭地址|银行卡|密码|薪资|薪酬|工资|期望薪|天气|量子|火星|明天.*(?:下雨|温度)|\b(?:weather|password|salary)\b/;
  const creationTest = /(?:请|帮我|为我)(?:写|生成|编写|创作|制定|翻译|计算|算一下)|^(?:写一|写个|写份|生成一|编写一|创作一|制定一|翻译成|计算|算一下)|(?:数学题|方程|微积分|编程题)/;
  const safeRecord = r => r && typeof r.title === 'string' && typeof r.text === 'string' && typeof r.url === 'string'
    && r.text.trim() && /^(?:index\.html|experience\/|projects\/|contact\/|honor\/|poster\/|updates\/)/.test(r.url)
    && !/[<>\\]|\.\./.test(r.url);
  const unique = list => list.filter((item, i, all) => all.findIndex(other => other.text === item.text && other.url === item.url) === i);
  function excerpt(text, limit = 330) {
    const clean = text.trim().replace(/\n{3,}/g, '\n\n');
    if (clean.length <= limit) return clean;
    const segment = clean.slice(0, limit);
    const end = Math.max(segment.lastIndexOf('。'), segment.lastIndexOf('；'), segment.lastIndexOf('\n\n'));
    return end > limit / 3 ? segment.slice(0, end + 1).trim() : segment.trim() + '…';
  }
  function select(topic, records, query) {
    const key = normalize(query);
    const focusActions = /行动|怎么做|如何做|流程|职责|分工/.test(key);
    const focusResults = /成果|结果|成效|收获/.test(key);
    return records.filter(r => topic.path.test(r.url) || r.section === topic.section).map(r => {
      let score = 0;
      if (topic.id === 'education') {
        const priorDegree=/专科|大专/.test(key) && !/本科|最高|学历/.test(key);
        score += /本科/.test(r.text) ? (priorDegree?70:90) : /专科/.test(r.text) ? (priorDegree?100:70) : 0;
      }
      if (topic.id === 'career') score += /希望面向/.test(r.text) ? 50 : 0;
      if (topic.id === 'tools') score += /Excel|Word|PowerPoint|ChatGPT|Codex|Canva|Seedance|Seedream/.test(r.text) ? 40 : 0;
      if (topic.id === 'ecommerce') score += /288.*1,?000|累计去重学员/.test(r.text) ? 65 : 0;
      if (focusActions && /我的行动|我做了什么|目标与职责|如何|分工/.test(r.title)) score += /我的行动|我做了什么/.test(r.title)?140:110;
      if (focusResults && /交付与结果|成果|结果/.test(r.title)) score += 140;
      if (topic.id === 'projects') score += /交付与结果|成果|交付|项目/.test(r.title) ? 35 : 0;
      if (topic.id === 'contact') score += /邮箱|手机|@|198700/.test(r.text) ? 50 : 0;
      score += Math.min(20, (r.text.match(/[0-9]/g) || []).length);
      return {r,score};
    }).sort((a,b) => b.score - a.score).map(item => item.r);
  }
  function topicFacts(topic, sources) {
    const facts = [];
    if (topic.id === 'education') {
      for (const source of sources.filter(r => /本科|专科/.test(r.text)).slice(0,2)) {
        facts.push({label:source.title.split(' · ').pop(), value:source.text});
      }
    }
    if (topic.id === 'ecommerce') {
      const text = sources.map(r => r.text).join('\n');
      const fee = text.match(/\d[\d,，]*(?:\.\d+)?\s*元\s*[/／]\s*人/);
      const students = text.match(/(?:(?:约|近)\s*)?\d[\d,，]*\s*人(?=\s*[·•|]\s*累计去重学员)/)
        || text.match(/约\s*1[，,]?000\s*人/);
      const partners = text.match(/(?:约\s*)?\d+\s*[–—-]\s*\d+\s*(?:人|名)(?=\s*[·•|]\s*推广合作伙伴)/)
        || text.match(/(?:约\s*)?\d+\s*[–—-]\s*\d+\s*(?:人|名)(?=[^。\n]{0,25}推广伙伴)/);
      if (fee) facts.push({label:'教学服务学费', value:fee[0]});
      if (students) facts.push({label:'累计去重学员', value:students[0]});
      if (partners) facts.push({label:'推广合作伙伴', value:partners[0]});
    }
    if (topic.id === 'contact') {
      const text = sources.map(r => r.text).join('\n');
      const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      const phone = text.match(/(?:手机|电话|手机号|手机号码)[：:\s]*([1][3-9]\d{9})\b/);
      if (email) facts.push({label:'邮箱',value:email[0]});
      if (phone) facts.push({label:'手机',value:phone[1]});
    }
    return facts;
  }
  function answer(query, sourceRecords, context = {}) {
    if (typeof query !== 'string' || !Array.isArray(sourceRecords)) return null;
    const original = query.trim().slice(0,140);
    if (!original || /[<>]|javascript:|\bonerror\s*=/i.test(original)) return null;
    const key = normalize(original);
    if (excludedTest.test(key) || creationTest.test(key)) return null;
    const records = unique(sourceRecords.filter(safeRecord));
    if (!records.length) return null;
    // School tuition and personal salary cannot be inferred from the separate
    // commerce teaching fee; do not blend these unrelated meanings of tuition.
    if (/(?:学校|大学|本科|专科|院校).*(?:学费|费用|收费)|(?:学费|费用|收费).*(?:学校|大学|本科|专科|院校)/.test(key)) return null;
    const overview = overviewTest.test(key);
    let {selected} = matchTopics(key);
    if(selected.some(topic=>['printing','business'].includes(topic.id))&&!/电商|教学|课程|学员|288/.test(key))selected=selected.filter(topic=>topic.id!=='ecommerce');
    const previous = topics.find(topic => topic.id === context?.topic);
    // Named new subjects win; generic outcome/process questions stay with the
    // concrete project the visitor was already reading. A bare "项目" does not
    // erase the previous game/commerce subject in a follow-up.
    const concrete = selected.filter(topic => topic.id !== 'projects');
    const genericDetail = /行动|成果|结果|成效|收获|流程|职责|分工|交付|怎么做|如何/.test(key);
    const keepProject = previous && ['ecommerce','printing','business','ai','game','livestream','store','events'].includes(previous.id)
      && !concrete.length && genericDetail && !/全部|所有|其他|各个|整体/.test(key);
    const contextual = Boolean(previous && (contextualTest.test(key) || keepProject));
    if (contextual && !overview && !concrete.length && (!selected.length || keepProject)) selected = [previous];
    if (/费用|成本/.test(key) && !/电商|课程|教学|学费|打印|彩印/.test(key) && !['ecommerce','printing'].includes(previous?.id)) return null;
    if (overview) selected = ['education','career','ecommerce','game'].map(id=>topics.find(topic=>topic.id===id));
    if (!selected.length) return null;
    // Generic "project results" should not drown a specifically named project.
    if (selected.length > 1 && selected.some(topic => ['ecommerce','printing','business','ai','game','livestream','store','events'].includes(topic.id))) {
      selected = selected.filter(topic => topic.id !== 'projects');
    }
    selected = selected.slice(0,4);
    const sources = [], paragraphs = [], facts = [];
    const isProfit = /净?利润|赚(?:了)?(?:多少|多[少久]?钱)|挣(?:了)?(?:多少|多[少久]?钱)|总收入|总收益|盈利多少/.test(key);
    const isResults = /成果|结果|成效/.test(key);
    for (const topic of selected) {
      let chosen = select(topic, records, original);
      if (topic.id === 'projects' && isResults) chosen = chosen.filter(r => /交付与结果|成果|结果|288/.test(r.title + r.text)).concat(chosen.filter(r => !/交付与结果|成果|结果|288/.test(r.title + r.text)));
      const count = overview ? 1 : selected.length > 1 ? 2 : topic.id === 'education' ? 2 : topic.id === 'career' || topic.id === 'tools' ? 4 : 3;
      chosen = unique(chosen).slice(0,count);
      if (!chosen.length) continue;
      sources.push(...chosen);
      let detailFacts=topicFacts(topic,chosen);
      let factOnly=false;
      if(!overview && topic.id==='contact' && detailFacts.length){
        const emailOnly=/邮箱|邮件|\bemail\b/.test(key) && !/手机|电话|联系|contact|简历|resume|\bcv\b/.test(key);
        const phoneOnly=/手机|电话|手机号/.test(key) && !/邮箱|邮件|联系|contact|简历|resume|\bcv\b/.test(key);
        if(emailOnly)detailFacts=detailFacts.filter(fact=>fact.label==='邮箱');
        if(phoneOnly)detailFacts=detailFacts.filter(fact=>fact.label==='手机');
        factOnly=true;
      }
      if(!overview && topic.id==='ecommerce' && !isProfit && !genericDetail && !isResults){
        const feeOnly=/288|学费|收费|费用|培训费|tuition/.test(key);
        const learnersOnly=/(?:学员|学生).*(?:多少|人数|规模)|(?:多少|几)(?:名|个|位)?(?:学员|学生)|学员数|累计去重/.test(key);
        const partnersOnly=/(?:推广|合作)(?:伙伴|人数)|伙伴.*(?:多少|人数|规模)/.test(key);
        const wanted=feeOnly?'教学服务学费':learnersOnly?'累计去重学员':partnersOnly?'推广合作伙伴':null;
        if(wanted && detailFacts.some(fact=>fact.label===wanted)){
          detailFacts=detailFacts.filter(fact=>fact.label===wanted);factOnly=true;
        }
      }
      facts.push(...detailFacts);
      if(factOnly)continue;
      for (const source of chosen.slice(0,overview ? 1 : selected.length > 1 ? 1 : topic.id === 'education' ? 2 : 3)) {
        if(!overview && topic.id==='ecommerce' && detailFacts.length && /教学服务学费|累计去重学员/.test(source.text))continue;
        const passage = topic.id === 'education' ? `${source.title.split(' · ').pop()}：${source.text}` : excerpt(source.text,overview ? 220 : 350);
        const display = overview ? `${topic.title}：${passage}` : passage;
        if (!paragraphs.includes(display)) paragraphs.push(display);
      }
    }
    if (!sources.length || (!paragraphs.length && !facts.length)) return null;
    if (isProfit && selected.some(topic=>topic.id === 'ecommerce')) {
      const netSource=records.find(record=>/#ecommerce$/.test(record.url)&&(/该项目累计净利润\s*\d/.test(record.text)||/万\s*元(?:以上|\+)?\s*[·•|]\s*该项目累计净利润/.test(record.text)));
      const reported=netSource?.text.match(/该项目累计净利润\s*(\d+(?:\.\d+)?\s*万\s*元(?:以上|\+)?)/)?.[1]
        || netSource?.text.match(/(\d+(?:\.\d+)?\s*万\s*元(?:以上|\+)?)\s*[·•|]\s*该项目累计净利润/)?.[1];
      const perPerson=/一个人|每人|单人|单个|每(?:个|位|名)(?:人|学员)|一位|一名/.test(key);
      if(selected.length===1){paragraphs.length=0;if(reported&&!perPerson)facts.length=0;}
      if(reported&&!perPerson){
        facts.push({label:'电商项目累计净利润',value:reported});
        if(!sources.includes(netSource))sources.unshift(netSource);
      }else paragraphs.unshift('原文未提供足以核算净利润的成本与分成明细，学费和学员规模不能直接等同于净利润。');
    }
    const active = selected.filter(topic=>sources.some(r=>topic.path.test(r.url)||r.section===topic.section));
    if (!active.length) return null;
    const followups = [];
    const resolvedQuery = contextual && active.length === 1 ? `${active[0].title} ${original}` : original;
    return {
      query:original,
      resolvedQuery,
      title:overview ? '30 秒认识嘉程' : active.map(topic=>topic.title).join(' · '),
      paragraphs:paragraphs.slice(0,6),
      facts:facts.filter((fact,i,all)=>all.findIndex(other=>other.label===fact.label&&other.value===fact.value)===i).slice(0,6),
      sources:unique(sources).slice(0,8),
      followups,
      topic:overview ? 'overview' : active[0].id
    };
  }
  function search(query, sourceRecords, options = {}) {
    if(typeof query!=='string' || !Array.isArray(sourceRecords))return [];
    const original=query.trim().slice(0,140);
    if(!original || /[<>]|javascript:|\bonerror\s*=/i.test(original))return [];
    const key=normalize(original);
    if(excludedTest.test(key) || creationTest.test(key))return [];
    if(/(?:学校|大学|本科|专科|院校).*(?:学费|费用|收费)|(?:学费|费用|收费).*(?:学校|大学|本科|专科|院校)/.test(key))return [];
    const records=unique(sourceRecords.filter(safeRecord));
    const {selected,rejected}=matchTopics(key);
    const specific=selected.filter(topic=>topic.id!=='projects');
    const matched=specific.length?specific:selected;
    const number=Number(options?.limit);
    const limit=Number.isFinite(number)?Math.max(1,Math.min(8,Math.floor(number))):4;
    if(matched.length) {
      // Round-robin prevents one subject from hiding the other half of a
      // compound request (for example “学历和联系方式”).
      const buckets=matched.map(topic=>select(topic,records,original));
      const found=[];
      for(let i=0;found.length<limit && buckets.some(bucket=>bucket[i]);i++) {
        for(const bucket of buckets) {
          const record=bucket[i];
          if(record && !found.some(other=>other.text===record.text && other.url===record.url))found.push(record);
          if(found.length===limit)break;
        }
      }
      return found;
    }
    if(rejected.length)return [];
    // Unrecognised titles and exact product names remain searchable. Require
    // meaningful whole terms; isolated coincidental Chinese bigrams do not count.
    const terms=questionWords(key).filter(term=>term.length>=2 && !/^(?:什么|怎么|如何|多少|在哪里|有没有|可以|帮我|谢谢)$/.test(term));
    return records.map((record,index)=>{
      const title=normalize(record.title),body=normalize(record.text),keywords=normalize(record.keywords);
      let score=0;
      for(const term of terms){
        if(wordMatch(title,term))score+=30+term.length;
        if(wordMatch(body,term))score+=10+term.length;
        if(wordMatch(keywords,term))score+=5;
      }
      return {record,index,score};
    }).filter(item=>item.score>=10).sort((a,b)=>b.score-a.score || a.index-b.index).slice(0,limit).map(item=>item.record);
  }
  window.XiaoChengBrain = Object.freeze({answer,search});
})();
