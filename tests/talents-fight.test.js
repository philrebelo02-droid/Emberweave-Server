'use strict';
/* Talents in a fight, step 1: the learned list travels spec -> makeUnit -> snap -> buildUnitFromSnapshot, plain stat talents change the
   numbers by exactly their percent, and a hero with NOTHING learned is built and fights exactly as before talents existed.
   BASE = the game page at TALENT_BASE (default: the last commit on main before the talents branch touched the page).
   Run: node --test tests/talents-fight.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),SH=require(path.join(root,'server/sim-host.js')),T=require(path.join(root,'talents.js')),FX=require(path.join(root,'talents-fx.js'));
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
/* a checkout-shaped temp folder holding the BASE page next to this checkout's other files (sim-host loads the page's local scripts from the page's folder) */
function baseHost(){ const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  const page=cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28});
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),page);
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));   // the page's own local scripts (not the talent files: BASE has none)
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true});
  return SH.load(path.join(dir,'emberweave-heroes.html')); }
const NOW=SH.load(path.join(root,'emberweave-heroes.html'));
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - identity checks against it are skipped'); }
const TEAM=['vael','sylthaine','vireo','vex','gruel'];
const spec=(key,level,talents)=>{ const s={key,level,stars:3,pips:0,ref:0,glyphRank:6,tt:{},ex:{techCrit:0,techCritRes:0,techHeal:0,equip:{}},fAtk:40,fHp:300,fApow:20,techArmor:60,techMr:40,techHeal:0,apMul:1,skillLv:[10,10,10,10],gearSkill:null,templeBonuses:null}; if(talents) s.talents=talents; return s; };
const snaps=(host,specs)=>JSON.parse(JSON.stringify(host.snapFromSpecs(specs)));
const WAVES=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')).find(e=>e.node===34).waves;
const fight=(host,sn,seed)=>{ const won=host.campaign(JSON.parse(JSON.stringify(sn)),WAVES,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([won,host.sandbox._p2digest]); };
/* a legal build: `n` points greedily down one tree */
function build(hero,treeIdx,n,level){ let b={r:{}}; const tr=T.trees(hero)[treeIdx];
  for(let g=0;g<400&&T.spent(hero,b).total<n;g++){ const nx=tr.talents.slice().sort((a,c)=>a[1]-c[1]||a[2]-c[2]).find(t=>T.canLearn(hero,b,t[0],level)); if(!nx) break; b=T.learn(hero,b,nx[0],level).build; }
  return b; }

test('no talents: every snap is identical to the pre-talent game, and so is a whole seeded fight',{skip:!BASE},()=>{
  const specs=TEAM.map(k=>spec(k,60));
  const a=snaps(NOW,specs), b=snaps(BASE,specs);
  assert.deepEqual(a,b); assert.ok(a.every(s=>!('tal' in s)),'a hero with no talents carries no talent field');
  for(const seed of [11,90210,424242]) assert.equal(fight(NOW,a,seed),fight(BASE,b,seed),'seed '+seed);
});

test('an empty learned list is the same as no list',()=>{
  const a=snaps(NOW,TEAM.map(k=>spec(k,60))), e=snaps(NOW,TEAM.map(k=>spec(k,60,[])));
  assert.deepEqual(a,e);
});

test('stat talents change exactly the stated numbers, by exactly the stated percent',()=>{
  let checked=0;
  for(const hero of ['vael','sylthaine','gruel','sloe','rafe','ambrel','aureth','vex']){
    const S=Object.keys(T.trees(hero).reduce((o,tr)=>{ for(const t of tr.talents) if(FX.has(hero,t[0])) o[t[0]]=t[4]; return o; },{}));
    for(const id of S){ const ranks=T.talent(hero,id).ranks, tot=FX.totals(hero,[[id,ranks]]);
      const p=snaps(NOW,[spec(hero,80)])[0], q=snaps(NOW,[spec(hero,80,[[id,ranks]])])[0];
      assert.deepEqual(q.tal,[[id,ranks]]);
      const near=(x,y,m)=>assert.ok(Math.abs(x-y)<=1e-9*Math.max(1,Math.abs(y)),hero+'/'+id+' '+m+': '+x+' vs '+y);
      near(q.maxHp,p.maxHp*(1+(tot.hp||0)),'max HP'); near(q.dmg,p.dmg*(1+(tot.atk||0)),'attack'); near(q.apow,p.apow*(1+(tot.apow||0)),'ability power');
      near(q.armorRating,p.armorRating*(1+(tot.armor||0)),'armor'); near(q.mrRating,p.mrRating*(1+(tot.mr||0)),'magic resist');
      near(q.glyphCrit,Math.min(0.6,p.glyphCrit+(tot.crit||0)),'crit chance'); near(1+q.critDmg,(1+p.critDmg)*(1+(tot.critDmg||0)),'crit damage');
      near(q.atkInterval,p.atkInterval/(1+(tot.aspd||0)),'attack speed'); near(q.healPowMul,p.healPowMul*(1+(tot.heal||0)),'healing power'); near(q.shieldStrMul,p.shieldStrMul*(1+(tot.shield||0)),'shield strength');
      const same=Object.keys(p).filter(k=>!['maxHp','dmg','apow','armorRating','mrRating','glyphCrit','critDmg','atkInterval','healPowMul','shieldStrMul'].includes(k));
      for(const k of same) assert.deepEqual(q[k],p[k],hero+'/'+id+': '+k+' must not change');
      checked++; } }
  assert.ok(checked>=60,'only '+checked+' stat talents checked');
});

test('a snap is rebuilt with its numbers once: a fight from a talented snap replays to the same result, and differs from the untalented one',()=>{
  const b=build('vael',1,61,80), list=T.learned('vael',b); assert.equal(T.invalid('vael',b,80),''); assert.ok(list.some(e=>FX.has('vael',e[0])),'the build holds at least one stat talent');
  const plain=snaps(NOW,TEAM.map(k=>spec(k,80))), tal=snaps(NOW,TEAM.map(k=>spec(k,80,k==='vael'?list:null)));
  assert.deepEqual(tal[0].tal,list); assert.ok(tal[0].maxHp>plain[0].maxHp,'Ironblood gives Vael max HP');
  assert.deepEqual(tal.slice(1),plain.slice(1),'heroes with no talents are untouched by a team-mate having some');
  const r1=fight(NOW,tal,777), r2=fight(NOW,tal,777); assert.equal(r1,r2,'same snaps, same seed, same fight');
  const u=NOW.sandbox.buildUnitFromSnapshot(JSON.parse(JSON.stringify(tal[0])),'ally',0,0);
  assert.equal(u.maxHp,tal[0].maxHp,'max HP is not multiplied a second time when the unit is rebuilt from the snap'); assert.deepEqual(JSON.parse(JSON.stringify(u._talList)),list);
});

test('an unknown talent id or a list saved under older data never throws and adds nothing',()=>{
  const p=snaps(NOW,[spec('vael',80)])[0], q=snaps(NOW,[spec('vael',80,[['no_such_talent',3],['rh_1_1',0]])])[0];
  const strip=s=>{ const o=Object.assign({},s); delete o.tal; return o; };
  assert.deepEqual(strip(q),strip(p));
});
