'use strict';
// v1125 - Grok spell FX s07 + s08 (Phil-approved, Grok note 11 Oct 18:05; Phil 11 Oct "ship korvux and astra"): Astra's Event Horizon
// (ult) flat on the aimed 8 m circle, Korvux's Ember Cleave (blue) riding his axe swing. Only these two: the five v1123 fx-branch spells
// (Sorrel, Carn, Tharl, Kon-Wu, Rhukk) are not in this release and must behave exactly as on main. Runs the real battle engine headless.
//   - the two sheets are on disk and their grids are what FX2_DEF says;
//   - each spell asks for its new art (ownFx) and the old plate is off (no abilArt plate);
//   - PARITY: both casts AND the five held-back spells, through the real cast path, give the same HP / stun / position on every tick as
//     main before this release (BASE);
//   - the art clocks sit on the damage: the planet's impact cell and the chop's hit-flash cell land on the tick the damage lands;
//   - CONTROLS: BASE has none of the art (run HTML=<that copy>: the art checks fail); the art code touches no fight state.
//   - v1126: the five v1123 spells now ship too (tests/test_spell_fx_1123.js); here they keep their parity runs against BASE.
// One line per check; exit code = number of failures.  Run on another copy: HTML=<path> node tests/test_spell_fx_1125.js
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.HTML || path.join(ROOT, 'emberweave-heroes.html');
const H = fs.readFileSync(HTML, 'utf8');
const BASE = process.env.BASE || '2f15f200';   // main before v1125
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? ' - ' + detail : '')); } };

// ---------------------------------------------------------------- sheets
function webpSize(f) { const b = fs.readFileSync(f); if (b.toString('ascii', 12, 16) !== 'VP8L') return null;
  const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
const SHEETS = { astrahorizon: ['astra_event_horizon', 72], korvuxcleave: ['korvux_ember_cleave', 69] };
ck('the two sheets carry a fresh ?v=1125 (never a shipped version)', /astrahorizon:\{u:'\/assets\/anim\/fx\/astra_event_horizon\.webp\?v=1125'/.test(H) && /korvuxcleave:\{u:'\/assets\/anim\/fx\/korvux_ember_cleave\.webp\?v=1125'/.test(H));
for (const [k, [file, cells]] of Object.entries(SHEETS)) {
  const m = H.match(new RegExp('\\n\\s*' + k + ":\\{u:'/(assets/anim/fx/" + file + "\\.webp)\\?v=(\\d+)',n:(\\d+),fw:(\\d+),fh:(\\d+),cols:(\\d+),rows:(\\d+)"));
  const f = m && path.join(ROOT, m[1]), sz = f && fs.existsSync(f) && webpSize(f);
  ck(`${k}: ${file}.webp on disk, ${cells} cells fit the grid, sheet = cols*fw x rows*fh, <= 4096`,
    !!(m && sz && +m[3] === cells && +m[3] <= +m[6] * +m[7] && sz[0] === +m[4] * +m[6] && sz[1] === +m[5] * +m[7] && sz[0] <= 4096 && sz[1] <= 4096), JSON.stringify([m && m.slice(3), sz]));
}

// ---------------------------------------------------------------- engine
function load(html) { const host = require(path.join(ROOT, 'server/sim-host.js')).load(html); return s => vm.runInContext(s, host.ctx); }
const run = load(HTML);
const has = n => run(`typeof ${n}`) !== 'undefined';
const FXRT = has('FX_RT') ? run('FX_RT') : NaN;

ck('Ember Cleave: ownFx chop; numbers unchanged (form, cleave, mul 1.6, 3.2 m, cd 7)',
  /korvux:\{green:\{[^}]*\},blue:\{deliver:'form',name:'Ember Cleave',type:'cleave',mul:1\.6,radius:3\.2\*METER,cd:7,ownFx:'chop',/.test(H));
ck('Event Horizon: HERO_ULT_ART ownFx horizon (form delivery kept)', /astra:\{deliver:'form',gfx:'astra_ult',gdur:5\.83,ownFx:'horizon'\}/.test(H));
ck('ULT_DEF.gravcrush unchanged (mul 2, 8 m, stun 1, gravity)', has('ULT_DEF') && run('JSON.stringify(ULT_DEF.gravcrush)') === JSON.stringify({ mul: 2, radius: 8 * 28.2, stun: 1, gravity: true }),
  has('ULT_DEF') ? run('JSON.stringify(ULT_DEF.gravcrush)') : '');

// ---------------------------------------------------------------- art calls (stubbed to record), through the real cast path
const ARTFN = ['astraHorizonFx', 'korvuxChopCastFx', 'korvuxChopLaunchFx', 'korvuxChopHitFx', 'spawnGroundFx', 'spawnProjFx'];
const SCEN = {   // caster, how, enemies [key,x,y], caster at, aim
  astra: ['ult', [['vael', 480, 760], ['umbris', 560, 800], ['tick', 620, 740]], [420, 1040], [560, 770]],
  korvux: ['blue', [['vael', 540, 905], ['tick', 545, 935]], [470, 920], null],
  // the five v1123 fx-branch spells, held back: parity only
  sorrel: ['green', [['ceraline', 640, 850]], [330, 1010], null],
  carn: ['ult', [['vael', 470, 820], ['umbris', 560, 800]], [470, 980], null],
  tharl: ['green', [['tick', 600, 930]], [400, 980], null],
  konwu: ['ult', [['vael', 330, 860], ['umbris', 500, 830], ['tick', 670, 860]], [500, 1030], null],
  rhukk: ['blue', [['vael', 300, 820], ['tick', 700, 820]], [500, 980], null],
};
const scen = (R, key, record) => JSON.parse(R(`(()=>{ const [how,foes,at,aim]=${JSON.stringify(SCEN[key])}; const log=[]; const keep={};
  ${record ? `const mk=n=>function(){ log.push([n,+battleTime.toFixed(4)].concat(Array.from(arguments).map(a=>a&&a.key?a.key:(typeof a==='number'?+a.toFixed(4):(a===undefined||a===null?null:(typeof a==='string'||typeof a==='boolean'?a:typeof a)))))); };
  ${JSON.stringify(ARTFN)}.forEach(n=>{ if(eval('typeof '+n)==='function'){ keep[n]=eval(n); globalThis.__stub=mk(n); eval(n+'=globalThis.__stub'); } });` : ''}
  try{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; _brng=()=>0.999;
    const u=makeUnit('${key}','ally',at[0],at[1],30,{owned:false}); const es=foes.map(f=>makeUnit(f[0],'enemy',f[1],f[2],30,{owned:false}));
    units=[u].concat(es); units.forEach(x=>{ x.atkInterval=99; x.atkCd=99; x.speed=0; x.greenCd=999; x.blueCd=999; x.energy=0; x.maxHp=x.hp=1e7; x._bodyR=20; });   /* headless has no sprite, so bodyR falls back to 2r (wider than the 3.2 m cleave): a drawn hero's body */
    u.target=es[0]; u._castSM=1; u._castLv=1; if(aim){ u._aimWX=aim[0]; u._aimWY=aim[1]; }
    if(how==='ult') castAbility(u); else { const ab=KITS['${key}'][how]; if(how==='blue') u.blueAb=ab; else u.greenAb=ab; castKit(u,ab); }
    const tr=[]; for(let i=0;i<Math.round(3/SIM_STEP);i++){ updateBattle(SIM_STEP);
      units.forEach(x=>{ x.atkCd=99; x.greenCd=999; x.blueCd=999; x.energy=0; });
      tr.push(units.map(x=>[+x.hp.toFixed(6),+(x.stunned||0).toFixed(4),+x.x.toFixed(4),+x.y.toFixed(4),x.forcedTarget?x.forcedTarget.key:null,+(x._markT||0).toFixed(4)])); }
    return JSON.stringify({tr,log,step:SIM_STEP}); } finally { Object.keys(keep).forEach(n=>eval(n+'=keep[n]')); } })()`));

let OLD = null;   // main before this release (BASE) from git, loaded beside this copy (sim-host reads hero-profiles.js next to the page), then removed
{ const f = path.join(ROOT, '.v1125-parity-' + process.pid + '.html');
  try { fs.writeFileSync(f, cp.execSync('git show ' + BASE + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 })); OLD = load(f); }
  catch (e) { console.log('  (' + BASE + ' not loadable: ' + String(e.message).split(/\r?\n/)[0] + ')'); } finally { try { fs.unlinkSync(f); } catch (e) {} } }

const A = {}, HIT = {};
for (const key of Object.keys(SCEN)) {
  let a = null; try { a = scen(run, key, true); } catch (e) { a = { tr: [], log: [['error', e.message]] }; } A[key] = a;
  let n = null, o = null; try { n = scen(run, key, false); o = OLD ? scen(OLD, key, false) : null; } catch (e) { o = null; n = { tr: [e.message] }; }
  const hit = n.tr.findIndex(r => r.some((x, i) => i > 0 && (x[0] < 1e7 || x[1] > 0 || x[4]))); HIT[key] = (hit + 1) * (n.step || 0);
  ck(`PARITY ${key}: the cast lands (damage / stun / taunt from tick ${hit}) and HP / stun / position / taunt / mark match main (BASE) on all ${n.tr.length} ticks`,
    !!o && hit >= 0 && JSON.stringify(n.tr) === JSON.stringify(o.tr), o ? (n.tr.findIndex((r, i) => JSON.stringify(r) !== JSON.stringify(o.tr[i])) + ' first differing tick') : 'no BASE engine');
}
const calls = (k, n) => A[k].log.filter(l => l[0] === n);
const SS = A.astra.step || 1 / 30;
{ const h = calls('astra', 'astraHorizonFx');
  ck('Event Horizon: the art once, on the aim point, 8 m radius; no astra_ult plate', h.length === 1 && h[0][2] === 560 && h[0][3] === 770 && Math.abs(h[0][4] - 8 * 28.2) < 1e-3 && !A.astra.log.some(l => l[0] === 'spawnGroundFx' || l[0] === 'spawnProjFx'), JSON.stringify(A.astra.log));
  if (h.length && has('FX2_DEF') && run('!!FX2_DEF.astrahorizon')) {
    const d = JSON.parse(run('JSON.stringify(FX2_DEF.astrahorizon)'));
    const land = h[0][1] + h[0][5];   // the launch + the form wait = when the art's impact cell is due
    ck(`Event Horizon: the planet's impact (cell ${d.impact}) is due ${land.toFixed(4)} s = the damage tick ${HIT.astra.toFixed(4)} s (within a tick)`, Math.abs(land - HIT.astra) <= SS + 1e-6, [land, HIT.astra]);
  } else ck('Event Horizon: FX2_DEF.astrahorizon exists and the art was called', false);
}
{ const c = calls('korvux', 'korvuxChopCastFx'), l = calls('korvux', 'korvuxChopLaunchFx'), h = calls('korvux', 'korvuxChopHitFx');
  ck('Ember Cleave: the chop starts at the press (t 0), is confirmed at the launch and aimed at the damage, once each, on Korvux; no korvux_blue plate',
    c.length === 1 && c[0][1] === 0 && c[0][2] === 'korvux' && l.length === 1 && h.length === 1 && Math.abs(h[0][4] - 3.2 * 28.2) < 1e-3 && !A.korvux.log.some(l => l[0] === 'spawnGroundFx' || l[0] === 'spawnProjFx'), JSON.stringify(A.korvux.log));
  ck(`Ember Cleave: the press says the hit is ${c.length ? c[0][3] : '?'} s away; the damage lands at ${HIT.korvux.toFixed(4)} s (within a tick), and the hit call is on that tick`,
    c.length === 1 && h.length === 1 && Math.abs(c[0][3] - HIT.korvux) <= SS + 1e-6 && Math.abs(h[0][1] - HIT.korvux) <= SS + 1e-6, JSON.stringify([c, h, HIT.korvux]));
  if (has('FX2_DEF') && run('!!FX2_DEF.korvuxcleave')) {
    const d = JSON.parse(run('JSON.stringify(FX2_DEF.korvuxcleave)')), flash = d.hit / d.n * d.dur;
    ck(`Ember Cleave: the hit flash (cell ${d.hit} = clip frame 69) is ${flash.toFixed(3)} clip s in (24 fps), ${(flash * FXRT).toFixed(4)} fight s - shorter than the press-to-damage wait, so it starts in time`,
      d.hit === 29 && Math.abs(flash - 29 / 24) < 1e-9 && flash * FXRT <= HIT.korvux + SS, [flash * FXRT, HIT.korvux]);
  } else ck('Ember Cleave: FX2_DEF.korvuxcleave exists', false);
}
if (has('FX2_DEF') && run('!!(FX2_DEF.korvuxcleave&&FX2_DEF.korvuxcleave.sync)')) {
  const d = JSON.parse(run('JSON.stringify(FX2_DEF.korvuxcleave)')), f = d.sync.f, c = d.sync.c;
  ck(`Ember Cleave rides his axe: sync frames ${f.join(',')} -> cells ${c.join(',')}; the flash cell lands on clip frame 28 (the impact, his blue clip's ax lunge frame), cells only move forward`,
    f[f.length - 1] === 28 && c[c.length - 1] === d.hit && c.every((x, i) => i === 0 || x >= c[i - 1]) && f.every((x, i) => i === 0 || x > f[i - 1]) && (() => { const m = H.match(/blue:\{u:'\/assets\/anim\/korvux\/korvux_blue\.webp\?v=\d+'[^}]*?ax:\[([-\d,]+)\]/); return !!m && +m[1].split(',')[28] === 47; })() && d.fit && d.fit.k > 0, JSON.stringify(d.sync));
} else ck('Ember Cleave: FX2_DEF.korvuxcleave.sync exists', false);
ck('both warmed with the hero figure (FX1123_WARM astra / korvux; v1126 adds the five v1123 spells beside them)', /const FX1123_WARM=\{[^}]*astra:\['astrahorizon'\],korvux:\['korvuxcleave'\][^}]*\};/.test(H));
// v1126: the five v1123 fx-branch spells ship now (their own checks: tests/test_spell_fx_1123.js); the parity runs above still prove
// their casts land exactly as on main before v1125 (BASE)
ck('v1126: the five v1123 spells ship beside s07/s08 (sheets, helpers, kit flags)',
  /sorrelcard/.test(H) && /carnReapFx/.test(H) && /tharlQuakeFx/.test(H) && /konwuRuyi/.test(H) && /rhukkDigInFx/.test(H) && /ownFx:'reap'/.test(H) && /ownFx:'ruyi'/.test(H)
  && ['sorrel_card', 'carn_crimson_reap', 'tharl_scale_ram_quake', 'konwu_ruyi_slam', 'rhukk_dig_in_roar', 'rhukk_dig_in_shell'].every(f => fs.existsSync(path.join(ROOT, 'assets/anim/fx/' + f + '.webp'))));

// CONTROL: the display helpers never touch the fight
{ const i0 = H.indexOf('const FX1123_WARM='), i1 = H.indexOf('/* v1115 Grok spell FX 22-24');
  const fx = i0 >= 0 && i1 > i0 ? H.slice(i0, i1) : 'dealDamage';
  ck('CONTROL the s07/s08 art code touches no damage, CC, hazards, HP, casts or positions', !/dealDamage|ccApply|groundHazards|\.hp\s*[-+]?=[^=]|stunned|_pend\s*=[^=]|\b(u|e|o\.u)\.(x|y|rx|ry)\s*=[^=]|brnd\(|_brng/.test(fx)); }

console.log('\nPASS: ' + pass + '  FAIL: ' + fail);
process.exit(Math.min(fail, 255));
