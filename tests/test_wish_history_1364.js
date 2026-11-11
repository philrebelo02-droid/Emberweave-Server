// v1364 (night smoke shops P2 + Grok EYES 11 Nov 01:32): Wishing "My roll history" went out as a banner (a text block over the pool, gone in 2 s)
// with raw result codes. It opens in the Wishing info card and names every result. Runs the real function text. CONTROL: the v1363 text banners.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
async function run(src) {
  const a = src.indexOf('function wishResultLabel('), b = src.indexOf('function renderWishing()', a); if (a < 0 || b < a) throw new Error('functions not found');
  const banners = [], made = []; let body = [];
  const el = () => { const e = { style: {}, _q: {}, set innerHTML(v) { e._html = v; }, get innerHTML() { return e._html || ''; }, querySelector(s) { return e._q[s] || (e._q[s] = { onclick: null }); }, remove() { e._gone = true; body = body.filter(x => x !== e); } }; return e; };
  const ctx = { console, Date, String, Promise,
    api: async () => ({ history: [{ t: 0, pool: 'gold', n: 10, results: ['hero:vael', 'frags:vex', 'dupe:vex', 'glyphFrag', 'glyphFull', 'shield', 'teleport', 'attackCard', 'gold', 'gems', 'stamItem', 'prayer'] }] }),
    bannerMsg: s => banners.push(s), t: k => k, ewT: (k, o) => k + (o && o.hero ? '<' + o.hero + '>' : ''), uiIcon: () => '', hudIcon: () => '', escapeHTML: s => String(s),
    HERO_TYPES: { vael: { name: 'Vael' }, vex: { name: 'Vex' } }, STAM_ITEM_NAME: 'Ember Roast',
    document: { getElementById: id => body.find(e => e.id === id) || null, createElement: () => { const e = el(); made.push(e); return e; }, body: { appendChild: e => body.push(e) } } };
  vm.runInNewContext(src.slice(a, b) + '\nthis.go=wishShowHistory;', ctx); await ctx.go();
  return { banners, made, body };
}
(async () => {
  const now = await run(fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8'));
  const card = now.body[0], html = card ? card.innerHTML : '';
  ck('history opens a card, not a banner', now.banners.length === 0 && !!card && card.className === 'wishInfoOv');
  ck('the card has a close button that removes it', !!card && (card.querySelector('#wishInfoX').onclick(), card._gone === true));
  ck('every result is named (no raw code left)', !/\b(shield|teleport|attackCard|glyphFull|stamItem|dupe|gems)\b/.test(html.replace(/wish\.[a-z_]+|econ\.[a-z]+|hero\.[a-z]+/g, '')), html.slice(-260));
  ck('owned hero and fragments carry the hero name', html.includes('wish.owned<Vex>') && html.includes('wish.label_frags<Vex>') && html.includes('wish.label_new_hero<Vael>'));
  let old = null; try { old = await run(cp.execSync('git show e68f7437:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString()); } catch (e) {}
  ck('CONTROL: v1363 sent the list as a banner with raw codes', !!old && old.banners.length === 1 && old.body.length === 0 && /attackCard/.test(old.banners[0]));
  console.log('test_wish_history_1364.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
})();
