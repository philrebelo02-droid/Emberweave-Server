'use strict';
// CR1944 + CR1957 + CR2025 (ChatGPT, 1 Oct 2026) - the world mine routes (worldMineDurable), the teleport purchase /
// castle move routes (worldMoveDurable) and first castle placement (worldLocation) commit the account and its receipt
// to disk BEFORE they acknowledge, through ONE shared helper (durableUserCommit). Runs the real server.js functions.
const vm=require('node:vm'),assert=require('node:assert/strict');
const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8').split(String.fromCharCode(13)).join('');
function fnSource(name){ const at=source.indexOf('function '+name+'('); assert.notEqual(at,-1,name+' exists');
  let i=source.indexOf('{',at),d=0; for(;i<source.length;i++){ if(source[i]==='{')d++; else if(source[i]==='}'&&--d===0)break; } return source.slice(at,i+1); }
const SHARED=fnSource('durableUserCommit');
function box(DB){ const b={DB,DB_FILE:'isolated.json',PG_BOOT_PENDING:false,Date:{now:()=>1000},console:{error:()=>{}},pgSave:()=>{},fs:{writeFileSync:()=>{},renameSync:()=>{}},JSON,Object,Error,Array};
  vm.createContext(b); vm.runInContext(SHARED,b); return b; }
function check(name){
  const user={id:'u',value:1},DB={users:{u:user,other:{id:'other',value:9}},idem:{}},b=box(DB);
  vm.runInContext(fnSource(name),b);const fn=b[name];
  const mutate=u=>{u.value=2;return {ok:true,value:2};},before=JSON.stringify(DB);
  for(const action of ['writeFileSync','renameSync']){const old=b.fs[action];b.fs[action]=()=>{throw Error('injected');};const r=fn(user,'k',mutate);assert.equal(r.storageFailed,true);assert.equal(JSON.stringify(DB),before);b.fs[action]=old;}
  b.PG_BOOT_PENDING=true;let called=false;const pr=fn(user,'k',()=>{called=true;return {ok:true};});assert.equal(pr.storageFailed,true);b.PG_BOOT_PENDING=false;
  assert.equal(fn(user,'bad',u=>{u.value=20;return {ok:false};}).ok,false);assert.equal(JSON.stringify(DB),before);
  assert.equal(fn(user,'k',mutate).ok,true);assert.equal(DB.users.u.value,2);assert.equal(DB.users.other.value,9);assert.equal(user.value,1,'Old user reference must not mutate during staging');
  let reran=false;assert.equal(fn(DB.users.u,'k',()=>{reran=true;}).value,2);assert.equal(reran,false);
  console.log('PASS '+name+': write/rename/restore-pending failures, rejected draft discard, unrelated user preservation and receipt short circuit');
}
check('worldMineDurable');
check('worldMoveDurable');
// the shared helper refuses an unknown tag
{ const b=box({users:{},idem:{}}); assert.throws(()=>b.durableUserCommit({id:'u'},{id:'u'},{},'gold-shop'),/Unknown durable/); }
// first castle placement: a failed save publishes nothing and throws WORLD_STORAGE_FAILURE; a good save keeps the SAME account object in the DB
{ const me={id:'me',lvl:30},DB={users:{me,other:{id:'other',worldLocation:{x:1,y:1}}},idem:{}},b=box(DB);
  Object.assign(b,{ledPlayerLevel:()=>30,ensureLedger:u=>u,WITCH:{UNLOCK_LEVEL:10},WORLD_LOCATION:{valid:l=>!!l,cellKey:(x,y)=>x+','+y,place:()=>({x:50,y:60})},
    WORLD_TERRAIN_BLOCKED:new Set(),WORLD_MINES:{field:()=>[],epochAt:()=>0},crypto:{randomInt:()=>0}});
  vm.runInContext(fnSource('worldLocation'),b);
  b.fs.renameSync=()=>{throw Error('injected');};
  assert.throws(()=>b.worldLocation(me),e=>e.code==='WORLD_STORAGE_FAILURE');
  assert.equal(me.worldLocation,undefined,'no location published after a failed save');
  b.fs.renameSync=()=>{};
  assert.deepEqual(JSON.parse(JSON.stringify(b.worldLocation(me))),{x:50,y:60});
  assert.equal(DB.users.me,me,'the DB keeps the request account object, not a copy');
  assert.deepEqual(JSON.parse(JSON.stringify(me.worldLocation)),{x:50,y:60});
  console.log('PASS worldLocation: failed save publishes nothing; saved placement keeps the same account object in the DB'); }
