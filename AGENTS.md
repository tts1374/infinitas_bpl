# AGENTS.md

## 0. Governance

This project is governed by the following documents:

- AGENTS.md (execution constraints)
- WORKFLOW.md (planning and PR rules)
- QUALITY.md (acceptance criteria)

If any conflict occurs, **AGENTS.md** takes precedence for execution rules.

### Branch
- Default working branch is **`v1`** (not `main`).
- Unless explicitly instructed otherwise, all work/PRs must use **`v1`** as the base branch.

---

## 1. System Architecture (Ph1)

### 1.1 Client
- Tauri 2 + React + TypeScript (Vite)
- Local file watching/parsing in Rust; UI + WS + audio + local storage in TS.

### 1.2 Server
- Cloudflare Workers (HTTP entry)
- Durable Objects (Room FSM + timers + aggregation + WS broadcast)
- Cloudflare KV (Lobby list lightweight metadata only)

### 1.3 Sources (fixed per device)
- `inf_daken_counter` (today_update.xml)
- `inf-notebook` (export/recent.json; records/recent.json optional)

Source is selected before joining a room and MUST NOT be changed while in a room.

---

## 2. Spec Sources of Truth

These design docs are normative. Implementation MUST match them.

- docs/design/01_fsm.md
- docs/design/02_ws_protocol.md
- docs/design/03_data_model.md
- docs/design/04_tech_stack.md
- docs/design/05_screen_list.md
- docs/design/06_source_io_spec.md
- docs/design/07_constants.md
- docs/design/08_repo_structure.md
- docs/design/09_implementation_plan.md (Ph1 plan; freeze after Ph1 done)

Rule:
- If implementation must deviate, update the relevant design doc(s) first, then implement.

---

## 3. WORKFLOW Enforcement (MANDATORY)

WORKFLOW.md is not optional guidance.

If any of the Plan-mode gate conditions apply, implementation MUST NOT begin until
the planning procedure is completed.

### 3.1 Plan-mode gate（該当したら実装開始禁止）

Plan-mode is mandatory when any of the following apply:

- 作業が複数ステップにまたがる変更
- アーキテクチャ変更 / 責務再分割 / データモデル変更（Room/FSM/WS schema含む）
- 互換性に影響する変更（client settings, saved results JSON, KV schema）
- Durable Objects の状態/タイマー/FSM/集計ロジックの変更
- WebSocket プロトコル（message type/payload）変更
- 監視ソース（inf_daken_counter / inf-notebook）のI/O仕様変更
- CI/CD（.github/workflows）変更
- デプロイ方式変更（Workers/DO/KV/Wrangler）
- 依存関係更新（lockfile含む）
- セキュリティ・再現性・整合性に影響する可能性がある変更

### 3.2 Plan Procedure（必須）
Follow WORKFLOW.md. Additionally:

- Plan file: `tasks/<branch-or-topic>.md` MUST include:
  - 目的 / 非目的
  - 変更点（箇条書き）
  - 影響範囲（ユーザー / データ / 互換性 / Cloudflare resources）
  - 実装方針（対象ファイル単位）
  - テスト観点（E2E: 2人 ARENA/BPL の通し、監視2ソース、TIMEOUT/強制進行）
  - ロールバック方針
  - Commit Plan（コミット分割計画）

---

## 4. Work Isolation (MANDATORY)

### 4.1 worktree
- すべての作業は git worktree で物理分離する。
- 1 worktree = 1 branch = 1 purpose（1PR1目的）
- 作業開始時に worktree パスと BASE_SHA を宣言する。

### 4.2 Base SHA fixed
- 作業開始時に BASE_SHA を明示し、PR完了まで固定する。
- 作業途中の rebase/merge を禁止（レビュー対応の例外が必要ならPlanに明記）。

---

## 5. Diff Discipline
- 変更対象ディレクトリ/ファイルを事前宣言する。
- 宣言外の変更は禁止。
- 無関係な整形・並び替え・リネームを行わない。
- 生成物（dist 等）を直接編集しない（生成はCI/ビルドで再生成）。

---

## 6. Cloudflare-specific Execution Rules

### 6.1 Worker vs DO responsibilities
- Worker routes must remain thin (routing + KV list).
- DO owns: FSM, timers, idempotency, expected_key enforcement, aggregation, broadcast.

### 6.2 Idempotency
- Client MUST send `client_msg_id` for every WS message.
- DO MUST de-duplicate by `(player_id, client_msg_id)`.

### 6.3 Lobby (KV)
- KV stores only lightweight metadata (no full room state, no secrets).
- `expires_at` is set at creation time; list API excludes expired entries.
- DO closure attempts KV deletion; list API still excludes by expires_at as safety.

### 6.4 Failure mode
- If DO state is lost, the room is closed with `ROOM_STATE_LOST` and clients show a blocking error dialog.
- Partial results are displayed from local snapshots.

---

## 7. Client-specific Execution Rules

### 7.1 Monitoring
- Monitoring is implemented in Rust (watcher + parser + new-event detection).
- TS layer only consumes structured events and submits via WS when:
  - `observed_key == expected_key`
  - `round_index == current_round_index`
  - player/round not already confirmed

### 7.2 Source failure
- If monitoring fails: show `SOURCE_UNAVAILABLE` and guide TECH-skip.
- No silent fallback (polling fallback is Ph2+ only).

### 7.3 Voice
- Local playback only.
- Clear queued audio and stop current audio on any state transition / room close.

---

## 8. READ / WRITE Protocol (Windows: UTF-8 strict)

目的: Windows起因の文字化け（UTF-16/CP932混入、BOM、改行コード揺れ）を作業プロセスで封じる。

### 8.1 Canonical Encoding Rules（このリポジトリの正解）
- テキストは **UTF-8（BOMなし）** が唯一の許容形式。
- 改行は **LF** が正。CRLFは例外扱い（許可する場合は対象ファイルを明記）。
- **UTF-16（LE/BE）禁止**。
- **CP932/Shift_JIS禁止**。

### 8.2 READ（読む時の原則）
- 表示が崩れる場合は **BOM/UTF-16/CP932** 混入を疑い、エンコーディングを確定してから処理する。
- BOM/UTF-16の存在自体を不具合とみなし、生成元を修正する。

判定基準:
- 先頭行だけ崩れる → BOM疑い
- 全文が記号になる → UTF-16/CP932疑い
- diffで全行変更 → CRLF/LF揺れ疑い

### 8.3 WRITE（書く時の原則）
- 書き込みは常に **UTF-8（BOMなし）** を明示する。
- 保存は原子的（テンポラリ→置換）。
- 書き込み後に必ず `git diff` で改行/エンコーディングの意図しない変化がないことを確認する。

### 8.4 Windows / PowerShell 注意
- PowerShell は既定エンコーディングがUTF-16寄りになり得るため、指定なし書き込み禁止。
- PowerShell: `Set-Content` / `Out-File` は UTF-8 指定必須
- Node/Python: encoding を明示

### 8.5 禁止事項（Violation = 修正してからコミット）
- UTF-16保存（LE/BE問わず）
- BOM付きUTF-8保存
- CRLF/LFの無断変更（必要なら対象と理由をPRに明記）
