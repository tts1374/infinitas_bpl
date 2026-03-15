# codex-release-r2-latest-json

## Purpose
- Move Desktop release delivery to R2 static `channels/stable/latest.json` and remove KV-based latest resolution.
- Keep GitHub Releases as a public announcement page with links to R2 downloads only.

## Non-goals
- No app runtime feature changes beyond updater endpoint wiring required for this migration.
- No multi-target expansion beyond `windows-x86_64`.

## Changes
- Update `.github/workflows/release-desktop.yml` to split into `release` and `github_release` jobs.
- Remove KV-related metadata, env vars, upload/update/verification steps from the release flow.
- Generate and publish `channels/stable/latest.json` after R2 artifact upload.
- Keep release object layout under `releases/<version>/<target>/...`.

## Impact
- Users: download links are consistently served from R2.
- Data: `channels/stable/latest.json` is newly published and used by updater checks.
- Compatibility: updater latest lookup changes from KV to static JSON on R2.
- Cloudflare: KV latest workflow path is removed from the desktop release pipeline.

## Target Files / Layers
- Files: `.github/workflows/release-desktop.yml`, `scripts/release/collect-updater-artifacts.ps1`, `scripts/release/publish-updater-artifacts.ps1`, and other `scripts/release/*` files only if required.
- Layers: CI workflow and release scripts.

## Test Focus
- Validate metadata generation and R2 path format (`releases/<version>/<target>`).
- Validate generated `latest.json` fields: `version`, `notes`, `pub_date`, `platforms.windows-x86_64.url`, `platforms.windows-x86_64.signature`.
- Validate post-checks cover R2 artifacts plus `channels/stable/latest.json` and contain no KV checks.
- Validate diff scope and UTF-8 (no BOM) / LF safety.

## Rollback Plan
- Revert this change set to restore previous workflow behavior.
- Re-run the previous release workflow for subsequent releases if rollback is required.

## Commit Split Plan
1. Refactor release workflow for R2 static latest JSON + separate GitHub Release job.
2. Update release scripts to remove KV assumptions and support static latest JSON generation/verification.

## Checklist
- [x] Design doc alignment confirmed (not required for this local contract-preserving change)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed (where executable in this environment)
- [x] Regression checks completed
- [x] Documentation updates completed (release docs only)
