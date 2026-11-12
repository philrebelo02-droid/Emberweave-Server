// Tester B 4.7 (11 Nov 2026, "Declutter the Chapter Map Nodes": stage badges, hero fragment icons and bonus labels crowded together,
// "frequent accidental taps"; "Hide future locked bonus stages until their prerequisite main stage is completed").
// The chapter stage map's OVERLAY only (map art and node positions untouched):
//   - a bonus plate shows once its main stage is cleared (no locked plates); clearing more stages brings the next plates in;
//   - a plain stage shows its code chip only (no STAGE word); BOSS / HERO FRAGMENTS labels stay, one word per line;
//   - no two node labels / bonus plates overlap; the centre of every stage node takes its own tap (elementFromPoint);
//   - node positions are the same as before (left/top % from CH_NODES), every node still opens its stage card.
// Phone 844x390, Fold cover 882x344, PC 1440x800; chapter 1 (4 cleared) and chapter 2 (14 cleared).
// CONTROL: EW_ROOT=<c48bb4a3 copy> fails (locked plates shown, STAGE labels, overlapping labels).
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname,path.join(__dirname,'..')]}));
const delay=ms=>new Promise(r=>setTimeout(r,ms)); let child,browser,fails=0,checks=0;
const ok=(c,m)=>{ checks++; if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const SHOTS=process.env.SHOTS||'';
const VIEWS=[{id:'844x390',w:844,h:390,dpr:2.625,m:1},{id:'882x344',w:882,h:344,dpr:2.625,m:1},{id:'1440x800',w:1440,h:800,dpr:1,m:0}];
(async()=>{ const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-cdecl-'));
  try{
    const port=await freePort(), base='http://127.0.0.1:'+port;
    const env={...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
    const up=async()=>{for(const t0=Date.now();Date.now()-t0<60000;){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
    child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
    const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
    const reg=await J('/api/register',{name:'cd'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
    await delay(700); child.kill(); await delay(900);
    child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
    browser=await chromium.launch({ignoreDefaultArgs:['--mute-audio'],args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
    for(const V of VIEWS){
      const UA='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
      const ctx=await browser.newContext(Object.assign({viewport:{width:V.w,height:V.h},deviceScaleFactor:V.dpr,serviceWorkers:'block'},V.m?{isMobile:true,hasTouch:true,userAgent:UA}:{}));
      const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
      await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
      await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
      await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined',null,{timeout:120000});
      for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
      await delay(900);
      await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated'); },L);
      for(const cleared of [4,7,14]){
        await page.evaluate(async(c)=>{ await api('/api/admin/led-grant','POST',{campCleared:c}); await ledgerSync(); campViewCh=0; show('campaign'); renderRoadmap(); },cleared);
        await delay(1600);
        const M=await page.evaluate(()=>{ const ch=campViewCh, cl=portalCleared('normal'); const R=e=>{ const r=e.getBoundingClientRect(); return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height}; };
          const nodes=[...document.querySelectorAll('#cmap .cnode')], plates=[...document.querySelectorAll('#cmap .cbonus')];
          const lbls=nodes.map(n=>({c:n.dataset.code, txt:(n.querySelector('.clbl')||{}).childNodes?[...n.querySelector('.clbl').childNodes].filter(x=>x.nodeType===3||(x.classList&&x.classList.contains('ewcmLbl'))).map(x=>x.textContent.trim()).join(' ').trim():'', boss:n.classList.contains('boss'), elite:n.classList.contains('elite'),
            boxes:[...n.querySelectorAll('.clbl > span, .clbl .cstagecode')].map(R).filter(b=>b.w>0)}));
          const pb=plates.map(p=>({s:p.dataset.bonusStage, locked:p.classList.contains('locked')||p.disabled, b:R(p.querySelector('span')||p)}));
          /* every label piece and plate, owner-tagged; overlaps between different owners */
          const items=[]; lbls.forEach(l=>l.boxes.forEach(b=>items.push({o:'n'+l.c,b}))); pb.forEach(p=>items.push({o:'b'+p.s,b:p.b}));
          const ov=[]; for(let i=0;i<items.length;i++) for(let j=i+1;j<items.length;j++){ const A=items[i],B=items[j]; if(A.o===B.o) continue; const x=Math.min(A.b.r,B.b.r)-Math.max(A.b.l,B.b.l), y=Math.min(A.b.b,B.b.b)-Math.max(A.b.t,B.b.t); if(x>1&&y>1) ov.push(A.o+'/'+B.o); }
          const taps=nodes.map(n=>{ const r=n.getBoundingClientRect(); const e=document.elementFromPoint(r.left+r.width/2, r.top+r.height*0.4); return {c:n.dataset.code, mine:!!e&&n.contains(e), hit:e&&(e.className||e.tagName)}; });
          const pos=nodes.map(n=>[n.dataset.code,n.style.left,n.style.top]);
          return {ch,cl,lbls,pb,ov,taps,pos}; });
        const tag=V.id+' ch'+M.ch+' ('+M.cl+' cleared)';
        const first=(M.ch-1)*10, wantPlates=[3,4,6,7,9,10].filter(s=>first+s<=M.cl).map(s=>M.ch+'-'+s);
        ok(M.pb.every(p=>!p.locked)&&M.pb.map(p=>p.s).join()===wantPlates.join(),tag+': only unlocked bonus plates shown ['+M.pb.map(p=>p.s).join(',')+'] want ['+wantPlates.join(',')+']');
        ok(M.lbls.filter(l=>!l.boss&&!l.elite).every(l=>l.txt===''),tag+': plain stages show the code chip only ('+M.lbls.filter(l=>!l.boss&&!l.elite).map(l=>l.c+(l.txt?':'+l.txt:'')).join(' ')+')');
        ok(M.lbls.filter(l=>l.boss).every(l=>l.txt.length>0)&&M.lbls.filter(l=>l.elite).every(l=>l.txt.length>0),tag+': BOSS and HERO FRAGMENTS labels kept');
        ok(M.ov.length===0,tag+': no label or plate overlaps another node\'s ('+(M.ov.slice(0,6).join(' ')||'none')+')');
        ok(M.taps.every(t=>t.mine),tag+': the centre of every stage node takes its own tap ('+M.taps.filter(t=>!t.mine).map(t=>t.c+'->'+t.hit).join(' ')+')');
        const want=await page.evaluate(ch=>CH_NODES[ch].map(n=>[n[0],n[1]]),M.ch);
        ok(M.pos.length===10&&M.pos.every((p,i)=>parseFloat(p[2])===want[i][1]),tag+': node positions unchanged (CH_NODES)');
        if(SHOTS){ fs.mkdirSync(SHOTS,{recursive:true}); await page.screenshot({path:path.join(SHOTS,'cd_'+V.id+'_cleared'+cleared+'.png')}); }
      }
      /* a node still opens its stage card */
      const opened=await page.evaluate(()=>{ let got=null; const o=openStageModal; openStageModal=function(g,m){ got=g; }; const n=document.querySelector('#cmap .cnode.current'); n.click(); openStageModal=o; return {got, want:+n.dataset.stagePlate}; });
      ok(opened.got===opened.want,V.id+' the current stage node opens its stage card ('+opened.got+')');
      ok(!errs.length,V.id+' no page errors '+errs.slice(0,3).join(' | '));
      await ctx.close();
    }
  } catch(e){ fails++; console.log('  FAIL '+(e&&e.stack||e)); }
  finally{ try{ await browser.close(); }catch(_){} if(child){ child.kill(); for(let i=0;i<100&&child.exitCode===null&&child.signalCode===null;i++) await delay(50); } }
  console.log('test_tr1364_chapter_declutter.js: '+(checks-fails)+'/'+checks+' passed, '+fails+' failed'); process.exit(fails?1:0); })();
