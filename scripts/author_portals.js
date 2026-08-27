/* v266 — Emberweave_Exact_Glyph_Fragment_Farm_Map_v1.
   ONE fixed, visible source per Glyph Fragment family. Normal Portal (100) + Elite Portal (100)
   + Veteran Portal (18 Orange) = every one of the 218 raw families, with zero overlap.
   Emits: server/campaign-encounters.json (rewritten fragment arrays),
          server/elite-campaign-encounters.json, server/veteran-campaign-encounters.json. */
const fs=require('fs'), path=require('path');
const DIR=path.join(__dirname,'server');
const slug=k=>k.toLowerCase().replace(/\s*\+\s*/g,'-plus-').replace(/\s+/g,'-');
const code=n=>`${Math.floor((n-1)/10)+1}-${((n-1)%10)+1}`;
const nodeOf=id=>{ const [c,s]=id.split('-').map(Number); return (c-1)*10+s; };

/* ---- the map, transcribed exactly from the spec's positional tables ---- */
const NORMAL=[
  ['1-1','1-4',  'Grey',      ['Stoneheart','Ironwall','Veilward','Ravager']],
  ['1-5','1-10', 'Green',     ['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep']],
  ['2-1','2-6',  'Green +1',  ['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep']],
  ['2-7','3-2',  'Blue',      ['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep']],
  ['3-3','3-8',  'Blue +1',   ['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep']],
  ['3-9','4-4',  'Blue +2',   ['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep']],
  ['4-5','5-1',  'Purple',    ['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep','Hawkeye']],
  ['5-2','5-8',  'Purple +1', ['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep','Hawkeye']],
  ['5-9','6-5',  'Purple +2', ['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep','Hawkeye']],
  ['6-6','7-2',  'Purple +3', ['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep','Hawkeye']],
  ['7-3','7-9',  'Gold',      ['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep','Hawkeye']],
  ['7-10','8-6', 'Gold +1',   ['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep','Hawkeye']],
  ['8-7','9-3',  'Gold +2',   ['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep','Hawkeye']],
  ['9-4','9-10', 'Gold +3',   ['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep','Hawkeye']],
  ['10-1','10-10','Gold +4',  ['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep','Hawkeye','Lifebloom','Bastion','Bloodroot']],
];
const ELITE=[
  ['1-1','1-4',  'Grey',      ['Windstep','Starfire','Hawkeye','Lifebloom']],
  ['1-5','1-8',  'Green',     ['Hawkeye','Lifebloom','Shadepath','Sunder']],
  ['1-9','2-2',  'Green +1',  ['Hawkeye','Lifebloom','Shadepath','Sunder']],
  ['2-3','2-8',  'Blue',      ['Hawkeye','Lifebloom','Bastion','Shadepath','Sunder','Voidbind']],
  ['2-9','3-4',  'Blue +1',   ['Hawkeye','Lifebloom','Bastion','Shadepath','Sunder','Voidbind']],
  ['3-5','3-10', 'Blue +2',   ['Hawkeye','Lifebloom','Bastion','Shadepath','Sunder','Voidbind']],
  ['4-1','4-7',  'Purple',    ['Lifebloom','Bastion','Bloodroot','Shadepath','Sunder','Tidecall','Voidbind']],
  ['4-8','5-4',  'Purple +1', ['Lifebloom','Bastion','Bloodroot','Shadepath','Sunder','Tidecall','Voidbind']],
  ['5-5','6-1',  'Purple +2', ['Lifebloom','Bastion','Bloodroot','Shadepath','Sunder','Tidecall','Voidbind']],
  ['6-2','6-8',  'Purple +3', ['Lifebloom','Bastion','Bloodroot','Shadepath','Sunder','Tidecall','Voidbind']],
  ['6-9','7-7',  'Gold',      ['Lifebloom','Bastion','Bloodroot','Dawnshield','Keenmind','Shadepath','Sunder','Tidecall','Voidbind']],
  ['7-8','8-6',  'Gold +1',   ['Lifebloom','Bastion','Bloodroot','Dawnshield','Keenmind','Shadepath','Sunder','Tidecall','Voidbind']],
  ['8-7','9-5',  'Gold +2',   ['Lifebloom','Bastion','Bloodroot','Dawnshield','Keenmind','Shadepath','Sunder','Tidecall','Voidbind']],
  ['9-6','10-4', 'Gold +3',   ['Lifebloom','Bastion','Bloodroot','Dawnshield','Keenmind','Shadepath','Sunder','Tidecall','Voidbind']],
  ['10-5','10-10','Gold +4',  ['Dawnshield','Keenmind','Shadepath','Sunder','Tidecall','Voidbind']],
];
const VETERAN=['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep','Hawkeye','Lifebloom',
  'Shadepath','Sunder','Voidbind','Bastion','Tidecall','Bloodroot','Keenmind','Dawnshield','Worldheart','Cataclysm'];

function expand(rows,label){
  const out={};   // node -> "Quality Family"
  for(const [from,to,q,fams] of rows){
    const a=nodeOf(from), b=nodeOf(to), span=b-a+1;
    if(span!==fams.length) throw new Error(label+' '+from+'..'+to+': '+span+' stages but '+fams.length+' families');
    for(let k=0;k<span;k++){ const n=a+k;
      if(out[n]) throw new Error(label+' stage '+code(n)+' assigned twice');
      out[n]=q+' '+fams[k]; }
  }
  const nodes=Object.keys(out).map(Number).sort((x,y)=>x-y);
  if(nodes.length!==100) throw new Error(label+': '+nodes.length+' stages mapped, expected 100');
  for(let n=1;n<=100;n++) if(!out[n]) throw new Error(label+': stage '+code(n)+' has no fragment');
  return out;
}
const NMAP=expand(NORMAL,'Normal'), EMAP=expand(ELITE,'Elite');

const frag=(key,qty)=>({ fragmentId:slug(key), key, displayName:key+' Fragment', quantity:qty||1 });

// ---------- 1) Normal Portal: replace the fragment arrays, keep everything else ----------
const CP=path.join(DIR,'campaign-encounters.json');
const camp=JSON.parse(fs.readFileSync(CP,'utf8'));
if(!Array.isArray(camp)||camp.length!==100) throw new Error('campaign-encounters.json must be a 100-entry array');
camp.forEach((e,i)=>{ const n=i+1;
  e.rewards.glyphFragments=[frag(NMAP[n], (n%10===0)?2:1)];   // the only allowed extra is MORE of the same named item on a boss
  e.portalMode='normal'; e.farmFragment=slug(NMAP[n]);
});
fs.writeFileSync(CP, JSON.stringify(camp,null,1));

// ---------- 2) Elite Portal: the same authored themes, fixed stronger waves ----------
const ELITE_HP=1.55, ELITE_DMG=1.35;   // "stronger fixed version of the matching Normal stage"
const elite=camp.map((e,i)=>{ const n=i+1;
  return { id:e.id, node:n, mode:'elite', checkpoint:e.checkpoint,
    recommendedPower:Math.round(e.recommendedPower*1.45),
    targetLevel:e.targetLevel, recommendedQuality:e.recommendedQuality,
    qualityMinHeroLevel:e.qualityMinHeroLevel,
    bossLevelGate:e.bossLevelGate, portalMode:'elite', farmFragment:slug(EMAP[n]),
    rewards:{ firstGold:Math.round(e.rewards.firstGold*1.6), repeatGold:Math.round(e.rewards.repeatGold*1.6),
      playerXpFirst:Math.round(e.rewards.playerXpFirst*1.5), playerXpRepeat:Math.round(e.rewards.playerXpRepeat*1.5),
      heroXpFirst:Math.round(e.rewards.playerXpFirst*1.5)*10, heroXpRepeat:Math.round(e.rewards.playerXpRepeat*1.5)*10,
      glyphFragments:[frag(EMAP[n], (n%10===0)?2:1)] },
    waves:e.waves.map(w=>w.map(m=>Object.assign({},m,
      { hpMul:+(m.hpMul*ELITE_HP).toFixed(4), dmgMul:+(m.dmgMul*ELITE_DMG).toFixed(4) }))) };
});
fs.writeFileSync(path.join(DIR,'elite-campaign-encounters.json'), JSON.stringify(elite,null,1));

// ---------- 3) Veteran Portal: the 18 Orange sources ----------
const VET_HP=2.6, VET_DMG=1.9;   // post-campaign content, built on the chapter-10 encounters
const veteran=VETERAN.map((fam,ix)=>{ const n=ix+1, src=camp[90+(ix%10)];   // chapter-10 themes
  return { id:code(n), node:n, mode:'veteran', checkpoint:(n%10===0)?'boss':(n%10===5?'guardian':'normal'),
    recommendedPower:Math.round(src.recommendedPower*(1.6+ix*0.05)),
    targetLevel:100, recommendedQuality:'Orange', qualityMinHeroLevel:100,
    bossLevelGate:100, portalMode:'veteran', farmFragment:slug('Orange '+fam),
    rewards:{ firstGold:4000+ix*200, repeatGold:3600+ix*200,
      playerXpFirst:0, playerXpRepeat:0, heroXpFirst:0, heroXpRepeat:0,   // level 100 is the cap
      glyphFragments:[frag('Orange '+fam, 1)] },
    waves:src.waves.map(w=>w.map(m=>Object.assign({},m,
      { lvl:100, hpMul:+(m.hpMul*(VET_HP+ix*0.08)).toFixed(4), dmgMul:+(m.dmgMul*(VET_DMG+ix*0.04)).toFixed(4) }))) };
});
fs.writeFileSync(path.join(DIR,'veteran-campaign-encounters.json'), JSON.stringify(veteran,null,1));

// ---------- the spec's own validation ----------
const nIds=camp.map(e=>e.rewards.glyphFragments[0].fragmentId);
const eIds=elite.map(e=>e.rewards.glyphFragments[0].fragmentId);
const vIds=veteran.map(e=>e.rewards.glyphFragments[0].fragmentId);
const uniq=a=>new Set(a);
const A=(c,m)=>{ if(!c) throw new Error('ASSERT FAILED: '+m); console.log('  ✓ '+m); };
A(camp.length===100,'normalStages.length === 100');
A(elite.length===100,'eliteStages.length === 100');
A(camp.every(s=>s.rewards.glyphFragments.length===1),'every Normal stage has exactly ONE glyph fragment');
A(elite.every(s=>s.rewards.glyphFragments.length===1),'every Elite stage has exactly ONE glyph fragment');
A(uniq(nIds).size===100,'unique(normalFragmentIds).size === 100');
A(uniq(eIds).size===100,'unique(eliteFragmentIds).size === 100');
A(nIds.filter(x=>eIds.includes(x)).length===0,'intersection(normal, elite) === 0');
A(uniq(vIds).size===18,'veteranOrangeFragmentIds.size === 18');

// every (quality, family) pair the catalog defines must have exactly one source
const raw=Object.values(require('./server/glyph-source.json'));
const pairs=new Set();
for(const d of raw){ const m=/(\w+)\s+(Glyph|Core|Crown)$/.exec(d.name); if(m) pairs.add(slug(d.quality+' '+m[1])); }
const all=new Set([...nIds,...eIds,...vIds]);
A(pairs.size===218,'the catalog defines 218 raw fragment families (got '+pairs.size+')');
A(all.size===218,'allGlyphFragmentIds.size === 218 (got '+all.size+')');
const missing=[...pairs].filter(p=>!all.has(p));
A(missing.length===0,'every catalog fragment has a farm source'+(missing.length?' — MISSING '+missing.slice(0,8).join(', '):''));
const stray=[...all].filter(p=>!pairs.has(p));
A(stray.length===0,'no farm source points at a fragment the catalog does not define'+(stray.length?' — STRAY '+stray.slice(0,8).join(', '):''));

console.log('\nwritten: campaign-encounters.json (100) · elite-campaign-encounters.json (100) · veteran-campaign-encounters.json (18)');
console.log('sample — Normal 1-9 → '+NMAP[9]+' · Elite 3-4 → '+EMAP[24]+' · Veteran 2-8 → Orange '+VETERAN[17]);
