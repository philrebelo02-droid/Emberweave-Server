const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const source=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','emberweave-heroes.html'),'utf8');
const start=source.indexOf('let _signinBusy=false;');
const stop=source.indexOf('function renderSignin()',start);
assert(start>=0&&stop>start);
(async()=>{
 let shown;
 const ctx={ACC:{token:'fixture'},G:{signinClaimed:[]},signinEnsure(){},signinNow:()=>new Date(2026,10,2),
  signinDayReward:()=>({label:'stamina:60'}),signinMonthKey:()=> '2026-11',api:async()=>({ok:true,month:'2026-11',day:2,got:{stamina:2}}),
  t:(_,v)=>'stamina:'+v.n,saveG(){},updateHubChrome(){},renderSignin(){},showSigninReward(r){shown=r.label;}};
 vm.runInNewContext(source.slice(start,stop)+'signinClaimToday();',ctx);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(shown,'stamina:2');
 console.log('PASS: sign-in reward shows the amount credited');
})().catch(e=>{console.error(e);process.exitCode=1;});
