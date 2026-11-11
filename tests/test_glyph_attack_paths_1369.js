// v1369 (Phil 11 Nov 2026: "i dont know why aureths stats are so low" / "its like he got nothing from glyphs"): every hero whose damage scales with
// Attack (a Bruiser, Marksman or Assassin that is not Magic) must have Ravager (Physical Attack) on its onslaught slot on at least 15 of 16 tiers - the guard
// that would have caught Aureth (Sunder on 14 tiers). Also checks the boot migration exists. CONTROL: v1368 (5285debc) fails it for Aureth.
const fs=require('fs'),path=require('path'),cp=require('child_process'); const ROOT=path.join(__dirname,'..');
let P=0,F=0; const ck=(n,c,x)=>{ if(c){P++;console.log('  ok   '+n);} else {F++;console.log('  FAIL '+n+(x?' - '+x:''));} };
const check=(paths)=>{ const bad=[]; const prof=require(path.join(ROOT,'hero-profiles.js')); const P2=prof.HERO_PROFILES||prof;
  for(const [k,h] of Object.entries(paths.heroes)){ const p=P2[k]||{}; const cls=p.class||p.role||''; const dp=p.damageProfile||'';
    const atk=/Bruiser|Marksman|Assassin/.test(cls)&&dp!=='Magic'; if(!atk) continue;   /* Tanks take Sunder by design (tank_attack_front); magic assassins take Starfire */
    const n=h.tiers.filter(t=>t[2]==='Ravager').length; if(n<15) bad.push(k+':'+n); } return bad; };
const now=JSON.parse(fs.readFileSync(path.join(ROOT,'server','hero-personal-glyph-paths.json'),'utf8'));
const bad=check(now); ck('every attack-scaling hero has Ravager on its onslaught slot on 15+ of 16 tiers', bad.length===0, bad.join(' '));
ck('Aureth has Ravager on all 16 tiers', now.heroes.aureth.tiers.every(t=>t[2]==='Ravager'));
const srv=fs.readFileSync(path.join(ROOT,'server.js'),'utf8');
ck('the boot migration recomputes Aureth once per account', /function migrateAurethGlyphPath\(\)/.test(srv)&&/migrateAurethGlyphPath\(\);   \/\* v1369/.test(srv)&&/g\.aurethPath11nov=1/.test(srv));
const old=JSON.parse(cp.execSync('git show 5285debc:server/hero-personal-glyph-paths.json',{cwd:ROOT,maxBuffer:64<<20}).toString());
ck('CONTROL: v1368 fails the guard for Aureth', check(old).some(x=>x.startsWith('aureth:')), check(old).join(' '));
console.log('test_glyph_attack_paths_1369.js: '+P+' passed, '+F+' failed'); process.exit(F?1:0);
