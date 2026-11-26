// v1455 lockdown audit 25 Nov 2026 - Guild Hall (audit/guild-06.md) fixes. Server in-process (temp DB), page headless (server/sim-host.js).
//  1. Results summary - citadel / assault totals come from the whole war (server warSummaryOf), not the last 30 events of the view.
//  2. No auto-placement - the match view shows how many members / lines missed the lock (missedMembers / missedLines).
//  3. Claim reward - the Skyfall claim stops at the arena-coin cap and leaves a ledger transaction.
//  4. Unclaimed coins shown - the line says ARENA coins (what the claim pays), in all 16 languages.
// CONTROL: LF_HTML=<v1454 page> LF_SERVER=<v1454 server.js> LF_SOFT=1 lists the checks the old code fails. Exit 0 = all passed.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const { loadServer, root } = require('./lockdown-1455-lib.js');
const HTML = process.env.LF_HTML || path.join(root, 'emberweave-heroes.html');
const html = fs.readFileSync(HTML, 'utf8');
const SOFT = !!process.env.LF_SOFT; let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); return; } fail++; console.log('  FAIL ' + m); if (!SOFT) { console.log('test_lockdown_guild_1455.js: FAILED after ' + pass + ' passed'); process.exit(1); } };
const host = require(path.join(root, 'server', 'sim-host.js')).load(HTML);
const R = s => vm.runInContext(s, host.ctx, { timeout: 60000 });
const J = s => { try { const r = R('JSON.stringify(' + s + ')'); return r === undefined ? null : JSON.parse(r); } catch (e) { return { __err: String(e && e.message || e) }; } };
const CODES = ['en', 'es', 'pt-BR', 'fr', 'de', 'it', 'nl', 'ru', 'tr', 'ja', 'ko', 'zh-Hans', 'zh-Hant', 'th', 'id', 'hi'];

// a busy war: 2 citadels fell early, then 40 assaults (25 won) and 10 late lock rows - the last 30 events hold no fall at all
const T0 = 1800000000000;
const LOG = [{ t: T0, e: 'STANDING_LANE', lane: 0 }, { t: T0 + 60000, e: 'CITADEL_FELL', lane: 1, by: 'p1' }, { t: T0 + 120000, e: 'CITADEL_CAPTURED', lane: 2 }]
  .concat(Array.from({ length: 40 }, (_, i) => ({ t: T0 + 200000 + i * 1000, e: 'ASSAULT', lane: i % 5, a: 'p1', d: 'q1', won: i < 25 })))
  .concat(Array.from({ length: 10 }, (_, i) => ({ t: T0 + 300000 + i, e: 'LATE_LINE', lane: 0 })));

const { S, call, guest } = loadServer(module);
const run = (async () => {
  console.log('== 1. Results summary counts the whole war ==');
  { const sum = typeof S.warSummaryOf === 'function' ? S.warSummaryOf({ eventLog: LOG }) : null;
    ok(!!sum && sum.fell.length === 2 && sum.assaults === 40 && sum.assaultsWon === 25, 'server summary of a 53-event war: ' + (sum ? sum.fell.length + ' citadels, ' + sum.assaultsWon + '/' + sum.assaults + ' assaults' : 'none') + ' (want 2, 25/40)');
    const src = fs.readFileSync(process.env.LF_SERVER || path.join(root, 'server.js'), 'utf8');
    ok(/eventLog:\(m\.eventLog\|\|\[\]\)\.slice\(-30\), summary:warSummaryOf\(m\)(?: \};|,)/.test(src), 'warMatchView sends the summary beside the last 30 events');   /* v1458: the real fight log follows it */
    const m = { eventLog: LOG.slice(-30), summary: sum || undefined, you: { guildId: 'g1' }, foe: { guildId: 'g2' }, winnerGuildId: 'g1', lanes: [] };
    host.ctx.__M = m; const h = J('skyWarSummaryHTML(__M)') || '';
    const cit = (/<b style="color:#ffd45e">(\d+)<\/b> citadel/.exec(h) || [])[1], as = /<b style="color:#8fe3ff">(\d+)<\/b>\/(\d+) assaults/.exec(h) || [];
    ok(cit === '2' && as[1] === '25' && as[2] === '40', 'the VICTORY summary reads ' + cit + ' citadels and ' + as[1] + '/' + as[2] + ' assaults (the last 30 events alone give 0 and 5/20)');
    host.ctx.__M = { eventLog: LOG.slice(-30), you: { guildId: 'g1' }, winnerGuildId: 'g1', lanes: [] }; const old = J('skyWarSummaryHTML(__M)') || '';
    ok(/<b style="color:#ffd45e">0<\/b> citadel/.test(old), 'CONTROL: an old server (no summary) still draws from the 30 events'); }

  console.log('== 2. members who missed the lock are shown ==');
  { const base = { id: 'm1', round: 'Round 1', state: 'live', endsAt: Date.now() + 3600000, lanes: [], eventLog: [], you: { guildId: 'g1', name: 'Ours', citadels: [], missedMembers: 3, missedLines: 9 }, foe: { guildId: 'g2', name: 'Theirs', citadels: [] } };
    host.ctx.__M = base; const h = J('skyMatchHTML(__M,false)'); const s = typeof h === 'string' ? h : JSON.stringify(h);
    ok(/class="skyMissed"/.test(s) && s.includes('3 members missed the line lock: 9 lines did not fight.'), 'live war, 3 members / 9 lines missed: "' + ((/class="skyMissed"[^>]*>([\s\S]*?)<\/div>/.exec(s) || [])[1] || s.slice(0, 120)).replace(/<[^>]+>/g, '').trim() + '"');
    host.ctx.__M = Object.assign({}, base, { you: Object.assign({}, base.you, { missedMembers: 0, missedLines: 0 }) }); const h0 = J('skyMatchHTML(__M,false)') || '';
    ok(!/class="skyMissed"/.test(String(h0)), 'nobody missed: no line');
    host.ctx.__M = Object.assign({}, base, { state: 'planning', preReveal: false }); const hp = J('skyMatchHTML(__M,false)') || '';
    ok(!/class="skyMissed"/.test(String(hp)), 'during prep (nobody has missed yet): no line'); }

  console.log('== 3. the Skyfall reward claim: arena-coin cap + ledger transaction ==');
  { const cap = S.ECON_CAP.arenaCoins;
    const a = await guest('claimcap'); a.u.coins = cap - 100; a.u.pendingWarRewards = [{ tid: 'old-week', gid: 'g1', tier: 'participant', amt: 300 }];
    const r = await call('/api/guild-war/claim-reward', { requestId: 'lf-claim-1' }, a.T); const u = S.DB.users[a.id], txs = (u.led && u.led.txs) || [], tx = txs[txs.length - 1] || {};
    ok(r.status === 200 && u.coins === cap && r.data.amount === 100, 'at cap - 100, a 300 claim stops at the cap ' + cap + ' (coins ' + u.coins + ', receipt +' + (r.data && r.data.amount) + '; was ' + (cap + 200) + ')');
    ok(/^skyfall:reward:/.test(tx.src || '') && tx.d && tx.d.arenaCoins === 100, 'the claim leaves a ledger transaction (' + (tx.src || 'none') + ' ' + JSON.stringify(tx.d || {}) + ')');
    const r2 = await call('/api/guild-war/claim-reward', { requestId: 'lf-claim-1' }, a.T);
    ok(r2.status === 200 && r2.data.amount === 100 && S.DB.users[a.id].coins === cap, 'the same requestId answers the same receipt, paid once');
    const b = await guest('claimok'); b.u.coins = 1000; b.u.pendingWarRewards = [{ tid: 'w1', gid: 'g1', tier: 'finalist', amt: 1000 }, { tid: 'w2', gid: 'g1', tier: 'champion', amt: 2000 }];
    const r3 = await call('/api/guild-war/claim-reward', { requestId: 'lf-claim-2' }, b.T);
    ok(r3.status === 200 && S.DB.users[b.id].coins === 4000 && r3.data.amount === 3000, 'under the cap the claim pays in full: 1,000 + 3,000 = ' + S.DB.users[b.id].coins + ' (amounts unchanged)'); }

  console.log('== 4. the unclaimed line says arena coins, in all 16 languages ==');
  { const CV = JSON.parse(html.match(/\nconst EW_LANG_V=(\{.*?\});\r?\n/)[1]); const OLD = { en: 'guild coins', de: 'Gildenmünzen', ja: 'ギルドコイン', ko: '길드 코인', 'zh-Hans': '公会币', ru: 'монет гильдии', fr: 'pièces de guilde', es: 'monedas de gremio' };
    for (const c of CODES) { const raw = fs.readFileSync(path.join(root, 'lang', c + '.json'), 'utf8'), j = JSON.parse(raw);
      const u = j['skytour.unclaimed'] || '', ml = j['skyfall.missed_lock'] || '';
      ok(u.includes('{n}') && !(OLD[c] && u.includes(OLD[c])) && ml.includes('{n}') && ml.includes('{m}') && crypto.createHash('sha1').update(raw).digest('hex').slice(0, 8) === CV[c],
        c + ': "' + u + '" / "' + ml + '", pack hash matches EW_LANG_V'); }
    const en = JSON.parse(fs.readFileSync(path.join(root, 'lang', 'en.json'), 'utf8'));
    ok(en['skytour.unclaimed'] === '{n} unclaimed arena coins from the last tournament.', 'English: "' + en['skytour.unclaimed'] + '"');
    ok(CODES.slice(1).every(c => JSON.parse(fs.readFileSync(path.join(root, 'lang', c + '.json'), 'utf8'))['skyfall.missed_lock'] !== en['skyfall.missed_lock']), 'the missed-lock line is translated in all 15 languages (none left in English)');
    const inl = JSON.parse(html.match(/\nconst EW_LANG_EN=(\{.*?\});\r?\n/)[1]);
    ok(inl['skytour.unclaimed'] === en['skytour.unclaimed'] && inl['skyfall.missed_lock'] === en['skyfall.missed_lock'], 'the page\'s inline English carries both lines'); }
})();
run.then(() => { console.log((SOFT ? 'SOFT ' : '') + 'test_lockdown_guild_1455.js: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); },
  e => { console.error(e && e.stack || e); process.exit(1); });
