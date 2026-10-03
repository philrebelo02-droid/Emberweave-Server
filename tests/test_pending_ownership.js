// 3 Oct 2026 (ChatGPT review HOLD 03:27 on 1761694d/1c521e81): the saved-result helpers for the Starless Well, the Vault and the
// Emberdraft buy must use the REAL account shape (ACC.id - the game never sets ACC.profile) and must:
//  1 keep two accounts' saved results apart on one device;
//  2 keep the saved result on an uncertain reply (null / not an object / offline / storageFailed / auth);
//  3 ignore a late reply for an account that is no longer signed in (no delete of the new account's job, no ledger adoption);
//  4 still send the fight result when the device cannot save locally (sending is never worse than v948; only the retry is lost);
//  5 Emberdraft: an uncertain reply keeps the purchase id; another account gets its own id.
// Runs the real functions from emberweave-heroes.html in vms; asserts, exits non-zero. Control: PEND_HTML=<1c521e81 html> must FAIL.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const html=fs.readFileSync(process.env.PEND_HTML||path.join(__dirname,'..','emberweave-heroes.html'),'utf8');
const sha=crypto.createHash('sha256').update(html).digest('hex'); let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; };
const fn=sig=>{ const i=html.indexOf(sig); if(i<0) return ''; const e=[html.indexOf('\nfunction ',i+1),html.indexOf('\nasync function ',i+1)].filter(x=>x>0); return html.slice(i,Math.min(...e)); };
function site(kind,route,refresh){
  const src=['function pendingDefinite(','function '+kind+'PendingKey(','function '+kind+'PendingSave(','function '+kind+'PendingSettle(','async function '+kind+'ResendPending('].map(fn).join('\n');
  const slots=new Map(), adopted=[]; const c=vm.createContext({ACC:{token:'A-token',id:'A'},JSON,Object,console,
    localStorage:{getItem:k=>slots.has(k)?slots.get(k):null,setItem:(k,v)=>slots.set(k,String(v)),removeItem:k=>slots.delete(k)},
    adoptLedger:l=>adopted.push({acct:c.ACC.id,l}), api:async()=>({error:'offline'})});
  vm.runInContext(src,c); return {c,slots,adopted};
}
(async()=>{
  for(const [kind,route] of [['well','/api/well/resolve'],['vault','/api/dungeon/resolve-battle']]){
    const S=(n)=>kind+'PendingSave', ST=kind+'PendingSettle', R=kind+'ResendPending';
    // 1 two accounts on one device
    { const {c,slots}=site(kind,route); c.p={attemptId:'a1',requestId:'rA'}; vm.runInContext(S()+'(p)',c); c.ACC={token:'B-token',id:'B'}; c.p={attemptId:'b1',requestId:'rB'}; vm.runInContext(S()+'(p)',c);
      ok(slots.size===2,kind+': two accounts keep two saved results ('+[...slots.keys()].join(',')+')'); }
    // 2 uncertain replies keep the job (settle is called with the CAPTURED account)
    for(const r of [null,'x',{error:'offline'},{ok:false,storageFailed:true},{error:'auth'}]){
      const {c,slots}=site(kind,route); c.p={attemptId:'a1',requestId:'rA'}; vm.runInContext(S()+'(p)',c); c.r=r;
      try{ vm.runInContext(ST+'("A",r)',c); }catch(e){}
      ok(slots.size===1,kind+': uncertain reply '+JSON.stringify(r)+' keeps the saved result'); }
    { const {c,slots}=site(kind,route); c.p={attemptId:'a1',requestId:'rA'}; vm.runInContext(S()+'(p)',c); vm.runInContext(ST+'("A",{ok:true})',c);
      ok(slots.size===0,kind+': a definite answer clears it'); }
    // 3 late reply after an account switch
    { const {c,slots,adopted}=site(kind,route); c.p={attemptId:'a1',requestId:'rA'}; vm.runInContext(S()+'(p)',c);
      slots.set(kind==='well'?'ew_wellPending_B':'ew_vaultPending_B',JSON.stringify({acct:'B',attemptId:'b1',requestId:'rB'}));
      c.api=async()=>{ c.ACC={token:'B-token',id:'B'}; return {ok:true,ledger:{owner:'A'}}; };
      await vm.runInContext(R+'()',c);
      ok([...slots.keys()].some(k=>k.endsWith('_B')),kind+': a late A reply does not delete B\'s saved result');
      ok(adopted.length===0,kind+': a late A reply is not adopted into B'); }
    // 4 local save fails -> still sends (end path) - checked on the source: the save result is not a gate on the send
    { const {c}=site(kind,route); c.localStorage.setItem=()=>{ throw Error('quota'); }; c.p={attemptId:'a1',requestId:'rA'};
      ok(vm.runInContext(S()+'(p)',c)===false,kind+': a failed local save reports false');
      const end=kind==='well'?html.slice(html.indexOf('if(att&&ACC.token){ const _wa'),html.indexOf('\n',html.indexOf('if(att&&ACC.token){ const _wa'))):html.slice(html.indexOf('if(att){ const _va'),html.indexOf('\n',html.indexOf('if(att){ const _va')));
      ok(end.length>0&&/PendingSave\(_[wv]b\); (try\{ )?r=await api\(/.test(end),kind+': the end path sends regardless of the save result'); }
  }
  // 5 Emberdraft buy
  { const b=html.indexOf('  buy.onclick=()=>gameConfirm('), e=html.indexOf('\n  solo.onclick=',b); assert(b>0&&e>b,'buy handler found');
    const holder=(html.match(/const ED_BUY_RID=\{[^}]*\};/)||[''])[0]; const sent=[]; let n=0, reply=null;
    const c=vm.createContext({ACC:{token:'A-token',id:'A'},buy:{dataset:{pack:3,cost:150}},gameConfirm:(m,cb)=>cb(),uid8:()=>'id'+(++n),
      api:async(p,m,v)=>{ sent.push(v.requestId); return reply; },adoptLedger(){},updateHubChrome(){},show(){},edNiceErr:x=>x});
    vm.runInContext(fn('function pendingDefinite(')+'\n'+holder+'\n'+html.slice(b,e),c);
    const tap=async r=>{ reply=r; c.buy.onclick(); await new Promise(r=>setImmediate(r)); };
    await tap(null); await tap({ok:true}); ok(sent[0]===sent[1],'emberdraft: an uncertain (null) reply keeps the purchase id ('+sent[0]+','+sent[1]+')');
    c.ACC={token:'B-token',id:'B'}; await tap({error:'offline'}); ok(sent[2]!==sent[1],'emberdraft: another account gets its own purchase id'); }
  console.log('test_pending_ownership.js: '+pass+' checks passed (client sha256 '+sha.slice(0,16)+')');
})().catch(e=>{ console.error('FAIL',e.message); process.exitCode=1; });
