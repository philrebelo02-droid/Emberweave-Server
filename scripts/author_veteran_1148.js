/* v1148 (Phil 15 Oct 2026: "All normal/ elite/ veteran should go from 1-16" / "Elite and veteran are 50% and 100% scaling of normal" /
   "So by default when nerfing normal you are nerfing elite and vet").
   Veteran is GENERATED from Normal, the way Elite is Normal at 1.5x (v1056): every Veteran stage is the matching Normal stage - same id,
   node, checkpoint, wave lineups, unit levels, bosses - with every enemy's hpMul AND dmgMul x2 (so the test_farm_map strength measure,
   sum sqrt(hp*dmg)*(1+0.05*lvl), reads exactly 2.0x). Re-run this after ANY Normal change and Veteran follows it.
   Rewards follow the Elite rule one step further:
     - gold:  Elite = Normal x1.6 (author_portals.js), so Veteran = Elite x1.6 (round).
     - XP:    Elite pays 60/12 on every stage = its 12-stamina cost x5 first / x1 repeat; Veteran costs the same 12, so it pays the same.
     - glyph: Elite chapter c pays two of one named fragment one ladder band above Normal chapter c; Veteran pays two, one band above
              Elite (capped at Orange). Families follow the matching Elite stage; the Orange stages cycle all 18 Orange families.
     - recommendedPower = Normal x2 (Elite is Normal x1.5); targetLevel / recommendedQuality / qualityMinHeroLevel = the paid band, as
       Elite does; bossLevelGate = Normal's (informational - campBossLevelGate is 0, v825).
   v1149 (Phil 15 Oct: "Veteran should give hero fragments yes"): HERO FRAGMENTS like Elite. Every Elite reward-hero stage (x-1/4/7/10, 64
   stages) is a Veteran reward-hero stage with the SAME hero (Elite's tiered pool: 1-star early, 2-star, then 3-star - no shop, arena or
   mythical heroes); the server pays it x2 (PORTAL_HERO_FRAG_MUL). The hero takes a final-wave slot exactly as author_portals.js puts
   Elite's there: the Normal final-wave hero unit if there is one (not the boss), else the first non-boss unit - keeping that unit's
   Normal x2 hpMul/dmgMul, so the 2x strength holds. Normal's own reward flags are dropped (Veteran pays Elite's hero, not Normal's).
   Usage: node scripts/author_veteran_1148.js   (writes server/veteran-campaign-encounters.json) */
const fs=require('fs'), path=require('path');
const DIR=path.join(__dirname,'..','server');
const LADDER=['Grey','Green','Green +1','Blue','Blue +1','Blue +2','Purple','Purple +1','Purple +2','Purple +3','Gold','Gold +1','Gold +2','Gold +3','Gold +4','Orange'];
const MIN_LEVEL=[1,5,13,18,24,30,36,43,50,57,65,72,79,86,93,100];   // = server.js GLYPH_MIN_LEVEL
const ORANGE=['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep','Hawkeye','Lifebloom','Shadepath','Sunder','Voidbind',
  'Bastion','Tidecall','Bloodroot','Keenmind','Dawnshield','Worldheart','Cataclysm'];   // the old 18-stage Veteran order
const VET_SCALE=2, VET_GOLD_OVER_ELITE=1.6;
const slug=k=>k.toLowerCase().replace(/\s*\+\s*/g,'-plus-').replace(/\s+/g,'-');
const frag=(key,qty)=>({ fragmentId:slug(key), key, displayName:key+' Fragment', quantity:qty });
const load=f=>JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8'));
const normal=load('campaign-encounters.json'), elite=load('elite-campaign-encounters.json');
const catalog=new Set(Object.values(load('glyph-source.json')).filter(d=>d.family).map(d=>d.quality+' '+d.family));
if(normal.length!==160||elite.length!==160) throw new Error('Normal and Elite must both have 160 stages');
const bandOf=key=>{ const q=key.slice(0,key.lastIndexOf(' ')); const i=LADDER.indexOf(q); if(i<0) throw new Error('bad quality '+key); return i; };
let orangeAt=0;
const veteran=normal.map((n,i)=>{
  const e=elite[i];
  if(e.id!==n.id||e.node!==n.node) throw new Error('Elite/Normal stage order differs at '+i);
  const eKey=e.rewards.glyphFragments[0].key, eFam=eKey.slice(eKey.lastIndexOf(' ')+1);
  const band=Math.min(LADDER.length-1, bandOf(eKey)+1), q=LADDER[band];
  const fam=band===LADDER.length-1 ? ORANGE[(orangeAt++)%ORANGE.length] : eFam;
  const key=q+' '+fam;
  if(!catalog.has(key)) throw new Error(n.id+': '+key+' is not a catalog fragment');
  const waves=n.waves.map(w=>w.map(m=>{ const u=Object.assign({},m,{ hpMul:+(m.hpMul*VET_SCALE).toFixed(4), dmgMul:+(m.dmgMul*VET_SCALE).toFixed(4) });
    delete u.rewardHero; return u; }));
  /* v1149: Elite's reward hero, fought in the final wave (author_portals.js slot rule) */
  if(e.rewardHero){ const eu=e.waves[e.waves.length-1].find(m=>m&&m.rewardHero&&m.key===e.rewardHero);
    if(!eu) throw new Error(n.id+': Elite reward hero '+e.rewardHero+' is not in its final wave');
    const final=waves[waves.length-1]; let at=final.findIndex(m=>m&&m.isHero&&!m.boss); if(at<0) at=final.findIndex(m=>m&&!m.boss);
    if(at<0) throw new Error(n.id+': no non-boss slot for the reward hero');
    const u=Object.assign({},final[at],{ key:e.rewardHero, isHero:true, rewardHero:true }); if(eu.rank!=null) u.rank=eu.rank; else delete u.rank;
    final[at]=u; }
  const er=e.rewards;
  return { id:n.id, node:n.node, mode:'veteran', checkpoint:n.checkpoint,
    recommendedPower:Math.round(n.recommendedPower*VET_SCALE),
    targetLevel:MIN_LEVEL[band], recommendedQuality:q, qualityMinHeroLevel:MIN_LEVEL[band],
    bossLevelGate:n.bossLevelGate, portalMode:'veteran', farmFragment:slug(key),
    rewards:{ firstGold:Math.round(er.firstGold*VET_GOLD_OVER_ELITE), repeatGold:Math.round(er.repeatGold*VET_GOLD_OVER_ELITE),
      playerXpFirst:er.playerXpFirst, playerXpRepeat:er.playerXpRepeat, heroXpFirst:er.heroXpFirst, heroXpRepeat:er.heroXpRepeat,
      glyphFragments:[frag(key,2)] },
    waves,
    ...(e.rewardHero?{ rewardHero:e.rewardHero }:{}),
    veteranRebalance:{ v:'v1148', date:'2026-10-15', scale:VET_SCALE, target:'2x the Normal stage (Phil: "Elite and veteran are 50% and 100% scaling of normal")' } };
});
fs.writeFileSync(path.join(DIR,'veteran-campaign-encounters.json'), JSON.stringify(veteran,null,1));
console.log('veteran-campaign-encounters.json: '+veteran.length+' stages = Normal x'+VET_SCALE+'; Orange stages '+orangeAt
  +'; 1-1 '+veteran[0].rewards.glyphFragments[0].key+' · 10-10 '+veteran[99].rewards.glyphFragments[0].key+' · 16-10 '+veteran[159].rewards.glyphFragments[0].key);
