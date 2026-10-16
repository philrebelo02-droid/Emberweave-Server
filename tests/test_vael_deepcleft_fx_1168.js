'use strict';
// v1168 - Vael's and Deepcleft's three spell FX each (Grok renders, Phil approved all six 16 Oct 2026; Grok's handoffs 07:45 and 09:32), DISPLAY ONLY.
// DEEPCLEFT: FAULT CLAWS flat from his claws back to the screen-left (mirrored with facing), green cell 18; BURROW GUARD upright at his feet on blue
//   cell 15 and again where he pops up (the engine's emerge); QUARRY COLLAPSE flat on the case's own centre at the kit radius (120 units), ult cell 9
//   (22 fps clip) - each real time, once. VAEL:
//   WARCRY      vael_green_warcry_16oct.mp4      top-down dust/air shockwave, red fear streaks: FLAT on the ground on him, the blast = the 5 m fear circle,
//                                                shown on the roar (green cell 7), real time, once
//   BLOODTHIRST vael_blue_bloodthirst_16oct.mp4  blood streams pulled into him over a pooled base: upright, its pool on his feet, shown as he settles into
//                                                the crouch (blue cell 16), fitted to the 6 s buff
//   LAST STAND  vael_ult_last_stand_16oct.mp4    a shield and spear ring slams up round him, holds, topples: upright, centred on his feet, shown on the
//                                                sword strike (ult cell 8); the slam real time, the hold stretched, the last second faded out at the 5 s end
// They replace FX2_DEF.vael_green / vael_blue / vael_ult in place (same keys) and are drawn by their own painters (ownFx 'vwarcry' / 'vblood' /
// 'vstand'): started at the press, shown on the cast clip's own cell, confirmed by the release, faded by an interrupt. The over-the-bar badge the
// old plates drew is gone (an ownFx buff draws no badge - the only abilities that rule touches are these three).
// CONTROL against the live build (git show BASE): casts and whole fights with Vael on both sides are tick-identical (FX never move game logic).
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const VER = process.env.EW_VER || '1168';
const BASE_SHA = process.env.EW_BASE || '51679f74';   // live v1165 (sound + the v1167 wall step), before this change
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-vfx1168-base.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
  const tmp = OLD; process.on('exit', () => { try { fs.unlinkSync(tmp); } catch (e) {} }); } catch (e) { OLD = null; } }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML), R0 = OLD ? load(OLD) : null;
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 900) : '')); } };
const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const chunks = b => { const o = []; let i = 12; while (i + 8 <= b.length) { const t = b.toString('ascii', i, i + 4), n = b.readUInt32LE(i + 4); o.push(t); i += 8 + n + (n & 1); } return o; };
function webpSize(file) { const b = fs.readFileSync(file), tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; return null; }
const fileOf = u => path.join(ROOT, String(u).split('?')[0].replace(/^\//, ''));
const KEYS = ['vael_green', 'vael_blue', 'vael_ult', 'deepcleft_green', 'deepcleft_blue', 'deepcleft_ult'], FILES = { vael_green: 'vael_warcry_16oct', vael_blue: 'vael_bloodthirst_16oct', vael_ult: 'vael_last_stand_16oct',
  deepcleft_green: 'deepcleft_fault_claws_16oct', deepcleft_blue: 'deepcleft_burrow_guard_16oct', deepcleft_ult: 'deepcleft_quarry_collapse_16oct' };
function sheetProblems(F) { const bad = [];
  for (const k of KEYS) { const d = F[k]; if (!d) { bad.push(k + ' missing'); continue; } const f = fileOf(d.u);
    if (!fs.existsSync(f)) { bad.push(k + ' missing file'); continue; }
    const sz = webpSize(f), ch = chunks(fs.readFileSync(f));
    if (d.n > d.cols * d.rows || d.n <= (d.cols - 1) * d.rows) bad.push(k + ' n does not fill its grid');
    if (d.fw * d.cols > 2048 || d.fh * d.rows > 2048) bad.push(k + ' > 2048 px');
    if (fs.statSync(f).size > 4e6) bad.push(k + ' > 4 MB');
    if (!sz || sz[0] !== d.fw * d.cols || sz[1] !== d.fh * d.rows) bad.push(k + ' file ' + sz + ' != grid');
    if (!(ch.includes('VP8 ') && ch.includes('ALPH'))) bad.push(k + ' not a q95 lossy WebP with alpha'); }
  return bad; }
[run, R0].forEach(r => r && r(`globalThis.crypto_like = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return s.length + ':' + h.toString(16); }; 1`));
// a cast through castKit / castAbility: the cast tick, every effect and damage tick and every unit for 7 s, and (new page) the art's life
const CAST = (kind, opt, K) => { K = K || 'vael'; return `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9); if(typeof clearFx1123==='function') clearFx1123();
  const g=makeUnit('${K}','ally',500,700,30,{owned:false,rank:3}); const e=makeUnit('tick','enemy',560,700,30,{owned:false}); const e2=makeUnit('sylthaine','enemy',600,740,30,{owned:false});
  g.anim=BATTLE_ANIM.${K}; e.anim=null; e2.anim=null; g.glyphCrit=0;
  units=[g,e,e2]; units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); [e,e2].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.greenCd=x.blueCd=99;}); g.atkCd=99; g.speed=0;
  g.target=e; g.greenCd=g.blueCd=99; g.hp=g.maxHp*0.5;
  const fx=[], dm=[]; const _de=doEffect; doEffect=function(uu,ty){ if(uu===g) fx.push(ty+'@'+battleTime.toFixed(4)); return _de.apply(this,arguments); };
  const _dd=dealDamage; dealDamage=function(s,t){ if(s===g) dm.push(t.key+'@'+battleTime.toFixed(4)); return _dd.apply(this,arguments); };
  let badge=0; const _ba=buffArtAll; buffArtAll=function(uu){ if(uu===g) badge++; return _ba.apply(this,arguments); };
  g._castSM=1; g._castLv=1; const OPT=${JSON.stringify(opt || {})};
  try{
    if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,'${kind}'==='blue'?(g.blueAb||KITS.${K}.blue):(g.greenAb||KITS.${K}.green));
    const hold=+(g._abilHold||0).toFixed(4), anim=g._abilAnim; let fired=null, pend=!!g._pend, shown=null, gone=null, cells=[], cut=null;
    const art=()=>(typeof _fx1123!=='undefined')?_fx1123.find(o=>o.kind==='fx16'&&o.u===g&&!o.emerge):null; let em=null;
    const tr=[]; for(let i=0;i<Math.round(7/SIM_STEP);i++){
      if(OPT.cancelAt!=null&&Math.abs(battleTime-OPT.cancelAt)<SIM_STEP/2) castCancel(g,'TEST');
      updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; e.energy=0; e2.energy=0;
      if(pend&&!g._pend&&fired==null) fired=+battleTime.toFixed(4);
      const o=art(); if(o&&o.s&&shown==null) shown=+battleTime.toFixed(4); if(o&&o.s) cells.push([+battleTime.toFixed(4),o.fr,+(o.op!=null?o.op:-1).toFixed(3)]);
      if(o&&o.cut!=null&&cut==null) cut=+battleTime.toFixed(4);
      if(shown!=null&&!o&&gone==null) gone=+battleTime.toFixed(4);
      const q=(typeof _fx1123!=='undefined')?_fx1123.find(o=>o.kind==='fx16'&&o.u===g&&o.emerge):null; if(q&&!em) em={t:+battleTime.toFixed(4),P:q.P,gx:g.x,gy:g.y}; if(q&&q.s&&em&&em.shown==null) em.shown=+battleTime.toFixed(4);
      if(o&&o.vk==='dquarry'&&o.ok&&o.P&&!OPT._pin){ OPT._pin={P:o.P,R:o.R,e:[e.x,e.y]}; }
      tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,+(u.stunned||0).toFixed(2),+(u._fearT||u.fearT||0).toFixed(2),+(u.dmgBuffT||0).toFixed(2),+(u.drT||0).toFixed(2),+(u._lifestealT||0).toFixed(2),+(u.hasteT||0).toFixed(2)].join(':')).join('|')); }
    return JSON.stringify({hold,anim,fired,fx,dm,trace:crypto_like(tr.join('#')),badge,shown,gone,cut,em,pin:OPT._pin||null,cells:cells.filter((c,i,a)=>i===0||c[1]!==a[i-1][1]||i===a.length-1)});
  } finally { doEffect=_de; dealDamage=_dd; buffArtAll=_ba; } })()`; };
const fight = (r, seed, a, f) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10)].join(':')).join('|')); }
      return tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');

try {
  ck('control file (BASE emberweave-heroes.html from git ' + BASE_SHA + ', the live build) loaded', !!R0, 'git show failed');
  { const html = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && bad.length === 0, bad.join('; '));
    let cb = 0; try { new vm.Script(html.replace('function _fx22Fx16Tick(o){', 'function _fx22Fx16Tick(o){ if( ').match(/<script>([\s\S]*?)<\/script>/g).map(x => x.slice(8, -9)).join('\n')); } catch (e) { cb = 1; }
    ck('CONTROL: the same parse catches a broken painter', cb === 1); }
  const src = fs.readFileSync(HTML, 'utf8'), baseSrc = fs.readFileSync(OLD, 'utf8');

  // 1. the sheets
  const FXQ = 'JSON.stringify(Object.assign({FX_RT,METER},Object.fromEntries(' + JSON.stringify(KEYS) + '.map(k=>[k,FX2_DEF[k]]))))', F = JSON.parse(run(FXQ)), F0 = JSON.parse(R0(FXQ));
  const bad = sheetProblems(F);
  ck('the six sheets exist, file = declared grid, within 2048 px per side and 4 MB, q95 lossy + alpha, real time', bad.length === 0 && KEYS.every(k => F[k].rt === true), bad.join('; '));
  ck('they replace vael_ / deepcleft_ green / blue / ult in place: new files at ?v=' + VER + ' that BASE never referenced', KEYS.every(k => F[k].u === '/assets/anim/fx/' + FILES[k] + '.webp?v=' + VER && !baseSrc.includes(FILES[k])));
  ck('the old plates are still on disk (rollback needs nothing)', KEYS.every(k => fs.existsSync(fileOf(F0[k].u))));
  { const ctl = JSON.parse(JSON.stringify(F)); ctl.vael_blue.fw = 900; ctl.vael_ult.u = '/assets/anim/fx/vael_missing.webp?v=1';
    ck('CONTROL: the sheet check catches an oversized grid and a missing file', sheetProblems(ctl).length >= 2); }
  const PY = cp.execFileSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'helpers', 'vael_fx_1168_check.py')].concat(KEYS.map(k => fileOf(F[k].u))), { maxBuffer: 1 << 24 }).toString();
  const Q = JSON.parse(PY), qs = Object.entries(Q);
  const oliveCap = n => /fault_claws/.test(n) ? 0.1 : 0.01;   // Fault Claws owns a yellow-amber flash at the olive band's edge (hue ~55)
  ck('green key, no fringe (measured on the shipped sheets): visible green (G > max(R,B)+24) 0 on edge and body; olive (plate left in a soft edge) <= 0.01% of edge px (Fault Claws 0.1%: its amber flash); violet (the unmix complement) <= 2.5% of edge px, 0.01% of body: ' + qs.map(([n, m]) => n + ' ' + m.green_edge + '% / ' + m.olive_edge + '% / ' + m.violet_edge + '%').join(', '),
    qs.length === 6 && qs.every(([n, m]) => m.green_edge === 0 && m.green_body === 0 && m.olive_edge <= oliveCap(n) && m.olive_body <= oliveCap(n) && m.violet_edge <= 2.5 && m.violet_body <= 0.01 && m.edge > 50000), PY);
  ck('CONTROL: 35% of the plate mixed back into the edges (the v1160 keyer\'s failure on these clips) reads as olive on every sheet (' + qs.map(([, m]) => m.control_olive_edge + '%').join(', ') + '), and the violet put back reads as violet (' + qs.map(([, m]) => m.control_violet_edge + '%').join(', ') + ')', qs.every(([, m]) => m.control_olive_edge > 20 && m.control_violet_edge > 10));

  // 2. the data the engine reads is BASE's
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => k === 'ownFx' ? undefined : v));
  const kit = r => JSON.stringify(strip(JSON.parse(r('JSON.stringify([KITS.vael,HERO_ULT_ART.vael,HERO_TYPES.vael,ABILITY_CAST.vael,ULT_DEF.laststand,BATTLE_ANIM.vael,KITS.deepcleft,HERO_ULT_ART.deepcleft,HERO_TYPES.deepcleft,ABILITY_CAST.deepcleft||null,ULT_DEF.aoeStun,BATTLE_ANIM.deepcleft])'))));
  ck('both kits, ult art, hero stats, cast times, ult numbers and battle clips identical to BASE apart from the six ownFx display tags (vwarcry / vblood / vstand, dclaws / dburrow / dquarry)', kit(run) === kit(R0) &&
    run("[KITS.vael.green.ownFx,KITS.vael.blue.ownFx,HERO_ULT_ART.vael.ownFx,KITS.deepcleft.green.ownFx,KITS.deepcleft.blue.ownFx,HERO_ULT_ART.deepcleft.ownFx].join('/')") === 'vwarcry/vblood/vstand/dclaws/dburrow/dquarry');
  const others = r => r("JSON.stringify(Object.keys(FX2_DEF).filter(k=>!/^(vael|deepcleft)_(green|blue|ult)$/.test(k)).map(k=>[k,FX2_DEF[k]]))");
  ck('every other FX2_DEF entry is byte-for-byte BASE', H(others(run)) === H(others(R0)));
  { const touched = r => JSON.parse(r(`JSON.stringify((()=>{ const out=[];
      for(const h in KITS){ for(const s of ['green','blue']){ const a=KITS[h][s]; if(a&&a.ownFx&&_ABOVE_BAR[a.type]) out.push(h+'.'+s); } }
      for(const h in HERO_ULT_ART){ const a=HERO_ULT_ART[h], t=HERO_TYPES[h]&&HERO_TYPES[h].ability; if(a&&a.ownFx&&_ABOVE_BAR[t]) out.push(h+'.ult'); }
      return out; })())`));
    ck('the "an ownFx buff draws no badge" rule touches exactly Vael\'s three (no other ability has ownFx with an over-the-bar type; BASE: none)', JSON.stringify(touched(run)) === '["vael.green","vael.blue","vael.ult"]' && touched(R0).length === 0, JSON.stringify(touched(run))); }
  ck('the FX sheets warm with each figure (FX1123_WARM.vael / .deepcleft)', run('JSON.stringify([FX1123_WARM.vael,FX1123_WARM.deepcleft])') === '[["vael_green","vael_blue","vael_ult"],["deepcleft_green","deepcleft_blue","deepcleft_ult"]]');

  // 3. CONTROL: casts and whole fights tick-identical to BASE
  const casts = {};
  for (const kind of ['green', 'blue', 'ult']) {
    const x = JSON.parse(run(CAST(kind))), y = JSON.parse(R0(CAST(kind))); casts[kind] = x;
    const pick = o => JSON.stringify([o.hold, o.anim, o.fired, o.fx, o.dm, o.trace]);
    ck(`${kind}: the cast fires on the same tick (${x.fired}), the effect on the same ticks (${x.fx.join(' ')}), the clip held as long (${x.hold} s), every unit (hp, x, y, stun, fear, buffs) = BASE for 7 s`,
      x.fired != null && x.anim === kind && pick(x) === pick(y), JSON.stringify({ now: pick(x), base: pick(y) }));
    ck(`${kind}: no over-the-bar badge any more (buffArtAll on him: ${x.badge}; BASE drew ${y.badge})`, x.badge === 0 && y.badge >= 1);
  }
  const dcasts = {};
  for (const kind of ['green', 'blue', 'ult']) {
    const x = JSON.parse(run(CAST(kind, null, 'deepcleft'))), y = JSON.parse(R0(CAST(kind, null, 'deepcleft'))); dcasts[kind] = x;
    const pick = o => JSON.stringify([o.hold, o.anim, o.fired, o.fx, o.dm, o.trace]);
    ck(`Deepcleft ${kind}: the cast fires on the same tick (${x.fired}), the effect and damage on the same ticks (${x.fx.join(' ')}; ${x.dm.slice(0, 2).join(' ')}), every unit = BASE for 7 s`,
      x.fired != null && x.anim === kind && pick(x) === pick(y), JSON.stringify({ now: pick(x), base: pick(y) }));
  }
  { const T = [[11, ['vael', 'tick', 'sylthaine'], ['vael', 'vireo', 'grosk']], [17, ['deepcleft', 'vael', 'lumi'], ['deepcleft', 'korvux', 'astra']], [23, ['vael', 'veyr', 'korvux', 'lumi', 'vex'], ['vael', 'aureth', 'carn', 'oakmir', 'rhukk']], [5, ['vael', 'vael', 'vael'], ['umbris', 'hollow', 'tharl']]];
    const a = T.map(([s, x, y]) => fight(run, s, x, y)), b = T.map(([s, x, y]) => fight(R0, s, x, y));
    ck('whole fights (4 seeds, Vael and Deepcleft on both sides, their auto-cast green / blue / ult) are tick-identical to BASE', JSON.stringify(a) === JSON.stringify(b), JSON.stringify({ a, b }));
    run("globalThis.__f=KITS.vael.green.fear; KITS.vael.green.fear*=0.5; 1"); const c = fight(run, T[0][0], T[0][1], T[0][2]); run('KITS.vael.green.fear=globalThis.__f; 1');
    ck('CONTROL: the same fight with Warcry\'s fear halved is NOT identical (the instrument sees game logic)', c !== b[0]); }

  // 4. the moments: shown on the clip's own cell, before the release, ending with the buff
  const C = { FX_RT: F.FX_RT, step: +run('SIM_STEP') };
  const cellT = c => c / 24 * C.FX_RT;   // a cell of his 24 fps cast clip, in fight seconds from the press
  for (const [kind, k, cell, dur] of [['green', 'vael_green', 7, null], ['blue', 'vael_blue', 16, 6], ['ult', 'vael_ult', 8, 5]]) {
    const x = casts[kind], want = cellT(cell);
    ck(`${kind}: the art shows on ${kind} cell ${cell} (${want.toFixed(3)} fight s after the press, measured ${x.shown}), before the release (${x.fired})`,
      F[k].spawn === cell && x.shown != null && Math.abs(x.shown - want) <= C.step + 1e-6 && x.shown < x.fired, JSON.stringify(x));
    if (dur) ck(`${kind}: it ends with the ${dur} s buff the release started (gone ${x.gone}, release + ${dur} = ${(x.fired + dur).toFixed(4)})`, x.gone != null && Math.abs(x.gone - (x.fired + dur)) <= 2 * C.step + 1e-6, JSON.stringify(x.cells.slice(-4)));
  }
  { const x = casts.green, n = F.vael_green.n;
    ck(`Warcry plays once in real time at 12 fps: ${n} cells over ${(n / 12).toFixed(3)} real s = ${(n / 12 * C.FX_RT).toFixed(3)} fight s (gone ${x.gone}), never looping`,
      Math.abs((x.gone - x.shown) - n / 12 * C.FX_RT) <= 2 * C.step && x.cells.every((c, i, a) => i === 0 || c[1] >= a[i - 1][1]), JSON.stringify(x.cells.slice(0, 6)));
    ck('Warcry lies flat on the ground at the 5 m fear radius (the kit radius): disc dw/dh 0.914 = 2 x 340 / 744 source px, drawn with 5*METER', F.vael_green.disc && F.vael_green.disc.dw === 0.914 &&
      run('KITS.vael.green.radius') === 5 * F.METER && /if\(V\.mode==='disc'\) return _fx22Disc\(V\.k,x,y,5\*METER\*_fx22Area\(\),-5\)/.test(src) && run("FX16_ART.vwarcry.mode") === 'disc'); }
  { const x = casts.ult, d = F.vael_ult, L = x.fired + 5 - x.shown, cAt = t => { let c = null; for (const q of x.cells) if (q[0] <= t + 1e-9) c = q; return c; };
    const tA = d.hold[0] / 24 * C.FX_RT, tC = L - (2 * (d.n - 1) - d.hold[1]) / 24 * C.FX_RT;
    const a = cAt(x.shown + tA - 2 * C.step), b = cAt(x.shown + tC - C.step), z = x.cells[x.cells.length - 1];
    ck(`Last Stand: the slam runs in real time to f40 (cell ${a && a[1]} just before ${tA.toFixed(3)} fight s), the hold fills the ult (cell ${b && b[1]} at the fade), the last 24 frames fade out and it ends at release + 5 s (last cell ${z[1]}, opacity ${z[2]})`,
      a && a[1] >= 18 && a[1] <= 20 && b && b[1] >= 46 && b[1] <= 48 && b[2] === 1 && z[1] >= 58 && z[2] < 0.15, JSON.stringify(x.cells)); }
  { const x = casts.blue, z = x.cells[x.cells.length - 1];
    ck(`Bloodthirst runs through all ${F.vael_blue.n} cells over the buff and fades its last 0.3 fight s (last cell ${z[1]}, opacity ${z[2]})`, z[1] >= F.vael_blue.n - 2 && z[2] < 0.2, JSON.stringify(x.cells.slice(-5))); }

  { const dc = c => c / 24 * C.FX_RT, uc = c => c / 22 * C.FX_RT;   // his green / blue clips are 24 fps, his ult 44 @22
    for (const [kind, k, cell, want] of [['green', 'deepcleft_green', 18, dc(18)], ['blue', 'deepcleft_blue', 15, dc(15)], ['ult', 'deepcleft_ult', 9, uc(9)]]) {
      const x = dcasts[kind];
      ck(`Deepcleft ${kind}: the art shows on ${kind} cell ${cell} (${want.toFixed(3)} fight s after the press, measured ${x.shown}), by the release (${x.fired})`,
        F[k].spawn === cell && x.shown != null && Math.abs(x.shown - want) <= C.step + 1e-6 && x.shown <= x.fired + 1e-9, JSON.stringify(x)); }
    for (const [kind, k] of [['green', 'deepcleft_green'], ['ult', 'deepcleft_ult']]) { const x = dcasts[kind], d = F[k];
      ck(`Deepcleft ${kind}: real time at 12 fps, once (${d.n} cells = ${(d.n / 12).toFixed(3)} real s = ${(d.n / 12 * C.FX_RT).toFixed(3)} fight s; shown for ${(x.gone - x.shown).toFixed(3)})`,
        Math.abs((x.gone - x.shown) - d.n / 12 * C.FX_RT) <= 2 * C.step && x.cells.every((c, i, a) => i === 0 || c[1] >= a[i - 1][1]), JSON.stringify(x.cells.slice(0, 5))); }
    { const x = dcasts.blue, d = F.deepcleft_blue, z = x.cells[x.cells.length - 1], bd = run('KITS.deepcleft.blue.dur'), emT = x.fired + bd;
      ck(`Burrow Guard: real time, faded out by 5 real s (shown for ${((x.gone - x.shown) / C.FX_RT).toFixed(3)} real s, last opacity ${z[2]})`, Math.abs((x.gone - x.shown) / C.FX_RT - d.n / 12) <= 2 * C.step / C.FX_RT && z[2] < 0.2, JSON.stringify(x.cells.slice(-4)));
      ck(`Burrow Guard: the burst plays again where he pops up, on the engine's emerge (release + ${bd} s = ${emT.toFixed(4)}; made ${x.em && x.em.t}, shown ${x.em && x.em.shown}) on the spot he popped up at (within 1.5 m of him after the tick: the body separation nudges him off it the same tick)`,
        !!x.em && Math.abs(x.em.t - emT) <= 2 * C.step + 1e-6 && x.em.shown != null && x.em.shown - x.em.t <= C.step + 1e-6 && !!x.em.P && Math.hypot(x.em.P.x - x.em.gx, x.em.P.y - x.em.gy) < 1.5 * F.METER, JSON.stringify(x.em)); }
    { const x = dcasts.ult, R = run('ULT_DEF.aoeStun.radius');
      ck(`Quarry Collapse: pinned on the case's own centre (its target ${x.pin && x.pin.e}) at the kit radius (aoeStun ${R} units = ${(R / F.METER).toFixed(2)} m; Grok's radius 120 is the kit's)`,
        !!x.pin && !!x.pin.P && Math.abs(x.pin.P.x - x.pin.e[0]) < 1e-6 && Math.abs(x.pin.P.y - x.pin.e[1]) < 1e-6 && x.pin.R === 120 && R === 120, JSON.stringify(x.pin)); }
    { const G = JSON.parse(run(`(()=>{ const g=makeUnit('deepcleft','ally',500,700,30,{owned:false}); g._bodyR=30; const out=[]; const _f=_fx22Flat;
        _fx22Flat=function(){ return {rotation:{},scale:{set(x,y){this.x=x;this.y=y;}},position:{set(x,y,z){this.x=x;this.z=z;}},_uv:[0.14,0.09,0.1,0.2],material:{}}; };
        try{ for(const mir of [false,true]){ g._fxMirror=mir; const o={vk:'dclaws',d:FX2_DEF.deepcleft_green,u:g}; const m=fx16Show(o); const d=o.d, ax=mir?1-d.anchor[0]:d.anchor[0];
          out.push({mir:o.mir, endX:+(m.position.x+(ax-0.5)*m.scale.x).toFixed(4), want:+wx(500+(mir?-1:1)*30*d.reach).toFixed(4), W:+m.scale.x.toFixed(4), Wwant:+(d.len*_fx22Head(g)/d.lineW).toFixed(4), left:+(m.position.x-0.5*m.scale.x).toFixed(4), right:+(m.position.x+0.5*m.scale.x).toFixed(4), gx:+wx(500).toFixed(4)}); } }
        finally{ _fx22Flat=_f; } return JSON.stringify(out); })()`));
      ck('Fault Claws lies flat with the slashes right end at his claws, running back under him to the screen-left; mirrored (the end at his claws on the left, running right) when he faces left: ' + JSON.stringify(G),
        G[0].mir === false && G[1].mir === true && G.every(q => Math.abs(q.endX - q.want) < 1e-3 && Math.abs(q.W - q.Wwant) < 1e-3) && G[0].left < G[0].gx && G[1].right > G[1].gx, JSON.stringify(G)); } }

  // 5. an interrupt, the drawn cell, the facing
  { const pre = JSON.parse(run(CAST('green', { cancelAt: 0.1 }))), post = JSON.parse(run(CAST('blue', { cancelAt: 0.48 })));
    ck(`an interrupted cast: before its cell the art never shows (Warcry cancelled at 0.1 s: shown ${pre.shown}); after it, it fades out (Bloodthirst cancelled at 0.48: shown ${post.shown}, cut ${post.cut}, gone ${post.gone})`,
      pre.shown === null && pre.fx.length === 0 && post.shown != null && post.cut != null && post.gone != null && post.gone - post.cut <= 0.15 + 2 * C.step, JSON.stringify({ pre, post: post.cells })); }
  { const L = JSON.parse(run(`(()=>{ clearFx1123(); const g=makeUnit('vael','ally',500,700,30,{owned:false}); g.anim=BATTLE_ANIM.vael; g._pend={t:0.5}; fx16Cast(g,'vwarcry',0.5,g._pend,6);
      const o=_fx1123.find(q=>q.kind==='fx16'); g._animSt='green'; g._abilAnim='green'; const r=[];
      for(const a of [6,7]){ g._animAcc=20; g._fxFr=a; o.t=0.001; _fx22Fx16Tick(o); r.push(!!o.s); }
      clearFx1123(); return JSON.stringify(r); })()`));
    ck('with his clip up the art follows the cell he is DRAWN on (_fxFr 6: not yet; 7: shown - with _animAcc already at 20), not the clock or the accumulator', JSON.stringify(L) === '[false,true]', JSON.stringify(L)); }
  { const M = JSON.parse(run(`(()=>{ const g=makeUnit('vael','ally',500,700,30,{owned:false}); const mk=()=>({center:{set(){}},scale:{set(){}},position:{copy(){}},_uv:[0.12,0.09,0.3,0.4]});
      const o={d:FX2_DEF.vael_ult,u:g,s:mk()}; g._fxMirror=false; _fx22Fx16Up(o); const a=o.s._uv[0]; g._fxMirror=true; _fx22Fx16Up(o); const b=o.s._uv[0]; return JSON.stringify([a,b]); })()`));
    ck('upright art is mirrored (UV window) with his facing', M[0] > 0 && M[1] < 0, JSON.stringify(M)); }
  ck('hooks: castKit starts the green / blue art and castAbility the ult art at the press (FX16_ART), abilArt confirms at the release, the burrow timer calls the emerge burst, the tick runs them',
    /if\(ab\.ownFx&&FX16_ART\[ab\.ownFx\]\) fx16Cast\(u,ab\.ownFx,ct,u\._pend,ab\.dur\|\|6\)/.test(src) && /if\(_ua\.ownFx&&FX16_ART\[_ua\.ownFx\]\) fx16Cast\(u,_ua\.ownFx,_ct,u\._pend/.test(src) && /ownFx==='dburrow'\) deepcleftEmergeFx\(u\)/.test(src) &&
    /else if\(FX16_ART\[o\.ownFx\]\)\{ try\{ const c=/.test(src) && /if\(o\.kind==='fx16'\)\{ if\(_fx22Fx16Tick\(o\)<0\)/.test(src) &&
    /const _buffArt=!!\(o&&o\.gfx&&FX2_DEF\[o\.gfx\]&&_ABOVE_BAR\[type\]\)&&!o\.ownFx;/.test(src));
  { const P = JSON.parse(run(`JSON.stringify([0,1,2].map(sl=>{ const p=skillPreviewPlan('vael',sl); return p?p.fx.map(e=>({k:e.k,kind:e.kind,t0:+e.t0.toFixed(4),real:e.real!=null?+e.real.toFixed(3):null,life:e.life!=null?+e.life.toFixed(4):null})):null; }))`));
    const [u, g, b] = P, sp = c => +(c / 24).toFixed(4);
    ck('Skills tab previews (v1164) show the new art at the moment the fight shows it: Warcry flat (disc22) from green cell 7, Bloodthirst and Last Stand upright (fx16up) from blue cell 16 / ult cell 8, each for its real length (' + JSON.stringify(P) + ')',
      g && g.length === 1 && g[0].k === 'vael_green' && g[0].kind === 'disc22' && g[0].t0 === sp(7) && Math.abs(g[0].real - 67 / 12) < 1e-3 &&
      b && b.length === 1 && b[0].k === 'vael_blue' && b[0].kind === 'fx16up' && b[0].t0 === sp(16) && Math.abs(b[0].life - (0.5 - 16 / 24 * C.FX_RT + 6)) < 1e-3 && Math.abs(b[0].real - b[0].life / C.FX_RT) < 1e-3 &&
      u && u.length === 1 && u[0].k === 'vael_ult' && u[0].kind === 'fx16up' && u[0].t0 === sp(8) && Math.abs(u[0].life - (0.3 - 8 / 24 * C.FX_RT + 5)) < 1e-3, JSON.stringify(P));
    const D = JSON.parse(run(`JSON.stringify([0,1,2].map(sl=>{ const p=skillPreviewPlan('deepcleft',sl); return p?p.fx.map(e=>({k:e.k,kind:e.kind,at:e.at||null,t0:+e.t0.toFixed(4),R:e.R||null,real:e.real!=null?+e.real.toFixed(3):null})):null; }))`)), rel = 0.5 / C.FX_RT;
    const [du, dg, db] = D;
    ck('Deepcleft previews: Fault Claws flat (fx16claws) from green cell 18; Burrow Guard (fx16puff) at his feet from blue cell 15 and under the target on the emerge (release + 1.4 fight s); Quarry Collapse disc22 on the target at 120 units from ult cell 9 (22 fps): ' + JSON.stringify(D),
      dg && dg.length === 1 && dg[0].kind === 'fx16claws' && dg[0].t0 === +(18 / 24).toFixed(4) &&
      db && db.length === 2 && db[0].kind === 'fx16puff' && db[0].at === 'self' && db[0].t0 === +(15 / 24).toFixed(4) && db[1].at === 'target' && Math.abs(db[1].t0 - (rel + 1.4 / C.FX_RT)) < 1e-3 &&
      du && du.length === 1 && du[0].kind === 'disc22' && du[0].at === 'target' && du[0].R === 120 && du[0].t0 === +(9 / 22).toFixed(4), JSON.stringify(D));
    const stage = fs.readFileSync(path.join(ROOT, 'assets/ui/skill-preview-stage.js'), 'utf8');
    ck('the preview stage draws the fx16up / fx16puff / fx16claws kinds (fxBox + drawFx) and the page loads it at a new ?v= (sp1168; BASE sp1164)', /case 'fx16up': case 'fx16puff': \{ const H=d\.size\*h/.test(stage) && /case 'fx16up': \{ const life=e\.life\|\|5;/.test(stage) && /case 'fx16puff': case 'fx16claws': \{ const L=e\.real\|\|5;/.test(stage) &&
      src.includes('skill-preview-stage.js?v=sp1168') && baseSrc.includes('skill-preview-stage.js?v=sp1164')); }
  { const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/anim/tiers_1141.json'), 'utf8')).sheets, t0 = cp.execSync('git show ' + BASE_SHA + ':assets/anim/tiers_1141.json', { cwd: ROOT }).toString();
    const live = JSON.parse(run(`JSON.stringify(['vael_green','vael_blue','vael_ult','deepcleft_green','deepcleft_blue','deepcleft_ult'].map(k=>typeof artFile==='function'?artFile(FX2_DEF[k].u):null))`));
    ck('the tier table is BASE byte for byte (no ?v= change): its entries for the replaced plates are left unreferenced, and the new sheets have no tier file (each is <= 2048 px: the phone loads it and v1140 sizes it, as the v1160 Veyr FX)',
      fs.readFileSync(path.join(ROOT, 'assets/anim/tiers_1141.json'), 'utf8') === t0 && !!T['/assets/anim/fx/vael_green.webp'] && live.every(x => x === null)); }
  ck('no emoji added', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src.slice(src.indexOf('const FX16_ART='), src.indexOf('const FX16_ART=') + 9000)));
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
