/* v1197 - NERISSE'S DRIFTING CONSTELLATION AT HALF SIZE (Phil 18 Oct 2026). FX2_DEF.nerisse_blue.fxMul 0.5: the star orb on every hop (spawnProjFx)
   and the plate under her (spawnGroundFx) are drawn at half their size; the Skills tab preview the same. DISPLAY ONLY.
     (1) the kit and one cast's hops, heals and units are tick-identical to BASE (the live build before this change)
     (2) real page (Chromium on SwiftShader, silent): the plate and the orb sprite are exactly 0.5 x the same draw with fxMul taken off
     (3) only nerisse_blue carries fxMul; the Skills tab preview's art for the slot is 0.5 x BASE's
   CONTROL: a halved heal is NOT tick-identical; without fxMul the renderer measures the full size. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), vm = require('vm'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), BASE_SHA = process.env.EW_BASE || '0219c16c';   // live v1198
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 900) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
(async () => {
  let srv = null, browser = null; const OLD = path.join(ROOT, '.test-ner1197-base.html');
  try {
    fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
    const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
    const run = load(path.join(ROOT, 'emberweave-heroes.html')), R0 = load(OLD);
    const CAST = `(()=>{ units=[]; ended=false; battleTime=0; groundHazards.length=0; seedBattle(7); const g=makeUnit('nerisse','ally',400,700,30,{owned:false,rank:3});
      const a=makeUnit('vael','ally',300,560,30,{owned:false}), b=makeUnit('tolley','ally',520,820,30,{owned:false}), e=makeUnit('umbris','enemy',1100,300,30,{owned:false});
      units=[g,a,b,e]; units.forEach(u=>{ try{ buildFigure(u); }catch(_e){} u.speed=0; u.atkCd=99; u.atkInterval=99; u.greenCd=u.blueCd=99; }); a.hp=a.maxHp*0.4; b.hp=b.maxHp*0.5; e._noTarget=true;
      g._castSM=1; g._castLv=1; castKit(g,KITS.nerisse.blue); const tr=[];
      for(let i=0;i<Math.round(8/SIM_STEP);i++){ updateBattle(SIM_STEP); units.forEach(u=>{ u.greenCd=u.blueCd=99; u.atkCd=99; }); e.hp=e.maxHp;
        tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10)].join(':')).join('|')+'#'+groundHazards.filter(h=>h.orb).map(h=>[Math.round(h.x),Math.round(h.y),h.tgt&&h.tgt.key,+h.hopT.toFixed(3)].join(':')).join(',')); }
      return tr.join('\\n'); })()`;
    const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
    const kit = r => r(`JSON.stringify([KITS.nerisse,HERO_TYPES.nerisse,ABILITY_CAST.nerisse||null])`);
    ck(kit(run) === kit(R0), '(1) the kit, hero stats and cast times are BASE ' + BASE_SHA + "'s");
    const t1 = run(CAST), t0 = R0(CAST);
    ck(t1 === t0 && t1.split('\n').some(l => /#\d/.test(l)), '(1) one Drifting Constellation: every hop, heal and unit tick-identical to BASE for 8 s (' + H(t1) + ')');
    run('globalThis.__m=KITS.nerisse.blue.mul; KITS.nerisse.blue.mul*=0.5; 1'); const tc = run(CAST); run('KITS.nerisse.blue.mul=globalThis.__m; 1');
    ck(tc !== t0, '(1) CONTROL: the same cast with the heal halved is NOT identical');
    const fx = JSON.parse(run('JSON.stringify(Object.keys(FX2_DEF).filter(k=>FX2_DEF[k].fxMul).map(k=>[k,FX2_DEF[k].fxMul]))'));
    ck(JSON.stringify(fx) === '[["nerisse_blue",0.5]]', '(3) only nerisse_blue carries fxMul (0.5): ' + JSON.stringify(fx));
    const PQ = `JSON.stringify((skillPreviewPlan('nerisse',2)||{fx:[]}).fx.map(e=>({k:e.k,kind:e.kind,R:e.R||null,scale:e.scale||null})))`;
    const P = JSON.parse(run(PQ)), P0 = JSON.parse(R0(PQ));
    ck(P.length && P.length === P0.length && P.every((e, i) => e.k === P0[i].k && (e.R == null || Math.abs(e.R / P0[i].R - 0.5) < 1e-9) && (e.scale == null || Math.abs(e.scale / P0[i].scale - 0.5) < 1e-9)),
      '(3) the Skills tab preview draws it at half: ' + JSON.stringify({ now: P, base: P0 }));
    /* (2) the real renderer */
    const port = await freePort(), base = 'http://127.0.0.1:' + port, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-ner1197-')), log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), RL_MUL: '1000', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    let up = false; for (let i = 0; i < 300 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch (_) {} if (!up) await delay(100); }
    const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
    const args = ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ args }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args }); }
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
    await ctx.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }; });
    const pg = await ctx.newPage(); await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof spawnGroundFx === 'function' && typeof scene !== 'undefined' && !!scene, null, { timeout: 90000 }); await delay(1500);
    const M = await pg.evaluate(() => { const meas = () => { const got = []; const add = scene.add; scene.add = function (o) { got.push(o); return add.apply(this, arguments); };
        try { _fxAllow = true; spawnGroundFx('nerisse_blue', 500, 700, 3 * METER, 2); spawnProjFx('nerisse_blue', 400, 700, 600, 700, 3.2, 0.5, () => {}, 1.6); } finally { _fxAllow = false; scene.add = add; }
        const r = got.map(o => [+o.scale.x.toFixed(5), +o.scale.y.toFixed(5)]); got.forEach(o => { try { scene.remove(o); } catch (e) {} }); return r; };
      const now = meas(), m = FX2_DEF.nerisse_blue.fxMul; delete FX2_DEF.nerisse_blue.fxMul; const off = meas(); FX2_DEF.nerisse_blue.fxMul = m; return { now, off }; });
    const ratio = (M.now.length >= 2 && M.now.length === M.off.length) ? M.now.map((v, i) => v[0] / M.off[i][0]) : [];
    ck(ratio.length >= 2 && ratio.every(x => Math.abs(x - 0.5) < 1e-6), '(2) in the real renderer the plate and the orb are 0.5 x the same draw without fxMul (' + JSON.stringify(M) + ')');
    ck(ratio.length >= 2 && ratio.every(x => Math.abs(x - 1) > 0.4), 'CONTROL: without fxMul the renderer measures the full size (the ratio is not 1)');
  } catch (e) { fail++; console.log('  FAIL ' + (e.stack || e.message)); }
  finally { try { fs.unlinkSync(OLD); } catch (e) {} try { if (browser) await browser.close(); } catch (e) {} try { if (srv) srv.kill(); } catch (e) {} }
  console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
  process.exitCode = fail ? 1 : 0;
})();
