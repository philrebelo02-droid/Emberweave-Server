// v1457 - Phil's five lockdown answers (26 Nov 2026), each proven here. Audit reports: LOCKDOWN CHECKLIST 25NOV2026/audit/.
//  1. Orphan glyph fragments (campaign-01 "Every fragment farmable"): the 17 kinds that dropped nowhere are on existing stages; a stage's drop is
//     split evenly between its kinds (2 kinds 50%, 3 kinds 33%; an ordinary 2-from-5 stage 40%); the stage panel shows it; the boot check is real.
//  2. Arena (vault-arena-well "70 hero XP"): "pvp shouldnt give exp" - no hero XP from the Arena anywhere.
//  3. Starless Well tent (vault-arena-well "Tent promises an owned hero"): 3 heroes to choose from, each a highly buffed loan, often one quality
//     step up; a hero you own can be borrowed as the stronger copy.
//  4. City Wall tap mode (citywall-watchtower "Tap mode tint"): allowed land tinted green, other regions red (blueprint 04).
//  5. Guild raid: no Skip / fast-forward in the client, and the server refuses a raid result that came back faster than the fight can be watched.
//     x2 speed in a guild raid is for VIPs only (EGP 1+); the server's floor is the x2 watch for a VIP, the x1 watch for everyone else.
//  1b. The 17 kinds are spent by the Ironwall guard boards; 1 also: the 4 Orange kinds drop on chapter 16 ordinary Normal stages.
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
    ok(/no ordinary Normal source \(1\): Blue Nothingness/.test(err), 'CONTROL: a recipe kind with no stage stops the boot ("' + err + '")');
    ok(Object.keys(S.FRAG_SOURCES).length === 218, 'and the real data compiles again (218 kinds)'); }
  ok(!/every type has an ordinary Normal source/.test(SRC), 'the boot line no longer claims what it never checked');
  /* Phil 26 Nov: "yes give orange normal stages too" - the 4 Orange kinds only Veteran paid now drop on chapter 16 ordinary stages as well */
  { const ordN = new Set(P.normal.list.filter(e => ![3, 6, 9, 0].includes(e.node % 10)).map(e => e.id));
    ok(need.every(k => (FS[slug(k)] || []).some(s => s.mode === 'normal' && ordN.has(s.stageId))), 'EVERY one of the 218 kinds drops from an ordinary Normal stage (the boot refuses otherwise)');
    const OR = { 'Orange Bastion': '16-2', 'Orange Dawnshield': '16-1', 'Orange Cataclysm': '16-8', 'Orange Voidbind': '16-4' };
    for (const [k, sid] of Object.entries(OR)) { const st = P.normal.list.find(e => e.id === sid), src = (FS[slug(k)] || []).map(s => s.mode + ' ' + s.stageId);
      ok(st.rewards.glyphFragments.length === 5 && st.rewards.fragmentRolls === 2 && st.rewards.glyphFragments.every(f => f.key.startsWith('Orange ')) && chance(st) === 0.4
        && src.includes('normal ' + sid) && src.some(s => s.startsWith('veteran ')), k + ': Normal ' + sid + ' (2 of 5 Orange kinds, 40% each) and its Veteran source kept - ' + src.join(', ')); } }
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

section('1b. the 17 kinds are spent by the boards they belong to (Phil: "dont remove them, mix them into the heroes it belongs to")', async () => {
  const cp = require('child_process');
  const now = JSON.parse(fs.readFileSync(path.join(root, 'server', 'glyph-source.json'), 'utf8'));
  let old = null; try { old = JSON.parse(cp.execFileSync('git', ['show', '780cbe0ca:server/glyph-source.json'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })); } catch (e) {}
  ok(!!old && old.length === now.length, 'the v1455 catalogue to compare with (' + (old && old.length) + ' recipes)');
  if (old) { const FR = /^(\d+)\s*[×x]\s*(.+?)\s+Fragments$/, parts = r => r.split(' + ').map(s => s.trim());
    const sum = r => parts(r).reduce((a, p) => { const m = FR.exec(p); return a + (m ? +m[1] : 0); }, 0), rest = r => parts(r).filter(p => !FR.test(p)).join(' + ');
    const changed = now.filter((d, i) => d.recipeText !== old[i].recipeText);
    ok(now.every((d, i) => d.id === old[i].id && sum(d.recipeText) === sum(old[i].recipeText) && rest(d.recipeText) === rest(old[i].recipeText)),
      'every recipe costs the same number of fragments as in v1455, with the same sub-glyphs and glyphs (' + changed.length + ' recipes changed: ' + changed.map(d => d.id).join(' ') + ')');
    ok(changed.length === 12 && changed.every(d => d.family === 'Ironwall'), 'the 12 changed recipes are the Blue..Gold +4 Ironwall glyphs (the armour guard board), part of their Ironwall cost moved to Bastion / Dawnshield'); }
  let gp = null; try { gp = JSON.parse(cp.execFileSync(process.execPath, [path.join(root, 'tools', 'glyph_paths.js')], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) {}
  ok(!!gp && gp.heroes && Object.keys(gp.heroes).length === 61, 'tools/glyph_paths.js (the engine\'s own board paths) runs: 61 heroes');
  if (!gp) return;
  const byId = Object.fromEntries(gp.glyphs.map(g => [g.id, g])), spend = {};
  for (const [h, v] of Object.entries(gp.heroes)) for (const t of v.path) for (const s of t.slots) for (const f of (byId[s.id] || { frags: [] }).frags)
    if (qOf(f.key) === t.quality) (spend[f.key] = spend[f.key] || new Set()).add(h);
  for (const k of ORPHANS) { const who = [...(spend[k] || [])].sort(), tanks = who.filter(h => (gp.heroes[h].role === 'Tank'));
    ok(who.length > 0 && tanks.length >= 5 && (S.FRAG_SOURCES[S.glyphFragSlug(k)] || []).length >= 2, k + ': dropped by ' + (S.FRAG_SOURCES[S.glyphFragSlug(k)] || []).map(s => s.mode + ' ' + s.stageId).join(', ')
      + '; spent at the ' + qOf(k) + ' step by ' + who.length + ' boards (' + tanks.length + ' tanks: ' + tanks.join(' ') + ')'); }
});

section('2. the Arena gives no hero XP', async () => {
  const a0 = html.indexOf("  if(CUR.mode==='arena'){ let _arepDef=null"), blk = html.slice(a0, html.indexOf("\n  if(CUR.mode===", a0 + 10));
  ok(blk.length > 500 && !/grantTeamXP|heroXP|hero_xp/.test(blk), 'the Arena result step grants no hero XP and promises none (' + blk.length + ' chars checked)');
  ok(!/if\(won\)grantTeamXP\(70\)/.test(html), 'the old local +70 is gone from the page');
  const rt = SRC.slice(SRC.indexOf("if(p==='/api/arena/result' && req.method==='POST')"), SRC.indexOf("if(p==='/api/arena/top')"));
  ok(rt.length > 1000 && !/heroXp|\.xp\b|hero\[/.test(rt), 'the server\'s /api/arena/result grants no hero XP');
  // a real won fight on the server
  const a = await guest('arA'), b = await guest('arB'), TEAM = ['vael', 'sylthaine', 'vireo', 'vex', 'gruel'];
  { const u = S.DB.users[a.id]; u.led.px = 900000; for (const k of TEAM) { u.led.unlocked[k] = true; u.led.hero[k] = { xp: 9000000, stars: 5, pips: 0 }; }
    u.team = TEAM.slice(); u._arenaOffer = [{ id: b.id, t: Date.now() }]; const o = S.DB.users[b.id]; o.team = []; o.wall = []; }
  const before = TEAM.map(k => S.DB.users[a.id].led.hero[k].xp);
  const st = (await call('/api/arena/start', { oppId: b.id, requestId: 'p1457-as' }, a.T)).data;
  const ar = (await call('/api/arena/result', { oppId: b.id, won: true, requestId: 'p1457-ar' }, a.T)).data;
  const after = TEAM.map(k => S.DB.users[a.id].led.hero[k].xp);
  ok(st && st.ok === true && ar && ar.won === true, 'a strong squad wins an Arena fight (' + JSON.stringify({ start: st && (st.error || 'ok'), won: ar && ar.won, err: ar && ar.error }) + ')');
  ok(JSON.stringify(before) === JSON.stringify(after) && !('heroXp' in (ar || {})), 'and its heroes gain no XP (' + after.join(', ') + ')');
});

section('3. the Starless Well tent: 3 buffed loans, often a quality up, a hero you own allowed', async () => {
  const WL = require(path.join(root, 'server', 'starless-well.js'));
  ok(WL.TENT_OPTIONS === 3 && WL.LOAN_BUFF.hp === 0.30 && WL.LOAN_BUFF.atk === 0.20 && WL.LOAN_UP_BUFF.hp === 0.45 && WL.LOAN_UP_BUFF.atk === 0.30 && WL.LOAN_UP_CHANCE === 0.6,
    'numbers: 3 options; every loan +30% health / +20% damage; an upgraded one (60% per option, at least one per tent) +45% / +30% and one glyph quality step');
  // the map layout never moves: every square the v1455 map had is where it was (old module from git)
  { const Module = require('module'), cp = require('child_process');
    let oldSrc = ''; try { oldSrc = cp.execFileSync('git', ['show', '780cbe0ca:server/starless-well.js'], { cwd: root, encoding: 'utf8', maxBuffer: 16 << 20 }); } catch (e) {}
    if (oldSrc) { const m = new Module(path.join(root, 'server', 'starless-well-v1455.js'), module); m.filename = path.join(root, 'server', 'starless-well-v1455.js'); m.paths = Module._nodeModulePaths(path.join(root, 'server')); m._compile(oldSrc, m.filename);
      const keys = Object.keys(S.SIM.HERO_BASE).sort(); let same = true, tents = 0, three = 0, ups = 0, opts = 0, noneUp = 0;
      for (let sd = 1; sd <= 400; sd++) for (const [mp, pth] of [[1, null], [2, 'normal'], [3, 'hard']]) {
        const a = m.exports.genMap(sd * 7919, mp, pth, keys), b = WL.genMap(sd * 7919, mp, pth, keys);
        for (let c = 0; c < 7; c++) for (let r = 0; r < 3; r++) { const x = a[c][r], y = b[c][r];
          if (!x !== !y || (x && (x.type !== y.type || JSON.stringify(x.foes || null) !== JSON.stringify(y.foes || null) || (x.type === 'tent' && x.hero !== y.hero)))) same = false;
          if (y && y.type === 'tent') { tents++; if (y.heroes.length === 3 && new Set(y.heroes).size === 3 && y.heroes[0] === y.hero) three++; opts += y.up.length; ups += y.up.filter(Boolean).length; if (!y.up.some(Boolean)) noneUp++; } } }
      ok(same, 'every square of 1,200 maps is where the v1455 map put it (fights, foes, chests, springs, the tent\'s first hero)');
      ok(tents > 100 && three === tents, tents + ' tents, every one offers 3 different heroes (the first is the old pick)');
      ok(noneUp === 0 && ups / opts > 0.62 && ups / opts < 0.75, 'every tent has an upgraded loan; ' + (100 * ups / opts).toFixed(0) + '% of options are upgraded ("often")'); }
    else ok(false, 'git show 780cbe0ca:server/starless-well.js'); }
  // a real run on the in-process server
  const lv = 80, TEAM = ['vael', 'sylthaine', 'vireo', 'vex', 'gruel'];
  let g = null, tent = null, tc = -1, tr = -1, st = null;
  for (let tries = 0; tries < 12 && !tent; tries++) {
    g = await guest('well' + tries); const u = S.DB.users[g.id]; u.led.px = S.D_TROOP_CUM[lv - 1] + 10;
    for (const k of TEAM) { u.led.unlocked[k] = true; u.led.hero[k] = { xp: 9000000, stars: 4, pips: 0 }; }
    st = (await call('/api/well/state', null, g.T)).data;
    for (const c of [2, 4]) for (let r = 0; r < 3 && !tent; r++) { const s = st && st.grid && st.grid[c][r]; if (s && s.type === 'tent') { tent = s; tc = c; tr = r; } } }
  ok(!!tent && st.playerLevel >= 61, 'a level-' + (st && st.playerLevel) + ' player with a tent on map 1 (column ' + tc + ')');
  if (!tent) return;
  ok(Array.isArray(tent.options) && tent.options.length === 3 && tent.options.every(o => o.key && o.quality >= 0 && o.power > 0 && o.level === st.playerLevel), 'the tent shows 3 loans, each with its quality, level and power: ' + JSON.stringify(tent.options.map(o => [o.key, o.quality, o.up, o.power])));
  // make the first option a hero the player owns: the duplicate is allowed and is the stronger copy
  const own = tent.options[0].key, u = S.DB.users[g.id]; u.led.unlocked[own] = true; u.led.hero[own] = { xp: 9000000, stars: 3, pips: 0 };
  st = (await call('/api/well/state', null, g.T)).data; const o0 = st.grid[tc][tr].options[0];
  ok(o0.owned === true && o0.power > o0.ownPower && o0.ownPower > 0, 'an owned hero on offer is the stronger copy: ' + o0.power + ' power against your ' + o0.ownPower);
  u.led.well2.run.pos = { col: tc - 1, row: tr }; u.led.well2.run.started = true;
  const bad = (await call('/api/well/move', { col: tc, row: tr, hero: 'not-a-hero', requestId: 'p1457-w0' }, g.T)).data;
  ok(bad && bad.ok === false && /Unknown hero/.test(bad.error) && u.led.well2.run.pos.col === tc - 1, 'a hero that is not in this tent is refused and nothing moves');
  const mv = (await call('/api/well/move', { col: tc, row: tr, hero: own, requestId: 'p1457-w1' }, g.T)).data;
  ok(mv && mv.ok && mv.got && mv.got.loan === own && mv.loans.indexOf(own) >= 0 && mv.loanInfo && mv.loanInfo[own] && mv.loanInfo[own].power === o0.power,
    'borrowing your own ' + own + ' works (was: nothing, while the card said it joined) and the view carries its loan card');
  ok(!!mv.got.up === !!st.grid[tc][tr].up[0] && (!!u.led.well2.run.loanUp[own]) === !!st.grid[tc][tr].up[0], 'its upgrade mark is the tent\'s (' + !!mv.got.up + ')');
  // the fight snapshot is the buffed loan
  const fc = tc + 1, fr = [0, 1, 2].find(r => st.grid[fc][r] && Math.abs(r - tr) <= 1);
  const ids = [own, ...TEAM.filter(k => k !== own)].slice(0, 5);
  const sa = (await call('/api/well/start', { col: fc, row: fr, heroIds: ids, requestId: 'p1457-w2' }, g.T)).data;
  ok(sa && sa.ok && Array.isArray(sa.snaps) && sa.snaps.length === 5, 'the next fight starts with the loan in the squad (' + (sa && (sa.error || 'ok')) + ')');
  if (!(sa && sa.ok)) return;
  const ls = sa.snaps.find(s => s.key === own), mine = host.snapFromSpecs([S.campaignHeroSpec(u, own)])[0];
  const lsp = WL.loanSpec({ me: u, led: u.led, SIM: S.SIM, campaignHeroSpec: S.campaignHeroSpec, playerLevel: () => st.playerLevel }, own, !!mv.got.up), plain = host.snapFromSpecs([lsp])[0];
  const B = mv.got.up ? WL.LOAN_UP_BUFF : WL.LOAN_BUFF;
  ok(Math.abs(ls.maxHp / plain.maxHp - (1 + B.hp)) < 0.01 && Math.abs(ls.dmg / plain.dmg - (1 + B.atk)) < 0.01, 'the fight snapshot is the loan x' + (1 + B.hp) + ' health, x' + (1 + B.atk) + ' damage (' + ls.maxHp + ' / ' + plain.maxHp + ')');
  ok(ls.maxHp >= mine.maxHp * (1 + B.hp) - 1 && ls.dmg >= mine.dmg * (1 + B.atk) - 1 && ls.level >= mine.level, 'and clearly above your own copy: health ' + ls.maxHp + ' vs ' + mine.maxHp + ', damage ' + ls.dmg + ' vs ' + mine.dmg);
  const other = sa.snaps.find(s => s.key !== own), otherMine = host.snapFromSpecs([S.campaignHeroSpec(u, other.key)])[0];
  ok(other.maxHp === otherMine.maxHp, 'the rest of the squad is unbuffed (' + other.key + ' ' + other.maxHp + ')');
  // an upgraded loan is one glyph quality step above
  { const ctx = { me: u, led: u.led, SIM: S.SIM, campaignHeroSpec: S.campaignHeroSpec, playerLevel: () => st.playerLevel };
    const a = WL.loanSpec(ctx, 'mirelle', false), b = WL.loanSpec(ctx, 'mirelle', true);
    ok(b.glyphRank === Math.min(16, a.glyphRank + 1) && b.level === a.level, 'an upgraded loan: glyph quality ' + a.glyphRank + ' -> ' + b.glyphRank + ' (one step)'); }
  ok(!u.led.hero[own].loan && u.led.hero[own].stars === 3, 'your own ' + own + ' is untouched (3 stars, no loan mark)');
  // the page: the tent shows the 3 loans with a Borrow tap each
  ok(/if\(s\.type==='tent'&&Array\.isArray\(s\.options\)&&s\.options\.length\)\{/.test(html) && /card\.querySelectorAll\('\[data-loan\]'\)\.forEach\(b=>\{ b\.onclick=\(\)=>\{ card\.remove\(\); go\(b\.dataset\.loan\); \}; \}\);/.test(html),
    'the page\'s tent card lists the options and borrows the one tapped');
  ok(J(`ewT('well.loan_buff',{hp:wellPct(0.3),atk:wellPct(0.2)})`) === '+30% health, +20% damage' && J(`ewT('well.loan_up',{q:'Purple'})`) === 'Upgraded to Purple', 'texts: "+30% health, +20% damage", "Upgraded to Purple"');
  ok(J(`(function(){ WELL.state={loans:['${own}'],heroes:{}}; CUR={mode:'well'}; G.unlocked=G.unlocked||{}; G.unlocked['${own}']=true; const t=wellHeroTag('${own}'); return !!(t&&/${'Loan'}/.test(t.html)); })()`) === true, 'the squad list tags your own borrowed hero "Loan"');
  ok(J(`wellListPower('${own}',{loanInfo:{'${own}':{power:12345}}})`) === 12345, 'the Heroes window shows a loan\'s own power');
});

section('4. City Wall tap mode: allowed land green, other regions red (blueprint 04)', async () => {
  const bp = (() => { try { return fs.readFileSync(path.join(root, '..', '..', '..', '1 Rulebook', 'Mechanics blueprints', '04 - City Wall.md'), 'utf8'); } catch (e) { return ''; } })();
  if (bp) ok(/In tap mode accessible zones are tinted green, other regions red/.test(bp), 'blueprint 04 says: "In tap mode accessible zones are tinted green, other regions red"');
  const m = html.match(/\n  if\(_teleMode\)\{ \/\* v1457[\s\S]*?inner\.appendChild\(cv\); \}\r?\n/), k = html.match(/\nconst TELE_TINT_OK='([^']+)', TELE_TINT_NO='([^']+)';/);
  ok(!!m && !!k && !/rgba\(0,0,0,\.35\)/.test(m ? m[0] : 'rgba(0,0,0,.35)'), 'the teleport-mode layer is the green / red tint (the dark veil is gone)');
  if (!m || !k) return;
  ok(/^rgba\((\d+),(\d+),(\d+)/.test(k[1]) && +RegExp.$2 > +RegExp.$1 && +RegExp.$2 > +RegExp.$3, 'TELE_TINT_OK ' + k[1] + ' is green');
  ok(/^rgba\((\d+),(\d+),(\d+)/.test(k[2]) && +RegExp.$1 > +RegExp.$2 && +RegExp.$1 > +RegExp.$3, 'TELE_TINT_NO ' + k[2] + ' is red');
  // run the block on a 6 x 2 strip: 2 cells of your region, 1 wild, 2 of another region, 1 sea
  const fills = [], ZONE = ['mine', 'mine', 'wild', 'other', 'other', null];
  const g = { fillStyle: '', fillRect(x, y) { fills.push([x, y, this.fillStyle]); } };
  const cv = { dataset: {}, style: {}, getContext: () => g };
  const ctx = vm.createContext({ document: { createElement: () => cv }, GRID_COLS: 6, GRID_ROWS: 2, GRID_CELL: 1, REALM_MAP: { landZone: (x) => ZONE[x], GEO: { Y0: 0 } },
    zoneAccessible: z => z === 'mine' || z === 'wild', inner: { appendChild() {} }, _teleMode: true, TELE_TINT_OK: k[1], TELE_TINT_NO: k[2] });
  vm.runInContext(m[0], ctx);
  const col = x => fills.filter(f => f[0] === x).map(f => f[2]);
  ok(fills.length === 10 && [0, 1, 2].every(x => col(x).every(c => c === k[1]) && col(x).length === 2) && [3, 4].every(x => col(x).every(c => c === k[2]) && col(x).length === 2) && col(5).length === 0,
    'your region and the wild are green, the other region red, the sea untinted (' + fills.length + ' cells)');
  ok(cv.dataset.veiled === '4' && cv.dataset.open === '6', 'the layer counts red ' + cv.dataset.veiled + ' / green ' + cv.dataset.open + ' cells (teleVeil keeps its id for the map tests)');
});

section('5. guild raid: no Skip on the page, a skipped result refused by the server', async () => {
  delete process.env.RAID_MIN_WATCH_MUL;   // the real rule (older raid tests set 0 to resolve at machine speed)
  ok(J(`(function(){ const c=CUR; CUR={mode:'graid'}; const r=isAutoBattle(); CUR=c; return r; })()`) === false, 'a guild raid is not an auto fight, so Skip is never offered');
  ok(/if\(kb\) kb\.style\.display=\(forced && !_isReplay && !\(CUR&&CUR\.mode==='emberdraft'\) && !\(CUR&&CUR\.mode==='graid'\)/.test(html), 'the Skip button is hidden in a guild raid (by name, too)');
  ok(/document\.getElementById\('skipBtn'\)\.onclick=\(\)=>\{ if\([^{]*\(CUR&&CUR\.mode==='graid'\)[^{]*\)return;/.test(html), 'and a Skip tap does nothing there');
  // x2 in a guild raid is for VIPs only (Phil 26 Nov: "guild raids should have x2 button for vips"); other modes keep their rule
  { const sp = (mode, vip, cleared) => J(`(function(){ const c=CUR, pn=patNow, cc=G.campaignCleared; CUR={mode:'${mode}'}; patNow=()=>(${vip}?{egp:1}:{egp:0}); G.campaignCleared=${cleared};
      const r=spdChoices(); CUR=c; patNow=pn; G.campaignCleared=cc; return r; })()`);
    ok(JSON.stringify(sp('graid', true, 50)) === '[1,2]' && JSON.stringify(sp('graid', false, 50)) === '[1]', 'guild raid: a VIP can pick x2, a non-VIP cannot - not even with stage 1-3 cleared');
    ok(JSON.stringify(sp('campaign', false, 50)) === '[1,2]' && JSON.stringify(sp('campaign', false, 1)) === '[1]' && JSON.stringify(sp('campaign', true, 1)) === '[1,2]' && JSON.stringify(sp('arena', false, 50)) === '[1,2]',
      'other modes unchanged: x2 after 1-3 or at EGP 1');
    ok(/bannerMsg\(\(CUR&&CUR\.mode==='graid'\)\?ewT\('battle\.x2_vip_raid'\)/.test(html) && J(`ewT('battle.x2_vip_raid')`) === 'x2 speed in guild raids is for VIPs (EGP 1 and up).', 'a non-VIP\'s locked x2 tap in a raid says: "' + J(`ewT('battle.x2_vip_raid')`) + '"'); }
  ok(S.RAID_MAX_SPEED === 2 && S.raidMinWatchMs(60, true) === 21000 && S.raidMinWatchMs(60, false) === 45000 && S.raidMinWatchMs(3, false) === 0 && S.raidMinWatchMs(NaN, true) === 0
    && S.raidSkipped(60, 20000, true) === true && S.raidSkipped(60, 31000, true) === false && S.raidSkipped(60, 31000, false) === true && S.raidSkipped(60, 46000, false) === false,
    'shortest watch of a 60 s raid fight: 21 s for a VIP (x2), 45 s for everyone else (x1) - 80%, less 3 s; a 3 s fight has no floor');
  // the real route
  const g = await guest('raid'), u = S.DB.users[g.id], SQUAD = ['vael', 'sylthaine', 'vireo', 'vex', 'gruel'];
  u.led.px = S.D_TROOP_CUM[39] + 10; for (const k of SQUAD) { u.led.unlocked[k] = true; u.led.hero[k] = { xp: 900000, stars: 3, pips: 0 }; }
  const setVip = on => { u.led.patron = { v: 1, base: on ? S.PATRON.egp[1] : 0, prestiged: false, edpBase: 0 }; };
  setVip(false); ok(S.raidVip(u) === false, 'fixture: a non-VIP (server ledger EGP 0)');
  const gc = (await call('/api/guild/create', { name: 'Raid Watch ' + Date.now().toString(36) }, g.T)).data;
  ok(gc && !gc.error, 'fixture: a guild (' + JSON.stringify(gc && gc.error || 'ok') + ')');
  const AUTO = [[1, 'auto', -1, 1, null, null]];
  const s1 = (await call('/api/guild/raid/start', { heroIds: SQUAD, requestId: 'p1457-rs1' }, g.T)).data;
  ok(s1 && s1.ok && s1.attemptId, 'a raid fight starts (' + (s1 && (s1.error || 'ok')) + ')');
  if (!(s1 && s1.ok)) return;
  const hp0 = s1.boss && s1.boss.hp;
  const r1 = (await call('/api/guild/raid/resolve', { attemptId: s1.attemptId, inputLog: AUTO, requestId: 'p1457-rr1' }, g.T)).data;
  const gg = Object.values(S.DB.guilds).find(x => x && x.raid && x.raid.att && x.raid.att[g.id]);
  ok(r1 && r1.ok === false && r1.skipped === true && gg && gg.raid.att[g.id] && gg.raid.att[g.id].id === s1.attemptId && gg.raid.hp === hp0,
    'a result sent the moment the fight began is refused - no damage booked, the attempt kept (' + JSON.stringify({ ok: r1 && r1.ok, skipped: r1 && r1.skipped, err: r1 && r1.error }) + ')');
  if (!(gg && gg.raid.att[g.id])) return;
  gg.raid.att[g.id].startedAt = Date.now() - 30000;   // 30 s: an x2 watch of a ~60 s fight, too fast for x1
  const r2 = (await call('/api/guild/raid/resolve', { attemptId: s1.attemptId, inputLog: AUTO, requestId: 'p1457-rr2' }, g.T)).data;
  ok(r2 && r2.ok === false && r2.skipped === true && gg.raid.hp === hp0, 'a non-VIP\'s result after 30 s (an x2 watch they do not have) is refused too');
  setVip(true); ok(S.raidVip(u) === true, 'the same player becomes a VIP (server ledger EGP 1)');
  const r3 = (await call('/api/guild/raid/resolve', { attemptId: s1.attemptId, inputLog: AUTO, requestId: 'p1457-rr3' }, g.T)).data;
  ok(r3 && r3.ok === true && r3.dmg > 0, 'a VIP\'s result after 30 s (watched at x2) is accepted and books ' + (r3 && r3.dmg) + ' damage');
  setVip(false);
  const s2 = (await call('/api/guild/raid/start', { heroIds: SQUAD, requestId: 'p1457-rs2' }, g.T)).data;
  if (s2 && s2.ok) { const g2 = Object.values(S.DB.guilds).find(x => x && x.raid && x.raid.att && x.raid.att[g.id]); g2.raid.att[g.id].startedAt = Date.now() - 120000;   /* the commit replaced the guild object */
    const r4 = (await call('/api/guild/raid/resolve', { attemptId: s2.attemptId, inputLog: AUTO, requestId: 'p1457-rr4' }, g.T)).data;
    ok(r4 && r4.ok === true && r4.dmg > 0, 'a non-VIP\'s fight watched at x1 (2 minutes) books its ' + (r4 && r4.dmg) + ' damage'); }
  else ok(false, 'a second raid fight starts (' + (s2 && s2.error) + ')');
  ok(/const _vip=raidVip\(me\);\s*if\(raidSkipped\(fightSec, Date\.now\(\)-\(a\.startedAt\|\|0\), _vip\)\)\{/.test(SRC) && SRC.indexOf('if(raidSkipped(') < SRC.indexOf("const out=durableCommit(me,rkey,")
    && /function raidVip\(u\)\{ try\{ const L=patronLevels\(ensureLedger\(u\)\);/.test(SRC), 'the check reads EGP from the server ledger and runs before anything is booked');
});

(async () => {
  for (const [n, f] of SECTIONS) { console.log('== ' + n + ' =='); await f(); }
})().then(() => { console.log((SOFT ? 'SOFT ' : '') + 'test_phil_answers_1457.js: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); },
  e => { console.error(e && e.stack || e); process.exit(1); });
