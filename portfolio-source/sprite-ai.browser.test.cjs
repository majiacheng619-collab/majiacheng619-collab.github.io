/* Regression guard: Xiao Cheng searches without loading a model or AI service. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(process.argv[2]||'_site');
const server=http.createServer((req,res)=>{
 let file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let args=['--no-sandbox'];if(process.env.CHROME_HELPER){const {default:c}=await import(process.env.CHROME_HELPER);args=c.args;}const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args,headless:true});try{
 const p=await b.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),models=[];
 p.on('request',request=>{if(/webllm|huggingface|mlc-ai|sprite-ai-worker|sprite-local-ai|\.wasm|\.onnx/i.test(request.url()))models.push(request.url());});
 await p.goto(origin);await p.locator('.sprite-launcher').click();assert.equal(await p.locator('.sprite-local-ai,[data-ai-load],.local-ai-form').count(),0);
 for(const query of ['学历','那什么时候毕业？','学费是多少']){await p.locator('.sprite-form input').fill(query);await p.locator('.sprite-form input').press('Enter');await p.locator('.sprite-answer').waitFor();}
 assert.equal(await p.evaluate(()=>typeof window.XiaoChengLocalAI),'undefined');assert.deepEqual(models,[]);
 console.log('PASS: useful grounded local search without model downloads, AI controls or AI service requests.');
 }finally{await b.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
