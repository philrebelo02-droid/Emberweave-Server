'use strict';
/* The still-field lab shared by the per-hero talent mechanics tests (tests/talents-mech-<hero>.test.js): the page's own battle code through
   server/sim-host.js, with helpers that live INSIDE the battle VM. The same field as tests/talents-mech.test.js (Vael's), for any hero.
   Places, in metres from the hero: foes F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6) F6 (0,12) F7 (5.5,12) F8 (11,12);
   allies A0 (0,-5.5) A1 (0,-11) A2 (0,-16.5). Plain units are rank-0 Vaels (no skills, no passive) with huge HP; everyone is held in place. */
const assert=require('node:assert/strict'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),SH=require(path.join(root,'server/sim-host.js')),T=require(path.join(root,'talents.js')),FXN=require(path.join(root,'talents-fx.js'));
const NOW=SH.load(path.join(root,'emberweave-heroes.html')), FX=NOW.sandbox.TalentFx;
const V=vm.runInContext(`({
  arena(al,fo,seed){ ended=false; state='battle'; CUR={mode:'replay',seed}; battleTime=0; gameSpeed=1; window._p2win=null; autoUlt=true;
    try{groundHazards.length=0;shots.length=0;particles.length=0;floatTexts.length=0;}catch(e){} waveXfer=null; chapterWaves=1; waveIdx=0; seedBattle(seed); setupMarchTeams(al,fo,false); return units; },
  step(n){ for(let i=0;i<n&&!ended;i++) updateBattle(SIM_STEP); return battleTime; },
  hit(a,b,amt,o){ o=o||{}; const p=_preCrit; _preCrit=(o.crit==null?false:o.crit); if(o.auto) _autoAtk=1; try{ if(o.frost) dealFrostDamage(a,b,amt,'#fff',o.kind||'magic'); else dealDamage(a,b,amt,'#fff',o.kind); } finally{ _autoAtk=0; _preCrit=p; } },
  dmg(u,a){ damage(u,a,'#fff',true); },
  heal(u,a){ healUnit(u,a); },
  cast(u,slot,tgt){ if(tgt) u.target=tgt; const ult=u.abilityOverride||u.t.ability, ab=slot==='ult'?Object.assign({},ULT_DEF[ult]):(slot==='blue'?u.blueAb:u.greenAb); const type=slot==='ult'?ult:ab.type;
    u._castSlot=slot; u._castLv=(u.skillLv&&u.skillLv[slot==='ult'?0:(slot==='green'?1:2)])||1; u._castSM=skillMul(u._castLv); const o2=(ab&&ab.deliver)?Object.assign({},ab,{_arrived:true,_tgtU:u.target}):ab;   /* a delivered skill: as it lands on its target */
    try{ doEffect(u,type,o2); } finally{ u._castSM=1; u._castLv=0; } },
  cc(by,t,field,dur){ return ccApply(by,t,field,dur); },
  wave(){ resetPerWave(); },
  dot(t,per,dur,iv,src){ pushDot(t,per,dur,iv,'#8f8fa8',src,'true'); },
  rndPeek(n){ const out=[]; for(let i=0;i<n;i++) out.push(brnd()); return out; },
  now(){ return battleTime; }, STEP:SIM_STEP, METER:METER, ccNerf:ccDur(1), cap(f){ return CC_DUR_MAX[f]; }, ended(){ return ended; }, bodyR(u){ return bodyR(u)/METER; },
  slowMulFor(l){ return slowMulFor(l); }
})`,NOW.ctx);
const spec=(key,level,talents,gr)=>{ const s={key,level,stars:3,pips:0,ref:0,glyphRank:gr==null?6:gr,tt:{},ex:{techCrit:0,techCritRes:0,techHeal:0,equip:{}},fAtk:40,fHp:300,fApow:20,techArmor:60,techMr:40,techHeal:0,apMul:1,skillLv:[10,10,10,10],gearSkill:null,templeBonuses:null}; if(talents) s.talents=talents; return s; };
const snaps=specs=>JSON.parse(JSON.stringify(NOW.snapFromSpecs(specs)));
const near=(a,b,msg,eps)=>assert.ok(Math.abs(a-b)<=(eps||1e-6)*Math.max(1,Math.abs(b)),(msg||'')+': '+a+' vs '+b);
const secs=s=>V.step(Math.round(s/V.STEP));
const J=x=>JSON.parse(JSON.stringify(x));
const FPOS=[[4.5,0],[10,0],[15.5,0],[0,6],[5.5,6],[11,6],[0,12],[5.5,12],[11,12]], APOS=[[0,-5.5],[0,-11],[0,-16.5]];
/* lab(hero, learned list, {allies, foes, seed, def (a scripted definition), big (the hero has huge HP too), cold (no first tick), allyKey}) */
function lab(hero,list,o){ o=o||{}; if('def' in o) FX.define(hero,o.def);
  const al=[spec(hero,100,list)].concat(Array.from({length:o.allies||0},()=>spec(o.allyKey||'vael',100,null,0)));
  const U=V.arena(snaps(al),snaps(Array.from({length:o.foes==null?2:o.foes},()=>spec('vael',100,null,0))),o.seed||7);
  const v=U[0], A=U.filter(u=>u.team==='ally'&&u!==v), F=U.filter(u=>u.team==='enemy');
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.ctrlHitF=0; u.glyphDR=0; if(u!==v||o.big){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; const put=(u,dx,dy)=>{ u.x=v.x+dx*V.METER; u.y=v.y+dy*V.METER; };
  F.forEach((f,i)=>put(f,FPOS[i][0],FPOS[i][1])); A.forEach((a,i)=>put(a,APOS[i][0],APOS[i][1]));
  if(!o.cold) V.step(1);
  return {v,A,F,U,T:v._tal,put}; }
const lost=(t,fn)=>{ const h=t.hp, s=t.shield||0; fn(); return (h-t.hp)+(s-(t.shield||0)); };
const stack=(L,name)=>{ const k=L.T.s.k[name]; return k?k.n:0; };
const mark=(L,t,name)=>!!(t&&t._talM&&t._talM[L.v.uid]&&t._talM[L.v.uid][name]&&(t._talM[L.v.uid][name].until==null||t._talM[L.v.uid][name].until>V.now()));
const full=(hero,ids)=>ids.map(id=>[id,T.talent(hero,id).ranks]).sort((a,b)=>a[0]<b[0]?-1:1);
const everything=hero=>{ const l=[]; for(const tr of T.trees(hero)) for(const t of tr.talents) l.push([t[0],t[4]]); return l.sort((a,b)=>a[0]<b[0]?-1:1); };
function build(hero,treeIdx,n,level){ let b={r:{}}; const tr=T.trees(hero)[treeIdx];
  for(let g=0;g<600&&T.spent(hero,b).total<n;g++){ const nx=tr.talents.slice().sort((a,c)=>a[1]-c[1]||a[2]-c[2]).find(t=>T.canLearn(hero,b,t[0],level)); if(!nx) break; b=T.learn(hero,b,nx[0],level).build; }
  return b; }
/* every talent of the hero is a plain stat, has rows, or is on the rulings list, and the three never overlap; every rank resolves to finite numbers */
function accounting(hero,counts){ const M=FXN.mech(hero), all=[]; for(const tr of T.trees(hero)) for(const t of tr.talents) all.push(t[0]);
  const st=all.filter(id=>FXN.has(hero,id)), me=all.filter(id=>M.talents[id]), ru=all.filter(id=>M.ruling[id]);
  assert.equal(new Set(st.concat(me,ru)).size,all.length,'each talent in exactly one bin'); assert.equal(st.length+me.length+ru.length,all.length);
  assert.deepEqual([all.length,st.length,me.length,ru.length,Object.keys(M.partial||{}).length],counts);
  for(const id of Object.keys(M.talents).concat(Object.keys(M.ruling),Object.keys(M.partial||{}),Object.keys(M.needs||{}))) assert.ok(T.talent(hero,id),id+' is a real talent id');
  for(const id of Object.keys(M.partial||{})) assert.ok(M.talents[id],id+': a partial talent has rows');
  for(const id of me) for(let r=1;r<=T.talent(hero,id).ranks;r++){ const t=FXN.attach({uid:1},hero,[[id,r]]); assert.ok(t,id);
    const walk=(x,p)=>{ if(typeof x==='number') assert.ok(Number.isFinite(x),id+' rank '+r+' '+p); else if(x&&typeof x==='object') for(const k in x) walk(x[k],p+'.'+k); }; walk([t.on,t.stats,t.auras],''); } }
/* whole fights: determinism twice, through a snap round-trip, snaps untouched, mirror and one-sided two-team fights */
const ENC=JSON.parse(require('node:fs').readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8'));
const campaign=(sn,node,seed)=>{ const r=NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.digest]); };
function determinism(hero,team){ const lists=[everything(hero)].concat([0,1,2].map(i=>T.learned(hero,build(hero,i,91,100))));
  for(const list of lists){ const sn=snaps(team.map(k=>spec(k,100,k===hero?list:null))), keep=JSON.stringify(sn);
    for(const [node,seed] of [[34,11],[60,90210],[90,424242]]){ const a=campaign(sn,node,seed), b=campaign(sn,node,seed); assert.equal(a,b,'twice: node '+node+' seed '+seed);
      const rt=sn.map(s=>JSON.parse(JSON.stringify(NOW.sandbox.snapUnitResolved(NOW.sandbox.buildUnitFromSnapshot(JSON.parse(JSON.stringify(s)),'ally',0,0)))));
      assert.deepEqual(rt,JSON.parse(keep),'a unit rebuilt from the snap snapshots to the same snap'); assert.equal(campaign(rt,node,seed),a,'through the round-trip'); }
    assert.equal(JSON.stringify(sn),keep,'the snaps are untouched by the fights');
    const plain=snaps(team.map(k=>spec(k,100)));
    const r1=NOW.auto(JSON.parse(keep),JSON.parse(keep),5), r2=NOW.auto(JSON.parse(keep),JSON.parse(keep),5); assert.equal(JSON.stringify(r1),JSON.stringify(r2),'talents on both sides');
    const r3=NOW.auto(JSON.parse(JSON.stringify(plain)),JSON.parse(keep),5), r4=NOW.auto(JSON.parse(JSON.stringify(plain)),JSON.parse(keep),5); assert.equal(JSON.stringify(r3),JSON.stringify(r4),'talents on the enemy side only'); } }
module.exports={NOW,FX,FXN,T,V,spec,snaps,near,secs,J,lab,lost,stack,mark,full,everything,build,accounting,determinism,campaign,root};
