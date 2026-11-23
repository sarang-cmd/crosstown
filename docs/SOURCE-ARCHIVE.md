# Portable source handoff · 0.14.0 / 14.002

`crosstown.zip`, regenerated with `npm run package`, is the runnable **source** handoff, not a deployment importer or source push. Extract it, use Node `^20.19.0` or `>=22.12.0`, then `npm ci` and `npm run dev`. Prepared models/fonts/audio are included. No Python, asset download or API key is required to play. Optional external radio has separate restrictions. Root `SHA256SUMS.txt` records the ZIP digest.

The [clean-source proof](evidence/crosstown-0.14.0/source-archive-build.json) builds a clean provisional allowlisted ZIP after verifying every runtime byte against the final before/after fingerprint. It runs clean install/build/model/pin audits and compares every built file against the **local 0.14 candidate**, not stale public 0.13. The final archive adds finished proof/docs/manifests but preserves exactly those runtime bytes; the packager checks them again. Historical 0.13 public equality is separate, not silently reused.

## Included

- All current source, pinned lockfile, Vite/TypeScript/Vercel configuration, prepared assets, reviewed source assets/licences, tests and release/asset tools. Only the nonsecret `.env.example` template; no environment values.
- Current implementation/testing/provider/deployment/limitations docs and historical readable summaries.
- **Every 0.14 report/log, all final candidate capture pixels**, the README Wren PNG and the self-contained historical gallery with all 26 embedded previews. Large reports/logs may be stored as `.gz`; `gzip -dc file.json.gz` restores original bytes/hash. [Compression audit](EVIDENCE-COMPRESSION.json) · [Historical PNG pixel audit](SCREENSHOT-LOSSLESS.json).
- `ARCHIVE-MANIFEST.json` lists bytes/SHA-256 for every other included entry. The packager refuses drift from the evidence manifest and independently extracts/hash-checks **every ZIP entry**, including the archive manifest, after writing.

## Deliberate ZIP-only exclusions

The persisted workspace has a size cap. To avoid duplicating large history in both the workspace and the rolling source ZIP, these are **inventory-only inside the ZIP**, never deleted from the shared workspace:

1. Raw historical **0.5 / 0.7 / 0.9 / 0.13** evidence trees (including their old capture pixels).
2. The same **51 supplemental historical PNGs** already excluded in 0.13, plus **25 full-resolution historical gallery PNGs**. The **26 embedded historical gallery previews** and the README Wren PNG remain bundled; all omitted originals stay unchanged in the workspace.
3. **86 explicitly inventoried intermediate Step 14 captures** from initial, pre-single-pass and mislocated Old Town attempts. Every 0.14 raw report/log and all final candidate captures remain included. The intermediate originals stay unchanged in the workspace, not recompressed or relabelled as final passes.

[SOURCE-ARCHIVE-EXCLUSIONS.json](SOURCE-ARCHIVE-EXCLUSIONS.json) pins each omitted supplemental/gallery/intermediate capture's exact bytes/SHA-256. `ARCHIVE-EXCLUSIONS.json` inside the ZIP inventories **every omitted path/size/hash**, including historical evidence trees. The export policy cannot accidentally omit a newly added final capture by a broad filename wildcard. The packager verifies all explicitly inventoried originals before excluding a duplicate copy.

Historical notes/summaries may link to these inventory-only raw files. Following all those historical raw-file links needs the full workspace rather than only this deliberately smaller ZIP. Exclusion is **not deletion, a changed observation or a current acceptance pass**. All 77 historical PNGs and fixed-name historical release ZIPs remain intact. The rolling `crosstown.zip` is replaced by the newest reviewed source archive.

`node_modules`, builds, uploads, `.arena`, local Git/home state, credentials and retired transfer descriptors are excluded. No importer or temporary transfer endpoint is needed to run the extracted game.

## Release boundary

`/` is the lightweight landing; `/play` immediately starts saved/default Quick; explicit setup/full and legacy root game queries/saves remain. **Local 0.14 is not deployed.** The production site remains separately verified 0.13. [DEPLOYMENT](DEPLOYMENT.md) · [HANDOFF](HANDOFF.md) · [TESTING](TESTING.md) · [FINDINGS](FINDINGS.md).

Native Radeon 840M 1080p60 / reported lag solved, strict traffic fairness, long driver-memory/whole-map soak, human visual/handling/listening and physical input acceptance remain open regardless of successful packaging or hosting.
