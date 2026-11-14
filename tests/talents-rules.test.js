'use strict';
/* Talent learning rules (talents.js) against the compiled data (talents-data.js). Run: node --test tests/talents-rules.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),T=require(path.join(root,'talents.js')),DATA=require(path.join(root,'talents-data.js'));
const heroes=Object.keys(DATA.heroes);

/* spend points greedily, top tier first, until `want` points are in `treeId` (or nothing more can be learned there) */
function fill(hero,build,level,treeId,want){
  for(let guard=0;guard<400;guard++){
    const sp=T.spent(hero,build); if(sp.tree[treeId]>=want) break;
    const tr=T.trees(hero).find(t=>t.id===treeId);
    const next=tr.talents.slice().sort((a,b)=>a[1]-b[1]||a[2]-b[2]).find(t=>T.canLearn(hero,build,t[0],level));
    if(!next) break;
    build=T.learn(hero,build,next[0],level).build;
  }
  return build;
}

test('data: 61 heroes, three trees each, every tree a lone 1-rank signature at tier 13',()=>{
  assert.equal(heroes.length,61);
  for(const h of heroes){ const trs=T.trees(h); assert.equal(trs.length,3,h);
    for(const tr of trs){ const sig=tr.talents.filter(t=>t[1]===13); assert.equal(sig.length,1,h+'/'+tr.id); assert.equal(sig[0][4],1,h+'/'+tr.id); } }
});

test('points: none before level 10, one per level, 91 at level 100',()=>{
  assert.equal(T.pointsTotal(1),0); assert.equal(T.pointsTotal(9),0); assert.equal(T.pointsTotal(10),1);
  assert.equal(T.pointsTotal(70),61); assert.equal(T.pointsTotal(100),91); assert.equal(T.pointsTotal(140),91);
});

test('nothing is learned until a point is spent: an empty build has no learned talents',()=>{
  for(const h of heroes) assert.deepEqual(T.learned(h,{}),[]);
  assert.deepEqual(T.learned('vael',undefined),[]);
});

test('a hero below level 10 cannot learn; tier 2 is shut until 5 points are in the tree',()=>{
  const tr=T.trees('vael')[0], t1=tr.talents.find(t=>t[1]===1), t2=tr.talents.find(t=>t[1]===2&&!t[6]);
  assert.match(T.whyNot('vael',{},t1[0],9),/level 10/);
  assert.equal(T.whyNot('vael',{},t1[0],10),'');
  assert.match(T.whyNot('vael',{},t2[0],100),/more points? in this tree/);
  const b=fill('vael',{},100,tr.id,5);
  assert.equal(T.spent('vael',b).tree[tr.id],5);
  assert.equal(T.whyNot('vael',b,t2[0],100),'');
});

test('every tree of every hero: 91 points fit in one tree, the signature opens at exactly 61, and the result is a legal build',()=>{
  for(const h of heroes) for(const tr of T.trees(h)){
    const sig=tr.talents.find(t=>t[1]===13)[0];
    let b=fill(h,{},100,tr.id,60);
    assert.equal(T.spent(h,b).tree[tr.id],60,h+'/'+tr.id+': could not place 60 points below the signature');
    const pre=T.talent(h,sig).prereq;
    if(!pre||T.rankOf(b,pre)>=T.talent(h,pre).ranks){ assert.equal(T.whyNot(h,b,sig,100),'',h+'/'+tr.id); b=T.learn(h,b,sig,100).build; }
    b=fill(h,b,100,tr.id,91);
    assert.equal(T.spent(h,b).total,91,h+'/'+tr.id+': 91 points do not fit');
    assert.equal(T.invalid(h,b,100),'',h+'/'+tr.id);
    assert.match(T.whyNot(h,b,tr.talents[0][0],100),/No talent points left|max rank/);
  }
});

test('61 + 30: the signature of one tree plus 30 points in each sister tree is legal',()=>{
  for(const h of heroes){ const trs=T.trees(h);
    for(const main of trs) for(const side of trs){ if(main===side) continue;
      let b=fill(h,{},100,main.id,61); b=fill(h,b,100,side.id,30);
      assert.equal(T.spent(h,b).total,91,h+' '+main.id+'+'+side.id); assert.equal(T.invalid(h,b,100),'',h+' '+main.id+'+'+side.id); } }
});

test('prerequisites: the lower talent of an arrow needs the upper one at max rank',()=>{
  let checked=0;
  for(const h of heroes) for(const tr of T.trees(h)) for(const t of tr.talents){ if(!t[6]) continue;
    const b={r:{}}; for(const o of tr.talents) if(o[1]<t[1]&&o[0]!==t[6]&&!o[7]) b.r[o[0]]=o[4];   // plenty of points above, but not the prerequisite
    if(T.spent(h,b).tree[tr.id]<T.tierOpenAt(t[1])) continue;
    assert.match(T.whyNot(h,b,t[0],100)||'(ok)',/Needs .* at max rank|No talent points left|Locked/,h+'/'+t[0]); checked++; }
  assert.ok(checked>300,'only '+checked+' arrows checked');
});

test('pick-one forks: learning one half locks the other, and a build with both is illegal',()=>{
  let forks=0;
  for(const h of heroes) for(const tr of T.trees(h)) for(const t of tr.talents){ if(!t[7]) continue; forks++;
    assert.equal(T.talent(h,t[7]).lock,t[0],h+'/'+t[0]+': fork is not mutual');
    assert.match(T.whyNot(h,{r:{[t[7]]:1}},t[0],100),/Locked|more point/,h+'/'+t[0]);
    assert.notEqual(T.invalid(h,{r:{[t[0]]:1,[t[7]]:1}},100),'',h+'/'+t[0]); }
  assert.ok(forks>=183*2,'only '+forks+' fork halves found');
});

test('invalid(): unknown ids, bad ranks, too many points and shut tiers are all refused',()=>{
  const tr=T.trees('vael')[0], t1=tr.talents.find(t=>t[1]===1), deep=tr.talents.find(t=>t[1]===6&&!t[6]&&!t[7]);
  assert.match(T.invalid('vael',{r:{nope:1}},100),/Unknown talent/);
  assert.match(T.invalid('vael',{r:{[t1[0]]:t1[4]+1}},100),/Bad rank/);
  assert.match(T.invalid('vael',{r:{[t1[0]]:1.5}},100),/Bad rank/);
  assert.match(T.invalid('vael',{r:{[deep[0]]:1}},100),/not open/);
  const b=fill('vael',{},100,tr.id,20);
  assert.equal(T.invalid('vael',b,100),''); assert.match(T.invalid('vael',b,20),/More points spent/);
});

test('learned(): a stable, sorted [id, rank] list; learn() never changes the build it was given',()=>{
  const tr=T.trees('vael')[0], a=tr.talents.filter(t=>t[1]===1&&!t[7]);
  const b0={r:{}}, b1=T.learn('vael',b0,a[1][0],100).build, b2=T.learn('vael',b1,a[0][0],100).build;
  assert.deepEqual(b0,{r:{}});
  assert.deepEqual(T.learned('vael',b2),[[a[0][0],1],[a[1][0],1]].sort((x,y)=>x[0]<y[0]?-1:1));
});
