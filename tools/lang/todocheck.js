// LANGUAGES step 2: check a translator's file against a todo list.
// Usage: node tools/lang/todocheck.js <todo.json> <translation.json>
// Lists keys missing / empty, values whose {vars} / {0} placeholders / {i:..} icon tokens / HTML tags differ from the English,
// and values left identical to the English. Exit 1 on missing or mismatched.
'use strict';
const fs=require('fs');
const [a,b]=process.argv.slice(2); if(!a||!b){ console.error('usage: todocheck.js <todo.json> <translation.json>'); process.exit(2); }
const src=JSON.parse(fs.readFileSync(a,'utf8'));
let tr={}; try{ tr=JSON.parse(fs.readFileSync(b,'utf8')); }catch(e){ console.log('BAD JSON '+b+': '+e.message); process.exit(1); }
const toks=s=>(String(s).match(/\{[^{}]*\}/g)||[]).sort().join(' ');
const tags=s=>(String(s).match(/<\/?[a-z][^>]*>/gi)||[]).map(x=>x.replace(/\s.*$/,'').toLowerCase()).sort().join(' ');
const miss=[],bad=[],same=[];
for(const [k,v] of Object.entries(src)){ const x=tr[k];
  if(typeof x!=='string'||!x.trim()){ miss.push(k); continue; }
  if(toks(x)!==toks(v)) bad.push(k+'  tokens ['+toks(x)+'] vs English ['+toks(v)+']');
  if(tags(x)!==tags(v)) bad.push(k+'  tags ['+tags(x)+'] vs English ['+tags(v)+']');
  if(x===v&&/[A-Za-z]{3}/.test(v.replace(/\{[^{}]*\}/g,''))) same.push(k); }
console.log(b+': '+Object.keys(src).length+' to do, missing '+miss.length+', mismatched '+bad.length+', same as English '+same.length);
if(miss.length) console.log('missing: '+miss.slice(0,60).join(', '));
if(bad.length) console.log('mismatched:\n  '+bad.slice(0,60).join('\n  '));
if(same.length) console.log('same as English (fine only for proper names / abbreviations like HP, ATK): '+same.slice(0,60).join(', '));
if(miss.length||bad.length) process.exitCode=1;
