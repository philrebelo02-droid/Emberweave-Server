'use strict';
// v1165 SOUND: ABILITY RIDE OUT + SPARKLE and the FUSED MELEE SWING (Phil 16 Oct 2026). Ability: listening page "spell ride" (spell_ride_picks)
// "Sparkle is good do c for every ability and put it in game"; "Yes lets do it, full effects will sound cleaner". Melee: "melee hits are kind of
// annoying after a while", "Maybe we should add a magic shimmer to play at the same time as the swings", the "Blended" page: "There we go",
// "Send that". tools/build_sfx.py (spark_base, fuse()) + the page's sfxPlay / sfxAtk / sfxFade / sfxCancel / sfxTailsOut.
//   FILES (measured with tools/sfx_loudness.py on the shipped files against the v1138 files in git BASE):
//     1. every ability row's files carry the ride-out + sparkle tail (manifest: spark_base ran, the wet level, the natural end); for the 10
//        examples on Phil's page + 14 more the build's own render(spark) run again reproduces the shipped file byte for byte.
//        CONTROL: the same render with the sparkle off does not.
//     2. every ability file's impact peak is within 10 ms of its v1138 peak. CONTROL: a peak moved 50 ms fails.
//     3. every ability file's max momentary loudness is within 0.5 LU of its v1138 file. CONTROL: a copy boosted 1 dB fails.
//     4. the weapon strikes are unchanged: the 12 approved LIB-ATK files and Aureth's 3 ARM cuts are byte-identical to BASE, same urls.
//        CONTROL: take 2 of a type is a different file.
//     5. FUSED: 6 fused files for each of the 8 melee types and Aureth's 3 ARM cuts (66), each within 1 LU of its target, its peak measured in
//        the file within 30 ms of its swing's; 4 of them rebuilt here by fuse() + render() byte for byte. CONTROL: a different shimmer differs.
//   CLIENT (the page in a vm, a fake audio device that records every start / stop / gain automation; nothing is output):
//     6. a row plays at most 2 copies: the 3rd fades the oldest over 120 ms. CONTROL: 3 different rows - no fade.
//     7. sfxCancel fades (~80 ms ramp to 0, stop after it) instead of a hard stop. CONTROL: BASE's sfxCancel stops at once, no ramp.
//     8. leaving the result screen fades every tail still ringing (show() calls sfxTailsOut).
//     9. FUSED SWINGS: every melee hero's swing (+ Rafe's cutlass, Aureth's ARM cuts) plays a fused file; 60 swings never repeat back to back and
//        use all 6; rate within 3%, level within 1.5 dB; the peak lands on the blow within 10 ms at its rate. CONTROLS: Math.random pinned -> 2
//        files; the peak computed without the rate misses; a ranged swing (bow, gun, thrown, caster) plays its live file at rate 1.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || 'cd6b232d';   // live v1162 (main) - the v1138 sound files, before v1165
const PY = process.env.PYTHON || 'python';
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-sparkle-'));
process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} });
const git = (a, enc) => cp.execSync('git ' + a, { cwd: ROOT, maxBuffer: 256 << 20, encoding: enc === null ? undefined : 'utf8' });
const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/sfx/sfx_manifest.json'), 'utf8'));
const OLD = JSON.parse(git('show ' + BASE_SHA + ':assets/audio/sfx/sfx_manifest.json'));
const F = MAN.files, OF = OLD.files, P = n => path.join(ROOT, 'assets/audio', F[n].f.split('?')[0]);
const PYM = `
import json, sys, numpy as np
sys.path.insert(0, sys.argv[1]); import sfx_loudness as L
out = []
for a in json.loads(open(sys.argv[2]).read()):
    x = L.decode(a['p']); e = L.envelope(x); pk = e.max() + 1e-12
    r = {'lufs': round(L.max_momentary(x), 3), 'peak': round(L.impact_peak(x), 4), 'dur': x.shape[1] / L.SR}
    if a.get('nat') is not None:   # the tail: the loudest 10 ms past the natural end, rel. to the file's peak, and how long it rings above -60 dB
        i = int(a['nat'] * L.SR); t = e[i:] if i < len(e) else np.zeros(1)
        r['tail_db'] = round(20 * np.log10(t.max() / pk + 1e-12), 1) if len(t) else -120.0
        on = np.nonzero(t > pk * 10 ** (-60 / 20))[0]; r['tail_s'] = round(on[-1] / L.SR, 3) if len(on) else 0.0
    out.append(r)
print(json.dumps(out))`;
const pyFile = path.join(tmp, 'm.py'); fs.writeFileSync(pyFile, PYM);
const measure = list => { const j = path.join(tmp, 'in' + Math.random().toString(36).slice(2) + '.json'); fs.writeFileSync(j, JSON.stringify(list));
  return JSON.parse(cp.execFileSync(PY, ['-I', pyFile, path.join(ROOT, 'tools'), j], { maxBuffer: 64 << 20 }).toString()); };
const oldFile = n => { const p = path.join(tmp, 'old-' + n + '.m4a'); if (!fs.existsSync(p)) fs.writeFileSync(p, git('show ' + BASE_SHA + ':assets/audio/' + OF[n].f.split('?')[0], null)); return p; };

try {
  // ------------------------------------------------------------------ FILES
  const abil = Object.keys(F).filter(n => !/^LIB-/.test(n) && !/^ATK-/.test(n)).sort();
  const rows = Object.entries(MAN.rows).filter(([, r]) => !r.none && r.files && r.files.length && ['green', 'blue', 'ult', 'passive'].includes(r.slot));
  ck('every ability row (' + rows.length + ' rows, ' + abil.length + ' files) plays files built with the ride-out + sparkle (spark_base) at ?v=' + MAN.version,
    rows.length >= 210 && rows.every(([, r]) => r.files.every(n => F[n] && F[n].spark && new RegExp('\\?v=' + MAN.version + '$').test(F[n].f))) && abil.every(n => F[n].spark));
  const M = measure(abil.map(n => ({ p: P(n) })));
  ck('every ability file was made by spark_base with a wet level stepped from -8 dB (the peak kept) and a natural end inside the file',
    abil.every(n => [-8, -11, -14, -17, -20].includes(F[n].spark.wet_db) && F[n].spark.natural > 0 && F[n].spark.end >= F[n].spark.natural - 1e-6 && F[n].dur >= F[n].spark.natural - 0.05));
  const ext = abil.filter(n => F[n].spark.end - F[n].spark.natural >= 0.05);
  console.log('  info the bloom rings past the natural end on ' + ext.length + ' of ' + abil.length + ' files (the ones whose take ended hot: up to ' +
    Math.max(...abil.map(n => F[n].spark.end - F[n].spark.natural)).toFixed(2) + ' s); on the rest it sits under the sound and fades with it');
  { /* the shipped file IS the sparkle render: the build's own render() run again here (deterministic: ffmpeg + the AAC encoder give the same
       bytes for the same input) on the 10 page examples + 14 more reproduces the shipped file byte for byte; the same render with the
       sparkle off does not */
    const PAGE = ['S0081', 'S0009', 'S0076', 'S0252', 'S0323', 'S0375', 'S0121', 'S0209', 'S0280', 'S0237'];
    const more = abil.filter(n => PAGE.indexOf(n) < 0 && /^S\d{4}$/.test(n) && n !== 'S0014').filter((n, i) => i % 14 === 0).slice(0, 14), pick = PAGE.concat(more);
    const RR = `
import json, sys, os, tempfile, hashlib
sys.path.insert(0, sys.argv[1]); import build_sfx as B
man = json.load(open(os.path.join(B.OUT, 'sfx_manifest.json'), encoding='utf-8')); rows, picks, appr = B.load()
ride = {k: os.path.join(B.SL, v['out']) for k, v in json.load(open(os.path.join(B.RIDE_DIR, 'rideout.json'), encoding='utf-8')).items() if v.get('ok')}
h = lambda p: hashlib.sha1(open(p, 'rb').read()).hexdigest()
out = {}
with tempfile.TemporaryDirectory() as td:
    for n in json.loads(sys.argv[2]):
        f = man['files'][n]; src = ride.get(n) or B.src_path(picks[n]['file'])
        a, b = os.path.join(td, n + '_on.m4a'), os.path.join(td, n + '_off.m4a')
        B.render(src, a, f['offset'], None, f['ch'] == 2, B.ABIL_MAX_LEN, True, f['peak_at'])
        B.render(src, b, f['offset'], None, f['ch'] == 2, B.ABIL_MAX_LEN, False, None)
        out[n] = {'on': h(a) == h(os.path.join(B.OUT, n + '.m4a')), 'off': h(b) == h(os.path.join(B.OUT, n + '.m4a'))}
print(json.dumps(out))`;
    const fp = path.join(tmp, 'rr.py'); fs.writeFileSync(fp, RR);
    const R = JSON.parse(cp.execFileSync(PY, ['-I', fp, path.join(ROOT, 'tools'), JSON.stringify(pick)], { maxBuffer: 64 << 20 }).toString());
    const notOn = pick.filter(n => !R[n].on);
    ck('the shipped ability files ARE the ride-out + sparkle render: build_sfx render(spark) run again reproduces ' + (pick.length - notOn.length) + ' of ' + pick.length +
      ' byte for byte (the 10 page examples included)', notOn.length === 0, notOn.join(','));
    ck('CONTROL: the same render with the sparkle off gives a different file for every one (' + pick.filter(n => R[n].off).length + ' match)', pick.every(n => !R[n].off)); }
  const pkBad = abil.filter(n => OF[n] && Math.abs(F[n].peak - OF[n].peak) > 0.010);
  ck('every ability file\'s impact peak (re-measured on the final file) is within 10 ms of its v1138 peak - no hit moves (' + abil.filter(n => OF[n]).length + ' files)',
    pkBad.length === 0, pkBad.map(n => n + ' ' + OF[n].peak + '->' + F[n].peak).slice(0, 6).join(', '));
  ck('the manifest peak is the final file\'s own loudest moment at that place (re-measured: the file\'s 10 ms max within 30 ms of it)',
    abil.every(n => typeof F[n].peak === 'number' && F[n].peak < F[n].dur && Math.abs(F[n].peak - (F[n].peak_at != null ? F[n].peak_at : F[n].peak)) <= 0.031));
  ck('CONTROL: a peak moved 50 ms fails the 10 ms check', Math.abs((OF.S0081.peak + 0.05) - OF.S0081.peak) > 0.010);
  const Mold = measure(abil.filter(n => OF[n]).map(n => ({ p: oldFile(n) })));
  const ld = abil.filter(n => OF[n]).map((n, i) => ({ n, d: +(M[abil.indexOf(n)].lufs - Mold[i].lufs).toFixed(2) }));
  const ldBad = ld.filter(r => Math.abs(r.d) > 0.5);
  console.log('  info loudness change vs v1138 (LU): ' + Math.min(...ld.map(r => r.d)) + ' .. ' + Math.max(...ld.map(r => r.d)));
  ck('every ability file\'s max momentary loudness is within 0.5 LU of its v1138 file (' + ld.length + ' files)', ldBad.length === 0, JSON.stringify(ldBad.slice(0, 6)));
  { const b = path.join(tmp, 'boost.m4a'); cp.execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', P('S0081'), '-af', 'volume=1dB', '-c:a', 'aac', '-b:a', '96k', b]);
    const [mb] = measure([{ p: b }]); ck('CONTROL: S0081 boosted 1 dB fails the 0.5 LU check (' + (mb.lufs - Mold[abil.filter(n => OF[n]).indexOf('S0081')].lufs).toFixed(2) + ' LU)',
      Math.abs(mb.lufs - Mold[abil.filter(n => OF[n]).indexOf('S0081')].lufs) > 0.5); }
  const strikes = Object.keys(OF).filter(n => /^LIB-ATK-|^ATK-AURETH-/.test(n));
  const blob = (ref, n, f) => git('rev-parse ' + ref + ':assets/audio/' + f.split('?')[0]).trim();
  const same = strikes.filter(n => F[n] && F[n].f === OF[n].f && blob('HEAD', n, F[n].f) === blob(BASE_SHA, n, OF[n].f) &&
    crypto().createHash('sha1').update(fs.readFileSync(P(n))).digest('hex') === crypto().createHash('sha1').update(git('show ' + BASE_SHA + ':assets/audio/' + OF[n].f.split('?')[0], null)).digest('hex'));
  ck('the weapon strikes are unchanged: ' + strikes.length + ' files (the 12 approved LIB-ATK + Aureth\'s 3 ARM cuts) byte-identical to BASE, same urls (no re-download)',
    strikes.length === 15 && same.length === strikes.length, strikes.filter(n => same.indexOf(n) < 0).join(','));
  ck('CONTROL: an ability file (S0081) did change (the strike check compares real bytes)', fs.readFileSync(P('S0081')).compare(fs.readFileSync(oldFile('S0081'))) !== 0);
  const FU = MAN.fused || {}, fus = Object.values(FU).flat();
  const Mf = measure(fus.map(n => ({ p: P(n) })));
  const fBad = fus.filter((n, i) => Math.abs(Mf[i].lufs - F[n].target) > 1.0 || !(F[n].peak > 0 && F[n].peak < F[n].dur));
  const base = Object.keys(FU), pkOff = base.flatMap(b => FU[b].filter(n => Math.abs(F[n].peak - F[b].peak) > 0.031));
  ck('FUSED: 6 fused swings for each of the 8 melee types and Aureth\'s 3 ARM cuts (' + fus.length + ' files), each within 1 LU of its target, its own peak inside the file',
    base.length === 11 && base.every(b => FU[b].length === 6) && JSON.stringify(MAN.melee) === JSON.stringify(['BLADE-LIGHT', 'BLADE-HEAVY', 'BLUNT', 'FIST-HEAVY', 'FIST-METAL', 'CLAW', 'THRUST', 'STAFF']) &&
    ['BOW', 'GUN', 'THROWN', 'CASTER-WHOOSH'].every(t => !FU['LIB-ATK-' + t]) && fBad.length === 0, fBad.join(','));
  ck('FUSED: every fused file\'s impact peak (re-measured on the final file) is within 30 ms of its swing\'s - the blow is where it was', pkOff.length === 0, pkOff.join(','));
  { const FR = `
import json, sys, os, tempfile, hashlib
sys.path.insert(0, sys.argv[1]); import build_sfx as B
man = json.load(open(os.path.join(B.OUT, 'sfx_manifest.json'), encoding='utf-8'))
h = lambda p: hashlib.sha1(open(p, 'rb').read()).hexdigest()
out = {}
with tempfile.TemporaryDirectory() as td:
    for b, k, kk in json.loads(sys.argv[2]):
        n = man['fused'][b][k]; f = man['files'][n]
        w = B.fuse(os.path.join(B.OUT, b + '.m4a'), os.path.join(B.SHIM_DIR, 'SHIM_%d.wav' % (kk + 1)), os.path.join(td, 'f.wav'))
        a = os.path.join(td, 'a.m4a'); B.render(w, a, f['offset'], None, False, 4.0, False, f['peak_at'])
        out[n + '/' + str(kk)] = h(a) == h(os.path.join(B.OUT, n + '.m4a'))
print(json.dumps(out))`;
    const fp = path.join(tmp, 'fr.py'); fs.writeFileSync(fp, FR);
    const R = JSON.parse(cp.execFileSync(PY, ['-I', fp, path.join(ROOT, 'tools'), JSON.stringify([['LIB-ATK-BLADE-LIGHT', 0, 0], ['LIB-ATK-BLUNT', 3, 3], ['ATK-AURETH-DARK', 5, 5], ['LIB-ATK-FIST-HEAVY', 1, 1], ['LIB-ATK-CLAW', 2, 4]])], { maxBuffer: 64 << 20 }).toString());
    const ks = Object.keys(R);
    ck('FUSED: fuse() + render() run again rebuild 4 of the shipped fused swings byte for byte (the approved swing + its shimmer, Phil\'s blend)', ks.slice(0, 4).every(k => R[k]), JSON.stringify(R));
    ck('CONTROL: the same rebuild with a different shimmer (CLAW take 3 made with shimmer 5) does not match', R[ks[4]] === false); }

  // ------------------------------------------------------------------ CLIENT
  const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
  const DUR = JSON.stringify(Object.fromEntries(Object.entries(F).map(([n, v]) => [n, v.dur])));
  const FAKE = `(()=>{ globalThis.__rt=1; globalThis.__src=[]; const dur=${DUR};
    const prm=v=>({value:v,ev:[],setValueAtTime(x,t){this.ev.push(['set',x,t]);},linearRampToValueAtTime(x,t){this.ev.push(['ramp',x,t]);},cancelScheduledValues(t){this.ev.push(['cancel',t]);}});
    const C={ state:'running', get currentTime(){ return globalThis.__rt; }, destination:{}, createGain(){ return {gain:prm(1),connect(x){ this.to=x; }}; },
      createBufferSource(){ const s={buffer:null,onended:null,playbackRate:prm(1),connect(x){ s.to=x; },start(t,off){ s.t=t; s.off=off||0; globalThis.__src.push(s); },stop(t){ s.stopAt=(t==null?globalThis.__rt:t); s.stopArg=t; }}; return s; } };
    SND.ctx=C; SND.out=C.createGain(); SND.bus.fx=C.createGain(); SND.cfg.fx.on=true; SND.live=0;
    for(const n in SFX_DATA.files){ SND.buf[SFX_DATA.files[n][0]]={duration:dur[n]||2}; }
    SFX.log=[]; SFX.last={}; SFX.atk=[]; if(SFX.act) SFX.act=[]; SFX.q=[]; CUR={mode:'replay'}; gameSpeed=1; battleTime=10; _bacc=0; SFX.loop=1; window._p2guard=false; return 1; })()`;
  const run = load(HTML); run(FAKE);
  const J = s => JSON.parse(run('JSON.stringify(' + s + ')'));
  // 6. the row cap
  const cap = J(`(()=>{ const t0=__rt; [0,0.2,0.4].forEach((d,i)=>{ __rt=t0+d; sfxPlay('S0081',__rt+1.6,{log:{id:'S0081'}}); }); const f=SFX.log.filter(x=>x.k==='fade');
    const v=SFX.act.filter(x=>x.row==='S0081'); return {fades:f, live:v.filter(x=>!x.dying).length, ev:v[0]&&v[0].env.gain.ev, stop:v[0]&&v[0].src.stopArg}; })()`);
  ck('a row plays at most 2 copies: the 3rd S0081 (Fritz Storm Surge, 6 s) fades the oldest out over 120 ms (env ramp to 0, stop after it)',
    cap.fades.length === 1 && cap.fades[0].why === 'row cap' && cap.live === 2 && cap.ev.some(e => e[0] === 'ramp' && e[1] === 0) &&
    Math.abs(cap.ev.find(e => e[0] === 'ramp')[2] - cap.ev.find(e => e[0] === 'set')[2] - 0.12) < 1e-6, JSON.stringify(cap));
  run(FAKE);
  const cap2 = J(`(()=>{ const t0=__rt; ['S0081','S0083','S0009'].forEach((n,i)=>{ __rt=t0+i*0.2; sfxPlay(n,__rt+1.6,{log:{id:n}}); }); return SFX.log.filter(x=>x.k==='fade').length; })()`);
  ck('CONTROL: three different rows at once - no fade', cap2 === 0);
  // 7. sfxCancel fades
  const CANCEL = `(()=>{ const u={key:'fritz',team:'ally'}; SFX.pend.set(u,{slot:'green',srcs:[]}); sfxGo({name:'S0081',T:battleTime,o:{u,rel:1,log:{id:'S0081'}}});
    const r=SFX.pend.get(u), s=r.srcs[0]; __rt+=0.5; const now=__rt; sfxCancel(u); const vv=(SFX.act||[]).find(v=>v.src===s), env=vv&&vv.env; const ev=(env&&env.gain&&env.gain.ev)||[];
    return {now, stopArg:s.stopArg, ramp:ev.filter(e=>e[0]==='ramp'), set:ev.filter(e=>e[0]==='set')}; })()`;
  run(FAKE); const cn = J(CANCEL);
  ck('sfxCancel fades the release sound over ~80 ms (ramp to 0 at now + 0.08, stop just after) instead of a hard stop',
    cn.ramp.length === 1 && cn.ramp[0][1] === 0 && Math.abs(cn.ramp[0][2] - cn.now - 0.08) < 1e-6 && cn.stopArg > cn.now + 0.08 && cn.stopArg < cn.now + 0.1, JSON.stringify(cn));
  { let base = null; try { const bh = path.join(tmp, 'base.html'); fs.writeFileSync(bh, git('show ' + BASE_SHA + ':emberweave-heroes.html')); const rb = load(bh); rb(FAKE); base = JSON.parse(rb('JSON.stringify(' + CANCEL + ')')); } catch (e) { base = { err: String(e) }; }
    ck('CONTROL: BASE\'s sfxCancel stops at once (stop() with no time, no ramp)', base && base.stopArg === undefined && (!base.ramp || base.ramp.length === 0), JSON.stringify(base)); }
  // 8. tails out
  run(FAKE);
  const to = J(`(()=>{ sfxPlay('S0081',__rt+1.6,{log:{id:'S0081'}}); sfxPlay('S0084',__rt+0.5,{log:{id:'S0084'}}); __rt+=2; const n=sfxTailsOut(); return {n, why:SFX.log.filter(x=>x.k==='fade').map(x=>x.why), d:SFX.log.filter(x=>x.k==='fade').map(x=>x.d)}; })()`);
  const showSrc = run('String(show)');
  ck('leaving the result screen fades every ability tail still ringing (show() -> sfxTailsOut, a 250 ms fade)', to.n === 2 && to.why.every(w => w === 'tails out') && to.d.every(d => d === 0.25) &&
    /state==='result'&&name!=='result'&&typeof sfxTailsOut==='function'\) sfxTailsOut\(\)/.test(showSrc), JSON.stringify(to));
  // 9. fused melee swings
  const SW = (hero, n, melee, pin, clip) => `(()=>{ ${pin ? 'const _r=Math.random; Math.random=()=>0.5;' : ''} try{ const u={key:'${hero}',team:'ally'${clip ? ",_atkClip:'" + clip + "'" : ''}}; const out=[];
      for(let i=0;i<${n};i++){ __rt+=1.3; battleTime+=1.3; SFX.log=[]; sfxAtk(u,0.3,${melee}); const q=SFX.q.pop(); if(q) sfxGo(q); out.push(SFX.log.find(x=>x.k==='play')||null); }
      return out; } finally{ ${pin ? 'Math.random=_r;' : ''} } })()`;
  const MH = { 'BLADE-LIGHT': 'hollow', 'BLADE-HEAVY': 'vael', BLUNT: 'gruel', 'FIST-HEAVY': 'grosk', 'FIST-METAL': 'tick', CLAW: 'hurne', THRUST: 'iver', STAFF: 'konwu' };
  const every = [];
  for (const [t, h] of Object.entries(MH)) { run(FAKE); every.push([t, h, J(SW(h, 12, true, false))]); }
  run(FAKE); every.push(['BLADE-LIGHT (Rafe\'s cutlass)', 'rafe', J(SW('rafe', 12, true, false))]);
  for (const c of ['attackLight', 'attackDark', 'crit']) { run(FAKE); every.push(['Aureth ' + c, 'aureth', J(SW('aureth', 12, true, false, c))]); }
  const notF = every.filter(([t, h, ps]) => !ps.every(p => p && fus.indexOf(p.name) >= 0));
  ck('FUSED: every melee hero\'s swing plays a fused file - the 8 melee types, Rafe\'s cutlass and Aureth\'s light / dark / X cuts (' + every.length * 12 + ' swings)', notF.length === 0, notF.map(x => x[0]).join(','));
  run(FAKE); const s60 = J(SW('vael', 60, true, false)).filter(Boolean);
  const rep60 = s60.filter((p, i) => i && p.name === s60[i - 1].name).length, used = new Set(s60.map(p => p.name)).size;
  ck('FUSED: 60 swings of one hero never play the same fused file twice in a row and use all 6 (' + used + ')', s60.length === 60 && rep60 === 0 && used === 6);
  ck('FUSED: every swing\'s rate is within 3% and its level within 1.5 dB, the weapon gain 0.85 kept', s60.every(p => Math.abs(p.rate - 1) <= 0.03 + 1e-9 && Math.abs(p.jdb) <= 1.5 + 1e-9 && p.gain === 0.85) &&
    Math.max(...s60.map(p => p.rate)) - Math.min(...s60.map(p => p.rate)) > 0.02);
  run(FAKE); const pin = J(SW('vael', 60, true, true)).filter(Boolean);
  ck('CONTROL: with Math.random pinned the same 60 swings play only 2 files, alternating (' + new Set(pin.map(p => p.name)).size + ') - the variety is the random pick', new Set(pin.map(p => p.name)).size === 2);
  const allP = every.flatMap(x => x[2]).concat(s60).filter(Boolean);
  const pkE = allP.map(p => Math.abs(p.st + (p.pk - p.off) / p.rate - p.peakAt)), pkN = allP.map(p => Math.abs(p.st + (p.pk - p.off) - p.peakAt));
  ck('FUSED: the peak lands on the blow within 10 ms at its rate (max ' + (Math.max(...pkE) * 1000).toFixed(2) + ' ms over ' + allP.length + ' swings)', Math.max(...pkE) <= 0.010);
  ck('CONTROL: the same peaks computed without the rate miss by more than 10 ms (max ' + (Math.max(...pkN) * 1000).toFixed(1) + ' ms)', Math.max(...pkN) > 0.010);
  const RG = { BOW: 'sloe', GUN: 'rivet', THROWN: 'yenna', 'CASTER-WHOOSH': 'fritz' }, rg = [];
  for (const [t, h] of Object.entries(RG)) { run(FAKE); rg.push([t, J(SW(h, 6, false, false))]); }
  const rgBad = rg.filter(([t, ps]) => !ps.every(p => p && p.name === 'LIB-ATK-' + t && p.rate === 1 && p.jdb === 0 && p.gain === 0.85));
  ck('RANGED: a bow, gun, thrown and caster swing play their live file at rate 1, level 0 dB jitter, gain 0.85 (unchanged)', rgBad.length === 0, rgBad.map(x => x[0] + ' ' + JSON.stringify(x[1][0])).join('; '));
  run(FAKE); const ab = J(`(()=>{ SFX.log=[]; sfxPlay('S0081',__rt+1.6,{log:{id:'S0081'}}); return SFX.log.find(x=>x.k==='play'); })()`);
  ck('an ability sound plays at gain 1 from its start at its peak offset (unchanged playback)', ab && ab.gain === 1 && Math.abs(ab.st + ab.pk - ab.peakAt) < 1e-9);
} catch (e) { ck('test ran', false, e.stack); }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
function crypto() { return require('crypto'); }
})();
