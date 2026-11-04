// LANGUAGES step 2 - FINISH CHECK 4: every player-facing error text the server can send has a stable code (server/error-codes.js)
// with a translation in all 16 languages. Reads server.js + server/*.js with Babel: every `error:` property whose value is a string,
// a template literal or a + concatenation is turned into a sample text (each ${...} / non-literal part -> "7") and looked up with
// errorInfo(). A miss is listed unless tools/lang/srv_allow.json allows it (machine tokens the client maps itself, dev/admin-only
// replies - each with a reason). Then every err.<code> key must be non-empty in every lang/<code>.json.
// Usage: node tools/lang/srvcheck.js [--list]    (exit 1 on any miss)
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..');
const bb=require(path.join(ROOT,'node_modules','playwright','lib','transform','babelBundle.js'));
const EC=require(path.join(ROOT,'server','error-codes.js'));
const ALLOW=(()=>{ try{ return JSON.parse(fs.readFileSync(path.join(__dirname,'srv_allow.json'),'utf8')); }catch(e){ return {}; } })();
const ALLOW_RE=(ALLOW.patterns||[]).map(p=>new RegExp(p.re)); const ALLOW_FILES=new Set(Object.keys(ALLOW.files||{}));
const files=['server.js'].concat(fs.readdirSync(path.join(ROOT,'server')).filter(f=>f.endsWith('.js')).map(f=>'server/'+f)).filter(f=>!ALLOW_FILES.has(f));
// every text a value can produce (a ?: of two literals gives both), non-literal parts as "7"; null when nothing literal is in it
const samples=n=>{ if(!n) return null; if(n.type==='StringLiteral') return [n.value];
  if(n.type==='ConditionalExpression'){ const a=samples(n.consequent), b=samples(n.alternate); return (a||b)?[...(a||['7']),...(b||['7'])]:null; }
  if(n.type==='TemplateLiteral'){ let out=['']; n.quasis.forEach((q,i)=>{ out=out.map(s=>s+q.value.cooked); if(i<n.expressions.length){ const e=samples(n.expressions[i])||['7']; out=out.flatMap(s=>e.map(x=>s+x)).slice(0,16); } }); return out; }
  if(n.type==='BinaryExpression'&&n.operator==='+'){ const a=samples(n.left), b=samples(n.right); if(!a&&!b) return null; return (a||['7']).flatMap(x=>(b||['7']).map(y=>x+y)).slice(0,16); }
  return null; };
const sample=n=>{ const s=samples(n); return s?s[s.length-1]:null; };
const miss=[]; let seen=0;
for(const f of files){ let src=fs.readFileSync(path.join(ROOT,f),'utf8').replace(/^#!.*/,''), ast=null;
  // Babel parses as a module (strict): a function declared twice (legal in sloppy scripts) is renamed in place
  for(let tries=0;tries<300&&!ast;tries++){ try{ ast=bb.babelParse(src,'x.js',false); }catch(e){ const msg=String(e.message).split('\n')[0];
    const d=/Identifier '([\w$]+)' has already been declared/.exec(msg); if(d&&e.pos!=null){ const at=src.indexOf(d[1],e.pos); if(at>=0&&at<e.pos+200){ src=src.slice(0,at)+'__dup'+tries+'_'+src.slice(at); continue; } }
    console.log('PARSE FAILED '+f+': '+msg); miss.push({file:f,line:0,text:'(could not parse)'}); break; } }
  if(!ast) continue;
  bb.traverse(ast,{ ObjectProperty(p){ const k=p.node.key; if(!((k.type==='Identifier'&&k.name==='error')||(k.type==='StringLiteral'&&k.value==='error'))) return;
    const v=p.node.value; const cands=v.type==='ConditionalExpression'?[v.consequent,v.alternate]:v.type==='LogicalExpression'?[v.left,v.right]:[v];
    for(const c of cands) for(const s of (samples(c)||[])){ if(!/[A-Za-z]{2}/.test(s)) continue; seen++;
      if(/^[a-z0-9_]+$/.test(s)) continue;   // a machine token (auth, offline, busy ...) - the client words it itself
      if(EC.errorInfo(s)) continue; if(ALLOW_RE.some(r=>r.test(s))) continue;
      miss.push({file:f,line:c.loc.start.line,text:s}); } } }); }
const CODES=['en','es','pt-BR','fr','de','it','nl','ru','tr','ja','ko','zh-Hans','zh-Hant','th','id','hi'];
const noTr=[]; for(const {code} of EC.table()){ for(const c of CODES){ const d=JSON.parse(fs.readFileSync(path.join(ROOT,'lang',c+'.json'),'utf8')); if(typeof d['err.'+code]!=='string'||!d['err.'+code].trim()) noTr.push(c+':err.'+code); } }
if(process.argv.includes('--list')) for(const m of miss) console.log(m.file+':'+m.line+'  '+m.text.slice(0,140));
if(noTr.length) console.log('no translation: '+noTr.slice(0,20).join(', '));
console.log('srvcheck: '+seen+' error texts read, '+miss.length+' without a code, '+noTr.length+' code translations missing ('+EC.table().length+' codes)');
if(miss.length||noTr.length) process.exitCode=1;
