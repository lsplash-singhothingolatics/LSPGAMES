/* Town Life RP: walk around town, work jobs, chat with townspeople, buy outfits, rides and a house. */
(function () {
  'use strict';
  const L = LSPG, rr = L.rr;
  const WW = 2400, WH = 1600, RW = 90, HROADS = [560, 1130], VROADS = [640, 1320, 2000], VROAD_END = 1175;
  const HOUSE_COLORS = ['#ffd6d6', '#d6ecff', '#e2ffd6', '#fff1c9', '#ecdcff', '#ffe0c7', '#d4f5f0', '#f5d4ec'];
  const BUILD = [
    { id: 'pizza', name: 'Pizza Place', icon: '🍕', x: 140, y: 180, w: 340, h: 240, color: '#ffe2b3', job: 'pizza' },
    { id: 'hospital', name: 'Hospital', icon: '🏥', x: 800, y: 150, w: 380, h: 280, color: '#ffffff', job: 'doctor' },
    { id: 'police', name: 'Police Station', icon: '🚓', x: 1480, y: 170, w: 380, h: 260, color: '#d6e4ff', job: 'police' },
    { id: 'fire', name: 'Fire Station', icon: '🚒', x: 2100, y: 170, w: 260, h: 260, color: '#ffd9d4', job: 'fire' },
    { id: 'style', name: 'Style Shop', icon: '👕', x: 140, y: 720, w: 340, h: 260, color: '#f3e1ff', shop: 'style' },
    { id: 'cars', name: 'Car Dealer', icon: '🚗', x: 800, y: 720, w: 380, h: 260, color: '#dff5e8', shop: 'rides' },
    { id: 'bank', name: 'Bank', icon: '🏦', x: 2100, y: 720, w: 260, h: 260, color: '#fff3c4' },
  ];
  for (let i = 0; i < 8; i++) BUILD.push({ id: 'house' + i, name: 'House ' + (i + 1), icon: '🏠', x: 110 + i * 285, y: 1260, w: 210, h: 170, color: HOUSE_COLORS[i], house: i });
  const PARK = { x: 1480, y: 720, w: 380, h: 300 };
  const JOBS = {
    pizza: { name: 'Pizza Delivery', icon: '🍕', pay: 15, desc: 'Pick up pizzas and deliver them to houses around town.' },
    doctor: { name: 'Doctor', icon: '🩺', pay: 22, desc: 'Find sick townspeople and bring them to the hospital.' },
    police: { name: 'Police Officer', icon: '👮', pay: 30, desc: 'Chase down robbers and catch them.' },
    fire: { name: 'Firefighter', icon: '🧯', pay: 25, desc: 'Race to burning houses and put out the fire.' },
  };
  const SHIRTS = [
    { id: 'blue', name: 'Blue Tee', color: '#2f6bff', cost: 0 }, { id: 'red', name: 'Red Hoodie', color: '#ff4d5e', cost: 100 },
    { id: 'green', name: 'Green Jacket', color: '#14c79a', cost: 150 }, { id: 'purple', name: 'Purple Sweater', color: '#8a5cff', cost: 250 },
    { id: 'black', name: 'Black Suit', color: '#2b3350', cost: 400 }, { id: 'gold', name: 'Gold Jacket', color: '#f2b61f', cost: 900 },
  ].map((s) => ({ ...s, icon: `<span style="display:block;width:26px;height:26px;border-radius:8px;background:${s.color}"></span>`, desc: s.cost ? 'Outfit' : 'Free outfit' }));
  const HATS = [
    { id: 'none', name: 'No hat', icon: '🙂', cost: 0, hat: '' }, { id: 'cap', name: 'Cap', icon: '🧢', cost: 200, hat: '🧢' },
    { id: 'grad', name: 'Grad Cap', icon: '🎓', cost: 350, hat: '🎓' }, { id: 'top', name: 'Top Hat', icon: '🎩', cost: 500, hat: '🎩' },
    { id: 'crown', name: 'Crown', icon: '👑', cost: 1500, hat: '👑' },
  ].map((h) => ({ ...h, desc: h.cost ? 'Hat' : 'Free' }));
  const RIDES = [
    { id: 'walk', name: 'Walking', icon: '🚶', cost: 0, mult: 1, color: '', desc: 'Normal speed' },
    { id: 'bike', name: 'Bike', icon: '🚲', cost: 300, mult: 1.4, color: '#14c79a', desc: '40% faster' },
    { id: 'scooter', name: 'Scooter', icon: '🛵', cost: 800, mult: 1.7, color: '#ff8a3d', desc: '70% faster' },
    { id: 'car', name: 'Family Car', icon: '🚗', cost: 1500, mult: 2, color: '#2f6bff', desc: 'Twice as fast' },
    { id: 'sports', name: 'Sports Car', icon: '🏎️', cost: 4000, mult: 2.5, color: '#ff4d5e', desc: 'The fastest ride in town' },
  ];
  const HOUSE_COST = 2500;
  const CHAT = ['Hi!', 'Hello there!', 'Nice outfit!', 'Want to be friends?', 'Need a ride?', 'Great day today!', 'See you later!', 'Where is the pizza place?'];
  const NPC_LINES = ['Hello!', 'Nice day!', 'Love this town!', 'Have you tried the pizza?', 'I need a new car...', 'Hi friend!', 'The park is so pretty.', 'Stay safe!', 'Going shopping!', 'Ha ha!'];
  const NAMES = ['Mia', 'Leo', 'Ava', 'Zoe', 'Kai', 'Noah', 'Aria', 'Ravi', 'Sara', 'Omar', 'Lily', 'Jay', 'Nina', 'Arjun', 'Ella', 'Max'];
  const SKIN = ['#ffd9b3', '#f1c08f', '#d9a06b', '#b87a4b', '#8d5a36'];

  const DB = L.store('town', { shirt: 'blue', hat: 'none', ride: 'walk', owned: { shirts: ['blue'], hats: ['none'], rides: ['walk'] }, house: false, done: { pizza: 0, doctor: 0, police: 0, fire: 0 } });
  let S = null;
  const save = () => DB.save(S);

  const A = L.makeGame({
    key: 'town', title: 'Town Life RP', emoji: '🏙️', cardBg: '#e0f0ff', grid: 'rp-games', bg: '#cfeec0',
    desc: 'Live in town: work jobs, chat, buy outfits, rides and a house.',
    tabs: [['play', 'Play'], ['style', 'Style'], ['rides', 'Rides'], ['home', 'Home']],
    hud: '<span class="hudpill" id="tw-job">No job</span><span class="hudpill" id="tw-earn">⭐ +0</span><button class="iconbtn" id="tw-chat" aria-label="Chat">💬</button><button class="iconbtn" id="tw-ride" aria-label="Get in or out of your ride">🚶</button><button class="btn ghost" id="tw-quit" style="height:44px;font-size:15px;display:none">Quit job</button>',
    padsR: '<button class="kbtn jump" data-k="act">ACT</button>',
    help: 'WASD or arrows to walk, click to walk somewhere, E to use a door, Esc to pause',
    quitNote: 'Points you earned from jobs are already saved.', padReserve: 0,
    progress: () => { const s = DB.load(); const n = Object.values(s.done).reduce((a, b) => a + b, 0); return n ? `${n} jobs done` : 'Get your first job!'; },
  });
  const cv = A.cv, g = A.g;
  let W = null;

  /* ---------- world ---------- */
  const doorOf = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h + 26 });
  const inB = (x, y, pad) => BUILD.some((b) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad);
  function randSpot(pad = 30) { for (let i = 0; i < 60; i++) { const x = 60 + Math.random() * (WW - 120), y = 60 + Math.random() * (WH - 120); if (!inB(x, y, pad)) return { x, y }; } return { x: 640, y: 560 }; }
  function resolve(o) {
    for (const b of BUILD) {
      const cx = Math.max(b.x, Math.min(o.x, b.x + b.w)), cy = Math.max(b.y, Math.min(o.y, b.y + b.h)), dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy);
      if (d < o.r) { if (d > 0) { o.x = cx + (dx / d) * o.r; o.y = cy + (dy / d) * o.r; } else o.y = b.y + b.h + o.r; }
    }
    o.x = Math.max(o.r, Math.min(WW - o.r, o.x)); o.y = Math.max(o.r, Math.min(WH - o.r, o.y));
  }
  function makeNpc(kind) {
    const p = randSpot();
    return { kind, x: p.x, y: p.y, r: 14, tx: p.x, ty: p.y, speed: 55 + Math.random() * 35, shirt: `hsl(${(Math.random() * 360) | 0},65%,62%)`, skin: SKIN[(Math.random() * SKIN.length) | 0], name: NAMES[(Math.random() * NAMES.length) | 0], say: '', sayT: 0, chatT: 3 + Math.random() * 10, stuck: 0, face: 0 };
  }

  function start() {
    S = DB.load();
    const home = S.house ? doorOf(BUILD.find((b) => b.id === 'house7')) : { x: 640, y: 640 };
    W = {
      p: { x: home.x, y: home.y, r: 16, face: Math.PI / 2, moving: false, say: '', sayT: 0, inRide: S.ride !== 'walk', target: null, pending: null },
      npcs: Array.from({ length: 16 }, () => makeNpc('npc')), cars: [], job: null, earned: 0, t: 0, floats: [], parts: [], cam: { x: home.x, y: home.y }, near: null, actPrev: false, fireHouse: null,
    };
    for (let i = 0; i < 6; i++) { const hz = i % 2 === 0, lane = i % 4 < 2 ? -22 : 22; W.cars.push(hz ? { hz, x: Math.random() * WW, y: HROADS[i % 2] + lane, v: lane < 0 ? -140 : 140, color: `hsl(${(Math.random() * 360) | 0},70%,60%)` } : { hz, x: VROADS[i % 3] + lane, y: Math.random() * VROAD_END, v: lane < 0 ? 140 : -140, color: `hsl(${(Math.random() * 360) | 0},70%,60%)` }); }
    A.play(); updateHud(); A.run(step);
  }
  A.onAgain = start;

  /* ---------- jobs ---------- */
  function startJob(type) { W.job = { type, stage: '', target: null, npc: null, fire: 0, t: 0 }; nextTask(); updateHud(); toast(`You're now a ${JOBS[type].name}!`); }
  function quitJob() { if (!W.job) return; if (W.job.npc) W.npcs = W.npcs.filter((n) => n !== W.job.npc); W.job = null; W.fireHouse = null; updateHud(); }
  function nextTask() {
    const j = W.job; j.t = 0;
    const houses = BUILD.filter((b) => b.house != null && !(S.house && b.id === 'house7'));
    if (j.type === 'pizza') { j.stage = 'pickup'; j.target = BUILD.find((b) => b.id === 'pizza'); }
    else if (j.type === 'doctor') { const n = makeNpc('patient'); n.say = '🤒 Help!'; n.sayT = 999; W.npcs.push(n); j.npc = n; j.stage = 'find'; j.target = null; }
    else if (j.type === 'police') { const n = makeNpc('robber'); let tries = 0; while (Math.hypot(n.x - W.p.x, n.y - W.p.y) < 500 && tries++ < 20) { const s = randSpot(); n.x = s.x; n.y = s.y; } n.shirt = '#2b3350'; n.name = 'Robber'; n.say = '💰 Ha ha!'; n.sayT = 2.5; W.npcs.push(n); j.npc = n; j.stage = 'chase'; }
    else if (j.type === 'fire') { const h = houses[(Math.random() * houses.length) | 0]; W.fireHouse = h; j.target = h; j.stage = 'fire'; j.fire = 0; }
    updateHud();
  }
  function pay(msg) {
    const j = W.job, base = JOBS[j.type].pay, bonus = j.type === 'pizza' && j.t < 25 ? 5 : 0;
    const got = Wallet.add(base + bonus); W.earned += got; S.done[j.type]++; save();
    W.floats.push({ x: W.p.x, y: W.p.y - 50, t: 1.4, txt: `+${got} ⭐` });
    toast(`${msg} +${got} points${bonus ? ' (fast bonus!)' : ''}`);
    burst(W.p.x, W.p.y, '#ffb31a', 18);
    nextTask();
  }
  function jobText() {
    const j = W.job; if (!j) return 'No job. Visit a work building';
    const jb = JOBS[j.type];
    if (j.type === 'pizza') return j.stage === 'pickup' ? `${jb.icon} Pick up pizza` : `${jb.icon} Deliver to ${j.target.name}`;
    if (j.type === 'doctor') return j.stage === 'find' ? `${jb.icon} Find the sick person` : `${jb.icon} Bring them to the Hospital`;
    if (j.type === 'police') return `${jb.icon} Catch the robber!`;
    return `${jb.icon} Put out the fire at ${j.target.name}`;
  }
  function updateHud() {
    if (!W) return;
    $('#tw-job').textContent = jobText();
    $('#tw-earn').textContent = `⭐ +${W.earned}`;
    $('#tw-quit').style.display = W.job ? '' : 'none';
    const r = RIDES.find((x) => x.id === S.ride);
    $('#tw-ride').style.display = S.ride === 'walk' ? 'none' : '';
    $('#tw-ride').textContent = W.p.inRide ? '🚶' : r.icon;
  }
  $('#tw-quit').onclick = () => quitJob();
  $('#tw-ride').onclick = () => { if (S.ride === 'walk') return; W.p.inRide = !W.p.inRide; updateHud(); };
  $('#tw-chat').onclick = () => {
    A.paused = true;
    A.modal(`<h2>Say something</h2><div class="modal-actions">${CHAT.map((c, i) => `<button class="btn ghost" data-a="c${i}">${c}</button>`).join('')}<button class="btn primary" data-a="close">Close</button></div>`,
      Object.assign({ close: () => { A.paused = false; A.closeModal(); } }, ...CHAT.map((c, i) => ({ ['c' + i]: () => { say(c); A.paused = false; A.closeModal(); } }))));
  };
  function say(text) {
    W.p.say = text; W.p.sayT = 3;
    const near = W.npcs.filter((n) => n.kind === 'npc' && Math.hypot(n.x - W.p.x, n.y - W.p.y) < 260).slice(0, 2);
    near.forEach((n, i) => setTimeout(() => { n.say = ['Hi!', 'Hello!', 'Sure!', 'Ha ha, yes!', 'Thanks!', 'You too!'][(Math.random() * 6) | 0]; n.sayT = 2.5; n.face = Math.atan2(W.p.y - n.y, W.p.x - n.x); }, 600 + i * 500));
  }
  function burst(x, y, c, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 60 + Math.random() * 180; W.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, c }); } }

  function useDoor(b) {
    if (b.job) {
      const jb = JOBS[b.job];
      if (W.job && W.job.type === b.job) { toast(`You're already working as a ${jb.name}.`); return; }
      A.paused = true;
      A.modal(`<h2>${jb.icon} ${jb.name}</h2><p class="muted">${jb.desc} Earn ⭐ ${jb.pay} points each time.</p><div class="modal-actions"><button class="btn primary" data-a="go">${W.job ? 'Switch to this job' : 'Start job'}</button><button class="btn ghost" data-a="no">Not now</button></div>`,
        { go: () => { quitJob(); A.paused = false; A.closeModal(); startJob(b.job); }, no: () => { A.paused = false; A.closeModal(); } });
    } else if (b.shop) {
      A.paused = true;
      A.modal(`<h2>${b.icon} ${b.name}</h2><p class="muted">${b.shop === 'style' ? 'Buy new outfits and hats.' : 'Buy bikes, scooters and cars.'}</p><div class="modal-actions"><button class="btn primary" data-a="go">Open shop</button><button class="btn ghost" data-a="no">Keep playing</button></div>`,
        { go: () => A.openLobby(b.shop), no: () => { A.paused = false; A.closeModal(); } });
    } else if (b.id === 'bank') { say('Can I open an account?'); setTimeout(() => toast('Bank: your points are safe with LSPGames!'), 700); }
    else if (b.house != null) {
      if (S.house && b.id === 'house7') { say('Home sweet home!'); }
      else { say('Knock knock!'); setTimeout(() => toast(`Nobody answered at ${b.name}.`), 700); }
    }
  }

  /* ---------- update ---------- */
  function step(dt) {
    if (dt > 0) update(dt);
    draw();
  }
  function update(dt) {
    W.t += dt;
    const p = W.p, k = A.keys;
    let mx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), my = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    if (mx || my) { p.target = null; p.pending = null; }
    else if (p.target) { const dx = p.target.x - p.x, dy = p.target.y - p.y, d = Math.hypot(dx, dy); if (d < 8) { p.target = null; if (p.pending) { const b = p.pending; p.pending = null; useDoor(b); } } else { mx = dx / d; my = dy / d; } }
    const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    const ride = RIDES.find((r) => r.id === S.ride), sp = 190 * (p.inRide ? ride.mult : 1);
    p.moving = len > 0.1; if (p.moving) p.face = Math.atan2(my, mx);
    p.x += mx * sp * dt; p.y += my * sp * dt; resolve(p);
    if (p.sayT > 0) p.sayT -= dt;

    for (const n of W.npcs) {
      if (n.sayT > 0 && n.sayT < 900) n.sayT -= dt;
      if (n.kind === 'robber') { const dx = n.x - p.x, dy = n.y - p.y, d = Math.hypot(dx, dy) || 1; n.tx = n.x + dx / d * 200 + Math.sin(W.t * 2) * 80; n.ty = n.y + dy / d * 200 + Math.cos(W.t * 1.7) * 80; n.speed = 165; }
      else if (n.kind === 'patient' && n.follow) { n.tx = p.x - Math.cos(p.face) * 40; n.ty = p.y - Math.sin(p.face) * 40; n.speed = sp * 0.95; }
      else if (n.kind === 'patient') { n.tx = n.x; n.ty = n.y; }
      else { n.chatT -= dt; if (n.chatT <= 0) { n.chatT = 6 + Math.random() * 12; if (Math.hypot(n.x - p.x, n.y - p.y) < 700) { n.say = NPC_LINES[(Math.random() * NPC_LINES.length) | 0]; n.sayT = 2.6; } } }
      const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
      if (d < 10 && n.kind === 'npc') { const s = randSpot(); n.tx = s.x; n.ty = s.y; }
      if (d > 4) { const ox = n.x, oy = n.y; n.x += (dx / d) * n.speed * dt; n.y += (dy / d) * n.speed * dt; resolve(n); n.face = Math.atan2(dy, dx); if (Math.hypot(n.x - ox, n.y - oy) < n.speed * dt * 0.3) { n.stuck += dt; if (n.stuck > 1) { n.stuck = 0; const s = randSpot(); n.tx = s.x; n.ty = s.y; } } else n.stuck = 0; }
    }
    for (const c of W.cars) { if (c.hz) { c.x += c.v * dt; if (c.x > WW + 60) c.x = -60; if (c.x < -60) c.x = WW + 60; } else { c.y += c.v * dt; if (c.y > VROAD_END + 60) c.y = -60; if (c.y < -60) c.y = VROAD_END + 60; } }

    // job logic
    const j = W.job;
    if (j) {
      j.t += dt;
      if (j.type === 'pizza') {
        const d = doorOf(j.target);
        if (Math.hypot(p.x - d.x, p.y - d.y) < 60) {
          if (j.stage === 'pickup') { j.stage = 'deliver'; const hs = BUILD.filter((b) => b.house != null && !(S.house && b.id === 'house7')); j.target = hs[(Math.random() * hs.length) | 0]; j.t = 0; toast('Got the pizza! Deliver it fast.'); updateHud(); }
          else pay('Pizza delivered!');
        }
      } else if (j.type === 'doctor') {
        const n = j.npc;
        if (j.stage === 'find' && Math.hypot(p.x - n.x, p.y - n.y) < 50) { j.stage = 'return'; n.follow = true; n.say = 'Thank you!'; n.sayT = 2; j.target = BUILD.find((b) => b.id === 'hospital'); updateHud(); }
        else if (j.stage === 'return') { const d = doorOf(j.target); if (Math.hypot(p.x - d.x, p.y - d.y) < 70) { W.npcs = W.npcs.filter((x) => x !== n); pay('Patient treated!'); } }
      } else if (j.type === 'police') {
        const n = j.npc; if (Math.hypot(p.x - n.x, p.y - n.y) < 38) { W.npcs = W.npcs.filter((x) => x !== n); burst(n.x, n.y, '#2f6bff', 20); pay('Robber caught!'); }
      } else if (j.type === 'fire') {
        const d = doorOf(j.target);
        if (Math.hypot(p.x - d.x, p.y - d.y) < 120) { j.fire += dt / 2.5; if (Math.random() < 0.6) W.parts.push({ x: p.x, y: p.y - 10, vx: (d.x - p.x) * 1.2 + (Math.random() - 0.5) * 60, vy: (j.target.y + 40 - p.y) * 1.2, life: 0.5, c: '#4fb6f0' }); if (j.fire >= 1) { W.fireHouse = null; pay('Fire is out!'); } }
      }
    }
    // doors
    let near = null, nd = 80;
    for (const b of BUILD) { const d = doorOf(b), dd = Math.hypot(p.x - d.x, p.y - d.y); if (dd < nd) { nd = dd; near = b; } }
    W.near = near;
    const act = k.KeyE || k.Enter || A.tin.act;
    if (act && !W.actPrev && near) useDoor(near);
    W.actPrev = act;
    for (const q of W.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    W.parts = W.parts.filter((q) => q.life > 0);
    for (const f of W.floats) { f.y -= 40 * dt; f.t -= dt; }
    W.floats = W.floats.filter((f) => f.t > 0);
  }

  cv.addEventListener('pointerdown', (e) => {
    if (!W || A.paused) return;
    const v = A.view, r = cv.getBoundingClientRect();
    const wx = ((e.clientX - r.left) * v.d - v.w / 2) / W.z + W.cam.x, wy = ((e.clientY - r.top) * v.d - v.h / 2) / W.z + W.cam.y;
    const b = BUILD.find((b) => wx > b.x && wx < b.x + b.w && wy > b.y && wy < b.y + b.h);
    if (b) { const d = doorOf(b); W.p.target = d; W.p.pending = b; } else { W.p.target = { x: wx, y: wy }; W.p.pending = null; }
  });

  /* ---------- draw ---------- */
  function person(x, y, shirt, skin, face, name, hat, bubble, you) {
    g.fillStyle = 'rgba(22,32,61,.14)'; g.beginPath(); g.ellipse(x, y + 14, 14, 5, 0, 0, 7); g.fill();
    g.fillStyle = shirt; rr(g, x - 11, y - 8, 22, 22, 7); g.fill();
    g.fillStyle = skin; g.beginPath(); g.arc(x, y - 16, 10, 0, 7); g.fill();
    g.fillStyle = '#16203d'; const ex = Math.cos(face) * 3; g.fillRect(x - 4 + ex, y - 18, 2.5, 3); g.fillRect(x + 2 + ex, y - 18, 2.5, 3);
    if (hat) { g.font = '18px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(hat, x, y - 22); }
    if (name) { g.font = `800 ${you ? 13 : 11}px Nunito, system-ui, sans-serif`; g.textAlign = 'center'; g.fillStyle = you ? '#1f4fd1' : 'rgba(22,32,61,.7)'; g.fillText(name, x, y - (hat ? 42 : 32)); }
    if (bubble) bubbleAt(x, y - (hat ? 56 : 46), bubble);
  }
  function bubbleAt(x, y, text) {
    g.font = '800 13px Nunito, system-ui, sans-serif'; const w = g.measureText(text).width + 18;
    g.fillStyle = '#ffffff'; g.strokeStyle = '#dfe5f1'; g.lineWidth = 2; rr(g, x - w / 2, y - 24, w, 26, 10); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - 5, y + 1); g.lineTo(x, y + 8); g.lineTo(x + 5, y + 1); g.fill();
    g.fillStyle = '#16203d'; g.textAlign = 'center'; g.fillText(text, x, y - 6);
  }
  function car(x, y, ang, color, w = 48, h = 26) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = 'rgba(22,32,61,.16)'; rr(g, -w / 2 + 3, -h / 2 + 4, w, h, 8); g.fill();
    g.fillStyle = color; rr(g, -w / 2, -h / 2, w, h, 8); g.fill();
    g.fillStyle = 'rgba(22,32,61,.55)'; rr(g, w * 0.05, -h / 2 + 4, w * 0.2, h - 8, 3); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; rr(g, -w * 0.3, -h / 2 + 5, w * 0.3, h - 10, 3); g.fill();
    g.restore();
  }
  function draw() {
    const v = A.view, p = W.p;
    W.z = Math.max(0.45, Math.min(v.w / 900, v.h / 700));
    const z = W.z, vw = v.w / z, vh = v.h / z;
    W.cam.x += (Math.max(vw / 2, Math.min(WW - vw / 2, p.x)) - W.cam.x) * 0.15;
    W.cam.y += (Math.max(vh / 2 - 60 / z, Math.min(WH - vh / 2, p.y)) - W.cam.y) * 0.15;
    const cx = W.cam.x, cy = W.cam.y;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#cfeec0'; g.fillRect(0, 0, v.w, v.h);
    g.setTransform(z, 0, 0, z, v.w / 2 - cx * z, v.h / 2 - cy * z);
    g.fillStyle = '#c6e8b5'; for (let x = 0; x < WW; x += 80) for (let y = (x / 80) % 2 ? 40 : 0; y < WH; y += 80) g.fillRect(x, y, 40, 40);
    // roads
    g.fillStyle = '#e8ecf3';
    for (const y of HROADS) g.fillRect(0, y - RW / 2 - 14, WW, RW + 28);
    for (const x of VROADS) g.fillRect(x - RW / 2 - 14, 0, RW + 28, VROAD_END);
    g.fillStyle = '#8f98ac';
    for (const y of HROADS) g.fillRect(0, y - RW / 2, WW, RW);
    for (const x of VROADS) g.fillRect(x - RW / 2, 0, RW, VROAD_END);
    g.fillStyle = 'rgba(255,255,255,.75)';
    for (const y of HROADS) for (let x = 0; x < WW; x += 60) g.fillRect(x, y - 2, 30, 4);
    for (const x of VROADS) for (let y = 0; y < VROAD_END; y += 60) g.fillRect(x - 2, y, 4, 30);
    // park
    g.fillStyle = '#a9dc92'; rr(g, PARK.x, PARK.y, PARK.w, PARK.h, 30); g.fill();
    g.fillStyle = '#9fd4ff'; g.beginPath(); g.arc(PARK.x + PARK.w / 2, PARK.y + PARK.h / 2, 50, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(PARK.x + PARK.w / 2, PARK.y + PARK.h / 2, 12 + Math.sin(W.t * 3) * 3, 0, 7); g.fill();
    for (const [tx, ty] of [[40, 40], [340, 50], [40, 250], [330, 240], [190, 30]]) { g.fillStyle = 'rgba(22,32,61,.12)'; g.beginPath(); g.arc(PARK.x + tx + 5, PARK.y + ty + 6, 24, 0, 7); g.fill(); g.fillStyle = '#4fb86d'; g.beginPath(); g.arc(PARK.x + tx, PARK.y + ty, 24, 0, 7); g.fill(); }
    // cars
    for (const c of W.cars) car(c.x, c.y, c.hz ? (c.v > 0 ? 0 : Math.PI) : (c.v > 0 ? Math.PI / 2 : -Math.PI / 2), c.color);
    // buildings
    for (const b of BUILD) {
      g.fillStyle = 'rgba(22,32,61,.12)'; rr(g, b.x + 8, b.y + 10, b.w, b.h, 14); g.fill();
      g.fillStyle = b.color; g.strokeStyle = '#c3cbdb'; g.lineWidth = 3; rr(g, b.x, b.y, b.w, b.h, 14); g.fill(); g.stroke();
      if (b.house != null) {
        g.fillStyle = ['#e0664f', '#4f7de0', '#4fb86d', '#e0a84f', '#8a5cff', '#e0804f', '#3fb8a8', '#d65fa8'][b.house]; rr(g, b.x - 8, b.y - 8, b.w + 16, 50, 12); g.fill();
      } else { g.fillStyle = 'rgba(22,32,61,.08)'; rr(g, b.x, b.y, b.w, 40, 14); g.fill(); }
      g.fillStyle = '#cfe8ff'; const wn = Math.floor(b.w / 90);
      for (let i = 0; i < wn; i++) { rr(g, b.x + 24 + i * ((b.w - 48) / wn) + 6, b.y + 62, (b.w - 48) / wn - 20, 40, 6); g.fill(); }
      g.fillStyle = '#6f5238'; rr(g, b.x + b.w / 2 - 20, b.y + b.h - 50, 40, 50, 6); g.fill();
      g.font = '34px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(b.icon, b.x + b.w / 2, b.y + (b.house != null ? 36 : 34) + 2);
      const label = S.house && b.id === 'house7' ? `${profile.email.split('@')[0]}'s House` : b.name;
      g.font = '700 18px Fredoka, system-ui, sans-serif'; g.fillStyle = '#16203d'; g.fillText(label, b.x + b.w / 2, b.y + b.h - 62);
    }
    // fire
    if (W.fireHouse) {
      const b = W.fireHouse;
      for (let i = 0; i < 7; i++) { const fx = b.x + 20 + i * (b.w - 40) / 6, fh = 30 + Math.sin(W.t * 9 + i) * 10; g.fillStyle = '#ff8a3d'; g.beginPath(); g.moveTo(fx - 14, b.y + 10); g.quadraticCurveTo(fx, b.y - fh * 1.6, fx + 14, b.y + 10); g.fill(); g.fillStyle = '#ffd640'; g.beginPath(); g.moveTo(fx - 7, b.y + 10); g.quadraticCurveTo(fx, b.y - fh * 0.8, fx + 7, b.y + 10); g.fill(); }
      if (W.job && W.job.type === 'fire' && W.job.fire > 0) { g.fillStyle = '#fff'; rr(g, b.x + b.w / 2 - 50, b.y - 80, 100, 12, 6); g.fill(); g.fillStyle = '#4fb6f0'; rr(g, b.x + b.w / 2 - 50, b.y - 80, 100 * W.job.fire, 12, 6); g.fill(); }
    }
    // target marker
    const j = W.job; let tgt = null;
    if (j) { if (j.target && !(j.type === 'doctor' && j.stage === 'find')) tgt = doorOf(j.target); if (j.npc && (j.stage === 'find' || j.stage === 'chase')) tgt = { x: j.npc.x, y: j.npc.y - 20 }; }
    if (tgt) { const bob = Math.sin(W.t * 6) * 6; g.fillStyle = '#ff4d5e'; g.beginPath(); g.moveTo(tgt.x - 14, tgt.y - 70 + bob); g.lineTo(tgt.x + 14, tgt.y - 70 + bob); g.lineTo(tgt.x, tgt.y - 48 + bob); g.fill(); g.strokeStyle = 'rgba(255,77,94,.5)'; g.lineWidth = 4; g.beginPath(); g.arc(tgt.x, tgt.y, 30 + Math.sin(W.t * 5) * 4, 0, 7); g.stroke(); }
    if (p.target) { g.strokeStyle = 'rgba(47,107,255,.5)'; g.lineWidth = 3; g.beginPath(); g.arc(p.target.x, p.target.y, 12, 0, 7); g.stroke(); }
    // people, sorted by y
    const all = W.npcs.map((n) => ({ n, y: n.y })).concat([{ n: null, y: p.y }]).sort((a, b) => a.y - b.y);
    const ride = RIDES.find((r) => r.id === S.ride), shirt = SHIRTS.find((s) => s.id === S.shirt).color, hat = HATS.find((h) => h.id === S.hat).hat, me = profile.email.split('@')[0];
    for (const e of all) {
      if (e.n) { const n = e.n; person(n.x, n.y, n.shirt, n.skin, n.face, n.name, n.kind === 'robber' ? '🎭' : '', n.sayT > 0 ? n.say : '', false); }
      else if (p.inRide && S.ride !== 'walk') {
        const big = ['car', 'sports'].includes(S.ride);
        car(p.x, p.y, p.face, ride.color, big ? 54 : 34, big ? 28 : 16);
        if (!big) { g.fillStyle = SKIN[0]; g.beginPath(); g.arc(p.x, p.y, 8, 0, 7); g.fill(); }
        g.font = '800 13px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#1f4fd1'; g.fillText(me, p.x, p.y - 26);
        if (p.sayT > 0) bubbleAt(p.x, p.y - 40, p.say);
      } else person(p.x, p.y, shirt, SKIN[0], p.face, me, hat, p.sayT > 0 ? p.say : '', true);
    }
    for (const q of W.parts) { g.globalAlpha = Math.max(0, q.life / 0.6); g.fillStyle = q.c; g.beginPath(); g.arc(q.x, q.y, 4, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    for (const f of W.floats) { g.globalAlpha = Math.min(1, f.t); g.fillStyle = '#e89a00'; g.font = '700 22px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(f.txt, f.x, f.y); }
    g.globalAlpha = 1;
    if (W.near) { const d = doorOf(W.near); bubbleAt(d.x, d.y - 4, A.scr.classList.contains('touch') ? 'Tap ACT' : 'Press E'); }
    // off-screen arrow to target
    if (tgt) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      const sx = (tgt.x - cx) * z + v.w / 2, sy = (tgt.y - cy) * z + v.h / 2, m = 40 * v.d;
      if (sx < m || sx > v.w - m || sy < m + 50 * v.d || sy > v.h - m) {
        const a = Math.atan2(sy - v.h / 2, sx - v.w / 2), ex = Math.max(m, Math.min(v.w - m, sx)), ey = Math.max(m + 50 * v.d, Math.min(v.h - m, sy));
        g.save(); g.translate(ex, ey); g.rotate(a); g.fillStyle = '#ff4d5e'; g.beginPath(); g.moveTo(18 * v.d, 0); g.lineTo(-10 * v.d, -12 * v.d); g.lineTo(-10 * v.d, 12 * v.d); g.fill(); g.restore();
      }
    }
  }

  /* ---------- lobby ---------- */
  A.onTab = (t) => {
    S = DB.load();
    const re = () => A.onTab(t);
    if (t === 'play') {
      const n = Object.values(S.done).reduce((a, b) => a + b, 0);
      A.panel('play').innerHTML = L.playCard('🏙️', 'Welcome to town!', 'Walk into the Pizza Place, Hospital, Police or Fire Station to get a job. Every task pays points. Chat with townspeople, and show off your outfit and ride.', [`💼 ${n} jobs done`, `${RIDES.find((r) => r.id === S.ride).icon} ${RIDES.find((r) => r.id === S.ride).name}`, S.house ? '🏠 You own a house' : '🏠 No house yet'], 'tw-go', 'Enter town');
      $('#tw-go').onclick = start;
    } else if (t === 'style') {
      A.panel('style').innerHTML = '<h2 class="section-title" style="margin-top:18px">Outfits</h2><div class="items" id="tw-shirts"></div><h2 class="section-title">Hats</h2><div class="items" id="tw-hats"></div>';
      $('#tw-shirts').innerHTML = L.shopCards(SHIRTS, S.owned.shirts, S.shirt, 'data-tws');
      $('#tw-hats').innerHTML = L.shopCards(HATS, S.owned.hats, S.hat, 'data-twh');
      bindOwned('data-tws', SHIRTS, 'shirts', 'shirt', re); bindOwned('data-twh', HATS, 'hats', 'hat', re);
    } else if (t === 'rides') {
      A.panel('rides').innerHTML = '<div class="items" id="tw-rides"></div>';
      $('#tw-rides').innerHTML = L.shopCards(RIDES, S.owned.rides, S.ride, 'data-twr');
      bindOwned('data-twr', RIDES, 'rides', 'ride', re);
    } else {
      A.panel('home').innerHTML = `<div class="item" style="margin-top:18px;max-width:520px"><div class="item-head"><div class="ico">🏠</div><div><h3>${S.house ? 'Your house' : 'Buy a house'}</h3><p>${S.house ? 'House 8 has your name on it, and you start each visit right at your front door.' : 'Own House 8 on the street. Your name goes on the sign and you start at your front door.'}</p></div></div>${S.house ? '<button class="btn ghost" disabled>You own it</button>' : `<button class="btn gold" id="tw-buyhouse" ${Wallet.get() < HOUSE_COST ? 'disabled' : ''}>Buy for ⭐ ${HOUSE_COST.toLocaleString()}</button>`}</div>`;
      const b = $('#tw-buyhouse'); if (b) b.onclick = () => { if (!Wallet.spend(HOUSE_COST)) return; S.house = true; save(); toast('You bought a house!'); re(); };
    }
  };
  function bindOwned(attr, list, ownedKey, curKey, re) {
    $$('[' + attr + ']').forEach((b) => (b.onclick = () => {
      const it = list.find((x) => x.id === b.getAttribute(attr));
      if (!S.owned[ownedKey].includes(it.id)) { if (!Wallet.spend(it.cost)) return; S.owned[ownedKey].push(it.id); toast(it.name + ' bought'); }
      S[curKey] = it.id; save(); re();
    }));
  }
})();
