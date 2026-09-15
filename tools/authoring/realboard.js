/* v364 — the REAL glyph board a player actually ends up with: the server's own pre-choice
   (glyphPreChoice) walked tier by tier with ascended carry, exactly as /api/glyphs/ascend and the
   dev "maxGlyphs" path accumulate it. Loads the glyph section of server.js verbatim so the model
   can never drift from the game. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'../../server.js'),'utf8');
const a=src.indexOf('const GLYPHS_V2_ENABLED'), b=src.indexOf('function glyphPruneConsumed(');
if(a<0||b<0) throw new Error('glyph section not found');
const SIM=require('../../server/sim.js');
const HERO_PROFILES=require('../../hero-profiles.js'), HERO_PATHS=require('../../hero-paths.js');
const ctx={ require, console:{log(){},error(){},warn(){}}, process, SIM, fs, path, __dirname:path.join(__dirname,'../..'), GEARCAT:null, HERO_PROFILES, HERO_PATHS };
vm.createContext(ctx);
vm.runInContext(src.slice(a,b)+'\nglyphCompile(); glyphSupplyOK=()=>true;\nthis.glyphPreChoice=glyphPreChoice; this.GLYPH_LADDER=GLYPH_LADDER; this.GLYPH_MIN_LEVEL=GLYPH_MIN_LEVEL; this.GLYPHS=GLYPHS;', ctx);
const LADDER=ctx.GLYPH_LADDER, MIN_LEVEL=ctx.GLYPH_MIN_LEVEL;
/* board state after reaching ladder index `tier` (0..15) with that tier's six built: ascended = all
   tiers below, slots = tier's six pre-chosen. tier 16 = fully ascended (everything banked). */
function boardFor(hero, tier){
  const asc={}, slots=[];
  const add=(def)=>{ for(const s of def.stats){ const k=s.stat; asc[k]=asc[k]||{val:0,pct:s.pct}; asc[k].val=+(asc[k].val+s.val).toFixed(2); } };
  for(let qi=0;qi<Math.min(tier,16);qi++) for(let i=0;i<6;i++){ const d=ctx.glyphPreChoice(hero,i,qi); if(d) add(d); }
  if(tier<16) for(let i=0;i<6;i++){ const d=ctx.glyphPreChoice(hero,i,tier); if(d) slots.push({stats:d.stats.map(s=>({stat:s.stat,val:s.val,pct:s.pct}))}); }
  return {ascended:asc, slots};
}
function tierForLevel(lv){ let t=0; for(let i=0;i<MIN_LEVEL.length;i++) if(lv>=MIN_LEVEL[i]) t=i; return t; }
module.exports={ boardFor, tierForLevel, LADDER, MIN_LEVEL, GLYPHS:ctx.GLYPHS };
if(require.main===module){ const b=boardFor(process.argv[2]||'tallow', +(process.argv[3]||16));
  const flat={}; for(const k in b.ascended) flat[k]=b.ascended[k].val; console.log(JSON.stringify(flat)); }
