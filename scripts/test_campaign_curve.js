/* v257 — the authored campaign curve (Phil, 27 Aug). No server needed: this reads the authored
   data and the shared combat core and proves the ramp is real, not asserted. */
const fs=require('fs'), path=require('path');
const SIM=require('./server/sim.js');
let PASS=0, FAIL=0;
const ck=(name,cond,extra)=>{ if(cond){PASS++;console.log('  ✓ '+name);} else {FAIL++;console.log('  ✗ '+name+(extra?' — '+extra:''));} };

const C=JSON.parse(fs.readFileSync(path.join(__dirname,'server','campaign-encounters.json'),'utf8'));
const stages=Object.keys(C).map(k=>C[k]).sort((a,b)=>a.node-b.node);
console.log('== campaign curve (v257) ==');
ck('the campaign authors 11 chapters × 10 stages', stages.length===110, 'got '+stages.length);
ck('every stage has a node, waves and an authored fragment target',
  stages.every(e=>e.node&&Array.isArray(e.waves)&&e.waves.length&&(e.rewards.glyphFragments||[]).length));

// hero XP is exactly 10× player XP, on first clears AND on repeats (which sweeps pay)
ck('hero XP is 10× player XP on first clear', stages.every(e=>e.rewards.heroXpFirst===e.rewards.playerXpFirst*10));
ck('hero XP is 10× player XP on repeats and sweeps', stages.every(e=>e.rewards.heroXpRepeat===e.rewards.playerXpRepeat*10));
ck('hero XP actually scales with the stage (it is no longer a flat 60)',
  stages[109].rewards.heroXpFirst > stages[0].rewards.heroXpFirst*50);

// the ramp: target level and target glyph tier both rise, and never fall
const LADDER=['None','Grey','Green','Green +1','Blue','Blue +1','Blue +2','Purple','Purple +1','Purple +2','Purple +3','Gold','Gold +1','Gold +2','Gold +3','Gold +4','Orange'];
const lv=stages.map(e=>e.targetLevel|0), ti=stages.map(e=>LADDER.indexOf(e.targetGlyph));
ck('every stage declares the level it is built for', lv.every(v=>v>=1&&v<=70));
ck('every stage declares the glyph board it is built for', ti.every(v=>v>=0));
ck('the target level never goes backwards', lv.every((v,i)=>i===0||v>=lv[i-1]));
ck('the target glyph tier never goes backwards', ti.every((v,i)=>i===0||v>=ti[i-1]));
ck('recommended power never goes backwards', stages.every((e,i)=>i===0||e.recommendedPower>=stages[i-1].recommendedPower));

// Phil's named chapter gates
const at=(id)=>stages.find(e=>e.id===id);
const gate=(id,q)=>ck('stage '+id+' is built for a '+q+' board', at(id).targetGlyph===q, 'got '+at(id).targetGlyph);
ck('1-1-to-1-3 need NO glyphs (a new account owns none)',
  ['1-1','1-2','1-3'].every(id=>at(id).targetGlyph==='None'), JSON.stringify(['1-1','1-2','1-3'].map(id=>at(id).targetGlyph)));
gate('1-10','Green'); gate('2-10','Green +1'); gate('3-10','Blue'); gate('4-5','Blue +1');
gate('4-10','Blue +2'); gate('5-10','Purple'); gate('6-10','Purple +1'); gate('7-10','Purple +3');
gate('8-5','Gold'); gate('9-10','Gold +1'); gate('10-10','Gold +3'); gate('11-10','Orange');

// chapter 11 brings every Orange family into the campaign
const FAMS=['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep','Hawkeye','Lifebloom',
  'Shadepath','Sunder','Bastion','Voidbind','Bloodroot','Tidecall','Dawnshield','Keenmind','Cataclysm','Worldheart'];
const orange=new Set();
stages.forEach(e=>e.rewards.glyphFragments.forEach(f=>{ if(f.key.startsWith('Orange ')) orange.add(f.key.slice(7)); }));
ck('chapter 11 makes all 18 Orange fragment families campaign-farmable', FAMS.every(f=>orange.has(f)),
  'missing '+FAMS.filter(f=>!orange.has(f)).join(','));

// the enemies really do get harder — monster level and scalars rise across the campaign
const scal=stages.map(e=>e.waves[0][0].hpMul||1), mlv=stages.map(e=>e.waves[0][0].lvl|0);
ck('enemy level rises across the campaign', mlv[109]>mlv[0]+40, mlv[0]+' -> '+mlv[109]);
ck('enemy scaling rises across the campaign', scal[109]>scal[0]*20, scal[0]+' -> '+scal[109]);
ck('1-4 is not a difficulty cliff (the 4th hero arrives there)', scal[3]<scal[9], scal[3]+' vs '+scal[9]);

console.log(''); console.log('PASS: '+PASS+'  FAIL: '+FAIL);
process.exit(FAIL?1:0);
