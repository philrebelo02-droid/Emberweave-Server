'use strict';
/* The controls for Morvayne's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script). Each control copies this checkout to a
   temp folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page site removed or given an unguarded
   seeded draw, a row or a number of his broken), runs the named tests of tests/talents-mech-morvayne.test.js in that copy, and expects them to FAIL. The checkout
   itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught. J=1 by default: one copy at a time, each deleted as
   soon as it has run (the wiring brief's rule). ONLY=<regex> runs a subset. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const r=(id,from,to,pat)=>[id,FXJ,from,to,pat];
const C=[
  // ---- the page sites (removed: his talents stop; an unguarded draw: the no-talent identity breaks) ----
  ['the cast-time site',HTML,"  if(u._tal&&u._tal.on.num) ct=TalentFx.num(u,'h61ct:'+slot,ct,target||null);","  ",'real kit'],
  ['the ultimate target site',HTML,"if(u._tal&&u._tal.on.skillTgt) target=TalentFx.skillTgt(u,'h61ult',target)||target;","",'real kit'],
  ['the protection length site',HTML,"battleTime+((u._tal&&u._tal.on.num)?TalentFx.num(u,'h61imm',4,target):4);","battleTime+4;",'real kit'],
  ['the heal target site',HTML,"if(ally&&u._tal&&u._tal.on.skillTgt) ally=TalentFx.skillTgt(u,'h61'+slot,ally)||ally;","",'Knocks'],
  ['the heal partPre site',HTML,"if(ally){if(u._tal) TalentFx.partPre(u,ally,'h61'+slot);","if(ally){",'his casts'],
  ['the heal part site',HTML,"if(u._tal) TalentFx.part(u,ally,'h61'+slot);}","}",'Unbroken'],
  ['the ultimate part site',HTML,"if(u._tal) TalentFx.part(u,target,'h61ult');","",'signatures'],
  ['the Shelter cooldown site',HTML,"u.blueCd=(u._tal&&u._tal.on.cd)?TalentFx.cd(u,'blue',8):8;","u.blueCd=8;",'real kit'],
  ['the Armor site',HTML,"+HERO61.aura(tgt,units)+(tgt._moAr||0))*rk","+HERO61.aura(tgt,units))*rk",'Iron'],
  ['the magic resist site',HTML,"Math.max(0,(tgt.mrRating||0)+(tgt._moMr||0))*rk","Math.max(0,(tgt.mrRating||0))*rk",'Evening Bell'],
  ['the unitArmorNow site',HTML,"+HERO61.aura(u,units)+(u._moAr||0))*","+HERO61.aura(u,units))*",'Iron'],
  ['the swing site',HTML,"if((u.key!==HERO61.KEY||HERO61.canAttack(u,units)||u._moSwing>0) && u.atkCd<=0","if((u.key!==HERO61.KEY||HERO61.canAttack(u,units)) && u.atkCd<=0",'real kit'],
  ['the timed blow site',HTML,"if(HERO61.canAttack(u,units)||u._moSwing>0)return land();","if(HERO61.canAttack(u,units))return land();",'real kit'],
  ['an unguarded draw at the cast time',HTML,"  let ct=HERO61.CAST[slot]; const lv=","  let ct=HERO61.CAST[slot]+0*brnd(); const lv=",'no talents'],
  ['an unguarded draw at the heal target',HTML,"      let ally=HERO61.weakest(u,units);","      let ally=HERO61.weakest(u,units); brnd();",'no talents'],
  ['an unguarded draw at the cooldown',HTML,"u.blueCd=(u._tal&&u._tal.on.cd)?TalentFx.cd(u,'blue',8):8;","u.blueCd=(u._tal&&u._tal.on.cd)?TalentFx.cd(u,'blue',8):8+0*brnd();",'no talents'],
  ['an unguarded draw at the ultimate',HTML,"battleTime+((u._tal&&u._tal.on.num)?TalentFx.num(u,'h61imm',4,target):4);","battleTime+((u._tal&&u._tal.on.num)?TalentFx.num(u,'h61imm',4,target):4+0*brnd());",'no talents'],
  ['an unguarded draw at the Armor',HTML,"+HERO61.aura(tgt,units)+(tgt._moAr||0))*rk","+HERO61.aura(tgt,units)+(tgt._moAr||0)+0*brnd())*rk",'no talents'],
  // ---- Knocks ----
  r('Knock at 10%',"if(has(T,KNOCK)&&c.amt>0.10*(t.maxHp||0))","if(has(T,KNOCK)&&c.amt>0.08*(t.maxHp||0))",'Knocks'),
  r('Knocks max 3',"KN_MAX=3,","KN_MAX=4,",'Knocks'),
  r('Knocks 6 s',"KN_DUR=6,","KN_DUR=7,",'Knocks'),
  r('not on himself',"if(!x||x===u||!hero(x)) return; const mx=T.fn.knMax(A,T);","if(!x||!hero(x)) return; const mx=T.fn.knMax(A,T);",'Knocks'),
  r('A Small Knock 2%',"oh_1_1:[ {param:'knock',add:R(0.02)} ],","oh_1_1:[ {param:'knock',add:R(0.03)} ],",'Knocks'),
  r('Heard Through Iron',"oh_2_1:[ {param:'knDur',add:R(1)} ],","oh_2_1:[ {param:'knDur',add:R(0)} ],",'Knocks'),
  r('Every Voice Reaches',"oh_8_1:[ {param:'knMax',add:R(1)} ],","oh_8_1:[ {param:'knMax',add:R(0)} ],",'Knocks'),
  r('Petitioner\'s Due',"if(P.pet&&T.fn.knN(A,T,u,t)>0) cut(P.pet);","",'Knocks'),
  r('A King Who Listens',"if(P.listen&&T.fn.anyKnock(A,T,u)) cut(P.listen);","",'Knocks'),
  r('Hall Never Closed',"if(P.hnc&&x!==u&&T.fn.knN(A,T,u,x)>0) x.energy=","if(false) x.energy=",'Knocks'),
  r('Open Door: the most Knocks',"if(slot==='green'&&P.door){","if(slot==='green'&&false){",'Knocks'),
  r('Open Door 20%',"if(P.door&&T.fn.knN(A,T,u,x)>=3) sb+=0.20;","if(P.door&&T.fn.knN(A,T,u,x)>=3) sb+=0.10;",'Knocks'),
  r('Answer the Knock',"if(r.n>=mx&&was<mx){ v.st.full++; if(P.atk) v.ak[x.uid]=1; } },","if(r.n>=mx&&was<mx){ v.st.full++; } },",'Knocks'),
  r('an instant cast\'s recovery',"u._h61Rec=Math.max(u._h61Rec||0,0.5*CAST[slot]);","u._h61Rec=Math.max(u._h61Rec||0,0);",'Knocks'),
  r('Answer the Knock once',"if(y){ delete v.ak[y.uid]; if(v.swf===y) v.swf=null; } }","if(y){ if(v.swf===y) v.swf=null; } }",'Knocks'),
  // ---- Violet Fire ----
  r('Violet Fire 1%',"oh_2_2:[ {param:'vf',add:R(0.01)} ],","oh_2_2:[ {param:'vf',add:R(0.012)} ],",'Violet Fire'),
  r('Violet Fire 4 s',"VF_DUR=4,","VF_DUR=5,",'Violet Fire'),
  r('Slow Burning',"oh_4_2:[ {param:'vfDur',add:R(1)} ],","oh_4_2:[ {param:'vfDur',add:R(0)} ],",'Violet Fire'),
  r('the regeneration cap',"SOON_CAP=0.25, REGEN=0.012,","SOON_CAP=0.25, REGEN=0.012e3,",'Violet Fire'),
  r('Fire in the Seams x3',"P.vf*heal*(sk==='h61blue'&&P.fits?3:1)","P.vf*heal*(sk==='h61blue'&&P.fits?2:1)",'Violet Fire'),
  r('Fire in the Seams spreads',"if(sk==='h61blue'&&P.fits){ const y=T.fn.nearestTo(A,T,u,x);","if(false){ const y=T.fn.nearestTo(A,T,u,x);",'Violet Fire'),
  r('Spreading Fire',"oh_9_2:[ {param:'spread',add:R(0.03)} ],","oh_9_2:[ {param:'spread',add:R(0.02)} ],",'Violet Fire'),
  r('Crowned Young once',"if(P.cy&&!r.cy&&x.hp<0.5*x.maxHp){ r.cy=1; r.t=P.cy; }","if(P.cy&&x.hp<0.5*x.maxHp){ r.cy=1; r.t=P.cy; }",'Violet Fire'),
  r('Crowned Young under half',"if(P.cy&&!r.cy&&x.hp<0.5*x.maxHp){","if(P.cy&&!r.cy&&x.hp<0.05*x.maxHp){",'Violet Fire'),
  r('Steward\'s Care',"if(P.stew&&T.fn.vfOn(A,T,x)) hg+=P.stew;","",'Violet Fire'),
  r('Quick Mercy',"(sk==='h61green'&&P.mf?(P.qm||0):0)","0",'Violet Fire'),
  // ---- Unbroken ----
  r('Unbroken max 5',"unbMax(A,T){ return 5+(T.P.unbMax||0); },","unbMax(A,T){ return 6+(T.P.unbMax||0); },",'Unbroken'),
  r('Unbroken: a control loses them',"if(p&&ctl(u)&&!v.cut){ v.cut=1; v.unb=0; v.st.cut++; }","if(p&&ctl(u)&&!v.cut){ v.cut=1; v.st.cut++; }",'Unbroken'),
  r('Unbroken: a cut cast adds none',"if(has(T,UNB)){ if(!v.cut){ const was=v.unb;","if(has(T,UNB)){ if(true){ const was=v.unb;",'Unbroken'),
  r('Unbroken: a silence loses them',"if(v.pp&&p!==v.pp){ if(ctl(u)&&!v.cut){ v.unb=0; v.st.cut++; } v.cut=0; }","if(v.pp&&p!==v.pp){ v.cut=0; }",'Unbroken'),
  r('Even Hands 1.5%',"oh_4_4:[ {param:'unb',add:R(0.015)} ],","oh_4_4:[ {param:'unb',add:R(0.01)} ],",'Unbroken'),
  r('Grain and Axles',"oh_5_1:[ {param:'grain',add:R(0.01)} ],","oh_5_1:[ {param:'grain',add:R(0.02)} ],",'Unbroken'),
  r('Fair Hearing',"if(P.fair) hg+=P.fair*v.unb;","",'Unbroken'),
  r('Reign of Mercy',"oh_11_4:[ {param:'reign',add:R(0.003)} ],","oh_11_4:[ {param:'reign',add:R(0.004)} ],",'Unbroken'),
  r('Calm Ruler at 5',"if(P.calm&&v.unb>=5) cut(P.calm);","if(P.calm&&v.unb>=4) cut(P.calm);",'Unbroken'),
  r('Unhurried Crown',"if(P.uc) v.unb=Math.max(v.unb,Math.min(T.fn.unbMax(A,T),P.uc));","",'Unbroken'),
  r('Not Rushed',"oh_8_4:[ {param:'unbMax',add:R(1)} ],","oh_8_4:[ {param:'unbMax',add:R(0)} ],",'Unbroken'),
  // ---- his casts ----
  r('Mercy First 0.3 s',"if(slot==='green'){ if(P.mf) flat+=0.3;","if(slot==='green'){ if(P.mf) flat+=0.2;",'real kit'),
  r('Mercy First +2 s',"c.amt=Math.max(0,c.amt+(P.mf?2:0)-(P.sf?2:0)); },","c.amt=Math.max(0,c.amt-(P.sf?2:0)); },",'real kit'),
  r('Shelter First -2 s',"c.amt=Math.max(0,c.amt+(P.mf?2:0)-(P.sf?2:0)); },","c.amt=Math.max(0,c.amt+(P.mf?2:0)); },",'his casts'),
  r('Shelter First 15% less',"if(P.sf) sb-=0.15;","if(P.sf) sb-=0.10;",'his casts'),
  r('Watched Road',"rb_2_2:[ {param:'mercCt',add:R(0.03)} ],","rb_2_2:[ {param:'mercCt',add:R(0.05)} ],",'his casts'),
  r('Measured Breath',"oh_7_4:[ {param:'shelCt',add:R(0.05)} ],","oh_7_4:[ {param:'shelCt',add:R(0)} ],",'his casts'),
  r('Heavy Plate slower',"if(P.heavyCt) slow+=P.heavyCt;","",'his casts'),
  r('the 0.5 s floor',"CT_FLOOR=0.5,","CT_FLOOR=0.3,",'his casts'),
  r('Shelter heals more',"else { sb+=P.shel||0; if(P.great&&P.sf) sb+=P.great;","else { if(P.great&&P.sf) sb+=P.great;",'his casts'),
  r('Great Shelter with Shelter First',"if(P.great&&P.sf) sb+=P.great;","",'his casts'),
  r('Patient Mercy below half',"if(P.patient&&share<0.5) sb+=P.patient;","if(P.patient&&share<0.2) sb+=P.patient;",'his casts'),
  r('Open Ear below 40%',"if(P.ear&&share<0.4) hg+=P.ear;","if(P.ear&&share<0.25) hg+=P.ear;",'his casts'),
  r('the RISK costs',"myIn(A,T,u,c){ const P=T.P; c.amt*=T.fn.drK(A,T,u,c.src,c.kind,c.auto); if(P.risk) c.amt*=1+P.risk; },","myIn(A,T,u,c){ const P=T.P; c.amt*=T.fn.drK(A,T,u,c.src,c.kind,c.auto); },",'his casts'),
  // ---- Iron and An Open Gate ----
  r('Iron max 10',"IRON_MAX=10,","IRON_MAX=11,",'Iron'),
  r('Iron 8 s',"IRON_DUR=8,","IRON_DUR=9,",'Iron'),
  r('Iron fades',"if(v.iron>0&&!(v.ironT>0)){ v.iron=0; v.ironFull=0; }","",'Iron'),
  r('Iron Shield 1%',"ig_1_2:[ {param:'ironG',add:R(0.01)} ],","ig_1_2:[ {param:'ironG',add:R(0.012)} ],",'Iron'),
  r('Shield Rim',"if(P.rim) cut(P.rim*v.iron);","",'Iron'),
  r('Iron Answer 1% an Iron',"if(w) E.healUnit(w,0.01*n*(w.maxHp||0)); return; }","if(w) E.healUnit(w,0.02*n*(w.maxHp||0)); return; }",'Iron'),
  r('Iron Answer spends it',"v.iron=0; v.ironFull=0; v.st.ironAns++;","v.st.ironAns++;",'Iron'),
  r('Hammered Gate basic attacks',"if(P.hammer&&full&&c.auto) cut(0.10);","if(P.hammer&&full) cut(0.10);",'Iron'),
  r('within 4 m',"if(g<=4){ if(P.hammer","if(g<=9){ if(P.hammer",'Iron'),
  r('Banner Companies',"ig_10_2:[ {param:'banner',add:R(0.005)} ],","ig_10_2:[ {param:'banner',add:R(0.004)} ],",'Iron'),
  r('Shield by the Chair',"if(P.chair&&has(T,IRON)){","if(false){",'Iron'),
  r('Rooted at the Gate',"if(slot!=='ult'&&P.unmoved) fast+=P.unmoved*v.iron;","",'Iron'),
  // ---- the bell and the gate ----
  r('the bell every 15 s',"BELL_PERIOD=15,","BELL_PERIOD=16,",'Evening Bell'),
  r('the bell 3 s',"BELL_RING=3,","BELL_RING=4,",'Evening Bell'),
  r('Before the Bell',"ig_4_3:[ {param:'btb',add:R(1)} ],","ig_4_3:[ {param:'btb',add:R(0)} ],",'Evening Bell'),
  r('The Evening Bell 4%',"ig_2_3:[ {param:'bell',add:R(0.04)} ],","ig_2_3:[ {param:'bell',add:R(0.03)} ],",'Evening Bell'),
  r('the bell\'s half as magic resist',"(ring&&P.bell?0.5*a:0)","(ring&&P.bell?0.4*a:0)",'Evening Bell'),
  r('Bell Iron',"if(v.bellT>0) cut(P.bellIron);","",'Evening Bell'),
  r('Bell of Mercy 40%',"E.healUnit(y,0.40*(1+(P.ring||0))*heal); } },","E.healUnit(y,0.30*(1+(P.ring||0))*heal); } },",'Evening Bell'),
  r('Bell of Mercy within 3 m',"if(y!==x&&hero(y)&&T.fn.gap(A,x,y)<=3)","if(y!==x&&hero(y)&&T.fn.gap(A,x,y)<=30)",'Evening Bell'),
  r('Bell Before Dark',"if(P.bbd) v.bellT=Math.max(v.bellT,d);","",'Evening Bell'),
  r('Close the Gate 20%',"const cg=P.ctg?((x===u||x===nr)?1.2:0.8):1,","const cg=P.ctg?((x===u||x===nr)?1.2:1):1,",'Evening Bell'),
  r('At His Shoulder',"if(P.shoulder&&P.ctg&&t===T.fn.nearestTo(A,T,u,u,T.fn.mates(A,T,u))) cut(P.shoulder);","",'Evening Bell'),
  r('Open the Gate 5%',"(P.otg?(0.05+(P.wide||0))*a:0)","(P.otg?(0.04+(P.wide||0))*a:0)",'Evening Bell'),
  r('Plate and Mail',"const mr=(x===u?(P.pm||0)*a:0)+","const mr=0+",'Evening Bell'),
  r('Strong Walls',"ig_5_2:[ {param:'walls',add:R(0.015)} ],","ig_5_2:[ {param:'walls',add:R(0.01)} ],",'Evening Bell'),
  // ---- Last Watch ----
  r('Last Watch: the last hero',"alone(A,T,u){ const E=A.eng(); for(const x of E.units()) if(x.alive&&x.team===u.team&&x!==u&&hero(x)) return false; return true; },","alone(A,T,u){ return true; },",'Last Watch'),
  r('Last Watch 2%',"ig_4_4:[ {param:'lwDr',add:R(0.02)},","ig_4_4:[ {param:'lwDr',add:R(0.01)},",'Last Watch'),
  r('Last Watch 4% dealt',"if(v.lw&&P.lwDmg) m*=1+P.lwDmg;","",'Last Watch'),
  r('Never Again once',"if(al&&!v.lw){ v.st.lw++;","if(al){ v.st.lw++;",'Last Watch'),
  r('Mace in Reach adds Iron',"if(v.lw&&P.mir){ m*=1+P.mir; T.fn.ironAdd(A,T,u,1); }","if(v.lw&&P.mir){ m*=1+P.mir; }",'Last Watch'),
  r('Still at the Gate',"if(P.still&&v.lw) give(u,P.still*(u.maxHp||0)*dt);","",'Last Watch'),
  r('King Alone',"if(P.alone&&x===u&&v.lw) hg+=P.alone;","",'Last Watch'),
  r('The Watch Holds',"(v.lw?(P.twh||0):0)","0",'Last Watch'),
  r('The Late Watch rank 1',"const th=P.lwSwing>=2?0:0.25;","const th=P.lwSwing>=2?0.5:0.25;",'real kit'),
  // ---- Met on the Road ----
  r('the farthest ally',"farthest(A,T,u){ let b=null,bd=-1; for(const x of T.fn.mates(A,T,u)){ const d=T.fn.gap(A,u,x); if(d>bd){","farthest(A,T,u){ let b=null,bd=1e9; for(const x of T.fn.mates(A,T,u)){ const d=T.fn.gap(A,u,x); if(d<bd){",'real kit'),
  r('Met stays below 70%',"else if(v.met.hp>0.70*v.met.maxHp){","else if(v.met.hp>0.40*v.met.maxHp){",'Met on the Road'),
  r('Lantern on the Road',"rb_10_4:[ {param:'lantern',add:R(1)} ],","rb_10_4:[ {param:'lantern',add:R(0)} ],",'Met on the Road'),
  r('Out Before the Bell',"if(x===v.met){ if(P.met) hg+=P.met;","if(x===v.met){",'Met on the Road'),
  r('the LINK\'s Knock',"if(T.P.heard&&T.r.oh_1_1&&x&&x===v.met) n=","if(false) n=",'Met on the Road'),
  r('Far Road',"if(P.farRoad&&t===v.met) cut(P.farRoad);","",'Met on the Road'),
  r('Shelter on the Road',"if(slot==='blue'&&P.sotr&&v.met&&v.met.alive&&v.met.hp<0.5*v.met.maxHp)","if(false)",'Met on the Road'),
  r('Shelter on the Road 25%',"mul*=1.25*(1+(P.roadShel||0));","mul*=1.20*(1+(P.roadShel||0));",'Met on the Road'),
  r('Hands Sent Ahead 0.5 s',"if(P.hsa&&x&&x===v.met) flat+=0.5;","if(P.hsa&&x&&x===v.met) flat+=0.4;",'Met on the Road'),
  r('Hands Sent Ahead frees',"if(slot==='green'&&P.hsa&&x&&x===v.met) A.acts(T,u,[{cleanse:1,on:'target'}],{u,tgt:x});","",'Met on the Road'),
  r('Carter\'s Coat',"if(y){ E.healUnit(y,P.carter*heal); v.st.carter++; } } }","if(y){ v.st.carter++; } } }",'Met on the Road'),
  r('Second Petition',"if(P.petition) x.energy=Math.min(100,(x.energy||0)+P.petition);","",'Met on the Road'),
  r('She Will Find Him below 25%',"const lo=v.met.hp<0.25*v.met.maxHp;","const lo=v.met.hp<0.15*v.met.maxHp;",'Met on the Road'),
  r('She Will Find Him every 10 s',"v.swf=v.met; v.swfCd=10;","v.swf=v.met; v.swfCd=0;",'Met on the Road'),
  r('Open Road',"if(v.met&&P.openRoad) E.healUnit(v.met,P.openRoad*(v.met.maxHp||0));","",'Met on the Road'),
  // ---- Borne, Answered, the ultimate's riders ----
  r('Borne max 4',"if(v.borne<4){ v.borne++; v.st.borne++; }","{ v.borne++; v.st.borne++; }",'Borne'),
  r('Borne Inside',"rb_2_3:[ {param:'borneHeal',add:R(0.02)} ],","rb_2_3:[ {param:'borneHeal',add:R(0.03)} ],",'Borne'),
  r('Heavy Coat',"if(P.coat) cut(P.coat*v.borne);","",'Borne'),
  r('Coat Clasp',"rb_11_1:[ {param:'clasp',add:R(0.01)} ],","rb_11_1:[ {param:'clasp',add:R(0.02)} ],",'Borne'),
  r('SOON25',"SOON_CAP=0.25, REGEN=0.012,","SOON_CAP=0.30, REGEN=0.012,",'Borne'),
  r('First Seal Kept',"rb_12_4:[ {param:'fsk',add:R(0.02)} ],","rb_12_4:[ {param:'fsk',add:R(0.03)} ],",'Borne'),
  r('Answered banks only the protected',"if(immune(E,t)){ const p=T.fn.protOf(A,T,t); if(p&&c.amt>0) p.bank+=c.amt; return; }","if(immune(E,t)){ return; }",'Borne'),
  r('Fire Answers 4%',"rb_4_1:[ {param:'ans',add:R(0.04)} ],","rb_4_1:[ {param:'ans',add:R(0.05)} ],",'Borne'),
  r('Loud Answer',"*(1+(P.loud||0))*(1+(P.fireRem||0)*v.borne)","*(1+(P.fireRem||0)*v.borne)",'Borne'),
  r('Fire Remembers',"*(1+(P.loud||0))*(1+(P.fireRem||0)*v.borne)","*(1+(P.loud||0))",'Borne'),
  r('Violet Answer',"E.healUnit(y,each*(y===lo?1+(P.va||0):1));","E.healUnit(y,each);",'Borne'),
  r('Answering Fire',"if(P.afire){ y.shield=(y.shield||0)+P.afire*(y.maxHp||0);","if(P.afire){ y.shield=(y.shield||0);",'Borne'),
  r('Told the Watch',"if(P.told){ if(P.told>=2) A.acts(T,u,[{cleanse:1,on:'target'}],{u,tgt:y}); else","if(P.told){ if(false) A.acts(T,u,[{cleanse:1,on:'target'}],{u,tgt:y}); else",'Borne'),
  r('None Left Outside 1.5 s',"T.fn.protect(A,T,u,nh,1.5+(P.lastCart||0),'nlo');","T.fn.protect(A,T,u,nh,1.0+(P.lastCart||0),'nlo');",'Borne'),
  r('Last Cart In',"rb_12_3:[ {param:'lastCart',add:R(0.1)} ],","rb_12_3:[ {param:'lastCart',add:R(0)} ],",'Borne'),
  r('Watch the Gate: the weakest',"if(sk==='h61ult'){ if(P.wtg){ const w=T.fn.weakest(A,T,u); if(w) c.tgt=w; }","if(sk==='h61ult'){ if(P.wtg){ }",'Borne'),
  r('Watch the Gate 20%',"if(P.wtg&&v.wtg>0) cut(0.20);","if(P.wtg&&v.wtg>0) cut(0.10);",'Borne'),
  r('Near Gate',"if(P.nearGate&&v.wtg>0) fast+=P.nearGate;","",'Borne'),
  r('Guard the Cart +0.5 s',"if(sk==='h61imm'){ if(P.gtc) c.amt+=0.5;","if(sk==='h61imm'){ if(P.gtc) c.amt+=0.4;",'real kit'),
  r('Far Gate',"return 10000*P.far; return 0; }","return 0; return 0; }",'Borne'),
  // ---- the signatures ----
  r('The Hall Is Open 8 s',"if(P.hio){ v.hio=8;","if(P.hio){ v.hio=4;",'signatures'),
  r('The Hall Is Open: Knocks',"for(const y of T.fn.mates(A,T,u)) T.fn.knAdd(A,T,u,y,'max');","",'signatures'),
  r('The Hall Is Open: no cast',"if(slot!=='ult'&&x&&((P.atk&&v.ak[x.uid])||(P.swf&&v.swf===x)||v.hio>0)){","if(slot!=='ult'&&x&&((P.atk&&v.ak[x.uid])||(P.swf&&v.swf===x))){",'signatures'),
  r('No Gate Shut Again at full Iron',"if(P.ngs&&v.iron>=T.fn.ironMax(A,T)){","if(P.ngs){",'signatures'),
  r('No Gate Shut Again doubles',"*(v.ngs>0?2:1),","*(v.ngs>0?1.5:1),",'signatures'),
  r('No Gate Shut Again: a quarter',"const x=0.25*c.amt; c.amt-=x;","const x=0.20*c.amt; c.amt-=x;",'signatures'),
  r('No Gate Shut Again: his own Armor',"y=x*E.defMul(s,u,kd)/Math.max(1e-6,E.defMul(s,t,kd));","y=x;",'signatures'),
  r('This Time once',"if(v.tt||!x||x===u","if(!x||x===u",'signatures'),
  r('This Time: double',"const rate=p.x2?2*Math.max(P.ans||0,0.04):(P.ans||0);","const rate=(P.ans||0);",'signatures'),
  r('This Time: the lent healing power',"(P.tt&&v.lend>0?0.10*v.borne:0)","0",'signatures'),
  // ---- the caps, the clock ----
  r('DR40',"const DR_FLOOR=0.60, ALLY_FLOOR=0.80, HEAL_CAP","const DR_FLOOR=0.50, ALLY_FLOOR=0.80, HEAL_CAP",'one product'),
  r('ALLY20',"ALLY_FLOOR=0.80, HEAL_CAP=1.00,","ALLY_FLOOR=0.70, HEAL_CAP=1.00,",'one product'),
  r('HEAL100',"HEAL_CAP=1.00,","HEAL_CAP=1.20,",'one product'),
  r('CC30',"HEAL_CAP=1.00, CC_FLOOR=0.70,","HEAL_CAP=1.00, CC_FLOOR=0.60,",'one product'),
  r('Black Plate',"oh_1_4:[ {param:'bp',add:R(0.05)} ],","oh_1_4:[ {param:'bp',add:R(0.04)} ],",'one product'),
  r('Hands Like Stone stuns',"if(P.hls&&(c.field==='stunned'||c.field==='silencedT')) k*=1-P.hls;","if(P.hls&&c.field==='silencedT') k*=1-P.hls;",'one product'),
  r('the wave ends his protections',"for(const p of v.prot) if(p.kind!=='nsf'&&p.x) p.x._openGateImmuneUntil=0; v.prot=[];","",'countdowns'),
  r('Knock countdowns',"for(const k in v.k){ const r=v.k[k]; if(r.t>0){ r.t-=dt;","for(const k in v.k){ const r=v.k[k]; if(r.t>0){ r.t-=2*dt;",'countdowns'),
  r('the bell starts again',"v.bellCd=Math.max(1,BELL_PERIOD-(P.btb||0)); v.bellT=0; v.met=null;","v.bellT=0; v.met=null;",'countdowns'),
];
const SKIP=new Set(['.logs','.base','.bin','.git','.tmp','node_modules','assets','backups','.remote-logs']);
const TMP=(()=>{ const t=os.tmpdir(), r=path.relative(root,t); return (!r.startsWith('..')&&!path.isAbsolute(r))?path.dirname(root):t; })();   // the test host keeps its temp folder inside the checkout: copy beside it instead
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); const top=r.split(path.sep)[0]; return !r||!(SKIP.has(top)||top.startsWith('.remote-')||top.startsWith('.ctl-')); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))){ try{ fs.symlinkSync(path.join(root,k),path.join(dir,k),process.platform==='win32'?'junction':undefined); }
    catch(e){ fs.cpSync(path.join(root,k),path.join(dir,k),{recursive:true}); } } }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(TMP,'ew-moc-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), n=s.split(from).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(from,()=>to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-morvayne.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/(?:#|ℹ) fail (\d+)/.exec(out), pm=/(?:#|ℹ) pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||1), only=process.env.ONLY?new RegExp(process.env.ONLY):null, list=only?C.filter(c=>only.test(c[0])):C, out=[]; let i=0;
  async function worker(){ while(i<list.length){ const c=list[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
