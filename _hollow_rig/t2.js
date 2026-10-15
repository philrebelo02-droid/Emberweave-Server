const {load,spec}=require('./lib.js'); const L=load(); const ENC=require('../server/campaign-encounters.json');
for(const x of ['hollow','hurne','vulmar','aureth']){ const snaps=L.host.snapFromSpecs([x,'grosk','vael','sylthaine','vireo'].map(k=>spec(k,{level:60,stars:4,glyphRank:6,skillLv:[40,40,40,40]})));
 L.reset(); const r=L.host.campaign(snaps,ENC[59].waves,12345,[[1,'auto',-1,1]]); const rep=L.report();
 const tot=rep.rows.reduce((a,r)=>a+Object.values(r.dmg).reduce((p,q)=>p+q,0),0);
 console.log(x,r.won,'attrib',Math.round(tot),'unattrib',Math.round(rep.unattrib),'unkKills',L.S.__T.unk, rep.rows.map(r=>r.key+':'+r.team[0]+':'+Math.round(Object.values(r.dmg).reduce((p,q)=>p+q,0))).join(' ')); }
