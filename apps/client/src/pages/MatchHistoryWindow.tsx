import { useEffect, useState } from "react";
import { MATCH_HISTORY_WINDOW_VISUAL_FIXTURE } from "../dev/visual-scenarios";
import {
  MATCH_HISTORY_STORAGE_KEY,
  readMatchHistory,
  type MatchHistoryDocument,
  type MatchHistoryEntry,
} from "../services/match-history-overlay";
import { selectActiveMatchHistory } from "../services/match-history-view-model";
import { buildScopedStorageKey } from "../runtime/runtime-config";
import "./match-history-window.css";

function formatCompletedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function renderSummary(match: MatchHistoryEntry): string {
  if (match.mode === "ARENA" && "arena_rank" in match.summary) {
    return `${match.summary.arena_rank}位 / ${match.summary.arena_points} pt`;
  }
  if (match.mode === "BPL" && "bpl_result" in match.summary) {
    return `${match.summary.bpl_result} ${match.summary.bpl_my_score} - ${match.summary.bpl_opp_score}`;
  }
  return "";
}

function MatchCard({ match }: { match: MatchHistoryEntry }) {
  return (
    <article className="match-history-card">
      <header>
        <div>
          <span className={`match-history-mode match-history-mode-${match.mode.toLowerCase()}`}>
            {match.mode}
          </span>
          <strong>{renderSummary(match)}</strong>
        </div>
        <time dateTime={match.completed_at}>{formatCompletedAt(match.completed_at)}</time>
      </header>
      <div className="match-history-players">
        {match.players.map((player) => player.display_name).join(" / ")}
      </div>
      <ol>
        {match.charts.map((chart) => (
          <li key={`${match.match_id}:${chart.order}`}>
            <span className="match-history-order">{chart.order}</span>
            <span className="match-history-chart">
              <strong>{chart.title}</strong>
              <small>{chart.play_style} {chart.difficulty}</small>
            </span>
            <span className="match-history-score">
              <strong>{chart.self_score.toLocaleString()}</strong>
              <small>BP {chart.self_miss_count} / {chart.self_point} pt</small>
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}

function MatchHistorySummary({ history }: { history: MatchHistoryDocument }) {
  const active = selectActiveMatchHistory(history);
  if (active.summary === null) {
    return null;
  }
  if (active.summary.mode === "ARENA") {
    const ranks = active.summary.rankCounts;
    return (
      <p className="match-history-summary">
        ARENA <strong>1位 {ranks[1]} / 2位 {ranks[2]} / 3位 {ranks[3]} / 4位 {ranks[4]}</strong>
        <span>{active.summary.pointsTotal} pt</span>
      </p>
    );
  }
  const results = active.summary.resultCounts;
  return (
    <p className="match-history-summary">
      BPL <strong>W {results.WIN} / L {results.LOSE} / D {results.DRAW}</strong>
    </p>
  );
}

function readInitialHistory(): MatchHistoryDocument {
  return new URLSearchParams(window.location.search).get("scenario") === "match-history-window"
    ? MATCH_HISTORY_WINDOW_VISUAL_FIXTURE
    : readMatchHistory();
}

export function MatchHistoryWindow() {
  const [history, setHistory] = useState(readInitialHistory);
  const activeHistory = selectActiveMatchHistory(history);

  useEffect(() => {
    document.body.dataset.visualReady = "true";
    const scopedStorageKey = buildScopedStorageKey(MATCH_HISTORY_STORAGE_KEY);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === scopedStorageKey) {
        setHistory(readMatchHistory());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      delete document.body.dataset.visualReady;
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return (
    <main className="match-history-window">
      <header className="match-history-title">
        <div>
          <p>INFINITAS ARENA</p>
          <h1>Match History</h1>
        </div>
        <span>Session only</span>
      </header>
      <MatchHistorySummary history={history} />
      {activeHistory.matches.length === 0 ? (
        <p className="match-history-empty">この起動セッションの試合履歴はまだありません。</p>
      ) : (
        <section className="match-history-list">
          {activeHistory.matches.map((match) => <MatchCard key={match.match_id} match={match} />)}
        </section>
      )}
    </main>
  );
}
