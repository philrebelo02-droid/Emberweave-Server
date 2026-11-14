'use strict';
/* Arena worlds for the real-engine tests: real accounts with every progression system set the way the server stores it.
   hero(st): st = {level, stars, skill:[4], asc (glyph board ascension), glyphAtk (an ascended Physical Attack value on the board),
   acad (Academy attack research level), gear (a catalog item id worn), temper (that item type's Temper), temple (Temple blessings
   lit, 0..4), talents (a learned build {id:rank})}. Every field is optional. */
const path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const TEMPLE=require(path.join(root,'server','temple-of-ash.js'));
const HERO_GEAR=require(path.join(root,'server','hero-gear.json'));
const CAT=require(path.join(root,'server','gear-catalog.json'));
const BYID={}; for(const d of CAT.items) BYID[d.id]=d;
const TEAM=['vael','sylthaine','vireo','vex','gruel'];
function gearFor(key,qi){ const list=HERO_GEAR[key]; const id=list&&list[qi==null?3:qi]; return id&&BYID[id]?id:null; }
function setHero(S,u,key,st){
  const led=S.ensureLedger(u);
  led.unlocked[key]=true;
  led.hero[key]={xp:S.D_HERO_CUM[Math.max(1,Math.min(100,st.level||60))],stars:st.stars||5,pips:0,ref:0};
  led.skill=led.skill||{}; led.skill[key]=(st.skill||[1,1,1,1]).slice();
  u.glyphs=u.glyphs||{revision:1,fragments:{},subGlyphs:{},finished:{},boards:{}};
  const asc={}; if(st.glyphAtk) asc['Physical Attack']={val:st.glyphAtk};
  u.glyphs.boards[key]={slots:[null,null,null,null,null,null],ascensionIndex:st.asc|0,ascended:asc,personalPathVersion:1};
  if(st.acad!=null){ led.acad=led.acad||{lv:{academy:0,atk:0,hp:0,ap:0,heal:0,armor:0,mr:0,crit:0,critres:0},learn:{},res:{iron:0,crystal:0,silver:0,coal:0}}; led.acad.lv.atk=st.acad|0; }
  if(st.gear){ u.gear=u.gear||{revision:1,fragments:{},subs:{},items:{},equipped:{},active:{},seq:1,heroGearV:1};
    const d=BYID[st.gear], iid='it-'+key+'-'+d.slot; u.gear.items[iid]={d:d.id,temper:st.temper|0,prog:0}; u.gear.equipped[key]=u.gear.equipped[key]||{}; u.gear.equipped[key][d.slot]=iid;
    u.gear.tt=u.gear.tt||{}; u.gear.tt[d.id]={temper:st.temper|0,prog:0,dustSpent:0}; }
  if(st.temple){ led.temple=led.temple||TEMPLE.newState(); led.temple.heroes=led.temple.heroes||{};
    const h=led.temple.heroes[key]=JSON.parse(JSON.stringify(led.temple.heroes[key]||{key,steps:{},boonsUnlocked:[false,false,false,false,false]}));
    h.key=key; h.boonsUnlocked=[0,1,2,3,4].map(i=>i<st.temple); led.temple.heroes[key]=h; }
  if(st.talents){ led.talents=led.talents||{}; led.talents[key]=JSON.parse(JSON.stringify(st.talents)); }
}
/* ids come from the names, so two servers given the same world give the same ids (the Arena seed hashes them) */
function player(S,name,heroes,o){ o=o||{}; const id='p-'+name, DB=S.getDB();
  const u={id,name,created:Date.now()-1000,rank:o.rank||5005,coins:0,team:Object.keys(heroes),wall:Object.keys(heroes),roster:{},qc:{}};
  DB.users[id]=u; DB.byName=DB.byName||{}; DB.byName[name.toLowerCase()]=id;
  const led=S.ensureLedger(u); led.px=S.D_TROOP_CUM[100]; led.gold=1000;
  for(const k in heroes) setHero(S,u,k,heroes[k]);
  if(o.arenaDef) u.arenaDef=o.arenaDef.map(key=>({key}));
  return u; }
function bot(S,rank,team){ const DB=S.getDB(), id='bot_t'+rank; DB.users[id]={id,name:'Ironhold '+rank,isNpc:true,rank,coins:0,team:team.map(t=>Object.assign({},t)),created:0}; return DB.users[id]; }
function offer(u,ids){ const now=Date.now(); u._arenaOffer=(u._arenaOffer||[]).concat(ids.map(id=>({id,t:now}))); }
module.exports={ setHero, player, bot, offer, gearFor, TEAM, BYID };
