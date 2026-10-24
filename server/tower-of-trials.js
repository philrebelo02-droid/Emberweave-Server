/* TOWER OF TRIALS v2 - THE ECHO SPIRE (Claude, 24 Oct 2026). Phil, 23 Oct night: "pick the best out of embers tower of trials ideas
   and all 3 of you need to make it a reality, ui, picture, logic and all. it needs to be unique". Ember's idea 04 (taskings/TOWER OF TRIALS
   REDESIGN 23OCT2026/04 Echo Spire), Grok's two QA notes, build spec 11 in the same folder.

   Before: /api/tower/ascend was a power check - no team, no fight (server.js 7332 in v1216). Now EVERY FLOOR IS A FIGHT on the Province /
   Starless Well pipeline: the server keeps the attempt (frozen snapshots, its seed, the waves), the player fights it, the WITNESSED
   result pays, and the server's replay only files an incident (Phil 28 Sep: the server never decides a fight).

   SEASONS: one week each (7 game days on the 09:00 New York day key). A new season starts the climb at a CHECKPOINT
   (best - 20, rounded down to 5); best floor ever is kept forever. Re-climbing the band checkpoint+1..best is the season's run.
   ECHOES: every floor you win records the five who won it. Next season, a floor in the band that has a record from an earlier season is
   an ECHO floor: your own past five come back as Echo Wardens (isHero foes), scaled to that floor's requirement - never easier than the
   floor (Grok QA #2). No record (a new player, season 1, a floor never reached) = a normal Guardian floor (Grok QA #1).
   PAY: a NEW floor (above best) pays towerFloorPay exactly as before (once ever); a re-climbed floor pays nothing again; an echo laid to
   rest pays ECHO_BONUS of that floor's gold (once per floor per season, no gems). Tribute follows THIS season's floor. */
'use strict';
const SEASON_DAYS = 7, CHECKPOINT_BACK = 20, KEEP_RECORDS = 25;
const SEASON_EPOCH_DAY = '2026-10-19';                 // a Monday on the 09:00 New York key: season 0 = 19-25 Oct 2026
const ECHO_BONUS = +(process.env.TOWER_ECHO_BONUS || 0.10);
const SESSION_MS = 6 * 3600 * 1000, MIN_BATTLE_MS = +(process.env.TOWER_MIN_BATTLE_MS || 8000);
const OPEN_LEVEL = 40, ECHO_RANK = 3;
const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

function dayIndex(dayKey) { const t = Date.parse(String(dayKey) + 'T00:00:00Z'); return Number.isFinite(t) ? Math.floor(t / 86400000) : 0; }
function seasonOf(dayKey) { return Math.max(0, Math.floor((dayIndex(dayKey) - dayIndex(SEASON_EPOCH_DAY)) / SEASON_DAYS)); }
function seasonEndsDay(season) { const d = new Date((dayIndex(SEASON_EPOCH_DAY) + (season + 1) * SEASON_DAYS) * 86400000); return d.toISOString().slice(0, 10); }
function checkpoint(best) { return Math.max(0, Math.floor(((best | 0) - CHECKPOINT_BACK) / 5) * 5); }

/* the ledger: v1 fields (floor = best ever, trib, mig, srv) are kept; v2 adds season, sf (season floor), rec (records), echo, rested, att */
function towerState(T, dayKey) {
  if (!T.rec || typeof T.rec !== 'object' || Array.isArray(T.rec)) T.rec = {};
  const s = seasonOf(dayKey);
  if (T.season !== s) {
    T.season = s; T.sf = checkpoint(T.floor); T.rested = {}; T.att = null; T.echo = {};
    for (const f of Object.keys(T.rec)) { const r = T.rec[f], n = f | 0;
      if (r && (r.season | 0) < s && n > T.sf && n <= (T.floor | 0) && Array.isArray(r.keys) && r.keys.length) T.echo[n] = r; }
  }
  if (!T.rested || typeof T.rested !== 'object') T.rested = {};
  if (!T.echo || typeof T.echo !== 'object') T.echo = {};
  if (!(T.sf >= 0)) T.sf = 0;
  return T;
}

/* GUARDIAN floors borrow the waves of the campaign node whose recommendedPower is nearest below the floor's requirement (its waves are
   engine-tuned, realEngineTuned), scaled up by the ratio: HP by r^0.6, damage by r^0.4 (power ~ HP x damage). Every 5th floor (Elite)
   borrows a boss node, so wave 3 holds its boss. Which node of a few near the requirement is picked rotates with the season. */
function guardianWaves(f, req, nodes, season) {
  const elite = f % 5 === 0;
  const pool = nodes.filter(n => n && Array.isArray(n.waves) && n.waves.length && n.recommendedPower > 0 && ((n.checkpoint === 'boss') === elite));
  if (!pool.length) return null;
  pool.sort((a, b) => a.recommendedPower - b.recommendedPower);
  let i = 0; for (let k = 0; k < pool.length; k++) if (pool[k].recommendedPower <= req) i = k;
  const near = pool.slice(Math.max(0, i - 2), i + 1), node = near[(f * 7 + season * 3) % near.length];
  const r = Math.max(1, req / node.recommendedPower), hm = Math.pow(r, 0.6), dm = Math.pow(r, 0.4);
  return { node: node.id, waves: node.waves.map(w => w.map(m => Object.assign({}, m, { hpMul: +((m.hpMul || 1) * hm).toFixed(4), dmgMul: +((m.dmgMul || 1) * dm).toFixed(4) }))) };
}
/* ECHO floors: ONE wave of the recorded five at their recorded levels, scaled to the floor's requirement (Grok QA #2) - HP by m,
   damage by m^0.7 (the Starless Well's hero-foe convention), m = requirement / the lineup's power when it was recorded, never below 1 */
function echoWaves(rec, req) {
  const m = Math.max(1, Math.min(50, req / Math.max(1, rec.pow | 0))), dd = Math.pow(m, 0.7);
  return [rec.keys.slice(0, 5).map((key, i) => ({ key, lvl: Math.max(1, (rec.lv && rec.lv[i]) | 0 || 1), hpMul: +m.toFixed(4), dmgMul: +dd.toFixed(4), isHero: true, rank: ECHO_RANK, echo: true }))];
}
function floorPlan(ctx, T, f) {
  const req = ctx.towerReqS(f), echo = own(T.echo, f) && !T.rested[f] ? T.echo[f] : null;
  if (echo) return { floor: f, type: 'echo', req, elite: f % 5 === 0, waves: echoWaves(echo, req), echo: { season: echo.season | 0, keys: echo.keys.slice(), recordedFloor: f, t: echo.t || 0 } };
  const g = guardianWaves(f, req, ctx.campaignNodes(), T.season | 0);
  return g ? { floor: f, type: 'guardian', req, elite: f % 5 === 0, waves: g.waves, node: g.node, echo: null } : null;
}
function payFor(ctx, T, plan) {
  const fp = ctx.towerFloorPay(plan.floor), fresh = plan.floor > (T.floor | 0);
  /* a floor whose gold/gems an old client already received (its exact receipt, v948) is climbed without paying that part again */
  const pb = (part) => !!(ctx.paidBefore && ctx.paidBefore(plan.floor, part));
  return { gold: fresh && !pb('gold') ? fp.gold : 0, gems: fresh && !pb('gems') ? fp.gems : 0, echoBonus: plan.type === 'echo' ? Math.round(ECHO_BONUS * fp.gold) : 0, newFloor: fresh };
}
function foesView(waves) { const out = []; for (const w of waves || []) for (const m of w) out.push({ key: m.key, lvl: m.lvl | 0, isHero: !!m.isHero, boss: !!m.boss }); return out; }
function view(ctx, T) {
  const next = floorPlan(ctx, T, (T.sf | 0) + 1);
  return { ok: true, floor: T.sf | 0, best: T.floor | 0, season: T.season | 0, seasonEnds: seasonEndsDay(T.season | 0), start: checkpoint(T.floor),
    trib: T.trib || '', today: ctx.dayKey(), power: ctx.teamPower(),
    next: next ? { floor: next.floor, type: next.type, req: next.req, elite: next.elite, foes: foesView(next.waves), echo: next.echo, pay: payFor(ctx, T, next) } : null,
    echoes: Object.keys(T.echo).map(Number).filter(f => !T.rested[f]).sort((a, b) => a - b),
    rested: Object.keys(T.rested).map(Number).sort((a, b) => a - b), records: Object.keys(T.rec).length };
}

/* ctx: me, led(), T(led), body, dayKey, teamPower, playerLevel, towerReqS, towerFloorPay, towerTribPay, campaignNodes, campaignHeroSpec,
   heroDisplayName, ownsHero, cardPower, simHost, sanitizeInputLog, sha256hex, uid, crypto, commit(key, fn) (a durable commit),
   credit(me, led, gold, gems, why), ledTx, feedbackCheatSignal, isDev */
async function handle(p, method, ctx) {
  if (p !== '/api/tower/start' && p !== '/api/tower/resolve') return null;
  if (method !== 'POST') return { status: 404, body: { error: 'not found' } };
  const b = await ctx.body(), reqId = (typeof b.requestId === 'string' && b.requestId.length >= 1 && b.requestId.length <= 48) ? b.requestId : null;
  if (!reqId) return { status: 400, body: { error: 'requestId must be a string of 1-48 characters' } };
  const out = ctx.commit(p.slice(11) + ':' + reqId, (me) => {
    const led = ctx.led(me), T = towerState(ctx.T(led), ctx.dayKey()), no = e => ({ ok: false, error: e });
    if (!T.mig) return no('Open the Tower of Trials first.');
    if (!ctx.isDev(me) && ctx.playerLevel(led) < OPEN_LEVEL) return no('The Tower of Trials opens at level ' + OPEN_LEVEL + '.');
    if (p === '/api/tower/start') {
      const f = (T.sf | 0) + 1, plan = floorPlan(ctx, T, f); if (!plan) return no('The Tower is unavailable.');
      const ids = Array.isArray(b.heroIds) ? [...new Set(b.heroIds.map(String))].slice(0, 5) : [];
      if (!ids.length) return no('Pick your squad (no duplicates).');
      for (const k of ids) if (!ctx.ownsHero(led, k)) return no('You have not unlocked ' + ctx.heroDisplayName(k) + '.');
      const specs = ids.map(k => ctx.campaignHeroSpec(me, k)); if (specs.some(x => !x)) return no('Unknown hero.');
      const host = ctx.simHost(); let snaps = null;
      if (host) { try { snaps = host.snapFromSpecs(specs); } catch (e) { console.error('sim-host snapFromSpecs failed (tower):', e.message); } }
      const seed = (ctx.crypto.randomBytes(4).readUInt32BE(0)) >>> 0;
      T.att = { id: ctx.uid(), floor: f, type: plan.type, heroIds: ids, lv: specs.map(s => s.level | 0), pow: ids.reduce((a, k) => a + (ctx.cardPower(me, k) | 0), 0),
        snaps, seed, waves: plan.waves, engine: (host && host.buildVersion) || null, startedAt: Date.now(), season: T.season | 0 };
      return { ok: true, attemptId: T.att.id, floor: f, type: plan.type, elite: plan.elite, seed, snaps, waves: plan.waves, engine: T.att.engine, echo: plan.echo, pay: payFor(ctx, T, plan) };
    }
    /* resolve */
    const a = T.att; if (!a || a.id !== String(b.attemptId || '')) return no('No matching Tower battle (the season may have turned).');
    T.att = null;
    if (Date.now() - (a.startedAt || 0) > SESSION_MS) return Object.assign(no('That battle expired - nothing was spent.'), { expired: true });
    if (a.floor !== (T.sf | 0) + 1 || (a.season | 0) !== (T.season | 0)) return no('That battle no longer matches your floor - nothing was paid.');
    const clientEnd = (typeof b.digest === 'string') ? b.digest : ''; let witnessed = null;
    try { const d = JSON.parse(clientEnd), cs = Number(b.stars);
      if (d && typeof d.won === 'boolean' && d.won === b.won && Number.isFinite(d.t) && d.t >= 0 && d.t <= SESSION_MS / 1000 && Array.isArray(d.u) && d.u.length >= a.heroIds.length
        && ((d.won && Number.isInteger(cs) && cs >= 1 && cs <= 3) || (!d.won && cs === 0))) witnessed = { won: d.won, stars: cs };
    } catch (e) {}
    if (!witnessed) return Object.assign(no('Battle result was incomplete - nothing was spent.'), { unverified: true });
    const inputLog = ctx.sanitizeInputLog(b.inputLog), host = ctx.simHost(); let rep = null;
    try { if (host && a.snaps && a.snaps.length) rep = host.campaign(a.snaps, a.waves, a.seed >>> 0, inputLog); } catch (e) { console.error('sim-host replay failed (tower):', e.message); }
    const srv = rep ? String(rep.digest || '') : '', match = !!srv && ctx.sha256hex(clientEnd) === ctx.sha256hex(srv);
    if (!match) { led.battleIncidents = (led.battleIncidents || []).concat([{ t: Date.now(), stage: 'tower-' + a.floor, mode: 'tower:' + a.type, why: rep ? 'digest-mismatch' : 'replay-unavailable',
        source: 'submitted-log', playerTruth: true, engine: a.engine, seed: a.seed >>> 0, inputs: inputLog.length, server: srv ? ctx.sha256hex(srv) : null, client: ctx.sha256hex(clientEnd),
        serverWon: rep ? !!rep.won : null, witnessedWon: witnessed.won, witnessedStars: witnessed.stars, transcript: inputLog }]).slice(-20);
      if (rep && srv) ctx.feedbackCheatSignal(me, 'tower-replay:' + a.id, 'Tower replay mismatch at floor ' + a.floor + ' (' + a.type + '): serverWon ' + !!rep.won + ', witnessedWon ' + witnessed.won +
        ', seed ' + (a.seed >>> 0) + ', serverDigest ' + ctx.sha256hex(srv) + ', clientDigest ' + ctx.sha256hex(clientEnd) + '.', 'battle integrity'); }
    const battleMs = Date.now() - (a.startedAt || 0);
    if (witnessed.won && battleMs < MIN_BATTLE_MS) ctx.feedbackCheatSignal(me, 'tower-fast:' + a.id, 'Tower fast win at floor ' + a.floor + ': ' + battleMs + ' ms against ' + MIN_BATTLE_MS + ' ms minimum.', 'battle timing');
    led.battleReceipts = (led.battleReceipts || []).concat([{ t: Date.now(), stage: 'tower-' + a.floor, mode: 'tower:' + a.type, node: a.floor, seed: a.seed >>> 0, engine: a.engine,
      source: 'submitted-log', heroes: a.heroIds.slice(), inputs: inputLog.length, won: witnessed.won, stars: witnessed.stars, digest: srv ? ctx.sha256hex(srv) : null,
      transcript: inputLog, clientDigest: ctx.sha256hex(clientEnd), match }]).slice(-40);
    let gold = 0, gems = 0, echoBonus = 0, newBest = false, rested = false;
    if (witnessed.won) {
      const plan = { floor: a.floor, type: a.type }, pay = payFor(ctx, T, plan);
      gold = pay.gold; gems = pay.gems; echoBonus = pay.echoBonus;
      if (a.type === 'echo') { T.rested[a.floor] = 1; rested = true; }
      if (a.floor > (T.floor | 0)) { T.floor = a.floor; newBest = true; }
      T.sf = a.floor; T.srv = 1;
      T.rec[a.floor] = { keys: a.heroIds.slice(), lv: (a.lv || []).slice(), pow: a.pow | 0, season: a.season | 0, t: Date.now() };
      for (const f of Object.keys(T.rec)) if ((f | 0) <= (T.floor | 0) - KEEP_RECORDS) delete T.rec[f];
      const paid = ctx.credit(me, led, gold + echoBonus, gems, 'tower');
      gold = Math.min(gold, paid.gold); echoBonus = Math.max(0, paid.gold - gold); gems = paid.gems;
      ctx.ledTx(me, 'tower:' + (a.type === 'echo' ? 'echo' : 'floor') + ':' + a.floor, { gold: paid.gold, gems: paid.gems });
    } else ctx.ledTx(me, 'tower:loss:' + a.floor, {});
    return Object.assign(view(ctx, T), { won: witnessed.won, stars: witnessed.stars, fought: a.floor, type: a.type, gold, gems, echoBonus, newBest, rested,
      digestMatch: match, serverWon: rep ? !!rep.won : null });
  });
  return { status: out.storageFailed ? 503 : (out.ok === false ? 400 : 200), body: out };
}

module.exports = { handle, view, towerState, floorPlan, guardianWaves, echoWaves, payFor, seasonOf, seasonEndsDay, checkpoint,
  SEASON_EPOCH_DAY, ECHO_BONUS, KEEP_RECORDS, CHECKPOINT_BACK, OPEN_LEVEL };
