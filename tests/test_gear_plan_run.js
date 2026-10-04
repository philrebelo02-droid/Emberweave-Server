// 4 Oct 2026 Forge re-audit #1 #9 (v1008): a Quick Build that stops partway equips NOTHING (it used to equip and bind the last
// intermediate piece) and says where it stopped; a finished plan still equips the end item. Runs the page's own gearPlanRun with stubs.
// Asserts (non-zero exit). Control: AUD_PAGE=<pre-fix emberweave-heroes.html> must FAIL.
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const page=process.env.AUD_PAGE||path.join(__dirname,'..','emberweave-heroes.html'), src=fs.readFileSync(page,'utf8');
const a=src.indexOf('async function gearPlanRun'), b=src.indexOf('\nfunction gearConfirmQuick',a); assert(a>0&&b>a,'gearPlanRun found');
let pass=0, missed=[]; const ok=(c,m)=>{ if(process.env.AUD_PAGE&&!c){ missed.push(m); return; } assert(c,m); pass++; };
async function run(failAt){ const calls=[], msgs=[]; let i=0;
  const ctx={FORGE:{busy:false,st:{revision:1}}, forgeSync:async()=>{}, renderHeroDetail:()=>{}, bannerMsg:m=>msgs.push(m),
    api:async(p)=>{ calls.push(p); if(p.includes('equip')) return {ok:true}; i++; return i===failAt?{error:'Not enough materials.'}:{crafted:'it'+i,name:'Piece'+i}; }};
  vm.createContext(ctx); vm.runInContext(src.slice(a,b)+';this.g=gearPlanRun;',ctx);
  await ctx.g({steps:[{kind:'sub'},{},{}]},'vael'); return {equip:calls.filter(c=>c.includes('equip')).length, msgs:msgs.join(' | ')}; }
(async()=>{ try{
  const p=await run(2);
  ok(p.equip===0,'a plan that fails at step 2 of 3 equips nothing ('+p.msgs+')');
  ok(/Stopped at step 1 of 3: Not enough materials/.test(p.msgs),'and says where it stopped and why ('+p.msgs+')');
  const f=await run(0);
  ok(f.equip===1&&/Piece3 equipped/.test(f.msgs),'a finished plan equips the end item ('+f.msgs+')');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_gear_plan_run.js: '+pass+' checks passed, '+missed.length+' failed (page '+path.basename(page)+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } })();
