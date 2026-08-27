/* Veteran: the Orange set, tuned by fighting it with a maxed line in the real engine. */
const fs=require('fs'), path=require('path');
const A=require('./author_campaign_real.js');
const dir=path.join(__dirname,'server');
const vet=JSON.parse(fs.readFileSync(path.join(dir,'veteran-campaign-encounters.json'),'utf8'));
const maxed=()=>A.referenceSpecs(100);            // level 100, Orange board, 5★
const out=[]; const rows=[];
for(let i=0;i<vet.length;i++){
  const st=vet[i];
  const b=A.tuneStage(st, 100, {target:0.40});
  out.push(Object.assign({}, st, { waves:A.scaleWaves(st.waves,b.d),
    difficultyTune:+((st.difficultyTune||1)*b.d).toFixed(4), realEngineTuned:true }));
  rows.push({id:st.id, d:+b.d.toFixed(3), hp:+b.eff.toFixed(2), wins:b.m.wins});
  console.log('  veteran '+st.id+'  d '+b.d.toFixed(3)+'  hp '+b.eff.toFixed(2)+'  wins '+b.m.wins+'/3');
}
fs.writeFileSync(path.join(dir,'veteran-campaign-encounters.json'), JSON.stringify(out,null,1));
console.log('VETERAN: '+out.length+' stages tuned; unwinnable at target: '+rows.filter(r=>r.wins<3).length);
