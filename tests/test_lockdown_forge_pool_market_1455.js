// v1455 lockdown audit 25 Nov 2026 - Forge + Wishing Pool (audit/forge-academy-pool.md) and Market (audit/market-shady-board-hut-egp.md) fixes.
// Server in-process (temp DB, tests/lockdown-1455-lib.js), page headless (server/sim-host.js).
//  1. Forge "Unlock at level 25" - every Forge action route refuses below player level 25 (same answer as the Academy lock).
//  2. Forge "Hero loadouts" - /api/gear/equip refuses an item that is not one of that hero's own nine (server/hero-gear.json).
//  3. Wishing Pool "Odds on cards" - the Diamond card's numbers come from the server's odds table (25% / 32%, no Ember Roast), 16 languages.
//  4. Market "Hourly restock" - the countdown ticks every second while the Market is open, redraws once at zero, stops when it closes.
// CONTROL: LF_HTML=<v1454 page> LF_SERVER=<v1454 server.js> LF_SOFT=1 lists the checks the old code fails. Exit 0 = all passed.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const { loadServer, root } = require('./lockdown-1455-lib.js');
const HTML = process.env.LF_HTML || path.join(root, 'emberweave-heroes.html');
const html = fs.readFileSync(HTML, 'utf8');
const SOFT = !!process.env.LF_SOFT; let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); return; } fail++; console.log('  FAIL ' + m); if (!SOFT) { console.log('test_lockdown_forge_pool_market_1455.js: FAILED after ' + pass + ' passed'); process.exit(1); } };
const host = require(path.join(root, 'server', 'sim-host.js')).load(HTML);
const R = s => vm.runInContext(s, host.ctx, { timeout: 60000 });
const J = s => { try { const r = R('JSON.stringify(' + s + ')'); return r === undefined ? null : JSON.parse(r); } catch (e) { return { __err: String(e && e.message || e) }; } };
const CODES = ['en', 'es', 'pt-BR', 'fr', 'de', 'it', 'nl', 'ru', 'tr', 'ja', 'ko', 'zh-Hans', 'zh-Hant', 'th', 'id', 'hi'];
process.env.GEAR_V2_ENABLED = 'true';
const HG = require(path.join(root, 'server', 'hero-gear.json'));
const { S, call, guest } = loadServer(module);

const run = (async () => {
  console.log('== 1. Forge routes need player level 25 ==');
  { const a = await guest('forge-l1'); const st = (await call('/api/gear/state', null, a.T)).data;
    ok(st && st.enabled === true, 'reading the Forge state stays open at level 1 (the hero card reads it)');
    const rev = st.revision | 0, refused = [];
    for (const [route, body] of [['/api/gear/craft', { gearId: 'E01' }], ['/api/gear/craft-sub', { gearId: 'E09' }], ['/api/gear/craft-plan', { gearId: 'E09' }], ['/api/gear/equip', { heroKey: 'vael', itemId: 'q1' }],
      ['/api/gear/unequip', { heroKey: 'vael', slot: 'Weapon' }], ['/api/gear/temper', { itemId: 'q1', uses: 60 }], ['/api/gear/extract', { itemId: 'q1' }], ['/api/gear/select-active', { heroKey: 'vael', itemId: 'q1' }]]) {
      const r = await call(route, Object.assign({ expectedRevision: rev, requestId: 'lf-' + route }, body), a.T);
      if (r.status === 400 && r.data && r.data.error === 'The Forge opens at player level 25.' && r.data.errCode === 'the_forge_opens_at_player_level') refused.push(route.slice(10)); }
    ok(refused.length === 8, 'level 1: all 8 Forge action routes refused with "The Forge opens at player level 25." + its code (' + refused.join(', ') + ')');
    const u = S.DB.users[a.id]; u.led.px = S.D_TROOP_CUM[24]; const lv = S.ledPlayerLevel(u.led);
    const r24 = await call('/api/gear/temper', { expectedRevision: rev, itemId: 'q1', uses: 60, requestId: 'lf-24' }, a.T);
    ok(lv === 24 && r24.data && r24.data.error === 'The Forge opens at player level 25.', 'level ' + lv + ': still refused');
    u.led.px = S.D_TROOP_CUM[25]; const lv25 = S.ledPlayerLevel(u.led);
    const r25 = await call('/api/gear/temper', { expectedRevision: rev, itemId: 'q1', uses: 60, requestId: 'lf-25' }, a.T);
    ok(lv25 === 25 && r25.data && r25.data.error !== 'The Forge opens at player level 25.', 'level 25: the route runs (answer: ' + JSON.stringify(r25.data && (r25.data.error || r25.data.ok)) + ')'); }

  console.log('== 2. a hero wears only its own nine items ==');
  { const a = await guest('forge-own'); const u = S.DB.users[a.id]; u.led.px = 3400;
    const owned = Object.keys(u.led.unlocked || {}).filter(k => u.led.unlocked[k] && HG[k]); const h = owned[0];
    const other = Object.keys(HG).find(k => k !== h && HG[k][0] !== HG[h][0]); const foreign = HG[other][0], own = HG[h][0], now = Date.now();
    u.gear = { revision: 1, heroGearV: 1, fragments: {}, subs: {}, seq: 10, active: {}, equipped: {}, items: { a: { d: foreign, temper: 0, prog: 0, dustSpent: 0, createdAt: now }, b: { d: own, temper: 0, prog: 0, dustSpent: 0, createdAt: now } } };
    const r1 = await call('/api/gear/equip', { expectedRevision: 1, heroKey: h, itemId: 'a', requestId: 'lf-eq-a' }, a.T);
    ok(r1.status === 400 && /cannot wear that item\.$/.test(String(r1.data && r1.data.error)) && r1.data.errCode === 'hero_cannot_wear_that_item' && !(S.DB.users[a.id].gear.equipped[h] || {}).Weapon && !Object.values(S.DB.users[a.id].gear.equipped[h] || {}).includes('a'),
      h + ' + ' + other + '\'s ' + foreign + ': refused (' + (r1.data && r1.data.error) + ')');
    const r2 = await call('/api/gear/equip', { expectedRevision: S.DB.users[a.id].gear.revision, heroKey: h, itemId: 'b', requestId: 'lf-eq-b' }, a.T);
    ok(r2.status === 200 && r2.data && r2.data.ok === true, 'CONTROL: ' + h + '\'s own ' + own + ' equips (' + JSON.stringify(r2.data && (r2.data.error || r2.data.ok)) + ')');
    const E = require(path.join(root, 'server', 'error-codes.js')); const t = E.table();
    ok(t.some(x => x.code === 'the_forge_opens_at_player_level') && t.some(x => x.code === 'hero_cannot_wear_that_item'), 'both refusals have error codes');
    const spec = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'lang', 'specs', 'C_server.json'), 'utf8')); const sk = spec.keys || spec;
    ok(['err.the_forge_opens_at_player_level', 'err.hero_cannot_wear_that_item'].every(k => typeof sk[k] === 'string'), 'and English in tools/lang/specs/C_server.json');
    for (const c of CODES) { const j = JSON.parse(fs.readFileSync(path.join(root, 'lang', c + '.json'), 'utf8'));
      ok(/\{forge_unlock_level\}/.test(j['err.the_forge_opens_at_player_level'] || '') && /\{name\}/.test(j['err.hero_cannot_wear_that_item'] || '') && (c === 'en' || j['err.hero_cannot_wear_that_item'] !== '{name} cannot wear that item.'), c + ': both refusals translated'); } }

  console.log('== 3. Diamond Pool card odds = the server table ==');
  { const G = S.GEM_ODDS || {}; const v = J('wishDiamondOddsVars()') || {};
    ok(v.h3 === '3' && v.h2 === '10' && v.f3 === '25' && v.f2 === '32' && v.gf === '20' && v.gn === '10', 'card numbers without a server answer: ' + JSON.stringify(v));
    const mine = J('[WISH_GEM_FULL3,WISH_GEM_FULL2,WISH_GEM_FRAG3,WISH_GEM_FRAG2,WISH_GEM_GLYPH_FULL,WISH_GEM_GLYPH_NEXT]') || [];
    ok(JSON.stringify(mine) === JSON.stringify([G.full3, G.full2, G.frag3, G.frag2, G.glyphFull, G.glyphNext]), 'the page\'s table equals server GEM_ODDS ' + JSON.stringify(G));
    const sv = J(`(function(){ const k=POOLSRV; POOLSRV={odds:{full3:0.04,full2:0.11,frag3:0.2,frag2:0.3,glyphFull:0.25,glyphNext:0.1}}; try{ return wishDiamondOddsVars(); } finally { POOLSRV=k; } })()`) || {};
    ok(sv.h3 === '4' && sv.f3 === '20' && sv.gf === '25', 'with /api/pool/state loaded the card shows the server\'s published numbers');
    const en = J(`t('wish.diamond_odds',Object.assign({star:'*'},wishDiamondOddsVars()))`) || '';
    ok(en === '3* hero 3% · 2* hero 10% · 3* fragments 25% · 2* fragments 32% · Full glyph 20% · Next-level glyph 10% · hero by wish 40', 'English card: "' + en + '"');
    ok(/t\('wish\.diamond_odds',Object\.assign\(\{star:uiIcon\('star-filled'\)\},wishDiamondOddsVars\(\)\)\)/.test(html), 'the Diamond card passes the numbers');
    const V = JSON.parse(html.match(/\nconst EW_LANG_V=(\{.*?\});\r?\n/)[1]);
    for (const c of CODES) { const raw = fs.readFileSync(path.join(root, 'lang', c + '.json'), 'utf8'), s = JSON.parse(raw)['wish.diamond_odds'] || '';
      ok(!/Ember Roast|17|23/.test(s) && ['{h3}', '{h2}', '{f3}', '{f2}', '{gf}', '{gn}', '{star}'].every(x => s.includes(x)) && crypto.createHash('sha1').update(raw).digest('hex').slice(0, 8) === V[c], c + ': no Ember Roast, no typed odds, pack hash matches EW_LANG_V'); } }

  console.log('== 4. Market restock countdown ticks ==');
  { ok(/<span id="mercRestock">\$\{t\('market\.restock',\{t:fmtDur\(left\)\}\)\}<\/span>/.test(html), 'the countdown has its own element');
    ok(/function renderMarket\(refreshStock=true\)\{\r?\n  const b=document\.getElementById\('marketBody'\); if\(!b\) return;\r?\n  marketTickStart\(\);/.test(html), 'opening the Market starts the 1 s timer');
    const r = J(`(function(){ const realDoc=globalThis.document, realG=G.market, realRM=renderMarket; let shown=true, txt='', redraws=0;
        const els={ market:{classList:{contains:c=>c==='active'&&shown}}, mercRestock:{set textContent(v){ txt=v; }} };
        globalThis.document=new Proxy(realDoc,{get:(o,k)=>k==='getElementById'?(id=>els[id]||null):o[k]});
        renderMarket=function(){ redraws++; };
        try{ const out=[]; G.market={ts:Date.now()-MARKET_REFRESH_MS+65000,offers:[]};
          out.push(marketTickStep(), txt);
          G.market.ts=Date.now()-MARKET_REFRESH_MS-1; out.push(marketTickStep(), marketTickStep(), redraws);
          G.market.ts=Date.now(); out.push(marketTickStep());
          shown=false; out.push(marketTickStep(), _marketTick);
          return out; } finally { globalThis.document=realDoc; G.market=realG; renderMarket=realRM; marketTickStop(); } })()`) || [];
    ok(r[0] === 'tick' && /1:0[45]/.test(String(r[1] || '')), 'a tick rewrites the countdown ("' + r[1] + '")');
    ok(r[2] === 'restock' && r[3] === 'waiting' && r[4] === 1, 'at zero the Market redraws once (fresh stock), not every second');
    ok(r[5] === 'tick', 'after the new stock arrives it counts down again');
    ok(r[6] === 'stopped' && r[7] === 0, 'the timer stops once the Market is closed'); }
})();
run.then(() => { console.log((SOFT ? 'SOFT ' : '') + 'test_lockdown_forge_pool_market_1455.js: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); },
  e => { console.error(e && e.stack || e); process.exit(1); });
