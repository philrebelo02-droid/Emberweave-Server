// 4 Oct 2026 v1020 - a full-auto fight (simFightResult: bot-city marches, mine garrisons, Skyfall/war lines, the arena
// re-roll) is the AI's fight on BOTH sides. The player's side never cast an ultimate on the server (autoUlt defaults to
// false there) and on the client it followed the player's last AUTO toggle - so a mirror match was won by the foe ~95%
// of the time and the same march could end differently in the browser and on the server.
// Asserts (non-zero exit). Control: AUD_HTML=<pre-fix emberweave-heroes.html> must FAIL.
const assert=require('assert'),path=require('path'),vm=require('vm');
const html=process.env.AUD_HTML||path.join(__dirname,'..','emberweave-heroes.html');
const host=require('../server/sim-host.js').load(html);
let pass=0; const missed=[];
const ok=(c,m)=>{ if(process.env.AUD_HTML&&!c){ missed.push(m); return; } assert(c,m); pass++; };
const keys=['grosk','astra','lumi','grimsby','yenna'];
const team=host.snapSquad(keys);
ok(Array.isArray(team)&&team.length===5,'five snapshots built');
const mirror=()=>JSON.parse(JSON.stringify(team));
// 1. the result never depends on the player's AUTO toggle
let same=0; const N=12;
for(let s=1;s<=N;s++){
  vm.runInContext('autoUlt=false;',host.ctx); const a=host.auto(mirror(),mirror(),s*7919);
  vm.runInContext('autoUlt=true;',host.ctx);  const b=host.auto(mirror(),mirror(),s*7919);
  if(a.digest===b.digest) same++;
}
ok(same===N,'the AUTO toggle left over from another fight does not change a full-auto result ('+same+'/'+N+' identical)');
// count every ultimate cast, by side (castAbility is the one place an ultimate fires)
vm.runInContext('var __ults={ally:0,enemy:0}; var __cast=castAbility; castAbility=function(u){ if(u&&__ults[u.team]!=null)__ults[u.team]++; return __cast.apply(this,arguments); };',host.ctx);
const casts=fn=>{ vm.runInContext('__ults.ally=0;__ults.enemy=0;',host.ctx); fn(); return JSON.parse(vm.runInContext('JSON.stringify(__ults)',host.ctx)); };
// 2. the player's side casts its ultimates in a full-auto fight, as the foe's does
vm.runInContext('autoUlt=false;',host.ctx);
const c=casts(()=>{ for(let s=1;s<=10;s++) host.auto(mirror(),mirror(),s*104729); });
ok(c.ally>0&&c.ally>=c.enemy*0.5,'the player side casts ultimates in a full-auto fight (ally '+c.ally+', foe '+c.enemy+' over 10 fights)');
// 3. a manual replay still leaves the ultimates to the recorded log: an empty log casts no player ultimate
vm.runInContext('autoUlt=true;',host.ctx);
const r=casts(()=>{ for(let s=1;s<=5;s++) host.replay(mirror(),mirror(),s*31337,[]); });
ok(r.ally===0&&r.enemy>0,'a manual replay with an empty log casts no player ultimate (ally '+r.ally+', foe '+r.enemy+')');
ok(vm.runInContext('autoUlt',host.ctx)===true,'the AUTO toggle is restored after a sim fight');
if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
console.log('test_auto_ult.js: '+pass+' checks passed, '+missed.length+' failed');
