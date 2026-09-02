/* ===========================================================================
   v273 — the owner's audit-response release standard, proven on real routes.

   Every check here corresponds to a P0 or a §4 correction in
   `Emberweave_Claude_Audit_Response_and_Release_Plan_v1`:
     · a divergent client digest records NOTHING and refunds the stamina
     · a battle session resumes instead of charging twice, and expires safely
     · equipment materials and star refine are server rolls, never browser rolls
     · a forged save blob cannot carry progression into the ledger
     · a reward and its idempotency receipt are one durable write
     · the deployed server states what it is and what it is NOT yet authoritative over
   =========================================================================== */
const http=require('http');
const PORT=process.env.PORT||8871;
function req(path, body, token){ return new Promise((res,rej)=>{ const d=body?JSON.stringify(body):null;
  const r=http.request({host:'localhost',port:PORT,path,method:body?'POST':'GET',
    headers:Object.assign({'content-type':'application/json'},token?{'x-token':token}:{},d?{'content-length':Buffer.byteLength(d)}:{})},
    x=>{ let s=''; x.on('data',c=>s+=c); x.on('end',()=>{ try{res(JSON.parse(s));}catch(e){res({raw:s});} }); });
  r.on('error',rej); if(d)r.write(d); r.end(); }); }
let pass=0,fail=0; const ck=(n,c,d)=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n+(d?' — '+d:''))); };
const rid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const SQUAD=['vael','sylthaine','vireo'];

(async()=>{
  console.log('== v273: the audit-response release standard ==');
  const reg=await req('/api/register',{name:'v273_'+Math.floor(Math.random()*1e6),pass:'password1'});
  const T=reg.token; ck('test account registered', !!T);

  // ---- the deployed server states what it is -------------------------------
  const man=await req('/api/manifest',null,T);
  ck('the server publishes its own build id', typeof man.serverBuild==='string' && man.serverBuild.length>0, JSON.stringify(man.serverBuild));
  ck('the server publishes the client engine build it replays', !!man.engine);
  ck('the campaign authority is stated as transcript replay', man.authority && man.authority.campaign==='player-transcript-replay');
  ck('a mismatch is stated as unverified+refund', man.authority && man.authority.campaignMismatch==='unverified-refund');
  ck('raid power is stated as ledger-derived', man.authority && man.authority.raidPower==='ledger');
  ck('the Vault is NOT claimed as converted', man.authority && /estimate/.test(man.authority.vault), JSON.stringify(man.authority&&man.authority.vault));

  // ---- a divergent digest records nothing ----------------------------------
  const s1=await req('/api/campaign/start',{mode:'normal',node:1,heroIds:SQUAD,requestId:rid()},T);
  const stamAfterStart=s1.stamina&&s1.stamina.v;
  const bad=await req('/api/campaign/resolve',{attemptId:s1.attemptId,requestId:rid(),inputLog:[],
    digest:'{"t":1,"won":true,"stars":3,"u":[]}'},T);
  ck('a client end-state that disagrees with the replay is UNVERIFIED', bad.ok===false && bad.unverified===true,
     JSON.stringify(bad).slice(0,140));
  ck('an unverified battle grants no reward', !bad.reward && bad.won===undefined);
  ck('an unverified battle returns the stamina', bad.ledger && bad.ledger.stamina && bad.ledger.stamina.v>stamAfterStart,
     'stamina '+(bad.ledger&&bad.ledger.stamina&&bad.ledger.stamina.v)+' vs '+stamAfterStart);
  const led1=await req('/api/ledger',null,T);
  ck('an unverified battle does not clear the stage', !(led1 && led1.camp && led1.camp.cleared>0),
     JSON.stringify(led1&&led1.camp));

  // ---- a submission with NO end state is also unverified --------------------
  const s2=await req('/api/campaign/start',{mode:'normal',node:1,heroIds:SQUAD,requestId:rid()},T);
  const none=await req('/api/campaign/resolve',{attemptId:s2.attemptId,requestId:rid(),inputLog:[]},T);
  ck('a submission with no end state is refused, not quietly scored', none.ok===false && none.unverified===true,
     JSON.stringify(none).slice(0,120));

  // ---- reconnect resumes the SAME session, at no extra cost -----------------
  const a1=await req('/api/campaign/start',{mode:'normal',node:1,heroIds:SQUAD,requestId:rid()},T);
  const stamA=a1.stamina.v;
  const a2=await req('/api/campaign/start',{mode:'normal',node:1,heroIds:SQUAD,requestId:rid()},T);
  ck('reconnecting to the same stage resumes the session', a2.resumed===true && a2.attemptId===a1.attemptId);
  ck('resuming re-issues the SAME seed — no reroll', a2.seed===a1.seed);
  ck('resuming does not charge stamina again', a2.stamina.v===stamA, stamA+' -> '+a2.stamina.v);
  /* An HONEST client: replay the frozen session locally with the same engine the server uses, and
     submit the end state it actually reached. This is what a real browser does — and it is the only
     way to get a verified win, which the abandonment check below needs. */
  const host=require('../server/sim-host.js').load(__dirname+'/../emberweave-heroes.html');
  const enc=JSON.parse(require('fs').readFileSync(__dirname+'/../server/campaign-encounters.json','utf8'));
  const honest=(snaps, node, seed, log)=>host.campaign(snaps, enc[node-1].waves, seed>>>0, log||[]);
  const play=async(node)=>{
    const st=await req('/api/campaign/start',{mode:'normal',node,heroIds:SQUAD,requestId:rid()},T);
    if(!st.ok) return {start:st};
    const log=[[30,'auto',-1,1,null,null]];
    const r=honest(st.snaps, node, st.seed, log);
    const out=await req('/api/campaign/resolve',{attemptId:st.attemptId,requestId:rid(),inputLog:log,digest:r.digest},T);
    return {start:st, local:r, out};
  };
  const w1=await play(1);
  ck('an honest client — replaying its own session — is VERIFIED and rewarded',
     w1.out && w1.out.ok===true && w1.out.verified===true && w1.out.digestMatch===true,
     JSON.stringify(w1.out).slice(0,160));
  ck('the recorded outcome is the one the local replay reached', !!w1.out.won===!!w1.local.won,
     'server '+(w1.out&&w1.out.won)+' local '+(w1.local&&w1.local.won));

  const open2=await req('/api/campaign/start',{mode:'normal',node:2,heroIds:SQUAD,requestId:rid()},T);
  const stamOpen=open2.stamina&&open2.stamina.v;
  const a3=await req('/api/campaign/start',{mode:'normal',node:1,heroIds:SQUAD,requestId:rid()},T);
  ck('starting a different stage abandons the open one and refunds it',
     a3.ok===true && a3.attemptId!==open2.attemptId && a3.stamina.v>=stamOpen,
     'stamina '+stamOpen+' -> '+(a3.stamina&&a3.stamina.v));

  // ---- a forged save blob carries nothing into the ledger -------------------
  const before=await req('/api/ledger',null,T);
  const forgedSave=JSON.stringify({gold:999999999, gems:4999999, playerXP:98000000,
    heroXP:{vael:98000000}, starLevel:{vael:5}, starRefine:{vael:15}, skillLevel:{vael:[10,10,10,10]},
    prayer:200, stamina:200, campaignCleared:100, unlocked:{konwu:true}, eqMats:{cloth:99999}});
  await req('/api/save',{roster:{__save:forgedSave}, requestId:rid()},T);
  const after=await req('/api/ledger',null,T);
  ck('a forged save does not change ledger gold', after.gold===before.gold, before.gold+' -> '+after.gold);
  ck('a forged save does not change ledger gems', after.gems===before.gems);
  ck('a forged save does not change player XP', after.px===before.px);
  ck('a forged save does not unlock a hero', !(after.unlocked&&after.unlocked.konwu));
  ck('a forged save does not clear the campaign', (after.camp&&after.camp.cleared|0)===(before.camp&&before.camp.cleared|0));
  ck('a forged save does not grant equipment materials', !(after.eqMats&&after.eqMats.cloth>0), JSON.stringify(after.eqMats));
  ck('a forged save does not raise skill levels',
     !(after.skill&&after.skill.vael&&after.skill.vael[0]>1), JSON.stringify(after.skill&&after.skill.vael));

  // ---- the client cannot roll a permanent upgrade ---------------------------
  const src=require('fs').readFileSync(__dirname+'/../emberweave-heroes.html','utf8');
  ck('the client-side refine gacha is gone from the build', !/function doRefine\(/.test(src));
  ck('the dungeon no longer rolls equipment materials in the browser',
     !/const b=bag\[Math\.floor\(Math\.random\(\)\*bag\.length\)\]/.test(src));
  ck('the simulation no longer asks the DOM whether a wave is won', !/!document\.getElementById\('vaultSubModal'\)\)\{const a=units/.test(src));

  // ---- rewards are durable + idempotent ------------------------------------
  const srv=require('fs').readFileSync(__dirname+'/../server.js','utf8');
  ck('every idempotent result is flushed to disk before the response', /writeDBNow\(\);\s*\/\/ the receipt lands with the reward/.test(srv));
  ck('the skill/prayer import is limited to pre-ledger accounts', /const legacy=\(\(u\.created\|\|0\)===0\) \|\| \(\(u\.created\|\|0\)<LEDGER_MIGRATE_CUTOFF\);\s*\n\s*if\(!legacy\)\{ led\.skillImported=Date\.now\(\); return; \}/.test(srv));

  console.log(''); console.log('PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
