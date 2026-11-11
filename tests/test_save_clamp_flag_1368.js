// v1368 (Claude 11 Nov 2026, save-clamp false flags): sanitizeSave filed the 'save-clamp' cheat signal (and an integrity flag) whenever
// migrateHeroIdsBlob translated an old hero id (tallow -> gruel, ...) from a not-yet-updated client - an honest save. Now only an
// ECON_CAP / MAP_CAP clamp files it. Runs the server's own sanitizeSave (and its id rename) in a vm with feedbackCheatSignal recorded.
// CONTROL: the same old-id save on a0155de5 (before the fix) filed the signal. Asserts, exits non-zero. Grok.
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process');
const ROOT=path.join(__dirname,'..');
function load(src){
  const cut=(a,b,incl)=>{ const i=src.indexOf(a); assert(i>=0,a+' in server.js'); const j=src.indexOf(b,i); assert(j>i,b+' after '+a); return src.slice(i,incl?j+b.length:j); };
  const code=cut('const HERO_ID_RENAME=','let saveTimer=null;')+'\n'+cut('const ECON_CAP=','roster.__save=JSON.stringify(g); return roster; }',true);
  const signals=[];
  const ctx=vm.createContext({DB:{users:{}},console:{log(){}},glyphAudit(){},feedbackCheatSignal:(u,signal,detail,meta)=>signals.push({user:u.id,signal,meta})});
  vm.runInContext(code+'\nthis.sanitizeSave=sanitizeSave;',ctx);
  return {run:(blob,u)=>{ u=u||{id:'p1',name:'P'}; const r=ctx.sanitizeSave(u,{__save:JSON.stringify(blob)}); return {u,g:JSON.parse(r.__save),signals:signals.splice(0)}; }};
}
let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; console.log('  ok   '+m); };
const S=load(fs.readFileSync(path.join(ROOT,'server.js'),'utf8'));
const oldIds={gold:1000,gems:50,heroFrag:{tallow:5,vael:2},squads:{campaign:['tallow','vael']},unlocked:['tallow']};
let r=S.run(oldIds);
ok(r.g.heroFrag.gruel===5&&r.g.heroFrag.tallow===undefined&&r.g.squads.campaign[0]==='gruel'&&r.g.unlocked[0]==='gruel','an old-id save is still translated (tallow -> gruel)');
ok(r.signals.length===0,'an old-id save files no save-clamp cheat signal');
ok(!r.u.flag,'an old-id save gets no integrity flag');
r=S.run({gold:3e9,gems:10});
ok(r.g.gold===2e9,'an over-cap gold save is clamped to ECON_CAP');
ok(r.signals.length===1&&r.signals[0].signal==='save-clamp'&&r.u.flag&&r.u.flag.reason==='impossible value clamped','an over-cap (ECON_CAP) save files save-clamp and the flag');
r=S.run({gold:10,mats:{ore:2e7}});
ok(r.g.mats.ore===1e7&&r.signals.length===1&&r.signals[0].signal==='save-clamp','an over-MAP_CAP save is clamped and files save-clamp');
r=S.run({gold:10,heroFrag:{tallow:2e7}});
ok(r.g.heroFrag.gruel===1e7&&r.signals.length===1&&r.signals[0].signal==='save-clamp','old ids AND an over-cap value: translated, clamped, still flagged');
r=S.run({gold:10,gems:5,heroFrag:{vael:3}});
ok(r.signals.length===0&&!r.u.flag,'a plain honest save files nothing');
r=S.run({gold:10,gems:400000,heroFrag:{tallow:1}},{id:'p2',name:'Q',econ:{gems:10,gold:10}});
ok(r.signals.length===0&&r.u.flag&&/diamond spike/.test(r.u.flag.reason),'an old-id save with a diamond spike is now flagged as the spike (before, the translate hid it as a clamp)');
// CONTROL: the code before the fix
let base=null; try{ base=cp.execSync('git show a0155de5:server.js',{cwd:ROOT,maxBuffer:256<<20}).toString(); }catch(e){}
if(base){ const C=load(base); const c=C.run(oldIds);
  ok(c.signals.length===1&&c.signals[0].signal==='save-clamp'&&c.u.flag&&c.u.flag.reason==='impossible value clamped','CONTROL: on a0155de5 the same old-id save filed save-clamp (the false flag)'); }
else console.log('  (CONTROL skipped: git show a0155de5 unavailable)');
console.log('test_save_clamp_flag_1368.js: '+pass+' checks passed');