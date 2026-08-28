/* ===========================================================================
   v274 — LIVE ACTION RECEIPTS (hardening directive §3 + acceptance §7.4).
   A campaign session streams its actions over the websocket while the fight runs. The server owns the
   sequence, stamps the tick, refuses anything impossible, and replays ITS OWN accepted list at
   resolve — so a transcript composed after the fight cannot be substituted.
   =========================================================================== */
const http=require('http'); const WebSocket=require('ws');
const PORT=process.env.PORT||8871;
function req(path, body, token){ return new Promise((res,rej)=>{ const d=body?JSON.stringify(body):null;
  const r=http.request({host:'localhost',port:PORT,path,method:body?'POST':'GET',
    headers:Object.assign({'content-type':'application/json'},token?{'x-token':token}:{},d?{'content-length':Buffer.byteLength(d)}:{})},
    x=>{ let s=''; x.on('data',c=>s+=c); x.on('end',()=>{ try{res(JSON.parse(s));}catch(e){res({raw:s});} }); });
  r.on('error',rej); if(d)r.write(d); r.end(); }); }
let pass=0,fail=0; const ck=(n,c,d)=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n+(d?' — '+d:''))); };
const rid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const SQUAD=['vael','sylthaine','vireo'];

function sock(token){ return new Promise((res,rej)=>{
  const ws=new WebSocket('ws://localhost:'+PORT); const acks=[];
  ws.on('message',d=>{ let m; try{m=JSON.parse(d.toString());}catch(e){return;} if(m.t==='actack') acks.push(m); });
  ws.on('open',()=>res({ws, acks, send:(o)=>ws.send(JSON.stringify(Object.assign({token},o)))}));
  ws.on('error',rej); }); }
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const ackFor=(acks,seq)=>acks.filter(a=>a.seq===seq).pop();   // the LATEST receipt for that sequence

(async()=>{
  console.log('== v274: the server receipts the player\'s actions as they happen ==');
  const reg=await req('/api/register',{name:'as'+Math.floor(Math.random()*1e6),pass:'password1'});
  const T=reg.token; ck('account registered', !!T);
  const S=await sock(T);

  const st=await req('/api/campaign/start',{mode:'normal',node:1,heroIds:SQUAD,requestId:rid()},T);
  ck('session started', st.ok===true);

  // --- an action before the battle has begun has nowhere to land -------------
  S.send({t:'act', sessionId:st.attemptId, seq:1, tick:5, kind:'ult', casterUid:0, targetUid:3});
  await wait(180);
  ck('an action before the battle begins is refused', (ackFor(S.acks,1)||{}).reason==='not-begun', JSON.stringify(ackFor(S.acks,1)));

  // --- begin anchors the server's clock -------------------------------------
  S.send({t:'act', sessionId:st.attemptId, seq:1, kind:'begin'});
  await wait(180);
  ck('the battle start is receipted and anchors the server clock', (ackFor(S.acks,1)||{}).begun===true);

  // --- a well-formed live action is accepted, and the SERVER picks the tick --
  S.send({t:'act', sessionId:st.attemptId, seq:2, tick:9999, kind:'auto', casterUid:-1, targetUid:-1, value:1});
  await wait(180);
  const a1=ackFor(S.acks,2);
  ck('a live action is accepted and receipted', a1 && a1.ok===true, JSON.stringify(a1));
  ck('the SERVER assigns the tick — the client\'s 9999 is ignored', a1 && a1.tick>0 && a1.tick<200, 'assigned '+(a1&&a1.tick));
  ck('the receipt carries the hash chain', a1 && typeof a1.chain==='string' && a1.chain.length>0);
  ck('the client tick is recorded only as drift', a1 && a1.clientTick===9999);

  // --- the server owns the sequence ----------------------------------------
  S.send({t:'act', sessionId:st.attemptId, seq:2, kind:'ult', casterUid:0, targetUid:3});
  await wait(150);
  ck('a repeated sequence number is refused', (ackFor(S.acks,2)||{}).reason==='out-of-order');
  S.send({t:'act', sessionId:st.attemptId, seq:9, kind:'ult', casterUid:0, targetUid:3});
  await wait(150);
  ck('a gap in the sequence is refused', (ackFor(S.acks,9)||{}).reason==='out-of-order');

  // --- a backdated action cannot pick an earlier moment ---------------------
  await wait(1200);                                   // let the server's clock run on
  S.send({t:'act', sessionId:st.attemptId, seq:3, tick:1, kind:'ult', casterUid:0, targetUid:3});
  await wait(180);
  const back=ackFor(S.acks,3);
  ck('a backdated but monotonic client tick cannot move the action earlier',
     back && back.ok===true && back.tick>(a1.tick+20), 'client asked for 1, server gave '+(back&&back.tick));
  ck('the assigned tick tracks the server clock, not the message', back && back.tick>=Math.floor(1.2*30*0.82));

  // --- bad kinds, casters and sessions --------------------------------------
  S.send({t:'act', sessionId:st.attemptId, seq:4, kind:'teleport', casterUid:0, targetUid:3});
  await wait(150);
  ck('an unknown action kind is refused', (ackFor(S.acks,4)||{}).reason==='bad-kind');
  S.send({t:'act', sessionId:st.attemptId, seq:4, kind:'ult', casterUid:999, targetUid:3});
  await wait(150);
  ck('an out-of-range caster is refused', (ackFor(S.acks,4)||{}).reason==='bad-caster');
  S.send({t:'act', sessionId:'not-a-session', seq:1, kind:'ult', casterUid:0, targetUid:3});
  await wait(150);
  ck('an action for a session that is not yours is refused', S.acks.some(a=>a.reason==='no-session'));

  // --- the channel has a budget --------------------------------------------
  const before=S.acks.length;
  for(let i=0;i<14;i++) S.send({t:'act', sessionId:st.attemptId, seq:4+i, kind:'ult', casterUid:0, targetUid:3});
  await wait(400);
  ck('a flood of actions hits the per-second ceiling', S.acks.slice(before).some(a=>a.reason==='too-fast'),
     JSON.stringify(S.acks.slice(before).map(a=>a.reason).filter(Boolean)).slice(0,120));
  ck('refusals are counted against the session', S.acks.some(a=>typeof a.strikes==='number'));

  // --- the resolve replays THE SERVER'S list, not the body's ----------------
  const host=require('./server/sim-host.js').load(__dirname+'/emberweave-heroes.html');
  const enc=JSON.parse(require('fs').readFileSync(__dirname+'/server/campaign-encounters.json','utf8'));
  /* the transcript the SERVER built from its own receipts — read it back and replay exactly that */
  const acceptedTicks=S.acks.filter(a=>a.ok===true&&!a.begun).map(a=>a.tick);
  const accepted=await (async()=>{
    // rebuild it the way the server holds it: [tick, kind, uid, tid, wx, wy]
    return [[acceptedTicks[0],'auto',-1,1,null,null]].concat(
      acceptedTicks.slice(1).map(t=>[t,'ult',0,3,null,null]));
  })();
  const truth=host.campaign(st.snaps, enc[0].waves, st.seed>>>0, accepted);
  const out=await req('/api/campaign/resolve',{attemptId:st.attemptId,requestId:rid(),
    inputLog:[[1,'ult',0,3,null,null],[2,'ult',1,3,null,null],[3,'ult',2,3,null,null]],   // a DIFFERENT log
    digest:truth.digest},T);
  ck('the resolve says it used the streamed receipts', out.transcript==='streamed-receipts', JSON.stringify(out).slice(0,160));
  ck('a submitted transcript that differs from the receipts is ignored, and the receipted fight verifies',
     out.ok===true && out.verified===true && out.digestMatch===true, JSON.stringify(out).slice(0,160));
  ck('the receipted action count is what the server accepted', out.actions===accepted.length, String(out.actions));
  ck('the response carries the action hash chain', typeof out.chain==='string' && out.chain.length>0);

  // --- actions after the battle ended are refused ---------------------------
  S.send({t:'act', sessionId:st.attemptId, seq:4, tick:120, kind:'ult', casterUid:0, targetUid:3});
  await wait(150);
  ck('an action arriving after the battle resolved is refused', S.acks.some(a=>a.reason==='session-ended'||a.reason==='no-session'));

  /* --- a dropped channel falls back honestly, and the receipt says so ------- */
  const st2=await req('/api/campaign/start',{mode:'normal',node:1,heroIds:SQUAD,requestId:rid()},T);
  const S2=await sock(T);
  S2.send({t:'act', sessionId:st2.attemptId, seq:1, kind:'begin'}); await wait(150);
  S2.send({t:'act', sessionId:st2.attemptId, seq:2, kind:'ult', casterUid:0, targetUid:3}); await wait(150);
  S2.send({t:'act', sessionId:st2.attemptId, seq:3, kind:'abandon'}); await wait(200);
  ck('a client that loses the channel can abandon the partial stream', S2.acks.some(a=>a.abandoned===true));
  const local=[[45,'ult',0,3,null,null]];
  const t2=host.campaign(st2.snaps, enc[0].waves, st2.seed>>>0, local);
  const o2=await req('/api/campaign/resolve',{attemptId:st2.attemptId,requestId:rid(),inputLog:local,digest:t2.digest},T);
  ck('the fallback still verifies the player\'s own fight', o2.ok===true && o2.verified===true);
  ck('and the receipt says the stream was lost, not that it was clean',
     o2.transcript==='submitted-log-after-stream-loss', String(o2.transcript));
  S2.ws.close();

  S.ws.close();
  console.log(''); console.log('PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
