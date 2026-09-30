'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const cal=require('../assets/ui/guild-war-calendar.js');
const time=s=>Date.parse(s), et=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:cal.timeZone,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(ms);
test('signups alternate with World Tree; never creates an off-week key',()=>{
 assert.equal(cal.key(time('2026-10-03T12:00:00Z')),'2026-09-26');
 assert.equal(cal.key(time('2026-10-10T05:59:59.999Z')),'2026-09-26');
 assert.equal(cal.key(time('2026-10-10T06:00:00Z')),'2026-10-10');
 assert.equal(cal.key(time('2026-10-17T12:00:00Z')),'2026-10-10');
 assert.equal(cal.key(time('2026-10-24T06:00:00Z')),'2026-10-24');
});
test('existing signup, four-round and report windows preserved',()=>{
 const s=cal.schedule(cal.anchor(time('2026-10-10T12:00:00Z')));
 assert.equal(s.registrationOpensAt,time('2026-10-10T06:00:00Z'));
 assert.equal(s.registrationLocksAt,time('2026-10-12T04:00:00Z'));
 assert.deepEqual(s.rounds.map(x=>x.name),['R16','QF','SF','F']);
 for(let i=0;i<4;i++){
  const d=13+i;
  assert.equal(s.rounds[i].planningOpensAt,time(`2026-10-${d}T06:00:00Z`));
  assert.equal(s.rounds[i].lockAt,time(`2026-10-${d}T22:00:00Z`));
  assert.equal(s.rounds[i].endsAt,time(`2026-10-${d+1}T00:00:00Z`));
  assert.equal(s.rounds[i].resultsUntil,time(`2026-10-${d+1}T06:00:00Z`));
 }
});
test('recurrence stays at 02:00 server time across fall DST',()=>{
 const before=time('2026-10-24T12:00:00Z');
 assert.equal(cal.nextRegistration(before),time('2026-11-07T07:00:00Z'));
 assert.match(et(cal.nextRegistration(before)),/02:00/);
 assert.equal(cal.key(time('2026-11-07T06:59:59.999Z')),'2026-10-24');
 assert.equal(cal.key(time('2026-11-07T07:00:00Z')),'2026-11-07');
});
test('spring DST inside signup weekend does not move Monday lock or rounds',()=>{
 const s=cal.schedule(cal.anchor(time('2027-03-13T12:00:00Z')));
 assert.equal(s.registrationOpensAt,time('2027-03-13T07:00:00Z'));
 assert.equal(s.registrationLocksAt,time('2027-03-15T04:00:00Z'));
 assert.equal(s.rounds[0].planningOpensAt,time('2027-03-16T06:00:00Z'));
 assert.match(et(s.rounds[0].lockAt),/18:00/);
});
test('client predicts only allowed signup and battle dates',()=>{
 for(const d of ['2026-10-03','2026-10-04','2026-10-06','2026-10-09','2026-10-17','2026-10-20'])assert.equal(cal.dayType(d),null);
 assert.equal(cal.dayType('2026-10-10'),'registration');
 assert.equal(cal.dayType('2026-10-11'),'registration');
 assert.equal(cal.dayType('2026-10-12'),null);
 assert.equal(cal.dayType('2026-10-13'),'war');
 assert.equal(cal.dayType('2026-10-16'),'war');
 assert.equal(cal.dayType('2026-02-30'),null);
});
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
function harness(now,current){
 const get=server.slice(server.indexOf('function getTournament(){'),server.indexOf('/* v740 - THE GATE'));
 const db={tournaments:{current}},context={DB:db,warNow:()=>now,warWeekKey:cal.key,warWeekAnchor:cal.anchor,warSchedule:cal.schedule,
  warAdvance:t=>{t.state='finished';t.version++;},warEscrowRewards:t=>{t.escrowed=true;},warResultRecord:t=>({id:t.id}),writeDB:()=>{}};
 vm.createContext(context);vm.runInContext(get+'\nthis.getTournament=getTournament;',context);return context;
}
test('actual getTournament preserves current registrations and entrants on off weekend',()=>{
 const current={id:'gw_2026-09-26',weekKey:'2026-09-26',state:'bracket',entrants:[{guildId:'keep-me'}],version:1};
 const h=harness(time('2026-10-03T12:00:00Z'),current);
 assert.equal(h.getTournament(),current);assert.equal(current.state,'bracket');assert.equal(current.entrants[0].guildId,'keep-me');
});
test('actual rollover retains result and reward handling, then waits another fortnight',()=>{
 const old={id:'old',weekKey:'2026-09-26',state:'finished',version:1};
 const h=harness(time('2026-10-10T06:00:00Z'),old), t=h.getTournament();
 assert.equal(old.escrowed,true);assert.equal(h.DB.tournaments.history['2026-09-26'].id,'old');
 assert.equal(t.weekKey,'2026-10-10');assert.equal(t.registrationOpensAt,time('2026-10-10T06:00:00Z'));
 h.warNow=()=>time('2026-10-17T12:00:00Z');assert.equal(h.getTournament(),t);
});
test('late rollout never erases an already-open legacy weekly tournament',()=>{
 const s=cal.schedule(time('2026-10-03T04:00:00Z'));
 const current={id:'legacy',weekKey:'2026-10-03',state:'bracket',registrationOpensAt:s.registrationOpensAt,schedule:s.rounds,version:1};
 const h=harness(time('2026-10-06T12:00:00Z'),current);
 assert.equal(h.getTournament(),current);
 h.warNow=()=>time('2026-10-10T06:00:00Z');
 assert.equal(h.getTournament().weekKey,'2026-10-10');assert.equal(current.escrowed,true);
});
test('actual server wrapper hooks and all client inline scripts parse',()=>{
 assert.match(server,/function warWeekKey\(now\)\{ return GUILD_WAR_CALENDAR.key\(now\); \}/);
 assert.match(server,/return GUILD_WAR_CALENDAR.schedule\(anchor\)/);
 assert.match(server,/nextRegistrationOpensAt:GUILD_WAR_CALENDAR.nextRegistration/);
 new vm.Script(server);
 const html=fs.readFileSync(path.join(__dirname,'../emberweave-heroes.html'),'utf8');
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/.test(m[1]))new vm.Script(m[2]);
 assert.match(html,/const predicted=window.EmberweaveGuildWarCalendar.dayType\(k\)/);
 assert.doesNotMatch(html,/Weekly guild knockout/);
});
