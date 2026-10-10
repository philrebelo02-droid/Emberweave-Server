'use strict';
// v1115 - Grok spell FX 22-24 (Phil-approved 10 Oct, Grok handoff 17:46): Mourning Bell ring + wax shatter (Ceraline), Hookline throw/reel
// + slash and Bleed Them Dry wound (Vex). Runs the real battle engine headless (server/sim-host.js, the file the server replays with).
//   - the five sheets are on disk and their grids are what FX2_DEF says;
//   - Hookline: the hook bites at clip 0.333 s and Vex is reeled in ONLY while the rope retracts (clip 0.458 -> 0.958 s = 0.308 -> 0.644
//     fight s at FX_RT 0.6724), on the rope tail's measured curve; the strike lands when she lands, behind the mark; numbers unchanged;
//   - Mourning Bell: the ring pulse plays on the damage moment; the shatter art plays where a coat breaks; Bleed Them Dry opens the wound;
//   - CONTROLS: v1114's instant teleport (she moved and struck at the cast) fails the timing checks; the art code touches no fight state.
// One line per check; exit code = number of failures.  Run on another copy: HTML=<path> node tests/test_vex_ceraline_fx_1115.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.HTML || path.join(ROOT, 'emberweave-heroes.html');
const H = fs.readFileSync(HTML, 'utf8');
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? ' - ' + detail : '')); } };
const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-9);

// ---------------------------------------------------------------- sheets
function webpSize(f) { const b = fs.readFileSync(f); if (b.toString('ascii', 12, 16) !== 'VP8L') return null;
  const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
const SHEETS = { bellring: 'ceraline_bell_ring', waxshatter: 'ceraline_wax_shatter', hookreel: 'vex_hook_reel', hookslash: 'vex_hook_slash', bleedopen: 'vex_bleed_open' };
for (const [k, file] of Object.entries(SHEETS)) {
  const m = H.match(new RegExp('\\n\\s*' + k + ":\\{u:'/(assets/anim/fx/" + file + "\\.webp)\\?v=\\d+',n:(\\d+),fw:(\\d+),fh:(\\d+),cols:(\\d+),rows:(\\d+)"));
  const f = m && path.join(ROOT, m[1]), sz = f && fs.existsSync(f) && webpSize(f);
  ck(`${k}: ${file}.webp on disk, ${m ? m[2] : '?'} cells fit ${m ? m[5] + 'x' + m[6] : '?'}, sheet = cols*fw x rows*fh, <= 4096`,
    !!(m && sz && +m[2] <= +m[5] * +m[6] && sz[0] === +m[3] * +m[5] && sz[1] === +m[4] * +m[6] && sz[0] <= 4096 && sz[1] <= 4096), JSON.stringify(sz));
}

const host = require(path.join(ROOT, 'server/sim-host.js')).load(HTML);
const run = src => vm.runInContext(src, host.ctx);

// ---------------------------------------------------------------- the clock
const has = n => run(`typeof ${n}`) !== 'undefined';
const FXRT = has('FX_RT') ? run('FX_RT') : NaN;
ck('FX_RT = SIM_STEP*SIM_HZ*BATTLE_PACE = 0.6724 (Grosk hitTimes conversion: clips real time, fight clock 0.6724 of it)', near(FXRT, run('SIM_STEP*SIM_HZ*BATTLE_PACE')) && near(FXRT, 0.6724, 1e-9), FXRT);
const REEL = has('HOOK_REEL') ? run('JSON.stringify(HOOK_REEL)') : '[]', R = JSON.parse(REEL);
const LAND = has('HOOK_LAND') ? run('HOOK_LAND') : NaN;
ck('HOOK_REEL is the measured retract: starts after the bite (0.4583 > 0.3333), the tail stops at the hook shank (0.793 of Vex->bite) at 0.9583 s, monotonic; landing 1.0833 s',
  R.length > 2 && R[0][0] > run('typeof HOOK_BITE==="number"?HOOK_BITE:9') && near(R[0][0], 0.4583) && near(R[R.length - 1][0], 0.9583) && near(R[R.length - 1][1], 0.7932) && near(LAND, 1.0833) && R.every((p, i) => !i || (p[0] > R[i - 1][0] && p[1] >= R[i - 1][1])), REEL);

// ---------------------------------------------------------------- Hookline in the real engine
// rolls pinned (_brng 0.999: no crit, no dodge) so the path, the hit and the reference strike compare exactly
const hook = () => JSON.parse(run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; _brng=()=>0.999;
  const u=makeUnit('vex','ally',300,700,20,{owned:false}), e=makeUnit('ceraline','enemy',300+15*METER,760,20,{owned:false});
  units=[u,e]; units.forEach(x=>{ x.atkInterval=99; x.atkCd=99; x.speed=0; x.greenAb=null; x.blueAb=null; x.energy=0; x.ultAb=null; });
  e.maxHp=e.hp=1e7; u._castSM=1; u._castLv=1; u._castSlot='green';
  const x0=u.x, y0=u.y, ab=Object.assign({},KITS.vex.green);
  const ex=e.x, ey=e.y, dx=ex-x0, dy=ey-y0, L=Math.hypot(dx,dy), gap=0.9*METER;
  const want=[Math.max(60,Math.min(FW-60,ex+dx/L*gap)), Math.max(80,Math.min(FD-60,ey+dy/L*gap))];
  const hp0=e.hp; doEffect(u,'hookline',ab); const castT=u._castT;
  const tr=[[0,u.x,u.y,hp0-e.hp]];
  for(let i=1;i<=40;i++){ updateBattle(SIM_STEP); tr.push([i*SIM_STEP,u.x,u.y,hp0-e.hp]); }
  return JSON.stringify({x0,y0,ex,ey,want,tr,castT}); })()`));
const A = hook(), B = hook();
const moved = r => Math.hypot(r[1] - A.x0, r[2] - A.y0) > 1e-6;
const firstMove = A.tr.find(moved), firstHit = A.tr.find(r => r[3] > 0), lastPt = A.tr[A.tr.length - 1];
const step = run('SIM_STEP'), tStart = R.length ? R[0][0] * FXRT : 0.308, tRet = R.length ? R[R.length - 1][0] * FXRT : 0.644, tEnd = (LAND || 1.0833) * FXRT;
ck(`CONTROL Vex holds still while the hook flies and bites (no movement before ${tStart.toFixed(3)} fight s; v1114 teleported at the cast)`, !!firstMove && firstMove[0] > tStart - 1e-9, firstMove && firstMove[0]);
ck(`she starts moving within one tick of the retract start (${tStart.toFixed(3)} s)`, !!firstMove && firstMove[0] <= tStart + step + 1e-9, firstMove && firstMove[0]);
// past the mark along her approach line = behind it (v578); the body-collision floor then settles her (same as v1114's teleport)
const behind = r => ((r[1] - A.ex) * (A.ex - A.x0) + (r[2] - A.ey) * (A.ey - A.y0)) > 0;
const along = r => ((r[1] - A.x0) * (A.ex - A.x0) + (r[2] - A.y0) * (A.ey - A.y0)) / Math.hypot(A.ex - A.x0, A.ey - A.y0);
{ const k = Math.ceil(tEnd / step - 1e-9), r = A.tr[k], r1 = A.tr[k - 1], goal = along([0, A.want[0], A.want[1]]);
  ck(`she arrives on the retract end (${tEnd.toFixed(3)} s): at the landing on tick ${k}, still short of it the tick before`, !!r && along(r) >= goal - 1e-6 && along(r1) < goal - 0.5, JSON.stringify([r1, r, goal])); }
ck('she lands BEHIND the mark (past it on her approach line, as v578) and stays there', behind(lastPt) && A.tr.slice(Math.ceil(tEnd / step - 1e-9)).every(behind), JSON.stringify(lastPt));
{ // she rides the rope tail: at each tick inside the retract, her distance from the start = tail fraction x her distance to the mark
  const AB = Math.hypot(A.ex - A.x0, A.ey - A.y0); let worst = 0, n = 0;
  for (const r of A.tr) { if (r[0] <= tStart || r[0] > tRet) continue; const c = r[0] / FXRT; let f = R.length ? R[R.length - 1][1] : 1; n++;
    for (let i = 1; i < R.length; i++) if (c <= R[i][0]) { f = R[i - 1][1] + (R[i][1] - R[i - 1][1]) * (c - R[i - 1][0]) / (R[i][0] - R[i - 1][0]); break; }
    worst = Math.max(worst, Math.abs(Math.hypot(r[1] - A.x0, r[2] - A.y0) / AB - f)); }
  ck(`she rides the rope tail through the retract (${n} ticks): her share of the way to the mark = the tail's measured position (max error < 0.01)`, n >= 10 && worst < 0.01, worst.toFixed(4)); }
ck(`CONTROL the strike lands when she lands (${tEnd.toFixed(3)} s), not at the cast (v1114 struck at t = 0)`, !!firstHit && firstHit[0] >= tEnd - 1e-9 && firstHit[0] <= tEnd + step + 1e-9, firstHit && firstHit[0]);
ck('she is rooted in the cast until she lands (_castT covers the reel)', A.castT >= tEnd - 1e-9, A.castT);
ck('deterministic: the same cast gives the same path and hit on every tick', JSON.stringify(A.tr) === JSON.stringify(B.tr), JSON.stringify(A.tr.map((r, i) => JSON.stringify(r) === JSON.stringify(B.tr[i]) ? null : [r, B.tr[i]]).filter(Boolean).slice(0, 2)));
{ // the strike is the same number: one strike of dB x 1.6 x 1.5 (rageMul 1), compared with the engine's own dealDamage on a twin target
  const ref = JSON.parse(run(`(()=>{ units=[]; groundHazards.length=0; _brng=()=>0.999; const u=makeUnit('vex','ally',300,700,20,{owned:false}), e=makeUnit('ceraline','enemy',300+15*METER,760,20,{owned:false});
    units=[u,e]; e.maxHp=e.hp=1e7; const h0=e.hp; dealDamage(u,e,u.dmg*1.6*1.5*rageMul,'#c9a6ff'); return JSON.stringify(h0-e.hp); })()`));
  ck('the strike is unchanged: one hit = dealDamage(dB x mul 1.6 x crit 1.5)', near(lastPt[3], ref, 1e-6), lastPt[3] + ' vs ' + ref); }
ck('Hookline numbers unchanged (mul 1.6, crit 1.5, cd 8, range 28 m, evade 0.5)', /vex:\{green:\{name:'Hookline',type:'hookline',mul:1\.6,crit:1\.5,cd:8,range:28\*METER,evade:0\.5,/.test(H));
ck('Bleed Them Dry numbers unchanged (mul 1.2, dps 0.30, dur 6, interval 1, cd 9)', /blue:\{name:'Bleed Them Dry',type:'dot',mul:1\.2,dps:0\.30,dur:6,interval:1,color:'#c0392b',cd:9,/.test(H));
ck('Mourning Bell numbers unchanged (form, cluster, mul 1.0, radius 8 m, detonate 0.8, cd 9)', /blue:\{deliver:'form',name:'Mourning Bell',type:'nova',at:'cluster',mul:1\.0,radius:8\*METER,detonate:0\.8,cd:9,/.test(H));
ck('a plain dash (Croc Drop, KonWu) is still linear: ease only when a dash carries one', H.includes('const _k=Math.min(1,_D.t/_D.dur), _f=_D.ease?_D.ease(_k):_k;'));

// ---------------------------------------------------------------- art calls (stubbed to record), in the real engine
let art; try { art = JSON.parse(run(`(()=>{ const log=[]; const keep={b:bellCastFx,s:waxShatterFx,w:vexWoundFx,r:hookReelFx,h:hookSlashFx};
  bellCastFx=(x,y)=>log.push(['bell',Math.round(x),Math.round(y)]); waxShatterFx=m=>log.push(['shatter',m.key,m._waxCoatT]); vexWoundFx=(e,l,c)=>log.push(['wound',e.key,l,c]);
  hookReelFx=(u,e)=>log.push(['reel',u.key,e.key]); hookSlashFx=e=>log.push(['slash',e.key]);
  try{ units=[]; groundHazards.length=0; _brng=()=>0.999;
    const c=makeUnit('ceraline','ally',300,700,20,{owned:false}), e=makeUnit('vex','enemy',300+6*METER,700,20,{owned:false}), f=makeUnit('vael','enemy',300+6*METER,760,20,{owned:false});
    units=[c,e,f]; units.forEach(x=>{ x.atkInterval=99; x.speed=0; x.greenAb=null; x.blueAb=null; x.ultAb=null; }); e.maxHp=e.hp=f.maxHp=f.hp=1e7;
    e._waxCoatT=4; e._waxCoatBy=c; const h0=e.hp, g0=f.hp; c._castSM=1; c._castLv=1; c._castSlot='blue';
    doEffect(c,'nova',Object.assign({},KITS.ceraline.blue));
    const atLaunch=log.length; for(let i=0;i<20;i++) updateBattle(SIM_STEP);
    const out={log,atLaunch,coat:e._waxCoatT,by:e._waxCoatBy===null,dmgE:h0-e.hp,dmgF:g0-f.hp,plates:0};
    units=[]; groundHazards.length=0; const v=makeUnit('vex','ally',300,700,20,{owned:false}), t=makeUnit('vael','enemy',300+5*METER,700,20,{owned:false});
    units=[v,t]; t.maxHp=t.hp=1e7; v.target=t; v._castSM=1; v._castLv=1; v._castSlot='blue'; doEffect(v,'dot',Object.assign({},KITS.vex.blue));
    out.dot=(t.dots||[]).filter(d=>d.color==='#c0392b').map(d=>[+(d.dps/(v.dmg*0.30)).toFixed(6),d.remaining,d.interval]);
    return JSON.stringify(out); } finally { bellCastFx=keep.b; waxShatterFx=keep.s; vexWoundFx=keep.w; hookReelFx=keep.r; hookSlashFx=keep.h; } })()`)) } catch (e) { ck('the art helpers exist in the engine', false, e.message); art = { log: [], atLaunch: 0, coat: -1, by: false, dmgE: 0, dmgF: 0, dot: [] }; }
const kinds = art.log.map(l => l[0]);
ck('Mourning Bell draws the bell once, at the form launch (before the damage)', kinds.filter(k => k === 'bell').length === 1 && art.atLaunch >= 1 && art.log[0][0] === 'bell', JSON.stringify(art.log));
ck('the shatter art plays on the waxed enemy, while its coat is still on (the frame it breaks)', art.log.some(l => l[0] === 'shatter' && l[1] === 'vex' && l[2] > 0), JSON.stringify(art.log));
ck('the coat still breaks and the detonation still hits (coat 0, owner cleared, waxed enemy takes more than the unwaxed one)', art.coat === 0 && art.by && art.dmgE > art.dmgF && art.dmgF > 0, JSON.stringify([art.coat, art.dmgE, art.dmgF]));
{ const fr = H.match(/:\(o\.form\|\|([\d.]+)\);/), form = fr ? +fr[1] : NaN, ring = 13 / 24 * FXRT, cell = FXRT / 24;
  ck(`the ring pulse (bell cell 13 = ${ring.toFixed(3)} fight s) lands on the form delivery (${form} s) within one cell (${cell.toFixed(3)} s)`, Math.abs(ring - form) <= cell && /bellring:\{[^}]*n:48[^}]*dur:2\.0,rt:true/.test(H), ring + ' vs ' + form); }
ck('Bleed Them Dry opens the wound on its target for the bleed duration, in its colour', art.log.some(l => l[0] === 'wound' && l[1] === 'vael' && l[2] === 6 && l[3] === '#c0392b'), JSON.stringify(art.log));
ck('the bleed itself is unchanged: one 6-tick dot of 0.30 x Attack every 1 s', JSON.stringify(art.dot) === '[[1,6,1]]', JSON.stringify(art.dot));
ck('the old plates are off: an ownFx ability draws no plate (abilArt) and no debuff badge', H.includes("if(o&&o.ownFx){ if(o.ownFx==='bell')") && H.includes('_DEBUFF_BADGE[type])&&!o.ownFx;'));
ck('cleared with the other FX (clearCandleFx, which clearFx2 calls)', H.includes('_candleFx.length=0; try{ clearFx1115(); }catch(_e){} }') && H.includes('killAllWaxFx(); clearCandleFx(); }'));
// CONTROL: the display helpers never touch the fight
{ const i0 = H.indexOf('const _fx1115=[];'), i1 = H.indexOf('function clearFx2(){');
  const fx = i0 >= 0 && i1 > i0 ? H.slice(i0, i1) : 'dealDamage';
  ck('CONTROL the v1115 art code touches no damage, CC, hazards, coats or positions', !/dealDamage|ccApply|groundHazards|\.hp\s*[-+]?=[^=]|stunned|_waxCoatT\s*=|\.x\s*=[^=]|\.y\s*=[^=]|brnd\(/.test(fx)); }

console.log('\nPASS: ' + pass + '  FAIL: ' + fail);
process.exit(Math.min(fail, 255));
