'use strict';
// v1127 SKILL HOLD (Phil 11 Oct 2026: "yes fix it for all heroes"). Pellucid's next swing cut Meteor Knuckle before the fist hit the ground
// (3 of 7 casts) and Infernal Clinch before the hands closed: the v1031 rule let a swing end a green/blue clip as soon as the cast lock ended.
// Now a swing may replace a skill clip only after that clip has SHOWN its contact cell (clipContactCell); the swing waits, then starts caught up.
// It is render-only. This test runs whole fights through the REAL battle engine (server/sim-host.js, the file the server replays fights with)
// AND the real renderer's syncMesh (stub meshes, every clip marked loaded), the way loop() drives them: SIM_STEP ticks off the render clock.
//   1. ENGINE: per tick, every unit's hp / x / y / alive / energy / atkCd / cast lock / root and the number of seeded RNG draws are IDENTICAL
//      with the new renderer, the old (v1126) renderer and no renderer at all - nothing the hold does reaches the fight.
//   2. RENDER: in every fight, every time an attack/crit clip replaces a green or blue clip on screen, that skill clip had been drawn past its
//      contact cell; every hero in BATTLE_ANIM gets a contact cell inside its clips (Hollow and Pellucid redo1 included).
// CONTROLS: the old v1126 renderer cuts skill clips before contact in the same fights (assertion 2 fails on it); a fight where the hold would
// wrongly gate the engine is caught (a deliberately leaking variant moves the trace).
// v1131 PASSIVE HOLD: 4 more fights with timed passives (Lumi Hush, Tharl Layered Hide, Ambrel Sacred Bells, Hollow, Hurne) plus the 5 above:
// no passive takes the screen from a green/blue before its contact cell or from an unfinished ult, and no passive filler shows under
// CC/silence; engine identical with the v1131 renderer, the v1130 passive renderer and none. PCONTROL (v1130 passive lines) must fail it.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'emberweave-heroes.html');
const SRC = fs.readFileSync(HTML, 'utf8');
const NL = SRC.includes('\r\n') ? '\r\n' : '\n';
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };

// The v1126 renderer: the new hold block swapped back for the one-line v1031 rule (catch-up and the seen-cell tracking become dead code without it).
const OLD_RULE = "        if(u.attackAnim>0 && (u._abilHold||0)>0 && (u._abilPri|0)===4 && (u._abilAnim==='green'||u._abilAnim==='blue') && !((u._castT||0)>0)){ u._abilHold=0; u._abilAnim=null; u._abilPri=0; if((u._lockPri|0)===4){ u._lockPri=1; u._animLockT=0; } }";
const i0 = SRC.indexOf('        { const _skOn='), i1 = SRC.indexOf('          u._swAA=u.attackAnim; }', i0);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skillhold-'));
// the page's external game scripts (hero profiles, glyph paths) load from beside the html, as sim-host does in production: copy them across
for (const raw of [...SRC.matchAll(/<script\s+src=["']\/([^"']+)["'][^>]*><\/script>/g)].map(m => m[1].split('?')[0]).filter(s => !s.startsWith('assets/'))) {
  const from = path.join(ROOT, raw); if (!fs.existsSync(from)) continue; const to = path.join(tmp, raw); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); }
const write = (name, text) => { const f = path.join(tmp, name); fs.writeFileSync(f, text); return f; };
let OLD = null, LEAK = null;
if (i0 > 0 && i1 > i0) {
  const end = i1 + '          u._swAA=u.attackAnim; }'.length;
  OLD = write('old.html', SRC.slice(0, i0) + OLD_RULE + SRC.slice(end));
  // a deliberately WRONG hold that gates the engine (holds the attack cooldown while it waits): the trace must see it
  LEAK = write('leak.html', SRC.replace('if(_skPast()) _letGo(); else u._swWait=0; }', 'if(_skPast()) _letGo(); else { u._swWait=0; u.atkCd+=0.4; } }'));
}
ck('the hold block is in the renderer (and the old v1031 rule is gone)', !!OLD && !SRC.includes(OLD_RULE));
if (!OLD) { console.log('FAIL ' + pass + ' checks, ' + (fail) + ' failed'); process.exitCode = 1; return; }

const hosts = {};
const hostFor = f => hosts[f] || (hosts[f] = require(path.join(ROOT, 'server/sim-host.js')).load(f));
const FIGHTS = [
  [['pellucid', 'vael', 'sloe'], ['grosk', 'pellucid', 'rhukk'], 11],
  [['pellucid', 'konwu'], ['umbris', 'tick', 'pellucid'], 222],
  [['hollow', 'pellucid', 'astra'], ['vael', 'grosk', 'korvux'], 5],
  [['gruel', 'carn', 'tharl'], ['sorrel', 'hollow', 'rhukk'], 77],
  [['pellucid', 'hollow'], ['pellucid', 'umbris'], 31],
];
// one fight: `render` drives syncMesh every 1/60 s render frame exactly as loop() does (gameSpeed 1); returns the per-tick engine trace
// digest, the skill->swing cuts seen on screen, and how many skill segments were drawn
function fight(file, [a, f, seed], render) {
  const H = require(path.join(ROOT, 'server/sim-host.js')).load(file);   // a FRESH game per fight: no global state carried from an earlier run
  const run = s => vm.runInContext(s, H.ctx);
  require('./helpers/anim-slim-1155.js').undoSlim1155(run);   // v1155 slim: these renderer checks (and the PCONTROL's Pellucid filler passive) run on the v1153 entries
  return JSON.parse(run(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true; const tr=[]; const cuts=[]; const swings=[]; let err=null, segs=0; const pcuts=[], disp=[], seenPO=[], pjump=[]; let muted=0, fr=0;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      let draws=0; const _r0=_brng; _brng=function(){ draws++; return _r0(); };
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      const T={image:{width:1,height:1},repeat:{set(){}},offset:{set(){}}};
      units.forEach(u=>{ const B=BATTLE_ANIM[u.key]; if(!B||!heroHasAnim(u.key)) return; const set={};
        for(const s in B) set[s]=${render ? 'Object.assign({},B[s],{tex:T})' : 'B[s]'};
        u.anim=set; ${render ? 'u.mesh=new THREE.Group(); u.sprite=new THREE.Sprite();' : ''} });
      window._p2guard=false;
      const seg=new Map(); let acc=0; const RD=1/60;
      for(fr=0; fr<60*70 && !ended; fr++){ acc+=RD*SIM_HZ*BATTLE_PACE; let n=Math.floor(acc); if(n>8)n=8; acc-=n;
        for(let i=0;i<n&&!ended;i++){ updateBattle(SIM_STEP);
          tr.push(units.map(u=>[Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*100),Math.round((u.atkCd||0)*1000),Math.round((u._castT||0)*1000),Math.round((u._ultRootT||0)*1000)].join(':')).join('|')+'#'+draws); }
        ${render ? `for(const u of units){ if(!u.mesh||!u.alive) continue; const held=(u._abilHold||0)>RD && (u._abilPri|0)===4 && u._abilAnim===u._animSt, waited=(u._swWait!=null); const pm0=!!u._passMute, po=u._passOver, pfr=u._fxFr|0, pst=u._animSt; try{ syncMesh(u,RD); }catch(e){ if(!err) err=String(e&&e.stack||e).slice(0,300); }
          const c=seg.get(u), st=u._animSt, ctl=(u.stunned>0)||((u.fearT||0)>0)||((u._airT||0)>0)||((u.pullT||0)>0)||((u.silencedT||0)>0);
          if(u._passOver && !seenPO.includes(u._passOver)){ seenPO.push(u._passOver); disp.push([u.key,u._passOver.st,u._passOver.pri]); }
          if(u._passMute && !pm0) muted++;
          if(po && u._passOver===po && pst===po.st && u._animSt===po.st && ((u._fxFr|0)-pfr>2 || (u._fxFr|0)<pfr)) pjump.push([u.key,po.st,pfr,u._fxFr|0]);
          if(!c||c.st!==st){ let after=false; if(c && (c.st==='green'||c.st==='blue')){ segs++;
              const atk=(st==='attack'||st==='crit'); if(atk && held){ cuts.push([u.key,u.team,c.st,c.max,st,+battleTime.toFixed(3)]); after=waited; } }
            if(c && c.after) swings.push([u.key,c.st,c.first,c.max,st||'']);
            if(c && st==='passive' && (c.st==='green'||c.st==='blue'||c.st==='ult')) pcuts.push([u.key,u.team,c.st,c.max,+((fr-c.f0)*RD).toFixed(3),+(c.os||0).toFixed(3),ctl?1:0,+battleTime.toFixed(3),u._passFired?1:0]);
            seg.set(u,{st,max:(u._fxFr|0),first:(u._fxFr|0),after,f0:fr,os:u._osMax||0}); }
          else c.max=Math.max(c.max,u._fxFr|0); }` : ''} }
    } finally{ autoUlt=svA; window._p2guard=false; }
    return JSON.stringify({digest:require_digest(tr), ticks:tr.length, cuts, swings, err, segs, pcuts, disp, muted, pjump}); })()`.replace('require_digest(tr)', 'tr.join("\\n")')));
}
const dig = r => { r.digest = crypto.createHash('sha256').update(r.digest).digest('hex'); return r; };

// contact cells from the NEW table, for every hero and every clip
const runNew = s => vm.runInContext(s, hostFor(HTML).ctx);
const CC = JSON.parse(runNew(`(()=>{ const o={}; for(const h in BATTLE_ANIM){ const set=BATTLE_ANIM[h]; if(!set||typeof set!=='object'||!heroHasAnim(h)) continue; o[h]={};
  for(const s in set){ const A=set[s]; if(A&&A.n>0) o[h][s]=clipContactCell(A); } } return JSON.stringify(o); })()`));
const badCC = [];
for (const h in CC) for (const s in CC[h]) { const c = CC[h][s]; if (!(Number.isInteger(c) && c >= 0)) badCC.push(h + '.' + s); }
const heroes = Object.keys(CC);
ck('every hero in BATTLE_ANIM gets a contact cell inside each of its clips (' + heroes.length + ' heroes, Hollow + Pellucid included)',
  !badCC.length && heroes.includes('hollow') && heroes.includes('pellucid') && heroes.every(h => ['green', 'blue', 'ult'].every(s => !runNew(`!!(BATTLE_ANIM[${JSON.stringify(h)}]||{})[${JSON.stringify(s)}]`) || CC[h][s] != null)), badCC.join(' '));
ck('measured cells win: Pellucid green 17 / blue 9 (fist on the ground, hands close), Hollow green 8 / blue 17 (release), Pellucid attack 13 (relFrac 13/48), Hollow attack 28 (contact)',
  CC.pellucid.green === 17 && CC.pellucid.blue === 9 && CC.hollow.green === 8 && CC.hollow.blue === 17 && CC.pellucid.attack === 13 && CC.hollow.attack === 28,
  JSON.stringify([CC.pellucid.green, CC.pellucid.blue, CC.hollow.green, CC.hollow.blue, CC.pellucid.attack, CC.hollow.attack]));
ck('a clip with no measured data falls back to halfway (the engine\'s own blow default)', runNew('clipContactCell({n:48,fps:24})') === 24 && runNew('clipContactCell({n:46})') === 23);

const early = cuts => cuts.filter(c => !(c[3] > CC[c[0]][c[2]]));
let sameAll = true, sameLeak = true, cutsNew = 0, earlyNew = [], earlyOld = [], segsNew = 0, errs = [], swNew = [];
for (const F of FIGHTS) {
  const bare = dig(fight(HTML, F, false)), nw = dig(fight(HTML, F, true)), od = dig(fight(OLD, F, true)), lk = dig(fight(LEAK, F, true));
  if (nw.err || od.err) errs.push(nw.err || od.err);
  const same = bare.digest === nw.digest && nw.digest === od.digest && bare.ticks === nw.ticks;
  sameAll = sameAll && same;
  if (lk.digest !== od.digest) sameLeak = false;
  cutsNew += nw.cuts.length; segsNew += nw.segs; swNew = swNew.concat(nw.swings);
  earlyNew = earlyNew.concat(early(nw.cuts)); earlyOld = earlyOld.concat(early(od.cuts));
  console.log('      ' + F[0].join(',') + ' vs ' + F[1].join(',') + ' seed ' + F[2] + ': ' + nw.ticks + ' ticks, engine ' + (same ? 'identical' : 'DIFFERS') +
    '; skill clips drawn ' + nw.segs + ', swing took over ' + nw.cuts.length + ' (old ' + od.cuts.length + ', ' + early(od.cuts).length + ' before contact)');
}
ck('the renderer runs headless with no error', !errs.length, errs[0]);
ck('ENGINE: whole fights are tick-for-tick identical - new renderer, old renderer, no renderer (hp, x, y, alive, energy, atkCd, cast lock, root, RNG draws)', sameAll);
ck('CONTROL: a hold that leaks into the engine (adds to atkCd while waiting) changes the trace', !sameLeak);
ck('RENDER: every swing that replaces a green/blue clip comes after the clip has drawn past its contact cell (' + cutsNew + ' takeovers, ' + segsNew + ' skill clips)',
  cutsNew > 0 && earlyNew.length === 0, JSON.stringify(earlyNew.slice(0, 4)));
ck('CONTROL: the old v1126 renderer cuts skill clips before their contact cell in the same fights (' + earlyOld.length + ' early cuts)',
  earlyOld.length > 0 && earlyOld.some(c => c[0] === 'pellucid'), JSON.stringify(earlyOld.slice(0, 3)));
// the swing that took over after a skill: it must be SEEN to land - its own contact cell drawn - unless a higher clip (hit flinch, a skill,
// an ult, CC) took the screen from it first. Caught up, never started past its blow.
const swMiss = sw => sw.filter(w => !(w[3] >= CC[w[0]][w[1]]) && (w[4] === 'idle' || w[4] === 'walk'));
const swLate = sw => sw.filter(w => w[2] > CC[w[0]][w[1]]);
ck('CATCH-UP: every swing that WAITED behind a skill draws its own contact cell (the blow is seen to land) and never starts past it (' + swNew.length + ' swings)',
  swNew.length > 0 && !swMiss(swNew).length && !swLate(swNew).length, JSON.stringify(swMiss(swNew).concat(swLate(swNew)).slice(0, 4)));
// v1131 PASSIVE HOLD. A timed passive (firePassiveClip) could still take the screen from a green/blue clip before its contact cell or from
// an ult: a swing rolled during a held skill drops the lock to 1, and the passive's queue test reads only the lock. And when CC or silence
// cut a clip, the idle filler could pick the passive sheet (Pellucid feared at green cell 1, silenced at ult cell 24). Now the screen holds the
// displaced clip (green/blue to past contact, ult to the end of its hold), then fits or skips the passive; under control the filler is idle.
// PCONTROL = this renderer with the v1131 lines taken out (= the v1130 passive behaviour).
const PASS_NOTE = "  o._passOver=passiveMustWait(o)?{st:o._abilAnim,pri:o._abilPri|0,hold:o._abilHold||0}:null;   /* v1131 passive hold - render only, see passiveMustWait */" + NL;
const PASS_CTL = " && !_ctlNow;";
ck('the v1131 passive hold is in the renderer (displaced-clip note + no passive filler under control)', SRC.includes(PASS_NOTE) && SRC.includes(PASS_CTL));
const PCONTROL = write('pctl.html', SRC.replace(PASS_NOTE, '').replace(PASS_CTL, ';'));
const OSH_FIX = "(u._passOver&&st===u._passOver.st)?u._passOver.hold:(u._abilHold||0)";   // the held clip is fitted to its own hold
const JCONTROL = SRC.includes(OSH_FIX) ? write('jctl.html', SRC.replace(OSH_FIX, '(u._abilHold||0)')) : null;
const PFIGHTS = FIGHTS.concat([
  [['lumi', 'tharl', 'ambrel'], ['pellucid', 'vael', 'grosk'], 13],
  [['hollow', 'lumi', 'pellucid'], ['tharl', 'umbris', 'sloe'], 42],
  [['ambrel', 'hurne', 'lumi'], ['rhukk', 'pellucid', 'korvux'], 7],
  [['tharl', 'lumi'], ['hollow', 'ambrel', 'tick'], 90],
]);
// a passive on screen right after a green/blue clip must come after that clip drew past its contact cell; right after an ult, only once the
// ult has played its whole hold (2 render frames of slack). Under CC/silence the clip was cut by the control (Phil's ladder, kept): the
// passive seen next may be a timed passive that fired (its own event), never the idle filler's passive sheet.
const pBad = pc => pc.filter(([k, , st, max, el, os, ctl, , fired]) => ctl ? !fired : (st === 'ult' ? !(el >= os - 2 / 60) : !(max > CC[k][st])));
let pSame = true, pNew = [], pOld = [], dispN = [], mutedN = 0, pErr = [], jumpN = []; let jumpC = [];
for (const F of PFIGHTS) {
  const extra = !FIGHTS.includes(F);
  const nw = fight(HTML, F, true), od = fight(PCONTROL, F, true);
  if (nw.err || od.err) pErr.push(nw.err || od.err);
  if (extra) { const bare = dig(fight(HTML, F, false)); dig(nw); dig(od);
    const same = bare.digest === nw.digest && nw.digest === od.digest && bare.ticks === nw.ticks; pSame = pSame && same;
    console.log('      ' + F[0].join(',') + ' vs ' + F[1].join(',') + ' seed ' + F[2] + ': ' + nw.ticks + ' ticks, engine ' + (same ? 'identical' : 'DIFFERS')); }
  else { dig(nw); dig(od); if (nw.digest !== od.digest) pSame = false; }
  pNew = pNew.concat(pBad(nw.pcuts)); pOld = pOld.concat(pBad(od.pcuts)); dispN = dispN.concat(nw.disp); mutedN += nw.muted; jumpN = jumpN.concat(nw.pjump); if (JCONTROL) jumpC = jumpC.concat(fight(JCONTROL, F, true).pjump);
}
console.log('      passive took the fields from a running clip ' + dispN.length + 'x (' + dispN.filter(d => d[2] >= 6).length + ' ult, ' + dispN.filter(d => d[2] < 6).length + ' green/blue before contact); body clip skipped ' + mutedN + 'x');
ck('PASSIVE: the renderer runs headless with no error', !pErr.length, pErr[0]);
ck('PASSIVE ENGINE: ' + PFIGHTS.length + ' fights tick-for-tick identical - v1131 renderer, v1130 passive renderer, no renderer', pSame);
ck('PASSIVE: the case is exercised - timed passives fire while a green/blue (before contact) and an ult clip run', dispN.some(d => d[2] >= 6) && dispN.some(d => d[2] === 4), JSON.stringify(dispN.slice(0, 6)));
ck('PASSIVE RENDER: no passive takes the screen from a green/blue before its contact cell, from an unfinished ult, or under CC/silence', pNew.length === 0, JSON.stringify(pNew.slice(0, 4)));
ck('PASSIVE RENDER: a clip held for a passive plays on cell by cell at its own pace - never jumps ahead past its contact (' + jumpN.length + ' jumps)', jumpN.length === 0, JSON.stringify(jumpN.slice(0, 4)));
ck('JCONTROL: fitting the held clip to the passive hold (the first v1131 draft) jumps it ahead (' + jumpC.length + ' jumps)', !!JCONTROL && jumpC.length > 0, JSON.stringify(jumpC.slice(0, 3)));
ck('PCONTROL: the v1130 passive renderer does, in the same fights (' + pOld.length + ' early passive takeovers: ' + pOld.filter(c => c[8] && !c[6]).length + ' timed passives over a green/blue before contact or an ult, ' + pOld.filter(c => c[6] && !c[8]).length + ' passive filler under CC/silence, Pellucid among them)',
  pOld.some(c => c[8] && !c[6]) && pOld.some(c => c[6] && !c[8]) && pOld.some(c => c[0] === 'pellucid'), JSON.stringify(pOld.slice(0, 4)));
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
