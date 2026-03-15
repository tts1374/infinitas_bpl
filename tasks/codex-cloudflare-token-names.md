# Plan: codex/cloudflare-token-names

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_arena`
- branch: `v1`
- base branch: `v1`
- BASE_SHA: `11b1a7eaf9a6616e3bfc7c9b3a2eb36ea823c839`

## 目的
- Cloudflare 用 GitHub Secrets 名を release 用と worker deploy 用で明確に分離する。
- LOBBY Worker deploy workflow と関連ドキュメントで `CLOUDFLARE_API_TOKEN_WORKER` を正として扱う。

## 非目的
- deploy フロー自体の変更。
- Cloudflare リソースや権限の見直し。
- desktop release の挙動変更。

## 変更点
- `.github/workflows/deploy-worker.yml` の worker deploy 用 secret 名を `CLOUDFLARE_API_TOKEN_WORKER` に変更する。
- `apps/worker/README.md` と `docs/release_preflight_checklist.md` の記載を同じ token 名へ揃える。

## 影響範囲
- ユーザー:
  - 直接影響なし。
- データ:
  - 変更なし。
- 互換性:
  - GitHub Secrets 名の前提が worker deploy 用専用 token へ揃う。
- Cloudflare:
  - Worker deploy workflow が参照する token 名のみ変更する。

## 対象ファイル / 対象レイヤ
- `.github/workflows/deploy-worker.yml`
- `apps/worker/README.md`
- `docs/release_preflight_checklist.md`
- `tasks/codex-cloudflare-token-names.md`

## テスト観点
- worker workflow が `CLOUDFLARE_API_TOKEN_WORKER` を参照している。
- release 用 token 名 `CLOUDFLARE_API_TOKEN_RELEASE` は維持される。
- docs の worker deploy 用 secret 名が workflow と一致する。

## ロールバック方針
- 上記 3 ファイルの token 名を元に戻す。

## Commit Plan（コミット分割計画）
1. token naming update plan 追加。
2. worker deploy workflow の secret 名更新。
3. 関連ドキュメント更新と検証結果反映。

## 検証結果
- [x] `rg -n "CLOUDFLARE_API_TOKEN_WORKER|CLOUDFLARE_API_TOKEN_RELEASE" .github apps docs tasks`
- [x] `git diff --check`
