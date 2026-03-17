import type { SourceUnresolvedDialog } from "../stores/source-store";

interface SourceUnresolvedDialogProps {
  dialog: SourceUnresolvedDialog;
  onAction: (action: "accept" | "skip" | "close") => void;
}

function renderChartInfoBlock(
  label: string,
  chart: {
    title: string;
    playStyle: string;
    difficulty: string;
    metricLabel: string;
    metricValue: number | null;
  },
) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300">{label}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm text-gray-200">
        <dt className="text-gray-400">曲名</dt>
        <dd className="font-semibold">{chart.title}</dd>
        <dt className="text-gray-400">プレイスタイル</dt>
        <dd className="font-semibold">{chart.playStyle}</dd>
        <dt className="text-gray-400">難易度</dt>
        <dd className="font-semibold">{chart.difficulty}</dd>
        <dt className="text-gray-400">{chart.metricLabel}</dt>
        <dd className="font-semibold">{chart.metricValue === null ? "不明" : chart.metricValue}</dd>
      </dl>
    </div>
  );
}

export function SourceUnresolvedDialog({ dialog, onAction }: SourceUnresolvedDialogProps) {
  if (dialog.kind === "unresolved_alias") {
    return (
      <div
        className="fixed inset-0 z-[2900] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
        role="presentation"
      >
        <div
          className="w-full max-w-[720px] overflow-hidden rounded-3xl border border-amber-500/25 bg-[#18181b] shadow-[0_30px_90px_rgba(0,0,0,0.9)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="source-unresolved-title"
        >
          <div className="border-b border-white/10 p-6 text-center">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.35em] text-amber-300">inf-notebook</p>
            <h2 id="source-unresolved-title" className="text-2xl font-black tracking-tight text-white">
              登録先の譜面が一致しません
            </h2>
            <p className="mt-3 text-sm text-gray-300">受信したリザルトは現在の選曲情報と一致しません。</p>
            <p className="mt-1 text-sm text-gray-300">現在のラウンド譜面に対してこのスコアを登録しますか。</p>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-2">
            {renderChartInfoBlock("A. 現在の登録先", dialog.expectedTarget)}
            {renderChartInfoBlock("B. 受信リザルトの解釈結果", dialog.parsedResult)}
          </div>

          <div className="px-6 pb-2">
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
              C. {dialog.mismatchReason}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 p-6 pt-4">
            <button
              type="button"
              onClick={() => onAction("accept")}
              className="rounded-2xl bg-amber-500 py-4 text-xs font-black uppercase tracking-[0.2em] text-black transition-all hover:bg-amber-400"
            >
              登録する
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => onAction("skip")}
              className="rounded-2xl border border-white/20 bg-white/5 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-white/10"
            >
              今回は登録しない
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (dialog.kind === "resolved_partial") {
    return (
      <div
        className="fixed inset-0 z-[2900] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
        role="presentation"
      >
        <div
          className="w-full max-w-[560px] overflow-hidden rounded-3xl border border-slate-500/20 bg-[#18181b] shadow-[0_30px_90px_rgba(0,0,0,0.9)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="source-unresolved-title"
        >
          <div className="p-6 text-center">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.35em] text-slate-300">inf-notebook</p>
            <h2 id="source-unresolved-title" className="text-2xl font-black tracking-tight text-white">
              スコアを特定できませんでした
            </h2>
            <p className="mt-3 text-sm text-gray-300">曲は特定できましたが、対応する recent データを取得できませんでした。</p>
            <p className="mt-1 text-sm text-gray-300">今回の登録は行いません。</p>
            <p className="mt-1 text-sm text-gray-300">再度リザルトを登録してください。</p>
          </div>

          <div className="px-6 pb-4">
            {renderChartInfoBlock("受信内容", dialog.chart)}
          </div>

          <div className="px-6 pb-6">
            <button
              type="button"
              autoFocus
              onClick={() => onAction("close")}
              className="w-full rounded-2xl bg-slate-200 py-4 text-xs font-black uppercase tracking-[0.2em] text-black transition-all hover:bg-white"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (dialog.kind === "unresolved_alias_catalog") {
    return (
      <div
        className="fixed inset-0 z-[2900] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
        role="presentation"
      >
        <div
          className="w-full max-w-[560px] overflow-hidden rounded-3xl border border-amber-500/20 bg-[#18181b] shadow-[0_30px_90px_rgba(0,0,0,0.9)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="source-unresolved-title"
        >
          <div className="p-6 text-center">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.35em] text-amber-300">inf-notebook</p>
            <h2 id="source-unresolved-title" className="text-2xl font-black tracking-tight text-white">
              譜面を特定できませんでした
            </h2>
            <p className="mt-3 text-sm text-gray-300">受信した曲情報から title_search_key を解決できませんでした。</p>
            <p className="mt-1 text-sm text-gray-300">今回の登録は行いません。曲名aliasの見直しをお願いします。</p>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-amber-300">
              エラーコード: {dialog.errorCode}
            </p>
          </div>

          <div className="px-6 pb-4">
            {renderChartInfoBlock("受信内容", dialog.chart)}
          </div>

          <div className="px-6 pb-6">
            <button
              type="button"
              autoFocus
              onClick={() => onAction("close")}
              className="w-full rounded-2xl bg-amber-300 py-4 text-xs font-black uppercase tracking-[0.2em] text-black transition-all hover:bg-amber-200"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[2900] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
      role="presentation"
    >
      <div
        className="w-full max-w-[560px] overflow-hidden rounded-3xl border border-red-500/20 bg-[#18181b] shadow-[0_30px_90px_rgba(0,0,0,0.9)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-unresolved-title"
      >
        <div className="p-6 text-center">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.35em] text-red-300">inf-notebook</p>
          <h2 id="source-unresolved-title" className="text-2xl font-black tracking-tight text-white">
            スコアを一意に特定できませんでした
          </h2>
          <p className="mt-3 text-sm text-gray-300">
            同一時刻の recent 候補が複数見つかったため、今回の登録は行いません。
          </p>
          <p className="mt-1 text-sm text-gray-300">
            この問題が続く場合は開発側での確認が必要です。
          </p>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-red-300">
            エラーコード: {dialog.errorCode}
          </p>
        </div>

        <div className="px-6 pb-4">
          {renderChartInfoBlock("受信内容", dialog.chart)}
          <p className="mt-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-200">
            候補数: <strong>{dialog.candidateCount}</strong>
          </p>
        </div>

        <div className="px-6 pb-6">
          <button
            type="button"
            autoFocus
            onClick={() => onAction("close")}
            className="w-full rounded-2xl bg-slate-200 py-4 text-xs font-black uppercase tracking-[0.2em] text-black transition-all hover:bg-white"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
