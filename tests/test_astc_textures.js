'use strict';
// v1191 GPU TEXTURE COMPRESSION (Phil 17 Oct 2026: "Lets do it, compress the ingame ones"; "to human eye those images looked identical" -
// ASTC 4x4 -thorough approved for hero sheets, FX and deaths). Blueprint 18 "GPU texture compression".
//   1. FILES: tools/astc_sheets.py --verify (every sheet a phone uploads has a compressed entry built from its CURRENT source with the current
//      recipe - new art that skipped the tool fails here); every .ktz parses with the page's own parser at the table's size, levels and bytes;
//      CONTROLS: a wrong format / a truncated file are refused.
//   2. STATIC: the heaviest possible 5v5 on a phone (the 10 heroes with the most art, every clip, deaths as their heaviest pair, + their spell
//      sheets) on the WebP path vs the ASTC path.
//   3. BROWSER (phone 844x390 @2, Android UA, swiftshader - which reports WEBGL_compressed_texture_astc): the compressed sheets are what loads
//      (.ktz requested, the WebP of those sheets never), the textures are compressed at the table's size and the GPU tallies (the page's gate and
//      this test's) count their REAL bytes; a frozen battle frame drawn from the compressed sheets matches the WebP frame (PSNR over the units);
//      the hub frees them; a death streams compressed; FALLBACKS: forced off, no ASTC extension, a corrupt file, a desktop - all WebP, no error;
//      DISPLAY ONLY: a seeded fight steps tick-identical on both paths (CONTROL: another seed differs).
(async function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), os = require('os'), net = require('net'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'emberweave-heroes.html');
const PY = process.env.PYTHON || 'python';
const OUT = process.env.EW_ASTC_OUT || null;   // a folder: keep the screenshots (the artifact's stills come from here)
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 600) : '')); } };
const html = fs.readFileSync(HTML, 'utf8');
const TAB = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/anim/astc_sheets.json'), 'utf8')), S = TAB.sheets;
const h = require(path.join(ROOT, 'server/sim-host.js')).load(HTML); const run = src => vm.runInContext(src, h.ctx);
try {
  // ------------------------------------------------------------------ 1. FILES
  const v = cp.spawnSync(PY, ['-I', path.join(ROOT, 'tools/astc_sheets.py'), ROOT, '--verify'], { encoding: 'utf8', maxBuffer: 1 << 24 });
  let vj = {}; try { vj = JSON.parse((v.stdout || '').trim().split('\n').pop()); } catch (e) {}
  ck('every sheet a phone uploads has a compressed entry built from its CURRENT source and recipe, and nothing else is in the table (tools/astc_sheets.py --verify: ' + vj.sheets + ' sheets)',
    v.status === 0 && vj.n_problems === 0 && vj.sheets > 900, (v.stdout || '') + (v.stderr || ''));
  ck('the page asks for this table (ASTC_TABLE_V = the table\'s own hash ' + TAB.v + ') and the table names the approved recipe (ASTC 4x4, -thorough)',
    html.includes("const ASTC_TABLE_V='" + TAB.v + "';") && /^astcenc5\.7\.0\|4x4\|-thorough\|/.test(TAB.enc));
  const parse = buf => { h.ctx.__b = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); return JSON.parse(run('(()=>{ const K=astcParse(__b); return JSON.stringify({W:K.W,H:K.H,lv:K.mips.map(m=>[m.width,m.height,m.data.byteLength])}); })()')); };
  let bad = [], nfx = 0, nclip = 0, gpuSum = 0;
  const CL = JSON.parse(run('JSON.stringify((()=>{ const o={}; for(const k in BATTLE_ANIM) for(const st in BATTLE_ANIM[k]){ const c=BATTLE_ANIM[k][st]; if(st[0]!=="_"&&c&&c.u) o[c.u.split("?")[0]]=st; } return o; })())'));
  const FXP = new Set(JSON.parse(run('JSON.stringify(Object.keys(FX2_DEF).map(k=>FX2_DEF[k].u.split("?")[0]))')));
  const PLATES = new Set(JSON.parse(run('JSON.stringify(Object.keys(FX_PLATE_DEF).map(k=>FX_PLATE_DEF[k].u.split("?")[0]))')));
  for (const p in S) { const e = S[p], f = path.join(ROOT, e[0].split('?')[0]);
    try { const K = parse(zlib.gunzipSync(fs.readFileSync(f))); const mip = !!CL[p], full = Math.floor(Math.log2(Math.max(e[1], e[2]))) + 1, by = K.lv.reduce((a, l) => a + l[2], 0);
      if (mip) nclip++; else nfx++;
      if (K.W !== e[1] || K.H !== e[2] || K.lv.length !== e[3] || by !== e[4] || (mip ? K.lv.length !== full : K.lv.length !== 1) || !(e[5] === 0 || e[5] === 1) || !/_a([0-9a-f]{8})\.ktz\?v=\1$/.test(e[0])) bad.push(p);
      gpuSum += by;
    } catch (x) { bad.push(p + ' ' + x.message); } }
  ck('every .ktz (' + nclip + ' clip sheets, ' + nfx + ' spell sheets) is KTX 1 / ASTC 4x4 at the table\'s size, levels and bytes; a clip sheet carries its full mip chain, a spell sheet level 0; each file is named and versioned by its own hash', bad.length === 0 && nclip > 700 && nfx > 200, bad.slice(0, 5).join('; '));
  ck('idle and walk are never compressed (the loader cards / Emberdraft paint them from the decoded image), nor the FX plates; every table key is a clip or spell sheet of the page',
    Object.keys(S).every(p => (CL[p] && CL[p] !== 'idle' && CL[p] !== 'walk') || (FXP.has(p) && !CL[p])) && Object.keys(S).every(p => !PLATES.has(p)));
  { const one = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, S[Object.keys(S)[0]][0].split('?')[0])));
    const wrongFmt = Buffer.from(one); wrongFmt.writeUInt32LE(0x93B7, 28);   /* ASTC 8x8 */
    let r1 = '', r2 = ''; try { parse(wrongFmt); } catch (e) { r1 = e.message; } try { parse(one.subarray(0, one.length - 7)); } catch (e) { r2 = e.message; }
    ck('CONTROL: the page\'s parser refuses another ASTC block size (' + r1 + ') and a truncated file (' + r2 + ')', /not ASTC 4x4/.test(r1) && /bad level/.test(r2)); }

  // ------------------------------------------------------------------ 2. STATIC (phone)
  const ST = JSON.parse(run(`(()=>{ window.__texPhone=1; const per={}, dp={};
    const add=(k,st,u,fw,fh,cols,rows,fig,mip)=>{ const kk=texSheetK(fw,fh,cols,rows,fig), w=Math.max(1,Math.round(fw*kk))*cols, hh=Math.max(1,Math.round(fh*kk))*rows;
      const webp=w*hh*4*(mip?4/3:1)/1048576; return webp; };
    for(const k in BATTLE_ANIM){ if(!HERO_TYPES[k]||HERO_TYPES[k].monster) continue; for(const st in BATTLE_ANIM[k]){ const c=BATTLE_ANIM[k][st]; if(st[0]==='_'||!c||!c.u||!c.fw) continue;
      const m=add(k,st,c.u,c.fw,c.fh,c.cols||c.n,c.rows||1,(c.figH&&c.fh)?c.figH/c.fh:0,true), r={u:c.u.split('?')[0],m};
      if(/^death\\d*$/.test(st)){ (dp[k]=dp[k]||[])[st==='death'?0:+st.slice(5)-1]=r; continue; } (per[k]=per[k]||[]).push(r); } }
    const fx={}; try{ for(const k in BATTLE_ANIM){ if(!HERO_TYPES[k]||HERO_TYPES[k].monster) continue; fx[k]=Object.keys(FX2_DEF).filter(n=>n===k||n.indexOf(k+'_')===0).map(n=>{ const d=FX2_DEF[n]; if(!d.fw||!d.cols) return null;
      return {u:d.u.split('?')[0], m:add(k,'fx',d.u,d.fw,d.fh,d.cols,d.rows||1,0,false)}; }).filter(Boolean); } }catch(e){}
    window.__texPhone=null; return JSON.stringify({per,dp,fx}); })()`));
  const mbA = r => { const e = S[r.u]; return e ? e[4] / 1048576 : r.m; };   // the ASTC path: a compressed sheet's real bytes, else its WebP upload
  const heroMB = (k, f) => { let s = (ST.per[k] || []).reduce((a, r) => a + f(r), 0); const d = ST.dp[k] || []; let m = d[0] ? f(d[0]) : 0;
    for (let i = 0; i + 1 < d.length; i++) m = Math.max(m, f(d[i]) + f(d[i + 1])); return s + m + (ST.fx[k] || []).reduce((a, r) => a + f(r), 0); };
  const keys = Object.keys(ST.per), byW = keys.slice().sort((a, b) => heroMB(b, r => r.m) - heroMB(a, r => r.m)).slice(0, 10), byA = keys.slice().sort((a, b) => heroMB(b, mbA) - heroMB(a, mbA)).slice(0, 10);
  const wW = byW.reduce((a, k) => a + heroMB(k, r => r.m), 0), wA = byA.reduce((a, k) => a + heroMB(k, mbA), 0);
  const ui = byA.reduce((a, k) => a + (ST.per[k] || []).filter(r => !S[r.u]).reduce((q, r) => q + r.m, 0), 0);
  console.log('  info STATIC worst 5v5 (phone; every clip + spell sheets, deaths as their heaviest pair): WebP ' + wW.toFixed(0) + ' MB (' + byW.join(',') + ') -> ASTC ' + wA.toFixed(0) + ' MB (' + byA.join(',') + '), of which ' + ui.toFixed(0) + ' MB is the idle/walk sheets that stay WebP');
  ck('STATIC: the heaviest possible 5v5 on an ASTC phone (' + wA.toFixed(0) + ' MB) is under half of the WebP path (' + wW.toFixed(0) + ' MB) and under 1024 MB', wA < wW / 2 && wA <= 1024);

  // ------------------------------------------------------------------ 3. BROWSER
  let chromium = null; try { chromium = require('playwright').chromium; } catch (e) {}
  if (process.env.EW_NO_BROWSER) console.log('  info EW_NO_BROWSER: the browser half was skipped');
  else if (!chromium) ck('playwright is available for the browser half', false);
  else {
    const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
    const port = await freePort(), base = 'http://127.0.0.1:' + port;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-astc-'));
    const srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DB_FILE: path.join(tmp, 'db.json') }, stdio: 'ignore', windowsHide: true });
    const INIT = (fs.readFileSync(path.join(__dirname, 'test_memory_budget_1140.js'), 'utf8').match(/const INIT = `([\s\S]*?)`;/) || [])[1];
    const PHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block',
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36' };
    const DESK = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, serviceWorkers: 'block' };
    let browser;
    const open = async (opts, pre) => { const ctx = await browser.newContext(opts);
      await ctx.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
      if (INIT) await ctx.addInitScript(INIT); if (pre) await ctx.addInitScript(pre);
      const pg = await ctx.newPage(); const P = { ctx, pg, errs: [], req: [], all: [], warn: [] };
      pg.on('pageerror', e => P.errs.push(String(e.message))); pg.on('request', r => { const u = r.url().replace(base, ''); P.req.push(u); P.all.push(u); });
      pg.on('console', m => { const t = m.text(); if (/ASTC/.test(t)) P.warn.push(t); });
      await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2500);
      await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await pg.waitForTimeout(1200);
      await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'astc' + Date.now().toString(36) + (Math.random() * 1e4 | 0), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id;
        G.tutStarted = true; G.tutDone = true; document.body.classList.remove('gated'); show('home'); });
      await pg.waitForTimeout(600);
      await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Skip Tutorial/i.test(x.textContent) && x.offsetParent); if (b) b.click(); });
      return P; };
    /* a fight with the rAF loop held from the start: nothing moves until the test steps loop() on a synthetic 60 Hz clock */
    const start = async (P, seed, A, E, frozen) => { const pg = P.pg;
      await pg.evaluate(([A, E, seed]) => { try { A.concat(E).forEach(k => G.unlocked[k] = true); } catch (e) {} window.__raf0 = window.__raf0 || window.requestAnimationFrame; window.requestAnimationFrame = () => 0;
        G.team = A.slice(); CUR = { mode: 'arena', seed }; startVersus(E.map(k => ({ key: k, level: 30 })), true, A.slice()); }, [A, E, seed]);
      for (let i = 0; i < 400; i++) { if (await pg.evaluate(() => state === 'battle' && units.length >= 10 && units.every(u => u.mesh) && _LOADQ.done >= _LOADQ.n)) break; await pg.waitForTimeout(150); }
      await pg.evaluate((frozen) => { window.__t = 1e6; last = window.__t;
        if (frozen) { units.forEach(u => { u.greenCd = 999; u.blueCd = 999; u.energy = 0; u.maxHp = u.hp = 1e7; u.speed = 0; u.atkCd = 99; });
          const a = units.filter(u => u.team === 'ally'), e = units.filter(u => u.team === 'enemy');
          a.forEach((u, i) => { u.x = u._ax = 330 + (i % 2) * 190; u.y = u._ay = 330 + i * 260; }); e.forEach((u, i) => { u.x = u._ax = 1170 + (i % 2) * 190; u.y = u._ay = 330 + i * 260; }); } }, frozen);
      await pg.waitForTimeout(frozen ? 6000 : 300); };
    const step = (P, n) => P.pg.evaluate(n => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; loop(window.__t); } }, n);
    /* every unit drawn on a chosen cell of a chosen clip (deathCell = syncMesh's own UV / scale / anchor rule), every spell sheet of FXK on a fixed cell */
    const FORCE = `window.__force=function(spec, fxk, hide){ window.__fspec=spec; window.__hide=!!hide;
      if(!window.__r0){ window.__r0=renderer.render.bind(renderer); renderer.render=function(s,c){ try{ for(const f of (window.__fspec||[])){ const u=units.find(x=>x.key===f.k&&x.team===f.t); if(!u||!u.sprite) continue;
          const A=BATTLE_ANIM[f.k][f.st]; if(A&&A.tex&&A.tex.image&&A.tex.image.width){ deathCell(u,u.sprite,A,f.c,f.t==='enemy'?!A.flip:!!A.flip); u.sprite.material.opacity=1; u.sprite.material.color.setRGB(1,1,1); } }
          for(const u of units) if(u.mesh) u.mesh.visible=!window.__hide; for(const o of (window.__fxo||[])) o.visible=!window.__hide; }catch(e){} return window.__r0(s,c); }; }
      for(const o of (window.__fxo||[])) scene.remove(o); window.__fxo=[];
      (fxk||[]).forEach((f,i)=>{ const d=FX2_DEF[f.k], t=fx2Tex(f.k); const spr=new TH.Sprite(new TH.SpriteMaterial({map:t,transparent:true,depthWrite:false,depthTest:false})); spr.userData.sharedMap=true; fx2Hook(spr);
        const c=d.cols, r=d.rows||1, col=f.c%c, row=Math.floor(f.c/c); spr._uv=[1/c,1/r,col/c,1-(row+1)/r]; spr.renderOrder=5; spr.scale.set(f.s*d.fw/d.fh,f.s,1); spr.center.set(0.5,0.5);
        spr.position.set(wx(f.x),f.y,wz(f.yy)); scene.add(spr); window.__fxo.push(spr); }); };`;
    const shot = async (P, file) => { await step(P, 1); const b = await P.pg.screenshot({ type: 'png' }); if (file) fs.writeFileSync(file, b); return b; };
    const shotDir = OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'ew-astc-shot-'));
    const HER = (process.env.EW_ASTC_HEROES || 'hollow,kharos,sylthaine,aureth,vael,rivet').split(','), FXK = (process.env.EW_ASTC_FX || 'sylthaine_ult,mirelle_ult,kharos_blue').split(',');
    const fill = ['vex', 'vireo', 'astra', 'brannus'];
    const A3 = HER.slice(0, 3).concat(fill.slice(0, 2)), E3 = HER.slice(3, 6).concat(fill.slice(2, 4));
    const pickSt = k => { const set = JSON.parse(run(`JSON.stringify(Object.keys(BATTLE_ANIM['${k}']).filter(s=>s[0]!=='_'&&BATTLE_ANIM['${k}'][s].u&&!BATTLE_ANIM['${k}'][s].lazy))`));
      return ['ult', 'blue', 'green', 'attack', 'crit'].find(s => set.includes(s) && S[JSON.parse(run(`JSON.stringify(BATTLE_ANIM['${k}']['${s}'].u.split('?')[0])`))]) || 'attack'; };
    const SPEC = HER.map((k, i) => { const st = pickSt(k), n = JSON.parse(run(`BATTLE_ANIM['${k}']['${st}'].n`)); return { k, t: i < 3 ? 'ally' : 'enemy', st, c: Math.floor(n * 0.45) }; });
    const FXS = FXK.map((k, i) => ({ k, c: 20, s: 5.5, x: 560 + i * 300, y: 3.2, yy: 760 }));
    try {
      for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch (_) {} await new Promise(r => setTimeout(r, 200)); }
      browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--expose-gc'] });
      // ---- A: an ASTC phone
      const A = await open(PHONE, FORCE);
      const why = await A.pg.evaluate(() => { astcOn(); return [ASTC.why, ART_TIER]; });
      ck('a phone with WEBGL_compressed_texture_astc on WebGL2 takes the compressed path (' + why.join(', ') + ')', why[0] === 'on' && why[1] === 'phone', JSON.stringify(why));
      A.req.length = 0;
      await start(A, 11, A3, E3, true);
      const ld = await A.pg.evaluate((keys) => { const o = { comp: 0, webp: 0, bad: [], keep: 0 }; for (const k of keys) { const set = BATTLE_ANIM[k]; for (const st in set) { const c = set[st]; if (st[0] === '_' || !c || !c.tex || !c.tex.image) continue;
        const K = astcFile(c.u); if (K) { if (c.tex.isCompressedTexture && c.tex.image.width === K.W && c.tex.image.height === K.H && c.tex._astc > 0 && c.tex._freed) o.comp++; else o.bad.push(k + '.' + st); }
        else if (st === 'idle' || st === 'walk') o.keep++; else o.webp++; } } return o; }, A3.concat(E3));
      const ktz = A.req.filter(u => /\.ktz\?/.test(u)), webpOfTable = A.req.filter(u => /\.webp/.test(u) && S[u.split('?')[0]]);
      const tierOfTable = A.req.filter(u => /_p1141\.webp/.test(u));
      ck('the fight loads its compressed sheets (' + ld.comp + ' sheets from ' + ktz.length + ' .ktz requests) - on the GPU as ASTC at the table\'s size, their bytes dropped once uploaded; idle/walk (' + ld.keep + ') stay WebP',
        ld.comp > 40 && ld.bad.length === 0 && ld.keep >= 10 && ktz.length >= ld.comp, JSON.stringify(ld));
      ck('no WebP of a compressed sheet was fetched (originals ' + webpOfTable.length + ', phone tier files ' + tierOfTable.length + ')', webpOfTable.length === 0 && tierOfTable.length === 0, webpOfTable.concat(tierOfTable).slice(0, 4).join(', '));
      const tal = await A.pg.evaluate(() => { let comp = 0; const seen = new Set(); for (const k in BATTLE_ANIM) for (const st in BATTLE_ANIM[k]) { const c = BATTLE_ANIM[k][st]; if (st[0] !== '_' && c && c.tex && c.tex.isCompressedTexture && !seen.has(c.tex)) { seen.add(c.tex); comp += c.tex._astc; } }   /* one texture can serve two states (Aureth's attack = attackLight) */
        return { page: +texTallyMB().toFixed(1), test: +__gpuMB().toFixed(1), split: __gpuSplit(), comp: +(comp / 1048576).toFixed(1), on: _glTally.on }; });
      ck('the GPU tallies count compressed textures at their REAL bytes: the page\'s gate ' + tal.page + ' MB = this test\'s ' + tal.test + ' MB (within 1), its ' + tal.split.astcN + ' compressed uploads ' + tal.split.astcMB.toFixed(1) + ' MB >= the fight\'s compressed sheets ' + tal.comp + ' MB',
        tal.on && Math.abs(tal.page - tal.test) <= 1 && tal.split.astcMB + 0.5 >= tal.comp && tal.comp > 20, JSON.stringify(tal));
      // pixel check: the same frozen frame on both paths
      await A.pg.evaluate(([s, f]) => __force(s, f, false), [SPEC, FXS]);
      for (let i = 0; i < 60; i++) { if (await A.pg.evaluate(f => f.every(x => { const t = fx2Tex(x.k); return t && t.image && t.image.width; }), FXS)) break; await A.pg.waitForTimeout(200); }
      await step(A, 2); const aShot = await shot(A, path.join(shotDir, 'astc.png'));
      const fxComp = await A.pg.evaluate(f => f.map(x => !!fx2Tex(x.k).isCompressedTexture), FXS);
      // ---- B: the same phone, ASTC forced off (the WebP path, exactly as before)
      const B = await open(PHONE, FORCE + ';window.__noAstc=1;');
      const whyB = await B.pg.evaluate(() => { astcOn(); return ASTC.why; });
      B.req.length = 0;
      await start(B, 11, A3, E3, true);
      await B.pg.evaluate(([s, f]) => __force(s, f, false), [SPEC, FXS]);
      for (let i = 0; i < 60; i++) { if (await B.pg.evaluate(f => f.every(x => { const t = fx2Tex(x.k); return t && t.image && t.image.width; }), FXS)) break; await B.pg.waitForTimeout(200); }
      await step(B, 2); await shot(B, path.join(shotDir, 'webp.png'));
      await B.pg.evaluate(() => { window.__hide = true; }); await shot(B, path.join(shotDir, 'bg.png')); await B.pg.evaluate(() => { window.__hide = false; });
      const tB = await B.pg.evaluate(() => +__gpuMB().toFixed(1)), tA = tal.test;
      ck('FALLBACK forced off (' + whyB + '): no .ktz is requested and the same fight loads its WebP sheets; ' + tB + ' MB on the GPU there vs ' + tA + ' MB compressed',
        whyB === 'forced off' && !B.req.some(u => /\.ktz/.test(u)) && B.req.some(u => /_p1141\.webp|_attack|_ult/.test(u)) && tA < tB * 0.6, '');
      const cmp = JSON.parse(cp.execFileSync(PY, ['-I', path.join(__dirname, 'helpers', 'astc_cmp.py'), path.join(shotDir, 'webp.png'), path.join(shotDir, 'astc.png'), path.join(shotDir, 'bg.png')]).toString());
      ck('the SAME frozen battle frame (' + HER.length + ' heroes on a fixed cell + ' + FXK.length + ' spell sheets) drawn from the compressed sheets matches the WebP frame: PSNR ' + cmp.psnr + ' dB over the units (' + cmp.n + ' px), mean ' + cmp.mean + ' levels',
        cmp.n > 20000 && cmp.psnr >= 32 && cmp.mean <= 3 && fxComp.every(Boolean), JSON.stringify(cmp) + ' fx compressed ' + fxComp);
      { const c2 = JSON.parse(cp.execFileSync(PY, ['-I', path.join(__dirname, 'helpers', 'astc_cmp.py'), path.join(shotDir, 'webp.png'), path.join(shotDir, 'bg.png'), path.join(shotDir, 'bg.png')]).toString());
        ck('CONTROL: the same comparison against the frame with no units fails (PSNR ' + c2.psnr_all + ' dB over the whole frame)', c2.psnr_all < cmp.psnr_all - 6, JSON.stringify(c2)); }
      // ---- DISPLAY ONLY: an unfrozen seeded fight steps tick-identical on both paths
      /* the death test's rendered harness (test_death_state.js): the fight is rebuilt from tick 0 (seedBattle) with the ten heroes whose sheets this page
         already holds (compressed on A, WebP on B) and rendered one 60 fps frame at a time inside ONE synchronous evaluate (no page timer can interleave);
         the trace is per SIM TICK. The first-fight ult lesson and the action-stream ack wait are wall-clock gates, not part of this check. */
      const TRACE = (P, seed) => P.pg.evaluate(([A, E, seed]) => { window.__fspec = []; window.__upd0 = window.__upd0 || updateBattle; updateBattle = window.__upd0;
        clearBattle(); ended = false; paused = false; waveXfer = null; battleTime = 0; gameSpeed = 1; seedBattle(seed); last = window.__t;
        ultCoachArmed = () => false; ultCoachReset(); actHold = () => false; _actWait = 0;
        A.forEach((k, i) => units.push(makeUnit(k, 'ally', 300 + i * 40, 600 + i * 90, 30, { owned: false, rank: 3 }))); E.forEach((k, i) => units.push(makeUnit(k, 'enemy', 900 + i * 40, 600 + i * 90, 30, { owned: false, rank: 3 })));
        units.forEach(u => buildFigure(u));
        let comp = 0; units.forEach(u => { if (u.sprite && u.sprite.material.map && u.sprite.material.map.isCompressedTexture) comp++; });
        const tr = [], U = updateBattle; let drawnC = 0;
        updateBattle = function () { const r = U.apply(this, arguments);
          tr.push(battleTime.toFixed(3) + '/' + units.map(u => u.key + u.team[0] + ':' + Math.round(u.hp * 100) + ':' + Math.round(u.x * 10) + ':' + Math.round(u.y * 10) + ':' + (u.alive ? 1 : 0) + ':' + Math.round((u.energy || 0) * 10)).join('|')); return r; };
        for (let j = 0; j < 60 * 60 && !ended && tr.length < 900; j++) { window.__t += 1000 / 60; loop(window.__t); if (j % 30 === 0) units.forEach(u => { if (u.sprite && u.sprite.material.map && u.sprite.material.map.isCompressedTexture) drawnC++; }); }
        tr.length = Math.min(tr.length, 900); updateBattle = window.__upd0;
        let h = 2166136261 >>> 0; const s = tr.join('#'); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
        return { h: tr.length + ':' + h.toString(16), n: tr.length, drawnC, tr }; }, [A3, E3, seed]);
      const firstDiff = (a, b) => { const i = a.tr.findIndex((x, j) => x !== b.tr[j]); return i < 0 ? 'none' : 'tick ' + i + ': ' + a.tr[i].slice(0, 160) + ' vs ' + (b.tr[i] || '').slice(0, 160); };
      const ta = await TRACE(A, 23), ta2 = await TRACE(A, 23), tb = await TRACE(B, 23), tc = await TRACE(B, 24);
      ck('CONTROL: the rendered harness is deterministic (the same seed twice on the ASTC page gives the same trace)', ta.h === ta2.h, firstDiff(ta, ta2));
      ck('DISPLAY ONLY: a rendered seeded 5v5, drawn from the compressed sheets (' + ta.drawnC + ' unit-frames sampled on an ASTC texture), is tick-identical to the same fight drawn from WebP (hp / x / y / alive / energy after every one of ' + ta.n + ' sim ticks)',
        ta.h === tb.h && ta.n >= 300 && ta.drawnC > 50 && tb.drawnC === 0, ta.h + ' vs ' + tb.h + ' ' + firstDiff(ta, tb));
      ck('CONTROL: the same fight on another seed is not identical', tc.h !== tb.h);
      // ---- a death streams compressed (Hollow: 12 sheets of 4 cells)
      /* to the hub the way a player goes there - the real game loop running again (its first frame off the battlefield frees the spell sheets) */
      await A.pg.evaluate(() => { try { endBattle(true); } catch (e) {} window.requestAnimationFrame = window.__raf0; requestAnimationFrame(loop); }); await A.pg.waitForTimeout(1200);
      await A.pg.evaluate(() => { try { document.getElementById('resultBtn').click(); } catch (e) {} }); await A.pg.waitForTimeout(800);
      await A.pg.evaluate(() => show('home')); await A.pg.waitForTimeout(2500);
      const hub = await A.pg.evaluate(() => { let held = 0, comp = 0; const names = []; for (const k in BATTLE_ANIM) for (const st in BATTLE_ANIM[k]) { const c = BATTLE_ANIM[k][st]; if (st[0] !== '_' && c && c.tex) { held++; names.push(k + '.' + st + (c.tex._freed ? ':freed' : '') + (c.tex._ewFreed ? ':ew' : '') + (c.lazy ? ':lazy' : '')); if (c.tex.isCompressedTexture) comp++; } } return { held, names, comp, split: __gpuSplit(), dims: __gpuList().slice(0, 40), fx: Object.keys(_fx2Tex) }; });
      ck('back on the hub every compressed sheet is freed (' + hub.held + ' sheets held, ' + hub.split.astcN + ' compressed textures on the GPU)', hub.held === 0 && hub.split.astcN === 0, JSON.stringify(hub));
      A.req.length = 0;
      await start(A, 31, ['hollow', 'vex', 'vireo', 'astra', 'brannus'], ['vael', 'kharos', 'rivet', 'aureth', 'tharl'], true);
      const dr = await A.pg.evaluate(() => { const u = units.find(x => x.key === 'hollow' && x.team === 'ally'); window.__dying = u; u.hp = u.maxHp * 0.2; return BATTLE_ANIM.hollow.death.parts.length; });
      for (let i = 0; i < 200; i++) { await step(A, 1); if (await A.pg.evaluate(() => deathReady({ anim: BATTLE_ANIM.hollow }))) break; await A.pg.waitForTimeout(50); }
      await step(A, 20);
      const d0 = await A.pg.evaluate(() => BATTLE_ANIM.hollow.death.parts.map(st => { const t = BATTLE_ANIM.hollow[st].tex; return t ? (t.isCompressedTexture ? 'C' : 'W') : '-'; }).join(''));
      const dk = new Set(A.all.filter(u => /hollow_death\d*_1190_a[0-9a-f]{8}\.ktz/.test(u))).size, dw = A.all.filter(u => /hollow_death\d*_1190\.webp/.test(u)).length;   /* over the whole session (the traced fights may have fetched them first) */
      await A.pg.evaluate(() => { const u = window.__dying; damage(u, u.maxHp * 100, 0xffffff, true); });
      let maxHeld = 0, played = 0, comp = true;
      for (let i = 0; i < 60 * 7; i++) { const r = await A.pg.evaluate(() => { window.__t += 1000 / 60; loop(window.__t); const u = window.__dying, set = BATTLE_ANIM.hollow, ps = set.death.parts;
          const held = ps.filter(st => set[st].tex).length, on = ps.map(st => set[st]).find(c => c.tex && u.sprite && u.sprite.material.map === c.tex);
          return { held, d: !!u._die, cell: on ? on.first : -1, comp: on ? !!on.tex.isCompressedTexture : null }; });
        maxHeld = Math.max(maxHeld, r.held); if (r.cell >= 0) { played = Math.max(played, r.cell); if (r.comp === false) comp = false; } }
      ck('a death STREAMS compressed: under 30% hp only Hollow\'s first sheet is on the GPU, as ASTC (' + d0 + '), all ' + dr + ' sheets fetched as .ktz, never as WebP (' + dk + ' distinct .ktz, WebP ' + dw + '); while it plays at most ' + maxHeld + ' sheets are held, every one drawn compressed, through its last sheet (cell ' + played + ')',
        d0 === 'C' + '-'.repeat(dr - 1) && dk === dr && dw === 0 && maxHeld <= 2 && comp && played >= 44, JSON.stringify({ d0, dk, dw, maxHeld, played, comp }));
      ck('no page error on the ASTC path, no ASTC warning (' + A.warn.filter(w => /failed/.test(w)).length + ')', A.errs.length === 0 && !A.warn.some(w => /failed/.test(w)), A.errs.concat(A.warn).slice(0, 4).join(' | '));
      ck('no page error on the forced-off path', B.errs.length === 0, B.errs.slice(0, 3).join(' | '));
      await A.ctx.close(); await B.ctx.close();
      // ---- C: a phone whose GPU has no ASTC (the extension hidden)
      const C = await open(PHONE, `(()=>{ for(const P of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]){ const g=P.getExtension, s=P.getSupportedExtensions;
          P.getExtension=function(n){ return /astc/i.test(n)?null:g.apply(this,arguments); }; P.getSupportedExtensions=function(){ return (s.apply(this,arguments)||[]).filter(n=>!/astc/i.test(n)); }; } })();`);
      const whyC = await C.pg.evaluate(() => { astcOn(); return ASTC.why; }); C.req.length = 0;
      await start(C, 11, A3, E3, true);
      const cl = await C.pg.evaluate((keys) => { let w = 0, c = 0; for (const k of keys) for (const st in BATTLE_ANIM[k]) { const x = BATTLE_ANIM[k][st]; if (st[0] !== '_' && x && x.tex && x.tex.image && x.tex.image.width) { if (x.tex.isCompressedTexture) c++; else w++; } } return { w, c }; }, A3.concat(E3));
      ck('FALLBACK no ASTC on the GPU (' + whyC + '): every sheet loads as WebP (' + cl.w + ' sheets, ' + cl.c + ' compressed), no .ktz requested, no page error', whyC === 'no WEBGL_compressed_texture_astc' && cl.c === 0 && cl.w > 40 && !C.req.some(u => /\.ktz/.test(u)) && C.errs.length === 0, JSON.stringify(cl) + C.errs.slice(0, 2).join('|'));
      await C.ctx.close();
      // ---- E: a corrupt .ktz for one hero: that sheet falls back to WebP, the fight goes on
      const E = await open(PHONE);
      await E.ctx.route(/kharos_[A-Za-z]+_1175_a[0-9a-f]{8}\.ktz/, r => r.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.from('this is not a texture') }));
      E.req.length = 0; await start(E, 11, A3, E3, true);
      const ce = await E.pg.evaluate(() => { const o = { w: 0, c: 0, other: 0 }; for (const st in BATTLE_ANIM.kharos) { const x = BATTLE_ANIM.kharos[st]; if (st[0] === '_' || !x || !x.tex || !/_1175\./.test(x.u)) continue;
        if (x.tex.isCompressedTexture) o.c++; else if (x.tex.image && x.tex.image.width && (st === 'idle' || st === 'walk' || x._astcFail)) o.w++; else o.other++; }
        o.vael = Object.keys(BATTLE_ANIM.vael).filter(st => { const x = BATTLE_ANIM.vael[st]; return st[0] !== '_' && x && x.tex && x.tex.isCompressedTexture; }).length; return o; });
      ck('FALLBACK a corrupt .ktz: Kharos\'s sheets warn and load their WebP (' + ce.w + ' WebP, ' + ce.c + ' compressed, ' + ce.other + ' missing) while everyone else stays compressed (Vael ' + ce.vael + '), no page error',
        ce.w >= 4 && ce.c === 0 && ce.other === 0 && ce.vael >= 3 && E.warn.some(w => /ASTC sheet failed/.test(w)) && E.errs.length === 0, JSON.stringify(ce) + E.errs.slice(0, 2).join('|'));
      await E.ctx.close();
      // ---- D: a desktop (high tier): WebP exactly as before
      const D = await open(DESK); const whyD = await D.pg.evaluate(() => { astcOn(); return [ASTC.why, ART_TIER]; }); D.req.length = 0;
      await start(D, 11, A3, E3, true);
      ck('a desktop (' + whyD.join(', ') + ') never asks for a .ktz', whyD[0] === 'not the phone tier' && !D.req.some(u => /\.ktz/.test(u)) && D.req.some(u => /\.webp/.test(u)) && D.errs.length === 0, D.errs.slice(0, 2).join('|'));
      await D.ctx.close();
    } finally { try { await browser.close(); } catch (e) {} try { srv.kill(); } catch (e) {} }
  }
} catch (e) { ck('test ran', false, e && e.stack); }
console.log('test_astc_textures: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
})();
