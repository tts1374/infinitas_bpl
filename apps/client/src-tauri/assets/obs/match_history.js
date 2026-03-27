const DATA_SOURCE = "match_history.json";
const POLL_INTERVAL_MS = 3000;

let lastDataString = "";

function formatDateTime(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        return isoString;
    }

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${month}/${day} ${hours}:${minutes}`;
}

function formatPoint(value) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
        return "0";
    }
    if (Math.abs(numberValue - Math.round(numberValue)) < 1e-9) {
        return String(Math.round(numberValue));
    }
    return numberValue.toFixed(1);
}

function renderEmpty() {
    const container = document.getElementById("history-container");
    container.innerHTML = "<div style=\"padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;\">No matches found.</div>";
    document.getElementById("active-mode-badge").textContent = "NO DATA";
    document.getElementById("summary-container").innerHTML = "";
}

function toModeClass(mode) {
    return mode === "ARENA" ? "mode-arena" : "mode-bpl";
}

function toBadge(match) {
    if (match.mode === "ARENA") {
        const rank = match.summary && Number.isFinite(Number(match.summary.arena_rank))
            ? Number(match.summary.arena_rank)
            : 4;
        const safeRank = Math.max(1, Math.min(4, rank));
        return {
            text: `RANK ${safeRank}`,
            className: `badge-rank-${safeRank}`,
        };
    }

    const result = match.summary && typeof match.summary.bpl_result === "string"
        ? match.summary.bpl_result.toUpperCase()
        : "DRAW";
    const className = result === "WIN" ? "badge-win" : result === "LOSE" ? "badge-lose" : "badge-draw";
    return {
        text: result,
        className,
    };
}

function toBplScore(summary, chartCount) {
    if (!summary || typeof summary !== "object") {
        return "DRAW";
    }

    const hasMyScore = Number.isFinite(Number(summary.bpl_my_score));
    const hasOppScore = Number.isFinite(Number(summary.bpl_opp_score));
    if (hasMyScore && hasOppScore) {
        return `${formatPoint(summary.bpl_my_score)} - ${formatPoint(summary.bpl_opp_score)}`;
    }

    return Number.isFinite(chartCount) && chartCount > 0
        ? `${chartCount} charts`
        : "DRAW";
}

function updateDOM(data) {
    if (!data.matches || data.matches.length === 0) {
        renderEmpty();
        return;
    }

    const sortedMatches = [...data.matches].sort((left, right) => (
        new Date(right.completed_at).getTime() - new Date(left.completed_at).getTime()
    ));

    const activeMode = sortedMatches[0].mode;
    const allActiveMatches = sortedMatches.filter((match) => match.mode === activeMode);
    const displayedMatches = allActiveMatches.slice(0, 3);

    const badgeElement = document.getElementById("active-mode-badge");
    badgeElement.textContent = `${activeMode} MODE`;
    badgeElement.className = `mode-badge ${toModeClass(activeMode)}`;

    const summaryContainer = document.getElementById("summary-container");
    if (activeMode === "ARENA") {
        const ranks = { 1: 0, 2: 0, 3: 0, 4: 0 };
        let totalPoints = 0;
        allActiveMatches.forEach((match) => {
            if (match.summary && Number.isFinite(Number(match.summary.arena_rank))) {
                const rank = Math.max(1, Math.min(4, Number(match.summary.arena_rank)));
                ranks[rank] += 1;
            }
            if (match.summary && Number.isFinite(Number(match.summary.arena_points))) {
                totalPoints += Number(match.summary.arena_points);
            }
        });

        summaryContainer.innerHTML = `
            <div class="record-arena">
                <div class="record-arena-stat rank-1"><span class="lbl">1ST</span><span class="val">${ranks[1]}</span></div>
                <div class="record-arena-stat rank-2"><span class="lbl">2ND</span><span class="val">${ranks[2]}</span></div>
                <div class="record-arena-stat rank-3"><span class="lbl">3RD</span><span class="val">${ranks[3]}</span></div>
                <div class="record-arena-stat rank-4"><span class="lbl">4TH</span><span class="val">${ranks[4]}</span></div>
                <div class="record-arena-stat rank-pt"><span class="lbl">PTS</span><span class="val">${formatPoint(totalPoints)}</span></div>
            </div>
        `;
    } else {
        let wins = 0;
        let losses = 0;
        let draws = 0;
        allActiveMatches.forEach((match) => {
            const result = match.summary && typeof match.summary.bpl_result === "string"
                ? match.summary.bpl_result.toUpperCase()
                : "";
            if (result === "WIN") {
                wins += 1;
            } else if (result === "LOSE") {
                losses += 1;
            } else if (result === "DRAW") {
                draws += 1;
            }
        });

        summaryContainer.innerHTML = `
            <div class="record-bpl">
                <div class="record-bpl-stat"><span class="val val-win">${wins}</span><span class="lbl val-win">W</span></div>
                <div class="record-bpl-stat"><span class="val val-lose">${losses}</span><span class="lbl val-lose">L</span></div>
                <div class="record-bpl-stat"><span class="val val-draw">${draws}</span><span class="lbl val-draw">D</span></div>
            </div>
        `;
    }

    const historyContainer = document.getElementById("history-container");
    historyContainer.innerHTML = "";

    displayedMatches.forEach((match) => {
        const badge = toBadge(match);
        const opponents = Array.isArray(match.players)
            ? match.players
                .filter((player) => player.player_id !== match.self_player_id)
                .map((player) => player.display_name)
            : [];
        const opponentsText = opponents.length > 0 ? `vs ${opponents.join(", ")}` : "Single Player";
        const timeText = formatDateTime(match.completed_at);
        const chartCount = Array.isArray(match.charts) ? match.charts.length : 0;

        const scoreText = match.mode === "ARENA"
            ? `${formatPoint(match.summary?.arena_points ?? 0)} pt`
            : toBplScore(match.summary, chartCount);

        let chartsHTML = "";
        if (Array.isArray(match.charts) && match.charts.length > 0) {
            const sortedCharts = [...match.charts].sort((left, right) => Number(left.order) - Number(right.order));
            chartsHTML = "<div class=\"charts-container\">";
            sortedCharts.forEach((chart) => {
                const chartOrder = Number.isFinite(Number(chart.order)) ? Number(chart.order) : 0;
                const selfScore = Number.isFinite(Number(chart.self_score)) ? Number(chart.self_score) : 0;
                const selfMiss = Number.isFinite(Number(chart.self_miss_count)) ? Number(chart.self_miss_count) : 0;
                const selfPoint = Number.isFinite(Number(chart.self_point)) ? Number(chart.self_point) : 0;
                const playStyle = typeof chart.play_style === "string" ? chart.play_style : "-";
                const difficulty = typeof chart.difficulty === "string" ? chart.difficulty : "-";
                const title = typeof chart.title === "string" ? chart.title : "-";

                chartsHTML += `
                    <div class="chart-row">
                        <div class="chart-main">
                            <div class="chart-title"><span class="chart-order">#${chartOrder}</span>${title}</div>
                            <div class="chart-meta">${playStyle} / ${difficulty}</div>
                        </div>
                        <div class="chart-stats">
                            <span class="c-val c-ex">EX ${selfScore}</span>
                            <span class="c-val c-bp">BP ${selfMiss}</span>
                            <span class="c-val c-pt">${formatPoint(selfPoint)}pt</span>
                        </div>
                    </div>
                `;
            });
            chartsHTML += "</div>";
        }

        const matchElement = document.createElement("div");
        matchElement.className = "match-list-item";
        matchElement.innerHTML = `
            <div class="match-main">
                <div class="match-left">
                    <div class="match-badge ${badge.className}">${badge.text}</div>
                    <div class="match-info">
                        <span class="match-opponents">${opponentsText}</span>
                        <span class="match-time">${timeText}</span>
                    </div>
                </div>
                <div class="match-right">
                    <span class="match-score">${scoreText}</span>
                </div>
            </div>
            ${chartsHTML}
        `;
        historyContainer.appendChild(matchElement);
    });
}

function fetchData() {
    fetch(`${DATA_SOURCE}?t=${Date.now()}`)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text();
        })
        .then((text) => {
            if (text === lastDataString) {
                return;
            }
            lastDataString = text;
            updateDOM(JSON.parse(text));
        })
        .catch((error) => {
            console.error("Match history overlay fetch error:", error);
        });
}

document.addEventListener("DOMContentLoaded", () => {
    fetchData();
    setInterval(fetchData, POLL_INTERVAL_MS);
});
