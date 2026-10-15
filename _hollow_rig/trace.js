const {load,spec}=require('./lib.js'); const vm=require('vm'); const L=load(); const S=L.S;
const P=JSON.parse(process.argv[2]); const y=process.argv[3]||'konwu'; const mates=['grosk','vael','sylthaine','vireo'];
const mk=k=>L.host.snapFromSpecs([k,...mates].map(z=>spec(z,P)));
const og=S.updateBattle; let log=[], prev={};
S.updateBattle=function(dt){ const r=og.apply(this,arguments); const us=vm.runInContext('units',L.ctx), t=vm.runInContext('battleTime',L.ctx);
  for(const u of us){ const id=u.team+':'+u.key; const st=(u.alive?'A':'D')+(u._dropHidden?'H':'')+(u._noTarget?'N':'');
    if(prev[id]!==st){ log.push(t.toFixed(1)+' '+id+' '+st+' hp'+Math.round(u.hp)); prev[id]=st; } } return r; };
for(const seed of [111,222]){ log=[]; prev={}; const r=L.host.auto(mk('hollow'),mk(y),seed); console.log('seed',seed,'hollow-team won',r.won); console.log(log.join('\n')); }
