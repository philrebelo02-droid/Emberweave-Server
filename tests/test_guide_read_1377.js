// v1377 F1b (Claude 12 Nov: "the guide text now sits over panel content ... hard to read. Keep the box at 20% (Phil). Give .ftut-name and .ftut-text a strong
// dark outline ... Also never place the bar over the control the current line HIGHLIGHTs"). At 844x390 and 1280x720 on Market, Wishing, Arena, Forge and
// the Bulletin Board: (1) the speaker name and the line carry a hard black outline (stroke painted under the fill) and, measured on the screenshot, nearly
// every bright letter pixel has a dark pixel within 2 px; (2) with FTUT_HL pointing line 1 at a screen button the bar covered, the box and portrait move off
// it and stay clear of the top row; (3) the box frame stays 20%. CONTROL: FAILS on e341d35e. Chromium: --disable-audio-output, never --mute-audio.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const SHOTS=process.env.GREAD_SHOTS||''; const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-gread-')); const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0; const ok=(c,m)=>{checks++; if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
const VIEWS=[['844x390',{width:844,height:390},true],['1280x720',{width:1280,height:720},false],['390x844',{width:390,height:844},true],['1440x900',{width:1440,height:900},false]];
const CASES=[['market','market'],['wishing','wishing'],['arena','arena'],['forge','forge'],['rankings','rankings']];
(async()=>{ try{
  const port=await freePort(),base='http://127.0.0.1:'+port;
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,DATABASE_URL:'',DB_STORE:'',PORT:String(port),DB_FILE:path.join(temp,'db.json'),ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',SIM_WORKERS:'0'},stdio:'ignore',windowsHide:true});
  let up=false; for(let i=0;i<400&&!up;i++){ try{ up=(await fetch(base+'/api/health')).ok; }catch(_){} if(!up) await delay(150); } if(!up) throw new Error('throwaway server did not start');
  browser=await chromium.launch({ ignoreDefaultArgs:['--mute-audio'], args:['--disable-audio-output','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu']});
  for(const [tag,vp,touch] of VIEWS){
    const nm='gr'+Date.now().toString(36); const reg=await (await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:nm,pass:'password1'})})).json();
    const L={token:reg.token,id:reg.profile.id,name:nm};
    const ctx=await browser.newContext({viewport:vp,hasTouch:touch,isMobile:touch,serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e.message||e)));
    await page.addInitScript(L=>{ try{ localStorage.setItem('ew_acc',JSON.stringify(L)); localStorage.setItem('ew_guest_step_'+L.id,'1'); window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} },L);
    await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    await page.goto(base+'/play',{waitUntil:'load',timeout:180000});
    await page.waitForFunction(()=>typeof FTUT_GUIDES!=='undefined'&&typeof show==='function'&&ACC&&ACC.token,null,{timeout:180000});
    for(let i=0;i<24;i++){ const gone=await page.evaluate(()=>{ const g=document.getElementById('rotateGate'); if(!g||getComputedStyle(g).display==='none'||getComputedStyle(g).visibility==='hidden'||+getComputedStyle(g).opacity===0) return true; const sp=document.querySelector('.splashPlay'); if(sp) sp.click(); return false; }).catch(()=>false); if(gone) break; await delay(500); }
    await delay(900);
    await page.evaluate(()=>{ G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} G.tutSkipped=true; document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); document.body.classList.remove('gated');
      playerLevel=()=>99; G.campaignCleared=Math.max(G.campaignCleared|0,30); G.ftutOff=false; });
    for(const [sc,k] of CASES){
      const r=await page.evaluate(async([sc,k])=>{ const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const R=e=>(typeof e.ewGameRect==='function')?e.ewGameRect():e.getBoundingClientRect();
        try{ ftutEnd(false); }catch(e){} show('home'); await sleep(500); try{ if(typeof FTUT_HL!=='undefined') for(const x in FTUT_HL) delete FTUT_HL[x]; }catch(e){}
        document.querySelectorAll('[data-ftut-test-hl]').forEach(e=>e.removeAttribute('data-ftut-test-hl'));
        G.ftutSeen={}; FTUT_GUIDES.forEach(x=>{ if(x.k!==k) G.ftutSeen[x.k]=1; }); show(sc);
        let bar=null; for(let i=0;i<40;i++){ await sleep(200); bar=document.getElementById('ftutBar'); if(bar&&bar.dataset.guide===k&&!bar.classList.contains('ftut-hold')) break; bar=null; } if(!bar) return {fired:false};
        await sleep(800);
        const st=el=>{ const c=getComputedStyle(el); return {stroke:parseFloat(c.webkitTextStrokeWidth||c.getPropertyValue('-webkit-text-stroke-width'))||0,order:c.paintOrder||'',color:c.webkitTextStrokeColor||''}; };
        const name=st(bar.querySelector('.ftut-name')), text=st(bar.querySelector('.ftut-text'));
        const frame=+getComputedStyle(bar.querySelector('.ftut-box'),'::before').opacity;
        const tr=bar.querySelector('.ftut-text').getBoundingClientRect();   /* screen pixels: on a portrait phone the game is turned, so the clip uses the screen rect */
        return {fired:true,name,text,frame,textRect:{x:tr.left,y:tr.top,w:tr.width,h:tr.height}}; },[sc,k]);
      ok(r.fired, tag+': '+k+' guide fires');
      if(!r.fired) continue;
      ok(r.name.stroke>=2&&/^stroke/.test(r.name.order)&&r.text.stroke>=2&&/^stroke/.test(r.text.order), tag+': '+k+' name + line have a black outline under the letters (stroke '+r.name.stroke+'/'+r.text.stroke+'px, paint-order "'+r.text.order+'")');
      ok(Math.abs(r.frame-0.2)<0.01, tag+': '+k+' box frame still 20% ('+r.frame+')');
      // measured on the screenshot: bright letter pixels with a dark pixel within 2 px
      const png=await page.screenshot({clip:{x:Math.max(0,r.textRect.x-3),y:Math.max(0,r.textRect.y-3),width:Math.min(r.textRect.w+6,vp.width),height:Math.min(r.textRect.h+6,vp.height)}});
      const edge=await page.evaluate(async b64=>{ const img=new Image(); img.src='data:image/png;base64,'+b64; await img.decode(); const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; const x=c.getContext('2d'); x.drawImage(img,0,0);
        const d=x.getImageData(0,0,c.width,c.height).data, W=c.width, H=c.height, lum=i=>0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]; let bright=0, ringed=0;
        for(let y=2;y<H-2;y++) for(let x2=2;x2<W-2;x2++){ const i=(y*W+x2)*4; if(lum(i)<215) continue; bright++; let dark=false;
          for(let dy=-2;dy<=2&&!dark;dy++) for(let dx=-2;dx<=2&&!dark;dx++){ if(lum(((y+dy)*W+x2+dx)*4)<45) dark=true; } if(dark) ringed++; }
        return {bright,ringed,share:bright?ringed/bright:0}; },png.toString('base64'));
      ok(edge.bright>50&&edge.share>=0.8, tag+': '+k+' on the screenshot '+Math.round(edge.share*100)+'% of '+edge.bright+' bright letter pixels have a dark edge within 2 px (need 80%)');
      if(SHOTS){ try{ fs.mkdirSync(SHOTS,{recursive:true}); await page.screenshot({path:path.join(SHOTS,tag+'-'+k+'.png')}); }catch(e){} }
      // highlight: point line 1 at a screen button the bar covers now, re-place, it must move off it
      const h=await page.evaluate(async([sc,k])=>{ const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const R=e=>(typeof e.ewGameRect==='function')?e.ewGameRect():e.getBoundingClientRect();
        const bar=document.getElementById('ftutBar'), host=ftutHost(FTUT.cur.at), hr=R(host); const parts=()=>[R(bar.querySelector('.ftut-box')),R(bar.querySelector('.ftut-por'))];
        const area=(a,q)=>Math.max(0,Math.min(a.right,q.right)-Math.max(a.left,q.left))*Math.max(0,Math.min(a.bottom,q.bottom)-Math.max(a.top,q.top));
        const btns=[...host.querySelectorAll('button,.btn,[onclick]')].filter(el=>{ if(el.closest('#ftutBar')) return false; const q=R(el); if(q.width<20||q.height<14) return false; if(q.top<=hr.top+hr.height*.22) return false; const cs=getComputedStyle(el); return cs.visibility!=='hidden'&&+cs.opacity>0; });
        let pick=btns.find(el=>{ const q=R(el); return parts().some(p=>area(p,q)>0.25*q.width*q.height); });
        const covered=!!pick; if(!pick){ const p=parts()[0]; pick=btns.sort((a,b)=>Math.abs(R(a).top-p.top)-Math.abs(R(b).top-p.top))[0]; } if(!pick) return {none:true};
        pick.setAttribute('data-ftut-test-hl','1'); window.FTUT_HL=window.FTUT_HL||{}; try{ FTUT_HL[k+'.1']='[data-ftut-test-hl]'; }catch(e){ window.FTUT_HL[k+'.1']='[data-ftut-test-hl]'; }
        FTUT.row=null; ftutPlace(); await sleep(700); const q=R(pick); const hit=parts().some(p=>area(p,q)>4);
        const v=ewGameView(), [b,po]=parts(); const inside=b.top>=-0.5&&b.bottom<=v.height+0.5&&po.top>=-0.5&&po.bottom<=v.height+0.5;
        const row=[...host.querySelectorAll('.backbtn,button,.btn,h1,h2,h3,b,span,div')].filter(el=>{ if(el.closest('#ftutBar')) return false; const r=R(el); if(r.width<6||r.height<6||r.height>80||r.top>hr.top+hr.height*.22) return false; if(el.closest('.backbtn')&&!el.matches('.backbtn')) return false;
          const cs=getComputedStyle(el); if(cs.visibility==='hidden'||+cs.opacity===0) return false; return el.matches('.backbtn,button,.btn,h1,h2,h3')||[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1); });
        const rowHit=row.filter(el=>parts().some(p=>area(p,R(el))>4)).map(el=>(el.textContent||'').trim().slice(0,20));
        /* same control marked only by the game's glow class (no FTUT_HL entry) */ try{ delete FTUT_HL[k+'.1']; }catch(e){} pick.removeAttribute('data-ftut-test-hl'); FTUT.row=null; ftutPlace(); await sleep(300);
        pick.classList.add('tut-target-glow'); FTUT.row=null; ftutPlace(); await sleep(600); const hitG=parts().some(p=>area(p,R(pick))>4); pick.classList.remove('tut-target-glow');
        const lbl=(pick.textContent||'').trim().replace(/\s+/g,' ').slice(0,24)||pick.className; try{ ftutEnd(true); }catch(e){} return {covered,lbl,hit,hitG,inside,rowHit}; },[sc,k]);
      if(h.none) { ok(true, tag+': '+k+' (no button below the top row to highlight)'); continue; }
      ok(!h.hit&&h.inside&&h.rowHit.length===0, tag+': '+k+' line 1 highlights "'+h.lbl+'"'+(h.covered?' (the bar covered it)':'')+' - box + portrait move off it, stay inside, top row clear ('+(h.hit?'STILL ON IT':'off')+(h.rowHit.length?'; top row: '+h.rowHit.join('|'):'')+')');
      ok(!h.hitG, tag+': '+k+' same control marked only with the game glow class (.tut-target-glow) - bar moves off it too ('+(h.hitG?'STILL ON IT':'off')+')'); }
    ok(errs.length===0, tag+': no page errors ('+errs.slice(0,2).join(' | ')+')'); await ctx.close(); }
}catch(e){ console.error(e); fails++; } finally { console.log('guide read 1377: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed'); if(fails) process.exitCode=1;
  if(browser) await browser.close().catch(()=>{}); if(child) child.kill(); await delay(300); try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){} } })();
