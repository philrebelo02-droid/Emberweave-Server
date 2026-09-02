// Vault sim-gate assertions (re-audit): a weak team's forged win is rejected at high floors,
// accepted at low floors; VAULT_SKILL_BAND=0 triggers the production warning path (gate off).
const load=require('./_probe_loader.js');
const S=load('./probe-db-vg.json');
let pass=0,fail=0; const ck=(n,c)=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n)); };
const save={playerXP:900000,heroXP:{vael:5000,sylthaine:5000,vireo:5000,tick:5000,fritz:5000},starLevel:{},starPip:{}};
const u={roster:{__save:JSON.stringify(save)}};
const snaps=['vael','sylthaine','vireo','tick','fritz'].map(k=>S.snapshotHeroFromServer(u,k,save));
ck('snapshots build (lvl '+snaps[0].level+')', snaps.every(Boolean));
ck('snapshot carries combat fields', 'dr' in snaps[0] && 'crit' in snaps[0]);
const at=f=>({id:'p'+f,floor:f,teamSnapshot:snaps,enemyWaves:S.buildDungeonWaves(f)});
ck('weak team CAN claim a low floor (5)', S.vaultWinPlausible(at(5))===true);
ck('weak team REJECTED at floor 50', S.vaultWinPlausible(at(50))===false);
ck('weak team REJECTED at floor 70', S.vaultWinPlausible(at(70))===false);
// ---- v241 (full-game audit): the Vault is an AUTHORED 100-floor table ----
const fs=require('fs'), path=require('path');
const vdir=fs.existsSync(__dirname+'/../server/vault-encounters.json')?__dirname+'/../server/vault-encounters.json':__dirname+'/../server/vault-encounters.json';
const V=JSON.parse(fs.readFileSync(vdir,'utf8')).floors;
ck('vault-encounters.json authors exactly 100 floors', V.length===100 && V.every((r,i)=>r.floor===i+1));
ck('every floor: exactly two waves', V.every(r=>Array.isArray(r.waves)&&r.waves.length===2));
ck('boss on every 5th floor, never elsewhere', V.every(r=>(r.floor%5===0)===r.waves[1].some(s=>s.boss)));
ck('every floor authors exactly 2 TARGETED gear fragments', V.every(r=>Array.isArray(r.gearFragments)&&r.gearFragments.length===2));
const gc=JSON.parse(fs.readFileSync(vdir.replace('vault-encounters','gear-catalog'),'utf8'));
const frags=new Set(gc.items.map(it=>it.frag));
ck('every authored gear fragment exists in the gear catalog', V.every(r=>r.gearFragments.every(k=>frags.has(k))));
ck('boss floors author named glyph fragments', V.filter(r=>r.floor%5===0).every(r=>(r.glyphFragments||[]).length>0));
ck('server serves the AUTHORED waves (floor 7 matches the file)', JSON.stringify(S.buildDungeonWaves(7))===JSON.stringify(V[6].waves));
ck('floor reward = the authored targets (floor 81)', JSON.stringify(S.makeStandardDungeonFloorReward(81).gearFragments)===JSON.stringify(V[80].gearFragments));
console.log('PASS: '+pass+'  FAIL: '+fail); process.exit(fail?1:0);
