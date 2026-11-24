/* v1438 DEV ROSTER CHEATS (Phil 24 Nov 2026: "These cheats need to change. It should be - Commander level to X - All heroes to level X ...
   - Set glyphs to current max for all - set equipment to current max for all - set prayer to current max for all - unlock all achievement
   journal - unlock all of academy to current commander level - give all current heroes X amount of stars - unlock all stages - temper all
   current equipment to temper level X" / "This is for dev panel also. Not just tester"; + "Make sure the buttons arent badly aligned in ui").
   The real server on a throwaway DB: an admin and a test account apply each of the ten /api/admin/led-grant {roster, n} actions and the
   resulting state is checked against the game's own rules (the XP curves and GLYPH_MIN_LEVEL read out of server.js, server/temple-of-ash.js,
   server/hero-gear.json, server/gear-catalog.json); every action twice changes nothing more; a test account cannot reach another account; a
   normal player is refused; each action is in the admin log. Then the page: the Roster box at 844x390, 390x844, 1024x768 and 1400x900 for the
   admin and the test account - every row's label, range, number box and Apply vertically centred in the row (2 px), the Apply buttons one
   right-hand column of equal width, the number boxes one width, nothing overlapping or cut off; Apply in the page refreshes the game without
   a reload. SHOTS=<dir> keeps the screenshots (default: <tmp>/ew-roster-1438-shots).
   CONTROL: TP_ROOT=<a c0a6b0b68 checkout> must FAIL (the actions do not exist there). */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.TP_ROOT || path.join(__dirname, '..'), control = !!process.env.TP_ROOT;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'ew-roster-1438-shots'); fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0; const ck = (m, c, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 400) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
/* the game's own tables, read out of the code under test */
const SRC = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const arr = name => JSON.parse(SRC.match(new RegExp('const ' + name + '=(?:Object\\.freeze\\()?(\\[[^\\]]*\\])'))[1]);
const D_MAX = 100, cum = steps => { const c = new Array(D_MAX + 1); c[1] = 0; for (let L = 2; L <= D_MAX; L++) c[L] = c[L - 1] + steps[L - 2]; return c; };
const TROOP_CUM = cum(arr('D_TROOP_INC')), HERO_CUM = cum(arr('D_HERO_STEP')), GLYPH_MIN = arr('GLYPH_MIN_LEVEL');
const lvFor = (xp, c) => { let L = 1; while (L < D_MAX && xp >= c[L + 1]) L++; return L; };
const TEMPLE = require(path.join(ROOT, 'server', 'temple-of-ash.js'));
const HERO_GEAR = require(path.join(ROOT, 'server', 'hero-gear.json')), GEARCAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'gear-catalog.json'), 'utf8'));
const GEAR_BY = Object.fromEntries(GEARCAT.items.map(d => [d.id, d])), TEMPER_MAX = GEARCAT.meta.temper.max;
const HB = JSON.parse(fs.readFileSync(path.join(ROOT, 'hero_base.json'), 'utf8')), ALLKEYS = Object.keys(HB.heroes || HB).filter(k => HERO_GEAR[k]);
const SILENT = () => { const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); }; };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-ro1438-')), dbFile = path.join(tmp, 'db.json'); let srv = null, br = null; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  const env = { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: dbFile, RL_MUL: '1000', REG_PER_MIN: '500', REG_ACCOUNTS_PER_IP: '500', SIM_WORKERS: '0', MUT_PER_MIN: '5000' }; delete env.SHOP_FREE_PACKS;
  const start = async () => { srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: 'ignore', windowsHide: true }); for (const t0 = Date.now(); Date.now() - t0 < 60000 && srv.exitCode === null;) { try { if ((await fetch(base + '/api/health')).ok) return; } catch (_) {} await delay(100); } throw new Error('server did not start'); };
  const stop = async () => { if (!srv) return; srv.kill(); for (let i = 0; i < 400 && srv.exitCode === null && srv.signalCode === null; i++) { if (i === 200) try { srv.kill('SIGKILL'); } catch (_) {} await delay(50); } if (srv.exitCode === null && srv.signalCode === null) throw new Error('server did not exit'); srv = null; };
  const req = async (m, u, b, tok) => { const r = await fetch(base + u, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { 'x-token': tok } : {}) }, body: m === 'GET' ? undefined : JSON.stringify(b || {}) }); let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, body: j }; };
  const post = (u, b, tok) => req('POST', u, b, tok).then(x => x.body), get = (u, tok) => req('GET', u, null, tok).then(x => x.body);
  const R = (tok, act, n, extra) => post('/api/admin/led-grant', Object.assign({ roster: act }, n == null ? {} : { n }, extra || {}), tok);
  const led = tok => get('/api/ledger', tok);
  try {
    await start();
    const tag = Date.now().toString(36), DEV = 'rodev' + tag, TST = 'rotst' + tag, PL = 'ropl' + tag, PW = 'password1';
    for (const n of [DEV, TST, PL]) await post('/api/register', { name: n, pass: PW });
    await delay(1500); await stop();
    const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')), byName = n => Object.values(db.users).find(x => x.name === n || x.login === n);
    byName(DEV).role = 'admin'; byName(DEV).admin = true; byName(TST).role = 'tester'; fs.writeFileSync(dbFile, JSON.stringify(db)); await start();
    const dl = await post('/api/login', { name: DEV, pass: PW }), tl = await post('/api/login', { name: TST, pass: PW }), pl = await post('/api/login', { name: PL, pass: PW });
    const D = dl.token, T = tl.token, P = pl.token, devId = dl.profile && dl.profile.id;
    ck('fixture: an admin, a test account and a normal player sign in', D && T && P && dl.profile.admin && tl.profile.tester, JSON.stringify([dl.profile, tl.profile]).slice(0, 200));
    /* the admin owns 10 heroes; one more hero stays NOT owned and must never be touched */
    const OWN = ALLKEYS.slice(0, 10), NOT = ALLKEYS.find(k => !OWN.includes(k) && !['vael', 'sylthaine', 'vireo'].includes(k));
    await post('/api/admin/led-grant', { unlock: OWN }, D);
    const owned = L => Object.keys(L.unlocked || {}).filter(k => L.unlocked[k]);
    /* ---- refused ---- */
    const pr = await req('POST', '/api/admin/led-grant', { roster: 'stars', n: 5 }, P);
    ck('a normal player is refused (403)', pr.status === 403, JSON.stringify(pr));
    const bad = await req('POST', '/api/admin/led-grant', { roster: 'nope' }, D);
    ck('an unknown roster action is refused (400)', bad.status === 400, JSON.stringify(bad));
    /* ---- 1. Commander level to X ---- */
    let r = await R(D, 'cmdlevel', 20), L = await led(D);
    ck('Commander level 20: level 20, XP exactly the curve\'s start of level 20', r.ok && r.roster && r.roster.level === 20 && L.playerLevel === 20 && L.px === TROOP_CUM[20], JSON.stringify([r.roster, L.playerLevel, L.px, TROOP_CUM[20]]));
    /* below the gates: the Forge (25), the Temple (50) */
    r = await R(D, 'gear'); ck('Equipment at Commander 20: refused politely - the Forge opens at 25 (nothing worn)', r.ok && r.roster && r.roster.locked === 25 && !Object.keys(((await get('/api/gear/state', D)).equipped) || {}).length, JSON.stringify(r.roster));
    r = await R(D, 'temple'); ck('Prayer at Commander 20: the Temple of Ash opens at 50', r.ok && r.roster && r.roster.locked === 50, JSON.stringify(r.roster));
    r = await R(D, 'cmdlevel', 9999); L = await led(D);
    ck('Commander level 9999 is clamped to 100', r.ok && L.playerLevel === 100 && L.px === TROOP_CUM[100], JSON.stringify([r.roster, L.playerLevel]));
    r = await R(D, 'cmdlevel', 80); L = await led(D);
    ck('Commander level DOWN to 80: level 80, XP exactly the start of 80', r.ok && L.playerLevel === 80 && L.px === TROOP_CUM[80], JSON.stringify([L.playerLevel, L.px]));
    const px1 = L.px; await R(D, 'cmdlevel', 80); L = await led(D); ck('Commander level 80 twice changes nothing', L.px === px1 && L.playerLevel === 80);
    /* ---- 2. All heroes to level X ---- */
    r = await R(D, 'herolevel', 999); L = await led(D);
    ck('All heroes to level 999: clamped to the Commander level (80) - every owned hero at level 80', r.ok && r.roster && r.roster.level === 80 && r.roster.range[1] === 80 && OWN.every(k => L.hero[k] && L.hero[k].xp === HERO_CUM[80]), JSON.stringify([r.roster, OWN.map(k => L.hero[k] && L.hero[k].xp)]));
    ck('...a hero the account does not own is not touched', !L.unlocked[NOT] && !(L.hero[NOT] && L.hero[NOT].xp), JSON.stringify(L.hero[NOT]));
    await R(D, 'herolevel', 30); L = await led(D); ck('All heroes to level 30 (down): every owned hero at 30', OWN.every(k => lvFor(L.hero[k].xp, HERO_CUM) === 30));
    await R(D, 'herolevel', 80); L = await led(D); ck('All heroes to level 80 again', OWN.every(k => lvFor(L.hero[k].xp, HERO_CUM) === 80));
    /* ---- 3. Glyphs to current max ---- */
    r = await R(D, 'glyphs'); let gs = await get('/api/glyphs/state', D); const wantAsc = GLYPH_MIN.filter(g => g <= 80).length;
    ck('Glyphs: every owned hero\'s board at the best quality level 80 allows (index ' + wantAsc + ', GLYPH_MIN_LEVEL)', r.ok && OWN.every(k => gs.boards && gs.boards[k] && gs.boards[k].ascensionIndex === wantAsc), JSON.stringify(OWN.map(k => gs.boards && gs.boards[k] && gs.boards[k].ascensionIndex)));
    ck('...the unowned hero has no board and is still not owned', !(gs.boards && gs.boards[NOT] && gs.boards[NOT].ascensionIndex) && !(await led(D)).unlocked[NOT]);
    const gsig = JSON.stringify(gs.boards); await R(D, 'glyphs'); ck('Glyphs twice changes nothing', JSON.stringify((await get('/api/glyphs/state', D)).boards) === gsig);
    /* ---- 4. Equipment to current max ---- */
    r = await R(D, 'gear'); let ge = await get('/api/gear/state', D);
    const gearOk = k => { const eq = (ge.equipped || {})[k] || {}; return HERO_GEAR[k].every(id => { const d = GEAR_BY[id], it = ge.items[eq[d.slot]]; return it && it.d === id && it.bound && it.hero === k; }) && Object.keys(eq).length === 9; };
    ck('Equipment (Commander 80): every owned hero wears all nine of its own items, bound to it', r.ok && OWN.every(gearOk), JSON.stringify([r.roster, OWN.filter(k => !gearOk(k))]));
    ck('...the unowned hero wears nothing', !(ge.equipped || {})[NOT]);
    const nItems = Object.keys(ge.items).length; r = await R(D, 'gear'); ge = await get('/api/gear/state', D);
    ck('Equipment twice adds nothing', (r.roster || {}).added === 0 && Object.keys(ge.items).length === nItems && nItems === owned(await led(D)).length * 9, JSON.stringify([r.roster, nItems]));
    /* ---- 10. Temper all equipment to X ---- */
    r = await R(D, 'temper', 99); ge = await get('/api/gear/state', D);
    ck('Temper 99 is clamped to the Temper max (' + TEMPER_MAX + '): every owned item at ' + TEMPER_MAX, r.ok && (r.roster || {}).temper === TEMPER_MAX && Object.values(ge.items).every(it => it.temper === TEMPER_MAX) && Object.values(ge.temperByType || {}).every(x => x.temper === TEMPER_MAX), JSON.stringify(r.roster));
    await R(D, 'temper', 7); ge = await get('/api/gear/state', D); ck('Temper 7: every owned item at 7 (down works too)', Object.values(ge.items).every(it => it.temper === 7 && (it.prog | 0) === 0));
    const tsig = JSON.stringify(ge.items); await R(D, 'temper', 7); ck('Temper 7 twice changes nothing', JSON.stringify((await get('/api/gear/state', D)).items) === tsig);
    /* ---- 5. Prayer to current max ---- */
    r = await R(D, 'temple'); L = await led(D); const st = L.temple || {};
    let wantL = 1; for (let lv = 1; lv <= TEMPLE.FLAMEKEEPER_TRACK.length; lv++) if (TEMPLE.keeperLevel(1e12, 80) >= lv) wantL = lv;
    const cap = TEMPLE.capSteps(wantL);
    const barsOk = k => { const h = st.heroes && st.heroes[k]; if (!h) return false; const s = TEMPLE.heroSteps(h, k); return TEMPLE.heroBars(k).every((b, i) => s[b] === (wantL >= TEMPLE.CONFIG.BAR_UNLOCK_TEMPLE[i] ? cap : 0)); };
    ck('Prayer: the Temple at the highest level Commander 80 allows (' + wantL + '), every open bar of every owned hero at its cap ' + cap, r.ok && st.level === wantL && (r.roster || {}).cap === cap && OWN.every(barsOk), JSON.stringify([r.roster, st.level, OWN.filter(k => !barsOk(k))]));
    const dotsOk = k => { const h = st.heroes[k], rows = TEMPLE.blessingsFor(st, h, { key: k, heroLevel: 80 }); return rows.every(x => x.earned === (x.keeperMet && x.heroMet && x.thresholdMet)) && h.boonsUnlocked[4] === TEMPLE.fifthOrbReachable(st, 80); };
    ck('...each hero\'s blessings lit exactly where the Temple / hero-level / threshold gates allow (5th dot needs hero 100: off)', OWN.every(dotsOk) && OWN.every(k => st.heroes[k].boonsUnlocked.slice(0, 4).every(Boolean) && !st.heroes[k].boonsUnlocked[4]), JSON.stringify(OWN.map(k => st.heroes[k] && st.heroes[k].boonsUnlocked)));
    ck('...no prayer left pending, the unowned hero untouched', !st._pending && !(st.heroes || {})[NOT]);
    const psig = JSON.stringify(st.heroes); await R(D, 'temple'); ck('Prayer twice changes nothing', JSON.stringify((await led(D)).temple.heroes) === psig);
    /* ---- 6. Unlock all achievement journal ---- */
    const g0 = L.gems, st0 = L.starClaimed;
    r = await R(D, 'journal'); L = await led(D);
    ck('Journal: the account is marked complete (ledger devJournal) and nothing is paid', r.ok && L.devJournal === 1 && L.gems === g0, JSON.stringify([L.devJournal, g0, L.gems]));
    const jb = await get('/api/rankings?board=journal', D);
    ck('...a dev-unlocked Journal is not on the Journal ranking board', jb && jb.ok && !(jb.rows || []).some(x => x.name === DEV), JSON.stringify(jb).slice(0, 200));
    /* ---- 7. Academy to Commander level ---- */
    r = await R(D, 'academy'); let ac = await get('/api/academy', D);
    const tracks = ['atk', 'hp', 'ap', 'heal', 'armor', 'mr', 'crit', 'critres'];
    ck('Academy: the building at Commander level 80, every research track at its max 60', r.ok && ac.lv && ac.lv.academy === 80 && tracks.every(k => ac.lv[k] === 60) && !Object.keys(ac.learn || {}).length, JSON.stringify([r.roster, ac.lv, ac.learn]));
    await R(D, 'academy'); ac = await get('/api/academy', D); ck('Academy twice changes nothing', ac.lv.academy === 80 && tracks.every(k => ac.lv[k] === 60));
    /* ---- 8. Stars X ---- */
    r = await R(D, 'stars', 9); L = await led(D);
    ck('Stars 9 is clamped to 5: every owned hero at 5 stars', r.ok && (r.roster || {}).stars === 5 && OWN.every(k => L.hero[k].stars === 5 && (L.hero[k].pips | 0) === 0), JSON.stringify(OWN.map(k => L.hero[k].stars)));
    r = await R(D, 'stars', 1); L = await led(D);
    ck('Stars 1: every owned hero at 1 star or its base stars, never under', OWN.every(k => L.hero[k].stars === Math.max(1, (HB.heroes || HB)[k].stars | 0)), JSON.stringify(OWN.map(k => [L.hero[k].stars, (HB.heroes || HB)[k].stars])));
    await R(D, 'stars', 3); L = await led(D); ck('Stars 3: every owned hero at 3 (or its base)', OWN.every(k => L.hero[k].stars === Math.max(3, (HB.heroes || HB)[k].stars | 0)));
    ck('...the unowned hero has no stars set', !(L.hero[NOT] && L.hero[NOT].stars > ((HB.heroes || HB)[NOT].stars | 0)));
    /* ---- 8b. v1439 Give all heroes X hero fragments (Phil: "just below" the stars row) - every hero in the game, owned or not ---- */
    { const L0 = await led(D), all = Object.keys(HB.heroes || HB), f0 = k => ((L0.frags || {})[k] | 0);
      r = await R(D, 'frags', 100); L = await led(D); const f1 = k => ((L.frags || {})[k] | 0);
      ck('Give fragments 100: every hero in the game (' + all.length + ') +100, the unowned hero too', r.ok && (r.roster || {}).each === 100 && all.every(k => f1(k) === Math.min(9999, f0(k) + 100)) && f1(NOT) === Math.min(9999, f0(NOT) + 100), JSON.stringify(r.roster));
      r = await R(D, 'frags', 99999); L = await led(D);
      ck('Give fragments 99999 is clamped to 9999 each, and no pile passes 9999', (r.roster || {}).each === 9999 && all.every(k => ((L.frags || {})[k] | 0) === 9999), JSON.stringify(r.roster)); }
    /* ---- 9. Unlock all stages ---- */
    r = await R(D, 'stages'); L = await led(D); let bs = await get('/api/bonus/state', D);
    const all3 = s => { for (let i = 1; i <= 160; i++) if ((s || {})[i] !== 3) return false; return true; };
    ck('Stages: Normal, Elite and Veteran - all 160 each cleared, every stage 3 stars', r.ok && L.camp.cleared === 160 && all3(L.camp.stars) && ['normal', 'elite', 'veteran'].every(m => L.portals[m].cleared === 160 && all3(L.portals[m].stars) && !L.portals[m].locked), JSON.stringify([r.roster, L.camp.cleared, L.portals.elite.cleared, L.portals.veteran.cleared]));
    ck('...all 96 bonus stages done with 3 stars, nothing back-paid (their clock starts now)', bs.ok && Object.keys(bs.done).length === 96 && Object.values(bs.done).every(x => x.stars === 3) && Date.now() - bs.since < 120000, JSON.stringify([Object.keys(bs.done || {}).length, bs.since]));
    ck('...star-track milestones left to claim (starClaimed unchanged)', L.starClaimed === st0, JSON.stringify([st0, L.starClaimed]));
    const ssig = JSON.stringify([L.camp, L.portals, bs.done]); await R(D, 'stages'); L = await led(D); bs = await get('/api/bonus/state', D);
    ck('Stages twice changes nothing', JSON.stringify([L.camp, L.portals, bs.done]) === ssig);
    /* ---- the test account ---- */
    const devBefore = await led(D);
    r = await R(T, 'cmdlevel', 30, { userId: devId }); let TL = await led(T), DL = await led(D);
    ck('test account: Commander level 30 aimed at the admin lands on the TEST ACCOUNT only', r.ok && TL.playerLevel === 30 && DL.playerLevel === devBefore.playerLevel && DL.px === devBefore.px, JSON.stringify([TL.playerLevel, DL.playerLevel]));
    r = await R(T, 'stars', 5, { userId: devId }); DL = await led(D);
    ck('test account: Stars 5 aimed at the admin does not touch the admin', r.ok && OWN.every(k => DL.hero[k].stars === devBefore.hero[k].stars), JSON.stringify(OWN.map(k => DL.hero[k].stars)));
    r = await R(T, 'stages', null, { userId: devId }); TL = await led(T);
    ck('test account: Unlock all stages works on its own account', r.ok && TL.camp.cleared === 160 && TL.portals.veteran.cleared === 160);
    for (const a of ['herolevel', 'glyphs', 'gear', 'temple', 'journal', 'academy', 'temper']) { const x = await req('POST', '/api/admin/led-grant', { roster: a, n: 5, userId: devId }, T); ck('test account: ' + a + ' answers 200 on its own account', x.status === 200 && x.body.ok && x.body.roster && x.body.roster.act === a, JSON.stringify(x).slice(0, 200)); }
    DL = await led(D); ck('...and none of them changed the admin', JSON.stringify([DL.hero, DL.camp.cleared, DL.temple.heroes, DL.devJournal]) === JSON.stringify([devBefore.hero, devBefore.camp.cleared, devBefore.temple.heroes, devBefore.devJournal]));
    /* ---- the admin log ---- */
    const lg = await get('/api/admin/log?n=300', D), acts = (lg.log || []).filter(x => /roster/.test(x.detail));
    ck('every roster action is in the admin log (who, whose account, which action)', ['cmdlevel', 'herolevel', 'glyphs', 'gear', 'temple', 'journal', 'academy', 'stars', 'stages', 'temper'].every(a => acts.some(x => x.byId === devId && x.id === devId && new RegExp('roster ' + a).test(x.detail))) && acts.some(x => x.act === 'economy:self' && /roster stars/.test(x.detail) && x.id !== devId), JSON.stringify(acts.slice(0, 3)));
    /* ---------------- the page ---------------- */
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    br = await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args: ['--disable-audio-output', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const errs = [];
    const page = async (n, vp) => { const ctx = await br.newContext({ viewport: vp, serviceWorkers: 'block' }); await ctx.addInitScript(SILENT); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(n + ': ' + e.message));
      await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => typeof renderSettings === 'function' && typeof api === 'function' && typeof devAction === 'function', null, { timeout: 90000 }); await delay(1500);
      await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(400);
      await pg.evaluate(async ([n, p]) => { const r = await api('/api/login', 'POST', { name: n, pass: p }); ACC.token = r.token; ACC.id = r.profile.id; ACC.name = r.profile.name; ACC.admin = !!r.profile.admin; ACC.tester = !!r.profile.tester; G.tutStarted = true; G.tutDone = true; try { _whatsNewDone = true; } catch (e) {} document.body.classList.remove('gated'); try { authGateRefresh(); } catch (e) {} show('home'); try { await ledgerSync(); } catch (e) {} }, [n, PW]);
      await delay(900); return pg; };
    const openEco = pg => pg.evaluate(async () => { try { devTab = 'economy'; } catch (e) {} setTab = 'dev'; renderSettings(); try { devPanelOpen(); } catch (e) {} for (let i = 0; i < 60 && !document.querySelector('#dvpOv #dvpRoster .dvp-rrow'); i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 500)); });
    /* the alignment measure: screen px, every row */
    /* the alignment measure, in each row's own frame (offset geometry: the panel is scaled, and on a portrait phone the whole game is turned
       90 degrees, so screen x/y are not the row's axes). A difference d in the panel's layout px is d x scale on screen; the limit is 2 px in
       both (d x max(1, scale) <= 2). */
    const measure = pg => pg.evaluate(() => { const box = document.getElementById('dvpRoster'); if (!box) return { none: true };
      const win = document.querySelector('#dvpOv .dvp'), wr = win.getBoundingClientRect(), right = box.closest('.dvp-right');
      const scale = Math.max(wr.width, wr.height) / 1280, tol = 2 / Math.max(1, scale), bad = [], btn = [], inp = [];
      const rows = [...box.querySelectorAll('.dvp-rrow')], L = e => ({ l: e.offsetLeft, t: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight, r: e.offsetLeft + e.offsetWidth, b: e.offsetTop + e.offsetHeight, cy: e.offsetTop + e.offsetHeight / 2 });
      for (const row of rows) { const k = row.dataset.rrow, R = { w: row.clientWidth, h: row.clientHeight }, b = row.querySelector('b'), g = row.querySelector('.dvp-rng'), i = row.querySelector('.dvp-ramt'), a = row.querySelector('.dvp-btn');
        if (getComputedStyle(row).position !== 'relative') { bad.push(k + ' row is not the offset frame'); continue; }
        const parts = [['label', b], ['range', g], ['box', i], ['apply', a]].filter(x => x[1]);
        for (const [n, e] of parts) { const r = L(e); if (Math.abs(r.cy - R.h / 2) > tol) bad.push(k + ' ' + n + ' off centre by ' + (r.cy - R.h / 2).toFixed(1) + 'px');
          if (r.l < -0.5 || r.r > R.w + 0.5 || r.t < -0.5 || r.b > R.h + 0.5) bad.push(k + ' ' + n + ' outside its row'); }
        for (let j = 1; j < parts.length; j++) if (L(parts[j - 1][1]).r > L(parts[j][1]).l + 0.5) bad.push(k + ' ' + parts[j - 1][0] + ' overlaps ' + parts[j][0]);
        if (b.scrollWidth > b.clientWidth + 1) bad.push(k + ' label cut off (' + b.textContent + ')');
        if (row.offsetParent === right && (row.offsetLeft < -0.5 || row.offsetLeft + row.offsetWidth > right.clientWidth + 0.5)) bad.push(k + ' row wider than its column');
        if (wr.width >= wr.height) { const RR = row.getBoundingClientRect(), c = RR.top + RR.height / 2;   /* not turned: the screen too (a transform would not show in offsets) */
          for (const [nm, e] of parts) { const q = e.getBoundingClientRect(); if (Math.abs(q.top + q.height / 2 - c) > 2) bad.push(k + ' ' + nm + ' off centre on screen by ' + (q.top + q.height / 2 - c).toFixed(1) + 'px'); } }
        if (!a || a.textContent.trim() !== 'Apply') bad.push(k + ' has no Apply'); else btn.push(L(a)); if (i) inp.push(L(i)); }
      const spread = (A, f) => A.length ? Math.max(...A.map(f)) - Math.min(...A.map(f)) : 0;
      if (spread(btn, r => r.r) > tol) bad.push('Apply buttons not one right-aligned column (right edges spread ' + spread(btn, r => r.r).toFixed(1) + 'px)');
      if (spread(btn, r => r.w) > tol) bad.push('Apply buttons not equal width (spread ' + spread(btn, r => r.w).toFixed(1) + 'px)');
      if (spread(inp, r => r.w) > tol) bad.push('number boxes not one width'); if (spread(inp, r => r.r) > tol) bad.push('number boxes not one column');
      if (spread(rows.map(L), r => r.w) > tol) bad.push('rows not one width');
      if (wr.left < -0.5 || wr.top < -0.5 || wr.right > innerWidth + 0.5 || wr.bottom > innerHeight + 0.5) bad.push('the panel window is cut off by the screen');
      const last = rows[rows.length - 1]; if (last && last.offsetTop + last.offsetHeight > right.scrollHeight + 1) bad.push('the last row cannot be scrolled to');
      return { n: rows.length, boxes: inp.length, keys: rows.map(r => r.dataset.rrow), ranges: [...box.querySelectorAll('.dvp-rng')].map(x => x.textContent), bad, scale: +scale.toFixed(3),
        applyW: btn.length ? btn[0].w : 0, boxW: inp.length ? inp[0].w : 0 }; });
    const SIZES = [['phone-landscape', 844, 390], ['phone-portrait', 390, 844], ['tablet', 1024, 768], ['desktop', 1400, 900]];
    const KEYS = ['cmdlevel', 'herolevel', 'glyphs', 'gear', 'temple', 'journal', 'academy', 'stars', 'frags', 'stages', 'temper'];   // v1439: frags just below stars
    for (const [who, name] of [['admin', DEV], ['test account', TST]]) for (const [sz, w, h] of SIZES) {
      const pg = await page(name, { width: w, height: h }); await openEco(pg); const m = await measure(pg);
      ck(who + ' ' + sz + ' ' + w + 'x' + h + ': the Roster box has exactly the eleven rows (5 with a number box), in Phil\'s order', !m.none && m.n === 11 && m.boxes === 5 && JSON.stringify(m.keys) === JSON.stringify(KEYS), JSON.stringify(m));
      ck(who + ' ' + sz + ' ' + w + 'x' + h + ': aligned - centred rows, one Apply column of equal buttons, equal boxes, no overlap, nothing cut off (scale ' + m.scale + ', Apply ' + m.applyW + ' px, boxes ' + m.boxW + ' px)', !m.none && m.bad.length === 0, (m.bad || []).join(' | '));
      if (who === 'admin' && sz === 'desktop') {   /* the measure itself: a 6 px drop on one Apply and a wider box must be caught */
        await pg.evaluate(() => { const st = document.createElement('style'); st.id = 'roNeg'; st.textContent = '#dvpRoster [data-rrow="glyphs"] .dvp-btn{margin-top:12px} #dvpRoster [data-rrow="stars"] .dvp-ramt{width:80px}'; document.head.appendChild(st); });
        const neg = await measure(pg); await pg.evaluate(() => document.getElementById('roNeg').remove());
        ck('CONTROL of the measure: a dropped Apply and a wider number box are caught', neg.bad.some(x => /glyphs apply off centre/.test(x)) && neg.bad.some(x => /number boxes not one width/.test(x)), JSON.stringify(neg.bad)); }
      await pg.evaluate(() => { const r = document.querySelector('#dvpOv .dvp-right'); if (r) r.scrollTop = 0; }); await delay(150);
      await pg.screenshot({ path: path.join(SHOTS, 'roster-' + (who === 'admin' ? 'dev' : 'tester') + '-' + sz + '-' + w + 'x' + h + '-top.png') });
      await pg.evaluate(() => { const L = [...document.querySelectorAll('#dvpRoster .dvp-rrow')].pop(); if (L) L.scrollIntoView({ block: 'end' }); }); await delay(150);
      await pg.screenshot({ path: path.join(SHOTS, 'roster-' + (who === 'admin' ? 'dev' : 'tester') + '-' + sz + '-' + w + 'x' + h + '-bottom.png') });
      if (who === 'admin' && sz === 'phone-landscape') {
        /* Apply in the page: Commander level 50 - the game shows it at once (no reload) and the hero-level range follows */
        const u = await pg.evaluate(async () => { const el = document.querySelector('[data-ramt="cmdlevel"]'); el.value = '50'; document.getElementById('devDone').textContent = '';
          document.querySelector('#dvpOv [data-dev="ro_cmdlevel"]').click(); for (let i = 0; i < 80 && !/Commander level 50|refused|unavailable/.test(document.getElementById('devDone').textContent); i++) await new Promise(r => setTimeout(r, 100));
          return { msg: document.getElementById('devDone').textContent, lv: playerLevel(), rng: document.querySelector('[data-rrow="herolevel"] .dvp-rng').textContent, hl: heroLevel(Object.keys(G.unlocked).find(k => G.unlocked[k] && G.heroXP[k] > 0)) }; });
        ck('page: Apply Commander level 50 - the game shows level 50 at once, heroes capped at 50, the hero-level range now 1-50', /Commander level 50/.test(u.msg) && u.lv === 50 && u.hl === 50 && u.rng === '1-50', JSON.stringify(u));
        const s = await pg.evaluate(async () => { const el = document.querySelector('[data-ramt="stars"]'); el.value = '4'; document.getElementById('devDone').textContent = '';
          document.querySelector('#dvpOv [data-dev="ro_stars"]').click(); for (let i = 0; i < 80 && !/stars|refused|unavailable/.test(document.getElementById('devDone').textContent); i++) await new Promise(r => setTimeout(r, 100));
          const own = Object.keys(G.unlocked).filter(k => G.unlocked[k]); return { msg: document.getElementById('devDone').textContent, stars: own.map(k => heroStars(k)), base: own.map(k => heroStartStars(k)) }; });
        ck('page: Apply stars 4 - every owned hero shows 4 stars (or its base) without a reload', /at 4 stars/.test(s.msg) && s.stars.every((x, i) => x === Math.max(4, s.base[i])), JSON.stringify(s));
        const box = await pg.evaluate(async () => { const el = document.querySelector('[data-ramt="temper"]'); el.value = ''; document.getElementById('devDone').textContent = ''; document.querySelector('#dvpOv [data-dev="ro_temper"]').click(); await new Promise(r => setTimeout(r, 300)); return document.getElementById('devDone').textContent; });
        ck('page: an empty number box asks for a number in its range and sends nothing', /Enter a number 0-30/.test(box), box);
        const j = await pg.evaluate(() => { const c = bbProgress(); return BB_TRACKS.every(([n, th]) => c[n] >= th[th.length - 1]); });
        ck('page: the Achievement Journal shows every milestone of all ' + 21 + ' tracks completed', j === true);
      }
      await pg.context().close();
    }
    ck('no page errors', errs.length === 0, errs.slice(0, 4).join(' | '));
    console.log('  screenshots: ' + SHOTS);
  } catch (e) { fail++; console.log('  FAIL run: ' + (e.stack || e)); }
  finally { try { if (br) await br.close(); } catch (_) {} try { await stop(); } catch (_) { try { srv && srv.kill('SIGKILL'); } catch (__) {} } try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
  console.log((control ? 'CONTROL ' : '') + 'test_dev_roster_1438.js: ' + pass + ' passed, ' + fail + ' failed');
  if (control) process.exit(fail > 0 ? 0 : 1);
  process.exit(fail ? 1 : 0);
})();
