import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import sharp from 'sharp';
function watch(page: Page) { const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404 (Not Found)')) errors.push(m.text()); }); return errors; }
async function boot(page: Page, project: string, lab = false) {
  await page.addInitScript(() => {
    localStorage.setItem('crosstown:settings:v1', JSON.stringify({ version: 1, data: { quality: 0, diagnostics: false } }));
    localStorage.setItem('crosstown:driving:v1', JSON.stringify({ version: 1, data: { cabin: 'sedan', manual: false, assist: true, mouseSteering: false } }));
  });
  await page.goto(`/?test&date=2026-11-20${project === 'webgl2-forced' ? '&webgl' : ''}${lab ? '&drive' : ''}`);
  await page.waitForFunction(() => !!window.__vehicles && !!window.__city && !!window.__parkour, undefined, { timeout: 180000 });
  if (lab) await expect.poll(() => page.evaluate(() => window.__vehicles!.snapshot().active), { timeout: 180000 }).toBe('lab');
  await page.evaluate(() => window.__city!.hour(15));
}
async function freeze(page: Page) { await page.evaluate(() => { window.__parkour!.pause(true); document.querySelector<HTMLElement>('#pause-overlay')!.hidden = true; document.body.classList.remove('run-paused'); document.querySelector('#hud')!.classList.remove('is-paused'); }); }
async function state(page: Page) { return page.evaluate(() => window.__vehicles!.snapshot()); }
async function capture(page: Page, name: string, project: string) { await page.evaluate(() => { document.querySelector<HTMLElement>('#pause-overlay')!.hidden = true; document.body.classList.remove('run-paused'); document.querySelector('#hud')!.classList.remove('is-paused'); }); await page.screenshot({ path: `docs/screenshots/${name}-${project}.png` }); }
const active = (s: any) => s.cars.find((c: any) => c.id === s.active);
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) {
    const data = await page.evaluate(() => ({ vehicles: window.__vehicles?.snapshot(), exit: window.__vehicles?.exitProbe(), city: window.__city?.snapshot(), parkour: window.__parkour?.snapshot(), messages: [...document.querySelectorAll('.toast, .run-toast')].map(e => e.textContent) })).catch(e => ({ error: String(e) }));
    await fs.writeFile(`.arena/vehicle-failure-${info.project.name}-${info.title.slice(0,12).replaceAll(' ','-')}.json`, JSON.stringify(data,null,2));
  }
});


test('real street enter/carjack, ordered cold start, keyboard steering, four cameras, handbrake, exit and actual finish-reward car work', async ({ page }, info) => {
  const errors = watch(page); await boot(page, info.project.name);
  await page.locator('#city-find-car').click();
  await expect.poll(() => page.evaluate(() => window.__city!.snapshot().mode)).toBe('street');
  await expect(page.locator('.vehicle-prompt')).toBeVisible();
  await capture(page, '06-street-entry', info.project.name);
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await state(page)).active).toBe('parked');
  let s = await state(page); expect(active(s).carjacked).toBe(true); expect(s.camera.index).toBe(0);
  await page.evaluate(() => { window.__vehicles!.step(20); window.__vehicles!.camera(3); }); await freeze(page);
  await expect.poll(async () => active(await state(page)).visual.doorRadians).toBeLessThan(-.3);
  await capture(page,'06-opening-real-car-door',info.project.name);
  await page.evaluate(() => { window.__vehicles!.camera(0); window.__vehicles!.step(320); }); await freeze(page);
  await expect.poll(async () => active(await state(page)).engine.phase).toBe('running');
  s = await state(page); expect(active(s).engine.history.slice(0,8).map((x:any) => x.phase)).toEqual(['off','door-open','door-close','key','ignition','cranking','catch','running']);
  expect(active(s).engine.fastIdleSeconds).toBeGreaterThan(15); expect(active(s).visual.gltf).toBe(true); expect(active(s).visual.movingGltfDoorTriangles).toBeGreaterThan(0); expect(active(s).visual.wheelNodes).toBe(4);
  const ticks = s.ticks, steps = s.cityWorldSteps; await page.evaluate(() => window.__vehicles!.step(120)); s = await state(page); expect(s.ticks-ticks).toBe(120); expect(s.cityWorldSteps-steps).toBe(120);
  await page.evaluate(() => window.__parkour!.pause(false));
  for (const index of [1,2,3,0]) { await page.keyboard.press('KeyC'); await expect.poll(async () => (await state(page)).camera.index).toBe(index); }
  const before = active(await state(page)).odometer;
  await page.keyboard.down('KeyW'); await expect.poll(async () => active(await state(page)).input.throttle).toBe(1);
  await expect.poll(async () => active(await state(page)).odometer, { timeout: 45000 }).toBeGreaterThan(before + 1.2);
  await page.keyboard.down('KeyD'); await expect.poll(async () => active(await state(page)).roadSteer).toBeLessThan(-.02); await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyA'); await expect.poll(async () => active(await state(page)).roadSteer).toBeGreaterThan(.02); await page.keyboard.up('KeyA');
  await page.keyboard.down('Space'); await expect.poll(async () => active(await state(page)).input.handbrake).toBe(true); s = await state(page); expect(active(s).wheels[2].grip).toBeLessThan(active(s).wheels[0].grip); await page.keyboard.up('Space'); await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyK'); await expect.poll(async () => active(await state(page)).visual.headlightIntensity).toBeGreaterThan(0);
  s = await state(page); expect(Math.abs(s.cabin.rackRadians + active(s).steeringWheelRadians)).toBeLessThan(.001);
  // A deterministic stationary fixture makes the real E-key exit test independent of software rendering cadence.
  await page.evaluate(() => { const s=window.__vehicles!.snapshot(), c=s.cars.find((c:any)=>c.id===s.active); window.__vehicles!.teleport(c.position); });
  expect(await page.evaluate(() => window.__vehicles!.exitProbe())).not.toBe(null);
  await expect.poll(async () => Math.abs(active(await state(page)).speed)).toBeLessThan(1.4);
  await page.keyboard.press('KeyE'); await expect.poll(async () => (await state(page)).active).toBe(null); await expect.poll(() => page.evaluate(() => window.__city!.snapshot().mode)).toBe('street');
  expect(await page.evaluate(() => window.__vehicles!.enter('reward'))).toBe(false);
  await page.evaluate(() => window.__city!.mode('parkour'));
  const result = await page.evaluate(() => window.__parkour!.botRun()); expect(result.state).toBe('finished');
  await page.evaluate(() => window.__vehicles!.find('reward')); await expect(page.locator('.vehicle-prompt')).toBeVisible(); await page.keyboard.press('KeyE'); await expect.poll(async () => (await state(page)).active).toBe('reward');
  await page.evaluate(() => window.__vehicles!.step(340)); await freeze(page);
  s = await state(page); expect(active(s).locked).toBe(false); expect(active(s).engine.phase).toBe('running');
  expect(s.rewardGuidance.arrow[0]).toBeCloseTo(s.rewardGuidance.route.x, 3); expect(s.rewardGuidance.arrow[2]).toBeCloseTo(s.rewardGuidance.route.z, 3);
  expect(active(s).position.x).toBeCloseTo(s.rewardGuidance.route.x, 1); expect(active(s).position.z).toBeCloseTo(s.rewardGuidance.route.z, 1);
  await capture(page, '06-reward-car-cockpit', info.project.name);
  const rewardState = s;
  await page.evaluate(() => window.__parkour!.start(84174));
  expect((await state(page)).resources.cars).toBe(2);
  expect((await state(page)).active).toBe(null);
  await page.evaluate(() => { window.__vehicles!.find('parked'); window.__parkour!.pause(false); });
  await expect(page.locator('.vehicle-prompt')).toBeVisible(); await page.keyboard.press('KeyE');
  await expect.poll(async () => (await state(page)).active).toBe('parked');
  await page.evaluate(() => window.__vehicles!.step(340)); await freeze(page);
  expect(active(await state(page)).engine.phase).toBe('running');
  await page.evaluate(() => window.__vehicles!.camera(3)); await capture(page,'06-car-after-route-restart',info.project.name);
  await page.evaluate(() => window.__parkour!.pause(false));
  await page.keyboard.press('KeyT'); await expect.poll(async () => active(await state(page)).engine.manual).toBe(true);
  await page.keyboard.press('KeyI'); await expect.poll(async () => active(await state(page)).engine.phase).toBe('shutdown');
  await page.evaluate(() => window.__vehicles!.step(70)); expect(active(await state(page)).engine.phase).toBe('off');
  await page.evaluate(() => window.__parkour!.pause(false)); await page.keyboard.press('KeyI');
  await expect.poll(async () => active(await state(page)).engine.phase).toBe('key');
  await page.evaluate(() => window.__vehicles!.step(300)); expect(active(await state(page)).engine.phase).toBe('stalled');
  await page.evaluate(() => { window.__vehicles!.gear(0); window.__parkour!.pause(false); }); await page.keyboard.press('KeyI');
  await expect.poll(async () => active(await state(page)).engine.phase).toBe('key');
  await page.evaluate(() => window.__vehicles!.step(300)); await freeze(page); expect(active(await state(page)).engine.phase).toBe('running');
  await fs.writeFile(`docs/VEHICLE-STREET-${info.project.name}.json`, JSON.stringify({ backend:info.project.name, ordinaryKeyboard:true, finishSimulation:result, snapshot:rewardState, afterRestart:await state(page), errors }, null, 2));
  expect(errors).toEqual([]);
});

test('virtual analog gamepad/wheel, all six actual cabins, recorded engine sweeps, one missing sample fallback and real every-other-frame rear mirrors', async ({ page }, info) => {
  const errors=watch(page); await boot(page, info.project.name, true); await page.keyboard.press('KeyW');
  await page.evaluate(() => window.__vehicles!.step(340)); await page.evaluate(() => window.__parkour!.pause(false));
  await page.evaluate(() => {
    const pad=(window as any).__acceptancePad={id:'Virtual standard acceptance pad',mapping:'standard',connected:true,index:0,timestamp:0,axes:[.35,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0})),rumbleCalls:0,vibrationActuator:{playEffect:async()=>{(window as any).__acceptancePad.rumbleCalls++;return 'complete';}}};
    pad.buttons[7]={pressed:true,touched:true,value:.7}; Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
  });
  await expect.poll(async()=>active(await state(page)).input.throttle).toBeCloseTo(.7,3); await expect.poll(async()=>active(await state(page)).input.steering).toBeGreaterThan(.1);
  let s=await state(page); expect(active(s).input.directSteer).toBe(false);
  await page.evaluate(()=>{ const pad=(window as any).__acceptancePad;pad.id='Virtual USB racing wheel 900 degrees';pad.mapping='';pad.axes=[.5,0,-1,0,0,1];pad.buttons.forEach((b:any)=>{b.pressed=false;b.value=0;}); });
  await expect.poll(async()=>active(await state(page)).input.directSteer).toBe(true); await expect.poll(async()=>active(await state(page)).input.throttle).toBe(1);
  await page.evaluate(()=>window.__vehicles!.step(90,{steering:.5,directSteer:true})); await freeze(page); s=await state(page); expect(Math.abs(Math.abs(active(s).steeringWheelRadians)*180/Math.PI-225)).toBeLessThan(.1);
  // Deliver an actual Rapier landing into the virtual actuator; this does NOT claim a physical controller test.
  await page.evaluate(()=>{window.__vehicles!.teleport({x:5125,y:5,z:5110});window.__vehicles!.step(240);});
  expect(await page.evaluate(()=>(window as any).__acceptancePad.rumbleCalls)).toBeGreaterThan(0);
  await page.evaluate(()=>{(window as any).__acceptancePad.connected=false;Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]});window.__vehicles!.input(undefined);window.__parkour!.pause(false);});
  await page.keyboard.press('KeyU'); await expect.poll(async()=>(await state(page)).preferences.mouseSteering).toBe(true); await page.mouse.move(1300,430); await expect.poll(async()=>active(await state(page)).input.steering).toBeGreaterThan(.65); await page.keyboard.press('KeyU');
  await page.evaluate(()=>{window.__vehicles!.teleport({x:5125,y:.9,z:5110},Math.PI/2);window.__vehicles!.manual();window.__vehicles!.gear(0);window.__vehicles!.step(160,{throttle:.5});}); await freeze(page);
  const cabins=[];
  for(const id of['compact','sedan','muscle','supercar','suv','motorbike']){
    await page.evaluate(id=>window.__vehicles!.cabin(id),id); await expect.poll(async()=>(await state(page)).cabin.class).toBe(id); await expect.poll(async()=>(await state(page)).audio.voices[0]?.state,{timeout:45000}).toBe('samples');
    s=await state(page); const c=active(s); expect(s.cabin.hands).toBe(2);expect(s.cabin.gauges).toHaveLength(3);expect(s.cabin.manualShifterVisible).toBe(true);expect(s.cabin.readings.rpm).toBeCloseTo(c.engine.rpm,1);expect(s.cabin.readings.temperature).toBeCloseTo(c.engine.temperature,1);expect(s.cabin.readings.speed).toBeCloseTo(Math.abs(c.speed)*3.6,1);expect(s.cabin.geometryParts).toBeGreaterThan(10);expect(s.cabin.screenGear).toBe(s.cabin.readings.gear);
    cabins.push({id,cabin:s.cabin,audio:s.audio}); await capture(page,`07-cabin-${id}`,info.project.name);
  }
  const sweeps=[];
  for(const [id,throttle]of [['sedan',.15],['muscle',.50],['suv',.85]] as const){await page.evaluate(({id,throttle})=>{window.__vehicles!.cabin(id);window.__vehicles!.step(180,{throttle});},{id,throttle});await expect.poll(async()=>(await state(page)).audio.voices[0]?.state,{timeout:45000}).toBe('samples');await expect.poll(async()=>(await state(page)).audio.rms,{timeout:20000}).toBeGreaterThan(.001);s=await state(page);expect(s.audio.voices[0].loops).toBe(8);expect(s.audio.voices[0].playbackRates.every((n:number)=>n>=.45&&n<=2.2)).toBe(true);sweeps.push({type:s.audio.voices[0].engine,rpm:active(s).engine.rpm,audio:s.audio});}
  expect(new Set(sweeps.map(x=>x.type)).size).toBe(3);
  let deliberatelyMissing=0;
  const sample='public/audio/cars/harbor/high-on.wav', held=`.arena/withheld-high-on-${info.project.name}.wav`, original=await fs.readFile(sample);
  let fallback:any;
  await fs.rename(sample,held);
  try {
    await page.route('**/audio/cars/harbor/high-on.wav',r=>{deliberatelyMissing++;return r.fulfill({status:404,body:'Deliberately removed acceptance-test sample'});});
    await page.evaluate(()=>window.__vehicles!.cabin('sedan'));await expect.poll(async()=>(await state(page)).audio.voices[0]?.state,{timeout:45000}).toBe('synth-fallback');expect(deliberatelyMissing).toBeGreaterThan(0);await expect.poll(async()=>(await state(page)).audio.rms).toBeGreaterThan(.001);fallback=(await state(page)).audio;
  } finally { await fs.rename(held,sample); await page.unroute('**/audio/cars/harbor/high-on.wav'); }
  expect(Buffer.compare(original,await fs.readFile(sample))).toBe(0);
  await page.evaluate(()=>window.__vehicles!.fallback(false));await expect.poll(async()=>(await state(page)).audio.voices[0]?.state,{timeout:45000}).toBe('samples');
  await page.evaluate(()=>{window.__vehicles!.quality(2);window.__vehicles!.camera(0);window.__city!.hour(15);});
  await expect.poll(async()=>(await state(page)).cabin.mirrorRenderFrames,{timeout:90000}).toBeGreaterThan(1);
  const before=await page.evaluate(()=>window.__vehicles!.mirrorPixels());await page.evaluate(()=>window.__vehicles!.rearMarker(true));const update=(await state(page)).cabin.mirrorRenderFrames;
  await expect.poll(async()=>(await state(page)).cabin.mirrorRenderFrames,{timeout:90000}).toBeGreaterThan(update+1);const after=await page.evaluate(()=>window.__vehicles!.mirrorPixels());expect(after[0].hash).not.toBe(before[0].hash);expect(after[0].magentaPixels).toBeGreaterThan(20);expect(after[0].range).toBeGreaterThan(50);
  // Check the MATERIAL on screen, not only raw render-target memory: top magenta
  // and bottom cyan control bars must not appear vertically inverted.
  await page.evaluate(() => { document.querySelector<HTMLElement>('#pause-overlay')!.hidden = true; document.body.classList.remove('run-paused'); document.querySelector('#hud')!.classList.remove('is-paused'); });
  const bounds=await page.evaluate(()=>window.__vehicles!.mirrorBounds());
  const {data:mirrorImage,info:mirrorInfo}=await sharp(await page.screenshot()).extract(bounds[0]).removeAlpha().raw().toBuffer({resolveWithObject:true});
  let magentaCount=0,cyanCount=0,magentaY=0,cyanY=0;
  for(let y=0;y<mirrorInfo.height;y++)for(let x=0;x<mirrorInfo.width;x++){const i=(y*mirrorInfo.width+x)*3,r=mirrorImage[i]!,g=mirrorImage[i+1]!,b=mirrorImage[i+2]!;if(r>130&&g<70&&b>100){magentaCount++;magentaY+=y;}if(g>r+45&&b>r+45&&g>120&&b>125){cyanCount++;cyanY+=y;}}
  expect(magentaCount).toBeGreaterThan(10);expect(cyanCount).toBeGreaterThan(10);expect(magentaY/magentaCount).toBeLessThan(cyanY/cyanCount-3);
  const orientation={magentaCount,cyanCount,topBarY:magentaY/magentaCount,bottomBarY:cyanY/cyanCount,bounds:bounds[0]};

  s=await state(page);const f0=s.renderFrames,m0=s.cabin.mirrorRenderFrames;await expect.poll(async()=>(await state(page)).renderFrames,{timeout:60000}).toBeGreaterThan(f0+3);s=await state(page);expect(Math.abs((s.cabin.mirrorRenderFrames-m0)-(s.renderFrames-f0)/2)).toBeLessThanOrEqual(1);
  const markedFrames=(await state(page)).cabin.mirrorRenderFrames; await page.evaluate(()=>window.__vehicles!.rearMarker(false));await expect.poll(async()=>(await state(page)).cabin.mirrorRenderFrames,{timeout:60000}).toBeGreaterThan(markedFrames);await capture(page,'07-live-mirrors',info.project.name);
  await page.evaluate(()=>window.__city!.hour(22));await expect.poll(async()=>(await state(page)).cabin.readings.night).toBe(1);await capture(page,'07-cockpit-night',info.project.name);
  const highFrames=(await state(page)).cabin.mirrorRenderFrames; await page.evaluate(()=>window.__vehicles!.quality(3)); await expect.poll(async()=>(await state(page)).cabin.mirrorRenderFrames,{timeout:60000}).toBeGreaterThan(highFrames);
  await page.evaluate(()=>window.__vehicles!.quality(0));await expect.poll(async()=>(await state(page)).cabin.mirrorsEnabled).toBe(false);
  const beforeReload=await state(page), budget=await page.evaluate(()=>window.__vehicles!.audioBudget());
  expect(budget.activeEmitters).toBe(16);expect(budget.activeOneShots).toBe(16);expect(budget.voices[0].id).toBe('budget-23');expect(budget.voices.every((v:any)=>v.spatial)).toBe(true);
  await page.evaluate(()=>window.__parkour!.pause(true));
  const volumes={master:.31,engine:.42,effects:.53,radio:.24};
  for(const [bus,value]of Object.entries(volumes))await page.locator(`[data-audio="${bus}"]`).evaluate((el,value)=>{(el as HTMLInputElement).value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await expect.poll(async()=>(await state(page)).audio.volumes.master).toBe(.31);
  await page.reload(); await page.waitForFunction(()=>window.__vehicles?.snapshot().active==='lab',undefined,{timeout:180000}); await page.keyboard.press('Escape');await expect(page.locator('#pause-overlay')).toBeVisible();
  for(const [bus,value]of Object.entries(volumes)){expect((await state(page)).audio.volumes[bus]).toBe(value);await expect(page.locator(`[data-audio="${bus}"]`)).toHaveValue(String(value));}
  await expect.poll(async()=>(await state(page)).audio.gains.engine).toBeCloseTo(.42,2); await expect.poll(async()=>(await state(page)).audio.gains.master).toBeCloseTo(.31*.05,2);
  const report={backend:info.project.name,physicalHardware:false,cabins,sweeps,missingSample404s:deliberatelyMissing,sampleWithheldOnDisk:true,sampleRestoredByteForByte:true,fallback,mirrorControl:{before,after,orientation},audioBudget:budget,savedVolumes:volumes,afterReload:await state(page),snapshot:beforeReload,errors};await fs.writeFile(`docs/VEHICLE-INTERIORS-${info.project.name}.json`,JSON.stringify(report,null,2));expect(errors).toEqual([]);
});
