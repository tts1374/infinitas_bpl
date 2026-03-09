- [ ] 設計確認
  docs/design の契約変更は前提にしない。今回は既存 WS schema を維持し、worker の BPL 進行条件と client 表示状態だけを調整する。

- [ ] 影響範囲特定
  目的:
  BPL room を mock 準拠の 3 stage 進行に寄せ、join reject / closed 表示と stage 演出を修正する。
  非目的:
  ARENA ルール変更、WS schema 追加、KV schema 変更、保存形式変更。
  変更点:
  1. BPL は 2 勝時点で終了せず、3 曲目終了後に final result へ入るよう DO の round progression を変更する。
  2. client は BPL 用の擬似表示 state を持ち、PICKING 後の選曲確定アニメーション、各曲後 10 秒の RESULT PHASE、最終 CLOSED(FINAL) を mock 表示に合わせる。
  3. pick 情報表示を `title (difficulty short)` と artist 表示へ変更し、match history は完了 stage のみ描画する。
  4. `ROOM_CLOSED` join reject を文字列露出ではなくダイアログで表示する。
  影響範囲:
  ユーザー:
  BPL の見た目進行と終了条件が変わる。ARENA は演出以外触らない。
  データ:
  永続形式は変更しない。既存 snapshot/result_ready をそのまま利用する。
  互換性:
  既存 client/worker 間 schema は維持する。
  Cloudflare:
  Durable Object の BPL round 終了条件のみ変更。KV/route は変更しない。

- [ ] 対象ファイル / 対象レイヤ
  client:
  `apps/client/src/pages/RoomPage.tsx`
  `apps/client/src/stores/room-store.ts`
  worker:
  `apps/worker/src/durable/room-state.ts`
  補助確認:
  `packages/shared/src/...` は参照のみの想定。

- [ ] テスト観点
  1. BPL で 1 曲目終了後に次 round が開始されること。
  2. BPL で 2 曲目が 2-0 になっても final result に入らず 3 曲目へ進むこと。
  3. 3 曲目終了後に final result / room close に入ること。
  4. join reject `ROOM_CLOSED` が modal で表示されること。
  5. match history が完了 round のみ表示し、未開始 round を出さないこと。
  6. `npm --workspace @infinitas/client run typecheck` と worker の既存 test/ts check が通ること。

- [ ] ロールバック方針
  worker の BPL 終了条件変更を戻す。
  client の擬似表示 state と履歴整形を戻す。
  join reject 文言マッピングを戻す。

- [ ] コミット分割計画
  1. worker: BPL 3 stage progression fix
  2. client: BPL mock flow / history / title formatting
  3. client: join reject modal wording and final verification

BASE_SHA: `ee73811177ac78fbd252d39b2e8c848416e4d0a2`
