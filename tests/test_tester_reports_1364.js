// v1364 (tester reports 11 Nov): (P13) closing Arena Rules left the dark backdrop on screen - the close button removed only the card;
// (2.6) a message fired from inside a hero window (Stars 13000, glyph / gear windows 12000) sat behind it at z 9600.
// Runs the real function text against a tiny DOM. CONTROL: both fail on v1363.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
function slice(src, a, b) { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < i) throw new Error('not found: ' + a); return src.slice(i, j); }
function el(tag) { const e = { tag, style: {}, children: [], parentNode: null, _q: {}, classList: { add() {}, remove() {} }, offsetWidth: 0,
  appendChild(c) { c.parentNode = e; e.children.push(c); return c; }, remove() { if (e.parentNode) { e.parentNode.children = e.parentNode.children.filter(x => x !== e); e.parentNode = null; } },
  querySelector(s) { return e._q[s] || null; }, set innerHTML(v) { e._html = v; const m = /id="([^"]+)"/.exec(v); if (m) e._q['#' + m[1]] = { onclick: null }; }, get innerHTML() { return e._html || ''; } }; return e; }
function arena(src) {
  const body = el('body'); const ctx = { t: k => k, document: { createElement: () => el('div'), body } };
  vm.runInNewContext(slice(src, 'function arenaRules(){', 'function rankTier(') + '\nthis.go=arenaRules;', ctx); ctx.go();
  const ov = body.children[0]; const x = ov && ov.querySelector('#arRulesX');
  if (!x || !x.onclick) return { closed: false, html: ov ? ov.innerHTML : '' };
  x.onclick(); return { closed: body.children.length === 0 };
}
function banner(src) {
  const b = el('div'); b.id = 'banner'; const modal = el('div'); modal._cs = { position: 'fixed', display: 'flex', visibility: 'visible', zIndex: '13000' };
  b._cs = { position: 'absolute', display: 'none', visibility: 'visible', zIndex: '9600' };
  const body = { children: [b, modal] };
  const ctx = { window: {}, String, parseInt, setTimeout: () => 0, rewardLocked: () => false, queueBehindReward() {}, langMsg: s => s, ewT: k => k,
    getComputedStyle: e => e._cs, document: { getElementById: id => (id === 'banner' ? b : null), body } };
  vm.runInNewContext(slice(src, 'function bannerMsg(t){', '\n// (matIcon deleted') + '\nthis.go=bannerMsg;', ctx); ctx.go('Glyph crafted');
  return +(b.style.zIndex || 9600);
}
const cur = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const old = cp.execSync('git show e68f7437:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
ck('Arena Rules: the close button removes the whole overlay', arena(cur).closed === true);
ck('CONTROL: v1363 left the overlay on screen', arena(old).closed === false);
const zn = banner(cur), zo = banner(old);
ck('a message sits above an open 13000 window', zn > 13000 && zn < 15000, String(zn));
ck('CONTROL: v1363 put it behind (9600)', zo === 9600, String(zo));
console.log('test_tester_reports_1364.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
