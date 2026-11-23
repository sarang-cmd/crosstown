# Crosstown · publishing and production

## Current verified release

**22 November 2026 · 0.7.0 / build 07.001 · Steps 01–07 prototype.** The existing Vercel project and established public address are retained.

| Item | Observed value |
|:--|:--|
| Public game | https://coastline-highline.vercel.app |
| Handling lab | https://coastline-highline.vercel.app/?drive |
| Training / foundation | `/?training` / `/?sandbox` on the same public host |
| Project | `crosstown` / `prj_gd5kw1GBgtWqMseb5ETMgzrXpKir` |
| Team | `sarang-dev` / `team_59dr7VIo7kdxnmJ9zpqSL0wv` |
| Production deployment | `dpl_4FNdWnzTuzhbpnp3ZVPYS7cCLRjm` |
| Connector-observed state | **READY / PROMOTED**, `aliasAssigned=true`, no alias error |
| Dashboard | https://vercel.com/sarang-dev/crosstown/4FNdWnzTuzhbpnp3ZVPYS7cCLRjm |
| Anonymous integrity | **77/77** public-file SHA-256 matches; repeated after transfer shutdown |
| Public browser checks | **5/5** earlier-feature regressions, plus the public sedan/cockpit/audio/mirror/exit smoke |

The primary alias is public. Team/generated hosts retain the account's existing SSO protection; no access-control or domain changes were made. The `public:false` deployment metadata does not mean the primary public alias was protected: anonymous 200/hash and real browser checks establish that boundary. [DEPLOYED-FILES.json](DEPLOYED-FILES.json), [VERCEL.json](VERCEL.json), [TESTING.md](TESTING.md) and `evidence/crosstown-0.7.0/` retain the evidence.

## How this refresh was transferred

GitHub authentication was no longer available for a source push. The connected Vercel app also has no separate binary-upload endpoint, and binary files must not be inlined in tool arguments. A **new**, one-time, checksum-pinned import therefore transferred only the locally tested **public compiled output**. This was not a redeploy of the retired 0.5 bootstrap.

```text
Crosstown 0.7.0 / 07.001 public compiled archive
77 files · 5,312,752 bytes
SHA-256 89c328bb1046b7948f6e3c46280a35f66365f88cfbf7a8e40e322d332eccaa08
VERIFIED CROSSTOWN 0.7.0 / 07.001 SHA256 89c328bb1046b7948f6e3c46280a35f66365f88cfbf7a8e40e322d332eccaa08 5312752 bytes
Build Completed in /vercel/output [6s]
Deployment completed
```

The fresh transfer was independently downloaded and hash-checked before submission. Its server exposed **only that public archive/ready metadata**, never project source, uploads, secrets or directory listings. The descriptor's two small text files were explicitly base64-encoded; no large/binary asset bytes were inlined. Vercel checked length/hash/release metadata before extracting the existing tested build. This is a compiled-output deployment, **not proof that Vercel compiled the full source or that GitHub CI ran**.

Both temporary server and tunnel are **stopped**. All 77 public hashes were checked again afterward, so the deployed game does not rely on the transfer staying up. **Do not redeploy any historical or current one-time import source:** its URL is intentionally retired. Future deployments must use the reviewed full source/lockfile/assets or a newly verified build transfer.

Project defaults were restored and confirmed by the connected app:

| Setting | Normal source build |
|:--|:--|
| Framework / root | Vite / project root |
| Install | `npm ci` |
| Build | `npm run build` |
| Output | `dist` |
| Required application environment variables | None for Steps 01–07 |

An idempotent settings call that also repeated the existing project name returned a 409 name conflict; retrying **without a rename** successfully restored these settings. No duplicate project was created. Deployment/metadata evidence contains no secret values.

Historical release reports: [DEPLOYMENT-0.5.0.md](DEPLOYMENT-0.5.0.md), [DEPLOYMENT-0.3.0.md](DEPLOYMENT-0.3.0.md). Their hashes/results are historical, not current-release verification.

## GitHub · existing repository, source push pending

**[sarang-cmd/crosstown](https://github.com/sarang-cmd/crosstown)** already exists as the user's **private** repository, ID **1467794178**. Creation and ten topics succeeded using the explicitly authorized transient token; the token was never saved in source, logs, a remote URL or credential file. `docs/GITHUB.json` records the non-secret result. Do not recreate or delete this repository.

The connector reports unsupported; there is currently no authenticated GitHub CLI or named token environment variable available in this workspace. Therefore **no source commit/push, remote CI pass or Vercel Git linkage is claimed**. This does not undo the successful repository creation or the separate Vercel refresh.

After secure authentication and a reviewed local `main` commit:

```bash
gh auth login --web --git-protocol https
bash tools/publish-github.sh
```

The publisher reads the approved repository name/ID, verifies the authenticated owner and private repository, checks a clean reviewed `main`, accepts only a matching clean origin, then performs a **normal non-force push** using a transient credential helper. It never creates/deletes a repository or alters visibility. An unrelated origin or non-fast-forward is refused rather than overwritten.

There is no initialized local Git repository in this handoff. If starting from the ZIP, first review the source allowlist, then initialize Git, explicitly add the project files and create a commit using your own author configuration. **Never blindly `git add` the entire home directory.** Exclude archives, `.arena`, uploads, compiled/dependency/cache directories and credentials. `.github/workflows/checks.yml` includes source, earlier-feature browser and vehicle jobs, but inclusion is not a hosted pass.

## Recheck the public build

```bash
npm ci
npm run build
npm run verify:deployed
xvfb-run -a npm run test:deployed
xvfb-run -a node tools/smoke-public-car.mjs
```

`DEPLOYMENT_URL=https://your-approved-public-host.example` overrides the read-only target. The integrity check expects the **exact tested local output**, not a merely equivalent build with different Vite hashes. No login/SSO bypass is attempted. Functional hosting success does not accept physical GPU FPS, human handling/audio quality or full-map no-stall flight.
