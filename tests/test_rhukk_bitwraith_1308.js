'use strict';
// v1308 balance (Phil 7 Nov 2026):
//  1. "rhukk needs his green reduced to base 35%, ending at 45% at level 100 skills. also needs to be a 10 second cooldown"
//  2. "his blue needs to start at 10% and ending at 20% at 100 / heals for 1% of his health per auto attack that hits him during that 3 seconds"
//  3. "bitwraiths also need a slight nerf on their damage with their corruption" (Corruption x0.85)
//  5. "croc drop needs a nerf, turn the team damage reduction for 3 seconds and maxes out at 35%, level 1 is 20%"
//  4. "change vaels ult to reduce 50% damage at level 1, building to 70% at 100 / it also needs to restore up to 20% health at level 1, and 30% at
//     level 100. this health heal scales off his health remaining, so if he has 1% he heals the full amount, at 95% he heals for only 2%, every 5%
//     of missing health he gains 1% increase to the heal"
// Runs the real battle engine (server/sim-host.js). CONTROL: TP_ROOT=<a pre-v1308 checkout (live 28aaec24)> must FAIL.
const path = require('path'), vm = require('vm');
const ROOT = process.env.TP_ROOT || path.resolve(__dirname, '..'), control = !!process.env.TP_ROOT;
const host = require(path.join(ROOT, 'server/sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
const run = src => vm.runInContext(src, host.ctx);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? ' - ' + detail : '')); } };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-9);
try {
  const prep = `units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0;
    const mk=(k,t,x,y)=>{ const z=makeUnit(k,t,x,y,50,{owned:false,rank:3}); z.atkInterval=99; z.speed=0; z.energy=0; z.critChance=0; z.crit=0; z.glyphCrit=0; z.dodge=0; z.evaStat=0; z.blockStat=0; z.maxHp=z.hp=1e7; z.greenCd=z.blueCd=999; return z; };`;
  // ---- 1. Carapace: the cast's damage-taken multiplier at skill level 1 and 100, cooldown 10 ----
  const g = JSON.parse(run(`(()=>{ ${prep} const R=mk('rhukk','ally',400,700); units=[R]; const out={cd:R.greenAb.cd, dur:R.greenAb.dur};
    for(const lv of [1,100]){ R._castLv=lv; R.drT=0; R.drMul=1; doEffect(R,R.greenAb.type,R.greenAb); out['m'+lv]=R.drMul; out['t'+lv]=R.drT; }
    out.desc1=KIT_DESC_LV.defensive(1,R.greenAb.desc,R.greenAb); out.desc100=KIT_DESC_LV.defensive(100,R.greenAb.desc,R.greenAb); return JSON.stringify(out); })()`));
  ck('Carapace level 1: damage taken x0.65 (35% less)', near(g.m1, 0.65), g.m1);
  ck('Carapace level 100: damage taken x0.55 (45% less)', near(g.m100, 0.55), g.m100);
  ck('Carapace cooldown 10 s, still lasts 5 s', g.cd === 10 && g.dur === 5 && g.t1 === 5, JSON.stringify({ cd: g.cd, dur: g.dur, t: g.t1 }));
  ck('Carapace text reads the real numbers (35% at 1, 45% at 100)', /taking 35% less damage for 5 seconds/.test(g.desc1) && /taking 45% less damage/.test(g.desc100), g.desc1 + ' | ' + g.desc100);
  // ---- 2a. Dig In: Rhukk's own taunt DR; Brannus's taunt (shared curve) unchanged ----
  const t = JSON.parse(run(`(()=>{ ${prep} const R=mk('rhukk','ally',400,700), B=mk('brannus','ally',300,700), E=mk('skulk','enemy',600,700); units=[R,B,E]; const out={};
    for(const lv of [1,100]){ for(const [k,u] of [['r',R],['b',B]]){ u._castLv=lv; u.drT=0; u.drMul=1; doEffect(u,u.blueAb.type,u.blueAb); out[k+lv]=1-u.drMul; out[k+'T'+lv]=u.drT; } }
    { const Gr=mk('gruel','ally',350,750); units.push(Gr); for(const lv of [1,100]){ Gr._castLv=lv; Gr.drT=0; Gr.drMul=1; doEffect(Gr,'taunt',Object.assign({},ULT_DEF.taunt)); out['g'+lv]=1-Gr.drMul; } }
    out.btype=B.blueAb.type; out.card1=abilityMeta?String(skillDesc('rhukk',2)):''; out.d100=(KIT_DESC_LV.taunt?KIT_DESC_LV.taunt(100,R.blueAb.desc,R.blueAb):R.blueAb.desc); return JSON.stringify(out); })()`));
  ck('Dig In level 1: 10% less damage', near(t.r1, 0.10), t.r1);
  ck('Dig In level 100: 20% less damage', near(t.r100, 0.20), t.r100);
  ck('Dig In lasts 3 s', t.rT1 === 3, t.rT1);
  ck('another hero\'s taunt (Brannus) keeps the shared 40% -> 59.8%', t.btype === 'taunt' && near(t.b1, 0.40) && near(t.b100, 0.598), JSON.stringify({ b1: t.b1, b100: t.b100 }));
  ck('Gruel\'s The Reckoning (ult taunt; ULT_DEF.taunt carries an unread dr:0.5) keeps the shared 40% -> 59.8%', near(t.g1, 0.40) && near(t.g100, 0.598), JSON.stringify({ g1: t.g1, g100: t.g100 }));
  ck('Dig In text: 10% at 1, 20% at 100, and the 1% heal per enemy basic attack', /takes 10% less damage/.test(t.card1) && /takes 20% less damage/.test(t.d100) && /heals him for 1% of his max health/.test(t.d100), t.card1 + ' | ' + t.d100);
  // ---- 2b. Real headless fight: 1% max HP per enemy auto-attack that lands during Dig In, none outside it, none from skills/DoTs ----
  const f = JSON.parse(run(`(()=>{ ${prep} const R=mk('rhukk','ally',400,700); R.hp=R.maxHp*0.5; R.atkInterval=99;
    const E=[0,1,2,3,4].map(i=>{ const e=mk('ashen','enemy',400+4*METER,700+(i-2)*1.5*METER);   /* ranged (7.4 m reach), so the body push-apart never takes them out of reach */ e.atkInterval=0.6; e.atkCd=i*0.12; e.greenAb=null; e.blueAb=null; e.maxHp=e.hp=1e7; return e; });
    units=[R,...E]; const ev=[]; let t0=-1;
    const _dm=damage; damage=function(u,a,c,noE){ if(u===R) ev.push(['L',battleTime,!!noE]); return _dm.apply(this,arguments); };
    const _hu=healUnit; healUnit=function(u,a){ const h0=u.hp; const r=_hu.apply(this,arguments); if(u===R&&u.hp>h0) ev.push(['H',battleTime,u.hp-h0]); return r; };
    const step=s=>{ for(let i=0;i<Math.round(s/SIM_STEP);i++){ E.forEach(e=>{ e.energy=0; }); R.energy=0; updateBattle(SIM_STEP); } };
    try{ step(3); t0=battleTime; R._castLv=1; doEffect(R,R.blueAb.type,R.blueAb);
      step(1); const nS=ev.length; ev.push(['S',battleTime]); dealDamage(E[0],R,500,'#ff0000'); pushDot(R,300,1,0.5,'#ff8844'); const skillEv=ev.slice(nS).filter(x=>x[0]==='H').length; step(5);
      return JSON.stringify({ev,t0,maxHp:R.maxHp,skillEv,alive:R.alive}); } finally{ damage=_dm; healUnit=_hu; } })()`));
  let inL = 0, inH = 0, inBad = 0, outL = 0, outH = 0, stray = 0;
  const pct = f.maxHp * 0.01;
  for (let i = 0; i < f.ev.length; i++) {
    const e = f.ev[i]; if (e[0] !== 'L' || e[2] || (i > 0 && f.ev[i - 1][0] === 'S')) continue;   // e[2]: a DoT / silent tick, not a blow; after 'S': the test's own skill hit
    const nx = f.ev[i + 1], healed = nx && nx[0] === 'H' && nx[1] === e[1];
    const dt = e[1] - f.t0;
    if (dt > 0 && dt < 2.9) { inL++; if (healed) { inH++; if (!near(nx[2], pct, 1e-3)) inBad++; } }
    else if (dt < 0 || dt > 3.1) { outL++; if (healed) outH++; }
  }
  for (let i = 0; i < f.ev.length; i++) if (f.ev[i][0] === 'H' && !(i > 0 && f.ev[i - 1][0] === 'L' && !f.ev[i - 1][2] && f.ev[i - 1][1] === f.ev[i][1])) stray++;
  ck('fight: enemy basic attacks land on Rhukk during Dig In (at least 8)', inL >= 8, inL);
  ck('every enemy basic attack that lands inside the 3 s heals him exactly 1% max HP', inL > 0 && inH === inL && inBad === 0, JSON.stringify({ inL, inH, inBad }));
  ck('basic attacks before the cast and after the 3 s heal nothing', outL >= 6 && outH === 0, JSON.stringify({ outL, outH }));
  ck('a skill hit and a DoT inside the window heal nothing; no heal without a blow', f.skillEv === 0 && stray === 0, JSON.stringify({ skillEv: f.skillEv, stray }));
  // ---- 3. Bitwraith Corruption: total damage x0.85 of the live numbers (mul 0.4, dps 0.5), same engine ----
  const b = JSON.parse(run(`(()=>{ const LIVE={mul:0.4,dps:0.5}; const ab=MONSTER_KITS.bitwraith.green; const out={mul:ab.mul,dps:ab.dps};
    const once=(o,arm)=>{ ${prep} const W=mk('bitwraith','enemy',700,700), D=mk('vael','ally',600,700); D.armorRating=arm; D.mrRating=arm; W.target=D; units=[W,D];
      let tot=0, ticks=0; const _dm=damage; damage=function(u,a){ if(u===D&&arguments[2]==='#b06bff'){ const h=u.hp; const r=_dm.apply(this,arguments); tot+=h-u.hp; if(arguments[3]) ticks+=h-u.hp; return r; } return _dm.apply(this,arguments); };
      try{ W._castLv=1; doEffect(W,o.type,o); for(let i=0;i<Math.round(8/SIM_STEP);i++){ W.energy=0; D.energy=0; updateBattle(SIM_STEP); } } finally{ damage=_dm; } return [tot,ticks]; };
    const cur=once(ab,0), live=once(Object.assign({},ab,LIVE),0); out.cur=cur[0]; out.live=live[0];
    out.tick0=cur[1]; out.tickArm=once(ab,3000)[1]; out.hit0=cur[0]-cur[1]; out.hitArm=once(ab,3000); out.hitArm=out.hitArm[0]-out.hitArm[1];
    return JSON.stringify(out); })()`));
  ck('Corruption numbers x0.85: hit 0.4 -> 0.34, DoT 0.5 -> 0.425', near(b.mul, 0.34) && near(b.dps, 0.425), JSON.stringify({ mul: b.mul, dps: b.dps }));
  ck('Corruption total damage in a headless cast = 0.85 x the live numbers', b.live > 0 && near(b.cur / b.live, 0.85, 1e-6), JSON.stringify({ cur: b.cur, live: b.live, ratio: b.cur / b.live }));
  console.log('  info Corruption vs 3000 armour/MR: DoT ticks ' + b.tick0.toFixed(1) + ' -> ' + b.tickArm.toFixed(1) + ' (unchanged = ticks skip armour/MR), opening hit ' + b.hit0.toFixed(1) + ' -> ' + b.hitArm.toFixed(1));
  // ---- 4. Vael Last Stand ----
  const v = JSON.parse(run(`(()=>{ ${prep} const V=mk('vael','ally',400,700); units=[V]; const out={pts:[]};
    for(const [lv,fr] of [[1,0.95],[1,0.01],[100,0.95],[100,0.01],[1,0.50],[39,1.0]]){ V.hp=V.maxHp*fr; V.drT=0; V.drMul=1; V._castLv=lv; V._campaignHero=false;
      doEffect(V,'laststand',Object.assign({},ULT_DEF.laststand)); out.pts.push([lv,fr,(V.hp-V.maxHp*fr)/V.maxHp,V.drMul,V.drT,V._lifestealPct,V._lifestealT]); }
    V.hp=V.maxHp*0.5; V._campaignHero=true; V._castLv=1; doEffect(V,'laststand',Object.assign({},ULT_DEF.laststand)); out.camp1=(V.hp-V.maxHp*0.5)/V.maxHp;
    V.hp=V.maxHp*0.5; V._castLv=100; doEffect(V,'laststand',Object.assign({},ULT_DEF.laststand)); out.camp100=(V.hp-V.maxHp*0.5)/V.maxHp;
    out.d1=ULT_DESC_LV.laststand(1,ULT_DESC.laststand); out.d100=ULT_DESC_LV.laststand(100,ULT_DESC.laststand); return JSON.stringify(out); })()`));
  const P = v.pts;
  ck('Last Stand level 1: damage taken x0.50 (50% less)', near(P[0][3], 0.50), P[0][3]);
  ck('Last Stand level 100: damage taken x0.30 (70% less)', near(P[2][3], 0.30), P[2][3]);
  ck('Last Stand still 5 s, 100% lifesteal', P[0][4] === 5 && P[0][5] === 1 && P[0][6] === 5, JSON.stringify(P[0].slice(4)));
  ck('heal level 1 at 95% health: 2% max HP', near(P[0][2], 0.02, 1e-6), P[0][2]);
  ck('heal level 1 at 1% health: 20% max HP (full)', near(P[1][2], 0.20, 1e-6), P[1][2]);
  ck('heal level 100 at 95% health: 3% max HP', near(P[2][2], 0.03, 1e-6), P[2][2]);
  ck('heal level 100 at 1% health: 30% max HP (full)', near(P[3][2], 0.30, 1e-6), P[3][2]);
  ck('heal level 1 at 50% health: 11% max HP', near(P[4][2], 0.11, 1e-6), P[4][2]);
  ck('campaign wave Vael keeps its flat 10% + 0.1 pt a level heal (Phil 31 Oct)', near(v.camp1, 0.10, 1e-6) && near(v.camp100, 0.199, 1e-6), JSON.stringify({ c1: v.camp1, c100: v.camp100 }));
  ck('Last Stand text: 50%/20% at level 1, 70%/30% at 100', /by 50%/.test(v.d1) && /up to 20% of his max health/.test(v.d1) && /by 70%/.test(v.d100) && /up to 30% of his max health/.test(v.d100), v.d1 + ' | ' + v.d100);
  // ---- 5. Grosk Croc Drop: team damage reduction 20% -> 35%, 3 s (Phil 7 Nov: "croc drop needs a nerf, turn the team damage reduction for 3 seconds and maxes out at 35%, level 1 is 20%") ----
  const c = JSON.parse(run(`(()=>{ const out={};
    for(const lv of [1,100]){ ${prep} const G=mk('grosk','ally',400,700), A=mk('vael','ally',300,700), E=[0,1,2].map(i=>mk('skulk','enemy',400+4*METER,700+(i-1)*20)); units=[G,A,...E];
      G._castLv=lv; doEffect(G,'hipposlam',Object.assign({},ULT_DEF.hipposlam)); let on=-1, off=-1;
      for(let i=0;i<Math.round(9/SIM_STEP);i++){ units.forEach(z=>{ z.energy=0; }); updateBattle(SIM_STEP); const act=(A._mwDrT||0)>0&&A._mwDrSrc===G; if(act&&on<0) on=battleTime; if(!act&&on>=0&&off<0) off=battleTime; }
      out['p'+lv]=A._mwDrPct; out['dur'+lv]=off-on;
      const hit=()=>{ A.hp=A.maxHp; dealDamage(E[0],A,1000,'#fff','true'); return A.maxHp-A.hp; };   /* with vs without the Croc Drop buff (the Mirewall passive cuts both alike) */
      A._mwDrT=0; const base=hit(); A._mwDrT=1; A._mwDrSrc=G; out['taken'+lv]=hit()/base; }
    out.d1=ULT_DESC_LV.hipposlam(1,ULT_DESC.hipposlam); out.d100=ULT_DESC_LV.hipposlam(100,ULT_DESC.hipposlam); return JSON.stringify(out); })()`));
  ck('Croc Drop level 1: the team takes 20% less damage', near(c.p1, 0.20) && near(c.taken1, 0.80, 1e-9), JSON.stringify({ p: c.p1, taken: c.taken1 }));
  ck('Croc Drop level 100: the team takes 35% less damage', near(c.p100, 0.35) && near(c.taken100, 0.65, 1e-9), JSON.stringify({ p: c.p100, taken: c.taken100 }));
  ck('Croc Drop team reduction lasts 3 s in a real cast (not 5)', Math.abs(c.dur1 - 3) < 0.05 && Math.abs(c.dur100 - 3) < 0.05, JSON.stringify({ d1: c.dur1, d100: c.dur100 }));
  ck('Croc Drop text: 3 seconds, 20% at 1, 35% at 100', /for 3 seconds every ally takes 20% less damage/.test(c.d1) && /takes 35% less damage/.test(c.d100), c.d1 + ' | ' + c.d100);
  // ---- 6. Grosk Hammer Fists: each punch = his Armor x 20% -> 30% (Phil 7 Nov: "grosk has zero attack damage dont make this abilty scale off it.
  //      instead make it scale off 20% of his armor per hit scaling to 30% at 100") ----
  const hf = JSON.parse(run(`(()=>{ const out={};
    const cast=(lv,arm,atk)=>{ ${prep} const G=mk('grosk','ally',400,700), E=mk('skulk','enemy',400+1.5*METER,700); units=[G,E];
      G.armorRating=arm; G.dmg=atk; G.target=E; G._castLv=lv; G._castSM=skillMul(lv); G._castSlot='blue'; const hits=[];
      const _dd=dealDamage; dealDamage=function(s,t,amt,col){ if(s===G&&col==='#e0b070') hits.push(amt); return _dd.apply(this,arguments); };
      try{ doEffect(G,G.blueAb.type,G.blueAb); for(let i=0;i<Math.round(4/SIM_STEP);i++){ units.forEach(z=>{ z.energy=0; }); updateBattle(SIM_STEP); } } finally{ dealDamage=_dd; G._castSlot=null; }
      return hits; };
    out.l1=cast(1,1000,300); out.l100=cast(100,1000,300); out.atkLow=cast(1,1000,1); out.atkHigh=cast(1,1000,5000); out.arm2=cast(1,2000,300);
    out.desc100=KIT_DESC_LV.punchflurry?KIT_DESC_LV.punchflurry(100,KITS.grosk.blue.desc||'',KITS.grosk.blue):''; return JSON.stringify(out); })()`));
  const all = (a, v) => a.length === 3 && a.every(x => near(x, v, 1e-6));
  ck('Hammer Fists level 1: 3 punches of armour x 0.20 (1000 armour -> 200 each, before mitigation)', all(hf.l1, 200), JSON.stringify(hf.l1));
  ck('Hammer Fists level 100: 3 punches of armour x 0.30 (300 each)', all(hf.l100, 300), JSON.stringify(hf.l100));
  ck('Attack does not move Hammer Fists (1 vs 5000 Attack: same punches)', all(hf.atkLow, 200) && all(hf.atkHigh, 200), JSON.stringify({ lo: hf.atkLow, hi: hf.atkHigh }));
  ck('Armour does (2000 armour -> 400 each)', all(hf.arm2, 400), JSON.stringify(hf.arm2));
  ck('Hammer Fists text: 30% of his Armor at level 100', /dealing 30% of his Armor/.test(hf.desc100), hf.desc100);
} catch (e) { fail++; console.log('  FAIL run: ' + (e.stack || e)); }
console.log((control ? 'CONTROL ' : '') + 'test_rhukk_bitwraith_1308.js: ' + pass + ' passed, ' + fail + ' failed');
if (control) process.exit(fail > 0 ? 0 : 1);
process.exit(fail ? 1 : 0);
