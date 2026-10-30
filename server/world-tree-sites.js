'use strict';
// v1227: the grid is world-realm.js META.cols x rows (1000 x 596); the tree core keeps its world size (4x4 squares of the 220 grid).
// v1228 (Phil 30 Oct 2026: "There of 2 of each oasis" / "The drawn one should be garrisonable like the cities"): the oases ARE the 4 ponds
// Grok painted on the island (nw / ne / sw / se of the tree), measured from the art by the realm build (world-oasis-layout.json: each
// pond's box, centre and cells). They are garrison sites like the cities (kind 'oasis', garrison true; the garrison mechanics come later).
const REALM=require('../world-realm.js'),GEO=REALM.GEO;
const GRID_COLS=GEO.COLS,GRID_ROWS=GEO.ROWS,CELL=GEO.CELL,CORE=REALM.META.tree.coreCells,SQ=REALM.META.oldSquareCells;
const OASIS_LAYOUT=require('./world-oasis-layout.json');
const OASIS_KEYS=Object.freeze(['nw','ne','sw','se']);
// distances measured on the 220 grid (6 and 6 squares), in this grid's squares; the half extent is the largest pond's
const DISTANCE_READINGS=Object.freeze({FIRST_TELEPORTABLE_TO_OASIS_CENTRE_TILES:Math.round(6*SQ),FIRST_TELEPORTABLE_TO_OASIS_NEAR_EDGE_TILES:Math.round(6*SQ),
  OASIS_HALF_EXTENT_TILES:Math.ceil(Math.max(...OASIS_LAYOUT.map(o=>Math.max(o.w||0,o.h||0)))/2)});
const DEFINITIONS=Object.freeze([
  {id:'tree',kind:'tree',direction:null,widthCells:CORE,heightCells:CORE},
  ...OASIS_KEYS.map(direction=>({id:'oasis-'+direction,kind:'oasis',direction,garrison:true}))
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
    if(d.kind==='tree'){const T=REALM.META.tree,centre={x:T.cx*CELL,y:GEO.Y0+T.cy*CELL};return {...d,centre,bounds:bounds(centre,d.widthCells,d.heightCells)};}   // v1228: the tree stands between the four ponds (META.tree), not on the world centre
    const rows=OASIS_LAYOUT.filter(row=>row.direction===d.direction&&row.id===d.id);
    if(rows.length!==1)throw Error('Invalid oasis layout');
    const row=rows[0];
    if(![row.x,row.y,row.w,row.h].every(Number.isInteger)||row.x<0||row.y<0||row.w<1||row.h<1||row.x+row.w>GRID_COLS||row.y+row.h>GRID_ROWS)throw Error('Invalid oasis box');
    if(!Array.isArray(row.cells)||!row.cells.length)throw Error('Invalid oasis cells');
    const centre={x:row.cx*CELL,y:GEO.Y0+row.cy*CELL};   // the pond's own centre (its pixel centroid, in cell units)
    const box={left:row.x*CELL,top:GEO.Y0+row.y*CELL,right:(row.x+row.w)*CELL,bottom:GEO.Y0+(row.y+row.h)*CELL};
    return {...d,name:row.name,widthCells:row.w,heightCells:row.h,cellOrigin:{x:row.x,y:row.y},cellCount:row.cells.length,centre,bounds:box};
  });
  return {schemaVersion:1,enabled:false,layoutConfirmed:false,layoutPlaced:true,coordinateSpace:'world-percent',gridColumns:GRID_COLS,gridRows:GRID_ROWS,gridTop:GEO.Y0,
    serverNow:calendar.serverNow,calendarConfigured:calendar.configured,eventWindow,
    requestedOasisDistanceTiles:DISTANCE_READINGS.FIRST_TELEPORTABLE_TO_OASIS_CENTRE_TILES,distanceReference:'first-tree-teleportable-square',distanceReadings:{...DISTANCE_READINGS},sites};
}
module.exports={snapshot,DISTANCE_READINGS};
