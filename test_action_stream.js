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

  // --- a well-formed live action is accepted --------------------------------
  S.send({t:'act', sessionId:st.attemptId, seq:1, tick:30, kind:'auto', casterUid:-1, targetUid:-1, value:1});
  await wait(180);
  const a1=ackFor(S.acks,1);
  ck('a live action is accepted and receipted', a1 && a1.ok===true, JSON.stringify(a1));
  ck('the receipt carries the accepted tick and a hash chain', a1 && a1.tick===30 && typeof a1.chain==='string' && a1.chain.length>0);

  // --- the server owns the sequence ----------------------------------------
  S.send({t:'act', sessionId:st.attemptId, seq:1, tick:40, kind:'ult', casterUid:0, targetUid:3});
  await wait(150);
  ck('a repeated sequence number is refused', (S.acks.filter(a=>a.seq===1).pop()||{}).reason==='out-of-order',
     JSON.stringify(S.acks.filter(a=>a.seq===1).pop()));
  S.send({t:'act', sessionId:st.attemptId, seq:5, tick:50, kind:'ult', casterUid:0, targetUid:3});
  await wait(150);
  ck('a gap in the sequence is refused', (ackFor(S.acks,5)||{}).ok===false && (ackFor(S.acks,5)||{}).reason==='out-of-order');

  // --- an action cannot claim a moment the clock has not reached ------------
  S.send({t:'act', sessionId:st.attemptId, seq:2, tick:9000, kind:'ult', casterUid:0, targetUid:3});
  await wait(150);
  const ahead=ackFor(S.acks,2);
  ck('an action ahead of the wall clock is refused (no composing the fight in one burst)',
     ahead && ahead.ok===false && ahead.reason==='tick-ahead-of-clock', JSON.stringify(ahead));

  // --- ticks may not go backwards ------------------------------------------
  S.send({t:'act', sessionId:st.attemptId, seq:2, tick:60, kind:'ult', casterUid:0, targetUid:3});
  await wait(150);
  ck('a legal second action is accepted', (ackFor(S.acks,2)||{}).ok===true);
  S.send({t:'act', sessionId:st.attemptId, seq:3, tick:10, kind:'ult', casterUid:1, targetUid:3});
  await wait(150);
  ck('an action whose tick goes backwards is refused', (ackFor(S.acks,3)||{}).reason==='tick-went-backwards');

  // --- a bad kind / caster / session ----------------------------------------
  S.send({t:'act', sessionId:st.attemptId, seq:3, tick:70, kind:'teleport', casterUid:0, targetUid:3});
  await wait(150);
  ck('an unknown action kind is refused', (ackFor(S.acks,3)||{}).reason==='bad-kind');
  S.send({t:'act', sessionId:'not-a-session', seq:1, tick:70, kind:'ult', casterUid:0, targetUid:3});
  await wait(150);
  ck('an action for a session that is not yours is refused', S.acks.some(a=>a.reason==='no-session'));

  // --- the resolve replays THE SERVER'S list, not the body's ----------------
  const host=require('./server/sim-host.js').load(__dirname+'/emberweave-heroes.html');
  const enc=JSON.parse(require('fs').readFileSync(__dirname+'/server/campaign-encounters.json','utf8'));
  const accepted=[[30,'auto',-1,1,null,null],[60,'ult',0,3,null,null]];
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

  S.ws.close();
  console.log(''); console.log('PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
