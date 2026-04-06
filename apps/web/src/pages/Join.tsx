import { AppWindow, Download, Eye, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import type { FC } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { attemptOpenDeepLink, buildJoinDeepLink } from "../lib/deeplink";
import { WEB_LINKS, WEB_RUNTIME } from "../lib/config";
import { fetchJoinRoomSummary, type JoinRoomSummary, type RecruitmentStatus } from "../lib/join-room";
import { logWebShareAnalytics } from "../lib/share-analytics";

type DeepLinkUiState = "idle" | "trying" | "launched" | "fallback";

interface StatusMeta {
  label: string;
  badgeClass: string;
  description: string;
}

const statusMetaMap: Record<RecruitmentStatus, StatusMeta> = {
  recruiting: {
    label: "募集中",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
    description: "このルームは現在参加を受け付けています。",
  },
  full: {
    label: "満員",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-400/30",
    description: "現在の募集枠は埋まっています。空きが出たら再度お試しください。",
  },
  closed: {
    label: "募集終了",
    badgeClass: "bg-slate-500/30 text-slate-200 border-slate-300/30",
    description: "このルームの募集は終了しました。",
  },
  expired: {
    label: "無効リンク",
    badgeClass: "bg-rose-500/20 text-rose-300 border-rose-400/30",
    description: "このリンクは使えません。新しい招待リンクを受け取ってください。",
  },
  unavailable: {
    label: "接続できません",
    badgeClass: "bg-orange-500/20 text-orange-200 border-orange-400/30",
    description: "ルーム情報を取得できませんでした。",
  },
};

const readRoomRef = (): string => {
  const raw = new URLSearchParams(window.location.search).get("r");
  return raw?.trim() ?? "";
};

const fallbackSummary: JoinRoomSummary = {
  roomName: "期限切れまたは無効な招待URL",
  status: "expired",
  isShareable: false,
  downloadUrl: WEB_LINKS.download,
};

export const JoinPage: FC = () => {
  const roomRef = useMemo(readRoomRef, []);
  const [summary, setSummary] = useState<JoinRoomSummary>(fallbackSummary);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(roomRef));
  const [deepLinkState, setDeepLinkState] = useState<DeepLinkUiState>("idle");
  const spectateUrl = useMemo(
    () => `${WEB_RUNTIME.basePath}spectate/?r=${encodeURIComponent(roomRef)}`,
    [roomRef],
  );

  const statusMeta = statusMetaMap[summary.status];

  const openInApp = useCallback(async (trigger: "auto" | "manual"): Promise<void> => {
    if (!roomRef) {
      setDeepLinkState("fallback");
      return;
    }

    logWebShareAnalytics("deep_link_attempted", {
      roomRef,
      trigger,
      phase: "start",
    });
    setDeepLinkState("trying");
    const result = await attemptOpenDeepLink(buildJoinDeepLink(roomRef));
    logWebShareAnalytics("deep_link_attempted", {
      roomRef,
      trigger,
      phase: "end",
      result,
    });
    setDeepLinkState(result);
  }, [roomRef]);

  useEffect(() => {
    if (!roomRef) {
      setSummary(fallbackSummary);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    void fetchJoinRoomSummary(roomRef, controller.signal).then((nextSummary) => {
      setSummary(nextSummary);
      setIsLoading(false);
    });

    return () => {
      controller.abort();
    };
  }, [roomRef]);

  useEffect(() => {
    logWebShareAnalytics("join_page_viewed", {
      roomRef,
      pathname: window.location.pathname,
    });
  }, [roomRef]);

  useEffect(() => {
    if (!roomRef) {
      return;
    }

    const sessionKey = `join:auto-attempted:${roomRef}`;
    if (window.sessionStorage.getItem(sessionKey) === "1") {
      return;
    }

    window.sessionStorage.setItem(sessionKey, "1");
    void openInApp("auto");
  }, [openInApp, roomRef]);

  const deepLinkMessage = (() => {
    if (deepLinkState === "trying") {
      return "アプリ起動を試行中です...";
    }
    if (deepLinkState === "launched") {
      return "アプリを起動しました。アプリ側で参加状態をご確認ください。";
    }
    if (deepLinkState === "fallback") {
      return "起動に失敗した場合は、アプリ導入後にもう一度「アプリで開く」を押してください。";
    }
    return "ページ表示時にアプリ起動を自動で試行します。";
  })();

  const formattedUpdatedAt = useMemo(() => {
    if (!summary.updatedAtIso) {
      return "";
    }

    const date = new Date(summary.updatedAtIso);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }, [summary.updatedAtIso]);

  return (
    <div className="min-h-screen bg-[#111116] px-6 py-10 text-white selection:bg-cyan-500/30">
      <main className="mx-auto max-w-4xl space-y-8">
        <header className="rounded-3xl border border-white/10 bg-[#15151A] p-8 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
          <p className="mb-3 text-sm uppercase tracking-widest text-cyan-300">INFINITAS Arena Join</p>
          <h1 className="mb-4 text-3xl font-black md:text-4xl">参加ページ</h1>
          <p className="text-sm leading-relaxed text-gray-300 md:text-base">ルーム状態を確認して、アプリ参加またはブラウザ観戦へ進みます。</p>
        </header>

        <section className="rounded-3xl border border-cyan-500/20 bg-[#101018] p-8 shadow-[0_0_35px_rgba(6,182,212,0.12)]">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold">ルーム情報</h2>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}>
              {statusMeta.label}
            </span>
          </div>

          {isLoading ? (
            <p className="inline-flex items-center gap-2 text-sm text-gray-300">
              <LoaderCircle size={16} className="animate-spin" />
              ルーム情報を確認しています...
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">ルーム名</p>
                <p className="text-xl font-bold">{summary.roomName}</p>
              </div>
              <p className="text-sm text-gray-300">{statusMeta.description}</p>
              <p className="text-sm text-gray-400">募集状態: {statusMeta.label}</p>
              <p className="text-sm text-gray-400">
                共有可否: {summary.isShareable ? "共有可能" : "共有停止中"}
              </p>
              {formattedUpdatedAt ? <p className="text-xs text-gray-500">更新時刻: {formattedUpdatedAt}</p> : null}
            </div>
          )}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                void openInApp("manual");
              }}
              disabled={deepLinkState === "trying"}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 font-bold text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-700/50 disabled:text-gray-300"
            >
              {deepLinkState === "trying" ? <LoaderCircle size={18} className="animate-spin" /> : <AppWindow size={18} />}
              アプリで開く
            </button>

            <a
              href={summary.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-semibold transition-colors hover:bg-white/10"
            >
              <Download size={18} />
              ダウンロード
            </a>

            <button
              type="button"
              onClick={() => {
                void openInApp("manual");
              }}
              disabled={deepLinkState === "trying"}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-6 py-3 font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={16} />
              再試行
            </button>

            <a
              href={spectateUrl}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-3 font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/20"
            >
              <Eye size={16} />
              ブラウザ観戦
            </a>
          </div>

          <p className="mt-4 text-sm text-gray-300">{deepLinkMessage}</p>
          {summary.status === "expired" ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              <TriangleAlert size={16} />
              このリンクは使えません。新しい招待リンクを受け取ってください。
            </p>
          ) : null}
          {summary.status === "unavailable" ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-orange-400/40 bg-orange-500/10 px-3 py-2 text-sm text-orange-100">
              <TriangleAlert size={16} />
              APIへ接続できません。`wrangler dev` と `VITE_JOIN_API_ENDPOINT` を確認してください。
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#15151A] p-8">
          <h2 className="mb-4 text-2xl font-bold">参加手順</h2>
          <ol className="space-y-3 text-sm leading-relaxed text-gray-300">
            <li>1. 「アプリで開く」で参加します。</li>
            <li>2. アプリ未導入なら「ダウンロード」からインストールします。</li>
            <li>3. 観戦したい場合は「ブラウザ観戦」を選びます。</li>
          </ol>
        </section>

        <footer className="text-center text-sm text-gray-500">
          <a href={WEB_RUNTIME.basePath} className="hover:text-cyan-300">
            LPに戻る
          </a>
          <span className="mx-3">|</span>
          <a href={WEB_LINKS.support} target="_blank" rel="noreferrer" className="hover:text-cyan-300">
            サポート / Issue
          </a>
        </footer>
      </main>
    </div>
  );
};
