// Phil 3 Oct 2026: resources renamed ("Set a is good": Emberite/Voidglass/Starsilver/Cinderwood; code keys iron/crystal/silver/coal unchanged),
// "All 4 resources are equal in worth", "different skills require 2 materials", "ability power might require void glass + emberite,
// attack damage would require the opposite 2 starsilver and cinderwood". Runs the REAL learnResCost (client) and learnResCostSrv (server)
// in a vm: same table both sides, every skill track costs exactly 2 materials at equal amounts, AP = Voidglass+Emberite, ATK = Starsilver+Cinderwood,
// each material used by the same number of tracks; the player-facing names are the new ones (client RES table, server shortfall message).
// Asserts, exits non-zero. Control: RNC_HTML=<pre-change html> RNC_SERVER=<pre-change server> must FAIL.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(process.env.RNC_HTML||path.join(root,'emberweave-heroes.html'),'utf8');
const srv=fs.readFileSync(process.env.RNC_SERVER||path.join(root,'server.js'),'utf8');
const sha=t=>crypto.createHash('sha256').update(t).digest('hex').slice(0,16);
let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; };
const line=(src,sig)=>{ const i=src.indexOf(sig); assert(i>=0,'found '+sig); return src.slice(i,src.indexOf('\n',i)); };
try{
  const ctx=vm.createContext({}); vm.runInContext(line(html,'function learnResCost('),ctx); { const i=srv.indexOf('function learnResCostSrv('); assert(i>=0,'found learnResCostSrv'); ctx.ACADEMY_ECON={levelCost:()=>0,RESOURCES:[]}; vm.runInContext(srv.slice(i,srv.indexOf('\nconst ACADEMY_CUTOFF',i)),ctx); }   // spans two lines since the Academy level costs all four (3 Oct)
  const TRACKS=['atk','ap','hp','def','armor','mr','crit','critres'], uses={iron:0,crystal:0,silver:0,coal:0};
  for(const t of TRACKS) for(const lv of [0,7,40]){
    const c=vm.runInContext('learnResCost('+JSON.stringify(t)+','+lv+')',ctx), s=vm.runInContext('learnResCostSrv('+JSON.stringify(t)+','+lv+')',ctx);
    ok(JSON.stringify(c)===JSON.stringify(s),t+' L'+lv+': client and server cost the same ('+JSON.stringify(c)+' vs '+JSON.stringify(s)+')');
    const ks=Object.keys(c); ok(ks.length===2&&ks.every(k=>k in uses),t+' L'+lv+': exactly 2 materials ('+ks+')');
    ok(c[ks[0]]===c[ks[1]],t+' L'+lv+': equal amounts of both (equal worth)');
    if(lv===0) for(const k of ks) uses[k]++; }
  const set=t=>Object.keys(vm.runInContext('learnResCost('+JSON.stringify(t)+',0)',ctx)).sort().join('+');
  ok(set('ap')==='crystal+iron','ability power = Voidglass + Emberite ('+set('ap')+')');
  ok(set('atk')==='coal+silver','attack = Starsilver + Cinderwood ('+set('atk')+')');
  ok(Object.values(uses).every(n=>n===TRACKS.length*2/4),'each material is used by the same number of tracks ('+JSON.stringify(uses)+')');
  const res=line(html,'const RES=[');
  ok(/'iron','[^']*','Emberite'/.test(res)&&/'crystal','[^']*','Voidglass'/.test(res)&&/'silver','[^']*','Starsilver'/.test(res)&&/'coal','[^']*','Cinderwood'/.test(res),'client RES table shows the new names');
  ok(!/'(Iron|Crystal|Silver|Coal)'/.test(res),'client RES table shows no old name');
  ok(/'Not enough '\+\(RES_NAMES\[k\]\|\|k\)/.test(srv)&&/RES_NAMES=\{iron:'Emberite',crystal:'Voidglass',silver:'Starsilver',coal:'Cinderwood'\}/.test(srv),'server shortfall message uses the new names');
  console.log('test_resource_names_costs.js: '+pass+' checks passed (client sha256 '+sha(html)+', server sha256 '+sha(srv)+')');
}catch(e){ console.error('FAIL',e.message); process.exitCode=1; }
