'use strict';
// v1138 COMBAT SOUND (Phil 15 Oct 2026: "wire it all in game"; "remember sfx should match the animation"; "the slice/contact peak of the
// sword sound should meet with the sword reaching the target"; "they should all be about the same loudness, minus the ones i said i want
// slightly lower"). tools/build_sfx.py turns Phil's picks into assets/audio/sfx/*.m4a + sfx_manifest.json + the page's SFX_DATA block;
// the page hangs every sound on the moment the engine already lands the blow on its art. This test:
//   1. FILES: every picked row resolves to shipped files (none of them in BASE - new asset versions ?v=1138), every file has a measured
//      peak, the page's SFX_DATA is the manifest's, every hero with a weapon type has an attack sound, the size total.
//   2. LOUDNESS: every shipped file measured again (tools/sfx_loudness.py: max momentary loudness, BS.1770, 400 ms) sits within +-2 LU of
//      the target + its offset, true peak under -0.5 dBTP; table sorted by loudness. CONTROL: one file boosted 8 dB must fail.
//   3. ENGINE: whole fights (all 60 heroes, autoUlt both sides) driven by a 60 fps render clock exactly as loop() does, with the sound
//      path LIVE (a fake audio clock, every file "decoded", SFX.loop on) are tick-identical (hp/x/y/alive/energy/atkCd + seeded RNG draws)
//      to BASE, and to the page with sound off. CONTROLS: a moved swing (relFrac) diverges; a sound hook that touches a unit diverges.
//   4. TIMING: in those fights every scheduled sound's PEAK is within one 30 fps frame (33 ms) of the frame its moment is drawn (the blow,
//      the release, the arrival); the rule moments: Vex Razor Tempest = 3 cuts, 3 different files, on the tempest art's slash cells;
//      Grosk Croc Drop lift-off on the release + landing on the dash arrival; Hammer Fists 3 punches on the hitTimes; Ceraline pour on the
//      press, effigy shatter + Living Tallow = the Sealing Wax file; Tick Mainspring once; an archer and a caster on the release.
//      CONTROL: a file whose peak is moved 0.1 s fails the 33 ms check.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || 'c78e5525';   // the branch point: live v1137 (Maren/Orryn, Veyr 2 s, Sylthaine, Rivet) after the rebase - no sound before this
const LOG_DIR = process.env.EW_SFX_LOG || '';          // when set, the timing log of the fights is written there (the rig log)
const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/sfx/sfx_manifest.json'), 'utf8'));
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
/* v1150 (Phil 15 Oct): Aureth's autos changed ON PURPOSE - 70% physical / 30% magic, a 1.8 s swing, light/dark arms in turn. BASE gets the same
   rule written into its text (each anchor must match exactly once, or this throws and the control file is missing), so the one fight with
   Aureth still compares sound-on to the pre-sound engine; tests/test_aureth_1150.js proves every other hero is tick-identical to v1149. */
function aureth1150(h) { const R = [
  ["aureth: {name:'Aureth',    emoji:'☯️',role:'Bruiser', swing:2.4,", "aureth: {name:'Aureth',    emoji:'☯️',role:'Bruiser', swing:1.8, autoSplit:{phys:0.7,mag:0.3}, autoAlt:true,"],
  ["u._atkClip=_swCrit?'crit':null; }", "u._atkClip=_swCrit?'crit':null; } if(u.t&&u.t.autoAlt){ u._armN=((u._armN|0)+1); u._atkArm=(u._armN&1)?'attackLight':'attackDark'; if(!_swCrit) u._atkClip=(u.anim&&u.anim[u._atkArm])?u._atkArm:null; }"],
  ["dealDamage(u,t,dmg,u.hybrid?'#ffe6b0':'#fff'); } finally{ _preCrit=null; } },_fly,u._atkSpdMul);", "dealDamage(u,t,dmg,u.hybrid?'#ffe6b0':'#fff',(u.t&&u.t.autoSplit)?'split':undefined); } finally{ _preCrit=null; } },_fly,u._atkSpdMul);"],
  ["  if(kind==='magic'){ amt*=1-defToDR(Math.max(0,_shM-((src&&src.magicPen)||0)),tgt.lvl); }      // MR vs Magic Pen", "  if(kind==='magic'){ amt*=1-defToDR(Math.max(0,_shM-((src&&src.magicPen)||0)),tgt.lvl); } else if(kind==='split'){ const _sp=(src&&src.t&&src.t.autoSplit)||{phys:1,mag:0}; let _ph=amt*_sp.phys*(1-defToDR(Math.max(0,_shA-((src&&src.armorPen)||0)),tgt.lvl)); const _mg=amt*_sp.mag*(1-defToDR(Math.max(0,_shM-((src&&src.magicPen)||0)),tgt.lvl)); if((tgt.blockStat||0)>0&&brnd()<tgt.blockStat){ _ph*=0.5; floatTexts.push({x:tgt.x,y:tgt.y-8,txt:'BLOCK',t:.5,color:'#8fb7ff',vy:1.1,sz:11}); } amt=_ph+_mg; tgt._splitLast={phys:_ph,mag:_mg}; }"]];
  for (const [a, b] of R) { if (h.split(a).length !== 2) throw new Error('aureth1150: anchor not found once in BASE: ' + a.slice(0, 50)); h = h.replace(a, () => b); }
  return h; }
let OLD = null;
try { OLD = path.join(ROOT, '.test-sfx-base-control.html'); fs.writeFileSync(OLD, aureth1150(cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString()));
  const t = OLD; process.on('exit', () => { try { fs.unlinkSync(t); } catch (e) {} }); } catch (e) { OLD = null; }
const tmpFiles = [];
process.on('exit', () => tmpFiles.forEach(f => { try { fs.unlinkSync(f); } catch (e) {} }));
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };

try {
  // ---------------------------------------------------------------- 1. FILES
  const run = load(HTML);
  const D = JSON.parse(run('JSON.stringify(SFX_DATA)'));
  const files = MAN.files, rows = MAN.rows;
  const missing = Object.entries(files).filter(([n, v]) => !fs.existsSync(path.join(ROOT, 'assets/audio', v.f.split('?')[0])));
  ck('every manifest file exists under assets/audio/sfx (' + Object.keys(files).length + ' files)', missing.length === 0, missing.map(m => m[0]).join(','));
  ck('every file has a measured impact peak (seconds from its start, inside the file)', Object.values(files).every(v => typeof v.peak === 'number' && v.peak >= 0 && v.peak < v.dur));
  const picked = Object.entries(rows).filter(([, r]) => !r.none);
  const unres = picked.filter(([, r]) => !(r.files && r.files.length && r.files.every(n => files[n])));
  ck('every row with a pick resolves to shipped files (' + picked.length + ' rows; ' + (Object.keys(rows).length - picked.length) + ' marked no sound)', unres.length === 0, unres.map(u => u[0]).join(','));
  ck('every file is a new asset version (?v=1138) and none existed in BASE', Object.values(files).every(v => /\?v=1138$/.test(v.f)) &&
    !cp.execSync('git ls-tree -r --name-only ' + BASE_SHA + ' assets/audio/sfx', { cwd: ROOT }).toString().trim());
  ck("the page's SFX_DATA is the manifest's (same files, urls and peaks)", Object.keys(D.files).length === Object.keys(files).length &&
    Object.entries(files).every(([n, v]) => D.files[n] && D.files[n][0] === v.f && D.files[n][1] === v.peak) && D.v === MAN.version);
  const heroes = JSON.parse(run(`JSON.stringify(Object.keys(KITS).filter(k=>HERO_TYPES[k]&&!HERO_TYPES[k].monster))`));
  const noAtk = heroes.filter(k => !(D.heroes[k] && D.heroes[k].atk && D.files[D.heroes[k].atk]));
  ck('every hero with a weapon type has an attack sound (' + heroes.length + ' heroes)', heroes.length === 60 && noAtk.length === 0, noAtk.join(','));
  ck('every ranged Magic/Healer hero plays the caster whoosh; Sloe the bow; Rafe gun + cutlass',
    JSON.parse(run(`JSON.stringify(Object.keys(KITS).filter(k=>HERO_TYPES[k]&&!HERO_TYPES[k].monster&&HERO_TYPES[k].range>60&&['Magic','Healer'].includes(HERO_TYPES[k].damageProfile)))`))
      .every(k => D.heroes[k].atk === 'LIB-ATK-CASTER-WHOOSH') && D.heroes.sloe.atk === 'LIB-ATK-BOW' && D.heroes.rafe.atk === 'LIB-ATK-GUN' && D.heroes.rafe.melee === 'LIB-ATK-BLADE-LIGHT');
  const sizeMB = Object.values(files).reduce((s, v) => s + fs.statSync(path.join(ROOT, 'assets/audio', v.f.split('?')[0])).size, 0) / 1e6;
  console.log('  info total sound size ' + sizeMB.toFixed(2) + ' MB in ' + Object.keys(files).length + ' files (loaded per hero, per fight)');
  ck('the total stays phone-sized (< 8 MB)', sizeMB < 8, sizeMB.toFixed(2));

  // ---------------------------------------------------------------- 2. LOUDNESS
  const PY = process.env.PYTHON || 'python';
  const measure = list => JSON.parse(cp.execFileSync(PY, ['-I', '-c',
    'import json,sys; sys.path.insert(0, sys.argv[1]); import sfx_loudness as L; print(json.dumps([L.measure(p) for p in sys.argv[2:]]))',
    path.join(ROOT, 'tools'), ...list], { maxBuffer: 16 << 20 }).toString());
  const names = Object.keys(files).sort();
  const meas = measure(names.map(n => path.join(ROOT, 'assets/audio', files[n].f.split('?')[0])));
  const tbl = names.map((n, i) => ({ n, m: meas[i].lufs_m, tp: meas[i].tp_db, want: files[n].target, d: +(meas[i].lufs_m - files[n].target).toFixed(2) }));
  const off = tbl.filter(r => Math.abs(r.d) > MAN.tolerance_lu || r.tp > -0.5);
  tbl.sort((a, b) => a.m - b.m);
  console.log('  info loudness (LUFS-M, sorted): quietest ' + tbl.slice(0, 4).map(r => r.n + ' ' + r.m).join(', ') + ' ... loudest ' + tbl.slice(-3).map(r => r.n + ' ' + r.m).join(', '));
  console.log('  info target ' + MAN.target_lufs_m + ' LUFS-M; offsets ' + JSON.stringify(MAN.offsets) + '; deviation from target+offset ' +
    Math.min(...tbl.map(r => r.d)).toFixed(2) + ' .. ' + Math.max(...tbl.map(r => r.d)).toFixed(2) + ' LU; true peak max ' + Math.max(...tbl.map(r => r.tp)).toFixed(2) + ' dBTP');
  if (LOG_DIR) { fs.mkdirSync(LOG_DIR, { recursive: true }); fs.writeFileSync(path.join(LOG_DIR, 'loudness_table.txt'),
    tbl.map(r => [r.n.padEnd(22), String(r.m).padStart(7), ('target ' + r.want).padStart(13), ('dev ' + r.d).padStart(10), ('TP ' + r.tp).padStart(9)].join(' ')).join('\n') + '\n'); }
  ck('every file within +-' + MAN.tolerance_lu + ' LU of target + offset and true peak under -0.5 dBTP (' + tbl.length + ' files)', off.length === 0, JSON.stringify(off.slice(0, 5)));
  ck("Phil's quieter ones sit where he asked: fist-heavy/bow/thrust -3, caster whoosh -5, Sacred Bells -3 (vs the -16 target)",
    [['LIB-ATK-FIST-HEAVY', -3], ['LIB-ATK-BOW', -3], ['LIB-ATK-THRUST', -3], ['LIB-ATK-CASTER-WHOOSH', -5], ['S0456', -3]].every(([n, o]) => { const r = tbl.find(x => x.n === n); return r && Math.abs(r.m - (MAN.target_lufs_m + o)) <= 1; }));
  {   // CONTROL: the same check on a copy boosted 8 dB
    const src = path.join(ROOT, 'assets/audio', files['LIB-ATK-BLADE-LIGHT'].f.split('?')[0]), boosted = path.join(require('os').tmpdir(), 'sfx-boost-' + process.pid + '.m4a');
    cp.execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-af', 'volume=8dB', '-c:a', 'aac', '-b:a', '64k', boosted]); tmpFiles.push(boosted);
    const b = measure([boosted])[0];
    ck('CONTROL: a file boosted 8 dB fails the loudness check (' + b.lufs_m + ' vs target ' + files['LIB-ATK-BLADE-LIGHT'].target + ')', Math.abs(b.lufs_m - files['LIB-ATK-BLADE-LIGHT'].target) > MAN.tolerance_lu);
  }

  // ---------------------------------------------------------------- 3. ENGINE + 4. TIMING
  ck('control file (BASE emberweave-heroes.html from git ' + BASE_SHA + ') loaded, with no sound system', !!OLD && !fs.readFileSync(OLD, 'utf8').includes('SFX_DATA'));
  const DUR = JSON.stringify(Object.fromEntries(Object.entries(files).map(([n, v]) => [n, v.dur])));
  // the fake audio device: a clock (globalThis.__rt, real seconds), sources that record start(t, offset) and end on time. Nothing is output.
  const FAKE = `(()=>{ globalThis.__rt=0; globalThis.__src=[]; const dur=${DUR};
    const C={ state:'running', get currentTime(){ return globalThis.__rt; }, destination:{}, createGain(){ return {gain:{value:1},connect(){}}; },
      createBufferSource(){ const s={buffer:null,onended:null,connect(){},start(t,off){ s.t=t; s.off=off||0; s.end=t+(s.buffer?s.buffer.duration:1)-(off||0); globalThis.__src.push(s); },stop(){ s.end=0; }}; return s; } };
    SND.ctx=C; SND.out=C.createGain(); SND.bus.fx=C.createGain(); SND.cfg.fx.on=true; SND.live=0;
    for(const n in SFX_DATA.files){ SND.buf[SFX_DATA.files[n][0]]={duration:dur[n]||2}; }
    SFX.log=[]; SFX.last={}; SFX.atk=[]; return 1; })()`;
  const FIGHTS = [
    [['vex', 'grosk', 'ceraline'], ['tick', 'sloe', 'sylthaine'], 11],
    [['tick', 'ceraline', 'sloe'], ['vex', 'grosk', 'umbris'], 222],
    [['konwu', 'vulmar', 'aureth'], ['bloatus', 'vireo', 'fritz'], 5],
    [['vael', 'oakmir', 'rhukk'], ['hurne', 'meridian', 'gruel'], 77],
    [['astra', 'quorrel', 'korvux'], ['maren', 'lumi', 'hollow'], 31],
    [['rivet', 'carn', 'vesper'], ['tessit', 'linnet', 'calypsa'], 9],
    [['lysara', 'nerisse', 'nox'], ['seyla', 'vaelora', 'zahri'], 13],
    [['kharos', 'yenna', 'sorrel'], ['brannus', 'deepcleft', 'askel'], 17],
    [['tharl', 'hobb', 'orryn'], ['pellucid', 'mirelle', 'veyr'], 19],
    [['grimsby', 'dandra', 'pyroclast'], ['iver', 'absalie', 'joss'], 23],
    [['ambrel', 'tolley', 'mellan'], ['aldren', 'rafe', 'umbris'], 29],
  ];
  // one whole fight, driven frame by frame (1/60 s) by the main loop's own accumulator. live: sound path on with the fake device.
  // phone: a campaign-clock fight (BATTLE_PACE, 24.6 ticks a real second, not the replay's 30) on an uneven render clock (frames 12-21 ms, every
  // 9th a 33 ms hitch) at game speed `phone` (1 or 2) - the ticks fall between frames unevenly, as on a phone
  const fight = (r, [a, f, seed], live, mut, phone) => JSON.parse(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true; let draws=0; let lcg=${seed}*2654435761>>>0; const rnd=()=>((lcg=(Math.imul(lcg,1664525)+1013904223)>>>0)/4294967296);
    try{ ended=false; state='battle'; CUR={mode:${phone ? "'campaign',node:1" : "'replay'"},seed:${seed}}; ${phone ? 'chapterWaves=1; waveIdx=0;' : ''} battleTime=0; gameSpeed=${phone === 3 ? 1 : (phone || 1)}; groundHazards.length=0; seedBattle(${seed});
      const _r0=_brng; _brng=function(){ draws++; return _r0(); };
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      ${live ? FAKE + ';' : ''} ${mut || ''}
      window._p2guard=false; _bacc=0; const has=typeof SFX!=='undefined'; const tr=[]; const ticks=[];
      for(let fr=0; fr<60*70 && !ended; fr++){ const fdt=${phone === 3 ? '0.07' : phone ? '(fr%9===8)?0.033:(0.012+0.009*rnd())' : '1/60'}; ${live ? 'globalThis.__rt+=fdt;' : ''}
        _bacc += Math.min(fdt,0.05)*SIM_HZ*(gameSpeed||1)*((CUR.mode==='replay')?1:BATTLE_PACE);   /* the loop's own clamp: a frame over 50 ms slows the fight */ let n=Math.floor(_bacc); if(n>8)n=8; _bacc-=n;
        if(has) SFX.loop=1; try{ for(let i=0;i<n&&!ended;i++){ if(has) SFX.left=n-1-i; updateBattle(SIM_STEP); if(has&&SFX.q.length) sfxPump(); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10),Math.round((u.atkCd||0)*1000)].join(':')).join('|')+'#'+draws);
          ${live ? 'ticks.push([+battleTime.toFixed(4),globalThis.__rt]);' : ''} } if(has){ SFX.left=0; sfxFrame(); } } finally{ if(has) SFX.loop=0; }
        ${live ? 'globalThis.__src.forEach(s=>{ if(s.end&&s.end<=globalThis.__rt&&s.onended){ const o=s.onended; s.onended=null; o(); } });' : ''} }
      const out={n:tr.length, h:require_hash(tr.join('\\n'))};
      if(${live ? 1 : 0}){ out.log=SFX.log; out.rate=sfxRate(); }
      return JSON.stringify(out); } finally{ autoUlt=svA; window._p2guard=false; if(typeof SFX!=='undefined'){ SFX.loop=0; SFX.log=null; } if(typeof SND!=='undefined'){ SND.ctx=null; SND.buf={}; SND.live=0; } } })()`));
  // the vm has no crypto: hash in-page with a small FNV over the trace (the full trace is compared through it)
  const HASH = `globalThis.require_hash=function(s){ let h1=0x811c9dc5, h2=0x01000193; for(let i=0;i<s.length;i++){ const c=s.charCodeAt(i); h1=Math.imul(h1^c,16777619)>>>0; h2=Math.imul(h2+c,2246822519)>>>0; } return h1.toString(16)+':'+h2.toString(16)+':'+s.length; }; 1`;
  const runL = load(HTML), runQ = load(HTML), runB = OLD ? load(OLD) : null;
  [runL, runQ, runB].forEach(r => r && r(HASH));
  /* v1142: Carn now has a crit clip, so by the v532 crit-clip rule (engine code, unchanged) his swing crit is rolled at the wind-up - same chance,
     earlier in the battle RNG stream. BASE gets the same rule by giving its Carn a crit clip with the OLD attack timing (render data only), exactly
     as tests/test_carn_anim_eight.js / test_hurne_attack_crit.js prove it; every other difference would still diverge. */
  if (runB) runB("BATTLE_ANIM.carn=Object.assign({},BATTLE_ANIM.carn,{crit:Object.assign({},BATTLE_ANIM.carn.attack)}); 1");
  /* v1153: Aureth has a crit clip too (the both-swords X slice) - the same v532 rule, given to BASE's Aureth the same way (tests/test_aureth_anim_eleven.js) */
  if (runB) runB("BATTLE_ANIM.aureth=Object.assign({},BATTLE_ANIM.aureth,{crit:Object.assign({},BATTLE_ANIM.aureth.attack)}); 1");
  const res = FIGHTS.map(F => ({ F, live: fight(runL, F, true), quiet: fight(runQ, F, false), base: runB && fight(runB, F, false) }));
  const runP = load(HTML); runP(HASH);
  const resP = FIGHTS.map((F, i) => ({ F, live: fight(runP, F, true, '', 1 + (i % 2)) }));   // the timing runs: phone clock, speed 1 / 2 alternating
  const same = res.filter(x => x.base && x.live.h === x.base.h && x.quiet.h === x.base.h && x.live.n > 100);
  ck('whole fights (' + FIGHTS.length + ', every hero) with the sound path LIVE are tick-identical to BASE and to sound off (hp/x/y/alive/energy/atkCd + RNG draws)',
    same.length === FIGHTS.length, res.filter(x => !same.includes(x)).map(x => x.F[2] + ':' + x.live.h + '/' + x.quiet.h + '/' + (x.base && x.base.h)).join(' '));
  const plays = res.reduce((s, x) => s + x.live.log.filter(e => e.k === 'play').length, 0);
  ck('the live fights really played sound (' + plays + ' sounds scheduled)', plays > 300);
  {   // CONTROL 1: the trace sees a moved swing
    const F = FIGHTS[0]; const moved = fight(runL, F, true, `BATTLE_ANIM.vex=JSON.parse(JSON.stringify(BATTLE_ANIM.vex)); BATTLE_ANIM.vex.attack.relFrac=0.7; units.forEach(u=>{ if(u.key==='vex') u.anim=BATTLE_ANIM.vex; });`);
    ck('CONTROL: the same fight with Vex\'s swing moved (relFrac 0.7) diverges - the trace sees a timing change', moved.h !== res[0].base.h);
    const runC = load(HTML); runC(HASH);
    const leak = fight(runC, F, true, `const _sa=sfxAtk; sfxAtk=function(u,d,m){ if(u) u.atkCd+=0.001; return _sa.apply(this,arguments); };`);
    ck('CONTROL: a sound hook that touches a unit (atkCd + 0.001 per attack sound) diverges from BASE', leak.h !== res[0].base.h);
  }
  {   // a SLOW device: 70 ms frames (14 fps) - the loop's 50 ms clamp runs the fight at 0.71 of its clock; the measured clock must follow it
    const runS = load(HTML); runS(HASH); const slow = fight(runS, FIGHTS[0], true, '', 3), L = slow.log; let mx = 0, nm = 0;
    L.filter(e => e.k === 'play' && e.kind === 'attack').forEach(e => { const m = L.find(q => q.k === 'blow' && q.hero === e.hero && Math.abs(q.due - e.due) < 1e-3 && Math.abs(q.bt - e.due) < 1e-3); if (m) { nm++; mx = Math.max(mx, Math.abs(e.peakAt - m.rt)); } });
    console.log('  info slow device (14 fps): ' + nm + ' swings, worst peak-vs-frame ' + (mx * 1000).toFixed(1) + ' ms');
    ck('on a slow device (14 fps, the fight slowed by the 50 ms clamp) every swing sound still peaks within one of its frames (70 ms) of the blow', nm > 30 && mx <= 0.07 + 1e-9, (mx * 1000).toFixed(1));
  }
  // ---- timing: every scheduled moment against the frame it is drawn on
  const FRAME = 1 / 30;   // the tolerance: one frame of a 30 fps phone
  const rows2 = [];   // [hero, id, kind, error_ms, peak cell / contact cell]
  let maxErr = 0, worst = null, unmatched = 0, entered = 0, matched = 0;
  const firstAt = (ticks, bt) => { for (const [b, rt] of ticks) if (b >= bt - 1e-6) return rt; return null; };
  resP.forEach(x => {
    const L = x.live.log;
    // the frame each moment is drawn on = the frame whose ticks carry it (blow / fire / dmg notes and instant plays)
    const moments = L.filter(e => e.k === 'blow' || e.k === 'fire' || e.k === 'arrive');
    L.filter(e => e.k === 'play' && e.due != null && (e.kind === 'attack' || e.kind === 'release' || e.kind === 'land' || e.kind === 'hit')).forEach(e => {
      let m = null;
      if (e.kind === 'attack') m = moments.find(q => q.k === 'blow' && q.hero === e.hero && Math.abs(q.due - e.due) < 1e-3 && Math.abs(q.bt - e.due) < 1e-3);
      else if (e.kind === 'release') m = moments.find(q => q.k === 'fire' && q.hero === e.hero && Math.abs(q.bt - e.due) < 1e-3);
      else if (e.why === 'instant' || e.why === 'window' || e.why === 'strike') m = { rt: e.rt };   // the blow is happening on this frame
      else m = moments.find(q => q.k === 'arrive' && q.hero === e.hero && Math.abs(q.due - e.due) < 1e-3 && Math.abs(q.bt - e.due) < 1e-3);   // queued / delivery / dash: the frame it lands
      if (!m) { unmatched++; return; }
      matched++; if (e.off > 0) entered++;
      const err = e.peakAt - m.rt;
      if (Math.abs(err) > Math.abs(maxErr)) { maxErr = err; worst = e; }
      rows2.push([e.hero, e.id, e.kind, Math.round(err * 1000), e.cl ? e.cl.clip + ' cell ' + e.cl.cell + ' / contact ' + e.cl.contact : '', e.bt, m.rt, e.peakAt]);
    });
  });
  console.log('  info timing: ' + matched + ' sounds matched to the frame of their moment (' + entered + ' entered past their lead-in), ' + unmatched + ' with no damage/release on screen (the blow never landed: target dead / interrupted)');
  console.log('  info worst peak-vs-frame error ' + (maxErr * 1000).toFixed(1) + ' ms (' + (worst ? worst.hero + ' ' + worst.id + ' ' + worst.kind : '-') + ')');
  ck('every sound peak lands within one frame (33 ms) of the frame its blow / release / arrival is drawn (uneven phone frames, speed 1 and 2)', matched > 300 && Math.abs(maxErr) <= FRAME + 1e-9, (maxErr * 1000).toFixed(1) + ' ms');
  {   // v1137 Rivet's ten weapons (rivetFire / rivetHook, his rank-3 passive): each weapon blow plays his attack pick on its own fuse, on the weapon clip's contact
    const rv = rows2.filter(r => r[0] === 'rivet' && r[2] === 'attack'), wcl = new Set(rv.map(r => (r[4] || '').split(' ')[0]).filter(c => /^w_/.test(c)));
    const rvMax = rv.reduce((m, r) => Math.max(m, Math.abs(r[3])), 0);
    console.log('  info Rivet: ' + rv.length + ' weapon/attack sounds matched, weapon clips heard: ' + [...wcl].join(',') + ', worst ' + rvMax + ' ms');
    ck('Rivet - his weapon blows sound (rivetFire hook) on his weapon clips, each peak within one frame (33 ms) of its blow', rv.length >= 5 && wcl.size >= 2 && rvMax <= 34, rv.length + ' / ' + [...wcl].join(',') + ' / ' + rvMax);
  }
  {   // CONTROL: a file whose peak is off by 0.1 s (the manifest lying about it) - the same check catches it
    const e = resP[0].live.log.find(q => q.k === 'play' && q.kind === 'attack');
    const m = e && resP[0].live.log.find(q => q.k === 'blow' && q.hero === e.hero && Math.abs(q.due - e.due) < 1e-3);
    ck('CONTROL: a sound started from a peak 0.1 s wrong misses its blow frame by more than 33 ms', !!m && Math.abs((e.st + e.pk + 0.1) - m.rt) > FRAME);
  }
  const atkCells = rows2.filter(r => r[2] === 'attack' && r[4]);
  // ---- the rule moments
  const L0 = res[0].live.log, L1 = res[1].live.log;
  const plays0 = L0.concat(L1).filter(e => e.k === 'play');
  const vex = plays0.filter(e => e.hero === 'vex' && e.id === 'S0408');
  const vexRel = L0.concat(L1).filter(e => e.k === 'fire' && e.hero === 'vex' && e.slot === 'ult');
  const cutsOk = vexRel.length > 0 && vexRel.every(f => { const c = vex.filter(e => Math.abs(e.rt - f.rt) < 1e-6); const at = MAN.rows.S0408.at;
    return c.length === 3 && new Set(c.map(e => e.name)).size === 3 && c.every((e, i) => e.name === 'S0408-' + (i + 1) && Math.abs(e.peakAt - (f.rt + at[i])) < 1e-3); });
  ck('Vex Razor Tempest: every ult = 3 cuts, 3 different files (CUT1/2/3), each peak on its slash cell (2 / 19 / 39 of the tempest art at 12 fps from the release)', cutsOk, vex.length + ' cuts / ' + vexRel.length + ' ults');
  const gU = plays0.filter(e => e.hero === 'grosk' && (e.id === 'S0015' || e.id === 'S0016'));
  ck('Grosk Croc Drop: lift-off (S0015) on the release and landing (S0016) on the dash arrival, both every ult', gU.some(e => e.id === 'S0015' && e.kind === 'release') && gU.some(e => e.id === 'S0016' && e.kind === 'land' && e.why === 'dash'));
  const gB = plays0.filter(e => e.hero === 'grosk' && e.id === 'S0014');
  const gRuns = gB.map(e => e.n).join(',').replace(/1,2,3(,|$)/g, '');   // every cast = punch 1, 2, 3 (a cast the fight's end cut short may be partial)
  ck('Grosk Hammer Fists: the one file on each of the 3 punches (queued on the hitTimes hazards)', gB.length >= 3 && gB.every(e => e.why === 'queued' && e.name === 'S0014') && /^(1(,2)?)?$/.test(gRuns), gB.map(e => e.n).join(','));
  const ce = plays0.filter(e => e.hero === 'ceraline');
  ck('Ceraline: Court of the Final Candle pour on the press (S0465); Sealing Wax (S0460); each effigy shatter (S0468, on its damage) and Living Tallow (S0469) play the Sealing Wax file',
    ce.some(e => e.id === 'S0465' && e.kind === 'cast') && ce.some(e => e.id === 'S0460') && MAN.rows.S0468.files[0] === 'S0460' && MAN.rows.S0469.files[0] === 'S0460' &&
    (ce.some(e => e.id === 'S0468') || console.log('  info  (no shatter landed in these fights)') || true));
  const tk = plays0.filter(e => e.hero === 'tick' && e.id === 'S0034');
  const tkCasts = L0.concat(L1).filter(e => e.k === 'fire' && e.hero === 'tick' && e.slot === 'blue').length;
  ck('Tick Mainspring: the 5-punch composite plays once per cast (the five blows land on one tick)', tk.length > 0 && tk.length <= tkCasts, tk.length + ' plays / ' + tkCasts + ' casts');
  ck('an archer (Sloe, bow) and casters (Sylthaine / Ceraline / Umbris, whoosh) play their weapon sound on the release',
    plays0.some(e => e.hero === 'sloe' && e.name === 'LIB-ATK-BOW') && plays0.some(e => (e.hero === 'sylthaine' || e.hero === 'ceraline') && e.name === 'LIB-ATK-CASTER-WHOOSH'));
  // coverage: which picked rows played in the 11 fights
  const fired = new Set(); res.forEach(x => x.live.log.forEach(e => { if (e.k === 'play' && e.id) fired.add(e.id); }));
  const heroRows = picked.filter(([, r]) => r.slot !== 'attack');
  const notFired = heroRows.filter(([id]) => !fired.has(id)).map(([id, r]) => id + ' ' + r.hero + ' ' + r.slot + ' ' + r.rule);
  console.log('  info rows heard in the 11 fights: ' + (heroRows.length - notFired.length) + ' / ' + heroRows.length + (notFired.length ? '; not triggered in these fights: ' + notFired.join('; ') : ''));
  const drops = res.reduce((s, x) => s + x.live.log.filter(e => e.k === 'drop').length, 0);
  console.log('  info noise control dropped ' + drops + ' sounds (attack density / same file within 60 ms / ' + 10 + ' at once)');
  // ---- every hero, every slot, cast on its own (3 foes in front, 2 hurt allies): which rows sound, and each one's moment
  const CAST = `(()=>{ const out={}; const heroes=${JSON.stringify(heroes)};
    for(const k of heroes){ for(const slot of ['green','blue','ult']){ try{
      window._p2guard=true; ended=false; state='battle'; CUR={mode:'replay',seed:7}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(7);
      const g=makeUnit(k,'ally',420,700,30,{owned:false,rank:5});
      const al=[makeUnit('vael','ally',380,640,30,{owned:false}),makeUnit('grosk','ally',380,760,30,{owned:false})];
      const fo=[makeUnit('vael','enemy',520,700,30,{owned:false}),makeUnit('grosk','enemy',560,650,30,{owned:false}),makeUnit('sloe','enemy',640,750,30,{owned:false})];
      units=[g].concat(al,fo); units.forEach(u=>buildFigure(u));
      ${FAKE};
      window._p2guard=false; _bacc=0;
      al.forEach(a=>{ a.hp=a.maxHp*0.25; a.stunned=0.6; }); fo.forEach(e=>{ e.maxHp=e.hp=1e7; });
      const hold=()=>{ units.forEach(u=>{ if(u!==g){ if(u.team===g.team) u.atkCd=99; u.greenCd=u.blueCd=99; u.energy=0; u.speed=0; } });   /* the foes swing (a counter needs a blow to answer), never cast */ g.greenCd=g.blueCd=99; g.atkCd=99; if(slot!=='ult') g.energy=0; };
      hold(); g.target=fo[0];
      SFX.loop=1; try{ if(slot==='ult'){ g.energy=100; castAbility(g); } else { const ab=slot==='blue'?g.blueAb:g.greenAb; if(ab){ g._castSM=1; g._castLv=1; castKit(g,ab); g._castSM=1; g._castLv=0; } } } finally{ SFX.loop=0; }
      for(let fr=0; fr<60*7; fr++){ globalThis.__rt+=1/60; _bacc += (1/60)*SIM_HZ*((CUR.mode==='replay')?1:BATTLE_PACE); let n=Math.floor(_bacc); if(n>8)n=8; _bacc-=n;
        SFX.loop=1; try{ for(let i=0;i<n;i++){ SFX.left=n-1-i; hold(); updateBattle(SIM_STEP); if(SFX.q.length) sfxPump(); } SFX.left=0; sfxFrame(); } finally{ SFX.loop=0; }
        globalThis.__src.forEach(q=>{ if(q.end&&q.end<=globalThis.__rt&&q.onended){ const o=q.onended; q.onended=null; o(); } }); }
      out[k+'.'+slot]=SFX.log.filter(e=>e.k==='play'&&e.hero===k&&e.kind!=='attack').map(e=>[e.id,e.kind,e.why||'',+e.bt.toFixed(3)]);
    }catch(err){ out[k+'.'+slot]='ERR '+err.message; } finally{ window._p2guard=false; SFX.loop=0; SFX.log=null; SND.ctx=null; } } }
    return JSON.stringify(out); })()`;
  const runK = load(HTML); const cast = JSON.parse(runK(CAST));
  const errs = Object.entries(cast).filter(([, v]) => typeof v === 'string');
  ck('every hero casts every slot on its own without an error in the sound path', errs.length === 0, errs.slice(0, 4).map(e => e.join(' ')).join('; '));
  const silent = [];
  picked.forEach(([id, r]) => { if (r.slot === 'passive' || r.slot === 'attack') return; const got = cast[r.hero + '.' + r.slot];
    if (!Array.isArray(got) || !got.some(e => e[0] === id)) silent.push(id + ' ' + r.hero + ' ' + r.slot + ' ' + r.rule + ' (' + (r.timing || '') + ')'); });
  ck('every green / blue / ult row sounds when its spell is cast (' + picked.filter(([, r]) => r.slot !== 'passive').length + ' rows)', silent.length === 0, silent.join('; '));
  if (LOG_DIR) fs.writeFileSync(path.join(LOG_DIR, 'node_every_cast.json'), JSON.stringify(cast, null, 1));
  if (LOG_DIR) {
    fs.writeFileSync(path.join(LOG_DIR, 'node_fights_timing.tsv'), ['hero\tsound\tkind\tpeak_minus_frame_ms\tclip cell at peak / contact cell\tqueued_bt\tframe_rt\tpeak_rt'].concat(rows2.map(r => r.join('\t'))).join('\n') + '\n');
    fs.writeFileSync(path.join(LOG_DIR, 'node_fights_log.json'), JSON.stringify(resP.map(x => ({ fight: x.F, rate: x.live.rate, log: x.live.log }))));
    console.log('  info rig log written to ' + LOG_DIR);
  }
  console.log('  info attack swings with a clip: ' + atkCells.length + '; drawn cell at the sound peak - contact cell: ' +
    JSON.stringify(atkCells.reduce((h, r) => { const m = /cell (-?\d+) \/ contact (\d+)/.exec(r[4]); const d = m ? (+m[1] - +m[2]) : 'na'; h[d] = (h[d] || 0) + 1; return h; }, {})));
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
