const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('C:/Users/Home/Downloads/ew-fritz-art/emberweave-heroes.html','utf8');
const start=src.indexOf('const BADGE_RETIRE='),end=src.indexOf('// Traveling projectile:',start);
const branch=src.slice(start,end);
class V{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}clone(){return new V(this.x,this.y,this.z)}set(x,y,z){Object.assign(this,{x,y,z});return this}copy(p){return this.set(p.x,p.y,p.z)}add(p){this.x+=p.x;this.y+=p.y;this.z+=p.z;return this}}
function run(code){const unit={alive:true,_sprRef:{getWorldPosition(p){p.set(0,10,0)}}};const make=(life)=>({followAbove:unit,aboveOff:new V(0,1,0),life,t:0,d:{dur:1,n:4},m:{position:new V(),scale:new V(1,1,1),material:{dispose(){}}}});const old=make(4),recent=make(.05),fx=[old,recent];const ctx={_groundFx:fx,TH:{Vector3:V},scene:{remove(){}},fx2SetFrame(){},wx:x=>x,wz:x=>x};vm.createContext(ctx);vm.runInContext(code,ctx);vm.runInContext('updateGroundFx(.05)',ctx);const first={ret:old._ret,y:old.m.position.y,opacity:old.m.material.opacity};for(let i=0;i<10;i++)vm.runInContext('updateGroundFx(.05)',ctx);return {first,remaining:fx.length,oldRet:old._ret,oldLife:old.life,oldOpacity:old.m.material.opacity};}
const actual=run(branch),control=run(branch.replace('o._seq<(_bTop.get(o.followAbove)||0)','(o._ret!=null||o._seq<(_bTop.get(o.followAbove)||0))'));
assert.equal(actual.remaining,1);assert(actual.oldRet<.1);assert.equal(control.remaining,0);
const out={candidate:'97967b278325af01ea1fb4f83ec12c0789f9c304',scope:'Actual extracted renderer with stubbed geometry, newest badge expires early; not full battle test',actual,control};
fs.writeFileSync('work/badge-retirement-review.evidence.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
