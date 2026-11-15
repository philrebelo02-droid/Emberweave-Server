'use strict';
/* THE WAVE CLOCK (WIRING/41c). The page's fight clock battleTime starts again at 0 at every wave (beginWaveEnter: `battleTime=0`). A talent time kept as an
   ABSOLUTE fight time (an icd lock, a window's cooldown, an 'until', a 'last at' stamp) would be wrong in the next wave: a 20 s lock set at 40 s of a wave
   that ends at 55 s has 5 s left, but against the new clock it would block the first 60 s. The page now calls TalentFx.clock(u, t) right before the reset
   (one guarded line), and the engine moves every such time it keeps back by t; a hero file lists its own stamps in `times`.
   Part 1  each engine primitive that stores a time: a two-wave fight on the still field (the page's own resetPerWave and beginWaveEnter between the waves),
           the time left is the same in wave 2 (not stretched, not cut). Every case is run twice: as the page is, and with the page's clock line taken out of
           beginWaveEnter (the control: the old page) - the control must show the stretched time.
   Part 2  each hero file that kept its own absolute times: its real functions across a wave (control: the same file without its `times`).
   Part 3  whole fights: real 3-wave campaign fights keep every lock within its own length at every wave start (control: they do not); one-wave fights
           are identical with and without the clock line (nothing changes inside a wave); the longest wave clock measured.
   Run: node --test tests/talents-waveclock.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {NOW,FX,FXN,T,V,near,lab,stack,mark,everything,snaps,spec,root}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx);
/* in the battle VM: the wave change exactly as updateWaveXfer runs it (resetPerWave inside buildEnemyWave, then beginWaveEnter); the march is skipped
   (the clock does not run during it). noHook(true): beginWaveEnter without its TALENT HOOK clock line (the page before this fix) */
const W=VMX(`({
  next(){ const t=battleTime; resetPerWave(); beginWaveEnter(); waveXfer=null; return t; },
  noHook(on){ if(on){ if(this.o) return; const src=beginWaveEnter.toString(), s2=src.replace(/for\\(const _u of units\\)\\{ if\\(_u&&_u\\._tal\\) TalentFx\\.clock\\(_u,battleTime\\); \\}/,'');
      if(s2===src) throw new Error('the clock line is not in beginWaveEnter'); this.o=beginWaveEnter; beginWaveEnter=(0,eval)('('+s2+')'); }
    else if(this.o){ beginWaveEnter=this.o; this.o=null; } }
})`);
test.afterEach(()=>{ W.noHook(false); for(const h of ['vael'].concat(Object.keys(HERO))) FX.define(h,null);
  const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const A=()=>FX.api();
const to=t=>{ const n=Math.round((t-V.now())/V.STEP); if(n>0) V.step(n); return V.now(); };
const FPOS=[[4.5,0],[10,0],[15.5,0],[0,6],[5.5,6],[11,6],[0,12],[5.5,12],[11,12]], APOS=[[0,-5.5],[0,-11],[0,-16.5]];
/* beginWaveEnter frees the heroes and sends everyone off the field: put the still field back as lab() set it */
function hold(L){ const {v,A:Al,F}=L; for(const u of L.U){ u.stunned=1e6; u.fearT=0; u.target=null; }
  v.x=300; v.y=700; const put=(u,dx,dy)=>{ u.x=v.x+dx*V.METER; u.y=v.y+dy*V.METER; u._ax=u.x; u._ay=u.y; u.px=u.x; u.py=u.y; };
  put(v,0,0); F.forEach((f,i)=>put(f,FPOS[i][0],FPOS[i][1])); Al.forEach((a,i)=>put(a,APOS[i][0],APOS[i][1])); }
/* the wave ends at 55 s; the next wave's first tick (its start: 'wave' rows, once:'wave') */
function wave2(L,at){ to(at==null?55:at); const t=W.next(); hold(L); assert.ok(V.now()===0,'the page starts its clock again at 0 (it was '+t+')'); V.step(1); return t; }
/* a case with the page as it is, then with the old page (no clock line) */
function both(f){ const on=f(); W.noHook(true); let off; try{ off=f(); } finally{ W.noHook(false); } return {on,off}; }
const R1=[['t',1]];
const vl=(def,o)=>lab('vael',R1,Object.assign({def},o||{}));

/* ============================== Part 1: the engine's own stores ============================== */
test('icd: a 20 s internal cooldown set at 40 s of a wave that ends at 55 s has 5 s left in the next wave (also per unit: by)',()=>{
  const def={states:{a:{},b:{}},talents:{t:[{on:'hit',icd:20,do:[{stack:'a',add:1}]},{on:'hit',by:'target',icd:20,do:[{stack:'b',add:1}]}]}};
  const r=both(()=>{ const L=vl(def), {v,F}=L, g=()=>[stack(L,'a'),stack(L,'b')]; to(40); V.hit(v,F[0],1); const s0=g(); wave2(L);
    to(4.4); V.hit(v,F[0],1); const s1=g(); to(5.6); V.hit(v,F[0],1); return [s0,s1,g()]; });
  assert.deepEqual(r.on,[[1,1],[1,1],[2,2]],'still locked 4.4 s into wave 2, open at 5.6 s');
  assert.deepEqual(r.off,[[1,1],[1,1],[1,1]],'control: the old page keeps it locked (until 60 s of wave 2)');
});
test("a window's cooldown (window, dur, cd): 5 s left after the wave, not 60",()=>{
  const def={states:{a:{}},talents:{t:[{on:'hit',do:[{window:'w',dur:1,cd:20},{stack:'a',add:1}]}]}};
  const r=both(()=>{ const L=vl(def), {v,F}=L; to(40); V.hit(v,F[0],1); wave2(L); to(4.4); V.hit(v,F[0],1); const a1=stack(L,'a'); to(5.6); V.hit(v,F[0],1);
    return [a1,stack(L,'a'),+(L.T.s.w.w.at<=V.now())]; });
  assert.deepEqual(r.on,[1,2,1]); assert.deepEqual(r.off,[1,1,0],'control: refused until 60 s, and its start stamp lies in the future');
});
test('a refilling pool (refill: 20): the unit spent at 40 s comes back 5 s into the next wave',()=>{
  const def={states:{p:{max:3,start:'max',refill:20}},talents:{t:[{on:'hit',do:[{stack:'p',spend:1}]}]}};
  const r=both(()=>{ const L=vl(def), {v,F}=L; to(40); V.hit(v,F[0],1); const p0=stack(L,'p'); wave2(L); to(4.4); const p1=stack(L,'p'); to(5.6); return [p0,p1,stack(L,'p')]; });
  assert.deepEqual(r.on,[2,2,3]); assert.deepEqual(r.off,[2,2,2],'control: it would come back at 60 s');
});
test("'after' actions: 20 s after a hit at 40 s = 5 s into the next wave",()=>{
  const def={states:{a:{}},talents:{t:[{on:'hit',do:[{after:20,do:[{stack:'a',add:1}]}]}]}};
  const r=both(()=>{ const L=vl(def), {v,F}=L; to(40); V.hit(v,F[0],1); wave2(L); to(4.4); const a1=stack(L,'a'); to(5.6); return [a1,stack(L,'a')]; });
  assert.deepEqual(r.on,[0,1]); assert.deepEqual(r.off,[0,0]);
});
test("marks: a 20 s mark ends 5 s into the next wave; a mark's age goes on (markAge)",()=>{
  const def={talents:{t:[{on:'hit',do:[{mark:'m',dur:20,if:{targetLacks:'m'}},{mark:'q'}]},{on:'out',if:{targetHas:'q'},more:0.01,per:{markAge:'q',every:1,max:100}}]}};
  const r=both(()=>{ const L=vl(def), {v,F}=L; to(40); V.hit(v,F[0],1); wave2(L); to(1.02);
    const h0=F[0].hp; V.hit(v,F[0],100); const d0=h0-F[0].hp, h1=F[1].hp; V.hit(v,F[1],100); const d1=h1-F[1].hp;   // F1 carries no mark yet: a plain hit
    to(4.4); const m1=mark(L,F[0],'m'); to(5.6); return [Math.round(d0/d1*1000)/1000,m1,mark(L,F[0],'m')]; });
  assert.deepEqual(r.on,[1.16,true,false],'the mark is 16 s old 1 s into wave 2 (15 s before the wave + 1): 16% more; the 20 s mark ends at 5 s');
  assert.notEqual(r.off[0],1.16); assert.equal(r.off[2],true,'control: the age is negative and the mark lasts to 60 s');
});
test("timed marks (mark with an end event): the end event comes 5 s into the next wave",()=>{
  const def={states:{a:{}},talents:{t:[{on:'hit',do:[{mark:'tm',on:'target',dur:20,ends:'tmEnd'}]},{on:'tmEnd',do:[{stack:'a',add:1}]}]}};
  const r=both(()=>{ const L=vl(def), {v,F}=L; to(40); V.hit(v,F[0],1); wave2(L); to(4.4); const a1=stack(L,'a'); to(5.6); return [a1,stack(L,'a')]; });
  assert.deepEqual(r.on,[0,1]); assert.deepEqual(r.off,[0,0]);
});
test('unit stacks (states.<name>.unit with dur): they lapse 5 s into the next wave',()=>{
  const def={states:{us:{unit:true,max:5,dur:20}},talents:{t:[{on:'hit',do:[{ustack:'us',on:'target'}]}]}};
  const r=both(()=>{ const L=vl(def), {v,F}=L; to(40); V.hit(v,F[0],1); wave2(L); to(4.4); const n1=A().ustGet(L.T,v,F[0],'us'); to(5.6); return [n1,A().ustGet(L.T,v,F[0],'us')]; });
  assert.deepEqual(r.on,[1,0]); assert.deepEqual(r.off,[1,1]);
});
test('ground zones end with the wave, as the game clears its own ground hazards on the same line',()=>{
  const def={talents:{t:[{on:'hit',do:[{zone:'z',at:'target',radius:2,dur:20}]}]}};
  const r=both(()=>{ const L=vl(def), {v,F}=L; to(40); V.hit(v,F[0],1); to(54); const z0=A().zoneOn(L.T,'z'); wave2(L); to(0.5); const z1=A().zoneOn(L.T,'z'); to(5.6); return [z0,z1,A().zoneOn(L.T,'z')]; });
  assert.deepEqual(r.on,[true,false,false]); assert.deepEqual(r.off,[true,true,true],'control: down until 60 s of the next wave');
});
test('rolling sums (roll, span 3 s): what came 1 s before the wave counts until 2 s into the next one',()=>{
  const def={talents:{t:[{on:'hit',do:[{roll:'r',add:100,span:3}]}]}};
  const r=both(()=>{ const L=vl(def), {v,F}=L, n=()=>A().cnt(L.T,v,{roll:'r',step:1},{}); to(54); V.hit(v,F[0],1); wave2(L); to(1.5); const a=n(); to(2.2); return [a,n()]; });
  assert.deepEqual(r.on,[100,0]); assert.deepEqual(r.off,[100,100]);
});
test("a shield-break stamp (absorb: T.s.brk, read as 'broke this tick')",()=>{
  const def={talents:{t:[{on:'shieldBreak',do:[]}]}};
  const r=both(()=>{ const L=vl(def,{big:true}), {v}=L; to(40); v.shield=10; V.dmg(v,50); const b0=L.T.s.brk, t0=V.now(); const t=wave2(L); return Math.round((L.T.s.brk-(b0-t))*1e6)/1e6+(t0===b0?0:9); });
  assert.equal(r.on,0,'moved back by the wave clock'); assert.notEqual(r.off,0);
});
test('a one-wave fight is untouched: the first wave\'s entry moves nothing (s.wave 0), and no clock line runs without a talented unit',()=>{
  const def={states:{a:{}},talents:{t:[{on:'hit',icd:20,do:[{stack:'a',add:1}]}]}};
  const L=vl(def,{cold:true}); L.T.s.lim.x={t:30,n:0,c:0,w:-1,was:false,acc:0,busy:0,by:null}; FX.clock(L.v,25); assert.equal(L.T.s.lim.x.t,30,'not before its first wave');
  V.step(1); FX.clock(L.v,25); assert.equal(L.T.s.lim.x.t,5); FX.clock(L.v,0); assert.equal(L.T.s.lim.x.t,5,'a clock of 0 moves nothing');
  const src=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8'), i=src.indexOf('function beginWaveEnter(){'), j=src.indexOf('battleTime=0;',i);
  assert.ok(i>0&&j>i&&src.slice(i,j).includes('if(_u&&_u._tal) TalentFx.clock(_u,battleTime);'),'the clock line sits in beginWaveEnter before battleTime=0, guarded on u._tal');
});

/* ============================== Part 2: the hero files' own stamps ============================== */
/* each hero file that keeps an absolute fight time of its own lists it in `times`; the table here must match */
const HERO={calypsa:['seaCd'],carn:['lastAtk'],deepcleft:['ccl.t'],fritz:['wtCd','lateAt'],grimsby:['doorsCd','rhsCd'],grosk:['dugT','cwT'],gruel:['stlCd','wioCd','rgAt'],
  hollow:['ho.rdyT','ho.kT','ho.nrT','ho.shT'],hurne:['hAnyT'],iver:['cbAt','caCd','sigCd','rgAt','ivFk'],kharos:['scU','la'],lumi:['lu.kb.*.t'],meridian:['md.fpT','md.inkT','md.hurtAt','md.greenAt','md.blueAt']};
const any=h=>[[Object.keys(FX.mech(h).talents).sort()[0],1]];
const noTimes=h=>FX.define(h,Object.assign({},FX.mech(h),{times:undefined}));
const setP=(o,p,v)=>{ const P=p.split('.'); for(let i=0;i<P.length-1;i++){ const k=P[i]==='*'?'k':P[i]; o=o[k]&&typeof o[k]==='object'?o[k]:(o[k]={}); } o[P[P.length-1]==='*'?'k':P[P.length-1]]=v; };
const getP=(o,p)=>{ for(const k of p.split('.')){ if(o==null) return undefined; o=o[k==='*'?'k':k]; } return o; };
test('every hero file\'s `times` is the list above, and each path is moved back with the clock (control: the file without its times)',()=>{
  for(const h of Object.keys(HERO)) assert.deepEqual(Array.from(FX.mech(h).times||[]),HERO[h],h);
  for(const h of FX.mechHeroes()) if(!HERO[h]) assert.equal(FX.mech(h).times,undefined,h+' keeps no absolute time of its own (or add it to this table)');
  for(const h of Object.keys(HERO)){ const r=both(()=>{ const L=lab(h,any(h)); to(55); for(const p of HERO[h]) setP(L.T.s,p,V.now()+10); W.next(); hold(L);
      return HERO[h].map(p=>Math.round(getP(L.T.s,p))); });
    assert.deepEqual(r.on,HERO[h].map(()=>10),h+': 10 s left after the wave'); assert.deepEqual(r.off,HERO[h].map(()=>65),h+': control (the old page)');
    noTimes(h); const L=lab(h,any(h)); to(55); for(const p of HERO[h]) setP(L.T.s,p,V.now()+10); W.next(); hold(L);
    assert.deepEqual(HERO[h].map(p=>Math.round(getP(L.T.s,p))),HERO[h].map(()=>65),h+': control (without its times)'); FX.define(h,null); }
});
/* a lock of the hero's own code, through its own functions: fired at the end of wave 1 with `a` s still to run before the wave ends; in wave 2 it is
   still shut a moment before the rest of its time has passed, and open a moment after. Control: the hero file without its `times` stays shut. */
function lockCase(h,cd,o){ const a=Math.min(15,cd/2), rest=cd-a, eps=Math.min(0.6,rest/2);
  const run=()=>{ const L=lab(h,any(h),{big:true}); if(o.prep) o.prep(L); to(55-a); const set=o.set||o.fire; assert.equal(set(L),true,h+': fires in wave 1');
    wave2(L); to(rest-eps); const shut=(o.open||o.fire)(L); to(rest+eps); return [shut,(o.open||o.fire)(L)]; };
  assert.deepEqual(run(),[false,true],h+': '+rest+' s left in wave 2');
  noTimes(h); try{ assert.deepEqual(run(),[false,false],h+': control (without its times) stays shut'); } finally{ FX.define(h,null); } }
const changed=(L,p,f)=>{ const was=getP(L.T.s,p); f(L.T,L.v,L.F[0]); return getP(L.T.s,p)!==was; };
test('Calypsa: The Sea Remembers (once every 30 s, seaCd)',()=>lockCase('calypsa',30,{fire:L=>changed(L,'seaCd',(T,u)=>{ T.s.sb=true; T.fn.sea(A(),T,u,{o:{}}); T.s.sea=false; })}));
test('Fritz: Late Blows (the first hit every 8 s, lateAt)',()=>lockCase('fritz',8,{prep:L=>{ L.T.r.hh_1_4=1; L.T.P['late.cd']=0; },fire:L=>changed(L,'lateAt',(T,u,f)=>T.fn.lateChk(A(),T,u,{u,src:f,tgt:u,amt:1}))}));
test('Grosk: the Mirewall Depth gain (at most one a second, dugT)',()=>lockCase('grosk',1,{prep:L=>{ L.T.P['dug.depth']=1; },fire:L=>changed(L,'dugT',(T,u)=>T.fn.mwTake(A(),T,u,{u,amt:1}))}));
test('Gruel: What Is Owed (once every 20 s, wioCd)',()=>lockCase('gruel',20,{fire:L=>changed(L,'wioCd',(T,u,f)=>T.fn.wio(A(),T,u,f))}));
test('Hollow: Misdirect\'s heal (once every 5 s, ho.nrT)',()=>lockCase('hollow',5,{prep:L=>{ L.T.P['md.heal']=0.01; },fire:L=>changed(L,'ho.nrT',(T,u,f)=>T.fn.md(A(),T,u,{u,src:f,amt:0},{}))}));
test('Hurne: He Does It Anyway (once every 30 s, hAnyT)',()=>lockCase('hurne',30,{fire:L=>changed(L,'hAnyT',(T,u)=>T.fn.anyway(A(),T,u))}));
test('Iver: Somewhere to Go (once every 25 s, sigCd)',()=>lockCase('iver',25,{fire:L=>changed(L,'sigCd',(T,u)=>T.fn.sigGo(A(),T,u,{u}))}));
test('Kharos: Patient Orchid (3 s without a hit of his, la)',()=>lockCase('kharos',3,{set:L=>{ L.T.fn.myHit(A(),L.T,L.v,{tgt:L.F[0]}); return true; },open:L=>!!L.T.fn.patient(A(),L.T,L.v)}));
test('Carn: Pace waits 2.5 s after his last swing (lastAtk)',()=>{
  const run=()=>{ const L=lab('carn',any('carn'),{big:true}), {v}=L; to(54); L.T.fn.swung(A(),L.T); wave2(L); to(1);
    const tick=()=>{ A().stSet(L.T,v,'pace',10); L.T.s.pAcc=0; v.stunned=0; v.fearT=0; L.T.fn.paceTick(A(),L.T,v,{u:v,dt:0.5}); v.stunned=1e6; return A().stGet(L.T,'pace'); };
    const p1=tick(); to(1.8); return [p1,tick()]; };   // 1 s before the wave + 1 s = 2 s (it waits); + 0.8 s more = 2.8 s (it drops)
  assert.deepEqual(run(),[10,9]); noTimes('carn'); try{ assert.deepEqual(run(),[10,10],'control: it waits until 56.5 s of wave 2'); } finally{ FX.define('carn',null); }
});
test('Deepcleft: who controlled him (ccl.t, "within 0.05 s")',()=>{
  const run=()=>{ const L=lab('deepcleft',any('deepcleft')); to(54.9); L.T.fn.ccSrc(A(),L.T,L.v,{src:L.F[0]}); wave2(L); to(1); return V.now()-L.T.s.ccl.t<0.05; };
  assert.equal(run(),false); noTimes('deepcleft'); try{ assert.equal(run(),true,'control: a wave-1 control counts as just now for 55 s'); } finally{ FX.define('deepcleft',null); }
});
test('Lumi: Kindled\'s heal budget (lu.kb.<uid>.t refills from the time of the last heal)',()=>{
  const run=()=>{ const L=lab('lumi',any('lumi')), {v}=L; L.T.P['kd.k']=0; to(55); L.T.fn.kheal(A(),L.T,v,v); wave2(L); to(1); L.T.fn.kheal(A(),L.T,v,v); return L.T.s.lu.kb[v.uid].v; };
  near(run(),0.012,'full again (1.2% a second, at most 1.2%)'); noTimes('lumi'); try{ assert.ok(run()<0,'control: the budget is about -54 s deep'); } finally{ FX.define('lumi',null); }
});
test('Meridian: a refund never takes Golden Quill below 3.5 s after it was set (md.greenAt)',()=>{
  const run=()=>{ const L=lab('meridian',any('meridian')), {v}=L; to(50); L.T.fn.cdSet(A(),L.T,v,{u:v,slot:'green',amt:10}); wave2(L); to(1); v.greenCd=10; L.T.fn.cdOff(A(),L.T,v,'green',3); return Math.round(v.greenCd*1000)/1000; };
  assert.equal(run(),7,'6 s after it was set: the whole 3 s refund'); noTimes('meridian'); try{ assert.equal(run(),10,'control: no refund until 50 s of wave 2'); } finally{ FX.define('meridian',null); }
});
test('Grimsby: Doors Locked Behind Him and The Rate He Set (25 s locks) are moved back with the clock',()=>{
  const run=()=>{ const L=lab('grimsby',any('grimsby')); to(45); const t1=V.now(); L.T.s.doorsCd=t1+25; L.T.s.rhsCd=t1+25; const t=wave2(L); return [L.T.s.doorsCd,L.T.s.rhsCd].map(x=>Math.round((x-(t1+25-t))*1e6)/1e6); };
  assert.deepEqual(run(),[0,0],'each lock keeps what it had left'); noTimes('grimsby'); try{ assert.notDeepEqual(run(),[0,0],'control: not moved'); } finally{ FX.define('grimsby',null); }
});

/* ============================== Part 3: whole fights ============================== */
const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8'));
const TEAM=['vael','vireo','sylthaine','vex'];
const FH=Object.keys(HERO).concat(['vael','astra','absalie','konwu']);
const sn=h=>snaps([h].concat(TEAM.filter(k=>k!==h).slice(0,4)).map(k=>spec(k,100,k===h?everything(h):null)));
const fight=(s,node,seed,n)=>{ const w=ENC.find(e=>e.node===node).waves; const r=NOW.campaign(JSON.parse(JSON.stringify(s)),n?w.slice(0,n):w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.digest]); };
/* at every wave change, right after beginWaveEnter: every icd lock of every talented unit has at most its own length to run, and every time a hero file lists
   is no further ahead than 30 s (its longest lock) */
function audit(s,node,seed){ const bad=[], clocks=[];
  const check=VMX(`(function(f){ const o=beginWaveEnter; beginWaveEnter=function(){ const bt=battleTime; const r=o.apply(this,arguments); f(bt,units); return r; }; return ()=>{ beginWaveEnter=o; }; })`);
  const undo=check((bt,units)=>{ if(!(bt>0)) return; clocks.push(Math.round(bt*10)/10);
    for(const u of units){ const T=u._tal; if(!T||!T.s.wave) continue; const icd={}; for(const ev in T.on) for(const row of T.on[ev]) if(row.icd) icd[row.key]=row.icd;
      for(const k in T.s.lim){ const L=T.s.lim[k], c=icd[k]; if(c==null) continue; const ls=[L.t].concat(L.by?Object.values(L.by).map(x=>x.t):[]); for(const t of ls) if(t>c+1e-6) bad.push([u.key,k,Math.round((t-c)*10)/10]); }
      const H=HERO[T.hero]; if(H) for(const p of H){ const vals=[]; const walk=(o,P,i)=>{ if(o==null||typeof o!=='object') return; const k=P[i], last=i===P.length-1; const one=x=>{ if(last){ if(typeof o[x]==='number') vals.push(o[x]); } else walk(o[x],P,i+1); }; if(k==='*') for(const x in o) one(x); else one(k); };
        walk(T.s,p.split('.'),0); for(const t of vals) if(t>30+1e-6) bad.push([u.key,p,Math.round((t-30)*10)/10]); } } });
  let res; try{ res=fight(s,node,seed); } finally{ undo(); } return {bad,clocks,res}; }
test('real 3-wave campaign fights: at every wave change no lock has more than its own length to run (control: the old page stretches them)',()=>{
  let n=0, nBad=0, worst=0, maxClock=0, onBad=0; const lines=[];
  for(const h of FH) for(const [node,seed] of [[34,11],[90,424242]]){ const s=sn(h);
    const a=audit(s,node,seed); onBad+=a.bad.length; for(const c of a.clocks) maxClock=Math.max(maxClock,c); n++;
    W.noHook(true); let b; try{ b=audit(s,node,seed); } finally{ W.noHook(false); }
    nBad+=b.bad.length; for(const x of b.bad) worst=Math.max(worst,x[2]); if(b.bad.length) lines.push(h+' node '+node+': '+b.bad.length+' stretched (worst '+Math.max(...b.bad.map(x=>x[2]))+' s too long)');
    assert.deepEqual(a.bad,[],h+' node '+node+' seed '+seed+': a lock with more than its own length to run after the wave'); }
  console.log('waveclock: '+n+' fights, longest wave clock at a wave change '+maxClock+' s; control (old page): '+nBad+' locks stretched, worst '+worst+' s too long\n  '+lines.join('\n  '));
  assert.equal(onBad,0); assert.ok(nBad>0,'control: the old page leaves locks stretched in these fights');
});
test('one-wave fights are identical with and without the clock line (nothing changes inside a wave); 3-wave fights may differ',()=>{
  let same=0, diff=0;
  for(const h of FH){ const s=sn(h);
    for(const [node,seed] of [[34,11],[60,90210]]){ const a=fight(s,node,seed,1); W.noHook(true); let b; try{ b=fight(s,node,seed,1); } finally{ W.noHook(false); } assert.equal(a,b,h+' node '+node+' one wave'); }
    const plain=JSON.parse(JSON.stringify(s)), x1=JSON.stringify(NOW.auto(JSON.parse(JSON.stringify(s)),plain,7)); W.noHook(true); let x2; try{ x2=JSON.stringify(NOW.auto(JSON.parse(JSON.stringify(s)),plain,7)); } finally{ W.noHook(false); }
    assert.equal(x1,x2,h+': a two-sided fight (one wave)');
    const m1=fight(s,60,90210); W.noHook(true); let m2; try{ m2=fight(s,60,90210); } finally{ W.noHook(false); } if(m1===m2) same++; else diff++; }
  console.log('waveclock: 3-wave fight node 60 with each of '+FH.length+' heroes fully learned: '+diff+' differ from the old page, '+same+' identical');
});
