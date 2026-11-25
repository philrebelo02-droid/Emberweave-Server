'use strict';
/* Lockdown audit 25 Nov 2026, section "Energy": Energy bars accurate - the portrait energy bars follow the real energy, including heroes who
   join mid-fight. A real campaign fight (stage 1-1 with the starter trio: Vael starts alone, Vireo runs in after Vael's ult, Sylthaine 5 s
   into wave 2 - each entry rebuilds the portrait bar) in a real browser on this checkout's server (temp DB). The page's own frame work
   (updateBattle + drawOverlay, which ends in updatePortraits) is stepped; after every few ticks each hero's bar on screen is measured
   against that hero's energy. Every check prints what it measured. Exit 0 = all passed. */
const H=require('./helpers/screens-1450.js');
const C=H.checker('test_screens_energy_1450.js');

(async()=>{
  const {file}=H.seedDB({vael:10,vireo:10,sylthaine:10},u=>{ u.team=['vael','vireo','sylthaine']; }); const s=await H.server(file); let pg;
  try{
    pg=await H.game(s.port,{w:1280,h:720});
    const r=await pg.evaluate(async()=>{ const sl=ms=>new Promise(r=>setTimeout(r,ms));
      CUR={node:1,mode:'campaign',portal:'normal'};
      const st=await api('/api/campaign/start','POST',{mode:'normal',node:1,heroIds:['vael','vireo','sylthaine'],requestId:'eb'+Date.now()});
      if(!st||!st.ok) return {error:'start: '+JSON.stringify(st).slice(0,200)};
      CUR.attemptId=st.attemptId; CUR.cwaves=(st.stage&&st.stage.waves)||null; CUR.serverSnaps=st.snaps; CUR.seed=st.seed>>>0; CUR.engine=st.engine;
      G.squads=G.squads||{}; G.squads.campaign=['vael','vireo','sylthaine']; G.team=G.squads.campaign.slice();
      paused=true; startBattle();
      for(let i=0;i<200&&!(state==='battle'&&units.some(u=>u.team==='ally'));i++) await sl(100);
      if(state!=='battle') return {error:'no battle (state '+state+')'};
      const intro=!!(CUR._intro);
      const startKeys=units.filter(u=>u.team==='ally'&&HERO_TYPES[u.key]).map(u=>u.key);
      const fillOf=u=>u.enEl&&u.enEl.querySelector('.pEnFill');
      const per={}, joined={}; let samples=0, worstStyle=0, worstRendered=0, missing=[], offscreen=[], rebuilds=0, lastBarEls={};
      const transition=(()=>{ const u=units.find(x=>x.team==='ally'&&x.enEl); const f=u&&fillOf(u); return f?getComputedStyle(f).transitionDuration+' '+getComputedStyle(f).transitionProperty:'?'; })();
      const measure=(t)=>{ for(const u of units){ if(u.team!=='ally'||!HERO_TYPES[u.key]) continue;
          const P=per[u.key]=per[u.key]||{n:0,maxE:0,maxBar:0,maxDiff:0,maxRDiff:0,first:t,bars:0};
          if(!startKeys.includes(u.key)&&!joined[u.key]) joined[u.key]=t;
          const f=fillOf(u), inDom=!!(u.enEl&&document.contains(u.enEl));
          if(!f||!inDom){ missing.push(u.key+'@'+t.toFixed(1)); continue; }
          if(lastBarEls[u.key]!==u.enEl){ lastBarEls[u.key]=u.enEl; P.bars++; rebuilds++; }
          const want=u.alive?Math.min(100,u.energy):0, sw=parseFloat(f.style.width)||0;
          const bw=u.enEl.getBoundingClientRect(), fw=f.getBoundingClientRect(), rw=bw.width?fw.width/bw.width*100:-1;
          const slot=u.slotEl&&u.slotEl.getBoundingClientRect();
          if(!slot||!(slot.width>0&&slot.left>=-1&&slot.right<=innerWidth+1&&slot.top>=-1&&slot.bottom<=innerHeight+1)) offscreen.push(u.key+'@'+t.toFixed(1));
          P.n++; samples++; P.maxE=Math.max(P.maxE,want); P.maxBar=Math.max(P.maxBar,sw);
          P.maxDiff=Math.max(P.maxDiff,Math.abs(sw-want)); P.maxRDiff=Math.max(P.maxRDiff,Math.abs(rw-want));
          worstStyle=Math.max(worstStyle,Math.abs(sw-want)); worstRendered=Math.max(worstRendered,Math.abs(rw-want)); } };
      let ticks=0, autoOn=false, settled=[];
      for(let chunk=0;chunk<4000&&!ended&&state==='battle';chunk++){
        for(let i=0;i<6&&!ended&&state==='battle';i++){ updateBattle(SIM_STEP); ticks++; }
        drawOverlay(); measure(ticks*SIM_STEP);
        if(!autoOn&&ticks>=40){ window.patEgp1=()=>true; try{ document.getElementById('autoBtn').onclick(); }catch(e){} autoOn=true; await sl(600); }
        if(chunk%5===0) await sl(4);
        if(chunk%150===75){ /* let a CSS transition finish, then the painted width must match */ await sl(700);
          for(const u of units){ if(u.team!=='ally'||!u.enEl||!document.contains(u.enEl)) continue; const f=fillOf(u); const bw=u.enEl.getBoundingClientRect(), fw=f.getBoundingClientRect();
            settled.push({k:u.key,want:+(u.alive?Math.min(100,u.energy):0).toFixed(1),painted:+(bw.width?fw.width/bw.width*100:-1).toFixed(1)}); } }
      }
      const I=CUR._intro||{};
      const bar=document.getElementById('portraitBar').getBoundingClientRect();
      return {intro,startKeys,ticks,simSeconds:+(ticks*SIM_STEP).toFixed(1),ended,samples,worstStyle:+worstStyle.toFixed(2),worstRendered:+worstRendered.toFixed(2),transition,
        per:Object.fromEntries(Object.entries(per).map(([k,P])=>[k,{samples:P.n,maxEnergy:+P.maxE.toFixed(1),maxBar:+P.maxBar.toFixed(1),maxStyleDiff:+P.maxDiff.toFixed(2),maxPaintedDiff:+P.maxRDiff.toFixed(1),barBuilds:P.bars}])),
        joined:Object.fromEntries(Object.entries(joined).map(([k,v])=>[k,+v.toFixed(1)])),vireoIn:I.vireoIn,sylIn:I.sylIn,missing:missing.slice(0,10),missingN:missing.length,offscreen:offscreen.slice(0,6),offscreenN:offscreen.length,
        rebuilds,settled,barRect:{x:Math.round(bar.left),y:Math.round(bar.top),w:Math.round(bar.width),h:Math.round(bar.height)},vh:innerHeight}; });
    if(r.error){ C.ok(false,'the 1-1 fight starts in the browser',r.error.replace(/Error:/g,'Err')); }
    else{
      console.log('  fight: '+JSON.stringify({intro:r.intro,start:r.startKeys,simSeconds:r.simSeconds,ended:r.ended,samples:r.samples,transition:r.transition,bar:r.barRect}));
      for(const k of Object.keys(r.per)) console.log('  '+k+': '+JSON.stringify(r.per[k]));
      C.ok(r.intro&&JSON.stringify(r.startKeys)===JSON.stringify(['vael']),'the scripted 1-1: Vael starts alone, Vireo and Sylthaine are benched',{start:r.startKeys});
      C.ok(r.joined.vireo!=null&&r.joined.sylthaine!=null,'both join mid-fight (sim seconds)',r.joined);
      C.ok(r.samples>300&&r.worstStyle<=0.01,'every portrait energy bar equals its hero\'s energy at every sample ('+r.samples+' samples, worst difference '+r.worstStyle+'%)',{worst:r.worstStyle});
      C.ok(r.missingN===0,'every hero on the field has a live bar in the page at every sample (after each mid-fight rebuild too)',{missing:r.missing,n:r.missingN});
      C.ok(r.offscreenN===0&&r.barRect.w>0&&r.barRect.y+r.barRect.h<=r.vh+1,'the portrait bar and every hero slot are on screen',{offscreen:r.offscreen,bar:r.barRect});
      for(const k of ['vireo','sylthaine']){ const P=r.per[k]||{}; C.ok(P.samples>20&&P.maxEnergy>=50&&P.maxBar>=50&&P.maxStyleDiff<=0.01,k+' (joined at '+r.joined[k]+' s) - the bar rises with the real energy: max energy '+P.maxEnergy+', max bar '+P.maxBar+'%',P); }
      const vael=r.per.vael||{}; C.ok(vael.barBuilds>=3&&vael.maxStyleDiff<=0.01,'Vael\'s bar is rebuilt at each entry ('+vael.barBuilds+' bars) and keeps following his energy',vael);
      const sd=r.settled.map(x=>Math.abs(x.want-x.painted)); const worst=sd.length?Math.max(...sd):null;
      C.ok(r.settled.length>0&&worst<=2,'painted on screen: after the bar animation settles, the drawn width = the energy (worst '+worst+' of '+r.settled.length+' looks)',r.settled.slice(0,9));
    }
    C.ok(pg._errs.length===0,'no page errors',pg._errs.slice(0,3).map(e=>e.replace(/Error:/g,'Err')));
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).replace(/Error:/g,'Err').slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
