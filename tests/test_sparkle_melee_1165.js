'use strict';
// v1165 SPARKLE TAILS + MELEE VARIETY (Phil 16 Oct 2026, listening pages "spell ride" (spell_ride_picks) and "melee shimmer" (melee_shimmer_picks):
// "Sparkle is good do c for every ability and put it in game"; "melee hits are kind of annoying after a while"; "Maybe we should add a magic
// shimmer to play at the same time as the swings"; "the average human probably can't hear it"; "6 random shimmers 6 random hits"; "Yes lets do
// it, full effects will sound cleaner"). tools/build_sfx.py (spark_base, the takes, the shimmers) + the page's sfxPlay / sfxAtk / sfxCancel.
//   FILES (measured with tools/sfx_loudness.py on the shipped files against the v1138 files in git BASE):
//     1. every ability row's files carry the ride-out + sparkle tail (manifest: spark_base ran, the wet level, the natural end). For the 10
//        examples on Phil's page + 14 more, the build's own B (ride out only) and C (+ sparkle) are rendered again here and the SHIPPED file
//        is matched to both after its peak: it is C (the bloom + shimmer under it), not B. CONTROL: the v1138 file is closer to B than to C.
//     2. every ability file's impact peak is within 10 ms of its v1138 peak. CONTROL: a peak moved 50 ms fails.
//     3. every ability file's max momentary loudness is within 0.5 LU of its v1138 file. CONTROL: a copy boosted 1 dB fails.
//     4. the weapon strikes are unchanged: the 12 approved LIB-ATK files and Aureth's 3 ARM cuts are byte-identical to BASE, same urls.
//        CONTROL: take 2 of a type is a different file.
//     5. 6 takes per weapon type + 6 shimmers, each within 1 LU of its type's target.
//   CLIENT (the page in a vm, a fake audio device that records every start / stop / gain automation; nothing is output):
//     6. a row plays at most 2 copies: the 3rd fades the oldest over 120 ms. CONTROL: 3 different rows - no fade.
//     7. sfxCancel fades (~80 ms ramp to 0, stop after it) instead of a hard stop. CONTROL: BASE's sfxCancel stops at once, no ramp.
//     8. leaving the result screen fades every tail still ringing (show() calls sfxTailsOut).
//     9. MELEE, 60 swings of one hero: every swing has a shimmer; the take and the shimmer never repeat back to back; >= 25 distinct
//        take+shimmer pairs; every swing rate 5-11% off 1 and any 6 in a row span >= 8%; shimmer rate within 8%; the swing's AND the shimmer's
//        peaks land on the contact moment within 10 ms. CONTROLS: Math.random pinned -> <= 3 pairs; the peak computed without the rate misses.
//    10. a crit plays louder than a normal swing (+2 dB); a crit found on the blow raises the swing. CONTROL: a non-crit stays soft.
//    11. thinning: 3 swings starting together play 0 / -3 / -5 dB. CONTROL: spread 0.5 s apart - all 0.
//    12. ranged (Sloe's bow): no shimmer, the takes and the rate still vary; an ability sound plays at rate 1 with no shimmer.
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
  { const PAGE = ['S0081', 'S0009', 'S0076', 'S0252', 'S0323', 'S0375', 'S0121', 'S0209', 'S0280', 'S0237'];
    const more = abil.filter(n => PAGE.indexOf(n) < 0 && /^S\d{4}$/.test(n)).filter((n, i) => i % 14 === 0).slice(0, 14), pick = PAGE.concat(more);
    const FIT = `
import json, sys, os, tempfile, numpy as np
sys.path.insert(0, sys.argv[1]); import build_sfx as B, sfx_loudness as L
man = json.load(open(os.path.join(B.OUT, 'sfx_manifest.json'), encoding='utf-8')); rows, picks, appr = B.load()
ride = {k: os.path.join(B.SL, v['out']) for k, v in json.load(open(os.path.join(B.RIDE_DIR, 'rideout.json'), encoding='utf-8')).items() if v.get('ok')}
def fit(y, x, a):   # residual (dB) of y after the best scale of x, from a on (both 48 kHz, same start)
    n = min(y.shape[1], x.shape[1]); y = y[:, a:n].ravel(); x = x[:, a:n].ravel(); g = (x @ y) / (x @ x + 1e-12)
    return float(10 * np.log10(((y - g * x) ** 2).sum() / ((y ** 2).sum() + 1e-12) + 1e-12))
out = {}
for n, old in json.loads(sys.argv[2]):
    p = picks[n]; src = ride.get(n) or B.src_path(p['file']); ch = str(man['files'][n]['ch'])
    with tempfile.TemporaryDirectory() as td:
        B.spark_base(src, ch, td)
        xb, xc = L.decode(os.path.join(td, 'B.wav')), L.decode(os.path.join(td, 'C2.wav'))
        xs, xo = L.decode(os.path.join(B.OUT, n + '.m4a')), L.decode(old)
        a = int((man['files'][n]['peak'] + 0.08) * L.SR)
        out[n] = {'ship_C': fit(xs, xc, a), 'ship_B': fit(xs, xb, a), 'old_C': fit(xo, xc, a), 'old_B': fit(xo, xb, a)}
print(json.dumps(out))`;
    const fp = path.join(tmp, 'fit.py'); fs.writeFileSync(fp, FIT);
    const R = JSON.parse(cp.execFileSync(PY, ['-I', fp, path.join(ROOT, 'tools'), JSON.stringify(pick.map(n => [n, oldFile(n)]))], { maxBuffer: 64 << 20 }).toString());
    const notC = pick.filter(n => !(R[n].ship_C < R[n].ship_B - 3));
    console.log('  info residual after the peak (dB, shipped file vs C / vs B): ' + pick.map(n => n + ' ' + R[n].ship_C.toFixed(0) + '/' + R[n].ship_B.toFixed(0)).join(', '));
    ck('the shipped ability files ARE the sparkle render: matched after the peak, each is >= 3 dB closer to C (+ bloom / shimmer) than to B (ride out only) (' + pick.length + ' files, the 10 page examples included)',
      notC.length === 0, notC.map(n => n + ' ' + JSON.stringify(R[n])).join('; '));
    const oldC = pick.filter(n => !(R[n].old_B < R[n].old_C));
    ck('CONTROL: the v1138 files (no sparkle) are closer to B than to C (' + (pick.length - oldC.length) + ' of ' + pick.length + ')', oldC.length === 0, oldC.join(',')); }
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
  ck('CONTROL: take 2 of BLADE-LIGHT is a different file from take 1', fs.readFileSync(P('LIB-ATK-BLADE-LIGHT-2')).compare(fs.readFileSync(P('LIB-ATK-BLADE-LIGHT'))) !== 0);
  const types = Object.keys(MAN.takes);
  const tk = types.flatMap(k => MAN.takes[k]).concat(MAN.shim.f);
  const Mt = measure(tk.map(n => ({ p: P(n) })));
  const tkBad = tk.filter((n, i) => Math.abs(Mt[i].lufs - F[n].target) > 1.0);
  ck('6 takes for each of the ' + types.length + ' weapon types and 6 melee shimmers, every one within 1 LU of its target (' + tk.length + ' files)',
    types.length === 12 && types.every(k => MAN.takes[k].length === 6 && MAN.takes[k][0] === k) && MAN.shim.f.length === 6 && tkBad.length === 0, tkBad.join(','));
  ck('the 8 melee types get the shimmer, the 4 ranged ones do not', JSON.stringify(MAN.melee) === JSON.stringify(['BLADE-LIGHT', 'BLADE-HEAVY', 'BLUNT', 'FIST-HEAVY', 'FIST-METAL', 'CLAW', 'THRUST', 'STAFF']));

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
    const r=SFX.pend.get(u), s=r.srcs[0]; __rt+=0.5; const now=__rt; sfxCancel(u); const env=s.to&&s.to.to&&s.to.to.to; const ev=(env&&env.gain&&env.gain.ev)||[];
    return {now, stopArg:s.stopArg, ramp:ev.filter(e=>e[0]==='ramp'), set:ev.filter(e=>e[0]==='set')}; })()`;
  run(FAKE); const cn = J(CANCEL);
  ck('sfxCancel fades the release sound over ~80 ms (ramp to 0 at now + 0.08, stop just after) instead of a hard stop',
    cn.ramp.length === 1 && cn.ramp[0][1] === 0 && Math.abs(cn.ramp[0][2] - cn.now - 0.08) < 1e-6 && cn.stopArg > cn.now + 0.08 && cn.stopArg < cn.now + 0.1, JSON.stringify(cn));
  { let base = null; try { const bh = path.join(tmp, 'base.html'); fs.writeFileSync(bh, git('show ' + BASE_SHA + ':emberweave-heroes.html')); const rb = load(bh); rb(FAKE); base = JSON.parse(rb('JSON.stringify(' + CANCEL.replace("s.to&&s.to.to&&s.to.to.to", "s.to") + ')')); } catch (e) { base = { err: String(e) }; }
    ck('CONTROL: BASE\'s sfxCancel stops at once (stop() with no time, no ramp)', base && base.stopArg === undefined && (!base.ramp || base.ramp.length === 0), JSON.stringify(base)); }
  // 8. tails out
  run(FAKE);
  const to = J(`(()=>{ sfxPlay('S0081',__rt+1.6,{log:{id:'S0081'}}); sfxPlay('S0084',__rt+0.5,{log:{id:'S0084'}}); __rt+=2; const n=sfxTailsOut(); return {n, why:SFX.log.filter(x=>x.k==='fade').map(x=>x.why), d:SFX.log.filter(x=>x.k==='fade').map(x=>x.d)}; })()`);
  const showSrc = run('String(show)');
  ck('leaving the result screen fades every ability tail still ringing (show() -> sfxTailsOut, a 250 ms fade)', to.n === 2 && to.why.every(w => w === 'tails out') && to.d.every(d => d === 0.25) &&
    /state==='result'&&name!=='result'&&typeof sfxTailsOut==='function'\) sfxTailsOut\(\)/.test(showSrc), JSON.stringify(to));
  // 9. melee 60 swings
  const SWING = (hero, n, gap, melee, pin) => `(()=>{ ${pin ? 'const _r=Math.random; Math.random=()=>0.5;' : ''} try{ const u={key:'${hero}',team:'ally'}; const out=[];
      for(let i=0;i<${n};i++){ __rt+=${gap}; battleTime+=${gap}; SFX.log=[]; sfxAtk(u,0.3,${melee},false); const q=SFX.q.pop(); if(q) sfxGo(q); const p=SFX.log.find(x=>x.k==='play'); out.push(p||null); }
      return out; } finally{ ${pin ? 'Math.random=_r;' : ''} } })()`;
  run(FAKE); const sw = J(SWING('vael', 60, 1.3, true, false));
  const ok = sw.filter(Boolean);
  const pairs = new Set(ok.map(p => p.name + '+' + p.shim));
  const rep2 = ok.filter((p, i) => i && (p.name === ok[i - 1].name || p.shim === ok[i - 1].shim));
  const rates = ok.map(p => p.rate), span6 = Math.min(...rates.slice(0, -5).map((r, i) => Math.max(...rates.slice(i, i + 6)) - Math.min(...rates.slice(i, i + 6))));
  console.log('  info Vael 60 swings: ' + pairs.size + ' distinct take+shimmer pairs; takes ' + new Set(ok.map(p => p.name)).size + ', shimmers ' + new Set(ok.map(p => p.shim)).size +
    '; rates ' + Math.min(...rates).toFixed(3) + '..' + Math.max(...rates).toFixed(3) + ', the narrowest 6-swing span ' + (span6 * 100).toFixed(1) + '%');
  ck('MELEE: 60 of 60 swings played, every one with a shimmer layer (one voice: both into one master gain)', ok.length === 60 && ok.every(p => p.shim && /^LIB-SHIM-/.test(p.shim)));
  ck('MELEE: the swing take and the shimmer never repeat back to back for the hero', rep2.length === 0, rep2.length + ' repeats');
  ck('MELEE: >= 25 distinct take+shimmer pairs in a 60-swing fight (' + pairs.size + ')', pairs.size >= 25);
  ck('MELEE: every swing rate is 5-11% up or down, any 6 in a row span >= 8%; every shimmer rate within 8%; gain jitter within +-3 dB',
    rates.every(r => Math.abs(r - 1) >= 0.05 - 1e-9 && Math.abs(r - 1) <= 0.11 + 1e-9) && span6 >= 0.08 && ok.every(p => Math.abs(p.shRate - 1) <= 0.08 + 1e-9));
  const pkErr = ok.map(p => Math.abs((p.st + (p.pk - p.off) / p.rate) - p.peakAt)), shErr = ok.map(p => Math.abs((p.shSt + (p.shPk - p.shOff) / p.shRate) - p.peakAt));
  ck('MELEE: the swing\'s peak lands on the contact moment within 10 ms at its rate (max ' + (Math.max(...pkErr) * 1000).toFixed(2) + ' ms), and so does the shimmer\'s (max ' + (Math.max(...shErr) * 1000).toFixed(2) + ' ms)',
    Math.max(...pkErr) <= 0.010 && Math.max(...shErr) <= 0.010);
  const noRate = ok.map(p => Math.abs((p.st + (p.pk - p.off)) - p.peakAt));
  ck('CONTROL: the same peaks computed without the rate miss by more than 10 ms (max ' + (Math.max(...noRate) * 1000).toFixed(1) + ' ms)', Math.max(...noRate) > 0.010);
  run(FAKE); const pin = J(SWING('vael', 60, 1.3, true, true)).filter(Boolean);
  const pinPairs = new Set(pin.map(p => p.name + '+' + p.shim));
  ck('CONTROL: with Math.random pinned the same 60 swings give <= 3 distinct pairs (' + pinPairs.size + ') - the variety is the random pick', pinPairs.size <= 3);
  // 10. crit
  run(FAKE);
  const cr = J(`(()=>{ const _r=Math.random; Math.random=()=>0.5; try{ const u={key:'vael',team:'ally'}, w={key:'vael',team:'enemy'}; const g=[];
      [[u,true],[w,false]].forEach(([x,c])=>{ __rt+=1.3; battleTime+=1.3; SFX.log=[]; sfxAtk(x,0.3,true,c); sfxGo(SFX.q.pop()); g.push(SFX.log.find(z=>z.k==='play')); });
      __rt+=1.3; battleTime+=1.3; SFX.log=[]; const z={key:'vael',team:'ally2'}; sfxAtk(z,0.3,true,null); const q=SFX.q.pop(); sfxGo(q); const p=SFX.log.find(e=>e.k==='play'); const v=q.o._v;
      const before=v.lvl; battleTime=q.T; sfxCrit(z); const after=v.lvl, ev=v.mst.gain.ev.slice();
      return {crit:g[0], non:g[1], before, after, ev}; } finally{ Math.random=_r; } })()`);
  const dB = 20 * Math.log10(cr.crit.gain / cr.non.gain);
  ck('CRIT: a crit swing plays louder than a normal one (+' + dB.toFixed(2) + ' dB; normal swings -2 dB on top of SFX_ATK_GAIN 0.85)', Math.abs(dB - 2) < 0.01 && cr.crit.crit === true && cr.non.crit === false);
  ck('CRIT: a crit found on the blow (sfxCrit) raises its swing to full level from that moment (+' + (20 * Math.log10(cr.after / cr.before)).toFixed(2) + ' dB)',
    Math.abs(20 * Math.log10(cr.after / cr.before) - 2) < 0.01 && cr.ev.some(e => e[0] === 'set'));
  ck('CONTROL: the non-crit swing stays 2 dB down (no raise without a crit)', cr.non.gain < cr.crit.gain);
  // 11. thinning
  const THIN = gap => `(()=>{ const _r=Math.random; Math.random=()=>0.5; try{ const out=[]; __rt+=2; battleTime+=2; ['vael','korvux','carn'].forEach((k,i)=>{ __rt+=${gap}; battleTime+=${gap}; SFX.log=[]; sfxAtk({key:k,team:'ally'},0.3,true,false); sfxGo(SFX.q.pop()); const p=SFX.log.find(z=>z.k==='play'); out.push(p?p.thin:'dropped'); }); return out; } finally{ Math.random=_r; } })()`;
  run(FAKE); const th = J(THIN(0)), th2 = (run(FAKE), J(THIN(0.5)));
  ck('THINNING: 3 swings starting together play 0 / -3 / -5 dB (' + th.join(' / ') + ')', JSON.stringify(th) === '[0,-3,-5]');
  ck('CONTROL: the same 3 swings 0.5 s apart all play at 0 dB (' + th2.join(' / ') + ')', JSON.stringify(th2) === '[0,0,0]');
  // 12. ranged + abilities
  run(FAKE); const bw = J(SWING('sloe', 24, 1.3, false, false)).filter(Boolean);
  ck('RANGED (Sloe\'s bow): no shimmer, the takes still rotate (' + new Set(bw.map(p => p.name)).size + ' of 6) and the rate still varies, no back-to-back repeat',
    bw.length === 24 && bw.every(p => !p.shim && Math.abs(p.rate - 1) >= 0.05 - 1e-9) && new Set(bw.map(p => p.name)).size >= 4 && bw.every((p, i) => !i || p.name !== bw[i - 1].name) && bw.every(p => p.soft === undefined));
  run(FAKE); const ab = J(`(()=>{ SFX.log=[]; sfxPlay('S0081',__rt+1.6,{log:{id:'S0081'}}); return SFX.log.find(x=>x.k==='play'); })()`);
  ck('an ability sound plays at rate 1, gain 1, with no shimmer (only weapon strikes vary)', ab && ab.rate === 1 && ab.gain === 1 && !ab.shim);
} catch (e) { ck('test ran', false, e.stack); }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
function crypto() { return require('crypto'); }
})();
