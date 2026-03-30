# Phase / Spawn 運用テンプレート

## 1. 初回実行テンプレート（A/B開始用）

```md
XXXX.mdを読み、Phase判定とSpawn Gateを省略せず実行してください。
Plan Modeが有効な環境では、Phase A/BをPlan Modeで進行し、未確定事項はrequest_user_inputで確認すること。
Plan Modeが無効な環境では、同等内容を通常質問で確認し、No-delegate reasonと状態（READY/NOT_READY/WAITING_FOR_HUMAN_DECISION）を明記すること。

Standard Spawn Gate（条件付き必須）:
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
- execution-coordinator を実行すること（Phase B未実施なら必須）。
- 実装担当をspawnすること。
  - client変更あり: front-implementer
  - worker変更あり: server-implementer
  - 両方あり: 両方
- 監査担当をspawnすること。
  - contract-auditor（必須）
  - implementation-auditor（必須）
- 必須ロール未spawnで COMPLETE を返してはならない。
- 例外的に非spawnとする場合は ESCALATION とし、No-delegate reason を明記すること。

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

Plan Modeが有効な環境では、Phase A/BをPlan Modeで進行し、未確定事項はrequest_user_inputで確認すること。
Plan Modeが無効な環境では、同等内容を通常質問で確認し、No-delegate reasonと状態（READY/NOT_READY/WAITING_FOR_HUMAN_DECISION）を明記すること。

Issue: #XXX
達成したいこと: <1-2行>
非目的: <やらないこと|これから決める>
```

## 3. 運用メモ（短縮版）

- A/Bは原則Plan Mode、Local-Fastのみ例外。
- C/Dで Replan Gate 該当が出たら停止してA/Bへ戻す。
- High-Risk は implementer + auditor を必須spawnとする。
