'use strict';
// v1227: the grid is world-realm.js META.cols x rows (1000 x 596); the tree and the oases keep their world size (the tree core = 4x4
// squares of the 220 grid, an oasis 2x2 of them), so their cell counts come from the realm build (META.tree.coreCells, META.oasisCells)
const REALM=require('../world-realm.js'),GEO=REALM.GEO;
const GRID_COLS=GEO.COLS,GRID_ROWS=GEO.ROWS,CELL=GEO.CELL,CORE=REALM.META.tree.coreCells,OAS=REALM.META.oasisCells,SQ=REALM.META.oldSquareCells;
const OASIS_LAYOUT=require('./world-oasis-layout.json');
// distances measured on the 220 grid (6, 6 and 1 squares), in this grid's squares
const DISTANCE_READINGS=Object.freeze({FIRST_TELEPORTABLE_TO_OASIS_CENTRE_TILES:Math.round(6*SQ),FIRST_TELEPORTABLE_TO_OASIS_NEAR_EDGE_TILES:Math.round(6*SQ),OASIS_HALF_EXTENT_TILES:OAS/2});
const DEFINITIONS=Object.freeze([
  {id:'tree',kind:'tree',direction:null,widthCells:CORE,heightCells:CORE},
  ...['north','south','east','west'].map(direction=>({id:'oasis-'+direction,kind:'oasis',direction,widthCells:OAS,heightCells:OAS}))
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
    if(!Number.isInteger(row.x)||!Number.isInteger(row.y)||row.x<0||row.y<0||row.x>GRID_COLS-OAS||row.y>GRID_ROWS-OAS)throw Error('Invalid oasis origin');
    const centre={x:(row.x+OAS/2)*CELL,y:GEO.Y0+(row.y+OAS/2)*CELL};
    return {...d,cellOrigin:{x:row.x,y:row.y},centre,bounds:bounds(centre,d.widthCells,d.heightCells)};
  });
  return {schemaVersion:1,enabled:false,layoutConfirmed:false,layoutPlaced:true,coordinateSpace:'world-percent',gridColumns:GRID_COLS,gridRows:GRID_ROWS,gridTop:GEO.Y0,
    serverNow:calendar.serverNow,calendarConfigured:calendar.configured,eventWindow,
    requestedOasisDistanceTiles:DISTANCE_READINGS.FIRST_TELEPORTABLE_TO_OASIS_CENTRE_TILES,distanceReference:'first-tree-teleportable-square',distanceReadings:{...DISTANCE_READINGS},sites};
}
module.exports={snapshot,DISTANCE_READINGS};
