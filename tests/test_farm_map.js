/* v266 — Emberweave_Exact_Glyph_Fragment_Farm_Map_v1, asserted exactly as the spec writes it.
   No server needed: this reads the three authored portal tables and the glyph catalog. */
const fs=require('fs'), path=require('path');
let PASS=0, FAIL=0;
const ck=(n,c,x)=>{ if(c){PASS++;console.log('  ✓ '+n);} else {FAIL++;console.log('  ✗ '+n+(x?' — '+x:''));} };
const load=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','server',f),'utf8'));
const slug=k=>k.toLowerCase().replace(/\s*\+\s*/g,'-plus-').replace(/\s+/g,'-');
const uniq=a=>new Set(a);

const normalStages=load('campaign-encounters.json');
const eliteStages=load('elite-campaign-encounters.json');
const veteranStages=load('veteran-campaign-encounters.json');
const fid=s=>s.rewards.glyphFragments[0].fragmentId;
const ordinaryNormal=normalStages.filter(s=>![3,6,9,0].includes(s.node%10));
const normalFragmentIds=ordinaryNormal.flatMap(s=>s.rewards.glyphFragments.map(f=>f.fragmentId));
const eliteFragmentIds=eliteStages.map(fid), vetIds=veteranStages.map(fid);

console.log('== exact glyph fragment farm map v1 ==');
// the spec's own assertion block
ck('normalStages.length === 160 (16 chapters, v821)', normalStages.length===160, String(normalStages.length));
ck('eliteStages.length === 100', eliteStages.length===100, String(eliteStages.length));
ck('every ordinary Normal stage offers four distinct glyph fragments and rolls two', ordinaryNormal.every(s=>s.rewards.glyphFragments.length===4
  && new Set(s.rewards.glyphFragments.map(f=>f.key)).size===4 && s.rewards.fragmentRolls===2));
ck('Guardian and boss Normal stages keep one fixed glyph fragment', normalStages.filter(s=>[3,6,9,0].includes(s.node%10)).every(s=>s.rewards.glyphFragments.length===1));
ck('every Elite stage awards two of one named Glyph Fragment', eliteStages.every(s=>s.rewards.glyphFragments.length===1&&s.rewards.glyphFragments[0].quantity===2));
const eliteHeroStages=eliteStages.filter(s=>s.rewardHero);
ck('four selected Elite stages per chapter reward heroes', eliteHeroStages.length===40
  &&eliteHeroStages.every(s=>[1,4,7,0].includes(s.node%10)));
ck('every hero-reward Elite stage fights its authored hero', eliteHeroStages.every(s=>
  s.waves[s.waves.length-1].some(m=>m.isHero&&m.rewardHero&&m.key===s.rewardHero)));
ck('1-star rewards run through 2-1 and 2-star rewards begin at 2-4',
  eliteStages.find(s=>s.id==='2-1').rewardHero==='tick'&&['fritz','rhukk'].includes(eliteStages.find(s=>s.id==='2-4').rewardHero));
ck('every Veteran stage names exactly ONE glyph fragment', veteranStages.every(s=>s.rewards.glyphFragments.length===1));
ck('ordinary Normal pools cover all 218 fragment types', uniq(normalFragmentIds).size===218, String(uniq(normalFragmentIds).size));
ck('unique(eliteFragmentIds).size === 100', uniq(eliteFragmentIds).size===100, String(uniq(eliteFragmentIds).size));
ck('every Elite fragment also has an ordinary Normal home', eliteFragmentIds.every(x=>normalFragmentIds.includes(x)));
ck('veteranOrangeFragmentIds.size === 18', uniq(vetIds).size===18, String(uniq(vetIds).size));
ck('every Veteran fragment is Orange', veteranStages.every(s=>s.rewards.glyphFragments[0].key.startsWith('Orange ')));

// the catalog is fully covered by ordinary Normal stages; Elite/Veteran remain alternate sources
const raw=Object.values(require('../server/glyph-source.json'));
const catalog=new Set();
for(const d of raw){ if(d.family) catalog.add(slug(d.quality+' '+d.family)); }
const all=[...normalFragmentIds,...eliteFragmentIds,...vetIds];
ck('the catalog defines 218 raw fragment families', catalog.size===218, String(catalog.size));
ck('allGlyphFragmentIds.size === 218', uniq(all).size===218, String(uniq(all).size));
ck('every fragment has at least one source', [...catalog].every(c=>all.includes(c)),
  [...catalog].filter(c=>!all.includes(c)).slice(0,5).join(', '));
ck('all 96 ordinary Normal stages are used (16 chapters x 6)', ordinaryNormal.length===96, String(ordinaryNormal.length));

// the positional map itself — spot-checks straight out of the spec's own examples
const nAt=id=>normalStages.find(s=>s.id===id).rewards.glyphFragments[0].key;
const eAt=id=>eliteStages.find(s=>s.id===id).rewards.glyphFragments[0].key;
ck('Normal 1-1 begins the progression-ordered ordinary pools', nAt('1-1')==='Grey Stoneheart', nAt('1-1'));
ck('Elite 1-1 drops Grey Windstep', eAt('1-1')==='Grey Windstep', eAt('1-1'));
ck('Elite 10-10 drops Gold +4 Voidbind', eAt('10-10')==='Gold +4 Voidbind', eAt('10-10'));
ck('Veteran 1-1 drops Orange Stoneheart', veteranStages[0].rewards.glyphFragments[0].key==='Orange Stoneheart');
ck('Veteran 2-8 drops Orange Cataclysm', veteranStages[17].rewards.glyphFragments[0].key==='Orange Cataclysm');

// fixed Guardian/boss Normal rewards and the stronger Elite variant
ck('a boss stage grants extra copies of its fixed named fragment',
  normalStages.filter(s=>s.node%10===0).every(s=>s.rewards.glyphFragments.length===1 && s.rewards.glyphFragments[0].quantity===2));
ck('Elite Portal is a stronger fixed version of the matching Normal stage',
  eliteStages.every((e,i)=>e.id===normalStages[i].id && e.waves.length===normalStages[i].waves.length
    && e.waves[0][0].hpMul>normalStages[i].waves[0][0].hpMul));
ck('Elite keeps the Normal wave sizes while replacing one final-wave enemy with its reward hero',
  eliteStages.every((e,i)=>e.waves.every((w,wi)=>w.length===normalStages[i].waves[wi].length)));
ck('every stage record carries its portal mode', normalStages.every(s=>s.portalMode==='normal')
  && eliteStages.every(s=>s.portalMode==='elite') && veteranStages.every(s=>s.portalMode==='veteran'));

console.log(''); console.log('PASS: '+PASS+'  FAIL: '+FAIL);
process.exit(FAIL?1:0);
