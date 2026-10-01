'use strict';
const C=require('./world-tree-control.js'),S=require('./world-tree-score.js'),R=require('./world-tree-ranking.js');
const clone=x=>JSON.parse(JSON.stringify(x));
// Pure transaction plan. The server persists all state and injuries together, or none.
function run(saved,input,hooks,guilds){
  if(input.enabled!==true)return {ok:false,error:'World Tree event disabled'};
  const state=saved?clone(saved):{version:1,control:null,score:null,finals:{},guilds:{}};
  if(state.version!==1||!state.finals||!state.guilds)throw Error('Invalid lifecycle state');
  const effects=[];
  function accept(result){
    if(!result.ok)return result;
    state.control=result.state;effects.push(...result.effects);state.control.effects=[];
    for(const m of Object.values(state.control.marches))if(!Object.hasOwn(state.guilds,m.guildId)){
      const g=guilds?.[m.guildId];
      if(!Number.isSafeInteger(g?.createdAt)||g.createdAt<0)throw Error('Guild creation timestamp required');
      Object.defineProperty(state.guilds,m.guildId,{value:{createdAt:g.createdAt,name:typeof g.name==='string'?g.name.slice(0,100):'Guild',tag:typeof g.tag==='string'?g.tag.slice(0,20):''},enumerable:true,writable:true,configurable:true});
    }
    state.score=S.advance(state.score,state.control,input.now);
    if(state.control.endedAt!=null&&!Object.hasOwn(state.finals,state.control.eventId)){
      const final=R.standings(state.score,state.control,state.guilds);
      final.rows=final.rows.map(r=>({...r,guildName:state.guilds[r.guildId].name,guildTag:state.guilds[r.guildId].tag}));
      Object.defineProperty(state.finals,state.control.eventId,{value:final,enumerable:true,writable:true,configurable:true});
    }
    return result;
  }
  // Always finish the previous event on its own authority before opening a new one.
  if(state.control){
    const tick=accept(C.dispatch(state.control,{...input,actorId:null,guildId:null,action:'tick',payload:{}},hooks));
    if(!tick.ok)return tick;
    if(input.window?.active===true&&input.window.startsAt!==state.control.startsAt){
      if(input.window.startsAt<state.control.endsAt||state.control.endedAt==null||Object.values(state.control.sites).some(s=>s.active))throw Error('Unsafe event rollover');
      const returning=Object.values(state.control.marches).filter(m=>m.phase==='returning'&&m.homeAt>input.now);
      state.control=C.initial(input.window);state.score=null;
      for(const m of returning){state.control.marches[m.id]=m;state.control.sequence=Math.max(state.control.sequence,m.sequence);}
    }
  }
  const result=accept(C.dispatch(state.control,input,hooks));
  if(!result.ok)return result; // caller must not commit a failed action's transaction plan
  return {ok:true,state,effects,marchId:result.marchId};
}
module.exports={run};
