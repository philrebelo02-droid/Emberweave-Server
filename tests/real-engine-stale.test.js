'use strict';
/* Frozen fight records and the real engine (14 Nov 2026). Marches, garrisons, war lines, defence reports and the campaign check backlog
   hold snaps frozen days earlier and fight them with whatever code is current. A record made before talents has no `tal`; one made under
   older talent data can name an id or a rank the data no longer has. Neither may throw, on the server (sim-host) or in the browser
   (the same page code), and an old record with no talents fights exactly as the same snap with `tal` removed.
   Run: node --test tests/real-engine-stale.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),SH=require(path.join(root,'server','sim-host.js')),SIM=require(path.join(root,'server','sim.js')),T=require(path.join(root,'talents.js'));
const H=SH.load(path.join(root,'emberweave-heroes.html'));
const J=JSON.stringify, clone=x=>JSON.parse(J(x));
const spec=(key,talents)=>{ const s={key,level:60,stars:5,pips:0,ref:0,glyphRank:6,tt:{},ex:{techCrit:0,techCritRes:0,techHeal:0,equip:{}},fAtk:40,fHp:300,fApow:20,techArmor:60,techMr:40,techHeal:0,apMul:1,skillLv:[20,20,20,20],gearSkill:null,templeBonuses:null}; if(talents) s.talents=talents; return s; };
function build(hero,n,level){ let b={r:{}}; const tr=T.trees(hero)[0];
  for(let g=0;g<400&&T.spent(hero,b).total<n;g++){ const nx=tr.talents.slice().sort((a,c)=>a[1]-c[1]||a[2]-c[2]).find(t=>T.canLearn(hero,b,t[0],level)); if(!nx) break; b=T.learn(hero,b,nx[0],level).build; }
  return T.learned(hero,b); }
const FOE=[{key:'grosk',level:55,rank:2},{key:'tick',level:55,rank:2}];
const ways=(a,f,seed)=>[H.auto(clone(a),clone(f),seed),H.autoWatched(clone(a),clone(f),seed)].map(r=>r.digest);

test('a record frozen before talents (no tal field) fights, and fights as the same hero with nothing learned',()=>{
  const now=H.snapFromSpecs([spec('vael'),spec('sylthaine')]);
  assert.ok(now.every(s=>!('tal' in s)),'a hero with nothing learned carries no tal field');
  const old=clone(now); for(const s of old) delete s.tal;   // the shape of a pre-talent snap
  for(const seed of [1,2,3]) assert.deepEqual(ways(old,FOE,seed),ways(now,FOE,seed));
});

test('a record frozen under older talent data (unknown ids, ranks above the cap, odd entries) never throws',()=>{
  const learned=build('vael',20,60); assert.ok(learned.length,'a legal Vael build');
  const snaps=H.snapFromSpecs([spec('vael',learned),spec('gruel')]);
  assert.ok(Array.isArray(snaps[0].tal)&&snaps[0].tal.length,'a learned build rides on the snap');
  const odd=clone(snaps);
  odd[0].tal=odd[0].tal.concat([['zz_retired_9',3],[learned[0][0],99],[42,1],['',2],['rh_1_1',-4]]);   // an id the data dropped, a rank past the cap, junk
  odd[1].tal=[['no_tree_for_this',1]];   // a hero whose tree changed completely
  for(const seed of [5,6]){ const d=ways(odd,FOE,seed); assert.ok(d.every(x=>typeof x==='string'&&typeof JSON.parse(x).won==='boolean'&&Array.isArray(JSON.parse(x).u)),'the fight resolved: '+J(d).slice(0,300)); }
  // and the same snaps as the enemy side (a garrison or a defence line frozen with talents)
  const g=H.autoWatched(clone(H.snapFromSpecs([spec('vex')])),clone(odd),7); assert.equal(typeof g.won,'boolean');
});

test('an old v2 report (foe as {key, level, rank}) and an old line-model war line still resolve',()=>{
  const mine=H.snapFromSpecs([spec('vireo'),spec('vex')]);
  assert.equal(typeof H.autoWatched(clone(mine),clone(FOE),11).won,'boolean');
  const line=['vael','gruel'].map(k=>SIM.heroCombatStats(k,{level:60,stars:5,pips:0}));   // the stored lineSnapshot shape, no talent field
  const r=SIM.resolveLineBattle(SIM.makeLine(line,null,true),SIM.makeLine(['vex','tick'].map(k=>SIM.heroCombatStats(k,{level:60,stars:3,pips:0})),null,true),12);
  assert.equal(typeof r.won,'boolean');
});

test('a null or malformed entry inside a snap\'s talent list is ignored, on either side (14 Nov: it threw in buildUnitFromSnapshot)',()=>{
  const learned=build('vael',20,60), snaps=H.snapFromSpecs([spec('vael',learned),spec('gruel')]);
  const clean=clone(snaps), dirty=clone(snaps);
  dirty[0].tal=[null].concat(dirty[0].tal.slice(0,2),[undefined,7,'rh_1_1',{0:'x',1:1}],dirty[0].tal.slice(2),[null]);   // junk around the real entries
  for(const seed of [21,22]){
    assert.deepEqual(ways(dirty,FOE,seed),ways(clean,FOE,seed),'the junk entries changed the fight (ally side)');
    assert.equal(H.autoWatched(clone(FOE),clone(dirty),seed).digest,H.autoWatched(clone(FOE),clone(clean),seed).digest,'the junk entries changed the fight (enemy side)'); }
  const odd=clone(snaps); odd[0].tal='not a list'; odd[1].tal={length:3};   // not a list at all: fights as nothing learned... and never throws
  for(const seed of [23]){ const d=ways(odd,FOE,seed); assert.ok(d.every(x=>typeof JSON.parse(x).won==='boolean'));
    const none=clone(snaps); delete none[0].tal; delete none[1].tal; assert.deepEqual(d,ways(none,FOE,seed),'a talent list that is not a list fights as no talents'); }
});
