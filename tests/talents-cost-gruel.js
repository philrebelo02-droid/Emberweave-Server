'use strict';
/* What Gruel's talents cost per second of fight (not a test: a measurement, run with plain node).
   50 seeded campaign fights (5 stages x 10 seeds), a level-100 team of Vael, Sylthaine, Vireo, Vex and Gruel at skill level 100. Each row is timed alternately
   (twice) and given as milliseconds of wall time per second of fight (fight time = the battle ticks run x the tick), with the fights won and a digest.
   Run: node tests/talents-cost-gruel.js */
const {NOW,T,spec,snaps,everything,build}=require('./talents-lab.js'), vm=require('node:vm'), path=require('node:path'), fs=require('node:fs'), crypto=require('node:crypto');
const H='gruel', TEAM=['vael','sylthaine','vireo','vex','gruel'], ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
const VMX=s=>vm.runInContext(s,NOW.ctx);
VMX('var __ckN=0; var __ckU=_updateBattleCore; _updateBattleCore=function(dt){ __ckN++; return __ckU.apply(this,arguments); };');
const STEP=VMX('SIM_STEP'), NODES=[12,34,60,90,120].filter(n=>ENC.find(e=>e.node===n)), SEEDS=[1,2,3,4,5,6,7,8,9,10];
function grow(b,tree,n){ const tr=T.trees(H)[tree];
  for(let g=0;g<600&&T.spent(H,b).total<n;g++){ const nx=tr.talents.slice().sort((a,c)=>a[1]-c[1]||a[2]-c[2]).find(t=>T.canLearn(H,b,t[0],100)); if(!nx) break; b=T.learn(H,b,nx[0],100).build; } return b; }
const legal=grow(grow({r:{}},1,61),2,91);   // 61 in The Brass Scales, 30 in The Appetite
const legal2=grow(grow({r:{}},0,61),1,91);  // 61 in The Ledger, 30 in The Brass Scales
const ROWS={ none:null, everything:everything(H), 'legal 61 Scales + 30 Appetite':T.learned(H,legal), 'legal 61 Ledger + 30 Scales':T.learned(H,legal2),
  'The Ledger at 91':T.learned(H,build(H,0,91,100)), 'The Brass Scales at 91':T.learned(H,build(H,1,91,100)), 'The Appetite at 91':T.learned(H,build(H,2,91,100)) };
function run(list){ const sn=snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))); VMX('__ckN=0'); let won=0; const dg=crypto.createHash('sha1'); const t0=process.hrtime.bigint();
  for(const node of NODES) for(const seed of SEEDS){ const r=NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); if(r.won) won++; dg.update(String(r.digest)); }
  const ms=Number(process.hrtime.bigint()-t0)/1e6, secs=VMX('__ckN')*STEP; return {ms,secs,per:ms/secs,won,digest:dg.digest('hex').slice(0,12)}; }
const out={}; for(const k in ROWS) out[k]=[];
run(null);   // warm-up
for(let pass=0;pass<2;pass++) for(const k of ['none','everything','legal 61 Scales + 30 Appetite']) out[k].push(run(ROWS[k]));
for(const k of ['legal 61 Ledger + 30 Scales','The Ledger at 91','The Brass Scales at 91','The Appetite at 91']) out[k].push(run(ROWS[k]));
const base=out.none.reduce((a,r)=>a+r.per,0)/out.none.length;
console.log('Gruel cost: '+NODES.length+' stages x '+SEEDS.length+' seeds, team '+TEAM.join(', ')+' (level 100, skill level 100); legal builds spent '+JSON.stringify(T.spent(H,legal).tree)+' / '+JSON.stringify(T.spent(H,legal2).tree)+', invalid: "'+T.invalid(H,legal,100)+'" / "'+T.invalid(H,legal2,100)+'"');
for(const k in out){ const L=out[k], m=L.reduce((a,r)=>a+r.per,0)/L.length;
  console.log('  '+k.padEnd(32)+' '+L.map(r=>r.per.toFixed(2)).join(' / ')+' ms per second of fight (mean '+m.toFixed(2)+', '+(m>=base?'+':'')+((m/base-1)*100).toFixed(0)+'%), fight time '+L[0].secs.toFixed(0)+' s, won '+L.map(r=>r.won).join(' / ')+' of '+(NODES.length*SEEDS.length)+', digest '+L.map(r=>r.digest).join(' / ')); }
