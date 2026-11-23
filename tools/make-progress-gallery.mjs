// Actual application captures only. Build a portable, offline visual handoff.
// Original capture pixels and telemetry are unedited; PNG encoding may be losslessly optimized (SCREENSHOT-LOSSLESS.json).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root = fileURLToPath(new URL('../', import.meta.url));
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const shots = [
  [
    "08-zenith-webgpu.png",
    "Twelve sets of keys.",
    "Actual Zenith exterior, one of twelve independently tuned vehicles. The same physical loop is used for every car; numerical pilots are not human driving-feel acceptance.",
    "08 / A real roster"
  ],
  [
    "08-six-car-garage-webgpu.png",
    "Keep the ones you like.",
    "Six taken street cars, stored inside the garage across a browser reload. Retrieval, paint, wreck recovery and unique VIN ownership are exercised on both renderers.",
    "08 / Six spaces"
  ],
  [
    "08-pip-webgpu.png",
    "Small, light, different.",
    "Pip compact: a distinct CC0 model, mass, brakes, drivetrain, paint and recorded/synth audio profile. This is not a cabin swap on the sedan.",
    "08 / Compact"
  ],
  [
    "08-brim-webgpu.png",
    "A little more muscle.",
    "The civilian Brim derivative has its taxi roof sign removed offline. Source provenance and the exact removed triangles are documented.",
    "08 / Muscle"
  ],
  [
    "08-summit-webgpu.png",
    "A taller point of view.",
    "Independent SUV exterior and heavier all-wheel-drive tuning. Service brakes are tested so AWD engine drag cannot bypass them.",
    "08 / SUV"
  ],
  [
    "08-wren-webgpu.png",
    "Two contact patches.",
    "Original CC0 Wren motorcycle fallback, after external source access failed. Two actual Rapier wheel rays and a lean controller; no hidden support wheels.",
    "08 / Motorbike"
  ],
  [
    "08-kestrel-webgpu.png",
    "Another bike. Another tune.",
    "Kestrel has its own geometry, tuning, paint and designed twin-cylinder timbre. The twin derives from a licensed single recording, not an independent dyno capture.",
    "08 / Motorbike two"
  ],
  [
    "08-burning-webgpu.png",
    "A dent is only the beginning.",
    "Actual physical impacts progress through dented, broken-glass, smoking and burning states. Seven simulated seconds later a wreck remains; the garage can recover it.",
    "08 / Damage"
  ],
  [
    "09-physical-npc-crash.png",
    "They feel the impact too.",
    "An actual player/NPC Rapier collision, not injected damage. Both chassis take damage; braking, one evasive lane change and nearby reactions are measured.",
    "09 / Crash response"
  ],
  [
    "09-siren-webgpu.png",
    "Make a little room.",
    "Siren test flag requests a pull-over response. It is a reaction hook, not a police system or a new siren-equipped vehicle.",
    "09 / Pull over"
  ],
  [
    "09-night-population.png",
    "Fewer footsteps after dark.",
    "Actual night street rendering. People reduce and headlights switch on; destinations and legal crossing rules remain. Seating/social alignment still needs human review.",
    "09 / Night streets"
  ],
  [
    "09-parked-wall-120s.png",
    "Two minutes, honestly timed.",
    "Captured after an actual two-wall-minute occupied parked-car observation. Software FPS is unretouched; simulated time advances much less than wall time. Strict no-stuck acceptance remains open.",
    "09 / Observation"
  ],
  [
    "09-auto-wall-120s.png",
    "Less work when it is slow.",
    "Separate two-wall-minute Auto observation: real frame intervals reduce quality and population density. Adaptation is functional, not proof of native near-60 FPS.",
    "09 / Adaptive cost"
  ],
  [
    "09-public-cockpit-webgpu.png",
    "The road behind is real.",
    "Actual public 0.9 cockpit after a real drive on the renamed site. Samples, geometry, live rear mirrors and E-key exit pass; software graphics, not 60 FPS or by-ear evidence.",
    "06–09 / Public cockpit"
  ],
  [
    "03-run-choices.png",
    "Your run, your rules.",
    "Quick is default; Standard and Full remain. Controls, sensitivity, camera feel and graphics are chosen before the run, as explicitly requested.",
    "01–09 / Your choices"
  ],
  [
    "08-crosstown-rooftops.png",
    "Same runner. More city.",
    "Retained CC0 runner and original parkour. This historical Full/Balanced profiler view has unretouched software FPS, not a new hardware benchmark.",
    "01–05 / The rooftops"
  ],
  [
    "district-1-beach.png",
    "West Beach",
    "Palms, pastel architecture, a promenade and open sea. Retained 0.5 district capture, not a new full-city tour.",
    "City / The coast"
  ],
  [
    "district-2-downtown.png",
    "Downtown",
    "Glass towers, plazas and the opening rooftop circuit. The fixed city is still four by four kilometres.",
    "City / The skyline"
  ],
  [
    "district-3-port.png",
    "South Port",
    "Cranes, industrial sheds, container yards and the waterfront.",
    "City / The working city"
  ],
  [
    "district-4-canals.png",
    "Canal Ward",
    "Waterways, waterfront homes, quays and connected bridges.",
    "City / Across the water"
  ],
  [
    "district-5-hills.png",
    "North Hills",
    "Villas, pools and winding hillside roads. Terrain/road blending remains unfinished.",
    "City / Higher ground"
  ],
  [
    "district-6-oldtown.png",
    "Old Town",
    "Brick palettes, balconies, rooftop equipment and alleys.",
    "City / The old blocks"
  ],
  [
    "district-7-outskirts.png",
    "County Line",
    "Dry outskirts, roadside buildings and the mountain boundary.",
    "City / The edge of town"
  ],
  [
    "05-neon-night.png",
    "When the windows light up.",
    "Dusk-driven windows and signs in a 24-active-minute day; not a production bloom or volumetric-lighting pass.",
    "City / After dark"
  ],
  [
    "06-city-map.png",
    "A connected way through.",
    "The real full map with a connected-road waypoint to West Beach. Press M.",
    "City / Find your way"
  ],
  [
    "10-rain.png",
    "A change in the weather.",
    "Calendar-seeded rain at 15:00. Lightweight streaks and fog, not full wet-road reflections or splashes.",
    "City / Rain date"
  ]
];
const images = await Promise.all(shots.map(async ([file, title, copy, label]) => ({
  file, title, copy, label,
  src: `data:image/webp;base64,${(await sharp(`${root}/docs/screenshots/${file}`).resize({ width: 1120, withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toBuffer()).toString('base64')}`,
})));
const font = (await readFile(`${root}/public/fonts/Manrope-Variable.ttf`)).toString('base64');
const cards = images.map((shot, i) => `<figure class="shot ${i < 2 ? 'wide' : ''}"><button class="capture" data-index="${i}" aria-label="Enlarge: ${escape(shot.title)}"><img src="${shot.src}" alt="Actual Crosstown application screenshot: ${escape(shot.title)}" ${i > 1 ? 'loading="lazy"' : ''} width="1280" height="800"><span class="enlarge" aria-hidden="true">↗</span></button><figcaption><span class="eyebrow">${escape(shot.label)}</span><h3>${escape(shot.title)}</h3><p>${escape(shot.copy)}</p></figcaption></figure>`).join('\n');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Crosstown · A city at your pace</title>
<style>
@font-face{font-family:Manrope;src:url(data:font/ttf;base64,${font}) format('truetype');font-weight:200 800;font-display:swap}
:root{--paper:#f3f0e2;--ink:#22483d;--muted:#61766a;--line:#ccd2ba;--green:#d2ee98;--amber:#e4ae60;--white:#fbfaf3}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:Manrope,system-ui,sans-serif}button,a{-webkit-tap-highlight-color:transparent}a{color:inherit}button{font:inherit}button:focus-visible,a:focus-visible{outline:3px solid #278a6c;outline-offset:5px}header,main,footer{max-width:1320px;margin:auto;padding-left:44px;padding-right:44px}header{display:flex;justify-content:space-between;align-items:center;min-height:108px;border-bottom:1px solid var(--line);gap:20px}.brand{font-size:20px;font-weight:800;letter-spacing:-.7px;display:flex;align-items:center;gap:10px}.mark{background:var(--ink);color:var(--green);width:35px;height:35px;display:grid;place-items:center;border-radius:9px;font-size:30px;line-height:1}.eyebrow,.tiny{font:10px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;text-transform:uppercase;letter-spacing:1.8px}.tiny{color:var(--muted);text-align:right}.hero{padding:66px 0 44px;display:grid;grid-template-columns:1.25fr 1fr;gap:60px;align-items:end}h1{font-size:clamp(46px,6.2vw,80px);letter-spacing:-5px;line-height:1.03;max-width:760px;margin:19px 0 22px;font-weight:750}.hero p{max-width:490px;line-height:1.8;color:var(--muted);font-size:14px;margin:0 0 24px}.cta{background:var(--ink);color:var(--paper);padding:15px 22px;display:inline-flex;align-items:center;justify-content:space-between;gap:45px;text-decoration:none;border-radius:7px;font-size:13px;font-weight:700}.cta span{color:var(--green);font-size:23px}.pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}.pill{font:10px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.8px;border:1px solid var(--line);padding:8px 10px;border-radius:20px}.dot{display:inline-block;width:6px;height:6px;background:#5d8b51;border-radius:100%;margin-right:6px}.stats{display:grid;grid-template-columns:repeat(4,1fr);margin:0 0 44px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.stat{padding:22px 16px 22px 0}.stat:not(:first-child){border-left:1px solid var(--line);padding-left:25px}.stat strong{font-size:30px;font-weight:600;letter-spacing:-1.8px;display:block}.stat span{font-size:11px;color:var(--muted);display:block;margin-top:5px}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:25px;padding-top:12px;margin-bottom:24px}.section-heading h2{font-size:29px;letter-spacing:-1.3px;margin:5px 0 0}.section-heading p{font-size:11px;line-height:1.7;color:var(--muted);max-width:330px;text-align:right}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:36px 24px}.shot{margin:0;min-width:0}.capture{padding:0;margin:0;border:0;background:#d8ddcd;width:100%;display:block;border-radius:11px;overflow:hidden;position:relative;cursor:zoom-in;aspect-ratio:8/5}.capture img{display:block;width:100%;height:auto;transition:transform .35s ease}.capture:hover img{transform:scale(1.012)}.enlarge{position:absolute;bottom:12px;right:12px;background:#f3f0e2d9;border:1px solid #fff9;border-radius:50%;width:30px;height:30px;display:grid;place-items:center;color:var(--ink);font-size:20px}figcaption{padding:16px 2px 0}figcaption .eyebrow{font-size:9px;color:var(--muted)}h3{font-size:21px;letter-spacing:-.8px;margin:7px 0}figcaption p{font-size:12px;color:var(--muted);line-height:1.8;margin:0;max-width:560px}.wide{grid-column:1/-1}.wide figcaption{display:grid;grid-template-columns:1fr 1.1fr;column-gap:32px;align-items:start}.wide figcaption .eyebrow{grid-column:1}.wide h3{font-size:27px;margin:7px 0}.wide figcaption p{grid-column:2;grid-row:1/3;font-size:13px}.honesty{background:var(--ink);color:var(--paper);padding:34px;border-radius:12px;margin:50px 0 32px;display:grid;grid-template-columns:1fr 1.3fr;gap:45px}.honesty .eyebrow{color:var(--green)}.honesty h2{font-size:32px;line-height:1.15;letter-spacing:-1.4px;margin:13px 0}.honesty p,.honesty li{font-size:12px;line-height:1.8;color:#d4dfce}.honesty ul{margin:0;padding-left:18px}.honesty li+li{margin-top:9px}.honesty strong{color:var(--paper)}.journal{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;padding:0 0 42px}.journal article{border-top:1px solid var(--line);padding-top:20px}.journal h3{font-size:17px}.journal p{font-size:12px;color:var(--muted);line-height:1.8}.journal .eyebrow{color:var(--muted)}footer{border-top:1px solid var(--line);padding-top:24px;padding-bottom:34px;display:flex;justify-content:space-between;gap:30px;font-size:10px;color:var(--muted);line-height:1.8}dialog{padding:0;border:1px solid #ffffff3b;background:#162d27;color:var(--paper);max-width:96vw;width:1340px;border-radius:12px;max-height:96vh;overflow:auto}dialog::backdrop{background:#09251ee8}dialog img{display:block;width:100%;height:auto}dialog .bar{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:12px 16px;font-size:12px}dialog button{border:1px solid #ffffff44;background:transparent;color:var(--paper);border-radius:6px;padding:8px 13px;cursor:pointer}dialog #view-title{font-weight:700}dialog .actions{display:flex;gap:8px}
@media(min-width:1080px){.wide:first-child{grid-column:1/-1}.wide:nth-child(2){grid-column:1/-1}}@media(max-width:720px){header,main,footer{padding-left:20px;padding-right:20px}header{min-height:84px}.tiny{font-size:8px;letter-spacing:1px}.hero{padding:38px 0 30px;grid-template-columns:1fr;gap:10px}h1{letter-spacing:-2.5px}.hero p{margin-bottom:18px}.stats{grid-template-columns:repeat(2,1fr);margin-bottom:25px}.stat:nth-child(3){border-left:0;padding-left:0;border-top:1px solid var(--line)}.stat:nth-child(4){border-top:1px solid var(--line)}.stat strong{font-size:27px}.section-heading{display:block}.section-heading p{text-align:left}.grid{grid-template-columns:1fr;gap:26px}.wide figcaption{display:block}.wide h3{font-size:23px}.wide figcaption p{font-size:12px}.honesty{padding:25px;grid-template-columns:1fr;gap:12px;margin-top:34px}.journal{grid-template-columns:1fr;gap:10px}.journal article{padding-top:13px}footer{display:block}dialog .bar{flex-wrap:wrap}.brand{font-size:17px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.capture img{transition:none}}
</style></head><body>
<header><div class="brand"><span class="mark" aria-hidden="true">↗</span>crosstown</div><div class="tiny">Progress, not promises.<br>22 Nov 2026 &nbsp; / &nbsp; 0.9.0</div></header>
<main><section class="hero"><div><div class="eyebrow">A coastal-city browser prototype / Steps 01–09</div><h1>From the roofs.<br>Into the seat.</h1><div class="pills"><span class="pill"><span class="dot"></span>0.9.0 prototype</span><span class="pill">WebGPU + WebGL 2</span><span class="pill">Actual captures</span></div></div><div><p>Finish the line. Earn the keys. Twelve independent cars and bikes, damage and garages, living streets, and the city and parkour you already know. Actual captures, with the unfinished acceptance left visible.</p><a class="cta" href="https://crosstown-sarang-dev.vercel.app" target="_blank" rel="noopener">Play Crosstown <span aria-hidden="true">↗</span></a></div></section>
<section class="stats" aria-label="Observed release facts"><div class="stat"><strong>12 vehicles</strong><span>Independent cars & two-wheel bikes</span></div><div class="stat"><strong>6 cabins</strong><span>Class-matched dashboards & instruments</span></div><div class="stat"><strong>99 / 99</strong><span>Local unit tests passed</span></div><div class="stat"><strong>96 loops</strong><span>Licensed recordings + synthesis</span></div></section>
<section aria-labelledby="captures"><div class="section-heading"><div><div class="eyebrow">Field notes / Real application screenshots</div><h2 id="captures">More keys. A living street.</h2></div><p>Click to enlarge. Fleet and traffic captures are 0.9.0. Retained city/profiler views are from 0.5, not a new full-map benchmark. Filename prefixes identify project steps, not release versions.</p></div><div class="grid">${cards}</div></section>
<aside class="honesty"><div><div class="eyebrow">An honest release boundary</div><h2>Built. Tested.<br>Not finished.</h2><p>Passing functional checks are not a 60 FPS badge. These captures use software graphics, not a Radeon 840M laptop.</p></div><ul><li><strong>The reported lag is not solved.</strong> Actual two-minute populated software observations are 1.859 FPS Balanced / 2.461 FPS Auto, despite adaptive reduction. The final population-off diagnostics are also slow. Native near60, ten nearby cars and the historical ≤8 ms streaming gate remain unaccepted.</li><li><strong>City art is still a prototype.</strong> Repetitive far buildings, sparse blocks, LOD noise and steep-road blending remain visible. A full-map stall-free flight is not proven.</li><li><strong>GitHub exists; the push is pending.</strong> The private sarang-cmd/crosstown repository was created with ten topics. Secure authentication for the source push is unavailable; no hosted CI pass is claimed.</li><li><strong>Fairness, feel and realism need review.</strong> Long traffic queues leave strict no-stuck acceptance open; clean samples are not exhaustive proof. No by-ear mix or physical wheel/rumble sign-off. Social alignment and final art need work; police, weapons and deep radio are future scope.</li></ul></aside>
<section class="journal" aria-label="Changes and verification"><article><div class="eyebrow">01 / Controls & commitment</div><h3>A means left. D means right.</h3><p>Corrected the keyboard camera-space basis, removed yaw feedback, added damped follow/look and retained collision sweeps. Quick / Standard / Full replace the sole long-run commitment.</p></article><article><div class="eyebrow">02 / Feature-preserving work</div><h3>Twelve vehicles. Six spaces.</h3><p>Twelve independent glTF exteriors and physical tunings, six matching cabins and 96 roster engine loops. Damage, paint and a six-car garage extend the retained ignition, four views, fallback audio and real mirror pixels.</p></article><article><div class="eyebrow">03 / Public verification</div><h3>Checked outside the dev server.</h3><p>99 units and 25 selected browser cases pass, plus a separate public-car smoke. All 189 anonymous public files match, also after temporary transfer shutdown. Real wall-time watches, accelerated soaks and software profiles are separate. Native 60 FPS and strict no-stuck remain open.</p></article></section>
</main><footer><div><strong>Crosstown / 0.9.0</strong><br>Portable gallery · all images embedded · no network required to view.</div><div>Images are actual screenshots, not concept art. Smaller WebP previews; exact original pixels retained in PNG.<br>Details: README.md · docs/SCREENSHOTS.md · docs/FINDINGS.md · docs/TEST-RESULTS.json</div></footer>
<dialog id="viewer" aria-labelledby="view-title"><div class="bar"><span id="view-title"></span><div class="actions"><button id="previous" aria-label="Previous capture">←</button><button id="next" aria-label="Next capture">→</button><button id="close">Close ✕</button></div></div><img id="view-image" alt=""></dialog>
<script>
const cards=[...document.querySelectorAll('.capture')],viewer=document.getElementById('viewer'),image=document.getElementById('view-image'),title=document.getElementById('view-title');let active=0;
function show(index){active=(index+cards.length)%cards.length;const card=cards[active],source=card.querySelector('img');image.src=source.src;image.alt=source.alt;title.textContent=card.closest('figure').querySelector('h3').textContent+' · '+(active+1)+' / '+cards.length;if(!viewer.open)viewer.showModal();}
cards.forEach((card,i)=>card.addEventListener('click',()=>show(i)));document.getElementById('close').onclick=()=>viewer.close();document.getElementById('previous').onclick=()=>show(active-1);document.getElementById('next').onclick=()=>show(active+1);viewer.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();show(active-1)}if(e.key==='ArrowRight'){e.preventDefault();show(active+1)}});viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close()});
</script></body></html>`;
await writeFile(`${root}/docs/PROGRESS-GALLERY.html`, html);
console.log(`Gallery: ${images.length} actual captures, ${Buffer.byteLength(html).toLocaleString()} bytes; all preview assets embedded.`);
