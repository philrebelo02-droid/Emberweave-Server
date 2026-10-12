'use strict';
// v1127 PER-ATTACK ACCOUNT COPY: a world attack plans on copy-on-first-touch views of the attacker's, defender's and allies' accounts
// instead of whole JSON copies. The fight must not change at all:
//  - one seeded world (8 attacker/defender pairs with different squads and levels, defenders with a wall and big untouched fields:
//    a stored save blob, war mail, ledger history) is copied twice and run on THIS tree and on 59eaefba (whole copies) with the same
//    server secret and the same requests: declare, march, attack - two rounds, so the first fight's wounds carry into the second;
//  - every attack reply (the fight result, its replay: seed, snapshots, foe, duration in ticks, hp/energy per unit) and every
//    account afterwards (ledger, Witch's Hut HP, marches, mail) are identical after dropping only ids and clock fields;
//  - the copy is smaller: bytes copied per attack (save-stats attackCopy) vs the whole accounts' JSON size;
//  - control: a tree whose staged copy drops one field the fight reads (the hero ledger) must be caught by the same comparison.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const R = require('./helpers/split-rig.cjs');
const WS = require('../server/world-store.js');
const SQUADS = [['vael', 'sylthaine', 'vireo'], ['brannus', 'yenna', 'seyla'], ['kharos', 'tharl', 'orryn'], ['hobb', 'askel', 'calypsa']];
const CLOCK = /^(t|ts|at|now|iat|exp|created|lastSeen|depart|arrive|home|reachAt|readyAt|expireAt|startedAt|landedAt|resolvedAt|sentAt|serverNow|mtime|day|dayKey|skillImported)$|At$|Ms$/;
const IDS = /^(id|marchId|mid|requestId|rid|key)$/;
function norm(v, k) {
  if (Array.isArray(v)) return v.map(x => norm(x));
  if (v && typeof v === 'object') { const o = {}; for (const kk of Object.keys(v).sort()) { if (CLOCK.test(kk) || IDS.test(kk)) continue; o[kk] = norm(v[kk], kk); } return o; }
  if (typeof v === 'string' && /^[0-9a-f]{16}$/.test(v)) return '<id>';
  return v;
}
const digest = v => JSON.stringify(norm(v));

// the seed world: built once on this tree, stored as split-v1 so both trees read it
async function seedWorld() {
  const S = await R.server({ env: { DB_STORE_PIECES: '0' } });
  try {
    const B = await R.boot(S, 'ak', 16);
    for (let i = 0; i < 16; i++) {
      const p = B.players[i], sq = SQUADS[i % SQUADS.length];
      const g = await S.req('POST', '/api/admin/led-grant', { userId: p.id, unlock: sq, heroKeys: sq, px: 900000 + i * 40000, heroXp: 150000 + i * 30000 }, B.A);
      assert.equal(g.body.ok, true, JSON.stringify(g.body).slice(0, 120));
      await S.req('POST', '/api/save', { wall: sq.map(k => ({ key: k })), roster: { __save: JSON.stringify({ filler: 'z'.repeat(20000 + i * 1000), whispers: {} }) } }, p.token, p.ip);
    }
    await R.sleep(800); await S.kill();
    const w = WS.readWorld(S.db);
    for (const p of B.players) { const u = w.users[p.id]; u.pvpMail = Array.from({ length: 20 }, (_, j) => ({ id: 'pm' + j, from: 'x', kind: 'note', t: j, text: 'q'.repeat(300) })); }
    WS.writeWorld(S.db, w);
    return { db: S.db, B };
  } finally { await S.kill(); }
}

async function runOn(dir, seed) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-atkcopy-')), db = path.join(temp, 'db.json');
  fs.copyFileSync(seed.db, db); fs.cpSync(seed.db + '.d', db + '.d', { recursive: true });
  const S = await R.server({ dir, temp, db, env: { DB_STORE_PIECES: '0' } });
  await S.start(seed.B.adminId);
  try {
    const A = (await S.req('POST', '/api/login', { name: 'akAdm', pass: 'password1' })).body.token;
    const P = seed.B.players, replies = [];
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 8; i++) {
        const atk = P[i], def = P[8 + i], sq = SQUADS[i % SQUADS.length];
        if (round === 0) { const w = await S.req('POST', '/api/world/war/declare', { defId: def.id, requestId: 'ac-war-' + i }, atk.token, atk.ip);
          assert.ok(w.body.ok, 'declare ' + JSON.stringify(w.body).slice(0, 160)); await R.sleep(Math.max(0, (w.body.readyAt || 0) - Date.now()) + 60); }
        const m = await S.req('POST', '/api/world/city/start', { defId: def.id, heroIds: sq, requestId: 'ac-march-' + round + '-' + i }, atk.token, atk.ip);
        if (!m.body.ok && /0% HP/.test(m.body.error || '')) { replies.push({ skipped: 'fallen squad' }); continue; }   // a squad wiped in round 1 cannot march again (the same on both trees)
        assert.ok(m.body.ok, 'march ' + JSON.stringify(m.body).slice(0, 160)); await R.sleep(Math.max(0, m.body.arriveAt - Date.now()) + 60);
        let a = null; for (let t = 0; t < 20; t++) { a = await S.req('POST', '/api/pvp/attack', { defId: def.id, marchId: m.body.marchId, requestId: 'ac-atk-' + round + '-' + i }, atk.token, atk.ip); if (a.status !== 503) break; await R.sleep(200); }
        assert.ok(a.body.ok, 'attack ' + JSON.stringify(a.body).slice(0, 200));
        replies.push(a.body);
      }
    }
    await R.sleep(500);
    const st = (await S.req('GET', '/api/dev/save-stats', null, A)).body;
    await S.kill();
    const w = WS.readWorld(db), accounts = {};
    for (const p of P) { const u = w.users[p.id]; accounts[p.id] = { led: u.led, witch: u.witch, worldCityMarches: u.worldCityMarches, worldWars: u.worldWars, pvpMail: u.pvpMail, pvpDay: u.pvpDay, gainLog: u.gainLog, wall: u.wall, team: u.team }; }
    const sizes = P.slice(0, 16).map(p => JSON.stringify(w.users[p.id]).length);
    return { replies, accounts, copy: st.attackCopy || null, sizes };
  } finally { await S.kill(); }
}

function compare(a, b) {
  const diffs = [];
  a.replies.forEach((r, i) => { if (digest(r) !== digest(b.replies[i])) diffs.push('attack ' + i); });
  for (const id of Object.keys(a.accounts)) if (digest(a.accounts[id]) !== digest(b.accounts[id])) { diffs.push('account ' + id.slice(0, 6));
    if (process.env.DBG && diffs.length === 1) { const x = norm(a.accounts[id]), y = norm(b.accounts[id]); const walk = (p, u, v) => { if (JSON.stringify(u) === JSON.stringify(v)) return; if (u && v && typeof u === 'object' && typeof v === 'object') { for (const k of new Set([...Object.keys(u), ...Object.keys(v)])) walk(p + '.' + k, u[k], v[k]); } else console.log('DIFF', p, JSON.stringify(u).slice(0, 150), '|', JSON.stringify(v).slice(0, 150)); }; walk('', x, y); } }
  return diffs;
}

// a deliberately broken copy for the control: the staged ledger hides the hero levels the fight reads
function brokenTree() {
  const dir = path.join(R.root, '.ctl-broken-copy'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  const tar = execFileSync('git', ['archive', '--format=tar', 'HEAD', '--', '.', ':!assets'], { cwd: R.root, maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', dir.split(path.sep).join('/')], { input: tar, maxBuffer: 1 << 30 });
  for (const f of ['server.js', ...fs.readdirSync(path.join(R.root, 'server')).filter(n => /\.js$/.test(n)).map(n => 'server/' + n)]) fs.copyFileSync(path.join(R.root, f), path.join(dir, f));   // this tree's code, whatever is committed (v1128: every server module - store-io.js is new)
  fs.symlinkSync(path.join(R.root, 'assets'), path.join(dir, 'assets'), 'junction');
  const f = path.join(dir, 'server.js'); let s = fs.readFileSync(f, 'utf8');
  const marker = "function _stageAccount(live,depth){\r\n  const out={}, copied=new Map(), touched=new Set();";
  assert.ok(s.includes(marker) || s.includes(marker.replace(/\r\n/g, '\n')), 'broken-tree marker present');
  s = s.replace(/(function _stageAccount\(live,depth\)\{\r?\n  const out=\{\}, copied=new Map\(\), touched=new Set\(\);)/, "$1 if(live&&live.hero&&live.unlocked) live={...live,hero:{}};");
  fs.writeFileSync(f, s); return dir;
}

(async () => {
  let failed = false, broken = null;
  try {
    const seed = await seedWorld();
    const mine = await runOn(R.root, seed), ctl = await runOn(R.controlTree(), seed);
    const diffs = compare(mine, ctl);
    R.ok(mine.replies.length === 16 && ctl.replies.length === 16, '16 attacks ran on both trees (8 pairs x 2 rounds)');
    R.ok(diffs.length === 0, 'every attack reply (result + replay: seed, snapshots, foe, duration in ticks, units) and every account after is identical to ' + R.CONTROL_SHA + ' (whole copies) - ' + (diffs.length ? 'DIFF: ' + diffs.join(', ') : '0 differences'));
    const r0 = mine.replies[0], dur = (r0.replay && r0.replay.durationSec) || (r0.battle && r0.battle.durationSec);
    R.ok(mine.replies.filter(r => !r.skipped).length >= 8 && mine.replies.filter(r => !r.skipped).every(r => r.replay && Array.isArray(r.replay.snaps) && r.replay.snaps.length), 'the compared replies carry the full replay (' + mine.replies.filter(r => !r.skipped).length + ' fights; first ' + dur + ' s)');
    const whole = mine.sizes.reduce((x, y) => x + y, 0) / mine.sizes.length, perAttack = mine.copy ? mine.copy.bytesCopied / mine.replies.filter(r => !r.skipped).length : null;
    R.ok(mine.copy && mine.copy.accounts === 2 * mine.replies.filter(r => !r.skipped).length && perAttack < whole, 'bytes copied per attack: ' + Math.round(perAttack) + ' B for two accounts (was two whole accounts, ' + Math.round(2 * whole) + ' B)');
    broken = brokenTree();
    const bad = await runOn(broken, seed), badDiffs = compare(bad, ctl);
    R.ok(badDiffs.length > 0, 'CONTROL: a copy that hides the hero ledger from the fight is caught by the same comparison (' + badDiffs.length + ' differences)');
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { R.removeControlTree(); if (broken) { try { fs.unlinkSync(path.join(broken, 'assets')); } catch (_) {} fs.rmSync(broken, { recursive: true, force: true }); } }
  console.log('test_attack_copy.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
