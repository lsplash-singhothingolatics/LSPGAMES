/* Kart Blitz: LSPGames racing game. Uses the shared LSPGames wallet (Wallet) from index.html. */
(function () {
  'use strict';

  const CARS = [
    { id: 'starter', name: 'Starter Kart', icon: '🚗', top: 1, acc: 1, turn: 1, cost: 0, color: '#2f6bff', desc: 'Easy to drive. Good for learning the tracks.' },
    { id: 'street', name: 'Street GT', icon: '🏎️', top: 1.1, acc: 1.12, turn: 1.06, cost: 1500, color: '#14c79a', desc: 'Faster and quicker off the line.' },
    { id: 'hyper', name: 'Hyper X', icon: '🚀', top: 1.22, acc: 1.25, turn: 1.12, cost: 4000, color: '#ff4d5e', desc: 'The fastest car on LSPGames.' },
  ];
  const KUPG = [
    { id: 'engine', name: 'Engine', icon: '⚙️', desc: '+6% top speed per level' },
    { id: 'accel', name: 'Turbo', icon: '💨', desc: '+10% acceleration per level' },
    { id: 'grip', name: 'Tires', icon: '🛞', desc: '+8% steering per level' },
    { id: 'nitro', name: 'Nitro tank', icon: '🔥', desc: 'Nitro refills 20% faster per level' },
  ];
  const KUPG_COST = [200, 400, 700, 1100, 1600], KMAX = 5;
  const RACES = [
    { name: 'Sunny Loop', seed: 3, level: 'Easy' },
    { name: 'Harbor Bends', seed: 17, level: 'Medium' },
    { name: 'Canyon Curves', seed: 29, level: 'Hard' },
    { name: 'Neon Circuit', seed: 41, level: 'Expert' },
    { name: 'Glacier Run', seed: 53, level: 'Master' },
    { name: 'Grand Final', seed: 67, level: 'Legend' },
  ];
  const REWARD = [600, 380, 250, 160, 100, 60];
  const LAPS = 3, ROAD = 170, WALL = ROAD / 2 + 110, BASE_TOP = 470, BASE_ACC = 270;
  const BOT_COLORS = ['#ff8a3d', '#b04dff', '#ffb31a', '#ff4d8b', '#16203d'];
  const BOT_NAMES = ['Blaze', 'Nova', 'Turbo', 'Pixel', 'Rocket'];
  const TAU = Math.PI * 2;
  const ord = (n) => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  const kclamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function krng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function krr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  /* ---------- save ---------- */
  let KS = null;
  function kload() {
    KS = Object.assign({ owned: ['starter'], car: 'starter', unlocked: 1, best: {} }, store.get('lsp_kart_' + profile.email, {}));
    KS.upg = Object.assign({ engine: 0, accel: 0, grip: 0, nitro: 0 }, KS.upg || {});
  }
  function ksave() { store.set('lsp_kart_' + profile.email, KS); }
  const carOf = () => CARS.find((c) => c.id === KS.car) || CARS[0];

  /* ---------- tracks ---------- */
  const trackCache = {};
  function buildTrack(ri) {
    if (trackCache[ri]) return trackCache[ri];
    const R = krng(RACES[ri].seed * 7919 + 13), tw = ri;
    let a1 = 0.10 + tw * 0.025 + R() * 0.04, a2 = 0.04 + tw * 0.012 + R() * 0.03;
    const k1 = 2 + Math.floor(R() * 2), k2 = k1 + 2 + Math.floor(R() * 2), p1 = R() * TAU, p2 = R() * TAU;
    const cx = 1700, cy = 1200, rx = 1350, ry = 900;
    let pts, N, step;
    for (let attempt = 0; attempt < 12; attempt++) {
      const raw = [], M = 1440;
      for (let i = 0; i < M; i++) {
        const t = (i / M) * TAU, r = 1 + a1 * Math.sin(k1 * t + p1) + a2 * Math.sin(k2 * t + p2);
        raw.push([cx + rx * r * Math.cos(t), cy + ry * r * Math.sin(t)]);
      }
      const segs = []; let total = 0;
      for (let i = 0; i < M; i++) { const a = raw[i], b = raw[(i + 1) % M], l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push(l); total += l; }
      N = Math.round(total / 10); step = total / N; pts = [];
      let si = 0, acc = 0;
      for (let j = 0; j < N; j++) {
        const d = j * step;
        while (si < M - 1 && acc + segs[si] < d) { acc += segs[si]; si++; }
        const t = (d - acc) / segs[si], a = raw[si], b = raw[(si + 1) % M];
        pts.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t });
      }
      for (let j = 0; j < N; j++) {
        const a = pts[(j - 1 + N) % N], b = pts[(j + 1) % N], dir = Math.atan2(b.y - a.y, b.x - a.x);
        pts[j].dir = dir; pts[j].nx = -Math.sin(dir); pts[j].ny = Math.cos(dir);
      }
      // make sure no corner is so tight that the road folds over itself
      let minR = 1e9;
      for (let j = 0; j < N; j += 2) { const da = Math.abs(angDiff(pts[(j + 2) % N].dir, pts[j].dir)); if (da > 1e-6) minR = Math.min(minR, (2 * step) / da); }
      if (minR > ROAD * 0.75) break;
      a1 *= 0.93; a2 *= 0.85;
    }
    const path = new Path2D();
    path.moveTo(pts[0].x, pts[0].y);
    for (let j = 1; j < N; j++) path.lineTo(pts[j].x, pts[j].y);
    path.closePath();
    // decoration: trees and flowers off the track
    const TR = krng(RACES[ri].seed * 31 + 5), trees = [];
    for (let i = 0; i < 260 && trees.length < 150; i++) {
      const x = 120 + TR() * 3160, y = 120 + TR() * 2160;
      let near = 1e9; for (let j = 0; j < N; j += 4) { const p = pts[j]; near = Math.min(near, Math.hypot(p.x - x, p.y - y)); }
      if (near > WALL + 50) trees.push({ x, y, r: 18 + TR() * 22, flower: TR() < 0.25 });
    }
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
    const T = { pts, N, step, path, trees, bb: { minX, minY, maxX, maxY } };
    trackCache[ri] = T;
    return T;
  }

  /* ---------- race state ---------- */
  const kcv = $('#kcv'), kg = kcv.getContext('2d');
  let RACE = null, kraf = 0, klast = 0, ktouch = false;
  const kk = {}, kin = { left: false, right: false, gas: false, brake: false, nitro: false };
  const cam = { x: 0, y: 0, z: 1 };

  function makeCar(T, gridIdx, isBot, i) {
    const row = Math.floor(gridIdx / 2), idx = (T.N - 8 - row * 9 + T.N) % T.N, p = T.pts[idx], side = gridIdx % 2 ? 38 : -38;
    return { x: p.x + p.nx * side, y: p.y + p.ny * side, ang: p.dir, v: 0, idx, total: idx - T.N, nitro: 0.35, isBot, finished: false, finishTime: 0, boost: false, offroad: false, lane: side, laneTarget: side, laneT: 2 + Math.random() * 2, nitroOn: false, name: isBot ? BOT_NAMES[i] : 'You', color: isBot ? BOT_COLORS[i] : carOf().color };
  }

  function startRace(ri) {
    kload();
    const T = buildTrack(ri), car = carOf();
    const cars = [];
    const base = 0.84 + ri * 0.05;
    for (let i = 0; i < 5; i++) {
      const b = makeCar(T, i, true, i);
      b.skill = base + (2 - i) * 0.025;
      b.top = BASE_TOP * b.skill; b.acc = BASE_ACC * (0.92 + 0.4 * (b.skill - 0.84)); b.turn = 2.6; b.refill = 0.05;
      cars.push(b);
    }
    const P = makeCar(T, 5, false, 0);
    P.top = BASE_TOP * car.top * (1 + 0.06 * KS.upg.engine);
    P.acc = BASE_ACC * car.acc * (1 + 0.1 * KS.upg.accel);
    P.turn = 2.5 * car.turn * (1 + 0.08 * KS.upg.grip);
    P.refill = 0.05 * (1 + 0.2 * KS.upg.nitro);
    cars.push(P);
    RACE = { ri, T, cars, P, count: 3.2, time: 0, finishOrder: [], over: false, paused: false, parts: [], endT: 0 };
    cam.x = P.x; cam.y = P.y;
    ktouch = matchMedia('(pointer: coarse)').matches;
    $('#s-race').classList.toggle('touch', ktouch);
    closeK(); show('s-race'); kfit();
    cancelAnimationFrame(kraf); klast = performance.now(); kraf = requestAnimationFrame(kloop);
  }

  function kfit() {
    const r = kcv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    kcv.width = Math.max(1, r.width * d); kcv.height = Math.max(1, r.height * d);
    cam.base = kclamp(Math.min(r.width / 1100, r.height / 680), 0.42, 1.05) * d; cam.d = d;
    $('#s-race').classList.toggle('portrait', innerHeight > innerWidth);
  }
  addEventListener('resize', () => { if ($('#s-race').classList.contains('active')) kfit(); if ($('#s-hub').classList.contains('active')) drawKartArt(); });

  function kloop(t) {
    kraf = requestAnimationFrame(kloop);
    const dt = Math.min(0.033, (t - klast) / 1000 || 0); klast = t;
    if (RACE && !RACE.paused) kupdate(dt);
    kdraw(); khud();
  }

  function locate(c, T) {
    let best = c.idx, bd = 1e18;
    for (let o = -25; o <= 25; o++) {
      const j = (c.idx + o + T.N) % T.N, p = T.pts[j], d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
      if (d < bd) { bd = d; best = j; }
    }
    let delta = best - c.idx;
    if (delta < -T.N / 2) delta += T.N; if (delta > T.N / 2) delta -= T.N;
    c.total += delta; c.idx = best;
  }

  function physics(c, inp, dt, T) {
    locate(c, T);
    let p = T.pts[c.idx], off = (c.x - p.x) * p.nx + (c.y - p.y) * p.ny;
    c.offroad = Math.abs(off) > ROAD / 2;
    let top = c.top * (c.offroad ? 0.5 : 1);
    const boosting = inp.nitro && c.nitro > 0.02 && inp.gas;
    if (boosting) { top *= 1.35; c.nitro = Math.max(0, c.nitro - 0.38 * dt); } else c.nitro = Math.min(1, c.nitro + c.refill * dt);
    c.boost = boosting;
    if (inp.gas) c.v += c.acc * (boosting ? 1.6 : 1) * dt;
    if (inp.brake) c.v -= (c.v > 0 ? 540 : 220) * dt;
    if (!inp.gas && !inp.brake) c.v -= c.v * 0.9 * dt;
    if (c.v > top) c.v = Math.max(top, c.v - (c.offroad ? 650 : 320) * dt);
    if (c.v < -150) c.v = -150;
    const sf = kclamp(c.v / 140, -1, 1), hs = 1 - 0.35 * Math.min(1, Math.abs(c.v) / c.top);
    c.ang += inp.steer * c.turn * sf * hs * dt;
    c.x += Math.cos(c.ang) * c.v * dt; c.y += Math.sin(c.ang) * c.v * dt;
    off = (c.x - p.x) * p.nx + (c.y - p.y) * p.ny;
    if (Math.abs(off) > WALL) {
      const s = Math.sign(off), along = (c.x - p.x) * Math.cos(p.dir) + (c.y - p.y) * Math.sin(p.dir);
      c.x = p.x + p.nx * s * WALL + Math.cos(p.dir) * along; c.y = p.y + p.ny * s * WALL + Math.sin(p.dir) * along;
      c.v *= 0.93;
    }
    if (c.offroad && Math.abs(c.v) > 60 && Math.random() < 0.5) puff(c.x - Math.cos(c.ang) * 20, c.y - Math.sin(c.ang) * 20, '#b9a27a');
    if (c.boost && Math.random() < 0.8) puff(c.x - Math.cos(c.ang) * 26, c.y - Math.sin(c.ang) * 26, '#ffb31a');
  }

  function botInput(b, T, P, ri) {
    b.laneT -= 1 / 60;
    if (b.laneT <= 0) { b.laneTarget = (Math.random() - 0.5) * ROAD * 0.55; b.laneT = 2 + Math.random() * 3; }
    b.lane += (b.laneTarget - b.lane) * 0.015;
    const la = Math.round(10 + Math.abs(b.v) / 28), t = T.pts[(b.idx + la) % T.N];
    const want = Math.atan2(t.y + t.ny * b.lane - b.y, t.x + t.nx * b.lane - b.x), d = angDiff(want, b.ang);
    let curv = 0; const d0 = T.pts[b.idx].dir;
    for (let j = 8; j <= 56; j += 8) curv = Math.max(curv, Math.abs(angDiff(T.pts[(b.idx + j) % T.N].dir, d0)));
    let target = b.top * (1 - Math.min(1, curv / 1.3) * 0.42);
    if (b !== P) {
      const gap = (b.total - P.total) / T.N;
      if (gap > 0.35) target *= 0.93; else if (gap < -0.35) target *= 1.06;
      if (ri >= 2) { if (!b.nitroOn && b.nitro > 0.7 && curv < 0.25 && Math.random() < 0.01) b.nitroOn = true; if (b.nitroOn && (b.nitro < 0.15 || curv > 0.5)) b.nitroOn = false; }
    }
    return { gas: b.v < target, brake: b.v > target + 60, steer: kclamp(d * 2.5, -1, 1), nitro: b.nitroOn };
  }

  function kupdate(dt) {
    const R = RACE, T = R.T, P = R.P;
    for (const q of R.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    R.parts = R.parts.filter((q) => q.life > 0);
    if (R.count > -1) R.count -= dt;
    if (R.over) return;
    const go = R.count <= 0;
    if (go && !P.finished) R.time += dt;
    for (const c of R.cars) {
      let inp;
      if (!go) inp = { gas: false, brake: false, steer: 0, nitro: false };
      else if (c.isBot || c.finished) inp = botInput(c, T, P, R.ri);
      else {
        const left = kk.ArrowLeft || kk.KeyA || kin.left, right = kk.ArrowRight || kk.KeyD || kin.right;
        inp = { gas: !!(kk.ArrowUp || kk.KeyW || kin.gas), brake: !!(kk.ArrowDown || kk.KeyS || kin.brake), steer: (right ? 1 : 0) - (left ? 1 : 0), nitro: !!(kk.ShiftLeft || kk.ShiftRight || kk.Space || kin.nitro) };
      }
      physics(c, inp, dt, T);
      if (!c.finished && c.total >= LAPS * T.N) { c.finished = true; c.finishTime = R.time; R.finishOrder.push(c); if (c === P) finishRace(); }
    }
    // car to car bumps
    for (let i = 0; i < R.cars.length; i++) for (let j = i + 1; j < R.cars.length; j++) {
      const a = R.cars[i], b = R.cars[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, o = 34 - d;
      if (o > 0) { a.x -= (dx / d) * o / 2; a.y -= (dy / d) * o / 2; b.x += (dx / d) * o / 2; b.y += (dy / d) * o / 2; a.v *= 0.99; b.v *= 0.99; }
    }
  }

  function standings() {
    const R = RACE;
    const rest = R.cars.filter((c) => !c.finished).sort((a, b) => b.total - a.total);
    return R.finishOrder.concat(rest);
  }

  function puff(x, y, color) { RACE.parts.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 0.45, max: 0.45, color, size: 4 + Math.random() * 5 }); }

  function finishRace() {
    const R = RACE; R.over = true;
    const place = R.finishOrder.indexOf(R.P) + 1;
    const pts = Wallet.add(Math.round((REWARD[place - 1] * (1 + 0.6 * R.ri)) / 10) * 10);
    const prevBest = KS.best[R.ri];
    if (!prevBest || place < prevBest) KS.best[R.ri] = place;
    let unlockedNew = false;
    if (place <= 3 && R.ri + 2 > KS.unlocked && R.ri + 1 < RACES.length) { KS.unlocked = R.ri + 2; unlockedNew = true; }
    ksave();
    setTimeout(() => {
      // include bots still driving, ordered by position
      const list = standings().map((c, i) => `<li class="${c === R.P ? 'me' : ''}"><span>${ord(i + 1)} ${c.name}</span><span>${c.finished ? fmt(c.finishTime) : 'racing'}</span></li>`).join('');
      const title = place === 1 ? (R.ri === RACES.length - 1 ? 'Champion of Kart Blitz!' : 'You won!') : `You finished ${ord(place)}`;
      const hasNext = R.ri + 1 < RACES.length && KS.unlocked >= R.ri + 2;
      openK(`<h2>${title}</h2><p class="big">⭐ +${pts.toLocaleString()}</p>
        <p class="muted">${place <= 3 ? (unlockedNew ? RACES[R.ri + 1].name + ' is now unlocked.' : 'Nice driving.') : 'Finish in the top 3 to unlock the next track. Upgrades help.'}</p>
        <ol class="standings">${list}</ol>
        <div class="modal-actions">${hasNext ? '<button class="btn primary" data-ka="next">Next race</button>' : ''}
        <button class="btn ${hasNext ? 'ghost' : 'primary'}" data-ka="again">Race again</button>
        <button class="btn ghost" data-ka="garage">Upgrade car</button>
        <button class="btn ghost" data-ka="lobby">Back to races</button></div>`);
    }, 1200);
  }

  function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; }

  /* ---------- drawing ---------- */
  function drawTrack(g, T, detail) {
    g.fillStyle = '#d9f0cc'; g.fillRect(-2000, -2000, 7400, 6400);
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = '#c6e6b3'; g.lineWidth = WALL * 2 + 30; g.stroke(T.path);
    g.strokeStyle = '#ffffff'; g.lineWidth = ROAD + 22; g.stroke(T.path);
    if (detail) { g.strokeStyle = '#ff4d5e'; g.setLineDash([26, 26]); g.lineWidth = ROAD + 22; g.stroke(T.path); g.setLineDash([]); }
    g.strokeStyle = '#8a93a6'; g.lineWidth = ROAD; g.stroke(T.path);
    if (detail) { g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 4; g.setLineDash([34, 34]); g.stroke(T.path); g.setLineDash([]); }
    // start/finish line
    const p = T.pts[0];
    g.save(); g.translate(p.x, p.y); g.rotate(p.dir);
    const sq = ROAD / 10;
    for (let i = 0; i < 10; i++) for (let k = 0; k < 2; k++) { g.fillStyle = (i + k) % 2 ? '#16203d' : '#ffffff'; g.fillRect(k * sq - sq, -ROAD / 2 + i * sq, sq, sq); }
    g.restore();
  }
  function drawTrees(g, T, vx0, vy0, vx1, vy1) {
    for (const t of T.trees) {
      if (t.x < vx0 - 60 || t.x > vx1 + 60 || t.y < vy0 - 60 || t.y > vy1 + 60) continue;
      if (t.flower) { g.fillStyle = '#ff8fb1'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(t.x + Math.cos(i * 1.26) * 8, t.y + Math.sin(i * 1.26) * 8, 6, 0, TAU); g.fill(); } g.fillStyle = '#ffd24d'; g.beginPath(); g.arc(t.x, t.y, 5, 0, TAU); g.fill(); continue; }
      g.fillStyle = 'rgba(22,32,61,.12)'; g.beginPath(); g.ellipse(t.x + 6, t.y + 8, t.r, t.r * 0.8, 0, 0, TAU); g.fill();
      g.fillStyle = '#5cc27a'; g.beginPath(); g.arc(t.x, t.y, t.r, 0, TAU); g.fill();
      g.fillStyle = '#7fd896'; g.beginPath(); g.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.5, 0, TAU); g.fill();
    }
  }
  function drawCar(g, c, me) {
    g.save(); g.translate(c.x, c.y); g.rotate(c.ang);
    g.fillStyle = 'rgba(22,32,61,.18)'; krr(g, -20, -9, 46, 26, 8); g.fill();
    g.fillStyle = '#16203d';
    g.fillRect(-17, -15, 11, 5); g.fillRect(8, -15, 11, 5); g.fillRect(-17, 10, 11, 5); g.fillRect(8, 10, 11, 5);
    g.fillStyle = c.color; krr(g, -23, -12, 46, 24, 8); g.fill();
    g.strokeStyle = 'rgba(22,32,61,.45)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.88)'; krr(g, 2, -9, 10, 18, 3); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(-20, -2.5, 18, 5);
    if (c.boost) { g.fillStyle = '#ffb31a'; g.beginPath(); g.moveTo(-23, -6); g.lineTo(-40 - Math.random() * 12, 0); g.lineTo(-23, 6); g.fill(); }
    g.restore();
    g.font = '800 15px Nunito, system-ui, sans-serif'; g.textAlign = 'center';
    if (me) { g.fillStyle = '#2f6bff'; g.beginPath(); g.moveTo(c.x, c.y - 30); g.lineTo(c.x - 8, c.y - 42); g.lineTo(c.x + 8, c.y - 42); g.fill(); }
    else { g.fillStyle = 'rgba(22,32,61,.7)'; g.fillText(c.name, c.x, c.y - 28); }
  }
  function kdraw() {
    const g = kg, R = RACE; g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#d9f0cc'; g.fillRect(0, 0, kcv.width, kcv.height);
    if (!R) return;
    const P = R.P, sp = Math.abs(P.v) / P.top;
    const tx = P.x + Math.cos(P.ang) * P.v * 0.35, ty = P.y + Math.sin(P.ang) * P.v * 0.35;
    cam.x += (tx - cam.x) * 0.12; cam.y += (ty - cam.y) * 0.12;
    const z = cam.base * (1 - 0.12 * Math.min(1, sp));
    g.setTransform(z, 0, 0, z, kcv.width / 2 - cam.x * z, kcv.height / 2 - cam.y * z);
    drawTrack(g, R.T, true);
    const hw = kcv.width / 2 / z, hh = kcv.height / 2 / z;
    for (const q of R.parts) { g.globalAlpha = Math.max(0, q.life / q.max) * 0.7; g.fillStyle = q.color; g.beginPath(); g.arc(q.x, q.y, q.size, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    for (const c of R.cars) if (c !== P) drawCar(g, c, false);
    drawCar(g, P, true);
    drawTrees(g, R.T, cam.x - hw, cam.y - hh, cam.x + hw, cam.y + hh);
    // minimap
    g.setTransform(1, 0, 0, 1, 0, 0);
    const d = cam.d, mw = 170 * d, mh = 118 * d, mx = kcv.width - mw - 14 * d, my = (ktouch ? 64 : 12) * d + (innerWidth < 640 ? 50 * d : 0);
    const bb = R.T.bb, ms = Math.min((mw - 20 * d) / (bb.maxX - bb.minX), (mh - 20 * d) / (bb.maxY - bb.minY));
    g.fillStyle = 'rgba(255,255,255,.9)'; krr(g, mx, my, mw, mh, 12 * d); g.fill();
    g.save(); g.translate(mx + mw / 2 - ((bb.minX + bb.maxX) / 2) * ms, my + mh / 2 - ((bb.minY + bb.maxY) / 2) * ms); g.scale(ms, ms);
    g.strokeStyle = '#8a93a6'; g.lineWidth = 7 / ms * d; g.lineJoin = 'round'; g.stroke(R.T.path);
    for (const c of R.cars) { g.fillStyle = c.color; g.beginPath(); g.arc(c.x, c.y, (c === P ? 6 : 4.5) / ms * d, 0, TAU); g.fill(); }
    g.restore();
    // countdown
    if (R.count > -0.8) {
      const txt = R.count > 0 ? String(Math.ceil(R.count)) : 'GO!';
      g.fillStyle = R.count > 0 ? '#16203d' : '#14c79a';
      g.font = `700 ${110 * d}px Fredoka, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10 * d; g.strokeStyle = '#ffffff'; g.strokeText(txt, kcv.width / 2, kcv.height / 2 - 40 * d); g.fillText(txt, kcv.width / 2, kcv.height / 2 - 40 * d);
      g.textBaseline = 'alphabetic';
    }
  }
  function khud() {
    if (!RACE) return;
    const R = RACE, P = R.P, list = standings(), pos = list.indexOf(P) + 1;
    $('#k-pos').textContent = `🏁 ${ord(pos)} / ${R.cars.length}`;
    $('#k-lap').textContent = `Lap ${kclamp(Math.floor(P.total / R.T.N) + 1, 1, LAPS)} / ${LAPS}`;
    $('#k-time').textContent = fmt(R.time);
    $('#k-speed').textContent = Math.round(Math.abs(P.v) * 0.45);
    $('#k-nitro').style.width = P.nitro * 100 + '%';
  }

  /* ---------- modal, pause ---------- */
  function openK(html) {
    $('#kmodal-card').innerHTML = html; $('#kmodal').classList.add('open');
    $$('#kmodal [data-ka]').forEach((b) => (b.onclick = () => {
      const a = b.dataset.ka, ri = RACE.ri;
      if (a === 'next') startRace(ri + 1);
      else if (a === 'again') startRace(ri);
      else if (a === 'resume') { closeK(); RACE.paused = false; klast = performance.now(); }
      else { stopRace(); openKLobby(a === 'garage' ? 'garage' : 'races'); }
    }));
  }
  function closeK() { $('#kmodal').classList.remove('open'); }
  function stopRace() { cancelAnimationFrame(kraf); closeK(); for (const k in kk) kk[k] = false; for (const k in kin) kin[k] = false; $$('.kbtn').forEach((b) => b.classList.remove('held')); }
  function pauseRace() {
    if (!RACE || RACE.over) return;
    if (RACE.paused) { closeK(); RACE.paused = false; klast = performance.now(); return; }
    RACE.paused = true;
    openK('<h2>Paused</h2><p class="muted">Quitting ends the race with no points.</p><div class="modal-actions"><button class="btn primary" data-ka="resume">Resume</button><button class="btn ghost" data-ka="lobby">Quit to races</button></div>');
  }
  $('#kpause').onclick = pauseRace;

  /* ---------- input ---------- */
  addEventListener('keydown', (e) => {
    if (!$('#s-race').classList.contains('active')) return;
    if (e.code === 'Escape' || e.code === 'KeyP') { pauseRace(); return; }
    kk[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { kk[e.code] = false; });
  addEventListener('blur', () => { for (const k in kk) kk[k] = false; });
  $$('.kbtn').forEach((b) => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => { kin[k] = true; b.classList.add('held'); try { b.setPointerCapture(e.pointerId); } catch (_) {} });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => b.addEventListener(t, () => { kin[k] = false; b.classList.remove('held'); }));
  });
  kcv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !ktouch) { ktouch = true; $('#s-race').classList.add('touch'); } });

  /* ---------- lobby ---------- */
  function setKTab(t) {
    $$('#s-klobby .ktab').forEach((b) => b.classList.toggle('on', b.dataset.ktab === t));
    $$('#s-klobby .kpanel').forEach((p) => p.classList.toggle('on', p.id === 'kp-' + t));
  }
  $$('#s-klobby .ktab').forEach((b) => (b.onclick = () => setKTab(b.dataset.ktab)));

  function openKLobby(tab) { kload(); refreshPoints(); renderRaces(); renderCars(); renderKUpg(); setKTab(tab || 'races'); show('s-klobby'); }

  function renderRaces() {
    $('#k-races').innerHTML = RACES.map((r, i) => {
      const locked = i + 1 > KS.unlocked, best = KS.best[i];
      return `<button class="lvl${locked ? ' locked' : ''}${i === RACES.length - 1 ? ' boss' : ''}" data-r="${i}" ${locked ? 'disabled aria-disabled="true"' : ''}>
        <span class="num" style="font-size:22px">${r.name}</span><span class="tier" style="color:${['#14c79a', '#2f6bff', '#ff8a3d', '#b04dff', '#ff4d5e', '#16203d'][i]}">${r.level}</span>
        <span class="sub">${locked ? '🔒 Locked' : best ? `Best: ${ord(best)} place` : 'Not raced yet'}</span></button>`;
    }).join('');
    $$('#k-races .lvl').forEach((b) => (b.onclick = () => { if (!b.disabled) startRace(+b.dataset.r); }));
  }
  function renderCars() {
    const pts = Wallet.get();
    $('#k-cars').innerHTML = CARS.map((c) => {
      const owned = KS.owned.includes(c.id), eq = KS.car === c.id;
      const btn = eq ? '<button class="btn ghost" disabled>Driving</button>' : owned ? `<button class="btn primary" data-kc="${c.id}">Drive</button>` : `<button class="btn gold" data-kbuy="${c.id}" ${pts < c.cost ? 'disabled' : ''}>Buy for ⭐ ${c.cost.toLocaleString()}</button>`;
      const bar = (v) => Math.round(((v - 0.8) / 0.5) * 100);
      return `<div class="item${eq ? ' eq' : ''}"><div class="item-head"><div class="ico">${c.icon}</div><div><h3>${c.name}</h3><p>${c.desc}</p></div></div>
        <div class="stat">Speed<div class="bar"><i style="width:${bar(c.top)}%;background:${c.color}"></i></div></div>
        <div class="stat">Accel<div class="bar"><i style="width:${bar(c.acc)}%;background:${c.color}"></i></div></div>
        <div class="stat">Handling<div class="bar"><i style="width:${bar(c.turn)}%;background:${c.color}"></i></div></div>${btn}</div>`;
    }).join('');
    $$('[data-kc]').forEach((b) => (b.onclick = () => { KS.car = b.dataset.kc; ksave(); renderCars(); toast(carOf().name + ' selected'); }));
    $$('[data-kbuy]').forEach((b) => (b.onclick = () => {
      const c = CARS.find((x) => x.id === b.dataset.kbuy);
      if (!Wallet.spend(c.cost)) return;
      KS.owned.push(c.id); KS.car = c.id; ksave(); renderCars(); renderKUpg(); toast(c.name + ' bought');
    }));
  }
  function renderKUpg() {
    const pts = Wallet.get();
    $('#k-upgrades').innerHTML = KUPG.map((u) => {
      const lv = KS.upg[u.id], max = lv >= KMAX, cost = KUPG_COST[lv];
      return `<div class="item"><div class="item-head"><div class="ico">${u.icon}</div><div><h3>${u.name}</h3><p>${u.desc}</p></div></div>
        <div class="dots" aria-label="Level ${lv} of ${KMAX}">${Array.from({ length: KMAX }, (_, i) => `<b class="${i < lv ? 'on' : ''}"></b>`).join('')}</div>
        ${max ? '<button class="btn ghost" disabled>Maxed out</button>' : `<button class="btn gold" data-ku="${u.id}" ${pts < cost ? 'disabled' : ''}>Upgrade for ⭐ ${cost.toLocaleString()}</button>`}</div>`;
    }).join('');
    $$('[data-ku]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.ku, cost = KUPG_COST[KS.upg[id]];
      if (!Wallet.spend(cost)) return;
      KS.upg[id]++; ksave(); renderKUpg(); renderCars(); toast('Upgrade installed');
    }));
  }

  /* ---------- hub card ---------- */
  function drawKartArt() {
    const cvs = $('#hub-art-kart'); if (!cvs) return;
    const r = cvs.getBoundingClientRect(); if (!r.width) return;
    const d = Math.min(2, devicePixelRatio || 1); cvs.width = r.width * d; cvs.height = r.height * d;
    const g = cvs.getContext('2d'), T = buildTrack(0), bb = T.bb;
    const s = Math.min(cvs.width / (bb.maxX - bb.minX + 500), cvs.height / (bb.maxY - bb.minY + 500)) * 1.25;
    g.setTransform(s, 0, 0, s, cvs.width / 2 - ((bb.minX + bb.maxX) / 2) * s, cvs.height / 2 - ((bb.minY + bb.maxY) / 2) * s);
    drawTrack(g, T, true);
    drawTrees(g, T, -1e4, -1e4, 1e4, 1e4);
    const spots = [[40, '#2f6bff'], [70, '#ff8a3d'], [95, '#b04dff'], [260, '#ffb31a'], [400, '#ff4d8b']];
    for (const [j, color] of spots) {
      const p = T.pts[j % T.N];
      g.save(); g.translate(p.x, p.y); g.scale(2.2, 2.2); g.translate(-p.x, -p.y);
      drawCar(g, { x: p.x + p.nx * ((j % 3) - 1) * 20, y: p.y + p.ny * ((j % 3) - 1) * 20, ang: p.dir, color, name: '', boost: j === 40 }, j === 40);
      g.restore();
    }
  }

  window.Kart = {
    onHub() {
      if (!profile) return;
      kload();
      $('#hub-kart-progress').textContent = KS.best[RACES.length - 1] === 1 ? 'Champion! All tracks won.' : `Track ${KS.unlocked} of ${RACES.length} unlocked`;
      requestAnimationFrame(drawKartArt);
    },
    open: openKLobby,
  };
  $('#play-kart').onclick = () => openKLobby('races');
  if (profile && $('#s-hub').classList.contains('active')) window.Kart.onHub();
})();
