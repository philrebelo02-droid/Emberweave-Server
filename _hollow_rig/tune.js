// usage: node tune.js '<override js run inside VM>' '<P json>' N label
const {load,spec}=require('./lib.js'); const vm=require('vm'); const L=load(); const ENC=require('../server/campaign-encounters.json');
const ov=process.argv[2]; if(ov&&ov!=='none') vm.runInContext(ov,L.ctx);
const P=JSON.parse(process.argv[3]); const N=+(process.argv[4]||12); const nodes=(process.argv[5]||'').split(',').filter(Boolean).map(Number);
const mates=(process.env.MATES||'grosk,vael,sylthaine,vireo').split(','); const others=['konwu','vulmar','aureth','hurne','veyr','kharos'];
const mk=k=>L.host.snapFromSpecs([k,...mates].map(z=>spec(z,P)));
const sum=r=>Object.values(r.dmg).reduce((a,b)=>a+b,0);
let tw=0,tn=0; const per=[];
for(const y of others){ let xw=0; for(let i=0;i<N;i++){ const seed=(0x27d4eb2f*(i+3))>>>0;
  if(L.host.auto(mk('hollow'),mk(y),seed).won) xw++; if(!L.host.auto(mk(y),mk('hollow'),seed).won) xw++; }
  per.push(y+' '+(100*xw/(2*N)).toFixed(0)+'%'); tw+=xw; tn+=2*N; }
console.log('5v5 hollow-team win vs swap:', per.join(' | '), '| ALL', (100*tw/tn).toFixed(0)+'%');
if(nodes.length){ const snaps=mk('hollow'); let d=0,t=0,k=0,f=0,ult=0,casts=0;
  for(const nd of nodes) for(let i=0;i<N;i++){ L.reset(); L.host.campaign(JSON.parse(JSON.stringify(snaps)),ENC[nd-1].waves,(0x9e3779b1*(i+1)+nd*7919)>>>0,[[1,'auto',-1,1]]); f++;
    for(const r of L.report().rows.filter(r=>r.team==='ally')){ t+=sum(r); if(r.key==='hollow'){ d+=sum(r); k+=r.kills; casts+=(r.casts.ult||0); for(const [s,v] of Object.entries(r.dmg)) if(s.startsWith('ult')) ult+=v; } } }
  console.log('campaign hollow dmg/fight',Math.round(d/f),'share',(100*d/t).toFixed(1)+'%','kills/fight',(k/f).toFixed(2),'ult dmg/cast',Math.round(ult/Math.max(1,casts)),'ult share',(100*ult/d).toFixed(0)+'%'); }
