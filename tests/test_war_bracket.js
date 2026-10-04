// Top-16 qualification: 17 registered guilds -> exactly 16 kept, the weakest 17th excluded, a ghost (deleted guild) dropped,
// seeds 1..16 by power. Runs against server internals (listener neutered).
const load=require('../scripts/_probe_loader.js');
const S=load('./probe-db-wb.json');
let pass=0,fail=0; const ck=(n,c)=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n)); };
/* v980: the lock re-qualifies every entrant from REAL guilds (a guild that no longer exists is dropped), so the 17 guilds
   exist here: guild i has i members, each filling one five-hero line, so its pool is i lines and g1 is the weakest. An 18th
   entrant whose guild is gone registered with a huge pool - it must not survive the lock. */
const DB=S.DB; DB.guilds=DB.guilds||{}; const K=Object.keys(S.SIM.HERO_BASE).slice(0,5);
for(let i=1;i<=17;i++){ const members=[];
  for(let m=1;m<=i;m++){ const id='wbu'+i+'_'+m, hero={}, unl={}; for(const k of K){ hero[k]={xp:5000,stars:1,pips:0}; unl[k]=true; }
    DB.users[id]={id,name:'WB'+i+'_'+m,rank:6000+i*20+m,coins:0,team:K.slice(),roster:{},guildId:'g'+i,led:{v:1,migratedAt:1,rev:1,gold:0,gems:0,px:1000,hero,unlocked:unl,frags:{}}}; members.push(id); }
  DB.guilds['g'+i]={id:'g'+i,name:'G'+i,leader:members[0],members,level:1,exp:0}; }
const t=S.getTournament();
t.entrants=[]; for(let i=1;i<=17;i++){ t.entrants.push({guildId:'g'+i,name:'G'+i,lines:[],powerPool:0}); }
t.entrants.push({guildId:'gghost',name:'Ghost',lines:[{memberId:'nobody',line:0,heroes:[],power:999999}],powerPool:999999});
t.registrationLocksAt=S.warNow()-1000; t.state='registration';
S.warAdvance(t);
ck('17 registered -> 16 kept', t.entrants.length===16);
ck('weakest (g1, one line) excluded', !t.entrants.some(e=>e.guildId==='g1'));
ck('seed 1 = strongest (g17)', t.entrants[0].guildId==='g17' && t.entrants[0].seed===1);
ck('an entrant whose guild is gone is dropped (v980)', !t.entrants.some(e=>e.guildId==='gghost'));
ck('bracket formed', t.state==='bracket' && t.rounds && t.rounds[0].matchIds.length>0);
console.log('PASS: '+pass+'  FAIL: '+fail); process.exit(fail?1:0);
