// GLYPH FLOW probes (Correction Spec v1): one-time migration preserves value; deterministic
// named drop tables; insufficiency is atomic (nothing consumed on failure). No server needed.
const load=require('./_probe_loader.js');
let P=0,F=0; const ck=(n,c)=>{ if(c){P++;console.log('  ✓ '+n);} else {F++;console.log('  ✗ '+n);} };
const S=load('./probe-db-glyphflow.json');

// ---- migration: loose finished -> 100% named ingredient refund; socketed -> locked ----
const u={ id:'u_probe', name:'probe', created:0, roster:{} };
const g=S.ensureGlyphs(u);
g.migratedAt=Date.now();   // skip the starter-pack stage; we are testing the FLOW migration
const grey=S.GLYPHS.raw.find(d=>d.qi===0);
const ing=grey.ing.filter(i=>i.kind==='frag');
g.finished['gA']={definitionId:grey.id, status:'inventory', createdAt:1};
g.finished['gB']={definitionId:grey.id, status:'socketed', createdAt:2};
g.boards['vael']={ slots:['gB',null,null,null,null,null], ascensionIndex:0, ascended:{HP:{val:10,pct:false}} };
g.subGlyphs={}; const before=JSON.parse(JSON.stringify(g.fragments||{}));
S.glyphFlowMigrate(u);
ck('flow migration stamps once', !!g.flow2At);
ck('loose finished glyph refunded at 100% named ingredients',
   ing.every(i=>((g.fragments[i.key]||0)-(before[i.key]||0))===i.qty));
ck('loose instance consumed (no inventory remains)', g.finished['gA'].status==='consumed');
ck('socketed glyph became a permanent locked build in place',
   g.finished['gB'].status==='locked' && g.boards['vael'].slots[0]==='gB');
ck('ascended bonuses untouched', g.boards['vael'].ascended.HP.val===10);
const flowStamp=g.flow2At; S.glyphFlowMigrate(u);
ck('migration is one-time (idempotent)', g.flow2At===flowStamp);

// ---- deterministic named drop tables ----
const c1=S.campFragFor(1), c1b=S.campFragFor(1), c15=S.campFragFor(15);
ck('campaign stage 1 target fixed: Grey Stoneheart ×1', c1[0].key==='Grey Stoneheart' && c1[0].quantity===1 && JSON.stringify(c1)===JSON.stringify(c1b));
ck('chapter 2 stage targets its own named Green fragment', c15[0].key.startsWith('Green ') && c15[0].key!==c1[0].key);
ck('boss stages grant ×2', S.campFragFor(10)[0].quantity===2);
const v5=S.vaultGlyphFragsFor(5), v5b=S.vaultGlyphFragsFor(5);
ck('vault floor 5 fragments are named and fixed', Array.isArray(v5)&&v5.length===2&&JSON.stringify(v5)===JSON.stringify(v5b)&&v5.every(k=>/^Grey /.test(k)));
const r1=S.makeStandardDungeonFloorReward(5), r2=S.makeStandardDungeonFloorReward(5);
ck('floor reward glyph fragments identical across grants', JSON.stringify(r1.fragments)===JSON.stringify(r2.fragments));

// ---- ladder is frozen (no runtime mutation possible) ----
let frozen=false; try{ S.GLYPH_LADDER.push('Grey +1'); }catch(e){ frozen=true; }
ck('canonical ladder is frozen at 16 entries', frozen && S.GLYPH_LADDER.length===16);

console.log('\nPASS: '+P+'  FAIL: '+F); process.exit(F?1:0);
