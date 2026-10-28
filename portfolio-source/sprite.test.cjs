/* Test search ranking against the real published copy; no network or browser needed. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const folder=__dirname;
const fixture=JSON.parse(execFileSync('python3',['-c',`import json,sys,tempfile,zipfile;sys.path.insert(0,${JSON.stringify(folder)});from sprite_content import build
with tempfile.TemporaryDirectory() as root:
 with zipfile.ZipFile(${JSON.stringify(path.join(folder,'../deploy.zip'))}) as archive:
  archive.extractall(root)
  print(json.dumps({'records':build(root),'paths':archive.namelist()}))`],{encoding:'utf8'}));
const records=fixture.records;
const source=fs.readFileSync(path.join(folder,'sprite.js'),'utf8');
const context=vm.createContext({window:{},records});
vm.runInContext(fs.readFileSync(path.join(folder,'sprite-brain.js'),'utf8'),context);
vm.runInContext('this.search=query=>window.XiaoChengBrain.search(query,records,{limit:8});',context);
test('real tuition and expanded passage keep their project and source anchor',()=>{
  const found=context.search('288');assert.ok(found.length>0);assert.ok(found[0].text.includes('288'));
  assert.match(found[0].title,/电商/);assert.equal(found[0].url,'experience/index.html#ecommerce');
});
test('Chinese questions and aliases find actual site topics',()=>{
  assert.ok(context.search('有什么求职方向').some(x=>/岗位|求职/.test(x.text+x.title)));
  assert.ok(context.search('AI 影像').some(x=>x.url.startsWith('projects/ai-content')));
  assert.ok(context.search('联系方式').some(x=>x.url.startsWith('contact/')));
  assert.ok(context.search('学费').some(x=>x.text.includes('288')));
});
test('empty and unknown queries return no invented answers',()=>{
  assert.equal(context.search('  ').length,0);assert.equal(context.search('zzzzzzzz不存在').length,0);
  assert.equal(context.search('<script>alert(919191)</script>').length,0);
});
test('every result comes from the same release and has a local safe URL',()=>{
  assert.ok(records.length>0);for(const anchor of ['education','roles','skills','ecommerce','livestream','store','field','ai-work','digital-work'])assert.ok(records.some(record=>record.url==='experience/index.html#'+anchor),'Missing published section: '+anchor);for(const record of records){assert.ok(record.text);assert.ok(record.title);assert.ok(!/^(https?:|javascript:|\/\/)/.test(record.url));assert.ok(fixture.paths.includes(record.url.split('#')[0]));}
});
test('education synonyms, questions, traditional characters and typo rank real degrees first',()=>{
  for(const query of ['学历','学校','毕业院校','教育背景','学 历','學歷','畢業院校','你是什么学历？','在哪里读书','学厉','教育经厉','educaton','DEGREE']) {
    const found=context.search(query);assert.ok(found.length,query);
    assert.equal(found[0].url,'experience/index.html#education',query);
    assert.match(found[0].text,/本科|专科/,query);
  }
});
test('related intents route to the corresponding published sections',()=>{
  for(const [query,url] of [['找工作','#roles'],['会哪些软件','#skills'],['直播间','#livestream'],['实体店','#store'],['策划','#field']]) {
    const found=context.search(query);assert.ok(found.length,query);assert.ok(found[0].url.endsWith(url),query+': '+found[0].url);
  }
  for(const query of ['天气预报','量子力学','火星移民','qwerty','18888888888']) {
    assert.equal(context.search(query).length,0,query);
  }
});


test('conversational searches lead to published answers without losing section routing',()=>{
  const cases=[
    ['想了解一下你的学历背景','#education'],
    ['学校在哪','#education'],
    ['读的什么专业','#education'],
    ['什么时候毕业','#education'],
    ['where did you study','#education'],
    ['how can I contact you','contact/'],
    ['Where can I reach you?', 'contact/'],
    ['How can I get in touch?', 'contact/'],
    ['educational background', '#education'],
    ['毕业年份', '#education'],
    ['何时毕业', '#education'],
    ['可以介绍一下毕业院校吗','#education'],
    ['你会用什么办公软件','#skills'],
    ['想知道你适合什么工作','#roles'],
    ['如何联系马嘉程','contact/'],
    ['这个电商课程的学费是多少','#ecommerce'],
    ['你的直播运营经历在哪里','#livestream'],
  ];
  for(const [query,target] of cases){
    const found=context.search(query);
    assert.ok(found.length,query);
    assert.ok(found[0].url.includes(target),query+': '+found[0].url);
    assert.ok(records.some(record=>record.url===found[0].url && record.text===found[0].text),query);
  }
});

test('compatibility forms and punctuation preserve the same education answer',()=>{
  const expected='experience/index.html#education';
  for(const query of ['ＤＥＧＲＥＥ','  degree  ','学历？！！','學 歷','education']) {
    assert.equal(context.search(query)[0]?.url,expected,query);
  }
});

test('ranking remains bounded, stable, deduplicated and read only',()=>{
  const before=JSON.stringify(records);
  for(const query of ['嘉程','学历','项目','288']) {
    const first=context.search(query);
    assert.ok(first.length<=8,query);
    assert.equal(new Set(first.map(record=>record.text)).size,first.length,query);
    assert.equal(JSON.stringify(first),JSON.stringify(context.search(query)),query);
  }
  assert.equal(JSON.stringify(records),before);
});

test('unrelated requests do not acquire answers from single shared characters',()=>{
  for(const query of ['查一下明天的天气预报','木星的卫星有几个','意大利面煮多久','zzzzzzzzzz','<svg onload=alert(919191)>']) {
    assert.equal(context.search(query).length,0,query);
  }
});

test('highlighting treats queries and source passages as text, including regex syntax',()=>{
  const makeElement=(tag='span')=>({tag,children:[],_text:'',
    set textContent(value){this._text=String(value);this.children=[];},
    get textContent(){return this._text+this.children.map(node=>node.textContent).join('');},
    append(node){this.children.push(node);}
  });
  const document={createElement:tag=>makeElement(tag),createTextNode:text=>({textContent:String(text)})};
  const marking=source.slice(source.indexOf('  function markText'),source.indexOf('  function snippet'));
  const sandbox=vm.createContext({document});
  vm.runInContext(marking+';this.markText=markText;',sandbox);
  for(const [text,query] of [
    ['<img src=x onerror=alert(1)>','<img'],
    ['C++ [学历] (本科) a.b','C++ [学历] (本科) a.b'],
    ['学历与学历背景','学历'],
    ['原文保持完整',''],
  ]) {
    const element=makeElement();
    assert.doesNotThrow(()=>sandbox.markText(element,text,query));
    assert.equal(element.textContent,text);
    assert.ok(element.children.every(node=>!node.tag || node.tag==='mark'));
  }
});
