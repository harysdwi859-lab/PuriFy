/* ═══════════════════════════════════════════════
   PuriFy – app.js
   ═══════════════════════════════════════════════ */

const API = ""; // same origin

// ── STATE ────────────────────────────────────────
const S = {
  user: null,
  queue: [],
  qi: -1,
  playing: false,
  ytPlayer: null,
  ytReady: false,
  curId: null,
  progTimer: null,
  searchTimer: null,
  lyricLines: [],
  lyricTimer: null,
};

const $ = id => document.getElementById(id);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

// ── BOOT ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setupLogin();
  setupNav();
  setupPlayerControls();
  setupSearch();
  setupLyrics();
});

// ═════════════════════════════════════════════════
//  LOGIN
// ═════════════════════════════════════════════════
function setupLogin() {
  on($("btn-login"), "click", doLogin);
  on($("inp-pass"), "keydown", e => e.key === "Enter" && doLogin());
}

async function doLogin() {
  const username = $("inp-user").value.trim();
  const password = $("inp-pass").value.trim();
  const errBox   = $("login-error");
  errBox.classList.add("hidden");

  if (!username || !password) { showLoginErr("Isi username & password dulu!"); return; }

  $("btn-login-text").style.display = "none";
  $("btn-login-spin").classList.remove("hidden");

  try {
    const res  = await fetch(`${API}/api/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.success) { S.user = username; initApp(); }
    else showLoginErr(data.message || "Login gagal");
  } catch { showLoginErr("Tidak bisa terhubung ke server"); }
  finally {
    $("btn-login-text").style.display = "";
    $("btn-login-spin").classList.add("hidden");
  }
}

function showLoginErr(msg) {
  const el = $("login-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

// ═════════════════════════════════════════════════
//  INIT APP
// ═════════════════════════════════════════════════
function initApp() {
  $("login-screen").classList.remove("active");
  $("app-screen").classList.add("active");

  $("sidebar-avatar").textContent   = S.user.charAt(0).toUpperCase();
  $("sidebar-username").textContent = S.user;

  const h = new Date().getHours();
  $("greeting").textContent = h < 12 ? "Selamat Pagi 🌅" : h < 18 ? "Selamat Siang ☀️" : "Selamat Malam 🌙";

  loadRecommendations();

  on($("btn-logout"), "click", () => {
    S.user = null;
    if (S.ytPlayer) S.ytPlayer.stopVideo();
    $("app-screen").classList.remove("active");
    $("login-screen").classList.add("active");
    $("player-bar").classList.add("hidden");
    $("inp-pass").value = "";
    toast("Berhasil logout");
  });
}

// ═════════════════════════════════════════════════
//  NAV
// ═════════════════════════════════════════════════
function setupNav() {
  document.querySelectorAll(".nav-item").forEach(item => {
    on(item, "click", e => {
      e.preventDefault();
      document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
      item.classList.add("active");
      goPage(item.dataset.page);
    });
  });
}

function goPage(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  $(`page-${page}`).classList.add("active");
  if (page === "playlist") loadPlaylist();
}

// ═════════════════════════════════════════════════
//  RECOMMENDATIONS
// ═════════════════════════════════════════════════
async function loadRecommendations() {
  const grid = $("reco-grid");
  try {
    const res   = await fetch(`${API}/api/recommendations`);
    const songs = await res.json();
    if (songs.error) throw new Error(songs.error);
    S.queue = songs;

    grid.innerHTML = songs.map((s, i) => `
      <div class="song-card" onclick="playSongAtIndex(${i}, 'reco')">
        <img class="card-thumb" src="${s.thumbnail}" alt="${escH(s.title)}" loading="lazy"
          onerror="this.src='https://placehold.co/200x200/1e1e2e/7c5cfc?text=♪'"/>
        <div class="card-info">
          <div class="card-title">${escH(s.title)}</div>
          <div class="card-artist">${escH(s.artist)}</div>
        </div>
        <div class="card-ov">
          <div class="card-play">
            <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" fill="white"/></svg>
          </div>
        </div>
      </div>
    `).join("");
  } catch {
    grid.innerHTML = `<p style="color:var(--text3);grid-column:1/-1;padding:20px">Gagal memuat rekomendasi</p>`;
  }
}

// ═════════════════════════════════════════════════
//  SEARCH
// ═════════════════════════════════════════════════
function setupSearch() {
  const inp = $("search-input");
  on(inp, "input", () => {
    clearTimeout(S.searchTimer);
    const q = inp.value.trim();
    if (!q) { $("search-results").innerHTML = ""; return; }
    S.searchTimer = setTimeout(() => doSearch(q), 400);
  });
}

async function doSearch(q) {
  $("search-spinner").classList.remove("hidden");
  try {
    const res   = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`);
    const songs = await res.json();
    if (songs.error) throw new Error(songs.error);
    renderSongList($("search-results"), songs, "search");
  } catch {
    $("search-results").innerHTML = `<p style="color:var(--text3);padding:20px">Gagal mencari lagu</p>`;
  } finally {
    $("search-spinner").classList.add("hidden");
  }
}

// ═════════════════════════════════════════════════
//  PLAYLIST
// ═════════════════════════════════════════════════
async function loadPlaylist() {
  const list = $("playlist-list");
  list.innerHTML = `<p style="color:var(--text3);padding:20px">Memuat playlist…</p>`;
  $("playlist-empty").classList.add("hidden");

  try {
    const res   = await fetch(`${API}/api/playlist/${S.user}`);
    const songs = await res.json();
    if (songs.error) throw new Error(songs.error);

    // Resolve judul untuk lagu yang belum ada title
    const resolved = await Promise.all(songs.map(async s => {
      if (s.title) return s;
      try {
        const r = await fetch(`${API}/api/song/${s.videoId}`);
        return await r.json();
      } catch { return s; }
    }));

    $("playlist-count").textContent = `${resolved.length} lagu`;

    if (!resolved.length) {
      list.innerHTML = "";
      $("playlist-empty").classList.remove("hidden");
      return;
    }
    renderSongList(list, resolved, "playlist");
  } catch {
    list.innerHTML = `<p style="color:var(--text3);padding:20px">Gagal memuat playlist</p>`;
  }
}

// ═════════════════════════════════════════════════
//  SONG LIST RENDER
// ═════════════════════════════════════════════════
function renderSongList(container, songs, queueKey) {
  if (!songs.length) {
    container.innerHTML = `<p style="color:var(--text3);padding:20px">Tidak ada hasil</p>`;
    return;
  }

  container.innerHTML = songs.map((s, i) => `
    <div class="song-row" data-index="${i}" data-qkey="${queueKey}" data-vid="${s.videoId}">
      <img class="song-row-thumb"
        src="${s.thumbnail || `https://img.youtube.com/vi/${s.videoId}/mqdefault.jpg`}"
        alt="" onerror="this.src='https://placehold.co/48x48/1e1e2e/7c5cfc?text=♪'"/>
      <div class="song-row-info">
        <div class="song-row-title">${escH(s.title || "Loading…")}</div>
        <div class="song-row-artist">${escH(s.artist || "")}</div>
      </div>
      ${s.duration ? `<div class="song-row-dur">${s.duration}</div>` : ""}
      <div class="row-actions">
        <button title="Download" onclick="event.stopPropagation();dlSong('${s.videoId}','${escH(s.title || s.videoId)}')">
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button title="Lirik" onclick="event.stopPropagation();openLyrics('${s.videoId}')">
          <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </button>
      </div>
    </div>
  `).join("");

  // Store queue per section
  window._queues = window._queues || {};
  window._queues[queueKey] = songs;

  container.querySelectorAll(".song-row").forEach(row => {
    on(row, "click", e => {
      if (e.target.closest("button")) return;
      const idx    = +row.dataset.index;
      const qkey   = row.dataset.qkey;
      S.queue      = window._queues[qkey] || songs;
      playSongAtIndex(idx, qkey);
    });
  });
}

// ═════════════════════════════════════════════════
//  YOUTUBE PLAYER
// ═════════════════════════════════════════════════
window.onYouTubeIframeAPIReady = function () {
  S.ytPlayer = new YT.Player("yt-player", {
    height: "1", width: "1",
    playerVars: { autoplay: 0, controls: 0 },
    events: { onReady: () => { S.ytReady = true; }, onStateChange: onYTState },
  });
};

function onYTState(e) {
  const YS = YT.PlayerState;
  if (e.data === YS.PLAYING) {
    S.playing = true;
    $("ico-play").classList.add("hidden");
    $("ico-pause").classList.remove("hidden");
    startProg();
  } else if (e.data === YS.PAUSED) {
    S.playing = false;
    $("ico-play").classList.remove("hidden");
    $("ico-pause").classList.add("hidden");
    stopProg();
  } else if (e.data === YS.ENDED) {
    playNext();
  }
}

function playSongAtIndex(idx, qkey) {
  const q = (qkey && window._queues && window._queues[qkey]) ? window._queues[qkey] : S.queue;
  if (idx < 0 || idx >= q.length) return;
  S.queue = q;
  S.qi    = idx;
  playSong(q[idx]);
}

function playSong(song) {
  if (!S.ytReady || !S.ytPlayer) { toast("Player belum siap, tunggu sebentar…"); return; }
  S.curId = song.videoId;

  $("player-thumb").src         = song.thumbnail || `https://img.youtube.com/vi/${song.videoId}/mqdefault.jpg`;
  $("player-title").textContent = song.title || "Loading…";
  $("player-artist").textContent= song.artist || "";
  $("player-bar").classList.remove("hidden");

  // Highlight row
  document.querySelectorAll(".song-row").forEach(r => r.classList.toggle("playing", r.dataset.vid === song.videoId));

  S.ytPlayer.loadVideoById(song.videoId);

  // Reload lirik kalau panel terbuka
  if ($("lyrics-panel").classList.contains("open")) loadLyrics(song.videoId);
  else $("lyrics-body").innerHTML = `<p class="lyrics-ph">Memuat lirik…</p>`;
}

// ── Progress ──────────────────────────────────────
function startProg() {
  stopProg();
  S.progTimer = setInterval(updateProg, 1000);
}
function stopProg() { if (S.progTimer) { clearInterval(S.progTimer); S.progTimer = null; } }
function updateProg() {
  if (!S.ytPlayer || !S.ytPlayer.getDuration) return;
  const cur = S.ytPlayer.getCurrentTime() || 0;
  const dur = S.ytPlayer.getDuration()    || 0;
  if (!dur) return;
  $("progress-fill").style.width  = `${(cur / dur) * 100}%`;
  $("time-cur").textContent       = fmtTime(cur);
  $("time-tot").textContent       = fmtTime(dur);
}

// ═════════════════════════════════════════════════
//  PLAYER CONTROLS
// ═════════════════════════════════════════════════
function setupPlayerControls() {
  on($("btn-play"),     "click", togglePlay);
  on($("btn-next"),     "click", playNext);
  on($("btn-prev"),     "click", playPrev);
  on($("btn-download"), "click", () => { if (S.curId) dlSong(S.curId, $("player-title").textContent); });
  on($("btn-lyrics"),   "click", () => {
    const p = $("lyrics-panel");
    p.classList.toggle("open");
    $("btn-lyrics").classList.toggle("active");
    if (p.classList.contains("open") && S.curId) loadLyrics(S.curId);
  });
  on($("progress-bar"), "click", e => {
    if (!S.ytPlayer || !S.ytPlayer.getDuration) return;
    const rect = $("progress-bar").getBoundingClientRect();
    S.ytPlayer.seekTo(((e.clientX - rect.left) / rect.width) * S.ytPlayer.getDuration(), true);
  });
  on($("vol-slider"), "input", e => {
    if (S.ytPlayer && S.ytPlayer.setVolume) S.ytPlayer.setVolume(+e.target.value);
  });
}

function togglePlay() { if (!S.ytPlayer) return; S.playing ? S.ytPlayer.pauseVideo() : S.ytPlayer.playVideo(); }
function playNext()   { if (S.qi < S.queue.length - 1) playSongAtIndex(S.qi + 1); }
function playPrev()   { if (S.qi > 0) playSongAtIndex(S.qi - 1); }

// ═════════════════════════════════════════════════
//  LYRICS
// ═════════════════════════════════════════════════
function setupLyrics() {
  on($("lyrics-close"), "click", () => {
    $("lyrics-panel").classList.remove("open");
    $("btn-lyrics").classList.remove("active");
  });
}

async function openLyrics(videoId) {
  // Play jika belum main
  if (S.curId !== videoId) {
    const allQueues = Object.values(window._queues || {});
    for (const q of allQueues) {
      const song = q.find(s => s.videoId === videoId);
      if (song) { S.queue = q; S.qi = q.indexOf(song); playSong(song); break; }
    }
  }
  $("lyrics-panel").classList.add("open");
  $("btn-lyrics").classList.add("active");
  await loadLyrics(videoId);
}

async function loadLyrics(videoId) {
  const body = $("lyrics-body");
  body.innerHTML = `<p class="lyrics-ph">Memuat lirik…</p>`;
  try {
    const res  = await fetch(`${API}/api/lyrics/${videoId}`);
    const data = await res.json();
    const text = data.lyrics || "Lirik tidak tersedia.";
    S.lyricLines = text.split("\n");
    body.innerHTML = S.lyricLines.map((l, i) =>
      `<div class="lyric-line" data-i="${i}">${escH(l) || "&nbsp;"}</div>`
    ).join("");
    startLyricSync();
  } catch {
    body.innerHTML = `<p class="lyrics-ph">Gagal memuat lirik</p>`;
  }
}

function startLyricSync() {
  if (S.lyricTimer) clearInterval(S.lyricTimer);
  S.lyricTimer = setInterval(() => {
    if (!S.ytPlayer || !S.ytPlayer.getDuration) return;
    const cur = S.ytPlayer.getCurrentTime() || 0;
    const dur = S.ytPlayer.getDuration()    || 1;
    const idx = Math.floor((cur / dur) * S.lyricLines.length);
    const body = $("lyrics-body");
    body.querySelectorAll(".lyric-line").forEach((el, i) => el.classList.toggle("active", i === idx));
    const active = body.querySelector(".lyric-line.active");
    if (active) active.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 1000);
}

// ═════════════════════════════════════════════════
//  DOWNLOAD
// ═════════════════════════════════════════════════
function dlSong(videoId, title) {
  toast(`⬇️ Mengunduh PuriFy-${title}…`);
  const a  = document.createElement("a");
  a.href   = `${API}/api/download/${videoId}?title=${encodeURIComponent(title)}`;
  a.download = `PuriFy-${title}.mp3`;
  a.click();
}

// ═════════════════════════════════════════════════
//  HELPERS
// ═════════════════════════════════════════════════
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.classList.add("hidden"), 300);
  }, 2800);
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

function escH(s = "") {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
