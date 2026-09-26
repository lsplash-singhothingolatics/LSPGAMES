/* Pet Paradise: hatch eggs, care for pets, grow them up for points. */
(function () {
  'use strict';
  const L = LSPG, rr = L.rr;
  const RW = 1000, RH = 600;
  const TYPES = {
    puppy: { name: 'Puppy', body: '#c98b52', ear: 'flop', rar: 0 }, kitten: { name: 'Kitten', body: '#ff9f4a', ear: 'point', rar: 0 }, bunny: { name: 'Bunny', body: '#f4f4f8', ear: 'long', rar: 0 },
    fox: { name: 'Fox', body: '#ff7a2e', ear: 'point', rar: 1, tail: '#fff' }, panda: { name: 'Panda', body: '#ffffff', ear: 'round', rar: 1, patch: true }, penguin: { name: 'Penguin', body: '#2b3350', ear: 'none', rar: 1, belly: '#fff', beak: true },
    unicorn: { name: 'Unicorn', body: '#fff4fb', ear: 'point', rar: 2, horn: true, mane: true }, dragon: { name: 'Dragon', body: '#3fcf7a', ear: 'point', rar: 2, horn: true, wings: '#2aa860' }, phoenix: { name: 'Phoenix', body: '#ff5a36', ear: 'none', rar: 2, wings: '#ffb31a', beak: true, crest: true },
  };
  const RAR = [{ name: 'Common', color: '#66708f', mult: 1 }, { name: 'Rare', color: '#2f6bff', mult: 2 }, { name: 'Legendary', color: '#e89a00', mult: 4 }];
  const EGGS = [
    { id: 'starter', name: 'Starter Egg', icon: '🥚', cost: 0, odds: [1, 0, 0], desc: 'Free once. Hatches a common pet.' },
    { id: 'common', name: 'Garden Egg', icon: '🥚', cost: 120, odds: [0.85, 0.14, 0.01], desc: 'Mostly common pets, small chance of rare.' },
    { id: 'rare', name: 'Crystal Egg', icon: '💎', cost: 450, odds: [0.3, 0.6, 0.1], desc: 'Good chance of a rare pet.' },
    { id: 'legend', name: 'Royal Egg', icon: '👑', cost: 1500, odds: [0, 0.55, 0.45], desc: 'Best chance of a legendary pet.' },
  ];
  const AGES = ['Newborn', 'Junior', 'Pre-Teen', 'Teen', 'Full Grown'], XP_AT = [0, 60, 150, 300, 500];
  const PET_NAMES = ['Biscuit', 'Luna', 'Mochi', 'Pip', 'Coco', 'Sunny', 'Nugget', 'Ziggy', 'Pebble', 'Toffee', 'Bean', 'Sky', 'Maple', 'Dot', 'Kiwi', 'Blaze'];
  const NEEDS = [{ id: 'hunger', icon: '🍖', label: 'Food', color: '#ff8a3d' }, { id: 'fun', icon: '🎾', label: 'Fun', color: '#14c79a' }, { id: 'clean', icon: '🫧', label: 'Clean', color: '#4fb6f0' }, { id: 'energy', icon: '😴', label: 'Energy', color: '#8a5cff' }];
  const SPOTS = { hunger: { x: 250, y: 470 }, clean: { x: 760, y: 470 }, energy: { x: 150, y: 330 }, fun: { x: 520, y: 440 } };

  const DB = L.store('pets', { pets: [], active: null, starter: false, hatched: 0 });
  let S = null; const save = () => DB.save(S);
  const A = L.makeGame({
    key: 'pets', title: 'Pet Paradise', emoji: '🐶', cardBg: '#fff0d9', grid: 'rp-games', bg: '#f6efe4', world: { w: RW, h: RH },
    desc: 'Hatch eggs, care for your pets and raise them to Full Grown.',
    tabs: [['home', 'Home'], ['pets', 'My pets'], ['adopt', 'Adopt']],
    hud: '<span class="hudpill" id="pt-name">Pet</span><button class="iconbtn" data-act="hunger" aria-label="Feed">🍖</button><button class="iconbtn" data-act="fun" aria-label="Play">🎾</button><button class="iconbtn" data-act="clean" aria-label="Bath">🫧</button><button class="iconbtn" data-act="energy" aria-label="Sleep">😴</button>',
    help: 'Use the buttons at the top to feed, play, bathe and put your pet to sleep', quitNote: 'Your pet and its progress are saved.', rotate: false,
    progress: () => { const s = DB.load(); return s.pets.length ? `${s.pets.length} pet${s.pets.length > 1 ? 's' : ''}, ${s.pets.filter((p) => p.age >= 4).length} full grown` : 'Hatch your first pet!'; },
  });
  const g = A.g;
  let P = null, R = null;

  function decayOffline(p) {
    const hrs = (Date.now() - (p.seen || Date.now())) / 3.6e6;
    for (const n of NEEDS) p.needs[n.id] = Math.max(0, p.needs[n.id] - hrs * 12);
    p.seen = Date.now();
  }
  function hatch(egg) {
    if (egg.id === 'starter') { if (S.starter) return; S.starter = true; }
    else if (!Wallet.spend(egg.cost)) return;
    let r = Math.random(), rar = 0; for (let i = 0; i < 3; i++) { if (r < egg.odds[i]) { rar = i; break; } r -= egg.odds[i]; }
    const pool = Object.keys(TYPES).filter((t) => TYPES[t].rar === rar), type = pool[(Math.random() * pool.length) | 0];
    const pet = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type, name: PET_NAMES[(Math.random() * PET_NAMES.length) | 0], age: 0, xp: 0, needs: { hunger: 70, fun: 70, clean: 70, energy: 70 }, seen: Date.now() };
    S.pets.push(pet); S.active = pet.id; S.hatched++; save(); refreshPoints();
    A.play(); A.paused = true;
    A.modal(`<h2>It hatched!</h2><canvas id="pt-reveal" width="240" height="200" style="width:200px;height:170px;margin:6px auto;display:block"></canvas><p style="font-weight:800;color:${RAR[rar].color}">${RAR[rar].name} ${TYPES[type].name}</p><p class="muted">Say hi to ${pet.name}!</p><div class="modal-actions"><button class="btn primary" data-a="go">Take care of ${pet.name}</button></div>`, { go: () => visit(pet.id) });
    const c = $('#pt-reveal'), cg = c.getContext('2d'); drawPet(cg, { x: 120, y: 130, face: 1, bob: 0, action: '' }, pet, 1.3);
  }
  function visit(id) {
    S = DB.load(); P = S.pets.find((p) => p.id === (id || S.active)); if (!P) { A.openLobby('adopt'); return; }
    S.active = P.id; decayOffline(P); save();
    R = { x: 500, y: 450, tx: 500, ty: 450, face: 1, bob: 0, action: '', actT: 0, target: null, t: 0, parts: [], ball: null, wander: 2 };
    A.play(); updHud(); A.run(step);
  }
  A.onAgain = () => visit();
  function updHud() { $('#pt-name').textContent = `${P.name} (${AGES[P.age]})`; }
  $$('#s-pets [data-act]').forEach((b) => (b.onclick = () => startCare(b.dataset.act)));

  function startCare(id) {
    if (!R || A.paused || R.action) return;
    const s = SPOTS[id]; R.target = id; R.tx = s.x; R.ty = s.y;
    if (id === 'fun') R.ball = { x: 520, y: 300, vx: 380 * (Math.random() < 0.5 ? -1 : 1), vy: -200 };
  }
  function finishCare(id) {
    const before = P.needs[id], xp = Math.round(8 + (100 - before) / 6), mult = RAR[TYPES[P.type].rar].mult;
    P.needs[id] = 100; P.xp += xp;
    let got = Wallet.add(2 * mult);
    R.parts.push({ x: R.x, y: R.y - 90, vy: -40, life: 1.3, text: `+${xp} XP` });
    while (P.age < 4 && P.xp >= XP_AT[P.age + 1]) {
      P.age++; const bonus = Wallet.add(50 * P.age * mult); got += bonus;
      for (let i = 0; i < 30; i++) R.parts.push({ x: R.x, y: R.y - 40, vx: (Math.random() - 0.5) * 400, vy: -Math.random() * 300, life: 1, c: ['#ffb31a', '#ff4d8b', '#14c79a', '#2f6bff'][i % 4] });
      toast(`${P.name} grew up to ${AGES[P.age]}! +${bonus} points`, 3500);
    }
    save(); refreshPoints(); updHud();
  }

  function step(dt) {
    if (dt > 0) update(dt);
    draw();
  }
  function update(dt) {
    R.t += dt;
    for (const n of NEEDS) P.needs[n.id] = Math.max(0, P.needs[n.id] - dt * (n.id === 'energy' ? 0.35 : 0.5));
    if (R.action) {
      R.actT -= dt;
      if (R.action === 'fun' && R.ball) { const b = R.ball; b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.y > 470) { b.y = 470; b.vy *= -0.7; } if (b.x < 120 || b.x > 880) b.vx *= -1; R.tx = b.x; R.ty = 470; }
      if (R.action === 'clean' && Math.random() < 0.5) R.parts.push({ x: R.x + (Math.random() - 0.5) * 80, y: R.y - 40 - Math.random() * 40, vx: 0, vy: -50, life: 0.9, c: 'bubble' });
      if (R.action === 'hunger' && Math.random() < 0.08) R.parts.push({ x: R.x + 30, y: R.y - 30, vx: 20, vy: -30, life: 0.8, text: 'Yum!' });
      if (R.action === 'energy' && Math.random() < 0.05) R.parts.push({ x: R.x + 30, y: R.y - 80, vx: 20, vy: -30, life: 1.2, text: 'Z' });
      if (R.actT <= 0) { const a = R.action; R.action = ''; R.ball = null; finishCare(a); }
    } else if (R.target) {
      if (Math.hypot(R.tx - R.x, R.ty - R.y) < 8) { R.action = R.target; R.actT = R.target === 'energy' ? 3.5 : 2.6; R.target = null; }
    } else {
      R.wander -= dt; if (R.wander <= 0) { R.wander = 2 + Math.random() * 3; R.tx = 200 + Math.random() * 600; R.ty = 400 + Math.random() * 110; }
    }
    const dx = R.tx - R.x, dy = R.ty - R.y, d = Math.hypot(dx, dy), sp = R.action === 'fun' ? 330 : R.target ? 240 : 90;
    if (d > 3 && R.action !== 'energy' && R.action !== 'clean' && R.action !== 'hunger') { R.x += (dx / d) * Math.min(d, sp * dt); R.y += (dy / d) * Math.min(d, sp * dt); if (Math.abs(dx) > 2) R.face = dx > 0 ? 1 : -1; R.bob += dt * 12; }
    for (const q of R.parts) { q.x += (q.vx || 0) * dt; q.y += (q.vy || 0) * dt; if (q.c && q.c !== 'bubble') q.vy += 500 * dt; q.life -= dt; }
    R.parts = R.parts.filter((q) => q.life > 0);
    R.saveT = (R.saveT || 0) - dt; if (R.saveT <= 0) { R.saveT = 5; P.seen = Date.now(); save(); }
  }

  function drawPet(c, st, pet, scale) {
    const T = TYPES[pet.type], s = (0.72 + pet.age * 0.1) * (scale || 1), x = st.x, y = st.y - Math.abs(Math.sin(st.bob)) * 6 * s, f = st.face;
    c.save(); c.translate(x, y); c.scale(f * s, s);
    c.fillStyle = 'rgba(22,32,61,.14)'; c.beginPath(); c.ellipse(0, 4, 50, 10, 0, 0, 7); c.fill();
    const sleeping = st.action === 'energy';
    if (T.wings) { c.fillStyle = T.wings; c.beginPath(); c.ellipse(-18, -52, 30, 16, -0.6 + Math.sin((st.bob || 0) * 2) * 0.2, 0, 7); c.fill(); }
    if (T.tail || pet.type === 'puppy' || pet.type === 'kitten' || pet.type === 'dragon') { c.fillStyle = T.body; c.beginPath(); c.ellipse(-44, -30, 18, 8, -0.7, 0, 7); c.fill(); if (T.tail) { c.fillStyle = T.tail; c.beginPath(); c.arc(-56, -42, 7, 0, 7); c.fill(); } }
    c.fillStyle = T.body; c.strokeStyle = 'rgba(22,32,61,.35)'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(-4, -28, 42, 28, 0, 0, 7); c.fill(); c.stroke();
    if (T.belly) { c.fillStyle = T.belly; c.beginPath(); c.ellipse(4, -24, 24, 20, 0, 0, 7); c.fill(); }
    c.fillStyle = T.body; for (const lx of [-26, 14]) { rr(c, lx, -10, 14, 14, 5); c.fill(); }
    // head
    c.fillStyle = T.body; c.beginPath(); c.arc(30, -62, 30, 0, 7); c.fill(); c.stroke();
    if (T.ear === 'point') { for (const ex of [14, 40]) { c.beginPath(); c.moveTo(ex - 10, -84); c.lineTo(ex, -104); c.lineTo(ex + 10, -84); c.fill(); c.stroke(); } }
    if (T.ear === 'flop') { c.fillStyle = '#8b5a33'; for (const ex of [8, 50]) { c.beginPath(); c.ellipse(ex, -66, 9, 18, ex < 30 ? 0.4 : -0.4, 0, 7); c.fill(); } }
    if (T.ear === 'long') { for (const ex of [18, 38]) { c.beginPath(); c.ellipse(ex, -104, 8, 24, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#ffc9d9'; c.beginPath(); c.ellipse(ex, -104, 4, 16, 0, 0, 7); c.fill(); c.fillStyle = T.body; } }
    if (T.ear === 'round') { c.fillStyle = '#2b3350'; for (const ex of [10, 50]) { c.beginPath(); c.arc(ex, -88, 10, 0, 7); c.fill(); } }
    if (T.patch) { c.fillStyle = '#2b3350'; c.beginPath(); c.ellipse(22, -64, 8, 10, 0.4, 0, 7); c.fill(); c.beginPath(); c.ellipse(42, -64, 8, 10, -0.4, 0, 7); c.fill(); }
    if (T.horn) { c.fillStyle = '#ffd640'; c.beginPath(); c.moveTo(24, -88); c.lineTo(32, -120); c.lineTo(40, -88); c.fill(); }
    if (T.mane) { ['#ff8ac2', '#b48cff', '#7fd4ff'].forEach((m, i) => { c.fillStyle = m; c.beginPath(); c.arc(8 - i * 6, -76 + i * 10, 10, 0, 7); c.fill(); }); }
    if (T.crest) { c.fillStyle = '#ffd640'; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(22 + i * 8, -94, 4, 12, -0.3 + i * 0.3, 0, 7); c.fill(); } }
    // face
    c.fillStyle = '#16203d';
    if (sleeping) { c.lineWidth = 3; c.strokeStyle = '#16203d'; for (const ex of [24, 42]) { c.beginPath(); c.arc(ex, -64, 5, 0.2, Math.PI - 0.2); c.stroke(); } }
    else for (const ex of [24, 42]) { c.beginPath(); c.arc(ex, -65, 4.5, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + 1.5, -67, 1.6, 0, 7); c.fill(); c.fillStyle = '#16203d'; }
    if (T.beak) { c.fillStyle = '#ffb31a'; c.beginPath(); c.moveTo(48, -58); c.lineTo(64, -54); c.lineTo(48, -50); c.fill(); }
    else { c.fillStyle = '#ff8aa8'; c.beginPath(); c.arc(56, -56, 4, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,120,150,.35)'; c.beginPath(); c.arc(18, -54, 5, 0, 7); c.fill();
    c.restore();
  }

  function draw() {
    A.begin(); const t = R.t;
    g.fillStyle = '#fbe9d0'; g.fillRect(0, 0, RW, 360);
    g.fillStyle = '#f3dcbc'; for (let x = 0; x < RW; x += 60) g.fillRect(x, 0, 30, 360);
    g.fillStyle = '#e8c9a0'; g.fillRect(0, 360, RW, RH - 360);
    g.fillStyle = 'rgba(255,255,255,.18)'; for (let x = 0; x < RW; x += 100) g.fillRect(x, 360, 4, RH - 360);
    g.fillStyle = '#cfe8ff'; rr(g, 400, 60, 200, 150, 14); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 10; g.stroke(); g.fillStyle = '#fff'; g.fillRect(496, 60, 8, 150); g.fillRect(400, 131, 200, 8);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(450 + (t * 8) % 120, 110, 16, 0, 7); g.arc(470 + (t * 8) % 120, 102, 20, 0, 7); g.fill();
    // bed
    g.fillStyle = '#8a5cff'; rr(g, 60, 300, 200, 70, 20); g.fill(); g.fillStyle = '#b89cff'; rr(g, 80, 290, 160, 40, 16); g.fill();
    // bowl
    g.fillStyle = '#ff4d5e'; g.beginPath(); g.ellipse(250, 520, 44, 16, 0, 0, 7); g.fill(); g.fillStyle = '#c98b52'; g.beginPath(); g.ellipse(250, 514, 32, 9, 0, 0, 7); g.fill();
    // tub
    g.fillStyle = '#ffffff'; g.strokeStyle = '#c3cbdb'; g.lineWidth = 4; rr(g, 680, 440, 170, 90, 30); g.fill(); g.stroke(); g.fillStyle = '#9fd4ff'; rr(g, 692, 450, 146, 26, 12); g.fill();
    // toy box
    g.fillStyle = '#14c79a'; rr(g, 860, 300, 100, 70, 10); g.fill(); g.font = '30px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('🧸', 910, 350);
    if (R.ball) { g.fillStyle = '#d4f04a'; g.beginPath(); g.arc(R.ball.x, R.ball.y - 12, 12, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(R.ball.x, R.ball.y - 12, 8, 0.5, 2.6); g.stroke(); }
    const pst = R.action === 'energy' ? { x: 160, y: 330, face: 1, bob: 0, action: 'energy' } : R.action === 'clean' ? { x: 765, y: 480, face: -1, bob: 0, action: 'clean' } : { x: R.x, y: R.y, face: R.face, bob: R.bob, action: R.action };
    drawPet(g, pst, P, 1.35);
    if (!R.action && !R.target) { const low = NEEDS.filter((n) => P.needs[n.id] < 35).sort((a, b) => P.needs[a.id] - P.needs[b.id])[0]; if (low) { g.fillStyle = '#fff'; rr(g, pst.x - 26, pst.y - 150, 52, 40, 14); g.fill(); g.font = '24px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(low.icon, pst.x, pst.y - 121); } }
    for (const q of R.parts) {
      g.globalAlpha = Math.max(0, Math.min(1, q.life));
      if (q.text) { g.fillStyle = q.text === 'Z' ? '#8a5cff' : '#e89a00'; g.font = '700 22px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(q.text, q.x, q.y); }
      else if (q.c === 'bubble') { g.strokeStyle = '#4fb6f0'; g.lineWidth = 2; g.beginPath(); g.arc(q.x, q.y, 8, 0, 7); g.stroke(); }
      else { g.fillStyle = q.c; g.fillRect(q.x - 4, q.y - 4, 8, 8); }
    }
    g.globalAlpha = 1;
    // needs panel
    g.fillStyle = 'rgba(255,255,255,.92)'; rr(g, 16, 16, 250, 160, 16); g.fill();
    g.font = '800 15px Nunito, system-ui, sans-serif'; g.textAlign = 'left';
    NEEDS.forEach((n, i) => { const y = 42 + i * 30; g.fillStyle = '#16203d'; g.fillText(n.icon + ' ' + n.label, 30, y + 5); g.fillStyle = '#edf1f8'; rr(g, 120, y - 7, 130, 12, 6); g.fill(); g.fillStyle = P.needs[n.id] < 30 ? '#ff4d5e' : n.color; rr(g, 120, y - 7, Math.max(6, 130 * P.needs[n.id] / 100), 12, 6); g.fill(); });
    const nx = P.age < 4 ? XP_AT[P.age + 1] : null, pr = nx ? (P.xp - XP_AT[P.age]) / (nx - XP_AT[P.age]) : 1;
    g.fillStyle = 'rgba(255,255,255,.92)'; rr(g, RW - 266, 16, 250, 64, 16); g.fill();
    g.fillStyle = RAR[TYPES[P.type].rar].color; g.font = '800 14px Nunito, system-ui, sans-serif'; g.fillText(`${RAR[TYPES[P.type].rar].name} ${TYPES[P.type].name}`, RW - 250, 40);
    g.fillStyle = '#16203d'; g.fillText(nx ? `${AGES[P.age]}: ${P.xp - XP_AT[P.age]} / ${nx - XP_AT[P.age]} XP` : 'Full Grown!', RW - 250, 60);
    g.fillStyle = '#edf1f8'; rr(g, RW - 250, 66, 218, 8, 4); g.fill(); g.fillStyle = '#ffb31a'; rr(g, RW - 250, 66, Math.max(6, 218 * pr), 8, 4); g.fill();
  }

  function mini(pet) { const c = document.createElement('canvas'); c.width = 160; c.height = 130; drawPet(c.getContext('2d'), { x: 72, y: 118, face: 1, bob: 0 }, pet, 0.95); return c.toDataURL(); }
  A.onTab = (t) => {
    S = DB.load(); S.pets.forEach(decayOffline); save();
    const act = S.pets.find((p) => p.id === S.active) || S.pets[0];
    if (t === 'home') {
      A.panel('home').innerHTML = act ? `<div class="item" style="margin-top:18px;max-width:560px"><div class="item-head"><img src="${mini(act)}" alt="" style="width:96px;height:78px"><div><h3>${act.name} the ${TYPES[act.type].name}</h3><p>${AGES[act.age]}. ${NEEDS.filter((n) => act.needs[n.id] < 35).map((n) => n.label).join(', ') || 'Happy and healthy'}${NEEDS.some((n) => act.needs[n.id] < 35) ? ' needed!' : '.'}</p></div></div><div class="statline"><span class="pill">🐾 ${S.pets.length} pets</span><span class="pill">🥚 ${S.hatched} hatched</span></div><button class="btn primary" id="pt-visit">Visit ${act.name}</button></div><p class="note">Pets get hungry, bored, dirty and sleepy over time, even when you're away. Each care task gives XP. Growing up earns big points, and rarer pets earn more.</p>`
        : L.playCard('🥚', 'Adopt your first pet', 'Get a free Starter Egg and hatch your very own pet.', [], 'pt-free', 'Hatch free egg');
      const v = $('#pt-visit'); if (v) v.onclick = () => visit(act.id);
      const f = $('#pt-free'); if (f) f.onclick = () => hatch(EGGS[0]);
    } else if (t === 'pets') {
      A.panel('pets').innerHTML = S.pets.length ? `<div class="items">${S.pets.map((p) => `<div class="item${p.id === S.active ? ' eq' : ''}"><div class="item-head"><img src="${mini(p)}" alt="" style="width:80px;height:65px"><div><h3>${p.name}</h3><p style="color:${RAR[TYPES[p.type].rar].color};font-weight:800">${RAR[TYPES[p.type].rar].name} ${TYPES[p.type].name}</p><p>${AGES[p.age]}</p></div></div><button class="btn primary" data-ptv="${p.id}">Visit</button></div>`).join('')}</div>` : '<p class="note">No pets yet. Adopt one from the Adopt tab.</p>';
      $$('[data-ptv]').forEach((b) => (b.onclick = () => visit(b.dataset.ptv)));
    } else {
      const pts = Wallet.get();
      A.panel('adopt').innerHTML = `<div class="items">${EGGS.filter((e) => e.id !== 'starter' || !S.starter).map((e) => `<div class="item"><div class="item-head"><div class="ico">${e.icon}</div><div><h3>${e.name}</h3><p>${e.desc}</p></div></div><p style="font-size:13px;font-weight:800">${e.odds.map((o, i) => o ? `<span style="color:${RAR[i].color}">${RAR[i].name} ${Math.round(o * 100)}%</span>` : '').filter(Boolean).join(' · ')}</p><button class="btn gold" data-egg="${e.id}" ${pts < e.cost ? 'disabled' : ''}>${e.cost ? 'Hatch for ⭐ ' + e.cost.toLocaleString() : 'Hatch free'}</button></div>`).join('')}</div>`;
      $$('[data-egg]').forEach((b) => (b.onclick = () => hatch(EGGS.find((e) => e.id === b.dataset.egg))));
    }
  };
  A.onLeave = () => { if (P) { P.seen = Date.now(); save(); } };
  A.onQuit = A.onLeave;
})();
