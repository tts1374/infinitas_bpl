function escapeHTML(str) {
  if (typeof str !== "string") return str;
  return str.replace(
    /[&<>'"]/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      }[c])
  );
}

function sanitizeClass(str) {
  return String(str).replace(/[^A-Za-z0-9_-]/g, "");
}

async function fetchResult() {
  try {
    const response = await fetch("result_output.json?time=" + Date.now());
    const data = await response.json();
    renderTable(data);
  } catch (e) {
    console.error(e);
    document.getElementById("result").innerText = "ローディング中…";
  }
}

function indicator(i) {
  i = Math.abs(i);
  const cent = i % 100;
  if (cent >= 10 && cent <= 20) return "th";
  const dec = i % 10;
  if (dec === 1) return "ST";
  if (dec === 2) return "ND";
  if (dec === 3) return "RD";
  return "th";
}

function renderSongInfo(song, type) {
  const safeType = sanitizeClass(type);
  const safeDiff = sanitizeClass(song.difficulty);
  return `
    <div class="song_info ${safeType}">
      <div class="stage_no">${escapeHTML(song.stage_no)}${indicator(
    song.stage_no
  )} STAGE</div>
      <div class="song_name ${safeType}">${escapeHTML(song.song_name)}</div>
      <div class="difficulty">
        <div class="play_style">${escapeHTML(song.play_style)}</div>
        <div class="difficulty_${safeDiff}">${escapeHTML(
    song.difficulty
  )} ${escapeHTML(song.level)}</div>
      </div>
    </div>
  `;
}

function renderBPLBattleUser(mode, r, position, is_pt_enabled) {
  const ptClass = is_pt_enabled ? `result_${sanitizeClass(r.pt)}` : "";
  const posClass = sanitizeClass(position);

  let html = `<div class="user_result bpl flex-glow result_${posClass}">`;

  if (mode === 2) {
    html += `<div class="user_result_title">SCORE</div>`;
  } else if (mode === 4) {
    html += `<div class="user_result_title">MISS COUNT</div>`;
  } else {
    html += "-";
  }

  if (r) {
    html += `<div class="user_result_score ${ptClass}">`;
    if (mode === 2) {
      html += `${escapeHTML(r.score)}`;
    } else if (mode === 4) {
      html += `${escapeHTML(r.miss_count)}`;
    } else {
      html += "-";
    }
    html += "</div>";
  }

  html += "</div>";
  return html;
}

function renderArenaUser(mode, r) {
  let html = `<div class="user_result arena flex-glow">`;
  if (r) {
    html += `<div class="user_result_score">${escapeHTML(r.pt)}</div>`;
    html += `<div class="user_result_bottom">`;
    if (mode === 1) {
      html += `SCORE : ${escapeHTML(r.score)}`;
    } else if (mode === 3) {
      html += `MISS COUNT : ${escapeHTML(r.miss_count)}`;
    } else {
      html += "-";
    }
    html += "</div>";
  } else {
    html += `<div class="user_result_score">-</div>`;
  }
  html += "</div>";
  return html;
}

function renderBPLTotal(songsOrig, users, user_id_1, user_id_2) {
  let user_1_total_pt = 0;
  let user_2_total_pt = 0;

  songsOrig.forEach((song) => {
    const results = song.results || [];
    const resultMap = {};
    results.forEach((r) => (resultMap[r.user_id] = r));

    const r1 = resultMap[user_id_1];
    const r2 = resultMap[user_id_2];
    if (results.length === users.length) {
      user_1_total_pt += r1.pt;
      user_2_total_pt += r2.pt;
    }
  });

  return `
    <div class="result_area">
      <div class="user flex-glow">
        <div class="label">TOTAL</div>
        <div class="total_pt">${escapeHTML(user_1_total_pt)}</div>
      </div>
      <div class="user flex-glow">
        <div class="label">TOTAL</div>
        <div class="total_pt">${escapeHTML(user_2_total_pt)}</div>
      </div>
    </div>
  `;
}

function renderBPLBattle(mode, users, songsOrig) {
  const songs = songsOrig.slice(0, 4);
  const user_id_1 = users[0].user_id;
  const user_id_2 = users[1].user_id;

  let html = '<div class="name_area">';
  html += `<div class="user_0 outline name_item flex-glow">${escapeHTML(
    users[0].user_name
  )}</div>`;
  html += `<div class="user_1 outline name_item flex-glow">${escapeHTML(
    users[1].user_name
  )}</div>`;
  html += "</div>";

  songs.forEach((song) => {
    html += "<li>";
    const results = song.results || [];
    const resultMap = {};
    results.forEach((r) => (resultMap[r.user_id] = r));

    html += renderBPLBattleUser(
      mode,
      resultMap[user_id_1],
      "left",
      results.length === users.length
    );
    html += renderSongInfo(song, "bpl");
    html += renderBPLBattleUser(
      mode,
      resultMap[user_id_2],
      "right",
      results.length === users.length
    );
    html += "</li>";
  });

  html += renderBPLTotal(songsOrig, users, user_id_1, user_id_2);
  return html;
}

function renderArenaBattle(mode, users, songsOrig) {
  const songs = songsOrig.slice(0, 4);
  let html = '<div class="name_area"><div class="song_item"></div>';

  users.forEach((u, i) => {
    html += `<div class="user_${i} name_item outline small flex-glow">${escapeHTML(
      u.user_name
    )}</div>`;
  });
  html += "</div>";

  const totalScoreMap = {};
  songs.forEach((song) => {
    html += "<li>";
    const results = song.results || [];
    const resultMap = {};
    results.forEach((r) => (resultMap[r.user_id] = r));

    html += renderSongInfo(song, "arena");
    users.forEach((u) => {
      html += renderArenaUser(mode, resultMap[u.user_id]);
    });
    html += "</li>";
  });

  // 合計pt計算
  songsOrig.forEach((song) => {
    const results = song.results || [];
    const resultMap = {};
    results.forEach((r) => (resultMap[r.user_id] = r));

    users.forEach((u) => {
      totalScoreMap[u.user_id] =
        (totalScoreMap[u.user_id] || 0) + (resultMap[u.user_id]?.pt || 0);
    });
  });

  html += '<div class="result_area"><div class="song_item"></div>';
  users.forEach((u) => {
    html += `<div class="user flex-glow">
    <div class="label">TOTAL</div>
    <div class="total_pt">${escapeHTML(totalScoreMap[u.user_id])}</div>
  </div>`;
  });
  html += "</div>";

  return html;
}

function renderTable(data) {
  const mode = data.mode;
  const users = data.users;
  const songs = data.songs;

  const fragment = document.createDocumentFragment();
  const wrapper = document.createElement("div");

  if (mode === 1 || mode === 3) {
    wrapper.innerHTML = renderArenaBattle(mode, users, songs);
  } else if (mode === 2 || mode === 4) {
    wrapper.innerHTML = renderBPLBattle(mode, users, songs);
  }

  while (wrapper.firstChild) {
    fragment.appendChild(wrapper.firstChild);
  }

  document.getElementById("result").replaceChildren(fragment);
}

// 初回＆1秒ごと更新
fetchResult();
setInterval(fetchResult, 1000);
