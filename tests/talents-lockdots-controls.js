'use strict';
/* The controls for the locked-hero and red-dot tests on the server and in the rules (14 Nov 2026; run on the cluster through tools/remote_test.sh as a
   plain node script). Each control copies this checkout to a folder under os.tmpdir() (node_modules and assets linked, not copied), breaks ONE thing
   there (an exact text swap, or one extra file), runs the named tests in that copy and expects them to FAIL. ONE copy at a time, each deleted as soon
   as it has run; the checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught.
   The page's controls (the lock, the dot, its cache, the card refresh) run inside tests/talents-ui.test.js itself, which needs this PC's art.
   CHECK=1: only checks that every text to break is found exactly once (no test is run). */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const SV='server.js', TJ='talents.js', ST='tests/talents-server.test.js', RT='tests/talents-rules.test.js';
const LEARN='locked hero: learning is refused', INPROC='locked hero: a saved build reaches no', WL='wired heroes:', DOT='anyLearnable';
const C=[
  // [name, file, text, replacement, test file, test-name pattern]   (file null: `text` is a file to ADD with `replacement` as its content)
  ['the learn route lets an unwired hero learn',SV,"      if(!isReset&&!talentWired(key)) return {ok:false,locked:true,","      if(false) return {ok:false,locked:true,",ST,LEARN],
  ['talentListFor lets an unwired hero\'s build through',SV,"if(!b||!TALENTS.has(key)||!talentWired(key)) return null;","if(!b||!TALENTS.has(key)) return null;",ST,INPROC],
  ['every hero counted as wired',SV,"const TALENT_WIRED=new Set((TALENT_FX&&typeof TALENT_FX.mechHeroes==='function')?TALENT_FX.mechHeroes():[]);","const TALENT_WIRED={has:()=>true};",ST,LEARN+'|'+INPROC],
  ['no hero counted as wired (the wired hero\'s build is dropped too)',SV,"const TALENT_WIRED=new Set((TALENT_FX&&typeof TALENT_FX.mechHeroes==='function')?TALENT_FX.mechHeroes():[]);","const TALENT_WIRED=new Set();",ST,LEARN+'|'+INPROC],
  ['anyLearnable always no',TJ,"    const sp=spent(hero,build); if(sp.total>=pointsTotal(level)) return false;","    return false; const sp=spent(hero,build);",RT,DOT],
  ['anyLearnable always yes',TJ,"    const sp=spent(hero,build); if(sp.total>=pointsTotal(level)) return false;","    return true; const sp=spent(hero,build);",RT,DOT],
  ['a mech file that talents-fx.js was not built from',null,'talents-mech/zz_unbuilt.js',"module.exports={talents:{}};\n",RT,WL],
];
const SKIP=new Set(['.logs','.base','.bin','.git','.tmp','node_modules','assets','backups','.remote-logs']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k),'junction'); }
const swap=(s,from)=>from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n');
function count(file,from){ const s=fs.readFileSync(path.join(root,file),'utf8'); return s.split(swap(s,from)).length-1; }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,tf,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-lockdots-ctl-'));
  const done=r=>{ try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(e){} res(r); };
  try{ copyTo(dir);
    if(file===null){ if(fs.existsSync(path.join(dir,from))) return done({name,ok:false,why:from+' already exists'}); fs.writeFileSync(path.join(dir,from),to); }
    else { const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=swap(s,from), n=s.split(a).length-1;
      if(n!==1) return done({name,ok:false,why:'the text to break was found '+n+' times'}); fs.writeFileSync(p,s.replace(a,()=>to)); }
  }catch(e){ return done({name,ok:false,why:'copy failed: '+String(e.message||e).slice(0,200)}); }
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,tf],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',()=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1; done({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
if(process.env.CHECK){ let bad=0; for(const c of C){ if(c[1]===null){ if(fs.existsSync(path.join(root,c[2]))){ bad++; console.log('EXISTS: '+c[0]); } continue; } const n=count(c[1],c[2]); if(n!==1){ bad++; console.log('NOT ONCE ('+n+'): '+c[0]); } }
  console.log(C.length+' controls, '+bad+' not usable'); process.exit(bad?1:0); }
(async()=>{ const out=[];
  for(const c of C){ const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }   // one copy at a time
  const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
