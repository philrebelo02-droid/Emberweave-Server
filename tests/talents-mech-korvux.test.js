'use strict';
/* Korvux's talents as data on the mechanics layer (talents-mech/korvux.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, Phil's 95% damage-reduction ceiling, the stun chain.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   EMBERSKIN measures 2.4 m from his CENTRE and burned an enemy on 1 of 850 ticks in real fights (tests/korvux-kit-facts.js); release v1391 on another branch
   measures to the enemy's body edge. Every Emberskin test puts the enemy 2.2 m from his centre and lets it through the bodies' push-apart (_pullGhost, gstep):
   a place the aura reaches both before and after that fix (centre 2.2 m < 2.4 m; body edge 0.2 m) - so these tests are about his talents, not the aura's reach.
   COMET DASH lands on its target (held, so it does not move away during the dash): the slam reaches it before and after v1391; other enemies are put within
   2.0 m of the landing (both measures). EMBER CLEAVE measures to the body edge since v1389 (F0 at 4.5 m: 2.5 m body edge, inside its 3.2 m).
   Places (metres from Korvux, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6); A0 (0,-5.5). The lab's skill level is 10.
   Run: node --test tests/talents-mech-korvux.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,build,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='korvux', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
test.afterEach(()=>{ FX.define(H,null); brndBack(); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; if(!m) return 0; if(V.now()<m.until) return m.v; const st=(L.T.st[name]&&L.T.st[name].step)||0; if(!(st>0)) return 0; const k=Math.floor((V.now()-m.until)/st+1e-9)+1; return Math.max(0,m.v-k); };
const setUst=(L,t,name,n,d)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+(d==null?99:d)}; };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const winLeft=(L,name)=>{ const w=L.T.s.w[name]; return w?w.t:0; };
const openWin=(L,name,d)=>{ L.T.s.w[name]=Object.assign(L.T.s.w[name]||{n:1,cdT:0,at:-1,wave:false},{t:d||99,n:1}); };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const dm=(s,t,k)=>VMX('defMul')(s,t,k);
const rage=()=>VMX('rageMul');
const kv=L=>L.T.s.kvx||(L.T.s.kvx={kb:{},hb:0});
const brnd=x=>VMX('var __kbr=(typeof __kbr!=="undefined"&&__kbr)?__kbr:brnd; brnd=function(){ return '+x+'; };');   // the seeded stream answers x (put back after each test)
const brndBack=()=>VMX('if(typeof __kbr!=="undefined"&&__kbr){ brnd=__kbr; __kbr=null; }');
/* a unit that thinks but does nothing (no move, no attack, nothing ready), at level 1 so a control is not resisted */
const free=x=>{ x.stunned=0; x.speed=0; x.atkCd=1e9; x.greenCd=99; x.blueCd=99; x.energy=0; x.level=1; };
function kl(list,o){ o=o||{}; const L=lab(H,list,Object.assign({},o,{cold:true})); L.v.x=300; L.v.y=700; L.F.forEach((f,i)=>{ const P=[[4.5,0],[10,0],[15.5,0],[0,6],[5.5,6],[11,6]][i]; if(P) at(L,f,P[0],P[1]); });
  if(o.pre) o.pre(L); V.step(1); return L; }
const plain=(o,fn)=>fn(kl(null,o));
/* steps with the enemies let through the bodies' push-apart, so an enemy put 2.2 m from his centre stays there (see the header) */
const gstep=(L,n)=>{ for(let i=0;i<(n||1);i++){ for(const f of L.F) f._pullGhost=true; V.step(1); } };
const burnNow=L=>{ L.v._immT=0.99999; gstep(L,1); };
const baseBurn=(L,f)=>VMX('(function(u,e){ return dotTickAmt(u,e,u.dmg*SKLV.immolate(passLv(u)),dotDmgKind(u,"#ff6a3a")); })')(L.v,f);
const burnK=(L,f)=>{ const b=baseBurn(L,f); return lost(f,()=>burnNow(L))/b; };
const close=(L,f,d)=>{ at(L,f,d==null?2.2:d,0); };
const hitOn=(L,amt,o)=>{ const v=L.v, r=lost(v,()=>V.hit((o&&o.src)||L.F[0],v,amt||100,Object.assign({kind:'true'},o||{}))); v.energy=0; return r; };
const inRatio=(L,o,amt)=>{ const v=L.v, h=v.hp; const a=hitOn(L,amt||100,o); v.hp=h; const b=plainHit(L,()=>hitOn(L,amt||100,o)); v.hp=h; return a/b; };
const ratio=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))));
function skillRatio(L,t,skill,o){ const s=L.T.s, keep=s.cur; s.cur=skill; let a; try{ a=lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{}))); } finally{ s.cur=keep; }
  return a/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})))); }
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.hit(L.v,t,100,{kind:'true'}); assert.ok(!t.alive,'it died'); };
/* Comet Dash for real: he is let go (doing nothing else), casts it, and the dash runs to its landing. The enemies are let through the bodies' push-apart while he dashes
   (otherwise he shoves his own target out of the slam as he arrives - the base skill's miss in real fights, see the header) */
function dash(L,g){ const v=L.v; free(v); v.level=100; const pos=new Map(L.F.map(f=>[f,[f.x,f.y]])); V.cast(v,'green'); const D=v._dash; if(D) D.pos=pos; assert.ok(D,'a dash'); for(let i=0;i<60&&v._dash;i++){ if(g!==false) for(const f of L.F) f._pullGhost=true; V.step(1); } assert.ok(!v._dash,'the dash landed'); return D; }
const onIt=(D,f)=>{ const p=(D.pos&&D.pos.get(f))||[f.x,f.y]; return Math.hypot(D.x1-p[0],D.y1-p[1])<0.5*V.METER; };   // the dash's landing spot is where that enemy stood at the cast
const KO=slot=>VMX('skillScaleOpts')(Object.assign({},VMX('KITS.korvux')[slot]),VMX('skillMul')(10),10);
const crater=()=>{ const G=VMX('groundHazards'); for(let i=G.length-1;i>=0;i--) if(G[i]&&G[i].interval&&G[i].src&&G[i].src.key===H) return G[i]; return null; };
const star=(L,t)=>{ VMX('groundHazards.length=0'); V.cast(L.v,'ult',t); return crater(); };
const critP=(L,t,o)=>{ const keep=L.T.s.cur; if(o&&o.cur) L.T.s.cur=o.cur; try{ return FX.crit(L.v,t,false,'phys',false); } finally{ L.T.s.cur=keep; } };

test('Korvux: every talent is accounted for - 11 plain stats, 107 with rows, none waiting',()=>{
  accounting(H,[118,11,107,0,0]);
  const M=FXN.mech(H); for(const id of ['rh_1_1','bs_1_1','pp_1_4','rh_13_2','bs_13_3','pp_13_3','pp_1_1','rh_5_4','bs_2_2','pp_5_1']) assert.ok(M.talents[id],id);
  for(const id of ['rh_2_3','rh_8_1','rh_8_3','rh_11_4','bs_8_4','bs_8_2','bs_8_3','bs_1_2','pp_8_2','pp_6_1','pp_2_2']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  assert.ok(!FXN.has(H,'pp_1_1'),'Violet Blood is a row (the 5% crit group), no longer a plain stat');
  const st=FXN.totals(H,S(['rh_8_1','bs_8_3','pp_6_1'])); near(st.critDmg,0.30,'crit damage: 10% from each of the three, at most');
});

test('Korvux: his real kit, as the talents read it - Emberskin once a second at 2.2 m, Comet Dash to the farthest with a 1.4 s stun, Ember Cleave, Falling Star\'s crater and no impact hit',()=>{
  const L=kl(null,{big:true}), {v,F}=L; close(L,F[0]);
  const b=baseBurn(L,F[0]); near(b,v.dmg*VMX('SKLV.immolate(10)')*dm(v,F[0],'phys'),'a burn: his attack x Emberskin at its level, through armor');
  let n=0; for(let i=0;i<Math.round(3/V.STEP);i++){ const h=F[0].hp; gstep(L,1); if(F[0].hp<h) n++; } assert.equal(n,3,'three burns in 3 s');
  assert.equal(lost(F[1],()=>burnNow(L)),0,'nothing reaches F1 at 10 m');
  const k=KO('green'); assert.equal(k.stun,2,'the slam\'s stun from the table (2.0 s area, x 0.7 when it lands)'); near(k.radius/V.METER,2.4,'2.4 m');
  const L2=kl(null,{big:true}); free(L2.F[1]); const D2=dash(L2); assert.ok(onIt(D2,L2.F[1]),'he landed on the farthest enemy'); near(L2.F[1].stunned,1.4,'stunned 1.4 s',0.03);
  const L3=kl(null); const h=star(L3,L3.F[1]); assert.ok(h,'a crater'); near(h.r/V.METER,6,'6 m'); near(h.life,5,'5 s'); near(h.dmg,L3.v.dmg*0.8*VMX('skillMul(10)'),'80% x skill level a half second');
  assert.equal(L3.F[1].hp,1e9,'no impact hit: the crater is all of Falling Star');
});

test('Korvux / Cooking: Too Close (1 a burn, max 8, 1% x 3 per Cooking), the fade after 1.5 s, Slow Roast, Cooked Through (double at 8), Furnace Core, Seething, Cook Faster',()=>{
  const L=kl(S(['rh_1_1','rh_2_1','rh_3_1','rh_3_4','rh_6_1','rh_9_4']),{big:true}), {v,F}=L; close(L,F[0]);
  setUst(L,F[0],'kxCk',3); v.hp=v.maxHp;
  near(burnK(L,F[0]),(1+0.03*3)*1.10,'3 Cooking x 3% and Furnace Core 10%'); assert.equal(ust(L,F[0],'kxCk'),4,'one more Cooking'); near(F[0]._talM[v.uid]['#kxCk'].until-V.now(),1.5,'it starts to fade 1.5 s after this gain',0.03);
  setUst(L,F[0],'kxCk',7); near(burnK(L,F[0]),(1+0.03*7)*1.10,'7 Cooking: once');
  setUst(L,F[0],'kxCk',8); near(burnK(L,F[0]),(1+0.03*8)*2*1.10,'8 Cooking: twice over'); assert.equal(ust(L,F[0],'kxCk'),8,'max 8');
  setUst(L,F[0],'kxCk',2); v.hp=0.4*v.maxHp; near(burnK(L,F[0]),(1+0.03*2)*1.10*1.12,'Seething below 50% HP: 4% x 3'); setUst(L,F[0],'kxCk',2); v.hp=0.55*v.maxHp; near(burnK(L,F[0]),(1+0.03*2)*1.10,'not at 55%'); v.hp=v.maxHp;
  at(L,F[0],4.5,0); setUst(L,F[0],'kxCk',5,1.5); secs(1.6); assert.equal(ust(L,F[0],'kxCk'),4,'1.5 s after its last gain, one fades'); secs(2.3); assert.equal(ust(L,F[0],'kxCk'),4,'Slow Roast: the next only 2.5 s later'); secs(0.3); assert.equal(ust(L,F[0],'kxCk'),3);
  const L2=kl(S(['rh_9_4'])), w=L2.v; w._immT=0; const t0=V.now(); let first=null; close(L2,L2.F[0]); for(let i=0;i<60&&first==null;i++){ const h=L2.F[0].hp; gstep(L2,1); if(L2.F[0].hp<h) first=V.now()-t0; }
  assert.ok(first!=null&&first<1/1.2+0.04&&first>1/1.2-0.04,'Cook Faster 4% x 5: a burn every 0.83 s ('+first+')'); near(FX.num(w,'immRate',1),1.2,'the clock 20% faster');
});

test('Korvux / Cleave the Heat (+3 Cooking a hit), Blistered (6% at 4+ Cooking), Hot Blood (6% less from Cooking enemies, in the group), Forty Words (in the crit group)',()=>{
  const L=kl(S(['rh_7_1','rh_6_4','rh_1_4','rh_1_1']),{big:true}), {v,F}=L; v.target=F[0];
  V.cast(v,'blue',F[0]); assert.equal(ust(L,F[0],'kxCk'),3,'Ember Cleave: 3 Cooking'); V.cast(v,'blue',F[0]); assert.equal(ust(L,F[0],'kxCk'),6);
  near(skillRatio(L,F[0],'cleave'),1.06,'Blistered at 6 Cooking'); setUst(L,F[1],'kxCk',3); near(skillRatio(L,F[1],'cleave'),1,'not at 3'); setUst(L,F[1],'kxCk',0,0);
  near(inRatio(L,{src:F[0]}),1-0.06,'Hot Blood: hits from a Cooking enemy'); near(inRatio(L,{src:F[1]}),1,'not from one that is not Cooking');
  const L2=kl(S(['rh_7_3'])); setUst(L2,L2.F[0],'kxCk',4); brnd(0.049); assert.equal(critP(L2,L2.F[0]),true,'Forty Words 5% at 4 Cooking'); brnd(0.051); assert.equal(critP(L2,L2.F[0]),false,'5% at most');
  brnd(0); setUst(L2,L2.F[1],'kxCk',3); assert.equal(critP(L2,L2.F[1]),false,'not at 3 Cooking');
});

test('Korvux / Emberskin\'s reach: Wide Heat (0.2 m x 3), Scalding Mist (0.1 m x 3 per Steam), Kellsmarch Summer (1 m while 3 enemies are Cooking)',()=>{
  const L=kl(S(['rh_4_2','rh_2_2','rh_1_2','rh_11_1']),{big:true,foes:4}), {v,F}=L; close(L,F[0],2.95); assert.ok(lost(F[0],()=>burnNow(L))>0,'Wide Heat: 3.0 m reaches 2.95 m');
  close(L,F[0],3.05); assert.equal(lost(F[0],()=>burnNow(L)),0,'not 3.05 m');
  setStack(L,'kxSt',3); close(L,F[0],3.85); assert.ok(lost(F[0],()=>burnNow(L))>0,'3 Steam: +0.9 m'); close(L,F[0],3.95); assert.equal(lost(F[0],()=>burnNow(L)),0,'not 3.95 m');
  setStack(L,'kxSt',0); for(const f of [F[1],F[2],F[3]]) setUst(L,f,'kxCk',1); setUst(L,F[0],'kxCk',0,0); close(L,F[0],3.9); assert.ok(lost(F[0],()=>burnNow(L))>0,'Kellsmarch Summer: 4.0 m'); setUst(L,F[0],'kxCk',0,0); close(L,F[0],4.1); assert.equal(lost(F[0],()=>burnNow(L)),0,'not 4.1 m'); setUst(L,F[0],'kxCk',0,0);
  setUst(L,F[3],'kxCk',0,0); setUst(L,F[0],'kxCk',0,0); close(L,F[0],3.9); assert.equal(lost(F[0],()=>burnNow(L)),0,'two Cooking enemies are not enough');
});

test('Korvux / Steam: Rain to Steam (1 a hit, max 5, 4 s; 0.4% x 5 a Steam in the group), Old Scales, Ash Tongue, Boiling Off under the 1.2% a second budget',()=>{
  const L=kl(S(['rh_1_2','rh_5_1','rh_10_2','rh_8_2']),{big:true}), {v,F}=L; v.maxHp=1e6; v.hp=5e5;
  hitOn(L,10); assert.equal(stack(L,'kxSt'),1); for(let i=0;i<6;i++) hitOn(L,10); assert.equal(stack(L,'kxSt'),5,'max 5');
  near(inRatio(L,{},100),1-0.02*5,'5 Steam: 10% less');
  const L0=kl(null), mr=L0.v.mrRating, as=L0.v.atkInterval;
  const L1=kl(S(['rh_1_2','rh_5_1','rh_10_2','rh_8_2']),{big:true}); setStack(L1,'kxSt',5); V.step(2); near(L1.v.mrRating,mr*1.10,'Old Scales at 3+'); near(L1.v.atkInterval,as/1.09,'Ash Tongue at 5');
  setStack(L1,'kxSt',4); V.step(2); near(L1.v.mrRating,mr*1.10,'Old Scales at 4'); near(L1.v.atkInterval,as,'no Ash Tongue at 4'); setStack(L1,'kxSt',2); V.step(2); near(L1.v.mrRating,mr,'no Old Scales at 2');
  L1.v.maxHp=1e6; L1.v.hp=5e5; kv(L1).hb=0.024e6; setStack(L1,'kxSt',5); const hb0=L1.v.hp; secs(1); near(L1.T.P['heal.boil'],0.012,'Boiling Off: 0.24% x 5 a second'); near((L1.v.hp-hb0)/1e6,0.012,'with the budget full: still 1.2% a second (0.24% x 5)',0.03);
  L1.v.maxHp=1e6; L1.v.hp=5e5; kv(L1).hb=0; V.step(1); const h0=L1.v.hp; setStack(L1,'kxSt',5); secs(2); setStack(L1,'kxSt',5); const got=L1.v.hp-h0; near(got/(1e6*2),0.012,'Boiling Off 0.24% x 5 = 1.2% a second',0.05);
  setStack(L1,'kxSt',4); const h1=L1.v.hp; secs(1); assert.ok(L1.v.hp-h1<1,'not at 4 Steam');
  const L2=kl(S(['rh_1_2']),{big:true}); hitOn(L2,10); secs(4.1); assert.equal(stack(L2,'kxSt'),0,'all of it lapses 4 s after the last');
});

test('Korvux / Steam Burst (at 5, the next hit releases it on every enemy in Emberskin, 100% of his attack), Glow Under the Steam (15% for 3 s; LINK: Afterglow with Afterglow learned)',()=>{
  const L=kl(S(['rh_1_2','rh_9_2','rh_8_2','rh_7_4']),{big:true}), {v,F}=L; close(L,F[0]); burnNow(L); assert.ok(mark(L,F[0],'kxIe'),'F0 is in Emberskin');
  setStack(L,'kxSt',5); const exp=v.dmg*rage()*dm(v,F[0],'phys'); const got=lost(F[0],()=>hitOn(L,10)); near(got,exp,'100% of his attack through armor');
  assert.equal(stack(L,'kxSt'),0,'Steam empties'); assert.equal(lost(F[1],()=>{ setStack(L,'kxSt',5); hitOn(L,10); }),0,'F1 is not in Emberskin');
  setStack(L,'kxSt',4); hitOn(L,10); assert.equal(stack(L,'kxSt'),5,'at 4 a hit adds the fifth (no burst)');
  const L2=kl(S(['rh_1_2','rh_n1','bs_1_1']),{big:true}); close(L2,L2.F[0]); setStack(L2,'kxSt',4); hitOn(L2,10); assert.ok(win(L2,'kxGl'),'reaching 5: the glow'); near(winLeft(L2,'kxGl'),3,'3 s',0.02);
  assert.ok(win(L2,'kxAg'),'with Afterglow learned: Afterglow too'); near(burnK(L2,L2.F[0]),1.15,'Emberskin 15% harder');
  const L3=kl(S(['rh_1_2','rh_n1']),{big:true}); setStack(L3,'kxSt',4); hitOn(L3,10); assert.ok(win(L3,'kxGl')&&!win(L3,'kxAg'),'no Afterglow without it');
});

test('Korvux / in Emberskin: Coals (0.5% x 5 armor), Overheat (0.5% x 5 attack per Cooking enemy in reach, up to 5), Keep Them Back (PICK ONE: pushed 1 m, 20% slow; once a wave) and Cooked Out',()=>{
  const L0=kl(null), arm=L0.F[0].armorRating, d0=L0.v.dmg;
  const L=kl(S(['rh_7_4','rh_10_1','rh_1_1']),{big:true}), {v,F}=L; close(L,F[0]); burnNow(L); V.step(1);
  near(F[0].armorRating,arm*(1-0.025),'Coals'); near(v.dmg,d0*(1+0.025),'Overheat: one Cooking enemy in reach'); near(F[1].armorRating,arm,'not on F1');
  at(L,F[0],8,8); secs(1.5); near(F[0].armorRating,arm,'out of Emberskin: back'); near(v.dmg,d0,'and the attack too');
  const L2=kl(S(['rh_5_3','rh_6_3']),{big:true}); close(L2,L2.F[0]); burnNow(L2); const f=L2.F[0]; assert.ok((f.pullT||0)>0,'pushed (the engine\'s drag)'); near(f.slowMul,0.65,'slowed 20% + Cooked Out 15 points'); near(f.slow,2,'2 s',0.05);
  f.slow=0; f.slowMul=1; f.pullT=0; close(L2,f); burnNow(L2); assert.equal(f.slow||0,0,'once a wave'); V.wave(); V.step(1); close(L2,f); burnNow(L2); assert.ok((f.slow||0)>0,'again the next wave');
});

test('Korvux / Sunburnt Friends (PICK ONE): an ally within Emberskin\'s reach of him (body to body) deals 6% more; not Korvux himself',()=>{
  const L=kl(S(['rh_5_2']),{allies:1,big:true}), {v,A,F}=L; burnNow(L);
  const r=lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'}))/plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'}))); near(r,1.06,'the ally at 5.5 m (1.7 m body to body)');
  near(ratio(L,F[0]),1,'Korvux himself: no');
  at(L,A[0],0,-9); const r2=lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'}))/plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'}))); near(r2,1,'an ally 9 m away: no');
});

test('Korvux / Running Hotter (1% x 5 per Cooking death, this wave, up to 5), Well Done (0.3% x 5 of max HP; a boss at most his attack), Something Owes Him (50% at 7 Pieces)',()=>{
  const L=kl(S(['rh_11_2','rh_12_2','pp_7_4','pp_1_4']),{big:true,foes:4}), {v,F}=L; setUst(L,F[2],'kxCk',2); kill(L,F[2]); assert.equal(stack(L,'kxRh'),1,'died while Cooking');
  kill(L,F[3]); assert.equal(stack(L,'kxRh'),1,'not Cooking: no'); close(L,F[0]); near(burnK(L,F[0]),1.05,'1% x 5');
  setStack(L,'kxRh',4); near(burnK(L,F[0]),1.20,'4: 20%, no max-HP part yet');
  setStack(L,'kxRh',5); const b=baseBurn(L,F[0]), x=lost(F[0],()=>burnNow(L)); near(x,b*1.25+0.015*F[0].maxHp*dm(v,F[0],'phys'),'full: 25% and 1.5% of its max HP');
  F[0].t=Object.assign({},F[0].t,{isboss:true}); const b2=baseBurn(L,F[0]), x2=lost(F[0],()=>burnNow(L)); near(x2,b2*1.25+v.dmg*rage()*dm(v,F[0],'phys'),'a boss: at most his attack');
  F[0].t=Object.assign({},F[0].t,{isboss:false}); setStack(L,'kxRh',0); setStack(L,'kxPc',7); near(burnK(L,F[0]),1.5,'Something Owes Him'); setStack(L,'kxPc',6); near(burnK(L,F[0]),1,'not at 6');
  setStack(L,'kxRh',3); V.wave(); V.step(1); assert.equal(stack(L,'kxRh'),0,'the wave ends it');
});

test('Korvux / Rain Never Lands (SIGNATURE): 3 enemies at 8 Cooking - 6 s white: reach and damage doubled, every hit fills Steam, deaths in Emberskin burst 50%; once every 25 s',()=>{
  const L=kl(S(['rh_13_2','rh_1_2']),{big:true,foes:5}), {v,F}=L; close(L,F[0]); for(const f of [F[1],F[2]]) setUst(L,f,'kxCk',8); burnNow(L); assert.ok(!win(L,'kxWh'),'two at 8: no'); for(const f of [F[1],F[2],F[3]]) setUst(L,f,'kxCk',8);
  const tw=V.now(); near(burnK(L,F[0]),2,'the burn that sets it off is already white'); assert.ok(win(L,'kxWh'),'white'); near(winLeft(L,'kxWh'),6,'6 s',0.03);
  close(L,F[0],4.7); assert.ok(lost(F[0],()=>burnNow(L))>0,'4.8 m reach');
  hitOn(L,10); assert.equal(stack(L,'kxSt'),5,'a hit fills Steam');
  close(L,F[0]); at(L,F[4],2.2,6.4); burnNow(L); assert.ok(mark(L,F[0],'kxIe')); const g=lost(F[4],()=>kill(L,F[0])); near(g,0.5*v.dmg*rage()*dm(v,F[4],'phys'),'the burst on the enemy beside it');
  L.T.s.w.kxWh.t=0; for(const f of [F[1],F[2],F[3]]) setUst(L,f,'kxCk',8); burnNow(L); assert.ok(!win(L,'kxWh'),'not again inside 25 s'); const t0=tw; secs(Math.max(0,t0+21-V.now())); for(const f of [F[1],F[2],F[3]]) setUst(L,f,'kxCk',8); burnNow(L); assert.ok(!win(L,'kxWh'),'not at 21 s'); secs(Math.max(0,t0+25.2-V.now())); for(const f of [F[1],F[2],F[3]]) setUst(L,f,'kxCk',8); burnNow(L); assert.ok(win(L,'kxWh'),'again after 25 s');
});

test('Korvux / Afterglow: 4 s after Comet Dash lands (Lasting Glow 0.4 s x 5), basic attacks 4% x 3, Glow Hands, Thick Scales, Glowing Hide (in the group), Bask, Landing Heat under the budget',()=>{
  const L0=kl(null), mr=L0.v.mrRating, ai=L0.v.atkInterval;
  const L=kl(S(['bs_1_1','bs_3_1','bs_5_1','bs_5_4','bs_10_1','bs_12_1','bs_7_1']),{big:true}), {v,F}=L; dash(L); assert.ok(win(L,'kxAg'),'Afterglow'); near(winLeft(L,'kxAg'),6,'4 s + 2 s',0.05);
  v.stunned=1e6; V.step(1); near(v.mrRating,mr*1.15,'Thick Scales'); near(v.atkInterval,ai/1.05,'Glow Hands'); near(ratio(L,F[0],{auto:true}),1.12,'basic attacks'); near(ratio(L,F[0]),1,'not a skill hit');
  near(inRatio(L,{}),0.95,'Glowing Hide');
  v.maxHp=1e6; v.hp=5e5; kv(L).hb=0.024e6; const h=v.hp; V.hit(v,F[0],10,{kind:'true',auto:true}); near(v.hp-h,0.015e6,'Landing Heat 0.5% x 3');
  kv(L).hb=0; secs(1); const h1=v.hp; V.hit(v,F[0],10,{kind:'true',auto:true}); near(v.hp-h1,0.012e6,'the budget refills 1.2% a second',0.03);
  kv(L).hb=0.004e6; const h2=v.hp; V.hit(v,F[0],10,{kind:'true',auto:true}); near(v.hp-h2,0.004e6,'only what the budget holds');
  const h3=v.hp; L.T.s.w.kxAg.t=0.01; V.step(1); near(v.hp-h3,0.04e6,'Bask: 2% x 2 when it ends',0.01); near(inRatio(L,{}),1,'over');
});

test('Korvux / Never Stops Burning: a kill during Afterglow makes Comet Dash ready; not outside it',()=>{
  const L=kl(S(['bs_7_1','bs_9_1']),{foes:3,big:true}), {v,F}=L; openWin(L,'kxAg',3); v.greenCd=8; kill(L,F[2]); assert.equal(v.greenCd,0,'ready at once');
  L.T.s.w.kxAg.t=0; v.greenCd=8; kill(L,F[1]); assert.equal(v.greenCd,8,'outside Afterglow nothing');
});

test('Korvux / Cratered: each enemy Comet Dash stuns (4 s, Deep Crater 1.5 s), Distance Is No Armour (Cleave 15%), Shaken Ground, Craterside (in the group), Stunned Crowd (up to 3), Edge of the Crater (crit group)',()=>{
  const L0=kl(null), sp=L0.F[0].speed, d0=L0.v.dmg;
  const L=kl(S(['bs_1_4','bs_2_4','bs_6_4','bs_9_4','bs_10_4','bs_9_2']),{big:true,foes:4}), {v,F}=L; at(L,F[2],3,6); at(L,F[3],6,6); free(F[1]); dash(L); assert.ok(mark(L,F[1],'kxCr'),'the stunned enemy is Cratered');
  const m=F[1]._talM[v.uid].kxCr; near(m.until-V.now(),5.5,'4 s + 1.5 s',0.01); free(F[2]); V.cc(v,F[2],'stunned',1); assert.ok(F[2].stunned>0&&!mark(L,F[2],'kxCr'),'a stun of his that is not Comet Dash\'s: not Cratered'); assert.ok(!mark(L,F[0],'kxCr'),'F0 was not stunned');
  v.stunned=1e6; near(skillRatio(L,F[1],'cleave'),1.15,'Ember Cleave on it'); near(skillRatio(L,F[0],'cleave'),1,'not on F0');
  near(inRatio(L,{src:F[1]}),1-0.075,'Craterside'); near(inRatio(L,{src:F[0]}),1,'not from F0');
  brnd(0.049); assert.equal(critP(L,F[1]),true,'Edge of the Crater 5%'); brnd(0.051); assert.equal(critP(L,F[1]),false,'5% at most'); brnd(0); assert.equal(critP(L,F[0]),false,'not on F0'); brndBack();
  V.step(1); near(v.dmg,d0*1.05,'Stunned Crowd 1% x 5 for one');
  F[0].speed=sp; setMk(L,F[0],'kxCr'); V.step(1); near(F[0].speed,sp*0.85,'Shaken Ground 5% x 3');
  for(const f of [F[2],F[3]]) setMk(L,f,'kxCr'); V.step(1); near(v.dmg,d0*1.15,'up to 3 (four are Cratered)');
});

test('Korvux / Second Stroke: Ember Cleave stuns a Cratered enemy 0.4 s - never a stunned one, nor within 0.5 s after his stun on it ends',()=>{
  const L=kl(S(['bs_1_4','bs_3_4']),{big:true}), {v,F}=L; free(F[0]); setMk(L,F[0],'kxCr'); v.target=F[0];
  V.cast(v,'blue',F[0]); near(F[0].stunned,0.4,'0.4 s',1e-6); V.cast(v,'blue',F[0]); near(F[0].stunned,0.4,'not on a stunned enemy');
  secs(0.45); assert.equal(F[0].stunned>0,false); V.cast(v,'blue',F[0]); assert.ok(!(F[0].stunned>0),'within 0.5 s after his stun ended: no'); secs(0.3); V.cast(v,'blue',F[0]); assert.ok(!(F[0].stunned>0),'at 0.35 s after: no'); secs(0.3); V.cast(v,'blue',F[0]); near(F[0].stunned,0.4,'later: yes');
  free(F[1]); at(L,F[1],4.5,0.6); setMk(L,F[1],'kxCr'); F[1].stunned=1; v.target=F[1]; V.cast(v,'blue',F[1]); assert.ok(!mark(L,F[1],'kxLk'),'stunned by someone else: no stun of his'); F[1].stunned=0; L.F[1]._talM[v.uid].kxCr.until=V.now(); v.target=F[1]; V.cast(v,'blue',F[1]); assert.equal(F[1].stunned||0,0,'not Cratered: no stun');
});

test('Korvux / Comet Dash: Long Stride and Brief Words, Wider Landing (0.6 m), Staggering and Farthest Always (in full, never past 4 s), Dash Again, Bright Landing (crit group)',()=>{
  const L=kl(S(['bs_2_3','pp_10_2']),{big:true}), {v,F}=L; near(skillRatio(L,F[0],'charge'),1.15*1.15,'Long Stride 15%, Brief Words 15%'); near(skillRatio(L,F[0],'chargePath'),1.15*1.15,'the path hits too');
  const L2=kl(S(['bs_4_3'])); const o2=FX.kit(L2.v,'charge',Object.assign({},L2.v.greenAb)); near(o2.radius/V.METER,3.0,'Wider Landing: 3.0 m');
  const L3=kl(S(['bs_7_4','bs_5_3']),{big:true}); free(L3.F[1]); free(L3.F[0]); at(L3,L3.F[0],9.5,1.5); dash(L3,true); assert.ok(L3.F[1].stunned>2.0-0.04&&L3.F[1].stunned<=2.0,'the target: 1.4 + 0.2 + 0.4 s ('+L3.F[1].stunned+')'); assert.ok(L3.F[0].stunned>1.6-0.04&&L3.F[0].stunned<=1.6,'beside it: Staggering only ('+L3.F[0].stunned+')'); L3.T.s.cur='charge'; L3.F[1].stunned=3.9; FX.ccHit(L3.v,L3.F[1],'stunned',3.9,false); L3.T.s.cur=null; near(L3.F[1].stunned,4.0,'never past 4 s in all');
  const L4=kl(S(['bs_6_3']),{big:true}); const c=FX.cd(L4.v,'green',9); near(c,8,'Dash Again 0.2 s x 5');
  const L5=kl(S(['bs_6_1'])); brnd(0.049); assert.equal(critP(L5,L5.F[0],{cur:'charge'}),true,'Bright Landing on the slam'); assert.equal(critP(L5,L5.F[0]),false,'not on a basic attack'); brnd(0.051); assert.equal(critP(L5,L5.F[0],{cur:'charge'}),false,'5% at most');
});

test('Korvux / Thought It Safe (PICK ONE: the back-row enemy with the lowest HP; none: the farthest) and Nowhere Safe (12% from him for 4 s)',()=>{
  const L=kl(S(['bs_5_2','bs_6_2']),{big:true}), {v,F}=L; F[0].t=Object.assign({},F[0].t,{row:'Back'}); F[1].t=Object.assign({},F[1].t,{row:'Back'}); F[0].hp=5e8; free(F[0]); free(F[1]);
  const D=dash(L); assert.ok(onIt(D,F[0]),'he went to the back-row enemy, not the farthest'); assert.ok(mark(L,F[0],'kxNs'),'Nowhere Safe');
  v.stunned=1e6; near(ratio(L,F[0]),1.12,'12% more from him'); near(ratio(L,F[1]),1); secs(4.1); near(ratio(L,F[0]),1,'4 s');
  const L2=kl(S(['bs_5_2']),{big:true}); free(L2.F[1]); const D2=dash(L2); assert.ok(onIt(D2,L2.F[1]),'nobody in the back row: the farthest');
});

test('Korvux / Through the Field (the game\'s path hits at 40%) and Scorched Path (Cratered, 1% x 5 more from Comet Dash)',()=>{
  const L=kl(S(['bs_11_3','bs_12_3','bs_1_4']),{big:true}), {v,F}=L; at(L,F[0],5,0.5); free(F[0]); free(F[1]);
  const o=FX.kit(v,'charge',Object.assign({},v.greenAb)); near(o.pathHit,0.4,'pathHit 0.4');
  const h=F[0].hp; dash(L); for(let i=0;i<5;i++) V.step(1); const got=h-F[0].hp; assert.ok(got>0,'the enemy on the way was struck'); assert.ok(mark(L,F[0],'kxCr')&&mark(L,F[0],'kxCp'),'Cratered by the path');
  v.stunned=1e6; near(skillRatio(L,F[0],'charge'),1.05,'Scorched Path: 5% more from Comet Dash'); near(skillRatio(L,F[1],'charge'),1,'not on one the path did not Crater');
});

test('Korvux / Called Down (SIGNATURE): a second landing on the next farthest enemy, both Crater all they hit, the line between them Cratered and stunned 0.5 s, Afterglow 8 s; once every 25 s',()=>{
  const L=kl(S(['bs_13_3','bs_1_1']),{big:true,foes:3}), {v,F}=L; for(const f of F) free(f); at(L,F[2],2,8); at(L,F[0],6,4);
  const P2=[F[2].x,F[2].y]; const D=dash(L,true), tc=V.now(); assert.ok(onIt(D,F[1]),'the first landing on the farthest'); const L1=null;
  for(let i=0;i<60&&(kv(L).cd2||v._dash);i++){ for(const f of F) f._pullGhost=true; V.step(1); }
  const L2=kv(L).lastL; assert.ok(L2&&Math.hypot(L2.x-P2[0],L2.y-P2[1])<0.5*V.METER,'then the next farthest from where he set off: '+JSON.stringify([L1,L2,P2,kv(L).cdT,V.now(),!!kv(L).cd2,v.stunned,!!v._pend,!!v._dash]));
  assert.ok(mark(L,F[0],'kxCr'),'the enemy on the line is Cratered'); near(F[0].stunned,0.5,'and stunned 0.5 s',0.05); assert.ok(mark(L,F[1],'kxCr')&&mark(L,F[2],'kxCr'),'both landings Crater');
  near(winLeft(L,'kxAg'),8,'Afterglow 8 s',0.1);
  const t0=tc; secs(Math.max(0,t0+22-V.now())); for(const f of F) free(f); v.x=300; v.y=700; at(L,F[1],10,0); at(L,F[2],2,8); at(L,F[0],6,4); dash(L); assert.equal(kv(L).cd2==null,true,'at 22 s: no second landing is set off');
  secs(Math.max(0,t0+25.3-V.now())); for(const f of F) free(f); v.x=300; v.y=700; at(L,F[1],10,0); at(L,F[2],2,8); at(L,F[0],6,4); dash(L); assert.ok(kv(L).cd2!=null||Math.abs(kv(L).cdT-V.now()-25)<1,'after 25 s: again');
});

test('Korvux / Ember Cleave: Wide Stroke (0.6 m), Ember Edge, Burning Crescent, Cleave Through; Cleave Rhythm, Ember Rhythm, Ember Patience',()=>{
  const L=kl(S(['bs_4_2','rh_6_2','bs_7_2','pp_4_2']),{big:true}), {v,F}=L; const o=FX.kit(v,'cleave',Object.assign({},v.blueAb)); near(o.radius/V.METER,3.8,'3.2 + 0.6 m');
  near(skillRatio(L,F[0],'cleave'),1.15*1.15*1.15,'15% x 3'); near(skillRatio(L,F[0],'charge'),1,'only Ember Cleave');
  const L2=kl(S(['rh_10_3','bs_11_2','pp_12_2'])); near(FX.cd(L2.v,'blue',7),7-0.9-0.75-0.9,'2.55 s off'); near(FX.cd(L2.v,'green',9),9,'not Comet Dash');
});

test('Korvux / Falling Star: its crater made his - Glowing Axe, Old Glow, Long Burn, Pieces (2% x 3 each); Crater Edge, Lingering Fire, Installment (at 7 Pieces 2 m and 3 s)',()=>{
  const L0=kl(null), d0=L0.v.dmg, hp=star(L0,L0.F[1]).dmg;
  const L2=kl(S(['rh_12_3','bs_12_2','pp_6_3','pp_1_4','pp_7_1','pp_10_3','pp_3_4','pp_2_4']),{}); setStack(L2,'kxPc',3); V.step(2); const h=star(L2,L2.F[1]);
  console.log('  crater: plain '+hp+' (attack '+d0+'), talented '+h.dmg+' (attack '+L2.v.dmg+', Pieces '+stack(L2,'kxPc')+')');
  near(h.dmg/hp,1.12*1.12*1.15*(1+0.06*3)*(L2.v.dmg/d0),'the burn: 12%, 12%, 15%, 6% x 3 Pieces (and Wartime\'s attack)',1e-3); assert.ok(L2.v.dmg>d0,'(Wartime)');
  const L3=kl(S(['pp_7_1','pp_10_3','pp_3_4','pp_1_4'])); const h3=star(L3,L3.F[1]); near(h3.r/V.METER,7,'6 + 1 m'); near(h3.life,5.9,'5 + 0.9 s');
  setStack(L3,'kxPc',6); near(star(L3,L3.F[1]).r/V.METER,7,'not at 6 Pieces');
  setStack(L3,'kxPc',7); const h4=star(L3,L3.F[1]); near(h4.r/V.METER,9,'Installment at 7: 2 m wider'); near(h4.life,8.9,'and 3 s longer');
  assert.ok(h3._talH===L3.v,'his crater');
});

test('Korvux / in the crater: Look Up (2% x 5 from him, through the page\'s crater tick), Stay in the Crater (30%), Scaled Back (3% x 5 armor), Small Violet Star (crit group)',()=>{
  const L0=kl(null); const h0=star(L0,L0.F[0]); let p0=0; for(let i=0;i<40;i++){ const a=L0.F[0].hp; V.step(1); p0+=a-L0.F[0].hp; } const arm=L0.v.armorRating;
  const L=kl(S(['pp_8_3','pp_9_3','pp_9_2']),{foes:3}), {v,F}=L; const h=star(L,F[0]); let p=0; for(let i=0;i<40;i++){ const a=F[0].hp; V.step(1); p+=a-F[0].hp; }
  near(p/p0,1.10,'Look Up 10% on the crater\'s own ticks',1e-3); near(F[0].slowMul,0.70,'slowed 30%'); assert.ok(F[0].slow>0);
  near(v.armorRating,arm*1.15,'he stands in it: 15% armor'); near(ratio(L,F[0]),1.10,'his hits too'); near(ratio(L,F[2]),1,'F2 at 15.5 m is not in it');
  const L2=kl(S(['pp_3_1'])); const c2=star(L2,L2.F[0]); brnd(0.049); near(FX.num(L2.v,'hzTick',100,L2.F[0])/100,1+Math.max(0,(L2.v.critDmg||0.6)-(L2.F[0].critRes||0)),'Small Violet Star: a critical tick'); brnd(0.051); near(FX.num(L2.v,'hzTick',100,L2.F[0]),100,'5% at most');
});

test('Korvux / Witnessed: within 10 m of where it lands, 6 s (Never Forgotten 3 s); Stop Arguing (5%: his allies, him in the group), Lasting Awe, Sunburn, Witness Marks (crit group)',()=>{
  const L=kl(S(['pp_1_3','pp_2_3','pp_4_3','pp_12_1','pp_9_1']),{allies:1,big:true,foes:6}), {v,A,F}=L; const ai=F[0].atkInterval;
  star(L,F[1]); for(const i of [0,1,2,3,4,5]) assert.ok(mark(L,F[i],'kxWi'),'F'+i+' Witnessed (F3 is 9.65 m from where it landed, body edge)'); const m=F[1]._talM[v.uid].kxWi; near(m.until-V.now(),9,'6 + 3 s',0.05);
  const r=lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'}))/plainHit(L,()=>lost(A[0],()=>V.hit(F[0],A[0],1000,{kind:'true'}))); near(r,0.95,'his ally takes 5% less from a Witnessed enemy');
  near(inRatio(L,{src:F[0]}),0.95,'and he does'); V.step(1); near(F[0].atkInterval,ai/(1-0.09),'Lasting Awe 9% slower');
  const h=F[0].hp; F[0].hp=5e8; VMX('healUnit')(F[0],1000); near(F[0].hp-5e8,1000*0.9,'Sunburn: 10% less healing'); F[0].hp=h;
  brnd(0.049); assert.equal(critP(L,F[0]),true,'Witness Marks'); brnd(0.051); assert.equal(critP(L,F[0]),false);
});

test('Korvux / Prefers the Second (PICK ONE: Witnessed as it lands are feared 0.5 s) and Never Confirmed (PICK ONE: 10% more from him, Nobody Argues 6 points more)',()=>{
  const L=kl(S(['pp_5_3']),{big:true}), {v,F}=L; star(L,F[1]); near(F[1].fearT,0.5,'feared 0.5 s',1e-6); assert.ok(F[1]._fearFrom===v,'from him');
  const L2=kl(S(['pp_5_2','pp_6_2']),{big:true}); star(L2,L2.F[1]); near(ratio(L2,L2.F[1]),1.16,'10% + 6 points');
  close(L2,L2.F[0]); const b=baseBurn(L2,L2.F[0]); near(lost(L2.F[0],()=>burnNow(L2))/b,1.16,'Emberskin too');
});

test('Korvux / Pieces: a death within 6 m (1, max 7), Pieces of Sky, Wartime, Loose Change, Heavens Owe, Steaming Hide, Paid Ahead (2 within 3 s of a landing), Paying Out',()=>{
  const L0=kl(null), d0=L0.v.dmg, mh=L0.v.maxHp, mr=L0.v.mrRating;
  const L=kl(S(['pp_1_4','pp_2_4','pp_6_4','pp_11_3','pp_5_4','pp_10_4','pp_11_4','pp_12_3']),{big:true,foes:6}), {v,F}=L; assert.equal(stack(L,'kxPc'),5,'Pieces of Sky: 5 at the start');
  kill(L,F[2]); assert.equal(stack(L,'kxPc'),5,'F2 died 11.7 m away (body to body): no Piece');
  at(L,F[5],0,-9.25); kill(L,F[5]); assert.equal(stack(L,'kxPc'),6,'F5 died 5.5 m away, body to body: a Piece'); setStack(L,'kxPc',5);
  kill(L,F[0]); assert.equal(stack(L,'kxPc'),6,'F0 within 6 m');
  openWin(L,'kxPa',3); kill(L,F[3]); assert.equal(stack(L,'kxPc'),7,'max 7');
  V.step(1); near(v.dmg/d0,1+0.012*7,'Wartime 0.4% x 3 x 7',1e-3); near(v.lifestealStat||0,0.07,'Heavens Owe 1% x 7'); near(v.mrRating,mr*1.10,'Steaming Hide'); setStack(L,'kxPc',2); const pc=stack(L,'kxPc'); V.wave(); V.step(1); assert.equal(stack(L,'kxPc'),pc,'Pieces of Sky only at the fight\'s start'); setStack(L,'kxPc',2); V.step(1); near(v.mrRating,mr,'no Steaming Hide at 2'); setStack(L,'kxPc',7); V.step(1);
  near(ratio(L,F[4]),1.10,'Paying Out at 7 Pieces'); setStack(L,'kxPc',6); near(ratio(L,F[4]),1,'not at 6');
  const L2=kl(S(['pp_1_4','pp_11_4']),{big:true,foes:3}); openWin(L2,'kxPa',3); kill(L2,L2.F[0]); assert.equal(stack(L2,'kxPc'),2,'Paid Ahead: 2'); L2.T.s.w.kxPa.t=0; at(L2,L2.F[1],5,0); kill(L2,L2.F[1]); assert.equal(stack(L2,'kxPc'),3,'outside it 1');
  const L3=kl(S(['pp_1_4','pp_11_4']),{big:true}); dash(L3); assert.ok(win(L3,'kxPa'),'a landing opens it'); near(winLeft(L3,'kxPa'),3,'3 s',0.05);
});

test('Korvux / What Came Down at Kellsmarch (SIGNATURE): Falling Star lands at 7 Pieces - again on the densest group at double size, Witnessed and feared 1 s, Pieces spent; once every 30 s',()=>{
  const L=kl(S(['pp_13_3','pp_1_4','pp_1_3']),{big:true,foes:5}), {v,F}=L; setStack(L,'kxPc',7); at(L,F[3],11,2); at(L,F[4],11,-2);
  const p0=VMX('densestEnemyCluster')(v,6*V.METER), tk0=V.now(); star(L,F[0]); free(v); v.energy=0; let h=null; for(let i=0;i<60;i++){ V.step(1); const G=VMX('groundHazards').filter(x=>x&&x.interval&&x.src===v); if(G.length>=2){ h=G[G.length-1]; break; } }
  assert.ok(h,'a second crater'); near(h.r/V.METER,12,'double size'); assert.equal(stack(L,'kxPc'),0,'Pieces spent');
  assert.ok(Math.hypot(h.x-p0.x,h.y-p0.y)<1,'on the densest group (the engine\'s own pick)'); for(const i of [1,3,4]){ assert.ok(mark(L,F[i],'kxWi'),'F'+i+' Witnessed'); assert.ok(F[i].fearT>0.8,'and feared 1 s'); }
  assert.equal(v.energy,0,'no energy spent');
  const t0=tk0; secs(Math.max(0,t0+28.5-V.now())); setStack(L,'kxPc',7); VMX('groundHazards.length=0'); star(L,F[0]); for(let i=0;i<60;i++) V.step(1); assert.equal(VMX('groundHazards').filter(x=>x&&x.interval&&x.src===v).length,1,'not again at 28.5 s');
  const L2=kl(S(['pp_13_3','pp_1_4']),{big:true,foes:3}); setStack(L2,'kxPc',6); star(L2,L2.F[0]); free(L2.v); for(let i=0;i<60;i++) V.step(1); assert.equal(VMX('groundHazards').filter(x=>x&&x.interval&&x.src===L2.v).length,1,'not at 6 Pieces');
});

test('Korvux / the caps: damage reduction one group at most 30%, crit one group at most 5%, slows at most 40% weaker, Unbothered 20%, ignore armour, the movement talents',()=>{
  const L=kl(S(['rh_1_2','rh_1_4','rh_9_3','rh_12_4','bs_9_4','bs_10_1','bs_12_4','pp_8_4','pp_1_3']),{big:true}), {v,F}=L; const f=F[0];
  setStack(L,'kxSt',5); setUst(L,f,'kxCk',3); f.t=Object.assign({},f.t,{row:'Back'}); setMk(L,f,'kxCr'); setMk(L,f,'kxWi'); openWin(L,'kxAg',9);
  near(inRatio(L,{src:f}),0.70,'all at once: 30% at most'); setStack(L,'kxSt',0); f.t=Object.assign({},f.t,{row:'Front'}); setUst(L,f,'kxCk',0,0); L.T.s.w.kxAg.t=0; L.T.s.k.kxSt.n=0;
  near(inRatio(L,{src:F[1]}),0.95*0.97*0.95,'Hard Scales, Iron Patience, Hot Scales multiply');
  L.T.s.k.kxSt.n=0; VMX('pushDot')(v,100,3,1,'#8f8fa8',F[1],'true'); const d=v.dots[v.dots.length-1]; const keep=FX.dotPre(v,d); const x=d.dps; FX.dotPost(v,d,keep); near(x/100,0.95*0.97*0.95,'damage over time too');
  const C=kl(S(['pp_1_1','rh_7_3','bs_6_1','bs_9_2','pp_9_1'])), g=C.F[0]; V.step(1); near(C.v.glyphCrit,0.05,'Violet Blood: 5% as a stat'); setUst(C,g,'kxCk',8); setMk(C,g,'kxCr'); setMk(C,g,'kxWi'); brnd(0); assert.equal(critP(C,g,{cur:'charge'}),false,'the stat fills the 5%: nothing more');
  const W=kl(S(['rh_12_1','bs_11_4','pp_11_1'])); W.v.slow=2; W.v.slowMul=0.5; V.step(1); near(W.v.slowMul,1-0.5*0.6,'64% asked, 40% given');
  const U=kl(S(['rh_4_1'])); free(U.v); U.v.level=1; V.cc(U.F[0],U.v,'stunned',2); near(U.v.stunned,V.ccNerf*2*0.8,'Unbothered 20%',1e-3);
  const I=kl(S(['rh_3_3'])); const a=lost(I.F[0],()=>V.hit(I.v,I.F[0],1000,{kind:'phys'})), b=plainHit(I,()=>lost(I.F[0],()=>V.hit(I.v,I.F[0],1000,{kind:'phys'}))); assert.ok(a>b,'his hits ignore armour');
  const M0=kl(null).v.speed, M=kl(S(['rh_5_4','bs_2_2','pp_5_1'])); V.step(1); near(M.v.speed,M0*1.27,'9% x 3');
});

test('Korvux: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['rh_1_1','rh_1_2','rh_4_2','bs_1_1','bs_1_4','pp_1_3','pp_1_4','rh_11_2']), TEAM=['vael','sylthaine','vireo','vex','korvux'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let ag=false,cr=false,wi=false,cook=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n); if(T0.w.kxAg&&T0.w.kxAg.t>0) ag=true;
    for(const f of VMX('units').filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o.kxCr) cr=true; if(o.kxWi) wi=true; if(o['#kxCk']) cook++; } }
  console.log('  live fight: max '+JSON.stringify(mx)+', Afterglow '+ag+', Cratered '+cr+', Witnessed '+wi+', ticks with Cooking on an enemy '+cook);
  assert.ok(ag,'a real Afterglow'); assert.ok(mx.kxSt>=1,'real Steam'); assert.ok(wi,'a real Witnessed');
  determinism(H,TEAM);
});

/* The page sites his talents added (Emberskin's clock, reach and burn; the charge's target; Falling Star's crater kept; a crater tick of his): with nothing learned, whole
   seeded fights with Korvux in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. The counters are also the base-skill measure of the report. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Korvux: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['korvux','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','ceraline','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __kvN={tick:0,burn:0,dash:0,star:0,hz:0}; var __kvD=_doEffectCore, __kvT=dotTickAmt, __kvU=_updateBattleCore;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="korvux"&&(!o||!o.deliver||o._arrived)){ if(type==="charge") __kvN.dash++; if(type==="ashfall") __kvN.star++; } return __kvD.apply(this,arguments); };'+
    'dotTickAmt=function(s,t,a,k){ if(s&&s.key==="korvux"){ if(s.pass&&s.pass.immolate&&Math.abs(a-s.dmg*SKLV.immolate(passLv(s)))<1e-9) __kvN.burn++; else __kvN.hz++; } return __kvT.apply(this,arguments); };'+
    '_updateBattleCore=function(dt){ for(const u of units) if(u&&u.key==="korvux"&&u.alive) __kvN.tick++; return __kvU.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    /* a scripted burn on an enemy placed inside Emberskin (it reaches nobody in real fights: the per-enemy site is run here) */
    const RS=`(function(al,fo){ ended=false; state='battle'; CUR={mode:'replay',seed:9}; battleTime=0; gameSpeed=1; window._p2win=null; autoUlt=true; try{groundHazards.length=0;shots.length=0;particles.length=0;floatTexts.length=0;}catch(e){} waveXfer=null; chapterWaves=1; waveIdx=0; seedBattle(9); setupMarchTeams(al,fo,false);
      const k=units.find(u=>u.key==='korvux'), f=units.find(u=>u.team==='enemy'); k.x=300; k.y=700; let hs=[];
      for(let i=0;i<90;i++){ f.x=k.x+2.2*METER; f.y=k.y; f._pullGhost=true; updateBattle(SIM_STEP); hs.push(Math.round(f.hp)); } return JSON.stringify([hs,brnd()]); })`;
    const sc=h=>{ const al=JSON.stringify(h.snapFromSpecs([spec('korvux',100)])), fo=JSON.stringify(h.snapFromSpecs([spec('vael',100)])); return vm.runInContext(RS+'('+al+','+fo+')',h.ctx); };
    assert.equal(sc(NOW),sc(BASE),'a scripted Emberskin on an enemy at 2.2 m: identical'); n++;
    const c=VMX('__kvN'); console.log('  identity / base skills: '+JSON.stringify(c)+' (burns per tick alive '+(c.burn/Math.max(1,c.tick)).toFixed(5)+', crater ticks per Falling Star '+(c.hz/Math.max(1,c.star)).toFixed(1)+')');
    assert.ok(c.tick>0&&c.dash>0&&c.star>0&&c.hz>0&&c.burn>0,'the fights ran Emberskin (and burned), cast Comet Dash and Falling Star, and its crater ticked: every new site was run'); }
  finally{ VMX('_doEffectCore=__kvD; dotTickAmt=__kvT; _updateBattleCore=__kvU;'); }
  assert.ok(n>=19);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at 85% or more for more than half a battle is too strong.
   His damage reduction talents (and armor / magic resist / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ rh:['rh_1_2','rh_1_4','rh_9_3','rh_12_4','rh_8_3','rh_11_4','rh_5_1','rh_4_1'],
            bs:['bs_9_4','bs_10_1','bs_12_4','bs_5_4','bs_8_4','bs_1_1'],
            pp:['pp_1_3','pp_8_4','pp_5_4','pp_8_2','pp_9_2','pp_6_4'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={rh:0,bs:1,pp:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (5 Steam, the attacker Cooking, in the back row, Cratered and Witnessed, Afterglow on);
   sustained: a usual state (2 Steam, the attacker in the front row, not Cooking, nothing else, a basic attack of 5% of his max HP). Measured through the engine */
function worstHit(list,kind,crit,sustained){ const L=kl(list,{foes:3}), {v,F}=L, f=F[0];
  v.maxHp=1e5; v.hp=sustained?8e4:6e4;
  if(L.T){ if(!sustained){ setStack(L,'kxSt',5); setUst(L,f,'kxCk',8); f.t=Object.assign({},f.t,{row:'Back'}); setMk(L,f,'kxCr'); setMk(L,f,'kxWi'); openWin(L,'kxAg',9); }
    else setStack(L,'kxSt',2); }
  V.step(1); if(L.T){ if(!sustained) setStack(L,'kxSt',5); else setStack(L,'kxSt',2); }
  v.shield=1e12; v.shieldT=999;
  const raw=sustained?5e3:2e4, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:true})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1;
  return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Korvux: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['rh','bs'],[61,30]],[['rh'],[91]],[['bs','rh'],[61,30]],[['rh','pp'],[61,30]],[['pp','rh'],[61,30]],[['bs','pp'],[61,30]],[['rh','bs','pp'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false));
    c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0,gl:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="korvux"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="korvux"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    const T=u._tal; if(T&&T.s.api){ let w=0; for(const e of units){ if(!e.alive||e.team===u.team) continue; const k=T.fn.drK(T.s.api,T,u,e)*Math.max(defMul(e,u,"phys"),defMul(e,u,"magic"))*(u.drMul||1)*(1-(u.glyphDR||0)); if(1-k>w) w=1-k; } if(w>=0.85) __dr.tHi++; if(w>__dr.gl) __dr.gl=w; } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','korvux'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; ticks at 85% or more against the strongest-reduced attacker '+d.tHi+' of '+d.ticks+' ('+(100*d.tHi/Math.max(1,d.ticks)).toFixed(1)+'%, the highest '+(d.gl*100).toFixed(1)+'%); immune '+d.imm);
    assert.ok(d.n>50&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0); assert.equal(d.imm,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.5*d.ticks,'above 85% for less than half of the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});

/* The stun-lock rule in real fights: his talent stuns (Second Stroke, Called Down's line) and his skill's stun (Comet Dash, made longer by Staggering / Farthest Always):
   the longest time one enemy stays stunned by him in a row, and every talent stun obeys the rule */
test('Korvux: in seeded fights with his stun build, no enemy stays stunned by him long in a row, and his talent stuns obey the stun-lock rule',()=>{
  const list=T.learned(H,build(H,1,91,100));
  VMX('var __st={runs:[],cur:{},talent:0,bad:0,last:{}}; var __sc=ccApply, __su=_updateBattleCore;'+
    'ccApply=function(u,t,f,d){ const r=__sc.apply(this,arguments); if(r&&u&&u.key==="korvux"&&f==="stunned") t.__kxS=1; return r; };'+
    '_updateBattleCore=function(dt){ const r=__su.apply(this,arguments); for(const e of units){ if(e.team==="ally") continue; const id=e.uid; const on=e.alive&&(e.stunned||0)>0&&e.__kxS;'+
    '  if(on){ __st.cur[id]=(__st.cur[id]||0)+dt; } else { if(__st.cur[id]) __st.runs.push(__st.cur[id]); __st.cur[id]=0; if(!((e.stunned||0)>0)) e.__kxS=0; } } return r; };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','korvux'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const s=VMX('__st'); for(const k in s.cur) if(s.cur[k]) s.runs.push(s.cur[k]); const mx=Math.max(0,...s.runs);
    console.log('  stun chain (91 One Burning Stride): '+s.runs.length+' runs of an enemy stunned by him, the longest '+mx.toFixed(2)+' s');
    assert.ok(s.runs.length>0,'he stunned someone'); assert.ok(mx<=4.0+0.05,'never past 4 s in a row: '+mx.toFixed(2)); }
  finally{ VMX('ccApply=__sc; _updateBattleCore=__su;'); }
});
