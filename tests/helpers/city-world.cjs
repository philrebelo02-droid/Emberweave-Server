'use strict';
/* World-map city fights for the real-engine tests (NPC castle, hit timing): real accounts (tests/helpers/arena-world.cjs heroes), NPC castles
   as the seeded ladder stores them ({id, isNpc, team / wall of {key, level, rank}}), and city marches built exactly as /api/world/city/start
   builds them - the squad's campaignHeroSpec resolved by the page (sim-host snapFromSpecs), each snap at its Witch's Hut HP (hp and
   worldEntryHpCap) - already arrived, so /api/pvp/attack fights them. ids are fixed strings, so two servers given the same world build the
   same one. */
const WITCH=require('../../server/witches-hut.js');
function wound(S,u,key,frac){ const w=u.witch||(u.witch=WITCH.create(100000,Date.now())); w.level=Math.max(w.level|0,WITCH.UNLOCK_LEVEL); w.hp[key]=Math.round(frac*WITCH.HP_FULL); }
function npc(S,id,team,o){ const DB=S.getDB(); DB.users[id]={id,name:'Castle '+id,isNpc:true,rank:(o&&o.rank)||4000,coins:0,team:team.map(t=>Object.assign({},t)),created:0};
  if(o&&o.wall) DB.users[id].wall=o.wall.map(t=>Object.assign({},t)); return DB.users[id]; }
function march(S,u,id,defId,heroIds,o){ o=o||{}; const host=S.simHost(), now=Date.now();
  const specs=heroIds.map(k=>S.campaignHeroSpec(u,k));
  const w=u.witch; const snaps=host.snapFromSpecs(JSON.parse(JSON.stringify(specs))).map(s=>{ const hp=w?WITCH.combatHp(w,s.key,s.maxHp):s.maxHp; return Object.assign({},s,{hp,worldEntryHpCap:hp}); });
  const m={id,defId,heroIds:heroIds.slice(),snaps,depart:now-120000,arriveAt:o.future?now+3600000:now-1000,homeAt:now+3600000,resolved:false,route:null};
  if(o.botTeam) m.botTeam=o.botTeam.map(h=>({key:h.key,level:h.level,rank:h.rank}));
  u.worldCityMarches=u.worldCityMarches||[]; u.worldCityMarches.push(m); return m; }
module.exports={ wound, npc, march };
