/* Block Tycoon: build a block factory, earn cash, rebirth for LSP points. */
(function () {
  'use strict';
  const L = LSPG, fmt = L.fmt, rr = L.rr;
  const money = (n) => '$' + fmt(n);

  const ITEMS = [
    { id: 'd1', name: 'Starter Dropper', icon: '🟫', cost: 0, type: 'drop', slot: 0, val: 1, every: 1.5, color: '#c98b52' },
    { id: 'd2', name: 'Stone Dropper', icon: '⬜', cost: 25, type: 'drop', slot: 1, val: 3, every: 1.5, color: '#9aa3b5' },
    { id: 'belt1', name: 'Faster Belt', icon: '⏩', cost: 60, type: 'belt', desc: 'Blocks reach the furnace 50% faster.' },
    { id: 'd3', name: 'Brick Dropper', icon: '🧱', cost: 150, type: 'drop', slot: 2, val: 8, every: 1.5, color: '#e0664f' },
    { id: 'washer', name: 'Block Washer', icon: '🫧', cost: 400, type: 'up', x: 705, mult: 2, color: '#4fb6f0' },
    { id: 'd4', name: 'Copper Dropper', icon: '🟧', cost: 1000, type: 'drop', slot: 3, val: 25, every: 1.5, color: '#e08a3c' },
    { id: 'belt2', name: 'Turbo Belt', icon: '⏭️', cost: 2500, type: 'belt', desc: 'Blocks move another 50% faster.' },
    { id: 'd5', name: 'Emerald Dropper', icon: '🟩', cost: 6000, type: 'drop', slot: 4, val: 80, every: 1.5, color: '#2fbf71' },
    { id: 'painter', name: 'Paint Booth', icon: '🎨', cost: 15000, type: 'up', x: 775, mult: 2, color: '#b04dff' },
    { id: 'mega', name: 'Mega Dropper', icon: '🟪', cost: 40000, type: 'drop', slot: 5, val: 300, every: 1, color: '#8a5cff', big: true },
    { id: 'laser', name: 'Laser Upgrader', icon: '🔆', cost: 100000, type: 'up', x: 845, mult: 3, color: '#ff4d5e' },
    { id: 'furnace', name: 'Golden Furnace', icon: '🔥', cost: 250000, type: 'furnace', desc: 'The furnace pays double for every block.' },
    { id: 'walls', name: 'Walls and Roof', icon: '🏠', cost: 600000, type: 'build', desc: 'A real factory building. +10% cash from every block.' },
    { id: 'diamond', name: 'Diamond Dropper', icon: '💎', cost: 1500000, type: 'drop', slot: 6, val: 2000, every: 1, color: '#4fd6ff', big: true },
  ];
  const REBIRTH_COST = 5e6;
  const W = 1000, H = 520, BELT_Y = 380, BELT_X0 = 40, BELT_X1 = 890;
  const SLOTS = [95, 180, 265, 350, 435, 525, 620];
  const PAINTS = ['#ff4d8b', '#ffb31a', '#14c79a', '#2f6bff', '#ff8a3d'];

  const descOf = (it) => it.desc || (it.type === 'drop' ? `Drops ${money(it.val)} blocks every ${it.every}s.` : it.type === 'up' ? `Blocks that pass through are worth ×${it.mult}.` : '');

  /* ---------- DOM ---------- */
  const style = document.createElement('style');
  style.textContent = `
  #s-tycoon{overflow:auto}
  .ty-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .ty-cash{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
  .ty-cash b{font-family:Fredoka,system-ui,sans-serif;font-size:38px;font-weight:700;color:#0b8f6e;line-height:1}
  .ty-cash span{font-weight:800}
  .ty-stage{margin-top:14px;border-radius:20px;overflow:hidden;border:2px solid var(--line);background:#eef6ff;aspect-ratio:1000/520;position:relative;cursor:pointer;touch-action:manipulation}
  .ty-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
  .ty-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:18px;align-items:start}
  .ty-grid .items{grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}
  .ty-rb{margin-top:18px}
  .ty-rb p{font-size:14px;color:var(--muted)}
  .ty-rb .big{font-family:Fredoka,system-ui,sans-serif;font-size:26px;font-weight:700}
  @media (max-width:820px){.ty-grid{grid-template-columns:1fr}.ty-cash b{font-size:30px}}
  `;
  document.head.appendChild(style);
  document.body.insertAdjacentHTML('beforeend', `
  <section class="screen" id="s-tycoon">
    <header class="topbar"><div class="topbar-in">
      <button class="iconbtn" id="ty-back" aria-label="Back to games">‹</button>
      <h2 style="font-size:20px">Block Tycoon</h2>
      <div class="spacer"></div>
      <span class="pill" title="LSP points">⭐ <span class="js-points">0</span></span>
    </div></header>
    <main class="wrap">
      <div class="ty-top">
        <div class="ty-cash"><b id="ty-cash">$0</b><span class="muted" id="ty-rate">$0 per second</span></div>
        <button class="btn primary" id="ty-tap">Drop a block</button>
      </div>
      <div class="ty-stage" id="ty-stage" title="Tap to drop a block"><canvas id="ty-cv"></canvas></div>
      <div class="ty-grid">
        <section><h2 class="section-title" style="margin-top:22px">Build next</h2><div class="items" id="ty-shop"></div></section>
        <section><h2 class="section-title" style="margin-top:22px">Rebirth</h2><div class="item ty-rb" id="ty-rebirth"></div></section>
      </div>
    </main>
  </section>`);

  const cv = $('#ty-cv'), g = cv.getContext('2d');
  let TS = null, blocks = [], floats = [], sparks = [], timers = {}, raf = 0, last = 0, time = 0, saveT = 0, uiT = 0, tapCd = 0, payAcc = 0, payT = 0, furnaceFlash = 0;

  function tload() {
    TS = Object.assign({ cash: 0, total: 0, bought: ['d1'], rebirths: 0, last: Date.now() }, store.get('lsp_tycoon_' + profile.email, {}));
    if (!TS.bought.includes('d1')) TS.bought.unshift('d1');
  }
  function tsave() { if (!TS) return; TS.last = Date.now(); store.set('lsp_tycoon_' + profile.email, TS); }
  const has = (id) => TS.bought.includes(id);
  const beltSpeed = () => 110 * (has('belt1') ? 1.5 : 1) * (has('belt2') ? 1.5 : 1);
  const payMult = () => (has('furnace') ? 2 : 1) * (has('walls') ? 1.1 : 1) * (1 + TS.rebirths);
  const upMult = () => ITEMS.filter((i) => i.type === 'up' && has(i.id)).reduce((a, i) => a * i.mult, 1);
  const rate = () => ITEMS.filter((i) => i.type === 'drop' && has(i.id)).reduce((a, i) => a + i.val / i.every, 0) * upMult() * payMult();
  const rebirthReward = () => 1500 + 500 * TS.rebirths;
  const allBuilt = () => ITEMS.every((i) => has(i.id));

  function visibleNext() {
    const lastIdx = Math.max(...TS.bought.map((id) => ITEMS.findIndex((i) => i.id === id)));
    return ITEMS.filter((it, i) => !has(it.id) && i <= lastIdx + 3);
  }

  function renderShop() {
    const next = visibleNext();
    $('#ty-shop').innerHTML = next.length ? next.map((it) => `
      <div class="item"><div class="item-head"><div class="ico">${it.icon}</div><div><h3>${it.name}</h3><p>${descOf(it)}</p></div></div>
      <button class="btn gold" data-ty="${it.id}" ${TS.cash < it.cost ? 'disabled' : ''}>Build for ${money(it.cost)}</button></div>`).join('')
      : '<div class="item"><h3>Factory complete!</h3><p>Everything is built. Save up and rebirth to earn LSP points.</p></div>';
    $$('[data-ty]').forEach((b) => (b.onclick = () => buy(b.dataset.ty)));
    const ready = allBuilt() && TS.cash >= REBIRTH_COST;
    $('#ty-rebirth').innerHTML = `
      <p>Rebirths so far</p><div class="big">${TS.rebirths} <span style="font-size:16px;color:var(--muted)">(cash ×${1 + TS.rebirths})</span></div>
      <p>Rebirth resets your cash and factory. You keep a bigger cash boost forever and earn <b style="color:var(--ink)">⭐ ${rebirthReward().toLocaleString()}</b> LSP points.</p>
      <p>${allBuilt() ? `Needs ${money(REBIRTH_COST)} cash.` : 'Build everything first, then save up ' + money(REBIRTH_COST) + '.'}</p>
      <button class="btn primary" id="ty-rb-btn" ${ready ? '' : 'disabled'}>Rebirth</button>`;
    $('#ty-rb-btn').onclick = rebirth;
  }

  function refreshButtons() {
    $$('[data-ty]').forEach((b) => { const it = ITEMS.find((i) => i.id === b.dataset.ty); b.disabled = TS.cash < it.cost; });
    const rb = $('#ty-rb-btn'); if (rb) rb.disabled = !(allBuilt() && TS.cash >= REBIRTH_COST);
  }

  function buy(id) {
    const it = ITEMS.find((i) => i.id === id);
    if (!it || has(id) || TS.cash < it.cost) return;
    TS.cash -= it.cost; TS.bought.push(id); tsave(); renderShop();
    const x = it.type === 'drop' ? SLOTS[it.slot] : it.type === 'up' ? it.x : it.type === 'furnace' ? 940 : 500;
    const y = it.type === 'drop' ? 140 : it.type === 'build' ? 120 : 340;
    for (let i = 0; i < 24; i++) { const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160; sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .7, color: it.color || '#ffb31a' }); }
    toast(it.name + ' built');
  }

  function rebirth() {
    if (!(allBuilt() && TS.cash >= REBIRTH_COST)) return;
    const got = Wallet.add(rebirthReward());
    TS.rebirths++; TS.cash = 0; TS.bought = ['d1']; blocks = []; timers = {};
    tsave(); renderShop(); refreshPoints();
    toast(`Rebirth ${TS.rebirths}! +⭐ ${got.toLocaleString()} points. Cash is now ×${1 + TS.rebirths}.`, 4000);
  }

  function spawn(it) {
    if (blocks.length > 450) return;
    blocks.push({ x: SLOTS[it.slot] + (Math.random() - .5) * 6, y: it.big ? 200 : 182, vy: 0, val: it.val, color: it.color, size: it.big ? 20 : 16, onBelt: false, ups: 0, shine: false, glow: false });
  }
  function tap() {
    if (tapCd > 0) return; tapCd = .12;
    const best = ITEMS.filter((i) => i.type === 'drop' && has(i.id)).sort((a, b) => b.val - a.val)[0];
    if (best) spawn(best);
  }

  /* ---------- loop ---------- */
  function update(dt) {
    time += dt; tapCd -= dt; furnaceFlash = Math.max(0, furnaceFlash - dt * 3);
    for (const it of ITEMS) {
      if (it.type !== 'drop' || !has(it.id)) continue;
      if (timers[it.id] == null) timers[it.id] = Math.random() * it.every;
      timers[it.id] -= dt;
      if (timers[it.id] <= 0) { timers[it.id] += it.every; spawn(it); }
    }
    const bs = beltSpeed(), ups = ITEMS.filter((i) => i.type === 'up' && has(i.id));
    for (const b of blocks) {
      if (!b.onBelt) { b.vy += 1400 * dt; b.y += b.vy * dt; if (b.y + b.size / 2 >= BELT_Y) { b.y = BELT_Y - b.size / 2; b.onBelt = true; } continue; }
      b.x += bs * dt;
      ups.forEach((u, k) => {
        const bit = 1 << ITEMS.indexOf(u);
        if (!(b.ups & bit) && b.x >= u.x) {
          b.ups |= bit; b.val *= u.mult;
          if (u.id === 'washer') b.shine = true; else if (u.id === 'painter') b.color = PAINTS[(Math.random() * PAINTS.length) | 0]; else b.glow = true;
        }
      });
      if (b.x >= BELT_X1) { b.dead = true; const v = b.val * payMult(); TS.cash += v; TS.total += v; payAcc += v; furnaceFlash = 1; }
    }
    blocks = blocks.filter((b) => !b.dead);
    payT -= dt;
    if (payT <= 0 && payAcc > 0) { floats.push({ x: 930 + (Math.random() - .5) * 30, y: 280, t: 1.1, txt: '+' + money(payAcc) }); payAcc = 0; payT = .3; }
    for (const f of floats) { f.y -= 45 * dt; f.t -= dt; }
    floats = floats.filter((f) => f.t > 0);
    for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 300 * dt; s.life -= dt; }
    sparks = sparks.filter((s) => s.life > 0);
  }

  function drawDropper(it, ghost) {
    const x = SLOTS[it.slot], big = it.big, w = big ? 64 : 50, h = big ? 78 : 62, y = 96;
    g.save();
    if (ghost) { g.globalAlpha = .5; g.setLineDash([6, 6]); g.strokeStyle = '#8a93ab'; g.lineWidth = 2; rr(g, x - w / 2, y, w, h, 10); g.stroke(); g.setLineDash([]); priceTag(x, y + h / 2, it.cost); g.restore(); return; }
    g.fillStyle = '#5b6178'; g.fillRect(x - 3, 60, 6, y - 60);
    g.fillStyle = '#ffffff'; g.strokeStyle = '#3c435a'; g.lineWidth = 3; rr(g, x - w / 2, y, w, h, 10); g.fill(); g.stroke();
    g.fillStyle = it.color; rr(g, x - w / 2 + 6, y + 8, w - 12, 14, 5); g.fill();
    g.fillStyle = '#3c435a'; g.beginPath(); g.moveTo(x - 14, y + h); g.lineTo(x + 14, y + h); g.lineTo(x + 7, y + h + 14); g.lineTo(x - 7, y + h + 14); g.closePath(); g.fill();
    g.fillStyle = '#16203d'; g.font = `700 ${big ? 15 : 13}px Fredoka, system-ui, sans-serif`; g.textAlign = 'center'; g.fillText(money(it.val), x, y + h - 14);
    g.restore();
  }
  function priceTag(x, y, cost) {
    const t = money(cost); g.font = '700 14px Fredoka, system-ui, sans-serif'; const tw = g.measureText(t).width + 16;
    g.globalAlpha = 1; g.fillStyle = '#ffb31a'; rr(g, x - tw / 2, y - 12, tw, 24, 12); g.fill(); g.fillStyle = '#16203d'; g.textAlign = 'center'; g.fillText(t, x, y + 5);
  }
  function drawUpgrader(it, ghost) {
    const x = it.x, top = BELT_Y - 92;
    g.save();
    if (ghost) { g.globalAlpha = .5; g.setLineDash([6, 6]); g.strokeStyle = '#8a93ab'; g.lineWidth = 2; rr(g, x - 24, top, 48, 92, 8); g.stroke(); g.setLineDash([]); priceTag(x, top - 16, it.cost); g.restore(); return; }
    g.fillStyle = it.color; g.globalAlpha = .16 + Math.sin(time * 5 + x) * .05; g.fillRect(x - 18, top + 14, 36, 78); g.globalAlpha = 1;
    g.fillStyle = '#3c435a'; g.fillRect(x - 24, top, 7, 92); g.fillRect(x + 17, top, 7, 92);
    g.fillStyle = it.color; rr(g, x - 28, top - 6, 56, 20, 6); g.fill();
    g.fillStyle = '#fff'; g.font = '700 12px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('×' + it.mult, x, top + 9);
    g.restore();
  }

  function draw() {
    const s = cv.width / W; g.setTransform(s, 0, 0, s, 0, 0);
    const walls = has('walls');
    if (walls) {
      g.fillStyle = '#f1e6d6'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(160,120,80,.18)'; g.lineWidth = 2;
      for (let y = 40; y < 470; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); const off = (y / 26) % 2 ? 0 : 30; for (let x = off; x < W; x += 60) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 26); g.stroke(); } }
      for (const wx of [150, 430, 710]) { g.fillStyle = '#cfe8ff'; rr(g, wx, 210, 110, 80, 8); g.fill(); g.strokeStyle = '#8b6b4a'; g.lineWidth = 5; g.stroke(); }
      g.fillStyle = '#8b6b4a'; g.fillRect(0, 0, W, 34); for (let x = 0; x < W; x += 80) { g.fillStyle = '#6f5238'; g.fillRect(x, 0, 12, 34); }
    } else {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#d4ecff'); gr.addColorStop(1, '#f3f9ff'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,.9)';
      for (const [cx, cy, r] of [[180, 70, 26], [215, 64, 32], [250, 74, 24], [690, 110, 22], [720, 100, 30], [752, 112, 20]]) { g.beginPath(); g.arc((cx + time * 8) % 1100 - 50, cy, r, 0, Math.PI * 2); g.fill(); }
    }
    g.fillStyle = '#d9d4c7'; g.fillRect(0, 470, W, 50); g.fillStyle = '#c9c3b3'; g.fillRect(0, 470, W, 6);

    const next = new Set(visibleNext().map((i) => i.id));
    if (TS.bought.some((id) => ITEMS.find((i) => i.id === id).type === 'drop')) { g.fillStyle = '#3c435a'; g.fillRect(50, 56, 620, 8); }
    for (const it of ITEMS) {
      if (it.type === 'drop' && (has(it.id) || next.has(it.id))) drawDropper(it, !has(it.id));
      if (it.type === 'up' && (has(it.id) || next.has(it.id))) drawUpgrader(it, !has(it.id));
    }

    // belt
    g.fillStyle = '#5b6178'; for (let x = 70; x < BELT_X1; x += 120) g.fillRect(x, BELT_Y + 26, 10, 470 - BELT_Y - 26);
    g.fillStyle = '#3c435a'; rr(g, BELT_X0, BELT_Y, BELT_X1 - BELT_X0 + 10, 26, 13); g.fill();
    g.save(); rr(g, BELT_X0 + 4, BELT_Y + 3, BELT_X1 - BELT_X0 + 2, 10, 5); g.clip();
    g.fillStyle = '#2b3350'; g.fillRect(BELT_X0, BELT_Y, BELT_X1 - BELT_X0 + 10, 14);
    g.fillStyle = 'rgba(255,255,255,.18)'; const off = (time * beltSpeed()) % 30; for (let x = BELT_X0 - 30 + off; x < BELT_X1 + 10; x += 30) g.fillRect(x, BELT_Y + 3, 10, 10);
    g.restore();

    // blocks
    for (const b of blocks) {
      const hs = b.size / 2;
      if (b.glow) { g.fillStyle = 'rgba(255,77,94,.25)'; rr(g, b.x - hs - 5, b.y - hs - 5, b.size + 10, b.size + 10, 8); g.fill(); }
      g.fillStyle = b.color; rr(g, b.x - hs, b.y - hs, b.size, b.size, 4); g.fill();
      g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(b.x - hs, b.y + hs - 4, b.size, 4);
      if (b.shine) { g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(b.x - hs + 3, b.y - hs + 3, 4, 4); }
    }

    // furnace
    const gold = has('furnace');
    g.fillStyle = gold ? '#f2c230' : '#5b6178'; rr(g, 890, 290, 100, 180, 12); g.fill();
    g.fillStyle = gold ? '#d9a514' : '#454b61'; rr(g, 900, 260, 80, 36, 8); g.fill();
    g.fillStyle = `rgba(255,${140 + furnaceFlash * 60},40,${.75 + furnaceFlash * .25})`; rr(g, 895, BELT_Y - 30, 70, 56, 10); g.fill();
    g.fillStyle = '#16203d'; g.font = '700 14px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(gold ? 'GOLD ×2' : 'FURNACE', 940, 450);
    if (!gold && next.has('furnace')) priceTag(940, 250, 250000);
    if (!walls && next.has('walls')) priceTag(500, 24, 600000);

    for (const f of floats) { g.globalAlpha = Math.min(1, f.t * 1.5); g.fillStyle = '#0b8f6e'; g.font = '700 20px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(f.txt, f.x, f.y); }
    g.globalAlpha = 1;
    for (const p of sparks) { g.globalAlpha = Math.max(0, p.life / .7); g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, 4, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  }

  function loop(t) {
    if (!L.isActive('s-tycoon')) { tsave(); raf = 0; return; }
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
    update(dt); draw();
    uiT -= dt; saveT -= dt;
    $('#ty-cash').textContent = money(TS.cash);
    if (uiT <= 0) { uiT = .25; { const r = rate(); $('#ty-rate').textContent = (r < 10 ? '$' + r.toFixed(1) : money(r)) + ' per second'; } refreshButtons(); }
    if (saveT <= 0) { saveT = 3; tsave(); }
  }

  function open() {
    tload();
    const away = Math.min(7200, (Date.now() - TS.last) / 1000);
    let offline = 0;
    if (away > 30) { offline = Math.floor(rate() * away * .25); TS.cash += offline; TS.total += offline; }
    blocks = []; floats = []; sparks = []; timers = {};
    show('s-tycoon'); refreshPoints(); renderShop(); tsave();
    requestAnimationFrame(() => { L.fit(cv); if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } });
    if (offline > 0) toast(`While you were away, your factory made ${money(offline)}`, 4200);
  }

  $('#ty-back').onclick = () => { tsave(); enterHub(); };
  $('#ty-tap').onclick = tap;
  $('#ty-stage').addEventListener('pointerdown', tap);
  addEventListener('resize', () => { if (L.isActive('s-tycoon')) L.fit(cv); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && TS && profile) tsave(); });

  L.addCard({ id: 'card-tycoon', emoji: '🧱', bg: '#fff2d9', title: 'Block Tycoon', desc: 'Build a block factory, grow your cash, and rebirth for points.', open });
  L.onHub(() => { tload(); L.setProg('card-tycoon', TS.rebirths ? `${TS.rebirths} rebirth${TS.rebirths > 1 ? 's' : ''}, ${money(TS.cash)} cash` : `${TS.bought.length} of ${ITEMS.length} built`); });
})();
