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

/* ---- LOCKED HEROES and the RED DOT (14 Nov 2026). Controls: tests/talents-lockdots-controls.js ---- */
const fs=require('node:fs'), FX=require(path.join(root,'talents-fx.js'));
test('wired heroes: exactly the heroes with a talents-mech/<key>.js file (built into talents-fx.js), each a hero of the data; an unwired hero has no mechanics',()=>{
  const files=fs.readdirSync(path.join(root,'talents-mech')).filter(f=>f.endsWith('.js')&&!f.startsWith('_')).map(f=>f.slice(0,-3)).sort();
  assert.deepEqual(FX.mechHeroes().slice().sort(),files,'talents-fx.js lists every talents-mech file and nothing else (run tools/build_talent_fx.py after adding one)');
  for(const k of files) assert.ok(heroes.includes(k),k+'.js is named by a hero key of talents-data.js (Morvayne is hero61)');
  assert.ok(files.includes('vael'));
  for(const k of heroes.filter(h=>!files.includes(h))){ assert.equal(FX.mech(k),null,k); assert.equal(FX.attach({},k,[[T.trees(k)[0].talents[0][0],1]]),null,k+': no mechanic can attach'); }
});

/* the red dot's rule, by brute force: some talent of the hero passes canLearn */
const anyBrute=(h,b,lv)=>T.trees(h).some(tr=>tr.talents.some(t=>T.canLearn(h,b,t[0],lv)));
function dotCases(h){ const out=[[{r:{}},9],[{r:{}},10],[{r:{}},100]];
  for(const tr of T.trees(h)) for(const n of [1,5,23,61]){ const b=fill(h,{},100,tr.id,n), sp=T.spent(h,b).total; out.push([b,100],[b,sp+9],[b,sp+10]); }
  { let b=fill(h,{},100,T.trees(h)[0].id,61); b=fill(h,b,100,T.trees(h)[1].id,30); out.push([b,100]); }
  /* a pick-one fork taken: its other half is shut, the rest of the tier may still be open */
  for(const tr of T.trees(h)){ const f=tr.talents.find(t=>t[7]); if(!f) continue; let b=fill(h,{},100,tr.id,T.tierOpenAt(f[1])); const p=f[6]&&T.talent(h,f[6]); if(p) while(T.rankOf(b,p.id)<p.ranks&&T.canLearn(h,b,p.id,100)) b=T.learn(h,b,p.id,100).build;
    if(T.canLearn(h,b,f[0],100)){ b=T.learn(h,b,f[0],100).build; out.push([b,T.spent(h,b).total+10]); } }
  return out; }
test('anyLearnable (the Talents tab\'s red dot) is exactly "some talent passes canLearn", for every hero, and it is cheap',()=>{
  let yes=0, no=0, calls=0, ms=0;
  for(const h of heroes) for(const [b,lv] of dotCases(h)){ const want=anyBrute(h,b,lv);
    const t0=process.hrtime.bigint(); const got=T.anyLearnable(h,b,lv); ms+=Number(process.hrtime.bigint()-t0)/1e6; calls++;
    assert.equal(got,want,h+' at level '+lv+' with '+T.spent(h,b).total+' spent'); want?yes++:no++; }
  assert.ok(yes>500&&no>200,'both answers are exercised ('+yes+' yes, '+no+' no)');
  assert.equal(T.anyLearnable('vael',{r:{}},9),false,'no point before level 10'); assert.equal(T.anyLearnable('vael',{r:{}},10),true,'one point and tier 1 open');
  assert.equal(T.anyLearnable('not_a_hero',{r:{}},100),false);
  const per=ms/calls; console.log('    anyLearnable: '+calls+' calls, '+ms.toFixed(1)+' ms in all, '+(per*1000).toFixed(1)+' us a call (uncached; the page keeps the answer per hero)');
  assert.ok(per<2,'a call takes '+per.toFixed(3)+' ms: too slow for the hero list');
});
