'use strict';
/* What Aureth's talents cost a fight (not a test: run with plain node, on a quiet machine).
   50 seeded campaign fights (5 stages x 10 seeds), a level-100 team of Vael, Sylthaine, Vireo, Vex and Aureth at skill level 100, for: no talents,
   a legal full build (61 points in The Hungry Brother + 30 in The Third Brother), every talent at full rank (both halves of each pick-one, not a legal
   build), and each tree at 91. Each is run twice, alternately. Prints ms per second of fight (the cost that does not depend on how long the fights
   last), the fights won and a digest of the no-talent fights (the same in every run).
   Run: node tests/talents-aureth-measure.js */
const {NOW,T,spec,snaps,everything,build}=require('./talents-lab.js'), vm=require('node:vm'), path=require('node:path'), fs=require('node:fs'), crypto=require('node:crypto');
const H='aureth', ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
const NODES=[12,34,60,90,120], SEEDS=[1,2,3,4,5,6,7,8,9,10], TEAM=['vael','sylthaine','vireo','vex',H];
function fill(b,ti,n){ const tr=T.trees(H)[ti]; for(let g=0;g<600&&T.spent(H,b).total<n;g++){ const nx=tr.talents.slice().sort((a,c)=>a[1]-c[1]||a[2]-c[2]).find(t=>T.canLearn(H,b,t[0],100)); if(!nx) break; b=T.learn(H,b,nx[0],100).build; } return b; }
const legal=fill(fill({r:{}},0,61),2,91); if(T.invalid(H,legal,100)) throw new Error('not legal: '+T.invalid(H,legal,100));
const CFG={ none:null, legal:T.learned(H,legal), everything:everything(H), hb91:T.learned(H,build(H,0,91,100)), mb91:T.learned(H,build(H,1,91,100)), tb91:T.learned(H,build(H,2,91,100)) };
vm.runInContext('var __mt={n:0}; var __mu=updateBattle; updateBattle=function(dt){ __mt.n++; return __mu.apply(this,arguments); };',NOW.ctx);
function run(list){ const sn=snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))); const keep=JSON.stringify(sn);
  const c=vm.runInContext('__mt',NOW.ctx); c.n=0; let won=0; const dg=crypto.createHash('sha1'); const t0=process.hrtime.bigint();
  for(const node of NODES) for(const seed of SEEDS){ const r=NOW.campaign(JSON.parse(keep),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); if(r.won) won++; dg.update(String(r.digest)); }
  const ms=Number(process.hrtime.bigint()-t0)/1e6, secs=c.n*vm.runInContext('SIM_STEP',NOW.ctx);
  return {ms,secs,per:ms/secs,won,dg:dg.digest('hex').slice(0,12)}; }
console.log('legal build: '+JSON.stringify(T.spent(H,legal).tree));
const res={}; for(let pass=0;pass<2;pass++) for(const k of Object.keys(CFG)){ const r=run(CFG[k]); (res[k]=res[k]||[]).push(r);
  console.log(pass+' '+k.padEnd(11)+' '+r.ms.toFixed(0)+' ms, '+r.secs.toFixed(0)+' s of fight, '+r.per.toFixed(3)+' ms per second, won '+r.won+' of 50, digest '+r.dg); }
const mean=k=>res[k].reduce((a,r)=>a+r.per,0)/res[k].length, base=mean('none');
for(const k of Object.keys(CFG)) console.log(k.padEnd(11)+' mean '+mean(k).toFixed(3)+' ms per second of fight ('+(k==='none'?'base':((mean(k)/base-1)*100).toFixed(1)+'%')+'), won '+res[k].map(r=>r.won).join(' / '));
