// Loads server.js with the HTTP listener neutered so internals can be unit-probed.
module.exports=function(dbFile){
  process.env.DB_FILE=dbFile||'./probe-db.json'; process.env.PORT='8899';
  const fs=require('fs'), path=require('path');
  // v229 (audit P0-6): resolve server.js whether this loader sits NEXT TO it (flat bundle) or in
  // scripts/ under a repo checkout — and generate the probe module BESIDE the real server.js so
  // its __dirname-relative data files (server/glyph-source.json etc.) still resolve.
  const srvDir=fs.existsSync(path.join(__dirname,'server.js'))?__dirname:path.join(__dirname,'..');
  let src=fs.readFileSync(path.join(srvDir,'server.js'),'utf8');
  src=src.replace('server.listen(PORT,', '(function(){})(PORT,');
  src+='\nmodule.exports={snapshotHeroFromServer,vaultWinPlausible,buildDungeonWaves,vaultSpecToCombatUnit,vaultTeamScore,vaultFloorScore,SIM,DB,warAdvance,getTournament,warNow,gearHeroFlats,glyphFlatStats,ensureGlyphs,glyphFlowMigrate,glyphMigrate,GLYPHS,GLYPH_LADDER,campFragFor,vaultGlyphFragsFor,makeStandardDungeonFloorReward};';
  const p=path.join(srvDir,'_server_probe_gen.js');
  fs.writeFileSync(p,src);
  const m=require(p); try{fs.unlinkSync(p);}catch(e){}
  return m;
};
