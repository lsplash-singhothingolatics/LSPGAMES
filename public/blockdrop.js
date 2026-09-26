/* Block Drop: falling blocks puzzle. Clear lines to score. */
(function () {
  'use strict';
  const L = LSPG, rr = L.rr;
  const CW = 10, CH = 20, SZ = 28, BX = 180, BY = 20, W = 660, H = 600;
  const P = {
    I: { c: '#4fd6ff', m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] }, O: { c: '#ffd640', m: [[1, 1], [1, 1]] },
    T: { c: '#b36bff', m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] }, S: { c: '#5cd67a', m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
    Z: { c: '#ff5a6e', m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] }, J: { c: '#4f7dff', m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] }, L: { c: '#ff9f40', m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
  };
  const DB = L.store('blockdrop', { best: 0, lines: 0, games: 0 });
  let S = null; const save = () => DB.save(S);
  const A = L.makeGame({
    key: 'bdrop', title: 'Block Drop', emoji: '🟦', cardBg: '#dfe9ff', grid: 'puzzle-games', bg: '#e9eef8', world: { w: W, h: H },
    desc: 'Rotate and drop blocks. Clear lines before the stack reaches the top.',
    hud: '<span class="hudpill" id="bd-score">Score 0</span><span class="hudpill" id="bd-level">Level 1</span>',
    padsL: '<button class="kbtn" data-k="left" aria-label="Left">◀</button><button class="kbtn" data-k="right" aria-label="Right">▶</button>',
    padsR: '<button class="kbtn" data-k="down" aria-label="Soft drop">▼</button><button class="kbtn" data-k="drop" aria-label="Hard drop">⤓</button><button class="kbtn jump" data-k="rot" aria-label="Rotate">⟳</button>',
    help: 'Left and right to move, Up to rotate, Down to drop faster, Space to slam', padReserve: 120, rotate: false,
    progress: () => { const s = DB.load(); return s.best ? `High score ${s.best.toLocaleString()}` : 'Clear your first line!'; },
  });
  const g = A.g;
  let G = null;

  function bag() { const k = Object.keys(P); for (let i = k.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [k[i], k[j]] = [k[j], k[i]]; } return k; }
  function start() {
    S = DB.load();
    G = { board: Array.from({ length: CH }, () => Array(CW).fill(null)), queue: [...bag(), ...bag()], cur: null, score: 0, lines: 0, level: 1, fall: 0, lock: 0, flash: [], t: 0, rep: {} };
    spawn(); A.play(); A.run(step); hud();
  }
  A.onAgain = start;
  function spawn() {
    if (G.queue.length < 7) G.queue.push(...bag());
    const k = G.queue.shift(); G.cur = { k, m: P[k].m.map((r) => r.slice()), x: k === 'O' ? 4 : 3, y: k === 'I' ? -1 : 0 };
    if (hit(G.cur.m, G.cur.x, G.cur.y)) gameOver();
  }
  function hit(m, x, y) { for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) if (m[r][c]) { const bx = x + c, by = y + r; if (bx < 0 || bx >= CW || by >= CH || (by >= 0 && G.board[by][bx])) return true; } return false; }
  const rot = (m) => m[0].map((_, i) => m.map((r) => r[i]).reverse());
  function move(dx) { if (!hit(G.cur.m, G.cur.x + dx, G.cur.y)) { G.cur.x += dx; G.lock = 0; } }
  function rotate() { const m = rot(G.cur.m); for (const k of [0, -1, 1, -2, 2]) if (!hit(m, G.cur.x + k, G.cur.y)) { G.cur.m = m; G.cur.x += k; G.lock = 0; return; } }
  function soft() { if (!hit(G.cur.m, G.cur.x, G.cur.y + 1)) { G.cur.y++; G.score += 1; return true; } return false; }
  function hard() { let n = 0; while (!hit(G.cur.m, G.cur.x, G.cur.y + 1)) { G.cur.y++; n++; } G.score += n * 2; place(); }
  function place() {
    const c = G.cur; let over = false;
    c.m.forEach((row, r) => row.forEach((v, cc) => { if (v) { if (c.y + r < 0) over = true; else G.board[c.y + r][c.x + cc] = P[c.k].c; } }));
    if (over) return gameOver();
    const full = []; G.board.forEach((row, i) => { if (row.every(Boolean)) full.push(i); });
    if (full.length) {
      G.flash = full.map((y) => ({ y, t: 0.25 }));
      full.forEach((y) => { G.board.splice(y, 1); G.board.unshift(Array(CW).fill(null)); });
      G.score += [0, 100, 300, 500, 800][full.length] * G.level; G.lines += full.length; G.level = 1 + Math.floor(G.lines / 10);
    }
    G.fall = 0; G.lock = 0; spawn(); hud();
  }
  function gameOver() {
    if (A.over) return; A.over = true;
    const got = Wallet.add(Math.floor(G.score / 50)), best = G.score > S.best; if (best) S.best = G.score; S.lines += G.lines; S.games++; save();
    setTimeout(() => A.end(best ? 'New high score!' : 'Game over', got, `Score ${G.score.toLocaleString()}, ${G.lines} lines, level ${G.level}. You get 1 point for every 50 score.`), 400);
  }
  function hud() { $('#bd-score').textContent = `Score ${G.score.toLocaleString()}`; $('#bd-level').textContent = `Level ${G.level}, ${G.lines} lines`; }
  A.onKey = (k) => {
    if (!G || A.over || A.paused) return;
    if (k === 'ArrowLeft' || k === 'KeyA') move(-1); else if (k === 'ArrowRight' || k === 'KeyD') move(1);
    else if (k === 'ArrowUp' || k === 'KeyW' || k === 'KeyX') rotate(); else if (k === 'ArrowDown' || k === 'KeyS') { soft(); hud(); } else if (k === 'Space') hard();
  };
  function touchRepeat(key, dt, fn, first = 0.18, every = 0.06) {
    const on = A.tin[key], r = G.rep; if (!on) { r[key] = null; return; }
    if (r[key] == null) { r[key] = first; fn(); return; } r[key] -= dt; if (r[key] <= 0) { r[key] = every; fn(); }
  }
  function step(dt) {
    if (dt > 0 && !A.over) {
      G.t += dt;
      touchRepeat('left', dt, () => move(-1)); touchRepeat('right', dt, () => move(1)); touchRepeat('down', dt, () => { soft(); hud(); }, 0.05, 0.04);
      if (A.tin.rot && !G.rotHeld) rotate(); G.rotHeld = A.tin.rot;
      if (A.tin.drop && !G.dropHeld) hard(); G.dropHeld = A.tin.drop;
      if (!A.over) {
        const speed = Math.max(0.06, 0.8 * Math.pow(0.82, G.level - 1));
        if (hit(G.cur.m, G.cur.x, G.cur.y + 1)) { G.lock += dt; if (G.lock > 0.45) place(); }
        else { G.fall += dt; if (G.fall >= speed) { G.fall = 0; G.cur.y++; } }
      }
      G.flash.forEach((f) => (f.t -= dt)); G.flash = G.flash.filter((f) => f.t > 0);
    }
    draw();
  }
  function cell(x, y, c, alpha) { g.globalAlpha = alpha == null ? 1 : alpha; g.fillStyle = c; rr(g, x + 1, y + 1, SZ - 2, SZ - 2, 5); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; rr(g, x + 4, y + 4, SZ - 8, 6, 3); g.fill(); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 2, y + SZ - 6, SZ - 4, 4); g.globalAlpha = 1; }
  function draw() {
    A.begin();
    g.fillStyle = '#ffffff'; g.strokeStyle = '#d5dcea'; g.lineWidth = 4; rr(g, BX - 8, BY - 8, CW * SZ + 16, CH * SZ + 16, 14); g.fill(); g.stroke();
    g.strokeStyle = '#eef2f8'; g.lineWidth = 1; for (let x = 1; x < CW; x++) { g.beginPath(); g.moveTo(BX + x * SZ, BY); g.lineTo(BX + x * SZ, BY + CH * SZ); g.stroke(); } for (let y = 1; y < CH; y++) { g.beginPath(); g.moveTo(BX, BY + y * SZ); g.lineTo(BX + CW * SZ, BY + y * SZ); g.stroke(); }
    G.board.forEach((row, y) => row.forEach((c, x) => { if (c) cell(BX + x * SZ, BY + y * SZ, c); }));
    if (G.cur && !A.over) {
      let gy = G.cur.y; while (!hit(G.cur.m, G.cur.x, gy + 1)) gy++;
      const col = P[G.cur.k].c;
      G.cur.m.forEach((row, r) => row.forEach((v, c) => { if (v && gy + r >= 0) cell(BX + (G.cur.x + c) * SZ, BY + (gy + r) * SZ, col, 0.22); }));
      G.cur.m.forEach((row, r) => row.forEach((v, c) => { if (v && G.cur.y + r >= 0) cell(BX + (G.cur.x + c) * SZ, BY + (G.cur.y + r) * SZ, col); }));
    }
    for (const f of G.flash) { g.fillStyle = `rgba(255,255,255,${f.t * 3})`; g.fillRect(BX, BY + f.y * SZ, CW * SZ, SZ); }
    // side panel
    const px = BX + CW * SZ + 30;
    g.fillStyle = '#fff'; rr(g, px, BY, 150, 300, 14); g.fill();
    g.fillStyle = '#66708f'; g.font = '800 14px Nunito, system-ui, sans-serif'; g.textAlign = 'left'; g.fillText('NEXT', px + 16, BY + 26);
    G.queue.slice(0, 3).forEach((k, i) => { const m = P[k].m, s = 18; m.forEach((row, r) => row.forEach((v, c) => { if (v) { g.fillStyle = P[k].c; rr(g, px + 30 + c * s, BY + 44 + i * 84 + r * s, s - 2, s - 2, 4); g.fill(); } })); });
    g.fillStyle = '#fff'; rr(g, 20, BY, 140, 170, 14); g.fill();
    g.fillStyle = '#66708f'; g.font = '800 13px Nunito, system-ui, sans-serif';
    [['SCORE', G.score.toLocaleString()], ['LEVEL', G.level], ['BEST', Math.max(S.best, G.score).toLocaleString()]].forEach(([a, b], i) => { g.fillStyle = '#66708f'; g.fillText(a, 36, BY + 28 + i * 52); g.fillStyle = '#16203d'; g.font = '700 22px Fredoka, system-ui, sans-serif'; g.fillText(String(b), 36, BY + 52 + i * 52); g.font = '800 13px Nunito, system-ui, sans-serif'; });
  }
  A.onTab = () => {
    S = DB.load();
    A.panel('play').innerHTML = L.playCard('🟦', 'Stack and clear', 'Move and rotate falling blocks to fill whole rows. Full rows disappear and score points. It speeds up every 10 lines. You earn 1 LSP point for every 50 score.', [`🏆 High score ${S.best.toLocaleString()}`, `🧱 ${S.lines} lines cleared`, `🎮 ${S.games} games`], 'bd-go', 'Play');
    $('#bd-go').onclick = start;
  };
})();
