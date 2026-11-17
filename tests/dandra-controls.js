'use strict';
/* The controls for Dandra's talent tests (run on PC 2 through tools/remote_test.sh as a plain node script). Each control copies this checkout to a temp
   folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made
   unguarded with a seeded draw, a primitive or a row of hers broken), runs the named tests of tests/talents-mech-dandra.test.js in that copy, and expects
   them to FAIL. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught.
   J (environment) = how many run at once (default 3: PC 2 is shared). */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
  // ---- the page sites: hook removed / guard widened back (her tests fail) ----
  ['skillTgt line at a delivered skill\'s launch removed',HTML,"  if(u._tal&&u._tal.on.skillTgt&&tU) tU=TalentFx.skillTgt(u,type,tU,o)||tU;   /* TALENT HOOK skillTgt: a learned talent may choose a delivered skill's target before it is launched (Warden's Prison, Dandra's Drowsy Lantern) */\n",'','Drowsy Lantern'],
  ['dot tick guard without _talDw',HTML,"||d._talK||u._talDw)?TalentFx.dotPre(u,d)","||d._talK)?TalentFx.dotPre(u,d)",'Lamplight:'],
  ['wake line guard removed (her hits wake again)',HTML,"if(tgt&&(tgt._sleepT||0)>0&&!(src&&src._tal&&tgt._talZz===src&&battleTime<tgt._talZzT)){","if(tgt&&(tgt._sleepT||0)>0){",'sleep:'],
  // ---- an unguarded seeded draw at each new / widened site (the no-talent identity test fails) ----
  ['draw at the skillTgt launch line',HTML,"  if(u._tal&&u._tal.on.skillTgt&&tU) tU=TalentFx.skillTgt(","  brnd(); if(u._tal&&u._tal.on.skillTgt&&tU) tU=TalentFx.skillTgt(",'no talents'],
  ['draw at the dot tick guard',HTML,"||d._talK||u._talDw)?TalentFx.dotPre(u,d)","||d._talK||(brnd(),u._talDw))?TalentFx.dotPre(u,d)",'no talents'],
  ['draw at the wake line',HTML,"if(tgt&&(tgt._sleepT||0)>0&&!(src&&src._tal&&","if(tgt&&(tgt._sleepT||0)>0&&!(brnd(),src&&src._tal&&",'no talents'],
  // ---- the new runtime pieces ----
  ['hotPre: no part tick',FXJ,"    if(h._talF!=null&&h.remaining<=1) ctx.amt*=h._talF;",'','heal over time'],
  ['hotPre: the heal over time not in the event',FXJ,"hot:true,h}; run(T,o,'healOut',ctx);","hot:true}; run(T,o,'healOut',ctx);",'Seedlight:'],
  ['teamDotIn rows never run',FXJ,"if(w===u||!w.alive||!Tw||!Tw.on.teamDotIn) continue;","continue;",'Lamplight:'],
  ['_talDw never set',FXJ,"if(dw) x._talDw=1; } }","} }",'Lamplight:'],
  // ---- her rows ----
  ['Fold a Petal 1.5% -> 1.6%',FXJ,"const size=x.maxHp*0.015*Math.max(1,r.pb_1_1||0)","const size=x.maxHp*0.016*Math.max(1,r.pb_1_1||0)",'Petals:'],
  ['Petals stack on one ally',FXJ,"x.shield=Math.max(x.shield||0,size); x.shieldT=Math.max(x.shieldT||0,d); (T.s.ps","x.shield=(x.shield||0)+size; x.shieldT=Math.max(x.shieldT||0,d); (T.s.ps",'Petals:'],
  ['Quick Regrowth 0.6 -> 0.5',FXJ,"pb_4_1:[ {param:'petal.re',add:R(-0.6)} ],","pb_4_1:[ {param:'petal.re',add:R(-0.5)} ],",'Petals:'],
  ['Still Standing at 5 Petals',FXJ,"if(Pp['dr.still']&&A.stGet(T,'petal')<=3)","if(Pp['dr.still']&&A.stGet(T,'petal')<=5)",'Petals:'],
  ['Last One Open 6 s',FXJ,"{fn:'lastOpen'},{window:'loo',dur:5}","{fn:'lastOpen'},{window:'loo',dur:6}",'Her Own Dress'],
  ['Her Own Dress costs 4%',FXJ,"u.hp=Math.max(1,u.hp-0.05*u.maxHp)","u.hp=Math.max(1,u.hp-0.04*u.maxHp)",'Her Own Dress'],
  ['Not a Close Call on a Petal that ran out of time',FXJ,"pb_9_1:[ {on:'petalEnd',if:{broke:true,","pb_9_1:[ {on:'petalEnd',if:{",'Her Own Dress'],
  ['Petal in the Light 30% -> 20%',FXJ,"*(k||1)*(lamp?1.3:1)","*(k||1)*(lamp?1.2:1)",'Petal in the Light'],
  ['Petal Ward 4% -> 5%',FXJ,"pb_10_1:[ {param:'ten.petal',add:R(0.04)} ],","pb_10_1:[ {param:'ten.petal',add:R(0.05)} ],",'Petal in the Light'],
  ['control cap on her 25% -> 30%',FXJ,"c.amt*=Math.max(0.75,k); },","c.amt*=Math.max(0.70,k); },",'Bright Eye'],
  ['One at a Time 25% -> 20%',FXJ,"if(main&&r.pb_5_2) k+=0.25;","if(main&&r.pb_5_2) k+=0.20;",'Seedlight:'],
  ['Everyone a Little 3 m -> 0 m',FXJ,"{team:'ally',of:'target',within:3,skip:'target'},{u,tgt:x})){ E.pushHot","{team:'ally',of:'target',within:0,skip:'target'},{u,tgt:x})){ E.pushHot",'heal over time'],
  ['Slower Dying not faster',FXJ,"if(h._talU===u&&h._talK==='seed') h.acc+=dt; }","if(h._talU===u&&h._talK==='seed') h.acc+=0; }",'heal over time'],
  ['Cold Morning at 31%',FXJ,"if(any(T,COLD)&&p>=0.30&&f<0.30)","if(any(T,COLD)&&p>=0.31&&f<0.31)",'Cold Morning'],
  ['Never Close Again 1% -> 1.1%',FXJ,"pb_12_1:[ {param:'dr.cold',add:R(0.01)} ],","pb_12_1:[ {param:'dr.cold',add:R(0.011)} ],",'Cold Morning'],
  ['Call of the Cold keeps the stacks',FXJ,"const n=cmN(A,T); A.stSet(T,u,'cm',0);","const n=cmN(A,T);",'Cold Morning'],
  ['Warmth reach 3 m -> 3.5 m',FXJ,"const R=3+(Pp['warm.m']||0)","const R=3.5+(Pp['warm.m']||0)",'Warmth:'],
  ['Warmth lost 4 s after leaving',FXJ,"A.ustPut(T,u,x,'warm',Math.min(5,n+1),3); } else if(n>0) x._talM[u.uid]['#warm'].until=now+3; }","A.ustPut(T,u,x,'warm',Math.min(5,n+1),4); } else if(n>0) x._talM[u.uid]['#warm'].until=now+4; }",'Warmth:'],
  ['regeneration cap 1.2% -> 1.5%',FXJ,"const REGEN=0.012;","const REGEN=0.015;",'regeneration cap'],
  ['Three Bees Alive twice a wave',FXJ,"pb_13_2:[ {on:'tba',once:'wave',","pb_13_2:[ {on:'tba',",'Three Bees Alive'],
  ['Three Bees Alive at single size',FXJ,"fold(A,T,u,x,2*n,c);","fold(A,T,u,x,n,c);",'Three Bees Alive'],
  ['Queen\'s Petals: no Petal back',FXJ,"A.acts(T,u,[{stack:'petal',set:'max'}],c); const k=s.k.petal;","const k=s.k.petal;",'Queen\'s Petals'],
  ['a Bee stings 7 times',FXJ,"const n=6+(T.r.tb_5_3?0.5:0);","const n=7+(T.r.tb_5_3?0.5:0);",'Bees:'],
  ['flight home 3 s -> 2 s',FXJ,"s.bh.push(now+Math.max(0,3+(Pp['bee.home']||0)))","s.bh.push(now+Math.max(0,2+(Pp['bee.home']||0)))",'Pollen'],
  ['Stay Close 15% -> 10%',FXJ,"tb_5_1:[ {param:'bee.close',add:0.15} ],","tb_5_1:[ {param:'bee.close',add:0.10} ],",'All Three'],
  ['Spread Out allows a second Bee',FXJ,"if(r.tb_5_3&&x&&(hasBee(T,x)||skip.indexOf(x)>=0))","if(r.tb_5_3&&x&&(skip.indexOf(x)>=0))",'All Three'],
  ['All Three with 2 home',FXJ,"const k=(r.tb_3_2&&home>=3)?3:","const k=(r.tb_3_2&&home>=2)?3:",'All Three'],
  ['Swollen 0.6% -> 0.7%',FXJ,"tb_2_3:[ {param:'sw.dmg',add:R(0.006)} ],","tb_2_3:[ {param:'sw.dmg',add:R(0.007)} ],",'Swollen'],
  ['Burst 40% -> 45%',FXJ,"A.hurt(T,u,x,ap*0.40*E.defMul(u,x,'magic'),COL,'burst');","A.hurt(T,u,x,ap*0.45*E.defMul(u,x,'magic'),COL,'burst');",'Swollen'],
  ['Burst reach 2 m -> 9 m',FXJ,"{team:'enemy',of:'target',within:2,skip:'target'},c)), ap=","{team:'enemy',of:'target',within:9,skip:'target'},c)), ap=",'Swollen'],
  ['Buzzing Ears without a Bee',FXJ,"let d=base*(1+((Pp['sleep.bee']&&hasBee(T,t))?","let d=base*(1+((Pp['sleep.bee'])?",'sleep:'],
  ['Sting of Mercy: poison stays 4 s',FXJ,"const st=((c.o&&c.o.stung)||6)-4; if(st>0)","const st=0; if(st>0)",'sleep:'],
  ['Drowsy Lantern +0.5 s',FXJ,"{param:'sleep.add',add:0.6} ],","{param:'sleep.add',add:0.5} ],",'Drowsy Lantern'],
  ['The Hive Remembers: 2 extra bees',FXJ,"if(A.winOn(T,'hive')) for(let i=0;i<3;i++) sendBee(A,T,u,t,'extra',c);","if(A.winOn(T,'hive')) for(let i=0;i<2;i++) sendBee(A,T,u,t,'extra',c);",'Hive Remembers'],
  ['The Hive Remembers: no sleep on a Burst',FXJ,"if(A.winOn(T,'hive')) for(const x of hit) if(x.alive) T.fn.tSleep(A,T,u,{u,tgt:x},{secs:1}); },","},",'Hive Remembers'],
  ['Royal Swarm 3% -> 4%',FXJ,"tb_12_3:[ {param:'bee.royal',add:R(0.03)} ],","tb_12_3:[ {param:'bee.royal',add:R(0.04)} ],",'Hive Remembers'],
  ['Moving On Faster: centre to centre',FXJ,"body(A,T,u,c){ c.body=true; },","body(A,T,u,c){ },",'Moving On Faster'],
  ['Moving On Faster: no extra enemy',FXJ,"if(!best) return; const dps=dead._plagueDps||0;","return; const dps=dead._plagueDps||0;",'Moving On Faster'],
  ['Lamplight at 41%',FXJ,"const th=0.40+(Pp['lamp.at']||0)","const th=0.41+(Pp['lamp.at']||0)",'Bright Lantern'],
  ['Lamplight held by HP number',FXJ,".sort((a,b)=>frac(a)-frac(b)).slice(0,n)",".sort((a,b)=>b.hp-a.hp).slice(0,n)",'Bright Lantern'],
  ['Do Not Close lets a stun land',FXJ,"if(Pp['no.close']&&f==='stunned'&&A.markOf(u,x,'lampR')){ x.stunned=0; x._sleepT=0; return; }","",'Do Not Close'],
  ['Little Hope only above 70%',FXJ,"if(Pp.hope&&frac(x)>0.40) E.healUnit","if(Pp.hope&&frac(x)>0.70) E.healUnit",'Lamplight:'],
  ['Seeds come back each wave',FXJ,"if(s.seeds==null) s.seeds=any(T,SEEDS)?5+","s.seeds=any(T,SEEDS)?5+",'Seeds'],
  ['Last Seed not doubled',FXJ,"(last?1+(Pp['seed.last']||0):1)","(1)",'Seeds'],
  ['Late Bloom split by 2',FXJ,"for(const x of tm) E.healUnit(x,b*k/tm.length);","for(const x of tm) E.healUnit(x,b*k/2);",'Late Bloom'],
  ['Gold Lantern 10% -> 12%',FXJ,"gl_12_2:[ {param:'bloom.lamp',add:R(0.10)} ],","gl_12_2:[ {param:'bloom.lamp',add:R(0.12)} ],",'Late Bloom'],
  ['The Dandelion Opens twice a fight',FXJ,"if(r.gl_13_3&&s.qcFull&&!s.dlOnce){","if(r.gl_13_3&&s.qcFull){",'Dandelion'],
  ['The Dandelion Opens: 4 s at 1 HP',FXJ,"{window:'dlamp',dur:8},{window:'dl1',dur:3}","{window:'dlamp',dur:8},{window:'dl1',dur:4}",'Dandelion'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-dnc-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(a,to.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n')));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-dandra.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||3), out=[]; let i=0;
  async function worker(){ while(i<C.length){ const c=C[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
