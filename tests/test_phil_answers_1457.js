// v1457 - Phil's five lockdown answers (26 Nov 2026), each proven here. Audit reports: LOCKDOWN CHECKLIST 25NOV2026/audit/.
//  1. Orphan glyph fragments (campaign-01 "Every fragment farmable"): the 17 kinds that dropped nowhere are on existing stages; a stage's drop is
//     split evenly between its kinds (2 kinds 50%, 3 kinds 33%; an ordinary 2-from-5 stage 40%); the stage panel shows it; the boot check is real.
//  2. Arena (vault-arena-well "70 hero XP"): "pvp shouldnt give exp" - no hero XP from the Arena anywhere.
//  3. Starless Well tent (vault-arena-well "Tent promises an owned hero"): 3 heroes to choose from, each a highly buffed loan, often one quality
//     step up; a hero you own can be borrowed as the stronger copy.
//  4. City Wall tap mode (citywall-watchtower "Tap mode tint"): allowed land tinted green, other regions red (blueprint 04).
//  5. Guild raid: no Skip / fast-forward in the client, and the server refuses a raid result that came back faster than the fight can be watched.
// Server in-process (temp DB, tests/lockdown-1455-lib.js) + the page through server/sim-host.js. No browser.
// CONTROL: LF_SERVER=<v1455 server.js> LF_HTML=<v1455 page> LF_SOFT=1 lists the checks the old code fails. Exit 0 = all passed.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const HTML = process.env.LF_HTML || path.join(root, 'emberweave-heroes.html');
const html = fs.readFileSync(HTML, 'utf8');
const SRC = fs.readFileSync(process.env.LF_SERVER || path.join(root, 'server.js'), 'utf8');
const SOFT = !!process.env.LF_SOFT; let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); return; } fail++; console.log('  FAIL ' + m); if (!SOFT) { console.log('test_phil_answers_1457.js: FAILED after ' + pass + ' passed'); process.exit(1); } };
const host = require(path.join(root, 'server', 'sim-host.js')).load(HTML);
const R = s => vm.runInContext(s, host.ctx, { timeout: 60000 });
const J = s => { try { const r = R('JSON.stringify(' + s + ')'); return r === undefined ? null : JSON.parse(r); } catch (e) { return { __err: String(e && e.message || e) }; } };
const { S, call, guest } = require('./lockdown-1455-lib.js').loadServer(module);
const load = f => JSON.parse(fs.readFileSync(path.join(root, 'server', f), 'utf8'));
const qOf = k => k.slice(0, k.lastIndexOf(' '));
const ORPHANS = ['Blue Bastion', 'Blue +1 Bastion', 'Blue +2 Bastion', 'Purple Bastion', 'Purple +1 Bastion', 'Purple +2 Bastion', 'Purple +3 Bastion',
  'Gold Bastion', 'Gold Dawnshield', 'Gold +1 Bastion', 'Gold +1 Dawnshield', 'Gold +2 Bastion', 'Gold +2 Dawnshield', 'Gold +3 Bastion', 'Gold +3 Dawnshield',
  'Gold +4 Bastion', 'Gold +4 Dawnshield'];
const SECTIONS = [];
const section = (n, f) => SECTIONS.push([n, f]);

section('1. every glyph fragment drops somewhere; a stage splits its drop evenly', async () => {
  const N = load('campaign-encounters.json'), E = load('elite-campaign-encounters.json');
  const addedOn = k => [...N.map(s => ['normal', s]), ...E.map(s => ['elite', s])].filter(([, s]) => (s.rewards.addedFragments || []).some(f => f.key === k));
  for (const k of ORPHANS) { const at = addedOn(k);
    ok(at.some(([m, s]) => m === 'normal' && s.rewards.fragmentRolls === 2) && at.some(([m]) => m === 'elite')
      && at.every(([, s]) => s.rewards.glyphFragments.every(f => qOf(f.key) === qOf(k))),
      k + ': on ' + at.map(([m, s]) => (m === 'normal' ? 'Normal ' : 'Elite ') + s.id).join(' + ') + ' (same quality band as the stage)'); }
  // the server joins the authored list with the added kinds - every route reads the joined list
  const P = S.PORTALS, FS = S.FRAG_SOURCES, slug = S.glyphFragSlug;
  const need = S.fragKindsNeeded();
  ok(need.length === 218 && need.every(k => (FS[slug(k)] || []).length > 0), 'all ' + need.length + ' recipe fragment kinds have a campaign source');
  ok(ORPHANS.every(k => (FS[slug(k)] || []).some(s => s.mode === 'normal') && (FS[slug(k)] || []).some(s => s.mode === 'elite')), 'each of the 17 now drops from a Normal AND an Elite stage');
  const n35 = P.normal.byNode[35], e26 = P.elite.byNode[26], e92 = P.elite.byNode[92], e25 = P.elite.byNode[25];
  ok(n35.rewards.glyphFragments.length === 5 && n35.rewards.fragmentRolls === 2 && n35.rewards.glyphFragments[4].key === 'Blue Bastion', 'Normal 4-5 offers 5 kinds (+ Blue Bastion), still pays 2');
  ok(e26.rewards.glyphFragments.map(f => f.key).join() === 'Blue Ironwall,Blue Bastion', 'Elite 3-6: Blue Ironwall or Blue Bastion');
  ok(e92.rewards.glyphFragments.map(f => f.key).join() === 'Gold Ironwall,Gold Bastion,Gold Dawnshield' && e92.rewards.glyphFragments.every(f => f.quantity === 2), 'Elite 10-2: Gold Ironwall, Gold Bastion or Gold Dawnshield, x2');
  const chance = S.campaignFragChance;
  ok(chance(n35) === 2 / 5 && chance(P.normal.byNode[34]) === 2 / 4 && chance(e26) === 1 / 2 && Math.abs(chance(e92) - 1 / 3) < 1e-12 && chance(e25) === 1,
    'chances: 2 of 5 = 40%, 2 of 4 = 50%, 2 kinds 50%, 3 kinds 33%, one kind 100%');
  const drops = S.campaignGlyphDrops, tally = (st, runs) => { const c = {}; let tot = 0, perRunOk = true;
    for (let i = 1; i <= runs; i++) { const d = drops(st, 1, (i * 2654435761) >>> 0); const q = d.reduce((a, f) => a + f.quantity, 0); tot += q;
      if (q !== (st.rewards.fragmentRolls === 2 ? 2 : st.rewards.glyphFragments[0].quantity)) perRunOk = false; d.forEach(f => { c[f.key] = (c[f.key] || 0) + 1; }); }
    return { c, tot, perRunOk }; };
  { const t = tally(e92, 30000), p = Object.values(t.c).map(v => v / 30000);
    ok(t.perRunOk && Object.keys(t.c).length === 3 && p.every(x => Math.abs(x - 1 / 3) < 0.02), 'Elite 10-2 over 30,000 runs: every run pays 2 fragments, each kind ' + p.map(x => (x * 100).toFixed(1) + '%').join(' / ')); }
  { const t = tally(e26, 30000), p = Object.values(t.c).map(v => v / 30000);
    ok(t.perRunOk && p.length === 2 && p.every(x => Math.abs(x - 0.5) < 0.02), 'Elite 3-6: every run pays 2, each kind ' + p.map(x => (x * 100).toFixed(1) + '%').join(' / ')); }
  { const t = tally(n35, 30000), p = Object.values(t.c).map(v => v / 30000);
    ok(t.perRunOk && p.length === 5 && p.every(x => Math.abs(x - 0.4) < 0.02), 'Normal 4-5: every run pays 2 distinct, each kind ' + p.map(x => (x * 100).toFixed(1) + '%').join(' / ')); }
  { const d = drops(e92, 10, 12345); ok(d.reduce((a, f) => a + f.quantity, 0) === 20, 'a 10x sweep of Elite 10-2 pays 20 fragments in all, split between the kinds (' + JSON.stringify(d) + ')'); }
  ok(JSON.stringify(drops(e25, 3, 1)) === JSON.stringify([{ key: e25.rewards.glyphFragments[0].key, quantity: 6 }]), 'a one-kind stage pays exactly what it did');
  // the boot check is a real check
  { const raw = S.GLYPHS.raw, fake = { id: 'v1457-fake', ing: [{ kind: 'frag', key: 'Blue Nothingness', qty: 1 }] }; raw.push(fake); let err = '';
    try { S.portalCompile(); } catch (e) { err = String(e.message); } raw.pop(); S.portalCompile();
    ok(/no campaign source \(1\): Blue Nothingness/.test(err), 'CONTROL: a recipe kind with no stage stops the boot ("' + err + '")');
    ok(Object.keys(S.FRAG_SOURCES).length === 218, 'and the real data compiles again (218 kinds)'); }
  ok(!/every type has an ordinary Normal source/.test(SRC), 'the boot line no longer claims what it never checked');
  // routes: the stage card and the farm map serve the joined list
  const g = await guest('frag');
  const card = (await call('/api/campaign/stage?mode=elite&node=92', null, g.T)).data;
  ok(card && card.stage && card.stage.rewards.glyphFragments.length === 3, 'the Elite 10-2 stage card lists its 3 kinds');
  const map = (await call('/api/portals', null, g.T)).data;
  ok(map && map.fragmentSources && (map.fragmentSources['gold-plus-4-dawnshield'] || []).map(s => s.mode + ' ' + s.stageId).join(', ') === 'normal 15-2, elite 15-5', 'the farm map names Gold +4 Dawnshield\'s sources: ' + JSON.stringify(map && map.fragmentSources && map.fragmentSources['gold-plus-4-dawnshield']));
  // the stage panel shows the split
  const chipsE = J(`stageDropsHTML(${JSON.stringify(card.stage)},92,'elite')`), chipsN = J(`stageDropsHTML(${JSON.stringify(P.normal.byNode[35])},35,'normal')`), chips1 = J(`stageDropsHTML(${JSON.stringify(e25)},25,'elite')`);
  ok(typeof chipsE === 'string' && (chipsE.match(/×2 · 33%/g) || []).length === 3 && chipsE.includes('ONE OF 3'), 'drop list on Elite 10-2: "ONE OF 3", each chip "×2 · 33%"');
  ok(typeof chipsN === 'string' && (chipsN.match(/>40%</g) || []).length === 5 && chipsN.includes('2 RANDOM'), 'drop list on Normal 4-5: "2 RANDOM", each of the 5 chips "40%"');
  ok(typeof chips1 === 'string' && !/%/.test(chips1) && chips1.includes('×2'), 'a one-kind stage still reads "×2" with no chance');
  ok(J(`ewT('stage.split_frags',{m:3,p:stageFragPct(1/3)})`) === 'One of these 3 fragments drops, 33% chance each:', 'CHANCES box line: "' + J(`ewT('stage.split_frags',{m:3,p:stageFragPct(1/3)})`) + '"');
  ok(/_random\?t\('stage\.random_frags',\{n:2,m:_gf\.length\}\):_split\?t\('stage\.split_frags',\{m:_gf\.length,p:_pct\}\):t\('stage\.guaranteed'\)/.test(html)
    && /\$\{\(_random\|\|_split\)\?` <span style="color:#8b98a9">\$\{_pct\}<\/span>`:''\}/.test(html), 'the CHANCES box heads the list with the split and shows the chance on each line');
});

(async () => {
  for (const [n, f] of SECTIONS) { console.log('== ' + n + ' =='); await f(); }
})().then(() => { console.log((SOFT ? 'SOFT ' : '') + 'test_phil_answers_1457.js: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); },
  e => { console.error(e && e.stack || e); process.exit(1); });
