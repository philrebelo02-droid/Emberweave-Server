'use strict';
const GRID_COLS=220,CELL=100/GRID_COLS;
const OASIS_LAYOUT=require('./world-oasis-layout.json');
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
  // One movable cell-origin row per oasis; placement does not enable the event.
  const sites=DEFINITIONS.map(d=>{
    if(d.kind==='tree'){const centre={x:50,y:50};return {...d,centre,bounds:bounds(centre,d.widthCells,d.heightCells)};}
    const rows=OASIS_LAYOUT.filter(row=>row.direction===d.direction);
    if(rows.length!==1)throw Error('Invalid oasis layout');
    const row=rows[0];
    if(!Number.isInteger(row.x)||!Number.isInteger(row.y)||row.x<0||row.y<0||row.x>GRID_COLS-2||row.y>GRID_COLS-2)throw Error('Invalid oasis origin');
    const centre={x:(row.x+1)*CELL,y:(row.y+1)*CELL};
    return {...d,cellOrigin:{x:row.x,y:row.y},centre,bounds:bounds(centre,d.widthCells,d.heightCells)};
  });
  return {schemaVersion:1,enabled:false,layoutConfirmed:false,layoutPlaced:true,coordinateSpace:'world-percent',gridColumns:GRID_COLS,
    serverNow:calendar.serverNow,calendarConfigured:calendar.configured,eventWindow,
    requestedOasisDistanceTiles:6,distanceReference:'first-tree-teleportable-square',distanceReadings:{...DISTANCE_READINGS},sites};
}
module.exports={snapshot,DISTANCE_READINGS};
