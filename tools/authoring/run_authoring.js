/* Re-author every portal against the real battle engine (v270). */
const fs=require('fs'), path=require('path');
const A=require('./author_campaign_real.js');
const dir=path.join(__dirname,'../..','server');
const t0=Date.now();

function tuneFile(file, opts){
  const enc=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
  const out=[]; const rows=[];
  for(let i=0;i<enc.length;i++){
    const st=enc[i]; const s=(opts.nodeOf?opts.nodeOf(st,i):(st.node||i+1));
    const b=A.tuneStage(st, s, {tierShift:opts.tierShift||0, target:opts.target?opts.target(s):undefined});
    const scaled=Object.assign({}, st, { waves:A.scaleWaves(st.waves, b.d),
      difficultyTune:+((st.difficultyTune||1)*b.d).toFixed(4), realEngineTuned:true });
    out.push(scaled);
    rows.push({id:st.id, d:+b.d.toFixed(3), hp:+b.eff.toFixed(3), wins:b.m.wins, target:+(opts.target?opts.target(s):A.targetHpFrac(s)).toFixed(3)});
    if((i+1)%10===0) console.log('  '+file+' '+(i+1)+'/'+enc.length+'  ('+Math.round((Date.now()-t0)/1000)+'s)');
  }
  return {out, rows};
}

const norm=tuneFile('campaign-encounters.json', {});
fs.writeFileSync(path.join(dir,'campaign-encounters.json'), JSON.stringify(norm.out,null,1));
const misses=norm.rows.filter(r=>r.wins<3);
console.log('NORMAL: stages', norm.rows.length, 'unwinnable at target:', misses.length);
const hps=norm.rows.map(r=>r.hp).sort((a,b)=>a-b);
console.log('  HP-remaining median', hps[Math.floor(hps.length/2)].toFixed(2), 'p25', hps[Math.floor(hps.length*0.25)].toFixed(2), 'p75', hps[Math.floor(hps.length*0.75)].toFixed(2));
fs.writeFileSync('/tmp/author_rows.json', JSON.stringify(norm.rows,null,1));
console.log('done in', Math.round((Date.now()-t0)/1000)+'s');
