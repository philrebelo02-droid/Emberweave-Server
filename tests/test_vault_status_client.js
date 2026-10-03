// 3 Oct 2026 audit (Vault F6): a Vault status reply that is not the server's (offline / 429 / auth / null) used to read as
// "Vault disabled" and rendered the legacy Challenge Dungeon (whose /api/trial/resolve lets the server decide fights). Runs the
// REAL vaultStatus() from emberweave-heroes.html in a vm with scripted api() replies; server answers must be handled exactly as
// before (enabled:true kept; enabled:false -> {enabled:false}). Also checks renderDungeon shows the unreachable screen BEFORE the
// legacy branch. Asserts, exits non-zero. Control: VSC_HTML=<pre-fix html> must FAIL.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const html=fs.readFileSync(process.env.VSC_HTML||path.join(__dirname,'..','emberweave-heroes.html'),'utf8');
const sha=crypto.createHash('sha256').update(html).digest('hex'); let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; };
const fn=sig=>{ const i=html.indexOf(sig); assert(i>=0,'found '+sig); const e=[html.indexOf('\nfunction ',i+1),html.indexOf('\nasync function ',i+1)].filter(x=>x>0); return html.slice(i,Math.min(...e)); };
(async()=>{
  let reply=null; const ctx=vm.createContext({VAULT:{}, api:async()=>reply, vaultResendPending:async()=>{}, JSON, Object});
  vm.runInContext(fn('async function vaultStatus('),ctx);
  const run=async r=>{ reply=r; return vm.runInContext('vaultStatus()',ctx); };
  for(const r of [{error:'offline'},{error:'Slow down — too many requests.'},{error:'auth'},null,'x']){
    const st=await run(r); ok(st&&st.unreachable===true&&st.enabled===false,'not a server status -> unreachable, not "disabled" ('+JSON.stringify(r)+')'); }
  const en={enabled:true,currentFloor:3,highestClearedFloor:2}; ok(JSON.stringify(await run(en))===JSON.stringify(en),'enabled status kept as before');
  ok(JSON.stringify(await run({enabled:false,locked:true,unlockLevel:10,playerLevel:4}))===JSON.stringify({enabled:false}),'server enabled:false handled exactly as before');
  const rd=fn('function renderDungeon('); const iU=rd.indexOf('VAULT.st.unreachable'), iL=rd.indexOf("CUR={mode:'dungeon'}");
  ok(iU>0&&iL>0&&iU<iL,'renderDungeon shows the unreachable screen before the legacy dungeon branch');
  ok(/vaultRetry/.test(rd),'the unreachable screen has a Retry control');
  console.log('test_vault_status_client.js: '+pass+' checks passed (client sha256 '+sha.slice(0,16)+')');
})().catch(e=>{ console.error('FAIL',e.message); process.exitCode=1; });
