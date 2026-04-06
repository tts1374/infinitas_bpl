# Phase / Spawn 運用テンプレート

## 1. 初回実行テンプレート（A/B開始用）

```md
XXXX.mdを読み、Phase判定とSpawn Gateを省略せず実行してください。
WORKFLOW.md を正本として、最初に実行プロファイル（Local-Fast / Standard / High-Risk）と Plan Mode要否を判定すること。
Plan Mode必須と判定された場合:
- Plan Modeが有効な環境では、Phase A/BをPlan Modeで進行し、未確定事項はrequest_user_inputで確認すること。
- Plan Modeが無効な環境では、同等内容を通常質問で確認し、No-delegate reasonと状態（READY/NOT_READY/WAITING_FOR_HUMAN_DECISION）を明記すること。
Plan Mode不要（Local-Fast）と判定された場合:
- Phase A-lite -> Phase C で進行してよい（Phase Bは省略可）。

Standard Spawn Gate（条件付き必須）:
- 実行プロファイルが Standard のときのみ適用すること。
- 次のいずれかに当てはまる場合は execution-coordinator をspawnすること。
  - 2レイヤ以上にまたがる
  - bounded task が曖昧
  - 実装が2タスク以上に分割される
  - 検証が型チェック以外へ広がる
- 次の条件を全て満たす場合のみ non-spawn で直実行可。
  - 単一レイヤ
  - 単一bounded task
  - contract-sensitive ではない
  - ローカル検証で完結
- non-spawn時は No-delegate reason を必ず明記すること。
- 実行中に契約影響やクロスレイヤ化が判明したら High-Risk に再分類すること。

High-Risk Spawn Gate（必須）:
- 実行プロファイルが High-Risk のときのみ適用すること。
- Phase B を完了し、execution-coordinator により bounded packet を確定すること。
- 実装担当をspawnすること。
  - client変更あり: front-implementer
  - worker変更あり: server-implementer
  - 両方あり: 両方
- 監査担当をspawnすること。
  - contract-auditor（必須）
  - implementation-auditor（必須）
- 必須ロール未spawnで COMPLETE を返してはならない。
- 例外的に非spawnとする場合は ESCALATION とし、No-delegate reason を明記すること。

C Kickoff Gate（Phase C開始前に必須）:
- 「プランを実施する」の直後に実装へ入らず、先に C Kickoff を実施すること。
- C Kickoff で次を必ず出力すること。
  - 実行プロファイル再判定（Local-Fast / Standard / High-Risk）
  - Spawn Gate 適用結果
  - delegation execution record
    - role
    - spawned: yes/no
    - objective
    - no-delegate reason（noの場合）
- 必須ロール未spawnの場合は BLOCKED を返して停止すること。
- 上記出力完了まで Phase C 実装を開始してはならない。

Replan Gate:
- Phase C/D中に次のいずれかが発生したら実装を停止し、Phase A/Bへ戻すこと。
  - 新たなcontract-sensitive変更が必要
  - in-scope外への拡張が必須
  - Blocker/Must fix解消に仕様判断が必要
  - 互換方針/依存/CI変更が必要
- 戻し時の状態は ESCALATION または WAITING_FOR_HUMAN_DECISION を明示すること。
- 合意が得られるまで Phase C/D を再開しないこと。

Issue: #XXX
達成したいこと: <1-2行>
非目的: <やらないこと|これから決める>
```

## 2. 再開テンプレート（Replan後の再始動用）

```md
XXXX.mdを読み、Phase判定とSpawn Gateを省略せず実行してください。
前回の停止理由: <理由>
今回の合意事項: <決まったこと>
未解決事項: <あれば>

WORKFLOW.md を正本として、実行プロファイル（Local-Fast / Standard / High-Risk）と Plan Mode要否を再判定すること。
Plan Mode必須と判定された場合:
- Plan Modeが有効な環境では、Phase A/BをPlan Modeで進行し、未確定事項はrequest_user_inputで確認すること。
- Plan Modeが無効な環境では、同等内容を通常質問で確認し、No-delegate reasonと状態（READY/NOT_READY/WAITING_FOR_HUMAN_DECISION）を明記すること。
Plan Mode不要（Local-Fast）と判定された場合:
- Phase A-lite -> Phase C で進行してよい（Phase Bは省略可）。
C Kickoff Gateを適用し、delegation execution recordの出力完了までPhase C実装を開始しないこと。

Issue: #XXX
達成したいこと: <1-2行>
非目的: <やらないこと|これから決める>
```

## 3. C/D開始テンプレート（A/B完了後）

```md
Issue #XXX を正本として、Phase C/D を実行してください。
WORKFLOW.md を運用プロトコルとして適用してください。

前提（A/B結果）:
- Phase A: READY
- Phase B: <READY | SKIPPED(Local-Fast)>
- 実行プロファイル: <Local-Fast / Standard / High-Risk>
- Plan Mode適用: <YES / NO>
- 実行境界ソース: <tasks/xxx.md | A-lite合意サマリ(Plan成果物なし)>
- High-Risk Spawn Gate: <APPLICABLE / NOT_APPLICABLE>
- No-delegate reason: <必要時のみ>

C Kickoff（実装開始前に必須）:
- 実行プロファイルを再判定
- Spawn Gate適用結果を出力
- delegation execution record を出力
  - role
  - spawned: yes/no
  - objective
  - no-delegate reason（noの場合）
- 必須ロール未spawnなら BLOCKED で停止

Phase C:
- 実行境界ソースで合意された bounded scope のみ実施
- Plan成果物がない場合は、C Kickoff 冒頭で A-lite合意サマリを再掲して境界を固定
- 検証を実施し、証跡を出力
- 状態を COMPLETE/BLOCKED/ESCALATION で明示

Phase D（C完了後は必須）:
- follow-up を P0/P1/P2/P3 で整理
- 今サイクル外項目を分離
- release影響入力（有無）を明示
- Issueをクローズする場合は `docs/issue_close_evidence_template.md` の証跡を記載
- 最終状態（COMPLETE/BLOCKED/ESCALATION）を明示

Replan Gate:
- 新たな contract-sensitive 変更、in-scope外拡張、Blocker/Must fixの仕様判断が必要になった場合は停止
- 状態を WAITING_FOR_HUMAN_DECISION または ESCALATION にして A/Bへ戻す
```

## 4. 運用メモ（短縮版）

- A/Bは原則Plan Mode、Local-Fastのみ例外。
- C/Dで Replan Gate 該当が出たら停止してA/Bへ戻す。
- High-Risk は implementer + auditor を必須spawnとする。
- Phase C は C Kickoff（spawn記録出力）完了まで開始禁止。
