import type { PlayStyle } from "@infinitas/shared";
import { useState } from "react";
import type { ChartRankingEntry, MatchHistoryEntry } from "../features/stats/models";
import {
  getChartRankings,
  getCurrentRating,
  getRecentMatchHistory,
  getStabilitySummary,
} from "../features/stats/stats";
import { useStatsArchiveStore } from "../services/stats-archive";
import { formatDateTime } from "../utils/format";

const RULE_OPTIONS = ["ARENA", "BPL"] as const;
const PLAY_MODE_OPTIONS = ["SP", "DP"] as const;

type RuleFilter = (typeof RULE_OPTIONS)[number];

function getToggleButtonClassName(active: boolean): string {
  return active ? "primary-button" : "secondary-button";
}

function getResultLabel(result: MatchHistoryEntry["match_result"]): "W" | "L" | "D" {
  switch (result) {
    case "WIN":
      return "W";
    case "LOSE":
      return "L";
    case "DRAW":
    default:
      return "D";
  }
}

function getResultTone(result: MatchHistoryEntry["match_result"]): "ok" | "danger" | "warning" {
  switch (result) {
    case "WIN":
      return "ok";
    case "LOSE":
      return "danger";
    case "DRAW":
    default:
      return "warning";
  }
}

function formatCompactNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1).replace(/\.?0+$/, "");
}

function formatRating(value: number | null): string {
  return value === null ? "--" : String(Math.round(value));
}

function formatDelta(value: number | null): string {
  if (value === null) {
    return "--";
  }

  if (value === 0) {
    return "±0";
  }

  return `${value > 0 ? "+" : ""}${Math.round(value)}`;
}

function formatWinRate(entry: ChartRankingEntry): string {
  const earned = entry.wins + entry.draws * 0.5;
  return `${entry.win_rate.toFixed(1)}% (${formatCompactNumber(earned)}/${entry.matches})`;
}

function formatRecord(entry: ChartRankingEntry): string {
  return `${entry.wins}-${entry.losses}-${entry.draws}`;
}

function formatAverageExDiff(value: number | null): string {
  if (value === null) {
    return "--";
  }

  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${formatCompactNumber(rounded)}`;
}

function formatChartMeta(entry: ChartRankingEntry): string {
  return entry.chart_level === null ? entry.chart_difficulty : `${entry.chart_difficulty} / Lv${entry.chart_level}`;
}

function RankingTable(props: { entries: ChartRankingEntry[]; emptyMessage: string }) {
  const { entries, emptyMessage } = props;

  if (entries.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="table-wrapper">
      <table className="room-table">
        <thead>
          <tr>
            <th>曲名</th>
            <th>譜面</th>
            <th>勝率</th>
            <th>勝敗数</th>
            <th>対戦数</th>
            <th>平均EX差</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.chart_id}>
              <td>{entry.chart_title}</td>
              <td>{formatChartMeta(entry)}</td>
              <td>{formatWinRate(entry)}</td>
              <td>{formatRecord(entry)}</td>
              <td>{entry.matches}</td>
              <td>{formatAverageExDiff(entry.average_ex_diff)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatsPage() {
  const archive = useStatsArchiveStore((state) => state.archive);
  const updatedAt = useStatsArchiveStore((state) => state.updatedAt);
  const [ruleFilter, setRuleFilter] = useState<RuleFilter>("ARENA");
  const [playMode, setPlayMode] = useState<PlayStyle>("SP");

  const currentRating = getCurrentRating(archive, ruleFilter, playMode);
  const history = getRecentMatchHistory(archive, ruleFilter, playMode);
  const rankings = getChartRankings(archive, ruleFilter, playMode);
  const stability = getStabilitySummary(archive, playMode);

  return (
    <section className="page-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Stats</p>
            <h2>対戦統計</h2>
            <p className="status-muted">レートと履歴はマッチ単位、勝率と安定度は曲単位で集計します。</p>
          </div>
          <div className="status-stack">
            <span className="status-label">Last updated</span>
            <strong>{formatDateTime(updatedAt)}</strong>
          </div>
        </div>

        <div className="split-panel">
          <div className="status-stack">
            <span className="status-label">ルール</span>
            <div className="button-row">
              {RULE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={getToggleButtonClassName(ruleFilter === option)}
                  onClick={() => {
                    setRuleFilter(option);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="status-stack">
            <span className="status-label">モード</span>
            <div className="button-row">
              {PLAY_MODE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={getToggleButtonClassName(playMode === option)}
                  onClick={() => {
                    setPlayMode(option);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="stats-summary-grid">
          <div className="stats-summary-card">
            <span className="status-label">現在レート</span>
            <strong className="stats-value">{formatRating(currentRating)}</strong>
            <span className="status-muted">
              {ruleFilter} / {playMode}
            </span>
          </div>
          <div className="stats-summary-card">
            <span className="status-label">表示中の履歴件数</span>
            <strong className="stats-value">{history.length}</strong>
            <span className="status-muted">直近10件</span>
          </div>
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">History</p>
            <h2>直近10マッチ</h2>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="empty-state">データなし</div>
        ) : (
          <div className="table-wrapper">
            <table className="room-table">
              <thead>
                <tr>
                  <th>結果</th>
                  <th>終了時刻</th>
                  <th>変動</th>
                  <th>レート</th>
                  <th>ラウンド詳細</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.match_id}>
                    <td>
                      <span className={`status-pill ${getResultTone(entry.match_result)}`}>
                        {getResultLabel(entry.match_result)}
                      </span>
                    </td>
                    <td>{formatDateTime(entry.ended_at)}</td>
                    <td>{formatDelta(entry.rating_delta)}</td>
                    <td>{formatRating(entry.rating_after)}</td>
                    <td>{entry.detail || "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Ranking</p>
            <h2>曲別勝率ランキング</h2>
            <p className="status-muted">{ruleFilter} / {playMode} で3戦以上の譜面のみ表示します。</p>
          </div>
        </div>

        <div className="split-panel">
          <div className="stats-subpanel">
            <div className="panel-header">
              <h3>勝率が高い曲</h3>
            </div>
            <RankingTable entries={rankings.highest} emptyMessage="3戦以上のデータが必要です" />
          </div>
          <div className="stats-subpanel">
            <div className="panel-header">
              <h3>勝率が低い曲</h3>
            </div>
            <RankingTable entries={rankings.lowest} emptyMessage="3戦以上のデータが必要です" />
          </div>
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Stability</p>
            <h2>安定度</h2>
            <p className="status-muted">直近20曲の自己結果を、全期間自己ベストと比較します。PRIVATE も含みます。</p>
          </div>
        </div>

        {stability.comparedCount === 0 ? (
          <div className="empty-state">比較対象データが不足しています</div>
        ) : (
          <div className="stats-summary-grid">
            <div className="stats-summary-card">
              <span className="status-label">スコア安定度</span>
              <strong className="stats-value">{stability.scoreStability?.toFixed(1)}%</strong>
              <span className="status-muted">
                対象 {stability.comparedCount}/{stability.recentCount}曲
              </span>
            </div>
            <div className="stats-summary-card">
              <span className="status-label">ミス安定度</span>
              <strong className="stats-value">
                {stability.missStability !== null
                  ? `${stability.missStability > 0 ? "+" : ""}${formatCompactNumber(
                      Math.round(stability.missStability * 10) / 10,
                    )} BP`
                  : "--"}
              </strong>
              <span className="status-muted">{playMode} の直近20曲ベース</span>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
