'use strict';
/* Skyfall worlds for the real-engine tests (tests/real-engine-skyfall.test.js): two guilds of real accounts (tests/helpers/arena-world.cjs
   heroes, every progression system as the server stores it), each member with one saved war line of five heroes, a final between the two
   in PLANNING with every line placed, its lock time passed - so the next /api/guild-war call locks it through the game's own warAdvance ->
   warLockMatch. ids and the match id come from the names / a pinned random stream, so two servers given the same world build the same war.
   war(S, {lanes}) -> {A:[users], B:[users], gA, gB, m, t}. lanes: the lane each member's line stands in (default: member i -> lane i % 5). */
const W=require('./arena-world.cjs'), IP=require('./server-inproc.cjs');
const ROSTER=['vael','sylthaine','vireo','vex','gruel','grosk','tick','fritz','konwu','aureth'];
function line(i){ return ROSTER.slice(i%2?5:0,(i%2?5:0)+5); }
function member(S,name,gid,keys,st){ const heroes={}; for(const k of keys) heroes[k]=Object.assign({level:60,stars:5,skill:[20,20,20,20],asc:4},typeof st==='function'?st(k):(st||{}));
  const u=W.player(S,name,heroes); u.guildId=gid; u.warLines=[keys.slice()]; return u; }
function war(S,o){ o=o||{}; const DB=S.getDB(), n=o.n||3;
  IP.pin(o.seed||77);
  try{
    const A=[], B=[];
    for(let i=0;i<n;i++) A.push(member(S,'GA'+i,'gA',line(i),o.statA&&o.statA(i)));
    for(let i=0;i<n;i++) B.push(member(S,'GB'+i,'gB',line(i+1),o.statB&&o.statB(i)));
    DB.guilds=DB.guilds||{};
    DB.guilds.gA={id:'gA',name:'Ashen Banner',leader:A[0].id,members:A.map(u=>u.id),level:7,exp:0};
    DB.guilds.gB={id:'gB',name:'Iron Lantern',leader:B[0].id,members:B.map(u=>u.id),level:7,exp:0};
    const t=S.getTournament(), now=Date.now();
    t.state='bracket'; t.entrants=[S.warQualifyGuild(DB.guilds.gA),S.warQualifyGuild(DB.guilds.gB)]; t.entrants.forEach((e,i)=>e.seed=i+1);
    const m=S.warNewMatch(t,0,t.entrants[0],t.entrants[1]);
    t.rounds=[{name:'F',matchIds:[m.id]}]; t.roundIndex=0; t.roundBase=3;
    m.revealAt=now-7200000; m.planningEndsAt=now-1000; m.startsAt=now-1000; m.endsAt=now+3*3600000;
    const lanes=o.lanes||((i)=>i%5);
    for(const [gid,mem] of [['gA',A],['gB',B]]){ const side=m.sides[gid]; side.unplaced=[];
      mem.forEach((u,i)=>side.citadels[lanes(i)].defenders.push({memberId:u.id,line:0})); }
    return {A,B,gA:DB.guilds.gA,gB:DB.guilds.gB,m,t};
  } finally{ IP.unpin(); } }
module.exports={ war, member, ROSTER, line };
