(function(root){
  'use strict';
  const DAY=86400000, HOUR=3600000, FIRST=Date.UTC(2026,9,10);
  const fmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  function parts(ms){const p={};for(const x of fmt.formatToParts(new Date(ms)))p[x.type]=x.value;return p;}
  function localDate(ms){const p=parts(ms);return Date.UTC(+p.year,+p.month-1,+p.day);}
  // Convert local calendar fields to an instant; all scheduled hours are unambiguous.
  function at(localDay,hour=0){
    const target=localDay+hour*HOUR;let guess=target;
    for(let i=0;i<4;i++){
      const p=parts(guess), represented=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
      const delta=target-represented;if(!delta)return guess;guess+=delta;
    }
    throw new Error('Cannot resolve Guild War server time');
  }
  function anchor(now){
    if(!Number.isSafeInteger(now))throw new Error('Invalid war time');
    let date=FIRST+Math.floor((localDate(now)-FIRST)/(14*DAY))*14*DAY;
    if(now<at(date,2))date-=14*DAY;
    return at(date);
  }
  function key(now){return new Date(localDate(anchor(now))).toISOString().slice(0,10);}
  function schedule(base){
    const d=localDate(base);
    return {registrationOpensAt:at(d,2),registrationLocksAt:at(d+2*DAY),
      rounds:['R16','QF','SF','F'].map((name,i)=>({name,planningOpensAt:at(d+(3+i)*DAY,2),
        lockAt:at(d+(3+i)*DAY,18),endsAt:at(d+(3+i)*DAY,20),resultsUntil:at(d+(4+i)*DAY,2)}))};
  }
  function nextRegistration(now){return at(localDate(anchor(now))+14*DAY,2);}
  function dayType(dateKey){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateKey))return null;
    const d=Date.parse(dateKey+'T00:00:00Z');
    if(!Number.isFinite(d)||new Date(d).toISOString().slice(0,10)!==dateKey)return null;
    const n=((d-FIRST)/DAY%14+14)%14;
    return n<2?'registration':n>=3&&n<=6?'war':null;
  }
  const api={anchor,key,schedule,nextRegistration,dayType,timeZone:'America/New_York',cycleDays:14};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.EmberweaveGuildWarCalendar=api;
})(typeof globalThis==='object'?globalThis:this);
