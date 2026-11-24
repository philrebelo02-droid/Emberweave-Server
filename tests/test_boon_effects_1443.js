/* v1443 - THE BONUS-STAGE BOONS DO WHAT THEIR CARDS SAY.
   Phil, 24 Nov 2026, on the scan that found every boon pick only raised a counter: "Add the effects, dont hide them" /
   "Add them and make them fully functional".

   For EVERY offerable boon (71 of the catalogue's 107) this starts a real bonus run in the game's own code (the page's script in
   the server's headless host - no browser), takes the run to a firebreak, picks the boon through the real offer / pick / confirm
   path, and asserts that what the card says is in force: the stat moved by the stated amount, or the stated thing fires when its
   roll succeeds and does not when it fails. Then: stacking, lasting through every wave, crossing roads, Inheritance, the offer
   fitting the road as it stands NOW, the sane number scale, clean-up at the end of the run, and determinism.
   Run alone:  node tests/test_boon_effects_1443.js */
'use strict';
const path=require('path'), vm=require('vm'), fs=require('fs');
const ROOT=path.join(__dirname,'..');
const BOONS=require(path.join(ROOT,'server','bonus-boons.js'));
const STAGES=require(path.join(ROOT,'server','bonus-stages.js'));
const SIM=require(path.join(ROOT,'server','sim.js'));
let pass=0, fail=0; const fails=[];
const VERBOSE=process.argv.indexOf('-v')>=0;
function ok(c,m){ if(c){ pass++; if(VERBOSE) console.log('  ok: '+m); } else { fail++; fails.push(m); console.log('  FAIL: '+m); } }

/* ---------------------------------------------------------------- the server side */
const READY=BOONS.readyNow(), IDS=READY.map(b=>b.id);
ok(BOONS.CATALOGUE.length===107, 'the catalogue has 107 boons ('+BOONS.CATALOGUE.length+')');
ok(READY.length===71, '71 boons are offerable ('+READY.length+')');
{ /* the number scale: no compounding, a share of the road's heroes */
  const iron=BOONS.CATALOGUE.find(b=>b.id==='bighp'), mend=BOONS.CATALOGUE.find(b=>b.id==='regen'), focus=BOONS.CATALOGUE.find(b=>b.id==='energy');
  for(const L of [1,30,60,86,100]){ const ref=BOONS.refFor(L);
    ok(Math.abs(BOONS.magnitude(iron,L)-Math.round(0.15*ref.hp))<=1, 'Ironhide at Commander '+L+' is 15% of a typical hero ('+BOONS.magnitude(iron,L)+' of '+Math.round(ref.hp)+')');
    ok(BOONS.magnitude(mend,L)<=0.011*ref.hp+1, 'Mending at Commander '+L+' is about 1% of health a second ('+BOONS.magnitude(mend,L)+')');
    ok(BOONS.magnitude(focus,L)===14, 'Focus is +14 energy a second at every level ('+BOONS.magnitude(focus,L)+')'); }
  ok(BOONS.magnitude(iron,100)<10000, 'no "+83,225 maximum health" at Commander 100 ('+BOONS.magnitude(iron,100)+')');
  ok(BOONS.magnitude(iron,100,{hp:20000,atk:300})===3000, 'a flat boon is measured from the road it is offered to (15% of 20,000 = 3,000)');
  for(const b of READY.filter(b=>b.scale)) ok(!!BOONS.SHARE[b.id], b.id+' has a share');
  ok(BOONS.BOON_SCALE_PER_LEVEL===0 && BOONS.scaleFor(100)===1, 'the x1.06-per-level compounding is gone');
}
{ /* hero() reaches the road tests */
  const hero=k=>SIM.HERO_BASE[k]||null;
  const p=BOONS.laneProfile(['fritz','vael'],hero,{}), q=BOONS.laneProfile(['fritz','vael'],null,{});
  ok(p.caster===true && q.caster===false, 'with hero() a road with a caster is a caster road (without it the test is always false)');
  ok(BOONS.laneProfile(['vael','yenna'],hero,{}).mixedRows===true, 'with hero() front + back heroes are mixed rows');
  const t=['fritz','vael','hurne','oakmir'].map(k=>BOONS.heroTags(k,hero));
  const a=BOONS.profileFromTags(t,{}), b=BOONS.laneProfile(['fritz','vael','hurne','oakmir'],hero,{});
  ok(['n','summoner','healer','caster','mixedRows','room','otherRoad'].every(k=>a[k]===b[k]), 'a road profile from hero tags equals laneProfile()');
  ok(BOONS.CATALOGUE.find(x=>x.id==='castsstack').req==='caster', 'Rhythm (ability power) is only for a road with a caster');
  const src=fs.readFileSync(path.join(ROOT,'server.js'),'utf8');
  ok(/isUnlocked:k=>!!ownsHeroK\(led,k\),\s*hero:k=>/.test(src), 'server.js hands hero() to the bonus routes');
  const deck=STAGES.boonDeck(4242,{hero},{1:['vael','hurne'],2:['fritz'],3:['oakmir']});
  ok(deck && deck.order.length===4 && deck.order.every(w=>w.length===3 && w.every(o=>o.length===71 && new Set(o).size===71)), 'Start hands the page the whole offerable deck, in order, for 4 windows x 3 roads');
  ok(JSON.stringify(deck.order)===JSON.stringify(STAGES.boonDeck(4242,{hero},{1:['vael','hurne'],2:['fritz'],3:['oakmir']}).order), 'the order is fixed by the run seed');
  ok(JSON.stringify(deck.order)!==JSON.stringify(STAGES.boonDeck(4243,{hero},{1:['vael'],2:['fritz'],3:['oakmir']}).order), 'another run, another order');
  ok(deck.tags.hurne.s===1 && deck.tags.oakmir.h===1 && deck.tags.fritz.c===1 && deck.tags.vael.r==='Front', 'the deck says what each hero is');
}

/* ---------------------------------------------------------------- the fight, in the page's own code */
const host=require(path.join(ROOT,'server','sim-host.js')).load(path.join(ROOT,'emberweave-heroes.html'));
const CAMP=(()=>{ const raw=JSON.parse(fs.readFileSync(path.join(ROOT,'server','campaign-encounters.json'),'utf8')); return Array.isArray(raw)?raw:Object.values(raw.byNode||raw); })();
const LANES_CACHE={};
host.sandbox.__mkStart=function(assignJson, seed, id){ const assign=JSON.parse(assignJson); id=id||'3-7';
  const [ch,slot]=id.split('-').map(Number);
  const lanes=LANES_CACHE[id]||(LANES_CACHE[id]=JSON.stringify(STAGES.buildLanes(CAMP,ch,slot)));
  const deck=STAGES.boonDeck(seed>>>0,{hero:k=>SIM.HERO_BASE[k]||null},assign);
  return JSON.stringify({ ok:true, attemptId:'att-'+seed, id, lanes:JSON.parse(lanes), boonOffers:[], boonLevel:30, boonDeck:deck }); };
host.sandbox.__IDS=JSON.stringify(IDS);
host.sandbox.__CATV=JSON.stringify(Object.fromEntries(BOONS.CATALOGUE.map(b=>[b.id,b.v])));

function vmTests(){
  const R=[]; const covered={};
  const check=(c,m)=>{ R.push([!!c,String(m)]); };
  const near=(a,b,e)=>Math.abs(a-b)<=(e==null?1e-6:e)*Math.max(1,Math.abs(b));
  const A0={1:['vael','hurne','oakmir','fritz','yenna'],2:['vex','tick','askel','rivet','sylthaine'],3:['gruel']};
  const ALL=[].concat(A0[1],A0[2],A0[3],['mirelle','aureth','sloe','carn','astra']);
  G.playerXP=1e12; if(!G.glyphRank) G.glyphRank={};
  for(const k of ALL){ G.unlocked[k]=true; G.heroXP[k]=1e12; G.glyphRank[k]=15; }
  try{ if(typeof RUNE2!=='undefined') RUNE2.enabled=false; }catch(e){}
  const T={verdict:null};
  gsplitFinish=function(v){ T.verdict=v; GSPLIT._finishing=true; };
  function end(){ if(!GSPLIT.active) return; try{ gsplitWindowHide(); }catch(e){} gsplitEnd(); GSPLIT._finishing=false; }
  function start(assign,seed,id){ end(); T.verdict=null; const a=assign||A0; const d=JSON.parse(__mkStart(JSON.stringify(a),seed||1,id||'3-7'));
    gsplitEnterBattle(d,a,id||'3-7',null); return d; }
  const H=i=>GSPLIT.lanes[i].units.filter(u=>u.team==='ally'&&u.alive&&!u._summon&&!u._wasSummon);
  const E=i=>GSPLIT.lanes[i].units.filter(u=>u.team==='enemy'&&u.alive);
  const hero=(i,k)=>GSPLIT.lanes[i].units.find(u=>u.key===k&&u.team==='ally');
  function step(n){ for(let i=0;i<n;i++) gsplitStep(SIM_STEP); }
  function clearWave(){ for(const L of GSPLIT.lanes) if(L.state==='walking'&&L.waveIdx<=GSPLIT.waveShown) for(const e of L.units) if(e.team==='enemy'&&e.alive){ e.hp=0; e.alive=false; e.deathT=0; } }
  function toWindow(){ for(let i=0;i<6000&&!gsplitWindowOpen()&&!T.verdict;i++){ if(i%20===0) clearWave(); gsplitStep(SIM_STEP); } return gsplitWindowOpen(); }
  function order(picks){ const w=GSPLIT.waveShown; for(const k in picks){ const o=GSPLIT.boonDeck.order[w][k]; GSPLIT.boonDeck.order[w][k]=[picks[k]].concat(o.filter(x=>x!==picks[k])); } }
  function open(picks){ order(picks||{}); if(!toWindow()) throw new Error('no firebreak opened'); }
  function take(picks){ const got={}; for(const k in picks){ const L=GSPLIT.lanes[k];
      if(!gsplitPickBoon(+k,picks[k])) throw new Error(picks[k]+' was not offered on road '+k+' (offered: '+(L.offer||[]).map(b=>b.id).join(',')+')');
      got[k]=L.offer.find(b=>b.id===picks[k]); covered[picks[k]]=1; }
    GSPLIT.window.phase='move'; gsplitBoonsCommit(); return got; }
  function close(){ for(let i=0;i<3000&&!gsplitStartAllowed();i++) gsplitStep(SIM_STEP); if(!gsplitCloseWindow()) throw new Error('START refused'); }
  /* run code as the fight runs it: with one road loaded */
  function inLane(i,fn){ const L=GSPLIT.lanes[i]; gsplitLoad(L); gsplitFxSwapIn(L); gsplitLoadWaves(L);
    try{ return fn(L); } finally{ gsplitSaveWaves(L); gsplitFxSwapOut(L); gsplitSave(L); units=GSPLIT.lanes.reduce((a,x)=>a.concat(x.units),[]); } }
  const tick=(i,dt)=>inLane(i,()=>BoonFx.tick(dt||0));
  function rng(v,fn){ const p=_brng; _brng=()=>v; try{ return fn(); } finally{ _brng=p; } }
  function big(e){ e.maxHp=1e9; e.hp=1e9; e.shield=0; e.dots=[]; return e; }
  /* one hit of `amt` true damage; returns the health it removed */
  function hit(src,tgt,amt,auto,pre){ const h0=tgt.hp; tgt._critHit=false; _preCrit=(pre===undefined?false:pre); _autoAtk=auto?1:0;
    try{ dealDamage(src,tgt,amt,'#fff','true'); } finally{ _preCrit=null; _autoAtk=0; } return h0-tgt.hp; }
  function taken(u,amt){ const h0=u.hp, s=u.shield; u.shield=0; damage(u,amt,'#fff',true); const d=h0-u.hp; u.hp=h0; u.shield=s; return d; }
  function kill(by,e){ e.hp=1; e.shield=0; return hit(by,e,1e7,true); }
  /* the standard scene: firebreak 1 open, boon `id` taken on road `lane` (default 0) */
  function scene(id,lane,assign,seed){ start(assign,seed); const p={}; p[lane||0]=id; open(p); return p; }
  function T1(id,fn,lane,assign){ try{ fn(); }catch(e){ check(false,id+': threw '+(e&&e.stack||e).toString().slice(0,400)); } }
  /* an auto attack with the roll forced to v: did `probe` come true? Also checks the stated chance exactly. */
  function autoProc(id,p,arm,probe,opts){ T1(id,()=>{ scene(id,0); const base={}; take({0:id}); tick(0);
      inLane(0,()=>{ const h=hero(0,'vael'), e=big(E(0)[0]);
        arm(e,h); rng(0.99,()=>hit(h,e,100,true)); check(!probe(e,h), id+': nothing happens when the roll fails');
        arm(e,h); rng(p+0.0005,()=>hit(h,e,100,true)); check(!probe(e,h), id+': a roll just above '+Math.round(p*100)+'% fails');
        arm(e,h); rng(Math.max(0,p-0.0005),()=>hit(h,e,100,true)); check(probe(e,h), id+': a roll just under '+Math.round(p*100)+'% on an auto attack does what the card says');
        if(!(opts&&opts.anyHit)){ arm(e,h); rng(0,()=>hit(h,e,100,false)); check(!probe(e,h), id+': a cast is not an auto attack'); }
        const o=hero(1,'vex'); }); }); }

  /* ================= PROC ================= */
  autoProc('stunstrike',0.10,e=>{e.stunned=0;},e=>e.stunned===1);
  autoProc('freezehit',0.08,e=>{e.stunned=0;e._frozenT=0;},e=>e.stunned===1.5&&e._frozenT===1.5);
  autoProc('fearhit',0.07,e=>{e.fearT=0;},e=>e.fearT===2);
  autoProc('slowfield',0.20,e=>{e.slow=0;e.slowMul=null;},e=>e.slow===3&&e.slowMul===0.5);
  autoProc('taunthit',0.10,e=>{e.forcedTarget=null;e.forcedTargetT=0;},(e,h)=>e.forcedTarget===h&&e.forcedTargetT===3);
  autoProc('burnproc',0.22,e=>{e.dots=[];},(e,h)=>e.dots.length===1&&near(e.dots[0].dps,Math.max(h.dmg,h.apow||0)*0.12)&&e.dots[0].remaining===3);
  autoProc('mortalhit',0.15,e=>{e._bnNoHealT=0;},e=>(e._bnNoHealT||0)>0);
  T1('mortalhit',()=>{ inLane(0,()=>{ const h=hero(0,'vael'), e=big(E(0)[0]); e._bnNoHealT=0; rng(0,()=>hit(h,e,100,true)); e.hp=1000; healUnit(e,500);
      check(e.hp===1000, 'mortalhit: the target cannot be healed for 3 seconds'); const bt=battleTime; battleTime=bt+3.01; e.mortalT=0; healUnit(e,500); battleTime=bt;
      check(e.hp===1500, 'mortalhit: after 3 seconds it can be healed again ('+e.hp+')'); }); });
  autoProc('sleepproc',0.06,e=>{e._sleepT=0;e.stunned=0;},e=>e._sleepT>0&&e.stunned>0);
  T1('sleepproc',()=>{ inLane(0,()=>{ const h=hero(0,'vael'), e=big(E(0)[0]); e._sleepT=0; e.stunned=0; rng(0,()=>hit(h,e,100,true)); const asleep=e._sleepT>0;
      rng(0.99,()=>hit(hero(0,'yenna'),e,100,true)); check(asleep&&e._sleepT===0&&e.stunned===0, 'sleepproc: it sleeps until it is struck again'); }); });
  T1('doublestrike',()=>{ scene('doublestrike',0); inLane(0,()=>{ const h=hero(0,'vael'), e=big(E(0)[0]); T.b=rng(0.99,()=>hit(h,e,100,true)); });
    take({0:'doublestrike'}); tick(0); inLane(0,()=>{ const h=hero(0,'vael'), e=big(E(0)[0]);
      check(near(rng(0.99,()=>hit(h,e,100,true)),T.b), 'doublestrike: one blow when the roll fails');
      check(near(rng(0.1495,()=>hit(h,e,100,true)),2*T.b), 'doublestrike: an auto attack strikes twice on a roll under 15%');
      check(near(rng(0.1505,()=>hit(h,e,100,true)),T.b), 'doublestrike: not on a roll over 15%');
      check(near(rng(0,()=>hit(h,e,100,false)),T.b), 'doublestrike: a cast does not strike twice'); }); });
  T1('critconvert',()=>{ scene('critconvert',0); take({0:'critconvert'}); tick(0); inLane(0,()=>{ const h=hero(0,'vael'), e=big(E(0)[0]);
      const b=rng(0.99,()=>hit(h,e,100,true)); check(e._critHit===false, 'critconvert: no crit when the roll fails');
      const c=rng(0.0995,()=>hit(h,e,100,false)); check(e._critHit===true&&c>b*1.3, 'critconvert: any attack is a guaranteed critical on a roll under 10% ('+(c/b).toFixed(2)+'x)');
      rng(0.1005,()=>hit(h,e,100,true)); check(e._critHit===false, 'critconvert: not on a roll over 10%'); }); });
  T1('blinkdodge',()=>{ scene('blinkdodge',0); take({0:'blinkdodge'}); tick(0); inLane(0,()=>{ const h=hero(0,'vael'), e=E(0)[0]; h.shield=0;
      check(rng(0.1195,()=>hit(e,h,50,true))===0, 'blinkdodge: a hit is avoided whole on a roll under 12%');
      check(rng(0.1205,()=>hit(e,h,50,true))>0, 'blinkdodge: it lands on a roll over 12%'); }); });
  T1('silencecast',()=>{ scene('silencecast',0); take({0:'silencecast'}); tick(0); inLane(0,()=>{ const h=hero(0,'fritz'), e=big(E(0)[0]);
      e.silencedT=0; rng(0.1195,()=>BoonFx.cast(h,'green')); hit(h,e,100,false); check(e.silencedT===2, 'silencecast: a cast that rolls under 12% silences what it hits for 2 seconds');
      e.silencedT=0; rng(0.1205,()=>BoonFx.cast(h,'green')); hit(h,e,100,false); check(!e.silencedT, 'silencecast: not on a roll over 12%');
      e.silencedT=0; rng(0,()=>BoonFx.cast(h,'green')); rng(0.99,()=>hit(h,e,100,true)); check(!e.silencedT, 'silencecast: an auto attack does not silence'); }); });
  function onKill(id,arm,probe,p,label){ T1(id,()=>{ scene(id,0); const got=take({0:id}); tick(0); inLane(0,()=>{ const h=hero(0,'vael'), es=E(0);
        arm(h,got[0]); rng(p==null?0.5:p+0.0005,()=>kill(h,es[0])); if(p!=null) check(!probe(h,got[0]), id+': nothing on a roll over '+Math.round(p*100)+'%');
        if(p!=null){ arm(h,got[0]); rng(p-0.0005,()=>kill(h,es[1])); } check(probe(h,got[0]), id+': '+label); }); }); }
  onKill('cdreset',h=>{h.greenCd=9;},h=>h.greenCd===0,0.10,'a kill under 10% refreshes the green cooldown');
  onKill('ultcharge',h=>{h.energy=10;},h=>h.energy===30,0.25,'a kill under 25% grants 20 energy');
  onKill('killresets',h=>{h.greenCd=9;h.blueCd=9;},h=>h.greenCd===7&&h.blueCd===7,null,'every kill takes 2 seconds off both cooldowns');
  onKill('shieldstack',h=>{h.shield=0;h._bnSh=0;},(h,o)=>h.shield===o.value&&o.value>0,null,'every kill leaves the stated shield');
  T1('shieldstack',()=>{ inLane(0,()=>{ const h=hero(0,'vael'), v=h.shield; h.shieldT=0.01; waveXfer=null; BoonFx.tick(0); updateBattle(SIM_STEP); updateBattle(SIM_STEP);
      check(h.shield>=v-1e-6&&v>0, 'shieldstack: the shield does not expire when a timed shield would ('+h.shield+' of '+v+')'); }); });
  T1('shieldstack',()=>{ scene('shieldstack',0); const got=take({0:'shieldstack'}); close(); const h=hero(0,'vael'), v=got[0].value; inLane(0,()=>{ h.shield=0; h._bnSh=0; kill(h,E(0)[0]); kill(h,E(0)[0]); });
    check(near(h.shield,2*v), 'shieldstack: two kills, two shields ('+h.shield+')'); open({}); check(near(h.shield,2*v), 'shieldstack: the shield is still there when the wave has ended and the next firebreak opens ('+h.shield+' of '+2*v+')');
    take({}); close(); step(60); tick(0); check(near(h.shield,2*v)&&near(h._bnSh,2*v), 'shieldstack: and in the wave after that');
    inLane(0,()=>{ h.shield=0; h._bnSh=0; for(let i=0;i<200;i++) BoonFx.death({team:'enemy'},h); }); check(near(h.shield,h.maxHp)&&near(h._bnSh,h.maxHp), 'shieldstack: the kept shield stops at the hero own maximum health ('+Math.round(h.shield)+' of '+Math.round(h.maxHp)+')');
    inLane(0,()=>{ h.shield=h._bnSh=0; h.shield=500; h.shieldT=3; }); open({}); check(h.shield===0, 'shieldstack: a timed shield from a skill still ends with the wave'); });
  T1('shieldproc',()=>{ scene('shieldproc',0); const got=take({0:'shieldproc'}); close(); const h=hero(0,'vael'); inLane(0,()=>{ h.shield=0; h._bnSh=0; rng(0,()=>hit(E(0)[0],h,1,true)); }); const s=h.shield;
    open({}); take({}); close(); check(s>0&&near(h.shield,s), 'shieldproc: the Bulwarked shield also lasts across the wave end ('+h.shield+' of '+s+')'); });
  T1('healproc',()=>{ scene('healproc',0); const got=take({0:'healproc'}); tick(0); inLane(0,()=>{ const h=hero(0,'vael'), low=hero(0,'yenna'), es=E(0); low.hp=low.maxHp*0.1;
      rng(0.1505,()=>kill(h,es[0])); check(near(low.hp,low.maxHp*0.1), 'healproc: no heal on a roll over 15%');
      rng(0.1495,()=>kill(h,es[1])); check(near(low.hp,low.maxHp*0.1+got[0].value)&&got[0].value>0, 'healproc: a kill under 15% heals the lowest hero on the road for the stated amount'); }); });
  T1('summonproc',()=>{ scene('summonproc',0); take({0:'summonproc'}); tick(0); let s=null; inLane(0,()=>{ const h=hero(0,'vael'), es=E(0);
      rng(0.0605,()=>kill(h,es[0])); check(!units.some(u=>u._bnCalled), 'summonproc: no warrior on a roll over 6%');
      rng(0.0595,()=>kill(h,es[1])); s=units.find(u=>u._bnCalled); check(!!s&&s.alive&&s.team==='ally'&&s._summonOwner===h, 'summonproc: a kill under 6% calls a warrior to the killer\'s side'); });
    close(); check(!!s&&!s.alive, 'summonproc: the warrior is for the wave - it goes at the next firebreak'); });
  T1('shieldproc',()=>{ scene('shieldproc',0); const got=take({0:'shieldproc'}); tick(0); inLane(0,()=>{ const h=hero(0,'vael'), e=E(0)[0]; h.shield=0; h._bnSh=0;
      rng(0.1805,()=>hit(e,h,10,true)); check(h.shield===0, 'shieldproc: no shield on a roll over 18%');
      rng(0.1795,()=>hit(e,h,10,true)); check(h.shield===got[0].value&&got[0].value>0, 'shieldproc: taking a hit under 18% raises a shield worth the stated amount ('+h.shield+')'); }); });
  T1('ultrefund',()=>{ scene('ultrefund',0); take({0:'ultrefund'}); tick(0); inLane(0,()=>{ const h=hero(0,'vael'); h.energy=0; rng(0.2005,()=>BoonFx.ult(h)); check(h.energy===0, 'ultrefund: no refund on a roll over 20%');
      rng(0.1995,()=>BoonFx.ult(h)); check(h.energy===50, 'ultrefund: an ultimate under 20% refunds half its energy'); }); });

  /* ================= RULE ================= */
  T1('ultcheap',()=>{ scene('ultcheap',0); take({0:'ultcheap'}); tick(0); inLane(0,()=>{ const h=hero(0,'vael'); h.target=E(0)[0]; h.energy=100; h.stunned=0; castAbility(h);
      check(h.energy===30, 'ultcheap: a real ultimate costs 30% less - 30 of its 100 energy stays ('+h.energy+')'); }); });
  T1('critchain',()=>{ scene('critchain',0); take({0:'critchain'}); tick(0); inLane(0,()=>{ const h=hero(0,'vael'), e=big(E(0)[0]);
      rng(0.99,()=>hit(h,e,100,true)); check(e._critHit===false, 'critchain: nothing before a crit');
      rng(0.99,()=>hit(h,e,100,true,true)); const c1=e._critHit; rng(0.99,()=>hit(h,e,100,true)); const c2=e._critHit; rng(0.99,()=>hit(h,e,100,true)); const c3=e._critHit;
      check(c1===true&&c2===true&&c3===false, 'critchain: a critical hit makes the next attack a critical too (and that one does not chain on) '+[c1,c2,c3]); }); });
  T1('deathblast',()=>{ scene('deathblast',0); const got=take({0:'deathblast'}); tick(0); inLane(0,()=>{ const h=hero(0,'vael'), es=E(0), a=es[0], b=big(es[1]), c=big(es[2]);
      b.x=a.x+5; b.y=a.y; c.x=a.x+4000; c.y=a.y; b.pass=null; b.glyphDR=0; kill(h,a);
      check(near(1e9-b.hp,got[0].value)&&got[0].value>0, 'deathblast: an enemy you kill explodes for the stated amount on what is near it ('+(1e9-b.hp)+' vs '+got[0].value+')');
      check(c.hp===1e9, 'deathblast: not on an enemy far away'); }); });
  T1('firstcast',()=>{ scene('firstcast',0); take({0:'firstcast'}); close(); inLane(0,()=>{ const h=hero(0,'fritz'); BoonFx.cast(h,'green'); h.greenCd=9; BoonFx.tick(0);
      check(h.greenCd===0, 'firstcast: the first cast of the wave costs nothing (its cooldown is back at once)');
      BoonFx.cast(h,'green'); h.greenCd=9; BoonFx.tick(0); check(h.greenCd===9, 'firstcast: the second cast costs as usual');
      const v=hero(0,'vael'); v.energy=0; BoonFx.ult(v); check(v.energy===100, 'firstcast: when the first cast is the ultimate, its energy stays');
      v.energy=0; BoonFx.ult(v); check(v.energy===0, 'firstcast: only the first'); });
    open({}); take({}); close(); inLane(0,()=>{ const h=hero(0,'fritz'); BoonFx.cast(h,'blue'); h.blueCd=9; BoonFx.tick(0); check(h.blueCd===0, 'firstcast: again in the next wave'); }); });
  T1('lowhpimmune',()=>{ scene('lowhpimmune',0); take({0:'lowhpimmune'}); inLane(0,()=>{ const h=hero(0,'vael'); h.hp=h.maxHp*0.5; h.stunned=3; h.fearT=2; h._frozenT=2; BoonFx.tick(0);
      check(h.stunned===3&&h.fearT===2, 'lowhpimmune: above a quarter health control still lands');
      h.hp=h.maxHp*0.24; BoonFx.tick(0); check(h.stunned===0&&h.fearT===0&&h._frozenT===0, 'lowhpimmune: below a quarter health no stun, freeze or fear holds'); }); });
  T1('healtoshield',()=>{ scene('healtoshield',0); take({0:'healtoshield'}); tick(0); inLane(0,()=>{ const h=hero(0,'vael'); h.shield=0; h._bnSh=0; h.hp=h.maxHp-100; healUnit(h,300);
      check(near(h.hp,h.maxHp)&&near(h.shield,200), 'healtoshield: healing above full health becomes a shield (+'+h.shield+')'); });
    inLane(1,()=>{ const h=hero(1,'vex'); h.shield=0; h.hp=h.maxHp-100; healUnit(h,300); check(h.shield===0, 'healtoshield: not on a road that did not take it'); }); });
  T1('revengekill',()=>{ scene('revengekill',0); take({0:'revengekill'}); tick(0); inLane(0,()=>{ const hs=H(0); hs.forEach(h=>{h.energy=5;}); const d=hs[4]; d.shield=0; damage(d,1e12,'#fff',true);
      check(!d.alive&&hs.slice(0,4).every(h=>h.energy===100), 'revengekill: when a hero on the road falls, everyone left has a full ultimate'); }); });
  T1('nohealenemy',()=>{ scene('nohealenemy',0); take({0:'nohealenemy'}); tick(0); tick(1); inLane(0,()=>{ const e=big(E(0)[0]); e.hp=1000; healUnit(e,500); check(e.hp===1000, 'nohealenemy: an enemy on this road cannot be healed'); });
    inLane(1,()=>{ const e=big(E(1)[0]); e.hp=1000; healUnit(e,500); check(e.hp===1500, 'nohealenemy: enemies on another road still heal'); }); });
  T1('casthaste',()=>{ scene('casthaste',0); take({0:'casthaste'}); tick(0); inLane(0,()=>{ const h=hero(0,'fritz'), e=big(E(0)[0]); BoonFx.cast(h,'green');
      check(near(h.castMul,1.3)&&h.castT>0, 'casthaste: a cast makes the next cast come 30% faster (cooldowns run at '+h.castMul+'x)');
      rng(0.99,()=>hit(h,e,10,true)); check(h.castMul===1&&h.castT===0, 'casthaste: it resets on an auto attack'); }); });
  T1('backline',()=>{ scene('backline',0); take({0:'backline'}); tick(0); inLane(0,()=>{ const h=hero(0,'yenna'), es=E(0); es[0].x=h.x+100; es[1].x=h.x+300; es[2].x=h.x+900; es.forEach(e=>{e.y=h.y;});
      waveXfer=null; h.target=null; h.stunned=0; h.forcedTargetT=0; think(h,SIM_STEP); check(h.target===es[2], 'backline: attacks go to the furthest enemy, not the nearest'); });
    inLane(1,()=>{ const h=hero(1,'sylthaine'), es=E(1); es[0].x=h.x+100; es[1].x=h.x+300; es[2].x=h.x+900; es.forEach(e=>{e.y=h.y;}); h.target=null; think(h,SIM_STEP); check(h.target===es[0], 'backline: a hero without it still takes the nearest'); }); });

  /* ================= how much a hero deals / takes / how fast it swings ================= */
  function mults(id,lane,key,pre,post,assign){ scene(id,lane,assign); const L=lane||0; const o={};
    inLane(L,()=>{ const h=hero(L,key), e=big(E(L)[0]); if(pre) pre(h,L); o.d0=rng(0.99,()=>hit(h,e,100,false)); o.t0=taken(h,100); });
    o.got=take({[L]:id}); if(post) post(hero(L,key),L); tick(L);
    inLane(L,()=>{ const h=hero(L,key), e=big(E(L)[0]); o.d=rng(0.99,()=>hit(h,e,100,false))/o.d0; o.t=taken(h,100)/o.t0; o.as=h._bnAs||1; o.h=h; });
    return o; }
  T1('glass',()=>{ const o=mults('glass',0,'vael'); check(near(o.d,1.6,1e-6), 'glass: +60% damage dealt ('+o.d+')'); check(near(o.t,1.6,1e-6), 'glass: 60% more damage taken ('+o.t+')'); });
  T1('slowtank',()=>{ const o=mults('slowtank',0,'vael'); check(near(o.t,0.5), 'slowtank: 50% less damage taken ('+o.t+')'); check(near(o.as,0.5), 'slowtank: attacks 50% slower ('+o.as+')'); check(near(o.d,1), 'slowtank: damage unchanged'); });
  T1('dr',()=>{ const o=mults('dr',0,'vael'); check(near(o.t,0.75), 'dr: 25% of incoming damage turned aside ('+o.t+')'); });
  T1('haste',()=>{ const o=mults('haste',0,'vael'); check(near(o.as,1.3), 'haste: +30% attack speed ('+o.as+')'); });
  T1('nofirstaid',()=>{ const o=mults('nofirstaid',0,'vael'); check(near(o.d,1.4)&&near(o.t,1/1.4)&&near(o.as,1.4), 'nofirstaid: +40% to everything - damage, attack speed, toughness ('+[o.d,o.t,o.as]+')');
    inLane(0,()=>{ const h=o.h; h.hp=h.maxHp*0.5; healUnit(h,1000); check(near(h.hp,h.maxHp*0.5), 'nofirstaid: the hero cannot be healed'); }); });
  T1('halfhp',()=>{ const o=mults('halfhp',0,'vael'); check(near(o.as,1.75), 'halfhp: +75% attack speed ('+o.as+')'); H(0)[1].hp=H(0)[1].maxHp*0.2; close();
    check(H(0).every(h=>near(h.hp,h.maxHp*0.5)), 'halfhp: every wave starts at half health'); step(40); tick(0); check(near(hero(0,'vael')._bnAs,1.75), 'halfhp: and the attack speed never stops'); });
  T1('onehero',()=>{ scene('onehero',0); let champ=null, bp=-1; for(const h of H(0)){ const p=heroPower(h.key); if(p>bp){ bp=p; champ=h; } } const other=H(0).find(h=>h!==champ); const o={};
    inLane(0,()=>{ const e=big(E(0)[0]); o.c0=rng(0.99,()=>hit(champ,e,100,false)); o.o0=rng(0.99,()=>hit(other,e,100,false)); }); take({0:'onehero'}); tick(0);
    inLane(0,()=>{ const e=big(E(0)[0]); check(near(rng(0.99,()=>hit(champ,e,100,false))/o.c0,2), 'onehero: the strongest hero on the road ('+champ.key+') deals double');
      check(near(rng(0.99,()=>hit(other,e,100,false))/o.o0,2/3), 'onehero: everyone else loses a third'); }); });
  T1('allin',()=>{ scene('allin',0); H(0).forEach(h=>{h.energy=3;}); take({0:'allin'}); check(H(0).every(h=>h.energy===100), 'allin: the ultimate is ready immediately');
    inLane(0,()=>{ const h=hero(0,'vael'); h.energy=0; BoonFx.ult(h); h.energy=80; BoonFx.tick(0); check(h.energy===0&&h._bnNoUlt===1, 'allin: after that one cast it cannot be cast again this run'); });
    close(); step(60); check(hero(0,'vael').energy===0, 'allin: still locked in the next wave'); });
  T1('killstack',()=>{ scene('killstack',0); take({0:'killstack'}); close(); inLane(0,()=>{ const es=E(0), h=hero(0,'vael'); kill(hero(0,'yenna'),es[0]); kill(h,es[1]); BoonFx.tick(0);
      check(near(h._bnAs,1.08), 'killstack: +4% attack speed for every enemy killed this wave (2 kills -> '+h._bnAs+')'); });
    BoonFx.wave(GSPLIT.lanes[0]); tick(0); check((hero(0,'vael')._bnAs||1)===1, 'killstack: resets each wave'); });
  T1('hitstack',()=>{ scene('hitstack',0); take({0:'hitstack'}); close(); tick(0); inLane(0,()=>{ const h=hero(0,'vael'), e=big(E(0)[0]); const d=[]; for(let i=0;i<13;i++) d.push(rng(0.99,()=>hit(h,e,100,false)));
      check(near(d[3]/d[0],1.06)&&near(d[10]/d[0],1.2)&&near(d[12]/d[0],1.2), 'hitstack: +2% damage for every attack landed this wave, up to ten ('+(d[3]/d[0]).toFixed(3)+', '+(d[12]/d[0]).toFixed(3)+')'); }); });
  T1('timestack',()=>{ const o=mults('timestack',0,'vael',null,null); inLane(0,()=>{ const h=o.h, e=big(E(0)[0]); const b=rng(0.99,()=>hit(h,e,100,false)); battleTime=25; BoonFx.tick(0);
      check(near(rng(0.99,()=>hit(h,e,100,false))/b,1.10), 'timestack: +5% damage for every 10 seconds the wave has lasted (25 s -> +10%)'); battleTime=0; }); });
  T1('hurtstack',()=>{ const o=mults('hurtstack',0,'vael'); inLane(0,()=>{ const h=o.h, e=big(E(0)[0]); const b=rng(0.99,()=>hit(h,e,100,false)); h.hp=h.maxHp*0.55; BoonFx.tick(0);
      check(near(rng(0.99,()=>hit(h,e,100,false))/b,1.12), 'hurtstack: +3% damage for every 10% health missing (45% missing -> +12%)'); }); });
  T1('castsstack',()=>{ scene('castsstack',0); take({0:'castsstack'}); tick(0); inLane(0,()=>{ const h=hero(0,'fritz'), e=big(E(0)[0]), a0=h.apow; BoonFx.cast(h,'green'); BoonFx.cast(h,'blue');
      check(near(h.apow,a0*1.12), 'castsstack: each cast in a row adds 6% ability power (two casts -> '+(h.apow/a0).toFixed(3)+'x)');
      rng(0.99,()=>hit(h,e,10,true)); check(near(h.apow,a0), 'castsstack: it resets on an auto attack'); }); });
  T1('wavestack',()=>{ const o=mults('wavestack',0,'vael'); check(near(o.d,1.12)&&near(o.as,1.12)&&near(o.t,1/1.12), 'wavestack: +12% to everything for the one wave this road has cleared ('+[o.d,o.as,o.t]+')'); });
  T1('alonestack',()=>{ const o=mults('alonestack',0,'vael'); check(near(o.d,1), 'alonestack: nothing while nobody has fallen'); inLane(0,()=>{ const d=hero(0,'yenna'); d.shield=0; damage(d,1e12,'#fff',true); BoonFx.tick(0);
      const e=big(E(0)[0]); const dd=rng(0.99,()=>hit(o.h,e,100,false)); check(near(dd/o.d0,1.2), 'alonestack: +20% to everything for each fallen ally on the road ('+(dd/o.d0)+')'); }); });
  T1('crowdstack',()=>{ const o=mults('crowdstack',0,'vael'); check(near(o.d,1.32)&&near(o.as,1.32), 'crowdstack: +8% to everything for each of the 4 allies standing beside you ('+o.d+')'); });
  T1('critstack',()=>{ scene('critstack',0); take({0:'critstack'}); tick(0); inLane(0,()=>{ const h=hero(0,'vael'), e=big(E(0)[0]), c0=h.glyphCrit||0; rng(0.99,()=>hit(h,e,100,true)); rng(0.99,()=>hit(h,e,100,true));
      check(near(h.glyphCrit,c0+0.10), 'critstack: +5% critical chance every time you fail to crit (two misses -> +'+((h.glyphCrit-c0)*100).toFixed(1)+'%)');
      rng(0.99,()=>hit(h,e,100,true,true)); check(near(h.glyphCrit,c0), 'critstack: resets when you do crit'); }); });
  T1('stayer',()=>{ const o=mults('stayer',0,'vael'); check(near(o.t,0.75), 'stayer: a hero that has never crossed takes 25% less ('+o.t+')');
    const h=o.h; gsplitMove(h,0,1); for(let i=0;i<3000&&!gsplitStartAllowed();i++) gsplitStep(SIM_STEP); tick(1); inLane(1,()=>{ check(near(taken(h,100)/o.t0,1), 'stayer: once it has crossed a firebreak it no longer does'); }); });
  T1('frontrunner',()=>{ scene('frontrunner',0); const hs=H(0).slice().sort((a,b)=>b.x-a.x), f=hs[0], r=hs[hs.length-1]; const o={}; inLane(0,()=>{ const e=big(E(0)[0]); o.f=rng(0.99,()=>hit(f,e,100,false)); o.r=rng(0.99,()=>hit(r,e,100,false)); });
    take({0:'frontrunner'}); tick(0); inLane(0,()=>{ const e=big(E(0)[0]); check(near(rng(0.99,()=>hit(f,e,100,false))/o.f,1.35), 'frontrunner: the hero furthest ahead deals 35% more'); check(near(rng(0.99,()=>hit(r,e,100,false))/o.r,1), 'frontrunner: nobody else does'); }); });
  T1('rearguard',()=>{ scene('rearguard',0); const hs=H(0).slice().sort((a,b)=>b.x-a.x), f=hs[0], r=hs[hs.length-1]; const o={}; inLane(0,()=>{ o.f=taken(f,100); o.r=taken(r,100); });
    take({0:'rearguard'}); tick(0); inLane(0,()=>{ check(near(taken(r,100)/o.r,0.65), 'rearguard: the hero furthest back takes 35% less'); check(near(taken(f,100)/o.f,1), 'rearguard: nobody else does'); }); });
  T1('crowded',()=>{ const o=mults('crowded',0,'vael'); check(near(o.t,0.55), 'crowded: +15% damage reduction for every hero beyond the first, three counted at most - five heroes take 45% less ('+o.t+')');
    check(o.got[0].blurb==='Shieldwall — +15% damage reduction for every hero on this road beyond the first, up to three.', 'crowded: the card says so');
    inLane(0,()=>{ const d=hero(0,'yenna'); d.shield=0; damage(d,1e12,'#fff',true); const e=hero(0,'fritz'); e.shield=0; damage(e,1e12,'#fff',true); BoonFx.tick(0); check(near(taken(o.h,100)/o.t0,0.70), 'crowded: with two other heroes left it is 30%'); }); });
  T1('crowded',()=>{ const A8={1:['vael','hurne','oakmir','fritz','yenna','mirelle','aureth','sloe'],2:['vex','tick'],3:['gruel']}; const o=mults('crowded',0,'vael',null,null,A8);
    check(H(0).length===8&&near(o.t,0.55), 'crowded: a road of eight takes 45% less, not 95% ('+o.t+')'); close(); order({0:'crowded',1:'crowded'}); toWindow();
    check(!GSPLIT.lanes[0].offer.some(b=>b.id==='crowded')&&GSPLIT.lanes[1].offer.some(b=>b.id==='crowded'), 'crowded: it is not offered again to the road that holds it'); });
  T1('lonewolf',()=>{ const o=mults('lonewolf',2,'gruel'); check(near(o.d,1.5)&&near(o.as,1.5)&&near(o.t,1/1.5), 'lonewolf: a road with exactly one hero fights at 50% more of everything ('+[o.d,o.as,o.t]+')'); });
  function rank(id,want){ T1(id,()=>{ scene(id,0); take({0:id}); close(); const h=hero(0,'vael'), e0=E(0)[0];
      const probe=()=>{ tick(0); return inLane(0,()=>{ const hp=e0.hp; const d=rng(0.99,()=>hit(h,e0,1,false)); e0.hp=hp; return d; }); };
      const set=(i,f)=>{ for(const e of E(i)) e.hp=e.maxHp*f; };
      set(0,1); set(1,1); set(2,1); const b=probe(); check(b>0, id+': (level roads: nobody is ahead or behind)');
      if(want<0){ set(1,0.3); set(2,0.3); } else { set(0,0.3); }
      const d=probe(); check(near(d/b,1.3), id+': +30% to everything while this road is the furthest '+(want<0?'behind':'ahead')+' ('+(d/b)+')');
      if(want<0){ set(1,1); set(2,0.3); } else { set(1,0.1); }
      const d2=probe(); check(near(d2/b,1), id+': and not when another road is '+(want<0?'as far behind':'further ahead')+' ('+(d2/b)+')'); }); }
  rank('envy',-1); rank('pacer',1);
  T1('crosser',()=>{ scene('crosser',0); const got=take({0:'crosser'}); const a=hero(1,'vex'); a.shield=0; a.greenCd=9; gsplitMove(a,1,0); for(let i=0;i<3000&&!gsplitStartAllowed();i++) gsplitStep(SIM_STEP);
    check(GSPLIT.lanes[0].units.includes(a)&&a.shield===got[0].value&&got[0].value>0&&a.greenCd===0, 'crosser: a hero arriving on the road lands with the stated shield and a free cast ('+a.shield+')'); });
  T1('crosser',()=>{ scene('crosser',0); const got=take({0:'crosser'}); const c=hero(0,'yenna'); c.shield=0; c.greenCd=9; gsplitMove(c,0,1); for(let i=0;i<3000&&!gsplitStartAllowed();i++) gsplitStep(SIM_STEP);
    check(GSPLIT.lanes[1].units.includes(c)&&c.shield===got[0].value&&c.greenCd===0, 'crosser: a hero who carries it gets it wherever he arrives'); });

  /* ================= WAVE ================= */
  T1('arrivestun',()=>{ scene('arrivestun',0); take({0:'arrivestun'}); close(); check(E(0).length>0&&E(0).every(e=>e.stunned===2), 'arrivestun: every enemy of the next wave arrives stunned for 2 seconds'); check(E(1).every(e=>!e.stunned), 'arrivestun: only on that road');
    open({}); take({}); close(); check(E(0).length>0&&E(0).every(e=>!e.stunned), 'arrivestun: the NEXT wave only'); });
  T1('arrivehalf',()=>{ scene('arrivehalf',0); take({0:'arrivehalf'}); close(); check(E(0).length>0&&E(0).every(e=>near(e.hp,e.maxHp*0.75)), 'arrivehalf: every enemy of the next wave arrives at 25% less health');
    open({}); take({}); close(); check(E(0).every(e=>near(e.hp,e.maxHp)), 'arrivehalf: the NEXT wave only'); });
  T1('arriveburn',()=>{ scene('arriveburn',0); const got=take({0:'arriveburn'}); close(); check(E(0).length>0&&E(0).every(e=>e.dots.length===1&&e.dots[0].dps===got[0].value&&got[0].value>0), 'arriveburn: every enemy arrives burning for the stated amount a second');
    const e=E(0)[0]; e.pass=null; e.glyphDR=0; e.shield=0; H(0).forEach(h=>{ h.stunned=999; }); const h0=e.hp; inLane(0,()=>{ waveXfer=null; for(let i=0;i<Math.round(3/SIM_STEP);i++) updateBattle(SIM_STEP); }); H(0).forEach(h=>{ h.stunned=0; });
    check(near(h0-e.hp,3*got[0].value,0.02), 'arriveburn: three seconds of it take three times the stated amount ('+(h0-e.hp)+' vs '+3*got[0].value+')');
    open({}); take({}); close(); check(E(0).length>0&&E(0).every(e=>e.dots.some(d=>d.dps===got[0].value)), 'arriveburn: every later wave too'); });
  T1('arriveburn',()=>{ scene('arriveburn',0); const got=take({0:'arriveburn'}); close(); for(let i=0;i<4000&&(GSPLIT.lanes[0].xfer||GSPLIT.lanes[1].xfer||GSPLIT.lanes[2].xfer);i++) gsplitStep(SIM_STEP);
    const n0=E(0).length, n1=E(1).length; H(0).forEach(h=>{h.maxHp=h.hp=1e9;}); H(1).forEach(h=>{h.maxHp=h.hp=1e9;}); E(0).forEach(big); E(0).forEach(e=>{ e._bnBurn=1; pushDot(e,got[0].value,999,1,'#ff6a3a',null); });
    inLane(2,()=>{ for(const h of H(2)){ h.shield=0; damage(h,1e12,'#fff',true); } }); step(3);
    check(GSPLIT.lanes[2].state==='lost'&&E(0).length>n0, 'arriveburn: (a road fell and its monsters marched onto this one: '+n0+' -> '+E(0).length+')');
    check(E(0).every(e=>e.dots.some(d=>d.dps===got[0].value)), 'arriveburn: a monster that marches over from a fallen road burns too');
    check(E(1).length>n1&&E(1).every(e=>!e.dots.some(d=>d.dps===got[0].value)), 'arriveburn: but not on the road without the boon'); });
  T1('arriveslow',()=>{ scene('arriveslow',0); take({0:'arriveslow'}); close(); check(E(0).length>0&&E(0).every(e=>e.slow===5&&e.slowMul===0.5), 'arriveslow: every enemy arrives at half speed for 5 seconds');
    open({}); take({}); close(); check(E(0).every(e=>e.slow===5&&e.slowMul===0.5), 'arriveslow: every later wave too'); });
  T1('preheal',()=>{ scene('preheal',0); take({0:'preheal'}); H(0).forEach(h=>{h.hp=h.maxHp*0.3;}); H(1).forEach(h=>{h.hp=h.maxHp*0.3;}); close();
    check(H(0).every(h=>near(h.hp,h.maxHp)), 'preheal: everyone on the road starts the wave at full health'); check(H(1).every(h=>h.hp<h.maxHp*0.5), 'preheal: only that road'); });
  T1('prefight',()=>{ scene('prefight',0); take({0:'prefight'}); close(); tick(0); inLane(0,()=>{ const h=hero(0,'vael'), y=hero(0,'yenna'), e=big(E(0)[0]);
      rng(0.99,()=>hit(h,e,100,true)); const a=e._critHit; rng(0.99,()=>hit(h,e,100,true)); const b=e._critHit; rng(0.99,()=>hit(y,e,100,false)); const c=e._critHit;
      check(a===true&&b===false&&c===true, 'prefight: the first hit of the wave is a guaranteed critical for everyone on the road, and only the first '+[a,b,c]); });
    open({}); take({}); close(); tick(0); inLane(0,()=>{ const h=hero(0,'vael'), e=big(E(0)[0]); rng(0.99,()=>hit(h,e,100,true)); check(e._critHit===true, 'prefight: again in the next wave'); }); });
  T1('prewarn',()=>{ scene('prewarn',0); check(gsplitBoonForesight(GSPLIT.lanes[0])==='', 'prewarn: nothing is shown before it is taken'); take({0:'prewarn'}); close(); open({});
    const s=gsplitBoonForesight(GSPLIT.lanes[0]); const L=GSPLIT.lanes[0];
    check(s.indexOf('gw-fore')>0&&[2,3,4].every(w=>(L.waves3[w]||[]).length===0||s.indexOf(mcardName(L.waves3[w][0].key))>=0), 'prewarn: the boon panel names every wave still to come on that road');
    check(gsplitBoonForesight(GSPLIT.lanes[1])==='', 'prewarn: not for a road without it'); gsplitWindowDraw(); });

  /* ================= BREAK ================= */
  T1('eternalsummon',()=>{ scene('eternalsummon',0); let s1=null, m=0, d=0; inLane(0,()=>{ const hu=hero(0,'hurne'); s1=summonUnit(hu,'boar warrior',15); s1._riseT=0; m=s1.maxHp; d=s1.dmg; });
    check(!!s1&&s1.alive, 'eternalsummon: (a summon to test with)'); take({0:'eternalsummon'});
    check(s1._boonEverlasting===true&&near(s1.maxHp,Math.round(m*0.5))&&near(s1.dmg,d*0.5)&&s1._summonT===Infinity, 'eternalsummon: summons fight at 50% power and have no timer ('+s1.maxHp+' of '+m+')');
    close(); check(s1.alive, 'eternalsummon: the summon survives the end of the wave (the firebreak purge)');
    let s2=null; inLane(0,()=>{ const hu=hero(0,'hurne'); s2=summonUnit(hu,'boar warrior',15); }); check(!!s2&&s2._boonEverlasting===true&&near(s2.maxHp,Math.round(m*0.5),0.02), 'eternalsummon: a summon called later is everlasting too, at half power');
    inLane(0,()=>{ waveXfer=null; for(const h of H(0)){ h.shield=0; damage(h,1e12,'#fff',true); } for(let i=0;i<5;i++) updateBattle(SIM_STEP); });
    check(s1.alive&&s2.alive, 'eternalsummon: they do not die with their summoner'); s1.hp=s1.maxHp=1e9; s2.hp=s2.maxHp=1e9; step(30);
    check(GSPLIT.lanes[0].state==='walking', 'eternalsummon: an everlasting summon holds the road with every hero down');
    open({}); const o=(GSPLIT.lanes[0].offer||[]); take({}); close(); check(s1.alive, 'eternalsummon: and it walks through the next firebreak too');
    const before=s1.maxHp; tick(0); check(s1.maxHp===before, 'eternalsummon: the halving is once, not at every window'); });
  T1('eternalsummon',()=>{ start(); open({}); let s=null; inLane(0,()=>{ s=summonUnit(hero(0,'hurne'),'boar warrior',15); }); take({}); close(); check(!!s&&!s.alive, 'eternalsummon: without the boon a summon dies at the firebreak'); });
  T1('freeult',()=>{ scene('freeult',0); take({0:'freeult'}); H(0).forEach(h=>{h.energy=7;}); H(1).forEach(h=>{h.energy=7;}); close(); check(H(0).every(h=>h.energy===100), 'freeult: every hero starts the wave with a full ultimate'); check(H(1).every(h=>h.energy===7), 'freeult: only its carriers'); });
  T1('doublespeed',()=>{ scene('doublespeed',0); take({0:'doublespeed'}); close(); for(let i=0;i<4000&&(GSPLIT.lanes[0].xfer||GSPLIT.lanes[1].xfer);i++) gsplitStep(SIM_STEP);
    E(0).forEach(big); E(1).forEach(big); H(0).forEach(h=>{h.maxHp=h.hp=1e9;}); H(1).forEach(h=>{h.maxHp=h.hp=1e9;}); const a=GSPLIT.lanes[0].battleTime, b=GSPLIT.lanes[1].battleTime; step(30);
    const da=GSPLIT.lanes[0].battleTime-a, db=GSPLIT.lanes[1].battleTime-b; check(db>0&&near(da/db,2,1e-6), 'doublespeed: the road, and everything on it, runs at double speed ('+(da/db)+'x)'); });
  T1('inherit',()=>{ scene('inherit',0); take({0:'inherit'}); close(); open({0:'haste'}); take({0:'haste'}); tick(0); inLane(0,()=>{ const d=hero(0,'yenna'); let heir=null, bd=1e18; for(const h of H(0)) if(h!==d){ const q=dist(h,d); if(q<bd){ bd=q; heir=h; } }
      const other=H(0).find(h=>h!==d&&h!==heir); d.shield=0; damage(d,1e12,'#fff',true); BoonFx.tick(0);
      check(BoonFx.n(heir,'haste')===2&&BoonFx.n(heir,'inherit')===2&&near(heir._bnAs,1.6), 'inherit: a fallen hero\'s boons pass to whoever is nearest ('+heir.key+' now swings at '+heir._bnAs+'x)');
      check(BoonFx.n(other,'haste')===1, 'inherit: and to nobody else'); }); });

  /* ================= STAT ================= */
  T1('bighp',()=>{ scene('bighp',0); const hs=H(0); const m=hs.map(h=>h.maxHp); hs.forEach(h=>{h.hp=h.maxHp*0.5;}); const mean=m.reduce((a,b)=>a+b,0)/m.length; const got=take({0:'bighp'});
    check(got[0].value===Math.round(0.15*mean), 'bighp: the number on the card is 15% of the road\'s average maximum health ('+got[0].value+' of '+Math.round(mean)+')');
    check(hs.every((h,i)=>near(h.maxHp,m[i]+got[0].value)&&near(h.hp,m[i]*0.5+got[0].value)), 'bighp: + that much maximum health, and healed that much now');
    check(got[0].blurb==='Ironhide — +'+got[0].value+' maximum health, and you heal that much now.', 'bighp: the card reads the same number ('+got[0].blurb+')'); });
  T1('regen',()=>{ scene('regen',0); const got=take({0:'regen'}); const h=hero(0,'vael'); h.hp=h.maxHp*0.5; tick(0,1); check(near(h.hp,h.maxHp*0.5+got[0].value)&&got[0].value>0, 'regen: + the stated health a second ('+got[0].value+')');
    close(); open({}); take({}); close(); h.hp=h.maxHp*0.5; tick(0,1); check(near(h.hp,h.maxHp*0.5+got[0].value), 'regen: forever - still there two waves on'); });
  T1('energy',()=>{ scene('energy',0); take({0:'energy'}); const h=hero(0,'vael'); h.energy=10; tick(0,1); check(near(h.energy,24), 'energy: +14 energy a second ('+h.energy+')'); });
  T1('lifesteal',()=>{ scene('lifesteal',0); take({0:'lifesteal'}); tick(0); inLane(0,()=>{ const h=hero(0,'vael'), e=big(E(0)[0]); h.hp=h.maxHp*0.5; const b=h.hp; const lost=rng(0.99,()=>hit(h,e,1000,false)); check(lost>0&&near(h.hp-b,lost*0.09), 'lifesteal: 9% of the damage dealt comes back as health ('+(h.hp-b)+' of '+lost+')'); }); });
  T1('skill',()=>{ scene('skill',0); const h=hero(0,'vael'), s0=h.skillLv.slice(), g0=JSON.stringify(G.skillLevel&&G.skillLevel.vael); take({0:'skill'}); check(h.skillLv.every((x,i)=>x===s0[i]+1), 'skill: +1 to every ability level ('+s0+' -> '+h.skillLv+')');
    check(JSON.stringify(G.skillLevel&&G.skillLevel.vael)===g0, 'skill: the saved ability levels are not touched'); });
  T1('haste',()=>{ /* the attack-speed number really reaches the swing: same seed, same road, with and without Quickened */
    function swings(withBoon){ start(A0,77); open({0:'haste'}); if(withBoon) take({0:'haste'}); else take({}); close(); const h=hero(0,'yenna'); let c=0;
      for(let i=0;i<6000&&GSPLIT.lanes[0].xfer;i++) gsplitStep(SIM_STEP); E(0).forEach(big); H(0).forEach(x=>{x.maxHp=x.hp=1e9;}); let cnt=0;
      for(let i=0;i<1200;i++){ const cd0=h.atkCd; gsplitStep(SIM_STEP); if(h.atkCd>cd0+1e-9) cnt++; } return cnt; }
    const a=swings(false), b=swings(true); check(a>5&&b/a>1.2&&b/a<1.4, 'haste: with it a hero swings about 30% more often in a real fight ('+a+' -> '+b+' swings)'); });

  /* ================= stacking, lasting, crossing, clean-up ================= */
  T1('stack',()=>{ scene('haste',0); take({0:'haste'}); close(); open({0:'haste'}); take({0:'haste'}); tick(0); check(near(hero(0,'vael')._bnAs,1.6), 'picked twice, +30% attack speed is +60% ('+hero(0,'vael')._bnAs+')');
    close(); open({0:'dr'}); const t0=inLane(0,()=>taken(hero(0,'vael'),100)); take({0:'dr'}); close(); open({0:'dr'}); take({0:'dr'}); tick(0);
    check(near(inLane(0,()=>taken(hero(0,'vael'),100))/t0,0.5625), 'picked twice, 25% less damage is 25% less of what was left (x0.5625)');
    close(); tick(0); check(near(hero(0,'vael')._bnAs,1.6)&&GSPLIT.waveShown===4, 'a boon from the first firebreak is still in force in the fifth wave');
    check(GSPLIT.lanes[0].boons.haste===2&&GSPLIT.lanes[0].boons.dr===2, 'the road\'s pick counter still counts'); });
  T1('stack2',()=>{ scene('bighp',0); const h=hero(0,'vael'), m=h.maxHp; const a=take({0:'bighp'}); close(); open({0:'bighp'}); const b=take({0:'bighp'}); check(near(h.maxHp,m+a[0].value+b[0].value), 'Ironhide twice adds both numbers'); });
  T1('cross',()=>{ scene('haste',0); take({0:'haste'}); const c=hero(0,'yenna'), n1=hero(1,'vex'); gsplitMove(c,0,1); gsplitMove(n1,1,0); for(let i=0;i<4000&&!gsplitStartAllowed();i++) gsplitStep(SIM_STEP); close(); tick(0); tick(1);
    check(GSPLIT.lanes[1].units.includes(c)&&near(c._bnAs,1.3), 'a hero who crosses takes his boon with him ("Their boon goes with them")');
    check(GSPLIT.lanes[0].units.includes(n1)&&(n1._bnAs||1)===1&&!BoonFx.n(n1,'haste'), 'a hero who arrives later does not get a boon picked before he came');
    check(hero(1,'tick')&&!BoonFx.n(hero(1,'tick'),'haste'), 'and the road he walks onto does not get it either'); });
  T1('change',()=>{ start(); order({0:'haste'}); toWindow(); const L=GSPLIT.lanes[0]; const other=L.offer.find(b=>b.id!=='haste'); gsplitPickBoon(0,'haste'); gsplitPickBoon(0,other.id); GSPLIT.window.phase='move'; gsplitBoonsCommit(); gsplitBoonsCommit();
    check(!BoonFx.n(hero(0,'vael'),'haste')&&BoonFx.n(hero(0,'vael'),other.id)===1, 'a pick changed before CONFIRM gives only the boon that was confirmed, once'); });
  T1('summons',()=>{ scene('haste',0); let s=null; inLane(0,()=>{ s=summonUnit(hero(0,'hurne'),'boar warrior',15); }); take({0:'haste'}); tick(0); check(!!s&&!s._bn, 'a summon is not given the road\'s boon');
    const hu=hero(0,'hurne'); gsplitMove(hu,0,1); for(let i=0;i<4000&&!gsplitStartAllowed();i++) gsplitStep(SIM_STEP); check(GSPLIT.lanes[1].units.includes(s), 'a summoner\'s pack crosses with it'); });
  T1('cleanup',()=>{ start(A0,5); const m0=hero(0,'vael').maxHp, c0=hero(0,'vael').glyphCrit, sk=JSON.stringify(G.skillLevel||null); open({0:'bighp',1:'skill',2:'critstack'}); take({0:'bighp',1:'skill',2:'critstack'}); close(); step(200); end();
    check(GSPLIT.active===false&&GSPLIT.lanes.length===0&&!GSPLIT._bnOn&&GSPLIT.boonDeck===null&&_bnSrc===null, 'the end of the run clears the run\'s boon state');
    check(JSON.stringify(G.skillLevel||null)===sk, 'nothing was written to the save'); start(A0,5);
    const h=hero(0,'vael'); check(h.maxHp===m0&&h.glyphCrit===c0&&!h._bn&&h._bnIn==null&&!h._bnAs, 'the next run starts clean: same hero, no boon left on it');
    const e=big(E(0)[0]); const a=inLane(0,()=>rng(0.5,()=>hit(h,e,100,true))); check(a>0, 'and a fight with no boon picked runs the hooks without effect'); });

  /* ================= the offer fits the road as it is NOW ================= */
  T1('fit',()=>{ start(A0,9); let lw=0, ev=0, sm=0; for(let w=0;w<4;w++){ order({0:'lonewolf',1:'eternalsummon',2:'crowded'}); toWindow(); if(GSPLIT.lanes[0].offer.some(b=>b.id==='lonewolf')) lw++; if(GSPLIT.lanes[1].offer.some(b=>b.id==='eternalsummon')) ev++; if(GSPLIT.lanes[2].offer.some(b=>b.id==='crowded')) sm++;
      check(GSPLIT.lanes.every(L=>L.offer&&L.offer.length===3&&new Set(L.offer.map(b=>b.id)).size===3), 'firebreak '+(w+1)+': three different boons for every road'); take({}); close(); }
    check(lw===0, 'Lone Wolf is never offered to a road of five'); check(ev===0, 'Everlasting is never offered to a road with no summoner'); check(sm===0, 'Shieldwall (several heroes) is never offered to a road of one'); });
  T1('fit2',()=>{ start(A0,9); order({0:'lonewolf'}); toWindow(); check(!GSPLIT.lanes[0].offer.some(b=>b.id==='lonewolf'), 'five heroes: no Lone Wolf'); take({}); close();
    inLane(0,()=>{ for(const h of H(0).slice(1)){ h.shield=0; damage(h,1e12,'#fff',true); } }); H(0)[0].maxHp=H(0)[0].hp=1e9; order({0:'lonewolf'}); toWindow();
    check(H(0).length===1&&GSPLIT.lanes[0].offer.some(b=>b.id==='lonewolf'), 'after four deaths the same road IS offered Lone Wolf'); take({}); close(); });
  T1('fit3',()=>{ start(A0,9); order({0:'eternalsummon',1:'eternalsummon'}); toWindow(); check(GSPLIT.lanes[0].offer.some(b=>b.id==='eternalsummon'), 'the summoner\'s road is offered Everlasting'); check(!GSPLIT.lanes[1].offer.some(b=>b.id==='eternalsummon'), 'the other road is not');
    take({}); const hu=hero(0,'hurne'); gsplitMove(hu,0,1); close(); order({0:'eternalsummon',1:'eternalsummon'}); toWindow();
    check(!GSPLIT.lanes[0].offer.some(b=>b.id==='eternalsummon')&&GSPLIT.lanes[1].offer.some(b=>b.id==='eternalsummon'), 'after the summoner crosses, the offer follows him to his new road'); take({}); close();
    inLane(1,()=>{ hu.shield=0; damage(hu,1e12,'#fff',true); }); order({1:'eternalsummon'}); toWindow(); check(!GSPLIT.lanes[1].offer.some(b=>b.id==='eternalsummon'), 'and once the summoner has fallen it is not offered at all'); });
  T1('fit4',()=>{ start(A0,9); order({0:'freeult'}); toWindow(); take({0:'freeult'}); close(); order({0:'freeult',1:'freeult'}); toWindow();
    check(!GSPLIT.lanes[0].offer.some(b=>b.id==='freeult'), 'a boon that cannot grow is not offered again to the road that has it'); check(GSPLIT.lanes[1].offer.some(b=>b.id==='freeult'), 'but still to a road that does not');
    take({}); close(); order({0:'prewarn'}); toWindow(); const third=GSPLIT.lanes[0].offer.some(b=>b.id==='prewarn'); take({}); close(); order({0:'prewarn'}); toWindow();
    check(third&&!GSPLIT.lanes[0].offer.some(b=>b.id==='prewarn'), 'Foresight is offered while waves remain to be seen, not at the last firebreak');
    inLane(1,()=>{ for(const h of H(1)){ h.shield=0; damage(h,1e12,'#fff',true); } }); });
  T1('fit5',()=>{ start(A0,9); toWindow(); take({}); close(); inLane(2,()=>{ for(const h of H(2)){ h.shield=0; damage(h,1e12,'#fff',true); } }); step(3);
    check(GSPLIT.lanes[2].state==='lost', '(a road has fallen)'); order({0:'envy',1:'pacer'}); toWindow(); check(GSPLIT.lanes[0].offer.some(b=>b.id==='envy')&&GSPLIT.lanes[1].offer.some(b=>b.id==='pacer'), 'with two roads walking, the boons about the other road are still offered');
    take({}); close(); inLane(1,()=>{ for(const h of H(1)){ h.shield=0; damage(h,1e12,'#fff',true); } }); });
  T1('legacy',()=>{ end(); T.verdict=null; const d=JSON.parse(__mkStart(JSON.stringify(A0),3)); d.boonDeck=null; d.boonOffers=[0,1,2,3].map(()=>[0,1,2].map(()=>[{id:'haste',name:'Quickened',value:0.3,blurb:'Quickened — +30% attack speed, and it never stops.'},{id:'dr',name:'Warded',value:0.25,blurb:'x'},{id:'bighp',name:'Ironhide',value:500,blurb:'y'}]));
    gsplitEnterBattle(d,A0,'3-7',null); toWindow(); check(GSPLIT.lanes[0].offer.length===3&&GSPLIT.lanes[0].offer[0].id==='haste', 'with no deck (an older server) the Start table is still what is offered');
    gsplitPickBoon(0,'haste'); gsplitPickBoon(1,'bighp'); const m=hero(1,'vex').maxHp; GSPLIT.window.phase='move'; gsplitBoonsCommit(); tick(0); check(near(hero(0,'vael')._bnAs,1.3)&&hero(1,'vex').maxHp===m+500, 'and its boons work too'); });

  /* ================= the page's numbers are the catalogue's ================= */
  { const cat=JSON.parse(__CATV); for(const id in BOON_V) check(cat[id]===BOON_V[id], 'the page\'s number for '+id+' is the catalogue\'s ('+BOON_V[id]+' vs '+cat[id]+')');
    const ids=JSON.parse(__IDS); check(ids.every(id=>covered[id]), 'every offerable boon was picked and checked here (missing: '+ids.filter(id=>!covered[id]).join(',')+')');
    check(Object.keys(covered).every(id=>ids.indexOf(id)>=0), 'and nothing else'); }
  end();
  return JSON.stringify({R,covered:Object.keys(covered).length});
}

/* determinism: a whole run, first boon on every road, twice with the same seed (and Math.random poisoned differently each time) */
function vmRun(){ return (function(seed,mr){
  const A={1:['vael','hurne','oakmir','fritz','yenna'],2:['vex','tick','askel','rivet','sylthaine'],3:['gruel','mirelle','aureth']};
  const _mr=Math.random; Math.random=()=>mr; let verdict=null; gsplitFinish=function(v){ verdict=v; GSPLIT._finishing=true; };
  try{ if(GSPLIT.active){ gsplitEnd(); GSPLIT._finishing=false; }
    const d=JSON.parse(__mkStart(JSON.stringify(A),seed,'1-4')); gsplitEnterBattle(d,A,'1-4',null); const picks=[]; let ticks=0;
    while(GSPLIT.active&&!verdict&&ticks<120000){
      if(gsplitWindowOpen()){ const W=GSPLIT.window; if(W.phase==='boon'){ for(const L of GSPLIT.lanes){ if(L.state!=='walking') continue; if(L.offer&&L.offer.length){ gsplitPickBoon(L.i,L.offer[0].id); picks.push(L.offer[0].id); } } W.phase='move'; gsplitBoonsCommit(); }
        for(let i=0;i<20;i++) gsplitStep(SIM_STEP); if(!gsplitCloseWindow()) break; continue; }
      gsplitStep(SIM_STEP); ticks++; }
    const dig=GSPLIT.lanes.map(L=>L.state+':'+L.waveIdx+':'+L.units.map(u=>u.key[0]+(u.alive?Math.round(u.hp*1000):'x')).join(',')).join('|');
    const out=JSON.stringify({verdict,ticks,picks,dig}); gsplitEnd(); GSPLIT._finishing=false; return out;
  } finally{ Math.random=_mr; } }); }

let res;
try{ res=JSON.parse(vm.runInContext('('+vmTests.toString()+')()',host.ctx,{timeout:900000})); }
catch(e){ console.log('THE PAGE TESTS THREW: '+(e&&e.stack||e)); fail++; res={R:[],covered:0}; }
for(const [c,m] of res.R) ok(c,m);
try{ const f='('+vmRun.toString()+')()';
  const a=vm.runInContext(f+'(31337,0.11)',host.ctx,{timeout:300000}), b=vm.runInContext(f+'(31337,0.87)',host.ctx,{timeout:300000}), c=vm.runInContext(f+'(4242,0.5)',host.ctx,{timeout:300000});
  const A=JSON.parse(a); ok(A.picks.length>=3, 'a whole run with boons finishes ('+A.verdict+', '+A.ticks+' ticks, picks '+A.picks.join(',')+')');
  ok(a===b, 'the same seed gives the same run, tick for tick, whatever Math.random returns');
  ok(a!==c, 'another seed gives another run');
}catch(e){ console.log('THE DETERMINISM RUN THREW: '+(e&&e.stack||e)); fail++; }
{ /* no Math.random in the boon code */
  const html=fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8'); const i=html.indexOf('const BOON_V ='), j=html.indexOf('function gsplitBoonForesight');
  ok(i>0&&j>i&&html.slice(i,j).indexOf('Math.random')<0, 'the boon code draws only from the fight\'s own seeded stream'); }

console.log('\ntest_boon_effects_1443: '+pass+' passed, '+fail+' failed ('+res.covered+' of '+IDS.length+' offerable boons exercised)');
process.exit(fail?1:0);
