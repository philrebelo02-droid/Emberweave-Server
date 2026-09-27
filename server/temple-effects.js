/* The Temple's class effects have one data source (temple-of-ash.js) and one
   power contribution on both sides of the game. Combat adapters only translate
   the shared effect names into each engine's existing unit fields. */
(function(global){
  'use strict';
  const get=(b,k)=>Math.max(0,Number(b&&b[k])||0);
  const mul=(n,v)=>n==null?n:n*(1+v);
  function powerMultiplier(b){
    const total=Object.values(b||{}).reduce((n,v)=>n+Math.max(0,Number(v)||0),0);
    return 1+Math.min(0.5,total/4);
  }
  function applyCore(u,b){
    if(!u||!b)return u;
    const hp=get(b,'max health'),atk=get(b,'attack damage'),ap=get(b,'ability power');
    u.maxHp=mul(u.maxHp,hp);if(u.hp>0)u.hp=mul(u.hp,hp);
    u.atkP=mul(u.atkP,atk);u.atk=u.atkP;u.atkM=mul(u.atkM,ap);
    u.armor=mul(u.armor,get(b,'armor'));u.mr=mul(u.mr,get(b,'magic resist'));
    u.heal=mul(u.heal,get(b,'heal/shield strength'));
    u.shieldStr=mul(u.shieldStr,get(b,'heal/shield strength'));
    u.energyReg=(u.energyReg||0)+get(b,'energy regen');
    u.templeDamageEnergy=get(b,'energy from damage taken');
    u.haste=mul(u.haste,get(b,'cooldown reduction'));
    u.speed=mul(u.speed,get(b,'attack speed'));
    u.crit=Math.min(0.6,(u.crit||0)+get(b,'crit chance'));
    u.critDmg=(u.critDmg||0)+get(b,'crit damage');
    u.armorPen=mul(u.armorPen||0,get(b,'armor penetration'));
    u.magicPen=mul(u.magicPen||0,get(b,'magic penetration'));
    u.lifesteal=Math.min(0.5,(u.lifesteal||0)+get(b,'lifesteal'));
    u.dmgRed=Math.min(0.6,(u.dmgRed||0)+get(b,'damage reduction'));
    u.eva=Math.min(0.3,(u.eva||0)+get(b,'dodge'));
    u.ctrlRes=Math.min(0.6,(u.ctrlRes||0)+get(b,'control resistance'));
    return u;
  }
  function applyClient(u,b){
    if(!u||!b)return u;
    const hp=get(b,'max health');u.maxHp=mul(u.maxHp,hp);u.hp=mul(u.hp,hp);
    u.dmg=mul(u.dmg,get(b,'attack damage'));
    u.apow=mul(u.apow,get(b,'ability power'));
    u.armorRating=mul(u.armorRating,get(b,'armor'));
    u.mrRating=mul(u.mrRating,get(b,'magic resist'));
    u.defRating=(u.armorRating||0)+(u.mrRating||0);
    u.healPowMul=mul(u.healPowMul,get(b,'heal/shield strength'));
    u.shieldStrMul=mul(u.shieldStrMul,get(b,'heal/shield strength'));
    u.energyReg=(u.energyReg||0)+get(b,'energy regen');
    u.templeDamageEnergy=get(b,'energy from damage taken');
    u.hasteEnergyMul=mul(u.hasteEnergyMul,get(b,'cooldown reduction'));
    u.atkInterval/=(1+get(b,'attack speed'));
    u.glyphCrit=Math.min(0.6,(u.glyphCrit||0)+get(b,'crit chance'));
    u.critDmg=(u.critDmg||0)+get(b,'crit damage');
    u.armorPen=mul(u.armorPen||0,get(b,'armor penetration'));
    u.magicPen=mul(u.magicPen||0,get(b,'magic penetration'));
    u.penRating=(u.armorPen||0)+(u.magicPen||0);
    u.lifestealStat=Math.min(0.5,(u.lifestealStat||0)+get(b,'lifesteal'));
    u.glyphDR=Math.min(0.6,(u.glyphDR||0)+get(b,'damage reduction'));
    u.evaStat=Math.min(0.3,(u.evaStat||0)+get(b,'dodge'));
    u.ctrlRes=Math.min(0.6,(u.ctrlRes||0)+get(b,'control resistance'));
    return u;
  }
  global.TempleEffects={powerMultiplier,applyCore,applyClient};
  if(typeof module!=='undefined'&&module.exports)module.exports=global.TempleEffects;
})(typeof window!=='undefined'?window:globalThis);
