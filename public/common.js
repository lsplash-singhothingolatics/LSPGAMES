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
      const grid = $('#more-games'); if (!grid) return;
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
  };
})();
