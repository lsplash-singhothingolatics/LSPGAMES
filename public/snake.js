/* Snake Arena: eat orbs, grow, and make bot snakes crash into you. */
(function () {
  'use strict';
  const L = LSPG;
  const R = 1400, SEG = 9;
  const SKINS = [
    { id: 'blue', name: 'Ocean', colors: ['#2f6bff', '#6f9bff'], cost: 0 }, { id: 'mint', name: 'Mint', colors: ['#14c79a', '#7fe6c9'], cost: 250 },
    { id: 'fire', name: 'Fire', colors: ['#ff4d5e', '#ffb31a'], cost: 600 }, { id: 'candy', name: 'Candy', colors: ['#ff8ac2', '#ffffff'], cost: 900 },
    { id: 'galaxy', name: 'Galaxy', colors: ['#8a5cff', '#2b3350', '#4fd6ff'], cost: 1500 }, { id: 'gold', name: 'Gold', colors: ['#f2b61f', '#fff3b0'], cost: 3000 },
  ].map((s) => ({ ...s, icon: `<span style="display:block;width:30px;height:14px;border-radius:7px;background:linear-gradient(90deg,${s.colors.join(',')})"></span>`, desc: 'Snake skin' }));
  const BOT_NAMES = ['Slinky', 'Noodle', 'Zippy', 'Viper', 'Wiggles', 'Fang', 'Coil', 'Sly', 'Twister', 'Bolt', 'Nibbles'];
  const DB = L.store('snake', { best: 0, owned: ['blue'], skin: 'blue', games: 0 });
  let S = null; const save = () => DB.save(S);
  const A = L.makeGame({
    key: 'snake', title: 'Snake Arena', emoji: '🐍', cardBg: '#e3f7e8', grid: 'arcade-games', bg: '#eef3fb',
    desc: 'Grow the longest snake. Make bots crash into you.',
    tabs: [['play', 'Play'], ['skins', 'Skins']],
    hud: '<span class="hudpill" id="sn-len">Length 10</span><span class="hudpill" id="sn-rank">Rank 1</span>',
    padsR: '<button class="kbtn jump" data-k="boost">BOOST</button>',
    help: 'Move the mouse to steer. Hold the mouse button or Space to boost', rotate: false,
    progress: () => { const s = DB.load(); return s.best ? `Longest snake ${s.best}` : 'Start slithering!'; },
  });
  const g = A.g;
  let G = null, aim = null, touchDir = null;

  function makeSnake(name, colors, bot) {
    const a = Math.random() * 6.28, r = Math.random() * R * 0.75, x = Math.cos(a) * r, y = Math.sin(a) * r, dir = Math.random() * 6.28;
    const segs = Array.from({ length: 12 }, (_, i) => ({ x: x - Math.cos(dir) * i * SEG, y: y - Math.sin(dir) * i * SEG }));
    return { name, colors, bot, segs, dir, target: dir, score: 12, boost: false, dead: false, think: 0, wander: dir };
  }
  function start() {
    S = DB.load();
    const skin = SKINS.find((s) => s.id === S.skin) || SKINS[0];
    G = { snakes: [], orbs: [], t: 0, cam: { x: 0, y: 0 }, parts: [] };
    G.me = makeSnake(profile.email.split('@')[0], skin.colors, false); G.me.segs.forEach((s, i) => { s.x = -i * SEG; s.y = 0; }); G.me.dir = 0;
    G.snakes.push(G.me);
    for (let i = 0; i < 11; i++) { let b; do { b = makeSnake(BOT_NAMES[i], [`hsl(${(i * 33) % 360},70%,58%)`, `hsl(${(i * 33 + 40) % 360},70%,72%)`], true); } while (Math.hypot(b.segs[0].x, b.segs[0].y) < 450); b.score = 12 + Math.floor(Math.random() * 60); G.snakes.push(b); }
    G.me.shield = 2.5;
    for (let i = 0; i < 700; i++) addOrb();
    aim = null; A.play(); A.run(step);
  }
  A.onAgain = start;
  function addOrb(x, y, v) {
    if (x == null) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * (R - 30); x = Math.cos(a) * r; y = Math.sin(a) * r; }
    G.orbs.push({ x, y, v: v || 1 + ((Math.random() * 3) | 0), c: `hsl(${(Math.random() * 360) | 0},80%,62%)`, ph: Math.random() * 6 });
  }
  const lenOf = (s) => Math.floor(10 + s.score / 2);

  A.cv.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') aim = e; });
  A.cv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { aim = e; A.tin.mouse = true; } else { touchDir = { id: e.pointerId, x: e.clientX, y: e.clientY }; } });
  A.cv.addEventListener('pointermove', (e) => { if (touchDir && e.pointerId === touchDir.id) { touchDir.x = e.clientX; touchDir.y = e.clientY; } });
  addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') A.tin.mouse = false; if (touchDir && e.pointerId === touchDir.id) touchDir = null; });

  function step(dt) {
    if (dt > 0 && !A.over) update(dt);
    if (G) draw();
  }
  function turnToward(s, target, rate, dt) { let d = target - s.dir; d = Math.atan2(Math.sin(d), Math.cos(d)); s.dir += Math.max(-rate * dt, Math.min(rate * dt, d)); }
  function update(dt) {
    G.t += dt;
    const me = G.me, v = A.view, r = A.cv.getBoundingClientRect();
    if (touchDir) { const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (Math.hypot(touchDir.x - cx, touchDir.y - cy) > 10) me.target = Math.atan2(touchDir.y - cy, touchDir.x - cx); }
    else if (aim) { const hx = (me.segs[0].x - G.cam.x) * G.z + v.w / 2, hy = (me.segs[0].y - G.cam.y) * G.z + v.h / 2; me.target = Math.atan2((aim.clientY - r.top) * v.d - hy, (aim.clientX - r.left) * v.d - hx); }
    const k = A.keys; if (k.ArrowLeft || k.KeyA) me.target = me.dir - 1; if (k.ArrowRight || k.KeyD) me.target = me.dir + 1;
    me.boost = !!(A.tin.mouse || A.tin.boost || k.Space) && me.score > 20;
    for (const s of G.snakes) {
      if (s.dead) continue;
      if (s.bot) botThink(s, dt);
      turnToward(s, s.target, s.boost ? 3.2 : 4.2, dt);
      const sp = s.boost ? 300 : 165, h = s.segs[0];
      const nh = { x: h.x + Math.cos(s.dir) * sp * dt, y: h.y + Math.sin(s.dir) * sp * dt };
      s.segs.unshift(nh);
      // keep body at even spacing
      const want = lenOf(s), out = [s.segs[0]]; let prev = s.segs[0];
      for (let i = 1; i < s.segs.length && out.length < want; i++) { const p = s.segs[i], d = Math.hypot(p.x - prev.x, p.y - prev.y); if (d >= SEG) { const t = SEG / d; prev = { x: prev.x + (p.x - prev.x) * t, y: prev.y + (p.y - prev.y) * t }; out.push(prev); i--; } }
      while (out.length < want) out.push({ ...out[out.length - 1] });
      s.segs = out;
      if (s.boost) { s.bleed = (s.bleed || 0) + dt; if (s.bleed > 0.12) { s.bleed = 0; s.score -= 1; const tl = s.segs[s.segs.length - 1]; addOrb(tl.x, tl.y, 1); } }
      if (Math.hypot(nh.x, nh.y) > R - 8) kill(s);
    }
    // eat
    for (const s of G.snakes) {
      if (s.dead) continue; const h = s.segs[0], rad = 16 + Math.min(20, s.score / 40);
      for (const o of G.orbs) if (!o.eaten && Math.abs(o.x - h.x) < rad + 8 && Math.abs(o.y - h.y) < rad + 8 && Math.hypot(o.x - h.x, o.y - h.y) < rad + 8) { o.eaten = true; s.score += o.v; }
    }
    G.orbs = G.orbs.filter((o) => !o.eaten); while (G.orbs.length < 700) addOrb();
    // collisions
    for (const a of G.snakes) {
      if (a.dead) continue; if (a.shield > 0) { a.shield -= dt; continue; } const h = a.segs[0], hr = 7 + Math.min(10, a.score / 60);
      for (const b of G.snakes) { if (b === a || b.dead) continue; const br = 7 + Math.min(10, b.score / 60); for (let i = 1; i < b.segs.length; i += 1) { const p = b.segs[i]; if (Math.abs(p.x - h.x) < hr + br && Math.abs(p.y - h.y) < hr + br && Math.hypot(p.x - h.x, p.y - h.y) < hr + br - 3) { kill(a); break; } } if (a.dead) break; }
    }
    // respawn bots
    G.snakes = G.snakes.filter((s) => !s.dead || s === G.me);
    while (G.snakes.filter((s) => s.bot).length < 11) { const b = makeSnake(BOT_NAMES[(Math.random() * BOT_NAMES.length) | 0], [`hsl(${(Math.random() * 360) | 0},70%,58%)`, `hsl(${(Math.random() * 360) | 0},70%,72%)`], true); if (Math.hypot(b.segs[0].x - me.segs[0].x, b.segs[0].y - me.segs[0].y) > 500) G.snakes.push(b); }
    for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; } G.parts = G.parts.filter((q) => q.life > 0);
    const rank = [...G.snakes].sort((a, b) => b.score - a.score).indexOf(me) + 1;
    $('#sn-len').textContent = `Length ${lenOf(me)}`; $('#sn-rank').textContent = `Rank ${rank} of ${G.snakes.length}`;
    G.rank = rank;
  }
  function botThink(s, dt) {
    s.think -= dt; const h = s.segs[0];
    if (s.think <= 0) {
      s.think = 0.15 + Math.random() * 0.2;
      let best = null, bd = 380; for (const o of G.orbs) { const d = Math.abs(o.x - h.x) + Math.abs(o.y - h.y); if (d < bd) { bd = d; best = o; } }
      s.target = best ? Math.atan2(best.y - h.y, best.x - h.x) : s.dir + (Math.random() - 0.5);
      if (Math.hypot(h.x, h.y) > R - 250) s.target = Math.atan2(-h.y, -h.x);
      // avoid bodies ahead
      const ax = h.x + Math.cos(s.dir) * 70, ay = h.y + Math.sin(s.dir) * 70;
      for (const o of G.snakes) { if (o === s || o.dead) continue; for (let i = 0; i < o.segs.length; i += 2) { const p = o.segs[i]; if (Math.abs(p.x - ax) < 45 && Math.abs(p.y - ay) < 45) { const side = Math.sin(Math.atan2(p.y - h.y, p.x - h.x) - s.dir) > 0 ? -1 : 1; s.target = s.dir + side * 1.6; s.think = 0.3; i = 1e9; break; } } }
      s.boost = s.score > 60 && Math.random() < 0.05;
    }
  }
  function kill(s) {
    if (s.dead) return; s.dead = true;
    for (let i = 0; i < s.segs.length; i += 2) { const p = s.segs[i]; addOrb(p.x + (Math.random() - 0.5) * 14, p.y + (Math.random() - 0.5) * 14, 2 + ((Math.random() * 3) | 0)); }
    for (let i = 0; i < 16; i++) G.parts.push({ x: s.segs[0].x, y: s.segs[0].y, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300, life: 0.6, c: s.colors[0] });
    if (s === G.me) {
      A.over = true; const len = lenOf(s), got = Wallet.add(Math.floor(s.score / 4) + (G.rank === 1 ? 50 : 0));
      const best = len > S.best; if (best) S.best = len; S.games++; save();
      setTimeout(() => A.end(best ? 'New record!' : 'You crashed!', got, `Your snake was ${len} long${G.rank === 1 ? ' and ranked #1 (+50 bonus)' : `, rank ${G.rank}`}. Longest ever: ${S.best}.`), 700);
    }
  }
  function draw() {
    const v = A.view, me = G.me, h = me.segs[0];
    G.z = Math.min(v.w, v.h) / (700 + Math.min(500, me.score));
    const z = G.z; if (!me.dead) { G.cam.x += (h.x - G.cam.x) * 0.2; G.cam.y += (h.y - G.cam.y) * 0.2; }
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#dfe6f2'; g.fillRect(0, 0, v.w, v.h);
    g.setTransform(z, 0, 0, z, v.w / 2 - G.cam.x * z, v.h / 2 - G.cam.y * z);
    g.fillStyle = '#f7f9fd'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
    const hw = v.w / z / 2 + 60, hh = v.h / z / 2 + 60, x0 = G.cam.x - hw, x1 = G.cam.x + hw, y0 = G.cam.y - hh, y1 = G.cam.y + hh;
    g.fillStyle = 'rgba(47,107,255,.06)'; for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) for (let y = Math.floor(y0 / 60) * 60 + ((x / 60) % 2 ? 30 : 0); y < y1; y += 60) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    g.strokeStyle = '#ff4d5e'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, R, 0, 7); g.stroke();
    for (const o of G.orbs) { if (o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1) continue; const r = 3 + o.v * 1.5 + Math.sin(G.t * 4 + o.ph); g.fillStyle = o.c; g.globalAlpha = 0.3; g.beginPath(); g.arc(o.x, o.y, r + 4, 0, 7); g.fill(); g.globalAlpha = 1; g.beginPath(); g.arc(o.x, o.y, r, 0, 7); g.fill(); }
    for (const s of G.snakes) {
      if (s.dead) continue; const w = 7 + Math.min(10, s.score / 60), n = s.segs.length;
      for (let i = n - 1; i >= 0; i--) { const p = s.segs[i]; if (p.x < x0 - 30 || p.x > x1 + 30 || p.y < y0 - 30 || p.y > y1 + 30) continue; g.fillStyle = s.colors[Math.floor(i / 3) % s.colors.length]; g.beginPath(); g.arc(p.x, p.y, w, 0, 7); g.fill(); }
      const hd = s.segs[0]; if (s.shield > 0) { g.strokeStyle = 'rgba(79,182,240,.7)'; g.lineWidth = 4; g.beginPath(); g.arc(hd.x, hd.y, w + 9, 0, 7); g.stroke(); }
      if (s.boost) { g.strokeStyle = 'rgba(255,179,26,.6)'; g.lineWidth = 4; g.beginPath(); g.arc(hd.x, hd.y, w + 5, 0, 7); g.stroke(); }
      for (const side of [-1, 1]) { const ex = hd.x + Math.cos(s.dir + side * 0.6) * w * 0.6, ey = hd.y + Math.sin(s.dir + side * 0.6) * w * 0.6; g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, ey, w * 0.38, 0, 7); g.fill(); g.fillStyle = '#16203d'; g.beginPath(); g.arc(ex + Math.cos(s.dir) * 1.5, ey + Math.sin(s.dir) * 1.5, w * 0.2, 0, 7); g.fill(); }
      g.fillStyle = s === me ? '#1f4fd1' : 'rgba(22,32,61,.6)'; g.font = `800 ${Math.round(13 / Math.max(0.6, z))}px Nunito, system-ui, sans-serif`; g.textAlign = 'center'; g.fillText(s.name, hd.x, hd.y - w - 10);
    }
    for (const q of G.parts) { g.globalAlpha = Math.max(0, q.life / 0.6); g.fillStyle = q.c; g.beginPath(); g.arc(q.x, q.y, 5, 0, 7); g.fill(); } g.globalAlpha = 1;
    // leaderboard
    g.setTransform(v.d, 0, 0, v.d, 0, 0);
    const top = [...G.snakes].filter((s) => !s.dead).sort((a, b) => b.score - a.score).slice(0, 5), W = v.w / v.d;
    g.fillStyle = 'rgba(255,255,255,.9)'; L.rr(g, W - 190, 64, 176, 30 + top.length * 22, 12); g.fill();
    g.fillStyle = '#16203d'; g.font = '800 14px Nunito, system-ui, sans-serif'; g.textAlign = 'left'; g.fillText('Leaderboard', W - 176, 86);
    top.forEach((s, i) => { g.fillStyle = s === me ? '#1f4fd1' : '#66708f'; g.fillText(`${i + 1}. ${s.name}`, W - 176, 108 + i * 22); g.textAlign = 'right'; g.fillText(lenOf(s), W - 26, 108 + i * 22); g.textAlign = 'left'; });
  }

  A.onTab = (t) => {
    S = DB.load(); const re = () => A.onTab(t);
    if (t === 'play') { A.panel('play').innerHTML = L.playCard('🐍', 'Enter the arena', 'Steer with the mouse (or drag on a phone). Eat glowing orbs to grow. If your head touches another snake you crash, so trap bots and eat what they leave behind. Boosting is faster but makes you shorter.', [`🏆 Longest ${S.best}`, `🎮 ${S.games} games`], 'sn-go', 'Play'); $('#sn-go').onclick = start; }
    else { A.panel('skins').innerHTML = `<div class="items">${L.shopCards(SKINS, S.owned, S.skin, 'data-sns')}</div>`; L.bindBuy('data-sns', SKINS, S, save, re, 'owned', 'skin'); }
  };
})();
