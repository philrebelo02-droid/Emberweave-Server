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
console.log('PASS: '+pass+'  FAIL: '+fail); process.exit(fail?1:0);
