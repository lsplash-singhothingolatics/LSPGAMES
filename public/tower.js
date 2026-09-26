/* Tower Blitz: place and upgrade towers to stop waves of enemies. */
(function () {
  'use strict';
  const L = LSPG, rr = L.rr;
  const C = 50, COLS = 20, ROWS = 11, W = 1000, H = 610, BAR = 550, WAVES = 12;
  const MAPS = [
    { name: 'Green Valley', grass: '#bfe6a8', path: [[-1, 2], [5, 2], [5, 8], [12, 8], [12, 3], [17, 3], [17, 9], [20, 9]] },
    { name: 'Desert Loop', grass: '#f3dfb0', path: [[-1, 5], [3, 5], [3, 1], [9, 1], [9, 9], [15, 9], [15, 4], [20, 4]] },
    { name: 'Snow Maze', grass: '#e3f1fb', path: [[-1, 1], [16, 1], [16, 4], [3, 4], [3, 7], [16, 7], [16, 9], [20, 9]] },
  ];
  const TOWERS = {
    archer: { name: 'Archer', icon: '🏹', cost: 50, range: 130, dmg: 10, rate: 0.6, color: '#8b6b4a' },
    cannon: { name: 'Cannon', icon: '💣', cost: 90, range: 115, dmg: 28, rate: 1.4, splash: 55, color: '#3c435a' },
    frost: { name: 'Frost', icon: '❄️', cost: 70, range: 110, dmg: 4, rate: 0.8, slow: 0.45, color: '#4fb6f0' },
    laser: { name: 'Laser', icon: '🔆', cost: 160, range: 165, dmg: 5.5, rate: 0.1, beam: true, color: '#ff4d5e' },
  };
  const ENEMIES = { slime: { hp: 30, sp: 58, r: 14, color: '#5cc47a', gold: 5 }, runner: { hp: 20, sp: 110, r: 11, color: '#ffb31a', gold: 4 }, tank: { hp: 130, sp: 38, r: 19, color: '#8a93ab', gold: 12 }, boss: { hp: 700, sp: 32, r: 26, color: '#8a5cff', gold: 80 } };
  const UPG = [{ id: 'gold', name: 'War Chest', icon: '💰', desc: '+40 starting gold per level' }, { id: 'power', name: 'Sharp Arrows', icon: '🗡️', desc: '+8% tower damage per level' }];
  const COST = [250, 550, 1000, 1600, 2400];
  const DB = L.store('tower', { unlocked: 1, best: {}, upg: { gold: 0, power: 0 } });
  let S = null; const save = () => DB.save(S);
  const A = L.makeGame({
    key: 'tower', title: 'Tower Blitz', emoji: '🏰', cardBg: '#e3f5dc', grid: 'arcade-games', bg: '#dbe8cf', world: { w: W, h: H },
    desc: 'Build and upgrade towers to stop 12 waves of monsters.',
    tabs: [['play', 'Maps'], ['upgrades', 'Upgrades']],
    hud: '<span class="hudpill" id="td-wave">Wave 0/12</span><span class="hudpill" id="td-lives">❤️ 20</span><span class="hudpill" id="td-gold">💰 150</span><button class="btn primary" id="td-next" style="height:44px;font-size:15px">Start wave</button>',
    help: 'Pick a tower at the bottom, then tap grass to build. Tap a tower to upgrade or sell it',
    progress: () => { const s = DB.load(); const b = Object.keys(s.best).length; return b ? `${b} of ${MAPS.length} maps beaten` : 'Defend Green Valley!'; },
  });
  const g = A.g;
  let D = null;

  function start(mi) {
    S = DB.load(); const m = MAPS[mi];
    const pts = m.path.map(([x, y]) => ({ x: x * C + C / 2, y: y * C + C / 2 })), cells = new Set();
    for (let i = 0; i < m.path.length - 1; i++) { let [x0, y0] = m.path[i]; const [x1, y1] = m.path[i + 1]; while (x0 !== x1 || y0 !== y1) { cells.add(x0 + ',' + y0); x0 += Math.sign(x1 - x0); y0 += Math.sign(y1 - y0); } cells.add(x1 + ',' + y1); }
    const segs = []; let tot = 0; for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); segs.push({ a: pts[i], b: pts[i + 1], l, s: tot }); tot += l; }
    D = { mi, m, pts, cells, segs, len: tot, towers: [], en: [], shots: [], parts: [], gold: 150 + 40 * S.upg.gold, lives: 20, wave: 0, spawnQ: [], spawnT: 0, active: false, sel: 'archer', picked: null, earned: 0, t: 0, auto: 0 };
    A.play(); A.run(step); hud();
  }
  A.onAgain = () => start(D.mi);
  const posAt = (d) => { for (const s of D.segs) if (d <= s.s + s.l) { const t = (d - s.s) / s.l; return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t }; } return D.pts[D.pts.length - 1]; };
  function hud() { $('#td-wave').textContent = `Wave ${D.wave}/${WAVES}`; $('#td-lives').textContent = `❤️ ${D.lives}`; $('#td-gold').textContent = `💰 ${D.gold}`; const b = $('#td-next'); b.disabled = D.active || D.wave >= WAVES; b.textContent = D.active ? 'Wave running' : 'Start wave'; }
  function nextWave() {
    if (D.active || D.wave >= WAVES || A.over) return;
    D.wave++; D.active = true; const w = D.wave, q = [];
    const n = 6 + w * 2; for (let i = 0; i < n; i++) q.push(w >= 3 && i % 4 === 3 ? 'runner' : w >= 5 && i % 6 === 5 ? 'tank' : 'slime');
    if (w >= 8) for (let i = 0; i < w - 6; i++) q.push('tank');
    if (w % 4 === 0) q.push('boss');
    D.spawnQ = q; D.spawnT = 0; hud();
  }
  $('#td-next').onclick = nextWave;
  A.onKey = (k) => { if (k === 'Space' || k === 'KeyN') nextWave(); const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(k); if (i >= 0) { D.sel = Object.keys(TOWERS)[i]; D.picked = null; } };

  const tStat = (t) => { const b = TOWERS[t.type], m = Math.pow(1.5, t.lvl - 1); return { range: b.range * (1 + 0.1 * (t.lvl - 1)), dmg: b.dmg * m * (1 + 0.08 * S.upg.power), rate: b.rate }; };
  const upCost = (t) => Math.round(TOWERS[t.type].cost * 0.8 * t.lvl);
  const sellVal = (t) => Math.round(t.spent * 0.6);

  A.cv.addEventListener('pointerdown', (e) => {
    if (!D || A.over || A.paused || !L.isActive('s-tower')) return;
    const p = A.toWorld(e);
    if (p.y > BAR) { const i = Math.floor((p.x - 20) / 130); const k = Object.keys(TOWERS)[i]; if (k && p.x > 20 && p.x < 540) { D.sel = k; D.picked = null; } else if (D.picked && p.x > 600) { const t = D.picked; if (p.x < 800) { const c = upCost(t); if (t.lvl < 3 && D.gold >= c) { D.gold -= c; t.lvl++; t.spent += c; } } else { D.gold += sellVal(t); D.towers = D.towers.filter((x) => x !== t); D.picked = null; } hud(); } return; }
    const cx = Math.floor(p.x / C), cy = Math.floor(p.y / C);
    const t = D.towers.find((t) => t.cx === cx && t.cy === cy);
    if (t) { D.picked = D.picked === t ? null : t; return; }
    D.picked = null;
    if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS || D.cells.has(cx + ',' + cy)) return;
    const b = TOWERS[D.sel]; if (D.gold < b.cost) { toast('Not enough gold'); return; }
    D.gold -= b.cost; D.towers.push({ type: D.sel, cx, cy, x: cx * C + C / 2, y: cy * C + C / 2, lvl: 1, cd: 0, ang: 0, spent: b.cost, beam: null }); hud();
  });

  function step(dt) {
    if (dt > 0 && !A.over) update(dt);
    draw();
  }
  function update(dt) {
    D.t += dt;
    if (D.spawnQ.length) { D.spawnT -= dt; if (D.spawnT <= 0) { const k = D.spawnQ.shift(), e = ENEMIES[k], hpm = 1 + 0.2 * (D.wave - 1) + (D.mi * 0.25); D.en.push({ k, hp: e.hp * hpm, max: e.hp * hpm, sp: e.sp, r: e.r, color: e.color, gold: e.gold, d: 0, slow: 0, x: D.pts[0].x, y: D.pts[0].y }); D.spawnT = k === 'boss' ? 1.5 : Math.max(0.35, 0.9 - D.wave * 0.04); } }
    for (const e of D.en) {
      e.slow = Math.max(0, e.slow - dt); e.d += e.sp * (e.slow > 0 ? 0.55 : 1) * dt; const p = posAt(e.d); e.x = p.x; e.y = p.y;
      if (e.d >= D.len) { e.dead = true; e.leak = true; D.lives -= e.k === 'boss' ? 5 : 1; hud(); }
    }
    for (const t of D.towers) {
      const s = tStat(t); t.cd -= dt; t.beam = null;
      let best = null; for (const e of D.en) if (!e.dead && Math.hypot(e.x - t.x, e.y - t.y) < s.range && (!best || e.d > best.d)) best = e;
      if (best) { t.ang = Math.atan2(best.y - t.y, best.x - t.x); if (TOWERS[t.type].beam) { t.beam = best; best.hp -= s.dmg * dt / s.rate; if (best.hp <= 0) kill(best); } else if (t.cd <= 0) { t.cd = s.rate; D.shots.push({ type: t.type, x: t.x, y: t.y, tg: best, dmg: s.dmg, sp: t.type === 'cannon' ? 380 : 620 }); } }
    }
    for (const b of D.shots) {
      const tg = b.tg, dx = tg.x - b.x, dy = tg.y - b.y, d = Math.hypot(dx, dy);
      if (d < 10 || tg.dead) {
        b.dead = true; if (tg.dead && b.type !== 'cannon') continue;
        const T = TOWERS[b.type];
        if (T.splash) { for (const e of D.en) if (!e.dead && Math.hypot(e.x - tg.x, e.y - tg.y) < T.splash) { e.hp -= b.dmg; if (e.hp <= 0) kill(e); } for (let i = 0; i < 10; i++) D.parts.push({ x: tg.x, y: tg.y, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, life: 0.4, c: '#ff8a3d' }); }
        else { tg.hp -= b.dmg; if (T.slow) tg.slow = 1.5; if (tg.hp <= 0) kill(tg); }
      } else { b.x += (dx / d) * b.sp * dt; b.y += (dy / d) * b.sp * dt; }
    }
    D.shots = D.shots.filter((b) => !b.dead); D.en = D.en.filter((e) => !e.dead);
    for (const q of D.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; } D.parts = D.parts.filter((q) => q.life > 0);
    if (D.lives <= 0) return finish(false);
    if (D.active && !D.spawnQ.length && !D.en.length) {
      D.active = false; const got = Wallet.add(5 * D.wave); D.earned += got; D.gold += 20 + D.wave * 5;
      D.parts.push({ x: 500, y: 260, vx: 0, vy: -30, life: 1.6, text: `Wave ${D.wave} cleared! +${got} ⭐` });
      hud(); if (D.wave >= WAVES) finish(true);
    }
  }
  function kill(e) { if (e.dead) return; e.dead = true; D.gold += e.gold; hud(); for (let i = 0; i < 8; i++) D.parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.4, c: e.color }); }
  function finish(win) {
    A.over = true;
    let got = 0; if (win) { got = Wallet.add(150 * (D.mi + 1) + D.lives * 5); D.earned += got; S.best[D.mi] = Math.max(S.best[D.mi] || 0, D.lives); S.unlocked = Math.max(S.unlocked, Math.min(MAPS.length, D.mi + 2)); save(); }
    setTimeout(() => A.end(win ? `${D.m.name} defended!` : 'The monsters broke through', D.earned, win ? `You survived all ${WAVES} waves with ${D.lives} lives left.` : `You reached wave ${D.wave}. Upgrades can help.`,
      [['again', 'Play again', 'primary'], ...(win && D.mi < MAPS.length - 1 ? [['next', 'Next map', 'ghost', () => start(D.mi + 1)]] : []), ['lobby', 'Back', 'ghost']]), 500);
  }

  function draw() {
    A.begin(); const m = D.m;
    g.fillStyle = m.grass; g.fillRect(0, 0, W, BAR);
    g.fillStyle = 'rgba(255,255,255,.18)'; for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) if ((x + y) % 2) g.fillRect(x * C, y * C, C, C);
    g.strokeStyle = '#d9c29a'; g.lineWidth = C - 6; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); D.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
    g.strokeStyle = '#e8d7b5'; g.lineWidth = C - 20; g.stroke();
    const last = D.pts[D.pts.length - 2]; g.font = '30px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('🏰', Math.min(W - 24, last.x + 30), last.y + 10);
    if (D.picked) { const s = tStat(D.picked); g.fillStyle = 'rgba(47,107,255,.12)'; g.strokeStyle = 'rgba(47,107,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(D.picked.x, D.picked.y, s.range, 0, 7); g.fill(); g.stroke(); }
    for (const t of D.towers) {
      const T = TOWERS[t.type];
      g.fillStyle = 'rgba(22,32,61,.15)'; g.beginPath(); g.ellipse(t.x + 3, t.y + 14, 20, 7, 0, 0, 7); g.fill();
      g.fillStyle = '#ffffff'; g.strokeStyle = T.color; g.lineWidth = 4; rr(g, t.x - 19, t.y - 19, 38, 38, 10); g.fill(); g.stroke();
      g.save(); g.translate(t.x, t.y); g.rotate(t.ang); g.fillStyle = T.color; rr(g, 4, -4, 18, 8, 3); g.fill(); g.restore();
      g.font = '20px system-ui, sans-serif'; g.fillText(T.icon, t.x, t.y + 7);
      for (let i = 0; i < t.lvl; i++) { g.fillStyle = '#ffb31a'; g.beginPath(); g.arc(t.x - 8 + i * 8, t.y - 24, 3.5, 0, 7); g.fill(); }
      if (t.beam) { g.strokeStyle = 'rgba(255,77,94,.8)'; g.lineWidth = 3 + t.lvl; g.beginPath(); g.moveTo(t.x, t.y); g.lineTo(t.beam.x, t.beam.y); g.stroke(); }
    }
    for (const e of D.en) {
      g.fillStyle = 'rgba(22,32,61,.15)'; g.beginPath(); g.ellipse(e.x, e.y + e.r * 0.8, e.r, e.r * 0.35, 0, 0, 7); g.fill();
      g.fillStyle = e.slow > 0 ? '#9fd8ff' : e.color; g.beginPath(); g.arc(e.x, e.y - Math.abs(Math.sin(D.t * 8 + e.d * 0.05)) * 3, e.r, 0, 7); g.fill();
      g.fillStyle = '#16203d'; g.beginPath(); g.arc(e.x - e.r * 0.3, e.y - e.r * 0.2, 2.5, 0, 7); g.arc(e.x + e.r * 0.3, e.y - e.r * 0.2, 2.5, 0, 7); g.fill();
      if (e.k === 'boss') { g.font = '18px system-ui, sans-serif'; g.fillText('👑', e.x, e.y - e.r - 6); }
      g.fillStyle = '#e3e8f2'; g.fillRect(e.x - 16, e.y - e.r - 12, 32, 4); g.fillStyle = '#ff4d5e'; g.fillRect(e.x - 16, e.y - e.r - 12, 32 * Math.max(0, e.hp / e.max), 4);
    }
    for (const b of D.shots) { g.fillStyle = b.type === 'cannon' ? '#2b3350' : b.type === 'frost' ? '#4fb6f0' : '#8b6b4a'; g.beginPath(); g.arc(b.x, b.y, b.type === 'cannon' ? 7 : 4, 0, 7); g.fill(); }
    for (const q of D.parts) { g.globalAlpha = Math.max(0, Math.min(1, q.life * 2)); if (q.text) { g.fillStyle = '#16203d'; g.font = '700 28px Fredoka, system-ui, sans-serif'; g.fillText(q.text, q.x, q.y); } else { g.fillStyle = q.c; g.fillRect(q.x - 3, q.y - 3, 6, 6); } }
    g.globalAlpha = 1;
    // build bar
    g.fillStyle = '#ffffff'; g.fillRect(0, BAR, W, H - BAR); g.fillStyle = '#dfe5f1'; g.fillRect(0, BAR, W, 2);
    Object.keys(TOWERS).forEach((k, i) => {
      const T = TOWERS[k], x = 20 + i * 130, on = D.sel === k && !D.picked, can = D.gold >= T.cost;
      g.fillStyle = on ? '#dbe5ff' : '#f3f6fc'; g.strokeStyle = on ? '#2f6bff' : '#dfe5f1'; g.lineWidth = 2; rr(g, x, BAR + 6, 120, 48, 12); g.fill(); g.stroke();
      g.globalAlpha = can ? 1 : 0.45; g.font = '22px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText(T.icon, x + 8, BAR + 38);
      g.fillStyle = '#16203d'; g.font = '800 14px Nunito, system-ui, sans-serif'; g.fillText(T.name, x + 40, BAR + 26); g.fillStyle = '#e89a00'; g.fillText(`💰${T.cost}`, x + 40, BAR + 44); g.globalAlpha = 1;
    });
    if (D.picked) {
      const t = D.picked, c = upCost(t); g.textAlign = 'center';
      g.fillStyle = t.lvl < 3 && D.gold >= c ? '#14c79a' : '#c9cfdb'; rr(g, 610, BAR + 6, 180, 48, 12); g.fill(); g.fillStyle = '#fff'; g.font = '800 15px Nunito, system-ui, sans-serif'; g.fillText(t.lvl < 3 ? `Upgrade 💰${c}` : 'Max level', 700, BAR + 36);
      g.fillStyle = '#ff4d5e'; rr(g, 810, BAR + 6, 170, 48, 12); g.fill(); g.fillStyle = '#fff'; g.fillText(`Sell 💰${sellVal(t)}`, 895, BAR + 36);
    } else { g.fillStyle = '#66708f'; g.font = '800 14px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(D.active ? 'Tap a tower to upgrade or sell it' : 'Build towers, then press Start wave', 780, BAR + 36); }
  }

  A.onTab = (t) => {
    S = DB.load(); const re = () => A.onTab(t);
    if (t === 'play') {
      A.panel('play').innerHTML = `<div class="levels">${MAPS.map((m, i) => { const lk = i + 1 > S.unlocked, b = S.best[i]; return `<button class="lvl${lk ? ' locked' : ''}${b != null ? ' done' : ''}" data-tdm="${i}" ${lk ? 'disabled' : ''}><span class="num">${i + 1}</span><span class="tier">${m.name}</span><span class="sub">${lk ? '🔒 Locked' : b != null ? `Won with ❤️ ${b}` : `⭐ ${150 * (i + 1)}+ points`}</span></button>`; }).join('')}</div><p class="note">Survive 12 waves to win the map and unlock the next one. Every cleared wave also gives points. On a keyboard, 1 to 4 picks a tower and Space starts the next wave.</p>`;
      $$('[data-tdm]').forEach((b) => (b.onclick = () => start(+b.dataset.tdm)));
    } else { A.panel('upgrades').innerHTML = `<div class="items">${L.upgradeCards(UPG, S.upg, COST, 5, 'data-tdu')}</div>`; L.bindUpg('data-tdu', S, COST, save, re); }
  };
})();
