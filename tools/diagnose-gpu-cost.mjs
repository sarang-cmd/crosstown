// Diagnostic instrumentation only; NEVER included in the shipped renderer or FPS.
// PERF_URL=http://127.0.0.1:4191 PERF_LABEL=before node tools/diagnose-gpu-cost.mjs
import {chromium} from '@playwright/test';import{mkdir,writeFile}from'node:fs/promises';
const folder='docs/evidence/crosstown-0.13.0';await mkdir(folder,{recursive:true});
const url=process.env.PERF_URL??'http://127.0.0.1:4191',label=process.env.PERF_LABEL??'before';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const errors=[];
const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(()=>{
 localStorage.setItem('crosstown:settings:v1',JSON.stringify({version:1,data:{quality:1,diagnostics:false}}));
 window.__glCost={calls:{},ms:{},slow:[],links:[],programs:0};const p=WebGL2RenderingContext.prototype;
 for(const name of['createProgram','linkProgram','getProgramParameter','getUniformBlockIndex','getActiveUniformBlockParameter','bufferData','bufferSubData','drawElementsInstanced','drawElements','drawArrays','getError']){
  const fn=p[name];if(!fn)continue;p[name]=function(...args){const t=performance.now(),v=fn.apply(this,args),d=performance.now()-t,c=window.__glCost;c.calls[name]=(c.calls[name]??0)+1;c.ms[name]=(c.ms[name]??0)+d;if(name==='createProgram')c.programs++;if(name==='linkProgram'&&c.links.length<4)c.links.push(Error().stack);if(d>8&&c.slow.length<80)c.slow.push({name,ms:d,param:name==='getProgramParameter'?args[1]:undefined});return v;};
 }
});
let result;
try{
 await page.goto(url+'/?test&webgl&autostart&length=quick&seed=84173&date=2026-11-20&population=off');
 await page.waitForFunction(()=>!!window.__parkour&&!!window.__vehicles&&!!window.__city,undefined,{timeout:180000});
 await page.evaluate(()=>{window.__parkour.input({x:0,z:0,jump:false,sprint:false,slide:false,interact:false,traverse:false});window.__city.hour(15);});
 const begin=await page.evaluate(()=>structuredClone(window.__glCost));console.log('READY',label,JSON.stringify(begin.calls));
 const frames=await page.evaluate(()=>new Promise(resolve=>{const t=[],st=performance.now();let last=st;function tick(n){t.push(n-last);last=n;if((n-st>30000&&t.length>=20)||n-st>90000){const s=[...t].sort((a,b)=>a-b);resolve({intervals:t.length,wallMs:n-st,fps:t.length*1000/(n-st),p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],firstIntervals:t.slice(0,8),lastIntervals:t.slice(-8)});}else requestAnimationFrame(tick);}requestAnimationFrame(tick);}));
 const end=await page.evaluate(()=>({cost:window.__glCost,parkour:window.__parkour.snapshot(),city:window.__city.snapshot()}));
 const delta={};for(const k in end.cost.calls)delta[k]={calls:end.cost.calls[k]-(begin.calls[k]??0),ms:end.cost.ms[k]-(begin.ms[k]??0)};
 result={label,url,environment:'WebGL2 / SwiftShader; diagnostic GL wrappers add small CPU overhead; same wrapper required for matched comparison, not native timing',viewport:[1280,800],quality:'Balanced fixed',population:'off',begin,end,delta,frames,errors};
 console.log('RESULT',JSON.stringify({label,frames,delta,errors},null,2));
}finally{if(result)await writeFile(`${folder}/gpu-cost-${label}.json`,JSON.stringify(result,null,2)+'\n');await browser.close();}
