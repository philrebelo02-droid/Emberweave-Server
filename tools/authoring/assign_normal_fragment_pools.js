/* Put every catalog Glyph Fragment into ordinary Normal campaign stages.
   Eligible stages are x-1/x-2/x-4/x-5/x-7/x-8: 60 stages total. Each receives four distinct,
   progression-ordered possibilities and pays two distinct random fragments per run. */
const fs=require('fs'), path=require('path');
const LADDER=['Grey','Green','Green +1','Blue','Blue +1','Blue +2','Purple','Purple +1','Purple +2',
  'Purple +3','Gold','Gold +1','Gold +2','Gold +3','Gold +4','Orange'];
const slug=k=>k.toLowerCase().replace(/\s*\+\s*/g,'-plus-').replace(/\s+/g,'-');
const eligible=node=>![3,6,9,10].includes(((node-1)%10)+1);
const frag=key=>({fragmentId:slug(key),key,displayName:key+' Fragment',quantity:1,possible:true});

function assignNormalFragmentPools(stages,catalog){
  const keys=catalog.slice().sort((a,b)=>LADDER.indexOf(a.quality)-LADDER.indexOf(b.quality)||a.id.localeCompare(b.id))
    .map(g=>g.quality+' '+g.family);
  const homes=stages.filter(e=>eligible(e.node));
  if(keys.length!==218||homes.length!==60) throw new Error('expected 218 fragment types and 60 ordinary stages');
  const pools=Array.from({length:homes.length},()=>[]);
  keys.forEach((key,i)=>pools[Math.min(homes.length-1,Math.floor(i*homes.length/keys.length))].push(key));
  for(let s=0;s<pools.length;s++){
    let probe=Math.min(keys.length-1,Math.floor((s+0.5)*keys.length/pools.length));
    while(pools[s].length<4){ while(pools[s].includes(keys[probe])) probe=(probe+1)%keys.length; pools[s].push(keys[probe]); }
    if(pools[s].length!==4||new Set(pools[s]).size!==4) throw new Error(homes[s].id+': pool is not four distinct fragments');
    homes[s].rewards.glyphFragments=pools[s].map(frag);
    homes[s].rewards.fragmentRolls=2;
    homes[s].farmFragments=pools[s].map(slug);
    homes[s].farmFragment=homes[s].farmFragments[0];
  }
  return stages;
}

module.exports={assignNormalFragmentPools,eligible,LADDER};
if(require.main===module){
  const root=path.join(__dirname,'../..'), p=path.join(root,'server','campaign-encounters.json');
  const stages=JSON.parse(fs.readFileSync(p,'utf8'));
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'server','glyph-source.json'),'utf8'));
  assignNormalFragmentPools(stages,catalog);
  fs.writeFileSync(p,JSON.stringify(stages,null,1));
  console.log('assigned all '+catalog.length+' fragment types to four-choice pools on 60 ordinary Normal stages');
}
