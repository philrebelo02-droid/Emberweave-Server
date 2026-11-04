// LANGUAGES step 2 (Phil 4 Nov 2026: "I need everything thats translatable to be translated") - the one build for the page's text.
// The page is rebuilt from the v1270 base (BASE below) + every edit spec in tools/lang/specs/*.json, so a re-run is exact and
// two specs can never fight over the same text:
//   spec = { "keys": { "<area>.<name>": "English with {vars}" }, "edits": [ { "line": <base line>, "find": "...", "replace": "..." } ] }
//   - "line" is the 1-based line of the BASE page; "find" lies on that line (one line, no CR/LF; "replace" may hold \n, written as CRLF) and occurs there once
//     (or give "nth": 0-based occurrence on that line). Edits may not overlap.
// Then: lang/en.json = base en + every spec's keys; lang/<code>.json = base file + tools/lang/tr/<code>/*.json; keys a language
// lacks are listed (tests/test_lang_step2.js fails on them); the page's inline EW_LANG_EN and EW_LANG_V (?v= hashes) are written.
// The page keeps CRLF line endings. Every <script> block of the result must compile (vm.Script) or nothing is written.
// Usage: node tools/lang/build.js [--build <BUILD_ID>] [--check [--only <spec.json>]]
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),vm=require('vm');
const ROOT=path.join(__dirname,'..','..');
const BASE='88bcea5a8eea4be1df48e3111ecbf9ad7a64f7d1';   // v1270
const CODES=['en','es','pt-BR','fr','de','it','nl','ru','tr','ja','ko','zh-Hans','zh-Hant','th','id','hi'];
const arg=k=>{ const i=process.argv.indexOf(k); return i<0?null:(process.argv[i+1]||true); };
const CHECK=!!arg('--check');
const gitShow=p=>cp.execFileSync('git',['show',BASE+':'+p],{cwd:ROOT,maxBuffer:64<<20}).toString('utf8');
const die=m=>{ console.error('lang build: '+m); process.exit(1); };

// ---- 1. the base page (CRLF) and its line starts ----
let base=gitShow('emberweave-heroes.html').replace(/\r?\n/g,'\r\n');
const starts=[0]; for(let i=0;i<base.length;i++) if(base[i]==='\n') starts.push(i+1);
const lineText=n=>base.slice(starts[n-1],(starts[n]||base.length+2)-2);

// ---- 2. specs ----
const SPEC_DIR=path.join(__dirname,'specs');
const ONLY=arg('--only');   // check one spec alone (with --check): node tools/lang/build.js --check --only market.json
const specFiles=(fs.existsSync(SPEC_DIR)?fs.readdirSync(SPEC_DIR).filter(f=>f.endsWith('.json')).sort():[]).filter(f=>!ONLY||f===ONLY||f.startsWith('00_'));
const enBase=JSON.parse(gitShow('lang/en.json')); const EN=Object.assign({},enBase); const keyFrom={};
const edits=[]; const problems=[];
for(const f of specFiles){ let s; try{ s=JSON.parse(fs.readFileSync(path.join(SPEC_DIR,f),'utf8')); }catch(e){ die(f+': bad JSON '+e.message); }
  for(const [k,v] of Object.entries(s.keys||{})){
    if(!/^[a-z][a-z0-9]*\.[a-z0-9_]+$/.test(k)) problems.push(f+': bad key name '+k);
    if(typeof v!=='string'||!v) problems.push(f+': empty text for '+k);
    if(k in EN && EN[k]!==v) problems.push(f+': key '+k+' already means "'+EN[k]+'" ('+(keyFrom[k]||'step 1')+'), not "'+v+'"');
    EN[k]=v; keyFrom[k]=keyFrom[k]||f; }
  for(const e of (s.edits||[])){ const n=e.line|0;
    if(!n||n>starts.length){ problems.push(f+': bad line '+e.line); continue; }
    if(typeof e.find!=='string'||!e.find||/[\r\n]/.test(e.find)||typeof e.replace!=='string'||/\r/.test(e.replace)){ problems.push(f+': line '+n+' find must be one line; replace may hold \\n (written as CRLF), never \\r'); continue; }
    const lt=lineText(n); const hits=[]; let p=-1; while((p=lt.indexOf(e.find,p+1))>=0) hits.push(p);
    const nth=e.nth==null?null:e.nth|0;
    if(!hits.length){ problems.push(f+': line '+n+' does not contain '+JSON.stringify(e.find.slice(0,90))); continue; }
    if(nth==null&&hits.length>1){ problems.push(f+': line '+n+' has '+hits.length+' copies of '+JSON.stringify(e.find.slice(0,90))+' (add "nth")'); continue; }
    if(nth!=null&&nth>=hits.length){ problems.push(f+': line '+n+' nth '+nth+' out of range'); continue; }
    const at=starts[n-1]+hits[nth==null?0:nth];
    edits.push({at,end:at+e.find.length,rep:e.replace.replace(/\n/g,'\r\n'),src:f+':'+n}); } }
edits.sort((a,b)=>a.at-b.at);
for(let i=1;i<edits.length;i++) if(edits[i].at<edits[i-1].end) problems.push('overlap: '+edits[i-1].src+' and '+edits[i].src);
if(problems.length) die(problems.length+' problem(s):\n  '+problems.slice(0,80).join('\n  '));
let page=''; let pos=0; for(const e of edits){ page+=base.slice(pos,e.at)+e.rep; pos=e.end; } page+=base.slice(pos);

// ---- 3. every key the page uses exists ----
const used=new Set([...page.matchAll(/(?<![\w$.])(?:t|ewT)\('([a-z][a-z0-9]*\.[a-z0-9_]+)'/g)].map(m=>m[1]).concat([...page.matchAll(/data-i18n(?:-ph|-title)?="([^"]+)"/g)].map(m=>m[1])));
const unknown=[...used].filter(k=>!(k in EN)&&!/^err\./.test(k)); if(unknown.length) die('the page uses keys English lacks: '+unknown.slice(0,40).join(', '));

// ---- 4. language files ----
const sorted=o=>Object.fromEntries(Object.keys(o).sort().map(k=>[k,o[k]]));
const out={en:sorted(EN)}; const missing={};
for(const c of CODES.slice(1)){ const d=JSON.parse(gitShow('lang/'+c+'.json')); const dir=path.join(__dirname,'tr',c);
  if(fs.existsSync(dir)) for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort()){ let j; try{ j=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')); }catch(e){ die('tr/'+c+'/'+f+': bad JSON '+e.message); }
    for(const [k,v] of Object.entries(j)){ if(!(k in EN)){ continue; } if(typeof v==='string'&&v.trim()) d[k]=v; } }
  for(const k of Object.keys(d)) if(!(k in EN)) delete d[k];
  missing[c]=Object.keys(EN).filter(k=>!(k in d));
  out[c]=sorted(d); }
// ---- 4b. game content (v1271): tools/lang/content/en.json = {template: area} (written by collect_content.js); a language's
//      translations are tools/lang/content/<code>/*.json {template: translation}; lang/<code>.content.json holds the ones English still has ----
const CDIR=path.join(__dirname,'content'); const CEN=fs.existsSync(path.join(CDIR,'en.json'))?JSON.parse(fs.readFileSync(path.join(CDIR,'en.json'),'utf8')):{};
const ctext={}, CV={}, cmissing={}; const tokOf=s=>(String(s).match(/\{[^{}]*\}|<\/?[a-z][^>]*>/gi)||[]).sort().join(' ');
for(const c of CODES.slice(1)){ const d={}; const dir=path.join(CDIR,c);
  if(fs.existsSync(dir)) for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort()){ let j; try{ j=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')); }catch(e){ die('content/'+c+'/'+f+': bad JSON '+e.message); }
    for(const [k,v] of Object.entries(j)) if(k in CEN&&typeof v==='string'&&v.trim()){ if(tokOf(v)!==tokOf(k)) problems.push('content/'+c+'/'+f+': tokens differ for '+JSON.stringify(k.slice(0,60))); else d[k]=v; } }
  cmissing[c]=Object.keys(CEN).filter(k=>!(k in d));
  if(Object.keys(d).length){ ctext[c]=JSON.stringify(sorted(d)); CV[c]=crypto.createHash('sha1').update(ctext[c]).digest('hex').slice(0,8); } }
if(problems.length) die(problems.length+' problem(s):\n  '+problems.slice(0,80).join('\n  '));
page=page.replace(/\nconst EW_LANG_CV=\{.*?\};/,()=>'\nconst EW_LANG_CV='+JSON.stringify(CV)+';');
const text={}; for(const c of CODES) text[c]=JSON.stringify(out[c]);
const V={}; for(const c of CODES) V[c]=crypto.createHash('sha1').update(text[c]).digest('hex').slice(0,8);
page=page.replace(/\nconst EW_LANG_EN=\{.*?\};\r\n/,()=>'\nconst EW_LANG_EN='+text.en+';\r\n').replace(/\nconst EW_LANG_V=\{.*?\};\r\n/,()=>'\nconst EW_LANG_V='+JSON.stringify(V)+';\r\n');
const bid=arg('--build'); if(bid&&bid!==true){ page=page.replace(/\nconst BUILD_ID = '\d+';/,"\nconst BUILD_ID = '"+bid+"';"); }

// ---- 5. every inline script compiles ----
for(const m of page.matchAll(/<script>([\s\S]*?)<\/script>/g)){ try{ new vm.Script(m[1],{filename:'page-script@'+page.slice(0,m.index).split('\n').length}); }catch(e){
  const ln=(e.stack||'').match(/page-script@(\d+):(\d+)/); die('script does not compile: '+e.message+(ln?' (block line '+ln[1]+' +'+ln[2]+')':'')); } }

const mc=Object.entries(missing).filter(([c,l])=>l.length).map(([c,l])=>c+' '+l.length);
console.log('lang build: '+specFiles.length+' specs, '+edits.length+' edits, '+Object.keys(EN).length+' keys ('+(Object.keys(EN).length-Object.keys(enBase).length)+' new)'+(mc.length?'; untranslated: '+mc.join(', '):'; every language complete'));
const cmc=Object.entries(cmissing).filter(([c,l])=>l.length).map(([c,l])=>c+' '+l.length);
console.log('lang content: '+Object.keys(CEN).length+' templates'+(cmc.length?'; untranslated: '+cmc.join(', '):'; every language complete'));
if(CHECK) return;
fs.writeFileSync(path.join(ROOT,'emberweave-heroes.html'),page);
for(const c of CODES) fs.writeFileSync(path.join(ROOT,'lang',c+'.json'),text[c]);
for(const c of CODES.slice(1)){ const f=path.join(ROOT,'lang',c+'.content.json'); if(ctext[c]) fs.writeFileSync(f,ctext[c]); else if(fs.existsSync(f)) fs.unlinkSync(f); }
fs.writeFileSync(path.join(__dirname,'content_missing.json'),JSON.stringify(cmissing,null,0));
if(bid&&bid!==true){ fs.writeFileSync(path.join(ROOT,'version.json'),'{"build":"'+bid+'"}');
  const sw=path.join(ROOT,'sw.js'); fs.writeFileSync(sw,fs.readFileSync(sw,'utf8').replace(/const BUILD='\d+';/,"const BUILD='"+bid+"';")); }
fs.writeFileSync(path.join(__dirname,'missing.json'),JSON.stringify(missing,null,0));
