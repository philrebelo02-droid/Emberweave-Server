'use strict';
const cycle=require('../assets/ui/world-tree-cycle.js');

// DB is the real backed-up game database; never a separate JSON progress store.
// The first event time is explicit and persisted once, never reset by a deploy.
function snapshot(DB,{now=Date.now(),firstEventAt=null,save}={}){
  if(!Number.isSafeInteger(now)||now<0)throw new Error('Invalid server time');
  const saved=DB.worldTreeCalendar;
  if(saved && (saved.schemaVersion!==1 || !Number.isSafeInteger(saved.firstEventAt)))throw new Error('Invalid saved World Tree calendar');
  if(!saved){
    if(firstEventAt===null)return {configured:false,serverNow:now};
    cycle.phase(firstEventAt,now);
    if(typeof save!=='function')throw new Error('Durable game DB save required');
    DB.worldTreeCalendar={schemaVersion:1,firstEventAt};
    try{save();}catch(error){delete DB.worldTreeCalendar;throw error;}
  }else if(firstEventAt!==null&&firstEventAt!==saved.firstEventAt){
    console.warn('World Tree configured anchor differs from saved schedule; retaining saved calendar. Explicit migration required to change it.');
  }
  const first=DB.worldTreeCalendar.firstEventAt;
  return {configured:true,serverNow:now,firstEventAt:first,...cycle.phase(first,now)};
}
module.exports={snapshot};
