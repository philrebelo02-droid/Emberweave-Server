/* v257: append a chapter of 10 authored stages to server/campaign-encounters.json.
   Usage: node add_chapter.js <chapterNumber> <glyphQuality>
   e.g.   node add_chapter.js 12 "Orange"
   Wave shapes are mirrored from the previous chapter; run tune_campaign.js afterwards to author
   the levels, enemy scalars, recommended power and XP for the new stages. */
const fs=require('fs');
const P=__dirname+'/server/campaign-encounters.json';
const ch=parseInt(process.argv[2],10), qual=process.argv[3];
if(!(ch>1)||!qual){ console.error('usage: node add_chapter.js <chapter> <quality>'); process.exit(1); }
const FAMS=['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep','Hawkeye','Lifebloom',
  'Shadepath','Sunder','Bastion','Voidbind','Bloodroot','Tidecall','Dawnshield','Keenmind','Cataclysm','Worldheart'];
const slug=k=>k.toLowerCase().replace(/\s*\+\s*(\d)/g,'-plus-$1').replace(/\s+/g,'-');
const C=JSON.parse(fs.readFileSync(P,'utf8'));
const have=Object.keys(C).length;
if(have!==(ch-1)*10){ console.error('expected '+((ch-1)*10)+' stages before chapter '+ch+', found '+have); process.exit(1); }
let fi=0;
for(let i=1;i<=10;i++){
  const src=C[String(have-10+i-1)];
  const node=have+i, boss=(i===10), guardian=(i===5);
  const frags=[];
  for(let k=0;k<(boss?3:2);k++){ const key=qual+' '+FAMS[fi++%FAMS.length];
    frags.push({fragmentId:slug(key), key, displayName:key+' Fragment', quantity:boss?2:1}); }
  C[String(node-1)]={ id:ch+'-'+i, node, checkpoint: boss?'boss':(guardian?'guardian':'normal'),
    recommendedPower:0,
    rewards:{ firstGold:(src.rewards.firstGold||3000)+400, repeatGold:(src.rewards.repeatGold||2900)+400,
      heroXpFirst:0, heroXpRepeat:0, playerXpFirst:0, playerXpRepeat:0, glyphFragments:frags },
    waves: src.waves.map(w=>w.map(m=>Object.assign({},m))) };
}
fs.writeFileSync(P, JSON.stringify(C,null,1));
console.log('chapter '+ch+' authored ('+qual+'). Now: update CAMPAIGN_NODES (server.js) + TOTAL_CHAPTERS/MAX_CHAPTER/CHAPTER_NAMES (client), extend CH_END_LEVEL/CH_END_TIER in tune_campaign.js, then run: node tune_campaign.js');
