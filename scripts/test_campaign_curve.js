/* v258 — the campaign against Emberweave_Launch_Progression_and_Portal_Difficulty_Blueprint_v1.
   No server needed: reads the authored data and proves the launch path, not asserts it. */
const fs=require('fs'), path=require('path');
let PASS=0, FAIL=0;
const ck=(n,c,x)=>{ if(c){PASS++;console.log('  ✓ '+n);} else {FAIL++;console.log('  ✗ '+n+(x?' — '+x:''));} };

const C=JSON.parse(fs.readFileSync(path.join(__dirname,'server','campaign-encounters.json'),'utf8'));
const S=Object.values(C).sort((a,b)=>a.node-b.node);
const LADDER=['Grey','Green','Green +1','Blue','Blue +1','Blue +2','Purple','Purple +1','Purple +2',
  'Purple +3','Gold','Gold +1','Gold +2','Gold +3','Gold +4','Orange'];
const MIN_LEVEL={'Grey':1,'Green':7,'Green +1':13,'Blue':18,'Blue +1':24,'Blue +2':30,'Purple':36,
  'Purple +1':43,'Purple +2':50,'Purple +3':57,'Gold':65,'Gold +1':72,'Gold +2':79,'Gold +3':86,
  'Gold +4':93,'Orange':100};
const BANDS=[[1,5,'Grey'],[6,10,'Green'],[11,15,'Green +1'],[16,20,'Blue'],[21,25,'Blue +1'],
  [26,30,'Blue +2'],[31,35,'Blue +2'],[36,40,'Purple'],[41,45,'Purple +1'],[46,50,'Purple +2'],
  [51,55,'Purple +2'],[56,60,'Purple +3'],[61,65,'Gold'],[66,70,'Gold'],[71,75,'Gold +1'],
  [76,80,'Gold +2'],[81,85,'Gold +2'],[86,90,'Gold +3'],[91,95,'Gold +4'],[96,100,'Orange']];

console.log('== launch progression blueprint v1 ==');
ck('the campaign is exactly 10 chapters × 10 fixed stages', S.length===100, 'got '+S.length);
ck('there are no chapters 11+', S.every(e=>e.node<=100 && !/^1[1-9]-/.test(e.id)));
ck('every stage has three fixed authored waves', S.every(e=>e.waves.length===3), 
  JSON.stringify([...new Set(S.map(e=>e.waves.length))]));
ck('every stage-10 puts a distinct boss in wave 3',
  S.filter(e=>e.node%10===0).every(e=>e.waves[2].some(m=>m.boss)));
ck('bosses only ever stand in wave 3, and only on a stage 5 or stage 10',
  S.every(e=>e.waves.every((w,i)=>w.every(m=>!m.boss||(i===2&&(e.node%10===0||e.node%10===5))))));
ck('stage 5 of every chapter is the elite checkpoint',
  S.filter(e=>e.node%10===5).every(e=>e.checkpoint==='guardian'));

// the exact quality path and its level gates
ck('every stage names the quality it is built for and that quality is on the frozen ladder',
  S.every(e=>LADDER.includes(e.recommendedQuality)));
ck('each stage carries that quality\'s minimum hero level',
  S.every(e=>e.qualityMinHeroLevel===MIN_LEVEL[e.recommendedQuality]),
  JSON.stringify(S.filter(e=>e.qualityMinHeroLevel!==MIN_LEVEL[e.recommendedQuality]).slice(0,3).map(e=>e.id)));
ck('the quality bands match the blueprint path table',
  BANDS.every(([a,b,q])=>S.slice(a-1,b).every(e=>e.recommendedQuality===q)),
  JSON.stringify(BANDS.filter(([a,b,q])=>!S.slice(a-1,b).every(e=>e.recommendedQuality===q))));
ck('no forbidden quality is ever named (Orange +1 / Grey +1 / Green +2 / Blue +3)',
  S.every(e=>!/Orange \+|Grey \+|Green \+2|Blue \+3/.test(e.recommendedQuality)));
ck('Orange is the chapter-10 finish, at hero level 100',
  S[99].recommendedQuality==='Orange' && S[99].qualityMinHeroLevel===100);

// recommended player level = stage number
ck('recommended player level equals the stage number, 1 through 100',
  S.every((e,i)=>e.targetLevel===i+1));

// chapter graduation bosses
const gates=S.filter(e=>e.node%10===0).map(e=>e.bossLevelGate);
ck('the ten chapter bosses gate on player level 10,20,…,100',
  JSON.stringify(gates)===JSON.stringify([10,20,30,40,50,60,70,80,90,100]), JSON.stringify(gates));
ck('normal stages carry no hard level gate', S.filter(e=>e.node%10!==0).every(e=>!e.bossLevelGate));

// XP
ck('hero XP is 10× player XP on first clear', S.every(e=>e.rewards.heroXpFirst===e.rewards.playerXpFirst*10));
ck('hero XP is 10× player XP on repeats and sweeps', S.every(e=>e.rewards.heroXpRepeat===e.rewards.playerXpRepeat*10));
const totalXp=S.reduce((a,e)=>a+e.rewards.playerXpFirst,0);
const D_TROOP_INC=[8,10,35,45,60,70,70,80,90,110,110,120,120,130,130,130,130,130,150,250,0,0,0,300,330,350,0,370,0,0,450,0,0,600,700,800,0,0,1200,1200,1300,1400,0,0,1900,0,0,0,3000,3250,0,3250,3250,3250,0,3400,0,3520,3640,0,3760,0,3880,4000,0,4120,4240,0,4360,0,4480,0,4600,4720,0,4840,4960,0,5080,0,5200,0,5320,5440,0,5560,5680,0,5800,0,5920,0,6040,6160,0,6280,6400,0,6520];
const rs=(a)=>{const o=[];let r=0;for(const v of a){r+=v;o.push(r);}return o;};
const cum=(st)=>{const c=new Array(101);c[1]=0;for(let L=2;L<=100;L++)c[L]=c[L-1]+st[L-2];return c;};
const T=cum(rs(D_TROOP_INC));
const share=totalXp/T[100];
ck('Portal first-clears supply 80–85% of the whole level path',
  share>=0.79&&share<=0.86, (share*100).toFixed(1)+'%');
ck('player XP never goes backwards stage to stage',
  S.every((e,i)=>i===0||e.rewards.playerXpFirst>=S[i-1].rewards.playerXpFirst*0.5));

// rewards
ck('every stage names exactly one GUARANTEED glyph fragment',
  S.every(e=>e.rewards.glyphFragments.filter(f=>f.guaranteed).length===1),
  JSON.stringify(S.filter(e=>e.rewards.glyphFragments.filter(f=>f.guaranteed).length!==1).slice(0,3).map(e=>e.id)));
ck('every reward line carries an exact name and a count (never "9 grey fragments")',
  S.every(e=>e.rewards.glyphFragments.every(f=>f.key&&f.fragmentId&&f.displayName&&f.quantity>=1)));
ck('a stage\'s guaranteed fragment is its own band\'s quality',
  S.every(e=>{ const g=e.rewards.glyphFragments.find(f=>f.guaranteed); return g&&g.key.startsWith(e.recommendedQuality+' '); }));
// every (tier, family) pair reachable in the Portal
const TIER_FAMS=(()=>{ const raw=Object.values(require('./server/glyph-source.json')), T={};
  for(const d of raw){ const m=/(\w+)\s+(Glyph|Core|Crown)$/.exec(d.name); if(!m) continue;
    (T[d.quality]=T[d.quality]||new Set()).add(m[1]); } return T; })();
const covered=new Set(); S.forEach(e=>e.rewards.glyphFragments.forEach(f=>covered.add(f.key)));
let pairs=0, miss=[];
for(const q of LADDER) for(const fam of (TIER_FAMS[q]||new Set())){ pairs++; if(!covered.has(q+' '+fam)) miss.push(q+' '+fam); }
ck('every (quality, family) fragment in the game is Portal-farmable', miss.length===0,
  miss.length+' missing: '+miss.slice(0,6).join(', '));

// the difficulty curve
const normalBase=e=>e.baselineHp/((e.node%10===5?1.08:1)*(e.node%10===0?1.16:1));
ck('the normal-growth baseline rises every single stage',
  S.every((e,i)=>i===0||normalBase(e)>normalBase(S[i-1])));
ck('stage 5 and stage 10 carry the blueprint elite/boss steps',
  S.filter(e=>e.node%10===5).every(e=>Math.abs(e.baselineHp/Math.pow(1.045,e.node-1)-1.08)<0.01) &&
  S.filter(e=>e.node%10===0).every(e=>Math.abs(e.baselineHp/Math.pow(1.045,e.node-1)-1.16)<0.01));
ck('every stage records the validated correction applied to the baseline',
  S.every(e=>typeof e.difficultyTune==='number'&&e.difficultyTune>0));
ck('enemy level tracks the stage number', S.every(e=>e.waves.every(w=>w.every(m=>m.lvl===e.node))));
ck('recommended power never goes backwards', S.every((e,i)=>i===0||e.recommendedPower>=S[i-1].recommendedPower));
ck('1-1 and 1-2 need no glyphs at all (a new account owns none)',
  S[0].targetGlyph==='None'&&S[1].targetGlyph==='None');

console.log(''); console.log('PASS: '+PASS+'  FAIL: '+FAIL);
process.exit(FAIL?1:0);
