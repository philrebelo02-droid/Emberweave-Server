// 3 Oct 2026 audit (Island of Trials #6): the Emberdraft "buy attempts" button must keep ONE requestId until a definite
// answer - a lost reply (offline) or a refused save (storageFailed) re-sends the same id, so a retap cannot buy twice.
// Runs the real buy.onclick statement from emberweave-heroes.html in a vm with a scripted api(); asserts, exits non-zero
// on failure. Control: ED_HTML=<v948 file> must FAIL (it makes a new id per tap).
const fs=require('fs'), path=require('path'), vm=require('vm'), assert=require('assert');
const html=fs.readFileSync(process.env.ED_HTML||path.join(__dirname,'..','emberweave-heroes.html'),'utf8');
const a=html.indexOf('  buy.onclick=()=>gameConfirm('); assert(a>0,'buy handler found');
const b=html.indexOf('\n  solo.onclick=',a); assert(b>a,'end of buy handler found');
const holder=/const ED_BUY_RID=\{id:null\};/.test(html)?'const ED_BUY_RID={id:null};':'';
const sent=[], script=[]; let n=0;
const buy={dataset:{pack:3,cost:150},disabled:false};
const ctx={buy, sent, gameConfirm:(msg,cb)=>cb(), uid8:()=>'id'+(++n), adoptLedger(){}, updateHubChrome(){}, show(){}, edNiceErr:(e,d)=>e||d,
  api:(p,m,body)=>{ sent.push(body.requestId); return Promise.resolve(script.shift()); } };
vm.createContext(ctx); vm.runInContext(holder+'\n'+html.slice(a,b),ctx);
(async()=>{ let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; };
  const tap=async r=>{ script.push(r); buy.onclick(); await new Promise(r=>setImmediate(r)); };
  await tap({error:'offline'}); await tap({ok:false,storageFailed:true,error:'Save failed. Retry the same request.'}); await tap({ok:true,edraft:{}});
  ok(sent[0]===sent[1],'retry after a lost reply re-sends the same id ('+sent[0]+','+sent[1]+')');
  ok(sent[1]===sent[2],'retry after a refused save re-sends the same id ('+sent[1]+','+sent[2]+')');
  await tap({ok:false,error:'Not enough diamonds.'}); ok(sent[3]!==sent[2],'after a definite answer the next purchase is a new request');
  await tap({ok:true,edraft:{}}); ok(sent[4]===sent[3]?false:true,'a definite refusal also starts a fresh id next time ('+sent[3]+','+sent[4]+')');
  console.log('test_ed_buy_rid.js: '+pass+' checks passed');
})().catch(e=>{ console.error('FAIL',e.message); process.exitCode=1; });
