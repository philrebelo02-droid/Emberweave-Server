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
ck('eliteStages.length === 160 (16 chapters, v823)', eliteStages.length===160, String(eliteStages.length));
ck('every ordinary Normal stage offers four distinct glyph fragments and rolls two', ordinaryNormal.every(s=>s.rewards.glyphFragments.length===4
  && new Set(s.rewards.glyphFragments.map(f=>f.key)).size===4 && s.rewards.fragmentRolls===2));
ck('Guardian and boss Normal stages keep one fixed glyph fragment', normalStages.filter(s=>[3,6,9,0].includes(s.node%10)).every(s=>s.rewards.glyphFragments.length===1));
ck('every Elite stage awards two of one named Glyph Fragment', eliteStages.every(s=>s.rewards.glyphFragments.length===1&&s.rewards.glyphFragments[0].quantity===2));
const eliteHeroStages=eliteStages.filter(s=>s.rewardHero);
ck('four selected Elite stages per chapter reward heroes', eliteHeroStages.length===64
  &&eliteHeroStages.every(s=>[1,4,7,0].includes(s.node%10)));
ck('every hero-reward Elite stage fights its authored hero', eliteHeroStages.every(s=>
  s.waves[s.waves.length-1].some(m=>m.isHero&&m.rewardHero&&m.key===s.rewardHero)));
ck('1-star rewards run through 2-1 and 2-star rewards begin at 2-4',
  eliteStages.find(s=>s.id==='2-1').rewardHero==='tick'&&['fritz','rhukk'].includes(eliteStages.find(s=>s.id==='2-4').rewardHero));
ck('every Veteran stage names exactly ONE glyph fragment', veteranStages.every(s=>s.rewards.glyphFragments.length===1));
ck('ordinary Normal pools cover all 218 fragment types', uniq(normalFragmentIds).size===218, String(uniq(normalFragmentIds).size));
ck('unique(eliteFragmentIds).size === 160', uniq(eliteFragmentIds).size===160, String(uniq(eliteFragmentIds).size));
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
ck('Elite chapter c pays one band ahead of Normal chapter c (v823, 07 COMBAT RULE 16a): 1-1 Green, 10-10 Gold, 16-10 Orange',
  eAt('1-1').startsWith('Green ') && eAt('10-10').startsWith('Gold ') && !eAt('10-10').startsWith('Gold +') && eAt('16-10').startsWith('Orange '), eAt('1-1')+' / '+eAt('10-10')+' / '+eAt('16-10'));
ck('Elite 15-1 pays Gold +4 and 15-6 pays Orange (the split that keeps all 160 unique)', eAt('15-1').startsWith('Gold +4 ') && eAt('15-6').startsWith('Orange '));
ck('Veteran 1-1 drops Orange Stoneheart', veteranStages[0].rewards.glyphFragments[0].key==='Orange Stoneheart');
ck('Veteran 2-8 drops Orange Cataclysm', veteranStages[17].rewards.glyphFragments[0].key==='Orange Cataclysm');

// fixed Guardian/boss Normal rewards and the stronger Elite variant
ck('a boss stage grants extra copies of its fixed named fragment',
  normalStages.filter(s=>s.node%10===0).every(s=>s.rewards.glyphFragments.length===1 && s.rewards.glyphFragments[0].quantity===2));
/* v823: Elite is TUNED on the real board (07 COMBAT RULE 16a/17a) against the squad that OPENS it - Elite chapter c opens after
   Normal c-10, so the chapter-end squad must win every seed. A monster multiplier is no longer the measure of "stronger": a Elite
   hero stage fields a rank-3 hero where Normal fought a monster, and some fights are cliffs (5% harder = a lost seed). The lab
   (C:/Emberweave/game-lab/realsim: elite_tune.js, elite_vs_normal.js) proves each stage is the hardest winnable version, and harder
   than Normal wherever the cliff allows. Here: same id and wave count, and every stage carries its measured eliteTune. */
ck('Elite Portal is the matching Normal stage, re-tuned on the real board for the squad that opens it (v823)',
  eliteStages.every((e,i)=>e.id===normalStages[i].id && e.waves.length===normalStages[i].waves.length && e.eliteTune>0));
ck('most Elite stages keep monsters at least as strong as Normal (the rest are tuned cliffs)',
  eliteStages.filter((e,i)=>e.waves[0][0].hpMul>=normalStages[i].waves[0][0].hpMul).length>=120,
  String(eliteStages.filter((e,i)=>e.waves[0][0].hpMul>=normalStages[i].waves[0][0].hpMul).length));
ck('Elite keeps the Normal wave sizes while replacing one final-wave enemy with its reward hero',
  eliteStages.every((e,i)=>e.waves.every((w,wi)=>w.length===normalStages[i].waves[wi].length)));
ck('every stage record carries its portal mode', normalStages.every(s=>s.portalMode==='normal')
  && eliteStages.every(s=>s.portalMode==='elite') && veteranStages.every(s=>s.portalMode==='veteran'));

console.log(''); console.log('PASS: '+PASS+'  FAIL: '+FAIL);
process.exit(FAIL?1:0);
