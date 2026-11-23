# Crosstown · publishing & production

## Current connected-app deployment

**2026-11-22 · 0.5.0 · Steps 01–05 prototype.** The existing Vercel project was renamed to **`crosstown`**, preserving its established public address so bookmarks still work:

- **Public game:** https://coastline-highline.vercel.app
- Training: https://coastline-highline.vercel.app/?training
- Original foundation: https://coastline-highline.vercel.app/?sandbox
- Vercel project: `crosstown` / `prj_gd5kw1GBgtWqMseb5ETMgzrXpKir`
- Team: `sarang-dev` / `team_59dr7VIo7kdxnmJ9zpqSL0wv`
- Production deployment: **`dpl_9oYzAnnu38B6iihCXVsVJK2M29q7`**
- Observed state: **READY / PROMOTED**, `aliasAssigned=true`, no alias error.
- Dashboard: https://vercel.com/sarang-dev/crosstown/9oYzAnnu38B6iihCXVsVJK2M29q7

The primary alias is the intended public link. The team/generated preview host inherits account SSO protection; it is not a replacement public URL. No unrelated domain, security policy, environment secret or project was changed. Final anonymous file hashes and real public browser results are recorded in [DEPLOYED-FILES.json](DEPLOYED-FILES.json), [TEST-RESULTS.json](TEST-RESULTS.json) and `evidence/crosstown-0.5.0/`.

### Transfer and reproducibility boundary

The connected app does not expose a separate binary upload endpoint. A temporary server/tunnel therefore served **only the current tested public compiled output**, never source directories, uploads, credentials or private configuration. A new one-time import fetched the archive and checked its exact byte length, SHA-256 and `Crosstown` / `0.5.0` release metadata before extraction. This did **not** redeploy the retired 0.3.0 bootstrap.

```text
Crosstown 0.5.0 public compiled archive
22 files · 1,802,763 bytes
SHA-256 be7cf23cef1a7485fbf5dff76bc6d89002bbc1a94d12efb6e7adab37c9be8158
VERIFIED CROSSTOWN 0.5.0 SHA256 be7cf23cef1a7485fbf5dff76bc6d89002bbc1a94d12efb6e7adab37c9be8158 1802763 bytes
Build Completed in /vercel/output [1s]
Deployment completed
```

A connector serialization error rejected plain inline `package.json` data as a non-string. Explicit base64 encoding of that **small text file** resolved it; no large or binary assets were inlined. The current release archive was independently downloaded/hash-checked before submission. The temporary transfer is shut down after verification; the deployed game has no runtime dependency on it.

**Do not redeploy either one-file transfer source.** Their intentionally retired URLs are not a source build. For every future release use the full source/lockfile/prepared assets in this handoff or the intended GitHub repository. Project defaults and the included `vercel.json` are restored to:

| Setting | Value |
|---|---|
| Framework | Vite |
| Install | `npm ci` |
| Build | `npm run build` |
| Output | `dist` |
| Root | Repository/project root |
| Required environment variables | None for Steps 01–05 |

The previous release's deployment report is [DEPLOYMENT-0.3.0.md](DEPLOYMENT-0.3.0.md). Its old file hashes remain at `DEPLOYED-FILES-0.3.0.json`; they are not current-release evidence.

## GitHub — prepared, not published

Chosen repository: **`crosstown`**. **No remote repository has been created or pushed.** GitHub connector lookup returned unsupported, and no authenticated CLI or secure token was available. Do not paste a credential into chat or put one in a file/remote URL. The previously exposed credential was neither saved nor used and should be revoked at its issuer.

Prepared description:

> A stylized coastal city to cross on foot and above the rooftops. Built with Three.js WebGPU, TypeScript and Rapier.

Prepared topics:

`threejs` · `webgpu` · `webgl2` · `typescript` · `rapier` · `parkour` · `open-world` · `procedural-generation` · `vite` · `browser-game`

Machine-readable metadata lives in `.github/repository.json`. README/badges, the bug-report issue form and a checks workflow are included. A local Git bundle/source archive is a handoff, **not** proof of a GitHub connection or hosted CI pass.

### Secure publish after authentication

With GitHub CLI installed, securely sign in using its browser/device flow:

```bash
gh auth login --web --git-protocol https
# From the reviewed local repository / cloned Git bundle:
bash tools/publish-github.sh
```

The script creates a **private-by-default** repository for the authenticated account, pushes the current local commit and applies the requested description/topics. It refuses to replace an existing `origin` or overwrite an existing `owner/crosstown` repository. Set `VISIBILITY=public` only if you want public source. Repository owner/IDs are discovered from the authenticated account, never invented.

If using the source ZIP instead of the Git bundle, first review the files, run `git init -b main`, explicitly add the project source/config/assets/docs/tests, and create a local commit with your own Git author configuration. Do not blindly add an entire home directory or local secrets.

## Verify a public release

```bash
npm ci
npm run build
npm run verify:deployed
xvfb-run -a npm run test:deployed
```

`DEPLOYMENT_URL=https://your-public-host.example` overrides the public integrity/browser target. The hash check expects **exactly the tested local build** and performs no upload or deployment mutation. It requires anonymous 200 responses; it does not bypass SSO. Target-GPU FPS, full-map flight and visual polish remain open in [FINDINGS.md](FINDINGS.md), regardless of deployment success.
