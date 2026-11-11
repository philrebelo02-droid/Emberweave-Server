// v1369 Emberdraft SAVE AND EXIT - the client's snapshot / restore, without a browser. Runs the real v1369 block of emberweave-heroes.html
// (edStage ... edResume) in a vm over a synthetic 8-seat match, with the engine calls it makes stubbed and recorded:
//  - snapshot -> JSON -> restore gives back every field (players, pool, round, orbs, avatar, boss order, uid, anvil) and the carousel /
//    draft object links (offer.by -> its avatar, avatar.p -> its seat, order -> seats);
//  - a save of a fight that had begun is restored with the fight's recorded result, or as a LOSS when none was recorded - never as a
//    plan to fight again; a save taken after the fight goes straight on; the server's fightR alone also forces it;
//  - a multiplayer match (ED.multi) never saves; leaving it tears down with nothing written; leaving an AI match saves first.
// The full in-game proof (real fights, IndexedDB, the server, memory) is the rig in Open Projects/EMBERDRAFT SAVE AND EXIT 11NOV2026.
const fs=require('fs'), path=require('path'), vm=require('vm'), assert=require('assert');
const html=fs.readFileSync(process.env.ED_HTML||path.join(__dirname,'..','emberweave-heroes.html'),'utf8');
const a=html.indexOf('/* where the match stands: plan / carousel / draft'), b=html.indexOf('window.edSaveRead=edSaveRead;');
assert(a>0&&b>a,'the v1369 save block is in the page');
let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; };
const mkCtx=()=>{ const calls=[]; const writes=[]; const ls={};
  const ctx={ console, JSON, Math, Date, Object, Array, Promise, setTimeout:(f)=>{ calls.push('timeout'); return 0; }, clearTimeout(){}, performance:{ now:()=>1 },
    localStorage:{ getItem:k=>ls[k]==null?null:ls[k], setItem:(k,v)=>{ ls[k]=String(v); }, removeItem:k=>{ delete ls[k]; } },
    document:{ addEventListener(){}, querySelector:()=>null, getElementById:()=>null, visibilityState:'visible' }, addEventListener(){},
    window:{}, ED:{}, _edUid:1, ended:false, state:'battle', units:[], SIM_STEP:0.05, ED_SAVE_V:1, ED_SAVE_LS:'ew_edSave_', ED_FIGHT_LS:'ew_edFight', _edSeq:0, _edSaveT:0,
    ewT:(k,v)=>k+(v&&v.n!=null?':'+v.n:''), edToast(){}, gameConfirm(){}, show:n=>calls.push('show:'+n), api:()=>Promise.resolve({}),
    edSaveWrite:rec=>{ writes.push(JSON.parse(JSON.stringify(rec))); return Promise.resolve(true); }, edSaveDrop:()=>{ calls.push('drop'); return Promise.resolve(); },
    edTeardown:()=>{ calls.push('teardown'); ctx.ED.active=false; }, edQuit:()=>calls.push('quit'), edAfterRound:()=>calls.push('afterRound'), edLaunchBattle:()=>calls.push('launch'),
    edCarOpen:()=>calls.push('carOpen'), edCarSettle:()=>calls.push('carSettle'), edDraftAdvance:()=>calls.push('draftAdvance'), edRender:()=>calls.push('render'),
    edLoadCatalog(){}, edPrepareMatch:()=>Promise.resolve(), updateBattle(){}, endBattle(){},
    edYou:()=>ctx.ED.players[0], edAlive:()=>ctx.ED.players.filter(p=>p.alive), edUnits:p=>Object.values(p.board).concat(p.bench.filter(Boolean)),
    edIsPve:r=>r<=3||(r>=12&&r%6===0), edPveSpec:r=>[{u:{key:'ooznik',mon:true}},{u:{key:'skarrn',mon:true}}],
    edDamage:s=>2+s.reduce((t,u)=>t+(u.rank||1),0) };
  ctx.window=ctx; vm.createContext(ctx);
  /* the page's own block, with its storage, teardown and engine helpers taken from the stubs above */
  let src=html.slice(a,b).replace(/^function (edSaveWrite|edSaveDrop)\(.*$/gm,'');
  vm.runInContext(src+'\n;this.__api={edStage,edCanSave,edSnapshot,edSaveNow,edContinue,edResume,edForfeitFight,edApplyFightRes,edLeaveAuto,edOnHide,edFastForward,edMatchIdOf,edFightMarkRead};',ctx);
  return { ctx, calls, writes, ls, F:ctx.__api }; };
const seat=(i)=>({ i, name:i?'AI '+i:'You', ai:i!==0, hp:100-i*3, gold:10+i, level:3+(i%3), xp:i, board:{ '0,3':{key:'vael',rank:2,items:[{c:'Weapon'}],id:10+i} }, bench:[{key:'rafe',rank:1,items:[],id:30+i},null,null],
  items:[{anv:'c',opts:[{c:'Helm'},{c:'Ring'},{c:'Belt'}]},{f:'Spark Tome',a:'Ring',b:'Ring'}], shop:['oakmir','fritz',null], locked:false, streak:i%2?-2:1, alive:i!==7, place:i===7?8:0, lastOpp:(i+1)%8, style:i?'econ':undefined, _spk:{} });
const freshED=(extra)=>Object.assign({ active:true, multi:false, round:9, phase:'plan', fighting:false, players:[0,1,2,3,4,5,6,7].map(seat), pool:{vael:40,rafe:12,oakmir:30}, msg:'hello', log:['x'],
  results:[{w:'AI 1',l:'AI 2',dmg:5}], _bossOrder:['miregor','orryx'], orbs:[{x:300,y:400,d:{gold:2},t:99}], av:{x:120,y:880,face:1.2,tx:5,ty:6,moving:true}, t0:1234567, attemptId:'edABC', lease:'lX', acct:'u1', anvil:null, sideMin:true, _sim:false }, extra||{});

(async()=>{
  /* 1. plan round trip */
  { const T=mkCtx(), E=T.ctx.ED=freshED(); T.ctx._edUid=77; E.anvil=E.players[0].items[0];
    ok(T.F.edStage()==='plan' && T.F.edCanSave(),'a planning AI match can be saved');
    await T.F.edSaveNow(); const rec=T.writes[0]; ok(rec && rec.stage==='plan' && rec.round===9 && rec.acct==='u1' && rec.attemptId==='edABC' && rec.lease==='lX' && rec.hp===100,'the record: stage, round, account, attempt, lease, health');
    const want=JSON.stringify({players:E.players,pool:E.pool,round:E.round,boss:E._bossOrder,msg:E.msg,log:E.log,results:E.results,t0:E.t0});
    const R=mkCtx(); R.ctx.ED={ match:3 }; await R.F.edContinue(JSON.parse(JSON.stringify(rec)),{lease:'lY',fightR:0}); await new Promise(r=>setImmediate(r));
    const E2=R.ctx.ED, got=JSON.stringify({players:E2.players,pool:E2.pool,round:E2.round,boss:E2._bossOrder,msg:E2.msg,log:E2.log,results:E2.results,t0:E2.t0});
    ok(got===want,'players, pool, round, boss order, message, log, results and start time come back exactly');
    ok(R.ctx._edUid===77,'the hero id counter comes back (new heroes never reuse an id)');
    ok(JSON.stringify(E2.orbs.map(o=>[o.x,o.y,o.d]))===JSON.stringify([[300,400,{gold:2}]]) && E2.av.x===120 && E2.av.y===880 && E2.av.face===1.2,'loot orbs on the floor and your avatar\'s spot come back');
    ok(E2.phase==='plan' && E2.anvil===E2.players[0].items[0] && R.calls.includes('render'),'back in planning with the open anvil the same object on your item bench');
    ok(E2.attemptId==='edABC' && E2.lease==='lY' && E2.acct==='u1' && E2.match===4 && E2.active && !E2.multi,'the attempt, the NEW lease, the account; a new match token'); }
  /* 2. carousel links */
  { const T=mkCtx(), E=T.ctx.ED=freshED({phase:'carousel'}); const P=E.players;
    const av=P.slice(0,7).map((p,j)=>({p,x:0.1*j,y:0.2,tx:j===0?0.5:null,ty:j===0?0.6:null,got:j===2?1:null,release:1.5+j,face:0.3,want:j===3?4:null,moving:false}));
    E.car={ offers:[0,1,2,3].map(i=>({key:'k'+i,item:{c:'Belt'},taken:i===1?P[2].i:null,by:i===1?av[2]:null})), order:P.slice(0,7), av, t:4.25, spin0:2.1, end:20, done:false, last:5 };
    await T.F.edSaveNow(); const rec=T.writes[0]; ok(rec.stage==='carousel' && rec.state.car.offers[1].by===2 && rec.state.car.av[3].p===3,'the carousel is saved with its links as indexes');
    const R=mkCtx(); R.ctx.ED={}; await R.F.edContinue(rec,{}); await new Promise(r=>setImmediate(r)); const C=R.ctx.ED.car;
    ok(C && C.offers[1].by===C.av[2] && C.av[2].p===R.ctx.ED.players[2] && C.order[5]===R.ctx.ED.players[5],'restored: the held offer rides its avatar, avatars and the order point at the restored seats');
    ok(C.t===4.25 && C.spin0===2.1 && C.av[0].tx===0.5 && C.av[3].want===4 && C.av[4].release===5.5 && R.calls.includes('carOpen'),'the carousel resumes where it stood (time, spin, targets, release times)'); }
  /* 3. fights: never planned again */
  const fightRec=async(extra,stage)=>{ const T=mkCtx(), E=T.ctx.ED=freshED(Object.assign({phase:'fight',fighting:true,_sim:stage==='fight'},extra)); E.opp={pve:false,p:E.players[3],name:'AI 3'};
    E.spec={enemy:[{u:{key:'vael',rank:2}},{u:{key:'rafe',rank:3}}]}; await T.F.edSaveNow(); return { rec:T.writes[0], T }; };
  { const { rec }=await fightRec({},'fight'); ok(rec.stage==='fight' && rec.state.spec.enemy.length===2 && rec.state.opp.p===3,'a running fight is saved as stage fight with its foes');
    const R=mkCtx(); R.ctx.ED={}; await R.F.edContinue(rec,{}); await new Promise(r=>setImmediate(r)); const E=R.ctx.ED;
    ok(E.players[0].hp===100-(2+2+3) && E.players[0].streak===-1 && E.players[3].streak===1,'no result recorded: the fight counts as LOST (every foe standing) - '+E.players[0].hp+' health');
    ok(R.calls.includes('afterRound') && !R.calls.includes('render') && !R.calls.includes('launch'),'the match goes on to the next round - no planning, no re-fight');
    ok(/fight_forfeit/.test(E.msg),'the player is told the fight counted as lost'); }
  { const { rec }=await fightRec({},'fight'); const R=mkCtx(); R.ctx.ED={};
    R.ls['ew_edFight']=JSON.stringify({acct:'u1',id:'edABC',r:9,res:{hp:[71,90,80,60,70,60,50,0],st:[3,0,0,-4,0,0,0,0],orbs:[{x:1,y:2,d:{gold:3}}],msg:'won'}});
    await R.F.edContinue(rec,{}); await new Promise(r=>setImmediate(r)); const E=R.ctx.ED;
    ok(E.players[0].hp===71 && E.players[3].hp===60 && E.players[0].streak===3 && E.orbs.length===1 && E.msg==='won' && R.calls.includes('afterRound'),'a recorded result (the fight ended, its save did not land) is applied as it happened'); }
  { const T=mkCtx(), E=T.ctx.ED=freshED(); await T.F.edSaveNow(); const plan=T.writes[0];
    const R=mkCtx(); R.ctx.ED={}; R.ls['ew_edFight']=JSON.stringify({acct:'u1',id:'edABC',r:9,res:null});
    await R.F.edContinue(JSON.parse(JSON.stringify(plan)),{}); await new Promise(r=>setImmediate(r));
    ok(R.ctx.ED.players[0].hp<100 && R.calls.includes('afterRound') && !R.calls.includes('render'),'a PLANNING save of a round whose fight began (marker) is not a second go: lost, next round');
    const S=mkCtx(); S.ctx.ED={}; await S.F.edContinue(JSON.parse(JSON.stringify(plan)),{fightR:9}); await new Promise(r=>setImmediate(r));
    ok(S.ctx.ED.players[0].hp<100 && S.calls.includes('afterRound'),'the server\'s fightR alone forces the same (the device marker was wiped)');
    const U=mkCtx(); U.ctx.ED={}; await U.F.edContinue(JSON.parse(JSON.stringify(plan)),{fightR:8}); await new Promise(r=>setImmediate(r));
    ok(U.ctx.ED.players[0].hp===100 && U.calls.includes('render'),'control: an earlier round\'s fight changes nothing - the save plans on'); }
  { const T=mkCtx(), E=T.ctx.ED=freshED({phase:'fight',fighting:false}); E.players[0].hp=64; await T.F.edSaveNow(); const rec=T.writes[0];
    ok(rec.stage==='after','a fight that ended is saved as stage after');
    const R=mkCtx(); R.ctx.ED={}; await R.F.edContinue(rec,{fightR:9}); await new Promise(r=>setImmediate(r));
    ok(R.ctx.ED.players[0].hp===64 && R.calls.includes('afterRound'),'stage after continues with its result, unchanged'); }
  { const T=mkCtx(), E=T.ctx.ED=freshED({phase:'fight',fighting:true,_sim:false}); E.opp={pve:true,p:null,name:'Wave'}; await T.F.edSaveNow(); const rec=T.writes[0];
    const R=mkCtx(); R.ctx.ED={}; await R.F.edContinue(rec,{}); await new Promise(r=>setImmediate(r));
    ok(rec.stage==='fightReady' && R.calls.includes('launch') && R.ctx.ED.opp.pve,'a fight still behind its loader (nothing seen) starts when continued'); }
  /* 4. multiplayer and leaving */
  { const T=mkCtx(); T.ctx.ED=freshED({multi:true}); ok(!T.F.edCanSave(),'a multiplayer match can never be saved');
    T.F.edOnHide(); ok(!T.writes.length,'hiding the page writes nothing for it');
    T.F.edLeaveAuto(); ok(T.calls.includes('drop') && T.calls.includes('teardown') && !T.writes.length && !T.ctx.ED.active,'leaving it: the Quit path - torn down, nothing saved'); }
  { const T=mkCtx(); T.ctx.ED=freshED(); T.F.edLeaveAuto(); ok(T.writes.length===1 && T.writes[0].stage==='plan' && T.calls.includes('teardown') && T.calls.indexOf('teardown')>=0,'leaving an AI match any other way: saved, then torn down');
    const U=mkCtx(); U.ctx.ED=freshED({round:0}); U.F.edLeaveAuto(); ok(!U.writes.length && !U.calls.includes('teardown'),'round 0 (the start loader) is not saved'); }
  console.log('test_ed_save_exit_client_1369.js: '+pass+' checks passed');
})().catch(e=>{ console.error('FAIL after '+pass+' checks:',e.message); process.exitCode=1; });
