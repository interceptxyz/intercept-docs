// Static docs generator: content/**/*.md -> dist/**/index.html
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { Marked } = require('marked');
const hljs = require('highlight.js/lib/core');
hljs.registerLanguage('typescript', require('highlight.js/lib/languages/typescript'));
hljs.registerLanguage('json', require('highlight.js/lib/languages/json'));
hljs.registerLanguage('bash', require('highlight.js/lib/languages/bash'));
const NAV = require('./nav');
const diagrams = require('./diagrams');

const SITE = 'https://docs.intercepting.xyz';
const MAIN_SITE = 'https://www.intercepting.xyz';
const X_URL = 'https://x.com/interdotxyz';
const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const ALIASES = { ts: 'typescript', tsx: 'typescript', js: 'typescript', javascript: 'typescript', sh: 'bash', shell: 'bash' };

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

const ICONS = {
  flag: '<path d="M4 21V4m0 0h11l-2 4 2 4H4"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  gauge: '<path d="M4 15a8 8 0 1 1 16 0"/><path d="m12 15 4-5"/>',
  shield: '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z"/>',
  network: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v5m0 0-6 5m6-5 6 5"/>',
  code: '<path d="m8 8-4 4 4 4m8-8 4 4-4 4"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrowL: '<path d="M19 12H5m6-6-6 6 6 6"/>',
  arrowR: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
const icon = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const X_ICON = '<svg class="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.9 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/></svg>';

// ---------- pages ----------
const pages = [];
for (const sec of NAV) for (const [slug, navTitle] of sec.pages) {
  const file = path.join(ROOT, 'content', sec.id, slug + '.md');
  const isIntro = sec.id === 'getting-started' && slug === 'introduction';
  pages.push({ sec, slug, navTitle, file, url: isIntro ? '/' : `/${sec.id}/${slug}`, exists: fs.existsSync(file) });
}

// ---------- markdown ----------
function render(md) {
  const toc = [];
  const used = new Map();
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading(textHtml, level) {
        let id = slugify(textHtml) || 'section';
        const n = used.get(id) || 0; used.set(id, n + 1); if (n) id += '-' + n;
        if (level === 2 || level === 3) toc.push({ id, level, text: textHtml.replace(/<[^>]+>/g, '') });
        return `<h${level} id="${id}"><a class="anchor" href="#${id}" aria-label="Link to this section">${icon('link')}</a>${textHtml}</h${level}>\n`;
      },
      code(code, lang) {
        const l = ALIASES[(lang || '').trim()] || (lang || '').trim();
        const body = hljs.getLanguage(l) ? hljs.highlight(code, { language: l }).value : esc(code);
        const label = { typescript: 'TypeScript', json: 'JSON', bash: 'Shell' }[l] || (l || 'text');
        return `<div class="code"><div class="code-head"><span>${esc(label)}</span><button class="copy" type="button" aria-label="Copy code">Copy</button></div><pre><code class="hljs language-${esc(l)}">${body}</code></pre></div>\n`;
      },
      table(header, body) {
        return `<div class="table-wrap"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>\n`;
      },
      link(href, title, textHtml) {
        const ext = /^https?:/.test(href) && !href.startsWith(SITE);
        return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}${ext ? ' target="_blank" rel="noopener"' : ''}>${textHtml}</a>`;
      },
      blockquote(quote) {
        const m = quote.match(/^\s*<p>\[!(NOTE|TIP|WARNING|ILLUSTRATIVE|IMPORTANT|CAUTION)\]\s*/);
        if (!m) return `<blockquote>${quote}</blockquote>\n`;
        const type = m[1].toLowerCase();
        const label = { note: 'Note', tip: 'Tip', warning: 'Warning', illustrative: 'Illustrative', important: 'Important', caution: 'Caution' }[type];
        return `<aside class="callout callout-${type}"><div class="callout-title">${label}</div>${quote.replace(m[0], '<p>').replace(/<p>\s*<\/p>/, '')}</aside>\n`;
      },
    },
  });
  const html = diagrams(marked.parse(md));
  return { html, toc };
}

// ---------- layout ----------
const sidebar = cur => NAV.map(sec => {
  const open = sec.id === cur.sec.id;
  const items = sec.pages.map(([slug, t]) => {
    const p = pages.find(x => x.sec.id === sec.id && x.slug === slug);
    const active = p === cur;
    return `<li><a href="${p.url}"${active ? ' class="active" aria-current="page"' : ''}>${esc(t)}</a></li>`;
  }).join('');
  return `<div class="nav-group${open ? ' open' : ''}"><button class="nav-head" type="button" aria-expanded="${open}">${icon(sec.icon)}<span>${esc(sec.title)}</span>${icon('chevron', 'i chev')}</button><ul>${items}</ul></div>`;
}).join('');

function layout(p, body, toc, prev, next, fm) {
  const title = p.url === '/' ? 'Intercept Docs — Security before execution' : `${fm.title} — Intercept Docs`;
  const canonical = SITE + (p.url === '/' ? '/' : p.url);
  const tocHtml = toc.length ? `<div class="toc-title">On this page</div><ul>${toc.map(t => `<li class="l${t.level}"><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ul>` : '';
  const pager = `<nav class="pager" aria-label="Pagination">${prev ? `<a class="prev" href="${prev.url}"><span>${icon('arrowL')} Previous</span><strong>${esc(prev.navTitle)}</strong></a>` : '<span></span>'}${next ? `<a class="next" href="${next.url}"><span>Next ${icon('arrowR')}</span><strong>${esc(next.navTitle)}</strong></a>` : '<span></span>'}</nav>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(fm.description || '')}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Intercept Docs">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(fm.description || '')}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/og.png?v=2">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(fm.description || '')}">
<meta name="twitter:image" content="${SITE}/og.png?v=2">
<meta name="theme-color" content="#050607">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/favicon-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Poppins:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/docs.css">
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header class="top">
  <button class="menu-btn" type="button" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button>
  <a class="brand" href="/"><img src="/assets/mark.png" alt="" width="22" height="22"><span class="brand-name">Intercept</span><span class="brand-sep"></span><span class="brand-label">Documentation</span></a>
  <button class="search-btn" type="button" aria-label="Search documentation" data-search>${icon('search')}<span>Search docs</span><kbd>⌘K</kbd></button>
  <nav class="top-links" aria-label="External">
    <a href="${MAIN_SITE}" target="_blank" rel="noopener">Website ${icon('ext', 'i sm')}</a>
    <a href="${X_URL}" target="_blank" rel="noopener" aria-label="Intercept on X">${X_ICON}</a>
  </nav>
</header>
<div class="shell">
  <aside class="sidebar" id="sidebar" aria-label="Documentation">
    <button class="search-btn side" type="button" data-search>${icon('search')}<span>Search</span><kbd>⌘K</kbd></button>
    <nav>${sidebar(p)}</nav>
    <div class="side-foot">Security before execution.</div>
  </aside>
  <div class="scrim" hidden></div>
  <main id="content" class="content">
    <div class="crumbs"><a href="/">Docs</a><span>/</span><span>${esc(p.sec.title)}</span>${p.url === '/' ? '' : `<span>/</span><span class="cur">${esc(p.navTitle)}</span>`}</div>
    <header class="page-head">
      ${fm.status ? `<div class="status"><span class="dot"></span>${esc(fm.status)}</div>` : ''}
      <h1>${esc(fm.title)}</h1>
      ${fm.description ? `<p class="lede">${esc(fm.description)}</p>` : ''}
    </header>
    <article class="prose">${body}</article>
    ${pager}
    <footer class="foot"><span>© Intercept</span><span>Documentation describes planned functionality unless stated otherwise.</span></footer>
  </main>
  <aside class="toc" aria-label="On this page">${tocHtml}</aside>
</div>
<div class="search-dialog" role="dialog" aria-modal="true" aria-label="Search documentation" hidden>
  <div class="search-panel">
    <div class="search-input">${icon('search')}<input type="search" placeholder="Search the documentation" autocomplete="off" spellcheck="false" aria-label="Search"><kbd>Esc</kbd></div>
    <ul class="search-results" role="listbox"></ul>
    <div class="search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>Esc</kbd> close</span></div>
  </div>
</div>
<script src="/assets/docs.js" defer></script>
</body>
</html>
`;
}

// ---------- build ----------
for (const e of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) if (e !== '.vercel') fs.rmSync(path.join(OUT, e), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
const live = pages.filter(p => p.exists);
const missing = pages.filter(p => !p.exists).map(p => path.relative(ROOT, p.file));
const index = [];
live.forEach((p, i) => {
  const { data: fm, content } = matter(fs.readFileSync(p.file, 'utf8'));
  fm.title = fm.title || p.navTitle;
  const { html, toc } = render(content);
  const out = path.join(OUT, p.url === '/' ? '' : p.url, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, layout(p, html, toc, live[i - 1], live[i + 1], fm));
  const plain = html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
  index.push({ u: p.url, t: fm.title, s: p.sec.title, d: fm.description || '', h: toc.map(t => [t.id, t.text]), x: plain.slice(0, 6000) });
});
fs.writeFileSync(path.join(OUT, 'search-index.json'), JSON.stringify(index));
for (const f of ['docs.css', 'docs.js', 'mark.png']) fs.copyFileSync(path.join(ROOT, 'assets', f), path.join(OUT, 'assets', f));
for (const f of ['favicon-32.png', 'favicon-180.png', 'og.png']) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
fs.writeFileSync(path.join(OUT, 'vercel.json'), JSON.stringify({ cleanUrls: true, trailingSlash: false }, null, 2));
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${live.map(p => `<url><loc>${SITE}${p.url === '/' ? '/' : p.url}</loc></url>`).join('\n')}\n</urlset>\n`);
// 404
const nf = { sec: { id: '', title: 'Docs' }, slug: '404', navTitle: 'Not found', url: '/404' };
fs.writeFileSync(path.join(OUT, '404.html'), layout(nf, '<p>This page does not exist. Use the sidebar or search to find what you are looking for.</p><p><a href="/">Back to the introduction</a></p>', [], null, live[0], { title: 'Page not found', description: 'The requested documentation page does not exist.' }));
console.log(`built ${live.length} pages` + (missing.length ? `, missing ${missing.length}: ${missing.join(', ')}` : ''));
