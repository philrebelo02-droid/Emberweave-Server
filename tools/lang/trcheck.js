// LANGUAGES step 2: check one language's translation of one source group.
// Usage: node tools/lang/trcheck.js <code> <group>   e.g.  node tools/lang/trcheck.js de A
// Reads tools/lang/src/<group>.en.json and every tools/lang/tr/<code>/*.json; lists keys missing, values with different {vars},
// values holding < > or ", and values left identical to the English (allowed for names/abbreviations - reported, not failed).
'use strict';
const fs=require('fs'),path=require('path');
const [code,group]=process.argv.slice(2); if(!code||!group){ console.error('usage: trcheck.js <code> <group>'); process.exit(2); }
const src=JSON.parse(fs.readFileSync(path.join(__dirname,'src',group+'.en.json'),'utf8'));
const dir=path.join(__dirname,'tr',code), tr={};
if(fs.existsSync(dir)) for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){ try{ Object.assign(tr,JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))); }catch(e){ console.log('BAD JSON '+f+': '+e.message); process.exitCode=1; } }
const vars=s=>(String(s).match(/\{\w+\}/g)||[]).sort().join(',');
const miss=[],bad=[],same=[];
for(const [k,v] of Object.entries(src)){ const x=tr[k];
  if(typeof x!=='string'||!x.trim()){ miss.push(k); continue; }
  if(vars(x)!==vars(v)) bad.push(k+' vars '+vars(x)+' vs '+vars(v));
  if(/[<>"]/.test(x)) bad.push(k+' has < > or "');
  if(x===v&&/[a-z]{3}/.test(v)) same.push(k); }
console.log(code+' '+group+': '+Object.keys(src).length+' keys, missing '+miss.length+', problems '+bad.length+', same as English '+same.length);
if(miss.length) console.log('missing: '+miss.slice(0,40).join(', '));
if(bad.length) console.log('problems:\n  '+bad.slice(0,40).join('\n  '));
if(same.length) console.log('same as English (ok only for names/abbreviations): '+same.slice(0,40).join(', '));
if(miss.length||bad.length) process.exitCode=1;
