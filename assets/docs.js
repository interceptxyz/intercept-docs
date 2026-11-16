(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const body = document.body;

  // ---- sidebar groups ----
  $$('.nav-head').forEach(btn => btn.addEventListener('click', () => {
    const g = btn.parentElement; const open = g.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  }));
  const active = $('.nav-group a.active');
  if (active) { const sb = $('.sidebar'); const r = active.getBoundingClientRect(); if (r.bottom > window.innerHeight - 40) sb.scrollTop = r.top - 200; }

  // ---- mobile drawer ----
  const menu = $('.menu-btn'), scrim = $('.scrim');
  const setNav = open => { body.classList.toggle('nav-open', open); menu.setAttribute('aria-expanded', String(open)); scrim.hidden = !open; };
  menu.addEventListener('click', () => setNav(!body.classList.contains('nav-open')));
  scrim.addEventListener('click', () => setNav(false));
  $$('.sidebar a').forEach(a => a.addEventListener('click', () => setNav(false)));

  // ---- copy buttons ----
  $$('.copy').forEach(btn => btn.addEventListener('click', async () => {
    const code = btn.closest('.code').querySelector('code').innerText;
    try { await navigator.clipboard.writeText(code); } catch {
      const t = document.createElement('textarea'); t.value = code; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    btn.textContent = 'Copied'; btn.classList.add('done');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('done'); }, 1600);
  }));

  // ---- TOC scrollspy ----
  const links = $$('.toc a');
  if (links.length) {
    const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const heads = [...map.keys()].map(id => document.getElementById(id)).filter(Boolean);
    const spy = () => {
      const y = window.scrollY + 110;
      let cur = heads[0];
      for (const h of heads) if (h.offsetTop <= y) cur = h;
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = heads[heads.length - 1];
      links.forEach(a => a.classList.remove('active'));
      if (cur) map.get(cur.id).classList.add('active');
    };
    let raf = 0;
    window.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(spy); }, { passive: true });
    spy();
  }

  // ---- search ----
  const dlg = $('.search-dialog'), input = $('.search-dialog input'), list = $('.search-results');
  let index = null, results = [], sel = 0, lastFocus = null;
  const load = () => index ? Promise.resolve(index) : fetch('/search-index.json').then(r => r.json()).then(d => (index = d));
  const escH = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const mark = (s, terms) => { let h = escH(s); terms.forEach(t => { h = h.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); }); return h; };

  function search(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(t => t.length > 1 || /\d/.test(t));
    if (!terms.length) return index.slice(0, 8).map(p => ({ p, url: p.u, title: p.t, snip: p.d }));
    const out = [];
    for (const p of index) {
      const T = p.t.toLowerCase(), D = p.d.toLowerCase(), X = p.x.toLowerCase();
      let score = 0, ok = true;
      for (const t of terms) {
        let s = 0;
        if (T.includes(t)) s += T.startsWith(t) ? 12 : 8;
        if (p.h.some(h => h[1].toLowerCase().includes(t))) s += 4;
        if (D.includes(t)) s += 3;
        const c = X.split(t).length - 1; if (c) s += Math.min(c, 6) * 0.6;
        if (!s) { ok = false; break; }
        score += s;
      }
      if (!ok) continue;
      // best heading + snippet
      const h = p.h.find(h => terms.some(t => h[1].toLowerCase().includes(t)));
      const i = X.indexOf(terms[0]);
      const snip = i >= 0 ? (i > 60 ? '…' : '') + p.x.slice(Math.max(0, i - 60), i + 120) + '…' : p.d;
      out.push({ p, score, url: p.u + (h ? '#' + h[0] : ''), title: p.t + (h ? ' › ' + h[1] : ''), snip });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 12).map(r => ({ ...r, terms }));
  }
  function draw() {
    if (!results.length) { list.innerHTML = '<li class="search-empty">No results. Try a different term.</li>'; return; }
    list.innerHTML = results.map((r, i) => `<li role="option" id="sr-${i}" aria-selected="${i === sel}"><a href="${r.url}"><div class="r-sec">${escH(r.p.s)}</div><div class="r-title">${mark(r.title, r.terms || [])}</div><div class="r-snip">${mark(r.snip, r.terms || [])}</div></a></li>`).join('');
    input.setAttribute('aria-activedescendant', 'sr-' + sel);
    const el = $('#sr-' + sel); if (el) el.scrollIntoView({ block: 'nearest' });
  }
  const run = () => load().then(() => { results = search(input.value.trim()); sel = 0; draw(); });
  function openSearch() { lastFocus = document.activeElement; dlg.hidden = false; body.style.overflow = 'hidden'; input.value = ''; input.focus(); run(); }
  function closeSearch() { dlg.hidden = true; body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
  $$('[data-search]').forEach(b => b.addEventListener('click', () => { setNav(false); openSearch(); }));
  dlg.addEventListener('click', e => { if (e.target === dlg) closeSearch(); });
  input.addEventListener('input', run);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, results.length - 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
    else if (e.key === 'Enter' && results[sel]) { e.preventDefault(); location.href = results[sel].url; closeSearch(); }
    else if (e.key === 'Tab') e.preventDefault();
  });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); dlg.hidden ? openSearch() : closeSearch(); }
    else if (e.key === '/' && dlg.hidden && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
    else if (e.key === 'Escape') { if (!dlg.hidden) closeSearch(); else if (body.classList.contains('nav-open')) setNav(false); }
  });
  if (!/Mac|iPhone|iPad/.test(navigator.platform)) $$('kbd').forEach(k => { if (k.textContent === '⌘K') k.textContent = 'Ctrl K'; });
})();
