// v1372 GUILD RANKS (Phil 11 Nov 2026: officers could not be appointed - "make that and also the ability for the guild leader to promote
// member and create "ranks" and give rank permissions"). Server checks over HTTP on a temp DB:
//  1. migration: a guild made before v1372 (no ranks) is seeded Officer (all 6 permissions) + Member (none), everyone on Member;
//     an old g.officers list lands on Officer and the field is dropped;
//  2. every rank route: auth (401), in a guild, leader-only (403 for a member, also for an Officer), validation (name 1-16, sanitised,
//     unique, max 8, unknown rank, Member undeletable, bad order, unknown/non-boolean permission, leader has no rank), idempotent repeats;
//  3. guildCan per permission: a rank holding ONE permission opens exactly that route (and the status flags) and no other;
//  4. kick only a lower rank (leader > ranks in list order > Member); delete a rank -> its members fall back to Member;
//  5. an Officer can move a whole Skyfall lane (/api/guild-war/move-lane), which only the leader could do before.
// Asserts (non-zero exit). CONTROL: AUD_SERVER=<the 8527daa7 server copied into the repo root> must FAIL (it counts every miss).
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js', dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-granks-'));
const dbFile=path.join(dir,'db.json');
let port,base,child,pass=0,missed=[];
const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ok '+m); };
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function start(){ child=spawn(process.execPath,[srvFile],{cwd:root,env:{...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,RL_MUL:'1000',REG_PER_MIN:'100',REG_ACCOUNTS_PER_IP:'100'},stdio:'ignore',windowsHide:true});
  for(const _t0=Date.now();Date.now()-_t0<60000&&!(child&&child.exitCode!==null);){ try{ if((await fetch(base+'/health')).ok)return; }catch(_){} await delay(100);} throw Error('no start'); }
async function stop(){ if(!child)return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); } child=null; await delay(300); }
let ipN=0;   /* the Skyfall dispatcher's 30-per-30s limit is per IP: each war call carries its own proxy address, as Railway's would */
async function call(route,data,tok,war){ const h={'Content-Type':'application/json',...(tok?{'x-token':tok}:{})}; if(war) h['x-forwarded-for']='10.9.'+((++ipN)>>8&255)+'.'+(ipN&255);
  const r=await fetch(base+route,{method:data?'POST':'GET',headers:h,body:data?JSON.stringify(data):undefined});
  let j={}; try{ j=await r.json(); }catch(_){}
  if(j&&j.guild&&typeof j.guild==='object'){ j.guild.ranks=j.guild.ranks||[]; j.guild.members=j.guild.members||[]; } else if(j&&j.guild===undefined) j.guild={ranks:[],members:[],missing:true};   /* a server without ranks still answers every check (the control counts misses) */
  return {status:r.status,data:j}; }
const disk=()=>JSON.parse(fs.readFileSync(dbFile,'utf8'));
const ALL=['members_accept','members_kick','notice_edit','banner_edit','war_register','war_manage'];
const BANNER={shape:1,emblem:2,color:3};
(async()=>{ try{
  port=await freePort(); base='http://127.0.0.1:'+port; await start();
  const reg=n=>call('/api/register',{name:n,pass:'password1'}).then(r=>r.data);
  const names=['grLead','grOff','grAnna','grBram','grCole','grProbe','grJoin','grQuin','grZed'];
  const U={}; for(const n of names){ U[n]=await reg(n); assert(U[n]&&U[n].profile,'register '+n+' '+JSON.stringify(U[n]).slice(0,120)); }
  const id=n=>U[n].profile.id;
  for(const n of names) await call('/api/ledger',null,U[n].token);
  await call('/api/guild-war/status',null,U.grLead.token,true);   // makes the current tournament
  await delay(500); await stop();
  const now=Date.now();
  { const db=disk(); db.guilds=db.guilds||{};
    // g1: a guild made before v1372 - no ranks, no memberRank
    db.guilds.g1={id:'g1',name:'Rank Hall',leader:id('grLead'),members:['grLead','grOff','grAnna','grBram','grCole','grProbe'].map(id),
      reqs:[{id:id('grJoin'),t:now}],level:3,exp:0,motd:'hello',log:[],createdAt:now-86400000};
    // g2: an old guild that somehow carries an officers list
    db.guilds.g2={id:'g2',name:'Old Order',leader:id('grZed'),members:[id('grZed'),id('grQuin')],officers:[id('grQuin')],reqs:[],level:1,exp:0,motd:'',log:[]};
    for(const n of ['grLead','grOff','grAnna','grBram','grCole','grProbe']) db.users[id(n)].guildId='g1';
    for(const n of ['grZed','grQuin']) db.users[id(n)].guildId='g2';
    for(const n of names) if(db.users[id(n)].led) db.users[id(n)].led.px=1000;   // the Guild Hall opens at level 13
    // a Skyfall match in planning between g1 and g2: grLead's line holds Iron Gate (lane 0)
    const t=db.tournaments.current; const lanes=[0,1,2,3,4];
    const side=(gid,nm,defs)=>({guildId:gid,name:nm,citadels:lanes.map(i=>({lane:i,key:'l'+i,destroyed:false,defenders:i===0?defs:[]})),unplaced:[]});
    t.state='bracket'; t.roundIndex=0; t.roundBase=3;
    t.entrants=[{guildId:'g1',name:'Rank Hall',banner:null,seed:1,powerPool:100,lines:[{memberId:id('grLead'),line:0,power:100}]},
                {guildId:'g2',name:'Old Order',banner:null,seed:2,powerPool:100,lines:[{memberId:id('grZed'),line:0,power:100}]}];
    t.rounds=[{name:'F',matchIds:['gwm_rk']}];
    t.matches={gwm_rk:{id:'gwm_rk',tournamentId:t.id,roundIndex:0,state:'planning',aGuildId:'g1',bGuildId:'g2',revealAt:0,
      planningEndsAt:now+6*3600000,startsAt:now+6*3600000,endsAt:now+8*3600000,winnerGuildId:null,
      sides:{g1:side('g1','Rank Hall',[{memberId:id('grLead'),line:0,power:100}]),g2:side('g2','Old Order',[{memberId:id('grZed'),line:0,power:100}])},
      assaults:{},eventLog:[],version:0}};
    fs.writeFileSync(dbFile,JSON.stringify(db)); }
  await start();
  const T={}; for(const n of names) T[n]=(await call('/api/login',{name:U[n].profile.name,pass:'password1'})).data.token;
  const mine=async n=>(await call('/api/guild/mine',null,T[n])).data.guild||{ranks:[],members:[]};
  const memOf=(g,n)=>(g.members||[]).find(m=>m.id===id(n))||{};

  // ---- 1. migration ----
  let g=await mine('grLead');
  ok(Array.isArray(g.ranks)&&g.ranks.map(r=>r.id).join(',')==='officer,member','an old guild is seeded with Officer then Member ('+JSON.stringify(g.ranks)+')');
  ok(g.ranks&&g.ranks.length===2&&g.ranks[0].name==='Officer'&&ALL.every(p=>g.ranks[0].perms.includes(p))&&g.ranks[1].name==='Member'&&g.ranks[1].perms.length===0,'Officer holds all six permissions, Member none');
  ok(JSON.stringify(g.permList)===JSON.stringify(ALL),'the guild view lists the six permissions ('+JSON.stringify(g.permList)+')');
  ok(g.youLeader&&JSON.stringify(g.myPerms)===JSON.stringify(ALL)&&g.myRankId==='leader','the leader holds every permission');
  ok(['grOff','grAnna','grBram','grCole','grProbe'].every(n=>memOf(g,n).rankId==='member'&&memOf(g,n).rankName==='Member'),'every other member starts on Member');
  ok(memOf(g,'grLead').rankName==='Leader','the leader\'s row is labelled Leader');
  const q=await mine('grQuin');
  ok(q.myRankId==='officer'&&ALL.every(p=>(q.myPerms||[]).includes(p)),'an old g.officers entry lands on the Officer rank ('+q.myRankId+')');
  let go=await mine('grOff');
  ok(Array.isArray(go.myPerms)&&go.myPerms.length===0&&go.myRankId==='member'&&Array.isArray(go.requests)&&go.requests.length===0,'a Member has no permissions and sees no join requests');

  // ---- 2a. before promotion a Member is refused every gated action, including the lane move ----
  for(const [route,body] of [['/api/guild/approve',{id:id('grJoin')}],['/api/guild/deny',{id:id('grJoin')}],['/api/guild/kick',{id:id('grAnna')}],['/api/guild/motd',{motd:'x'}],['/api/guild/banner',{banner:BANNER}],['/api/guild/transfer',{id:id('grOff')}],['/api/guild/disband',{}]]){
    const r=await call(route,body,T.grOff); ok(r.status===403,'a Member gets 403 on '+route+' ('+r.status+')'); }
  { const r=await call('/api/guild-war/move-lane',{from:0,to:1},T.grOff,true); ok(r.status===403,'a Member cannot move a Skyfall lane ('+r.status+' '+(r.data.error||'')+')'); }
  // ---- 2b. rank routes: auth, guild, leader-only ----
  const RR=['create','rename','delete','reorder','perms','assign'];
  for(const x of RR){ const r=await call('/api/guild/rank/'+x,{name:'Nope',rankId:'officer',id:id('grAnna'),order:['officer'],perms:{}},null); ok(r.status===401,'/rank/'+x+' needs auth ('+r.status+')'); }
  { const r=await call('/api/guild/rank/create',{name:'Loner'},T.grJoin); ok(r.status===400,'/rank/create outside a guild is refused ('+r.status+')'); }
  for(const x of RR){ const r=await call('/api/guild/rank/'+x,{name:'Nope',rankId:'officer',id:id('grAnna'),order:['officer'],perms:{members_kick:true}},T.grOff); ok(r.status===403,'a Member cannot use /rank/'+x+' ('+r.status+')'); }
  // ---- 2c. leader: assign, and validation ----
  let r=await call('/api/guild/rank/assign',{id:id('grOff'),rankId:'officer'},T.grLead);
  ok(r.status===200&&memOf(r.data.guild,'grOff').rankId==='officer'&&memOf(r.data.guild,'grOff').rankName==='Officer','the leader promotes grOff to Officer ('+r.status+')');
  r=await call('/api/guild/rank/assign',{id:id('grOff'),rankId:'officer'},T.grLead); ok(r.status===200&&memOf(r.data.guild,'grOff').rankId==='officer','assign again is idempotent');
  for(const x of RR){ const r=await call('/api/guild/rank/'+x,{name:'Nope',rankId:'member',id:id('grAnna'),order:['officer'],perms:{members_kick:true}},T.grOff); ok(r.status===403,'an Officer still cannot use /rank/'+x+' (leader-only) ('+r.status+')'); }
  for(const [b,why] of [[{id:id('grJoin'),rankId:'officer'},'a non-member'],[{id:id('grLead'),rankId:'officer'},'the leader'],[{id:id('grAnna'),rankId:'nope'},'an unknown rank']]){
    const r=await call('/api/guild/rank/assign',b,T.grLead); ok(r.status===400,'assign refuses '+why+' ('+r.status+' '+(r.data.error||'')+')'); }
  for(const [nm,why] of [['','empty'],['   ','blank'],['x'.repeat(17),'17 characters'],['Bad<b>','< >'],['Admin','a reserved name'],['A​B','a hidden character']]){
    const r=await call('/api/guild/rank/create',{name:nm},T.grLead); ok(r.status===400,'create refuses a '+why+' name ('+r.status+' '+(r.data.error||'')+')'); }
  r=await call('/api/guild/rank/create',{name:'officer'},T.grLead); ok(r.status===409,'create refuses a name already used, any case ('+r.status+')');
  r=await call('/api/guild/rank/create',{name:'  Veteran  ',requestId:'rq-1',perms:{members_kick:true,bogus:true}},T.grLead);
  const vetId=r.data.rankId; g=r.data.guild||{};
  ok(r.status===200&&vetId&&g.ranks.map(x=>x.name).join(',')==='Officer,Veteran,Member','create adds Veteran just above Member, trimmed ('+(g.ranks||[]).map(x=>x.name)+')');
  ok(((g.ranks||[]).find(x=>x.id===vetId)||{perms:[]}).perms.join(',')==='members_kick','create keeps only known permissions');
  r=await call('/api/guild/rank/create',{name:'Veteran',requestId:'rq-1'},T.grLead);
  ok(r.status===200&&r.data.replayed&&r.data.rankId===vetId&&r.data.guild.ranks.length===3,'the same create requestId again answers the first result (no second rank)');
  for(let i=0;i<5;i++){ r=await call('/api/guild/rank/create',{name:'Tier '+i},T.grLead); ok(r.status===200,'create Tier '+i+' ('+r.status+')'); }
  r=await call('/api/guild/rank/create',{name:'Ninth'},T.grLead); ok(r.status===400&&r.data.guild.missing===true,'a ninth rank is refused (max 8) ('+r.status+' '+(r.data.error||'')+')');
  g=await mine('grLead'); ok(g.ranks.length===8&&g.ranks[7].id==='member','eight ranks, Member last');
  // rename
  r=await call('/api/guild/rank/rename',{rankId:'nope',name:'X'},T.grLead); ok(r.status===400,'rename an unknown rank -> 400');
  r=await call('/api/guild/rank/rename',{rankId:vetId,name:'Officer'},T.grLead); ok(r.status===409,'rename onto a used name -> 409');
  r=await call('/api/guild/rank/rename',{rankId:vetId,name:'x'.repeat(17)},T.grLead); ok(r.status===400,'rename to 17 characters -> 400');
  r=await call('/api/guild/rank/rename',{rankId:vetId,name:'Sergeant'},T.grLead); ok(r.status===200&&(r.data.guild.ranks.find(x=>x.id===vetId)||{}).name==='Sergeant','rename Veteran -> Sergeant');
  r=await call('/api/guild/rank/rename',{rankId:vetId,name:'Sergeant'},T.grLead); ok(r.status===200,'rename to its own name again is idempotent');
  // delete (Tier ranks), Member undeletable, repeat
  r=await call('/api/guild/rank/delete',{rankId:'member'},T.grLead); ok(r.status===400,'the Member rank cannot be deleted');
  g=await mine('grLead'); const tiers=g.ranks.filter(x=>/^Tier/.test(x.name)).map(x=>x.id);
  r=await call('/api/guild/rank/assign',{id:id('grCole'),rankId:tiers[0]},T.grLead); ok(memOf(r.data.guild,'grCole').rankId===tiers[0],'grCole placed on Tier 0');
  for(const tid of tiers){ r=await call('/api/guild/rank/delete',{rankId:tid},T.grLead); ok(r.status===200,'delete '+tid); }
  ok(memOf(r.data.guild,'grCole').rankId==='member','deleting a rank drops its members back to Member');
  r=await call('/api/guild/rank/delete',{rankId:tiers[0]},T.grLead); ok(r.status===200&&r.data.already,'deleting it again is idempotent (already)');
  // reorder
  r=await call('/api/guild/rank/reorder',{order:['officer']},T.grLead); ok(r.status===400,'reorder missing a rank -> 400');
  r=await call('/api/guild/rank/reorder',{order:['officer','officer']},T.grLead); ok(r.status===400,'reorder with a duplicate -> 400');
  r=await call('/api/guild/rank/reorder',{order:['officer',vetId,'member']},T.grLead); ok(r.status===400,'reorder may not move Member -> 400');
  r=await call('/api/guild/rank/reorder',{order:[vetId,'officer']},T.grLead); ok(r.status===200&&r.data.guild.ranks.map(x=>x.id).join(',')===vetId+',officer,member','reorder Sergeant above Officer, Member stays last');
  r=await call('/api/guild/rank/reorder',{order:['officer',vetId]},T.grLead); ok(r.status===200&&r.data.guild.ranks.map(x=>x.id).join(',')==='officer,'+vetId+',member','reorder back');
  // perms validation
  r=await call('/api/guild/rank/perms',{rankId:vetId,perms:{fly:true}},T.grLead); ok(r.status===400,'an unknown permission -> 400');
  r=await call('/api/guild/rank/perms',{rankId:vetId,perms:{members_kick:'yes'}},T.grLead); ok(r.status===400,'a non-boolean permission -> 400');
  r=await call('/api/guild/rank/perms',{rankId:'nope',perms:{}},T.grLead); ok(r.status===400,'permissions for an unknown rank -> 400');
  r=await call('/api/guild/rank/perms',{rankId:vetId,perms:'all'},T.grLead); ok(r.status===400,'permissions that are not an object -> 400');

  // ---- 3. guildCan, one permission at a time (grProbe on the Sergeant rank holding exactly that one) ----
  r=await call('/api/guild/rank/assign',{id:id('grProbe'),rankId:vetId},T.grLead); ok(r.status===200,'grProbe on Sergeant');
  const probe={   // the route that permission opens: a status other than 403 means the gate let it through
    members_accept:()=>call('/api/guild/deny',{id:'nobody'},T.grProbe),
    members_kick:()=>call('/api/guild/kick',{id:'nobody'},T.grProbe),          // gate passed -> 400 Not a member
    notice_edit:()=>call('/api/guild/motd',{motd:'probe'},T.grProbe),
    banner_edit:()=>call('/api/guild/banner',{banner:BANNER},T.grProbe),
    war_register:()=>call('/api/guild-war/unregister',{},T.grProbe,true),       // gate passed -> 400 (bracket set)
    war_manage:()=>call('/api/guild-war/assign',{memberId:'nobody',lane:1},T.grProbe,true) };   // gate passed -> 400 no registered line
  for(const p of ALL){
    r=await call('/api/guild/rank/perms',{rankId:vetId,perms:{[p]:true}},T.grLead); ok(r.status===200,'Sergeant holds only '+p);
    const gp=await mine('grProbe'); ok(JSON.stringify(gp.myPerms)===JSON.stringify([p]),'the guild view gives grProbe exactly ['+p+'] ('+JSON.stringify(gp.myPerms)+')');
    ok((gp.requests||[]).length===(p==='members_accept'?1:0),'join requests are shown only with members_accept ('+p+')');
    const st=(await call('/api/guild-war/status',null,T.grProbe,true)).data;
    ok(st.canRegister===(p==='war_register')&&st.canArrange===(p==='war_manage'),'Skyfall status flags follow the rank ('+p+': '+st.canRegister+'/'+st.canArrange+')');
    for(const q of ALL){ const rr=await probe[q](); ok(q===p?rr.status!==403:rr.status===403,(q===p?'with ':'without ')+q+' -> '+rr.status+' '+(rr.data.error||'')); }
  }
  r=await call('/api/guild/rank/perms',{rankId:vetId,perms:{}},T.grLead); ok(r.status===200&&(r.data.guild.ranks.find(x=>x.id===vetId)||{perms:[1]}).perms.length===0,'Sergeant cleared');

  // ---- 4. the Officer at work, and kick only a lower rank ----
  go=await mine('grOff'); ok(JSON.stringify(go.myPerms)===JSON.stringify(ALL)&&go.requests.length===1,'grOff (Officer) holds every officer permission and sees the join request');
  r=await call('/api/guild/approve',{id:id('grJoin')},T.grOff); ok(r.status===200&&memOf(r.data.guild,'grJoin').rankId==='member','an Officer accepts a join request; the new member is a Member ('+r.status+')');
  r=await call('/api/guild/motd',{motd:'Officer notice'},T.grOff); ok(r.status===200&&r.data.guild.motd==='Officer notice','an Officer edits the notice');
  r=await call('/api/guild/banner',{banner:BANNER},T.grOff); ok(r.status===200,'an Officer changes the banner');
  ok(memOf(r.data.guild,'grAnna').kickable===true&&memOf(r.data.guild,'grLead').kickable===false,'the view marks who the viewer may remove ('+JSON.stringify((r.data.guild.members||[]).map(m=>[m.name,m.rankId,m.rankPos,m.kickable]))+')');
  r=await call('/api/guild/kick',{id:id('grLead')},T.grOff); ok(r.status===403,'an Officer cannot remove the leader');
  await call('/api/guild/rank/assign',{id:id('grBram'),rankId:'officer'},T.grLead);
  r=await call('/api/guild/kick',{id:id('grBram')},T.grOff); ok(r.status===403,'an Officer cannot remove another Officer (same rank)');
  await call('/api/guild/rank/perms',{rankId:vetId,perms:{members_kick:true}},T.grLead);   // Sergeant (below Officer) may kick
  r=await call('/api/guild/kick',{id:id('grOff')},T.grProbe); ok(r.status===403,'a Sergeant cannot remove an Officer (higher rank)');
  r=await call('/api/guild/kick',{id:id('grJoin')},T.grProbe); ok(r.status===200&&!(r.data.guild.members||[]).some(m=>m.id===id('grJoin')),'a Sergeant with members_kick removes a Member (lower rank)');
  await call('/api/guild/rank/perms',{rankId:'member',perms:{members_kick:true}},T.grLead);
  r=await call('/api/guild/kick',{id:id('grCole')},T.grAnna); ok(r.status===403,'a Member with members_kick still cannot remove another Member');
  r=await call('/api/guild/kick',{id:id('grAnna')},T.grOff); ok(r.status===200,'an Officer removes a Member');
  await call('/api/guild/rank/perms',{rankId:'member',perms:{}},T.grLead);

  // ---- 5. the Officer moves a whole lane ----
  r=await call('/api/guild-war/move-lane',{from:0,to:2},T.grOff,true);
  ok(r.status===200&&r.data.moved===1,'an Officer moves the whole Iron Gate lane to another tower ('+r.status+' '+(r.data.error||'')+')');
  r=await call('/api/guild-war/move-lane',{from:2,to:0},T.grCole,true); ok(r.status===403,'a Member still cannot ('+r.status+')');

  // ---- leadership transfer: the two swap places; the old leader is never left without a rank ----
  r=await call('/api/guild/transfer',{id:id('grOff')},T.grLead);
  ok(r.status===200&&r.data.guild.leader===id('grOff')&&memOf(r.data.guild,'grLead').rankId==='officer','transfer: grOff leads, grLead takes the Officer rank ('+(memOf(r.data.guild,'grLead').rankId)+')');
  r=await call('/api/guild/rank/create',{name:'Nope'},T.grLead); ok(r.status===403,'the old leader can no longer edit ranks');

  // ---- saved: the ranks live on the guild in the server DB ----
  await delay(600); await stop();
  const d=disk(), dg=d.guilds.g1;
  ok(Array.isArray(dg.ranks)&&dg.ranks.length===3&&dg.ranks[2].id==='member'&&dg.memberRank&&dg.memberRank[id('grLead')]==='officer'&&dg.memberRank[id('grBram')]==='officer'&&!dg.memberRank[id('grOff')],'the DB holds the ranks and memberRank');
  ok(d.users[id('grAnna')].guildId===undefined&&!(dg.memberRank||{})[id('grAnna')],'a removed member leaves no rank behind');
  if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
  console.log('test_guild_ranks_1372.js: '+pass+' checks passed, '+missed.length+' failed (server '+srvFile+')');
} catch(e){ console.error('FAIL',e&&e.message||e); process.exitCode=1; } finally { await stop(); } })();
