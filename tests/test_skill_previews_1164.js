'use strict';
/* v1164 SKILL PREVIEWS (Phil 16 Oct 2026: "Can you please update all the skill previews with the new animations, skill fx and also the sound
   it makes" / "With the real animations"). The Skills tab reads the fight's own data (skillPreviewPlan); this test checks it against the
   FIGHT ITSELF, hero by hero, slot by slot, for all 60 heroes (non-zero exit on any failure):
     1. CLIP  - each skill slot plays the clip the engine's own startAbilityClip picks for that cast (castKit / castAbility on a real unit in
                server/sim-host.js), the same BATTLE_ANIM object (sheet, cells, fps) for exactly the engine's one-play hold; a cast the
                engine plays on its attack STAND-IN has no preview; Attack plays the clips real swings pick (Aureth light then dark, Rivet's
                arsenal, Rafe's pistol + cutlass), Critical Strike the crit clip only where one exists, the passive only where the fight
                has a passive clip. The cell clock is the fight's (ppPer / ppFrame, one-shot hold).
     2. FX    - every spell sheet the fight draws for that cast (every plate through _fxCheck, projectile, beam, tip FX and ownFx painter,
                recorded live) is in the preview, and nothing else, each at the fight's moment (within one tick). The one moment sim-host
                cannot record (a setTimeout: Kon-Wu's Phantom Step flash, 1 s real) is checked against its source line.
     3. SOUND - every file the fight's SFX_DATA rows play, the swing's weapon / arm pick (sfxAtk), each peak on the clip's contact cell
                (clipContactCell), cast and passive rows from the start on the press, a swing at SFX_ATK_GAIN.
     4. CONTROLS - Korvux pointed back at his old (v1159) Ember Cleave sheet, a sound moved one cell, a dropped FX: the checks FAIL.
     5. BROWSER (phone 844x390, muted - every destination through a gain of 0, --mute-audio): opening the Skills tab plays no sound; a tap
                plays the slot's files through sfxPlay on the FX bus (a swing at 0.85); a second slot stops the first; FX off = silent; the
                master mute holds; the stage holds only the open hero's sheets - the device's tier files (artFile) - and lets them and its
                decoded sounds go when the panel closes. Shots for the review in SHOT_DIR.
     6. ENGINE - render only: whole fights are tick-identical to BASE (v1163, 27570597). */
(async function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), os = require('os'), net = require('net'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || '27570597';   // v1163 (the mute dock + lag fix), the build this change sits on
const H = require('./helpers/skill-preview-1164.js');
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 900) : '')); } };
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML);
const J = s => JSON.parse(run(s));
const KEYS = J('JSON.stringify(HERO_KEYS.filter(k=>HERO_TYPES[k]&&!HERO_TYPES[k].monster))');
const FXRT = run('FX_RT'), STEP = run('SIM_STEP');
ck('all 60 heroes are checked', KEYS.length === 60, KEYS.length);

/* ---------- the checks, as functions of a runner (so the controls can run them on a broken page) ---------- */
function checkClips(r) {
  const bad = [];
  for (const k of KEYS) for (const sl of [0, 1, 2]) {
    const b = JSON.parse(r(H.castSrc(k, sl))); if (!b) { const p = JSON.parse(r(`JSON.stringify(skillPreviewPlan('${k}',${sl}))`)); if (p) bad.push(k + ' ' + sl + ' no slot, preview has one'); continue; }
    const p = JSON.parse(r(`(()=>{ const p=skillPreviewPlan('${k}',${sl}); if(!p) return 'null'; const c=p.clips[0]; return JSON.stringify({st:c.st,same:c.A===BATTLE_ANIM['${k}'][c.st],dur:c.dur,n:p.clips.length}); })()`));
    if (b.clip === '(stand-in)' || b.clip == null) { if (p) bad.push(k + ' ' + sl + ' fight plays the stand-in, preview shows ' + p.st); continue; }
    if (!p) { bad.push(k + ' ' + sl + ' fight plays ' + b.clip + ', no preview'); continue; }
    if (p.st !== b.clip || !p.same || p.n !== 1) bad.push(k + ' ' + sl + ' fight ' + b.clip + ' preview ' + p.st + (p.same ? '' : ' (not the BATTLE_ANIM object)'));
    else if (Math.abs(p.dur - b.hold) > 1e-9) bad.push(k + ' ' + sl + ' hold ' + b.hold + ' preview ' + p.dur); }
  // passive / crit: exactly where the fight has the clip (firePassiveClip plays anim.passive; the v532 crit clip)
  for (const k of KEYS) { const q = JSON.parse(r(`(()=>{ const an=BATTLE_ANIM['${k}']; const p3=skillPreviewPlan('${k}',3), pc=skillPreviewPlan('${k}','crit');
      return JSON.stringify({pas:!!(an.passive&&an.passive.u), p3:p3?p3.clips.map(c=>c.st):null, p3same:p3?p3.clips.every(c=>c.A===an[c.st]):true, crit:!!an.crit, pc:pc?pc.clips.map(c=>c.st):null}); })()`));
    if (q.pas !== !!q.p3 || (q.p3 && q.p3[0] !== 'passive') || !q.p3same) bad.push(k + ' passive fight ' + q.pas + ' preview ' + q.p3);
    if (q.crit !== !!q.pc || (q.pc && q.pc.join() !== 'crit')) bad.push(k + ' crit fight ' + q.crit + ' preview ' + q.pc); }
  // attack: the clips real swings play are the preview's, in the fight's order
  for (const k of KEYS) { const sw = JSON.parse(r(H.swingSrc(k, 0, 4))), p = JSON.parse(r(`JSON.stringify((skillPreviewPlan('${k}','attack')||{clips:[]}).clips.map(c=>c.st))`));
    const cr = JSON.parse(r(H.swingSrc(k, 1, 2)));
    if (!sw.length) { bad.push(k + ' attack: no swing recorded'); continue; }
    if (!sw.every(c => p.includes(c))) bad.push(k + ' attack fight ' + sw.join('+') + ' preview ' + p.join('+'));
    if (k === 'aureth' && p.slice(0, 2).join() !== sw.slice(0, 2).join()) bad.push('aureth arm order fight ' + sw.join() + ' preview ' + p.join());
    const an = J(`JSON.stringify(!!BATTLE_ANIM['${k}'].crit)`); if (an && !cr.includes('crit')) bad.push(k + ' forced crit did not play the crit clip: ' + cr); }
  return bad;
}
function checkCells(r) {   // the preview's cell clock against the engine's own one-shot reading (syncMesh: acc += dt*fps; ppFrame; hold the last cell)
  return JSON.parse(r(`(()=>{ const bad=[]; for(const k of HERO_KEYS){ const an=BATTLE_ANIM[k]; if(!an) continue; for(const st in an){ if(st[0]==='_') continue; const A=an[st]; if(!A||!A.n) continue;
      const per=ppPer(A), f=A.fps||10; for(let i=0;i<per+5;i++){ const t=(i+0.5)/f; let p=Math.min(per-1,Math.floor(t*f)), want=(A.pingpong&&A.n>1)?ppFrame(A,p):Math.min(A.n-1,p); if(A.reverse) want=A.n-1-want;
        if(skillPreviewCell(A,t)!==want){ bad.push(k+'.'+st+' cell '+i); break; } } if(Math.abs(skillPreviewClipDur(A)-per/f)>1e-12) bad.push(k+'.'+st+' dur'); } } return JSON.stringify(bad); })()`));
}
function checkFx(r) {
  const bad = [];
  for (const k of KEYS) for (const sl of [0, 1, 2]) {
    const b = JSON.parse(r(H.castSrc(k, sl))); if (!b) continue;
    const p = JSON.parse(r(`JSON.stringify((skillPreviewPlan('${k}',${sl})||{fx:[]}).fx.map(e=>({k:e.k,kind:e.kind,t0:e.t0})))`));
    // the fight's sheets for this cast, minus the status markers every DoT tick draws (poison / curse voidzone, not this spell's art)
    // and passive plates a cast happens to trigger (the passive's own preview carries those)
    const rec = b.rec.filter(x => !/_passive$/.test(x.key) && !(x.key === 'voidzone' && !(k === 'umbris' && sl === 0)));
    const bk = [...new Set(rec.map(x => x.key))].sort(), pk = [...new Set(p.map(e => e.k))].sort();
    const blink = (k === 'konwu' && sl === 2);   // abilArt: setTimeout(1000) real ms - never fires in sim-host; checked on its source below
    if (!blink && bk.join() !== pk.join()) { bad.push(k + ' ' + sl + ' fight [' + bk + '] preview [' + pk + ']'); continue; }
    for (const e of p) { const ts = rec.filter(x => x.key === e.k).map(x => x.t); if (!ts.length) continue; const pt = e.t0 * FXRT;
      if (Math.min(...ts.map(t => Math.abs(t - pt))) > STEP * 1.5) bad.push(k + ' ' + sl + ' ' + e.k + ' at ' + pt.toFixed(3) + ' fight s, fight ' + ts.join('/')); }
    if (blink) { const e = p.find(x => x.k === 'konwu_blue'); if (!e || Math.abs(e.t0 - J(`skillPreviewPlan('konwu',2).rel`) - 1.0) > 1e-9) bad.push('konwu blink flash not 1 s after the release'); } }
  // passive art: firePassiveFx's sheet (key+'_passive') on the passive preview
  for (const k of KEYS) { const q = J(`(()=>{ const p=skillPreviewPlan('${k}',3); return JSON.stringify({p:!!p, fx:p?p.fx.map(e=>e.k):[], def:!!FX2_DEF['${k}_passive']}); })()`);
    if (q.p && q.def !== q.fx.includes(k + '_passive')) bad.push(k + ' passive art ' + q.fx); }
  return bad;
}
function checkSound(r) {
  return JSON.parse(r(`(()=>{ const bad=[]; const BS={0:'ult',1:'green',2:'blue',3:'passive'};
    for(const k of HERO_KEYS){ if(!HERO_TYPES[k]||HERO_TYPES[k].monster) continue; const Hd=SFX_DATA.heroes[k]||{};
      for(const sl of SKILL_PREVIEW_SLOTS){ const p=skillPreviewPlan(k,sl); if(!p) continue;
        if(sl==='attack'||sl==='crit'){ p.clips.forEach((c,i)=>{ const melee=(c.st==='melee')||(/^w_/.test(c.st)&&RIVET_WPN.melee.indexOf(c.st.slice(2))>=0);
            const want=(Hd.arm&&Hd.arm[c.st])||((melee&&Hd.melee)?Hd.melee:Hd.atk), s=p.snd[i], at=c.t0+clipContactCell(c.A)/(c.A.fps||10);
            if(!s||s.name!==want||!s.atk||s.fromStart||Math.abs(s.at-at)>1e-9) bad.push(k+' '+sl+' '+c.st+' '+JSON.stringify(s)+' want '+want+'@'+at.toFixed(3)); }); continue; }
        const R=Hd[BS[sl]]||[], c=p.clips[0], files=new Set(); R.forEach(x=>x.f.forEach(f=>files.add(f)));
        if(!p.snd.every(s=>files.has(s.name))) bad.push(k+' '+sl+' plays a file the fight does not: '+p.snd.map(s=>s.name));
        R.forEach(x=>{ const mine=p.snd.filter(s=>s.id===x.id); if(!mine.length){ bad.push(k+' '+sl+' row '+x.id+' missing'); return; }
          mine.forEach(s=>{ if(s.atk) bad.push(k+' '+sl+' '+x.id+' at weapon gain');
            if(x.on==='cast'||x.on==='passive'){ if(!s.fromStart||Math.abs(s.at-c.t0)>1e-9) bad.push(k+' '+sl+' '+x.id+' not from the press'); }
            else if(x.on==='seq'&&x.at){ if(!x.at.some(a=>Math.abs(s.at-(p.rel+a))<1e-9)) bad.push(k+' '+sl+' '+x.id+' seq time'); }
            else { const cs=Array.isArray(c.A.contact)?c.A.contact:[clipContactCell(c.A)]; if(!cs.some(cc=>Math.abs(s.at-(c.t0+cc/(c.A.fps||10)))<1e-9)) bad.push(k+' '+sl+' '+x.id+' peak '+s.at.toFixed(3)+' not on a contact cell'); } }); }); } }
    return JSON.stringify(bad); })()`));
}
/* ---------- 1-3 on this page ---------- */
const cb = checkClips(run); ck('1. CLIP: every slot of every hero plays the fight\'s own clip (startAbilityClip / swings / crit / passive), same BATTLE_ANIM object, the engine\'s hold; stand-ins show nothing', cb.length === 0, cb.join(' | '));
const ce = checkCells(run); ck('1. CLIP: the preview cell clock is the engine\'s one-shot reading for every state of every hero (ppPer / ppFrame, last-cell hold)', ce.length === 0, ce.join(' | '));
const cf = checkFx(run); ck('2. FX: every sheet the fight draws for each cast (plates, projectiles, beams, tip FX, ownFx painters) is in the preview, nothing else, each within a tick of the fight\'s moment', cf.length === 0, cf.join(' | '));
const cs = checkSound(run); ck('3. SOUND: the fight\'s own files, peaks on the contact cell (swing / release / land / hit), cast + passive rows from the press, swings at the weapon gain', cs.length === 0, cs.join(' | '));
{ const src = fs.readFileSync(HTML, 'utf8');
  ck('2. the Phantom Step flash source still defers 1000 ms (the preview\'s rel + 1.0 s)', /if\(type==='blink'&&!o\._deferred\)\{[^\n]*\},1000\); return; \}/.test(src));
  ck('no hand-written preview table is left (HERO_SKILL_CLIPS starts empty, no _sk_ strip, no stand-in)', /const HERO_SKILL_CLIPS = \{\};/.test(src) && !/_sk_(ult|green|blue|pass|idle|cast)\.webp/.test(src) && !/HERO_SKILL_CLIPS\.[a-z]+ = \{/.test(src));
  ck('the derived view (ensureSkillPreview) is the fight\'s clip per slot', J(`(()=>{ const bad=[]; for(const k of HERO_KEYS){ HERO_SKILL_CLIPS[k]=null; ensureSkillPreview(k); const s=HERO_SKILL_CLIPS[k]; [0,1,2,3].forEach(i=>{ const st=skillPreviewStates(k,i); if((st.length?BATTLE_ANIM[k][st[0]]:undefined)!==s[i]) bad.push(k+i); }); } return JSON.stringify(bad); })()`).length === 0); }
const recent = J(`JSON.stringify({aureth:[skillPreviewPlan('aureth',0).clips[0].A.u,skillPreviewPlan('aureth','attack').clips.map(c=>c.A.u)], carn:skillPreviewPlan('carn',0).clips[0].A.u,
  veyr:[1,2,0].map(s=>skillPreviewPlan('veyr',s).fx.map(e=>e.k).join()), deep:skillPreviewPlan('deepcleft',2).clips[0].A.u, korvux:[skillPreviewPlan('korvux',2).clips[0].A.u, skillPreviewPlan('korvux',2).fx.map(e=>e.k).join()],
  nopass:HERO_KEYS.filter(k=>!(BATTLE_ANIM[k]&&BATTLE_ANIM[k].passive)&&skillPreviewPlan(k,3)).length})`);
ck('recent remakes: Aureth v1153 ult + light/dark arms, Carn v1150, Deepcleft v1160, Korvux v1162 Ember Cleave on his new blue clip, Veyr\'s three v1160 FX; no passive clip = no passive preview',
  /_1153\.webp/.test(recent.aureth[0]) && recent.aureth[1].length === 2 && /carn_ult_1150|carn\/carn_ult_/.test(recent.carn) && !/carn_ult\.webp\?v=3/.test(recent.carn) && /_1160/.test(recent.deep) && /korvux_blue_1162/.test(recent.korvux[0]) && recent.korvux[1] === 'korvuxcleave'
  && recent.veyr.join('|') === 'veyrcrescent|veyrmantle|veyrundertow' && recent.nopass === 0, JSON.stringify(recent));

/* ---------- 4. CONTROLS ---------- */
{ const oldBlue = JSON.stringify(Object.assign(J('JSON.stringify(BATTLE_ANIM.korvux.blue)'), { u: '/assets/anim/korvux/korvux_blue.webp?v=20' }));   // his v1159 Ember Cleave sheet (still on disk)
  const rc = load(HTML);   // a fresh page: Korvux's preview pointed back at his v1159 Ember Cleave sheet (the clip the old Skills tab could have kept)
  rc(`globalThis.__old=${oldBlue}; const _p=skillPreviewPlan; skillPreviewPlan=function(k,s){ const p=_p(k,s); if(p&&k==='korvux'&&s===2) p.clips[0]=Object.assign({},p.clips[0],{A:__old}); return p; }; 1`);
  const c1 = checkClips(rc); ck('CONTROL: Korvux\'s Ember Cleave preview on the old v1159 sheet FAILS the clip check', c1.some(x => /^korvux 2 /.test(x)), c1.join(' | '));
  const rs = load(HTML); rs(`const _p=skillPreviewPlan; skillPreviewPlan=function(k,s){ const p=_p(k,s); if(p&&k==='korvux'&&s===2) p.snd.forEach(x=>{ if(!x.fromStart) x.at+=1/24; }); return p; }; 1`);
  const c2 = checkSound(rs); ck('CONTROL: a sound one cell off its contact FAILS the sound check', c2.some(x => /^korvux 2 /.test(x)), c2.join(' | '));
  const rf = load(HTML); rf(`const _p=skillPreviewPlan; skillPreviewPlan=function(k,s){ const p=_p(k,s); if(p&&k==='veyr'&&s===2) p.fx=[]; return p; }; 1`);
  const c3 = checkFx(rf); ck('CONTROL: Veyr\'s Abyssal Mantle with its FX dropped FAILS the FX check', c3.some(x => /^veyr 2 /.test(x)), c3.join(' | ')); }

/* ---------- 6. ENGINE: render only - whole fights tick-identical to BASE ---------- */
{ const BASE = path.join(ROOT, '.test-skp-live-' + process.pid + '.html'); let rb = null;
  try { fs.writeFileSync(BASE, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 })); rb = load(BASE); } catch (e) {} finally { try { fs.unlinkSync(BASE); } catch (e) {} }
  const trace = (r, seed, a, f) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10),+(u.atkCd||0).toFixed(3)].join(':')).join('|')); }
      return tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');
  const FIGHTS = [[11, ['korvux', 'aureth', 'veyr'], ['carn', 'deepcleft', 'hollow']], [12, ['hurne', 'konwu', 'vex'], ['rivet', 'zahri', 'sorrel']], [13, ['umbris', 'oakmir', 'lumi'], ['grosk', 'sylthaine', 'rafe']]];
  const same = rb && FIGHTS.every(([s, a, f]) => trace(run, s, a, f) === trace(rb, s, a, f));
  ck('6. ENGINE: whole seeded fights are tick-for-tick identical to BASE ' + BASE_SHA + ' (hp, x, y, alive, energy, swing timer)', same); }

/* ---------- 5. BROWSER ---------- */
let chromium = null; try { ({ chromium } = require(path.join(ROOT, 'node_modules/playwright'))); } catch (e) {}
const SHOTS = process.env.SHOT_DIR || 'C:\\Users\\Home\\Downloads\\ew-sweep\\skillpreview';
if (process.env.SKP_NO_BROWSER) console.log('  (browser part skipped: SKP_NO_BROWSER)');
else if (!chromium) ck('5. BROWSER (playwright missing)', false);
else {
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
  let port = await freePort(); if (port === 8871) port = await freePort();
  const base = 'http://127.0.0.1:' + port, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-skp-'));
  const srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200' }, stdio: 'ignore', windowsHide: true });
  let browser;
  try {
    for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch (_) {} await delay(150); }
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
    await ctx.addInitScript(() => { const oc = AudioNode.prototype.connect;   // every path to the speakers goes through a gain of 0
      AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
        if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); };
      try { localStorage.setItem('ew_sound', JSON.stringify({ fx: { on: true, vol: 0.8 }, music: { on: false, vol: 0 }, voice: { on: false, vol: 0 } })); } catch (e) {} });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message)));
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' }); await delay(3500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(800);
    await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'skp' + Date.now().toString(36), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id;
      G.tutStarted = true; G.tutDone = true; try { document.body.classList.remove('gated'); } catch (e) {} show('home'); });
    await delay(1200);
    await pg.evaluate(() => { window.__plays = []; const sp = sfxPlay; sfxPlay = function (n, at, o) { const src = sp.apply(this, arguments); window.__plays.push({ n, at, atk: !!(o && o.atk), fs: !!(o && o.fromStart), src: !!src, stopped: false });
        if (src) { const st = src.stop.bind(src), rec = window.__plays[window.__plays.length - 1]; src.stop = function () { rec.stopped = true; try { st(); } catch (e) {} }; } return src; };
      SFX.log = []; });
    const open = hk => pg.evaluate(hk => { G.unlocked[hk] = true; detailHero = hk; heroTab = 'skills'; skClipIdx = 0; popoutScreen('heroDetail'); renderHeroDetail(); return !!document.getElementById('skStage'); }, hk);
    const tapRow = async sl => { const el = await pg.$(`.skrow[data-skill="${sl}"]`); await el.scrollIntoViewIfNeeded(); await delay(150); const b = await el.boundingBox(); await pg.touchscreen.tap(b.x + 30, b.y + b.height / 2); };
    // the first tap anywhere unlocks audio (a phone's rule); opening the tab must stay silent
    await pg.touchscreen.tap(420, 380); await delay(300);
    ck('5. the Skills tab opens with a stage', await open('korvux')); await delay(1500);
    ck('5. opening the Skills tab plays no sound', (await pg.evaluate(() => window.__plays.length)) === 0, JSON.stringify(await pg.evaluate(() => window.__plays)));
    const plan = await pg.evaluate(() => skillPreviewPlan('korvux', 2).snd.map(s => s.name));
    await tapRow(2); await delay(1500);
    const p1 = await pg.evaluate(() => window.__plays.slice());
    ck('5. a tap on Ember Cleave plays its files through sfxPlay (the fight\'s player)', p1.length === plan.length && p1.every((x, i) => x.n === plan[i] && x.src), JSON.stringify(p1) + ' want ' + plan);
    const logs = await pg.evaluate(() => (SFX.log || []).filter(x => x.k === 'play').map(x => ({ name: x.name, gain: x.gain })));
    await pg.evaluate(() => { window.__plays.length = 0; SFX.log = []; }); await tapRow('attack'); await delay(1500);
    const lg2 = await pg.evaluate(() => (SFX.log || []).filter(x => x.k === 'play').map(x => ({ name: x.name, gain: x.gain })));
    ck('5. a spell sound plays at gain 1, a swing at SFX_ATK_GAIN 0.85, both into the FX bus', logs.every(x => x.gain === 1) && lg2.length >= 1 && lg2.every(x => Math.abs(x.gain - 0.85) < 1e-6)
      && await pg.evaluate(() => !!(SND.bus && SND.bus.fx)), JSON.stringify(logs) + JSON.stringify(lg2));
    await pg.evaluate(() => { window.__plays.length = 0; }); await tapRow(0); await delay(60); await tapRow(1); await delay(1200);
    const p3 = await pg.evaluate(() => window.__plays.slice());
    const firstN = await pg.evaluate(() => skillPreviewPlan('korvux', 0).snd.length);
    ck('5. one preview sound at a time: tapping Comet Dash stops Falling Star\'s', p3.slice(0, firstN).every(x => !x.src || x.stopped || x.fs) || p3.length <= firstN, JSON.stringify(p3));
    await pg.evaluate(() => { window.__plays.length = 0; sndSet('fx', { on: false }); }); await tapRow(2); await delay(1200);
    ck('5. Settings FX off: a tap plays nothing', (await pg.evaluate(() => window.__plays.length)) === 0);
    await pg.evaluate(() => { sndSet('fx', { on: true, vol: 0.8 }); window.__plays.length = 0; });
    ck('5. the master mute holds: muted, the master gain is 0 while a preview plays', await pg.evaluate(async () => { sndMuteSet(true);
      await new Promise(r => setTimeout(r, 50)); const g = SND.out && SND.out.gain.value; return g === 0; }));
    await pg.evaluate(() => sndMuteSet(false));
    // memory: only the open hero's sheets, the device's tier files; released when the panel closes
    const mem = await pg.evaluate(async () => { const st = EmberSkillStage.current(); const held = Object.keys(st.imgs);
      const want = new Set(); SKILL_PREVIEW_SLOTS.forEach(sl => { const p = skillPreviewPlan('korvux', sl); if (!p) return; p.clips.forEach(c => { const F = artFile(c.A.u); want.add(F ? F.u : c.A.u); });
        p.fx.forEach(e => { const F = artFile(e.d.u); want.add(F ? F.u : e.d.u); }); }); if (BATTLE_ANIM.korvux.idle) want.add(BATTLE_ANIM.korvux.idle.u);
      want.add('/assets/img/battlefields/emberdraft/cinderforge.webp');
      const tier = ART_TIER; const bufs = Object.keys(SND.buf).filter(f => /S017|NEW-korvux/.test(f));
      closePopout(); show('home'); await new Promise(r => setTimeout(r, 400));
      return { held, extra: held.filter(u => !want.has(u)), tier, cur: !!EmberSkillStage.current(), bufsBefore: bufs.length, bufsAfter: Object.keys(SND.buf).filter(f => /S017/.test(f)).length }; });
    ck('5. the stage holds only the open hero\'s sheets, each the file this device loads in a fight (artFile, ' + mem.tier + ' tier)', mem.held.length > 0 && mem.extra.length === 0, JSON.stringify(mem.extra));
    ck('5. closing the panel lets the sheets and the decoded preview sounds go', !mem.cur && mem.bufsAfter === 0, JSON.stringify(mem));
    // shots: the Skills tab of 12 heroes (the review contact sheet is built from these)
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const hk of ['aureth', 'carn', 'veyr', 'deepcleft', 'korvux', 'hollow', 'hurne', 'konwu', 'vex', 'zahri', 'grosk', 'sylthaine']) {
      await open(hk); await delay(2500); await pg.evaluate(() => { const w = document.getElementById('skClipWrap'); if (w) w.scrollIntoView({ block: 'start' }); const st = EmberSkillStage.current(); st.t0 = performance.now() - 1200; }); await delay(160);
      await pg.screenshot({ path: path.join(SHOTS, 'panel_' + hk + '.png') }); }
    ck('5. no page errors', errs.length === 0, errs.slice(0, 5).join(' | '));
  } catch (e) { ck('5. BROWSER ran', false, e && e.stack); }
  finally { try { if (browser) await browser.close(); } catch (e) {} try { srv.kill(); } catch (e) {} }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
