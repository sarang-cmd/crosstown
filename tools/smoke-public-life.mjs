// Anonymous normal-user landing -> Play smoke on the actual deployed alias.
// No debug game URL, fake providers or performance claims.
import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';import sharp from 'sharp';
const pkg=JSON.parse(await readFile('package.json','utf8')),release=JSON.parse(await readFile('public/release.json','utf8')),folder=`docs/evidence/crosstown-${pkg.version}`,base=process.env.DEPLOYMENT_URL??'https://crosstown-sarang-dev.vercel.app';
const report={version:pkg.version,base,anonymous:true,normalPlayURL:true,debugHooksUsed:false,initialLowQualityFixture:true,nativePerformanceAcceptance:false,passed:false,errors:[],networkFailures:[]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.networkFailures.push({url:r.url(),failure:r.failure()?.errorText}));
await page.addInitScript(()=>localStorage.setItem('crosstown:settings:v1',JSON.stringify({version:1,data:{quality:0,diagnostics:false}})));
const r=await page.request.get(base+'/release.json');assert.equal(r.status(),200);report.release=await r.json();assert.equal(report.release.version,pkg.version);assert.equal(report.release.build,release.build);
await page.goto(base+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.ready==='landing');await page.evaluate(()=>document.fonts.ready);
report.landing=await page.evaluate(()=>({title:document.title,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,canvas:document.querySelectorAll('canvas').length,resources:performance.getEntriesByType('resource').map(r=>r.name)}));
assert.equal(report.landing.canvas,0);assert.equal(report.landing.scrollWidth,1440);assert.ok(!report.landing.resources.some(p=>/\/assets\/(?:game|rendering|physics|foundation)-|\.wasm|\.glb/.test(p)));
await sharp(await page.screenshot({fullPage:true})).webp({quality:86}).toFile(folder+'/public-landing-desktop.webp');
await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await sharp(await page.screenshot({fullPage:true})).webp({quality:86}).toFile(folder+'/public-landing-mobile.webp');
await page.setViewportSize({width:1280,height:800});await page.locator('a[href="/play"]').first().click();
await page.waitForURL(base+'/play');await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',undefined,{polling:100,timeout:180000});
await page.waitForFunction(()=>!document.querySelector('#boot-status'));
report.game=await page.evaluate(()=>({path:location.pathname,query:location.search,ready:document.documentElement.dataset.ready,debugHooks:!!window.__parkour,canvas:!!document.querySelector('#world-canvas'),wantedHUD:!!document.querySelector('#wanted-stars'),radioHUD:!!document.querySelector('#radio-open'),minimap:!!document.querySelector('.city-minimap canvas')}));
assert.equal(report.game.path,'/play');assert.equal(report.game.query,'');assert.equal(report.game.debugHooks,false);assert.equal(report.game.canvas,true);assert.equal(report.game.wantedHUD,true);assert.equal(report.game.radioHUD,true);assert.equal(report.game.minimap,true);
await sharp(await page.screenshot()).webp({quality:88}).toFile(folder+'/public-immediate-game.webp');assert.deepEqual(report.errors,[]);assert.deepEqual(report.networkFailures,[]);
report.passed=true;console.log('PASS anonymous public landing -> immediate normal /play; new HUD, no debug hooks, no runtime/request failures');
}catch(e){report.error=String(e.stack??e);console.error(e.stack??e);process.exitCode=1;}
finally{await writeFile(folder+'/public-normal-play-smoke.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
