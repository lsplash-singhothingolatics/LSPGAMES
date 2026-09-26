/* Obby Rush: 2D obstacle course with checkpoints. Uses the shared LSPGames wallet. */
(function () {
  'use strict';
  const L = LSPG, rr = L.rr;
  const T = 40, ROWS = 12, PAD = 4;
  const PW = 26, PH = 34, GRAV = 2100, PAD_V = 1150;

  /* ---------- level pieces (8 rows each, bottom row is ground level) ---------- */
  const START = ['......', '......', '......', '......', '......', '......', '.S....', '######'];
  const CHECK = ['....', '....', '....', '....', '....', '....', '.C..', '####'];
  const FINISH = ['........', '........', '........', '........', '........', '........', '...F....', '########'];
  const EASY = [
    ['..........', '..........', '..........', '..........', '....oo....', '..........', '..........', '####..####'],
    ['..........', '..........', '..........', '......o...', '......##..', '....##....', '..##......', '####....##'],
    ['..........', '..........', '..........', '..........', '...o...o..', '..........', '..........', '##LL##LL##'],
    ['..........', '..........', '..........', '..........', '...o...o..', '..........', '...^...^..', '##########'],
    ['..........', '..........', '..........', '....o..o..', '..........', '....#..#..', '....#..#..', '##........'],
  ];
  const MED = [
    ['............', '............', '........o...', '......######', '............', '............', '............', '###J#.......'],
    ['............', '............', '............', '....o...o...', '............', '...DD..DD...', '............', '##........##'],
    ['............', '............', '............', '............', '......o.....', '............', '..M.........', '##........##'],
  ];
  const HARD = [
    ['..............', '..............', '..............', '....o....o....', '..............', '...#....#.....', '......#.....#.', '##LLLLLLLLLLLL'],
    ['............', '............', '............', '############', '......o.....', '............', '...^....^...', '############'],
    ['..............', '..............', '.........o....', '..........DD..', '.......DD.....', '....DD........', '..............', '##LLLLLLLLLLLL'],
    ['................', '................', '................', '........o.......', '................', '..M......M......', '................', '##.............#'],
  ];
  const STAGES = [
    { name: 'Meadow Run', sky: ['#cfeaff', '#f4faff'], ground: '#b8835a', top: '#5cc47a' },
    { name: 'Sunny Beach', sky: ['#bfe7ff', '#fff6e0'], ground: '#e0bd7c', top: '#f5dea6' },
    { name: 'Pine Forest', sky: ['#d3efdb', '#f3fbf5'], ground: '#8c6b4f', top: '#3fae62' },
    { name: 'Candy Clouds', sky: ['#ffe0ef', '#fff6fb'], ground: '#ee9cc2', top: '#ffffff' },
    { name: 'Desert Heat', sky: ['#ffe9c2', '#fff8ea'], ground: '#d9a15e', top: '#f0c27a' },
    { name: 'Ice Peak', sky: ['#d9f0ff', '#f5fbff'], ground: '#8fbde0', top: '#ffffff' },
    { name: 'Lava Lair', sky: ['#ffd9cc', '#fff3ee'], ground: '#6b5a5a', top: '#9b8686' },
    { name: 'Space Tower', sky: ['#d9d4ff', '#f4f2ff'], ground: '#6c6fa8', top: '#b7b9ff' },
  ];
  const UPG = [
    { id: 'speed', name: 'Speed Coil', icon: '👟', desc: 'Run 8% faster per level' },
    { id: 'jump', name: 'Gravity Coil', icon: '🌀', desc: 'Jump 4% higher per level' },
  ];
  const UPG_COST = [250, 500, 900, 1400, 2000], UPG_MAX = 5;
  const SKINS = [
    { id: 'classic', name: 'Classic', color: '#2f6bff', cost: 0 },
    { id: 'mint', name: 'Mint', color: '#14c79a', cost: 300 },
    { id: 'sunset', name: 'Sunset', color: '#ff8a3d', cost: 600 },
    { id: 'galaxy', name: 'Galaxy', color: '#8a5cff', cost: 1200 },
    { id: 'gold', name: 'Gold', color: '#f2b61f', cost: 2500 },
  ];
  const fmtTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  const rewardOf = (n) => 60 + n * 40;

  /* ---------- DOM ---------- */
  document.body.insertAdjacentHTML('beforeend', `
  <section class="screen" id="s-olobby" style="overflow:auto">
    <header class="topbar"><div class="topbar-in">
      <button class="iconbtn" id="ob-back" aria-label="Back to games">‹</button>
      <h2 style="font-size:20px">Obby Rush</h2><div class="spacer"></div>
      <span class="pill" title="LSP points">⭐ <span class="js-points">0</span></span>
    </div></header>
    <main class="wrap">
      <div class="tabs" role="tablist">
        <button class="tab on" data-t="stages" role="tab">Stages</button>
        <button class="tab" data-t="upgrades" role="tab">Upgrades</button>
        <button class="tab" data-t="skins" role="tab">Skins</button>
      </div>
      <div class="gpanel on" data-p="stages"><div class="levels" id="ob-stages"></div><p class="note">Reach the finish flag to unlock the next stage. Touching lava, spikes or falling sends you back to your last checkpoint.</p></div>
      <div class="gpanel" data-p="upgrades"><div class="items" id="ob-upg"></div></div>
      <div class="gpanel" data-p="skins"><div class="items" id="ob-skins"></div></div>
    </main>
  </section>
  <section class="screen gscreen" id="s-obby">
    <canvas class="gcv" id="ob-cv"></canvas>
    <div class="hud">
      <button class="iconbtn" id="ob-pause" aria-label="Pause">⏸</button>
      <span class="hudpill" id="ob-name">Stage 1</span>
      <span class="hudpill" id="ob-cp">🚩 0 / 0</span>
      <span class="hudpill" id="ob-coins">🪙 0</span>
      <span class="hudpill" id="ob-deaths">💀 0</span>
      <span class="hudpill" id="ob-time">0:00.0</span>
    </div>
    <div class="gpad gpad-l"><button class="kbtn" data-k="left" aria-label="Move left">◀</button><button class="kbtn" data-k="right" aria-label="Move right">▶</button></div>
    <div class="gpad gpad-r"><button class="kbtn jump" data-k="jump">JUMP</button></div>
    <div class="help">A / D or arrows to move, Space to jump, R to respawn, Esc to pause</div>
    <div class="rotate hudpill">Turn your phone sideways for a bigger view</div>
    <div class="modal" id="ob-modal"><div class="modal-card"></div></div>
  </section>`);

  const cv = $('#ob-cv'), g = cv.getContext('2d');
  const scr = $('#s-obby');
  const keys = {}, tin = {};
  L.holdButtons('#s-obby', tin);
  let OS = null, G = null, raf = 0, last = 0, touchMode = false;

  function oload() {
    OS = Object.assign({ unlocked: 1, best: {}, owned: ['classic'], skin: 'classic' }, store.get('lsp_obby_' + profile.email, {}));
    OS.upg = Object.assign({ speed: 0, jump: 0 }, OS.upg || {});
  }
  function osave() { store.set('lsp_obby_' + profile.email, OS); }

  /* ---------- build stage ---------- */
  function buildStage(n) {
    const R = L.rng(n * 131 + 7), rows = Array.from({ length: ROWS }, () => '');
    const add = (tpl) => { const w = tpl[0].length; for (let r = 0; r < ROWS; r++) rows[r] += r < PAD ? '.'.repeat(w) : tpl[r - PAD]; };
    add(START);
    const count = 4 + n, pHard = Math.max(0, (n - 3) * 0.13), pMed = Math.min(0.5, 0.12 * n);
    let prev = null;
    for (let i = 0; i < count; i++) {
      let tpl;
      for (let tries = 0; tries < 10; tries++) {
        const r = R(), pool = r < pHard ? HARD : r < pHard + pMed ? MED : EASY;
        tpl = pool[(R() * pool.length) | 0];
        if (tpl !== prev) break;
      }
      prev = tpl; add(tpl);
      if (i < count - 1) add(CHECK);
    }
    add(FINISH);
    const cols = rows[0].length, grid = rows.map((r) => r.split(''));
    const st = { n, theme: STAGES[n - 1], cols, grid, coins: [], checks: [], movers: [], spawn: null, finish: null, w: cols * T, h: ROWS * T };
    let mi = 0;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < cols; x++) {
      const c = grid[y][x];
      if (c === 'o') { st.coins.push({ x: x * T + T / 2, y: y * T + T / 2, taken: false }); grid[y][x] = '.'; }
      else if (c === 'C') { st.checks.push({ x: x * T, y: y * T, on: false }); grid[y][x] = '.'; }
      else if (c === 'S') { st.spawn = { x: x * T + (T - PW) / 2, y: (y + 1) * T - PH }; grid[y][x] = '.'; }
      else if (c === 'F') { st.finish = { x: x * T, y: y * T }; grid[y][x] = '.'; }
      else if (c === 'M') { st.movers.push({ x0: x * T, x: x * T, y: y * T, w: 2 * T, h: 16, range: 6 * T, period: 5.2, phase: (mi++ % 2) * 0.5, dx: 0 }); grid[y][x] = '.'; }
    }
    // two movers in one piece swing in opposite directions with a 5-tile range
    for (let i = 0; i < st.movers.length - 1; i++) { const a = st.movers[i], b = st.movers[i + 1]; if (b.y === a.y && b.x0 - a.x0 === 7 * T) { a.range = b.range = 5 * T; } }
    return st;
  }

  /* ---------- game state ---------- */
  function startStage(n) {
    const st = buildStage(n);
    const sp = 250 * (1 + 0.08 * OS.upg.speed), jv = 760 * (1 + 0.04 * OS.upg.jump);
    G = {
      st, n, time: 0, deaths: 0, coins: 0, cpIndex: -1, respawn: { ...st.spawn }, dis: {}, parts: [], over: false, paused: false, deadT: 0, winT: 0, t: 0,
      p: { x: st.spawn.x, y: st.spawn.y, vx: 0, vy: 0, onGround: false, coyote: 0, jumpBuf: 0, mover: null, face: 1, squash: 0, jumpHeldPrev: false },
      speed: sp, jumpV: jv, color: (SKINS.find((s) => s.id === OS.skin) || SKINS[0]).color, cam: { x: 0, y: 0 },
    };
    touchMode = L.isTouch(); scr.classList.toggle('touch', touchMode);
    $('#ob-name').textContent = `Stage ${n}: ${st.theme.name}`;
    L.closeModal('ob-modal'); show('s-obby'); fit();
    G.cam.x = G.p.x; G.cam.y = G.p.y;
    cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  const view = { z: 1, w: 0, h: 0, d: 1 };
  function fit() {
    view.d = L.fit(cv); view.w = cv.width; view.h = cv.height;
    view.reserve = scr.classList.contains('touch') ? 130 * view.d : 0;
    view.z = Math.min((view.h - view.reserve) / ((view.reserve ? 8.5 * T : ROWS * T + 60)), view.w / (14 * T));
    scr.classList.toggle('portrait', innerHeight > innerWidth);
  }
  addEventListener('resize', () => { if (L.isActive('s-obby')) fit(); });

  function tileAt(tx, ty) { const s = G.st; if (ty < 0 || ty >= ROWS || tx < 0 || tx >= s.cols) return '.'; return s.grid[ty][tx]; }
  function solid(tx, ty) {
    const s = G.st;
    if (tx < 0 || tx >= s.cols) return ty < ROWS;
    if (ty < 0 || ty >= ROWS) return false;
    const c = s.grid[ty][tx];
    if (c === '#' || c === 'J') return true;
    if (c === 'D') { const d = G.dis[ty * s.cols + tx]; return !d || d.gone <= 0; }
    return false;
  }

  function burst(x, y, color, n, sp) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = sp * (0.3 + Math.random() * 0.7); G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.6, color, size: 3 + Math.random() * 3 }); } }
  function floatText(x, y, text, color) { G.parts.push({ x, y, vx: 0, vy: -60, life: 1.1, text, color }); }

  function die() {
    if (G.deadT > 0 || G.over) return;
    const p = G.p; G.deaths++; G.deadT = 0.55;
    burst(p.x + PW / 2, p.y + PH / 2, G.color, 26, 320);
  }
  function respawn() {
    const p = G.p, r = G.respawn;
    Object.assign(p, { x: r.x, y: r.y, vx: 0, vy: 0, onGround: false, mover: null, coyote: 0, jumpBuf: 0 });
    G.dis = {};
  }

  function input() {
    const left = keys.ArrowLeft || keys.KeyA || tin.left, right = keys.ArrowRight || keys.KeyD || tin.right;
    const jump = keys.Space || keys.ArrowUp || keys.KeyW || tin.jump;
    return { dir: (right ? 1 : 0) - (left ? 1 : 0), jump: !!jump };
  }

  function update(dt) {
    G.t += dt;
    for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; if (!q.text) q.vy += 900 * dt; q.life -= dt; }
    G.parts = G.parts.filter((q) => q.life > 0);
    const s = G.st, p = G.p;
    // movers
    for (const m of s.movers) {
      const ph = ((G.t / m.period + m.phase) % 1 + 1) % 1, tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      const nx = m.x0 + tri * m.range; m.dx = nx - m.x; m.x = nx;
    }
    // disappearing blocks
    for (const k in G.dis) { const d = G.dis[k]; if (d.t > 0) { d.t -= dt; if (d.t <= 0) d.gone = 2.2; } else { d.gone -= dt; if (d.gone <= 0) delete G.dis[k]; } }
    if (G.over) { G.winT -= dt; return; }
    if (G.deadT > 0) { G.deadT -= dt; if (G.deadT <= 0) respawn(); return; }
    G.time += dt;

    const inp = input();
    if (inp.jump && !p.jumpHeldPrev) p.jumpBuf = 0.13;
    p.jumpHeldPrev = inp.jump; p.jumpBuf -= dt;
    const target = inp.dir * G.speed;
    p.vx += (target - p.vx) * Math.min(1, dt * (p.onGround ? 16 : 9));
    if (inp.dir) p.face = inp.dir;
    p.coyote = p.onGround ? 0.1 : p.coyote - dt;
    if (p.jumpBuf > 0 && p.coyote > 0) { p.vy = -G.jumpV; p.coyote = 0; p.jumpBuf = 0; p.onGround = false; p.mover = null; p.squash = -0.25; }
    p.vy += GRAV * dt;
    if (!inp.jump && p.vy < 0) p.vy += GRAV * 1.4 * dt;
    p.vy = Math.min(p.vy, 1100);

    // ride mover
    if (p.mover) p.x += p.mover.dx;
    // X
    p.x += p.vx * dt;
    const ty0 = Math.floor(p.y / T), ty1 = Math.floor((p.y + PH - 1) / T);
    if (p.vx > 0 || (p.mover && p.mover.dx > 0)) { const tx = Math.floor((p.x + PW) / T); for (let ty = ty0; ty <= ty1; ty++) if (solid(tx, ty)) { p.x = tx * T - PW; p.vx = 0; break; } }
    if (p.vx < 0 || (p.mover && p.mover.dx < 0)) { const tx = Math.floor(p.x / T); for (let ty = ty0; ty <= ty1; ty++) if (solid(tx, ty)) { p.x = (tx + 1) * T; p.vx = 0; break; } }
    // Y
    const prevBottom = p.y + PH, wasGround = p.onGround;
    p.onGround = false; p.mover = null; p.y += p.vy * dt;
    let groundTile = null;
    const tx0 = Math.floor(p.x / T), tx1 = Math.floor((p.x + PW - 1) / T);
    if (p.vy > 0) { const ty = Math.floor((p.y + PH) / T); for (let tx = tx0; tx <= tx1; tx++) if (solid(tx, ty)) { p.y = ty * T - PH; p.vy = 0; p.onGround = true; groundTile = { tx, ty }; break; } }
    else if (p.vy < 0) { const ty = Math.floor(p.y / T); for (let tx = tx0; tx <= tx1; tx++) if (solid(tx, ty)) { p.y = (ty + 1) * T; p.vy = 0; break; } }
    if (!p.onGround && p.vy >= 0) for (const m of s.movers) {
      if (p.x + PW > m.x + 2 && p.x < m.x + m.w - 2 && prevBottom <= m.y + 4 && p.y + PH >= m.y) { p.y = m.y - PH; p.vy = 0; p.onGround = true; p.mover = m; break; }
    }
    if (p.onGround && !wasGround) p.squash = 0.2;
    p.squash *= Math.pow(0.001, dt);
    if (groundTile) {
      // stand on the tile under the player's centre when possible
      const cx = Math.floor((p.x + PW / 2) / T), ct = solid(cx, groundTile.ty) ? { tx: cx, ty: groundTile.ty } : groundTile;
      const c = tileAt(ct.tx, ct.ty);
      if (c === 'J') { p.vy = -PAD_V; p.onGround = false; p.squash = -0.35; burst(ct.tx * T + T / 2, ct.ty * T, '#ffb31a', 10, 160); }
      else if (c === 'D') { const k = ct.ty * s.cols + ct.tx; if (!G.dis[k]) G.dis[k] = { t: 0.45, gone: 0 }; }
      for (let tx = tx0; tx <= tx1; tx++) if (tileAt(tx, groundTile.ty) === 'D') { const k = groundTile.ty * s.cols + tx; if (!G.dis[k]) G.dis[k] = { t: 0.45, gone: 0 }; }
    }
    // hazards
    if (p.y > s.h + 120) return die();
    for (let ty = Math.floor(p.y / T); ty <= Math.floor((p.y + PH - 1) / T); ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const c = tileAt(tx, ty);
      if (c === 'L') { const top = ty * T + 8; if (p.y + PH > top) return die(); }
      if (c === '^') { const hx = tx * T + 9, hy = ty * T + T - 17; if (p.x + PW > hx && p.x < hx + T - 18 && p.y + PH > hy) return die(); }
    }
    // coins, checkpoints, finish
    const pcx = p.x + PW / 2, pcy = p.y + PH / 2;
    for (const c of s.coins) if (!c.taken && Math.abs(c.x - pcx) < 24 && Math.abs(c.y - pcy) < 28) { c.taken = true; G.coins++; burst(c.x, c.y, '#ffb31a', 8, 120); }
    s.checks.forEach((c, i) => {
      if (!c.on && pcx > c.x && pcx < c.x + T && pcy > c.y - T && pcy < c.y + T) {
        c.on = true; G.cpIndex = Math.max(G.cpIndex, i); G.respawn = { x: c.x + (T - PW) / 2, y: c.y + T - PH };
        floatText(c.x + T / 2, c.y - 20, 'Checkpoint!', '#0b8f6e'); burst(c.x + T / 2, c.y, '#14c79a', 14, 180);
      }
    });
    if (s.finish && pcx > s.finish.x - 10 && pcx < s.finish.x + T + 10 && pcy > s.finish.y - T * 2) win();
  }

  function win() {
    G.over = true; const n = G.n, base = rewardOf(n), flawless = G.deaths === 0;
    const total = base + G.coins * 5 + (flawless ? Math.round(base * 0.5) : 0);
    const got = Wallet.add(total);
    OS.unlocked = Math.max(OS.unlocked, Math.min(STAGES.length, n + 1));
    const first = !OS.best[n]; if (!OS.best[n] || G.time < OS.best[n]) OS.best[n] = G.time;
    osave(); refreshPoints();
    burst(G.p.x + PW / 2, G.p.y, '#ffb31a', 40, 380);
    setTimeout(() => {
      L.modal('ob-modal', `<h2>${n === STAGES.length ? 'You beat Obby Rush!' : 'Stage ' + n + ' complete!'}</h2><p class="big">⭐ +${got.toLocaleString()}</p>
        <p class="muted">Time ${fmtTime(G.time)}${first ? '' : ` (best ${fmtTime(OS.best[n])})`}. ${G.coins} coins, ${G.deaths} ${G.deaths === 1 ? 'fall' : 'falls'}${flawless ? ', flawless bonus!' : '.'}</p>
        <div class="modal-actions">${n < STAGES.length ? '<button class="btn primary" data-a="next">Next stage</button>' : ''}<button class="btn ghost" data-a="again">Play again</button><button class="btn ghost" data-a="lobby">Back to stages</button></div>`,
        { next: () => startStage(n + 1), again: () => startStage(n), lobby: () => { stop(); openLobby('stages'); } });
    }, 700);
  }

  /* ---------- drawing ---------- */
  function drawTile(c, x, y, tx, ty, th) {
    if (c === '#') {
      const topOpen = !solid(tx, ty - 1) || tileAt(tx, ty - 1) === 'D';
      g.fillStyle = th.ground; g.fillRect(x, y, T, T);
      g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(x, y + T - 5, T, 5); g.fillRect(x + T - 3, y, 3, T);
      if (topOpen) { g.fillStyle = th.top; rr(g, x - 1, y - 2, T + 2, 11, 4); g.fill(); }
    } else if (c === 'L') {
      g.fillStyle = '#ff5a36'; g.fillRect(x, y + 8, T, T - 8);
      g.fillStyle = '#ffb31a'; g.beginPath(); g.moveTo(x, y + 12);
      for (let i = 0; i <= 4; i++) g.lineTo(x + i * 10, y + 8 + Math.sin(G.t * 5 + tx + i) * 3);
      g.lineTo(x + T, y + 16); g.lineTo(x, y + 16); g.fill();
    } else if (c === '^') {
      g.fillStyle = '#7d8599';
      for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(x + 4 + i * 16, y + T); g.lineTo(x + 12 + i * 16, y + T - 20); g.lineTo(x + 20 + i * 16, y + T); g.fill(); }
      g.fillStyle = '#dfe4ee'; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(x + 12 + i * 16, y + T - 20); g.lineTo(x + 14 + i * 16, y + T - 12); g.lineTo(x + 10 + i * 16, y + T - 12); g.fill(); }
    } else if (c === 'J') {
      g.fillStyle = th.ground; g.fillRect(x, y + 10, T, T - 10);
      g.fillStyle = '#3c435a'; for (let i = 0; i < 3; i++) g.fillRect(x + 8, y + 4 + i * 4, T - 16, 2);
      g.fillStyle = '#ffb31a'; rr(g, x + 2, y - 2, T - 4, 9, 4); g.fill();
    } else if (c === 'D') {
      const d = G.dis[ty * G.st.cols + tx];
      if (d && d.gone > 0) { g.strokeStyle = 'rgba(138,92,255,.25)'; g.setLineDash([4, 4]); g.lineWidth = 2; g.strokeRect(x + 2, y + 2, T - 4, T - 4); g.setLineDash([]); return; }
      const shake = d && d.t > 0 ? (Math.random() - 0.5) * 4 : 0;
      g.globalAlpha = d && d.t > 0 ? 0.55 + Math.sin(G.t * 40) * 0.2 : 0.9;
      g.fillStyle = '#b89cff'; rr(g, x + 1 + shake, y + 1, T - 2, T - 2, 6); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 6 + shake, y + 6, 8, 4);
      g.globalAlpha = 1;
    }
  }

  function drawPlayer(p) {
    const sq = p.squash, w = PW * (1 + sq * 0.6), h = PH * (1 - sq * 0.6), x = p.x + PW / 2, y = p.y + PH;
    g.fillStyle = 'rgba(22,32,61,.15)'; g.beginPath(); g.ellipse(x, y + 2, PW * 0.55, 4, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(x, y);
    g.fillStyle = G.color; g.strokeStyle = '#16203d'; g.lineWidth = 2.5; rr(g, -w / 2, -h, w, h, 8); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.92)'; const vx = p.face > 0 ? 1 : -w * 0.55 + 1; rr(g, vx - 2, -h + 6, w * 0.5, h * 0.36, 4); g.fill();
    g.fillStyle = '#16203d'; const ex = p.face > 0 ? w * 0.22 : -w * 0.22; g.fillRect(ex - 1, -h + 10, 3, 5);
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(-w / 2 + 2, -8, w - 4, 6);
    g.restore();
  }

  function draw() {
    const s = G.st, th = s.theme, z = view.z, p = G.p;
    const vw = view.w / z, vh = (view.h - (view.reserve || 0)) / z;
    const tx = Math.max(0, Math.min(s.w - vw, p.x + PW / 2 - vw * 0.4 + p.vx * 0.2));
    let ty;
    if (vh >= s.h + 60) ty = s.h - vh + 30; else ty = Math.max(-240, Math.min(s.h + 30 - vh, p.y - vh * 0.55));
    G.cam.x += (tx - G.cam.x) * 0.15; G.cam.y += (ty - G.cam.y) * 0.12;
    const cx = G.cam.x, cy = G.cam.y;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const gr = g.createLinearGradient(0, 0, 0, view.h); gr.addColorStop(0, th.sky[0]); gr.addColorStop(1, th.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, view.w, view.h);
    // parallax clouds and hills
    g.setTransform(z, 0, 0, z, 0, 0);
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 14; i++) { const px = ((i * 377 - cx * 0.2) % (vw + 300) + vw + 300) % (vw + 300) - 150, py = 40 + (i * 53) % 160 - (cy * 0.1); g.beginPath(); g.arc(px, py, 26, 0, 7); g.arc(px + 30, py - 8, 32, 0, 7); g.arc(px + 62, py, 24, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 8; i++) { const px = ((i * 523 - cx * 0.4) % (vw + 600) + vw + 600) % (vw + 600) - 300; g.beginPath(); g.ellipse(px, vh + 40 - cy * 0.2, 260, 150, 0, Math.PI, 0); g.fill(); }
    g.setTransform(z, 0, 0, z, -cx * z, -cy * z);
    const c0 = Math.max(0, Math.floor(cx / T) - 1), c1 = Math.min(s.cols - 1, Math.ceil((cx + vw) / T) + 1);
    for (let y = 0; y < ROWS; y++) for (let x = c0; x <= c1; x++) { const c = s.grid[y][x]; if (c !== '.') drawTile(c, x * T, y * T, x, y, th); }
    g.fillStyle = th.ground; g.globalAlpha = 0.35; g.fillRect(cx - 10, s.h, vw + 20, 2000); g.globalAlpha = 1;
    for (const m of s.movers) { g.fillStyle = '#5b6fd6'; rr(g, m.x, m.y, m.w, m.h, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(m.x + 10, m.y + 5, m.w - 20, 3); }
    for (const c of s.coins) if (!c.taken) { const sx = Math.abs(Math.cos(G.t * 4 + c.x * 0.1)); g.fillStyle = '#ffb31a'; g.beginPath(); g.ellipse(c.x, c.y + Math.sin(G.t * 3 + c.x) * 3, 10 * sx + 2, 11, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffe28a'; g.beginPath(); g.ellipse(c.x, c.y + Math.sin(G.t * 3 + c.x) * 3, 4 * sx + 1, 5, 0, 0, Math.PI * 2); g.fill(); }
    for (const c of s.checks) { g.fillStyle = '#8a93ab'; g.fillRect(c.x + 18, c.y - 30, 4, T + 30); g.fillStyle = c.on ? '#14c79a' : '#c9cfdb'; g.beginPath(); g.moveTo(c.x + 22, c.y - 30); g.lineTo(c.x + 46, c.y - 21 + Math.sin(G.t * 4) * 2); g.lineTo(c.x + 22, c.y - 12); g.fill(); }
    if (s.finish) {
      const f = s.finish; g.fillStyle = '#3c435a'; g.fillRect(f.x + 18, f.y - 70, 5, T + 70);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i + j) % 2 ? '#16203d' : '#ffffff'; g.fillRect(f.x + 23 + i * 9, f.y - 70 + j * 9 + Math.sin(G.t * 4 + i) * 1.5, 9, 9); }
    }
    if (!(G.deadT > 0)) drawPlayer(p);
    for (const q of G.parts) {
      g.globalAlpha = Math.max(0, Math.min(1, q.life / 0.6));
      if (q.text) { g.fillStyle = q.color; g.font = '700 20px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(q.text, q.x, q.y); }
      else { g.fillStyle = q.color; g.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); }
    }
    g.globalAlpha = 1;
  }

  function hud() {
    $('#ob-cp').textContent = `🚩 ${G.cpIndex + 1} / ${G.st.checks.length}`;
    $('#ob-coins').textContent = `🪙 ${G.coins}`;
    $('#ob-deaths').textContent = `💀 ${G.deaths}`;
    $('#ob-time').textContent = fmtTime(G.time);
  }
  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.033, (t - last) / 1000 || 0); last = t;
    if (G && !G.paused) update(dt);
    if (G) { draw(); hud(); }
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; L.closeModal('ob-modal'); for (const k in keys) keys[k] = false; for (const k in tin) tin[k] = false; }
  function pause() {
    if (!G || G.over) return;
    if (G.paused) { G.paused = false; L.closeModal('ob-modal'); last = performance.now(); return; }
    G.paused = true;
    L.modal('ob-modal', '<h2>Paused</h2><p class="muted">Quitting ends this run without points.</p><div class="modal-actions"><button class="btn primary" data-a="resume">Resume</button><button class="btn ghost" data-a="restart">Restart stage</button><button class="btn ghost" data-a="quit">Quit to stages</button></div>',
      { resume: pause, restart: () => startStage(G.n), quit: () => { stop(); openLobby('stages'); } });
  }
  $('#ob-pause').onclick = pause;

  addEventListener('keydown', (e) => {
    if (!L.isActive('s-obby')) return;
    if (e.code === 'Escape' || e.code === 'KeyP') { pause(); return; }
    if (e.code === 'KeyR' && G && !G.over && !G.paused) { die(); return; }
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  cv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !touchMode) { touchMode = true; scr.classList.add('touch'); fit(); } });

  /* ---------- lobby ---------- */
  const setTab = L.tabs('#s-olobby', (t) => render());
  function render() {
    $('#ob-stages').innerHTML = STAGES.map((s, i) => {
      const n = i + 1, locked = n > OS.unlocked, best = OS.best[n];
      return `<button class="lvl${locked ? ' locked' : ''}${best ? ' done' : ''}" data-ob="${n}" ${locked ? 'disabled aria-disabled="true"' : ''}>
        <span class="num">${n}</span><span class="tier" style="color:${s.top === '#ffffff' ? s.ground : s.top}">${s.name}</span>
        <span class="sub">${locked ? '🔒 Locked' : best ? 'Best ' + fmtTime(best) : `⭐ ${rewardOf(n)}+ points`}</span></button>`;
    }).join('');
    $$('[data-ob]').forEach((b) => (b.onclick = () => { if (!b.disabled) startStage(+b.dataset.ob); }));
    $('#ob-upg').innerHTML = L.upgradeCards(UPG, OS.upg, UPG_COST, UPG_MAX, 'data-obu');
    $$('[data-obu]').forEach((b) => (b.onclick = () => { const id = b.dataset.obu; if (!Wallet.spend(UPG_COST[OS.upg[id]])) return; OS.upg[id]++; osave(); render(); toast('Upgrade installed'); }));
    $('#ob-skins').innerHTML = L.skinCards(SKINS, OS.owned, OS.skin, 'data-obs');
    $$('[data-obs]').forEach((b) => (b.onclick = () => {
      const s = SKINS.find((x) => x.id === b.dataset.obs);
      if (!OS.owned.includes(s.id)) { if (!Wallet.spend(s.cost)) return; OS.owned.push(s.id); }
      OS.skin = s.id; osave(); render(); toast(s.name + ' skin equipped');
    }));
    refreshPoints();
  }
  function openLobby(tab) { oload(); show('s-olobby'); setTab(tab || 'stages'); }
  $('#ob-back').onclick = () => enterHub();

  L.addCard({ id: 'card-obby', emoji: '🏃', bg: '#ffe6ea', title: 'Obby Rush', desc: 'Jump, dodge lava and ride platforms through 8 obstacle courses.', open: () => openLobby('stages') });
  L.onHub(() => { oload(); L.setProg('card-obby', OS.best[STAGES.length] ? 'All 8 stages cleared!' : `Stage ${OS.unlocked} of ${STAGES.length} unlocked`); });
})();
