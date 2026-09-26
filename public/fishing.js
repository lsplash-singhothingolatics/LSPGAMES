/* Fishing Frenzy: cast, hook and reel in fish of every rarity. */
(function () {
  'use strict';
  const L = LSPG, rr = L.rr;
  const W = 1000, H = 600, WATER = 300;
  const RAR = [
    { name: 'Common', color: '#66708f', w: 60, speed: 0.6 }, { name: 'Uncommon', color: '#14c79a', w: 25, speed: 0.9 },
    { name: 'Rare', color: '#2f6bff', w: 10, speed: 1.2 }, { name: 'Epic', color: '#8a5cff', w: 4, speed: 1.55 }, { name: 'Legendary', color: '#e89a00', w: 1, speed: 1.9 },
  ];
  const FISH = [
    { id: 'sardine', name: 'Sardine', icon: '🐟', r: 0, val: 5, kg: [0.1, 0.4] }, { id: 'carp', name: 'Carp', icon: '🐟', r: 0, val: 7, kg: [1, 4] }, { id: 'crab', name: 'Crab', icon: '🦀', r: 0, val: 8, kg: [0.3, 1.5] },
    { id: 'clown', name: 'Clownfish', icon: '🐠', r: 1, val: 14, kg: [0.1, 0.3] }, { id: 'puffer', name: 'Pufferfish', icon: '🐡', r: 1, val: 16, kg: [0.5, 2] }, { id: 'shrimp', name: 'Giant Shrimp', icon: '🦐', r: 1, val: 18, kg: [0.2, 1] },
    { id: 'squid', name: 'Squid', icon: '🦑', r: 2, val: 35, kg: [2, 10] }, { id: 'octo', name: 'Octopus', icon: '🐙', r: 2, val: 40, kg: [3, 15] }, { id: 'turtle', name: 'Sea Turtle', icon: '🐢', r: 2, val: 45, kg: [20, 80] },
    { id: 'shark', name: 'Shark', icon: '🦈', r: 3, val: 85, kg: [80, 400] }, { id: 'dolphin', name: 'Dolphin', icon: '🐬', r: 3, val: 90, kg: [60, 200] },
    { id: 'whale', name: 'Blue Whale', icon: '🐋', r: 4, val: 250, kg: [5000, 20000] }, { id: 'koi', name: 'Golden Koi', icon: '✨', r: 4, val: 300, kg: [5, 12] },
  ];
  const UPG = [
    { id: 'rod', name: 'Strong Rod', icon: '🎣', desc: 'Bigger green catch zone' },
    { id: 'bait', name: 'Fancy Bait', icon: '🪱', desc: 'Faster bites and rarer fish' },
    { id: 'reel', name: 'Speed Reel', icon: '⚙️', desc: 'Catch meter fills faster' },
  ];
  const COST = [200, 450, 800, 1300, 2000];
  const DB = L.store('fishing', { upg: { rod: 0, bait: 0, reel: 0 }, book: {}, caught: 0, earned: 0 });
  let S = null; const save = () => DB.save(S);
  const A = L.makeGame({
    key: 'fish', title: 'Fishing Frenzy', emoji: '🎣', cardBg: '#d9f1ff', grid: 'sim-games', bg: '#cfeaff', world: { w: W, h: H },
    desc: 'Cast your line and catch 13 kinds of fish, from sardines to whales.',
    tabs: [['play', 'Play'], ['upgrades', 'Upgrades'], ['book', 'Fish book']],
    hud: '<span class="hudpill" id="fs-caught">🐟 0 caught</span><span class="hudpill" id="fs-earn">⭐ +0</span>',
    help: 'Hold and let go to cast. Tap when the bobber dips, then hold to keep the fish in the green zone',
    quitNote: 'Every fish you caught is already sold for points.',
    progress: () => { const s = DB.load(); return s.caught ? `${Object.keys(s.book).length} of ${FISH.length} fish found` : 'Go fishing!'; },
  });
  const g = A.g;
  let F = null, holding = false;

  function start() {
    S = DB.load();
    F = { state: 'idle', power: 0, pdir: 1, bob: null, waitT: 0, biteT: 0, fish: null, zone: 200, zv: 0, fy: 200, ftarget: 200, fT: 0, meter: 0.3, caught: 0, earned: 0, t: 0, msg: 'Hold to cast', msgT: 99, splash: [], shadows: Array.from({ length: 6 }, () => ({ x: 300 + Math.random() * 650, y: WATER + 60 + Math.random() * 220, v: (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 30), s: 0.6 + Math.random() * 0.8 })) };
    A.play(); A.run(step); hud();
  }
  A.onAgain = start;
  function hud() { $('#fs-caught').textContent = `🐟 ${F.caught} caught`; $('#fs-earn').textContent = `⭐ +${F.earned}`; }
  function say(m, t) { F.msg = m; F.msgT = t || 1.8; }
  function pickFish() {
    const luck = S.upg.bait * 0.25 + (F.bob ? (F.bob.x - 300) / 650 : 0) * 0.6;
    const ws = RAR.map((r, i) => r.w * (1 + luck * i * 0.9)), tot = ws.reduce((a, b) => a + b, 0);
    let x = Math.random() * tot, rar = 0; for (let i = 0; i < ws.length; i++) { if (x < ws[i]) { rar = i; break; } x -= ws[i]; }
    const pool = FISH.filter((f) => f.r === rar), f = pool[(Math.random() * pool.length) | 0];
    return { ...f, kg: +(f.kg[0] + Math.random() * (f.kg[1] - f.kg[0])).toFixed(f.kg[1] > 50 ? 0 : 1) };
  }
  function press() {
    if (!F || A.paused || A.over) return;
    holding = true;
    if (F.state === 'idle') { F.state = 'charge'; F.power = 0; F.pdir = 1; }
    else if (F.state === 'bite') { F.state = 'reel'; F.fish = pickFish(); F.meter = 0.3; F.zone = 260; F.zv = 0; F.fy = 300; F.ftarget = 300; say('Hold to lift the green zone!', 2); }
    else if (F.state === 'wait') { F.state = 'idle'; F.bob = null; say('Too early! Wait for the dip.', 1.5); }
  }
  function release() {
    holding = false;
    if (F && F.state === 'charge') {
      F.state = 'cast'; const dist = 300 + F.power * 640;
      F.bob = { x: 175, y: 230, tx: dist, ty: WATER + 14, t: 0 };
    }
  }
  A.cv.addEventListener('pointerdown', (e) => { if (L.isActive('s-fish')) { e.preventDefault(); press(); } });
  addEventListener('pointerup', () => { if (L.isActive('s-fish')) release(); });
  A.onKey = (k) => { if (k === 'Space' && !holding) press(); };
  addEventListener('keyup', (e) => { if (e.code === 'Space' && L.isActive('s-fish')) release(); });

  function step(dt) {
    if (dt > 0) update(dt);
    draw();
  }
  function update(dt) {
    F.t += dt; F.msgT -= dt;
    for (const s of F.shadows) { s.x += s.v * dt; if (s.x < 260) s.v = Math.abs(s.v); if (s.x > 980) s.v = -Math.abs(s.v); }
    for (const p of F.splash) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.life -= dt; } F.splash = F.splash.filter((p) => p.life > 0);
    if (F.state === 'charge') { F.power += F.pdir * dt * 1.1; if (F.power > 1) { F.power = 1; F.pdir = -1; } if (F.power < 0) { F.power = 0; F.pdir = 1; } }
    else if (F.state === 'cast') {
      const b = F.bob; b.t += dt * 1.6; const t = Math.min(1, b.t);
      b.x = 175 + (b.tx - 175) * t; b.y = 230 + (b.ty - 230) * t - Math.sin(t * Math.PI) * 160;
      if (t >= 1) { F.state = 'wait'; F.waitT = (2 + Math.random() * 4) * Math.pow(0.85, S.upg.bait); for (let i = 0; i < 10; i++) F.splash.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 180, life: 0.5 }); say('Wait for a bite...', 2); }
    } else if (F.state === 'wait') { F.waitT -= dt; if (F.waitT <= 0) { F.state = 'bite'; F.biteT = 1.1; say('Tap now!', 1.1); } }
    else if (F.state === 'bite') { F.biteT -= dt; if (F.biteT <= 0) { F.state = 'idle'; F.bob = null; say('It got away. Cast again!', 1.8); } }
    else if (F.state === 'reel') {
      const bar = 430, zh = 90 + S.upg.rod * 16, sp = RAR[F.fish.r].speed;
      F.zv += (holding ? -1500 : 1100) * dt; F.zv = Math.max(-520, Math.min(520, F.zv)); F.zone += F.zv * dt;
      if (F.zone < 0) { F.zone = 0; F.zv = 0; } if (F.zone > bar - zh) { F.zone = bar - zh; F.zv = 0; }
      F.fT -= dt; if (F.fT <= 0) { F.fT = (0.5 + Math.random() * 1.1) / sp; F.ftarget = 20 + Math.random() * (bar - 40); }
      F.fy += (F.ftarget - F.fy) * Math.min(1, dt * 2.2 * sp);
      const inside = F.fy > F.zone && F.fy < F.zone + zh;
      F.meter += (inside ? 0.28 * (1 + 0.15 * S.upg.reel) : -0.2 * (0.7 + sp * 0.3)) * dt;
      if (F.meter >= 1) catchFish(); else if (F.meter <= 0) { F.state = 'idle'; F.bob = null; say(`The ${RAR[F.fish.r].name.toLowerCase()} fish escaped!`, 2); }
    }
  }
  function catchFish() {
    const f = F.fish, got = Wallet.add(f.val);
    F.caught++; F.earned += got; S.caught++; S.earned += got;
    const bk = S.book[f.id]; const isNew = !bk; S.book[f.id] = { n: (bk ? bk.n : 0) + 1, best: Math.max(bk ? bk.best : 0, f.kg) }; save(); hud();
    F.state = 'idle'; F.bob = null; F.show = { f, t: 2.4, isNew };
    for (let i = 0; i < 18; i++) F.splash.push({ x: 175, y: 230, vx: (Math.random() - 0.5) * 300, vy: -Math.random() * 300, life: 0.8 });
  }

  function draw() {
    A.begin();
    const gr = g.createLinearGradient(0, 0, 0, WATER); gr.addColorStop(0, '#bfe3ff'); gr.addColorStop(1, '#eaf6ff'); g.fillStyle = gr; g.fillRect(0, 0, W, WATER);
    g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(860, 80, 40, 0, 7); g.fill();
    g.fillStyle = '#fff'; for (const [x, y] of [[300, 70], [620, 110]]) { const cx = (x + F.t * 10) % 1100 - 50; g.beginPath(); g.arc(cx, y, 22, 0, 7); g.arc(cx + 26, y - 8, 28, 0, 7); g.arc(cx + 52, y, 20, 0, 7); g.fill(); }
    const wg = g.createLinearGradient(0, WATER, 0, H); wg.addColorStop(0, '#6cc3f2'); wg.addColorStop(1, '#2f7fc4'); g.fillStyle = wg; g.fillRect(0, WATER, W, H - WATER);
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= W; x += 10) g.lineTo(x, WATER + Math.sin(x * 0.03 + F.t * 2) * 3); g.stroke();
    for (const s of F.shadows) { g.fillStyle = 'rgba(20,60,110,.25)'; g.beginPath(); g.ellipse(s.x, s.y, 26 * s.s, 10 * s.s, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(s.x - Math.sign(s.v) * 26 * s.s, s.y); g.lineTo(s.x - Math.sign(s.v) * 40 * s.s, s.y - 9 * s.s); g.lineTo(s.x - Math.sign(s.v) * 40 * s.s, s.y + 9 * s.s); g.fill(); }
    // dock
    g.fillStyle = '#8b6b4a'; g.fillRect(0, 270, 230, 22); for (let x = 20; x < 230; x += 60) g.fillRect(x, 292, 12, 90);
    g.fillStyle = '#a07e5a'; for (let x = 0; x < 230; x += 38) g.fillRect(x, 270, 34, 8);
    // fisher
    g.fillStyle = '#ff8a3d'; rr(g, 118, 214, 36, 44, 10); g.fill(); g.fillStyle = '#2b3350'; g.fillRect(122, 256, 12, 16); g.fillRect(138, 256, 12, 16);
    g.fillStyle = '#ffd9b3'; g.beginPath(); g.arc(136, 198, 16, 0, 7); g.fill(); g.fillStyle = '#ffd640'; g.beginPath(); g.ellipse(136, 188, 24, 7, 0, 0, 7); g.fill(); g.beginPath(); g.arc(136, 186, 13, Math.PI, 0); g.fill();
    const tipX = 150 + 60, tipY = 180 - (F.state === 'charge' ? F.power * 30 : 0);
    g.strokeStyle = '#6f5238'; g.lineWidth = 4; g.beginPath(); g.moveTo(148, 232); g.lineTo(tipX, tipY); g.stroke();
    if (F.bob) {
      const dip = F.state === 'bite' ? 8 + Math.sin(F.t * 40) * 4 : F.state === 'wait' ? Math.sin(F.t * 3) * 2 : 0, bx = F.bob.x, by = F.bob.y + dip;
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(tipX, tipY); g.quadraticCurveTo((tipX + bx) / 2, Math.max(tipY, by) + 30, bx, by); g.stroke();
      g.fillStyle = '#ff4d5e'; g.beginPath(); g.arc(bx, by, 8, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, 8, 0, Math.PI); g.fill();
      if (F.state === 'bite') { g.fillStyle = '#ff4d5e'; g.font = '700 40px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('!', bx, by - 26); }
    }
    for (const p of F.splash) { g.globalAlpha = Math.max(0, p.life * 2); g.fillStyle = '#e6f4ff'; g.beginPath(); g.arc(p.x, p.y, 4, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    if (F.state === 'charge') { g.fillStyle = 'rgba(255,255,255,.9)'; rr(g, 60, 120, 180, 22, 11); g.fill(); g.fillStyle = F.power > 0.75 ? '#14c79a' : '#ffb31a'; rr(g, 64, 124, 172 * F.power, 14, 7); g.fill(); g.fillStyle = '#16203d'; g.font = '800 14px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('Let go to cast! Farther casts find rarer fish', 150, 110); }
    if (F.state === 'reel') {
      const bx = 850, by = 90, bar = 430, zh = 90 + S.upg.rod * 16, f = F.fish;
      g.fillStyle = 'rgba(255,255,255,.95)'; rr(g, bx - 20, by - 20, 100, bar + 40, 20); g.fill();
      g.fillStyle = '#2f7fc4'; rr(g, bx, by, 40, bar, 12); g.fill();
      g.fillStyle = 'rgba(20,199,154,.85)'; rr(g, bx + 2, by + F.zone, 36, zh, 10); g.fill();
      g.font = '28px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(f.icon, bx + 20, by + F.fy + 10);
      g.fillStyle = '#e3e8f2'; rr(g, bx + 50, by, 12, bar, 6); g.fill(); g.fillStyle = F.meter > 0.3 ? '#14c79a' : '#ff4d5e'; rr(g, bx + 50, by + bar * (1 - F.meter), 12, bar * F.meter, 6); g.fill();
      g.fillStyle = RAR[f.r].color; g.font = '800 16px Nunito, system-ui, sans-serif'; g.fillText(RAR[f.r].name + ' fish!', bx + 30, by - 30);
    }
    if (F.show) {
      F.show.t -= 1 / 60; const s = F.show; if (s.t <= 0) F.show = null;
      g.globalAlpha = Math.min(1, s.t * 2); g.fillStyle = 'rgba(255,255,255,.95)'; rr(g, 330, 150, 340, 170, 24); g.fill();
      g.textAlign = 'center'; g.font = '64px system-ui, sans-serif'; g.fillText(s.f.icon, 500, 225);
      g.fillStyle = RAR[s.f.r].color; g.font = '700 26px Fredoka, system-ui, sans-serif'; g.fillText(`${s.isNew ? 'New! ' : ''}${s.f.name}`, 500, 268);
      g.fillStyle = '#16203d'; g.font = '800 16px Nunito, system-ui, sans-serif'; g.fillText(`${s.f.kg} kg, +${s.f.val} points`, 500, 298); g.globalAlpha = 1;
    }
    if (F.msgT > 0 && F.state !== 'charge' && !F.show) { g.fillStyle = 'rgba(22,32,61,.8)'; g.font = '800 18px Nunito, system-ui, sans-serif'; const w = g.measureText(F.msg).width + 30; rr(g, 500 - w / 2, 540, w, 36, 18); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(F.msg, 500, 564); }
  }

  A.onTab = (t) => {
    S = DB.load(); const re = () => A.onTab(t);
    if (t === 'play') { A.panel('play').innerHTML = L.playCard('🎣', 'Gone fishing', 'Hold and let go to cast. When the bobber dips and shows "!", tap fast. Then hold to lift the green zone and keep the fish inside it until the meter fills. Each fish is sold right away for points.', [`🐟 ${S.caught} caught`, `📖 ${Object.keys(S.book).length} / ${FISH.length} species`, `⭐ ${S.earned.toLocaleString()} earned`], 'fs-go', 'Start fishing'); $('#fs-go').onclick = start; }
    else if (t === 'upgrades') { A.panel('upgrades').innerHTML = `<div class="items">${L.upgradeCards(UPG, S.upg, COST, 5, 'data-fsu')}</div>`; L.bindUpg('data-fsu', S, COST, save, re); }
    else A.panel('book').innerHTML = `<div class="items">${FISH.map((f) => { const b = S.book[f.id]; return `<div class="item"><div class="item-head"><div class="ico" style="${b ? '' : 'filter:grayscale(1) opacity(.35)'}">${f.icon}</div><div><h3>${b ? f.name : '???'}</h3><p style="color:${RAR[f.r].color};font-weight:800">${RAR[f.r].name}</p><p>${b ? `Caught ${b.n}, biggest ${b.best} kg, worth ⭐ ${f.val}` : 'Not caught yet'}</p></div></div></div>`; }).join('')}</div>`;
  };
})();
