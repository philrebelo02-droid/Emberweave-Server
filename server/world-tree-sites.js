'use strict';
const GRID_COLS=220,CELL=100/GRID_COLS;
const DISTANCE_READINGS=Object.freeze({FIRST_TELEPORTABLE_TO_OASIS_CENTRE_TILES:6,FIRST_TELEPORTABLE_TO_OASIS_NEAR_EDGE_TILES:6,OASIS_HALF_EXTENT_TILES:1});
const DEFINITIONS=Object.freeze([
  {id:'tree',kind:'tree',direction:null,widthCells:4,heightCells:4},
  ...['north','south','east','west'].map(direction=>({id:'oasis-'+direction,kind:'oasis',direction,widthCells:2,heightCells:2}))
]);
function bounds(centre,width,height){return {left:centre.x-width*CELL/2,top:centre.y-height*CELL/2,right:centre.x+width*CELL/2,bottom:centre.y+height*CELL/2};}
function snapshot(calendar){
  if(!calendar||typeof calendar.configured!=='boolean'||!Number.isSafeInteger(calendar.serverNow)||calendar.serverNow<0)throw Error('Invalid calendar snapshot');
  let eventWindow=null;
  if(calendar.configured){
    if(!['waiting','decay','event'].includes(calendar.phase)||!Number.isSafeInteger(calendar.nextEventAt)||!Number.isSafeInteger(calendar.phaseEndsAt)||calendar.eventDurationMs!==86400000)throw Error('Invalid event window');
    const start=calendar.phase==='event'?calendar.phaseStartedAt:calendar.nextEventAt;
    if(!Number.isSafeInteger(start)||start<0)throw Error('Invalid event start');
    eventWindow={startsAt:start,endsAt:start+calendar.eventDurationMs,active:calendar.phase==='event'};
  }
  // Human six-tile instruction is settled; its edge-to-centre interpretation is not.
  // No invented oasis positions may escape this disabled contract draft.
  const sites=DEFINITIONS.map(d=>{const centre=d.kind==='tree'?{x:50,y:50}:null;
    return {...d,centre,bounds:centre?bounds(centre,d.widthCells,d.heightCells):null};});
  return {schemaVersion:1,enabled:false,layoutConfirmed:false,coordinateSpace:'world-percent',gridColumns:GRID_COLS,
    serverNow:calendar.serverNow,calendarConfigured:calendar.configured,eventWindow,
    requestedOasisDistanceTiles:6,distanceReference:'first-tree-teleportable-square',distanceReadings:{...DISTANCE_READINGS},sites};
}
module.exports={snapshot,DISTANCE_READINGS};
