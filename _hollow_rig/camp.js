const {load,spec}=require('./lib.js'); const L=load(); const ENC=require('../server/campaign-encounters.json');
const X=(process.argv[2]||'hollow,konwu,vulmar,aureth,hurne,veyr,kharos').split(',');
const P=JSON.parse(process.argv[3]); const nodes=process.argv[4].split(',').map(Number); const N=+(process.argv[5]||24);
const mates=(process.argv[6]||'grosk,vael,sylthaine,vireo').split(',');
const out={};
for(const x of X){ const team=[x,...mates]; const snaps=L.host.snapFromSpecs(team.map(k=>spec(k,P)));
  const A={fights:0,wins:0,dmg:0,team:0,kills:0,slots:{},casts:{}};
  for(const nd of nodes){ const st=ENC[nd-1];
    for(let i=0;i<N;i++){ L.reset(); const seed=(0x9e3779b1*(i+1)+nd*7919)>>>0;
      const r=L.host.campaign(JSON.parse(JSON.stringify(snaps)),st.waves,seed,[[1,'auto',-1,1]]);
      const rep=L.report().rows.filter(r=>r.team==='ally'); A.fights++; if(r.won)A.wins++;
      for(const rr of rep){ const d=Object.values(rr.dmg).reduce((a,b)=>a+b,0); A.team+=d;
        if(rr.key===x){ A.dmg+=d; A.kills+=rr.kills; for(const [s,v] of Object.entries(rr.dmg)) A.slots[s]=(A.slots[s]||0)+v; for(const [s,v] of Object.entries(rr.casts)) A.casts[s]=(A.casts[s]||0)+v; } } } }
  out[x]=A;
  const sl=Object.entries(A.slots).sort((a,b)=>b[1]-a[1]).map(([s,v])=>s+' '+(100*v/A.dmg).toFixed(0)+'%').join(', ');
  const cs=Object.entries(A.casts).map(([s,v])=>s+' '+(v/A.fights).toFixed(1)).join(', ');
  console.log(x.padEnd(8),'win',(100*A.wins/A.fights).toFixed(0)+'%','dmg/fight',Math.round(A.dmg/A.fights),'share',(100*A.dmg/A.team).toFixed(1)+'%','kills/fight',(A.kills/A.fights).toFixed(2),'| ult dmg/cast',Math.round(Object.entries(A.slots).filter(([k])=>k.startsWith('ult')).reduce((a,[,v])=>a+v,0)/Math.max(1,A.casts.ult||0)),'|',sl,'| casts/fight',cs);
}
require('fs').writeFileSync(__dirname+'/out-'+(process.argv[7]||'camp')+'.json',JSON.stringify(out));
