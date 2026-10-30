'use strict';
// v1226 realm map: the server deals every mine field (the client's signed-out generator and the old 3x3 geometry are gone).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const mines=require('../server/world-mines.js');
const R=require('../world-realm.js');
const source=fs.readFileSync(path.join(__dirname,'..','emberweave-heroes.html'),'utf8');
assert.ok(/function worldMines\(\)\{ return \[\]; \}/.test(source),'the client keeps no field of its own');
for(let epoch=30_000;epoch<30_100;epoch++){
  const field=mines.field(epoch);
  assert.equal(field.length,mines.COUNT);
  assert.equal(new Set(field.map(n=>n.gx+','+n.gy)).size,mines.COUNT,'each mine occupies its own grid intersection');
  assert.ok(field.every(n=>R.isLand(n.gx,n.gy)),'every node on land');
  assert.deepEqual(mines.field(epoch),field,'a field is deterministic');
}
assert.equal(mines.nodeById('mn30000_0',30_000*mines.EPOCH_MS).id,'mn30000_0');
assert.equal(mines.nodeById('mn29999_0',30_000*mines.EPOCH_MS),null,'stale epoch cannot be claimed');
console.log('World mine field rules passed');
