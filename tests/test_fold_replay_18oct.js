'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),temp=path.join(root,'.fold-replay-baseline-'+process.pid+'.html');
const load=f=>{const h=require('../server/sim-host.js').load(f);return s=>vm.runInContext(s,h.ctx)},now=load(path.join(root,'emberweave-heroes.html'));
require('./helpers/grosk-fritz-fx-1217.js').undoGroskFritzFx1217(now);   // v1217 Grosk / Fritz / Hobb FX display tags (a later, display-only release) go back to v1216's; test_grosk_fritz_fx_1217 checks them
const BASE='d0e944c0a87cfa335c46b2efa47cb97dd771cc9a'; // v1206 before this layout-only integration; remote main can advance during cluster QA.
fs.writeFileSync(temp,cp.execFileSync('git',['show',BASE+':emberweave-heroes.html'],{cwd:root,maxBuffer:64<<20}));
try{const old=load(temp),digest=s=>crypto.createHash('sha256').update(s).digest('hex');
 assert.equal(now('JSON.stringify([HERO_TYPES,KITS,ULT_DEF,BATTLE_ANIM])'),old('JSON.stringify([HERO_TYPES,KITS,ULT_DEF,BATTLE_ANIM])'),'layout must not change combat or animation data');
 console.log('ok gameplay and animation tables unchanged');
 const fight=(run,seed)=>digest(run(`(()=>{window._p2guard=true;autoUlt=true;ended=false;state='battle';CUR={mode:'replay',seed:${seed}};battleTime=0;gameSpeed=1;groundHazards=[];seedBattle(${seed});units=[];['vael','fritz','hobb','sylthaine','vireo'].forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*20,600+i*40,30,{owned:false,rank:3})));['grosk','tick','joss','iver','ambrel'].forEach((k,i)=>units.push(makeUnit(k,'enemy',800+i*20,600+i*40,30,{owned:false,rank:3})));units.forEach(u=>buildFigure(u));const trace=[];for(let i=0;i<Math.round(35/SIM_STEP)&&!ended;i++){updateBattle(SIM_STEP);trace.push(units.map(u=>[u.key,u.hp,u.x,u.y,u.alive,u.energy,u.stunned].join(':')).join('|'));}window._p2guard=false;return trace.join('#');})()`));
 for(const seed of [17,222,777]){assert.equal(fight(now,seed),fight(old,seed),'server replay changed at seed '+seed);console.log('ok full fight remains tick-identical seed '+seed)}
 console.log('PASS 4 checks');
}finally{fs.unlinkSync(temp)}
