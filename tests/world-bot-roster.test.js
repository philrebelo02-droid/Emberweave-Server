'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {test}=require('node:test');
const host=require('../server/sim-host.js').load(path.join(__dirname,'..','emberweave-heroes.html'));

const cell=100/220;
const center=n=>(n+0.5)*cell;
const square=bot=>`${Math.round(bot.x/cell-0.5)},${Math.round(bot.y/cell-0.5)}`;

test('server-derived bot roster uses authoritative inputs without leaking between players',()=>{
  const base={regionKey:'crystor',homeRegion:'crystor',playerXP:0,
    castleX:center(2),castleY:center(2),realCities:[]};
  const empty=host.botRoster(base);
  assert.equal(empty.length,99,'the viewer occupies one of the 100 regional city slots');
  assert.ok(empty.every(b=>b.bot&&b.region==='crystor'&&b.team.length===5));
  assert.equal(new Set(empty.map(square)).size,empty.length);
  assert.ok(!empty.some(b=>square(b)==='2,2'));

  const withCity=host.botRoster({...base,realCities:[{id:'neighbor',region:'crystor',x:center(1),y:center(1)}]});
  assert.equal(withCity.length,98,'a second real account replaces a second bot');
  assert.ok(!withCity.some(b=>square(b)==='1,1'));
  assert.ok(!withCity.some(b=>square(b)==='2,2'));
  const secondView=host.botRoster({...base,castleX:center(1),castleY:center(1),
    realCities:[{id:'first',region:'crystor',x:center(2),y:center(2)}]});
  const firstView=host.botRoster({...base,castleX:center(2),castleY:center(2),
    realCities:[{id:'second',region:'crystor',x:center(1),y:center(1)}]});
  assert.deepEqual(secondView,firstView,'two residents see the same NPC city IDs, teams, and squares');
  const full=host.botRoster({...base,realCities:Array.from({length:99},(_,i)=>({
    id:'resident'+i,region:'crystor',x:center(i%9),y:center(Math.floor(i/9))
  }))});
  assert.equal(full.length,0,'a region with 100 real players has no filler bots');

  const higher=host.botRoster({...base,playerXP:900000});
  assert.ok(higher.some((b,i)=>b.team.some((h,j)=>h.level!==empty[i].team[j].level)));
  assert.deepEqual(host.botRoster(base),empty,"a different player's roster must not contaminate the next call");
});
