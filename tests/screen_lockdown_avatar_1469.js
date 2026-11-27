'use strict';
/* Lockdown checklist 25 Nov 2026 (01 - EVERY FEATURE IN THE GAME.md), v1469 screen check - Emberdraft "Avatar picker", in a real browser on
   this checkout's server (temp DB), a Lv 100 player, at phone 844x390 (touch) and desktop 1280x720. The lobby opened from the Floating
   Isle's Emberdraft label. The avatar's turn is read from the lobby's own three.js scene: the test wraps THREE.WebGLRenderer before the
   lobby makes its renderer and keeps the scene it renders into #edAvCv (test-side only - the game code is not changed).
   - the lobby offers 10 3D avatars (the tray = ED_AV_PICK), yours on the pedestal as a 3D model;
   - a drag on the avatar turns it (the model's rotation.y while the finger is held);
   - a picked avatar sticks: a new model on the pedestal, and still picked after reopening the lobby and after reloading the game;
   - PLAY (a real match; one attempt): you play as your avatar, the 7 rivals each get a different one, none of them yours.
   STEP lines mark every phase; every wait is capped; a 12-minute watchdog. */
const H=require('./helpers/screens-lockdown.js');
const {rig,press,tapEl}=require('./helpers/lockdown-1469.js');
const TEST='screen_lockdown_avatar_1469.js', R=rig(TEST,{limitMin:12}), {C,shot,step,cap,waitFor}=R;
const SIZES=[H.SIZES.phone,H.SIZES.desktop];
const HEROES={vael:60,aureth:60,sylthaine:60,vireo:60,brannus:60,calypsa:60,dandra:60,grosk:60};

const PATCH_THREE=()=>{ if(window._slThree) return THREE.WebGLRenderer===window._slThree; const O=THREE.WebGLRenderer;
  const W=function(p){ const r=new O(p), rr=r.render; r.render=function(sc,cam){ try{ if(this.domElement&&this.domElement.id==='edAvCv') window._slAvScene=sc; }catch(e){} return rr.call(this,sc,cam); }; return r; };
  W.prototype=O.prototype; try{ THREE.WebGLRenderer=W; }catch(e){} window._slThree=W; return THREE.WebGLRenderer===W; };
const AV=()=>{ const sc=window._slAvScene, m=sc&&sc.children.find(o=>o.userData&&o.userData.h); return {model:!!m,uuid:m?m.uuid:null,rotY:m?+m.rotation.y.toFixed(3):null,av:G.edAvatar||null,mine:edMyAvatarId(),
  name:SL.txt('#edAvName'),on:[...document.querySelectorAll('#edAvStrip button.on')].map(b=>b.dataset.av),strip:[...document.querySelectorAll('#edAvStrip button')].map(b=>b.dataset.av),cv:SL.vis('#edAvCv')}; };
async function openLobby(pg,S){ await cap(H.openBuilding(pg,'skyisland',S.touch),60000,'opening the Floating Isle');
  await waitFor(pg,()=>document.querySelectorAll('#skyIslandBody .islespot').length===3,null,30000,'the Floating Isle labels');
  await H.wait(800); const patched=await pg.evaluate(PATCH_THREE); await pg.evaluate(()=>{ window._slAvScene=null; });
  await press(pg,S,'#skyIslandBody .islespot[data-if="emberdraft"]>div');
  await waitFor(pg,()=>document.getElementById('edLobby')&&document.querySelectorAll('#edAvStrip button').length>0,null,40000,'the Emberdraft lobby');
  await waitFor(pg,()=>{ const sc=window._slAvScene; return !!(sc&&sc.children.find(o=>o.userData&&o.userData.h)); },null,40000,'the 3D avatar model on the pedestal');
  await H.wait(2000); await H.clean(pg); await H.prep(pg); return patched; }
async function reloadGame(pg){ await pg.reload({waitUntil:'domcontentloaded',timeout:120000});
  await waitFor(pg,()=>typeof renderHeroDetail==='function'&&typeof api==='function'&&typeof adoptLedger==='function'&&typeof LANG==='object',null,120000,'the game after reload');
  await H.wait(1500); await pg.evaluate(()=>{ const p=document.querySelector('.splashPlay'); if(p) p.click(); }); await H.wait(1000);
  await pg.evaluate(async()=>{ G.tutSkipped=true; G.tutDone=true; G.ftutOff=true; document.querySelectorAll('#tutOffer').forEach(n=>n.remove()); try{ await ledgerSync(); }catch(e){} }); await H.wait(800); }

async function avatarPicker(pg,S){
  step(S.tag+' check: Avatar picker (10 avatars)');
  const patched=await openLobby(pg,S);
  const a0=await pg.evaluate(AV), picks=await pg.evaluate(()=>ED_AV_PICK.map(a=>a.id));
  const s1=await shot(pg,S.tag+' Avatar picker lobby');
  C.ok(patched&&a0.strip.length===10&&new Set(a0.strip).size===10&&JSON.stringify(a0.strip)===JSON.stringify(picks)&&a0.model&&a0.cv&&a0.on.length===1&&a0.on[0]===a0.mine,
    S.tag+' Avatar picker: the lobby offers 10 3D avatars ('+a0.strip.join(', ')+'); "'+a0.name+'" ('+a0.mine+') stands on the pedestal as a 3D model'+(patched?'':' [the renderer could not be wrapped - no model readout]'),{...a0,patched,shot:s1});
  step(S.tag+' check: Avatar picker (drag turns)');
  const box=await pg.evaluate(()=>{ const r=document.getElementById('edAvHit').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width}; });
  const cdp=S.touch?await cap(pg._ctx.newCDPSession(pg),15000,'a DevTools session'):null, from={x:box.x-40,y:box.y}, to={x:box.x+80,y:box.y}, N=12;
  const touch=(type,pts)=>cap(cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts}),10000,'a touch event');
  const rest=(await pg.evaluate(AV)).rotY;
  if(S.touch) await touch('touchStart',[{x:from.x,y:from.y,id:1}]); else { await pg.mouse.move(from.x,from.y); await pg.mouse.down(); }
  for(let i=1;i<=N;i++){ const x=from.x+(to.x-from.x)*i/N; if(S.touch) await touch('touchMove',[{x,y:from.y,id:1}]); else await pg.mouse.move(x,from.y); await H.wait(40); }
  await H.wait(250); const held=(await pg.evaluate(AV)).rotY; const s2=await shot(pg,S.tag+' Avatar picker drag turns the model');
  if(S.touch) await touch('touchEnd',[]); else await pg.mouse.up();
  await H.wait(2500); const after=(await pg.evaluate(AV)).rotY;
  C.ok(rest!=null&&held!=null&&Math.abs(held-rest)>=0.8,S.tag+' Avatar picker: a '+(to.x-from.x)+' px drag on the avatar turns the model (rotation.y '+rest+' -> '+held+' rad while held; eases back to '+after+' after)',{rest,held,after,shot:s2});
  step(S.tag+' check: Avatar picker (pick sticks)');
  const want=picks.find((k,i)=>i>=3&&k!==a0.mine)||picks.find(k=>k!==a0.mine);
  await tapEl(pg,S,'#edAvStrip button[data-av="'+want+'"]');
  await waitFor(pg,u=>{ const sc=window._slAvScene, m=sc&&sc.children.find(o=>o.userData&&o.userData.h); return !!m&&m.uuid!==u; },a0.uuid,30000,'the picked avatar\'s model loading');
  await H.wait(800); const a1=await pg.evaluate(AV), s3=await shot(pg,S.tag+' Avatar picker picked '+want);
  await tapEl(pg,S,'#edX'); await H.wait(1200);
  await openLobby(pg,S); const a2=await pg.evaluate(AV), s4=await shot(pg,S.tag+' Avatar picker reopened');
  await reloadGame(pg); await openLobby(pg,S); const a3=await pg.evaluate(AV), s5=await shot(pg,S.tag+' Avatar picker after reload');
  const sticks=a=>a.av===want&&a.mine===want&&a.on.length===1&&a.on[0]===want&&a.model;
  C.ok(a1.uuid!==a0.uuid&&sticks(a1)&&sticks(a2)&&sticks(a3)&&a1.name===a2.name&&a2.name===a3.name,S.tag+' Avatar picker: a picked avatar sticks - '+want+' ("'+a1.name+'", a new model on the pedestal) is still the one after reopening the lobby and after reloading the game',{picked:a1,reopened:a2,reloaded:a3,shots:[s3,s4,s5]});
  step(S.tag+' check: Avatar picker (rivals differ)');
  await waitFor(pg,()=>{ const b=document.getElementById('edSolo'); return b&&!b.disabled; },null,30000,'PLAY enabled (attempts read from the server)');
  const cards=[]; let polling=true;
  const poll=(async()=>{ while(polling){ try{ const c=await pg.evaluate(()=>[...document.querySelectorAll('img')].map(i=>i.getAttribute('src')||'').filter(s=>/\/assets\/img\/avatars\/card-/.test(s))); for(const x of c) if(!cards.includes(x)) cards.push(x); }catch(e){} await H.wait(250); } })();
  await tapEl(pg,S,'#edSolo');
  const started=await waitFor(pg,()=>window.ED&&ED.active&&Array.isArray(ED.players)&&ED.players.length===8,null,60000,'the match seats (8 players)');
  await H.wait(1500); const s6=await shot(pg,S.tag+' Avatar picker match seats');
  await waitFor(pg,()=>ED.phase==='carousel'||ED.phase==='plan',null,45000,'the match past its loader');
  polling=false; await cap(poll,5000,'the loader-card poll').catch(()=>{});
  const seats=await pg.evaluate(()=>ED.players.map(p=>({ai:!!p.ai,name:p.ai?p.name:'you',av:edAvatarFor(p).id})));
  const mine=seats.find(x=>!x.ai), rivals=seats.filter(x=>x.ai), ids=rivals.map(x=>x.av), cardIds=cards.map(u=>(/card-([a-z]+)\.webp/.exec(u)||[])[1]).filter(Boolean);
  const s7=await shot(pg,S.tag+' Avatar picker rivals');
  C.ok(started&&!!mine&&mine.av===want&&rivals.length===7&&new Set(ids).size===7&&!ids.includes(want)&&ids.every(k=>picks.includes(k)),
    S.tag+' Avatar picker: you play as '+(mine&&mine.av)+'; the 7 rivals each get a different avatar, none of them yours ('+rivals.map(x=>x.name+'='+x.av).join(', ')+'; loader cards seen: '+(cardIds.join(', ')||'none')+')',{seats,loaderCards:cardIds,shots:[s6,s7]}); }

(async()=>{
  let pg=null, s=null;
  try{
    step('setup: seed DB + server');
    const {file}=H.seedDB(HEROES,u=>{ u.led.gold=100000; });
    s=await R.server(file);
    for(const S of SIZES){ step(S.tag+': game load');
      try{ pg=await R.game(s.port,S); await avatarPicker(pg,S); }
      catch(e){ C.ok(false,S.tag+' Avatar picker ran to the end',String(e&&e.stack||e).slice(0,600)); try{ if(pg) await shot(pg,S.tag+' Avatar picker error'); }catch(_){} }
      if(pg){ C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3)); await R.closeCtx(pg); pg=null; }
      await R.cap(H.closeBrowser(),20000,'closing the browser').catch(()=>{}); }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) await R.closeCtx(pg); await R.stop(s); await R.finish(); }
})();
