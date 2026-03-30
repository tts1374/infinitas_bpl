# apps/client AGENTS

## 0. Scope

`apps/client` は UI とローカル体験の責務を持つ。

対象:
- React/TypeScript UI
- client-side state
- WS client handling
- local settings/snapshot persistence
- source status 表示
- audio/notification
- Tauri bridge coordination

共通ガバナンス:
- root `AGENTS.md`
- `WORKFLOW.md`
- `QUALITY.md`
- `packages/shared/AGENTS.md`（sharedを触る場合）

---

## 1. Invariants

- サーバ authoritative state を client convenience で上書きしない
- host/non-host の操作境界を壊さない
- reconnect/resync/stale-local を authoritative 表示と混同しない
- source unavailable/degraded を隠蔽しない
- fallback result を authoritative result と混同しない
- parser authority を UI 側で再実装しない

---

## 2. Contract-sensitive Triggers

次は高リスク扱い:
- room-state 駆動UIの意味変更
- WS message type/payload 解釈変更
- settings/snapshot 互換変更
- source semantics 変更
- reconnect/recovery 意味変更

上記に該当する場合:
- Plan/監査要否は `WORKFLOW.md` に従う
- 検証は `QUALITY.md` の該当マトリクスを満たす

---

## 3. Validation Focus

client 変更時は最低限次を確認:
- state別レンダリング
- host/non-host 表示境界
- source failure 表示
- submission retry/duplicate 表示整合
- fallback と authoritative の区別
- 必要時の audio/notification cleanup