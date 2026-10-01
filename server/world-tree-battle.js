'use strict';
const vm=require('node:vm');
function once(source,old,next){if(source.split(old).length!==2)throw Error('World Tree battle anchor drift');return source.replace(old,next);}
function prepare(source){
  let s=once(source,'function simFightResult(','function worldTreeFightResult(');
  s=once(s,'const sv={units,state,ended,CUR,battleTime,gameSpeed,waveXfer,chapterWaves,waveIdx};','const sv={units,state,ended,CUR,battleTime,gameSpeed,waveXfer,chapterWaves,waveIdx,REPLAY_IN};');
  s=once(s,'  window._p2guard=true;','  try{\n  window._p2guard=true;');
  s=once(s,'  if(manualReplay) autoUlt=false;','  autoUlt=true; REPLAY_IN=null;');
  s=once(s,'  for(let i=0;i<14400 && !ended;i++) updateBattle(SIM_STEP);',
    `  const wtTracked=units.slice(),wtDeaths=[],wtSeen=new Set();
  for(const u of units)u.energy=0;
  for(let i=0;i<Math.ceil(90/SIM_STEP) && !ended;i++){
    updateBattle(SIM_STEP);
    for(const u of wtTracked)if(!u.alive&&!wtSeen.has(u.uid)){
      wtSeen.add(u.uid);wtDeaths.push({key:u.key,team:u.team,atMs:Math.min(45000,Math.ceil(battleTime*500))});
    }
  }`);
  s=once(s,'const won = (window._p2win===true) || (allyAlive>0 && foeAlive===0);','const won = battleTime<90 && allyAlive>0 && foeAlive===0;');
  s=once(s,'    u:units.map(u=>[u.key,u.team,u.alive?1:0,Math.round(u.hp),Math.round(u.energy),Math.round(u.x),Math.round(u.y)]) });',
    '    deaths:wtDeaths, u:units.map(u=>[u.key,u.team,u.alive?1:0,Math.round(u.hp),Math.round(u.energy),Math.round(u.x),Math.round(u.y)]) });');
  s=once(s,'  window._p2guard=false; autoUlt=svAuto;','  return won;\n  }finally{window._p2guard=false; autoUlt=svAuto;');
  s=once(s,'  ({units,state,ended,CUR,battleTime,gameSpeed,waveXfer,chapterWaves,waveIdx}=sv);\n  return won;',
    '  ({units,state,ended,CUR,battleTime,gameSpeed,waveXfer,chapterWaves,waveIdx,REPLAY_IN}=sv);\n  }');
  return s;
}
function create(host){
  if(!host?.ctx||!host.sandbox||typeof host.sandbox.simFightResult!=='function')throw Error('World Tree battle engine unavailable');
  const source=prepare(host.sandbox.simFightResult.toString());
  new vm.Script(source).runInContext(host.ctx);
  return function battle(ally,foe,seed){
    const a=JSON.parse(JSON.stringify(ally)),d=JSON.parse(JSON.stringify(foe));
    host.sandbox.worldTreeFightResult(a,d,seed>>>0,false);
    const digest=JSON.parse(host.sandbox._p2digest||'null');
    if(!digest||!Array.isArray(digest.u)||!Array.isArray(digest.deaths)||!Number.isFinite(digest.t))throw Error('Incomplete World Tree battle digest');
    const outcomes=(snaps,team)=>snaps.map(s=>{const row=digest.u.find(r=>r[0]===s.key&&r[1]===team);return {key:s.key,maxHp:s.maxHp,hp:row&&row[2]?Math.max(0,Math.min(s.hp,+row[3]||0)):0};});
    const ao=outcomes(a,'ally'),fo=outcomes(d,'enemy');
    const durationMs=Math.min(45000,Math.max(Math.ceil(digest.t*500),...digest.deaths.map(x=>x.atMs)));
    return {won:digest.won===true,durationMs,ally:ao,foe:fo,
      deaths:digest.deaths.filter(x=>x.team==='enemy'&&fo.some(r=>r.key===x.key&&r.hp===0)),digest,seed:seed>>>0,engine:host.buildVersion};
  };
}
module.exports={prepare,create};
