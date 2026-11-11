// Chess Journey poster engine, copied from the poster studio. Draws the real posters customers buy.
(() => {
  const DISPLAY = '"Bodoni Moda", Didot, "Bodoni 72", Georgia, serif';
  const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  const RATIO = 1.41421356;
  // Where the last render put its peak marker and grid, so pages can crop close-ups
  let lastPeak = null, lastGrid = null, lastSpiral = null;

  const PALETTES = {
    chalk:     { name: "Chalk",     bg: "#ECEDE8", ink: "#1B1F1D", accent: "#2F5D50", mid: "#8B918C", faint: "#C8CCC6" },
    midnight:  { name: "Midnight",  bg: "#10161F", ink: "#E8E3D6", accent: "#D4A54E", mid: "#737A86", faint: "#283140" },
    rosewood:  { name: "Rosewood",  bg: "#E8D7D0", ink: "#2A1A19", accent: "#8C2E29", mid: "#9C807A", faint: "#CDB6AF" },
    blueprint: { name: "Blueprint", bg: "#1E3A56", ink: "#EAF0F5", accent: "#A6D8EA", mid: "#7591AC", faint: "#2F5072" },
    violet:    { name: "Violet",    bg: "#0C0913", ink: "#EEE9FA", accent: "#8E63F2", mid: "#6A5D86", faint: "#231B35" },
    graphite:  { name: "Graphite",  bg: "#141516", ink: "#F2F2EE", accent: "#5FE0C1", mid: "#F2A94B", faint: "#2A2C2E" },
    // Combinations sampled from the colour book photos
    pomegranate: { name: "Pomegranate", bg: "#B8BCB6", ink: "#1E1F21", accent: "#8E3343", mid: "#5F635E", faint: "#A3A8A2" },
    sulphurteal: { name: "Sulphur Teal", bg: "#F1EAB3", ink: "#1F3A3D", accent: "#3A7278", mid: "#C55E6E", faint: "#DED595" },
    citrine:     { name: "Citrine",     bg: "#F6E4A6", ink: "#2D2A22", accent: "#6E6127", mid: "#84716C", faint: "#E2CF8E" },
    indigored:   { name: "Indigo Red",  bg: "#F4F3EF", ink: "#0B1020", accent: "#B42321", mid: "#D66978", faint: "#E2E0DA" },
    nightgreen:  { name: "Night Green", bg: "#21160C", ink: "#F1D3B9", accent: "#8EB32A", mid: "#9A776C", faint: "#3A2A1F" },
    orangeslate: { name: "Orange Slate", bg: "#252E25", ink: "#CFE6EC", accent: "#F57937", mid: "#8AA08A", faint: "#36413A" },
    cinnamon:    { name: "Cinnamon",    bg: "#F2D29A", ink: "#1F3319", accent: "#466839", mid: "#AA818E", faint: "#E0BE82" },
    helvetia:    { name: "Helvetia",    bg: "#2A303F", ink: "#E5DEB2", accent: "#C06679", mid: "#B47A4A", faint: "#3A4255" },
  };
  const POOL_LABEL = { rapid: "Rapid", blitz: "Blitz", bullet: "Bullet", daily: "Daily", classical: "Classical" };

  const state = { all: [], player: "", pool: "", layout: "climb", palette: "chalk", title: "", sample: true };

  // ---------- PGN parsing ----------
  function parsePGN(text) {
    const out = [];
    const chunks = text.split(/(?=\[Event\s+")/);
    const re = /\[(\w+)\s+"([^"]*)"\]/g;
    for (const chunk of chunks) {
      if (!chunk.includes("[")) continue;
      const h = {};
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(chunk))) h[m[1]] = m[2];
      if (!h.White || !h.Black || !h.Result) continue;
      // Variants (Chess960, Crazyhouse…) and custom start positions have their own ratings
      if ((h.Variant && h.Variant !== "Standard") || h.SetUp === "1") continue;
      const dateStr = h.UTCDate || h.Date || h.EndDate || "";
      const timeStr = h.UTCTime || h.StartTime || h.EndTime || "00:00:00";
      const d = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})/);
      if (!d) continue;
      const t = timeStr.match(/(\d{1,2}):(\d{2}):?(\d{2})?/) || [0, 0, 0, 0];
      const when = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1] || 0, +t[2] || 0, +t[3] || 0);
      out.push({
        white: h.White, black: h.Black, result: h.Result,
        welo: parseInt(h.WhiteElo, 10), belo: parseInt(h.BlackElo, 10),
        when, pool: poolOf(h.TimeControl, h.Event), opening: openingOf(h),
      });
    }
    return out;
  }

  function poolOf(tc, event) {
    if (!tc || tc === "-" || tc.includes("/")) return "daily";
    const [b, inc] = tc.split("+");
    const est = (parseInt(b, 10) || 0) + 40 * (parseInt(inc, 10) || 0);
    if (est < 180) return "bullet";
    if (est < 600) return "blitz";
    if (est < 1800 || /chess\.com|live chess/i.test(event || "")) return "rapid";
    return "classical";
  }

  function openingOf(h) {
    let name = "";
    if (h.Opening && h.Opening !== "?") name = h.Opening.split(":")[0];
    else if (h.ECOUrl) {
      const seg = decodeURIComponent(h.ECOUrl.split("/").pop() || "");
      name = seg.split(/-\d+\./)[0].replace(/-/g, " ");
    }
    name = name.replace(/\bQueens\b/g, "Queen's").replace(/\bKings\b/g, "King's").replace(/\bBirds\b/g, "Bird's").trim();
    if (!name) return "";
    const words = name.split(/\s+/);
    const keys = ["Defense", "Defence", "Game", "Opening", "Gambit", "Attack", "System", "Variation"];
    for (let i = 0; i < words.length; i++) if (keys.includes(words[i])) return words.slice(0, i + 1).join(" ");
    return words.slice(0, 2).join(" ");
  }

  // ---------- Sample player ----------
  function samplePGN() {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rnd(); return s - 3; };
    const openings = [["Italian-Game", 22], ["Queens-Gambit-Declined", 14], ["Sicilian-Defense", 16], ["London-System", 12],
      ["Caro-Kann-Defense", 10], ["Scandinavian-Defense", 6], ["French-Defense", 6], ["Kings-Indian-Defense", 5], ["Ruy-Lopez-Opening", 9]];
    const totalW = openings.reduce((a, o) => a + o[1], 0);
    const pickOpening = () => { let r = rnd() * totalW; for (const o of openings) { if ((r -= o[1]) <= 0) return o[0]; } return openings[0][0]; };
    const start = Date.UTC(2020, 2, 14), end = Date.UTC(2026, 9, 28);
    const lines = [];
    const make = (n, tc, target, noise) => {
      let t = start, r = target(0), prev = r;
      for (let i = 0; i < n; i++) {
        t += (end - start) / n * (0.2 + rnd() * 1.6);
        if (t > end) t = end - (n - i) * 60000;
        const f = i / (n - 1);
        r = r + (target(f) - r) * 0.08 + gauss() * noise;
        const diff = r - prev; prev = r;
        const res = Math.abs(diff) < noise * 0.12 ? "1/2-1/2" : diff > 0 ? "W" : "L";
        const asWhite = rnd() < 0.5;
        const me = "sample_player", opp = "opponent" + Math.floor(rnd() * 900);
        const result = res === "1/2-1/2" ? res : (res === "W") === asWhite ? "1-0" : "0-1";
        const myElo = Math.round(r), oppElo = Math.round(r + gauss() * 60);
        const d = new Date(t);
        const ds = `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
        const ts = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:00`;
        lines.push(`[Event "Live Chess"]\n[UTCDate "${ds}"]\n[UTCTime "${ts}"]\n[White "${asWhite ? me : opp}"]\n[Black "${asWhite ? opp : me}"]\n[Result "${result}"]\n[WhiteElo "${asWhite ? myElo : oppElo}"]\n[BlackElo "${asWhite ? oppElo : myElo}"]\n[TimeControl "${tc}"]\n[ECOUrl "https://www.chess.com/openings/${pickOpening()}-3.Nf3"]\n\n1. e4 e5 ${result}\n`);
      }
    };
    // Rapid: steady climb with a slump in 2022 and a late breakthrough.
    make(1386, "600", f => 640 + 820 / (1 + Math.exp(-7 * (f - 0.42))) - 90 * Math.exp(-Math.pow((f - 0.36) / 0.05, 2)) + 70 * Math.max(0, f - 0.85) / 0.15, 22);
    make(512, "180+2", f => 560 + 700 * f, 26);
    return lines.join("\n");
  }

  // ---------- Derived data ----------
  function playersOf(games) {
    const c = new Map();
    for (const g of games) { c.set(g.white, (c.get(g.white) || 0) + 1); c.set(g.black, (c.get(g.black) || 0) + 1); }
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }
  function gamesFor(player) {
    const p = player.toLowerCase();
    const res = [];
    for (const g of state.all) {
      const w = g.white.toLowerCase() === p, b = g.black.toLowerCase() === p;
      if (!w && !b) continue;
      const rating = w ? g.welo : g.belo;
      if (!Number.isFinite(rating)) continue;
      let r = "D";
      if (g.result === "1-0") r = w ? "W" : "L"; else if (g.result === "0-1") r = b ? "W" : "L";
      res.push({ when: g.when, rating, r, pool: g.pool, opening: g.opening });
    }
    return res.sort((a, b) => a.when - b.when);
  }
  function model() {
    const games = gamesFor(state.player).filter(g => g.pool === state.pool);
    const n = games.length;
    if (n < 5) return { n, games };
    const ratings = games.map(g => g.rating);
    const k = Math.max(3, Math.min(25, Math.round(n / 60))) | 1;
    const half = k >> 1;
    const smooth = ratings.map((_, i) => {
      const w = ratings.slice(Math.max(0, i - half), Math.min(n, i + half + 1)).sort((a, b) => a - b);
      return w[w.length >> 1];
    });
    let peakI = 0; ratings.forEach((r, i) => { if (r > ratings[peakI]) peakI = i; });
    let W = 0, D = 0, L = 0, streak = 0, best = 0;
    for (const g of games) {
      if (g.r === "W") { W++; streak++; best = Math.max(best, streak); } else { streak = 0; g.r === "D" ? D++ : L++; }
    }
    const oc = new Map();
    games.forEach(g => g.opening && oc.set(g.opening, (oc.get(g.opening) || 0) + 1));
    const top = [...oc.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    return { n, games, ratings, smooth, window: k, peakI, W, D, L, best, top, first: games[0].when, last: games[n - 1].when };
  }

  const fmt = n => n.toLocaleString("en-GB");
  const month = t => new Date(t).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  const day = t => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  // ---------- Rendering ----------
  function setSpacing(ctx, px) { if ("letterSpacing" in ctx) ctx.letterSpacing = px + "px"; }

  function render(ctx, W, H, M, opts) {
    lastPeak = null; lastGrid = null; lastSpiral = null;
    const P = PALETTES[opts.palette];
    const u = W / 1000, m = 76 * u;
    ctx.save();
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "alphabetic";

    // Eyebrow
    ctx.fillStyle = P.mid; ctx.font = `500 ${14 * u}px ${MONO}`; setSpacing(ctx, 3.2 * u);
    ctx.textAlign = "left";
    ctx.fillText(`CHESS JOURNEY  ·  ${(POOL_LABEL[opts.pool] || "").toUpperCase()}`, m, m + 14 * u);
    setSpacing(ctx, 0);

    // Title, sized to fit the width
    const title = opts.title || opts.player || "Your name";
    ctx.font = `600 100px ${DISPLAY}`;
    const w100 = ctx.measureText(title).width || 1;
    const ts = Math.min(124 * u, (W - 2 * m) / w100 * 100);
    ctx.font = `600 ${ts}px ${DISPLAY}`; ctx.fillStyle = P.ink;
    const titleY = m + 14 * u + 26 * u + ts * 0.78;
    ctx.fillText(title, m - ts * 0.02, titleY);

    if (M.n < 5) {
      ctx.font = `400 italic ${30 * u}px ${DISPLAY}`; ctx.fillStyle = P.mid;
      ctx.fillText("Not enough rated games in this pool yet.", m, titleY + 70 * u);
      ctx.restore(); return;
    }
    // When the title is a real name, the username goes underneath it
    const handle = opts.player && opts.title && opts.title.trim().toLowerCase() !== opts.player.toLowerCase() ? `@${opts.player}  ·  ` : "";
    const sub = `${handle}${fmt(M.n)} games, ${month(M.first)} to ${month(M.last)}`;
    ctx.font = `400 italic 100px ${DISPLAY}`;
    const subSize = Math.min(30 * u, (W - 2 * m) / (ctx.measureText(sub).width || 1) * 100);
    ctx.font = `400 italic ${subSize}px ${DISPLAY}`; ctx.fillStyle = P.ink; ctx.globalAlpha = 0.78;
    const subY = titleY + ts * 0.24 + 36 * u;
    ctx.fillText(sub, m, subY);
    ctx.globalAlpha = 1;

    const top = subY + 56 * u;
    const footTop = H - m - 196 * u;
    const bottom = footTop - 46 * u;
    let perDot = 1;
    if (opts.layout === "grid") perDot = drawGrid(ctx, M, P, u, m, W, top, bottom);
    else if (opts.layout === "spiral") drawSpiral(ctx, M, P, u, m, W, top, bottom);
    else drawClimb(ctx, M, P, u, m, W, top, bottom, opts.pool);

    // Footer stats
    ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.85; ctx.lineWidth = 1.4 * u;
    ctx.beginPath(); ctx.moveTo(m, footTop); ctx.lineTo(W - m, footTop); ctx.stroke(); ctx.globalAlpha = 1;
    const stats = [
      [fmt(M.ratings[M.peakI]), "Peak rating"],
      [fmt(M.n), "Games played"],
      [Math.round(M.W / M.n * 100) + "%", "Win rate"],
      [fmt(M.best), "Longest win streak"],
    ];
    const colW = (W - 2 * m) / 4;
    stats.forEach(([v, l], i) => {
      const x = m + i * colW;
      ctx.fillStyle = P.ink; ctx.font = `400 ${54 * u}px ${DISPLAY}`; ctx.textAlign = "left";
      ctx.fillText(v, x, footTop + 76 * u);
      ctx.fillStyle = P.mid; ctx.font = `500 ${11.5 * u}px ${MONO}`; setSpacing(ctx, 2 * u);
      ctx.fillText(l.toUpperCase(), x, footTop + 104 * u);
      setSpacing(ctx, 0);
    });
    if (M.top) {
      ctx.fillStyle = P.ink; ctx.font = `400 italic ${24 * u}px ${DISPLAY}`;
      ctx.fillText(`Most played opening: ${M.top[0]}, ${fmt(M.top[1])} games`, m, footTop + 158 * u);
    }
    // Caption
    ctx.fillStyle = P.mid; ctx.font = `500 ${10.5 * u}px ${MONO}`; setSpacing(ctx, 2 * u);
    const caps = {
      grid: perDot > 1 ? `EACH DOT IS ${perDot} GAMES · RING MARKS EACH YEAR'S PEAK` : "EACH DOT IS ONE GAME · RING MARKS EACH YEAR'S PEAK",
      spiral: "ONE TURN PER YEAR · DISTANCE FROM CENTRE = RATING",
    };
    const cap = caps[opts.layout] || `${(POOL_LABEL[opts.pool] || "").toUpperCase()} RATING · ${M.window}-GAME ROLLING MEDIAN`;
    ctx.fillText(cap, m, H - m + 18 * u);
    if (opts.layout === "grid") legend(ctx, P, u, W - m, H - m + 18 * u, perDot > 1 ? "batch" : "dot");
    if (opts.layout === "spiral") legend(ctx, P, u, W - m, H - m + 18 * u, "dot");
    setSpacing(ctx, 0);
    ctx.restore();
  }

  function legend(ctx, P, u, right, y, style) {
    const items = style === "batch" ? [["MOSTLY WINS", "w"], ["EVEN", "d"], ["MOSTLY LOSSES", "l"]]
      : [["WIN", "w"], ["DRAW", "d"], ["LOSS", "l"]];
    ctx.textAlign = "left";
    const lead = 14 * u;
    const widths = items.map(([t]) => ctx.measureText(t).width + lead + 12 * u);
    let x = right - widths.reduce((a, b) => a + b, 0) + 12 * u;
    items.forEach(([t, k], i) => {
      dot(ctx, P, k, x + 5 * u, y - 4 * u, 4.5 * u, u);
      ctx.fillStyle = P.mid; ctx.fillText(t, x + lead, y); x += widths[i];
    });
  }

  // Peak highlight: soft glow, ring, label kept inside the poster
  function peak(ctx, P, u, W, m, top, x, y, M, place) {
    lastPeak = { x, y };
    const g = ctx.createRadialGradient(x, y, 0, x, y, 40 * u);
    g.addColorStop(0, hexA(P.accent, 0.55)); g.addColorStop(1, hexA(P.accent, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 40 * u, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 9 * u, 0, Math.PI * 2); ctx.lineWidth = 2.6 * u; ctx.strokeStyle = P.ink; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 3.6 * u, 0, Math.PI * 2); ctx.fillStyle = P.ink; ctx.fill();
    const right = x > W - m - 240 * u;
    const below = place === "below" || y - 70 * u < top;
    const lx = x + (right ? -18 : 18) * u, ly = below ? y + 56 * u : y - 26 * u;
    label(ctx, P, u, lx, ly, right ? "right" : "left", "PEAK · " + day(M.games[M.peakI].when).toUpperCase(), fmt(M.ratings[M.peakI]));
  }

  function dot(ctx, P, kind, x, y, r, u) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (kind === "w") { ctx.fillStyle = P.accent; ctx.fill(); }
    else if (kind === "d") { ctx.fillStyle = P.mid; ctx.fill(); }
    else { ctx.strokeStyle = P.mid; ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(0.6 * u, r * 0.22); ctx.stroke(); ctx.globalAlpha = 1; }
  }

  function drawClimb(ctx, M, P, u, m, W, top, bottom, pool) {
    const { ratings, smooth, n } = M;
    const x0 = m + 54 * u, x1 = W - m, y0 = top + 30 * u, y1 = bottom - 34 * u;
    const sorted = [...ratings].sort((a, b) => a - b);
    const lo0 = Math.min(sorted[Math.floor(n * 0.01)], ...smooth), hi0 = Math.max(sorted[Math.ceil(n * 0.99) - 1], ratings[M.peakI]);
    const step = hi0 - lo0 > 900 ? 200 : 100;
    const lo = Math.floor((lo0 - 20) / step) * step - step, hi = Math.ceil((hi0 + 20) / step) * step;
    const X = i => x0 + (x1 - x0) * (n === 1 ? 0 : i / (n - 1));
    const Y = r => y1 - (y1 - y0) * (Math.min(hi, Math.max(lo, r)) - lo) / (hi - lo);

    // Grid and rating labels
    ctx.font = `400 ${11 * u}px ${MONO}`; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let v = lo; v <= hi; v += step) {
      const y = Y(v);
      ctx.strokeStyle = P.faint; ctx.lineWidth = 1 * u; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillStyle = P.mid; ctx.fillText(fmt(v), x0 - 12 * u, y);
    }
    ctx.textBaseline = "alphabetic";

    // Every game as a faint dot
    ctx.fillStyle = P.mid; ctx.globalAlpha = n > 2000 ? 0.22 : 0.32;
    const dr = Math.max(1.1 * u, Math.min(2.4 * u, 1600 * u / n));
    for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(X(i), Y(ratings[i]), dr, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;

    // Smoothed line with soft area
    const stepI = Math.max(1, Math.floor(n / 500));
    const pts = [];
    for (let i = 0; i < n; i += stepI) pts.push([X(i), Y(smooth[i])]);
    pts.push([X(n - 1), Y(smooth[n - 1])]);
    const grad = ctx.createLinearGradient(0, y0, 0, y1);
    grad.addColorStop(0, hexA(P.accent, 0.30)); grad.addColorStop(1, hexA(P.accent, 0));
    ctx.beginPath(); ctx.moveTo(pts[0][0], y1); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(pts[pts.length - 1][0], y1); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.strokeStyle = P.accent; ctx.lineWidth = 3.4 * u; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();

    // Baseline and years
    ctx.strokeStyle = P.ink; ctx.lineWidth = 1.2 * u; ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.font = `500 ${12 * u}px ${MONO}`; ctx.textAlign = "center"; ctx.fillStyle = P.ink;
    let lastYear = new Date(M.games[0].when).getUTCFullYear(), lastX = -1e9;
    M.games.forEach((g, i) => {
      const yr = new Date(g.when).getUTCFullYear();
      if (i === 0 || yr !== lastYear) {
        const x = X(i);
        ctx.strokeStyle = P.ink; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y1 + 8 * u); ctx.stroke();
        if (x - lastX > 46 * u && x < x1 - 10 * u) { ctx.fillText(String(yr), x, y1 + 27 * u); lastX = x; }
        lastYear = yr;
      }
    });

    // Start and peak markers
    const sx = X(0), sy = Y(smooth[0]);
    marker(ctx, P, u, sx, sy);
    label(ctx, P, u, sx + 14 * u, sy + 34 * u, "left", "FIRST RATED GAME", fmt(ratings[0]));
    peak(ctx, P, u, W, m, top, X(M.peakI), Y(ratings[M.peakI]), M, "");
  }

  function marker(ctx, P, u, x, y) {
    ctx.beginPath(); ctx.arc(x, y, 7 * u, 0, Math.PI * 2); ctx.fillStyle = P.bg; ctx.fill();
    ctx.lineWidth = 2.6 * u; ctx.strokeStyle = P.ink; ctx.stroke();
  }
  function label(ctx, P, u, x, y, align, small, big) {
    ctx.font = `500 ${10.5 * u}px ${MONO}`; setSpacing(ctx, 1.8 * u);
    const ws = ctx.measureText(small).width; setSpacing(ctx, 0);
    ctx.font = `600 ${26 * u}px ${DISPLAY}`;
    const wb = ctx.measureText(big).width;
    const bw = Math.max(ws, wb) + 16 * u, bx = align === "right" ? x - bw + 8 * u : x - 8 * u;
    ctx.fillStyle = hexA(P.bg, 0.82);
    ctx.fillRect(bx, y - 42 * u, bw, 52 * u);
    ctx.textAlign = align;
    ctx.fillStyle = P.mid; ctx.font = `500 ${10.5 * u}px ${MONO}`; setSpacing(ctx, 1.8 * u);
    ctx.fillText(small, x, y - 24 * u); setSpacing(ctx, 0);
    ctx.fillStyle = P.ink; ctx.font = `600 ${26 * u}px ${DISPLAY}`; ctx.fillText(big, x, y + 2 * u);
  }

  // How many games one dot stands for, so dots stay legible for very active players
  function gamesPerDot(n) {
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    return steps.find(k => n / k <= 2200) || 2000;
  }

  function drawGrid(ctx, M, P, u, m, W, top, bottom) {
    const K = gamesPerDot(M.n);
    const years = [];
    M.games.forEach((g, i) => {
      const y = new Date(g.when).getUTCFullYear();
      if (!years.length || years[years.length - 1].year !== y) years.push({ year: y, idx: [], peak: -1 });
      const yb = years[years.length - 1];
      yb.idx.push(i);
      if (yb.peak < 0 || M.ratings[i] > M.ratings[yb.peak]) yb.peak = i;
    });
    years.forEach(yb => {
      yb.bins = [];
      for (let s = 0; s < yb.idx.length; s += K) {
        const ids = yb.idx.slice(s, s + K);
        let w = 0, d = 0;
        ids.forEach(i => { const r = M.games[i].r; if (r === "W") w++; else if (r === "D") d++; });
        const share = (w + d / 2) / ids.length;
        const kind = K === 1 ? (w ? "w" : d ? "d" : "l") : share >= 0.55 ? "w" : share <= 0.45 ? "l" : "d";
        yb.bins.push({ kind, from: ids[0], to: ids[ids.length - 1] });
      }
    });

    const Y = years.length, labelW = 104 * u, gap = 12 * u, H = bottom - top;
    const minH = Math.min(52 * u, (H - gap * (Y - 1)) / Y);
    const w = W - 2 * m - labelW;
    const fit = cols => {
      const rows = years.map(y => Math.ceil(y.bins.length / cols));
      let cell = Math.min(w / cols, (H - gap * (Y - 1)) / rows.reduce((a, b) => a + b, 0));
      for (let k = 0; k < 80; k++) {
        const used = rows.reduce((a, r) => a + Math.max(r * cell, minH), 0) + gap * (Y - 1);
        if (used <= H) break;
        cell *= 0.97;
      }
      return { cols, cell, rows };
    };
    let best = fit(8);
    for (let cols = 9; cols <= 320; cols++) { const f = fit(cols); if (f.cell > best.cell) best = f; }
    const { cols, cell, rows } = best;
    const blocks = rows.map(r => Math.max(r * cell, minH));
    const used = blocks.reduce((a, b) => a + b, 0) + gap * (Y - 1);
    let y = top + Math.max(0, (H - used) / 2);
    const r = cell * 0.36;
    lastGrid = { x: m, y };
    let peakXY = null;
    const rings = [];

    years.forEach((yb, yi) => {
      const bh = blocks[yi], line = Math.min(15 * u, bh / 3.3);
      const gy = y + (bh - rows[yi] * cell) / 2;
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillStyle = P.ink; ctx.font = `500 ${Math.min(13 * u, line * 0.9)}px ${MONO}`;
      ctx.fillText(String(yb.year), m, y);
      ctx.fillStyle = P.mid; ctx.font = `400 ${Math.min(10 * u, line * 0.72)}px ${MONO}`;
      ctx.fillText(`${fmt(yb.idx.length)} games`, m, y + line);
      ctx.fillStyle = P.ink; ctx.font = `500 ${Math.min(10 * u, line * 0.72)}px ${MONO}`; setSpacing(ctx, 0.8 * u);
      ctx.fillText(`PEAK ${fmt(M.ratings[yb.peak])}`, m, y + line * 2);
      setSpacing(ctx, 0);
      ctx.textBaseline = "alphabetic";
      yb.bins.forEach((b, i) => {
        const cx = m + labelW + (i % cols) * cell + cell / 2, cy = gy + Math.floor(i / cols) * cell + cell / 2;
        dot(ctx, P, b.kind, cx, cy, r, u);
        if (yb.peak >= b.from && yb.peak <= b.to) rings.push([cx, cy]);
        if (M.peakI >= b.from && M.peakI <= b.to) peakXY = [cx, cy];
      });
      y += bh + gap;
    });
    // Yearly peak rings go on last so no dot is drawn over them
    ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(1.1 * u, r * 0.28);
    rings.forEach(([cx, cy]) => { ctx.beginPath(); ctx.arc(cx, cy, r * 1.75 + 1.2 * u, 0, Math.PI * 2); ctx.stroke(); });
    if (peakXY) peak(ctx, P, u, W, m, top, peakXY[0], peakXY[1], M, "");
    return K;
  }

  // The spiral: one turn per year, distance from the centre is rating
  function drawSpiral(ctx, M, P, u, m, W, top, bottom) {
    const { ratings, smooth, n } = M;
    const size = Math.min(W - 2 * m, bottom - top);
    const cx = W / 2, cy = top + (bottom - top) / 2;
    const Rmax = size / 2 - 34 * u, hole = Rmax * 0.1, Rin = Rmax * 0.3;
    const sorted = [...ratings].sort((a, b) => a - b);
    const lo0 = Math.min(sorted[Math.floor(n * 0.01)], ...smooth), hi0 = Math.max(sorted[Math.ceil(n * 0.99) - 1], ratings[M.peakI]);
    const step = hi0 - lo0 > 900 ? 200 : 100;
    const lo = Math.floor((lo0 - 20) / step) * step, hi = Math.ceil((hi0 + 20) / step) * step;
    lastSpiral = { cx, cy, Rmax, size, top, bottom };
    const R = r => Rin + (Rmax - Rin) * (Math.min(hi, Math.max(lo - step * 0.8, r)) - lo) / (hi - lo);
    const yearFrac = t => {
      const d = new Date(t), y = d.getUTCFullYear();
      const a = Date.UTC(y, 0, 1), b = Date.UTC(y + 1, 0, 1);
      return (t - a) / (b - a);
    };
    const XY = (t, r) => { const a = -Math.PI / 2 + yearFrac(t) * Math.PI * 2, rr = R(r); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; };

    // Twelve month spokes and the rating rings
    ctx.strokeStyle = P.ink; ctx.lineWidth = 1 * u; ctx.globalAlpha = 0.09;
    for (let k = 0; k < 12; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 6;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * hole, cy + Math.sin(a) * hole);
      ctx.lineTo(cx + Math.cos(a) * (Rmax + 6 * u), cy + Math.sin(a) * (Rmax + 6 * u)); ctx.stroke();
    }
    ctx.globalAlpha = 0.16;
    for (let v = lo; v <= hi; v += step) { ctx.beginPath(); ctx.arc(cx, cy, R(v), 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;

    // Month names just outside the circle, centred in each month
    ctx.fillStyle = P.mid; ctx.font = `500 ${11 * u}px ${MONO}`; setSpacing(ctx, 1.6 * u);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"].forEach((mo, k) => {
      const a = -Math.PI / 2 + (k + 0.5) * Math.PI / 6, rr = Rmax + 22 * u;
      ctx.fillText(mo, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    });
    setSpacing(ctx, 0);

    // Every game: wins filled, draws solid, losses as rings
    const dr = Math.max(0.9 * u, Math.min(2.6 * u, 3600 * u / n));
    const fade = n > 8000 ? 0.45 : 1;
    const groups = { w: [], d: [], l: [] };
    M.games.forEach((g, i) => groups[g.r === "W" ? "w" : g.r === "D" ? "d" : "l"].push(XY(g.when, ratings[i])));
    ctx.strokeStyle = P.mid; ctx.lineWidth = Math.max(0.5 * u, dr * 0.4); ctx.globalAlpha = 0.8 * fade;
    ctx.beginPath(); groups.l.forEach(([x, y]) => { ctx.moveTo(x + dr, y); ctx.arc(x, y, dr, 0, Math.PI * 2); }); ctx.stroke();
    ctx.fillStyle = P.mid; ctx.globalAlpha = 0.85 * fade;
    ctx.beginPath(); groups.d.forEach(([x, y]) => { ctx.moveTo(x + dr, y); ctx.arc(x, y, dr, 0, Math.PI * 2); }); ctx.fill();
    ctx.fillStyle = P.accent; ctx.globalAlpha = 0.6 * fade;
    ctx.beginPath(); groups.w.forEach(([x, y]) => { ctx.moveTo(x + dr, y); ctx.arc(x, y, dr, 0, Math.PI * 2); }); ctx.fill();
    ctx.globalAlpha = 1;

    // The journey itself: the smoothed rating, spiralling out
    // Short breaks follow the arc; breaks of more than three months lift the pen
    const stepI = Math.max(1, Math.floor(n / 1500));
    const DAY = 86400000;
    const idx = [];
    for (let i = 0; i < n; i += stepI) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    ctx.beginPath();
    idx.forEach((i, k) => {
      const t = M.games[i].when, [x, y] = XY(t, smooth[i]);
      if (!k) { ctx.moveTo(x, y); return; }
      const j = idx[k - 1], t0 = M.games[j].when, gap = t - t0;
      if (gap > 92 * DAY) { ctx.moveTo(x, y); return; }
      for (let s = Math.floor(gap / (4 * DAY)); s > 0 && gap > 6 * DAY; s--) {
        const f = 1 - s / (Math.floor(gap / (4 * DAY)) + 1);
        const [ix, iy] = XY(t0 + gap * f, smooth[j] + (smooth[i] - smooth[j]) * f);
        ctx.lineTo(ix, iy);
      }
      ctx.lineTo(x, y);
    });
    ctx.strokeStyle = P.bg; ctx.lineWidth = 6.4 * u; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.globalAlpha = 0.7; ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = P.accent; ctx.lineWidth = 3.4 * u; ctx.stroke();

    // Rating values along the bottom spoke
    ctx.font = `400 ${10 * u}px ${MONO}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    for (let v = lo; v <= hi; v += step) {
      const y = cy + R(v), t = fmt(v), w = ctx.measureText(t).width;
      ctx.fillStyle = hexA(P.bg, 0.9); ctx.fillRect(cx + 5 * u, y - 7.5 * u, w + 7 * u, 15 * u);
      ctx.fillStyle = P.mid; ctx.fillText(t, cx + 8.5 * u, y);
    }

    // Where each year begins on the line
    ctx.font = `500 ${11 * u}px ${MONO}`;
    const placed = [];
    let lastYear = null;
    M.games.forEach((g, i) => {
      const yr = new Date(g.when).getUTCFullYear();
      if (yr === lastYear) return;
      lastYear = yr;
      let [x, y] = XY(g.when, smooth[i]);
      const t = String(yr), w = ctx.measureText(t).width + 8 * u;
      x += 8 * u;
      for (let k = 0; k < 8 && placed.some(p => Math.abs(p[0] - x) < w && Math.abs(p[1] - y) < 15 * u); k++) y += 15 * u;
      placed.push([x, y]);
      ctx.fillStyle = hexA(P.bg, 0.9); ctx.fillRect(x, y - 7.5 * u, w, 15 * u);
      ctx.fillStyle = P.ink; ctx.textAlign = "left"; ctx.fillText(t, x + 4 * u, y);
    });
    ctx.textBaseline = "alphabetic";

    // Start
    const [sx, sy] = XY(M.games[0].when, smooth[0]);
    ctx.beginPath(); ctx.arc(sx, sy, 5 * u, 0, Math.PI * 2); ctx.fillStyle = P.bg; ctx.fill();
    ctx.lineWidth = 2 * u; ctx.strokeStyle = P.ink; ctx.stroke();

    // Peak, with its label in the nearest corner so it never sits on the dots
    const [px, py] = XY(M.games[M.peakI].when, ratings[M.peakI]);
    const right = px > cx, below = py > cy;
    const lx = right ? W - m : m, ly = below ? bottom - 4 * u : top + 52 * u;
    ctx.strokeStyle = P.ink; ctx.lineWidth = 1 * u;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(lx + (right ? -40 : 40) * u, ly + (below ? -50 : 14) * u); ctx.stroke();
    const g = ctx.createRadialGradient(px, py, 0, px, py, 40 * u);
    g.addColorStop(0, hexA(P.accent, 0.55)); g.addColorStop(1, hexA(P.accent, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 40 * u, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px, py, 9 * u, 0, Math.PI * 2); ctx.fillStyle = P.bg; ctx.fill();
    ctx.lineWidth = 2.6 * u; ctx.strokeStyle = P.ink; ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py, 3.6 * u, 0, Math.PI * 2); ctx.fillStyle = P.ink; ctx.fill();
    lastPeak = { x: px, y: py };
    label(ctx, P, u, lx, ly, right ? "right" : "left", "PEAK · " + day(M.games[M.peakI].when).toUpperCase(), fmt(ratings[M.peakI]));
    label(ctx, P, u, right ? m : W - m, below ? top + 52 * u : bottom - 4 * u, right ? "left" : "right", "FIRST RATED GAME", fmt(ratings[0]));
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }


  window.CJ = { render, PALETTES, RATIO, model, parsePGN, samplePGN, state, peak: () => lastPeak };
})();
