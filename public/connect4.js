/* Four in a Row: drop discs and connect four before the bot does. */
(function () {
  'use strict';
  const L = LSPG, rr = L.rr;
  const COLS = 7, ROWS = 6, SZ = 80, BX = 70, BY = 96, W = 700, H = 620;
  const LEVELS = [
    { id: 0, name: 'Easy', depth: 1, noise: 0.35, reward: 20, desc: 'A relaxed bot that makes mistakes.' },
    { id: 1, name: 'Medium', depth: 3, noise: 0.08, reward: 60, desc: 'Blocks your wins and sets traps.' },
    { id: 2, name: 'Hard', depth: 6, noise: 0, reward: 150, desc: 'Thinks six moves ahead.' },
  ];
  const DB = L.store('connect4', { wins: [0, 0, 0], losses: 0, draws: 0 });
  let S = null; const save = () => DB.save(S);
  const A = L.makeGame({
    key: 'c4', title: 'Four in a Row', emoji: '🔴', cardBg: '#ffe0e3', grid: 'puzzle-games', bg: '#eef2fa', world: { w: W, h: H },
    desc: 'Connect four discs in a row before the bot does.',
    hud: '<span class="hudpill" id="c4-turn">Your turn</span><span class="hudpill" id="c4-lvl">Easy bot</span>',
    help: 'Click a column (or press 1 to 7) to drop your disc', rotate: false,
    progress: () => { const s = DB.load(); const w = s.wins.reduce((a, b) => a + b, 0); return w ? `${w} wins (${s.wins[2]} on Hard)` : 'Beat the bot!'; },
  });
  const g = A.g;
  let G = null;

  function start(lv) {
    S = DB.load();
    G = { lv: LEVELS[lv], b: Array.from({ length: ROWS }, () => Array(COLS).fill(0)), turn: 1, hover: 3, drop: null, win: null, botT: 0, t: 0, moves: 0 };
    A.play(); A.run(step); hud();
  }
  A.onAgain = () => start(G.lv.id);
  function hud() { $('#c4-turn').textContent = G.win ? (G.win.p === 1 ? 'You win!' : G.win.p === 2 ? 'Bot wins' : 'Draw') : G.turn === 1 ? '🔴 Your turn' : '🟡 Bot is thinking...'; $('#c4-lvl').textContent = `${G.lv.name} bot`; }
  const rowFor = (b, c) => { for (let r = ROWS - 1; r >= 0; r--) if (!b[r][c]) return r; return -1; };
  function lineAt(b) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const p = b[r][c]; if (!p) continue; for (const [dr, dc] of dirs) { const cells = [[r, c]]; for (let k = 1; k < 4; k++) { const rr2 = r + dr * k, cc = c + dc * k; if (rr2 < 0 || rr2 >= ROWS || cc < 0 || cc >= COLS || b[rr2][cc] !== p) break; cells.push([rr2, cc]); } if (cells.length === 4) return { p, cells }; } }
    return null;
  }
  function evalWindow(w, p) { const o = 3 - p, mine = w.filter((x) => x === p).length, theirs = w.filter((x) => x === o).length, empty = 4 - mine - theirs; if (mine === 4) return 1000; if (mine === 3 && empty === 1) return 6; if (mine === 2 && empty === 2) return 2; if (theirs === 3 && empty === 1) return -8; return 0; }
  function score(b, p) {
    let s = 0; for (let r = 0; r < ROWS; r++) if (b[r][3] === p) s += 3;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { const er = r + dr * 3, ec = c + dc * 3; if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue; s += evalWindow([0, 1, 2, 3].map((k) => b[r + dr * k][c + dc * k]), p); }
    return s;
  }
  const ORDER = [3, 2, 4, 1, 5, 0, 6];
  function minimax(b, depth, a, be, max) {
    const w = lineAt(b); if (w) return w.p === 2 ? 100000 + depth : -100000 - depth;
    const valid = ORDER.filter((c) => !b[0][c]); if (!valid.length) return 0; if (depth === 0) return score(b, 2);
    if (max) { let v = -Infinity; for (const c of valid) { const r = rowFor(b, c); b[r][c] = 2; v = Math.max(v, minimax(b, depth - 1, a, be, false)); b[r][c] = 0; a = Math.max(a, v); if (a >= be) break; } return v; }
    let v = Infinity; for (const c of valid) { const r = rowFor(b, c); b[r][c] = 1; v = Math.min(v, minimax(b, depth - 1, a, be, true)); b[r][c] = 0; be = Math.min(be, v); if (a >= be) break; } return v;
  }
  function botMove() {
    const valid = ORDER.filter((c) => !G.b[0][c]); if (!valid.length) return;
    if (Math.random() < G.lv.noise) return drop(valid[(Math.random() * valid.length) | 0], 2);
    let best = valid[0], bv = -Infinity;
    for (const c of valid) { const r = rowFor(G.b, c); G.b[r][c] = 2; const v = minimax(G.b, G.lv.depth - 1, -Infinity, Infinity, false); G.b[r][c] = 0; if (v > bv) { bv = v; best = c; } }
    drop(best, 2);
  }
  function drop(c, p) {
    if (G.drop || G.win) return; const r = rowFor(G.b, c); if (r < 0) return;
    G.drop = { c, r, p, y: BY - SZ, vy: 0 };
  }
  function land() {
    const d = G.drop; G.b[d.r][d.c] = d.p; G.drop = null; G.moves++;
    const w = lineAt(G.b);
    if (w) { G.win = w; return finish(w.p); }
    if (G.b[0].every(Boolean)) { G.win = { p: 0, cells: [] }; return finish(0); }
    G.turn = 3 - d.p; if (G.turn === 2) G.botT = 0.45; hud();
  }
  function finish(p) {
    hud(); let got = 0;
    if (p === 1) { got = Wallet.add(G.lv.reward); S.wins[G.lv.id]++; } else if (p === 2) S.losses++; else { got = Wallet.add(5); S.draws++; }
    save(); A.over = true;
    setTimeout(() => A.end(p === 1 ? 'You win! 🎉' : p === 2 ? 'The bot wins' : "It's a draw", got || null, p === 1 ? `You beat the ${G.lv.name.toLowerCase()} bot in ${Math.ceil(G.moves / 2)} moves.` : p === 2 ? 'Try blocking its three-in-a-rows.' : 'The board filled up. +5 points.',
      [['again', 'Rematch', 'primary'], ...(p === 1 && G.lv.id < 2 ? [['harder', 'Try a harder bot', 'ghost', () => start(G.lv.id + 1)]] : []), ['lobby', 'Back', 'ghost']]), 900);
  }
  A.cv.addEventListener('pointermove', (e) => { if (!G) return; const p = A.toWorld(e); const c = Math.floor((p.x - BX) / SZ); if (c >= 0 && c < COLS) G.hover = c; });
  A.cv.addEventListener('pointerdown', (e) => { if (!G || A.over || A.paused || G.turn !== 1 || !L.isActive('s-c4')) return; const p = A.toWorld(e); const c = Math.floor((p.x - BX) / SZ); if (c >= 0 && c < COLS) { G.hover = c; drop(c, 1); } });
  A.onKey = (k) => {
    if (!G || A.over || A.paused || G.turn !== 1) return;
    const n = parseInt(k.replace('Digit', ''), 10); if (k.startsWith('Digit') && n >= 1 && n <= 7) return drop(n - 1, 1);
    if (k === 'ArrowLeft') G.hover = Math.max(0, G.hover - 1); if (k === 'ArrowRight') G.hover = Math.min(6, G.hover + 1); if (k === 'Enter' || k === 'Space' || k === 'ArrowDown') drop(G.hover, 1);
  };

  function step(dt) {
    if (dt > 0) {
      G.t += dt;
      if (G.drop) { const d = G.drop, ty = BY + d.r * SZ; d.vy += 3200 * dt; d.y += d.vy * dt; if (d.y >= ty) { d.y = ty; if (d.vy > 400) d.vy *= -0.3; else land(); } }
      else if (G.turn === 2 && !G.win) { G.botT -= dt; if (G.botT <= 0) { G.botT = 99; botMove(); } }
    }
    draw();
  }
  function disc(x, y, p, glow) {
    g.fillStyle = p === 1 ? '#ff4d5e' : '#ffc92e'; g.beginPath(); g.arc(x, y, SZ * 0.4, 0, 7); g.fill();
    g.strokeStyle = p === 1 ? '#d9324a' : '#e0a800'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, SZ * 0.3, 0, 7); g.stroke();
    if (glow) { g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, SZ * 0.43 + Math.sin(G.t * 8) * 2, 0, 7); g.stroke(); }
  }
  function draw() {
    A.begin();
    if (G.turn === 1 && !G.win && !G.drop) { g.globalAlpha = 0.5 + Math.sin(G.t * 5) * 0.15; disc(BX + G.hover * SZ + SZ / 2, BY - SZ / 2 - 6, 1); g.globalAlpha = 1; }
    if (G.drop) disc(BX + G.drop.c * SZ + SZ / 2, G.drop.y + SZ / 2, G.drop.p);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (G.b[r][c]) disc(BX + c * SZ + SZ / 2, BY + r * SZ + SZ / 2, G.b[r][c], G.win && G.win.cells.some(([a, b]) => a === r && b === c));
    // board with holes
    g.save(); g.beginPath(); rr(g, BX - 12, BY - 12, COLS * SZ + 24, ROWS * SZ + 24, 22);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { g.moveTo(BX + c * SZ + SZ / 2 + SZ * 0.4, BY + r * SZ + SZ / 2); g.arc(BX + c * SZ + SZ / 2, BY + r * SZ + SZ / 2, SZ * 0.4, 0, Math.PI * 2, true); }
    g.fillStyle = '#2f6bff'; g.fill('evenodd'); g.restore();
    g.strokeStyle = '#1f4fd1'; g.lineWidth = 4; rr(g, BX - 12, BY - 12, COLS * SZ + 24, ROWS * SZ + 24, 22); g.stroke();
    g.fillStyle = '#1f4fd1'; g.fillRect(BX - 30, BY + ROWS * SZ + 10, 24, 30); g.fillRect(BX + COLS * SZ + 6, BY + ROWS * SZ + 10, 24, 30);
    g.fillStyle = '#66708f'; g.font = '800 14px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; for (let c = 0; c < COLS; c++) g.fillText(String(c + 1), BX + c * SZ + SZ / 2, BY + ROWS * SZ + 34);
  }
  A.onTab = () => {
    S = DB.load();
    A.panel('play').innerHTML = `<div class="levels">${LEVELS.map((l) => `<button class="lvl" data-c4="${l.id}"><span class="num" style="font-size:24px">${l.name}</span><span class="sub">${l.desc}</span><span class="tier" style="color:#e89a00">Win ⭐ ${l.reward}</span><span class="sub">${S.wins[l.id]} win${S.wins[l.id] === 1 ? '' : 's'}</span></button>`).join('')}</div><p class="note">You play red and go first. Get four in a row across, down or diagonally.</p>`;
    $$('[data-c4]').forEach((b) => (b.onclick = () => start(+b.dataset.c4)));
  };
})();
