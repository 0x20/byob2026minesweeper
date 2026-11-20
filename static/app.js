/* QR Minesweeper: projector view. Polls /api/state and renders the grid. */
(() => {
  const $ = (id) => document.getElementById(id);
  const boardEl = $("board");
  const overlay = $("overlay");
  const flash = $("flash");

  const POLL_MS = 400;

  let cfg = null;
  let tiles = [];          // tile elements
  let prev = null;         // previous state
  let lastFetch = 0;       // performance.now() of last state
  let lastElapsed = 0;

  const pad = (n, w) => String(n).padStart(w, "0");
  const fmtTime = (s) => {
    s = Math.floor(s);
    return `${pad(Math.floor(s / 60), 2)}:${pad(s % 60, 2)}`;
  };

  // ---------------------------------------------------------------- build
  function build() {
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
    boardEl.style.gridTemplateRows = `repeat(${cfg.rows}, 1fr)`;
    tiles = [];
    for (let i = 0; i < cfg.cols * cfg.rows; i++) {
      const t = document.createElement("div");
      t.className = "tile";
      t.dataset.id = i;
      t.dataset.s = "h";

      const card = document.createElement("div");
      card.className = "card";
      const img = document.createElement("img");
      // The QR encodes base_url and is cached for a day, so key the URL on it.
      img.src = `/qr/${i}.svg?b=${encodeURIComponent(cfg.base_url)}`;
      img.alt = "";
      img.draggable = false;
      card.appendChild(img);

      const g = document.createElement("div");
      g.className = "glyph";

      t.appendChild(card);
      t.appendChild(g);
      boardEl.appendChild(t);
      tiles.push(t);
    }
    $("f-url").textContent = cfg.base_url.replace(/^https?:\/\//, "") + "/T/#";
    layout();
  }

  // Fit the grid into the stage, keeping square cells.
  function layout() {
    if (!cfg) return;
    const stage = boardEl.parentElement;
    const cs = getComputedStyle(stage);
    const W = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const H = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const cell = Math.floor(Math.min(W / cfg.cols, H / cfg.rows));
    boardEl.style.width = `${cell * cfg.cols}px`;
    boardEl.style.height = `${cell * cfg.rows}px`;
    boardEl.style.setProperty("--cell", `${cell}px`);
    for (const t of tiles) t.querySelector(".glyph").style.fontSize = `${Math.round(cell * 0.46)}px`;
  }

  // ---------------------------------------------------------------- render
  const hidden = (s) => s === "h" || s === "f" || s === "w";

  function render(st) {
    const first = !prev;
    const ev = st.event || {};
    const evChanged = !prev || JSON.stringify(prev.event) !== JSON.stringify(ev);

    for (let i = 0; i < tiles.length; i++) {
      const s = st.tiles[i];
      const t = tiles[i];
      const was = prev ? prev.tiles[i] : "h";
      if (s === was && !first) continue;

      t.dataset.s = s;
      const g = t.querySelector(".glyph");
      g.textContent = /^[1-8]$/.test(s) ? s : "";

      // ripple: newly opened tiles pop with a delay by distance from the scan
      if (!first && hidden(was) && !hidden(s)) {
        let delay = 0;
        if (ev.type === "open" && Array.isArray(ev.opened) && ev.opened.includes(i)) {
          const [r0, c0] = [Math.floor(ev.id / cfg.cols), ev.id % cfg.cols];
          const [r, c] = [Math.floor(i / cfg.cols), i % cfg.cols];
          delay = Math.max(Math.abs(r - r0), Math.abs(c - c0)) * 45;
        }
        t.classList.remove("pop");
        t.style.animationDelay = `${delay}ms`;
        g.style.animationDelay = `${delay}ms`;
        // force restart
        void t.offsetWidth;
        t.classList.add("pop");
      }
    }

    // stats
    $("s-flags").textContent = `${pad(st.flags, 2)}/${pad(st.mines, 2)}`;
    $("s-flags").classList.toggle("warn", st.flags > st.mines);
    $("s-open").textContent = `${pad(st.revealed, 3)}/${pad(st.cols * st.rows - st.mines, 3)}`;
    $("f-game").textContent = `GAME ${pad(st.games, 2)}`;
    // A round is lost by a mine, or by flagging everything left with a flag wrong.
    const failed = st.status === "lost" && st.reason === "flags";
    const label = failed ? "FAILED"
      : { ready: "READY", playing: "LIVE", won: "CLEARED", lost: "DETONATED" }[st.status];
    $("s-status").textContent = label;

    // status transitions
    document.body.classList.toggle("lost", st.status === "lost");
    document.body.classList.toggle("won", st.status === "won");
    if (st.status === "lost" || st.status === "won") {
      $("ov-k").textContent = failed ? "WRONG FLAGS" : st.status === "lost" ? "MINE HIT" : "ALL CLEAR";
      $("ov-v").textContent = label;
      overlay.hidden = false; // its last line is the countdown, kept fresh by tick()
      if (!first && prev.status !== st.status && st.status === "lost") {
        flash.classList.remove("go");
        void flash.offsetWidth;
        flash.classList.add("go");
      }
    } else {
      overlay.hidden = true;
    }

    prev = st;
  }

  // ---------------------------------------------------------------- net
  async function poll() {
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      const st = await r.json();
      lastFetch = performance.now();
      lastElapsed = st.elapsed;
      if (!prev || st.version !== prev.version) render(st);
      else prev = st;
      $("s-status").parentElement.style.opacity = "1";
    } catch (_) {
      $("s-status").textContent = "OFFLINE";
      $("s-status").parentElement.style.opacity = ".5";
    } finally {
      setTimeout(poll, POLL_MS);
    }
  }

  function tick() {
    if (prev) {
      let e = lastElapsed;
      if (prev.status === "playing") e += (performance.now() - lastFetch) / 1000;
      $("s-time").textContent = fmtTime(e);

      // A finished board restarts on its own; count down to it.
      if (prev.status === "won" || prev.status === "lost") {
        let line = `TIME ${fmtTime(prev.elapsed)}`;
        if (prev.restart_in != null) {
          const left = prev.restart_in - (performance.now() - lastFetch) / 1000;
          line += ` · NEXT ROUND IN ${Math.max(0, Math.ceil(left))}`;
        }
        if ($("ov-s").textContent !== line) $("ov-s").textContent = line;
      }
    }
    requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- input
  // No reset here: the keyboard is within reach of visitors. See /admin.
  document.addEventListener("keydown", (e) => {
    if (e.key === "f" || e.key === "F") {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    }
  });

  window.addEventListener("resize", layout);

  // ---------------------------------------------------------------- go
  fetch("/api/config")
    .then((r) => r.json())
    .then((c) => {
      cfg = c;
      build();
      tick();
      poll();
    });
})();
