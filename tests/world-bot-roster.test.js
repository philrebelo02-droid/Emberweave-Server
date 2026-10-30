'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {test}=require('node:test');
const host=require('../server/sim-host.js').load(path.join(__dirname,'..','emberweave-heroes.html'));

const R=require('../world-realm.js'),GEO=R.GEO,M=require('../server/world-mines.js');
const cell=100/220;
const center=n=>(n+0.5)*cell;   // a stored (220-grid era) position
const square=p=>GEO.col(p.x)+','+GEO.row(p.y);   // v1229: the realm grid's square

test('server-derived bot roster uses authoritative inputs without leaking between players',()=>{
  const base={regionKey:'crystor',homeRegion:'crystor',playerXP:0,
    castleX:center(2),castleY:center(2),realCities:[]};
  const empty=host.botRoster(base);
  assert.equal(empty.length,99,'the viewer occupies one of the 100 regional city slots');
  assert.ok(empty.every(b=>b.bot&&b.region==='crystor'&&b.team.length===5));
  assert.equal(new Set(empty.map(square)).size,empty.length);
  const at=(n)=>square({x:center(n),y:center(n)});
  assert.ok(!empty.some(b=>square(b)===at(2)));

  const withCity=host.botRoster({...base,realCities:[{id:'neighbor',region:'crystor',x:center(1),y:center(1)}]});
  assert.equal(withCity.length,98,'a second real account replaces a second bot');
  assert.ok(!withCity.some(b=>square(b)===at(1)));
  assert.ok(!withCity.some(b=>square(b)===at(2)));
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
// v1229 (Phil 30 Oct 2026: a bot castle "in the sea" by the Alumron coast; bots also stood on mines): every bot of every region stands on
// an open square of its own region (isOpen: land, no city, no oasis), off the tree core, off the coast line, off every mine's cells
test('bots never stand on sea, a city, an oasis, the coast line, a mine or another castle',()=>{
  for(let e=M.epochAt(Date.now());e<M.epochAt(Date.now())+3;e++){
    const mineKeys=M.field(e).flatMap(n=>GEO.mineKeys(n.x,n.y)),mines=new Set(mineKeys);
    for(const rk of ['crystor','draymon','tefron','alumron']){
      const c=R.zoneCells(rk)[R.zoneCells(rk).length>>1],held=new Set();
      const bots=host.botRoster({regionKey:rk,homeRegion:rk,playerXP:0,castleX:GEO.cornerX(c[0]),castleY:GEO.cornerY(c[1]),realCities:[],mineKeys});
      assert.ok(bots.length>=90,rk+' bots '+bots.length);
      for(const b of bots){const x=GEO.col(b.x),y=GEO.row(b.y),k=x+','+y;
        assert.ok(R.isOpen(x,y)&&R.landZone(x,y)===rk,b.id+' on its own open land');assert.ok(!GEO.coreCell(x,y));assert.ok(!mines.has(k),b.id+' on a mine');
        assert.ok(R.isLand(x+1,y)&&R.isLand(x-1,y)&&R.isLand(x,y+1)&&R.isLand(x,y-1),b.id+' on the coast line');
        assert.ok(!held.has(k),'two bots on '+k);held.add(k);}
    }
  }
});
