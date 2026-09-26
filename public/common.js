/* LSPGames shared helpers for games loaded after index.html (uses $, $$, store, show, toast, Wallet, profile). */
(function () {
  'use strict';
  const css = `
  .gcard.play{cursor:pointer;text-align:left;padding:0;display:flex;flex-direction:column;box-shadow:0 5px 0 var(--line);font:inherit;color:inherit}
  .gcard.play:active{transform:translateY(3px);box-shadow:0 2px 0 var(--line)}
  .gcard.play .thumb{height:118px;font-size:52px;width:100%}
  .gcard .meta p.gdesc{font-size:14px;color:var(--muted);margin-top:2px}
  .gcard .prog{font-size:13px;font-weight:800;margin-top:6px}
  .gscreen{position:fixed;inset:0;background:#e6ecf7;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
  .gscreen .gcv{position:absolute;inset:0;width:100%;height:100%;display:block}
  .gpanel{display:none}.gpanel.on{display:block}
  .gpad{position:absolute;bottom:calc(20px + env(safe-area-inset-bottom,0px));display:none;gap:10px;align-items:flex-end}
  .gpad-l{left:18px}.gpad-r{right:18px}
  .touch .gpad{display:flex}
  .kbtn.jump{width:104px;height:104px;border-radius:50%;background:var(--brand);color:#fff;border-color:var(--brand);box-shadow:0 5px 0 var(--brand-d);font-size:18px}
  .statline{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
  .gscreen .help{animation:lspHelpFade .6s 6s forwards}
  @keyframes lspHelpFade{to{opacity:0;visibility:hidden}}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const hubHooks = [];
  const fmt = (n) => {
    n = Math.floor(n);
    if (n < 1e4) return n.toLocaleString();
    const u = [['T', 1e12], ['B', 1e9], ['M', 1e6], ['K', 1e3]];
    for (const [s, v] of u) if (n >= v) return (n / v).toFixed(n / v < 100 ? 2 : 1).replace(/\.?0+$/, '') + s;
    return String(n);
  };

  window.LSPG = {
    fmt,
    addCard(o) {
      const grid = $('#' + (o.grid || 'arcade-games')); if (!grid) return;
      const b = document.createElement('button');
      b.className = 'gcard play'; b.id = o.id;
      b.innerHTML = `<div class="thumb" style="background:${o.bg}">${o.emoji}</div><div class="meta"><h3>${o.title}</h3><p class="gdesc">${o.desc}</p><p class="prog" id="${o.id}-prog"></p></div>`;
      b.onclick = o.open; grid.appendChild(b); return b;
    },
    setProg(id, t) { const e = document.getElementById(id + '-prog'); if (e) e.textContent = t; },
    onHub(fn) { hubHooks.push(fn); },
    runHub() { if (!profile) return; hubHooks.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); },
    isTouch() { return matchMedia('(pointer: coarse)').matches; },
    fit(cv) { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); return d; },
    tabs(rootSel, onChange) {
      const set = (t) => { $$(rootSel + ' .tab').forEach((x) => x.classList.toggle('on', x.dataset.t === t)); $$(rootSel + ' .gpanel').forEach((p) => p.classList.toggle('on', p.dataset.p === t)); if (onChange) onChange(t); };
      $$(rootSel + ' .tab').forEach((b) => (b.onclick = () => set(b.dataset.t)));
      return set;
    },
    modal(id, html, actions) {
      const m = document.getElementById(id); m.querySelector('.modal-card').innerHTML = html; m.classList.add('open');
      m.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => { const f = actions && actions[b.dataset.a]; if (f) f(); }));
    },
    closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('open'); },
    holdButtons(rootSel, state) {
      $$(rootSel + ' [data-k]').forEach((b) => {
        const k = b.dataset.k;
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); state[k] = true; b.classList.add('held'); try { b.setPointerCapture(e.pointerId); } catch (_) {} });
        const up = () => { state[k] = false; b.classList.remove('held'); };
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => b.addEventListener(t, up));
      });
    },
    rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); },
    rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
    isActive(id) { const e = document.getElementById(id); return !!(e && e.classList.contains('active')); },
    upgradeCards(list, levels, costs, max, dataAttr) {
      const pts = Wallet.get();
      return list.map((u) => {
        const lv = levels[u.id] || 0, done = lv >= max, cost = costs[lv];
        return `<div class="item"><div class="item-head"><div class="ico">${u.icon}</div><div><h3>${u.name}</h3><p>${u.desc}</p></div></div>
          <div class="dots" aria-label="Level ${lv} of ${max}">${Array.from({ length: max }, (_, i) => `<b class="${i < lv ? 'on' : ''}"></b>`).join('')}</div>
          ${done ? '<button class="btn ghost" disabled>Maxed out</button>' : `<button class="btn gold" ${dataAttr}="${u.id}" ${pts < cost ? 'disabled' : ''}>Upgrade for ⭐ ${cost.toLocaleString()}</button>`}</div>`;
      }).join('');
    },
    skinCards(list, owned, current, dataAttr) {
      const pts = Wallet.get();
      return list.map((s) => {
        const has = owned.includes(s.id), on = current === s.id;
        const btn = on ? '<button class="btn ghost" disabled>Equipped</button>' : has ? `<button class="btn primary" ${dataAttr}="${s.id}">Equip</button>` : `<button class="btn gold" ${dataAttr}="${s.id}" ${pts < s.cost ? 'disabled' : ''}>Buy for ⭐ ${s.cost.toLocaleString()}</button>`;
        return `<div class="item${on ? ' eq' : ''}"><div class="item-head"><div class="ico" style="background:${s.bg || '#eef3ff'}"><span style="display:block;width:26px;height:26px;border-radius:8px;background:${s.color};box-shadow:inset 0 -4px 0 rgba(0,0,0,.15)"></span></div><div><h3>${s.name}</h3><p>${s.cost ? 'Skin' : 'Free skin'}</p></div></div>${btn}</div>`;
      }).join('');
    },

    /* Per-user save: LSPG.store('name', defaults) -> { load(), save(data) } */
    store(name, def) {
      const key = () => 'lsp_' + name + '_' + profile.email;
      const merge = (d, v) => { for (const k in d) { if (v[k] === undefined) v[k] = JSON.parse(JSON.stringify(d[k])); else if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) merge(d[k], v[k]); } return v; };
      return { load: () => merge(def, store.get(key(), {}) || {}), save: (d) => store.set(key(), d) };
    },
    /* Game shell: lobby screen with tabs + full-screen play screen with canvas, HUD, pause, modal. */
    makeGame(o) {
      const k = o.key, tabs = o.tabs || [['play', 'Play']];
      document.body.insertAdjacentHTML('beforeend', `
      <section class="screen" id="s-${k}-l" style="overflow:auto">
        <header class="topbar"><div class="topbar-in">
          <button class="iconbtn" id="${k}-back" aria-label="Back to games">‹</button>
          <h2 style="font-size:20px">${o.title}</h2><div class="spacer"></div>
          <span class="pill" title="LSP points">⭐ <span class="js-points">0</span></span>
        </div></header>
        <main class="wrap">
          ${tabs.length > 1 ? `<div class="tabs" role="tablist">${tabs.map(([id, l], i) => `<button class="tab${i ? '' : ' on'}" data-t="${id}" role="tab">${l}</button>`).join('')}</div>` : ''}
          ${tabs.map(([id], i) => `<div class="gpanel${i ? '' : ' on'}" data-p="${id}" id="${k}-p-${id}"></div>`).join('')}
        </main>
      </section>
      <section class="screen gscreen" id="s-${k}" style="${o.bg ? 'background:' + o.bg : ''}">
        <canvas class="gcv" id="${k}-cv"></canvas>
        <div class="hud"><button class="iconbtn" id="${k}-pause" aria-label="Pause">⏸</button>${o.hud || ''}</div>
        ${o.padsL ? `<div class="gpad gpad-l">${o.padsL}</div>` : ''}${o.padsR ? `<div class="gpad gpad-r">${o.padsR}</div>` : ''}
        ${o.help ? `<div class="help">${o.help}</div>` : ''}
        ${o.rotate === false ? '' : '<div class="rotate hudpill">Turn your phone sideways for a bigger view</div>'}
        <div class="modal" id="${k}-modal"><div class="modal-card"></div></div>
      </section>`);
      const api = { key: k, scr: $('#s-' + k), cv: $('#' + k + '-cv'), keys: {}, tin: {}, paused: false, over: false, raf: 0, view: { s: 1, ox: 0, oy: 0, d: 1 }, world: o.world || null };
      api.g = api.cv.getContext('2d');
      api.panel = (id) => $('#' + k + '-p-' + id);
      api.setTab = LSPG.tabs('#s-' + k + '-l', (t) => { if (api.onTab) api.onTab(t); refreshPoints(); });
      api.openLobby = (t) => { api.stop(); show('s-' + k + '-l'); api.setTab(t || tabs[0][0]); };
      api.modal = (html, actions) => LSPG.modal(k + '-modal', html, actions);
      api.closeModal = () => LSPG.closeModal(k + '-modal');
      api.fit = () => {
        const d = LSPG.fit(api.cv), v = api.view; v.d = d; v.w = api.cv.width; v.h = api.cv.height;
        const touch = api.scr.classList.contains('touch');
        v.top = 58 * d; v.bottom = (touch && o.padReserve ? o.padReserve : 8) * d;
        if (api.world) { const W = api.world.w, H = api.world.h; v.s = Math.min(v.w / W, (v.h - v.top - v.bottom) / H); v.ox = (v.w - W * v.s) / 2; v.oy = v.top + (v.h - v.top - v.bottom - H * v.s) / 2; }
        api.scr.classList.toggle('portrait', innerHeight > innerWidth && o.rotate !== false);
        if (api.onFit) api.onFit();
      };
      api.begin = () => { const v = api.view, g = api.g; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = o.bg || '#e6ecf7'; g.fillRect(0, 0, v.w, v.h); if (api.world) g.setTransform(v.s, 0, 0, v.s, v.ox, v.oy); };
      api.toWorld = (e) => { const r = api.cv.getBoundingClientRect(), v = api.view; return { x: ((e.clientX - r.left) * v.d - v.ox) / v.s, y: ((e.clientY - r.top) * v.d - v.oy) / v.s }; };
      api.play = () => { api.scr.classList.toggle('touch', LSPG.isTouch()); api.closeModal(); api.paused = false; api.over = false; show('s-' + k); api.fit(); };
      api.run = (step) => {
        cancelAnimationFrame(api.raf); let last = performance.now();
        const f = (t) => { if (!LSPG.isActive('s-' + k)) { api.raf = 0; return; } api.raf = requestAnimationFrame(f); const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t; step(api.paused ? 0 : dt); };
        api.raf = requestAnimationFrame(f);
      };
      api.stop = () => { cancelAnimationFrame(api.raf); api.raf = 0; api.closeModal(); for (const x in api.keys) api.keys[x] = false; for (const x in api.tin) api.tin[x] = false; };
      api.togglePause = () => {
        if (api.over) return;
        if (api.paused) { api.paused = false; api.closeModal(); return; }
        api.paused = true;
        api.modal(`<h2>Paused</h2><p class="muted">${o.quitNote || 'Quitting ends this round without points.'}</p><div class="modal-actions"><button class="btn primary" data-a="resume">Resume</button><button class="btn ghost" data-a="quit">Quit</button></div>`,
          { resume: api.togglePause, quit: () => { if (api.onQuit) api.onQuit(); api.openLobby(); } });
      };
      api.end = (title, got, text, buttons) => {
        api.over = true; refreshPoints();
        const acts = {}, html = (buttons || [['again', 'Play again', 'primary'], ['lobby', 'Back', 'ghost']]).map(([id, label, cls, fn]) => { acts[id] = fn || (id === 'lobby' ? () => api.openLobby() : () => api.onAgain && api.onAgain()); return `<button class="btn ${cls || 'ghost'}" data-a="${id}">${label}</button>`; }).join('');
        api.modal(`<h2>${title}</h2>${got != null ? `<p class="big">⭐ +${got.toLocaleString()}</p>` : ''}<p class="muted">${text || ''}</p><div class="modal-actions">${html}</div>`, acts);
      };
      $('#' + k + '-pause').onclick = api.togglePause;
      $('#' + k + '-back').onclick = () => { api.stop(); if (api.onLeave) api.onLeave(); enterHub(); };
      LSPG.holdButtons('#s-' + k, api.tin);
      addEventListener('keydown', (e) => {
        if (!LSPG.isActive('s-' + k)) return;
        if (e.code === 'Escape' || e.code === 'KeyP') { api.togglePause(); return; }
        api.keys[e.code] = true; if (api.onKey) api.onKey(e.code);
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      });
      addEventListener('keyup', (e) => { api.keys[e.code] = false; });
      addEventListener('blur', () => { for (const x in api.keys) api.keys[x] = false; });
      addEventListener('resize', () => { if (LSPG.isActive('s-' + k)) api.fit(); });
      api.cv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !api.scr.classList.contains('touch')) { api.scr.classList.add('touch'); api.fit(); } });
      LSPG.addCard({ id: 'card-' + k, emoji: o.emoji, bg: o.cardBg, title: o.title, desc: o.desc, grid: o.grid, open: () => api.openLobby() });
      if (o.progress) LSPG.onHub(() => LSPG.setProg('card-' + k, o.progress()));
      return api;
    },
    /* Simple buy/equip shop rows for anything with {id,name,icon,cost,desc} */
    shopCards(list, owned, current, attr) {
      const pts = Wallet.get();
      return list.map((s) => {
        const has = owned.includes(s.id), on = current === s.id;
        const btn = on ? '<button class="btn ghost" disabled>Equipped</button>' : has ? `<button class="btn primary" ${attr}="${s.id}">Use</button>` : `<button class="btn gold" ${attr}="${s.id}" ${pts < s.cost ? 'disabled' : ''}>Buy for ⭐ ${s.cost.toLocaleString()}</button>`;
        return `<div class="item${on ? ' eq' : ''}"><div class="item-head"><div class="ico">${s.icon}</div><div><h3>${s.name}</h3><p>${s.desc || ''}</p></div></div>${btn}</div>`;
      }).join('');
    },
    bindBuy(attr, list, S, save, rerender, ownedKey, curKey) {
      $$('[' + attr + ']').forEach((b) => (b.onclick = () => {
        const it = list.find((x) => x.id === b.getAttribute(attr));
        if (!S[ownedKey].includes(it.id)) { if (!Wallet.spend(it.cost)) return; S[ownedKey].push(it.id); toast(it.name + ' unlocked'); }
        S[curKey] = it.id; save(); rerender();
      }));
    },
    bindUpg(attr, S, costs, save, rerender) {
      $$('[' + attr + ']').forEach((b) => (b.onclick = () => { const id = b.getAttribute(attr), c = costs[S.upg[id]]; if (!Wallet.spend(c)) return; S.upg[id]++; save(); rerender(); toast('Upgrade installed'); }));
    },
    playCard(icon, title, text, stats, btnId, btnLabel) {
      return `<div class="item" style="margin-top:18px;max-width:560px"><div class="item-head"><div class="ico">${icon}</div><div><h3>${title}</h3><p>${text}</p></div></div><div class="statline">${stats.map((x) => `<span class="pill">${x}</span>`).join('')}</div><button class="btn primary" id="${btnId}">${btnLabel || 'Play'}</button></div>`;
    },
  };
})();
