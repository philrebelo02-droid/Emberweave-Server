/* Hero 61: shared authored data and deterministic combat rules. No rendering or RNG. */
(function(root,factory){const v=factory();if(typeof module==='object'&&module.exports)module.exports=v;if(root)root.HERO61=v;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const IDENTITY=Object.freeze({name:'Morvayne',subname:'The Open Gate'}); // Phil 4 Nov 2026: "Lets go Morvayne". Rename here only.
  const KEY='hero61';
  const PROFILE=Object.freeze({class:'Support',combatRow:'Back',damageProfile:'Healer',primaryScaling:'Ability Power + Healing Power',glyphPath:'support_tank_back',equipmentPath:'support_tank_back',formationDepth:3.4,minimumReachMeters:3.5});
  const GROWTH=Object.freeze({hp:36,dmg:0.5,apow:1,armor:10,mr:7});
  const BASE=Object.freeze({name:IDENTITY.name,emoji:'\u265b',role:'Support',swing:2,stars:3,start:3,locked:true,myth:true,source:'purchase',healer:true,hp:620,dmg:16,apow:30,armor:60,mr:40,range:200,speed:65,atkSpeed:0.85,color:0x652699,abilityName:'None Shall Fall',ability:'noneShallFall',growth:GROWTH});
  const KIT=Object.freeze({green:{name:"King's Mercy",type:'kingsMercy',cd:0,desc:'A 1.5 second cast heals the weakest ally. No cooldown.'},blue:{name:'Shelter of the Crown',type:'crownShelter',cd:8,desc:'A 2.5 second cast heals the weakest ally. Eight second cooldown after release.'},purple:{name:'An Open Gate',pass:'openGate',desc:'All living allies gain flat Armor; strongest copy only, while the king lives.'}});
  const CAST=Object.freeze({green:1.5,blue:2.5,ult:1.2});
  function allies(u,roster){return roster.filter(a=>a.alive&&a.team===u.team&&!a._dropHidden&&!(a._riseT>0));}
  // Stable array order is formation order. Never sort by a render coordinate or wall clock.
  function weakest(u,roster){return allies(u,roster).reduce((best,a)=>!best||a.hp/Math.max(1,a.maxHp)<best.hp/Math.max(1,best.maxHp)?a:best,null);}
  function recordDamage(u,amount,now){if(!(amount>0))return;const h=u._openGateDamage||(u._openGateDamage=[]);h.push({at:now,amount});while(h.length&&h[0].at<now-2)h.shift();}
  function recentDamage(u,now){const h=u._openGateDamage||[];while(h.length&&h[0].at<now-2)h.shift();return h.reduce((s,e)=>s+e.amount,0);}
  function protectionTarget(u,roster,now){return allies(u,roster).reduce((best,a)=>{if(!best)return a;const da=recentDamage(a,now),db=recentDamage(best,now);return da>db||(da===db&&a.hp/Math.max(1,a.maxHp)<best.hp/Math.max(1,best.maxHp))?a:best;},null);}
  function healAmount(slot,level,target,caster){const n=Math.max(0,(level|0)-1);return (slot==='blue'?.18+.0009*n:.06+.0003*n)*target.maxHp+(slot==='blue'?2:.5)*(caster.apow||0);}
  function aura(u,roster){let best=0;for(const a of allies(u,roster))if(a.key===KEY&&a.pass&&a.pass.openGate)best=Math.max(best,20+2*(Math.max(1,(a.skillLv&&a.skillLv[3])|0)-1));return best;}
  function canAttack(u,roster){return u.hp>u.maxHp*.5&&roster.filter(a=>a.alive&&a.team===u.team&&!a._summon&&!a.t?.monster).length===1;}
  function immune(u,now){return (u._openGateImmuneUntil||0)>now;}
  return Object.freeze({KEY,IDENTITY,PROFILE,GROWTH,BASE,KIT,CAST,allies,weakest,recordDamage,recentDamage,protectionTarget,healAmount,aura,canAttack,immune});
});
