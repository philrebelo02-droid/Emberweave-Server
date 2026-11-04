// LANGUAGES step 2: every t('key') call in the page must reach the global t() - a function that declares its own local `t`
// (const t=HERO_TYPES[key] ...) would turn t('x') into a TypeError. Parses each inline <script> with Babel (bundled in playwright)
// and lists t(...) calls whose `t` binds to anything but the global. ewT() is the safe spelling inside such functions.
// Usage: node tools/lang/shadow.js [file]   (exit 1 on any hit)
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..');
const bb=require(path.join(ROOT,'node_modules','playwright','lib','transform','babelBundle.js'));
const NL=String.fromCharCode(10);
function shadowCheck(page,log){ log=log||(()=>{}); let hits=0, calls=0; const list=[];
for(const m of page.matchAll(/<script>([\s\S]*?)<\/script>/g)){
  const line0=page.slice(0,m.index).split(NL).length-1;
  // Babel parses as a module (strict): a name declared twice at top level (legal in the page's sloppy script) is renamed in place
  let src=m[1], ast=null;
  for(let tries=0;tries<500&&!ast;tries++){ try{ ast=bb.babelParse(src,'page.js',false); }catch(e){
    const msg=String(e.message).split(NL)[0]; if(process.env.SHDBG) console.log(tries,msg.slice(-100),e.pos);
    const d=/Identifier '([\w$]+)' has already been declared/.exec(msg);
    if(d&&e.pos!=null){ const at=src.indexOf(d[1],e.pos); if(at>=0&&at<e.pos+200){ src=src.slice(0,at)+'__dup'+tries+'_'+src.slice(at); continue; } }
    log('parse error near line '+(line0+(e.loc?e.loc.line:0))+': '+msg); break; } }
  if(!ast){ log('could not parse the script at line '+(line0+1)); hits++; continue; }
  bb.traverse(ast,{ CallExpression(p){ const c=p.node.callee; if(c.type!=='Identifier'||c.name!=='t') return;
    const a=p.node.arguments[0]; if(!a||a.type!=='StringLiteral'||!/^[a-z][a-z0-9]*\.[a-z0-9_]+$/.test(a.value)) return;
    calls++; const b=p.scope.getBinding('t');
    if(b&&!(b.kind==='hoisted'&&b.scope.path.isProgram())){ hits++; list.push(a.value); log('line '+(line0+c.loc.start.line)+": t('"+a.value+"') binds a local t ("+b.kind+' at line '+(line0+b.identifier.loc.start.line)+')'); } } });
}
return {calls,hits,list}; }
module.exports=shadowCheck;
if(require.main===module){ const file=process.argv[2]||path.join(ROOT,'emberweave-heroes.html');
  const r=shadowCheck(fs.readFileSync(file,'utf8'),m=>console.log(m));
  console.log('shadow: '+r.calls+' t() calls, '+r.hits+' shadowed'); if(r.hits) process.exitCode=1; }
