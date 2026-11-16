// Monochrome SVG diagrams, styled by docs.css (.d-*) so they follow the theme.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function box(x, y, w, h, label, sub, cls = '') {
  return `<g class="d-node ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>` +
    `<text class="d-label" x="${x + w / 2}" y="${y + h / 2 + (sub ? -3 : 4)}" text-anchor="middle">${esc(label)}</text>` +
    (sub ? `<text class="d-sub" x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle">${esc(sub)}</text>` : '') + '</g>';
}
const arrow = (x1, y1, x2, y2, cls = '') => `<line class="d-edge ${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#d-arrow)"/>`;
const path = (d, cls = '') => `<path class="d-edge ${cls}" d="${d}" fill="none" marker-end="url(#d-arrow)"/>`;
const text = (x, y, s, cls = 'd-sub', anchor = 'middle') => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;
const defs = `<defs><marker id="d-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="d-head"/></marker></defs>`;

function wrap(id, w, h, body, caption) {
  return `<figure class="diagram" id="diagram-${id}"><div class="diagram-scroll"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(caption)}" xmlns="http://www.w3.org/2000/svg">${defs}${body}</svg></div><figcaption>${esc(caption)}</figcaption></figure>`;
}

const D = {
  architecture() {
    let b = '';
    b += box(20, 110, 140, 64, 'AI Agent', 'proposes transaction');
    // execution layer
    b += `<g class="d-group"><rect x="210" y="30" width="340" height="224" rx="8"/></g>`;
    b += text(380, 56, 'INTERCEPT EXECUTION LAYER', 'd-kicker');
    b += box(234, 78, 292, 34, 'Simulation', '', 'd-thin');
    b += box(234, 128, 138, 70, 'Risk Engine', 'financial limits');
    b += box(388, 128, 138, 70, 'Security Engine', 'threat prevention');
    b += box(234, 210, 292, 30, 'Decision + enforcement', '', 'd-thin');
    b += box(600, 110, 140, 64, 'Chain', 'onchain execution');
    b += arrow(160, 142, 208, 142);
    b += arrow(550, 142, 598, 142);
    b += arrow(303, 112, 303, 126) + arrow(457, 112, 457, 126);
    b += arrow(303, 198, 303, 208) + arrow(457, 198, 457, 208);
    return wrap('architecture', 760, 280, b, 'AI Agent → Intercept Execution Layer (Risk Engine, Security Engine) → chain');
  },
  lifecycle() {
    const steps = [['1', 'Proposed'], ['2', 'Simulation'], ['3', 'Risk evaluation'], ['4', 'Security verification'], ['5', 'Decision']];
    let b = '';
    const w = 134, gap = 13, y = 30;
    steps.forEach(([n, l], i) => {
      const x = 20 + i * (w + gap);
      b += `<g class="d-node"><rect x="${x}" y="${y}" width="${w}" height="58" rx="6"/>` +
        `<text class="d-step" x="${x + 12}" y="${y + 20}">${n}</text>` +
        `<text class="d-label d-small" x="${x + 12}" y="${y + 42}">${esc(l)}</text></g>`;
      if (i < steps.length - 1) b += arrow(x + w, y + 29, x + w + gap - 1, y + 29);
    });
    const dx = 20 + 4 * (w + gap) + w / 2; // decision centre x
    const outs = [['Approved', 'executes onchain', 'd-ok', 140], ['Requires approval', 'held for owner or operator', 'd-warn', 380], ['Blocked', 'never reaches the chain', 'd-bad', 620]];
    outs.forEach(([l, s, cls, cx]) => {
      b += path(`M${dx} ${y + 58} L${dx} ${y + 100} L${cx} ${y + 100} L${cx} ${y + 134}`, 'd-faint');
      b += `<g class="d-node ${cls}"><rect x="${cx - 100}" y="${y + 136}" width="200" height="58" rx="6"/>` +
        `<circle cx="${cx - 82}" cy="${y + 158}" r="4" class="d-dot"/>` +
        `<text class="d-label" x="${cx - 70}" y="${y + 162}">${esc(l)}</text>` +
        `<text class="d-sub" x="${cx - 70}" y="${y + 180}">${esc(s)}</text></g>`;
    });
    return wrap('lifecycle', 760, 244, b, 'Transaction evaluation: five stages, three possible outcomes');
  },
  enforcement() {
    let b = '';
    // advisory
    b += `<g class="d-group"><rect x="10" y="20" width="360" height="250" rx="8"/></g>`;
    b += text(30, 46, 'ADVISORY', 'd-kicker', 'start');
    b += box(40, 70, 120, 52, 'Agent', 'holds signing key');
    b += box(220, 70, 120, 52, 'Intercept', 'evaluate()');
    b += box(40, 200, 120, 46, 'Chain', '');
    b += arrow(160, 90, 218, 90);
    b += arrow(218, 106, 162, 106, 'd-faint');
    b += text(190, 84, 'ask', 'd-sub');
    b += text(190, 120, 'advice', 'd-sub');
    b += arrow(100, 122, 100, 198, 'd-bad-stroke');
    b += text(116, 156, 'agent signs alone', 'd-sub d-bad-text', 'start');
    b += text(116, 172, 'evaluate() can be skipped', 'd-sub', 'start');
    // enforced
    b += `<g class="d-group"><rect x="390" y="20" width="360" height="250" rx="8"/></g>`;
    b += text(410, 46, 'ENFORCED', 'd-kicker', 'start');
    b += box(420, 70, 120, 52, 'Agent', 'proposes only');
    b += box(600, 70, 120, 52, 'Intercept', 'policy signer');
    b += box(510, 160, 120, 46, 'Policy vault', '2 required signers');
    b += box(510, 226, 120, 34, 'Chain', '', 'd-thin');
    b += arrow(540, 96, 598, 96);
    b += path('M480 122 L480 183 L508 183');
    b += path('M660 122 L660 183 L632 183');
    b += arrow(570, 206, 570, 224);
    b += text(690, 226, 'no bypass path', 'd-sub d-ok-text', 'middle');
    return wrap('enforcement', 760, 290, b, 'Advisory integrations can be bypassed. Enforced integrations require Intercept as a co-signer.');
  },
  network() {
    let b = '';
    ['Agents', 'Wallets', 'Protocols'].forEach((l, i) => { b += box(20, 40 + i * 76, 140, 52, l, 'consume signals'); b += path(`M298 ${130 + i * 20} L164 ${66 + i * 76}`, 'd-faint'); });
    b += box(300, 112, 160, 76, 'Threat Registry', 'verified signals');
    b += box(600, 60, 140, 52, 'Security Operators', 'signed reports');
    b += box(600, 188, 140, 52, 'Verification', 'quorum + evidence');
    b += arrow(670, 112, 670, 186);
    b += path('M598 214 L462 166');
    b += text(680, 154, 'pending', 'd-sub', 'start');
    b += text(530, 206, 'verified', 'd-sub');
    return wrap('network', 760, 280, b, 'Proposed Intercept Network: operators report, verification gates the registry, connected systems consume it');
  },
};

module.exports = html => html.replace(/<!--\s*diagram:([a-z-]+)\s*-->/g, (m, id) => (D[id] ? D[id]() : m));
