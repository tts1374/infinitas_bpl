# issue-125-web-pages-workflow

## Purpose
- Add a manual GitHub Actions workflow to deploy `apps/web` static output to GitHub Pages.

## Non-goals
- Automatic trigger on push/tag.
- Changes to Worker/client deployment workflows.
- GitHub Pages source repository settings changes outside workflow file.

## Changes
- Add `.github/workflows/deploy-web-pages.yml`.
- Build `apps/web` with environment-aware base path for Pages.
- Upload `apps/web/dist` as Pages artifact and deploy via `actions/deploy-pages`.

## Impact
- Users: Enables manual publishing of LP/join web pages to GitHub Pages.
- Data: None.
- Compatibility: No app protocol/runtime compatibility impact.
- Cloudflare: None.

## Target Files / Layers
- Files:
  - `.github/workflows/deploy-web-pages.yml`
- Layers:
  - GitHub Actions / deployment

## Test Focus
- Workflow YAML validity.
- Build command consistency with repository scripts.
- Diff validation (only intended files, UTF-8 no BOM / LF).

## Rollback Plan
- Revert `.github/workflows/deploy-web-pages.yml`.

## Commit Split Plan
1. Add manual GitHub Pages deploy workflow for `apps/web`.

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)
