'use strict';
// v1391 SKILL REACH (audit "SKILL REACH AUDIT 14NOV2026": skills that never land in real fights). ENGINE = the page's own code, which the
// client runs and server/sim-host.js replays, so client and server replay stay identical.
//   A. STALE AIM: a Green/Blue cast read u._aimWX, the spot of the hero's LAST aimed ultimate (never cleared), so Astra's Starfire and Nebula,
//      Bloatus's Toxic Breath and Pyroclast's Blazing Orbit fired at that old spot. castKit now gives the pending cast only the aim it picks
//      itself (none, or the densest pack for a ground area), and a delivered Green/Blue arrival reads the aim it was released with.
//      An aimed ultimate reads exactly what it read before.
// CONTROLS: every check that proves a fix also runs on the pre-fix page (git BASE below, or EW_BASE) and must FAIL there.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE = process.env.EW_BASE || 'a077917d6cfb59973c46043ca77bc832a5123f6c';   // v1391-work before the reach fixes
const BD = fs.mkdtempSync(path.join(os.tmpdir(), 'reach1391-'));
process.on('exit', () => { try { fs.rmSync(BD, { recursive: true, force: true }); } catch (e) {} });
let baseOk = true;
try { fs.mkdirSync(path.join(BD, 'server'));
  for (const f of ['emberweave-heroes.html', 'hero-profiles.js', 'hero-paths.js', 'hero61.js', 'world-realm.js', 'server/temple-of-ash.js', 'server/patron-benefits.js', 'server/temple-effects.js'])
    { let b; try { b = cp.execSync('git show ' + BASE + ':' + f, { cwd: ROOT, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }); }
      catch (e) { if (f === 'emberweave-heroes.html') throw e; b = fs.readFileSync(path.join(ROOT, f)); }   // PC 2's git shim serves only the page: these scripts are the same at BASE
      fs.writeFileSync(path.join(BD, f), b); } } catch (e) { baseOk = false; }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML), R0 = baseOk ? load(path.join(BD, 'emberweave-heroes.html')) : null;
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 900) : '')); } };
const J = (r, s) => JSON.parse(r(s));
const RESET = `units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9);`;
const HOLD = `units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0; u.atkInterval=99; u.atkCd=99; u.speed=0; u.greenCd=u.blueCd=99; u.ctrlRes=0;});`;
const KEEP = `units.forEach(u=>{u.energy=Math.min(u.energy,0); u.atkCd=99; u.greenCd=u.blueCd=99;}); if(S.ghost) units.forEach(u=>{u._pullGhost=true;});`;
/* STAGE: the caster at (500,700), enemies at {k,dx,dy} metres from him (positive dx = towards the enemy side); t = index of his target.
   aim = a stale aim left by an earlier aimed ult ({dx,dy} metres) or null. The skill is pressed the way the fight presses it
   (castKit with the slot's skill multiplier, then the fight clock runs: the cast time, the delivery, the effect).
   Returns the keys each enemy / ally the cast touched (damage, control, damage-over-time, heal, buff), and the aim left on him after. */
const STAGE = (r, s) => J(r, `(()=>{ ${RESET} const S=${JSON.stringify(s)};
  const h=makeUnit(S.hero,'ally',500,700,30,{owned:false,rank:3}); if(h._backHunter){ h._dropT=0; h._dropHidden=false; h._backHunter=false; }   // Hollow waits off the field for his drop: here he is on it
  const es=S.en.map(q=>makeUnit(q.k,'enemy',500+(q.dx||0)*METER,700+(q.dy||0)*METER,30,{owned:false,rank:3}));
  const as=(S.al||[]).map(q=>makeUnit(q.k,'ally',500+(q.dx||0)*METER,700+(q.dy||0)*METER,30,{owned:false,rank:3}));
  const place=(arr,qs)=>qs.forEach((q,i)=>{ if(q.edge==null) return; const e=arr[i], c=(q.from!=null)?es[q.from]:h, a=(q.ang||0)*Math.PI/180, d=q.edge*METER+bodyR(e); e.x=c.x+Math.cos(a)*d; e.y=c.y+Math.sin(a)*d; e._ax=e.x; e._ay=e.y; });
  const placeAll=()=>{ h.x=500; h.y=700; h._ax=h.x; h._ay=h.y; S.en.forEach((q,i)=>{ if(q.edge==null){ es[i].x=500+(q.dx||0)*METER; es[i].y=700+(q.dy||0)*METER; es[i]._ax=es[i].x; es[i]._ay=es[i].y; } }); (S.al||[]).forEach((q,i)=>{ if(q.edge==null){ as[i].x=500+(q.dx||0)*METER; as[i].y=700+(q.dy||0)*METER; } }); place(es,S.en); place(as,S.al||[]); };
  placeAll();
  units=[h,...es,...as]; ${HOLD} if(S.ghost) units.forEach(u=>{u._pullGhost=true;}); if(S.t!=null) h.target=es[S.t];
  as.forEach(a=>{ a.hp=a.maxHp*0.5; });
  if(S.aim){ h._aimWX=h.x+S.aim.dx*METER; h._aimWY=h.y+S.aim.dy*METER; } else { h._aimWX=null; h._aimWY=null; }
  const aim0=h._aimWX;
  const hit=new Set(), ally=new Set(); const own=s=>s&&(s===h||ddOwner(s)===h);
  const _dd=dealDamage, _cc=ccApply, _pd=pushDot, _pl=plagueDot, _hf=healFrom;
  dealDamage=function(s,t){ if(own(s)&&t&&t.team!==h.team) hit.add(es.indexOf(t)); return _dd.apply(this,arguments); };
  ccApply=function(s,t){ if(own(s)&&t&&t.team!==h.team) hit.add(es.indexOf(t)); return _cc.apply(this,arguments); };
  pushDot=function(t,dps,dur,iv,col,s){ if(own(s)&&t&&t.team!==h.team) hit.add(es.indexOf(t)); return _pd.apply(this,arguments); };
  plagueDot=function(t,dps,dur,iv,col,s){ if(own(s)&&t&&t.team!==h.team) hit.add(es.indexOf(t)); return _pl.apply(this,arguments); };
  healFrom=function(s,t){ if(own(s)&&t&&t!==h) ally.add(as.indexOf(t)); return _hf.apply(this,arguments); };
  const pre=as.map(a=>[a.drMul||1,a.hasteMul||1,a.drT||0]);
  try{ updateBattle(SIM_STEP); ${KEEP} placeAll(); if(S.pre) eval(S.pre);   /* placed again after the first tick: an assassin opens the fight with a dive */
    if(S.slot==='ult'){ h.energy=100; if(S.ultAim){ h._aimWX=h.x+S.ultAim.dx*METER; h._aimWY=h.y+S.ultAim.dy*METER; } castAbility(h); }
    else if(S.slot==='none'){ }
    else if(S.direct){ h._castSM=1; h._castLv=1; h._castSlot=S.slot; doEffect(h,S.direct,Object.assign({},KITS[S.hero][S.slot],{_arrived:true,_tgtU:(S.t!=null?es[S.t]:null)})); h._castSlot=null; }
    else { h._castSM=skillMul(1); h._castLv=1; castKit(h,KITS[S.hero][S.slot]); h._castSM=1; h._castLv=0; }
    for(let i=0;i<Math.round((S.secs||3)/SIM_STEP);i++){ updateBattle(SIM_STEP); ${KEEP} } }
  finally{ dealDamage=_dd; ccApply=_cc; pushDot=_pd; plagueDot=_pl; healFrom=_hf; }
  as.forEach((a,i)=>{ const p=pre[i]; if((a.drMul||1)!==p[0]||(a.hasteMul||1)!==p[1]||(a.drT||0)>p[2]) ally.add(i); });
  es.forEach((e,i)=>{ if(e.hp<e.maxHp) hit.add(i); }); const tgt=(S.t!=null)?es[S.t]:null;
  return JSON.stringify({hit:[...hit].filter(i=>i>=0).sort(), ally:[...ally].filter(i=>i>=0).sort(), aimAfter:(h._aimWX===aim0)?'same':(h._aimWX==null?'none':'moved'),
    edge:es.map(e=>+((dist(h,e)-bodyR(e))/METER).toFixed(2)), cc:es.map(e=>+(dist(h,e)/METER).toFixed(2)), body:es.map(e=>+(bodyR(e)/METER).toFixed(2)),
    aedge:as.map(a=>+((dist(h,a)-bodyR(a))/METER).toFixed(2)), tedge:tgt?es.map(e=>+((dist(tgt,e)-bodyR(e))/METER).toFixed(2)):null}); })()`);
const fmt = x => 'hit [' + x.hit.join(',') + ']' + (x.ally.length ? ' allies [' + x.ally.join(',') + ']' : '');

try {
  ck('control page (git ' + BASE.slice(0, 9) + ' + its external scripts) loaded', !!R0);
  { const src = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of src.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block of the page parses (' + n + ' blocks)', n > 0 && !bad.length, bad.join('; ')); }

  // ================= A. stale aim =================
  // each: the hero, his current target in front of him, and the spot of an earlier aimed ult 8-12 m away where nobody stands
  const A = [
    ['Astra\'s Starfire (green)', { hero: 'astra', slot: 'green', en: [{ k: 'grosk', dx: 9, dy: 0 }], t: 0, aim: { dx: 4, dy: -9 } }],
    ['Astra\'s Nebula (blue)', { hero: 'astra', slot: 'blue', en: [{ k: 'grosk', dx: 9, dy: 0 }], t: 0, aim: { dx: 4, dy: -9 }, secs: 2 }],
    ['Bloatus\'s Toxic Breath (green)', { hero: 'bloatus', slot: 'green', en: [{ k: 'grosk', dx: 5, dy: 0 }], t: 0, aim: { dx: 0, dy: -9 } }],
    ['Pyroclast\'s Blazing Orbit (blue)', { hero: 'pyroclast', slot: 'blue', en: [{ k: 'vael', dx: 2.2, dy: 0 }], t: 0, aim: { dx: 12, dy: -6 }, ghost: 1 }],
  ];
  for (const [name, s] of A) {
    const a = STAGE(run, s), b = STAGE(R0, s), c = STAGE(run, Object.assign({}, s, { aim: null }));
    ck('A ' + name + ' after an aimed ult lands on its current target (' + fmt(a) + ')', a.hit.includes(0), JSON.stringify(a));
    ck('A ' + name + ': the same cast with no old aim lands the same (' + fmt(c) + ')', JSON.stringify(c.hit) === JSON.stringify(a.hit), JSON.stringify(c));
    ck('A ' + name + ': the old ult aim is still on the hero after the cast (' + a.aimAfter + ')', a.aimAfter === 'same', JSON.stringify(a));
    ck('A CONTROL ' + name + ': on the pre-fix page it fired at the old spot and hit nobody (' + fmt(b) + ')', b.hit.length === 0, JSON.stringify(b)); }
  // an aimed ULT reads the player's aim exactly as before: Astra's Collapsing Star and Pyroclast's Crownfire, aimed at a pack 3 m off her target,
  // after a Green cast (which used to leave the aim alone, and now still does)
  for (const [name, hero] of [['Astra\'s Collapsing Star', 'astra'], ['Pyroclast\'s Crownfire', 'pyroclast']]) {
    const s = { hero, slot: 'ult', en: [{ k: 'grosk', dx: 9, dy: 0 }, { k: 'vael', dx: 9, dy: -7 }, { k: 'lumi', dx: 10, dy: -8 }], t: 0, ultAim: { dx: 9.5, dy: -7.5 }, secs: 4 };
    const a = STAGE(run, s), b = STAGE(R0, s);
    ck('A ' + name + ' (aimed ult) lands on the aimed pack exactly as on the pre-fix page (' + fmt(a) + ' / ' + fmt(b) + ')', JSON.stringify(a.hit) === JSON.stringify(b.hit) && a.hit.includes(1) && a.hit.includes(2), JSON.stringify([a, b])); }
  // a Green ground area (Maren's Tide Pool, AUTO_GROUND_AOE) still picks its own aim, the densest pack, as before
  { const s = { hero: 'maren', slot: 'green', en: [{ k: 'grosk', dx: 9, dy: 0 }, { k: 'vael', dx: 9, dy: -6 }, { k: 'lumi', dx: 9.6, dy: -6.6 }], t: 0, aim: { dx: 2, dy: 9 }, secs: 5 };
    const a = STAGE(run, s), b = STAGE(R0, s);
    ck('A Maren\'s Tide Pool (a ground area that picks the densest pack) lands where it did before (' + fmt(a) + ' / ' + fmt(b) + ')', JSON.stringify(a.hit) === JSON.stringify(b.hit) && a.hit.length >= 1, JSON.stringify([a, b])); }
} catch (e) { fail++; console.log('  FAIL threw: ' + (e && e.stack || e)); }
console.log((fail ? 'FAIL' : 'PASS') + ': ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
})();
