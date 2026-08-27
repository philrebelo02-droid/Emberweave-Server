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

// ---- AUTHORED per-stage named drops (read from campaign-encounters.json records) ----
const st1=S.campStageOf(1), st15=S.campStageOf(15), st10=S.campStageOf(10);
ck('stage 1 record authors Grey Stoneheart ×1', st1.rewards.glyphFragments[0].key==='Grey Stoneheart' && st1.rewards.glyphFragments[0].quantity===1);
ck('chapter 2 record authors its own named Green fragment', st15.rewards.glyphFragments[0].key.startsWith('Green ') && st15.rewards.glyphFragments[0].key!==st1.rewards.glyphFragments[0].key);
ck('boss stage records author ×2', st10.rewards.glyphFragments[0].quantity===2);
ck('all 100 records carry a validated named target', [...Array(100)].every((_,i)=>{ const st=S.campStageOf(i+1); return st&&st.rewards.glyphFragments&&st.rewards.glyphFragments.length>=1; }));

// ---- v232: ONE pre-chosen glyph per slot, matched to the hero's build identity ----
const stats=(d)=>d?d.stats.map(x=>x.stat).join('/'):'none';
const pre=(h,sl,qi)=>S.glyphPreChoice(h,sl,qi||0);
ck('every hero/slot has exactly one deterministic pre-choice',
   ['vael','sylthaine','grosk','meridian','vireo'].every(h=>[0,1,2,3,4,5].every(sl=>{ const a=pre(h,sl),b=pre(h,sl); return a&&b&&a.id===b.id; })));
ck('melee (Bruiser vael): onslaught forges Physical Attack', /Physical Attack/.test(stats(pre('vael',2))));
ck('caster (Mage sylthaine): onslaught forges Ability Power/Magic Pen', /Ability Power|Magic Pen/.test(stats(pre('sylthaine',2))));
ck('healer (Support vireo): onslaught forges Healing/AP — never armor pen', /Healing|Ability Power/.test(stats(pre('vireo',2))) && !/Armor Pen/.test(stats(pre('vireo',2))));
ck('marksman (meridian): mastery forges Crit', /Crit/.test(stats(pre('meridian',5))));
ck('tank (grosk): bulwark forges Armor', /Armor|Block/.test(stats(pre('grosk',1))));
ck('UNIVERSAL: every archetype gets an HP vitality glyph',
   ['vael','sylthaine','grosk','meridian','vireo'].every(h=>/HP|Health/.test(stats(pre(h,0)))));
ck('caster identity holds at higher tiers too (sylthaine Purple onslaught = magical)',
   /Ability Power|Magic Pen|Control/.test(stats(pre('sylthaine',2,6))));
const v5=S.vaultGlyphFragsFor(5), v5b=S.vaultGlyphFragsFor(5);
ck('vault floor 5 fragments are named and fixed', Array.isArray(v5)&&v5.length===2&&JSON.stringify(v5)===JSON.stringify(v5b)&&v5.every(k=>/^Grey /.test(k)));
const r1=S.makeStandardDungeonFloorReward(5), r2=S.makeStandardDungeonFloorReward(5);
ck('floor reward glyph fragments identical across grants', JSON.stringify(r1.fragments)===JSON.stringify(r2.fragments));

// ---- GLYPH ANCESTRY TREE (spec 27 Aug): full canonical lineage, farmable leaves ----
const gg={fragments:{}, subGlyphs:{}};
function leaves(n,out){ if(n.kind==='fragment') out.push(n); (n.children||[]).forEach(c=>leaves(c,out)); return out; }
function kinds(n,out){ out.push(n.kind); (n.children||[]).forEach(c=>kinds(c,out)); return out; }
const preP=S.glyphPreChoice('sylthaine',2,6), preG=S.glyphPreChoice('vael',2,10);
const treeP=S.glyphTreeFinished(gg,preP), treeG=S.glyphTreeFinished(gg,preG);
ck('Purple tree: finished root + virtual branch nodes + fragment leaves',
   treeP.kind==='finishedGlyph' && kinds(treeP,[]).includes('subGlyph') &&
   kinds(treeP,[]).filter(k=>k==='finishedGlyph').length>1 && leaves(treeP,[]).length>0);
ck('Gold tree: multi-level lineage (predecessors of predecessors)',
   treeG.kind==='finishedGlyph' && (treeG.children||[]).some(c=>c.kind==='finishedGlyph' && (c.children||[]).some(cc=>cc.kind==='finishedGlyph'||cc.kind==='subGlyph')));
ck('every leaf in both trees is a FARMABLE fragment (family exists at its own tier)',
   [...leaves(treeP,[]),...leaves(treeG,[])].every(l=>S.glyphSupplyOK({ing:[{kind:'frag',key:l.key,qty:1}]})));
ck('leaf sources resolve to authored stages carrying that same named fragment',
   [...leaves(treeP,[]),...leaves(treeG,[])].every(l=>(l.sources||[]).every(sid=>{
     const m=/^(\d+)-(\d+)$/.exec(String(sid).replace('campaign-','')); if(!m) return false;
     const st=S.campStageOf((+m[1]-1)*10 + (+m[2]));
     return st && st.rewards.glyphFragments.some(f=>f.key===l.key); })));
ck('flattened totals equal the sum of the tree leaves',
   (()=>{ const tot=S.g2BuildCost(gg,preP).need; const acc={};
     leaves(treeP,[]).forEach(l=>acc[l.key]=(acc[l.key]||0)+l.need);
     return JSON.stringify(Object.fromEntries(Object.entries(acc).sort()))===JSON.stringify(Object.fromEntries(Object.entries(tot).sort())); })());
ck('CAMPAIGN COVERAGE: every Grey→Gold+4 (tier,family) pair is authored on some stage (all fragments sweepable)',
   (()=>{ const covered=new Set();
     for(let n=1;n<=100;n++){ const st=S.campStageOf(n); (st.rewards.glyphFragments||[]).forEach(f=>covered.add(f.key)); }
     const quals=S.GLYPH_LADDER.slice(0,15); // Grey..Gold+4 (Orange = chapter 11/12, Vault-only for now)
     return quals.every(q=>{ const fams=(S.GLYPHS.raw.filter(d=>d.quality===q).map(d=>d.family));
       return [...new Set(fams)].every(f=>covered.has(q+' '+f)); }); })());
ck('every pre-choice at every tier is farmable end-to-end',
   ['vael','sylthaine','grosk','meridian','vireo'].every(h=>[0,1,2,3,4,5].every(sl=>[0,3,6,10,15].every(qi=>{ const d=S.glyphPreChoice(h,sl,qi); return d&&S.glyphSupplyOK(d); }))));

// ---- ladder is frozen (no runtime mutation possible) ----
let frozen=false; try{ S.GLYPH_LADDER.push('Grey +1'); }catch(e){ frozen=true; }
ck('canonical ladder is frozen at 16 entries', frozen && S.GLYPH_LADDER.length===16);

console.log('\nPASS: '+P+'  FAIL: '+F); process.exit(F?1:0);
