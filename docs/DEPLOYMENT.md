# Crosstown · current deployment and source handoff

## Local Step 14 candidate is not deployed

The current **source/rolling ZIP is 0.14.0 / 14.002**, with TSL lighting/effects and the quality scaler. This task did **not** publish that candidate. The production URL below remains the independently verified **0.13.0** release. Current local tests/benchmarks do not rewrite earlier public hashes, imply a source push or establish a native performance pass. See [Step 14](LIGHTING.md) and [current tests](TESTING.md).

## Verified public release

**0.13.0 / 13.001 · 22 November 2026 · Steps 01–13 prototype.** The existing public site now serves the new lightweight landing and immediate game. All **204/204 anonymous public-file SHA-256 checks pass before and after both temporary transfer processes were stopped**. A separate browser workflow follows the actual landing's normal `/play` link, with no debug game URL/hooks, and observes the new game HUD with no runtime/request failures. This is hosting/functional verification, **not proof the reported lag is solved**.

| Resource | Observed state |
|:--|:--|
| Landing | https://crosstown-sarang-dev.vercel.app |
| Immediate game / explicit choices | https://crosstown-sarang-dev.vercel.app/play · `/play?setup` |
| Legacy game links | `/?drive`, `?training`, `?length=full`, `?webgl`, etc. remain compatible |
| Existing project / team | `crosstown`, `prj_gd5kw1GBgtWqMseb5ETMgzrXpKir`, `team_59dr7VIo7kdxnmJ9zpqSL0wv` |
| Production deployment | `dpl_4jMtSU8oRbRUoB3MpUiMxTQVnnkR`, **READY / PROMOTED**, aliases assigned, no alias error |
| Dashboard | https://vercel.com/sarang-dev/crosstown/4jMtSU8oRbRUoB3MpUiMxTQVnnkR |
| Aliases | Primary `crosstown-sarang-dev.vercel.app`; retained `coastline-highline.vercel.app` bookmark alias |
| Public output | **204/204 anonymous 200 + SHA-256 matches**, repeated after transfer shutdown |
| Compiled archive | **12,850,153 B**; SHA-256 `b0b3249355ea2d747729928aa0227aef8d6ea1c38e142c3eacb361b227905947` |
| Independent checks | Local extraction + HTTPS download/extraction match all files; builder checksum line agrees |
| Public browser workflow | Responsive landing, actual Play link, normal immediate game, new wanted/health/radio/minimap elements, debug hooks absent; errors/request failures `[]` |
| Temporary transfer | **Tunnel and archive-only server stopped**; permanent public hashes pass afterward |
| Access controls | Existing `all_except_custom_domains` SSO policy unchanged; no access-control bypass or project/domain recreation |
| Normal source settings | Confirmed Vite, `npm ci`, `npm run build`, `dist`, project root; Git auto-deploy remains disabled |
| Open acceptance | Reported lag/native near60, strict traffic fairness, human handling/listening/devices, YouTube/SoundCloud playback/skip and authenticated Spotify |

Evidence: [VERCEL.json](VERCEL.json), [DEPLOYED-FILES.json](DEPLOYED-FILES.json), [PUBLIC-BUILD.json](PUBLIC-BUILD.json), `evidence/crosstown-0.13.0/deployed-files-{before,after}-transfer-shutdown.json`, `public-normal-play-smoke.json`, `public-transfer-roundtrip.json`, `transfer-retired.json` and `vercel-build-excerpt.log`. Historical [0.9 deployment](DEPLOYMENT-0.9.0.md) and versioned JSON remain separate, not substituted for new checks.

The generated deployment's `public:false` metadata is not anonymous-access proof either way. The intended permanent alias's actual anonymous bytes and browser workflow establish that boundary; existing team/generated-host protection was not weakened.

## What was deployed

The connector exposes small file descriptors but no separate large/binary upload operation. The private source repository has not been pushed. This release therefore used a **new, one-time, checksum-pinned import of already locally built/tested public `dist` output**, not an invented source push, hosted CI pass or Vercel source compilation.

`tools/prepare-public-release.mjs` inventories every public file, rejects nonregular paths/source maps, creates a deterministic `dist/` archive under `.arena`, validates paths and independently extracts/compares every file hash. `tools/serve-release.mjs` exposes only that one **public compiled archive** and nonsecret ready metadata—never directories, private source, uploads, local/home state or credentials. A new temporary HTTPS connection supplied an independent matching roundtrip.

Three small text descriptor files were explicitly base64-encoded for the connector, not large/binary assets. The first plain JSON-text descriptor call was rejected before deployment; the explicit text encoding resolved that API representation error. The builder checked archive length, SHA-256, safe paths and release identity before extraction. Observed builder excerpt:

```text
VERIFIED CROSSTOWN 0.13.0 / 13.001 SHA256 b0b3249355ea2d747729928aa0227aef8d6ea1c38e142c3eacb361b227905947 12850153 bytes
Build Completed in /vercel/output [4s]
Deployment completed
```

Both temporary processes are stopped. **Do not redeploy any retired one-time importer descriptor/deployment as a new build.** Its transfer URL is deliberately temporary. Future releases must use reviewed source/lockfile/assets or a newly prepared/tested/independently verified public-output transfer. Importer files/archives stay under excluded `.arena`, not inside the source ZIP.

## Normal source configuration

| Setting | Value |
|:--|:--|
| Framework | Vite |
| Install / build / output | `npm ci` / `npm run build` / `dist` |
| Root | Project root |
| Node locally | `^20.19.0` or `>=22.12.0` |
| Required app environment variables | None |
| Optional Spotify | Public `VITE_SPOTIFY_CLIENT_ID` only; keep disabled pending authorized account/API/terms approval; never a client secret |
| SPA returns | `/play`, `/play/` and `/callback` rewrite to `index.html` |

The normal source settings were restored/confirmed after this compiled-output deployment. [Radio setup](RADIO.md) includes exact loopback/production redirect instructions and the untested Premium/allowlist boundary. A saved source or SDK-ready state is not playback acceptance.

## Private source repository and ZIP

The existing private `sarang-cmd/crosstown` repository is not recreated/deleted or made public. **Source push remains pending secure authorized authentication; no hosted CI result is claimed.** The allowlisted local publishing helper validates the exact existing repository and never force-pushes or stores tokens in source.

`crosstown.zip` is a separate portable source handoff with prepared assets, current evidence, licences, original capture pixels and a verified per-file manifest. [Archive scope/exclusions](SOURCE-ARCHIVE.md) · [Handoff](HANDOFF.md) · [Testing](TESTING.md) · [Open findings](FINDINGS.md).
