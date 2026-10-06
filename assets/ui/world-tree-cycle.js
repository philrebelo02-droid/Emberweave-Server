(function(root){
  'use strict';
  const DAY=86400000, EVENT=DAY, DECAY=13*DAY, CYCLE=14*DAY;
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
    if(now<initialDecay)return {phase:'waiting',phaseStartedAt:null,phaseEndsAt:firstEventAt,nextEventAt:firstEventAt,remainingMs:firstEventAt-now,lifeFraction:1/28,framePosition:0,eventDurationMs:EVENT,decayDurationMs:DECAY,cycleDurationMs:CYCLE};
    let n=Math.max(0,Math.floor((wall(now)-wall(firstEventAt))/CYCLE));
    while(n>0&&boundary(firstEventAt,n)>now)n--;
    while(boundary(firstEventAt,n+1)<=now)n++;
    const start=boundary(firstEventAt,n),next=boundary(firstEventAt,n+1);
    const evEnd=eventEnd(start), live=now>=start&&now<evEnd;
    const decayStart=now<firstEventAt?initialDecay:evEnd, eventStart=now<firstEventAt?firstEventAt:start, end=live?evEnd:(now<firstEventAt?firstEventAt:next);
    const progress=live?(now-start)/(evEnd-start):(now-decayStart)/(end-decayStart);
    // Phil 30 Sep: "the frames should make the time" - life moves at a steady rate (was an ease-in/out curve that
    // showed frame 4 with 2 d 9 h left instead of frame 6)
    const life=live?progress:1-progress;
    return {phase:live?'event':'decay',phaseStartedAt:live?eventStart:decayStart,
      phaseEndsAt:end,nextEventAt:now<firstEventAt?firstEventAt:next,
      remainingMs:Math.max(0,end-now),lifeFraction:1/28+life*27/28,
      framePosition:life*27,eventDurationMs:EVENT,decayDurationMs:DECAY,cycleDurationMs:CYCLE};
  }
  function format(ms){
    const seconds=Math.max(0,Math.ceil(ms/1000)),days=Math.floor(seconds/86400);
    const h=Math.floor(seconds%86400/3600),m=Math.floor(seconds%3600/60),s=seconds%60;
    const pad=n=>String(n).padStart(2,'0');
    return (days?days+'d ':'')+pad(h)+':'+pad(m)+':'+pad(s);
  }
  const api={phase,format,boundary,eventEnd,DAY,EVENT,DECAY,CYCLE};
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.EmberweaveWorldTreeCycle=api;
})(typeof globalThis==='object'?globalThis:this);
