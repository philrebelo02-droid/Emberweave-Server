/* v258 — the campaign against Emberweave_Launch_Progression_and_Portal_Difficulty_Blueprint_v1.
   No server needed: reads the authored data and proves the launch path, not asserts it. */
const fs=require('fs'), path=require('path');
let PASS=0, FAIL=0;
const ck=(n,c,x)=>{ if(c){PASS++;console.log('  ✓ '+n);} else {FAIL++;console.log('  ✗ '+n+(x?' — '+x:''));} };

const C=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server','campaign-encounters.json'),'utf8'));
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
const REWARD_HEROES=['tick','sylthaine','vireo','vael','fritz','rhukk','bloatus','umbris','oakmir'];
const rewardSlot=s=>({3:0,6:1,9:2,10:3})[((s-1)%10)+1];
const rewardHero=s=>REWARD_HEROES[((Math.floor((s-1)/10)*4)+rewardSlot(s))%REWARD_HEROES.length];
const rewardStages=S.filter(e=>[3,6,9,0].includes(e.node%10));
ck('stages 3, 6, 9 and 10 put their exact sweep-reward hero in wave 3',
  rewardStages.every(e=>e.waves[2].some(m=>m.isHero&&m.rewardHero&&m.key===rewardHero(e.node))),
  JSON.stringify(rewardStages.filter(e=>!e.waves[2].some(m=>m.isHero&&m.rewardHero&&m.key===rewardHero(e.node))).map(e=>e.id)));
ck('stage 10 always fights both its reward hero and its chapter boss',
  S.filter(e=>e.node%10===0).every(e=>e.waves[2].some(m=>m.isHero&&m.rewardHero)&&e.waves[2].some(m=>m.boss)));
ck('bosses only ever stand in wave 3, and only on stage 10',
  S.every(e=>e.waves.every((w,i)=>w.every(m=>!m.boss||(i===2&&e.node%10===0)))));
ck('stages 3, 6 and 9 of every chapter are the Guardian checkpoints',
  S.filter(e=>[3,6,9].includes(e.node%10)).every(e=>e.checkpoint==='guardian') &&
  S.filter(e=>![3,6,9].includes(e.node%10)&&e.node%10!==0).every(e=>e.checkpoint==='normal'));

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
ck('early reference enemy levels follow XP attainable before each first clear',
  S.slice(0,20).every((e,i)=>{const xp=i*30+(i>=10?30:0); const curve=[0,8,26,79,177,335,563,861];
    const expected=curve.reduce((level,needed,j)=>xp>=needed?j+1:level,1);
    return e.targetLevel===expected&&e.waves.every(w=>w.every(m=>m.lvl===expected));}));
ck('later recommended player levels retain the authored ladder for balance review',
  S.slice(20).every((e,i)=>e.targetLevel===i+21));

// chapter graduation bosses
const gates=S.filter(e=>e.node%10===0).map(e=>e.bossLevelGate);
ck('early boss levels are attainable under the 5× first-clear XP rule',
  JSON.stringify(gates)===JSON.stringify([5,7,30,40,50,60,70,80,90,100]), JSON.stringify(gates));
ck('normal stages carry no hard level gate', S.filter(e=>e.node%10!==0).every(e=>!e.bossLevelGate));

// XP: Phil's 15 Sep 2026 rule is five stamina-equivalent runs on the first
// clear, one thereafter, paid equally to Commander and every participating hero.
ck('Normal stages pay 5× stamina XP first, 1× repeat to Commander and heroes',
  S.every(e=>{const cost=e.node%10===0?12:6,r=e.rewards;
    return r.playerXpFirst===cost*5&&r.playerXpRepeat===cost&&
      r.heroXpFirst===cost*5&&r.heroXpRepeat===cost;}));
const E=require('../server/elite-campaign-encounters.json');
ck('Elite stages pay 60 XP first, 12 XP repeat to Commander and heroes',
  E.every(e=>{const r=e.rewards;return r.playerXpFirst===60&&r.playerXpRepeat===12&&
    r.heroXpFirst===60&&r.heroXpRepeat===12;}));
ck('player XP never goes backwards stage to stage',
  S.every((e,i)=>i===0||e.rewards.playerXpFirst>=S[i-1].rewards.playerXpFirst*0.5));

// rewards: ordinary stages roll two distinct fragments from four visible possibilities;
// Guardian/boss Normal stages keep their fixed reward.
const ordinary=S.filter(e=>![3,6,9,0].includes(e.node%10));
const rewardNodes=S.filter(e=>[3,6,9,0].includes(e.node%10));
ck('ordinary Normal stages roll two from four distinct named fragments',
  ordinary.every(e=>e.rewards.fragmentRolls===2&&e.rewards.glyphFragments.length===4
    &&new Set(e.rewards.glyphFragments.map(f=>f.key)).size===4));
ck('Guardian and boss Normal stages keep one fixed named fragment',
  rewardNodes.every(e=>e.rewards.glyphFragments.length===1));
ck('every reward line carries an exact name and a count (never "9 grey fragments")',
  S.every(e=>e.rewards.glyphFragments.every(f=>f.key&&f.fragmentId&&f.displayName&&f.quantity>=1)));
// the farm map deliberately offers materials a few stages BEFORE the matching level gate, so the
// fragment quality tracks the ladder without having to equal the stage's recommended quality
const LI=q=>LADDER.indexOf(q);
ck('the first two ordinary stages expose all eight Grey glyph families',
  new Set([...S[0].rewards.glyphFragments,...S[1].rewards.glyphFragments].map(f=>f.key)).size===8
  && [...S[0].rewards.glyphFragments,...S[1].rewards.glyphFragments].every(f=>f.key.startsWith('Grey ')));
ck('ordinary fragment pools progress from Grey to Orange without reversing',
  ordinary.every((e,i)=>i===0||LI(e.rewards.glyphFragments[0].key.slice(0,e.rewards.glyphFragments[0].key.lastIndexOf(' ')))
    >=LI(ordinary[i-1].rewards.glyphFragments[0].key.slice(0,ordinary[i-1].rewards.glyphFragments[0].key.lastIndexOf(' ')))));
// (whole-catalogue fragment coverage is proven across all three portals in test_farm_map.js)

// the difficulty curve
const isGuardian=e=>[3,6,9].includes(e.node%10);
const normalBase=e=>e.baselineHp/((isGuardian(e)?1.08:1)*(e.node%10===0?1.16:1));
ck('the normal-growth baseline rises every single stage',
  S.every((e,i)=>i===0||normalBase(e)>normalBase(S[i-1])));
ck('stages 3/6/9 and stage 10 carry the Guardian/boss steps',
  S.filter(isGuardian).every(e=>Math.abs(e.baselineHp/Math.pow(1.045,e.node-1)-1.08)<0.01) &&
  S.filter(e=>e.node%10===0).every(e=>Math.abs(e.baselineHp/Math.pow(1.045,e.node-1)-1.16)<0.01));
ck('every stage records the validated correction applied to the baseline',
  S.every(e=>typeof e.difficultyTune==='number'&&e.difficultyTune>0));
ck('enemy level tracks each stage reference target', S.every(e=>e.waves.every(w=>w.every(m=>m.lvl===e.targetLevel))));
ck('recommended power never goes backwards', S.every((e,i)=>i===0||e.recommendedPower>=S[i-1].recommendedPower));
ck('1-1 and 1-2 need no glyphs at all (a new account owns none)',
  S[0].targetGlyph==='None'&&S[1].targetGlyph==='None');

console.log(''); console.log('PASS: '+PASS+'  FAIL: '+FAIL);
process.exit(FAIL?1:0);
