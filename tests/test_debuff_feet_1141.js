'use strict';
// v1141 DEBUFFS UNDER THE FEET (Phil 15 Oct 2026: "Debuffs like burn, bleed, poison, curse, wax, are being treated like buffs and are
// being placed above a character. they should be under their feet."). Display only. This test:
//   1. KIND MAP: every damage-over-time colour the engine pushes (every literal colour handed to pushDot / plagueDot, every creeprot/dot
//      kit colour, every _plagueColor) has a named feet kind (burn / bleed / poison / curse), each kind has its feet art on disk
//      (firepatch / bleed / poison / voidzone - curse lies FLAT, a disc); Umbris' curse, Grimsby's debt, Hollow's grey bleed, Astra's
//      stardust and the bee sting by name. CONTROL: BASE classifies the curse, the debt and the grey bleed as nothing (no feet mark).
//   2. WORDS: a debuff word (WAX, SEALED, IN DEBT, MARKED, VENOM, bleed x2, OVERDUE x3, -resist ...) stacks UNDER the feet (screen offset
//      down), buff and control words (STUN, SILENCED, FEAR!, RALLIED) stay in the over-head column. CONTROL: on BASE WAX goes up.
//   3. FIGHTS: whole fights with every debuffer (both sides, autoUlt) are tick-identical to BASE (hp/x/y/alive/energy/atkCd + RNG draws).
//      CONTROL: the same fight with a DoT 1% longer diverges - the trace sees a change.
//   4. BROWSER (real page, muted 844x390 phone, real fights): the v595 debuff badges of Grimsby / Pyroclast / Absalie are drawn at the
//      victim's FEET (behind the unit, renderOrder -4, riding with it), never over the bar; buff badges still go over the bar; a curse
//      and a debt get the flat void zone at the feet; Living Tallow's stacks get the wax pool behind the feet; a new fight tears every
//      feet mark down (_statusFxAll, _waxFxAll, no feet badge left in the scene). CONTROL: the BASE page draws the same debuffs over the bar.
// One line per check; exit code = number of failures.
(async function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), net = require('net'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || '25d88920';   // live v1140
const H = fs.readFileSync(HTML, 'utf8');
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? ' - ' + detail : '')); } };
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
let OLD = null, baseHtml = '';
try { baseHtml = cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
  OLD = path.join(ROOT, '.test-debuff-feet-base-' + process.pid + '.html'); fs.writeFileSync(OLD, baseHtml);
  const t = OLD; process.on('exit', () => { try { fs.unlinkSync(t); } catch (e) {} }); } catch (e) { OLD = null; }
ck('BASE ' + BASE_SHA + ' loaded as the control', !!OLD && !baseHtml.includes('FT_DEBUFF_RE'));
try {
  const run = load(HTML), runB = OLD ? load(OLD) : null;

  // ------------------------------------------------------------------ 1. KIND MAP
  const cols = new Set();
  for (const m of H.matchAll(/(?:pushDot|plagueDot)\(([^;]*?)\)/g)) for (const c of m[1].matchAll(/'(#[0-9a-fA-F]{6})'/g)) cols.add(c[1].toLowerCase());
  for (const m of H.matchAll(/type:'(?:creeprot|dot)'[^}]*?color:'(#[0-9a-fA-F]{6})'/g)) cols.add(m[1].toLowerCase());
  for (const m of H.matchAll(/_plagueColor(?:\|\||=)'(#[0-9a-fA-F]{6})'/g)) cols.add(m[1].toLowerCase());
  cols.add('#ff8844');   // pushDot's own default
  const list = [...cols].sort();
  const kinds = JSON.parse(run(`JSON.stringify(${JSON.stringify(list)}.map(c=>[c,dotKind(c)]))`));
  ck('every DoT colour the engine pushes (' + list.length + ') has a feet kind', list.length >= 12 && kinds.every(k => ['burn', 'bleed', 'poison', 'curse'].includes(k[1])), JSON.stringify(kinds.filter(k => !k[1])));
  const want = { '#8a5cff': 'curse', '#7a3fb0': 'curse', '#b06bff': 'curse', '#8a7a3a': 'curse', '#8f8fa8': 'bleed', '#c0392b': 'bleed', '#8fbf3f': 'poison', '#f2d84a': 'poison',
    '#ff7a2a': 'burn', '#ff6a3a': 'burn', '#ffa657': 'burn', '#6fe3d4': 'burn' };
  const got = JSON.parse(run(`JSON.stringify(Object.fromEntries(${JSON.stringify(Object.keys(want))}.map(c=>[c,dotKind(c)])))`));
  ck('by name: Umbris/plague curse + Grimsby debt = curse, Hollow grey + Carn red = bleed, Bloatus + bee sting = poison, Pyroclast/Tolley/Astra = burn', JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got));
  const art = JSON.parse(run(`JSON.stringify(Object.entries(STATUSFX_KEY).map(([k,v])=>[k,v,!!FX2_DEF[v],FX2_DEF[v]&&FX2_DEF[v].u,!!(FX2_DEF[v]&&FX2_DEF[v].disc)]))`));
  ck('each kind has its existing feet art (no new art): burn firepatch, bleed bleed, poison poison, curse voidzone (a flat disc)',
    art.length === 4 && art.every(a => a[2] && fs.existsSync(path.join(ROOT, a[3].split('?')[0]))) && JSON.stringify(art.map(a => a.slice(0, 2))) === JSON.stringify([['poison', 'poison'], ['bleed', 'bleed'], ['burn', 'firepatch'], ['curse', 'voidzone']]) && art[3][4], JSON.stringify(art));
  if (runB) { const b = JSON.parse(runB(`JSON.stringify(['#8a5cff','#8a7a3a','#8f8fa8','#6fe3d4'].map(c=>dotKind(c)))`));
    ck('CONTROL: BASE gives the curse, the debt, the grey bleed and the stardust no kind (no feet mark) - ' + JSON.stringify(b), b.every(x => x === null)); }

  // ------------------------------------------------------------------ 2. WORDS
  const W = { below: ['WAX', 'SEALING WAX', 'SEALED', 'ENCASED', 'STATUE', 'VENOM', 'STUNG', 'IN DEBT', 'MARKED', 'REWRITTEN', 'RUPTURE', 'bleed x2', 'wax x3', 'OVERDUE x4', '−resist', '−armour', '−SPEED'],
    above: ['STUN', 'SILENCED', 'FEAR!', 'ASLEEP', 'FROZEN', 'ROOTED', 'RALLIED', 'ABSORB', 'WILL NOT FALL'] };
  const words = (r) => JSON.parse(r(`(()=>{ floatTexts=[]; const all=${JSON.stringify(W.below.concat(W.above))};
    all.forEach((t,i)=>floatTexts.push({x:100+i*3*FT_STATUS_GROUP,y:400,txt:t,t:1.2,color:'#fff',vy:1,sz:12}));   /* one word per unit: each is the newest line of its own column */
    for(let i=0;i<20;i++) statusTextStack(1/60,1);
    const o={}; floatTexts.forEach(f=>{ o[f.txt]=f._oy==null?null:+f._oy.toFixed(2); }); floatTexts=[]; return JSON.stringify(o); })()`));
  const nw = words(run);
  ck('debuff words stack UNDER the feet (screen offset > 0): ' + W.below.join(', '), W.below.every(t => nw[t] > 0), JSON.stringify(nw));
  ck('control, buff and shield words keep the over-head column (offset < 0): ' + W.above.join(', '), W.above.every(t => nw[t] < 0), JSON.stringify(nw));
  ck('a debuff word is not a buff word and is projected from the feet line (FT_FEET_HZ, the draw uses it)',
    run(`ftIsDebuff({txt:'WAX'})&&!ftIsStatus({txt:'WAX'})&&ftIsStatus({txt:'STUN'})&&!ftIsDebuff({txt:'STUN'})&&!ftIsDebuff({txt:'Last Stand',label:true})&&!ftIsDebuff({txt:'-47'})`) === true && /_fdb\?FT_FEET_HZ:/.test(H));
  if (runB) { const bw = words(runB); ck('CONTROL: on BASE the debuff words go up with the buffs (WAX ' + bw.WAX + ', IN DEBT ' + bw['IN DEBT'] + ')', bw.WAX < 0 && bw['IN DEBT'] < 0); }

  // ------------------------------------------------------------------ 3. FIGHTS tick-identical
  const FIGHTS = [
    [['pyroclast', 'carn', 'bloatus'], ['umbris', 'grimsby', 'ceraline'], 3],
    [['umbris', 'grimsby', 'ceraline'], ['pyroclast', 'carn', 'bloatus'], 7],
    [['astra', 'vex', 'mellan'], ['tolley', 'hollow', 'absalie'], 11],
    [['tolley', 'hollow', 'absalie'], ['astra', 'vex', 'mellan'], 13],
    [['ceraline', 'grimsby', 'vex'], ['ceraline', 'umbris', 'hollow'], 21],
    [['bloatus', 'mellan', 'umbris'], ['carn', 'pyroclast', 'grimsby'], 29],
  ];
  const HASH = `globalThis.require_hash=function(s){ let h1=0x811c9dc5, h2=0x01000193; for(let i=0;i<s.length;i++){ const c=s.charCodeAt(i); h1=Math.imul(h1^c,16777619)>>>0; h2=Math.imul(h2+c,2246822519)>>>0; } return h1.toString(16)+':'+h2.toString(16)+':'+s.length; }; 1`;
  const fight = (r, [a, f, seed], mut) => JSON.parse(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true; let draws=0;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; floatTexts=[]; seedBattle(${seed});
      const _r0=_brng; _brng=function(){ draws++; return _r0(); };
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:5})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:5})));
      units.forEach(u=>buildFigure(u)); ${mut || ''}
      window._p2guard=false; const tr=[]; let dots=0, deb=0;
      for(let i=0;i<SIM_HZ*60&&!ended;i++){ updateBattle(SIM_STEP); try{ updateWaxFx(SIM_STEP); }catch(e){}
        units.forEach(u=>{ dots+=(u.dots||[]).length?1:0; }); deb+=floatTexts.filter(ftIsDebuff).length;
        tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10),Math.round((u.atkCd||0)*1000)].join(':')).join('|')+'#'+draws); }
      return JSON.stringify({n:tr.length,h:require_hash(tr.join('\\n')),dots,deb}); } finally{ autoUlt=svA; window._p2guard=false; } })()`));
  if (runB) {
    /* v1161 re-baseline: these fights run Hollow, Carn, Mellan and Tolley, changed on purpose after BASE - v1143 Vanishing Point 2.0 -> 1.2
       (0c5e8a29), v1144 Hollow's drop 3.5 -> 5.5 s + Attack 40 -> 36 (5121b055), v1150 a summon takes its owner's fight level (cf3bf0c4), and
       v1142 Carn's first crit clip (by the v532 crit-clip rule his crit is rolled at the wind-up - same chance, earlier in the RNG stream). The
       BASE side is BASE + those changes (tests/helpers/balance-1143-1150.js, copied from the commits; Carn's crit clip given with his OLD attack
       timing, render data only, as tests/test_carn_anim_eight.js proves it), so the fights still compare the feet display with the pre-v1141
       engine; a CONTROL shows plain BASE differs. */
    const BAL = require('./helpers/balance-1143-1150.js');
    const OLDF = path.join(ROOT, '.test-debuff-feet-base-balance-' + process.pid + '.html'); fs.writeFileSync(OLDF, BAL.withChanges(baseHtml));
    process.on('exit', () => { try { fs.unlinkSync(OLDF); } catch (e) {} });
    const CARN_RULE = "BATTLE_ANIM.carn=Object.assign({},BATTLE_ANIM.carn,{crit:Object.assign({},BATTLE_ANIM.carn.attack)}); 1";
    const rN = load(HTML), rB = load(OLDF); rN(HASH); rB(HASH); rN('ftIsDebuff'); rB('globalThis.ftIsDebuff=globalThis.ftIsDebuff||(()=>false)'); rB(CARN_RULE);
    const res = FIGHTS.map(F => { let n = null, b = null; try { n = fight(rN, F); } catch (e) { n = { h: 'ERR ' + e.message }; } try { b = fight(rB, F); } catch (e) { b = { h: 'ERR ' + e.message }; } return { F, n, b }; });
    const same = res.filter(x => x.n.h === x.b.h && x.n.n > 300 && x.n.dots > 0);
    ck('whole fights (' + FIGHTS.length + ', every debuffer both sides, autoUlt) are tick-identical to BASE (hp/x/y/alive/energy/atkCd + RNG draws) and really carried DoTs',
      same.length === FIGHTS.length, res.filter(x => !same.includes(x)).map(x => x.F[2] + ':' + x.n.h + '/' + x.b.h + ' dots ' + x.n.dots).join(' '));
    ck('those fights really put debuff words under the feet (' + res.reduce((s, x) => s + (x.n.deb || 0), 0) + ' word-ticks)', res.reduce((s, x) => s + (x.n.deb || 0), 0) > 50);
    const moved = fight(rN, FIGHTS[0], `{ const _pd=pushDot; pushDot=function(t,dps,dur,iv,c){ return _pd.call(this,t,dps*1.01,dur,iv,c); }; }`);
    ck('CONTROL: the same fight with every DoT 1% stronger diverges - the trace sees a fight change', moved.h !== res[0].b.h);
    { const r0 = load(OLD); r0(HASH); r0('globalThis.ftIsDebuff=globalThis.ftIsDebuff||(()=>false)'); r0(CARN_RULE);
      const diff = FIGHTS.filter((F, i) => fight(r0, F).h !== res[i].b.h).map(F => F[2]);
      ck('CONTROL: plain BASE (without the v1143-v1150 balance changes) differs in the fights with Hollow (seeds ' + diff.join(',') + ')', diff.length >= 3 && diff.includes(11) && diff.includes(13) && diff.includes(21), diff.join()); }
  }

  // ------------------------------------------------------------------ 4. BROWSER
  let chromium = null; try { chromium = require('playwright').chromium; } catch (e) {}
  if (!chromium) ck('playwright is available for the browser half', false);
  else {
    const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
    const port = await freePort(), base = 'http://127.0.0.1:' + port, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-dbf-'));
    const srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DB_FILE: path.join(tmp, 'db.json') }, stdio: 'ignore', windowsHide: true });
    /* no sound may ever reach Phil's speakers: no AudioContext at all, media play() a no-op, and the browser muted */
    const INIT = `(()=>{ try{ delete window.AudioContext; delete window.webkitAudioContext; }catch(e){} window.AudioContext=undefined; window.webkitAudioContext=undefined;
      try{ HTMLMediaElement.prototype.play=function(){ return Promise.resolve(); }; }catch(e){} })();`;
    let browser;
    const probe = async (html) => {
      const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36' });
      await ctx.addInitScript(INIT);
      if (html) { const ver = cp.execSync('git show ' + BASE_SHA + ':version.json', { cwd: ROOT }).toString();
        await ctx.route(u => /\/play(\?|$)/.test(new URL(u).pathname + new URL(u).search.slice(0, 1)), r => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
        await ctx.route('**/version.json*', r => r.fulfill({ status: 200, contentType: 'application/json', body: ver })); }
      const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message)));
      await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2500);
      await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await pg.waitForTimeout(1000);
      await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'dbf' + Date.now().toString(36), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id;
        G.tutStarted = true; G.tutDone = true; document.body.classList.remove('gated'); show('home'); });
      await pg.waitForTimeout(500);
      await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Skip Tutorial/i.test(x.textContent) && x.offsetParent); if (b) b.click(); });
      const VICT = ['mirelle', 'tick', 'rhukk'], CAST = ['grimsby', 'pyroclast', 'absalie'];
      await pg.evaluate(({ VICT, CAST }) => { G.team = VICT.slice(); CUR = { mode: 'arena', seed: 41 }; startVersus(CAST.map(k => ({ key: k, level: 30, rank: 5 })), true, VICT); }, { VICT, CAST });
      for (let i = 0; i < 240; i++) { if (await pg.evaluate(() => state === 'battle' && units.length > 0)) break; await pg.waitForTimeout(250); }
      await pg.evaluate(() => { window.__gf = []; const _g = spawnGroundFx;
        spawnGroundFx = function (k) { const r = _g.apply(this, arguments); if (r && (window._fxAboveBar || window._fxBelowFeet)) window.__gf.push({ k, r, above: !!window._fxAboveBar, below: !!window._fxBelowFeet, tgt: window._fxTgtU }); return r; };
        units.forEach(u => { u.maxHp = u.hp = 1e7; if (u.team === 'ally') { u.dmg = 0; u.apow = 0; u.energy = u.maxEnergy || 100; } }); gameSpeed = 2; });   /* full allies: Mirelle's ult is a BUFF badge over the bar (v1168: Vael's Last Stand moved to its own painter, no over-bar badge) */
      const DEBUFF_GFX = ['grimsby_green', 'pyroclast_green', 'absalie_green', 'grimsby_ult'];
      let seen = [];
      for (let i = 0; i < 120; i++) { await pg.waitForTimeout(250);
        await pg.evaluate(() => units.forEach(u => { u.hp = u.maxHp; }));
        seen = await pg.evaluate((D) => window.__gf.filter(g => D.includes(g.k) && g.tgt && g.tgt.team === 'ally').map(g => {
          const p = g.r.m.position; return { k: g.k, above: g.above, below: g.below, ro: g.r.m.renderOrder, cy: g.r.m.center ? +g.r.m.center.y.toFixed(2) : null, y: +p.y.toFixed(3),
            follow: g.r.follow === g.tgt, followAbove: !!g.r.followAbove }; }), DEBUFF_GFX);
        if (new Set(seen.map(s => s.k)).size >= 3) break; }
      const buffs = await pg.evaluate(() => window.__gf.filter(g => g.above).map(g => g.k));
      const out = { seen, buffs, errs };
      // feet plates: a curse, a debt and Living Tallow on the first victim(s)
      out.plates = await pg.evaluate(async () => { const v = units.filter(u => u.team === 'ally' && u.alive); const a = v[0], b = v[1] || v[0];
        a.dots = []; pushDot(a, 0, 6, 1, '#8a5cff'); await new Promise(r => setTimeout(r, 400));
        const s1 = a._statusFx; const curse = s1 ? { kind: s1.kind, flat: !!s1.flat, mesh: !!s1.spr.isMesh, rotX: +s1.spr.rotation.x.toFixed(3), y: +s1.spr.position.y.toFixed(3), ro: s1.spr.renderOrder, inScene: s1.spr.parent === scene } : null;
        a.dots = []; pushDot(a, 0, 6, 1, '#8a7a3a'); await new Promise(r => setTimeout(r, 400));
        const s2 = a._statusFx; const debt = s2 ? { kind: s2.kind } : null;
        b._waxCoatT = 0; b._wax = 2; b._waxT = 5; await new Promise(r => setTimeout(r, 400));
        const w = b._waxFx; const tallow = w ? { pool: !!w.pool, ro: w.spr.renderOrder, y: +w.spr.position.y.toFixed(3), key: (() => { for (const k in _fx2Tex) if (_fx2Tex[k] === w.spr.material.map) return k; return null; })() } : null;
        const fl = { x: a.x, y: a.y - 8, txt: 'WAX', t: 1.5, color: '#fff', vy: 1, sz: 12 }, fs = { x: a.x + 4 * FT_STATUS_GROUP, y: a.y - 8, txt: 'STUN', t: 1.5, color: '#fff', vy: 1, sz: 12 };
        floatTexts.push(fl, fs); await new Promise(r => setTimeout(r, 500));
        const feet = project(a.x, a.y, 0.02), head = project(a.x, a.y, a.sprH || 3.9);
        return { curse, debt, tallow, wax_oy: fl._oy, stun_oy: fs._oy, feetY: feet.y, headY: head.y }; });
      // teardown: a new fight leaves no feet mark behind
      await pg.evaluate(() => { if (!ended) endBattle(true); }); await pg.waitForTimeout(600);
      await pg.evaluate(() => { try { document.getElementById('resultBtn').click(); } catch (e) {} show('home'); }); await pg.waitForTimeout(500);
      await pg.evaluate(({ VICT }) => { CUR = { mode: 'arena', seed: 42 }; startVersus([{ key: 'tick', level: 1, rank: 3 }], true, VICT); }, { VICT });
      for (let i = 0; i < 240; i++) { if (await pg.evaluate(() => state === 'battle' && units.length > 0)) break; await pg.waitForTimeout(250); }
      out.tear = await pg.evaluate(() => { const keys = new Set(['voidzone', 'waxpool', 'waxerupt', 'grimsby_green', 'pyroclast_green', 'absalie_green', 'firepatch']); let left = 0;
        scene.traverse(o => { if (o.material && o.material.map) for (const k of keys) if (_fx2Tex[k] === o.material.map) left++; });
        return { statusFx: _statusFxAll.length, waxFx: (typeof _waxFxAll !== 'undefined') ? _waxFxAll.length : -1, left }; });
      await pg.evaluate(() => { if (!ended) endBattle(true); });
      await ctx.close(); return out;
    };
    try {
      for (let i = 0; i < 150; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch (_) {} await new Promise(r => setTimeout(r, 150)); }
      try { browser = await chromium.launch({ args: ['--mute-audio'] }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] }); }
      const N = await probe(null);
      const ks = [...new Set(N.seen.map(s => s.k))];
      ck('real fights: the debuff badges of Grimsby / Pyroclast / Absalie landed on the victims (' + ks.join(', ') + ')', ks.length >= 3, JSON.stringify(N.seen.slice(0, 4)));
      ck('every debuff badge is drawn at the FEET (below, not over the bar; centre on the feet line y <= 0.1, renderOrder -4 behind the unit, rides with it)',
        N.seen.length > 0 && N.seen.every(s => s.below && !s.above && s.cy === 0.5 && s.y <= 0.1 && s.ro === -4 && s.follow && !s.followAbove), JSON.stringify(N.seen.filter(s => !(s.below && !s.above && s.y <= 0.1 && s.ro === -4 && s.follow)).slice(0, 3)));
      ck('buff badges still go over the bar (' + [...new Set(N.buffs)].join(', ') + ')', N.buffs.length > 0 && !N.buffs.some(k => ['grimsby_green', 'pyroclast_green', 'absalie_green'].includes(k)));
      const P = N.plates;
      ck('a curse gets the void zone FLAT under the feet (mesh, laid on the ground, behind the units)', !!P.curse && P.curse.kind === 'curse' && P.curse.flat && P.curse.mesh && Math.abs(P.curse.rotX + Math.PI / 2) < 1e-3 && P.curse.y < 0.2 && P.curse.ro < 0 && P.curse.inScene, JSON.stringify(P.curse));
      ck('Grimsby\'s debt is a curse mark at the feet too', !!P.debt && P.debt.kind === 'curse', JSON.stringify(P.debt));
      ck('Living Tallow stacks get the wax pool behind the feet (waxpool, renderOrder -4, on the feet line)', !!P.tallow && P.tallow.pool && P.tallow.key === 'waxpool' && P.tallow.ro === -4 && P.tallow.y <= 0.36, JSON.stringify(P.tallow));
      ck('on screen: WAX sits below the feet line (' + P.wax_oy.toFixed(1) + ' px under it), STUN above the head column (' + P.stun_oy.toFixed(1) + ')', P.wax_oy > 0 && P.stun_oy < 0 && P.feetY > P.headY);
      ck('a new fight tears every feet mark down (_statusFxAll ' + N.tear.statusFx + ', _waxFxAll ' + N.tear.waxFx + ', debuff art left in the scene ' + N.tear.left + ')', N.tear.statusFx === 0 && N.tear.waxFx === 0 && N.tear.left === 0);
      ck('no page error', N.errs.length === 0, N.errs.slice(0, 3).join(' | '));
      if (baseHtml) { const B = await probe(baseHtml);
        const bAbove = B.seen.filter(s => s.above && s.followAbove);
        ck('CONTROL: the BASE page draws the same debuffs OVER THE BAR (' + bAbove.length + ' of ' + B.seen.length + ') and gives the curse no feet mark (' + JSON.stringify(B.plates.curse) + ')',
          B.seen.length > 0 && bAbove.length === B.seen.length && !B.plates.curse && B.plates.wax_oy < 0); }
    } finally { try { await browser.close(); } catch (e) {} try { srv.kill(); } catch (e) {} }
  }
} catch (e) { ck('test ran without throwing', false, e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e)); }
console.log('\nPASS: ' + pass + '  FAIL: ' + fail);
process.exit(Math.min(fail, 255));
})();
