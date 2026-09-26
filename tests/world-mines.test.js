'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const mines=require('../server/world-mines.js');

const source=fs.readFileSync(path.join(__dirname,'..','emberweave-heroes.html'),'utf8');
const start=source.indexOf('function mineRand(seed)');
const end=source.indexOf('// tiny resource icon:',start);
assert.ok(start>0&&end>start,'client mine-field implementation found');
const zone=Object.fromEntries([
  ['crystor','region',0,0],['wildN','wild',1,0],['draymon','region',2,0],
  ['wildW','wild',0,1],['worldtree','worldtree',1,1],['wildE','wild',2,1],
  ['tefron','region',0,2],['wildS','wild',1,2],['alumron','region',2,2]
].map(([key,type,col,row])=>[key,{type,col,row}]));
const ctx={ZONES:zone,RES:mines.RESOURCES.map(k=>[k]),GRID_COLS:220,GRID_CELL:100/220,ZONE_EDGES:[0,90,130,220],
  MINE_COUNT:mines.COUNT,mineEpoch:()=>30_000,zoneOfPos:(x,y)=>Object.keys(zone).find(k=>
    zone[k].col===(x*2.2<90?0:x*2.2<130?1:2)&&zone[k].row===(y*2.2<90?0:y*2.2<130?1:2))};
vm.createContext(ctx);
vm.runInContext(source.slice(start,end)+'\nthis.result=worldMines();',ctx);
assert.equal(ctx.result.length,mines.COUNT);
assert.deepEqual(JSON.parse(JSON.stringify(ctx.result)),mines.field(30_000),'server field matches client node-for-node');
assert.equal(mines.nodeById('mn30000_0',30_000*mines.EPOCH_MS).id,'mn30000_0');
assert.equal(mines.nodeById('mn29999_0',30_000*mines.EPOCH_MS),null,'stale epoch cannot be claimed');
console.log('World mine field parity passed');
