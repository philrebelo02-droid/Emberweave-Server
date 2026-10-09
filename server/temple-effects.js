/* The Temple's bonuses have one data source (temple-of-ash.js heroBonuses) and one path into each side of the game.
   v2 (9 Oct 2026, TEMPLE OF ASH v2): the four bars are FLAT stats that ride the same ratings path as glyph flats -
     server: coreRatings(R, extra, b) before SIM.heroCombatStats (hpFlat / atkFlat / apowFlat / armor & MR rating / pens)
     client: makeUnit adds clientFlats(b) where it adds the glyph flats (fHp / fAtk / apow / armorRating / mrRating / pens)
   so a client battle and the server replay build the same numbers. applyCore / applyClient carry the % / rate effects
   (crit chance, lifesteal, dodge, heal/shield strength, ...). The old % bar path (max health x1.2 ...) is gone.
   v1098 (hero-specific bars): a bar of a % / rate kind (Healing power, Attack speed, Crit damage, Energy regen ...) arrives here
   under the same effect name as a blessing of that kind - heroBonuses sums bar + blessing - so it takes the same two paths. */
(function(global){
  'use strict';
  const get=(b,k)=>Math.max(0,Number(b&&b[k])||0);
  const mul=(n,v)=>n==null?n:n*(1+v);
  const FLAT_KEYS=['hpFlat','adFlat','apFlat','armorFlat','mrFlat','armorPenFlat','magicPenFlat'];
  const PEN_POWER_PER_POINT=0.0001;   // card power: +1% per 100 average penetration (pen is not in the card's EHP x DPS formula)
  /* v1096: two blessing kinds are not fractions - weigh them into the card multiplier as fraction-equivalents (PROPOSED):
     1 energy/s ~ 0.05, energy from damage taken 0.4 ~ 0.1. Every other effect counts its fraction as before. */
  const POWER_WEIGHT={'energy regen':0.05,'energy from damage taken':0.25};
  function flats(b){ const o={}; for(const k of FLAT_KEYS) o[k]=Math.round(get(b,k)); return o; }
  /* the card multiplier: blessing effect fractions (as before) + penetration. Flat HP / Attack / Armor go INTO the card's unit. */
  function powerMultiplier(b){
    let total=0;
    for(const k of Object.keys(b||{})){ if(FLAT_KEYS.indexOf(k)<0) total+=Math.max(0,Number(b[k])||0)*(POWER_WEIGHT[k]==null?1:POWER_WEIGHT[k]); }
    const pen=(get(b,'armorPenFlat')+get(b,'magicPenFlat'))/2;
    return 1+Math.min(0.5,total/4+pen*PEN_POWER_PER_POINT);
  }
  /* server: fold the flats into the raw ratings exactly as glyph flats go in (snapshotHeroFromServer) */
  function coreRatings(R,extra,b){
    const f=flats(b);
    R.hpFlat=(R.hpFlat|0)+f.hpFlat; R.atkFlat=(R.atkFlat|0)+f.adFlat; R.apowFlat=(R.apowFlat|0)+f.apFlat;
    R.armorPen=(R.armorPen|0)+f.armorPenFlat; R.magicPen=(R.magicPen|0)+f.magicPenFlat;
    if(extra){ extra.armorRating=(extra.armorRating||0)+f.armorFlat; extra.mrRating=(extra.mrRating||0)+f.mrFlat; }
    return R;
  }
  /* client: the same whole numbers, read by makeUnit / heroPower */
  function clientFlats(b){ return flats(b); }
  function applyCore(u,b){
    if(!u||!b)return u;
    u.heal=mul(u.heal,get(b,'heal/shield strength'));
    u.shieldStr=mul(u.shieldStr,get(b,'heal/shield strength'));
    u.energyReg=(u.energyReg||0)+get(b,'energy regen');
    u.templeDamageEnergy=get(b,'energy from damage taken');
    u.haste=mul(u.haste,get(b,'cooldown reduction'));
    u.speed=mul(u.speed,get(b,'attack speed'));
    u.crit=Math.min(0.6,(u.crit||0)+get(b,'crit chance'));
    u.critDmg=(u.critDmg||0)+get(b,'crit damage');
    u.lifesteal=Math.min(0.5,(u.lifesteal||0)+get(b,'lifesteal'));
    u.dmgRed=Math.min(0.6,(u.dmgRed||0)+get(b,'damage reduction'));
    u.eva=Math.min(0.3,(u.eva||0)+get(b,'dodge'));
    u.ctrlRes=Math.min(0.6,(u.ctrlRes||0)+get(b,'control resistance'));
    return u;
  }
  function applyClient(u,b){
    if(!u||!b)return u;
    u.healPowMul=mul(u.healPowMul,get(b,'heal/shield strength'));
    u.shieldStrMul=mul(u.shieldStrMul,get(b,'heal/shield strength'));
    u.energyReg=(u.energyReg||0)+get(b,'energy regen');
    u.templeDamageEnergy=get(b,'energy from damage taken');
    u.hasteEnergyMul=mul(u.hasteEnergyMul,get(b,'cooldown reduction'));
    u.atkInterval/=(1+get(b,'attack speed'));
    u.glyphCrit=Math.min(0.6,(u.glyphCrit||0)+get(b,'crit chance'));
    u.critDmg=(u.critDmg||0)+get(b,'crit damage');
    u.lifestealStat=Math.min(0.5,(u.lifestealStat||0)+get(b,'lifesteal'));
    u.glyphDR=Math.min(0.6,(u.glyphDR||0)+get(b,'damage reduction'));
    u.evaStat=Math.min(0.3,(u.evaStat||0)+get(b,'dodge'));
    u.ctrlRes=Math.min(0.6,(u.ctrlRes||0)+get(b,'control resistance'));
    return u;
  }
  global.TempleEffects={FLAT_KEYS,powerMultiplier,coreRatings,clientFlats,applyCore,applyClient};
  if(typeof module!=='undefined'&&module.exports)module.exports=global.TempleEffects;
})(typeof window!=='undefined'?window:globalThis);
