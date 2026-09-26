/* Café Rush: serve customers before they lose patience. */
(function () {
  'use strict';
  const L = LSPG, rr = L.rr;
  const W = 1000, H = 600, DAY_LEN = 90;
  const FOODS = [
    { id: 'coffee', icon: '☕', name: 'Coffee', price: 4, cook: 1.8, day: 1 },
    { id: 'donut', icon: '🍩', name: 'Donut', price: 3, cook: 0, day: 1 },
    { id: 'juice', icon: '🧃', name: 'Juice', price: 3, cook: 0, day: 1 },
    { id: 'cake', icon: '🍰', name: 'Cake', price: 5, cook: 0, day: 2 },
    { id: 'burger', icon: '🍔', name: 'Burger', price: 7, cook: 3, day: 3 },
    { id: 'icecream', icon: '🍦', name: 'Ice cream', price: 5, cook: 0, day: 4 },
  ];
  const UPG = [
    { id: 'fast', name: 'Fast Machines', icon: '⚡', desc: 'Coffee and burgers cook 15% faster per level' },
    { id: 'decor', name: 'Cozy Decor', icon: '🪴', desc: 'Customers wait 15% longer per level' },
    { id: 'tips', name: 'Tip Jar', icon: '🫙', desc: '+15% tips per level' },
  ];
  const COST = [200, 450, 800, 1300, 2000];
  const SLOTS = [220, 500, 780];
  const SKIN = ['#ffd9b3', '#f1c08f', '#d9a06b', '#b87a4b', '#8d5a36'];
  const DB = L.store('cafe', { day: 1, best: 0, served: 0, upg: { fast: 0, decor: 0, tips: 0 } });
  let S = null; const save = () => DB.save(S);
  const A = L.makeGame({
    key: 'cafe', title: 'Café Rush', emoji: '☕', cardBg: '#f5e6d8', grid: 'rp-games', bg: '#f3e7da', world: { w: W, h: H },
    desc: 'Run your own café. Make orders fast and earn tips.',
    tabs: [['play', 'Play'], ['upgrades', 'Upgrades']],
    hud: '<span class="hudpill" id="cf-day">Day 1</span><span class="hudpill" id="cf-time">1:30</span><span class="hudpill" id="cf-coins">💰 0</span>',
    help: 'Tap food to put it on your tray, then tap a customer to serve them', rotate: true,
    progress: () => { const s = DB.load(); return `Day ${s.day}, ${s.served} customers served`; },
  });
  const g = A.g;
  let G = null;

  const menu = () => FOODS.filter((f) => f.day <= G.day);
  const stations = () => FOODS.map((f, i) => ({ f, x: 90 + i * 150, y: 470, w: 120, h: 100, locked: f.day > G.day }));
  function start() {
    S = DB.load();
    G = { day: S.day, t: DAY_LEN, coins: 0, served: 0, missed: 0, tray: [], cust: [null, null, null], spawnT: 1, cooking: {}, parts: [], over: false };
    A.play(); A.run(step);
  }
  A.onAgain = start;

  function spawn() {
    const free = G.cust.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0); if (!free.length) return;
    const slot = free[(Math.random() * free.length) | 0], m = menu(), n = 1 + Math.floor(Math.random() * Math.min(3, 1 + G.day * 0.6));
    const order = Array.from({ length: n }, () => m[(Math.random() * m.length) | 0].id);
    const pat = Math.max(14, 26 - G.day * 1.5) * (1 + 0.15 * S.upg.decor);
    G.cust[slot] = { order, got: order.map(() => false), pat, max: pat, x: SLOTS[slot], y: 200, shirt: `hsl(${(Math.random() * 360) | 0},60%,62%)`, skin: SKIN[(Math.random() * 5) | 0], enter: 0, leave: 0, happy: null };
  }
  function tapStation(st) {
    if (st.locked) return;
    const f = st.f, c = G.cooking[f.id];
    if (f.cook) {
      if (!c) { G.cooking[f.id] = { t: f.cook * Math.pow(0.85, S.upg.fast), max: f.cook * Math.pow(0.85, S.upg.fast) }; return; }
      if (c.t > 0) return;
      if (G.tray.length >= 4) { toast('Your tray is full'); return; }
      G.tray.push(f.id); delete G.cooking[f.id];
    } else { if (G.tray.length >= 4) { toast('Your tray is full'); return; } G.tray.push(f.id); }
  }
  function serve(i) {
    const c = G.cust[i]; if (!c || c.leave) return;
    let any = false;
    c.order.forEach((id, k) => { if (c.got[k]) return; const ti = G.tray.indexOf(id); if (ti >= 0) { G.tray.splice(ti, 1); c.got[k] = true; any = true; } });
    if (!any) { c.shake = 0.3; return; }
    if (c.got.every(Boolean)) {
      const price = c.order.reduce((a, id) => a + FOODS.find((f) => f.id === id).price, 0), tip = Math.round(price * (c.pat / c.max) * 0.6 * (1 + 0.15 * S.upg.tips));
      G.coins += price + tip; G.served++; c.leave = 1; c.happy = true;
      G.parts.push({ x: c.x, y: c.y - 110, life: 1.2, text: `+💰${price + tip}` });
    }
  }
  function endDay() {
    G.over = true;
    const total = G.served + G.missed, ratio = total ? G.served / total : 0, stars = ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : ratio >= 0.5 ? 1 : 0;
    const got = Wallet.add(G.coins);
    S.served += G.served; S.best = Math.max(S.best, G.coins); if (stars >= 1) S.day = Math.max(S.day, G.day + 1); save();
    const next = FOODS.find((f) => f.day === G.day + 1);
    A.end(stars ? `Day ${G.day} done! ${'⭐'.repeat(stars)}` : 'Tough day...', got, `You served ${G.served} of ${total} customers.${stars ? (next ? ` Tomorrow ${next.name.toLowerCase()} is on the menu!` : ' Keep it up!') : ' Serve at least half to reach the next day.'}`,
      [['again', stars ? `Start day ${S.day}` : 'Try again', 'primary'], ['shop', 'Upgrades', 'ghost', () => A.openLobby('upgrades')], ['lobby', 'Back', 'ghost']]);
  }

  A.cv.addEventListener('pointerdown', (e) => {
    if (!G || G.over || A.paused || !LSPG.isActive('s-cafe')) return;
    const p = A.toWorld(e);
    for (const st of stations()) if (p.x > st.x && p.x < st.x + st.w && p.y > st.y && p.y < st.y + st.h) return tapStation(st);
    if (p.x > 870 && p.y > 330 && p.y < 420) { G.tray = []; return; }
    G.cust.forEach((c, i) => { if (c && Math.abs(p.x - c.x) < 90 && p.y > 60 && p.y < 330) serve(i); });
  });
  A.onKey = (k) => { if (!G || G.over || A.paused) return; const n = '123456'.indexOf(k.replace('Digit', '')); if (k.startsWith('Digit') && n >= 0) tapStation(stations()[n]); if (k === 'KeyQ') serve(0); if (k === 'KeyW') serve(1); if (k === 'KeyE') serve(2); if (k === 'KeyX') G.tray = []; };

  function step(dt) {
    if (dt > 0 && !G.over) {
      G.t -= dt; if (G.t <= 0) { G.t = 0; G.cust.forEach((c) => { if (c && !c.leave) G.missed++; }); endDay(); }
      G.spawnT -= dt; if (G.spawnT <= 0 && G.t > 6) { spawn(); G.spawnT = Math.max(2.2, 6 - G.day * 0.5) + Math.random() * 2.5; }
      for (const k in G.cooking) G.cooking[k].t = Math.max(0, G.cooking[k].t - dt);
      G.cust.forEach((c, i) => {
        if (!c) return; c.enter = Math.min(1, c.enter + dt * 2.5); if (c.shake) c.shake = Math.max(0, c.shake - dt);
        if (c.leave) { c.leave -= dt * 1.5; if (c.leave <= 0) G.cust[i] = null; return; }
        c.pat -= dt; if (c.pat <= 0) { c.leave = 1; c.happy = false; G.missed++; }
      });
      for (const q of G.parts) { q.y -= 40 * dt; q.life -= dt; } G.parts = G.parts.filter((q) => q.life > 0);
    }
    draw();
    $('#cf-day').textContent = `Day ${G.day}`; $('#cf-time').textContent = `⏱️ ${Math.floor(G.t / 60)}:${String(Math.floor(G.t % 60)).padStart(2, '0')}`; $('#cf-coins').textContent = `💰 ${G.coins}`;
  }
  function draw() {
    A.begin();
    g.fillStyle = '#f9efe3'; g.fillRect(0, 0, W, 290);
    g.fillStyle = '#f3e1cd'; for (let x = 0; x < W; x += 50) g.fillRect(x, 0, 25, 290);
    g.fillStyle = '#6f5238'; rr(g, 330, 16, 340, 40, 12); g.fill(); g.fillStyle = '#fff'; g.font = '700 22px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('☕ LSP Café', 500, 44);
    // customers
    G.cust.forEach((c) => {
      if (!c) return;
      const a = c.leave ? Math.max(0, c.leave) : c.enter, x = c.x + (c.shake ? Math.sin(c.shake * 60) * 6 : 0), y = c.y + (1 - a) * 40;
      g.globalAlpha = a;
      g.fillStyle = c.shirt; rr(g, x - 38, y - 10, 76, 90, 24); g.fill();
      g.fillStyle = c.skin; g.beginPath(); g.arc(x, y - 40, 32, 0, 7); g.fill();
      g.fillStyle = '#16203d'; g.beginPath(); g.arc(x - 11, y - 44, 4, 0, 7); g.arc(x + 11, y - 44, 4, 0, 7); g.fill();
      const mood = c.happy === true ? 1 : c.happy === false ? -1 : c.pat / c.max > 0.4 ? 0.5 : -0.5;
      g.strokeStyle = '#16203d'; g.lineWidth = 3; g.beginPath(); if (mood > 0) g.arc(x, y - 34, 10, 0.2, Math.PI - 0.2); else g.arc(x, y - 20, 10, Math.PI + 0.3, -0.3); g.stroke();
      if (!c.leave) {
        const bw = c.order.length * 52 + 16; g.fillStyle = '#fff'; g.strokeStyle = '#dfe5f1'; g.lineWidth = 2; rr(g, x - bw / 2, y - 150, bw, 60, 16); g.fill(); g.stroke();
        c.order.forEach((id, k) => { const ix = x - bw / 2 + 34 + k * 52; g.globalAlpha = a * (c.got[k] ? 0.3 : 1); g.font = '32px system-ui, sans-serif'; g.fillText(FOODS.find((f) => f.id === id).icon, ix, y - 108); g.globalAlpha = a; if (c.got[k]) { g.fillStyle = '#14c79a'; g.font = '800 26px Nunito, system-ui, sans-serif'; g.fillText('✓', ix + 10, y - 100); } });
        const pr = c.pat / c.max; g.fillStyle = '#e3e8f2'; rr(g, x - 50, y - 86, 100, 10, 5); g.fill(); g.fillStyle = pr > 0.5 ? '#14c79a' : pr > 0.25 ? '#ffb31a' : '#ff4d5e'; rr(g, x - 50, y - 86, 100 * pr, 10, 5); g.fill();
      } else { g.font = '34px system-ui, sans-serif'; g.fillText(c.happy ? '❤️' : '😠', x + 40, y - 70); }
      g.globalAlpha = 1;
    });
    // counter
    g.fillStyle = '#b8835a'; g.fillRect(0, 290, W, 40); g.fillStyle = '#9a6a45'; g.fillRect(0, 322, W, 8);
    g.fillStyle = '#efe4d6'; g.fillRect(0, 330, W, H - 330);
    // tray
    g.fillStyle = '#c9cfdb'; rr(g, 330, 345, 340, 80, 20); g.fill(); g.fillStyle = '#e3e8f2'; rr(g, 340, 355, 320, 60, 14); g.fill();
    g.font = '36px system-ui, sans-serif'; g.textAlign = 'center';
    G.tray.forEach((id, i) => g.fillText(FOODS.find((f) => f.id === id).icon, 385 + i * 76, 398));
    if (!G.tray.length) { g.fillStyle = '#8a93ab'; g.font = '800 16px Nunito, system-ui, sans-serif'; g.fillText('Your tray', 500, 392); }
    g.fillStyle = '#ffe0e3'; rr(g, 880, 345, 90, 80, 16); g.fill(); g.font = '30px system-ui, sans-serif'; g.fillText('🗑️', 925, 390); g.fillStyle = '#ff4d5e'; g.font = '800 13px Nunito, system-ui, sans-serif'; g.fillText('Clear', 925, 414);
    // stations
    stations().forEach((st, i) => {
      g.fillStyle = st.locked ? '#e3e8f2' : '#ffffff'; g.strokeStyle = '#d5dcea'; g.lineWidth = 3; rr(g, st.x, st.y, st.w, st.h, 18); g.fill(); g.stroke();
      g.globalAlpha = st.locked ? 0.35 : 1; g.font = '44px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(st.f.icon, st.x + st.w / 2, st.y + 58); g.globalAlpha = 1;
      g.fillStyle = '#66708f'; g.font = '800 13px Nunito, system-ui, sans-serif'; g.fillText(st.locked ? `🔒 Day ${st.f.day}` : `${st.f.name} (${i + 1})`, st.x + st.w / 2, st.y + 86);
      const ck = G.cooking[st.f.id];
      if (ck) { g.fillStyle = 'rgba(255,255,255,.85)'; rr(g, st.x + 10, st.y - 18, st.w - 20, 14, 7); g.fill(); g.fillStyle = ck.t > 0 ? '#ffb31a' : '#14c79a'; rr(g, st.x + 10, st.y - 18, (st.w - 20) * (1 - ck.t / ck.max), 14, 7); g.fill(); if (ck.t <= 0) { g.fillStyle = '#0b8f6e'; g.font = '800 13px Nunito, system-ui, sans-serif'; g.fillText('Ready! Tap', st.x + st.w / 2, st.y - 24); } }
      else if (st.f.cook && !st.locked) { g.fillStyle = '#8a93ab'; g.font = '800 12px Nunito, system-ui, sans-serif'; g.fillText('Tap to cook', st.x + st.w / 2, st.y - 8); }
    });
    for (const q of G.parts) { g.globalAlpha = Math.min(1, q.life); g.fillStyle = '#e89a00'; g.font = '700 24px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(q.text, q.x, q.y); }
    g.globalAlpha = 1;
  }

  A.onTab = (t) => {
    S = DB.load(); const re = () => A.onTab(t);
    if (t === 'play') {
      const today = FOODS.filter((f) => f.day <= S.day).map((f) => f.icon).join(' ');
      A.panel('play').innerHTML = L.playCard('☕', `Day ${S.day} at the café`, 'Customers show what they want in a bubble. Tap food to put it on your tray (coffee and burgers need cooking first), then tap the customer. Faster service means bigger tips. Every coin you earn becomes a point.', [`🍽️ Menu: ${today}`, `🙂 ${S.served} served`, `🏆 Best day 💰${S.best}`], 'cf-go', `Open café (day ${S.day})`);
      $('#cf-go').onclick = start;
    } else { A.panel('upgrades').innerHTML = `<div class="items">${L.upgradeCards(UPG, S.upg, COST, 5, 'data-cfu')}</div>`; L.bindUpg('data-cfu', S, COST, save, re); }
  };
})();
