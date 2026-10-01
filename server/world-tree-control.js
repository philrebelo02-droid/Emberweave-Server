'use strict';
// Server-owned control draft. No score, reward or enable switch in this slice.
const SITE_IDS=['tree','oasis-north','oasis-south','oasis-east','oasis-west'];
const clone=x=>JSON.parse(JSON.stringify(x));
const safeId=x=>typeof x==='string'&&x.length>0&&x.length<=200&&!['__proto__','constructor','prototype'].includes(x);
const ms=x=>Number.isSafeInteger(x)&&x>=0;
const LIMIT=id=>id==='tree'?15:10;
const HOLD=id=>id==='tree'?12*3600000:8*3600000;
const BENEFIT=require('./world-tree-benefit.js');
function initial(window){
  if(!window||!ms(window.startsAt)||!ms(window.endsAt)||window.endsAt-window.startsAt!==86400000)throw Error('Invalid event window');
  return {version:1,eventId:'world-tree-'+window.startsAt,startsAt:window.startsAt,endsAt:window.endsAt,through:window.startsAt,sequence:0,
    sites:Object.fromEntries(SITE_IDS.map(id=>[id,{holderGuildId:null,heldSince:null,lines:[],queue:[],active:null}])),marches:{},effects:[],controlChanges:[]};
}
function publicState(state,userId,guildId,now){
  if(!state)return {guildId:guildId||null,serverNow:now,sites:[],marches:[]};
  return {guildId:guildId||null,eventId:state.eventId,startsAt:state.startsAt,endsAt:state.endsAt,endedAt:state.endedAt??null,serverNow:now,
    sites:SITE_IDS.map(id=>{const s=state.sites[id],out={id,holderGuildId:s.holderGuildId,heldSince:s.heldSince,garrisonCount:s.lines.length,
      benefit:id!=='tree'&&s.holderGuildId&&s.holderGuildId===state.sites.tree.holderGuildId?{damagePercent:10,regenPercent:1,regenEveryMs:30000}:null};
      // Only a holder's guild sees garrison membership, never snapshots/HP/energy.
      if(guildId&&guildId===s.holderGuildId)out.lines=s.lines.map(mid=>{const m=state.marches[mid];return {id:m.id,ownerId:m.ownerId,heroIds:m.heroIds.slice(),arrivedAt:m.arriveAt,returnAt:m.holdUntil};});
      return out;}),
    marches:Object.values(state.marches).filter(m=>m.ownerId===userId&&(m.phase!=='home'||m.homeAt>now)).map(m=>({id:m.id,siteId:m.siteId,guildId:m.guildId,heroIds:m.heroIds.slice(),phase:m.phase,depart:m.depart,arriveAt:m.arriveAt,homeAt:m.homeAt,holdUntil:m.holdUntil,route:clone(m.route),
      // Own health only. Enemy/guildmate health and battle seeds never leave the server.
      healthPercent:m.snaps.length?Math.floor(100*m.snaps.reduce((n,s)=>n+Math.max(0,s.hp),0)/m.snaps.reduce((n,s)=>n+s.maxHp,0)):0,
      canRetreat:!['home','returning','fighting'].includes(m.phase)&&!Object.values(state.sites).some(s=>s.active?.defender===m.id)}))};
}
function busy(state,ownerId,key,now){return !!state&&Object.values(state.marches).some(m=>m.ownerId===ownerId&&m.heroIds.includes(key)&&m.phase!=='home'&&(m.phase!=='returning'||m.homeAt>now));}
function dispatch(saved,input,hooks){
  const {enabled,window,now,actorId,guildId,action,payload={}}=input;
  if(enabled!==true)return {ok:false,error:'World Tree event disabled'};
  const settling=saved&&(action==='tick'||action==='resolve');
  if(!ms(now)||(!settling&&(!window||window.active!==true||now<window.startsAt||now>=window.endsAt)))return {ok:false,error:'World Tree event is not active'};
  if(action!=='tick'&&!safeId(actorId))return {ok:false,error:'Authenticated owner required'};
  if(action!=='tick'&&action!=='retreat'&&(!safeId(guildId)||!hooks.guildValid(guildId,actorId)))return {ok:false,error:'Current guild membership required'};
  const state=saved?clone(saved):initial(window);
  if(state.version!==1||(!settling&&(state.startsAt!==window.startsAt||state.endsAt!==window.endsAt)))throw Error('Control event mismatch');
  if(now<state.through)return {ok:false,error:'Server clock moved backwards'};
  state.effects=[];
  function effect(m,rows,at,tag){state.effects.push({id:state.eventId+':'+tag,ownerId:m.ownerId,heroIds:rows.map(r=>r.key),outcomes:clone(rows),at});}
  function home(m,at,reason){
    const s=state.sites[m.siteId];s.lines=s.lines.filter(id=>id!==m.id);s.queue=s.queue.filter(id=>id!==m.id);
    m.phase='returning';m.returnDepart=at;m.homeAt=at+m.travelMs;m.returnReason=reason;m.holdUntil=null;
  }
  function holder(s,gid,at){if(s.holderGuildId!==gid){
    const siteId=SITE_IDS.find(id=>state.sites[id]===s);
    state.controlChanges.push({sequence:state.controlChanges.length+1,siteId,at,fromGuildId:s.holderGuildId,toGuildId:gid});
    s.holderGuildId=gid;s.heldSince=gid?at:null;
    if(siteId==='tree')for(const m of Object.values(state.marches))if(m.siteId!=='tree'&&m.phase==='garrison')m.regenAt=gid===m.guildId?at+30000:null;
  }}
  function garrison(m,at){const s=state.sites[m.siteId];
    if(state.endedAt!=null||at>=state.endsAt){home(m,at,'event-ended');return;}
    if(s.lines.length>=LIMIT(m.siteId)){home(m,at,'site-full');return;}
    holder(s,m.guildId,at);m.phase='garrison';m.holdUntil=at+HOLD(m.siteId);m.homeAt=m.holdUntil+m.travelMs;s.lines.push(m.id);
    m.regenAt=BENEFIT.eligible(state,m)?at+30000:null;
  }
  function fight(s,m,at){
    if(state.endedAt!=null||at>=state.endsAt){home(m,at,'event-ended');return;}
    const did=s.lines[s.lines.length-1],d=state.marches[did];
    if(!d){garrison(m,at);return;}
    const benefit=BENEFIT.eligible(state,d)&&hooks.guildValid(d.guildId,d.ownerId);
    const aSnaps=m.snaps.filter(x=>x.hp>0).map(x=>({...clone(x),energy:0})),dSnaps=d.snaps.filter(x=>x.hp>0).map(x=>({...clone(x),energy:0,worldTreeBenefit:benefit}));
    const seed=hooks.seed(state.eventId,m.id,d.id,m.fights||0);
    const result=hooks.battle(aSnaps,dSnaps,seed);
    if(!result||typeof result.won!=='boolean'||!ms(result.durationMs)||result.durationMs>45000||!Array.isArray(result.ally)||!Array.isArray(result.foe)||!Array.isArray(result.deaths))throw Error('Invalid authoritative battle');
    for(const [rows,snaps]of [[result.ally,aSnaps],[result.foe,dSnaps]]){
      if(rows.length!==snaps.length||new Set(rows.map(r=>r.key)).size!==rows.length)throw Error('Incomplete battle outcomes');
      for(const row of rows){const original=snaps.find(x=>x.key===row.key);const cap=original?Math.min(original.maxHp,original.hp+(original.worldTreeBenefit?Math.floor(result.durationMs/30000)*original.maxHp*.01:0)):0;if(!original||!Number.isFinite(row.hp)||row.hp<0||row.hp>cap||row.maxHp!==original.maxHp)throw Error('Invalid battle HP');}
    }
    const aliveA=result.ally.some(r=>r.hp>0),aliveD=result.foe.some(r=>r.hp>0);
    // Full death and timeout always defend. Never trust a client winner.
    const won=result.won&&aliveA&&!aliveD&&result.durationMs<45000;
    const deaths=result.deaths.filter(x=>x.team==='enemy');
    if(new Set(deaths.map(x=>x.key)).size!==deaths.length||deaths.some(x=>!ms(x.atMs)||x.atMs>result.durationMs||!result.foe.some(r=>r.key===x.key&&r.hp===0)))throw Error('Invalid death schedule');
    if(result.foe.filter(r=>r.hp===0).length!==deaths.length)throw Error('Missing defender death schedule');
    m.phase='fighting';m.fights=(m.fights||0)+1;
    s.active={attacker:m.id,defender:d.id,startedAt:at,endsAt:at+result.durationMs,seed,benefit,result:{...clone(result),won},deaths:deaths.map((x,i)=>({...x,at:at+x.atMs,done:false,order:i}))};
  }
  function nextAttack(s,at){if(s.active||state.endedAt!=null||at>=state.endsAt)return;while(s.queue.length){const m=state.marches[s.queue.shift()];
    if(!hooks.guildValid(m.guildId,m.ownerId)){home(m,at,'guild-changed');continue;}
    if(!s.lines.length||s.holderGuildId===m.guildId)garrison(m,at);else{fight(s,m,at);break;}}
  }
  function advance(to){let steps=0;
    for(;;){const events=[];
      if(state.endedAt==null)events.push({at:state.endsAt,rank:-100,seq:0,type:'cutoff',id:'cutoff'});
      for(const m of Object.values(state.marches)){
        if(m.phase==='outbound')events.push({at:m.arriveAt,rank:2,seq:m.sequence,type:'arrive',m});
        if(m.phase==='garrison'&&ms(m.holdUntil)&&!Object.values(state.sites).some(s=>s.active?.defender===m.id))events.push({at:Math.max(m.holdUntil,state.through),rank:3,seq:m.sequence,type:'hold',m});
        if(m.phase==='returning')events.push({at:m.homeAt,rank:4,seq:m.sequence,type:'home',m});
        if(state.endedAt==null&&BENEFIT.eligible(state,m)&&ms(m.regenAt)&&!Object.values(state.sites).some(s=>s.active?.defender===m.id))events.push({at:m.regenAt,rank:5,seq:m.sequence,type:'regen',m});
      }
      for(const [id,s]of Object.entries(state.sites))if(s.active){const f=s.active;
        for(const x of f.deaths)if(!x.done)events.push({at:x.at,rank:0,seq:x.order,type:'death',s,f,x,id});
        events.push({at:f.endsAt,rank:1,seq:0,type:'finish',s,f,id});}
      const eventRank=e=>(e.id==='tree'||e.m?.siteId==='tree')?e.rank-10:e.rank;
      events.sort((a,b)=>a.at-b.at||eventRank(a)-eventRank(b)||a.seq-b.seq||(a.id||a.m.id).localeCompare(b.id||b.m.id));
      const e=events[0];if(!e||e.at>to)break;if(++steps>2000)throw Error('Control settlement limit');
      if(e.type==='cutoff'){
        state.endedAt=state.endsAt;
        const fighting=new Set(Object.values(state.sites).flatMap(s=>s.active?[s.active.attacker,s.active.defender]:[]));
        for(const m of Object.values(state.marches)){
          m.regenAt=null;
          if(!fighting.has(m.id)&&['outbound','queued','garrison'].includes(m.phase))home(m,e.at,'event-ended');
        }
        // Holder history freezes; keeping the final holder is data, not post-end occupation.
      }
      if(e.type==='arrive'){const m=e.m,s=state.sites[m.siteId];m.phase='queued';
        if(!hooks.guildValid(m.guildId,m.ownerId))home(m,e.at,'guild-changed');
        else{s.queue.push(m.id);nextAttack(s,e.at);}}
      if(e.type==='hold'){home(e.m,e.at,'hold-expired');if(!state.sites[e.m.siteId].lines.length&&!state.sites[e.m.siteId].active)holder(state.sites[e.m.siteId],null,e.at);nextAttack(state.sites[e.m.siteId],e.at);}
      if(e.type==='home')e.m.phase='home';
      if(e.type==='regen'){const m=e.m;
        // Batch only until before the next non-regen event: no credit across a capture, fight or return.
        const stop=Math.min(to,...events.filter(x=>x.type!=='regen').map(x=>x.at-1)),ticks=Math.floor((stop-e.at)/30000)+1,last=e.at+(ticks-1)*30000;
        if(ticks<1)throw Error('Invalid regeneration ordering');
        if(hooks.guildValid(m.guildId,m.ownerId)){const r=BENEFIT.settle(m.snaps,null,e.at-30000,last,true);m.snaps=r.snaps;effect(m,m.snaps,last,'regen:'+m.id+':'+last);state.effects[state.effects.length-1].benefit=true;}m.regenAt=last+30000;
      }
      if(e.type==='death'){
        e.x.done=true;const d=state.marches[e.f.defender],row=e.f.result.foe.find(r=>r.key===e.x.key);
        const childId=d.id+':death:'+e.x.key;if(state.marches[childId])throw Error('Duplicate defender return');
        state.marches[childId]={...clone(d),id:childId,heroIds:[e.x.key],snaps:[],phase:'returning',returnDepart:e.at,homeAt:e.at+d.travelMs,holdUntil:null,returnReason:'killed'};
        d.heroIds=d.heroIds.filter(k=>k!==e.x.key);d.snaps=d.snaps.filter(x=>x.key!==e.x.key);
        effect(d,[row],e.at,'death:'+childId);
      }
      if(e.type==='finish'){
        const a=state.marches[e.f.attacker],d=state.marches[e.f.defender],r=e.f.result;
        const update=(m,rows)=>{for(const x of m.snaps){const row=rows.find(z=>z.key===x.key);x.hp=row.hp;x.worldEntryHpCap=row.hp;x.energy=0;}};
        update(a,r.ally);update(d,r.foe);effect(a,r.ally,e.at,'fight:'+a.id+':'+a.fights);effect(d,r.foe.filter(x=>d.heroIds.includes(x.key)),e.at,'defend:'+a.id+':'+a.fights);
        if(e.f.benefit)state.effects[state.effects.length-1].benefit=true;
        e.s.active=null;
        d.regenAt=BENEFIT.eligible(state,d)?e.at+30000:null;
        if(d.phase==='garrison'&&d.holdUntil<e.at)d.holdUntil=e.at;
        if(!d.heroIds.length){e.s.lines=e.s.lines.filter(id=>id!==d.id);d.phase='home';d.homeAt=e.at;}
        if(state.endedAt!=null||e.at>=state.endsAt){home(a,e.at,'event-ended');if(d.heroIds.length)home(d,e.at,'event-ended');}
        else if(r.won){if(e.s.lines.length)fight(e.s,a,e.at);else garrison(a,e.at);}else{home(a,e.at,'defeated');}
        nextAttack(e.s,e.at);
      }
    }state.through=to;
  }
  advance(now);
  for(const m of Object.values(state.marches))if(state.endedAt==null&&m.phase==='garrison'&&!hooks.guildValid(m.guildId,m.ownerId)&&!state.sites[m.siteId].active){
    home(m,now,'guild-changed');const s=state.sites[m.siteId];if(!s.lines.length)holder(s,null,now);nextAttack(s,now);
  }
  if(action==='start'){
    const siteId=payload.siteId;if(!SITE_IDS.includes(siteId))return {ok:false,error:'Unknown site'};
    const ids=payload.heroIds;if(!Array.isArray(ids)||ids.length<1||ids.length>5||new Set(ids).size!==ids.length||ids.some(x=>!safeId(x)))return {ok:false,error:'Pick one to five distinct heroes'};
    if(ids.some(k=>busy(state,actorId,k,now)||hooks.heroBusy(actorId,k,now)))return {ok:false,error:'Hero is away'};
    const snaps=hooks.squad(actorId,ids);if(!Array.isArray(snaps)||snaps.length!==ids.length||new Set(snaps.map(s=>s.key)).size!==ids.length||snaps.some(s=>!ids.includes(s.key)||!Number.isFinite(s.hp)||!Number.isFinite(s.maxHp)||s.maxHp<=0||s.hp<=0||s.hp>s.maxHp))return {ok:false,error:'Owned living squad required'};
    const trip=hooks.route(actorId,siteId,now);if(!trip||!ms(trip.travelMs)||trip.travelMs<1||!trip.route)return {ok:false,error:'Invalid route'};
    const mid=hooks.uid();if(!safeId(mid)||state.marches[mid])throw Error('Invalid march identity');
    state.marches[mid]={id:mid,siteId,ownerId:actorId,guildId,heroIds:ids.slice(),snaps:clone(snaps),sequence:++state.sequence,
      phase:'outbound',depart:now,arriveAt:now+trip.travelMs,homeAt:now+trip.travelMs*2+HOLD(siteId),holdUntil:null,travelMs:trip.travelMs,route:clone(trip.route)};
    return {ok:true,state,effects:state.effects,marchId:mid};
  }
  if(action==='retreat'){
    const m=state.marches[payload.marchId];if(!m||m.ownerId!==actorId)return {ok:false,error:'Own march required'};
    if(m.phase==='fighting'||Object.values(state.sites).some(s=>s.active?.defender===m.id))return {ok:false,error:'A fighting line cannot retreat'};
    if(m.phase!=='returning'&&m.phase!=='home'){home(m,now,'owner-retreat');const s=state.sites[m.siteId];if(!s.lines.length)holder(s,null,now);nextAttack(s,now);}
  }else if(action!=='resolve'&&action!=='tick')return {ok:false,error:'Unknown control action'};
  return {ok:true,state,effects:state.effects};
}
module.exports={initial,dispatch,publicState,busy,SITE_IDS};
