/* ============================== EMBERWEAVE SHARED COMBAT CORE ==============================
   v242 (full-game audit P0): ONE deterministic combat model with REAL damage types.

   - PHYSICAL and MAGICAL damage are separate. A physical hit is mitigated by the target's ARMOR
     rating, a magical hit by the target's MAGIC RESIST rating — each through the same diminishing
     curve defToDR(r) = r/(r+1200), and each countered ONLY by its own penetration
     (armorPen vs armor, magicPen vs MR). Penetration re-runs the curve with (rating − pen): it
     never adds raw damage and does nothing against a target with no rating.
   - ABILITY POWER scales SPELLS ONLY (the atkM line, used by magical kits and heals);
     PHYSICAL ATTACK scales basic attacks and physical kits ONLY (the atkP line).
   - Universal survival stats: HP, Armor, MR. Real handling for crit (chance + crit damage +
     crit resist), attack speed (extra swings), haste (faster energy), energy regen, lifesteal,
     evasion vs accuracy, block (physical only), damage bonus / damage reduction, shield strength,
     healing power, HP regen, control hit vs tenacity (stun rounds).
   - Every hero has an authored KIT (its ultimate, typed and shaped); the resolver emits a full
     EVENT LOG [round, side, key, verb, target, amount, ultFlag, kind, critFlag] that a client can
     animate — the server result is derived from that log and nothing else.
   - Deterministic: one mulberry32 stream per battle, every roll consumed unconditionally where
     branching would change stream length.
   ============================================================================================ */
'use strict';

function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
function seedFrom(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function defToDR(r){ return r>0 ? r/(r+1200) : 0; }   // the client's exact diminishing curve

/* ---- rating→fraction conversions (points from glyphs/gear are RATINGS; these are the only
        places they become percentages, shared by every battle authority) ---- */
const CONV={
  critPerPt:0.005, critCap:0.6,            // Crit Chance
  critDmgPerPt:0.005,                      // Crit Damage: adds to the 0.6 crit BONUS
  critResPerPt:0.005, critResCap:0.75,     // shrinks the crit bonus
  defPtMul:3,                              // glyph Armor/MR points → defense rating
  evaPerPt:0.003, evaCap:0.30,             // Evasion (chance to dodge), countered by Accuracy pts
  blockPerPt:0.003, blockCap:0.30,         // Block halves a PHYSICAL hit
  lifestealPerPt:0.004, lifestealCap:0.5,
  dmgBonusPerPt:0.004,
  dmgRedPerPt:0.004, dmgRedCap:0.30,
  atkSpdPerPt:0.004,                       // Attack Speed points speed the swing timer
  hastePerPt:0.004,                        // Haste speeds energy gain
  shieldStrPerPt:0.005,
  ctrlHitPerPt:0.004,                      // Control Hit: raises stun chance
  ctrlResPerPt:0.005, ctrlResCap:0.6,      // Tenacity/Control Resist: shrinks stun duration/chance
  energyPer100:1                            // 100 Energy Regen rating = +1 energy/second
};

/* ---- authored hero kits: the ultimate each hero fires at 100 energy.
   kind: 'phys' scales off atkP, 'magic' off atkM, 'heal'/'shieldTeam' off atkM (healer lines),
   'hybrid' fires both lines at half weight. shape: nuke (first alive), lowest (weakest foe),
   aoe (up to n foes), cleave (first 2). stun: rounds of lost actions on the struck target(s). ---- */
const KITS={
  konwu:     {kind:'phys',  shape:'cleave', coef:2.4, n:2},
  grosk:     {kind:'shieldTeam', pct:0.22},
  vulmar:    {kind:'magic', shape:'aoe',   coef:1.5, n:3},
  tick:      {kind:'phys',  shape:'nuke',  coef:2.6},
  sylthaine: {kind:'magic', shape:'aoe',   coef:1.4, n:3, stun:1},
  aureth:    {kind:'hybrid',shape:'aoe',   coef:1.2, n:3},
  bloatus:   {kind:'magic', shape:'aoe',   coef:1.2, n:3},
  vireo:     {kind:'heal',  who:'allies',  coef:1.2},
  fritz:     {kind:'magic', shape:'aoe',   coef:1.5, n:3},
  umbris:    {kind:'magic', shape:'aoe',   coef:1.7, n:3},
  vael:      {kind:'phys',  shape:'cleave', coef:2.4, n:2},
  oakmir:    {kind:'heal',  who:'allies',  coef:1.1},
  rhukk:     {kind:'phys',  shape:'nuke',  coef:2.6},
  hurne:     {kind:'phys',  shape:'cleave', coef:2.3, n:2},
  meridian:  {kind:'phys',  shape:'lowest', coef:2.8},
  tallow:    {kind:'shieldTeam', pct:0.20},
  astra:     {kind:'magic', shape:'aoe',   coef:1.3, n:3, stun:1},
  magistrant:{kind:'phys',  shape:'nuke',  coef:2.5},
  vharn:     {kind:'phys',  shape:'cleave', coef:2.4, n:2},
  fathom:    {kind:'magic', shape:'aoe',   coef:1.5, n:3},
  lumi:      {kind:'heal',  who:'allies',  coef:1.15},
  hollow:    {kind:'phys',  shape:'lowest', coef:3.0},
  sprocket:  {kind:'phys',  shape:'nuke',  coef:2.5},
  carn:      {kind:'phys',  shape:'nuke',  coef:2.5},
  vesper:    {kind:'magic', shape:'nuke',  coef:3.0},
  sablewick: {kind:'magic', shape:'aoe',   coef:1.0, n:3, stun:1},
  vex:       {kind:'phys',  shape:'lowest', coef:2.9},
  arrears:   {kind:'phys',  shape:'nuke',  coef:2.5},
  meryln:    {kind:'heal',  who:'allies',  coef:1.1}
};
const DEFAULT_KIT={kind:'phys',shape:'nuke',coef:2.2};

/* ---- typed unit builder. base: {hp,dmg,apow,armor,mr,role,healer,atkSpeed}; mul: level×star
   multiplier; r: RATINGS {hpFlat,atkFlat,apowFlat,healFlat, armor,mr,armorPen,magicPen, crit,
   critDmg,critRes, energy,startEnergy, regen, lifesteal,atkSpd,haste, eva,acc,block, dmgBonus,
   dmgRed, shieldStr, ctrlHit,ctrlRes, healPow} (all raw points unless noted); defScale scales the
   BASE armor/mr like the client (1+0.05·(lvl−1))·starMult. ---- */
function buildUnit(key, base, mul, defScale, r, extra){
  r=r||{}; extra=extra||{};
  const armor=(base.armor||0)*defScale + (r.armor||0)*CONV.defPtMul + (extra.armorRating||0);
  const mr=(base.mr||0)*defScale + (r.mr||0)*CONV.defPtMul + (extra.mrRating||0);
  const atkP=Math.round((base.dmg||0)*mul)+(r.atkFlat|0);
  // AP flats never create an ability line where none exists — a pure physical hero gains NOTHING from AP
  const atkM=Math.round(((base.apow||0)>0 ? Math.round(base.apow*mul)+(r.apowFlat|0) : 0)*(extra.apMul||1));   // Academy AP research scales spells only
  return {
    key, role:base.role||'Bruiser', healer:!!base.healer,
    maxHp:Math.round((base.hp||100)*mul)+(r.hpFlat|0),
    hp:0, energy:0,
    atkP, atkM,
    heal: base.healer? Math.round((Math.max(10,base.apow||10)*mul+(r.apowFlat|0))*0.9)+(r.healFlat|0) : 0,
    speed:(base.atkSpeed||1)*(1+(r.atkSpd||0)*CONV.atkSpdPerPt),
    armor, mr,
    armorPen:Math.max(0,r.armorPen|0), magicPen:Math.max(0,r.magicPen|0),
    crit:Math.min(CONV.critCap,(r.crit||0)*CONV.critPerPt + (extra.critFrac||0)),
    critDmg:0.6+(r.critDmg||0)*CONV.critDmgPerPt,
    critRes:Math.min(CONV.critResCap,(r.critRes||0)*CONV.critResPerPt+(extra.critResFrac||0)),
    energyReg:(r.energy||0)*CONV.energyPer100/100 + (extra.energyRegFlat||0),
    startEnergy:Math.max(0,Math.min(60,Math.round((r.startEnergy||0)*0.35))),
    regen:Math.min(0.06,(r.regen||0)*0.0001),   // v364: 0.01% max-HP/s per point, cap 6%/s (was 0.1%/pt uncapped — mirrors the client mulsFromTotals)
    lifesteal:Math.min(CONV.lifestealCap,(r.lifesteal||0)*CONV.lifestealPerPt),
    eva:Math.min(CONV.evaCap,(r.eva||0)*CONV.evaPerPt), acc:(r.acc||0),
    block:Math.min(CONV.blockCap,(r.block||0)*CONV.blockPerPt),
    dmgBonus:1+(r.dmgBonus||0)*CONV.dmgBonusPerPt,
    dmgRed:Math.min(0.6,Math.min(CONV.dmgRedCap,(r.dmgRed||0)*CONV.dmgRedPerPt)+(extra.dmgRedFrac||0)),   // Academy Defense research adds flat reduction
    haste:1+(r.haste||0)*CONV.hastePerPt,
    shieldStr:1+(r.shieldStr||0)*CONV.shieldStrPerPt,
    ctrlHit:(r.ctrlHit||0)*CONV.ctrlHitPerPt,
    ctrlRes:Math.min(CONV.ctrlResCap,(r.ctrlRes||0)*CONV.ctrlResPerPt),
    healPow:(r.healPow||0)*0.004,
    kit:KITS[key]||extra.kit||DEFAULT_KIT,
    gearSkillSlot:extra.gearSkillSlot||null, gearSkill:extra.gearSkill||null,
    shieldPool:0, _stunR:0, _skipR:0, _buffR:0, _buffMul:1, _drR:0, _markR:0, _markMul:1, _gearSkillUsed:false
  };
}

const ROLE_FRONT_ORDER={Tank:0,Bruiser:1,Fighter:2,Assassin:3,Mage:4,Marksman:4,Support:5};
function lineUp(units, carry){
  const out=units.filter(Boolean).slice(0,5).map((u,i)=>{ const c=Object.assign({},u);
    c.hp=carry&&carry[i]?Math.max(0,Math.min(u.maxHp,carry[i].hp|0)):u.maxHp;
    c.energy=carry&&carry[i]?Math.max(0,Math.min(100,carry[i].energy|0)):(u.startEnergy||0);
    c.shieldPool=0; c._stunR=0; c._skipR=0; c._buffR=0; c._buffMul=1; c._drR=0; c._markR=0; c._markMul=1; c._gearSkillUsed=false;
    return c; });
  out.sort((a,b)=>(ROLE_FRONT_ORDER[a.role]??5)-(ROLE_FRONT_ORDER[b.role]??5));
  return out;
}
function anyAlive(us){ return us.some(u=>u.hp>0); }
function firstAlive(us){ for(const u of us) if(u.hp>0) return u; return null; }
function weakestAlive(us){ let w=null; for(const u of us){ if(u.hp>0&&(!w||u.hp/u.maxHp<w.hp/w.maxHp)) w=u; } return w; }
function aliveList(us){ return us.filter(u=>u.hp>0); }
function state(us){ return us.map(u=>({key:u.key,hp:Math.max(0,Math.round(u.hp)),maxHp:u.maxHp,energy:Math.round(u.energy),alive:u.hp>0})); }

/* ---- the ONE typed damage entry point (also used by gear actives) ----
   kind: 'phys' | 'magic' | 'true'. Returns damage actually removed from hp+shields. */
function applyDamage(rnd, log, round, side, src, tgt, raw, kind, opts){
  opts=opts||{};
  // evasion (countered point-for-point by accuracy) — roll ALWAYS consumed
  const evaRoll=rnd();
  const eva=Math.max(0, (tgt.eva||0) - (src.acc||0)*CONV.evaPerPt);
  if(kind!=='true' && !opts.noDodge && evaRoll<eva){
    if(log.length<600) log.push([round,side,src.key,'miss',tgt.key,0,opts.ult?1:0,kind,0]);
    return 0; }
  let dmg=raw*(src.dmgBonus||1);
  // crit — rolls ALWAYS consumed
  const critRoll=rnd(); let crit=false;
  if(!opts.noCrit && (src.crit||0)>0 && critRoll<(src.crit||0)){
    crit=true; dmg*= 1 + (src.critDmg||0.6)*(1-(tgt.critRes||0)); }
  if(tgt._markR>0) dmg*=(tgt._markMul||1);
  // TYPED mitigation: armor vs phys (blockable), MR vs magic — each countered only by its own pen
  if(kind==='phys'){
    dmg*=1-defToDR(Math.max(0,(tgt.armor||0)-(src.armorPen||0)));
    const blockRoll=rnd();
    if((tgt.block||0)>0 && blockRoll<(tgt.block||0)){ dmg*=0.5; if(log.length<600) log.push([round,side,tgt.key,'block',src.key,0,0,kind,0]); }
  } else if(kind==='magic'){
    dmg*=1-defToDR(Math.max(0,(tgt.mr||0)-(src.magicPen||0)));
    rnd();   // parity roll so phys/magic consume identical stream length
  } else { rnd(); }
  if(tgt._drR>0) dmg*=0.65;                      // gear brace
  dmg*=1-(tgt.dmgRed||0);                        // Damage Reduction rating
  dmg=Math.max(0,Math.round(dmg));
  let removed=0;
  if(tgt.shieldPool>0){ const ab=Math.min(tgt.shieldPool,dmg); tgt.shieldPool-=ab; dmg-=ab; removed+=ab; }
  tgt.hp-=dmg; removed+=dmg;
  if(log.length<600) log.push([round,side,src.key,'>',tgt.key,removed,opts.ult?1:0,kind,crit?1:0]);
  // lifesteal off damage actually removed
  if((src.lifesteal||0)>0 && removed>0 && src.hp>0){ const ls=Math.round(removed*src.lifesteal); src.hp=Math.min(src.maxHp,src.hp+ls); }
  return removed;
}
function applyHeal(log, round, side, src, tgt, amt, ult){
  const a=Math.round(amt*(1+(src.healPow||0)));
  tgt.hp=Math.min(tgt.maxHp,tgt.hp+a);
  if(log.length<600) log.push([round,side,src.key,'+',tgt.key,a,ult?1:0,'heal',0]);
  return a;
}
function grantShield(log, round, side, src, tgt, amt){
  const a=Math.round(amt*(src.shieldStr||1));
  tgt.shieldPool+=a;
  if(log.length<600) log.push([round,side,src.key,'shield',tgt.key,a,0,'shield',0]);
  return a;
}

/* ---- kit executor: the hero's authored ultimate ---- */
function fireKit(rnd, log, round, side, u, own, foe, variance){
  const k=u.kit||DEFAULT_KIT;
  const targetsFor=shape=>{ const alive=aliveList(foe); if(!alive.length) return [];
    if(shape==='lowest'){ const w=weakestAlive(foe); return w?[w]:[]; }
    if(shape==='aoe') return alive.slice(0,Math.max(1,k.n||3));
    if(shape==='cleave') return alive.slice(0,Math.max(1,k.n||2));
    return [alive[0]]; };
  const tryStun=t=>{ if(!k.stun) { rnd(); return; }
    const roll=rnd(); const ch=Math.max(0.15, 0.55+(u.ctrlHit||0)-(t.ctrlRes||0));
    if(roll<ch) t._stunR=Math.max(t._stunR||0, Math.max(1,Math.round(k.stun*(1-(t.ctrlRes||0))))); };
  if(k.kind==='heal'){ const who=k.who==='allies'?aliveList(own):[weakestAlive(own)].filter(Boolean);
    for(const w of who) applyHeal(log,round,side,u,w,u.heal*(k.coef||1.1)*variance(),true); return; }
  if(k.kind==='shieldTeam'){ for(const w of aliveList(own)) grantShield(log,round,side,u,w,w.maxHp*(k.pct||0.2)); return; }
  if(k.kind==='hybrid'){ for(const t of targetsFor(k.shape||'aoe')){
      applyDamage(rnd,log,round,side,u,t,u.atkP*(k.coef||1.2)*variance(),'phys',{ult:true});
      applyDamage(rnd,log,round,side,u,t,u.atkM*(k.coef||1.2)*variance(),'magic',{ult:true}); tryStun(t); } return; }
  const kind=k.kind==='magic'?'magic':'phys';
  const line=kind==='magic'?u.atkM:u.atkP;
  for(const t of targetsFor(k.shape||'nuke')){ applyDamage(rnd,log,round,side,u,t,line*(k.coef||2.2)*variance(),kind,{ult:true}); tryStun(t); }
}

/* ---- gear actives (unchanged semantics, typed executor) ---- */
function fireGearSkill(rnd,log,round,side,u,own,foe){ const g=u.gearSkill;
  const pickT=(how,n)=>{ const alive=aliveList(foe); if(!alive.length)return[];
    if(how==='far') return [alive[alive.length-1]];
    if(how==='lowest'){ const w=weakestAlive(foe); return w?[w]:[]; }
    if(how==='all') return alive;
    if(how==='chain'||how==='random'||how==='aoe'||how==='line') return alive.slice(0,Math.max(1,n||3));
    return [alive[0]]; };
  if(!g||!g.type||!g.params){ grantShield(log,round,side,u,u,u.maxHp*0.12); return; }
  const p=g.params, atk=Math.max(u.atkP,u.atkM);
  switch(g.type){
    case 'dmg': for(const t of pickT(p.target,p.n)) applyDamage(rnd,log,round,side,u,t,atk*(p.mult||1),'phys',{noDodge:true,noCrit:true}); break;
    case 'stun': { const ts=pickT(p.target==='aoe'?'aoe':'near',p.target==='aoe'?3:1);
      for(const t of ts){ t._skipR=Math.max(t._skipR||0,1); if(p.dmgMult) applyDamage(rnd,log,round,side,u,t,atk*p.dmgMult,'phys',{noDodge:true,noCrit:true}); } break; }
    case 'silence': { const t=pickT('near',1)[0]; if(t) t._skipR=Math.max(t._skipR||0,1); break; }
    case 'slow': case 'move': for(const t of pickT(p.target==='aoe'?'aoe':'near',3)){ t._buffR=0; } break;
    case 'shield': { const who=p.who==='allies'||p.who==='nearAllies'?aliveList(own):(p.who==='lowest'?[weakestAlive(own)].filter(Boolean):[u]);
      for(const w of who){ const amt=p.ap?Math.round(atk*(p.ap||1)):Math.round(w.maxHp*(p.pct||0.1)); grantShield(log,round,side,u,w,amt); if(p.energy) w.energy=Math.min(100,w.energy+p.energy); } break; }
    case 'heal': { const who=p.who==='allies'?aliveList(own):(p.who==='lowest'?[weakestAlive(own)].filter(Boolean):[u]);
      for(const w of who){ const amt=p.missing?Math.round((w.maxHp-w.hp)*p.missing):Math.round(w.maxHp*(p.pct||0.1)); applyHeal(log,round,side,u,w,amt,false); } break; }
    case 'energy': u.energy=Math.min(100,u.energy+(p.n||20)); break;
    case 'buff': u._buffR=Math.max(u._buffR||0,Math.round(p.dur||3)); u._buffMul=Math.max(u._buffMul||1,p.atk||p.as||1.15); if(p.dr!=null) u._drR=Math.max(u._drR||0,Math.round(p.dur||3)); break;
    case 'mark': for(const t of pickT(p.target==='aoe'||p.target==='all'?'all':(p.target==='far'?'far':'near'),5)){ t._markMul=Math.max(t._markMul||1,p.mult||1.15); t._markR=Math.max(t._markR||0,Math.round(p.dur||3)); } break;
    case 'taunt': grantShield(log,round,side,u,u,u.maxHp*0.10); break;
    case 'cleanse': for(const w of own){ if(w.hp>0){ w._skipR=0; w._stunR=0; } } break;
    case 'untarget': case 'ward': grantShield(log,round,side,u,u,u.maxHp*0.15); break;
    case 'next': u._buffR=Math.max(u._buffR||0,2); u._buffMul=Math.max(u._buffMul||1,p.mult||1.3); break;
    default: break;
  } }

/* ---- THE resolver: attacker a must eliminate b; round-cap stall = defender win. ---- */
function resolveBattle(a, b, seed){
  const rnd=mulberry32(seed>>>0); const log=[]; let round=0;
  const fA=0.85+0.30*rnd(), fB=0.85+0.30*rnd();     // per-fight team performance band (seeded)
  const act=(u, side, own, foe)=>{
    if(u.hp<=0) return;
    if(u._stunR>0){ u._stunR--; if(log.length<600) log.push([round,side,u.key,'stunned',u.key,0,0,'ctrl',0]); return; }
    if(u._skipR>0){ u._skipR--; return; }
    const swings=u.speed>=1.1?2:1;
    for(let s=0;s<swings;s++){
      if(!anyAlive(foe)) return;
      u.energy=Math.min(100,u.energy+25*(u.haste||1));
      const ult=u.energy>=100;
      const variance=()=> (side==='A'?fA:fB)*(0.85+0.3*rnd());
      if(ult){ fireKit(rnd,log,round,side,u,own,foe,variance); u.energy=0; continue; }
      if(u.healer){ const w=weakestAlive(own);
        if(w && w.hp<w.maxHp*0.72){ applyHeal(log,round,side,u,w,u.heal*variance(),false); continue; } }
      const t=firstAlive(foe); if(!t) return;
      const buff=(u._buffR>0)?(u._buffMul||1):1;
      // BASIC ATTACK: always the PHYSICAL line — casters poke physically, their power is the kit
      applyDamage(rnd,log,round,side,u,t,u.atkP*buff*variance(),'phys',{});
    }
  };
  while(anyAlive(a)&&anyAlive(b)&&round<300){
    round++;
    for(const u of a.concat(b)){ if(u.hp<=0) continue;
      if(u.energyReg) u.energy=Math.min(100,u.energy+u.energyReg*(u.haste||1));
      if(u.regen) u.hp=Math.min(u.maxHp,u.hp+u.maxHp*u.regen);
      if(u._buffR>0){ u._buffR--; if(u._buffR<=0) u._buffMul=1; }
      if(u._drR>0) u._drR--;
      if(u._markR>0){ u._markR--; if(u._markR<=0) u._markMul=1; } }
    if(round===2 && !a._gsDone){ a._gsDone=true;
      for(const u of a){ if(u.hp>0&&(u.gearSkill||u.gearSkillSlot)&&!u._gearSkillUsed){ u._gearSkillUsed=true; fireGearSkill(rnd,log,round,'A',u,a,b); } }
      for(const u of b){ if(u.hp>0&&(u.gearSkill||u.gearSkillSlot)&&!u._gearSkillUsed){ u._gearSkillUsed=true; fireGearSkill(rnd,log,round,'B',u,b,a); } } }
    const n=Math.max(a.length,b.length), aLeads=(round%2===1);
    for(let i=0;i<n;i++){
      if(aLeads){ if(i<a.length) act(a[i],'A',a,b); if(i<b.length) act(b[i],'B',b,a); }
      else      { if(i<b.length) act(b[i],'B',b,a); if(i<a.length) act(a[i],'A',a,b); } }
  }
  const won=anyAlive(a)&&!anyAlive(b);
  return { won, rounds:round, aState:state(a), bState:state(b), log };
}

module.exports={ mulberry32, seedFrom, defToDR, CONV, KITS, buildUnit, lineUp, resolveBattle,
  applyDamage, applyHeal, grantShield, state };
