# Portable source handoff · 0.13.0 / 13.001

`crosstown.zip`, regenerated with `npm run package`, is the current runnable **source** handoff, not the Vercel deployment importer or a source push. Extract it, use Node.js `^20.19.0` or `>=22.12.0`, then `npm ci` and `npm run dev`. Prepared models/fonts/audio are included. No Python, asset download or API key is required to play; optional external radio has separate restrictions. The root `SHA256SUMS.txt` records the ZIP digest. A clean extraction was installed and built successfully; all **204 output files match the published release byte-for-byte**. [Build proof](evidence/crosstown-0.13.0/source-archive-build.json) and its log identify the tested source-input fingerprint; the final package adds only that proof/notes/manifests to those same runtime inputs.

## Included

- All current application source, pinned lockfile, Vite/TypeScript/Vercel configuration, prepared assets, reviewed source assets/licences, tests and release/asset tools; only the nonsecret `.env.example` template.
- Current implementation/testing/provider/deployment/limitations notes, **all current 0.13 capture pixels**, the 26 full-resolution original PNGs selected for the historical gallery, and the smaller self-contained **historical** gallery itself.
- **All `docs/evidence/crosstown-0.13.0/` evidence**, including explicitly failed, unavailable, interrupted and debug attempts. Large JSON/logs may be losslessly stored as `.gz`; `gzip -dc file.json.gz` restores the original bytes. The release summarizer reads either form. [Compression audit](EVIDENCE-COMPRESSION.json) · [PNG pixel-identity audit](SCREENSHOT-LOSSLESS.json).
- An `ARCHIVE-MANIFEST.json` with bytes/SHA-256 for every other included entry. The packager refuses drift from the evidence manifest and extracts/hash-checks **every ZIP entry**, including that manifest, after writing it.

## Deliberate archive-only exclusions

To avoid another multi-megabyte copy under the shared-workspace snapshot cap, raw **0.5, 0.7 and 0.9** evidence trees and **51 supplemental historical PNGs** are not duplicated inside this rolling ZIP. All remain byte-identical in the shared workspace. The 26 historical gallery originals remain included. The supplemental PNG exclusion list is explicit and hash-pinned in [SOURCE-ARCHIVE-EXCLUSIONS.json](SOURCE-ARCHIVE-EXCLUSIONS.json); newly added current captures are not automatically excluded.

`ARCHIVE-EXCLUSIONS.json` inside the ZIP records every omitted path, byte count and SHA-256. Historical summaries and the offline embedded gallery stay included; older notes may link to raw reports or supplemental PNGs available in the workspace rather than this ZIP. These historical-file link checks need the full workspace, not just this deliberately smaller archive.

Exclusion is **not deletion or a changed test result**. All 77 historical PNGs and fixed-name historical release ZIPs stay unchanged in the workspace. The rolling `crosstown.zip` is replaced by the latest packaged source. `node_modules`, builds, uploads, `.arena`, local Git/home state, credentials, environment values and all retired one-time transfer descriptors are excluded.

The landing is `/`; the immediate game is `/play`; legacy root game queries still work. [HANDOFF](HANDOFF.md), [TESTING](TESTING.md), [FINDINGS](FINDINGS.md) and [DEPLOYMENT](DEPLOYMENT.md) distinguish local verification, actual public state and unfinished acceptance. **Reported lag/native near-60 FPS, strict traffic fairness, physical input/human handling and listening remain open**, regardless of packaging/deployment success.
