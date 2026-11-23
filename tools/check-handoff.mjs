// Offline gallery, current local-document links and allowlisted-source safety.
// This is a handoff check, not an additional gameplay or security-audit claim.
import { chromium, expect } from '@playwright/test';
import { gunzipSync } from 'node:zlib';
import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const evidence = `docs/evidence/crosstown-${pkg.version}`;
const jsonWrite = (path, data) => writeFile(resolve(root, path), `${JSON.stringify(data, null, 2)}\n`);
const release = JSON.parse(await readFile(resolve(root, 'public/release.json'), 'utf8'));
expect(release.version).toBe(pkg.version); expect(release.build).toMatch(/^\d{2}\.\d{3}$/);expect(await readFile(resolve(root,'src/config/app.ts'),'utf8')).toContain("build: '"+release.build+"'");
const documents = ['README.md', 'CREDITS.md', 'docs/PROGRESS.md', 'docs/TESTING.md', 'docs/FINDINGS.md', 'docs/DEPLOYMENT.md', 'docs/ASSET_PIPELINE.md', 'docs/SCREENSHOTS.md', 'docs/RENDERER.md', 'docs/PARKOUR-API.md', 'docs/FLEET.md', 'docs/POPULATION.md', 'docs/LIGHTING.md', 'docs/SOURCE-ARCHIVE.md', 'docs/RADIO.md', 'docs/HANDOFF.md', 'docs/GITHUB-PUBLICATION.md'];
let checked = 0; const broken = [];
for (const file of documents) {
  const text = await readFile(resolve(root, file), 'utf8');
  const links = [...text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map(m => m[1]);
  links.push(...[...text.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]));
  for (const link of links) {
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(link)) continue;
    const path = decodeURIComponent(link.split(/[?#]/)[0]); if (!path) continue; checked++;
    try { await access(resolve(root, dirname(file), path)); } catch { try { await access(resolve(root, dirname(file), `${path}.gz`)); } catch { broken.push({ file, link }); } }
  }
}
await jsonWrite(`${evidence}/link-check.json`, { passed: broken.length === 0, checked, documents, broken, boundary: 'Current local relative file links only; external reachability/anchors not asserted.' });
expect(broken).toEqual([]);

const projectFiles = ['.gitignore', '.env.example', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'vercel.json', 'index.html', 'README.md', 'CREDITS.md', ...(await readdir(root)).filter(file => /^playwright.*\.ts$/.test(file))];
const forbiddenNames = new Set(['.git', '.arena', 'node_modules', 'dist', 'uploads', '.git-credentials', '.netrc', '.env']);
async function walk(dir) {
  for (const entry of await readdir(resolve(root, dir), { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (forbiddenNames.has(entry.name) || entry.name.startsWith('.env.') && entry.name !== '.env.example') throw new Error(`Forbidden handoff path: ${file}`);
    if (entry.isDirectory()) await walk(file); else if (entry.isFile()) projectFiles.push(file); else throw new Error(`Non-regular handoff path: ${file}`);
  }
}
for (const dir of ['.github', 'src', 'tools', 'docs', 'assets', 'public', 'tests']) await walk(dir);
const findings = [], rules = [
  ['GitHub credential pattern', /(?:github_pat_[A-Za-z0-9_]{40,}|gh[pousr]_[A-Za-z0-9]{24,})/],
  ['Private-key header', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Credential-bearing HTTP URL', /https?:\/\/[^\s/:@]+:[^\s/@]+@/],
];
const reviewedNonsecretFixtures = [];
// Exact deliberately-invalid URLs in the negative validation tests, never real credentials.
// Only these quoted literals in this one test file are exempted from the generic URL rule.
const negativeUrlFixtures = ['https://user:secret@example.com/live', 'https://user:pass@youtube.com/watch?v=M7lc1UVf-VE'];
let scanned = 0;
for (const file of projectFiles) if (['.ts', '.js', '.mjs', '.py', '.json', '.md', '.txt', '.yml', '.yaml', '.html', '.svg', '.log', '.example', '.sh'].includes(extname(file)) || /\.(?:json|log)\.gz$/.test(file)) {
  scanned++; const bytes = await readFile(resolve(root, file)); const text = /\.(?:json|log)\.gz$/.test(file) ? gunzipSync(bytes).toString() : bytes.toString();
  // Exclude the literal expressions defining this scanner; no values are ignored.
  if (file === 'tools/check-handoff.mjs') continue;
  let scanText = text;
  if (file === 'tests/unit/city-life.test.ts') for (const fixture of negativeUrlFixtures) {
    const quoted = `'${fixture}'`;
    if (scanText.includes(quoted)) { reviewedNonsecretFixtures.push({ file, fixtureWithoutUserinfo: fixture.replace(/\/\/[^@]+@/, '//'), reason: 'Exact negative URL validation assertion with invented userinfo; dummy userinfo omitted from this report.' }); scanText = scanText.replaceAll(quoted, "'reviewed-invalid-URL-fixture'"); }
  }
  for (const [rule, pattern] of rules) if (pattern.test(scanText)) findings.push({ file, rule });
}
await jsonWrite(`${evidence}/source-safety-check.json`, { passed: findings.length === 0, allowlistedFiles: projectFiles.length, textFilesScanned: scanned, reviewedNonsecretFixtures, findings, boundary: 'Explicit path allowlist and known credential patterns; two exact negative-test URL literals are reviewed above. Not an exhaustive security audit.' });
expect(findings).toEqual([]);

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await context.setOffline(true);
const page = await context.newPage(), networkRequests = [], errors = [];
page.on('request', r => { if (/^https?:/.test(r.url())) networkRequests.push(r.url()); }); page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(pathToFileURL(resolve(root, 'docs/PROGRESS-GALLERY.html')).href);
  await page.evaluate(async () => { for (const img of document.querySelectorAll('figure img')) img.loading = 'eager'; await document.fonts.ready; });
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('figure img')].filter(img => !img.complete || !img.naturalWidth).map(img => img.alt)), { timeout: 30000 }).toEqual([]);
  const captures = await page.locator('figure.shot').count(); expect(captures).toBeGreaterThanOrEqual(24);
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); expect(desktopOverflow).toBe(false);
  await page.screenshot({ path: `.arena/gallery-desktop-${pkg.version}.png` });
  await page.locator('.capture').first().click(); await expect(page.locator('dialog')).toBeVisible(); await page.keyboard.press('ArrowRight'); await expect(page.locator('#view-title')).toContainText(`2 / ${captures}`);
  const lightboxNext = await page.locator('#view-title').textContent(); await page.keyboard.press('Escape'); await expect(page.locator('dialog')).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => { document.activeElement?.blur(); scrollTo({ top: 0, behavior: 'instant' }); });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); expect(mobileOverflow).toBe(false);
  await page.screenshot({ path: `.arena/gallery-mobile-${pkg.version}.png` });
  await page.locator('.capture').first().click(); await expect(page.locator('dialog')).toBeVisible(); await page.locator('#next').click(); await expect(page.locator('#view-title')).toContainText(`2 / ${captures}`); await page.locator('#close').click();
  expect(networkRequests).toEqual([]); expect(errors).toEqual([]);
  await jsonWrite(`${evidence}/gallery-check.json`, { date: '2026-11-22', version: pkg.version, passed: true, captures, networkRequests, errors, desktopOverflow, mobileOverflow, lightboxNext, offline: true });
  console.log(`PASS handoff: ${captures} offline captures, desktop/mobile/lightbox; ${checked} current local links; ${scanned} allowlisted text files scanned.`);
} finally { await browser.close(); }
