'use strict';
// v1140 MEMORY BUDGET GUARD (Phil 15 Oct 2026, pre-beta day: his Android Chrome tab crashed "Aw, Snap!" during a fight and as one ended -
// "We cant have this happening"). Measured cause (blueprint 18 "Battle memory budget"): every battle sheet uploaded at full size, the
// decoded ImageBitmaps kept for the whole session (_texReg), the squad's sheets kept on the hub, and a fight's decoded sounds piling up.
// This test makes sure no release can bring that back:
//   1. FILES: no battle sheet file (BATTLE_ANIM + FX2_DEF) is over 2048 px per side or over 4 MB unless it is one of the frozen
//      pre-v1140 files in tests/fixtures/sheet_size_baseline_1140.json (a ratchet - the list may only shrink). CONTROL: a 2100 px sheet fails.
//   2. LOADER: on a phone every sheet uploads within 2048 px per side, except where that would put the figure under 160 px (then up to
//      4096, never more); desktop loads every sheet exactly as before (k = 1). CONTROL: the policy switched off fails.
//   3. BUDGET (static): the heaviest possible 5v5 (the 10 heroes with the most battle art, every clip, mipmapped) fits GPU_BUDGET_MB on a
//      phone; the 10 heroes with the most sound + the 12 weapon sounds decode within AUDIO_BUDGET_MB (48 kHz float, channels from the manifest).
//   4. BROWSER: a phone (844x390, Android UA) plays 5 fights of the heaviest heroes (real loader + GPU warm-up) and goes home after each;
//      every WebGL texture upload is tallied. Peak GPU <= GPU_BUDGET_MB, decoded bitmaps held <= BMP_BUDGET_MB, and back on the hub after
//      EVERY fight: battle textures and bitmaps back to the start (<= 64 MB / 16 MB), hero sounds released (only the weapon sounds left).
//      CONTROL: the same loop on BASE (v1139, before the fix) breaks the budget and keeps its bitmaps after the fight.
(async function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), os = require('os'), net = require('net');
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || 'd36a9beb';   // live v1139, the release before the memory hotfix
/* THE BUDGET (blueprint 18 "Battle memory budget"). GPU 2048 MB = the WORST POSSIBLE fight (the 10 heroes with the most art on one field,
   every clip + spell sheets) under the phone rule, measured 1.95 GB; a normal 5v5 measures ~1.6-1.75 GB. Before v1140 the same fight was
   6.5 GB of textures + 4.4 GB of decoded bitmaps and grew every fight - the "Aw, Snap!". A tighter number (e.g. 350 MB) would need ~1000 px
   sheets, i.e. figures under the 140-180 px a phone draws them at: every hero blurry on every phone (rule 22). Bitmaps 400 MB = the idle +
   walk sheets the loader cards / Emberdraft paint from (measured 294). Audio 48 MB = the 10 heroes with the most sound + the 12 weapon
   sounds, decoded at 48 kHz float (43.3 MB; a normal 5v5 ~25 MB). Raise a number only with Phil's OK and the blueprint.
   v1165 AUDIO 48 -> 72 MB with Phil's OK (16 Oct 2026, "Yes lets do it, full effects will sound cleaner"): every ability sound rides out to
   its natural end with the sparkle tail, and every weapon type has 6 takes + the 6 melee shimmers - measured below (the heaviest-sound 5v5
   + the whole weapon library). Audio is separate from the 2048 MB GPU budget behind the v1137 crash (textures + bitmaps, unchanged). */
const GPU_BUDGET_MB = 2048, BMP_BUDGET_MB = 400, AUDIO_BUDGET_MB = 72, AUDIO_BUDGET_OLD_MB = 48, SHEET_MAX = 2048, FILE_MAX = 4e6;
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
const webpSize = f => { const b = Buffer.alloc(30); const fd = fs.openSync(f, 'r'); fs.readSync(fd, b, 0, 30, 0); fs.closeSync(fd);
  const tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  return null; };
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML);
const CLIPS = JSON.parse(run(`JSON.stringify([].concat(...Object.keys(BATTLE_ANIM).map(k=>Object.keys(BATTLE_ANIM[k]).filter(s=>s[0]!=='_'&&BATTLE_ANIM[k][s]&&BATTLE_ANIM[k][s].u).map(s=>{ const c=BATTLE_ANIM[k][s];
  return {k,s,u:c.u,fw:c.fw,fh:c.fh,cols:c.cols||c.n,rows:c.rows||1,figH:c.figH,lazy:!!c.lazy,hero:!!(HERO_TYPES[k]&&!HERO_TYPES[k].monster)}; }))))`));
const FX = JSON.parse(run(`JSON.stringify(Object.keys(FX2_DEF).map(k=>({k,u:FX2_DEF[k].u,fw:FX2_DEF[k].fw,fh:FX2_DEF[k].fh,cols:FX2_DEF[k].cols,rows:FX2_DEF[k].rows||1})))`));
try {
  // ------------------------------------------------------------------ 1. FILES (ratchet)
  const BASEL = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/sheet_size_baseline_1140.json'), 'utf8'));
  const frozen = new Set(BASEL.files);
  /* v1141: an oversize original that has a PHONE tier file (assets/anim/tiers_1141.json "p") is never loaded by a phone - the phone loads
     its tier file, which tests/test_condense_1141.js holds to this same rule. Such an original is desktop-only and LEAVES the frozen list. */
  const TIERS = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/anim/tiers_1141.json'), 'utf8')).sheets; } catch (e) { return {}; } })();
  const phoneTiered = new Set(Object.keys(TIERS).filter(p => TIERS[p] && TIERS[p].p));
  /* v1155 animation slim: a sheet cut losslessly from a frozen sheet (fewer cells, same cell size) may stay oversize only WITHIN its parent -
     each side <= the parent sheet and bytes <= the parent file (fixture derived_1155: the parent's numbers are recorded, so the parent file
     can leave the repo). It is not a new oversize sheet: it is a strict subset of one that was already frozen. */
  const derived = new Map((BASEL.derived_1155 || []).map(d => [d.file, d]));
  const derivedOk = (u, d, by) => { const D = derived.get(u); return !!D && d[0] <= D.w && d[1] <= D.h && by <= D.bytes; };
  const files = [...new Set(CLIPS.concat(FX).map(c => c.u).filter(u => /^\/assets\//.test(u)).map(u => u.split('?')[0]))];
  const sheetProblems = (list, fz) => list.map(u => { const f = path.join(ROOT, u); if (!fs.existsSync(f)) return null; const d = webpSize(f) || [0, 0], by = fs.statSync(f).size;
    return (Math.max(d[0], d[1]) > SHEET_MAX || by > FILE_MAX) && !fz.has(u) && !phoneTiered.has(u) && !derivedOk(u, d, by) ? u + ' ' + d.join('x') + ' ' + (by / 1e6).toFixed(1) + ' MB' : null; }).filter(Boolean);
  const bad = sheetProblems(files, frozen);
  ck('no battle sheet file outside the frozen pre-v1140 list is over ' + SHEET_MAX + ' px per side or ' + FILE_MAX / 1e6 + ' MB (' + files.length + ' files, ' + frozen.size + ' frozen)', bad.length === 0, bad.slice(0, 6).join('; '));
  ck('the v1140 re-cuts (Maren / Orryn / Sylthaine v1137 sheets) are within 2048 px and not frozen', CLIPS.filter(c => /_1140\.webp/.test(c.u)).length === 9 - require('./helpers/anim-slim-1155.js').SLIM_1155.changes.filter(c => c.before && !c.after && /_1140\.webp/.test(c.before.u)).length &&   /* v1155: Sylthaine's filler passive left the page */
    CLIPS.filter(c => /_1140\.webp/.test(c.u)).every(c => { const d = webpSize(path.join(ROOT, c.u.split('?')[0])); return d && Math.max(...d) <= SHEET_MAX && !frozen.has(c.u.split('?')[0]); }));
  ck('the frozen list only shrinks: every frozen file still exists and is still oversize (a fixed file must leave the list)', BASEL.files.every(u => { const f = path.join(ROOT, u);
    if (!fs.existsSync(f)) return false; const d = webpSize(f) || [0, 0]; return Math.max(...d) > SHEET_MAX || fs.statSync(f).size > FILE_MAX; }));
  ck('v1141: an original with a phone tier file is not on the frozen list (' + phoneTiered.size + ' phone-tiered, ' + BASEL.files.length + ' still frozen)', BASEL.files.every(u => !phoneTiered.has(u)) && BASEL.files.length <= 654);
  { const tmp = path.join(ROOT, 'assets/anim/.memtest-' + process.pid + '.webp'); cp.execFileSync(process.env.PYTHON || 'python', ['-I', '-c',
      'import sys; from PIL import Image; Image.new("RGBA",(2100,64),(0,0,0,0)).save(sys.argv[1],"WEBP",lossless=True)', tmp]);
    try { ck('CONTROL: a new 2100 px sheet fails the file check', sheetProblems(['/assets/anim/' + path.basename(tmp)], frozen).length === 1);
      /* v1155: a derived entry that grows past its parent (here: a parent cap of 2099 px wide, the 2100 px file) fails too */
      const tu = '/assets/anim/' + path.basename(tmp); derived.set(tu, { file: tu, w: 2099, h: 64, bytes: 1e9 });
      ck('CONTROL (v1155): a derived sheet wider than its frozen parent fails the file check', sheetProblems([tu], frozen).length === 1);
      derived.set(tu, { file: tu, w: 2100, h: 64, bytes: 1e9 }); ck('CONTROL (v1155): the same sheet within its parent passes', sheetProblems([tu], frozen).length === 0); derived.delete(tu);
    } finally { try { fs.unlinkSync(tmp); } catch (e) {} } }
  ck('v1155 ratchet: the frozen list never grows (<= the 638 files of v1140) and every derived_1155 entry is in use, within its parent and its parent left the frozen list',
    BASEL.files.length <= 638 && [...derived.values()].every(D => files.includes(D.file) && !frozen.has(D.from) && !files.includes(D.from)));

  // ------------------------------------------------------------------ 2. LOADER POLICY
  const K = (phone, list) => JSON.parse(run(`(()=>{ window.__texPhone=${phone}; try{ return JSON.stringify(${JSON.stringify(list)}.map(c=>texSheetK(c.fw,c.fh,c.cols,c.rows,(c.figH&&c.fh)?c.figH/c.fh:0))); } finally{ window.__texPhone=null; } })()`));
  const all = CLIPS.filter(c => c.fw && c.fh).concat(FX.filter(c => c.fw && c.fh));
  const kp = K(1, all), kd = K(0, all);
  const up = all.map((c, i) => { const k = kp[i]; return { c, k, w: Math.max(1, Math.round(c.fw * k)) * c.cols, h: Math.max(1, Math.round(c.fh * k)) * c.rows, fig: c.figH ? c.figH * k : 0 }; });
  const floorWins = c => !!c.figH && c.figH * Math.min(1, SHEET_MAX / Math.max(c.fw * c.cols, c.fh * c.rows)) < 160;   // the 2048 cut would put the figure under 160 px
  const over = up.filter(x => Math.max(x.w, x.h) > SHEET_MAX + 8 && !floorWins(x.c));
  ck('phone: every sheet uploads within ' + SHEET_MAX + ' px per side unless the figure would fall under 160 px (' + all.length + ' sheets, ' + up.filter(x => Math.max(x.w, x.h) > SHEET_MAX + 8).length + ' floor exceptions)', over.length === 0, over.slice(0, 4).map(x => x.c.k + '.' + (x.c.s || 'fx') + ' ' + x.w + 'x' + x.h).join('; '));
  ck('phone: nothing uploads over 4096 px per side, and no figure is cut under 160 px (or its own size)', up.every(x => Math.max(x.w, x.h) <= 4096 + 8) && up.every(x => !x.c.figH || x.fig >= Math.min(159.5, x.c.figH) || Math.max(x.c.fw * x.c.cols, x.c.fh * x.c.rows) * x.k >= 4095));
  ck('desktop: every sheet loads exactly as before (k = 1)', kd.every(k => k === 1));
  ck('CONTROL: with the phone policy off, the 2048 check fails', all.filter(c => Math.max(c.fw * c.cols, c.fh * c.rows) > SHEET_MAX + 8).length > 100);

  // ------------------------------------------------------------------ 3. STATIC BUDGET
  const mb = x => x.w * x.h * 4 * 4 / 3 / 1048576;
  const per = {}; up.forEach(x => { if (!x.c.s || !x.c.hero) return; per[x.c.k] = (per[x.c.k] || 0) + mb(x); });
  const heavy = Object.keys(per).sort((a, b) => per[b] - per[a]);
  const top10 = heavy.slice(0, 10), gpuStatic = top10.reduce((s, k) => s + per[k], 0);
  console.log('  info heaviest 10 heroes (phone, every clip incl. lazy): ' + top10.map(k => k + ' ' + per[k].toFixed(0)).join(', ') + ' = ' + gpuStatic.toFixed(0) + ' MB');
  ck('BUDGET: the heaviest possible 5v5 on a phone (every clip of the 10 heaviest heroes, mipmapped) <= ' + GPU_BUDGET_MB + ' MB of GPU textures', gpuStatic <= GPU_BUDGET_MB, gpuStatic.toFixed(0));
  const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/sfx/sfx_manifest.json'), 'utf8'));
  const SD = JSON.parse(run('JSON.stringify(SFX_DATA)'));
  const dec = n => { const F = MAN.files[n]; return F ? Math.ceil(F.dur * 48000) * (F.ch || 2) * 4 : 0; };
  const sndPer = {}; for (const k in SD.heroes) { const H = SD.heroes[k], s = new Set(); ['green', 'blue', 'ult', 'passive'].forEach(sl => (H[sl] || []).forEach(r => r.f.forEach(n => s.add(n))));
    sndPer[k] = [...s].filter(n => !/^LIB-/.test(n)).reduce((a, n) => a + dec(n), 0); }
  const lib = Object.keys(MAN.files).filter(n => /^LIB-/.test(n)).reduce((a, n) => a + dec(n), 0);   /* v1165: the whole weapon library - 6 takes per type + the 6 shimmers (all decoded on the first tap) */
  const sTop = Object.keys(sndPer).sort((a, b) => sndPer[b] - sndPer[a]).slice(0, 10), audio = (sTop.reduce((a, k) => a + sndPer[k], 0) + lib) / 1048576;
  console.log('  info heaviest-sound 5v5: ' + sTop.join(',') + ' + the weapon library (' + Object.keys(MAN.files).filter(n => /^LIB-/.test(n)).length + ' files, ' + (lib / 1048576).toFixed(1) + ' MB) = ' + audio.toFixed(1) + ' MB decoded (48 kHz float)');
  ck('BUDGET: the heaviest-sound 5v5 decodes within ' + AUDIO_BUDGET_MB + ' MB (v1165, Phil 16 Oct: "full effects will sound cleaner")', audio <= AUDIO_BUDGET_MB, audio.toFixed(1));
  { /* CONTROL: the same sum with one more hero's worth of sound - an over-budget set must fail the check;
       and the v1165 sounds really needed the raise (they do not fit the old 48 MB) */
    const over = audio + 2.5 * sndPer[sTop[0]] / 1048576;
    ck('CONTROL: the heaviest-sound 5v5 with 2.5 more copies of its heaviest hero (' + over.toFixed(1) + ' MB) fails the ' + AUDIO_BUDGET_MB + ' MB check', !(over <= AUDIO_BUDGET_MB));
    ck('CONTROL: the v1165 set does not fit the old ' + AUDIO_BUDGET_OLD_MB + ' MB (' + audio.toFixed(1) + ' MB) - the raise was needed, the check measures the new files', audio > AUDIO_BUDGET_OLD_MB); }
  const relSrc = run('String(sfxRelease)'), evSrc = run('String(evictUnusedArt)');
  ck('disposal is wired: evictUnusedArt closes the bitmaps, leaves _texReg and releases the fight sounds; the hub frees every battle sheet',
    /texImgFree/.test(evSrc) && /_texReg\.splice/.test(evSrc) && /sfxRelease/.test(evSrc) && /\^LIB-/.test(relSrc) && /name==='home'\) setTimeout\(\(\)=>\{ try\{ evictBattleArtAll/.test(fs.readFileSync(HTML, 'utf8')));

  // ------------------------------------------------------------------ 4. BROWSER (real loader, real GPU uploads)
  let chromium = null; try { chromium = require('playwright').chromium; } catch (e) {}
  if (!chromium) { ck('playwright is available for the browser half', false); }
  else {
    const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
    const port = await freePort(), base = 'http://127.0.0.1:' + port;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-mem-'));
    const srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DB_FILE: path.join(tmp, 'db.json') }, stdio: 'ignore', windowsHide: true });
    let browser;
    const baseHtml = cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
    const INIT = `(()=>{ const T=new Map();
      for(const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]){ if(!C) continue; const P=C.prototype;
        const bind=P.bindTexture; P.bindTexture=function(t,x){ if(t===this.TEXTURE_2D) this.__b=x; return bind.apply(this,arguments); };
        const ti=P.texImage2D; P.texImage2D=function(target,level){ const r=ti.apply(this,arguments); try{ if(level===0&&target===this.TEXTURE_2D&&this.__b){ const a=[].slice.call(arguments,2); let w,h;
          if(typeof a[1]==='number'&&a.length>=6){ w=a[1]; h=a[2]; } else { const s=a[a.length-1]; w=s&&(s.width||s.videoWidth||0); h=s&&(s.height||s.videoHeight||0); } T.set(this.__b,{w,h,mip:false}); } }catch(e){} return r; };
        const gm=P.generateMipmap; P.generateMipmap=function(t){ const r=gm.apply(this,arguments); const o=T.get(this.__b); if(o) o.mip=true; return r; };
        const dt=P.deleteTexture; P.deleteTexture=function(x){ T.delete(x); return dt.apply(this,arguments); }; }
      window.__gpuMB=()=>{ let b=0; for(const v of T.values()) b+=(v.w||0)*(v.h||0)*4*(v.mip?4/3:1); return b/1048576; };
      const BM=new Set(), fr=new FinalizationRegistry(k=>BM.delete(k)); const cib=window.createImageBitmap;
      window.createImageBitmap=function(){ return cib.apply(this,arguments).then(bm=>{ const k={w:bm.width,h:bm.height}; BM.add(k); bm.__k=k; fr.register(bm,k); return bm; }); };
      const cl=ImageBitmap.prototype.close; ImageBitmap.prototype.close=function(){ if(this.__k) BM.delete(this.__k); return cl.apply(this,arguments); };
      window.__bmpMB=()=>{ let b=0; for(const k of BM) b+=k.w*k.h*4; return b/1048576; }; })();`;
    const loop = async (label, html, fights) => {
      const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36' });
      await ctx.addInitScript(INIT);
      if (html) {   // BASE: its page AND its build stamp (with the newer version.json the old page would update itself to the new one)
        const ver = cp.execSync('git show ' + BASE_SHA + ':version.json', { cwd: ROOT }).toString();
        await ctx.route(u => /\/play(\?|$)/.test(new URL(u).pathname + new URL(u).search.slice(0, 1)), r => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
        await ctx.route('**/version.json*', r => r.fulfill({ status: 200, contentType: 'application/json', body: ver })); }
      const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message)));
      await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2500);
      await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await pg.waitForTimeout(1200);
      await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'mem' + Date.now().toString(36), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id;
        G.tutStarted = true; G.tutDone = true; document.body.classList.remove('gated'); show('home'); });
      await pg.waitForTimeout(600);
      await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Skip Tutorial/i.test(x.textContent) && x.offsetParent); if (b) b.click(); });
      const gc = () => pg.evaluate(() => { try { gc(); } catch (e) {} });
      const sample = async () => { await gc(); await pg.waitForTimeout(250); await gc(); return pg.evaluate(() => {
        let hero = 0; try { const lib = /\/LIB-/; for (const f in SND.buf) if (SND.buf[f] && !lib.test(f)) hero++; } catch (e) {}
        let held = 0; for (const k in BATTLE_ANIM) { const s = BATTLE_ANIM[k]; for (const st in s) if (st[0] !== '_' && s[st] && s[st].tex) held++; }
        return { gpu: +__gpuMB().toFixed(1), bmp: +__bmpMB().toFixed(1), heroSnd: hero, held, reg: _texReg.length }; }); };
      const isNew = await pg.evaluate(() => typeof texSheetK === 'function');
      if (!!html === isNew) { const e = new Error('the ' + label + ' page did not load (texSheetK ' + isNew + ')'); e.notCrash = true; throw e; }
      const s0 = await sample(); const rows = [];
      const ORDER = heavy.slice(0, 10);
      for (let f = 0; f < fights; f++) {
        const A = f % 2 ? ORDER.slice(5, 10) : ORDER.slice(0, 5), F = f % 2 ? ORDER.slice(0, 5) : ORDER.slice(5, 10);
        await pg.evaluate(({ A, F, f }) => { G.team = A.slice(); CUR = { mode: 'arena', seed: 100 + f }; startVersus(F.map(k => ({ key: k, level: 1, rank: 3 })), true, A); }, { A, F, f });
        for (let i = 0; i < 240; i++) { if (await pg.evaluate(() => state === 'battle' && units.length > 0)) break; await pg.waitForTimeout(250); }
        // fake decoded hero sounds (headless Chromium cannot decode AAC): every fighter's files "decoded", so the release is visible
        await pg.evaluate(() => { try { units.forEach(u => { const H = SFX_DATA.heroes[u.key]; if (H) sfxFiles(H).forEach(n => { const F = SFX_DATA.files[n]; if (F && !(SND.buf[F[0]])) SND.buf[F[0]] = { length: 48000, numberOfChannels: 1, duration: 1 }; }); }); } catch (e) {} });
        await pg.waitForTimeout(3500);
        const mid = await sample();
        await pg.evaluate(() => { if (!ended) endBattle(true); });
        for (let i = 0; i < 40; i++) { if (await pg.evaluate(() => state === 'result')) break; await pg.waitForTimeout(250); }
        const vic = await sample();
        await pg.evaluate(() => document.getElementById('resultBtn').click()); await pg.waitForTimeout(500);
        await pg.evaluate(() => show('home')); await pg.waitForTimeout(1500);
        const hub = await sample();
        rows.push({ mid, vic, hub }); console.log('  info ' + label + ' fight ' + (f + 1) + ': battle gpu ' + mid.gpu + ' MB bitmaps ' + mid.bmp + ' MB | victory gpu ' + vic.gpu + ' | hub gpu ' + hub.gpu + ' MB bitmaps ' + hub.bmp + ' MB, hero sounds ' + hub.heroSnd + ', sheets held ' + hub.held + ', _texReg ' + hub.reg);
      }
      await ctx.close(); return { s0, rows, errs };
    };
    try {
      for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch (_) {} await new Promise(r => setTimeout(r, 150)); }
      try { browser = await chromium.launch({ args: ['--mute-audio', '--js-flags=--expose-gc'] }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--js-flags=--expose-gc'] }); }
      const N = await loop('v1140', null, 5);
      const peakG = Math.max(...N.rows.map(r => Math.max(r.mid.gpu, r.vic.gpu))), peakB = Math.max(...N.rows.map(r => Math.max(r.mid.bmp, r.vic.bmp)));
      ck('5 fights of the 10 heaviest heroes really loaded their art (peak GPU ' + peakG + ' MB > 300)', peakG > 300);
      ck('BUDGET: peak GPU textures in a fight and on the victory screen <= ' + GPU_BUDGET_MB + ' MB (' + peakG + ')', peakG <= GPU_BUDGET_MB);
      ck('BUDGET: decoded bitmaps held in a fight <= ' + BMP_BUDGET_MB + ' MB (' + peakB + ') - a sheet\'s copy is freed once it is on the GPU', peakB <= BMP_BUDGET_MB);
      ck('back on the hub after EVERY fight the battle textures are back to the start (<= start + 64 MB)', N.rows.every(r => r.hub.gpu <= N.s0.gpu + 64), N.rows.map(r => r.hub.gpu).join(','));
      ck('back on the hub after EVERY fight the decoded bitmaps are gone (<= 16 MB) and no battle sheet is held', N.rows.every(r => r.hub.bmp <= 16 && r.hub.held === 0), N.rows.map(r => r.hub.bmp + '/' + r.hub.held).join(','));
      ck('the fight sounds are released after every fight (only the weapon library stays decoded: the takes + shimmers)', N.rows.every(r => r.mid.heroSnd > 0 && r.hub.heroSnd === 0), N.rows.map(r => r.mid.heroSnd + '->' + r.hub.heroSnd).join(','));
      ck('memory does not grow over 5 fights (fight 5 within 15% of fight 1 in a fight; _texReg bounded)', N.rows[4].mid.gpu <= N.rows[0].mid.gpu * 1.15 + 32 && N.rows[4].hub.reg <= 40, N.rows[0].mid.gpu + ' -> ' + N.rows[4].mid.gpu + ', reg ' + N.rows[4].hub.reg);
      ck('no page error in the 5 fights', N.errs.length === 0, N.errs.slice(0, 3).join(' | '));
      /* the BASE page can run the rig's browser out of memory (the very crash this test guards): a crash of its page counts as BASE breaking the budget */
      let B = null, bCrash = '';
      try { await browser.close(); } catch (e) {}
      try { browser = await chromium.launch({ args: ['--mute-audio', '--js-flags=--expose-gc'] }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--js-flags=--expose-gc'] }); }
      try { B = await loop('BASE ' + BASE_SHA, baseHtml, 2); } catch (e) { if (e && e.notCrash) { ck(e.message, false); } else { bCrash = String(e && e.message || e).slice(0, 80); console.log('  info BASE page crashed: ' + bCrash); } }
      const bPeak = B ? Math.max(...B.rows.map(r => r.mid.gpu)) : 0;
      ck('CONTROL: BASE (before the fix) breaks the budget - ' + (B ? 'GPU ' + bPeak + ' MB, bitmaps kept after the fight ' + B.rows[0].hub.bmp + ' MB' : 'its page crashed (' + bCrash + ')'), B ? (bPeak > GPU_BUDGET_MB && B.rows[0].hub.bmp > 1000) : !!bCrash);
    } finally { try { await browser.close(); } catch (e) {} try { srv.kill(); } catch (e) {} }
  }
} catch (e) { console.log('  FAIL test crashed - ' + (e && e.stack || e)); fail++; }
console.log((fail ? 'FAIL ' : 'PASS ') + (pass + fail) + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
process.exit(fail ? 1 : 0);
})();
