# Crosstown · deployment and private repository

## Current verified release

**22 November 2026 · deployed 0.9.0 / 09.001 · Steps 01–09 prototype.** The renamed public site serves the exact tested build. All **189/189 anonymous public-file SHA-256 checks pass**, including a repeat after both temporary transfer processes were stopped. Public browser checks **5/5** and the separate real car/cockpit/audio/mirror/exit smoke pass. This is functional hosting verification, not native 60 FPS or traffic-fairness acceptance.

| Resource | Observed state |
|:--|:--|
| Public game | https://crosstown-sarang-dev.vercel.app |
| Handling lab | https://crosstown-sarang-dev.vercel.app/?drive |
| Training / foundation | `/?training` / `/?sandbox` on the same public host |
| Project / scope | Existing `crosstown`, `prj_gd5kw1GBgtWqMseb5ETMgzrXpKir`, team `team_59dr7VIo7kdxnmJ9zpqSL0wv` |
| Domain rename | New branded domain verified and anonymously serving **0.9.0 / 09.001**. No second project/domain creation |
| Legacy address | `coastline-highline.vercel.app` remains an assigned working bookmark alias; no destructive removal |
| Production deployment | `dpl_CGHF6xxuyPmeXv6cZjVVi7Yq2Mmt`, **READY / PROMOTED**, alias assigned, no alias error |
| Dashboard | https://vercel.com/sarang-dev/crosstown/CGHF6xxuyPmeXv6cZjVVi7Yq2Mmt |
| Public output | **189/189** anonymous 200 + SHA-256 matches before and after transfer shutdown; `DEPLOYED-FILES.json`, `PUBLIC-BUILD.json` |
| Compiled archive | **12,548,166 B**, SHA-256 `a4ac64d518dcc0d5a87c5107a95bd8198e4994d97446ff1ecabb601e96c1a787`; independent local/HTTPS roundtrips and Vercel builder checksum confirmation |
| Public browser / car smoke | **5/5** selected public cases; separate actual drive, samples, mirror pixels and E-key exit; zero runtime errors |
| Temporary transfer | **Tunnel and server stopped**; every permanent public hash checked again afterward |
| Normal source settings | Confirmed after deployment: Vite, `npm ci`, `npm run build`, `dist`, project root; SSO unchanged |
| Native/human acceptance | Near60 FPS/traffic fairness/physical input/listening remain open regardless of deployment status |

Evidence: [VERCEL metadata](VERCEL.json), [anonymous public inventory](DEPLOYED-FILES.json), [tested compiled inventory](PUBLIC-BUILD.json), [verification](TESTING.md), `evidence/crosstown-0.9.0/vercel-build-excerpt.log`, the two named `deployed-files-{before,after}-transfer-shutdown.json` inventories and actual public browser/car reports. Historical [0.7 deployment notes](DEPLOYMENT-0.7.0.md), `VERCEL-0.7.0.json` and `DEPLOYED-FILES-0.7.0.json` remain separate; they are not substituted for 0.9 checks.

The user requested a public-address rename. The existing project was already called Crosstown; **crosstown-sarang-dev.vercel.app** is now the documented primary address, while old bookmarks remain valid. Existing account/team/generated-host `all_except_custom_domains` SSO protection was **not weakened or bypassed**. `public:false` deployment metadata is not anonymous-access evidence either way: the exact public alias's anonymous bytes and real browser checks establish that boundary.

## How the public output was transferred

The connected Vercel tool accepts small text descriptor files, but does not expose a separate binary-upload operation for the many GLB/WAV/font/build assets. The existing private GitHub source repository has not been pushed. This release therefore used a **new, one-time, checksum-pinned import of the locally built and tested public `dist` output**, not an invented source push or Vercel source compilation.

`tools/prepare-public-release.mjs` inventories every public file, rejects nonregular paths/source maps, creates a deterministic `dist/` archive under `.arena`, checks archive paths and independently extracts/compares every hash. `tools/serve-release.mjs` exposes **only that one compiled archive and nonsecret ready metadata**, never directories, private source, uploads, home state or environment values. A temporary HTTPS tunnel was used only for transfer; its independent download matched the archive byte-for-byte before submission.

Three small text files were explicitly base64-encoded for the connector; no large/binary asset bytes were inlined. The builder checked archive length, SHA-256, safe archive paths and release metadata before extraction. Observed builder text:

```text
VERIFIED CROSSTOWN 0.9.0 / 09.001 SHA256 a4ac64d518dcc0d5a87c5107a95bd8198e4994d97446ff1ecabb601e96c1a787 12548166 bytes
Build Completed in /vercel/output [5s]
Deployment completed
```

Both transfer processes are now **stopped**. All 189 permanent public hashes pass afterward, so the game does not depend on either process or the temporary URL. `.arena` descriptors/archives are not packaged as project source.

**Never redeploy a retired historical or current one-time descriptor.** Its transfer URL is intentionally temporary. A future release must use reviewed source/lockfile/assets or a newly built, tested and independently verified public-output transfer.

## Normal source settings

| Setting | Value |
|:--|:--|
| Framework | Vite |
| Install | `npm ci` |
| Build | `npm run build` |
| Output | `dist` |
| Root | Project root |
| Required runtime application environment variables | None for Steps 01–09 |

The one-time import used an explicit per-deployment install/build override. Normal source defaults were restored/confirmed afterward **without a rename**. That is not a claim the transfer contains the whole source repository. No access-protection, ownership or visibility changes were required.

## Existing private GitHub repository

**[sarang-cmd/crosstown](https://github.com/sarang-cmd/crosstown)** already exists as the user's **private** repository, ID **1467794178**. Creation and ten topics previously succeeded with explicitly authorized transient authentication; the credential was never saved in source, logs, a remote URL or a credential file. `GITHUB.json` records the nonsecret result. **Do not recreate/delete it or change visibility.**

Current source push remains blocked on secure authentication and a reviewed local `main` commit. No hosted CI pass is claimed. `.github/repository.json` prepares the twelve-vehicle/traffic description and new homepage; that local file is not proof of applied server-side metadata. The workflow includes units/assets/pins/build, earlier browser checks and separate vehicle/fleet jobs, but has not run on GitHub.

After secure `gh` authentication and review, `tools/publish-github.sh` validates the exact existing repository ID/private state, clean `main` and matching origin, then performs a normal **non-force** push. It never creates/deletes a repository. Do not put a token in chat, source, a Git remote URL, `.env`, manifests or the portable archive. Do not blindly `git add` the user's whole home directory.

## Read-only recheck

```bash
npm ci
npm run build
npm run verify:deployed
xvfb-run -a npm run test:deployed
xvfb-run -a node tools/smoke-public-car.mjs
```

Omit Xvfb on a desktop. Checks default to the renamed public address; `DEPLOYMENT_URL` can override it with a credential-free public HTTPS host. Integrity expects the **exact** local public output, not merely an equivalent build with different Vite hashes. No login/protection bypass is attempted. Functional deployment success does not accept the remaining hardware, fairness, handling or listening gates.
