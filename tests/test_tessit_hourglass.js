'use strict';
// v1189 (built as v1134; re-cut 17 Oct to the 2048 phone cap) - Tessit's Hourglass ult FX (Grok s11, Phil-approved 12 Oct 2026): the hourglass SHATTERS on the land / damage tick, the sand stays
// FROZEN in the air through the stun, then falls; the lingering hourglass fades by alpha (no redraw). Standing on the 4.3 m stun circle's
// centre, the frozen cloud = the circle's diameter. It replaces the (no-op since v554) blue burst for this ult only.
// THE ART IS TIMED TO THE ENGINE, NOT THE OTHER WAY ROUND:
//   1. the ult's numbers (ULT_DEF.aoeStun, deliver 'land', fall 0.55) are unchanged;
//   2. CONTROL against main before this change (git show BASE): the same scripted ults (enemies inside / on / outside the circle) and whole
//      fights through server/sim-host.js (the file the server replays with) land every hit and stun on the same tick with the same numbers;
//   3. the art starts ON the damage tick with the stun the case actually left (ccDur-shortened), its cells follow the approved plan;
//   4. controls: BASE has none of the art (those checks fail there), a moved stun / radius is caught by the trace.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || '551eebd8';   // live v1184 (on v1186), before this change
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-tessit-base-control.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
  const tmp = OLD; process.on('exit', () => { try { fs.unlinkSync(tmp); } catch (e) {} }); } catch (e) { OLD = null; } }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML);
const R0 = OLD ? load(OLD) : null;
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
function webpSize(file) {
  const b = fs.readFileSync(file); const tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  return null;
}
// the art checks, run on any file: returns the names that fail (BASE must fail them all)
function artChecks(r) {
  const bad = [];
  const F = r("JSON.stringify({d:(typeof FX2_DEF!=='undefined'&&FX2_DEF.tessithourglass)||null,a:HERO_ULT_ART.tessit,w:(typeof FX1123_WARM!=='undefined'&&FX1123_WARM.tessit)||null,f:typeof tessitHourglassFx})");
  const o = JSON.parse(F);
  if (!o.d || o.d.u !== '/assets/anim/fx/tessit_hourglass_17oct.webp?v=1189') bad.push('sheet entry'); else {
    const f = path.join(ROOT, o.d.u.split('?')[0]), sz = fs.existsSync(f) ? webpSize(f) : null;
    if (!sz || sz[0] !== o.d.fw * o.d.cols || sz[1] !== o.d.fh * o.d.rows || o.d.n > o.d.cols * o.d.rows || sz[0] > 2048 || sz[1] > 2048 || fs.statSync(f).size > 4e6) bad.push('sheet file != grid, or over the phone cap (2048 px, 4 MB) ' + sz);
    if (!(o.d.holdA === 28 && o.d.holdB === 49 && o.d.fall === 50 && o.d.fadeA === 64 && o.d.n === 74)) bad.push('cell plan'); }
  if (!o.a || o.a.ownFx !== 'hourglass' || o.a.deliver !== 'land') bad.push('ult art flag');
  if (JSON.stringify(o.w) !== JSON.stringify(['tessithourglass'])) bad.push('warm with her figure');
  if (o.f !== 'function') bad.push('helper');
  return bad;
}
// one scripted Tessit ult, aimed at (700,700); enemies at the given offsets; records every hit (time, target, amount, stun left) and the art call
const SCRIPT = offs => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(7);
  const g=makeUnit('tessit','ally',300,700,30,{owned:false,rank:3}); units=[g];
  ${JSON.stringify(offs)}.forEach((d,i)=>units.push(makeUnit(['vael','grosk','umbris','tick'][i%4],'enemy',700+d[0],700+d[1],30,{owned:false})));
  units.forEach(u=>{u.maxHp=u.hp=1e9; u.atkCd=99; u.energy=0; u.speed=0; u.greenCd=u.blueCd=99;});
  const hits=[], art=[], _dd=dealDamage; dealDamage=function(s,t,amt){ if(s===g) hits.push([+battleTime.toFixed(4),units.indexOf(t),Math.round(amt)]); return _dd.apply(this,arguments); };
  const _hf=(typeof tessitHourglassFx==='function')?tessitHourglassFx:null; if(_hf) tessitHourglassFx=function(x,y,R,st){ art.push([+battleTime.toFixed(4),x,y,+(R/METER).toFixed(3),+st.toFixed(4)]); return _hf.apply(this,arguments); };
  const stun=[];
  try{ g.energy=100; g._aimWX=700; g._aimWY=700; castAbility(g);
    for(let i=0;i<Math.round(4/SIM_STEP);i++){ updateBattle(SIM_STEP); units.forEach(u=>{u.hp=u.maxHp; if(u!==g){u.atkCd=99; u.speed=0;}}); stun.push(units.slice(1).map(u=>+(u.stunned||0).toFixed(3)).join('/')); } }
  finally{ dealDamage=_dd; if(_hf) tessitHourglassFx=_hf; }
  return JSON.stringify({hits,art,stun:stun.join('|')}); })()`;
const act = (r, offs) => JSON.parse(r(SCRIPT(offs)));
const trace = (r, seed, a, f) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.stunned||0)*100)].join(':')).join('|')); }
      return tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');
try {
  // 1. the ult's numbers
  const nums = r => r("JSON.stringify([ULT_DEF.aoeStun,HERO_TYPES.tessit,KITS.tessit,ULT_RADIUS.includes('aoeStun')])");
  ck('control file (BASE emberweave-heroes.html from git) loaded', !!R0, 'git show failed');
  ck('Hourglass numbers identical to BASE (mul 1.4, stun 2, radius 120 = 4.26 m, land after 0.55 s)', R0 && nums(run) === nums(R0) && run('ULT_DEF.aoeStun.radius') === 120, nums(run));
  const artNow = run('JSON.stringify(HERO_ULT_ART.tessit)'), artOld = R0 && R0('JSON.stringify(HERO_ULT_ART.tessit)');
  ck("HERO_ULT_ART.tessit only gains ownFx:'hourglass' (deliver 'land' kept)", JSON.stringify(Object.assign(JSON.parse(artOld || '{}'), { ownFx: 'hourglass' })) === artNow, artNow + ' vs ' + artOld);

  // 2. CONTROL: scripted ults and whole fights on BASE
  const sets = [[[0, 0], [60, 30], [-50, -40]], [[0, 0], [115, 0], [125, 0]], [[200, 0]]];
  const got = [];
  for (const offs of sets) {
    const a = act(run, offs), b = R0 ? act(R0, offs) : null; got.push(a);
    ck('ult with enemies at ' + JSON.stringify(offs) + ': every hit and stun on the same tick with the same numbers as BASE',
      b && JSON.stringify(a.hits) === JSON.stringify(b.hits) && a.stun === b.stun, JSON.stringify({ now: a.hits, base: b && b.hits }));
  }
  const fights = [[['tessit', 'vael', 'astra'], ['grosk', 'umbris', 'tick'], 11], [['vesper', 'tessit'], ['tessit', 'rhukk', 'iver'], 222]];
  ck('whole fights (autoUlt, Tessit on both sides) are tick-for-tick identical to BASE (hp, position, alive, stun)',
    R0 && fights.every(([a, f, s]) => trace(run, s, a, f) === trace(R0, s, a, f)));
  ck("CONTROL: the same fights with Tessit's stuns cut by a quarter diverge - the trace sees a CC change",
    R0 && fights.some(([a, f, s]) => { run("globalThis.__sv=ccApply; ccApply=function(u,t,field,dur){ return globalThis.__sv.call(this,u,t,field,(u&&u.key==='tessit'&&field==='stunned')?dur*0.75:dur); }; 1");
      try { return trace(run, s, a, f) !== trace(R0, s, a, f); } finally { run('ccApply=globalThis.__sv; 1'); } }));

  // 3. the art lands on those moments
  const bad = artChecks(run);
  ck('sheet tessit_hourglass_17oct.webp exists, file = declared grid (9x9, 74 cells of 225x227), within the phone cap (2048 px, 4 MB), new file at ?v=1189; ownFx flag; warms with her figure', bad.length === 0, bad.join('; '));
  const g0 = got[0], tick = g0.hits.length ? g0.hits[0][0] : null;
  ck('the art starts ON the damage tick (one call, the same battleTime as the hits), on the aim point, radius 4.26 m',
    g0.art.length === 1 && g0.art[0][0] === tick && g0.art[0][1] === 700 && g0.art[0][2] === 700 && Math.abs(g0.art[0][3] - 120 / 28.2) < 1e-3, JSON.stringify(g0.art) + ' tick ' + tick);
  const st = g0.art.length ? g0.art[0][4] : -1, ccd = run('ccDur(2)');
  ck('its frozen sand holds for the stun the case actually left (ccDur(2) = ' + ccd + ' s, v818), not the nominal 2 s', Math.abs(st - ccd) < 1e-6, 'art stun ' + st);
  ck('no enemy in the circle: the art still plays, its hold 0 (the shatter then the fall)', got[2].hits.length === 0 && got[2].art.length === 1 && got[2].art[0][4] === 0, JSON.stringify(got[2]));
  const cells = JSON.parse(run(`(()=>{ const d=FX2_DEF.tessithourglass, S=${ccd}, o={d,t:0,stunT:S}, a=d.holdA/d.fps*FX_RT, out=[];
    for(const t of [0, a-1e-6, a+1e-6, (a+S)/2, S-1e-6, S+1e-6, S+(d.fadeA-d.fall)/d.fallFps*FX_RT+1e-6, S+(d.n-d.fall)/d.fallFps*FX_RT-1e-4, S+(d.n-d.fall)/d.fallFps*FX_RT+1e-4]){ o.t=t; out.push(+_fx22HourCell(o).toFixed(3)); }
    return JSON.stringify(out); })()`));
  ck('cells: shatter 0..27 at 24 fps from the tick, frozen 28..49 stretched to the stun end, the fall from cell 50, fade from 64, gone at 74',
    cells[0] === 0 && Math.floor(cells[1]) === 27 && cells[2] === 28 && cells[3] > 28 && cells[3] < 49 && cells[4] === 49 && Math.floor(cells[5]) === 50 && Math.floor(cells[6]) === 64 && Math.floor(cells[7]) === 73 && cells[8] >= 74, JSON.stringify(cells));
  const short = JSON.parse(run(`(()=>{ const d=FX2_DEF.tessithourglass, o={d,t:0.3,stunT:0.2}; return JSON.stringify([_fx22HourCell(o)]); })()`));
  ck('a stun shorter than the shatter: the shatter plays whole, no hold, no negative time', short[0] >= 0 && short[0] < 28, JSON.stringify(short));
  const src = run("[_fx22HourCell,_fx22HourPos,tessitHourglassFx].map(f=>f.toString()).join('\\n')");
  const writes = s => /\b(?:e|u|t|tgt|units\[[^\]]*\])\.(?:hp|x|y|stunned|silencedT|energy|alive|shield|_castT)\s*[-+*]?=(?!=)|ccApply\(|dealDamage\(|groundHazards\.push/.test(s);
  ck('the art code touches no fight state (no unit field, CC, damage or hazard write in its helpers)', !writes(src));
  ck('control: that scan catches a write', writes(src + '\nfunction x(){ e.stunned=0; }') && writes('ccApply(u,e,"stunned",1)'));
  const snap = "JSON.stringify(units.map(x=>[x.key,x.hp,x.x,x.y,x.stunned||0,x.energy]))+'|'+battleTime+'|'+groundHazards.length";
  ck('the helper and its tick (on the replay host stub scene) leave every unit, the clock and the hazards untouched',
    run(`(()=>{ units=[]; seedBattle(3); clearFx1123(); const e=makeUnit('vael','enemy',600,600,30,{owned:false}); units=[e]; const a=${snap}; tessitHourglassFx(600,600,120,1.4); for(let i=0;i<40;i++) updateFx1123(0.1); const b=${snap}; const n=_fx1123.length; clearFx1123(); return a===b&&n===0; })()`) === true);

  // 4. BASE has none of it
  const badOld = R0 ? artChecks(R0) : [];
  ck('CONTROL: BASE fails every art check (' + badOld.length + '/4: ' + badOld.join(', ') + ')', badOld.length === 4);
  ck('CONTROL: BASE draws no hourglass on the tick', R0 && act(R0, sets[0]).art.length === 0);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
