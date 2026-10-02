'use strict';
// CR1944 + CR1957 (ChatGPT, 1 Oct 2026) - the world mine routes (worldMineDurable) and the teleport purchase / castle
// move routes (worldMoveDurable) commit the account and its receipt to disk BEFORE they acknowledge. v921/v922 put
// the staged-transaction checks in the suite, reading the real server.js.
const vm=require('node:vm'),assert=require('node:assert/strict');
const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8').split(String.fromCharCode(13)).join('');
function check(name,until){
  const at=source.indexOf('function '+name+'('); assert.notEqual(at,-1,name+' exists');
  const helper=source.slice(at,source.indexOf('function '+until+'(',at));
  const user={id:'u',value:1},DB={users:{u:user,other:{id:'other',value:9}},idem:{}},box={DB,DB_FILE:'isolated.json',PG_BOOT_PENDING:false,Date:{now:()=>1000},console:{error:()=>{}},pgSave:()=>{},fs:{writeFileSync:()=>{},renameSync:()=>{}}};
  vm.createContext(box);vm.runInContext(helper,box);const fn=box[name];
  const mutate=u=>{u.value=2;return {ok:true,value:2};},before=JSON.stringify(DB);
  for(const action of ['writeFileSync','renameSync']){const old=box.fs[action];box.fs[action]=()=>{throw Error('injected');};const r=fn(user,'k',mutate);assert.equal(r.storageFailed,true);assert.equal(JSON.stringify(DB),before);box.fs[action]=old;}
  box.PG_BOOT_PENDING=true;let called=false;assert.equal(fn(user,'k',()=>{called=true;return {ok:true};}).storageFailed,true);assert.equal(called,false);box.PG_BOOT_PENDING=false;
  assert.equal(fn(user,'bad',u=>{u.value=20;return {ok:false};}).ok,false);assert.equal(JSON.stringify(DB),before);
  assert.equal(fn(user,'k',mutate).ok,true);assert.equal(DB.users.u.value,2);assert.equal(DB.users.other.value,9);assert.equal(user.value,1,'Old user reference must not mutate during staging');
  let reran=false;assert.equal(fn(DB.users.u,'k',()=>{reran=true;}).value,2);assert.equal(reran,false);
  console.log('PASS '+name+': write/rename/restore-pending failures, rejected draft discard, unrelated user preservation and receipt short circuit');
}
check('worldMineDurable','worldMineMarches');
check('worldMoveDurable','worldTravelState');
