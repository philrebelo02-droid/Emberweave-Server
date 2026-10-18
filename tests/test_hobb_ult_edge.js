'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert');
const root=path.resolve(__dirname,'..'),file=path.join(root,'emberweave-heroes.html');
const load=f=>{const h=require('../server/sim-host.js').load(f);return s=>vm.runInContext(s,h.ctx)};
const run=load(file);let pass=0;const ck=(s,v)=>{assert(v,s);console.log('ok '+s);pass++};
const fixture=`(()=>{battleTime=1;groundHazards=[];window.__hits=[];const u={key:'hobb',team:'ally',x:-100,y:0,alive:true,_hobbUltAt:0};const near={id:'near',team:'enemy',x:-50,y:0,alive:true},far={id:'far',team:'enemy',x:90,y:0,alive:true};units=[u,near,far];dealDamage=(u,e,amount)=>window.__hits.push([e.id,amount]);ccApply=(u,e,key,time)=>e[key]=time;hobbPorcelainFront(u,{x:0,y:0},120,123,2);window.__near=near;window.__far=far;return groundHazards.map(h=>h.delay);})()`;
const delays=run(fixture);
ck('per-enemy front arrival schedules near before far',delays.length===2&&delays[0]<delays[1]);
ck('cast elapsed time and real-to-sim FX clock are applied once',Math.abs(delays[0]-run('hobbEdgeT(70/240)*FX_RT-1'))<1e-9);
ck('no early damage or stun at release',run('window.__hits.length===0&&!window.__near.stunned&&!window.__far.stunned'));
run('groundHazards[0].run()');ck('arrival keeps original damage and stun values',run("JSON.stringify(window.__hits)===JSON.stringify([['near',123]])&&window.__near.stunned===2"));
run(fixture);run('window.__near.alive=false;groundHazards[0].run()');ck('dead before arrival is not hit or stunned',run('window.__hits.length===0&&!window.__near.stunned'));
run(fixture);run('window.__near.x=121;groundHazards[0].run()');ck('enemy leaving the area before arrival is not hit or stunned',run('window.__hits.length===0&&!window.__near.stunned'));
const mirrored=run(`(()=>{groundHazards=[];const u={key:'hobb',team:'enemy',x:100,y:0,alive:true,_hobbUltAt:0};units=[u,{team:'ally',x:50,y:0,alive:true},{team:'ally',x:-90,y:0,alive:true}];hobbPorcelainFront(u,{x:0,y:0},120,123,2);return groundHazards.map(h=>h.delay);})()`);
ck('left facing mirrors timing without changing the area',JSON.stringify(delays)===JSON.stringify(mirrored));
ck('edge table is monotonic, measured burst to completed spread',run('HOBB_EDGE[0][0]===3.2&&HOBB_EDGE.at(-1)[1]===1&&HOBB_EDGE.every((v,i)=>!i||(v[0]>HOBB_EDGE[i-1][0]&&v[1]>=HOBB_EDGE[i-1][1]))'));
// Fresh contexts restore the actual engine after the isolated damage probes.
const now=load(file),again=load(file),tmp=path.join(root,'.hobb-edge-base-'+process.pid+'.html');
fs.writeFileSync(tmp,cp.execFileSync('git',['show','origin/main:emberweave-heroes.html'],{cwd:root,maxBuffer:64<<20}));
const old=load(tmp),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function fight(r,seed,team,foe,ult=true){return hash(r(`(()=>{window._p2guard=true;autoUlt=${ult};ended=false;state='battle';CUR={mode:'replay',seed:${seed}};battleTime=0;gameSpeed=1;groundHazards=[];seedBattle(${seed});units=[];${JSON.stringify(team)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*50,30,{owned:false,rank:3})));${JSON.stringify(foe)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',800+i*40,600+i*50,30,{owned:false,rank:3})));units.forEach(u=>buildFigure(u));const trace=[];for(let i=0;i<Math.round(35/SIM_STEP)&&!ended;i++){updateBattle(SIM_STEP);trace.push(units.map(u=>[u.key,u.hp,u.x,u.y,u.alive,u.energy,u.stunned].join(':')).join('|'));}window._p2guard=false;return trace.join('#');})()`))}
try{
 const heroes=now('Object.keys(HERO_TYPES).filter(k=>k!=="hobb")');
 for(let i=0;i<heroes.length;i+=10){const team=heroes.slice(i,i+5),foe=heroes.slice(i+5,i+10);if(!foe.length)foe.push('vael');ck('non-Hobb fights remain tick-identical: roster '+i,fight(now,100+i,team,foe)===fight(old,100+i,team,foe));}
 ck('Hobb ordinary attacks and skills remain tick-identical without his ult',fight(now,777,['hobb','vael'],['grosk','tick'],false)===fight(old,777,['hobb','vael'],['grosk','tick'],false));
 ck('Hobb ult full server replay is deterministic across independent hosts',fight(now,222,['hobb','vireo'],['grosk','tick'])===fight(again,222,['hobb','vireo'],['grosk','tick']));
 ck('CONTROL: Hobb ult timing actually changes the old fight',fight(now,222,['hobb','vireo'],['grosk','tick'])!==fight(old,222,['hobb','vireo'],['grosk','tick']));
}finally{fs.unlinkSync(tmp)}
console.log('PASS '+pass+' checks');
