'use strict';
// This control asks whether v1148 pays Veteran hero fragments. Its 218-glyph /
// 84-gear startup gates must read the catalogs and paths that shipped with it,
// rather than unrelated new-hero data from the current checkout.
const {execFileSync}=require('child_process'),vm=require('vm'),path=require('path');
const REF='e94e80a46b83d9882c2e6cc41f140939cd8c2c09',root=path.resolve(__dirname,'../..');
const show=f=>execFileSync('git',['show',REF+':'+f],{cwd:root,maxBuffer:64<<20,encoding:'utf8'});
module.exports=function(){
 let src=show('server.js');
 for(const file of ['server/glyph-source.json','server/gear-catalog.json','server/hero-personal-glyph-paths.json','server/hero-ascension-bonuses.json','hero-profiles.js','hero-paths.js']){
  const token="require('./"+file+"')";
  let data;
  if(file.endsWith('.json'))data=JSON.parse(show(file));
  else{const box={module:{exports:{}},globalThis:{}};vm.runInNewContext(show(file),box,{filename:file});data=box.module.exports;}
  const value='JSON.parse('+JSON.stringify(JSON.stringify(data))+')';
  src=src.split(token).join(value);
  if(file==='server/glyph-source.json'){
   const raw='const raw=JSON.parse(txt);';if(!src.includes(raw))throw Error('Frozen glyph loader changed');
   src=src.replace(raw,'const raw='+value+';');
  }
  if(file==='server/gear-catalog.json'){
   const raw="JSON.parse(fs.readFileSync(path.join(__dirname,'server','gear-catalog.json'),'utf8'))";
   if(!src.includes(raw))throw Error('Frozen gear loader changed');src=src.replace(raw,value);
  }
 }
 return src;
};
