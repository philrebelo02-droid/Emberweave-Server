'use strict';
const assert=require('assert/strict'),vm=require('vm');
const H=require('../hero61'),profiles=require('../hero-profiles'),paths=require('../hero-paths');
const host=require('../server/sim-host').load(require('path').resolve(__dirname,'../emberweave-heroes.html'));
const run=s=>vm.runInContext(s,host.ctx);
function reset(){run(`units=[];battleTime=0;autoUlt=false;CUR={mode:'replay'};
 globalThis.king=makeUnit('hero61','ally',300,300,1,{rank:3});
 globalThis.friend=makeUnit('vael','ally',320,300,1,{rank:3});
 globalThis.foe=makeUnit('vael','enemy',330,300,1,{rank:3});
 units=[king,friend,foe];friend.hp=friend.maxHp*.2;king.energy=100;`);}
assert.equal(profiles.hero61.glyphPath,'support_tank_back');
assert.equal(paths.support_tank_back.equipment.length,9);
reset();
assert.equal(run('HERO_TYPES.hero61.myth'),true);
assert.equal(run('HERO_TYPES.hero61.source'),'purchase','same acquisition classification as existing Mythical heroes');
assert.equal(run('baseAtLevel(HERO_TYPES.hero61,100).hp'),4184);
assert.equal(run('baseAtLevel(HERO_TYPES.hero61,100).armor'),1050);
assert.equal(run('baseAtLevel(HERO_TYPES.hero61,100).mr'),733);
// Exact formulas use the target's max HP, then the caster healing multiplier once.
run(`king.healPowMul=1.5;globalThis.before=friend.hp;hero61Cast(king,'green');`);
run('castTick(king,1.49)');assert.equal(run('friend.hp===before'),true);
run('castTick(king,.011)');
assert.ok(Math.abs(run('friend.hp-before')-run('HERO61.healAmount("green",1,friend,king)*1.5'))<1e-8);
// Stun and silence interrupt with no heal, no Blue cooldown, and a full new cast.
for(const field of ['stunned','silencedT']){
 reset();run(`hero61Cast(king,'blue');globalThis.before=friend.hp;king.${field}=1;castTick(king,3)`);
 assert.equal(run('friend.hp===before'),true);assert.equal(run('king._pend'),null);
 assert.ok(run('(king.blueCd||0)<8'));
 run(`king.${field}=0;hero61Cast(king,'blue')`);assert.equal(run('king._pend.t'),2.5);
 run('castTick(king,2.501)');assert.equal(run('king.blueCd'),8);
}
// Blue preempts Green; Ult preempts Blue. No unearned heal on either cancellation.
reset();run(`hero61Cast(king,'green');king.blueCd=0;hero61Schedule(king,.01)`);
assert.equal(run('king._pend.hero61Slot'),'blue');
run(`hero61Cast(king,'ult',friend)`);assert.equal(run('king._pend.hero61Slot'),'ult');assert.equal(run('king.energy'),0);
run('battleTime=1.2;castTick(king,1.201)');
assert.equal(run('friend._openGateImmuneUntil'),5.2);
run(`globalThis.before=friend.hp;damage(friend,100,'red');dealDamage(foe,friend,100,'red','true')`);
assert.equal(run('friend.hp'),run('before'));
run(`foe._gearNextStun=2;dealDamage(foe,friend,100,'red','phys')`);
assert.equal(run('friend.hp'),run('before'));assert.ok(run('friend.stunned>0'),'damage protection is not stun immunity');
run(`battleTime=5.2;damage(friend,10,'red')`);assert.ok(run('friend.hp<before'));
// Auto selection uses actual recent HP damage, not lowest HP or incoming shield damage.
reset();run(`HERO61.recordDamage(king,50,0);HERO61.recordDamage(friend,10,0)`);
assert.equal(run('optimalAimField(king).tgt===king'),true);
run('battleTime=2.01');assert.equal(run('optimalAimField(king).tgt===friend'),true);
// Recorded hold/drag target survives the input queue, and invalid enemy inputs spend nothing.
reset();run(`applyInput({k:'ult',uid:king.uid,tid:foe.uid})`);assert.equal(run('king.energy'),100);
run(`applyInput({k:'ult',uid:king.uid,tid:friend.uid});castTick(king,1.21)`);
assert.equal(run('friend._openGateImmuneUntil'),4);
// Strongest aura only, with immediate removal when the source dies.
reset();run(`globalThis.king2=makeUnit('hero61','ally',350,300,1,{rank:3});king2.skillLv=[1,1,1,5];units.push(king2)`);
assert.equal(run('HERO61.aura(friend,units)'),28);
run('king2.alive=false');assert.equal(run('HERO61.aura(friend,units)'),20);
run('king.alive=false');assert.equal(run('HERO61.aura(friend,units)'),0);
reset();assert.equal(run('HERO61.canAttack(king,units)'),false);
run('friend._dropHidden=true');assert.equal(run('HERO61.canAttack(king,units)'),false,'hidden living ally still counts');
run('friend.alive=false;king.hp=king.maxHp*.5');assert.equal(run('HERO61.canAttack(king,units)'),false);
run('king.hp+=1');assert.equal(run('HERO61.canAttack(king,units)'),true);
run(`king.hp=king.maxHp;globalThis.landed=0;fuseStrike(king,foe,{n:2,fps:1},()=>landed++);king.hp=king.maxHp*.5;king._fuse[0].go()`);
assert.equal(run('landed'),0,'a queued basic blow rechecks half-HP at landing');
reset();run(`globalThis.before=foe.hp;dealDamage(king,foe,100,'violet','magic')`);
assert.ok(run('foe.hp<before'),'existing non-basic gear damage is not suppressed by the auto-attack rule');
// Pure six-stat authored progression, all sixteen tiers, no hidden secondary effects.
const allowed=new Set(['HP','Armor','Magic Resist','Healing Power','Ability Power','Energy Regen']);
const defs=require('../server/glyph-source.json').filter(d=>d.id.startsWith('H61G'));
assert.equal(defs.length,96);for(const d of defs){assert.equal(d.passiveStats.split(';').length,1);assert.ok(allowed.has(d.statFocus));assert.ok(d.fragmentFamily);}
for(const s of require('../server/hero-ascension-bonuses.json').heroes.hero61.steps)assert.ok(allowed.has(s.stat));
for(const d of require('../server/gear-catalog.json').items.filter(d=>d.id.startsWith('H61E'))){assert.equal(d.active,null);assert.equal(Object.keys(d.stats).length,3);assert.ok(Object.keys(d.stats).every(k=>['hp','armor','mr','healPow','apow','energy'].includes(k)));}
const temple=require('../server/temple-of-ash');
assert.deepEqual(Array.from(temple.heroBars('hero61')),['health','armorMrOnly','abilityPower','healPow']);
assert.equal(temple.CONFIG.BAR_KINDS.armorMrOnly.defenseStep,undefined);
// The production replay entry point, with rank-unlocked casts and actual frozen snapshots.
const snaps=host.snapFromSpecs([{key:'hero61',level:30,rank:3,skillLv:[20,20,20,20]}, {key:'vael',level:30,rank:3,skillLv:[20,20,20,20]}]);
const foes=[{key:'hollow',level:30,rank:3},{key:'grosk',level:30,rank:3}];
for(const seed of [61,620,61003]){
 const a=host.auto(snaps,foes,seed),b=host.auto(snaps,foes,seed);
 assert.ok(a.digest);assert.deepEqual(a,b,'same seed and snapshots replay byte-identically');
}
const log=[[420,'ult',0,1,null,null]];
assert.deepEqual(host.replay(snaps,foes,61,log),host.replay(snaps,foes,61,log),'recorded ally target replays identically');
assert.equal(run('HERO_KEYS.includes(HERO61.KEY)'),true);
assert.equal(run('Array.from({length:61},(_,seed)=>seededTeam(seed)).some(team=>team.some(h=>h.key===HERO61.KEY))'),true,'normal deterministic bot roster can roll Hero61');
console.log('Hero61 PASS: real combat casts, interruption/priority, damage immunity, targeting inputs, aura, attack gate, six-stat progression');
