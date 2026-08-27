/* v266 — Emberweave_Exact_Glyph_Fragment_Farm_Map_v1, asserted exactly as the spec writes it.
   No server needed: this reads the three authored portal tables and the glyph catalog. */
const fs=require('fs'), path=require('path');
let PASS=0, FAIL=0;
const ck=(n,c,x)=>{ if(c){PASS++;console.log('  ✓ '+n);} else {FAIL++;console.log('  ✗ '+n+(x?' — '+x:''));} };
const load=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'server',f),'utf8'));
const slug=k=>k.toLowerCase().replace(/\s*\+\s*/g,'-plus-').replace(/\s+/g,'-');
const uniq=a=>new Set(a);

const normalStages=load('campaign-encounters.json');
const eliteStages=load('elite-campaign-encounters.json');
const veteranStages=load('veteran-campaign-encounters.json');
const fid=s=>s.rewards.glyphFragments[0].fragmentId;
const normalFragmentIds=normalStages.map(fid), eliteFragmentIds=eliteStages.map(fid), vetIds=veteranStages.map(fid);

console.log('== exact glyph fragment farm map v1 ==');
// the spec's own assertion block
ck('normalStages.length === 100', normalStages.length===100, String(normalStages.length));
ck('eliteStages.length === 100', eliteStages.length===100, String(eliteStages.length));
ck('every Normal stage names exactly ONE glyph fragment', normalStages.every(s=>s.rewards.glyphFragments.length===1));
ck('every Elite stage names exactly ONE glyph fragment', eliteStages.every(s=>s.rewards.glyphFragments.length===1));
ck('every Veteran stage names exactly ONE glyph fragment', veteranStages.every(s=>s.rewards.glyphFragments.length===1));
ck('unique(normalFragmentIds).size === 100', uniq(normalFragmentIds).size===100, String(uniq(normalFragmentIds).size));
ck('unique(eliteFragmentIds).size === 100', uniq(eliteFragmentIds).size===100, String(uniq(eliteFragmentIds).size));
ck('intersection(normal, elite) === 0', normalFragmentIds.filter(x=>eliteFragmentIds.includes(x)).length===0,
  normalFragmentIds.filter(x=>eliteFragmentIds.includes(x)).slice(0,4).join(','));
ck('veteranOrangeFragmentIds.size === 18', uniq(vetIds).size===18, String(uniq(vetIds).size));
ck('every Veteran fragment is Orange', veteranStages.every(s=>s.rewards.glyphFragments[0].key.startsWith('Orange ')));

// the catalog is fully covered, and nothing is farmed twice
const raw=Object.values(require('./server/glyph-source.json'));
const catalog=new Set();
for(const d of raw){ const m=/(\w+)\s+(Glyph|Core|Crown)$/.exec(d.name); if(m) catalog.add(slug(d.quality+' '+m[1])); }
const all=[...normalFragmentIds,...eliteFragmentIds,...vetIds];
ck('the catalog defines 218 raw fragment families', catalog.size===218, String(catalog.size));
ck('allGlyphFragmentIds.size === 218', uniq(all).size===218, String(uniq(all).size));
ck('every fragment has at least one source', [...catalog].every(c=>all.includes(c)),
  [...catalog].filter(c=>!all.includes(c)).slice(0,5).join(', '));
ck('no fragment has more than ONE source', all.length===uniq(all).size,
  all.filter((x,i)=>all.indexOf(x)!==i).slice(0,5).join(', '));

// the positional map itself — spot-checks straight out of the spec's own examples
const nAt=id=>normalStages.find(s=>s.id===id).rewards.glyphFragments[0].key;
const eAt=id=>eliteStages.find(s=>s.id===id).rewards.glyphFragments[0].key;
ck('spec example: Normal 1-5 drops Green Stoneheart', nAt('1-5')==='Green Stoneheart', nAt('1-5'));
ck('spec example: Normal 1-10 drops Green Windstep', nAt('1-10')==='Green Windstep', nAt('1-10'));
ck('Normal 1-1 drops Grey Stoneheart', nAt('1-1')==='Grey Stoneheart', nAt('1-1'));
ck('Normal 10-10 drops Gold +4 Bloodroot', nAt('10-10')==='Gold +4 Bloodroot', nAt('10-10'));
ck('Elite 1-1 drops Grey Windstep', eAt('1-1')==='Grey Windstep', eAt('1-1'));
ck('Elite 10-10 drops Gold +4 Voidbind', eAt('10-10')==='Gold +4 Voidbind', eAt('10-10'));
ck('Veteran 1-1 drops Orange Stoneheart', veteranStages[0].rewards.glyphFragments[0].key==='Orange Stoneheart');
ck('Veteran 2-8 drops Orange Cataclysm', veteranStages[17].rewards.glyphFragments[0].key==='Orange Cataclysm');

// no Normal/Elite stage may quietly show unrelated families, and a boss may only give MORE of its own
ck('a boss stage grants extra copies of ITS OWN named fragment, never a different one',
  normalStages.filter(s=>s.node%10===0).every(s=>s.rewards.glyphFragments.length===1 && s.rewards.glyphFragments[0].quantity===2));
ck('Elite Portal is a stronger fixed version of the matching Normal stage',
  eliteStages.every((e,i)=>e.id===normalStages[i].id && e.waves.length===normalStages[i].waves.length
    && e.waves[0][0].hpMul>normalStages[i].waves[0][0].hpMul));
ck('Elite never randomises: every wave keeps the Normal stage line-up',
  eliteStages.every((e,i)=>JSON.stringify(e.waves.map(w=>w.map(m=>m.key)))===JSON.stringify(normalStages[i].waves.map(w=>w.map(m=>m.key)))));
ck('every stage record carries its portal mode', normalStages.every(s=>s.portalMode==='normal')
  && eliteStages.every(s=>s.portalMode==='elite') && veteranStages.every(s=>s.portalMode==='veteran'));

console.log(''); console.log('PASS: '+PASS+'  FAIL: '+FAIL);
process.exit(FAIL?1:0);
