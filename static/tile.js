/* QR Minesweeper: phone page. Opened by scanning a tile's QR code.
   Shows the tile and lets the player choose REVEAL or FLAG. */
(() => {
  const $ = (id) => document.getElementById(id);
  const m = location.pathname.match(/\/t\/(\d+)/i);
  const id = m ? parseInt(m[1], 10) : NaN;

  const big = $("big");
  const msg = $("msg");
  const actions = $("actions");
  const btnReveal = $("btn-reveal");
  const btnFlag = $("btn-flag");

  const statusLabel = { ready: "READY", playing: "LIVE", won: "CLEARED", lost: "DETONATED" };
  let coord = "";
  let reloadTimer = null;

  function show(word, text, opts = {}) {
    big.textContent = word;
    big.classList.toggle("word", !opts.number);
    msg.textContent = text;
    document.body.classList.toggle("boom", !!opts.boom);
    actions.hidden = !opts.choose;
    btnFlag.textContent = opts.flagged ? "UNFLAG" : "FLAG";
    setBusy(false);
  }

  function setBusy(b) {
    for (const el of [btnReveal, btnFlag]) el.disabled = b;
  }

  // A finished round restarts on its own. Say when, and reload this page then
  // so the tile can be played in the new round.
  function nextRound(restartIn) {
    clearTimeout(reloadTimer);
    if (restartIn == null) return "";
    reloadTimer = setTimeout(load, restartIn * 1000 + 500);
    return ` NEXT ROUND IN ${Math.ceil(restartIn)} S.`;
  }

  async function api(path, method = "GET") {
    const r = await fetch(path, { method, cache: "no-store" });
    return r.json();
  }

  // ---------------------------------------------------------------- views
  function renderInfo(info) {
    coord = info.coord;
    $("coord").textContent = `TILE ${coord}`;
    $("status").textContent = `BOARD ${statusLabel[info.status] || ""}`;

    if (info.over) {
      const lost = info.status === "lost";
      return show(endWord(info.status, info.reason),
                  "THIS ROUND IS OVER." + nextRound(info.restart_in),
                  { boom: lost });
    }
    switch (info.state) {
      case "open":
        return info.count === 0
          ? show("CLEAR", "ALREADY OPEN. SCAN ANOTHER TILE.")
          : show(String(info.count), "ALREADY OPEN. SCAN ANOTHER TILE.", { number: true });
      case "flagged":
        return show(coord, "FLAGGED. REVEAL IT ANYWAY, OR TAKE THE FLAG OFF.",
                    { choose: true, flagged: true });
      default:
        return show(coord, "REVEAL IT, OR FLAG IT AS A MINE.", { choose: true });
    }
  }

  // A round is lost by hitting a mine, or by flagging every tile that is left
  // while some of those flags are wrong.
  function endWord(status, reason) {
    if (status === "won") return "CLEARED";
    return reason === "flags" ? "FAILED" : "DETONATED";
  }

  function showFailed(restartIn) {
    $("status").textContent = "BOARD FAILED";
    show("FAILED", "EVERY TILE LEFT IS FLAGGED, AND NOT EVERY FLAG IS A MINE." + nextRound(restartIn),
         { boom: true });
  }

  function renderReveal(r) {
    $("status").textContent = `BOARD ${statusLabel[r.status] || ""}`;
    switch (r.result) {
      case "boom":
        return show("BOOM", "THAT WAS A MINE. GAME OVER." + nextRound(r.restart_in),
                    { boom: true });
      case "fail":
        return showFailed(r.restart_in);
      case "win":
        return show("CLEARED", "LAST SAFE TILE. THE BOARD IS CLEAN." + nextRound(r.restart_in));
      case "ok":
        return r.count === 0
          ? show("CLEAR", `NO MINES NEARBY. OPENED ${r.opened} TILE${r.opened === 1 ? "" : "S"}.`)
          : show(String(r.count), `${r.count} MINE${r.count === 1 ? "" : "S"} TOUCHING THIS TILE`, { number: true });
      case "already":
        return show(String(r.count), "ALREADY OPEN. SCAN ANOTHER TILE.", { number: true });
      case "over":
        return show(endWord(r.status, r.reason),
                    "THIS ROUND IS OVER." + nextRound(r.restart_in),
                    { boom: r.status === "lost" });
      default:
        return show("?", "UNEXPECTED REPLY");
    }
  }

  // ---------------------------------------------------------------- actions
  async function load() {
    if (Number.isNaN(id)) return show("?", "UNKNOWN TILE");
    $("tile-id").textContent = `TILE ${String(id).padStart(2, "0")}`;
    try {
      const info = await api(`/api/tile/${id}`);
      if (info.error) return show("?", "UNKNOWN TILE");
      renderInfo(info);
    } catch (_) {
      show("OFFLINE", "COULD NOT REACH THE SERVER.");
    }
  }

  btnReveal.addEventListener("click", async () => {
    setBusy(true);
    try {
      renderReveal(await api(`/api/reveal/${id}`, "POST"));
    } catch (_) {
      show("OFFLINE", "COULD NOT REACH THE SERVER.");
    }
  });

  btnFlag.addEventListener("click", async () => {
    setBusy(true);
    try {
      const r = await api(`/api/flag/${id}`, "POST");
      if (!r.changed) return load(); // tile got opened or round ended meanwhile
      if (r.result === "fail") return showFailed(r.restart_in); // that was the last tile
      if (r.flagged) {
        show("FLAGGED", "MARKED ON THE WALL. CHANGED YOUR MIND?", { choose: true, flagged: true });
      } else {
        show(coord, "FLAG REMOVED.", { choose: true });
      }
    } catch (_) {
      show("OFFLINE", "COULD NOT REACH THE SERVER.");
    }
  });


  load();
})();
