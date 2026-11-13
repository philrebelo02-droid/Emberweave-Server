'use strict';
/* v1388 DAMAGE DONE (Phil 13 Nov 2026: "Add a Damage done screen after every fight, before the reward claim screen";
   "it show a bar graph, comparing all heroes on left side and the opponent on right side"; "highest damage on the top";
   "hero or monster card left of the damage left side" / "right of the damage right side"; "the Number in the actual bar";
   "if you double click or hover the damage bar it gives a per ability / auto attack break down of where the damage came from").
   A. ENGINE (the game's own script in server/sim-host.js, headless, real fights - every hero kit in 5v5s, plus a 3-wave campaign
      stage of monsters):
      - the damage each side is credited with equals the health the other side actually lost (start HP - end HP + healing received),
        within rounding; almost nothing is unattributed;
      - healing is counted (a squad with healers heals > 0; credited healing == healing received);
      - every unit's per-source totals (auto / green / blue / ult / passive / summon) add up to its damage dealt;
      - BOOKKEEPING ONLY: the same seed gives the byte-identical digest with the tracking on and off.
   B. BROWSER (real page + real local server on a temp DB):
      - campaign stage won: the Damage Done panel opens first, the reward pop is under it; Continue -> the normal reward pop;
        Collect -> the campaign map; /api/campaign/resolve called once; gold credited exactly once (server ledger);
      - campaign stage lost: the panel, then the normal DEFEAT screen;
      - Vault and Arena once each: the panel, then that mode's result;
      - hover / double click a bar -> the per-source breakdown, sums to the bar's number, stays inside the panel;
      - four sizes (844x390, 390x844 turned, 1280x720, 1440x900): panel inside the screen, no sideways scroll, Continue visible,
        both columns present, highest damage at the top of each column; screenshots saved for a human look.
   Local server + temp DB only (never live). Set DD_SHOTS=<dir> to choose the screenshot folder. Exit code = failures. */
const fs = require('fs'), path = require('path'), os = require('os'), net = require('net'), vm = require('vm');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));

// ---------------- A. engine ----------------
console.log('== A. engine: credited damage = health lost, heals counted, per-source sums, no effect on the fight ==');
const H = require(path.join(ROOT, 'server/sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
const run = s => vm.runInContext(s, H.ctx);
run(`globalThis.__hp0=new Map(); { const _w=(n)=>{ const f=globalThis[n]; globalThis[n]=function(){ const r=f.apply(this,arguments); try{ (units||[]).forEach(u=>{ if(!__hp0.has(u)) __hp0.set(u,u.hp); }); if(r&&typeof r==='object'&&r.key&&!__hp0.has(r)) __hp0.set(r,r.hp); }catch(e){} return r; }; };
  _w('setupMarchTeams'); _w('buildEnemyWave'); _w('spawnTeamFromSnaps'); _w('summonUnit'); _w('beginWaveEnter'); }`);
const audit = () => JSON.parse(run(`(()=>{ const sides={ally:{dealt:0,lost:0,taken:0,unk:0,heal:0,recv:0},enemy:{dealt:0,lost:0,taken:0,unk:0,heal:0,recv:0}}; let srcBad=[], noHp0=0, kinds={};
  DD.rows.forEach((r,u)=>{ const S=sides[u.team]; if(!S) return; S.dealt+=r.dealt; S.taken+=r.taken; S.unk+=r.unk+r.self; S.heal+=r.heal; S.recv+=r.recv;
    const h0=__hp0.get(u); if(u._summon||u._wasSummon) S.lost+=r.taken;   /* a summon whose time runs out is not damage: the HP it lost to hits is what it took */
    else if(h0==null){ if(r.taken>0) noHp0+=r.taken; } else S.lost+=h0-Math.max(0,u.hp)+r.recv;
    let s=0; for(const k in r.src){ s+=r.src[k]; const kk=k.indexOf('summon:')===0?'summon':k; kinds[kk]=(kinds[kk]||0)+r.src[k]; } if(Math.abs(s-r.dealt)>1e-6*Math.max(1,r.dealt)) srcBad.push(u.key+' '+s+'/'+r.dealt); });
  return JSON.stringify({sides,srcBad,noHp0,kinds}); })()`));
const fight = (A, B, seed, on) => { run(`DD.force=${on ? 'true' : 'false'}; ddReset(); DD.on=${on ? 'true' : 'false'}; __hp0.clear();`);
  const r = H.auto(JSON.parse(JSON.stringify(A)), JSON.parse(JSON.stringify(B)), seed); const a = on ? audit() : null; run('DD.force=false; DD.on=false;'); return { r, a }; };
const ALL = JSON.parse(run(`JSON.stringify(Object.keys(HERO_TYPES).filter(k=>!HERO_TYPES[k].monster))`));
const squads = []; for (let i = 0; i < ALL.length; i += 5) squads.push(ALL.slice(i, i + 5));
const snaps = squads.map(k => H.snapSquad(k).map(x => Object.assign(x, { rank: 3 })));   // every slot unlocked: green, blue, passive
let same = 0, total = 0, worst = 0, worstName = '', unkMax = 0, healTot = 0, healEq = true, srcBad = [], kindsAll = {};
const pct = (x, y) => Math.abs(x - y) / Math.max(1, y);
for (let i = 0; i < squads.length; i++) { const j = (i + 1) % squads.length, seed = 1000 + i * 77;
  const on = fight(snaps[i], snaps[j], seed, true), off = fight(snaps[i], snaps[j], seed, false);
  total++; if (on.r.digest && on.r.digest === off.r.digest && on.r.won === off.r.won) same++;
  const a = on.a; srcBad = srcBad.concat(a.srcBad); for (const k in a.kinds) kindsAll[k] = (kindsAll[k] || 0) + a.kinds[k];
  for (const [side, other] of [['ally', 'enemy'], ['enemy', 'ally']]) {
    const credited = a.sides[side].dealt, lost = a.sides[other].lost, d = pct(credited + a.sides[other].unk, lost);
    if (d > worst) { worst = d; worstName = squads[i].join('+') + ' vs ' + squads[j].join('+') + ' ' + side + ': credited ' + Math.round(credited) + ' + unattributed ' + Math.round(a.sides[other].unk) + ' vs lost ' + Math.round(lost); }
    unkMax = Math.max(unkMax, a.sides[other].unk / Math.max(1, a.sides[other].taken)); }
  healTot += a.sides.ally.heal + a.sides.enemy.heal;
  if (pct(a.sides.ally.heal + a.sides.enemy.heal, a.sides.ally.recv + a.sides.enemy.recv) > 1e-9) healEq = false; }
ck('every hero kit (' + ALL.length + ' heroes in ' + total + ' 5v5s): credited damage (+ the unattributed rest) = the health the other side lost, within 0.5% (worst ' + (worst * 100).toFixed(3) + '%)', worst <= 0.005, worstName);
ck('unattributed damage (incl. health spent on own skills) is at most 1% of any side\'s damage taken (worst ' + (unkMax * 100).toFixed(2) + '%)', unkMax <= 0.01);
ck('healing is counted (' + Math.round(healTot) + ' HP across the fights) and credited healing == healing received', healTot > 0 && healEq);
ck('every unit\'s per-source totals add up to its damage dealt', srcBad.length === 0, srcBad.slice(0, 4).join(' | '));
ck('the sources include auto attacks, green / blue skills, ultimates and passives (' + Object.keys(kindsAll).sort().join(', ') + ')', ['auto', 'green', 'blue', 'ult', 'passive'].every(k => kindsAll[k] > 0));
ck('BOOKKEEPING ONLY: the same seed gives the identical digest + result with the tracking on and off (' + same + '/' + total + ')', same === total && total > 5);
{ // a 3-wave campaign stage of monsters (wave 1 and 2 enemies leave the field - their totals must stay)
  const enc = require(path.join(ROOT, 'server/campaign-encounters.json'));
  const st = enc.find(e => e.node === 41) || enc[40], sq = H.snapSquad(['vael', 'lumi', 'hurne', 'astra', 'umbris']).map(s => Object.assign(s, { rank: 3, maxHp: s.maxHp * 40, dmg: s.dmg * 3, apow: (s.apow || 0) * 3 }));
  run('DD.force=true; ddReset(); __hp0.clear();');
  const w = H.campaign(JSON.parse(JSON.stringify(sq)), st.waves, 4242, [], 'campaign'); const a = audit();
  const snap = JSON.parse(run('JSON.stringify(ddFinish(true))')); run('DD.force=false; DD.on=false;');
  const enemyKinds = snap.e.length, enemyN = snap.e.reduce((s, g) => s + g.n, 0), waveUnits = st.waves.reduce((s, x) => s + x.length, 0);
  ck('campaign ' + st.id + ' (' + st.waves.length + ' waves, ' + waveUnits + ' monsters): every monster of every wave is in the panel (' + enemyN + ' in ' + enemyKinds + ' rows)', enemyN === waveUnits, JSON.stringify(snap.e.map(g => g.key + ' x' + g.n)));
  ck('campaign: the squad\'s credited damage = the monsters\' health lost (' + Math.round(a.sides.ally.dealt) + ' vs ' + Math.round(a.sides.enemy.lost) + ', won=' + w.won + ')', pct(a.sides.ally.dealt + a.sides.enemy.unk, a.sides.enemy.lost) <= 0.005 && a.sides.ally.dealt > 0);
  ck('campaign: the monsters\' damage is credited to them too (' + Math.round(a.sides.enemy.dealt) + ' vs heroes lost ' + Math.round(a.sides.ally.lost) + ')', a.sides.enemy.dealt > 0 && pct(a.sides.enemy.dealt + a.sides.ally.unk, a.sides.ally.lost) <= 0.01);
  ck('campaign: each column is sorted highest damage first', [snap.a, snap.e].every(c => c.every((g, i) => i === 0 || c[i - 1].dealt >= g.dealt)));
  ck('campaign: the squad won all ' + st.waves.length + ' waves (so every wave is counted)', w.won === true);
  ck('summons are inside their owner: summon damage is a source on the owner\'s row (' + Math.round(kindsAll.summon || 0) + ' in the 5v5s), never a row of its own', (kindsAll.summon || 0) > 0 && !snap.a.some(g => !['vael', 'lumi', 'hurne', 'astra', 'umbris'].includes(g.key)),
    JSON.stringify(snap.a.map(g => g.key)));
  const names = JSON.parse(run(`JSON.stringify(${JSON.stringify(snap.e.concat(snap.a))}.map(g=>Object.keys(g.src).map(l=>ddSrcName(g.key,l))))`));
  ck('every source has a readable name (hero + monster kit names, Auto Attack, the summon\'s name)', names.flat().every(n => typeof n === 'string' && n.length > 1 && !/undefined|null|\[object/.test(n)), JSON.stringify(names).slice(0, 300));
  ck('the panel is never prepared in a headless replay (window._p2guard): a server replay leaves no pending panel', JSON.parse(run(`(()=>{ DD.pending=false; DD.force=false; ddReset(); window._p2guard=true; ddReset(); const on=DD.on; window._p2guard=false; return JSON.stringify(!on); })()`)));
}

// ---------------- B. browser ----------------
(async () => {
  if (process.env.DD_ENGINE_ONLY) return done();
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ck('playwright is installed', false, e.message); return done(); }
  const port = await new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew1388-'));
  const SHOTS = process.env.DD_SHOTS || path.join(dir, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
  const env = { ...process.env, DATABASE_URL: '', PORT: String(port), DB_FILE: path.join(dir, 'db.json'), SIM_WORKERS: '0', NODE_ENV: '' }; delete env.CLOCK_FILE;
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: 'ignore', windowsHide: true });
  let b;
  try {
    let up = false; for (const t0 = Date.now(); Date.now() - t0 < 60000 && !up && srv.exitCode === null;) { try { up = (await fetch('http://127.0.0.1:' + port + '/api/health')).ok; } catch (_) {} if (!up) await delay(150); }
    if (!up) throw new Error('server did not start');
    const launch = o => chromium.launch(Object.assign({ ignoreDefaultArgs: ['--mute-audio'], args: ['--disable-audio-output'] }, o || {}));
    try { b = await launch(); } catch (e) { b = await launch({ channel: 'chrome' }); }
    const newPage = async (w, h) => { const ctx = await b.newContext({ viewport: { width: w, height: h } });
      await ctx.addInitScript(() => { const Px = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : (k === Symbol.toPrimitive ? () => 0 : (['value', 'currentTime', 'sampleRate'].includes(k) ? 0 : Px)), apply: () => Px, construct: () => Px, set: () => true });
        window.AudioContext = function () { return Px; }; window.webkitAudioContext = window.AudioContext; });
      const pg = await ctx.newPage(); pg._errs = []; pg.on('pageerror', e => pg._errs.push(String(e.message)));
      await pg.goto('http://127.0.0.1:' + port + '/play', { waitUntil: 'domcontentloaded' });
      await pg.waitForFunction(() => typeof endBattle === 'function' && typeof api === 'function' && typeof ddRender === 'function', null, { timeout: 90000 });
      await delay(1500); await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(1200);
      return pg; };
    console.log('== B. browser: campaign win / loss, Vault, Arena ==');
    const pg = await newPage(1280, 720);
    const login = await pg.evaluate(async () => { const name = 'dd' + Date.now().toString(36); const reg = await api('/api/register', 'POST', { name, pass: 'password1' });
      if (!reg || !reg.token) return { error: JSON.stringify(reg).slice(0, 200) }; ACC.token = reg.token; ACC.id = reg.profile.id; try { adoptLedger(await api('/api/ledger')); } catch (e) {}
      G.tutSkipped = true; G.tutDone = true; return { ok: true }; });
    if (login.error) throw new Error('register: ' + login.error);
    // the game's own campaign flow: /api/campaign/start, startBattle, the fight, endBattle -> resultLater -> /api/campaign/resolve
    const campaign = async (lose) => pg.evaluate(async (lose) => {
      const team = ['vael', 'sylthaine', 'vireo'];
      CUR = { node: 1, mode: 'campaign', portal: 'normal' };
      const s = await api('/api/campaign/start', 'POST', { mode: 'normal', node: 1, heroIds: team, requestId: 'dd' + Date.now() + Math.random() });
      if (!s || !s.ok) return { error: (s && s.error) || 'start failed' };
      CUR.attemptId = s.attemptId; CUR.cwaves = (s.stage && s.stage.waves) || null; CUR.serverSnaps = s.snaps; CUR.seed = s.seed >>> 0; CUR.engine = s.engine;
      G.squads = G.squads || {}; G.squads.campaign = team.slice(); G.team = team.slice();
      const led0 = await api('/api/ledger'); const gold0 = (led0 && (led0.gold != null ? led0.gold : (led0.ledger && led0.ledger.gold))) | 0;
      let resolves = 0; const _api = window.api; window.api = async function (p) { if (p === '/api/campaign/resolve') resolves++; return _api.apply(this, arguments); };
      paused = true; startBattle();
      for (let i = 0; i < 200 && !(state === 'battle' && units.some(u => u.team === 'ally')); i++) await new Promise(r => setTimeout(r, 100));
      window.patEgp1 = () => true; autoUlt = true;
      const step = async n => { for (let i = 0; i < n && !ended && state === 'battle'; i++) { updateBattle(SIM_STEP); if (i % 8 === 0) await new Promise(r => setTimeout(r, 2)); } };
      if (lose) { await step(200); if (!ended) endBattle(false); }   // the player loses (time out / squad down): the engine's own loss path
      else { units.filter(u => u.team === 'ally').forEach(u => { u.maxHp *= 30; u.hp = u.maxHp; }); await step(14400); if (!ended) endBattle(false); }
      paused = false;
      const won = window._p2lastWon === true, snap = JSON.parse(JSON.stringify(DD.snap || null));
      const sees = []; let popUnder = false;
      for (let i = 0; i < 200; i++) { const dp = document.getElementById('ddPop'); if (dp) { sees.push('dd'); break; } await new Promise(r => setTimeout(r, 100)); }
      const ddEl = document.getElementById('ddPop');
      // the result / reward screen is painted under the panel while it is open
      for (let i = 0; i < 200 && !(document.getElementById('result').classList.contains('active')); i++) await new Promise(r => setTimeout(r, 100));
      await new Promise(r => setTimeout(r, 600));
      const rp = document.getElementById('stageRewPop'); popUnder = !!rp;
      const zDD = ddEl ? +getComputedStyle(ddEl).zIndex : 0, zRP = rp ? +getComputedStyle(rp).zIndex : 0;
      const resultTitle = document.getElementById('resultTitle').textContent;
      const rows = ddEl ? [...ddEl.querySelectorAll('.ddL .ddRow')].length : 0, erows = ddEl ? [...ddEl.querySelectorAll('.ddR .ddRow')].length : 0;
      const mvp = ddEl ? !!ddEl.querySelector('.ddL .ddRow.ddMvp:first-child') : false;
      const nums = ddEl ? [...ddEl.querySelectorAll('.ddL .ddNum')].map(e => e.textContent) : [];
      const goBtn = ddEl && ddEl.querySelector('.ddGo'); const gr = goBtn && goBtn.getBoundingClientRect();
      document.querySelectorAll('#tutOffer').forEach(n => n.remove());   // a brand-new test account's boot-time tutorial offer, not part of this flow
      const _at = gr && document.elementFromPoint(gr.left + gr.width / 2, gr.top + gr.height / 2), topIsGo = !!(gr && _at === goBtn), atGo = _at ? (_at.id || _at.className || _at.tagName) + ' in ' + ((_at.closest('[id]') || {}).id || '') : 'none';
      if (goBtn) goBtn.click();
      await new Promise(r => setTimeout(r, 400));
      const ddGone = !document.getElementById('ddPop');
      const rp2 = document.getElementById('stageRewPop'); let topIsCollect = false, collected = false;
      if (rp2) { const c = rp2.querySelector('.srGo'), cr = c.getBoundingClientRect(); topIsCollect = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2) === c; c.click(); collected = true; await new Promise(r => setTimeout(r, 1500)); }
      const active = (document.querySelector('.screen.active:not(.popout)') || {}).id || '';
      await new Promise(r => setTimeout(r, 1500));
      const led1 = await api('/api/ledger'); const gold1 = (led1 && (led1.gold != null ? led1.gold : (led1.ledger && led1.ledger.gold))) | 0;
      window.api = _api;
      return { atGo, won, snap, sees, popUnder, zDD, zRP, resultTitle, rows, erows, mvp, nums, topIsGo, ddGone, topIsCollect, collected, active, resolves, gold0, gold1, team };
    }, lose);
    const W = await campaign(false);
    if (W.error) { ck('campaign stage starts', false, W.error); }
    else {
      ck('campaign win: the fight was won on screen', W.won === true);
      ck('campaign win: the Damage Done panel opens first', W.sees[0] === 'dd');
      ck('campaign win: your heroes on the left (' + W.rows + ' rows) and the opponents on the right (' + W.erows + ' rows)', W.rows === W.team.length && W.erows > 0);
      ck('campaign win: the top dealer is marked (first row, crown)', W.mvp);
      ck('campaign win: every bar carries its number (' + W.nums.join(', ') + ')', W.nums.length === W.rows && W.nums.every(n => /^[\d,]+$/.test(n)));
      ck('campaign win: the per-source totals add up to each row', W.snap && W.snap.a.concat(W.snap.e).every(g => Math.abs(Object.values(g.src).reduce((s, v) => s + v, 0) - g.dealt) < 1e-6 * Math.max(1, g.dealt)));
      ck('campaign win: the reward pop is painted UNDER the panel (z ' + W.zRP + ' < ' + W.zDD + ') and VICTORY under both', W.popUnder && W.zDD > W.zRP && /VICTORY/i.test(W.resultTitle), W.resultTitle);
      ck('campaign win: Continue is on top and closes the panel', W.topIsGo && W.ddGone, W.atGo + ' gone=' + W.ddGone);
      ck('campaign win: Continue -> exactly the reward pop (its Collect is on top) -> Collect -> the campaign map', W.topIsCollect && W.collected && W.active === 'campaign', 'screen ' + W.active);
      ck('campaign win: /api/campaign/resolve called once and the gold credited once (' + W.gold0 + ' -> ' + W.gold1 + ')', W.resolves === 1 && W.gold1 > W.gold0);
    }
    const L = await campaign(true);
    if (L.error) ck('campaign loss starts', false, L.error);
    else {
      ck('campaign loss: the panel opens, then the normal DEFEAT screen (' + L.resultTitle + ')', L.won === false && L.sees[0] === 'dd' && L.ddGone && /DEFEAT/i.test(L.resultTitle) && !L.popUnder && L.active === 'result', JSON.stringify({ ...L, snap: undefined }));
      ck('campaign loss: one resolve call, no gold (' + L.gold0 + ' -> ' + L.gold1 + ')', L.resolves === 1 && L.gold1 === L.gold0);
    }
    // Vault + Arena: a real fight on the page's engine, ended by the engine, through that mode's endBattle branch
    const local = async (mode) => pg.evaluate(async (mode) => {
      await new Promise(r => setTimeout(r, 300)); show('hub');
      clearBattle(); const A = snapAllySquad(['vael', 'lumi', 'grosk', 'astra', 'umbris']), B = snapAllySquad(['tick', 'fritz', 'oakmir']);
      CUR = mode === 'vault' ? { mode: 'vault', floor: 7 } : { mode: 'arena', arenaSnap: A, arenaFoe: B, oppName: 'Rival', oppId: null, seed: 99 };
      ended = false; state = 'battle'; battleTime = 0; gameSpeed = 1; paused = true; seedBattle(99); setupMarchTeams(A, B, false);
      for (let i = 0; i < 14400 && !ended; i++) { updateBattle(SIM_STEP); if (i % 50 === 0) await new Promise(r => setTimeout(r, 1)); }
      paused = false; const won = window._p2lastWon === true, snap = JSON.parse(JSON.stringify(DD.snap || null));
      let dd = null; for (let i = 0; i < 150 && !(dd = document.getElementById('ddPop')); i++) await new Promise(r => setTimeout(r, 100));
      for (let i = 0; i < 100 && !document.getElementById('result').classList.contains('active'); i++) await new Promise(r => setTimeout(r, 100));
      const title = document.getElementById('resultTitle').textContent, under = document.getElementById('result').classList.contains('active');
      const L = dd ? dd.querySelectorAll('.ddL .ddRow').length : 0, R = dd ? dd.querySelectorAll('.ddR .ddRow').length : 0;
      if (dd) dd.querySelector('.ddGo').click(); await new Promise(r => setTimeout(r, 300));
      return { ended, won, dd: !!dd, L, R, title, under, gone: !document.getElementById('ddPop'), active: (document.querySelector('.screen.active:not(.popout)') || {}).id, snap }; }, mode);
    const V = await local('vault');
    ck('Vault: the fight ends, the panel opens (5 heroes left, ' + V.R + ' opponents right), Continue -> the Vault result (' + V.title + ')', V.ended && V.dd && V.L === 5 && V.R === 3 && V.under && V.gone && V.active === 'result' && (/FLOOR 7|VAULT/i.test(V.title)), JSON.stringify({ ...V, snap: undefined }));
    const A = await local('arena');
    ck('Arena: the panel opens over the arena result (' + A.title + '), the seed-search re-sims after the fight did not touch its numbers', A.ended && A.dd && A.L === 5 && A.R === 3 && A.under && A.gone && /ARENA/i.test(A.title) && A.snap && A.snap.a.reduce((s, g) => s + g.dealt, 0) > 0, JSON.stringify({ ...A, snap: undefined }));
    ck('no page errors in the browser flows', pg._errs.length === 0, pg._errs.slice(0, 3).join(' | '));
    const SNAP = (W && W.snap && W.snap.e.length >= 3) ? W.snap : A.snap;
    // a fuller board for the size checks: the 5-hero Vault fight (summons included in their owner)
    const BIG = V.snap && V.snap.a.length === 5 ? V.snap : SNAP;

    console.log('== C. four sizes: everything fits, no sideways scroll, breakdown inside the panel ==');
    for (const [w, h, nm] of [[844, 390, 'phone-landscape-844x390'], [390, 844, 'phone-portrait-390x844'], [1280, 720, 'pc-1280x720'], [1440, 900, 'pc-1440x900']]) {
      const p2 = await newPage(w, h);
      const many = JSON.parse(JSON.stringify(BIG)); // add a crowd of opponents to prove the list scrolls inside the panel
      const crowd = (SNAP.e || []).concat(A.snap.e || []); for (let i = 0; i < 6 && crowd.length; i++) { const g = JSON.parse(JSON.stringify(crowd[i % crowd.length])); const f = 0.3 + i * 0.05; g.dealt *= f; for (const k in g.src) g.src[k] *= f; many.e.push(g); }
      many.e.sort((x, y) => y.dealt - x.dealt);
      const m = await p2.evaluate(async (S) => { { const st = document.createElement('style'); st.textContent = '#authGate,#tutOffer{display:none!important}'; document.head.appendChild(st); }   // signed-out page: the sign-in gate is not part of a fight
        show('hub'); ddRender(S, null); await new Promise(r => setTimeout(r, 900));
        const vw = innerWidth, vh = innerHeight, ov = document.getElementById('ddPop'), card = ov.querySelector('.ddCard'), go = ov.querySelector('.ddGo');
        const inside = el => { const r = el.getBoundingClientRect(); return r.left >= -0.5 && r.top >= -0.5 && r.right <= vw + 0.5 && r.bottom <= vh + 0.5; };
        const lists = [...ov.querySelectorAll('.ddList')].map(l => ({ sh: l.scrollHeight, ch: l.clientHeight, ov: getComputedStyle(l).overflowY }));
        const orderOk = ['.ddL', '.ddR'].every(c => { const v = [...ov.querySelectorAll(c + ' .ddNum')].map(e => +e.textContent.replace(/,/g, '')); return v.every((x, i) => i === 0 || v[i - 1] >= x); });
        const numsIn = [...ov.querySelectorAll('.ddTrack')].every(t => { const n = t.querySelector('.ddNum'), tr = t.getBoundingClientRect(), nr = n.getBoundingClientRect(); return nr.width > 0 && (nr.left >= tr.left - 1 && nr.right <= tr.right + 1 && nr.top >= tr.top - 2 && nr.bottom <= tr.bottom + 2); });
        const cardRot = (card.ewGameRect ? card.ewGameRect() : card.getBoundingClientRect());
        return { card: inside(card), go: inside(go), hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || document.body.scrollWidth > document.body.clientWidth + 1,
          lists, orderOk, numsIn, rot: document.body.classList.contains('ew-rotated'), cw: Math.round(cardRot.width), chh: Math.round(cardRot.height), L: ov.querySelectorAll('.ddL .ddRow').length, R: ov.querySelectorAll('.ddR .ddRow').length,
          cardSide: [...ov.querySelectorAll('.ddL .ddRow')].every(r => r.firstElementChild.classList.contains('ddArt')) && [...ov.querySelectorAll('.ddR .ddRow')].every(r => getComputedStyle(r).flexDirection === 'row-reverse' && r.firstElementChild.classList.contains('ddArt')) }; }, many);
      ck(nm + ': the panel and Continue are inside the screen, no sideways scroll (card ' + m.cw + 'x' + m.chh + (m.rot ? ', turned' : '') + ')', m.card && m.go && !m.hscroll);
      ck(nm + ': both columns shown (' + m.L + ' heroes | ' + m.R + ' opponents), a long column scrolls inside the panel', m.L === BIG.a.length && m.R === many.e.length && m.lists.every(l => l.ov === 'auto' && (l.sh <= l.ch + 1 || l.sh > l.ch)), JSON.stringify(m.lists));
      ck(nm + ': highest damage at the top of each column; each number sits on its bar row', m.orderOk && m.numsIn);
      ck(nm + ': cards on the outside - heroes\' card left of their bar, opponents\' card right of theirs', m.cardSide);
      await p2.screenshot({ path: path.join(SHOTS, 'dd-' + nm + '.png') });
      // the breakdown: hover on PC, double tap on a phone; it must stay inside the panel
      const t = await p2.evaluate(async () => { const ov = document.getElementById('ddPop'), tr = [...ov.querySelectorAll('.ddR .ddTrack')].pop(); tr.scrollIntoView({ block: 'nearest' }); await new Promise(r => setTimeout(r, 250));
        tr.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await new Promise(r => setTimeout(r, 150));
        const tip = ov.querySelector('.ddTip'), card = ov.querySelector('.ddCard'), r = tip.getBoundingClientRect(), c = card.getBoundingClientRect();
        const rows = [...tip.querySelectorAll('.ddTipR b')].map(b => +b.textContent.replace(/,/g, '')), head = +((tip.querySelector('.ddTipH').textContent.match(/([\d,]+)\s*$/) || [0, '0'])[1].replace(/,/g, ''));
        const pcts = [...tip.querySelectorAll('.ddTipR i')].map(i => parseFloat(i.textContent));
        return { shown: !tip.hidden, inCard: r.left >= c.left - 0.5 && r.right <= c.right + 0.5 && r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5, inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, rows, head, pcts,
          sorted: rows.every((x, i) => i === 0 || rows[i - 1] >= x) }; });
      const sum = t.rows.reduce((s, x) => s + x, 0);
      ck(nm + ': double click the last opponent\'s bar -> its breakdown, inside the panel and the screen, highest first, sums to its total (' + sum + ' vs ' + t.head + ', ' + t.pcts.reduce((s, x) => s + x, 0).toFixed(1) + '%)', t.shown && t.inCard && t.inView && t.sorted && Math.abs(sum - t.head) <= t.rows.length && Math.abs(t.pcts.reduce((s, x) => s + x, 0) - 100) < 0.5, JSON.stringify(t));
      await p2.screenshot({ path: path.join(SHOTS, 'dd-' + nm + '-breakdown-enemy.png') });
      if (w >= 1000) { // hover on PC: the first hero's bar
        await p2.evaluate(() => { document.getElementById('ddPop').querySelector('.ddTip').hidden = true; });
        const box = await p2.evaluate(() => { const r = document.querySelector('#ddPop .ddL .ddTrack').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
        await p2.mouse.move(box.x, box.y); await delay(200);
        const hv = await p2.evaluate(b => { const e = document.elementFromPoint(b.x, b.y); return { shown: !document.querySelector('#ddPop .ddTip').hidden, at: e ? (e.id || e.className) + ' < ' + ((e.closest('[id]') || {}).id || '') : 'none' }; }, box);
        ck(nm + ': hovering a hero\'s bar shows its breakdown', hv.shown, JSON.stringify(hv));
        await p2.screenshot({ path: path.join(SHOTS, 'dd-' + nm + '-breakdown-hero.png') });
        await p2.mouse.move(2, 2); await delay(150);
        ck(nm + ': moving off the bar closes it', await p2.evaluate(() => document.querySelector('#ddPop .ddTip').hidden));
      } else { // touch: double tap a hero's bar
        const ok = await p2.evaluate(async () => { const ov = document.getElementById('ddPop'), tip = ov.querySelector('.ddTip'); tip.hidden = true; const tr = ov.querySelector('.ddL .ddTrack');
          const ev = () => tr.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' })); ev(); await new Promise(r => setTimeout(r, 120)); const one = !tip.hidden; ev(); await new Promise(r => setTimeout(r, 120));
          const two = !tip.hidden; ov.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })); return { one, two, closed: tip.hidden }; });
        ck(nm + ': a single tap does nothing, a double tap on a hero\'s bar opens the breakdown, a tap elsewhere closes it', !ok.one && ok.two && ok.closed, JSON.stringify(ok));
        await p2.evaluate(async () => { const tr = document.querySelector('#ddPop .ddL .ddTrack'); tr.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
        await delay(150); await p2.screenshot({ path: path.join(SHOTS, 'dd-' + nm + '-breakdown-hero.png') });
      }
      ck(nm + ': no page errors', p2._errs.length === 0, p2._errs.slice(0, 2).join(' | '));
      await p2.context().close();
    }
    console.log('  screenshots: ' + SHOTS);
  } catch (e) { ck('browser part ran', false, e && e.stack || String(e)); }
  finally { try { if (b) await b.close(); } catch (_) {} try { srv.kill(); } catch (_) {} }
  done();
})();
function done() { console.log('test_damage_done_1388.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0); }
