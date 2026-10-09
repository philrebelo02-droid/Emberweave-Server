// Isolated API exercise: player intake, dev-only feed, durable acknowledgment.
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const net=require('net');
const {spawn}=require('child_process');
const root=path.join(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-feedback-'));
const dbFile=path.join(temp,'db.json');
let port,base;
let child,token='';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const freePort=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
async function start(){
  child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
  for(let i=0;i<100;i++){if(child.exitCode!==null)throw new Error('throwaway server exited');try{if((await fetch(base+'/health')).ok)return;}catch(_){} await delay(100);}
  throw new Error('throwaway server did not start');
}
async function stop(){if(!child)return;child.kill();for(let i=0;i<40&&child.exitCode===null;i++)await delay(50);child=null;}
async function call(route,method='GET',data){
  const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json','x-token':token},body:data?JSON.stringify(data):undefined});
  return {status:response.status,data:await response.json()};
}
(async()=>{
  port=await freePort();base=`http://127.0.0.1:${port}`;
  await start();
  const guest=await call('/api/guest','POST',{deviceId:'feedback-qa-'+Date.now()});
  assert.strictEqual(guest.status,200);token=guest.data.token;
  assert.strictEqual((await call('/api/ember/feedback')).status,403,'ordinary guest cannot read feed');
  assert.strictEqual((await call('/api/ember/feedback/ack','POST',{ids:[]})).status,403,'ordinary guest cannot ack');
  const bug=await call('/api/report','POST',{text:'A visible test defect'});
  const suggestion=await call('/api/report','POST',{kind:'suggestion',text:'A test idea'});
  const balance=await call('/api/report','POST',{kind:'balance',text:'A test bot note'});
  assert.strictEqual(bug.status,200);assert.strictEqual(suggestion.status,200);assert.strictEqual(balance.status,200);
  await delay(400);await stop();
  const db=JSON.parse(fs.readFileSync(dbFile,'utf8'));
  /* v1013: since v999 (Account audit #3) only a dev account files 'balance' into the integrity list; a player's 'balance' note is an
     ordinary report. This test predated that and was never in the runner (re-audit Arena N16), so it failed unseen. */
  assert.strictEqual(db.feedback.length,3,'bug, suggestion and a player balance note (filed as a bug) stay in the feedback inbox');
  assert(bug.data.id.startsWith('FB-')&&suggestion.data.id.startsWith('FB-'),'player feedback gets FB identifiers');
  assert(db.feedback.some(x=>x.kind==='bug'&&x.id===bug.data.id));
  assert(db.feedback.some(x=>x.kind==='suggestion'&&x.id===suggestion.data.id));
  assert(db.feedback.some(x=>x.kind==='bug'&&x.id===balance.data.id)&&!(db.reports||[]).some(x=>x.kind==='balance'),'a player balance note is an ordinary report, not an integrity report');
  db.feedback.push({id:'old-acked',t:Date.now()-32*86400000,kind:'bug',text:'Already filed',received:true,receivedAt:Date.now()-31*86400000});
  (db.reports=db.reports||[]).push({id:'legacy-bug',name:guest.data.profile.name,kind:'skarrn',text:'Older bug report',t:Math.min(db.feedback[0].t,db.feedback[1].t)-1000,resolved:false});
  db.users[guest.data.profile.id].role='admin';
  db.users[guest.data.profile.id].feedbackDay.n=20;
  db.users[guest.data.profile.id].led.px=99000000;
  db.users[guest.data.profile.id].led.stam.v=0;
  const vaultHeroes=Object.keys(require('../server/sim.js').HERO_BASE).slice(0,5);
  for(const key of vaultHeroes)db.users[guest.data.profile.id].led.unlocked[key]=true;
  fs.writeFileSync(dbFile,JSON.stringify(db));
  await start();
  const feed=await call('/api/ember/feedback');
  assert.strictEqual(feed.status,200,'admin/dev account may read feed');
  assert.deepStrictEqual(feed.data.items.map(x=>x.id),['legacy-bug',bug.data.id,suggestion.data.id,balance.data.id],'unreceived reports oldest first');
  assert.strictEqual((await call('/api/report','POST',{text:'Report beyond daily limit'})).status,429,'20-per-day player limit');
  const grant=await call('/api/admin/led-grant','POST',{gold:5000001});
  assert.strictEqual(grant.status,200,'dev grant accepted');
  const withCheat=await call('/api/ember/feedback');
  const cheat=withCheat.data.items.find(x=>x.kind==='cheat'&&x.resource==='gold');
  assert(cheat&&cheat.text.startsWith('TEST dev panel:'),'dev grant reaches Ember cheat inbox');
  assert.strictEqual(cheat.purchased,0,'a dev grant is not a purchase');
  const draftStart=await call('/api/emberdraft/start','POST',{requestId:'feedback-draft-start'});
  assert.strictEqual(draftStart.status,200,'high-level fixture may start Emberdraft');
  const draft=await call('/api/emberdraft/result','POST',{
    requestId:'feedback-draft-result',attemptId:draftStart.data.attemptId,place:1,rounds:1});
  assert.strictEqual(draft.status,200,'suspicious short match is not denied automatically');
  assert.strictEqual(draft.data.stamina,6,'v1097 (sweep P0 #4): a claim the round record does not show is paid at the lowest tier (6), not denied');
  const draftRetry=await call('/api/emberdraft/result','POST',{
    requestId:'feedback-draft-result',attemptId:draftStart.data.attemptId,place:1,rounds:1});
  assert.strictEqual(draftRetry.data.stamina,6,'retry returns the same durable result');
  const draftFeed=await call('/api/ember/feedback');
  const draftCase=draftFeed.data.items.find(x=>x.kind==='cheat'&&x.signal?.startsWith('emberdraft:'));
  assert(draftCase&&draftCase.claimedPlace===1&&draftCase.round===1&&draftCase.amount===30,
    'Ember receives the checkpoint evidence and the reward at stake (36 claimed - 6 paid)');
  assert.strictEqual(draftFeed.data.items.filter(x=>x.signal===draftCase.signal).length,1,
    'idempotent retry does not file a second cheating case');
  assert.strictEqual((await call('/api/admin/led-grant','POST',{heroXp:100,heroKeys:['vex']})).status,200);
  const teamFeed=await call('/api/ember/feedback');
  const teamCase=teamFeed.data.items.find(x=>x.signal==='dev-team');
  assert(teamCase&&teamCase.text.startsWith('TEST dev panel:')&&teamCase.meta==='dev panel',
    'non-wallet dev team boosts reach the same review inbox');
  const ack=await call('/api/ember/feedback/ack','POST',{ids:[bug.data.id]});
  assert.strictEqual(ack.status,200);assert.strictEqual(ack.data.acknowledged,1);
  const again=await call('/api/ember/feedback');
  assert.deepStrictEqual(again.data.items.map(x=>x.id),['legacy-bug',suggestion.data.id,balance.data.id,cheat.id,draftCase.id,teamCase.id],'acked item no longer delivered');
  const vaultStart=await call('/api/dungeon/start-battle','POST',{
    requestId:'feedback-vault-start',heroIds:vaultHeroes});
  assert.strictEqual(vaultStart.status,200,'test team starts a Vault attempt');
  const vaultWin=await call('/api/dungeon/resolve-battle','POST',{
    requestId:'feedback-vault-win',attemptId:vaultStart.data.attemptId,won:true});
  assert.strictEqual(vaultWin.status,200,'too-fast Vault win pays instead of being denied');
  assert(vaultWin.data.reward&&vaultWin.data.progress.currentFloor===2,'Vault advances and pays its reward');
  const vaultFeed=await call('/api/ember/feedback');
  assert(vaultFeed.data.items.some(x=>x.kind==='cheat'&&x.signal==='vault-fast:'+vaultStart.data.attemptId),
    'fast Vault win sends a case for human review');
  const provinceStart=await call('/api/province/start','POST',{
    requestId:'feedback-province-start',type:'gold',stage:1,heroIds:[vaultHeroes[0]]});
  assert.strictEqual(provinceStart.status,200,'test team starts a Province attempt');
  const provinceWin=await call('/api/province/resolve','POST',{
    requestId:'feedback-province-win',attemptId:provinceStart.data.attemptId,
    won:true,stars:3,digest:JSON.stringify({won:true,t:1,u:[{}]}),inputLog:[]});
  assert.strictEqual(provinceWin.status,200,'witnessed Province win is not denied for replay or speed suspicion');
  assert(provinceWin.data.reward&&provinceWin.data.cleared===1,'Province clears and pays the witnessed result');
  const provinceFeed=await call('/api/ember/feedback');
  assert(provinceFeed.data.items.some(x=>x.signal==='province-fast:'+provinceStart.data.attemptId),
    'fast Province win sends timing evidence for review');
  assert(provinceFeed.data.items.some(x=>x.signal==='province-replay:'+provinceStart.data.attemptId),
    'Province replay mismatch sends digest evidence for review');
  let well=(await call('/api/well/state')).data;
  let wellTarget=null;
  for(let step=0;step<6&&!wellTarget;step++){
    const col=well.pos.col+1;
    const options=well.grid[col].map((sq,row)=>({sq,row})).filter(x=>x.sq&&Math.abs(x.row-well.pos.row)<=1);
    wellTarget=options.find(x=>x.sq.type==='fight'||x.sq.type==='boss');
    if(!wellTarget){
      const next=options[0];assert(next,'a reachable Well square exists');
      const moved=await call('/api/well/move','POST',{
        requestId:'feedback-well-move-'+step,col,row:next.row});
      assert.strictEqual(moved.status,200);well=moved.data;
    }
  }
  assert(wellTarget,'a reachable Well battle was found');
  const wellStart=await call('/api/well/start','POST',{
    requestId:'feedback-well-start',col:well.pos.col+1,row:wellTarget.row,heroIds:[vaultHeroes[0]]});
  assert.strictEqual(wellStart.status,200,'test team starts a Well battle');
  const wellWin=await call('/api/well/resolve','POST',{
    requestId:'feedback-well-win',attemptId:wellStart.data.attemptId,
    won:true,stars:3,digest:JSON.stringify({won:true,t:1,u:[{}]}),inputLog:[]});
  assert.strictEqual(wellWin.status,200,'witnessed Well win is not denied for replay or speed suspicion');
  assert(wellWin.data.reward&&wellWin.data.won,'Well pays the witnessed result');
  const wellFeed=await call('/api/ember/feedback');
  assert(wellFeed.data.items.some(x=>x.signal==='well-fast:'+wellStart.data.attemptId),
    'fast Well win sends timing evidence for review');
  assert(wellFeed.data.items.some(x=>x.signal==='well-replay:'+wellStart.data.attemptId),
    'Well replay mismatch sends digest evidence for review');
  assert.strictEqual((await call('/api/admin/led-grant','POST',{
    gold:10000,maxGlyphs:true,heroKeys:[vaultHeroes[0]]})).status,200);
  const templeBefore=(await call('/api/ledger')).data;
  const templeRefused=await call('/api/temple/pray','POST',{
    requestId:'feedback-temple-refused',heroKey:'not-a-hero',tier:'gold'});
  assert.strictEqual(templeRefused.status,400,'an invalid hero cannot pray');
  assert.strictEqual((await call('/api/ledger')).data.gold,templeBefore.gold,'refusal spends nothing');
  const templePray=await call('/api/temple/pray','POST',{
    requestId:'feedback-temple-pray',heroKey:vaultHeroes[0],tier:'gold'});
  assert.strictEqual(templePray.status,200,'eligible hero can pray');
  assert(templePray.data.rolls&&templePray.data.ledger.temple._pending,'the rolled prayer persists as pending');
  const templeRetry=await call('/api/temple/pray','POST',{
    requestId:'feedback-temple-pray',heroKey:vaultHeroes[0],tier:'gold'});
  assert.strictEqual(templeRetry.data.ledger.rev,templePray.data.ledger.rev,'idempotent retry cannot charge twice');
  await delay(300);await stop();await start();
  assert((await call('/api/ledger')).data.temple._pending,'pending prayer survives a server restart');
  const templeSave=await call('/api/temple/save','POST',{requestId:'feedback-temple-save'});
  assert.strictEqual(templeSave.status,200,'pending prayer can be saved');
  assert.strictEqual(templeSave.data.ledger.temple._pending,null,'save clears pending');
  const nextPrayer=await call('/api/temple/pray','POST',{
    requestId:'feedback-temple-next',heroKey:vaultHeroes[0],tier:'gold'});
  assert.strictEqual(nextPrayer.status,200);
  const afterCharge=nextPrayer.data.ledger.gold;
  const discarded=await call('/api/temple/discard','POST',{requestId:'feedback-temple-discard'});
  assert.strictEqual(discarded.status,200);
  assert.strictEqual(discarded.data.ledger.gold,afterCharge,'discard keeps the prayer cost spent');
  assert.strictEqual(discarded.data.ledger.temple._pending,null);
  await delay(400);await stop();
  const persisted=JSON.parse(fs.readFileSync(dbFile,'utf8'));
  assert(!persisted.feedback.some(x=>x.id==='old-acked'),'old acknowledged feedback is pruned');
  assert(persisted.feedback.some(x=>x.id===bug.data.id&&x.received&&x.receivedAt),'ack receipt has a timestamp');
  console.log('feedback API: pass');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  await stop();
  const resolved=path.resolve(temp),parent=path.resolve(os.tmpdir());
  if(resolved.startsWith(parent+path.sep)&&path.basename(resolved).startsWith('ew-feedback-'))fs.rmSync(resolved,{recursive:true,force:true});
});
