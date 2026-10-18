'use strict';
// Approved art only: source receipts, phone sheet geometry, unchanged mechanics,
// seeded full-fight controls and a deliberately broken timing counterexample.
module.exports=function(hero){
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),html=path.join(root,'emberweave-heroes.html');
const base=path.join(root,'.art-18oct-base-'+process.pid+'.html');
fs.writeFileSync(base,cp.execFileSync('git',['show','8dc5fe8d:emberweave-heroes.html'],{cwd:root,maxBuffer:64<<20}));
const load=f=>{const h=require(path.join(root,'server/sim-host.js')).load(f);return s=>vm.runInContext(s,h.ctx);};
const now=load(html),old=load(base);let pass=0,fail=0;
const ck=(s,ok,d)=>{console.log((ok?'ok ':'FAIL ')+hero+': '+s+(ok?'':' '+(d||'')));ok?pass++:fail++;};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/'+hero+'_art_18oct.json'),'utf8'));
const size=b=>{const t=b.toString('ascii',12,16);if(t==='VP8X')return[1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)];if(t==='VP8L'){const x=b.readUInt32LE(21);return[1+(x&16383),1+((x>>14)&16383)];}return[b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383];};
const fight=(r,seed,crit0)=>hash(r(`(()=>{window._p2guard=true;const save=autoUlt;autoUlt=true;try{ended=false;state='battle';CUR={mode:'replay',seed:${seed}};battleTime=0;gameSpeed=1;groundHazards.length=0;seedBattle(${seed});units=[];
 ['${hero}','vael','vireo'].forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
 ['${hero}','grosk','tick'].forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
 units.forEach(u=>{buildFigure(u);${crit0?`if(u.key==='${hero}')u.glyphCrit=0;`:''}});
 const trace=[];for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){updateBattle(SIM_STEP);trace.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10)].join(':')).join('|'));}
 return trace.length+'@'+trace.join('#');}finally{autoUlt=save;window._p2guard=false;}})()`));
try{
 const keys=fixture.map(x=>x.state),anim=now(`JSON.parse(JSON.stringify(BATTLE_ANIM.${hero}))`);
 ck('all approved remake states exist',keys.length===(hero==='iver'?8:9)&&keys.every(k=>anim[k]));
 for(const row of fixture){const a=anim[row.state],file=path.join(root,a.u.split('?')[0]);const bytes=fs.readFileSync(file),wh=size(bytes);
  ck(row.state+' fresh file, grid, alpha budget and receipt',/18oct26\.webp\?v=18oct26$/.test(a.u)&&wh[0]===a.fw*a.cols&&wh[1]===a.fh*a.rows&&Math.max(...wh)<=2048&&bytes.length<=4e6&&hash(bytes)===row.sha256&&a.n<=a.cols*a.rows&&a.figH>=159&&a.feet>0&&a.feet<=a.fh&&a.top<a.feet);
  ck(row.state+' source has Phil PASS hash',!!row.sourceCreationId&&/^[a-f0-9]{64}$/.test(row.sourceSha256)&&(!fs.existsSync(row.source)||hash(fs.readFileSync(row.source))===row.sourceSha256));
  ck(row.state+' per-cell source map is monotonic',row.sourceFrames.length===a.n&&row.sourceFrames.every((x,i)=>i===0||x>=row.sourceFrames[i-1]));
 }
 ck('action duration and release timing data preserved',['attack','crit','green','blue','ult'].every(st=>Math.abs(now(`clipDur(BATTLE_ANIM.${hero}.${st})`)-2)<1e-8&&anim[st].relFrac==null));
 if(hero==='joss')ck('shield wave is triggered only, never an idle filler',anim.passive.event===true&&now(`String(updateBattle).includes('if(u.anim&&u.anim.passive) firePassiveClip(u,clipDur(u.anim.passive)); else firePassiveFx(u);')`));
 ck('kit, hero stats and ult mechanics unchanged (ownFx is display routing)',now(`JSON.stringify([HERO_TYPES.${hero},KITS.${hero},HERO_ULT_ART.${hero}],(k,v)=>k==='ownFx'?undefined:v)`)===old(`JSON.stringify([HERO_TYPES.${hero},KITS.${hero},HERO_ULT_ART.${hero}],(k,v)=>k==='ownFx'?undefined:v)`));
 if(hero!=='ambrel')ck('existing streamed death unchanged',now(`JSON.stringify(Object.keys(BATTLE_ANIM.${hero}).filter(s=>/^death/.test(s)).map(s=>BATTLE_ANIM.${hero}[s]))`)===old(`JSON.stringify(Object.keys(BATTLE_ANIM.${hero}).filter(s=>/^death/.test(s)).map(s=>BATTLE_ANIM.${hero}[s]))`));
 ck('seeded full fights with crit zero tick-identical',[11,222,5,77].every(seed=>fight(now,seed,true)===fight(old,seed,true)));
 // v532: supplying a first crit clip moves the existing roll to wind-up. As in
 // test_aureth_anim_eleven, control with the OLD attack geometry/timing as crit.
 old(`BATTLE_ANIM.${hero}.crit=Object.assign({},BATTLE_ANIM.${hero}.attack);1`);
 ck('real-crit fights identical to old art with existing crit-clip rule',[11,222,5,77].every(seed=>fight(now,seed,false)===fight(old,seed,false)));
 const broken=now(`JSON.stringify(BATTLE_ANIM.${hero}.attack)`);
 now(`BATTLE_ANIM.${hero}.attack=Object.assign({},BATTLE_ANIM.${hero}.attack,{relFrac:0.8});1`);
 ck('CONTROL: moved strike timing is detected',fight(now,11,true)!==fight(old,11,true));
 now(`BATTLE_ANIM.${hero}.attack=${broken};1`);
 ck('CONTROL: different seed produces a different trace',fight(now,11,false)!==fight(now,222,false));
}finally{fs.unlinkSync(base);}
console.log((fail?'FAIL ':'PASS ')+hero+' '+pass+' checks, '+fail+' failed');return fail;
};
