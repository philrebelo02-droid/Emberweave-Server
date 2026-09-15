/* Regression checks for permanent hero-power sources that must reach authoritative combat. */
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
let pass=0,fail=0;
function ck(name,ok,detail){ if(ok){pass++;console.log('  ✓ '+name);}else{fail++;console.log('  ✗ '+name+(detail?' — '+detail:''));} }

const sim=require('../server/sim.js');
const ref0=sim.heroCombatStats('vael',{level:100,stars:5,pips:0,ref:0});
const ref15=sim.heroCombatStats('vael',{level:100,stars:5,pips:0,ref:15});
const expected=2.90/1.90;
for(const k of ['maxHp','atkP','armor','mr']){
  const got=ref15[k]/ref0[k];
  const tolerance=(k==='armor'||k==='mr')?1e-9:0.002;
  ck('refinement scales '+k+' with the same multiplier',Math.abs(got-expected)<tolerance,'got '+got+' expected '+expected);
}
const prayer0=sim.heroCombatStats('vael',{level:100,stars:5,pips:0,ref:0,extra:{prayerMul:1}});
const prayer10=sim.heroCombatStats('vael',{level:100,stars:5,pips:0,ref:0,extra:{prayerMul:1.2}});
ck('Prayer raises authoritative base HP by 20% at level 10',prayer10.maxHp===Math.round(prayer0.maxHp*1.2),
  'got '+prayer10.maxHp+' from '+prayer0.maxHp);
/* Each snapshot rounds once from the unrounded base, so multiplying the already rounded baseline
   may differ by one point. That point is display rounding, not lost Prayer power. */
ck('Prayer raises authoritative base Attack by 20% at level 10',Math.abs(prayer10.atkP-Math.round(prayer0.atkP*1.2))<=1,
  'got '+prayer10.atkP+' from '+prayer0.atkP);
ck('Prayer does not multiply defenses',prayer10.armor===prayer0.armor && prayer10.mr===prayer0.mr);

const host=require('../server/sim-host.js').load(path.join(ROOT,'emberweave-heroes.html'));
const gearSkill={name:'Power-source probe',slot:'Weapon',defId:'E01',type:'energy',params:{n:20},desc:'probe'};
const spec={key:'vael',level:30,stars:3,pips:0,ref:0,glyphRank:6,tt:{},ex:{},fAtk:0,fHp:0,fApow:0,apMul:1,skillLv:[1,1,1,1],gearSkill};
const snap=host.snapFromSpecs([spec])[0];
ck('equipped Gear Active survives the server-frozen campaign snapshot',!!snap.gearSkill && snap.gearSkill.defId==='E01' && snap.gearSkill.type==='energy');
ck('snapshot starts Gear Active unused',snap.gearSkill && snap.gearSkill.used===false);
const prayed=host.snapFromSpecs([Object.assign({},spec,{ex:{prayerPct:20}})])[0];
ck('Prayer reaches the frozen playable campaign snapshot',prayed.maxHp>snap.maxHp && prayed.dmg>snap.dmg);
function gearProbe(type,params,setup,read){
  return vm.runInContext(`(()=>{ units=[]; ended=false; paused=false;
    const u=makeUnit('vael','ally',100,100,20,{owned:false});
    const a=makeUnit('vireo','ally',300,100,20,{owned:false});
    const e=makeUnit('sylthaine','enemy',700,100,20,{owned:false});
    units=[u,a,e]; ${setup||''}
    u.gearSkill={used:false,name:'probe',type:${JSON.stringify(type)},params:${JSON.stringify(params)}};
    castGearSkill(u); return (${read}); })()`,host.ctx);
}
const hold=gearProbe('untarget',{dur:0,ccImmune:3},'',`({used:u.gearSkill.used,t:u._gearImmovableT,noTarget:!!u._noTarget})`);
ck('Hold Fast grants displacement immunity instead of untargetability',hold.used&&hold.t===3&&!hold.noTarget);
const highShield=gearProbe('shield',{who:'self',pct:.2,dur:5,ifBelow:.35},'',`({used:u.gearSkill.used,shield:u.shield})`);
ck('Heartward Pendant cannot be consumed above its low-health threshold',!highShield.used&&highShield.shield===0);
const conduit=gearProbe('energy',{n:45,selfArmorCut:.15,dur:2},'',`({energy:u.energy,cut:u._gearArmorCut,t:u._gearArmorCutT})`);
ck('Mana Conduit applies its temporary armor penalty',conduit.energy===80&&conduit.cut===.15&&conduit.t===2);
const silenced=gearProbe('silence',{target:'farCaster',dur:1.25},`const f=makeUnit('vael','enemy',900,100,20,{owned:false});units.push(f);`,`({caster:e.silencedT||0,farPhysical:f.silencedT||0})`);
ck('Scrollkeeper Sash targets the farthest caster, not the nearest or farthest physical hero',silenced.caster===1.25&&silenced.farPhysical===0);
const vamp=gearProbe('buff',{as:1.25,vamp:.25,dur:3},'',`({v:u._gearVampPct,t:u._gearVampT})`);
ck('Furnace Heart applies its written spell-vamp window',vamp.v===.25&&vamp.t===3);
const pulled=gearProbe('heal',{who:'lowest',pct:.08,pull:1},'a.hp=1;',`({before:300,after:a.x})`);
ck('Beacon Standard pulls the lowest-health ally toward its user',pulled.after<pulled.before);
const delayed=gearProbe('heal',{who:'allies',pct:.09,delay:2},'a.hp=1;',`({now:a.hp,pending:a._gearDelayedHeals&&a._gearDelayedHeals.length})`);
ck('Dream Lantern schedules its heal instead of healing immediately',delayed.now===1&&delayed.pending===1);
const aim=gearProbe('next',{kind:'crit'},'',`({flag:u._gearNextCrit,crit:u.glyphCrit,buff:u.dmgBuffT})`);
ck('Aiming Band arms exactly the next hit without permanent Crit or a timed damage buff',aim.flag==='hit'&&aim.crit===0&&aim.buff===0);
const surge=gearProbe('next',{kind:'crit',spell:1},'',`({flag:u._gearNextCrit,crit:u.glyphCrit,buff:u.dmgBuffT})`);
ck('Surge Band arms exactly the next spell without permanent Crit',surge.flag==='spell'&&surge.crit===0&&surge.buff===0);
const orb=gearProbe('next',{kind:'dmg',mult:1.4,spell:1},'',`({repeat:u._gearRepeatSpell,buff:u.dmgBuffT})`);
ck('Orb of Reverberation arms a 40% repeat instead of a generic buff',Math.abs(orb.repeat-.4)<1e-9&&orb.buff===0);

const html=fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8');
const a=html.indexOf('function doEffect(u,type,o)');
const b=html.indexOf('let aimCtr=',a);
const head=html.slice(a,b);
ck('Academy AP is not multiplied a second time inside the shared ability resolver',
  !/let apB=[^;]*apMul/.test(head) && !/let dB=[^;]*apMul/.test(head));
const hpLine=(html.match(/const hp\s*=\s*heroStat[^\n]+/)||[''])[0];
const atkLine=(html.match(/const atkP\s*=\s*heroStat[^\n]+/)||[''])[0];
const critLine=(html.match(/const crit\s*=\s*Math\.min[^\n]+/)||[''])[0];
ck('displayed Hero Power includes Academy HP and Attack flats',/techTotal\('hp'\)/.test(hpLine)&&/techTotal\('atk'\)/.test(atkLine));
ck('displayed Hero Power counts socket and gear Crit once',!/tt\.crit\|\|/.test(critLine));
const powerReturn=(html.match(/return Math\.round\(POWER_K\*Math\.sqrt\(ehp\*dps\)[^\n]+/)||[''])[0];
ck('disabled legacy equipment does not add cosmetic Hero Power',!/equipTierSum/.test(powerReturn));


const gearCatalog=JSON.parse(fs.readFileSync(path.join(ROOT,'server','gear-catalog.json'),'utf8'));
const passiveKey={
  'Health':'hp','Attack':'atk','Ability Power':'apow','Armor':'armor','Magic Resist':'mr',
  'Crit':'crit','Crit Resist':'critRes','Crit Resistance':'critRes','Energy':'energy',
  'Energy Regen':'energy','Haste':'haste','Tenacity':'ctrlRes','Control Resist':'ctrlRes',
  'Accuracy':'acc','Block':'block','Lifesteal':'lifesteal','Armor Pierce':'armorPen',
  'Magic Pierce':'magicPen','Healing Power':'healPow','Shielding':'shieldStr',
  'Barrier Strength':'shieldStr','Dodge':'eva','Attack Speed':'atkSpd','HP Regen':'regen',
  'Resistance':'mr','Range':'range','Move Speed':'moveSpd'
};
let typed=true, typedDetail='';
for(const d of gearCatalog.items){
  for(const label of d.passive.split(',').map(x=>x.trim())){
    const key=passiveKey[label];
    if(key && !Object.prototype.hasOwnProperty.call(d.stats,key)){ typed=false; typedDetail=d.id+' missing '+key; break; }
  }
  if(!typed) break;
}
ck('every written Forge passive is delivered by its matching typed stat',typed,typedDetail);
const mobility=sim.heroCombatStats('vael',{level:20,stars:3,ratings:{moveSpd:100,range:100}});
ck('Forge movement and range ratings survive the authoritative snapshot',Math.abs(mobility.moveSpd-1.1)<1e-9&&Math.abs(mobility.rangeMul-1.1)<1e-9);
const mobileSpec=Object.assign({},spec,{tt:{moveSpd:100,range:100}});
const mobileSnap=host.snapFromSpecs([mobileSpec])[0];
ck('Forge movement and range ratings reach the real-time campaign unit',mobileSnap.speed>snap.speed&&mobileSnap.range>snap.range);

console.log('\nPASS: '+pass+'  FAIL: '+fail);
process.exit(fail?1:0);
