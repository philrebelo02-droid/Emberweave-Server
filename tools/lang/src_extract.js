// LANGUAGES step 2: write the English of every key the specs add, one file per group (tools/lang/src/<group>.en.json, a key per line),
// for the translators. Group = the spec file's first letter (A screens, B battle, C server errors, ...). Keys of step 1 are left out.
// Usage: node tools/lang/src_extract.js
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const ROOT=path.join(__dirname,'..','..'), d=path.join(__dirname,'specs');
const en=JSON.parse(cp.execFileSync('git',['show','88bcea5a8eea4be1df48e3111ecbf9ad7a64f7d1:lang/en.json'],{cwd:ROOT}).toString('utf8'));
const groups={}, seen=new Set(Object.keys(en));
for(const f of fs.readdirSync(d).filter(f=>f.endsWith('.json')).sort()){ const g=f.startsWith('00_')?'A':f[0];
  const s=JSON.parse(fs.readFileSync(path.join(d,f),'utf8'));
  for(const [k,v] of Object.entries(s.keys||{})){ if(seen.has(k)) continue; seen.add(k); (groups[g]=groups[g]||{})[k]=v; } }
fs.mkdirSync(path.join(__dirname,'src'),{recursive:true});
for(const [g,o] of Object.entries(groups)){
  const txt='{\n'+Object.entries(o).map(([k,v])=>JSON.stringify(k)+':'+JSON.stringify(v)).join(',\n')+'\n}\n';
  fs.writeFileSync(path.join(__dirname,'src',g+'.en.json'),txt);
  console.log(g+': '+Object.keys(o).length+' keys, '+Object.values(o).join('').length+' chars'); }
