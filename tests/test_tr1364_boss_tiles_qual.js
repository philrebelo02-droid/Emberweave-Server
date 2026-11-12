// Tester A P9 (11 Nov 2026, "enemy / boss art looks low quality" on a phone) + Grok's QUAL finding.
// Emulated phone (Android UA, 844x390, DPR 2.625, touch) in a real boss fight, campaign 1-10 (Brukk) with 5 heroes:
//   1. RESOLUTION: QUAL starts unset, so qualityInit runs - the phone starts at its own DPR (v507) and QUAL.max = min(DPR, 3);
//      the Graphics setting still caps the buffer (Balanced 2, Low 1) and the qualityTick governor still sheds / earns 0.25 steps.
//   2. BOSS TILES: every boss sheet the 2048 rule used to shrink uploads as column tiles <= 2048 x 2048 at FULL resolution (k = 1),
//      cells never straddle a tile, the tile pixels are the source sheet's own (compared to the file), and a drawn frame always
//      samples the tile that holds its column.
//   3. BUDGET: the boss fight's real GPU total (texTallyMB) <= 2048 MB and decoded bitmaps <= 400 MB (blueprint 18 rule 5).
// Prints the before/after numbers (buffer size, boss texels, GPU MB) as info lines.
// CONTROL: EW_ROOT=<a build without this change> fails 1 and 2 (QUAL.dpr 1, max 2; no tiles, boss sheets at k 0.42-0.48).
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname,path.join(__dirname,'..')]}));
const delay=ms=>new Promise(r=>setTimeout(r,ms)); let child,browser,fails=0,checks=0;
const ok=(c,m)=>{ checks++; if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
const info=m=>console.log('  info '+m);
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const SHOTS=process.env.SHOTS||'', TAG=process.env.TAG||'run';
const BMP_HOOK=`(()=>{ const BM=new Set(), fr=new FinalizationRegistry(k=>BM.delete(k)); const cib=window.createImageBitmap;
  window.createImageBitmap=function(){ return cib.apply(this,arguments).then(bm=>{ const k={w:bm.width,h:bm.height}; BM.add(k); bm.__k=k; fr.register(bm,k); return bm; }); };
  const cl=ImageBitmap.prototype.close; ImageBitmap.prototype.close=function(){ if(this.__k) BM.delete(this.__k); return cl.apply(this,arguments); };
  window.__bmpMB=()=>{ let b=0; for(const k of BM) b+=k.w*k.h*4; return b/1048576; }; })();`;
(async()=>{ const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-btiles-'));
  try{
    const port=await freePort(), base='http://127.0.0.1:'+port;
    const env={...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500'};
    const up=async()=>{for(const t0=Date.now();Date.now()-t0<60000;){try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await delay(150);}throw new Error('throwaway server did not start');};
    child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:'ignore',windowsHide:true}); await up();
    const J=async(p,b,tok)=>(await fetch(base+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:JSON.stringify(b)})).json();
    const reg=await J('/api/register',{name:'bt'+Date.now().toString(36),pass:'password1'}); const L={token:reg.token,id:reg.profile.id};
    await delay(700); child.kill(); await delay(900);
    child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...env,ADMIN_IDS:L.id},stdio:'ignore',windowsHide:true}); await up();
    browser=await chromium.launch({ignoreDefaultArgs:['--mute-audio'],args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
    const UA='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
    const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2.625,isMobile:true,hasTouch:true,userAgent:UA,serviceWorkers:'block'});
    const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
    await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
    await page.addInitScript(BMP_HOOK);
    await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
    await page.waitForFunction(()=>typeof HERO_TYPES!=='undefined'&&typeof show==='function'&&typeof ACC!=='undefined'&&typeof renderer!=='undefined'&&!!renderer,null,{timeout:120000});
    for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
    await delay(900);
    /* ---- 1. resolution at start (before any fight: the boot resize3D ran) */
    const Q0=await page.evaluate(()=>({dpr:QUAL.dpr,max:QUAL.max,DPR,dev:devicePixelRatio,scheme:(()=>{ try{ return localStorage.getItem('ew_dpr_scheme'); }catch(e){ return null; } })()}));
    info('QUAL at start: dpr '+Q0.dpr+', max '+Q0.max+', DPR used '+Q0.DPR+' (device '+Q0.dev+'), saved scheme '+Q0.scheme);
    ok(Q0.dpr===Math.min(Q0.dev,3)&&Q0.max===Math.min(Q0.dev,3),'the phone starts at its own resolution: QUAL.dpr '+Q0.dpr+', QUAL.max '+Q0.max+' (device '+Q0.dev+')');
    ok(Q0.scheme==='v511-vsync-governor','qualityInit ran (the v511 saved-resolution scheme is recorded: '+Q0.scheme+')');
    await page.evaluate(async(L)=>{ ACC.token=L.token; ACC.id=L.id; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated');
      await api('/api/admin/led-grant','POST',{unlock:['vael','sylthaine','vireo','grosk','brannus'],campCleared:9}); await ledgerSync(); },L);
    const heroes=['vael','sylthaine','vireo','grosk','brannus'];
    const st=await page.evaluate(async(heroes)=>{ QUAL.locked=true; CUR={node:10,mode:'campaign',portal:'normal'};
      const s=await api('/api/campaign/start','POST',{mode:'normal',node:10,heroIds:heroes,requestId:'bt'+Date.now()}); if(!s||!s.ok) return 'start '+(s&&s.error);
      CUR.attemptId=s.attemptId; CUR.cwaves=(s.stage&&s.stage.waves)||null; CUR.serverSnaps=s.snaps; CUR.seed=s.seed>>>0; CUR.engine=s.engine; G.squads=G.squads||{}; G.squads.campaign=heroes.slice(); G.team=heroes.slice();
      startBattle(); for(let i=0;i<600&&!(state==='battle'&&units.some(u=>u.team==='enemy'&&u.alive));i++) await new Promise(r=>setTimeout(r,100)); return state; },heroes);
    ok(st==='battle','campaign 1-10 boss fight started ('+st+')');
    await delay(2500); await page.evaluate(()=>{ paused=true; });
    const B=await page.evaluate(()=>{ const g=renderer.getContext(); return {PR:renderer.getPixelRatio(), buf:[g.drawingBufferWidth,g.drawingBufferHeight], css:[CW,CH], ov:[overlay.width,overlay.height]}; });
    info('battle buffer at 844x390 DPR 2.625: pixel ratio '+B.PR.toFixed(3)+', WebGL '+B.buf.join('x')+' + overlay '+B.ov.join('x')+' for '+B.css.join('x')+' CSS px ('+(4*(B.buf[0]*B.buf[1]+B.ov[0]*B.ov[1])/1048576).toFixed(1)+' MB RGBA)');
    ok(Math.abs(B.PR-Math.min(4.5,Q0.dev*1.5))<0.01,'battle pixel ratio follows the device: '+B.PR.toFixed(3)+' = min(4.5, DPR 2.625 x 1.5)');
    const P=await page.evaluate(()=>{ const out={}; for(const p of ['balanced','low','high']){ setGraphicsPreset(p); out[p]=renderer.getPixelRatio(); } return out; });
    ok(P.balanced===2&&P.low===1&&Math.abs(P.high-B.PR)<0.01,'the Graphics setting still caps it: High '+P.high.toFixed(3)+', Balanced '+P.balanced+', Low '+P.low);
    const GV=await page.evaluate(()=>{ QUAL.locked=false; QUAL.good=0; QUAL.bad=0; const d0=QUAL.dpr, p0=renderer.getPixelRatio(); for(let i=0;i<40;i++) qualityTick(60); const d1=QUAL.dpr, p1=renderer.getPixelRatio();
      for(let i=0;i<185;i++) qualityTick(10); const d2=QUAL.dpr, p2=renderer.getPixelRatio(); QUAL.locked=true; return {d0,d1,d2,p0,p1,p2}; });
    ok(GV.d1===+(GV.d0-0.25).toFixed(2)&&GV.p1<GV.p0,'the governor sheds 0.25 on 2 s of stutter (dpr '+GV.d0+' -> '+GV.d1+', ratio '+GV.p0.toFixed(2)+' -> '+GV.p1.toFixed(2)+')');
    ok(GV.d2===GV.d0&&GV.p2===GV.p0,'and earns it back on 3 s of good frames, up to QUAL.max (dpr -> '+GV.d2+')');
    /* ---- 2. boss tiles */
    /* the boss walks in with the last wave: load his set the way the fight does when he arrives */
    await page.evaluate(()=>{ try{ loadAnimSet('brukk'); }catch(e){} for(const k of ['idle','walk','attack','cast']){ const A=BATTLE_ANIM.brukk[k]; if(A&&!A.tex) try{ _loadClip(A); }catch(e){} } });
    await page.waitForFunction(()=>{ const s=BATTLE_ANIM.brukk; if(!s) return false; return ['idle','walk','attack','cast'].every(k=>!s[k]||(s[k].tex&&s[k].tex.image&&s[k].tex.image.width>0&&(!s[k]._tiles||s[k]._tiles.every(q=>q.tex.image&&q.tex.image.width>0)))); },null,{timeout:60000}).catch(()=>{});
    const T=await page.evaluate(()=>{ const s=BATTLE_ANIM.brukk, out=[]; for(const k of ['idle','walk','attack','cast','hurt','death']){ const A=s&&s[k]; if(!A||!A.tex||!A.fw) continue; const cols=A.cols||A.n, rows=A.rows||1;
        const tl=A._tiles?A._tiles.map(q=>({c0:q.c0,n:q.n,w:q.tex.image?q.tex.image.width:0,h:q.tex.image?q.tex.image.height:0})):null;
        const im=A.tex.image; out.push({k,u:A.u.split('/').pop(),sheet:[cols*A.fw,rows*A.fh],cols,rows,fw:A.fw,fh:A.fh,figH:A.figH,tiles:tl,
          kNow:tl?Math.min(...tl.map(q=>q.w/(q.n*A.fw))):(im?im.width/(cols*A.fw):0), kOld:texSheetK(A.fw,A.fh,cols,rows,(A.figH&&A.fh)?A.figH/A.fh:0)}); } return out; });
    T.forEach(r=>info('brukk '+r.k+' '+r.u+' '+r.sheet.join('x')+' grid '+r.cols+'x'+r.rows+': '+(r.tiles?r.tiles.length+' tiles '+r.tiles.map(q=>q.w+'x'+q.h).join(' + '):'one texture')+', texels per source px '+r.kNow.toFixed(3)+' (2048 rule alone: '+r.kOld.toFixed(3)+'), figure '+Math.round(r.figH*r.kNow)+' px (was '+Math.round(r.figH*Math.min(1,r.kOld))+')'));
    const big=T.filter(r=>r.kOld<0.99&&r.rows*r.fh<=2048);
    ok(big.length>0,'the boss has sheets the 2048 rule shrank ('+big.map(r=>r.k+' k '+r.kOld.toFixed(2)).join(', ')+')');
    ok(big.every(r=>r.tiles&&r.tiles.length>1),'each of them uploads as column tiles ('+big.map(r=>r.k+':'+(r.tiles?r.tiles.length:0)).join(', ')+')');
    ok(big.every(r=>r.tiles&&r.tiles.every(q=>q.w<=2048&&q.h<=2048)),'every tile is <= 2048 x 2048 (the phone texture rule)');
    ok(big.every(r=>r.tiles&&r.tiles.every(q=>q.w===q.n*r.fw&&q.h===r.rows*r.fh)&&r.tiles.reduce((a,q)=>a+q.n,0)===r.cols&&r.tiles.every((q,i,a)=>i===0||q.c0===a[i-1].c0+a[i-1].n)),'tiles are whole columns at full resolution (k = 1), covering every column once');
    /* the idle tiles keep their image (the loading card paints from it): compare each tile with the source file, cell by cell */
    const PX=await page.evaluate(async()=>{ const A=BATTLE_ANIM.brukk.idle; if(!A||!A._tiles) return null; const bl=await (await fetch(A.u)).blob(); const full=await createImageBitmap(bl);
      const rows=A.rows||1, H=rows*A.fh, out=[];
      for(const q of A._tiles){ const W=q.n*A.fw; if(!q.tex.image||q.tex.image._freed||!(q.tex.image instanceof ImageBitmap)) continue;   /* tiles 1.. drop their decoded copy once uploaded */ const a=new OffscreenCanvas(W,H), b=new OffscreenCanvas(W,H), ca=a.getContext('2d'), cb=b.getContext('2d');
        ca.drawImage(full, q.c0*A.fw,0,W,H, 0,0,W,H); cb.save(); cb.translate(0,H); cb.scale(1,-1); cb.drawImage(q.tex.image,0,0); cb.restore();
        const da=ca.getImageData(0,0,W,H).data, db=cb.getImageData(0,0,W,H).data; let s=0,n=0; for(let i=0;i<da.length;i+=4*97){ s+=Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2])+Math.abs(da[i+3]-db[i+3]); n+=4; } out.push(+(s/n).toFixed(3)); }
      try{ full.close(); }catch(e){} return out; });
    ok(PX&&PX.length>=1&&PX.every(d=>d<1),'each idle tile still decoded (tile 0) is the source sheet\'s own pixels (mean abs diff per channel '+(PX?PX.join(' / '):'n/a')+')');
    /* a drawn frame samples the tile that holds its column */
    const D=await page.evaluate(async()=>{ const b=units.find(u=>u.key==='brukk')||(()=>{ const u=makeUnit('brukk','enemy',Math.round(FW*0.66),Math.round(FD*0.5),null,{boss:true}); u.alive=true; buildFigure(u); units.push(u); return u; })();
      try{ syncMesh(b,0); }catch(e){} const A=b.anim&&b.anim[b._animSt||'idle']; if(!A||!A._tiles) return {n:0,bad:0,tiles:[],st:b._animSt}; const seen=new Set(); let bad=0, n=0; const cols=A.cols||A.n;
      for(let i=0;i<A.n*6;i++){ b._idleFrozen=false; try{ syncMesh(b,1/6); }catch(e){} const spr=b.sprite, fr=b._fxFr; if(fr==null||!spr) continue; const col=fr%cols;
        const q=A._tiles.find(t=>col>=t.c0&&col<t.c0+t.n); if(spr.material.map===A.tex||A._tiles.some(t=>t.tex===spr.material.map)){ n++; if(spr.material.map!==q.tex) bad++; seen.add(A._tiles.indexOf(q)); } }
      return {n,bad,tiles:[...seen],st:b._animSt}; });
    ok(D&&D.n>0&&D.bad===0&&D.tiles.length>1,'a drawn frame always samples its own column\'s tile ('+(D?D.n+' frames, '+D.bad+' wrong, tiles used '+D.tiles.join(','):'n/a')+')');
    /* ---- 3. budget */
    /* worst case: every boss sheet / tile on the GPU at once (a sheet uploads the first time it is drawn) */
    await page.evaluate(()=>{ const s=BATTLE_ANIM.brukk; for(const k of ['idle','walk','attack','cast']){ const A=s[k]; if(!A||!A.tex) continue; for(const t of (A._tiles?A._tiles.map(q=>q.tex):[A.tex])){ try{ renderer.initTexture(t); }catch(e){} } } });
    await delay(500);
    const M=await page.evaluate(()=>{ let boss=0; const s=BATTLE_ANIM.brukk; for(const k of ['idle','walk','attack','cast']){ const A=s[k]; if(!A||!A.tex) continue; const ts=A._tiles?A._tiles.map(q=>q.tex):[A.tex]; for(const t of ts){ const im=t.image; if(im&&im.width) boss+=im.width*im.height*4*(t.generateMipmaps?4/3:1); } }
      return {gpu:+texTallyMB().toFixed(1), bmp:+__bmpMB().toFixed(1), real:!!(_glTally&&_glTally.on), boss:+(boss/1048576).toFixed(1)}; });
    info('the boss sheets (4 states) on the GPU: '+M.boss+' MB');
    info('boss fight 1-10, 5 heroes: GPU textures '+M.gpu+' MB (texTallyMB, real tally '+M.real+'), decoded bitmaps '+M.bmp+' MB');
    ok(M.gpu<=2048,'the boss fight stays under the phone GPU budget ('+M.gpu+' <= 2048 MB)');
    ok(M.bmp<=400,'decoded bitmaps under their budget ('+M.bmp+' <= 400 MB)');
    if(SHOTS){ fs.mkdirSync(SHOTS,{recursive:true});
      /* the boss alone at 1:1 phone pixels (buffer locked at 2.625 = the phone's own DPR) */
      const box=await page.evaluate(async()=>{ QUAL.locked=true; QUAL.dpr=1.75; CW=0; resize3D(); for(const u of units){ if(u.mesh) u.mesh.visible=false; } const o=document.getElementById('overlay'); if(o) o.style.visibility='hidden';
        let b=units.find(u=>u.key==='brukk'); if(!b){ b=makeUnit('brukk','enemy',Math.round(FW*0.6),Math.round(FD*0.5),null,{boss:true}); b.alive=true; buildFigure(b); units.push(b); }
        b.x=Math.round(FW*0.6); b.y=Math.round(FD*0.5); b.px=b.x; b.py=b.y; b.mesh.visible=true; b._animAcc=0; try{ syncMesh(b,0); }catch(e){} renderer.render(scene,camera);
        const f=project(b.x,b.y,0.001), h=project(b.x,b.y,b.sprH||6), r=renderer.domElement.getBoundingClientRect(); const top=Math.min(f.y,h.y)-40, bot=f.y+20, hw=(bot-top)*0.6;
        return {x:r.left+f.x-hw, y:r.top+top, w:hw*2, h:bot-top}; });
      await delay(300); await page.screenshot({path:path.join(SHOTS,'boss_'+TAG+'_brukk_1to1.png'),clip:{x:Math.max(0,box.x),y:Math.max(0,box.y),width:Math.min(844,box.w),height:Math.min(390-Math.max(0,box.y),box.h)}}); }
    ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));
    await ctx.close();
  } catch(e){ fails++; console.log('  FAIL '+(e&&e.stack||e)); }
  finally{ try{ await browser.close(); }catch(_){} if(child){ child.kill(); for(let i=0;i<100&&child.exitCode===null&&child.signalCode===null;i++) await delay(50); } }
  console.log('test_tr1364_boss_tiles_qual.js: '+(checks-fails)+'/'+checks+' passed, '+fails+' failed'); process.exit(fails?1:0); })();
