'use strict';
/* v1469 screen-test rig on top of screens-lockdown.js: every phase prints "STEP <name> t=<s>", every wait has a hard cap with a clear
   message, page scripts / server calls / game loads are capped, and a whole-file watchdog prints the step it is on and exits 1 when the
   file runs past its limit (the cluster runner only shows a job's output when the job ends, so a hang must end the job itself). */
const H=require('./screens-lockdown.js');

function rig(test,opt){ opt=opt||{}; const limitMin=opt.limitMin||12;
  const C=H.checker(test), shot=H.shooter(test), T0=Date.now(); let cur='start';
  const sec=()=>((Date.now()-T0)/1000).toFixed(1);
  const step=name=>{ cur=name; console.log('STEP '+name+' t='+sec()); };
  const wd=setTimeout(()=>{ console.log('WATCHDOG '+test+': still running after '+limitMin+' min, on step "'+cur+'" (t='+sec()+' s) - exiting 1');
    try{ C.ok(false,'the file finished within '+limitMin+' minutes (it was on step "'+cur+'")'); C.done(); }catch(e){} process.exit(1); },limitMin*60000);
  /* a promise with a hard cap: rejects with what was being waited for */
  const cap=(p,ms,what)=>{ let tm; return Promise.race([Promise.resolve(p).finally(()=>clearTimeout(tm)),
    new Promise((_,rej)=>{ tm=setTimeout(()=>rej(new Error('TIMEOUT after '+Math.round(ms/1000)+' s: '+what+' (step "'+cur+'")')),ms); })]); };
  /* a page condition with a hard cap: true, or false with a WAIT-TIMEOUT line naming it */
  const waitFor=async(pg,fn,arg,ms,what,poll)=>{ try{ await pg.waitForFunction(fn,arg,{timeout:ms,polling:poll||100}); return true; }
    catch(e){ console.log('  WAIT-TIMEOUT '+what+' (not true within '+Math.round(ms/1000)+' s, step "'+cur+'")'); return false; } };
  const game=async(port,S)=>{ const pg=await cap(H.game(port,{w:S.w,h:S.h,touch:S.touch}),240000,'the game loading at '+S.tag);
    pg.setDefaultTimeout(20000); const ev=pg.evaluate.bind(pg); pg.evaluate=(fn,arg)=>cap(ev(fn,arg),60000,'a page script'); return pg; };
  const server=(file,env)=>cap(H.server(file,env),150000,'the server starting');
  const stop=s=>s?cap(s.stop(),15000,'the server stopping').catch(e=>console.log('  INFO   '+e.message)):null;
  const api=(s,p,m,b)=>cap(s.api(p,m,b),30000,'the server answering '+p);
  const closeCtx=async pg=>{ if(pg) await cap(pg._ctx.close(),20000,'closing the browser context').catch(e=>console.log('  INFO   '+e.message)); };
  const finish=async()=>{ clearTimeout(wd); step('done'); C.done(); await cap(H.closeBrowser(),20000,'closing the browser').catch(()=>{}); process.exit(process.exitCode||0); };
  return {C,shot,step,cap,waitFor,game,server,stop,api,closeCtx,finish,sec,get cur(){ return cur; }}; }

const press=(pg,S,sel)=>S.touch?pg.tap(sel,{timeout:10000}):pg.click(sel,{timeout:10000});
/* a player's tap; if something covers the element (playwright refuses the tap), the element's own click, and that is printed */
async function tapEl(pg,S,sel){ try{ await press(pg,S,sel); return 'tap'; }catch(e){
  const ok=await pg.evaluate(s=>{ const el=document.querySelector(s); if(!el) return false; el.click(); return true; },sel);
  const why=String(e.message||e).split('\n'), line=why.find(l=>/intercept|not visible|outside/i.test(l))||why[0];
  return ok?'js click (tap refused: '+line.trim().slice(0,140)+')':'missing'; } }
async function tapAt(pg,S,x,y){ if(S.touch) await pg.touchscreen.tap(x,y); else await pg.mouse.click(x,y); }
const mmss=s=>{ const m=/^(\d+):(\d+)$/.exec(String(s||'').trim()); return m?(+m[1])*60+(+m[2]):null; };

module.exports={rig,press,tapEl,tapAt,mmss};
