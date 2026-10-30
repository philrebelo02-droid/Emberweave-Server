(function(root){
  'use strict';
  const DAY=86400000, HOUR=3600000, EVENT=DAY, DECAY=13*DAY, CYCLE=14*DAY, EVENT_STEPS=24, DECAY_STEPS=13;
  const clock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  function wall(ms){const p={};for(const v of clock.formatToParts(ms))if(v.type!=='literal')p[v.type]=Number(v.value);return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)+ms%1000;}
  function fromWall(serial){let utc=serial;for(let i=0;i<4;i++)utc+=serial-wall(utc);return utc;}
  function boundary(first,n){return fromWall(wall(first)+n*CYCLE);}
  // v1042 (Phil 6 Oct 2026: "world tree is Saturday 0800- sunday 0800"): the event ends at the same New York wall time a day later - on the
  // night the clocks change (31 Oct -> 1 Nov) that is 25 h, never 07:00 Sunday
  function eventEnd(start){return fromWall(wall(start)+EVENT);}
  function phase(firstEventAt,now){
    if(!Number.isSafeInteger(firstEventAt)||firstEventAt<DECAY||!Number.isSafeInteger(now)||now<0) throw new Error('Invalid World Tree schedule');
    const initialDecay=firstEventAt-DECAY;
    if(now<initialDecay)return {phase:'waiting',phaseStartedAt:null,phaseEndsAt:firstEventAt,nextEventAt:firstEventAt,remainingMs:firstEventAt-now,lifeFraction:1/28,framePosition:0,frame:1,step:0,stepCount:1,nextStepAt:firstEventAt,stepRemainingMs:firstEventAt-now,eventDurationMs:EVENT,decayDurationMs:DECAY,cycleDurationMs:CYCLE};
    let n=Math.max(0,Math.floor((wall(now)-wall(firstEventAt))/CYCLE));
    while(n>0&&boundary(firstEventAt,n)>now)n--;
    while(boundary(firstEventAt,n+1)<=now)n++;
    const start=boundary(firstEventAt,n),next=boundary(firstEventAt,n+1);
    const evEnd=eventEnd(start), live=now>=start&&now<evEnd;
    const decayStart=now<firstEventAt?initialDecay:evEnd, eventStart=now<firstEventAt?firstEventAt:start, end=live?evEnd:(now<firstEventAt?firstEventAt:next);
    // v1226 (Phil 30 Oct 2026: "Make sure the world tree is programmed to change per day, and per hour during world tree event"):
    // the tree STEPS. Decay = 13 day states, one per New York wall-clock day from the phase start (08:00); the event = 24 hour
    // states, one per New York wall-clock hour. Each state maps evenly onto the 28 tree frames (framePosition 0..27, frame
    // wt_<framePosition+1>): decay day d -> round((12-d)*27/12) (27 full ... 0), event hour h -> round(h*27/23) (0 ... 27).
    // Wall-clock steps keep the 25 h DST night right: the repeated 01:00 hour is one state, the next starts at 02:00 EST.
    const phaseStart=live?start:decayStart, steps=live?EVENT_STEPS:DECAY_STEPS, unit=live?HOUR:DAY;
    const step=Math.max(0,Math.min(steps-1,Math.floor((wall(now)-wall(phaseStart))/unit)));
    const fp=live?Math.round(step*27/(EVENT_STEPS-1)):Math.round((DECAY_STEPS-1-step)*27/(DECAY_STEPS-1));
    const nextStepAt=step>=steps-1?end:Math.min(end,fromWall(wall(phaseStart)+(step+1)*unit));
    return {phase:live?'event':'decay',phaseStartedAt:live?eventStart:decayStart,
      phaseEndsAt:end,nextEventAt:now<firstEventAt?firstEventAt:next,
      remainingMs:Math.max(0,end-now),lifeFraction:(fp+1)/28,
      framePosition:fp,frame:fp+1,step,stepCount:steps,nextStepAt,stepRemainingMs:Math.max(0,nextStepAt-now),
      eventDurationMs:EVENT,decayDurationMs:DECAY,cycleDurationMs:CYCLE};
  }
  // the frame (1..28) for a phase snapshot; the one rule client and server share
  function frameOf(p){ return p&&Number.isInteger(p.framePosition)?p.framePosition+1:null; }
  function format(ms){
    const seconds=Math.max(0,Math.ceil(ms/1000)),days=Math.floor(seconds/86400);
    const h=Math.floor(seconds%86400/3600),m=Math.floor(seconds%3600/60),s=seconds%60;
    const pad=n=>String(n).padStart(2,'0');
    return (days?days+'d ':'')+pad(h)+':'+pad(m)+':'+pad(s);
  }
  const api={phase,format,boundary,eventEnd,frameOf,wall,fromWall,DAY,HOUR,EVENT,DECAY,CYCLE,EVENT_STEPS,DECAY_STEPS};
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.EmberweaveWorldTreeCycle=api;
})(typeof globalThis==='object'?globalThis:this);
