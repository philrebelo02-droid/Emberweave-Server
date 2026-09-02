// Top-16 qualification: 17 registered guilds -> exactly 16 kept, the weakest 17th excluded,
// seeds 1..16 by power. Runs against server internals (listener neutered).
const load=require('./_probe_loader.js');
const S=load('./probe-db-wb.json');
let pass=0,fail=0; const ck=(n,c)=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n)); };
const t=S.getTournament();
t.entrants=[]; for(let i=1;i<=17;i++){ t.entrants.push({guildId:'g'+i,name:'G'+i,lines:[],powerPool:1000+i}); }
t.registrationLocksAt=S.warNow()-1000; t.state='registration';
S.warAdvance(t);
ck('17 registered -> 16 kept', t.entrants.length===16);
ck('weakest (g1, pool 1001) excluded', !t.entrants.some(e=>e.guildId==='g1'));
ck('seed 1 = strongest (g17)', t.entrants[0].guildId==='g17' && t.entrants[0].seed===1);
ck('bracket formed', t.state==='bracket' && t.rounds && t.rounds[0].matchIds.length>0);
console.log('PASS: '+pass+'  FAIL: '+fail); process.exit(fail?1:0);
