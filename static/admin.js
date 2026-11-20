/* QR Minesweeper: admin page. Password login, then live status and reset. */
(() => {
  const $ = (id) => document.getElementById(id);
  const big = $("big");
  const msg = $("msg");
  const login = $("login");
  const panel = $("panel");
  const btnReset = $("btn-reset");

  const POLL_MS = 1000;
  const ARM_MS = 3000;
  const statusLabel = { ready: "READY", playing: "LIVE", won: "CLEARED", lost: "DETONATED" };

  let state = null;
  let timer = null;      // state poll
  let armed = null;      // pending "tap again" timeout

  const pad = (n) => String(n).padStart(2, "0");
  const fmtTime = (s) => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s) % 60)}`;

  async function call(path, method = "GET", body) {
    const r = await fetch(path, {
      method,
      cache: "no-store",
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  }

  function view(name, word, text) {
    login.hidden = name !== "login";
    panel.hidden = name !== "panel";
    big.textContent = word;
    msg.textContent = text;
    if (name !== "panel") {
      clearTimeout(timer);
      disarm();
      $("f-left").innerHTML = "&nbsp;";
      $("f-right").innerHTML = "&nbsp;";
    }
  }

  function showLogin(text = "ENTER THE ADMIN PASSWORD.") {
    view("login", "LOCKED", text);
    $("password").value = "";
  }

  // ---------------------------------------------------------------- panel
  function disarm() {
    clearTimeout(armed);
    armed = null;
    btnReset.textContent = "NEW GAME";
  }

  function render(st) {
    state = st;
    big.textContent = st.status === "lost" && st.reason === "flags"
      ? "FAILED" : statusLabel[st.status] || "?";
    const safe = st.cols * st.rows - st.mines;
    msg.textContent = `TIME ${fmtTime(st.elapsed)} · OPEN ${st.revealed}/${safe} · FLAGS ${st.flags}`;
    $("f-left").textContent = `${st.cols} X ${st.rows} · ${st.mines} MINES`;
    $("f-right").textContent = `GAME ${pad(st.games)}`;
  }

  async function poll() {
    clearTimeout(timer);
    try {
      const r = await call("/api/state");
      if (r.status === 200) render(r.data);
    } catch (_) {
      big.textContent = "OFFLINE";
      msg.textContent = "COULD NOT REACH THE SERVER.";
    }
    if (!panel.hidden) timer = setTimeout(poll, POLL_MS);
  }

  function showPanel() {
    view("panel", "…", "LOADING");
    poll();
  }

  // ---------------------------------------------------------------- actions
  login.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("btn-login").disabled = true;
    try {
      const r = await call("/api/admin/login", "POST", { password: $("password").value });
      if (r.status === 200) showPanel();
      else if (r.status === 429) showLogin("TOO MANY ATTEMPTS. WAIT A MINUTE.");
      else showLogin("WRONG PASSWORD.");
    } catch (_) {
      showLogin("COULD NOT REACH THE SERVER.");
    } finally {
      $("btn-login").disabled = false;
    }
  });

  btnReset.addEventListener("click", async () => {
    // Cutting a live round short takes a second tap.
    if (state && state.status === "playing" && !armed) {
      btnReset.textContent = "TAP AGAIN TO RESET";
      armed = setTimeout(disarm, ARM_MS);
      return;
    }
    disarm();
    btnReset.disabled = true;
    try {
      const r = await call("/api/reset", "POST");
      if (r.status === 403) showLogin("SESSION EXPIRED. LOG IN AGAIN.");
      else poll();
    } catch (_) {
      msg.textContent = "COULD NOT REACH THE SERVER.";
    } finally {
      btnReset.disabled = false;
    }
  });

  $("btn-logout").addEventListener("click", async () => {
    try { await call("/api/admin/logout", "POST"); } catch (_) { /* cookie stays */ }
    showLogin();
  });

  // ---------------------------------------------------------------- go
  (async () => {
    try {
      const r = await call("/api/admin/session");
      if (!r.data.enabled) return view("off", "DISABLED", "NO ADMIN PASSWORD IS SET ON THE SERVER.");
      if (r.data.authed) showPanel();
      else showLogin();
    } catch (_) {
      view("off", "OFFLINE", "COULD NOT REACH THE SERVER.");
    }
  })();
})();
