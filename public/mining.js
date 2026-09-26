/* Mining Sim: dig for ores, sell them on the surface, upgrade your pickaxe and backpack. */
(function () {
  'use strict';
  const L = LSPG, rr = L.rr;
  const T = 50, COLS = 16, ROWS = 160, SURF = 3;
  const ORES = [
    { id: 'coal', name: 'Coal', color: '#2b2b35', val: 1, from: 4, p: 0.12 },
    { id: 'iron', name: 'Iron', color: '#eef2f8', val: 3, from: 10, p: 0.09 },
    { id: 'gold', name: 'Gold', color: '#ffd640', val: 8, from: 22, p: 0.07 },
    { id: 'emerald', name: 'Emerald', color: '#2fdf8a', val: 15, from: 38, p: 0.05 },
    { id: 'diamond', name: 'Diamond', color: '#6fe6ff', val: 25, from: 55, p: 0.045 },
    { id: 'ruby', name: 'Ruby', color: '#ff3b6b', val: 60, from: 80, p: 0.035 },
    { id: 'crystal', name: 'LSP Crystal', color: '#b36bff', val: 150, from: 115, p: 0.025 },
  ];
  const LAYERS = [{ to: 18, color: '#b8835a', hard: 1 }, { to: 48, color: '#9aa3b5', hard: 2 }, { to: 95, color: '#6c7389', hard: 3.5 }, { to: 999, color: '#40385a', hard: 6 }];
  const PICK = [1, 1.6, 2.4, 3.5, 5, 7.5], BAG = [10, 20, 35, 55, 80, 120];
  const UPG = [{ id: 'pick', name: 'Pickaxe', icon: '⛏️', desc: 'Mine faster. Needed for deep rock' }, { id: 'bag', name: 'Backpack', icon: '🎒', desc: 'Carry more ore per trip' }];
  const COST = [150, 400, 900, 1800, 3500];
  const DB = L.store('mining', { upg: { pick: 0, bag: 0 }, deepest: 0, earned: 0, found: [] });
  let S = null; const save = () => DB.save(S);
  const A = L.makeGame({
    key: 'mine', title: 'Mining Sim', emoji: '⛏️', cardBg: '#efe3d3', grid: 'sim-games', bg: '#2a2230',
    desc: 'Dig deep for coal, gold, diamonds and rare crystals.',
    tabs: [['play', 'Play'], ['upgrades', 'Upgrades'], ['ores', 'Ore book']],
    hud: '<span class="hudpill" id="mn-bag">🎒 0/10</span><span class="hudpill" id="mn-depth">⬇️ 0 m</span><span class="hudpill" id="mn-worth">⭐ 0</span><button class="btn ghost" id="mn-home" style="height:44px;font-size:15px">🏠 Surface</button>',
    padsL: '<button class="kbtn" data-k="left" aria-label="Left">◀</button><div style="display:flex;flex-direction:column;gap:8px"><button class="kbtn" data-k="up" aria-label="Up">▲</button><button class="kbtn" data-k="down" aria-label="Down">▼</button></div><button class="kbtn" data-k="right" aria-label="Right">▶</button>',
    help: 'Arrows or WASD to move and dig. Sell ore on the SELL pad at the top', padReserve: 190,
    quitNote: 'Ore in your backpack is lost if you quit. Sell it first!',
    progress: () => { const s = DB.load(); return s.deepest ? `Deepest ${s.deepest} m, ⭐ ${s.earned.toLocaleString()} earned` : 'Start digging!'; },
  });
  const g = A.g;
  let M = null;

  function gen() {
    const grid = [];
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      for (let x = 0; x < COLS; x++) {
        if (y < SURF) { row.push(null); continue; }
        const layer = LAYERS.findIndex((l) => y < l.to);
        let ore = null;
        for (let i = ORES.length - 1; i >= 0; i--) { const o = ORES[i]; if (y >= o.from && Math.random() < o.p * (y === SURF ? 0 : 1)) { ore = i; break; } }
        row.push({ layer, ore, hp: 1 });
      }
      grid.push(row);
    }
    return grid;
  }
  function start() {
    S = DB.load();
    M = { grid: gen(), x: 4, y: SURF - 1, px: 4, py: SURF - 1, bag: [], dig: null, move: 0, parts: [], camY: 0, face: 1, t: 0, sold: 0 };
    A.play(); A.run(step); hud();
  }
  A.onAgain = start;
  const cap = () => BAG[S.upg.bag], power = () => PICK[S.upg.pick];
  const worth = () => M.bag.reduce((a, i) => a + ORES[i].val, 0);
  function hud() { $('#mn-bag').textContent = `🎒 ${M.bag.length}/${cap()}`; $('#mn-depth').textContent = `⬇️ ${Math.max(0, M.y - SURF + 1)} m`; $('#mn-worth').textContent = `⭐ ${worth()}`; }
  function sell() {
    if (!M.bag.length) return;
    const v = worth(), got = Wallet.add(v); S.earned += got; M.sold += got;
    M.bag.forEach((i) => { if (!S.found.includes(ORES[i].id)) S.found.push(ORES[i].id); });
    M.bag = []; save(); hud(); toast(`Sold ore for ${got} points!`);
    for (let i = 0; i < 20; i++) M.parts.push({ x: 1.5 * T, y: (SURF - 1) * T, vx: (Math.random() - 0.5) * 300, vy: -Math.random() * 300, life: 0.8, c: '#ffb31a' });
  }
  $('#mn-home').onclick = () => { if (!M || A.over) return; M.x = M.px = 4; M.y = M.py = SURF - 1; M.dig = null; hud(); };

  function tryMove(dx, dy) {
    const nx = M.x + dx, ny = M.y + dy;
    if (dx) M.face = dx;
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;
    const c = M.grid[ny][nx];
    if (!c || c.dug) { M.x = nx; M.y = ny; M.move = 0.12; const d = M.y - SURF + 1; if (d > S.deepest) { S.deepest = d; } hud(); return; }
    if (c.ore != null && M.bag.length >= cap()) { if (!M.fullWarn) { toast('Backpack full! Go sell your ore.'); M.fullWarn = 3; } return; }
    const need = LAYERS[c.layer].hard + (c.ore != null ? ORES[c.ore].val / 40 : 0);
    if (need > power() * 2.2) { if (!M.hardWarn) { toast('Too hard! Upgrade your pickaxe.'); M.hardWarn = 3; } return; }
    if (!M.dig || M.dig.x !== nx || M.dig.y !== ny) M.dig = { x: nx, y: ny, p: 0, need: need * 0.32 / power() };
  }
  function step(dt) {
    if (dt > 0) update(dt);
    draw();
  }
  function update(dt) {
    M.t += dt; if (M.fullWarn) M.fullWarn = Math.max(0, M.fullWarn - dt); if (M.hardWarn) M.hardWarn = Math.max(0, M.hardWarn - dt);
    const k = A.keys, ti = A.tin;
    const dx = (k.ArrowRight || k.KeyD || ti.right ? 1 : 0) - (k.ArrowLeft || k.KeyA || ti.left ? 1 : 0);
    const dy = dx ? 0 : (k.ArrowDown || k.KeyS || ti.down ? 1 : 0) - (k.ArrowUp || k.KeyW || ti.up ? 1 : 0);
    M.move -= dt;
    if ((dx || dy) && M.move <= 0) tryMove(dx, dy);
    if (!dx && !dy) M.dig = null;
    if (M.dig) {
      M.dig.p += dt / M.dig.need;
      if (Math.random() < 0.3) { const c = M.grid[M.dig.y][M.dig.x]; M.parts.push({ x: (M.dig.x + 0.5) * T, y: (M.dig.y + 0.5) * T, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 120, life: 0.4, c: c.ore != null ? ORES[c.ore].color : LAYERS[c.layer].color }); }
      if (M.dig.p >= 1) {
        const c = M.grid[M.dig.y][M.dig.x]; c.dug = true;
        if (c.ore != null) { M.bag.push(c.ore); M.parts.push({ x: (M.dig.x + 0.5) * T, y: M.dig.y * T, vx: 0, vy: -50, life: 1, text: `+${ORES[c.ore].name}` }); }
        M.dig = null; hud(); M.move = 0.05;
      }
    }
    M.px += (M.x - M.px) * Math.min(1, dt * 16); M.py += (M.y - M.py) * Math.min(1, dt * 16);
    if (M.y === SURF - 1 && M.x <= 2 && M.bag.length) sell();
    for (const q of M.parts) { q.x += q.vx * dt; q.y += q.vy * dt; if (!q.text) q.vy += 600 * dt; q.life -= dt; }
    M.parts = M.parts.filter((q) => q.life > 0);
  }

  A.cv.addEventListener('pointerdown', (e) => {
    if (!M || A.paused || A.over || !L.isActive('s-mine')) return;
    const v = A.view, r = A.cv.getBoundingClientRect();
    const wx = ((e.clientX - r.left) * v.d - M.ox) / M.z, wy = ((e.clientY - r.top) * v.d - M.oy) / M.z;
    const tx = Math.floor(wx / T), ty = Math.floor(wy / T), dx = tx - M.x, dy = ty - M.y;
    if (Math.abs(dx) + Math.abs(dy) === 1) { M.tap = { dx, dy, t: 0.6 }; }
  });

  function draw() {
    const v = A.view, avail = v.h - v.top - v.bottom;
    const z = Math.min(v.w / (COLS * T), avail / (8.5 * T)); M.z = z;
    const vwH = avail / z;
    const target = Math.max(-T * 1.5, M.py * T - vwH * 0.4);
    M.camY += (target - M.camY) * 0.15;
    M.ox = (v.w - COLS * T * z) / 2; M.oy = v.top - M.camY * z;
    if (M.tap) { M.tap.t -= 1 / 60; tryMove(M.tap.dx, M.tap.dy); if (M.tap.t <= 0 || !M.dig) { if (!M.dig) M.tap = null; } }
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#2a2230'; g.fillRect(0, 0, v.w, v.h);
    g.setTransform(z, 0, 0, z, M.ox, M.oy);
    const skyH = SURF * T; const gr = g.createLinearGradient(0, -400, 0, skyH); gr.addColorStop(0, '#bfe3ff'); gr.addColorStop(1, '#eaf6ff'); g.fillStyle = gr; g.fillRect(0, -600, COLS * T, skyH + 600);
    g.fillStyle = '#fff'; for (const [cx, cy] of [[140, -60], [520, 20], [700, -120]]) { g.beginPath(); g.arc(cx, cy, 24, 0, 7); g.arc(cx + 28, cy - 8, 30, 0, 7); g.arc(cx + 56, cy, 22, 0, 7); g.fill(); }
    // sell hut
    g.fillStyle = '#ffb31a'; rr(g, 6, (SURF - 1) * T - 70, 3 * T - 12, 64, 10); g.fill(); g.fillStyle = '#16203d'; g.font = '700 22px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('SELL', 1.5 * T, (SURF - 1) * T - 30);
    g.fillStyle = '#14c79a'; rr(g, 6, SURF * T - 10, 3 * T - 12, 10, 4); g.fill();
    const y0 = Math.max(0, Math.floor(M.camY / T) - 1), y1 = Math.min(ROWS - 1, y0 + Math.ceil(vwH / T) + 3);
    for (let y = y0; y <= y1; y++) for (let x = 0; x < COLS; x++) {
      const c = M.grid[y][x], px = x * T, py = y * T;
      if (!c) continue;
      if (c.dug) { g.fillStyle = '#4a3a33'; g.fillRect(px, py, T, T); continue; }
      g.fillStyle = LAYERS[c.layer].color; g.fillRect(px, py, T, T);
      g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(px, py + T - 5, T, 5); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(px + ((x * 7 + y * 13) % 30), py + ((x * 11 + y * 5) % 30), 8, 6);
      if (y === SURF) { g.fillStyle = '#5cc47a'; g.fillRect(px, py, T, 10); }
      if (c.ore != null) { const o = ORES[c.ore]; g.fillStyle = o.color; for (const [ox, oy, r] of [[14, 16, 7], [34, 22, 8], [22, 36, 6]]) { g.beginPath(); g.moveTo(px + ox, py + oy - r); g.lineTo(px + ox + r, py + oy); g.lineTo(px + ox, py + oy + r); g.lineTo(px + ox - r, py + oy); g.fill(); } g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(px + 12, py + 12, 3, 3); }
      if (M.dig && M.dig.x === x && M.dig.y === y) { g.strokeStyle = 'rgba(22,32,61,.7)'; g.lineWidth = 3; const p = M.dig.p; g.beginPath(); g.moveTo(px + T / 2, py + T / 2); g.lineTo(px + T / 2 - 18 * p, py + 6); g.moveTo(px + T / 2, py + T / 2); g.lineTo(px + T - 6, py + T / 2 + 14 * p); g.moveTo(px + T / 2, py + T / 2); g.lineTo(px + 8, py + T - 8 * p); g.stroke(); }
    }
    // miner
    const mx = (M.px + 0.5) * T, my = (M.py + 0.5) * T, sw = M.dig ? Math.sin(M.t * 30) * 0.6 : 0;
    g.save(); g.translate(mx, my); g.scale(M.face, 1);
    g.fillStyle = '#2f6bff'; rr(g, -13, -6, 26, 26, 7); g.fill();
    g.fillStyle = '#ffd9b3'; g.beginPath(); g.arc(0, -14, 11, 0, 7); g.fill();
    g.fillStyle = '#ffb31a'; g.beginPath(); g.arc(0, -18, 12, Math.PI, 0); g.fill(); g.fillStyle = '#fff6c9'; g.beginPath(); g.arc(8, -22, 3.5, 0, 7); g.fill();
    g.fillStyle = '#16203d'; g.fillRect(4, -15, 2.5, 3);
    g.save(); g.translate(12, 2); g.rotate(-0.6 + sw); g.fillStyle = '#8b5a33'; g.fillRect(0, -2, 20, 4); g.fillStyle = '#9aa3b5'; g.beginPath(); g.moveTo(18, -10); g.quadraticCurveTo(26, 0, 18, 10); g.lineTo(20, 0); g.fill(); g.restore();
    g.restore();
    for (const q of M.parts) { g.globalAlpha = Math.max(0, Math.min(1, q.life * 2)); if (q.text) { g.fillStyle = '#ffd640'; g.font = '700 18px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(q.text, q.x, q.y); } else { g.fillStyle = q.c; g.fillRect(q.x - 3, q.y - 3, 6, 6); } }
    g.globalAlpha = 1;
    // darkness
    const depth = M.py - SURF;
    if (depth > 4) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      const sx = M.ox + mx * z, sy = M.oy + my * z, dark = Math.min(0.82, (depth - 4) / 40);
      const rg = g.createRadialGradient(sx, sy, T * z * 1.5, sx, sy, T * z * 4.5); rg.addColorStop(0, 'rgba(20,14,28,0)'); rg.addColorStop(1, `rgba(20,14,28,${dark})`);
      g.fillStyle = rg; g.fillRect(0, 0, v.w, v.h);
    }
  }

  A.onQuit = () => { if (M) save(); };
  A.onLeave = A.onQuit;
  A.onTab = (t) => {
    S = DB.load(); const re = () => A.onTab(t);
    if (t === 'play') {
      A.panel('play').innerHTML = L.playCard('⛏️', 'Head down the mine', 'Dig with the arrow keys or the on-screen pad. Ore goes in your backpack. Walk back to the SELL pad at the top (or tap Surface) to turn it into points. Rarer ores are deeper, and deep rock needs a better pickaxe.', [`⛏️ Pickaxe level ${S.upg.pick + 1}`, `🎒 Holds ${BAG[S.upg.bag]}`, `⬇️ Deepest ${S.deepest} m`], 'mn-go', 'Start mining');
      $('#mn-go').onclick = start;
    } else if (t === 'upgrades') { A.panel('upgrades').innerHTML = `<div class="items">${L.upgradeCards(UPG, S.upg, COST, 5, 'data-mnu')}</div>`; L.bindUpg('data-mnu', S, COST, save, re); }
    else A.panel('ores').innerHTML = `<div class="items">${ORES.map((o) => { const f = S.found.includes(o.id); return `<div class="item"><div class="item-head"><div class="ico"><span style="display:block;width:22px;height:22px;transform:rotate(45deg);border-radius:4px;background:${f ? o.color : '#c9cfdb'}"></span></div><div><h3>${f ? o.name : '???'}</h3><p>${f ? `Worth ⭐ ${o.val}. Found from ${o.from} m down.` : `Found deeper than ${o.from} m.`}</p></div></div></div>`; }).join('')}</div>`;
  };
})();
