'use strict';
const fs=require('fs'), path=require('path'), cp=require('child_process');
const root=path.resolve(__dirname,'..');
const profiles=require(path.join(root,'hero-profiles.js'));
const paths=require(path.join(root,'hero-paths.js'));
const sim=require(path.join(root,'server','sim.js'));
const html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
function ok(v,m){ if(!v) throw new Error(m); }
const keys=Object.keys(profiles);
ok(keys.length===60,'expected 60 canonical hero profiles');
ok(Object.keys(sim.HERO_BASE).length===60,'server hero count');
ok(Object.keys(paths).length===14,'expected 14 shared progression paths');
const classes=new Set(['Tank','Bruiser','Assassin','Mage','Marksman','Support']);
const rows=new Set(['Front','Mid','Back','Other']);
const damage=new Set(['Attack','Magic','Hybrid','Healer']);
for(const key of keys){
  const p=profiles[key], b=sim.HERO_BASE[key];
  ok(b,'server missing '+key); ok(classes.has(p.class),'bad class '+key); ok(rows.has(p.combatRow),'bad row '+key);
  ok(damage.has(p.damageProfile),'bad damage '+key); ok(paths[p.glyphPath],'bad glyph path '+key);
  ok(p.glyphPath===p.equipmentPath,'glyph/equipment formula diverged '+key);
  ok(paths[p.equipmentPath].equipment.length===9,'equipment path length '+key);
  ok(b.role===p.class&&b.row===p.combatRow&&b.damageProfile===p.damageProfile,'server overlay mismatch '+key);
  if(p.class==='Tank') ok(p.minimumReachMeters===1,'Tank reach baseline '+key);
  else ok(p.minimumReachMeters>=3.5,'every non-Tank needs 2.5 m more reach: '+key);
}
ok(!html.includes("role:'Fighter'"),'obsolete Fighter hero remains');
ok(html.includes('<script src="/hero-profiles.js"></script>'),'client profile source missing');
ok(html.includes('<script src="/hero-paths.js"></script>'),'client path source missing');
ok(html.includes("const hold=2.5*METER"),'assassin Tank leash missing');
const out=cp.execFileSync(process.execPath,[path.resolve(root,'..','Operating procedure','tools','glyph_paths.js')],{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
const report=JSON.parse(out);
ok(Object.keys(report.heroes).length===60,'glyph hero coverage');
ok(Object.keys(report.archetypes).length===14,'glyph path coverage');
for(const [id,p] of Object.entries(report.archetypes)) ok(p.path.length===16&&p.path.every(q=>q.slots.length===6&&q.slots.every(Boolean)),'glyph path incomplete '+id);
const grey=report.glyphs.filter(g=>g.quality==='Grey');
ok(grey.every(g=>g.total===2),'Grey glyph must cost 2');
console.log('hero profiles PASS — 60 heroes, 14 shared paths, 16 glyph tiers, 9 equipment qualities');
