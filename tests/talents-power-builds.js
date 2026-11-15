'use strict';
/* Legal full talent builds for the power tests and measurements (talents-power.test.js, talents-power-measure.js). Data only: no fight, no page.
   Each build is made one point at a time under the rules of talents.js (tier opens every 5 points above it in the tree, an arrow needs its
   upper talent at max rank, a fork locks its other half, one point per level from 10). The per-point check here is an incremental copy of
   T.whyNot (fast enough to make 800 builds in about a second); every finished build is checked again with the real T.invalid by the callers.
   Kinds of build, per hero:
     deep<t>      91 points down tree t, always the deepest talent the rules allow (reaches the signature at 61, then deep extras)
     shallow<t>   91 points in tree t, always the shallowest talent (the "fill the top rows" player; usually no signature)
     random<t>    91 points in tree t, a seeded random legal talent each point (spills into the other trees once t is full)
     split<a><b>  61 deep in tree a, then 30 in tree b (seeded random)
     even         30 + 30 + 31, one tree after the other (shallowest first) */
const path=require('node:path');
const T=require(path.join(__dirname,'..','talents.js'));
function rng(seed){ let x=(seed>>>0)||0x9e3779b9; return ()=>{ x^=x<<13; x^=x>>>17; x^=x<<5; return (x>>>0)/4294967296; }; }
/* a build being made: r = ranks, tier[tree][k] = points in tier k of that tree, total */
function state(hero,b){ const s={r:Object.assign({},(b&&b.r)||{}),tier:{},total:0}; for(const tr of T.trees(hero)) s.tier[tr.id]=new Array(14).fill(0);
  for(const id in s.r){ const t=T.talent(hero,id); s.tier[t.tree][t.tier]+=s.r[id]; s.total+=s.r[id]; } return s; }
function ok(hero,s,t,cap){ const r=s.r[t.id]|0; if(r>=t.ranks||s.total>=cap) return false;
  let above=0; const a=s.tier[t.tree]; for(let k=1;k<t.tier;k++) above+=a[k]; if(above<5*(t.tier-1)) return false;
  if(t.prereq&&(s.r[t.prereq]|0)<T.talent(hero,t.prereq).ranks) return false;
  if(t.lock&&(s.r[t.lock]|0)>0) return false; return true; }
const all=(hero,ti)=>(ti==null?T.trees(hero):[T.trees(hero)[ti]]).flatMap(tr=>tr.talents.map(x=>T.talent(hero,x[0])));
function fill(hero,b,pool,n,pick,level){ const s=state(hero,b), cap=Math.min(T.pointsTotal(level||100),s.total+n), P=pool();
  while(s.total<cap){ const c=P.filter(t=>ok(hero,s,t,cap)); if(!c.length) break; const t=pick(c); s.r[t.id]=(s.r[t.id]|0)+1; s.tier[t.tree][t.tier]++; s.total++; }
  return {r:s.r}; }
const deepest=c=>c.reduce((a,b)=>(b.tier>a.tier||(b.tier===a.tier&&(b.col<a.col||(b.col===a.col&&b.id<a.id))))?b:a);
const shallowest=c=>c.reduce((a,b)=>(b.tier<a.tier||(b.tier===a.tier&&(b.col<a.col||(b.col===a.col&&b.id<a.id))))?b:a);
const rnd=r=>c=>c[Math.floor(r()*c.length)];
function builds(hero,level){ level=level||100; const out=[]; const n=T.trees(hero).length;
  for(let t=0;t<n;t++){
    out.push(['deep'+t,fill(hero,{r:{}},()=>all(hero,t),91,deepest,level)]);
    out.push(['shallow'+t,fill(hero,{r:{}},()=>all(hero,t),91,shallowest,level)]);
    const r=rng(7919*(t+1)+hero.length*131); let b=fill(hero,{r:{}},()=>all(hero,t),91,rnd(r),level); b=fill(hero,b,()=>all(hero),91,rnd(r),level);
    out.push(['random'+t,b]);
    const s=(t+1)%n, r2=rng(104729*(t+1)+hero.charCodeAt(0)); let c=fill(hero,{r:{}},()=>all(hero,t),61,deepest,level); c=fill(hero,c,()=>all(hero,s),30,rnd(r2),level);
    out.push(['split'+t+s,c]); }
  let e={r:{}}; for(let t=0;t<n;t++) e=fill(hero,e,()=>all(hero,t),t===n-1?31:30,shallowest,level); out.push(['even',e]);
  return out; }
/* `pts` points deep into tree t, as a player levelling up spends them */
function partial(hero,t,pts,level){ return fill(hero,{r:{}},()=>all(hero,t),pts,deepest,level||100); }
module.exports={builds,partial,fill,rng,all,deepest,shallowest};
