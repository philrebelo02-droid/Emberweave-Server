'use strict';
/* The "every system counts" check shared by the real-engine tests: gear, Temper, glyphs, Temple prayers, Academy, skill levels and learned
   talents each change a squad's snaps (campaignHeroSpec -> the page's snapFromSpecs) and, over `n` seeds, win more often against `foe`.
   run(S, PAGE, pool, {team, foe(snapsOfGearOnlySquad) -> foe snaps, method:'autoWatched', n:100, args(sn,foe,seed)}) -> {res, ok} */
const W=require('./arena-world.cjs'), path=require('node:path'), T=require(path.join(__dirname,'..','..','talents.js'));
const J=JSON.stringify, clone=x=>JSON.parse(J(x));
function build(hero,treeIdx,n,level){ let b={r:{}}; const tr=T.trees(hero)[treeIdx];
  for(let g=0;g<400&&T.spent(hero,b).total<n;g++){ const nx=tr.talents.slice().sort((a,c)=>a[1]-c[1]||a[2]-c[2]).find(t=>T.canLearn(hero,b,t[0],level)); if(!nx) break; b=T.learn(hero,b,nx[0],level).build; }
  return b; }
async function run(S,PAGE,pool,o){ const TEAM=o.team, base=o.base||{level:60,stars:5,skill:[20,20,20,20],asc:4}, n=o.n||100, tag=o.tag||'Sys';
  const squad=u=>PAGE.snapFromSpecs(clone(TEAM.map(k=>S.campaignHeroSpec(u,k))));
  const add={ gear:k=>({gear:W.gearFor(k)}), temper:k=>({gear:W.gearFor(k),temper:12}), glyphs:()=>({glyphAtk:300}), prayers:()=>({temple:4}),
    academy:()=>({acad:40}), skills:()=>({skill:[60,60,60,60]}), talents:k=>({talents:build(k,0,30,base.level)}) };
  const seeds=Array.from({length:n},(_,i)=>(i+1)*2654435761>>>0);
  const args=o.args||((sn,foe,s)=>[sn,foe,s]);
  const wins=async(sn,foe,m)=>(await Promise.all(seeds.slice(0,m||n).map(s=>pool.run(o.method||'autoWatched',args(sn,foe,s))))).filter(r=>r.won).length;
  const ref=squad(W.player(S,tag+'Ref',Object.fromEntries(TEAM.map(k=>[k,Object.assign({},base,{gear:W.gearFor(k)})]))));
  const foe=await o.foe(ref,wins);
  const res={}, bad=[], cache=new Map();
  for(const f in add){ const lo={}, hi={};
    for(const k of TEAM){ const b0=Object.assign({},base,f==='temper'?{gear:W.gearFor(k)}:(f==='gear'?{}:{gear:W.gearFor(k)})); lo[k]=b0; hi[k]=Object.assign({},b0,add[f](k)); }
    const loS=squad(W.player(S,tag+'Lo-'+f,lo)), hiS=squad(W.player(S,tag+'Hi-'+f,hi)), kl=J(loS);
    if(!cache.has(kl)) cache.set(kl,await wins(loS,foe)); const a=cache.get(kl), b=await wins(hiS,foe); res[f]=[a,b];
    if(J(hiS)===J(loS)) bad.push(f+': the snaps are the same'); else if(!(b>a)) bad.push(f+': '+a+' -> '+b); }
  return {res,bad}; }
module.exports={ run, build };
