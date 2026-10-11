'use strict';
// v1123 - Grok spell FX (Phil-approved 10 Oct): Sorrel Marked Deal cards + hit sparks, Carn Crimson Reap crescent, Tharl Scale Ram quake,
// Kon-Wu Heaven-Splitting Slam Ruyi, Rhukk Dig In roar + shell. Runs the real battle engine headless (server/sim-host.js, the file the
// server replays with).
//   - the eight sheets are on disk and their grids are what FX2_DEF says;
//   - each spell's case asks for its new art (ownFx) and the old plate is off (no abilArt plate, no phantom-staff plate);
//   - PARITY: every spell, cast through the real cast path, gives the same HP / stun / position / taunt on every tick as v1121 (78902fe8);
//   - the art clocks sit on the damage: Kon-Wu's slam cell lands on the 1 s cast release, Sorrel's card flies the 0.30 s the damage waits;
//   - CONTROLS: v1121 has none of the art (its checks fail - run HTML=<v1121 copy>); the v1123 art code touches no fight state.
// One line per check; exit code = number of failures.  Run on another copy: HTML=<path> node tests/test_spell_fx_1123.js
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.HTML || path.join(ROOT, 'emberweave-heroes.html');
const H = fs.readFileSync(HTML, 'utf8');
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? ' - ' + detail : '')); } };
const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-9);

// ---------------------------------------------------------------- sheets
function webpSize(f) { const b = fs.readFileSync(f); if (b.toString('ascii', 12, 16) !== 'VP8L') return null;
  const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
const SHEETS = { sorrelcard: 'sorrel_card', sorrelspark: 'sorrel_hit_spark', sorrelflare: 'sorrel_mark_flare', carnreap: 'carn_crimson_reap',
  tharlquake: 'tharl_scale_ram_quake', konwuruyi: 'konwu_ruyi_slam', rhukkroar: 'rhukk_dig_in_roar', rhukkshell: 'rhukk_dig_in_shell' };
const CELLS = { sorrelcard: 1, sorrelspark: 3, sorrelflare: 5, carnreap: 64, tharlquake: 67, konwuruyi: 48, rhukkroar: 60, rhukkshell: 35 };
for (const [k, file] of Object.entries(SHEETS)) {
  const m = H.match(new RegExp('\\n\\s*' + k + ":\\{u:'/(assets/anim/fx/" + file + "\\.webp)\\?v=(\\d+)',n:(\\d+),fw:(\\d+),fh:(\\d+),cols:(\\d+),rows:(\\d+)"));
  const f = m && path.join(ROOT, m[1]), sz = f && fs.existsSync(f) && webpSize(f);
  ck(`${k}: ${file}.webp on disk, ${CELLS[k]} cells fit the grid, sheet = cols*fw x rows*fh, <= 4096`,
    !!(m && sz && +m[3] === CELLS[k] && +m[3] <= +m[6] * +m[7] && sz[0] === +m[4] * +m[6] && sz[1] === +m[5] * +m[7] && sz[0] <= 4096 && sz[1] <= 4096), JSON.stringify([m && m.slice(3), sz]));
}

// ---------------------------------------------------------------- engine
function load(html) { const host = require(path.join(ROOT, 'server/sim-host.js')).load(html); return s => vm.runInContext(s, host.ctx); }
const run = load(HTML);
const has = n => run(`typeof ${n}`) !== 'undefined';
const FXRT = has('FX_RT') ? run('FX_RT') : NaN;

// the kits: new art switched on, numbers untouched
ck('Marked Deal: cards are his card sprite (pfx sorrelcard), ownFx cards; numbers unchanged (single, mul 0.75, n 3, cd 6, mark 1.22 for 6 s)',
  /sorrel:\{green:\{name:'Marked Deal',type:'volley',single:true,mul:0\.75,n:3,cd:6,pfx:'sorrelcard',pscale:0\.9,ownFx:'cards',desc:"[^"]*",mark:1\.22,markDur:6,/.test(H));
ck('Scale Ram: ownFx quake; numbers unchanged (mul 1.45, stun 1.1, push 1.8 m, cd 8)', /tharl:\{green:\{name:'Scale Ram',type:'knockstun',mul:1\.45,stun:1\.1,push:1\.8\*METER,cd:8,ownFx:'quake',/.test(H));
ck('Dig In: ownFx digin; numbers unchanged (taunt, cd 10)', /blue:\{name:'Dig In',type:'taunt',cd:10,ownFx:'digin',gfx:'rhukk_blue'/.test(H));
ck('Crimson Reap: HERO_ULT_ART ownFx reap (form delivery kept)', /carn:\{deliver:'form',gfx:'carn_ult',gdur:2\.6,gfxAt:'front',ownFx:'reap'\}/.test(H));
ck('Heaven-Splitting Slam: HERO_ULT_ART ownFx ruyi', /konwu:\{gfx:'konwu_ult',gdur:5\.88,ownFx:'ruyi'\}/.test(H));
ck('ULT_DEF unchanged: cleave mul 2.6 bleed 6.5 m; monkSlam mul 1 stun 2 15 m', has('ULT_DEF') && run('JSON.stringify([ULT_DEF.cleave,ULT_DEF.monkSlam])') === JSON.stringify([{ mul: 2.6, bleed: true, radius: 6.5 * 28.2 }, { mul: 1, stun: 2, radius: 15 * 28.2 }]),
  has('ULT_DEF') ? run('JSON.stringify([ULT_DEF.cleave,ULT_DEF.monkSlam])') : '');

// ---------------------------------------------------------------- art calls (stubbed to record), through the real cast path
const ARTFN = ['sorrelHitFx', 'carnReapFx', 'tharlQuakeFx', 'konwuRuyiCastFx', 'konwuRuyiHitFx', 'rhukkDigInFx', 'spawnStaffFx', 'spawnGroundFx', 'spawnProjFx'];
const SCEN = {   // caster, how, enemies [key,x,y]
  sorrel: ['green', [['ceraline', 640, 850]], [330, 1010]],
  carn: ['ult', [['vael', 470, 820], ['umbris', 560, 800]], [470, 980]],
  tharl: ['green', [['tick', 600, 930]], [400, 980]],
  konwu: ['ult', [['vael', 330, 860], ['umbris', 500, 830], ['tick', 670, 860]], [500, 1030]],
  rhukk: ['blue', [['vael', 300, 820], ['tick', 700, 820]], [500, 980]],
};
// one fight per spell: the caster presses, then 3 s of ticks; returns per-tick state + the art calls
const scen = (R, key, record) => JSON.parse(R(`(()=>{ const [how,foes,at]=${JSON.stringify(SCEN[key])}; const log=[]; const keep={};
  ${record ? `const mk=n=>function(){ log.push([n].concat(Array.from(arguments).map(a=>a&&a.key?a.key:(typeof a==='number'?+a.toFixed(4):(Array.isArray(a)?a.map(x=>x&&x.key):(a===undefined||a===null?null:(typeof a==='string'||typeof a==='boolean'?a:typeof a)))))));
    if(n==='spawnProjFx'&&typeof arguments[7]==='function') arguments[7](); };   /* the card 'arrives' at once: its onHit is the spark */
  ${JSON.stringify(ARTFN)}.forEach(n=>{ if(eval('typeof '+n)==='function'){ keep[n]=eval(n); globalThis.__stub=mk(n); eval(n+'=globalThis.__stub'); } });` : ''}
  try{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; _brng=()=>0.999;
    const u=makeUnit('${key}','ally',at[0],at[1],30,{owned:false}); const es=foes.map(f=>makeUnit(f[0],'enemy',f[1],f[2],30,{owned:false}));
    units=[u].concat(es); units.forEach(x=>{ x.atkInterval=99; x.atkCd=99; x.speed=0; x.greenCd=999; x.blueCd=999; x.energy=0; x.maxHp=x.hp=1e7; });
    u.target=es[0]; u._castSM=1; u._castLv=1;
    if(how==='ult') castAbility(u); else { const ab=KITS['${key}'][how]; if(how==='blue') u.blueAb=ab; else u.greenAb=ab; castKit(u,ab); }
    const tr=[]; for(let i=0;i<Math.round(3/SIM_STEP);i++){ updateBattle(SIM_STEP);
      units.forEach(x=>{ x.atkCd=99; x.greenCd=999; x.blueCd=999; x.energy=0; });
      tr.push(units.map(x=>[+x.hp.toFixed(6),+(x.stunned||0).toFixed(4),+x.x.toFixed(4),+x.y.toFixed(4),x.forcedTarget?x.forcedTarget.key:null,+(x._markT||0).toFixed(4)])); }
    return JSON.stringify({tr,log}); } finally { Object.keys(keep).forEach(n=>eval(n+'=keep[n]')); } })()`));

let OLD = null;   // v1121 (78902fe8) from git, loaded beside this copy (sim-host reads hero-profiles.js next to the page), then removed
{ const f = path.join(ROOT, '.v1121-parity-' + process.pid + '.html');
  try { fs.writeFileSync(f, cp.execSync('git show 78902fe8:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 })); OLD = load(f); }
  catch (e) { console.log('  (v1121 not loadable: ' + String(e.message).split(/\r?\n/)[0] + ')'); } finally { try { fs.unlinkSync(f); } catch (e) {} } }

const A = {}, P = {};
for (const key of Object.keys(SCEN)) {
  let a = null; try { a = scen(run, key, true); } catch (e) { a = { tr: [], log: [['error', e.message]] }; } A[key] = a;
  let n = null, o = null; try { n = scen(run, key, false); o = OLD ? scen(OLD, key, false) : null; } catch (e) { o = null; n = { tr: [e.message] }; }
  const hit = n.tr.findIndex(r => r.some((x, i) => i > 0 && (x[0] < 1e7 || x[1] > 0 || x[4])));
  ck(`PARITY ${key}: the cast lands (damage / stun / taunt from tick ${hit}) and HP / stun / position / taunt / mark match v1121 on all ${n.tr.length} ticks`,
    !!o && hit >= 0 && JSON.stringify(n.tr) === JSON.stringify(o.tr), o ? (n.tr.findIndex((r, i) => JSON.stringify(r) !== JSON.stringify(o.tr[i])) + ' first differing tick') : 'no v1121 engine');
}
const calls = (k, n) => A[k].log.filter(l => l[0] === n);
{ const L = A.sorrel.log; const hits = calls('sorrel', 'sorrelHitFx'), proj = calls('sorrel', 'spawnProjFx');
  ck('Marked Deal: three card sprites fly (spawnProjFx sorrelcard, 0.30 s - the same wait as the damage)', proj.length === 3 && proj.every(p => p[1] === 'sorrelcard' && p[7] === 0.3), JSON.stringify(proj));
  ck('Marked Deal: a spark on each card, the flare (big) on the third only, on ceraline', hits.length === 3 && hits.map(h => h[2]).join() === 'false,false,true' && hits.every(h => h[1] === 'ceraline'), JSON.stringify(hits));
  ck('Marked Deal: no old plate (no ground plate drawn)', !L.some(l => l[0] === 'spawnGroundFx'), JSON.stringify(L)); }
{ const r = calls('carn', 'carnReapFx');
  ck('Crimson Reap: the crescent once, on the cleave (Carn, its direction, the 6.5 m radius); no carn_ult plate', r.length === 1 && r[0][1] === 'carn' && near(r[0][3], 6.5 * 28.2, 1e-3) && !A.carn.log.some(l => l[0] === 'spawnGroundFx'), JSON.stringify(A.carn.log)); }
{ const q = calls('tharl', 'tharlQuakeFx');
  ck('Scale Ram: the quake once, on the target; no tharl_green plate', q.length === 1 && q[0][1] === 'tick' && !A.tharl.log.some(l => l[0] === 'spawnGroundFx'), JSON.stringify(A.tharl.log)); }
{ const c = calls('konwu', 'konwuRuyiCastFx'), h = calls('konwu', 'konwuRuyiHitFx');
  ck('Heaven-Splitting Slam: the Ruyi starts at the press (cast 1 s, 15 m) and is confirmed at the slam on all three enemies; no phantom staff, no konwu_ult plate',
    c.length === 1 && c[0][2] === 1 && near(c[0][3], 15 * 28.2, 1e-3) && h.length === 1 && JSON.stringify(h[0][2]) === '["vael","umbris","tick"]' && !A.konwu.log.some(l => l[0] === 'spawnStaffFx' || l[0] === 'spawnGroundFx'), JSON.stringify(A.konwu.log)); }
{ const d = calls('rhukk', 'rhukkDigInFx');
  ck('Dig In: roar + shell once on Rhukk for the 3 s taunt; no rhukk_blue plate', d.length === 1 && d[0][1] === 'rhukk' && d[0][2] === 3 && !A.rhukk.log.some(l => l[0] === 'spawnGroundFx'), JSON.stringify(A.rhukk.log)); }

// ---------------------------------------------------------------- art clocks on the damage
if (has('FX2_DEF') && run('!!FX2_DEF.konwuruyi')) {
  const d = JSON.parse(run('JSON.stringify(FX2_DEF.konwuruyi)')), slamT = d.slam / d.n * d.dur * FXRT, cell = d.dur / d.n * FXRT;
  ck(`Kon-Wu: the slam cell (${d.slam} = clip frame 57) is ${slamT.toFixed(4)} fight s into the sheet; started ${(slamT - 1).toFixed(4)} s in at the press, it lands on the 1 s release (within a cell, ${cell.toFixed(3)} s)`,
    d.slam === 36 && Math.abs(slamT - run("castTimeFor({key:'konwu',t:{}},'ult')")) < cell, slamT);
  const s = JSON.parse(run('JSON.stringify(FX2_DEF.rhukkshell)'));
  const cells = JSON.parse(run(`(()=>{ const d=FX2_DEF.rhukkshell, o={d,life:3,t:0}; const r=[]; for(let t=0;t<3;t+=0.05){ o.t=t; r.push(_fx22ShellCell(o)); } return JSON.stringify(r); })()`));
  ck('Rhukk shell: forms, holds (cells 10-27 back and forth), and is in its dissolve (>= cell 28) only in the last 0.4 s of the 3 s taunt',
    cells[0] === 0 && cells.slice(0, Math.floor((3 - 0.4) / 0.05)).every(c => c < s.outC0) && cells[cells.length - 1] >= s.outC0 && cells.slice(10, 50).every(c => c >= s.holdA && c <= s.holdB || c < s.inN), JSON.stringify(cells));
} else ck('the v1123 FX2_DEF entries exist', false);
ck('Carn crescent front edge measured on all 64 cells', has('FX2_DEF') && run('!!(FX2_DEF.carnreap&&FX2_DEF.carnreap.front&&FX2_DEF.carnreap.front.length===64)'));
ck('cleared with the other FX (clearFx2) and ticked with them (updateWaxFx)', H.includes('function clearFx2(){ try{ clearFx1123(); }catch(_e){}') && H.includes('try{ updateFx1115(dt); }catch(_e){} try{ updateFx1123(dt); }catch(_e){}'));

// CONTROL: the display helpers never touch the fight
{ const i0 = H.indexOf('const _fx1123=[];'), i1 = H.indexOf('/* v1115 Grok spell FX 22-24');
  const fx = i0 >= 0 && i1 > i0 ? H.slice(i0, i1) : 'dealDamage';
  ck('CONTROL the v1123 art code touches no damage, CC, hazards, HP, taunts, marks or positions', !/dealDamage|ccApply|groundHazards|\.hp\s*[-+]?=[^=]|stunned|forcedTarget|_markT|\b(u|e|o\.u)\.(x|y)\s*=[^=]|brnd\(|_brng/.test(fx)); }

console.log('\nPASS: ' + pass + '  FAIL: ' + fail);
process.exit(Math.min(fail, 255));
