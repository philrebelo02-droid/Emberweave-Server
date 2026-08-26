// Loads server.js with the HTTP listener neutered so internals can be unit-probed.
module.exports=function(dbFile){
  process.env.DB_FILE=dbFile||'./probe-db.json'; process.env.PORT='8899';
  const fs=require('fs');
  let src=fs.readFileSync(require('path').join(__dirname,'server.js'),'utf8');
  src=src.replace('server.listen(PORT,', '(function(){})(PORT,');
  src+='\nmodule.exports={snapshotHeroFromServer,vaultWinPlausible,buildDungeonWaves,vaultSpecToCombatUnit,vaultTeamScore,vaultFloorScore,SIM,DB,warAdvance,getTournament,warNow,gearHeroFlats,glyphFlatStats};';
  const p=require('path').join(__dirname,'_server_probe_gen.js');
  fs.writeFileSync(p,src);
  const m=require(p); try{fs.unlinkSync(p);}catch(e){}
  return m;
};
