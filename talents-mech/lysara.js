/* LYSARA MOONVEIL - what her learned talents do in a fight (the mechanics; her 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (the section "Added for Lysara Moonveil": what she added)
   Her real kit (the code, not the tooltip wording; a ranged support whose skills scale on ability power; her basic attacks are magic):
   - Dreamthread ('linkheal', green, cd 8): the two allies of her side with the lowest HP share (herself included, as alliesOf sorts them) are linked for 8 s
     (_linkTo / _linkT): each is healed apow x 0.55 x the skill curve (healFrom: her healOut rows see it) and given a heal over time of 2.2% of its max HP a
     second for 8 s (pushHot, no caster: her rows make it hers, tag 'dt'). While linked, 35% of any healing one of them receives also heals the other
     (healUnit's own link hop). SHIELDS ARE NOT SHARED, whatever the card says.
   - Moon Cocoon ('harmonyshield', blue, cd 9): every ally within 3 m CENTRE TO CENTRE of the game's lowestAlly (the most wounded, herself included) gets
     max(shield, apow x 2.2 x the skill curve) for 6 s. Allies stand 4 m+ apart, so in practice it is the one ally.
   - Queen of Quiet Wings ('quietwings', ultimate; ULT_DEF.quietwings + HERO_ULT_ART.lysara = deliver 'form', art only): EVERY enemy on the field (no radius)
     gets _sleepT = the sleep table's 5.0 s and ccApply(stunned, 5.0) -> x0.7 = 3.5 -> the stun ceiling 2.8 s (the real sleep), and ccApply(slow, 3) -> 2.1 s;
     every ally gets the damage buff 1.3 + 0.001 a level and haste 1.2 for 8 s. No damage. The wake line in _dealDamageCore wakes a sleeper on ANY direct hit
     that reaches it (before the miss and dodge checks: a miss wakes it too); DoT ticks and talent damage do not. _sleepT keeps casts cancelled until it runs
     out or a hit clears it, also after the stun field has ended.
   - Powdered Slumber (passive 'slumber', at each swing on her target): t._accDn = min(0.35, + 0.05 x passMul) - a field the game WRITES AND NEVER READS - and
     t.accStat -= 3 x passMul (floor 0): only an enemy with an accuracy rating loses anything, and that only matters against an ally with evasion.
   Drowse, Haunted, Moon Phase, Hatching, Dust, the Lantern and the talents' count of Powdered Slumber exist only through her talents.
   Readings, caps and corrected tooltips: WIRING/37 - LYSARA MOONVEIL - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const ULT='quietwings', DT='linkheal', COC='harmonyshield', COL='#c9b8ff';
const CAP=4.0;                            // a control her talents make longer: the extensions add in full, the whole at most 4.0 s (WIRING/00, control durations)
const LOCK=0.5;                           // the stun-lock rule: none of her sleeps lands within 0.5 s after one of her sleeps on that enemy ended
/* families: the bookkeeping of a state runs when any talent that reads it is learned */
const DUST=['lm_1_1','lm_7_2','lm_13_3'];                                                   // makes Dust (Wing Dust, Snuffed Light, Into the Flame's window)
const LAN=['lm_2_3','lm_3_3','lm_4_3','lm_8_1','lm_8_3','lm_9_1','lm_11_4','lm_13_3'];       // who the Lantern is
const PSF=['ln_1_4','ln_3_4','ln_8_4','ln_9_4','lm_1_4','lm_2_4','lm_4_4','lm_7_4','lm_8_4']; // her talents' count of Powdered Slumber
const MOON=['sd_2_1','sd_4_1','sd_5_1','sd_7_1','sd_8_1','sd_9_1','sd_11_1','sd_12_1'];      // the moon's clock
const COCF=['sd_1_4','sd_2_4','sd_3_4','sd_5_4','sd_6_3','sd_6_4','sd_8_4','sd_11_3'];       // her cocoons followed to their end
const HEALK=['sd_2_1','sd_4_1','sd_4_3','sd_5_2','sd_8_2','sd_12_2'];                        // her Dreamthread heals made stronger
const OUTK=['ln_8_1','lm_7_1','lm_9_3','lm_8_3','lm_4_4'];
const TEAMIN=['ln_5_4','lm_2_3','ln_12_1','sd_6_4','lm_1_4','sd_1_2','ln_2_2','ln_10_3','lm_7_4','sd_5_1','sd_n1','sd_5_4','sd_12_4'];
const SELFIN=['lm_1_4','sd_1_2','ln_2_2','ln_10_4','ln_10_3','lm_n1','lm_10_4','lm_7_4','sd_5_1','sd_n1','sd_5_4'];
const any=(T,L)=>{ const c=T.s.anyC||(T.s.anyC=new Map()); let v=c.get(L); if(v===undefined){ v=L.some(id=>T.r[id]); c.set(L,v); } return v; };
const frac=x=>x.maxHp>0?x.hp/x.maxHp:1;
const apNow=u=>(u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1);
const asleep=t=>!!t&&t.alive&&(t.stunned||0)>0&&(t._sleepT||0)>0;           // the game's sleep: the stun field and _sleepT both running
const nrg=(x,n)=>{ if(x&&x.alive&&n>0) x.energy=Math.min(100,(x.energy||0)+n); };
const foes=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team!==u.team);
const side=(A,u)=>A.eng().units().filter(x=>x.alive&&x.team===u.team&&!x._dropHidden&&!(x._riseT>0));   // as the game's alliesOf (Dreamthread's own list)
/* her talents' count of Powdered Slumber on an enemy: the passive's own 5% x passMul a swing (+ Fine Dust, x Shaking Hands), up to 35% (+ Stray Shots); it holds
   4 s after her last swing at it (+ Choking Dust). "Full" = at that top */
const psMax=T=>0.35+(T.P['ps.max']||0);
const psFull=(A,T,u,t)=>!!t&&A.ustGet(T,u,t,'ps')>=psMax(T)-1e-9;
const isLan=(A,T,u,t)=>!!t&&T.s.m.lan===t&&!!A.markOf(u,t,'lan');
/* the moon: Waxing in the even 8 s, Waning in the odd ones (each fight starts Waxing); a Syzygy (every third turn, 4 s) is both */
const mIdx=T=>Math.floor((T.s.mt||0)/8+1e-9);                               // her own fight clock (T.s.mt, summed in her tick): the page's battleTime starts again at every wave
const syz=(A,T)=>(T.s.mt||0)<(T.s.syz||-1);
const isWax=(A,T)=>(mIdx(T)%2===0)||syz(A,T), isWane=(A,T)=>(mIdx(T)%2===1)||syz(A,T);
/* her link: the game's (_linkTo while _linkT runs) and Wide Weave's third ally (T.s.w3 = {a: the lowest one, c: the third, until}) */
function partnerOf(A,T,u,x){ if(!x) return null; const E=A.eng(); if(x._linkTo&&x._linkTo.alive&&(x._linkT||0)>0&&x._linkTo!==x) return x._linkTo;
  const w=T.s.w3; if(w&&E.now()<w.until){ if(x===w.c&&w.a.alive) return w.a; } return null; }
function linked(A,T,u,x){ if(partnerOf(A,T,u,x)) return true; const w=T.s.w3; return !!(w&&A.eng().now()<w.until&&x===w.a&&w.c.alive); }
/* ---------------- damage reduction: ONE capped group (her own hits at most 35% off, an ally's at most 25%); each share multiplies ---------------- */
function drK(A,T,u,t,s,kind,auto,live){ const r=T.r, E=A.eng(); let k=1; const me=t===u;
  if(r.ln_2_2&&A.markOf(u,s,'ha')) k*=1-0.02*r.ln_2_2;                                  // Nightmare: a Haunted enemy deals less
  if(me&&r.ln_10_4&&A.markOf(u,s,'ha')) k*=1-0.02*r.ln_10_4;                            // Moth Hide
  if(r.ln_10_3&&(T.s.nz||0)>0) k*=Math.max(0,1-0.005*r.ln_10_3*T.s.nz);                // Grey Hours: per sleeping enemy
  if(me&&r.lm_n1&&!auto) k*=1-0.02*r.lm_n1;                                            // Once Burned: enemy abilities
  if(me&&r.lm_10_4&&A.ustGet(T,u,s,'du')>0) k*=1-0.015*r.lm_10_4;                       // Grey Eye: an enemy carrying Dust
  if(r.lm_7_4&&psFull(A,T,u,s)) k*=1-0.01*r.lm_7_4;                                     // Wandering Light
  if(r.sd_5_1&&A.markOf(u,s,'nm')) k*=1-0.01*r.sd_5_1;                                  // New Moon
  if(r.sd_n1&&!auto&&linked(A,T,u,t)){ if(r.lm_2_3&&isLan(A,T,u,s)){ k*=1-0.12; if(live) nrg(u,2); } else k*=1-0.04; }   // Lamp in the Window (LINK)
  if(r.sd_5_4&&A.markOf(u,t,'coc')&&(t.shield||0)>0) k*=1-0.02*r.sd_5_4;               // Pupa: inside her cocoon
  if(!me&&r.sd_12_4&&A.gap(u,t)<3*E.METER()) k*=1-0.02*r.sd_12_4;                       // Wing Shelter
  return Math.max(me?0.65:0.75,k); }
/* Lost Aim: an enemy at full Powdered Slumber misses 3% of its basic attacks per rank (the fight's seeded stream, drawn last, only for such an attack) */
function lostAim(A,T,u,c){ const r=T.r, s=c.src, t=c.tgt; if(!r.lm_1_4||!c.auto||!psFull(A,T,u,s)) return false;
  if(!(A.eng().rnd()<0.03*r.lm_1_4)) return false;
  c.amt=0; t._talMiss=1; nrg(u,1);
  if(r.lm_11_3&&t!==u) nrg(t,r.lm_11_3);                                                 // Curtain Call
  if(r.lm_6_4) u.blueCd=Math.max(0,(u.blueCd||0)-0.1*r.lm_6_4);                          // Fumble
  return true; }
/* Dreamshare: of the damage a linked ally takes (after its reductions), 3% per rank is carried by its partner, at half strength */
function share(A,T,u,c){ const r=T.r; if(!r.sd_1_2||!(c.amt>0)) return; const p=partnerOf(A,T,u,c.tgt); if(!p) return;
  const cut=c.amt*0.03*r.sd_1_2; c.amt-=cut; A.eng().damage(p,cut*0.5,'#d8c8ff',true); }
/* ---------------- sleeps ---------------- */
/* a sleep she caused is followed until it ends: T.s.zz[uid] = {t, kind: 'ult' | 'drowse' | 'hush', at, id (the ultimate it came from)} */
function rec(A,T,u,t,kind){ const E=A.eng(), now=E.now(), r=T.r, s=T.s, d=t.stunned||0;
  (s.zz||(s.zz={}))[t.uid]={t,kind,at:now,id:kind==='ult'?s.ultId:-1,hit:null};
  if(r.ln_8_1){ t._talZz=u; t._talZzT=now+d; }                                          // Lullaby: her own hits do not wake it
  if(kind==='drowse'&&T.P.ss) t._talZzA=now+Math.min(d,T.P.ss);                         // Sound Sleep: no hit wakes it for its first moments
  if(r.ln_6_1){ const L=s.dlt||(s.dlt=[]); while(L.length&&L[0]<=now-6) L.shift(); if(L.length<3){ L.push(now); nrg(u,2*r.ln_6_1); } } }   // Deep Lull: at most 3 sleeps count in any 6 s
/* a sleep her talents put on (Drowse, the Hush): its full length on the fixed path (the target's own control shortening still applies), the game's sleep */
function putSleep(A,T,u,t,secs,kind){ if(!t||!t.alive||!(secs>0)) return false; A.control(T,u,t,'stunned',Math.min(CAP,secs)); if(!((t.stunned||0)>0)) return false;
  t._sleepT=Math.max(t._sleepT||0,t.stunned); rec(A,T,u,t,kind); return true; }
const immune=t=>!!t.stunImmune;                                                 // the game's "cannot be stunned" (think clears every stun on such a unit)
function haunt(A,T,u,t,d){ if(d>0&&t&&t.alive) A.setMark(T,u,t,'ha',{dur:d,longest:true}); }
const hDur=T=>4+(T.P.haunt||0);
/* Drowse on an enemy: +n (max 5, lapses 4 s after the last + Drift Off). At 5 (Heavy Head: 4) it falls asleep 0.25 s per rank (x Slow Breathing), each enemy at
   most once every 12 s (Black Window: 6 s at full Powdered Slumber); never on an enemy already stunned or within 0.5 s after one of her sleeps on it ended */
function drowseAdd(A,T,u,t,n,twin){ const r=T.r; if(!r.ln_1_1||!t||!t.alive) return; const was=A.ustGet(T,u,t,'dr'), nw=Math.min(5,was+n);
  A.ustPut(T,u,t,'dr',nw,4+(T.P['dr.fade']||0)); if(nw>=(r.ln_3_1?4:5)) trySleep(A,T,u,t,twin); }
function trySleep(A,T,u,t,twin){ const E=A.eng(), r=T.r, s=T.s, now=E.now(), dg=s.dg||(s.dg={}), last=dg[t.uid], gap=(r.ln_9_4&&psFull(A,T,u,t))?6:12;
  if(last!=null&&now<last+gap-1e-9) return;
  if(immune(t)){ if(r.ln_n1){ haunt(A,T,u,t,2*r.ln_n1); A.ustPut(T,u,t,'dr',0); dg[t.uid]=now; } return; }   // Wide Awake
  if((t.stunned||0)>0||now<((s.lk||{})[t.uid]||0)) return;
  if(!putSleep(A,T,u,t,0.25*r.ln_1_1*(1+(T.P.sb||0)),'drowse')) return;
  A.ustPut(T,u,t,'dr',0); dg[t.uid]=now;
  if(r.ln_11_1){ const x=E.lowestAlly(u); if(x) E.healUnit(x,apNow(u)*0.03*r.ln_11_1); }                       // Dreamcatcher
  if(r.ln_5_2&&!twin){ const x=A.pick(T,u,{team:'enemy',of:'target',within:3,skip:'target',n:1},{u,tgt:t})[0]; if(x) drowseAdd(A,T,u,x,3,true); } }   // Twin Dreams (once: it does not pass on again)
/* a sleep of hers ended (woken, out of time): Haunted, Sleep Paralysis, Stopped Clock, the Hush, Into the Flame, Snuffed Light */
function woke(A,T,u,z){ const E=A.eng(), r=T.r, s=T.s, now=E.now(), t=z.t; (s.lk||(s.lk={}))[t.uid]=now+LOCK;
  if(t._talZz===u){ t._talZz=null; t._talZzT=0; } t._talZzA=0;
  if(z.kind==='ult'&&z.id===s.ultId&&s.ultFired!==z.id){ s.ultFired=z.id;                                       // "when Queen of Quiet Wings' sleep ends": its first sleeper wakes
    if(r.ln_13_2){ s.hush=now+6; s.hd={}; } if(r.lm_13_3) itf(A,T,u); }
  const inHush=now<(s.hush||-1), hd=hDur(T); let d=0;
  if(r.ln_2_2||inHush) d=hd;                                                                                   // Nightmare: any sleep of hers; the Hush: any enemy that wakes inside it
  if(z.kind==='ult'&&r.ln_7_2) d=2*hd;                                                                         // Night Terrors: the ultimate's sleepers, twice as long
  haunt(A,T,u,t,d);
  if(z.kind==='drowse'&&t.alive){ if(r.ln_10_1) A.control(T,u,t,'silencedT',1);                                  // Sleep Paralysis
    if(r.ln_5_3) (s.sc||(s.sc={}))[t.uid]={t,until:now+1,g:t.greenCd||0,b:t.blueCd||0}; }                   // Stopped Clock
  if(z.kind==='ult'&&r.lm_7_2) A.setMark(T,u,t,'sn',{dur:3});                                                  // Snuffed Light
  if(inHush&&r.ln_13_2&&z.kind!=='hush'&&t.alive&&!s.hd[t.uid]){ s.hd[t.uid]=1; (s.hq||(s.hq=[])).push({t,at:now+LOCK}); } }
/* ---------------- Dust and its flares ---------------- */
function dustAdd(A,T,u,t,n,noSwarm){ if(!t||!t.alive||!(n>0)) return; const mx=6+(T.P['du.max']||0), was=A.ustGet(T,u,t,'du'), nw=Math.min(mx,was+n);
  A.ustPut(T,u,t,'du',nw,6+(T.P['du.dur']||0));
  if(nw>=mx&&was<mx&&T.r.lm_10_3&&!noSwarm){ const E=A.eng(); for(const x of A.pick(T,u,{team:'enemy',of:'target',within:2,skip:'target'},{u,tgt:t})) if(E.rnd()<0.2*T.r.lm_10_3) dustAdd(A,T,u,x,1,true); } }   // Moth Swarm (no cascade)
function defMag(A,T,u,t){ const E=A.eng(), x=0.02*(T.r.lm_11_1||0); if(!x) return E.defMul(u,t,'magic'); const sv=t.mrRating; t.mrRating=(sv||0)*(1-x); try{ return E.defMul(u,t,'magic'); } finally{ t.mrRating=sv; } }   // Ember Moth
/* a flare of n Dust on t, x k: 3% of her ability power per Dust per rank of Wing Dust (rank 1 without it), magic (Ember Moth), Pale Fire, Fine Powder, on the
   Lantern (Bright Burn, Lightless, The Lantern's team share), Moonless, Dazzle. Talent damage (no crit, nothing set off). Returns what it took */
function flareAmt(A,T,u,t,n,k){ const r=T.r, Pp=T.P; let a=apNow(u)*0.03*Math.max(1,r.lm_1_1||0)*n*k;
  if(r.lm_1_2){ let m=0; for(const x of foes(A,u)) if(x.t&&(x.t.role==='Mage'||x.t.role==='Support')) m++; a*=1+0.01*r.lm_1_2*Math.min(3,m); }
  if(r.lm_6_1) a*=1+0.05*r.lm_6_1;
  if(isLan(A,T,u,t)){ if(r.lm_8_1) a*=1+0.08*r.lm_8_1; if(r.lm_8_3) a*=1+0.02*r.lm_8_3; if(r.lm_2_3) a*=1+0.015*r.lm_2_3; }
  if(r.ln_5_4&&A.markOf(u,t,'ha')) a*=1+0.015*r.ln_5_4; if(r.lm_4_4&&psFull(A,T,u,t)) a*=1+0.01*r.lm_4_4;
  void Pp; return a*defMag(A,T,u,t); }
function flare(A,T,u,t,n,k){ if(!t||!t.alive||!(n>0)) return 0; return A.hurt(T,u,t,flareAmt(A,T,u,t,n,k),COL,'flare'); }
function afterFlare(A,T,u,done){ const r=T.r, E=A.eng(); if(r.lm_5_4) nrg(u,r.lm_5_4);                       // Guttering
  if(r.lm_10_2&&done>0){ const L=side(A,u).filter(x=>x._linkTo&&x._linkTo.alive&&(x._linkT||0)>0); if(L.length) for(const x of L.slice(0,2)) E.healUnit(x,done*0.20); } }   // Burning Thread
/* Into the Flame: every Dust on the field flares at double damage; the Lantern takes one more (double) flare for every Dust that flared and is silenced 2 s;
   for 6 s after, any enemy that casts flares as if it carried 3 Dust */
function itf(A,T,u){ const E=A.eng(); let sum=0, done=0; for(const x of foes(A,u)){ const n=A.ustGet(T,u,x,'du'); if(n>0){ A.ustPut(T,u,x,'du',0); sum+=n; done+=flare(A,T,u,x,n,2); } }
  const L=T.s.m.lan; if(L&&L.alive&&A.markOf(u,L,'lan')){ if(sum>0) done+=flare(A,T,u,L,sum,2); if(L.alive) A.control(T,u,L,'silencedT',2); }
  if(sum>0) afterFlare(A,T,u,done); T.s.itf=E.now()+6; }
/* the Lantern: the enemy with the highest ability power (none has any: the highest attack); ties keep the field's order */
function pickLan(A,T,u,skip){ let b=null, bv=-1, d=null, dv=-1; for(const x of foes(A,u)){ if(x._summon||x===skip) continue; const v=x.apow||0; if(v>bv){ bv=v; b=x; } const w=x.dmg||0; if(w>dv){ dv=w; d=x; } }
  return bv>0?b:d; }
/* ---------------- her cocoons ---------------- */
function track(A,T,u,a,dur){ const E=A.eng(), L=T.s.co||(T.s.co=[]); for(let i=L.length-1;i>=0;i--) if(L[i].a===a) L.splice(i,1); L.push({a,until:E.now()+dur}); A.setMark(T,u,a,'coc',{dur}); }
function hatch(A,T,u,a,k){ const r=T.r, s=T.s; A.setMark(T,u,a,'hat',{dur:4}); (s.hk||(s.hk={}))[a.uid]=k;
  if(r.sd_8_4) A.eng().healUnit(a,a.maxHp*0.02*r.sd_8_4*k);                               // Cocoon Wake
  if(r.sd_3_4&&k>=1) A.acts(T,u,[{cleanse:1,on:'target'}],{u,tgt:a}); }                    // Molting
/* a cocoon of her talents' own (Under Her Wing, The Shared Dream): the larger shield stays, Silk Strength, Waning */
function cocoon(A,T,u,a,size,c){ if(!a||!a.alive||!(size>0)) return; const d=6+(T.P['sh.dur']||0); let x=size; if(T.P.moon&&isWane(A,T)) x*=1+T.P.moon;
  a.shield=Math.max(a.shield||0,x); a.shieldT=Math.max(a.shieldT||0,d); track(A,T,u,a,d); void c; }
module.exports={
  hero:'lysara',
  casting:true,                         // rows ask which of her skills a heal or a control comes from
  times:['hush','itf','w3.until','dlt.*','sdW.*','mw.*.t','lk.*','dg.*','sc.*.until','co.*.until','hq.*.at','sdE.*.at','zz.*.at'],   // this file's own absolute fight times (the wave clock moves them back)
  states:{
    dr:{unit:true,max:5},                                                         // Drowse on each enemy (written by her functions)
    du:{unit:true,max:P('du.max',6),dur:P('du.dur',6)},                          // Dust on each enemy
    ps:{unit:true}                                                                // her talents' count of Powdered Slumber on each enemy
  },
  needs:{ ln_4_1:'ln_1_1', ln_5_2:'ln_1_1', ln_5_3:'ln_1_1', ln_7_1:'ln_1_1', ln_9_4:'ln_1_1', ln_10_1:'ln_1_1', ln_11_1:'ln_1_1', ln_12_1:'ln_1_1', ln_n1:'ln_1_1',
          sd_12_1:'sd_2_1', sd_8_4:'sd_1_4', lm_6_4:'lm_1_4', lm_11_3:'lm_1_4' },
  /* run for her whenever she has any mechanic talent: the bookkeeping of the states her talents share */
  always:[
    {on:'tick',do:[{fn:'tk'}]},
    {on:'wave',do:[{fn:'wave'}]},
    {on:'kit',skill:ULT,do:[{fn:'ultKit'}]},
    {on:'ccHit',if:{casting:ULT,talent:false},do:[{fn:'ultCc'}]},                                     // the ultimate's sleep and slow landed
    {on:'kit',skill:DT,do:[{fn:'dtKit'}]}, {on:'cast',skill:DT,do:[{fn:'dtCast'}]},
    {on:'healOut',skill:DT,reqAny:HEALK,do:[{fn:'hk'}]}, {on:'healOut',skill:'dt',reqAny:HEALK,do:[{fn:'hk'}]},   // Dreamthread's heal, and each tick of its heal over time
    {on:'kit',skill:COC,do:[{fn:'cocKit'}]}, {on:'cast',skill:COC,do:[{fn:'cocCast'}]},
    {on:'hit',if:{targetTeam:'enemy'},do:[{fn:'myHit'}]},                                             // her hits: Drowse, Dust, New Moon, Moonwell
    {on:'out',reqAny:OUTK,if:{targetTeam:'enemy'},do:[{fn:'myOut'}]},
    {on:'teamIn',reqAny:TEAMIN,do:[{fn:'tin'}]},
    {on:'in',reqAny:SELFIN,do:[{fn:'myIn'}]},
    {on:'pass',skill:'slumber',reqAny:PSF,do:[{fn:'psSwing'}]},                                       // Powdered Slumber at her swing
    {on:'teamCast',reqAny:DUST,do:[{fn:'foeCast'}]},                                                  // an enemy casts: its Dust flares
    {on:'death',reqAny:['lm_3_1','lm_4_3'],do:[{fn:'died'}]},
    {on:'pickTgt',reqAny:['lm_2_3'],do:[{fn:'lanTgt'}]},
    {on:['teamHeal','healMe'],reqAny:['sd_3_2','sd_5_3'],do:[{fn:'theal'}]},
    {on:'teamLethal',reqAny:['sd_13_2'],do:[{fn:'sdAlly'}]}, {on:'lethal',reqAny:['sd_13_2'],do:[{fn:'sdSelf'}]}
  ],
  talents:{
    /* ============================== THE LONG NIGHT ============================== */
    ln_1_1:[],                                                                                         // Drowse (myHit / drowseAdd)
    ln_2_4:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                     // Grey Wings
    ln_1_4:[ {param:'ps.gain',add:R(0.01)} ],                                                          // Fine Dust
    ln_2_1:[ {param:'ss',add:R(0.2)} ],                                                                // Sound Sleep
    ln_2_2:[],                                                                                         // Nightmare (woke; drK)
    ln_3_1:[],                                                                                         // Heavy Head (drowseAdd)
    ln_n2:[ {param:'sb',add:R(0.02)} ],                                                                // Slow Breathing
    ln_3_4:[ {stat:{aspd:R(-0.015)},to:{team:'enemy',fn:'psSel'}} ],                                    // Dust in the Eyes
    ln_4_1:[ {stat:{move:R(-0.01)},to:{team:'enemy',ust:{dr:1}},per:{ust:'dr'}} ],                     // Nodding Off
    ln_4_2:[ {stat:{move:R(-0.05)},to:{team:'enemy',has:'ha'}} ],                                      // Waking Terror
    ln_5_2:[],                                                                                         // Twin Dreams (PICK ONE; trySleep)
    ln_5_3:[],                                                                                         // Stopped Clock (PICK ONE; woke / tk)
    ln_5_1:[ {stat:{armor:R(-0.02),mr:R(-0.02)},to:{team:'enemy',fn:'zzSel'}} ],                        // Lamp Out
    ln_4_3:[ {param:'lw',add:R(0.1)} ],                                                                // Long Wings (ultCc)
    ln_5_4:[],                                                                                         // Moonless (tin / flareAmt)
    ln_6_1:[],                                                                                         // Deep Lull (rec)
    ln_6_2:[ {on:'teamHeal',if:{unitHas:'ha'},less:R(0.05)} ],                                         // Bad Dreams
    ln_6_4:[ {param:'haunt',add:R(0.4)} ],                                                             // Haunting
    ln_7_1:[ {param:'dr.fade',add:R(1)} ],                                                             // Drift Off
    ln_7_2:[],                                                                                         // Night Terrors (woke)
    ln_7_3:[ {param:'swb',add:R(0.2)} ],                                                               // Slow Wingbeat (ultCc)
    ln_8_1:[],                                                                                         // Lullaby (rec / myOut)
    ln_8_3:[ {on:'cd',less:R(0.01)} ],                                                                 // Silent Hours
    ln_8_4:[ {param:'ps.hold',add:R(1)} ],                                                             // Choking Dust
    ln_9_2:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',has:'ha'}} ],                                      // Waking Dread
    ln_9_4:[],                                                                                         // Black Window (trySleep)
    ln_10_1:[],                                                                                        // Sleep Paralysis (woke)
    ln_10_3:[],                                                                                        // Grey Hours (tk / drK)
    ln_10_4:[],                                                                                        // Moth Hide (drK)
    ln_11_1:[],                                                                                        // Dreamcatcher (trySleep)
    ln_11_2:[ {param:'qc',add:R(0.3)} ],                                                               // Quiet Court (ultKit)
    ln_11_3:[ {stat:{cdRate:R(-0.03)},to:{team:'enemy',has:'ha'}} ],                                   // Heavy Eyelids
    ln_12_1:[],                                                                                        // Weight of Night (tin)
    ln_12_2:[ {stat:{nrg:R(0.02)}} ],                                                                  // Longest Night
    ln_n1:[],                                                                                          // Wide Awake (trySleep)
    ln_13_2:[],                                                                                        // Hush of Callowmere (SIGNATURE; woke / tk)

    /* ============================== THE SHARED DREAM ============================== */
    sd_2_1:[ {param:'moon',add:R(0.02)} ],                                                             // Moon Phase (tk; hk / cocKit)
    sd_1_2:[],                                                                                         // Dreamshare (share)
    sd_1_4:[ {stat:{aspd:R(0.04)},to:{team:'ally',has:'hat'},per:{fn:'hatK'}} ],                       // Hatching (tk / hatch)
    sd_2_2:[ {param:'dt.dur',add:R(0.5)} ],                                                            // Long Thread
    sd_2_4:[ {stat:{move:R(0.05)},to:{team:'ally',has:'hat'},per:{fn:'hatK'}} ],                       // Bright Wings
    sd_3_2:[],                                                                                         // Shared Breath (theal)
    sd_3_3:[],                                                                                         // Soft Silk (cocKit)
    sd_3_4:[],                                                                                         // Molting (hatch)
    sd_4_1:[],                                                                                         // Full Moon (tk / dtKit / cocKit)
    sd_4_2:[ {param:'sh.dur',add:R(0.3)} ],                                                            // Silk Strength
    sd_4_3:[],                                                                                         // Kind Dreams (hk)
    sd_n1:[],                                                                                          // Lamp in the Window (LINK; drK)
    sd_5_1:[],                                                                                         // New Moon (myHit / drK)
    sd_5_2:[],                                                                                         // Bound Hearts (PICK ONE; dtCast / hk)
    sd_5_3:[],                                                                                         // Wide Weave (PICK ONE; dtCast / theal)
    sd_5_4:[],                                                                                         // Pupa (drK)
    sd_6_2:[ {stat:{armor:R(0.03),mr:R(0.03)},to:{team:'ally',fn:'lkSel'}} ],                           // Dream Armor
    sd_6_3:[],                                                                                         // Night Bloom (tk)
    sd_6_4:[],                                                                                         // Wingbeat (tin)
    sd_7_1:[ {stat:{apow:R(0.01)},if:{fn:'wax'}}, {stat:{hp:R(0.01)},if:{fn:'wane'}} ],                // Moon Tides
    sd_7_3:[],                                                                                         // Second Skin (cocKit / cocCast)
    sd_7_4:[ {on:'ccIn',less:R(0.04)} ],                                                               // Restless Queen (up to 20%)
    sd_8_1:[],                                                                                         // Lunar Clock (tk)
    sd_8_2:[],                                                                                         // Spun Fine (hk)
    sd_8_4:[],                                                                                         // Cocoon Wake (hatch)
    sd_9_1:[],                                                                                         // Syzygy (tk)
    sd_9_2:[ {on:'cd',skill:'green',add:R(-0.15)} ],                                                   // Steady Thread
    sd_9_3:[ {on:'cd',less:R(0.01)} ],                                                                 // Gentle Hours
    sd_10_2:[],                                                                                        // One Dream (tk)
    sd_10_3:[ {param:'qg',add:R(0.01)} ],                                                              // Queen's Grace (ultKit)
    sd_11_1:[],                                                                                        // Moon Basin (myHit)
    sd_11_3:[],                                                                                        // Hatchling (tk)
    sd_n2:[],                                                                                          // Under Her Wing (wave)
    sd_12_1:[ {param:'moon',add:R(0.01)} ],                                                            // Tidal Heart
    sd_12_2:[],                                                                                        // Woven Fate (hk)
    sd_12_4:[],                                                                                        // Wing Shelter (drK)
    sd_13_2:[],                                                                                        // The Shared Dream (SIGNATURE; sdAlly / sdSelf / tk)

    /* ============================== LANTERN MOTH ============================== */
    lm_1_1:[],                                                                                         // Wing Dust (myHit / foeCast)
    lm_1_2:[],                                                                                         // Pale Fire (flareAmt)
    lm_1_4:[],                                                                                         // Lost Aim (lostAim)
    lm_2_1:[ {param:'du.dur',add:R(1)} ],                                                              // Thick Wings
    lm_2_3:[],                                                                                         // The Lantern (wave / lanTgt / tin)
    lm_3_1:[],                                                                                         // Ash Wings (died)
    lm_3_2:[ {on:'cd',less:R(0.01)} ],                                                                 // Moth's Patience
    lm_3_3:[],                                                                                         // Drawn to Light (myHit)
    lm_2_4:[ {param:'ps.max',add:R(0.02)} ],                                                           // Stray Shots
    lm_4_1:[ {stat:{mr:R(-0.02)},to:{team:'enemy',ust:{du:3}}} ],                                      // Smother
    lm_4_3:[],                                                                                         // Lamp Black (died)
    lm_4_4:[],                                                                                         // Dazzle (myOut / flareAmt)
    lm_n1:[],                                                                                          // Once Burned (drK)
    lm_8_1:[],                                                                                         // Bright Burn (flareAmt)
    lm_8_4:[ {param:'ps.fast',add:R(0.1)} ],                                                           // Shaking Hands
    lm_6_1:[],                                                                                         // Fine Powder (flareAmt)
    lm_6_4:[],                                                                                         // Fumble (lostAim)
    lm_7_1:[],                                                                                         // Wick (myOut)
    lm_7_2:[],                                                                                         // Snuffed Light (ultCc / woke / foeCast)
    lm_7_4:[],                                                                                         // Wandering Light (drK)
    lm_8_3:[],                                                                                         // Lightless (myOut / flareAmt)
    lm_5_2:[],                                                                                         // Choking Flare (PICK ONE; tk)
    lm_5_3:[],                                                                                         // Wildfire Dust (PICK ONE; tk)
    lm_5_4:[],                                                                                         // Guttering (afterFlare)
    lm_9_1:[],                                                                                         // Self-Snuffing (foeCast)
    lm_9_2:[],                                                                                         // Dream Silk (cocKit)
    lm_9_3:[],                                                                                         // Hunt the Glow (myOut)
    lm_10_2:[],                                                                                        // Burning Thread (afterFlare)
    lm_10_3:[],                                                                                        // Moth Swarm (dustAdd)
    lm_10_4:[],                                                                                        // Grey Eye (drK)
    lm_11_1:[],                                                                                        // Ember Moth (defMag)
    lm_11_3:[],                                                                                        // Curtain Call (lostAim)
    lm_12_1:[ {param:'du.max',add:R(1)} ],                                                             // Long Wick
    lm_12_3:[ {stat:{nrg:R(0.02)}} ],                                                                  // Bright Night
    lm_11_4:[ {stat:{armor:R(-0.04)},to:'holder:lan'} ],                                               // Glass Lantern
    lm_13_3:[]                                                                                         // Into the Flame (SIGNATURE; woke / itf / foeCast)
  },
  fn:{
    /* ---------------- each tick ---------------- */
    tk(A,T,u,c){ const E=A.eng(), r=T.r, Pp=T.P, s=T.s, now=E.now(); s.api=A;   // the runtime API kept for the tests' pure probes (drProbe, wax / wane)
      /* the flares her enemies' casts set off (queued at the cast, so a flare never strikes from inside the enemy's own skill) */
      if(s.fq&&s.fq.length){ const q=s.fq; s.fq=[];
        for(const e of q){ const t=e.t; if(!t.alive) continue; let done=flare(A,T,u,t,e.n,e.k);
          if(r.lm_5_2&&t.alive) A.control(T,u,t,'silencedT',0.6);                                             // Choking Flare
          if(r.lm_5_3){ const x=A.pick(T,u,{team:'enemy',of:'target',within:3,skip:'target',n:1},{u,tgt:t})[0]; if(x){ done+=flare(A,T,u,x,e.n,e.k); dustAdd(A,T,u,x,2); } }   // Wildfire Dust
          afterFlare(A,T,u,done); } }
      /* the moon */
      if(any(T,MOON)){ s.mt=(s.mt||0)+(c.dt||0); const p=mIdx(T); if(s.mp==null) s.mp=p; else if(p!==s.mp){ s.mp=p;
          if(r.sd_4_1) s.fm=true;                                                                            // Full Moon
          if(r.sd_8_1) nrg(u,4*r.sd_8_1);                                                                    // Lunar Clock
          if(r.sd_9_1&&p%3===0) s.syz=s.mt+4; } }                                                             // Syzygy
      /* her sleeps: who still sleeps, who woke, who died asleep */
      if(r.ln_10_3){ let n=0; for(const x of foes(A,u)) if(asleep(x)) n++; s.nz=n; }
      if(s.zz){ for(const k in s.zz){ const z=s.zz[k], t=z.t;
          if(!t.alive){ delete s.zz[k]; if(r.ln_13_2&&now<(s.hush||-1)) for(const x of side(A,u)) if(!x._summon) nrg(x,5); if(z.kind==='ult') woke(A,T,u,z); continue; }   // the Hush: each enemy that dies asleep
          if(!asleep(t)){ delete s.zz[k]; woke(A,T,u,z); } } }
      if(s.hq&&s.hq.length){ for(let i=0;i<s.hq.length;i++){ const e=s.hq[i]; if(now<e.at-1e-9) continue; s.hq.splice(i--,1); if(e.t.alive&&!((e.t.stunned||0)>0)) putSleep(A,T,u,e.t,1.2*(1+(Pp.sb||0)),'hush'); } }   // the Hush's second sleep
      if(s.sc){ for(const k in s.sc){ const h=s.sc[k], t=h.t; if(!t.alive||now>=h.until){ delete s.sc[k]; continue; } if(t.greenCd<h.g) t.greenCd=h.g; if(t.blueCd<h.b) t.blueCd=h.b; } }   // Stopped Clock
      /* her cocoons: ended unbroken (its time ran out) = Hatching; broken = Hatchling; either = Night Bloom */
      if(s.co&&s.co.length){ for(let i=0;i<s.co.length;i++){ const e=s.co[i], a=e.a; if(!a.alive){ s.co.splice(i--,1); continue; }
          const gone=!((a.shield||0)>0), over=now>=e.until-1e-6; if(!gone&&!over) continue; s.co.splice(i--,1); A.clearMark(u,a,'coc');
          const broke=gone&&now<e.until-0.05;
          if(r.sd_6_3) E.healUnit(a,a.maxHp*0.03*r.sd_6_3);                                                  // Night Bloom
          if(!broke&&(r.sd_1_4||r.sd_2_4||r.sd_6_4||r.sd_8_4||r.sd_3_4)) hatch(A,T,u,a,1);
          else if(broke&&r.sd_11_3) hatch(A,T,u,a,0.15*r.sd_11_3); } }
      /* One Dream: a new shield on a linked ally gives its partner 40% of it (the larger stays); a shield it gave is not passed back */
      if(r.sd_10_2){ const od=s.od||(s.od={});
        for(const x of side(A,u)){ const cur=x.shield||0, prev=od[x.uid]; od[x.uid]=cur; if(prev==null||!(cur>prev+1e-6)) continue; const p=partnerOf(A,T,u,x)||(linked(A,T,u,x)&&s.w3?s.w3.c:null);
          if(p&&p.alive){ const ns=cur*0.4; if(ns>(p.shield||0)){ p.shield=ns; p.shieldT=Math.max(p.shieldT||0,x.shieldT||0); } od[p.uid]=p.shield||0; } } }
      /* The Shared Dream: the dream ends, both wake inside a cocoon worth 3x her ability power */
      if(s.sdE&&s.sdE.length){ for(let i=0;i<s.sdE.length;i++){ const e=s.sdE[i]; if(now<e.at-1e-9) continue; s.sdE.splice(i--,1); for(const x of [e.a,e.b]) if(x&&x.alive) cocoon(A,T,u,x,3*apNow(u),c); } } },
    wave(A,T,u){ const E=A.eng(), r=T.r, s=T.s; s.zz={}; s.hq=[]; s.sc={}; s.co=[]; s.fq=[]; s.dg={}; s.lk={}; s.hd={}; s.hush=-1; s.itf=-1; s.od={}; s.sdE=[];
      if(any(T,LAN)){ const L=pickLan(A,T,u); if(L) A.setMark(T,u,L,'lan',{unique:true}); }
      if(r.sd_n2){ const near=side(A,u).filter(x=>x!==u&&!x._summon).map(x=>[x,A.gap(u,x)]).sort((a,b)=>a[1]-b[1]).slice(0,2);   // Under Her Wing: her two nearest allies
        const lv=(u.skillLv&&u.skillLv[2])||1, base=apNow(u)*((u.blueAb&&u.blueAb.mul)||2.2)*(E.skillMul?E.skillMul(lv):1);
        for(const [x] of near) cocoon(A,T,u,x,base*0.15*r.sd_n2); } },
    /* ---------------- Queen of Quiet Wings ---------------- */
    ultKit(A,T,u,c){ const Pp=T.P, s=T.s; s.ultId=(s.ultId||0)+1;
      if(Pp.qg) c.o.buff=(c.o.buff||1.3)+Pp.qg;                                                               // Queen's Grace: points on the team damage bonus
      if(Pp.qc) c.o.dur=(c.o.dur||8)+Pp.qc; },                                                                 // Quiet Court
    ultCc(A,T,u,c){ const t=c.tgt, r=T.r, Pp=T.P; if(!t||t.team===u.team||!t.alive) return;
      if(c.field==='slow'){ if(Pp.swb) t.slow=Math.max(t.slow||0,Math.min(CAP,c.amt+Pp.swb)); return; }        // Slow Wingbeat: in full on the real 2.1 s
      if(c.field!=='stunned') return;
      const d=Math.min(CAP,c.amt*(1+(Pp.sb||0))+(Pp.lw||0)); if(d>(t.stunned||0)) t.stunned=d; t._sleepT=Math.max(t._sleepT||0,t.stunned);   // Slow Breathing x the real 2.8 s, + Long Wings
      rec(A,T,u,t,'ult');
      if(r.lm_7_2) dustAdd(A,T,u,t,3); },                                                                      // Snuffed Light
    /* ---------------- Dreamthread ---------------- */
    dtKit(A,T,u,c){ const s=T.s, Pp=T.P; if(Pp['dt.dur']) c.o.dur=(c.o.dur||8)+Pp['dt.dur'];
      s.fmNow=!!s.fm; s.fm=false; if(any(T,HEALK)) A.acts(T,u,[{tagHots:'kit'}],c); },
    dtCast(A,T,u,c){ const E=A.eng(), r=T.r, s=T.s, o=c.o||{}, dur=o.dur||8, now=E.now();
      if(any(T,HEALK)){ A.acts(T,u,[{tagHots:'dt'}],c); for(const x of side(A,u)) for(const h of (x.hots||[])) if(h._talU===u&&h._talK==='dt'&&!h._lyMk){ h._lyMk=1; h._lyFm=!!s.fmNow; } }
      const al=side(A,u).sort((a,b)=>frac(a)-frac(b)), a1=al[0], a2=al[1];
      if(r.sd_5_2&&a1&&a2){ const x=al.find(y=>y!==u&&!y._summon); if(x){ for(const y of [a1,a2]) if(y!==x&&y!==u){ y._linkTo=null; y._linkT=0; }   // Bound Hearts: the lowest-HP ally is linked to her
          x._linkTo=u; u._linkTo=x; x._linkT=u._linkT=dur; A.setMark(T,u,x,'bh',{dur}); } }
      if(r.sd_5_3&&a1&&a2&&al[2]){ const a3=al[2], sm=u._castSM||1, h=(u.apow||0)*(o.mul||0.5)*sm, keep=s.cur;     // Wide Weave: the third lowest is linked too (to the lowest)
        s.cur=DT; try{ E.healFrom(u,a3,h); } finally{ s.cur=keep; }
        E.pushHot(a3,a3.maxHp*(o.hot||0.02),dur,1); const hh=a3.hots[a3.hots.length-1]; if(hh){ hh._talU=u; hh._talK='dt'; hh._lyMk=1; hh._lyFm=!!s.fmNow; }
        s.w3={a:a1,c:a3,until:now+dur}; }
      s.fmNow=false; },
    /* her Dreamthread heals: Moon Phase (Waxing), Full Moon, Kind Dreams (the heal over time), Spun Fine (the first heal), Bound Hearts, Woven Fate; they add */
    hk(A,T,u,c){ const x=c.tgt, r=T.r, Pp=T.P; if(!x) return; let k=1;
      if(Pp.moon&&isWax(A,T)) k+=Pp.moon;
      if(c.hot){ if(c.h&&c.h._lyFm) k+=0.25; k+=0.04*(r.sd_4_3||0); } else { if(T.s.fmNow) k+=0.25; k+=0.03*(r.sd_8_2||0); }
      if(r.sd_5_2&&A.markOf(u,x,'bh')) k+=0.30;
      if(r.sd_12_2&&linked(A,T,u,x)) k+=0.02*r.sd_12_2;
      c.amt*=k; },
    /* healing a linked ally receives: Shared Breath (3% per rank to its partner), Wide Weave (the third ally shares 35% with the lowest, both ways, as the game's link does) */
    theal(A,T,u,c){ const E=A.eng(), r=T.r, x=c.unit; if(!x||x.team!==u.team||!(c.amt>0)) return; const got=Math.max(0,Math.min(c.amt,E.healCap(x)-x.hp)); if(!(got>0)) return;
      const p=partnerOf(A,T,u,x); if(r.sd_3_2&&p) E.healUnit(p,got*0.03*r.sd_3_2);
      const w=T.s.w3; if(r.sd_5_3&&w&&E.now()<w.until){ if(x===w.c&&w.a.alive) E.healUnit(w.a,got*0.35); else if(x===w.a&&w.c.alive) E.healUnit(w.c,got*0.35); } },
    /* ---------------- Moon Cocoon ---------------- */
    cocKit(A,T,u,c){ const r=T.r, s=T.s, Pp=T.P; let k=1;
      if(Pp.moon&&isWane(A,T)) k+=Pp.moon; k+=0.02*(r.sd_3_3||0)+0.02*(r.lm_9_2||0);                             // Moon Phase (Waning), Soft Silk, Dream Silk
      if(s.fm){ s.fm=false; k+=0.25; }                                                                           // Full Moon
      c.o.mul=(c.o.mul||2.4)*k; if(Pp['sh.dur']) c.o.dur=(c.o.dur||6)+Pp['sh.dur'];
      s.cs=side(A,u).map(x=>[x,x.shield||0,x.shieldT||0]); s.ss=null;
      if(r.sd_7_3){ s.ss={mul:c.o.mul,dur:c.o.dur||6}; c.o.radius=-1; } },                                       // Second Skin: no dome; the two weakest instead (cocCast)
    cocCast(A,T,u,c){ const s=T.s, o=c.o||{}, dur=o.dur||6;
      if(s.ss){ const sh=apNow(u)*(u._castSM||1)*s.ss.mul*0.6; for(const x of side(A,u).sort((a,b)=>frac(a)-frac(b)).slice(0,2)){ x.shield=Math.max(x.shield||0,sh); x.shieldT=Math.max(x.shieldT||0,s.ss.dur); } s.ss=null; }
      if(any(T,COCF)) for(const [x,sh,st] of (s.cs||[])) if(x.alive&&((x.shield||0)>sh+1e-9||(x.shieldT||0)>st+1e-9)) track(A,T,u,x,x.shieldT||dur);
      s.cs=null; },
    /* ---------------- her hits ---------------- */
    myHit(A,T,u,c){ const E=A.eng(), r=T.r, t=c.tgt; if(!t) return;
      if(r.sd_5_1&&isWane(A,T)&&t.alive) A.setMark(T,u,t,'nm',{dur:2});                                          // New Moon
      if(!c.auto) return;
      if(r.sd_11_1&&isWax(A,T)){ const x=E.lowestAlly(u); if(x&&x.alive){ const m=T.s.mw||(T.s.mw={}), now=E.now(), q=m[x.uid]||(m[x.uid]={t:now,b:0.012*x.maxHp});   // Moon Basin: at most 1.2% of its max HP a second
          q.b=Math.min(0.012*x.maxHp,q.b+(now-q.t)*0.012*x.maxHp); q.t=now; const h=Math.min(q.b,apNow(u)*0.02*r.sd_11_1); if(h>0){ q.b-=h; E.healUnit(x,h); } } }
      if(!t.alive) return;
      drowseAdd(A,T,u,t,1);
      if(r.lm_1_1){ let n=1; if(r.lm_3_3&&isLan(A,T,u,t)&&E.rnd()<0.15*r.lm_3_3) n=2; dustAdd(A,T,u,t,n); } },   // Wing Dust (Drawn to Light: a seeded roll, last)
    myOut(A,T,u,c){ const r=T.r, t=c.tgt; if(!t) return; let k=1;
      if(c.auto){ if(r.ln_8_1&&asleep(t)) k*=1+0.10*r.ln_8_1;                                                     // Lullaby
        const n=A.ustGet(T,u,t,'du'); if(r.lm_7_1&&n>0) k*=1+0.01*r.lm_7_1*n; if(r.lm_9_3&&n>0) k*=1+0.02*r.lm_9_3; }   // Wick, Hunt the Glow
      if(r.lm_8_3&&isLan(A,T,u,t)) k*=1+0.02*r.lm_8_3;                                                            // Lightless
      if(r.lm_4_4&&psFull(A,T,u,t)) k*=1+0.01*r.lm_4_4;                                                           // Dazzle
      c.amt*=k; },
    /* hits on enemies by her side (Moonless, The Lantern, Weight of Night, Wingbeat), and enemy hits on her allies (Lost Aim, her capped group, Dreamshare) */
    tin(A,T,u,c){ const t=c.tgt, s=c.src, r=T.r; if(!t||!s) return;
      if(t.team!==u.team){ if(s.team!==u.team) return; let k=1;
        if(r.ln_5_4&&A.markOf(u,t,'ha')) k*=1+0.015*r.ln_5_4;
        if(r.lm_2_3&&isLan(A,T,u,t)) k*=1+0.015*r.lm_2_3;
        const z=T.s.zz&&T.s.zz[t.uid]; if(z&&z.kind==='drowse'&&!z.hit&&!((t._sleepT||0)>0)){ z.hit=s; if(r.ln_12_1) k*=1+0.04*r.ln_12_1; }   // the hit that woke it
        if(r.sd_6_4&&A.markOf(u,s,'hat')) k*=1+0.015*r.sd_6_4*((T.s.hk||{})[s.uid]||0);
        c.amt*=k; return; }
      if(s.team===u.team||t===u) return;
      if(lostAim(A,T,u,c)) return;
      c.amt*=drK(A,T,u,t,s,c.kind,c.auto,true); share(A,T,u,c); },
    myIn(A,T,u,c){ if(lostAim(A,T,u,c)) return; c.amt*=drK(A,T,u,u,c.src,c.kind,c.auto,true); share(A,T,u,c); },
    /* Powdered Slumber dusted her target at this swing: her talents' count (5% x passMul + Fine Dust, x Shaking Hands; at most 35% + Stray Shots; holds 4 s + Choking Dust) */
    psSwing(A,T,u,c){ const t=c.tgt, Pp=T.P; if(!t||!t.alive) return; const pm=u.passMul||1, g=(0.05+(Pp['ps.gain']||0))*pm*(1+(Pp['ps.fast']||0));
      A.ustPut(T,u,t,'ps',Math.min(psMax(T),A.ustGet(T,u,t,'ps')+g),4+(Pp['ps.hold']||0)); },
    /* an enemy casts (teamCast): its Dust flares, at the next tick (Snuffed Light x2 within 3 s of waking from her ultimate; Into the Flame: at least 3 Dust);
       the Lantern's cast with Self-Snuffing flares all of it and keeps half */
    foeCast(A,T,u,c){ const E=A.eng(), r=T.r, t=c.unit; if(!t||t.team===u.team||!t.alive) return; let n=A.ustGet(T,u,t,'du'); const w=E.now()<(T.s.itf||-1);
      if(w) n=Math.max(n,3); if(!(n>0)) return;
      const keep=(r.lm_9_1&&isLan(A,T,u,t))?Math.floor(A.ustGet(T,u,t,'du')/2):0; A.ustPut(T,u,t,'du',keep,6+(T.P['du.dur']||0));
      (T.s.fq||(T.s.fq=[])).push({t,n,k:A.markOf(u,t,'sn')?2:1}); },
    /* a watched unit died: Ash Wings (its Dust flares on every enemy within 2 m), Lamp Black (the next Lantern takes all its Dust) */
    died(A,T,u,c){ const x=c.unit, r=T.r; if(!x||x.team===u.team) return; const n=A.ustGet(T,u,x,'du');
      if(r.lm_3_1&&n>0){ let done=0; for(const y of A.pick(T,u,{team:'enemy',of:'unit',within:2,skip:'unit'},c)) done+=flare(A,T,u,y,n,1); afterFlare(A,T,u,done); }
      if(r.lm_4_3&&T.s.m.lan===x){ const L=pickLan(A,T,u,x); if(L){ A.setMark(T,u,L,'lan',{unique:true}); if(n>0) dustAdd(A,T,u,L,n,true); } }
      if(n>0) A.ustPut(T,u,x,'du',0); },
    /* The Lantern: her basic attacks go to it while it is in her reach */
    lanTgt(A,T,u,c){ const L=T.s.m.lan, E=A.eng(); if(!L||!L.alive||!A.markOf(u,L,'lan')||L._noTarget||L._dropHidden) return; if(E.dist(u,L)<=(u.range||0)) c.tgt=L; },
    /* ---------------- The Shared Dream ---------------- */
    sdAlly(A,T,u,c){ const E=A.eng(), x=c.unit, s=T.s; if(!x||x===u||x.team!==u.team||x._summon) return; const W=s.sdW||(s.sdW={}), now=E.now();
      if(now<(W[x.uid]||-1)){ A.acts(T,u,[{atOne:'unit'}],c); return; }                                             // the dream holds them (a DoT, a second blow)
      const U=s.sdU||(s.sdU={}); if(U[x.uid]||!linked(A,T,u,x)) return; U[x.uid]=1; A.acts(T,u,[{atOne:'unit'}],c); T.fn.dream(A,T,u,x); },
    sdSelf(A,T,u,c){ const s=T.s, U=s.sdU||(s.sdU={}); if(U[u.uid]||!linked(A,T,u,u)) return; U[u.uid]=1; A.acts(T,u,[{undying:2}],c); T.fn.dream(A,T,u,u); },
    dream(A,T,u,x){ const E=A.eng(), now=E.now(), s=T.s; (s.sdW||(s.sdW={}))[x.uid]=now+2; x._noTarget=true; x._noTargetT=Math.max(x._noTargetT||0,2);
      const p=partnerOf(A,T,u,x)||(s.w3&&x===s.w3.a?s.w3.c:null); if(p&&p.alive) E.healUnit(p,p.maxHp*0.15);
      (s.sdE||(s.sdE=[])).push({at:now+2,a:x,b:p}); },
    /* ---------------- counts, selectors and conditions ---------------- */
    hatK(A,T,u,c){ const x=c.tgt; return (x&&A.markOf(u,x,'hat'))?((T.s.hk||{})[x.uid]||0):0; },
    psSel(A,T,u,c){ return psFull(A,T,u,c.tgt); },
    zzSel(A,T,u,c){ return asleep(c.tgt); },
    lkSel(A,T,u,c){ return linked(A,T,u,c.tgt); },
    wax(A,T){ return isWax(A,T); },
    wane(A,T){ return isWane(A,T); },
    /* the 95% instrument (tests): the share her group lets through on a hit on t from s, with no action and no draw */
    drProbe(A,T,u,t,s,kind,auto){ return drK(A,T,u,t,s,kind,auto,false); }
  },
  partial:{},
  /* nothing implemented: needs engine work. None: every talent has rows (readings and reworded tooltips in WIRING/37 - LYSARA MOONVEIL - talent decisions.md) */
  ruling:{}
};
