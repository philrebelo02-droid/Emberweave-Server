// v1090 - scan 11 #1: Server 2-5 re-check linked accounts against Server 1 (acctStatusSync). Only accounts with a session HERE or a ban
// were checked, so a player who reset their password on Server 1 while holding no session here kept their OLD password hash here -
// and the login fallback (Server 1 unreachable) accepted it. Accounts holding a local password copy are now checked too.
// Runs the server's own acctStatusSync/applyAcctState against a stub account server. Control: AUD_SERVER=<pre-fix copy> must FAIL.
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..',process.env.AUD_SERVER||'server.js'),'utf8');
let pass=0,missed=[]; const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const fnSrc=name=>{ const i=src.indexOf(name); if(i<0) return ''; let j=src.indexOf('{',i), d=0; for(;j<src.length;j++){ if(src[j]==='{')d++; else if(src[j]==='}'){ d--; if(!d) break; } } return src.slice(i,j+1); };
const code=['function applyAcctState','async function acctStatusSync'].map(fnSrc).join('\n')+'\nthis.sync=acctStatusSync;';
const asked=[], dropped=[];
const ctx={ ACCOUNT_AUTHORITY:'http://s1', ACCOUNT_LINK_SECRET:'x', _acctSyncBusy:false, console:{log(){}}, Date, Object, Set, Array, String, Math,
  DB:{ tokens:{}, byGid:{ g1:'u1', g2:'u2' }, users:{
    u1:{ id:'u1', gid:'g1', name:'reset-elsewhere', hash:'OLDHASH', salt:'s', iters:210000, passSeenAt:1000 },   // no session here, local copy kept
    u2:{ id:'u2', gid:'g2', name:'guest-like' } } },                                                                // linked, no copy, no session
  tokOwner:()=>null, isBanned:()=>false, dropTokens:id=>dropped.push(id), writeDB(){},
  authorityCall:async(route,body)=>{ asked.push(...body.gids); const states={}; for(const g of body.gids) states[g]={until:0,reason:'',passAt:5000}; return {status:200,body:{states}}; } };
vm.runInNewContext(code,ctx);
(async()=>{
  await ctx.sync(); const u1=ctx.DB.users.u1;
  ok(asked.includes('g1'),'an account with a local password copy and no session here is checked against Server 1 (asked: '+asked.join(',')+')');
  ok(!u1.hash&&!u1.salt&&u1.passSeenAt===5000,'a newer password on Server 1 drops the stale local copy (hash '+(u1.hash||'gone')+')');
  ok(!asked.includes('g2'),'CONTROL: a linked account with no copy, no session and no ban is not asked about');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_acct_sync_1090.js: '+pass+' checks passed, '+missed.length+' failed');
})().catch(e=>{ console.error('FAIL',e.message); process.exitCode=1; });
