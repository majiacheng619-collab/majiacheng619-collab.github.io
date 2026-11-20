/* Grounded-answer regression tests against the actual publication archive. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const folder=__dirname;
const fixture=JSON.parse(execFileSync('python3',['-c',`import json,sys,tempfile,zipfile;sys.path.insert(0,${JSON.stringify(folder)});from sprite_content import build
with tempfile.TemporaryDirectory() as root:
 with zipfile.ZipFile(${JSON.stringify(path.join(folder,'../deploy.zip'))}) as archive:
  archive.extractall(root)
  print(json.dumps({'records':build(root),'paths':archive.namelist()}))`],{encoding:'utf8'}));
const records=fixture.records;
const sandbox=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(folder,'sprite-brain.js'),'utf8'),sandbox);
const brain=sandbox.window.XiaoChengBrain;
const textOf=answer=>[answer.title,...answer.paragraphs,...answer.facts.flatMap(fact=>[fact.label,fact.value])].join('\n');
function grounded(answer,sourceRecords=records){
 assert.ok(answer && typeof answer==='object');
 assert.ok(typeof answer.query==='string');
 assert.ok(typeof answer.resolvedQuery==='string');
 assert.ok(typeof answer.title==='string' && answer.title);
 assert.ok(Array.isArray(answer.paragraphs) && answer.paragraphs.every(x=>typeof x==='string'));
 assert.ok(Array.isArray(answer.facts) && answer.facts.every(x=>typeof x.label==='string' && typeof x.value==='string'));
 assert.ok(Array.isArray(answer.followups) && answer.followups.every(x=>typeof x==='string'));
 assert.ok(Array.isArray(answer.sources) && answer.sources.length>0);
 for(const source of answer.sources){
  assert.ok(sourceRecords.some(record=>record.url===source.url && record.text===source.text && record.title===source.title),'Every cited passage must exist in the release');
  assert.ok(fixture.paths.includes(source.url.split('#')[0]));
  assert.ok(!/^(?:https?:|javascript:|data:|\/\/)/i.test(source.url));
 }
 return answer;
}

test('answer module loads as a pure engine without DOM, storage, timers, or network',()=>{
 assert.equal(typeof brain.answer,'function');
 assert.equal('document' in sandbox,false);
 assert.equal('localStorage' in sandbox,false);
 assert.equal('fetch' in sandbox,false);
 assert.equal('setTimeout' in sandbox,false);
});

test('education answers preserve current undergraduate status and expected graduation',()=>{
 for(const query of ['学历','什么学历','什么时候毕业','education']){
  const answer=grounded(brain.answer(query,records));
  assert.match(textOf(answer),/本科/);
  assert.match(textOf(answer),/在读/);
  assert.match(textOf(answer),/2027/);
  assert.match(textOf(answer),/预计/);
  assert.ok(answer.sources[0].text.includes('本科在读'),'Current degree should be cited first');
  assert.doesNotMatch(textOf(answer),/已(?:经)?(?:本科)?毕业|本科毕业生/);
 }
});

test('one question can combine career direction and tools with evidence for both',()=>{
 const answer=grounded(brain.answer('适合什么岗位，会用哪些工具？',records));
 const citations=answer.sources.map(record=>record.url).join(' ');
 assert.match(citations,/#roles/);
 assert.match(citations,/#skills/);
 assert.match(textOf(answer),/运营|商务|项目/);
 assert.match(textOf(answer),/Excel|Codex|ChatGPT|Word|Canva/);
});

test('a thirty-second introduction gives a grounded overview rather than an empty list',()=>{
 const answer=grounded(brain.answer('30秒了解嘉程',records));
 assert.match(textOf(answer),/嘉程|2027|本科/);
 assert.ok(answer.paragraphs.length>0);
 assert.ok(new Set(answer.sources.map(record=>record.section)).size>=2,'Overview should cite different aspects of the portfolio');
});

test('contact answers cite the actual contact destination without inventing contact details',()=>{
 const answer=grounded(brain.answer('怎么联系嘉程',records));
 assert.ok(answer.sources.some(record=>record.url==='contact/index.html'));
 const phones=textOf(answer).match(/1[3-9]\d{9}/g)||[];
 for(const phone of phones)assert.ok(records.some(record=>record.text.includes(phone)),phone);
 assert.ok(answer.facts.some(fact=>fact.label==='邮箱'));
 assert.ok(answer.facts.some(fact=>fact.label==='手机'));
 const emails=textOf(answer).match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g)||[];
 for(const email of emails)assert.ok(records.some(record=>(record.text+' '+record.title).includes(email)),email);
});

test('a follow-up can resolve through the preceding education or commerce topic',()=>{
 const education=grounded(brain.answer('学历',records));
 const graduation=grounded(brain.answer('那什么时候毕业',records,education));
 assert.match(textOf(graduation),/2027/);
 assert.ok(graduation.sources.some(record=>record.url.endsWith('#education')));
 const commerce=grounded(brain.answer('电商教学',records));
 const fees=grounded(brain.answer('费用呢',records,commerce));
 assert.match(textOf(fees),/288/);
 assert.ok(fees.sources.some(record=>record.url.endsWith('#ecommerce')));
});

test('tuition and learners alone cannot establish a total or personal profit',()=>{
 const undisclosed=[{title:'电商教学',text:'288 元/人 · 教学服务学费 · 近 1,000 人 · 累计去重学员',url:'experience/index.html#ecommerce',section:'电商教学'}];
 const answer=grounded(brain.answer('电商教学一共盈利多少，净利润是多少？',undisclosed),undisclosed);
 const text=textOf(answer);
 assert.doesNotMatch(text,/288[,.]?000|28[.]?8\s*万|净利润(?:为|是|达到)\s*\d/);
 assert.match(text,/未提供足以核算净利润/,'Tuition alone cannot establish profit');
});

test('unsupported, empty, and malicious questions cannot produce fabricated answers',()=>{
 for(const query of ['', '   ','明天天气怎么样','火星移民要多少钱','zzzzzzzz','<script>alert(919191)</script>','<img src=x onerror=alert(919191)>']){
  assert.equal(brain.answer(query,records),null,query);
 }
 for(const query of ['学历','电商教学','30秒了解嘉程'])assert.equal(brain.answer(query,[]),null,query);
});

test('answering does not mutate records or the previous answer',()=>{
 const before=JSON.stringify(records);
 const prior=grounded(brain.answer('学历',records));
 const priorBefore=JSON.stringify(prior);
 const first=brain.answer('那什么时候毕业',records,prior);
 const second=brain.answer('那什么时候毕业',records,prior);
 assert.equal(JSON.stringify(first),JSON.stringify(second));
 assert.equal(JSON.stringify(prior),priorBefore);
 assert.equal(JSON.stringify(records),before);
});


test('generic result and delivery follow-ups preserve a concrete project subject',()=>{
 for(const [first,followup,topic] of [
  ['电商教学','有哪些实际成果？','ecommerce'],
  ['电商教学','具体做了哪些行动？','ecommerce'],
  ['萌芽保卫队','项目是如何交付的？','game'],
  ['直播运营','有哪些实际成果？','livestream'],
 ]){
  const prior=grounded(brain.answer(first,records));
  const answer=grounded(brain.answer(followup,records,prior));
  assert.equal(answer.topic,topic,first+' → '+followup);
  assert.ok(answer.sources.every(source=>topic==='game' ? /projects\/sprout-patrol\/|#digital-work$/.test(source.url) : source.section===prior.sources[0].section),first);
 }
});

test('an explicit new degree subject wins over commerce context',()=>{
 const prior=grounded(brain.answer('电商教学',records));
 const answer=grounded(brain.answer('那本科呢',records,prior));
 assert.equal(answer.topic,'education');assert.match(textOf(answer),/本科在读/);
 const fee=grounded(brain.answer('那费用呢',records,prior));
 assert.equal(fee.topic,'ecommerce');assert.match(textOf(fee),/288/);
 assert.equal(brain.answer('那学校费用呢',records,prior),null);
});

test('role questions and per-person earning questions do not fabricate suitability or profit',()=>{
 const career=grounded(brain.answer('能做产品运营吗',records));
 assert.equal(career.topic,'career');assert.match(textOf(career),/运营/);
 for(const query of ['288元一个人能赚多少钱','288元一个人能挣多少钱']){
  const answer=grounded(brain.answer(query,records));
  assert.match(textOf(answer),/不能直接等同于净利润|未提供足以核算净利润/);
 }
});

test('the concise overview includes distinct digital product evidence',()=>{
 const answer=grounded(brain.answer('30秒了解嘉程',records));
 assert.ok(answer.sources.some(source=>source.url.startsWith('projects/sprout-patrol/')||source.url.endsWith('#digital-work')));
 assert.match(answer.paragraphs.join('\n'),/萌芽保卫队|数字产品/);
 assert.equal(answer.paragraphs.length,4);
});

test('natural wording, traditional text, and bounded misspellings resolve the same published sections',()=>{
 for(const [queries,topic,route] of [
  [['最高文凭','你在哪上过学','大专','學歷','请问教肓经历是什么？','what is your educaton?','educatoin','shcool'],'education',/#education$/],
  [['聯絡方式','邮件地址','联系方试','contcat','emial'],'contact',/^contact\//],
  [['电子商务','电孑商务','用户增长','培训费','ecommmerce'],'ecommerce',/#ecommerce$/],
  [['萌牙保卫队','数字产品','网站开发'],'game',/projects\/sprout-patrol\/|#digital-work$/],
  [['职业规划','就业方向','求职意向'],'career',/#roles$/],
  [['技术栈','办公软件','熟悉什么'],'tools',/#skills$/],
 ]) for(const query of queries){
  const answer=grounded(brain.answer(query,records));
  assert.equal(answer.topic,topic,query);
  const hits=brain.search(query,records,{limit:4});
  assert.ok(hits.length>0 && hits.every(hit=>route.test(hit.url)),query);
 }
});

test('search preserves both sides of compound questions and limits the result list',()=>{
 for(const query of ['学历和联系方式','联系方式，以及什么学历','电商有哪些成果，会用哪些软件？']){
  const hits=brain.search(query,records,{limit:2});
  assert.equal(hits.length,2,query);
  assert.ok(hits.every(hit=>records.includes(hit)),'Hits must be original source records');
  const paths=hits.map(hit=>hit.url).join(' ');
  if(query.includes('学历')) {assert.match(paths,/#education/);assert.match(paths,/contact\//);}
  else {assert.match(paths,/#ecommerce/);assert.match(paths,/#skills/);}
 }
 assert.ok(brain.search('电商',records,{limit:100}).length<=8);
 assert.equal(brain.search('电商',records,{limit:1}).length,1);
});

test('explicit exclusion removes a subject without turning a negative query into a recommendation',()=>{
 for(const query of ['不要游戏，只看电商','不看萌芽保卫队，想了解电商教学']){
  const answer=grounded(brain.answer(query,records));
  assert.equal(answer.topic,'ecommerce');
  assert.ok(answer.sources.every(source=>source.url.endsWith('#ecommerce')));
  assert.ok(brain.search(query,records).every(source=>source.url.endsWith('#ecommerce')));
 }
 assert.equal(brain.answer('不要游戏',records),null);
 assert.equal(brain.search('不要游戏',records).length,0);
 assert.equal(grounded(brain.answer('不太了解学历',records)).topic,'education');
});

test('a specific result or action request ranks the evidence it asks for',()=>{
 const outcomes=brain.search('电商成果',records,{limit:1});
 const actions=brain.search('电商具体做了哪些行动',records,{limit:1});
 assert.match(outcomes[0].title,/交付与结果|成果|结果/);
 assert.match(actions[0].title,/我的行动|我做了什么|目标与职责|如何|分工/);
 const priorDegree=grounded(brain.answer('大专',records));
 assert.match(priorDegree.sources[0].text,/专科/);
 const currentDegree=grounded(brain.answer('最高学历',records));
 assert.match(currentDegree.sources[0].text,/本科在读/);
});

test('exact portfolio titles work without vocabulary and English substrings do not become intents',()=>{
 const titled=[{title:'星河观察计划',text:'一次观察记录。',url:'projects/index.html',section:'作品与项目'}];
 assert.equal(brain.search('星河观察计划',titled)[0],titled[0]);
 for(const query of ['gameplay','schoolingzz','salary','微积分的大学数学题','请帮我写一份电商运营方案','帮我计算电商利润','外星生物研究计划']){
  assert.equal(brain.answer(query,records),null,query);
  assert.equal(brain.search(query,records).length,0,query);
 }
});

test('search handles invalid input safely, never mutates source data, and offers no shortcut buttons',()=>{
 const before=JSON.stringify(records);
 for(const query of [null,17,{},'<script>电商</script>','javascript:学历',''])assert.equal(brain.search(query,records).length,0);
 assert.equal(brain.search('学历',null).length,0);
 assert.ok(brain.search('学历',records,null).length>0);
 assert.equal(JSON.stringify(records),before);
 assert.equal(grounded(brain.answer('学历',records)).followups.length,0);
});

test('Chinese-only spacing, generic planning, and exceptions keep their intended sections',()=>{
 for(const query of ['学 历','學 歷','请问 学 历 是什么？']){
  assert.equal(grounded(brain.answer(query,records)).topic,'education',query);
  assert.match(brain.search(query,records)[0].url,/#education$/,query);
 }
 assert.match(brain.search('策划',records)[0].url,/#field$/);
 assert.equal(grounded(brain.answer('直播策划',records)).topic,'livestream');
 assert.equal(grounded(brain.answer('除了游戏还有什么项目',records)).topic,'projects');
 assert.equal(grounded(brain.answer('不是学历，是联系方式',records)).topic,'contact');
 for(const query of ['sword','toolsmith','wordsmith']){
  assert.equal(brain.answer(query,records),null,query);
  assert.equal(brain.search(query,records).length,0,query);
 }
});

test('specific published fields answer directly while full source passages remain available',()=>{
 for(const query of ['288','学费','电商收费是多少','课程费用']){
  const answer=grounded(brain.answer(query,records));
  assert.equal(answer.paragraphs.length,0,query);
  assert.equal(answer.facts.length,1,query);
  assert.equal(answer.facts[0].label,'教学服务学费');
  assert.match(answer.facts[0].value,/288\s*元\s*\/\s*人/);
  assert.ok(answer.sources.length>0);
 }
 const contact=grounded(brain.answer('联系方式',records));
 assert.equal(contact.paragraphs.length,0);
 assert.deepEqual(Array.from(contact.facts,fact=>fact.label),['邮箱','手机']);
 const email=grounded(brain.answer('邮箱',records));
 assert.deepEqual(Array.from(email.facts,fact=>fact.label),['邮箱']);
 const phone=grounded(brain.answer('手机号',records));
 assert.deepEqual(Array.from(phone.facts,fact=>fact.label),['手机']);
 assert.equal(brain.answer('学校学费',records),null);
});

test('commerce extracts each exact labeled metric without duplicating the data paragraph',()=>{
 const answer=grounded(brain.answer('电商教学',records));
 const facts=new Map(answer.facts.map(fact=>[fact.label,fact.value]));
 assert.match(facts.get('教学服务学费'),/288/);
 assert.match(facts.get('累计去重学员'),/(?:约|近)\s*1,?000\s*人/);
 assert.match(facts.get('推广合作伙伴'),/40\s*[–—-]\s*50\s*(?:人|名)/);
 assert.ok(answer.paragraphs.every(text=>!text.includes('累计去重学员')));
 const profit=grounded(brain.answer('288元一个人盈利多少',records));
 assert.equal(profit.paragraphs.length,1);
 assert.match(profit.paragraphs[0],/未提供足以核算净利润/);
 const changed=[{title:'电商教学',text:'380 元／人 · 教学服务学费 · 约 2,000 人 · 累计去重学员 · 60–70 人 · 推广合作伙伴',url:'experience/index.html#ecommerce',section:'电商教学'}];
 const metrics=brain.answer('电商教学',changed);
 assert.deepEqual(Array.from(metrics.facts,f=>f.value),['380 元／人','约 2,000 人','60–70 人']);
 const unrelated=[{title:'电商教学',text:'服务尚在准备。',url:'experience/index.html#ecommerce',section:'电商教学'}];
 assert.equal(brain.answer('电商教学',unrelated).facts.length,0);
});

test('a phone-shaped email address never replaces an explicitly labeled contact phone',()=>{
 const custom=[{title:'联系',text:'邮箱：13912345678@example.com\n手机：13887654321',url:'contact/index.html',section:'联系与合作'}];
 const answer=brain.answer('联系方式',custom);
 assert.equal(answer.facts.find(fact=>fact.label==='手机').value,'13887654321');
 assert.equal(answer.facts.find(fact=>fact.label==='邮箱').value,'13912345678@example.com');
 const emailOnly=[{title:'联系',text:'邮箱：13912345678@example.com',url:'contact/index.html',section:'联系与合作'}];
 assert.ok(!brain.answer('联系方式',emailOnly).facts.some(fact=>fact.label==='手机'));
});

test('a published project profit is reported, while a per-person profit stays uncomputed',()=>{
 const updated=[...records,{title:'电商项目结果',text:'该项目累计净利润 40 万元以上。累计服务近 1,000 名学员。',url:'experience/index.html#ecommerce',section:'电商教学'}];
 const total=grounded(brain.answer('电商累计净利润是多少',updated),updated);
 assert.match(textOf(total),/40\s*万元以上/);
 assert.doesNotMatch(textOf(total),/未提供足以核算净利润/);
 const perPerson=grounded(brain.answer('288元一个人净利润是多少',updated),updated);
 assert.match(textOf(perPerson),/不能直接等同于净利润/);
 assert.doesNotMatch(textOf(perPerson),/115[.]2|净利润(?:是|为)40/);
});

test('campus printing queries and follow-ups cite the printing project',()=>{
 const updated=[...records,{title:'宿舍打印店创业',text:'黑白打印 0.2 元，彩印 0.4 元，送货上门，1 份起送。半年多验证可盈利后交由同学接手并获得分红，单日最高收益数百元。',url:'experience/index.html#printing',section:'校园打印创业'}];
 for(const query of ['宿舍打印店','校园创业','打印收费多少']){
  const result=grounded(brain.answer(query,updated),updated);
  assert.equal(result.topic,'printing');
  assert.ok(result.sources.every(source=>source.url.endsWith('#printing')));
  assert.match(textOf(result),/0[.]2/);
 }
 const first=brain.answer('宿舍打印店',updated);
 const followup=grounded(brain.answer('具体做了哪些行动',updated,first),updated);
 assert.equal(followup.topic,'printing');
});
