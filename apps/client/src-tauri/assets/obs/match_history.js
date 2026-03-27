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

        const matchElement = document.createElement("div");
        matchElement.className = "match-list-item";
        const matchMain = document.createElement("div");
        matchMain.className = "match-main";

        const matchLeft = document.createElement("div");
        matchLeft.className = "match-left";

        const matchBadge = document.createElement("div");
        matchBadge.className = `match-badge ${badge.className}`;
        matchBadge.textContent = badge.text;

        const matchInfo = document.createElement("div");
        matchInfo.className = "match-info";

        const matchOpponents = document.createElement("span");
        matchOpponents.className = "match-opponents";
        matchOpponents.textContent = opponentsText;

        const matchTime = document.createElement("span");
        matchTime.className = "match-time";
        matchTime.textContent = timeText;

        const matchRight = document.createElement("div");
        matchRight.className = "match-right";

        const matchScore = document.createElement("span");
        matchScore.className = "match-score";
        matchScore.textContent = scoreText;

        matchInfo.appendChild(matchOpponents);
        matchInfo.appendChild(matchTime);
        matchLeft.appendChild(matchBadge);
        matchLeft.appendChild(matchInfo);
        matchRight.appendChild(matchScore);
        matchMain.appendChild(matchLeft);
        matchMain.appendChild(matchRight);
        matchElement.appendChild(matchMain);

        if (Array.isArray(match.charts) && match.charts.length > 0) {
            const sortedCharts = [...match.charts].sort((left, right) => Number(left.order) - Number(right.order));
            const chartsContainer = document.createElement("div");
            chartsContainer.className = "charts-container";

            sortedCharts.forEach((chart) => {
                const chartOrder = Number.isFinite(Number(chart.order)) ? Number(chart.order) : 0;
                const selfScore = Number.isFinite(Number(chart.self_score)) ? Number(chart.self_score) : 0;
                const selfMiss = Number.isFinite(Number(chart.self_miss_count)) ? Number(chart.self_miss_count) : 0;
                const selfPoint = Number.isFinite(Number(chart.self_point)) ? Number(chart.self_point) : 0;
                const playStyle = typeof chart.play_style === "string" ? chart.play_style : "-";
                const difficulty = typeof chart.difficulty === "string" ? chart.difficulty : "-";
                const title = typeof chart.title === "string" ? chart.title : "-";

                const chartRow = document.createElement("div");
                chartRow.className = "chart-row";

                const chartMain = document.createElement("div");
                chartMain.className = "chart-main";

                const chartTitle = document.createElement("div");
                chartTitle.className = "chart-title";

                const chartOrderElement = document.createElement("span");
                chartOrderElement.className = "chart-order";
                chartOrderElement.textContent = `#${chartOrder}`;

                const chartMeta = document.createElement("div");
                chartMeta.className = "chart-meta";
                chartMeta.textContent = `${playStyle} / ${difficulty}`;

                const chartStats = document.createElement("div");
                chartStats.className = "chart-stats";

                const exStat = document.createElement("span");
                exStat.className = "c-val c-ex";
                exStat.textContent = `EX ${selfScore}`;

                const bpStat = document.createElement("span");
                bpStat.className = "c-val c-bp";
                bpStat.textContent = `BP ${selfMiss}`;

                const pointStat = document.createElement("span");
                pointStat.className = "c-val c-pt";
                pointStat.textContent = `${formatPoint(selfPoint)}pt`;

                chartTitle.appendChild(chartOrderElement);
                chartTitle.appendChild(document.createTextNode(title));
                chartMain.appendChild(chartTitle);
                chartMain.appendChild(chartMeta);
                chartStats.appendChild(exStat);
                chartStats.appendChild(bpStat);
                chartStats.appendChild(pointStat);
                chartRow.appendChild(chartMain);
                chartRow.appendChild(chartStats);
                chartsContainer.appendChild(chartRow);
            });

            matchElement.appendChild(chartsContainer);
        }
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
