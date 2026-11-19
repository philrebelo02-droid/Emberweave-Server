// v1425 (Soul Eater 19 Nov 2026: "The icon to send to mining is still at the very bottom" - with a big roster the Send button sat under
// every hero card and needed a scroll; Phil: "Yes to fix his first idea"): the mine march picker puts Send at the TOP like the attack march
// (v1248). Real page, offline, a full roster, phone landscape + desktop + phone portrait, English and Spanish:
//  1. Send is visible without scrolling (inside the viewport and the dialog's visible box) and above the first hero card
//  2. the dialog still scrolls for the heroes, and picking a hero still updates the count beside Send
// CONTROL: the v1424 page (EW_MINE_REF=cbc4e62d4 runs that tree) must fail check 1 on the phone sizes.
'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),{execFileSync}=require('child_process');
let ROOT=path.resolve(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
if(process.env.EW_MINE_REF){ const wt=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'ew-mine-')),'wt'); execFileSync('git',['worktree','add','--detach',wt,process.env.EW_MINE_REF],{cwd:ROOT,stdio:'ignore'});
  process.on('exit',()=>{ try{ execFileSync('git',['worktree','remove','--force',wt],{cwd:path.resolve(__dirname,'..'),stdio:'ignore'}); }catch(e){} }); ROOT=wt; }
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(c,m)=>{ if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
const TYPES={'.html':'text/html','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const srv=http.createServer((q,s)=>{ let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/'||u==='/play') u='/emberweave-heroes.html';
  const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ s.writeHead(404); return s.end(); }
  s.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s); });
(async()=>{ await new Promise(r=>srv.listen(0,'127.0.0.1',r)); const base='http://127.0.0.1:'+srv.address().port;
  let browser;
  try{ browser=await chromium.launch({ignoreDefaultArgs:['--mute-audio'],args:['--disable-audio-output']});
    for(const vp of [{w:844,h:390,n:'phone-landscape'},{w:1280,h:720,n:'desktop'},{w:390,h:844,n:'phone-portrait'}]) for(const lang of ['en','es']){ const tag=lang+'/'+vp.n;
      const ctx=await browser.newContext({viewport:{width:vp.w,height:vp.h},serviceWorkers:'block'}); const page=await ctx.newPage();
      await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
      await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
      await page.waitForFunction(()=>typeof openMineSelect==='function'&&typeof HERO_KEYS!=='undefined',null,{timeout:120000});
      await page.evaluate(async l=>{ for(const k of HERO_KEYS) G.unlocked[k]=true; G.team=HERO_KEYS.slice(0,5); try{ await langLoad(l); }catch(e){}
        document.querySelectorAll('#tutOffer,#authGate,#rotateGate').forEach(e=>e.remove());
        openMineSelect({id:'t1',res:'silver',level:9,x:10,y:10,name:'Test'}); },lang);
      await delay(700);
      const r=await page.evaluate(()=>{ const go=document.getElementById('mcGo'); const dlg=go&&go.closest('[style*="overflow:auto"]'); const first=document.querySelector('.mc-hero');
        const R=e=>e.ewGameRect?e.ewGameRect():e.getBoundingClientRect();   // game coordinates: the portrait view turns the whole page
        const g=R(go), d=R(dlg), f=R(first);
        return {inView:dlg.scrollTop===0&&g.width>0&&g.height>0, inDlg:g.top>=d.top-1&&g.bottom<=d.bottom+1&&g.left>=d.left-1&&g.right<=d.right+1, above:g.bottom<=f.top+1, scrolls:dlg.scrollHeight>dlg.clientHeight+4, heroes:document.querySelectorAll('.mc-hero').length, txt:go.textContent.trim()}; });
      ok(r.inView&&r.inDlg&&r.above,tag+': Send ("'+r.txt+'") is on screen without scrolling, above the '+r.heroes+' hero cards');
      const n0=await page.evaluate(()=>document.getElementById('mcGo').parentElement.textContent.match(/(\d)\/5/)[1]);
      await page.evaluate(()=>{ document.querySelector('.mc-hero[data-k="'+G.team[0]+'"]').click(); });   // the team is full (5/5): tapping a picked hero drops it
      await delay(200);
      const n1=await page.evaluate(()=>document.getElementById('mcGo').parentElement.textContent.match(/(\d)\/5/)[1]);
      ok(n0!==n1,tag+': tapping a hero updates the count beside Send ('+n0+'/5 -> '+n1+'/5)');
      if(process.env.MINE_SHOTS&&lang==='es'){ fs.mkdirSync(process.env.MINE_SHOTS,{recursive:true}); await page.screenshot({path:path.join(process.env.MINE_SHOTS,'mine-'+vp.n+'.png')}); }
      await ctx.close(); }
  } finally { try{ await browser.close(); }catch(e){} srv.close(); }
  console.log(fails?'FAIL '+fails:'PASS'); process.exit(fails?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
