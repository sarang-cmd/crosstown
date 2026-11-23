# Vercel production deployment

Deployed **2026-11-22 through the enabled Vercel connected app**.

- **Public game:** https://coastline-highline.vercel.app
- Training: https://coastline-highline.vercel.app/?training
- Preserved foundation: https://coastline-highline.vercel.app/?sandbox
- Project: `coastline-highline` / `prj_gd5kw1GBgtWqMseb5ETMgzrXpKir`
- Team: `sarang-dev` / `team_59dr7VIo7kdxnmJ9zpqSL0wv`
- Production deployment: `dpl_AN77CJEBLkcpMBdFDmVyJ2Xgq1c9`
- Vercel state: **READY / PROMOTED**, `aliasAssigned=true`, no alias error.
- Dashboard: https://vercel.com/sarang-dev/coastline-highline/AN77CJEBLkcpMBdFDmVyJ2Xgq1c9

## Verified, not just queued

The public primary alias returned anonymous **HTTP 200**, and every one of its **21 files** matched the SHA-256 of the tested local production build, including both workers, all three GLBs and the local fonts. [DEPLOYED-FILES.json](DEPLOYED-FILES.json) records the checks.

Five browser cases then ran against the actual HTTPS public site, not a local preview: WebGPU, forced WebGL 2, WebGPU-disabled fallback, full ordinary-speed physics pilot/save/ghost/night unlock, and the eight-checkpoint training route. All five passed with retries disabled. Final desktop, mobile, result/flight, night and training screenshots were inspected and retained in `docs/evidence/production-public-*`.

The team/immutable preview aliases are still protected by the account's inherited Vercel SSO policy. **Use the primary public URL above**, not `coastline-highline-sarang-dev.vercel.app` or the deployment-specific preview hostname. No unrelated project, domain, team security policy or environment secret was modified. The API's `public:false` build metadata does not mean the verified primary website requires login.

## How the connected-app transfer worked

The connector exposes inline small text deployment files but no separate binary-upload endpoint. A temporary server therefore served **only a gzip archive of public compiled `dist` files**, never source directories or credentials. A temporary HTTPS tunnel made it reachable to the Vercel builder.

A small `deploy.mjs` submitted through `create_deployment` fetched the archive, required its exact SHA-256, extracted `dist`, verified release version 0.3.0 and let Vercel store the static output. Build logs confirm:

```text
VERIFIED HIGHLINE 0.3.0 SHA256 f60ed9bee555d55d1d62447222f04f47fb12f0a2146e18296791b4f686346c94 1769979 bytes
Build Completed in /vercel/output [1s]
Deployment completed
```

The temporary transfer server and tunnel were stopped afterwards. **The running game has no dependency on them**: it runs from Vercel's stored JS/WASM, worker, model and font files. No Vercel token or secret was copied into the workspace/browser.

## Future deployments from source

The archive delivered with this task contains the full source, prepared assets, exact lockfile and `vercel.json`. For a normal next deployment, submit/import that full source to the existing project:

- Framework: Vite
- Install: `npm ci`
- Build: `npm run build`
- Output: `dist`
- Root: repository/project root
- No required environment variables; this scope contains no radio/login integration.

The project's saved build/install/output defaults were restored to those standard source settings after the initial prebuilt import. The root `vercel.json` also specifies the normal source build and safe static headers. Use the full source on a future redeploy; **do not redeploy only the old one-file transfer deployment**, whose deliberately retired one-time archive URL is no longer a build source. No Git repository was connected as part of this request.

Recheck a public deployment with:

```bash
npm ci
npm run build
npm run verify:deployed
xvfb-run -a npm run test:deployed
```

`DEPLOYMENT_URL=https://your-public-host.example` overrides the verification target. The file-integrity command expects that deployment to contain exactly the local build being checked; it does not upload anything or change Vercel. Target-hardware frame rate remains unverified; see [TESTING.md](TESTING.md).
