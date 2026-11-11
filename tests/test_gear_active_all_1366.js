// v1366 (Phil 11 Nov 2026, testers: "make sure all equipment has an active option, right now a tester said morvayne green doesnt" /
// "the activation of equipment takes a long time to activate" / "should be instant").
// 1 every catalog item has an active with real effect data the battle can cast; 2 Set active shows on the card before the server answers.
// CONTROL: v1365's catalog had nine pieces with none.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/gear-catalog.json'), 'utf8')).items;
const acts = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/gear-actives.json'), 'utf8'));
const aby = {}; acts.forEach(a => aby[a.id] = a);
const none = cat.filter(d => !d.active || !aby[d.id] || !aby[d.id].type);
ck('every one of the ' + cat.length + ' items has an active the battle can cast (name + type + params)', none.length === 0, none.map(d => d.id).join(','));
const h = cat.filter(d => d.id.startsWith('H61E'));
ck("Morvayne's nine pieces each carry the active of the item they were built from", h.length === 9 && h.every(d => { const t = cat.find(x => x.id === d.artId); return d.active === t.active && aby[d.id].type === aby[t.id].type; }));
ck("Morvayne's green piece (Crown of the Open Gate) has one", (cat.find(d => d.id === 'H61E02') || {}).active === 'Grace Ward');
const old = JSON.parse(cp.execSync('git show 7e49f874:server/gear-catalog.json', { cwd: ROOT, maxBuffer: 64 << 20 }).toString()).items;
ck('CONTROL: v1365 had nine items with no active', old.filter(d => !d.active).length === 9);
// 2 instant Set active: run the real gearHeroPost with a server that never answers
const src = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const a = src.indexOf('async function gearHeroPost('), b = src.indexOf('\n}', a) + 2;
const ctx = { FORGE: { busy: false, st: { revision: 1, active: { vael: 'old' } } }, renders: 0, api: () => new Promise(() => {}), bannerMsg() {}, t: x => x, iconize: x => x, forgeSync: async () => {} };
ctx.renderHeroDetail = () => { ctx.renders++; };
vm.runInNewContext(src.slice(a, b) + '\nthis.go=gearHeroPost;', ctx);
ctx.go('/select-active', { heroKey: 'vael', itemId: 'new1' }, null);
ck('Set active shows on the card the moment it is tapped (server still answering)', ctx.FORGE.st.active.vael === 'new1' && ctx.renders === 1, JSON.stringify(ctx.FORGE.st.active));
console.log('test_gear_active_all_1366.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
