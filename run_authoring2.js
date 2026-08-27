/* Elite = the same authored stage, harder by a fixed factor (test_farm_map asserts the relationship).
   Veteran = the Orange set, tuned against a level-100 Orange reference line. */
const fs=require('fs'), path=require('path');
const A=require('./author_campaign_real.js');
const dir=path.join(__dirname,'server');
const ELITE_MUL=1.25;   // v270: measured against the real engine — a line ~8 levels and one ladder tier ahead clears ~70% of Elite stages on AUTO, and manual play does better
const norm=JSON.parse(fs.readFileSync(path.join(dir,'campaign-encounters.json'),'utf8'));
const elite=JSON.parse(fs.readFileSync(path.join(dir,'elite-campaign-encounters.json'),'utf8'));
const out=elite.map((st,i)=>{
  const n=norm[i]; if(!n) return st;
  const waves=n.waves.map(w=>w.map(m=>Object.assign({},m,{
    hpMul:+(m.hpMul*ELITE_MUL).toFixed(4), dmgMul:+(m.dmgMul*Math.pow(ELITE_MUL,0.7)).toFixed(4) })));
  return Object.assign({}, st, { waves, difficultyTune:+((n.difficultyTune||1)*ELITE_MUL).toFixed(4), realEngineTuned:true });
});
fs.writeFileSync(path.join(dir,'elite-campaign-encounters.json'), JSON.stringify(out,null,1));
console.log('ELITE rebuilt from the new Normal ×'+ELITE_MUL);
// sanity: can a line ONE TIER ahead clear elite?
let wins=0; const sample=[1,10,25,50,75,100];
for(const s of sample){ const st=out[s-1]; const specs=A.referenceSpecs(s,1);
  const r=A.fight(specs, st.waves, 1111); if(r.won) wins++;
  console.log('  elite '+st.id+' vs a line one tier ahead:', r.won?('won, hp '+r.hpFrac.toFixed(2)):'lost'); }
console.log('elite sample cleared '+wins+'/'+sample.length);
