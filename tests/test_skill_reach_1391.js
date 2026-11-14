'use strict';
// v1391 SKILL REACH (audit "SKILL REACH AUDIT 14NOV2026": skills that never land in real fights). ENGINE = the page's own code, which the
// client runs and server/sim-host.js replays, so client and server replay stay identical.
//   A. STALE AIM: a Green/Blue cast read u._aimWX, the spot of the hero's LAST aimed ultimate (never cleared), so Astra's Starfire and Nebula,
//      Bloatus's Toxic Breath and Pyroclast's Blazing Orbit fired at that old spot. castKit now gives the pending cast only the aim it picks
//      itself (none, or the densest pack for a ground area), and a delivered Green/Blue arrival reads the aim it was released with.
//      An aimed ultimate reads exactly what it read before.
//   B. REACH TO THE BODY EDGE: Standard Crash, Vein Burst, Coinflail, Fan of Knives, Flywheel, Feed Them (enemy burst), Emberskin, Comet Dash (at
//      the landing), Sunburst (enemy damage) and Rallying Ground (allies) tested centre to centre, and bodies are 1.5-2 m in radius, so a melee
//      enemy stood outside them. They now measure dist - bodyR, as v1389's cleave.
//   C. BACK-ROW SKILLS ON THE TARGET (Phil 14 Nov: "center the back row skills on the target"): Blazing Orbit, Gravity Knot, Ledger Slam,
//      Tsunami and Scattergun were centred on a caster who stands 10-16 m from the enemies. Now (kit at:'target') the area is centred on the
//      skill's target (the caster's target, else the nearest enemy), same radius, to the body edge; Scattergun becomes a 3.2 m burst at the
//      target (a cone cannot be centred on it); the plates are drawn there.
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
  var _st=null; const hit=new Set(), ally=new Set(); const own=s=>s&&(s===h||ddOwner(s)===h);
  const _dd=dealDamage, _cc=ccApply, _pd=pushDot, _pl=plagueDot, _hf=healFrom;
  dealDamage=function(s,t){ if(own(s)&&t&&t.team!==h.team) hit.add(es.indexOf(t)); return _dd.apply(this,arguments); };
  const silOn=new Set(); ccApply=function(s,t,fld){ if(own(s)&&t&&t.team!==h.team){ hit.add(es.indexOf(t)); if(fld==='silencedT') silOn.add(t); } return _cc.apply(this,arguments); };
  pushDot=function(t,dps,dur,iv,col,s){ if(own(s)&&t&&t.team!==h.team) hit.add(es.indexOf(t)); return _pd.apply(this,arguments); };
  plagueDot=function(t,dps,dur,iv,col,s){ if(own(s)&&t&&t.team!==h.team) hit.add(es.indexOf(t)); return _pl.apply(this,arguments); };
  healFrom=function(s,t){ if(own(s)&&t&&t!==h) ally.add(as.indexOf(t)); return _hf.apply(this,arguments); };
  const pre=as.map(a=>[a.drMul||1,a.hasteMul||1,a.drT||0]);
  try{ updateBattle(SIM_STEP); ${KEEP} placeAll(); if(S.pre) eval(S.pre);
    const T0=(S.t!=null)?{x:es[S.t].x,y:es[S.t].y}:{x:es[0].x,y:es[0].y}; var _st={T0, d0:es.map(e=>dist(T0,e)), te0:es.map(e=>+((dist(T0,e)-bodyR(e))/METER).toFixed(2))};   /* placed again after the first tick: an assassin opens the fight with a dive */
    if(S.slot==='ult'){ h.energy=100; if(S.ultAim){ h._aimWX=h.x+S.ultAim.dx*METER; h._aimWY=h.y+S.ultAim.dy*METER; } castAbility(h); }
    else if(S.slot==='none'){ }
    else if(S.direct){ h._castSM=1; h._castLv=1; h._castSlot=S.slot; doEffect(h,S.direct,Object.assign({},KITS[S.hero][S.slot],{_arrived:true,_tgtU:(S.t!=null?es[S.t]:null)})); h._castSlot=null; }
    else { h._castSM=skillMul(1); h._castLv=1; castKit(h,KITS[S.hero][S.slot]); h._castSM=1; h._castLv=0; }
    for(let i=0;i<Math.round((S.secs||3)/SIM_STEP);i++){ updateBattle(SIM_STEP); ${KEEP} } }
  finally{ dealDamage=_dd; ccApply=_cc; pushDot=_pd; plagueDot=_pl; healFrom=_hf; }
  as.forEach((a,i)=>{ const p=pre[i]; if((a.drMul||1)!==p[0]||(a.hasteMul||1)!==p[1]||(a.drT||0)>p[2]) ally.add(i); });
  es.forEach((e,i)=>{ if(e.hp<e.maxHp) hit.add(i); }); const tgt=(S.t!=null)?es[S.t]:null;
  return JSON.stringify({hit:[...hit].filter(i=>i>=0).sort(), ally:[...ally].filter(i=>i>=0).sort(), aimAfter:(h._aimWX===aim0)?'same':(h._aimWX==null?'none':'moved'),
    tedge0:_st.te0, mv:es.map((e,i)=>+((dist(_st.T0,e)-_st.d0[i])/METER).toFixed(2)), ctl:es.map(e=>({sil:silOn.has(e), forced:e.forcedTarget===h})),
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
  // ================= B. reach measured to the body edge (melee skills centred on the caster) =================
  // each: an enemy (or, for Rallying Ground, an ally) whose BODY EDGE is 0.15 m inside / outside the written radius; the cast is pressed as in a fight
  const NO_EMBERSKIN = "h.pass=Object.assign({},h.pass,{immolate:false});";   // his aura would burn the neighbour he lands next to (and the neighbour is not Grosk: his Mirewall takes a share of the target's hit)
  const IN = 0.15, PRE_HURNE = "h._castSM=1; h._castLv=1; h._castSlot='green'; doEffect(h,'summonwarriors',Object.assign({},KITS.hurne.green)); h._castSlot=null; units.forEach(x=>{ if(x._summonOwner===h){ x.speed=0; x.atkCd=99; x.atkInterval=99; } });";
  const B = [
    ['Askel Greatbrow\'s Standard Crash (green, 3.2 m)', 3.2, R => ({ hero: 'askel', slot: 'green', en: [{ k: 'grosk', edge: R }], t: 0 })],
    ['Carn\'s Vein Burst (blue, 2.8 m)', 2.8, R => ({ hero: 'carn', slot: 'blue', en: [{ k: 'grosk', edge: R }], t: 0 })],
    ['Gruel\'s Coinflail (green, 3 m, 70 deg cone)', 3, R => ({ hero: 'gruel', slot: 'green', en: [{ k: 'grosk', edge: R }], t: 0 })],
    ['Hollow\'s Fan of Knives (green, 3 m, 75 deg cone)', 3, R => ({ hero: 'hollow', slot: 'green', en: [{ k: 'grosk', edge: R }], t: 0 })],
    ['Tick\'s Flywheel (ult, 3 m)', 3, R => ({ hero: 'tick', slot: 'ult', en: [{ k: 'grosk', edge: R }], t: 0, secs: 3 })],
    ['Hurne\'s Feed Them (ult, enemy burst 3 m)', 3, R => ({ hero: 'hurne', slot: 'ult', en: [{ k: 'grosk', edge: R }], t: 0, secs: 3, pre: PRE_HURNE, ghost: 1 })],
    ['Korvux\'s Emberskin (passive aura, 2.4 m)', 2.4, R => ({ hero: 'korvux', slot: 'none', en: [{ k: 'grosk', edge: R }], t: 0, secs: 1.3 })],
    ['Korvux\'s Comet Dash (green, 2.4 m at the landing spot)', 2.4, R => ({ hero: 'korvux', slot: 'green', en: [{ k: 'vael', dx: 6.5, dy: 0 }, { k: 'sylthaine', from: 0, ang: 135, edge: R }], t: 0, secs: 2, who: 1, pre: NO_EMBERSKIN, ghost: 1 })],
    ['Aureth\'s Sunburst (green, enemy damage 2.8 m)', 2.8, R => ({ hero: 'aureth', slot: 'green', en: [{ k: 'grosk', edge: R }], t: 0 })],
    ['Askel Greatbrow\'s Rallying Ground (blue, ally buff 6 m)', 6, R => ({ hero: 'askel', slot: 'blue', en: [{ k: 'grosk', dx: 12, dy: 0 }], t: 0, al: [{ k: 'vael', edge: R, ang: 90 }], ally: 1 })],
  ];
  const got = (x, s) => s.ally ? x.ally.includes(0) : x.hit.includes(s.who || 0);
  for (const [name, R, mk] of B) {
    const si = mk(R - IN), so = mk(R + IN), a = STAGE(run, si), o = STAGE(run, so), b = STAGE(R0, si);
    const ed = x => si.ally ? x.aedge[0] : (si.who ? null : x.edge[0]);
    ck('B ' + name + ': the one ' + IN + ' m inside by body edge is reached (' + fmt(a) + ', edge ' + ed(a) + ' m, centre ' + (si.ally ? '' : a.cc[si.who || 0]) + ' m)', got(a, si), JSON.stringify(a));
    ck('B ' + name + ': the one ' + IN + ' m outside is not (' + fmt(o) + ', edge ' + ed(o) + ' m)', !got(o, so), JSON.stringify(o));
    ck('B CONTROL ' + name + ': on the pre-fix page the one inside by body edge was not reached (' + fmt(b) + ')', !got(b, si), JSON.stringify(b)); }
  // shared effect codes: who else moves, and what stays
  { const R = J(run, 'JSON.stringify(KITS.konwu.green.radius/METER)'), s = { hero: 'konwu', slot: 'green', en: [{ k: 'grosk', edge: R - IN }], t: 0 }, a = STAGE(run, s), b = STAGE(R0, s);
    ck('B shared cleavecone: KonWu\'s Cleaving Arc (' + R + ' m) now also reaches the body edge (' + fmt(a) + ' / pre-fix ' + fmt(b) + ')', a.hit.includes(0) && !b.hit.includes(0), JSON.stringify([a, b])); }
  for (const hero of ['rhukk', 'askel']) {
    const R = J(run, `JSON.stringify((Object.assign({},ULT_DEF[HERO_TYPES.${hero}.ability]||{}).radius||2.4*METER)/METER)`);
    const s = { hero, slot: 'ult', en: [{ k: 'vael', dx: 6.5, dy: 0 }, { k: 'sylthaine', from: 0, ang: 135, edge: R - IN }], t: 0, secs: 2.5, who: 1, ghost: 1 }, a = STAGE(run, s), b = STAGE(R0, s);
    ck('B the charge ults keep their centre test: ' + hero + '\'s ult (' + R + ' m) on an enemy inside by body edge only: the same as before (' + fmt(a) + ' / ' + fmt(b) + ')', JSON.stringify(a.hit) === JSON.stringify(b.hit), JSON.stringify([a, b])); }
  { const R = J(run, 'JSON.stringify((ULT_DEF.sunburst.radius||2.8*METER)/METER)'), s = { hero: 'lumi', slot: 'ult', en: [{ k: 'grosk', edge: R - IN }], t: 0, secs: 2 }, a = STAGE(run, s), b = STAGE(R0, s);
    ck('B Lumi\'s Radiant Nova (ult on the same code, not touched) is the same as before for an enemy inside by body edge (' + fmt(a) + ' / ' + fmt(b) + ')', JSON.stringify(a.hit) === JSON.stringify(b.hit), JSON.stringify([a, b])); }
  for (const [lab, al] of [['inside by body edge only', { k: 'vael', edge: 2.8 - IN, ang: 90 }], ['at 2.6 m centre to centre', { k: 'vael', dx: 0, dy: 2.6 }]]) {
    const s = { hero: 'aureth', slot: 'green', en: [{ k: 'grosk', dx: 12, dy: 0 }], t: 0, al: [al], ghost: 1 }, a = STAGE(run, s), b = STAGE(R0, s);
    ck('B Aureth\'s Sunburst heal keeps its radius as written: an ally ' + lab + ' is healed the same as before (' + (a.ally.length ? 'healed' : 'not healed') + ')', JSON.stringify(a.ally) === JSON.stringify(b.ally), JSON.stringify([a, b])); }
  { const K = r => J(r, `JSON.stringify(['askel','carn','gruel','hollow','korvux','aureth','konwu'].map(k=>[KITS[k].green,KITS[k].blue]))`);
    ck('B no written radius, damage number or description changed in these kits', JSON.stringify(K(run)) === JSON.stringify(K(R0))); }

  // ================= C. back-row skills centred on the target (Phil 14 Nov: "center the back row skills on the target") =================
  // the caster stands 11 m behind his target (as in a fight: 10-16 m); a second enemy's BODY EDGE is 0.15 m inside / outside the written radius
  // of the TARGET (beside it, so it is not the nearest or the farthest); the cast is pressed as in a fight
  const CS = [
    ['Pyroclast\'s Blazing Orbit (blue, 2.8 m)', 'pyroclast', 'blue', 2.8],
    ['Absalie\'s Gravity Knot (blue, 4 m)', 'absalie', 'blue', 4],
    ['Grimsby\'s Ledger Slam (blue, 4 m)', 'grimsby', 'blue', 4],
    ['Maren\'s Tsunami (blue, 3.4 m)', 'maren', 'blue', 3.4],
    ['Rivet\'s Scattergun (green, now a 3.2 m burst at the target)', 'rivet', 'green', 3.2],
  ];
  const CST = (hero, slot, edge, extra) => Object.assign({ hero, slot, en: [{ k: 'grosk', dx: 11, dy: 0 }, { k: 'vael', from: 0, ang: 90, edge }], t: 0, secs: 2.5, ghost: 1 }, extra || {});
  for (const [name, hero, slot, R] of CS) {
    const a = STAGE(run, CST(hero, slot, R - IN)), o = STAGE(run, CST(hero, slot, R + IN)), b = STAGE(R0, CST(hero, slot, R - IN));
    ck('C ' + name + ' lands on its target 11 m away and on the enemy ' + IN + ' m inside its radius of the target by body edge (' + fmt(a) + ', that enemy\'s edge ' + a.tedge0[1] + ' m from the target)', a.hit.includes(0) && a.hit.includes(1), JSON.stringify(a));
    ck('C ' + name + ': the enemy ' + IN + ' m outside is not reached (' + fmt(o) + ', edge ' + o.tedge0[1] + ' m)', o.hit.includes(0) && !o.hit.includes(1), JSON.stringify(o));
    ck('C CONTROL ' + name + ': on the pre-fix page, centred on the caster 11 m back, it reached nobody (' + fmt(b) + ')', b.hit.length === 0, JSON.stringify(b));
    const n = STAGE(run, CST(hero, slot, R - IN, { t: null }));
    ck('C ' + name + ' with no target of his own: centred on the nearest enemy (' + fmt(n) + ')', n.hit.includes(0), JSON.stringify(n)); }
  // the movement each one keeps, now from the target's spot
  { const a = STAGE(run, CST('absalie', 'blue', 4 - IN)), b = STAGE(R0, CST('absalie', 'blue', 4 - IN));
    ck('C Gravity Knot pulls the enemy beside the target toward the target\'s spot (' + a.mv[1] + ' m closer); the target itself stays (' + a.mv[0] + ' m)', a.mv[1] < -0.5 && Math.abs(a.mv[0]) < 0.05, JSON.stringify(a));
    ck('C CONTROL Gravity Knot moved nobody there on the pre-fix page (' + b.mv.join(' / ') + ' m)', Math.abs(b.mv[1]) < 0.05, JSON.stringify(b)); }
  { const a = STAGE(run, CST('maren', 'blue', 3.4 - IN));
    ck('C Tsunami shoves the enemy beside the target away from the target\'s spot (' + a.mv[1] + ' m)', a.mv[1] > 0.5, JSON.stringify(a)); }
  { const a = STAGE(run, CST('pyroclast', 'blue', 2.8 - IN));
    ck('C Blazing Orbit repels the enemy beside the target from it (' + a.mv[1] + ' m)', a.mv[1] > 0.5, JSON.stringify(a)); }
  { const a = STAGE(run, CST('grimsby', 'blue', 4 - IN, { secs: 1.3 }));   // read inside the 2 s silence
    ck('C Ledger Slam: the enemies around the target are silenced and must attack Grimsby, as before (' + JSON.stringify(a.ctl) + ')', a.ctl.every(c => c.sil && c.forced), JSON.stringify(a)); }
  { const S = (r, e) => J(r, `(()=>{ ${RESET} const h=makeUnit('rivet','ally',500,700,30,{owned:false,rank:3}); const t=makeUnit('grosk','enemy',500+11*METER,700,30,{owned:false,rank:3}); const n=makeUnit('vael','enemy',t.x,t.y+${e}*METER+0,30,{owned:false,rank:3});
      units=[h,t,n]; ${HOLD} n.y=t.y+${e}*METER+bodyR(n); h.target=t; const D=new Map(); const _dd=dealDamage; dealDamage=function(s,x,a){ if(s===h) D.set(x.key,(D.get(x.key)||0)+a); return _dd.apply(this,arguments); };
      try{ h._castSM=1; h._castLv=1; h._castSlot='green'; doEffect(h,'spread',Object.assign({},KITS.rivet.green)); } finally{ dealDamage=_dd; h._castSlot=null; }
      return JSON.stringify({t:Math.round(D.get('grosk')||0), n:Math.round(D.get('vael')||0)}); })()`);
    const a = S(run, 0.5), b = S(run, 2.9);
    ck('C Scattergun keeps its falloff, now by the distance to the target: the target takes the full charge (' + a.t + '), a neighbour 0.5 m off its body edge ' + a.n + ', one 2.9 m off ' + b.n, a.t > 0 && a.n < a.t && b.n < a.n && b.n > 0, JSON.stringify([a, b])); }
  // the art: every plate is drawn where the skill now lands (spawnGroundFx recorded; the kit's own gfx)
  { const ART = (r, hero, slot) => J(r, `(()=>{ ${RESET} const h=makeUnit('${hero}','ally',500,700,30,{owned:false,rank:3}); const t=makeUnit('grosk','enemy',500+11*METER,700,30,{owned:false,rank:3}); units=[h,t]; ${HOLD} h.target=t;
      const at=[]; const _s=spawnGroundFx; spawnGroundFx=function(k,x,y){ at.push({k,x,y}); return null; }; const _fa=_fxAllow; _fxAllow=true;
      try{ const o=Object.assign({},KITS['${hero}']['${slot}']); abilArt(h,o,t,(o.at==='target')?{x:t.x,y:t.y}:null,o.type); } finally{ spawnGroundFx=_s; _fxAllow=_fa; }
      const p=at.find(q=>q.k===KITS['${hero}']['${slot}'].gfx); return JSON.stringify(p?{d:+(Math.hypot(p.x-t.x,p.y-t.y)/METER).toFixed(2), dc:+(Math.hypot(p.x-h.x,p.y-h.y)/METER).toFixed(2)}:null); })()`);
    for (const [name, hero, slot, R] of CS) {
      const a = ART(run, hero, slot), b = ART(R0, hero, slot), near = hero === 'maren' ? R + 0.01 : 0.6;
      ck('C ' + name + ': its plate is drawn on the target (' + (a ? a.d + ' m from the target' : 'none') + '; the pre-fix plate was ' + (b ? b.dc + ' m from the caster, ' + b.d + ' m from the target' : 'none') + ')', a && a.d <= near, JSON.stringify([a, b])); } }
  // shared codes keep their centre: Grosk's Gravemaw Pull (pullsilence) and Astra's Starfire / Ceraline's Mourning Bell (nova at:'cluster')
  { const s = { hero: 'grosk', slot: 'green', en: [{ k: 'vael', edge: 0.4 }, { k: 'lumi', ang: 60, edge: 3 }], t: 0, secs: 2 }, a = STAGE(run, s), b = STAGE(R0, s);
    ck('C Grosk\'s Gravemaw Pull (the same pullsilence code) is unchanged (' + fmt(a) + ' / ' + fmt(b) + ')', JSON.stringify(a.hit) === JSON.stringify(b.hit), JSON.stringify([a, b])); }
  { const K = r => J(r, `JSON.stringify(['pyroclast','absalie','grimsby','maren','rivet'].map(k=>{ const o=Object.assign({},KITS[k].green.type==='spread'?KITS[k].green:KITS[k].blue); return [o.mul,o.radius/METER,o.cd,o.dur,o.slow,o.push,o.pull,o.burn,o.burnDur,o.falloff,o.minMul]; }))`);
    ck('C the five keep their damage, radius, cooldown, duration, slow, push and pull numbers', JSON.stringify(K(run)) === JSON.stringify(K(R0)), K(run)); }

} catch (e) { fail++; console.log('  FAIL threw: ' + (e && e.stack || e)); }
console.log((fail ? 'FAIL' : 'PASS') + ': ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
})();
