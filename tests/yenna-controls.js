'use strict';
/* The controls for Yenna's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script). Each control copies this checkout to a
   temp folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed or given an unguarded
   seeded draw, a row or a number of hers broken), runs the named tests of tests/talents-mech-yenna.test.js in that copy, and expects them to FAIL. The checkout itself
   is never changed. Prints one line per control and a count; exits 1 if any control was not caught. J=1 by default: one copy at a time, each deleted as soon as it
   has run (the wiring brief's rule). */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const r=(id,from,to,pat)=>[id,FXJ,from,to,pat];
const C=[
  // ---- the page sites (removed: her talents stop; an unguarded draw: the no-talent identity breaks) ----
  ['the return partPre site',HTML,"if(u._tal) TalentFx.partPre(u,e,'yeBack');","if(false) TalentFx.partPre(u,e,'yeBack');",'/ Arc'],
  ['the return part site',HTML,"if(u._tal) TalentFx.part(u,e,'yeBack');","if(false) TalentFx.part(u,e,'yeBack');",'real kit'],
  ['the ring flag',HTML,"||(u._tal&&e._yeRic===u)));","));",'/ the return'],
  ['the hop part site',HTML,"if(u._tal) TalentFx.part(u,e,'yeHop');","if(false) TalentFx.part(u,e,'yeHop');",'real kit'],
  ['an unguarded draw at the return site',HTML,"if(u._tal) TalentFx.partPre(u,e,'yeBack');","brnd(); if(u._tal) TalentFx.partPre(u,e,'yeBack');",'no talents'],
  ['an unguarded draw at the hop site',HTML,"if(u._tal) TalentFx.partPre(u,e,'yeHop');","brnd(); if(u._tal) TalentFx.partPre(u,e,'yeHop');",'no talents'],
  ['an unguarded draw at the ring',HTML,"if(o.ricochet){ const _marked=","if(o.ricochet){ brnd(); const _marked=",'no talents'],
  // ---- Arc ----
  r('Whole Arc 2%',"wb_1_1:[ {on:'out',if:{casting:BACK},more:R(0.02),per:{fn:'arcN'}} ],","wb_1_1:[ {on:'out',if:{casting:BACK},more:R(0.01),per:{fn:'arcN'}} ],",'/ Arc'),
  r('Arc 3 a throw',"arcCap(A,T){ return 3+(T.P['arc.cap']||0); },","arcCap(A,T){ return 2+(T.P['arc.cap']||0); },",'/ Arc'),
  r('Arc Remembered',"wb_6_1:[ {param:'arc.keep',add:R(1)} ],","wb_6_1:[ {param:'arc.keep',add:R(0)} ],",'/ Arc'),
  r('Harder Coming Home at 4',"if(P.hch&&v.arc>=4&&","if(P.hch&&v.arc>=7&&",'/ Arc'),
  r('Heavy Arc inside the pool',"const room=Math.max(0,0.05-T.fn.critPool(A,T,u)/10000);","const room=Math.max(0,0.15-T.fn.critPool(A,T,u)/10000);",'/ Arc'),
  r('Full Swing 4%',"wb_10_1:[ {on:'out',if:{casting:BACK,fn:'arcFull'},critMore:R(0.04)} ],","wb_10_1:[ {on:'out',if:{casting:BACK,fn:'arcFull'},critMore:R(0.02)} ],",'/ Arc'),
  r('full Arc is the cap',"return has(T,ARC)&&v.arc>0&&v.arc>=T.fn.arcCap(A,T)-1e-9;","return has(T,ARC)&&v.arc>0&&v.arc>=3-1e-9;",'/ Arc'),
  // ---- the throw ----
  r('Thighbone 3%',"wb_2_3:[ {on:'out',if:{casting:RRS},more:R(0.03)} ],","wb_2_3:[ {on:'out',if:{casting:RRS},more:R(0.02)} ],",'/ the throw'),
  r('Hard Throw out only',"wb_11_3:[ {on:'out',if:{casting:RR},more:R(0.04)} ],","wb_11_3:[ {on:'out',if:{casting:RRS},more:R(0.04)} ],",'/ the throw'),
  r('Sharp Turn 2%',"wb_12_2:[ {on:'out',if:{casting:BACK},more:R(0.02)} ],","wb_12_2:[ {on:'out',if:{casting:BACK},more:R(0.01)} ],",'/ the throw'),
  r('Comes Back Harder up to 10',"return Math.min(10,V(T).thrW);","return Math.min(1,V(T).thrW);",'/ the throw'),
  r('Long Way Back 0.3 s',"{on:'kit',skill:RR,opt:{back:{add:0.3}}}","{on:'kit',skill:RR,opt:{back:{add:0.1}}}",'/ the throw'),
  r('Long Way Back 25%',"more:P('lwb',0.25)","more:P('lwb',0.20)",'/ the throw'),
  r('Waiting Hands',"wb_6_2:[ {param:'lwb',add:R(0.05)} ],","wb_6_2:[ {param:'lwb',add:R(0.03)} ],",'/ the throw'),
  r('Short Way Back at once',"opt:{back:{set:1e-6}}","opt:{back:{set:0.3}}",'/ the throw'),
  r('Short Way Back 1 s off the mark',"if(P.swb) u.blueCd=Math.max(0,(u.blueCd||0)-1);","if(P.swb) u.blueCd=Math.max(0,(u.blueCd||0)-0);",'/ the throw'),
  r('Snapback 4%',"wb_6_3:[ {param:'snap',add:1}, {stat:{aspd:R(0.04)},if:{window:'yeSnap'}} ],","wb_6_3:[ {param:'snap',add:1}, {stat:{aspd:R(0.02)},if:{window:'yeSnap'}} ],",'/ the throw'),
  r('Snapback 3 s',"A.acts(T,u,[{window:'yeSnap',dur:3}],{u});","A.acts(T,u,[{window:'yeSnap',dur:6}],{u});",'/ the throw'),
  r('Bone Through Hide',"wb_5_1:[ {on:'out',if:{casting:RRS},ignoreArmor:R(0.02)} ],","wb_5_1:[ {on:'out',if:{casting:RRS},ignoreArmor:R(0)} ],",'/ the throw'),
  r('Two Bones every third',"if(P.two&&v.thr%3===0)","if(P.two&&v.thr%2===0)",'/ the throw'),
  r('Two Bones 50%',"T.fn.skillHit(A,T,u,x,v.outDmg*0.5,RR); } },","T.fn.skillHit(A,T,u,x,v.outDmg*0.4,RR); } },",'/ the throw'),
  r('Chalk Flats Hide 2%',"wb_3_2:[ {param:'chalk',add:R(0.02)} ],","wb_3_2:[ {param:'chalk',add:R(0.01)} ],",'/ the throw'),
  r('Chalk Flats Hide in the air only',"if(P.chalk&&v.air) cut(P.chalk);","if(P.chalk) cut(P.chalk);",'/ the throw'),
  r('the landing',"if(v.air&&!u._boomFoes&&!v.q.some(q=>q.f==='pass')){","if(false){",'/ the throw'),
  // ---- Notches ----
  r('Notches 5 at most',"yeNotch:{max:5},","yeNotch:{max:6},",'/ Notches'),
  r('a Rending Return kill carves',"if(has(T,NOTCH)) T.fn.notch1(A,T,u);","if(false) T.fn.notch1(A,T,u);",'/ Notches'),
  r('Carved Notch 1.5%',"wb_1_4:[ {on:'out',if:{casting:RRS},more:R(0.015),per:'yeNotch'} ],","wb_1_4:[ {on:'out',if:{casting:RRS},more:R(0.01),per:'yeNotch'} ],",'/ Notches'),
  r('Deep Notch',"wb_2_4:[ {stat:{aspd:R(0.004)},per:'yeNotch'} ],","wb_2_4:[ {stat:{aspd:R(0.002)},per:'yeNotch'} ],",'/ Notches'),
  r('Bone Charm',"wb_6_4:[ {stat:{hp:R(0.005)},per:'yeNotch'} ],","wb_6_4:[ {stat:{hp:R(0.003)},per:'yeNotch'} ],",'/ Notches'),
  r('Old Bone',"wb_10_4:[ {stat:{lifesteal:R(0.003)},per:'yeNotch'} ],","wb_10_4:[ {stat:{lifesteal:R(0.002)},per:'yeNotch'} ],",'/ Notches'),
  r('Fifth Notch',"wb_7_4:[ {param:'cd.fifth',add:R(0.2)} ],","wb_7_4:[ {param:'cd.fifth',add:R(0.1)} ],",'/ Notches'),
  r('Quick Catch',"wb_3_3:[ {param:'cd.rr',add:R(0.15)} ],","wb_3_3:[ {param:'cd.rr',add:R(0.1)} ],",'/ Notches'),
  r('Singing Bone',"wb_12_4:[ {on:'out',if:{stackMin:{yeNotch:5}},critMore:R(0.03)} ],","wb_12_4:[ {on:'out',if:{stackMin:{yeNotch:5}},critMore:R(0.02)} ],",'/ Notches'),
  r('Notch by Notch',"wb_4_4:[ {on:'kill',if:{fn:'nonRR'},chance:R(0.15),","wb_4_4:[ {on:'kill',if:{fn:'nonRR'},chance:R(0),",'/ Notches'),
  r('Sure Catch',"wb_8_3:[ {param:'sc',add:R(0.5)} ],","wb_8_3:[ {param:'sc',add:R(0.2)} ],",'/ Notches'),
  r('Twice Back once every 12 s',"if(P.twice&&v.tbT<=0&&c.tgt){ v.tbT=12;","if(P.twice&&v.tbT<=0&&c.tgt){ v.tbT=0;",'/ Notches'),
  // ---- the return's riders ----
  r('All in a Row 4%',"wb_n1:[ {on:'out',if:{auto:true,fn:'lined'},more:R(0.04)} ],","wb_n1:[ {on:'out',if:{auto:true,fn:'lined'},more:R(0.02)} ],",'/ the return'),
  r('Lined Up 4 s',"for(const f of foes) if(f.alive) rec(T,f).lined=4;","for(const f of foes) if(f.alive) rec(T,f).lined=40;",'/ the return'),
  r('Catch and Throw once',"{on:'out',if:{auto:true,window:'yeCT'},more:R(0.04),do:[{window:'yeCT',end:true}]}","{on:'out',if:{auto:true,window:'yeCT'},more:R(0.04)}",'/ the return'),
  r('Return Cut 2%',"{on:'out',if:{fn:'cut'},more:R(0.02)} ],","{on:'out',if:{fn:'cut'},more:R(0.01)} ],",'/ the return'),
  r('Return Cut 3 s',"if(P.rcut) r.cut=3;","if(P.rcut) r.cut=30;",'/ the return'),
  r('Bone Tally 1%',"wb_11_4:[ {param:'tally',add:R(0.01)} ],","wb_11_4:[ {param:'tally',add:R(0.005)} ],",'/ the return'),
  r('Bone Tally 2 s',"if(P.tally) r.tally=2;","if(P.tally) r.tally=0;",'/ the return'),
  r('Taken by the Throat 40%',"af_7_3:[ {on:'out',if:{casting:BACK,fn:'gripped'},more:0.40} ],","af_7_3:[ {on:'out',if:{casting:BACK,fn:'gripped'},more:0.30} ],",'/ the return'),
  r('Taken by the Throat: held only',"return !!t&&((t.fearT||0)>0||(t.stunned||0)>0||(t.slow||0)>0);","return !!t;",'/ the return'),
  r('Drifted 3%',"af_3_3:[ {on:'out',if:{casting:RRS,fn:'alone'},more:R(0.03)} ],","af_3_3:[ {on:'out',if:{casting:RRS,fn:'alone'},more:R(0.02)} ],",'/ the return'),
  r('isolated: 3.5 m',"E.dist(o,t)<3.5*E.METER()){ alone=false; break; }","E.dist(o,t)<0.5*E.METER()){ alone=false; break; }",'/ the return'),
  r('Nervous Laughter 8%',"{on:'out',if:{casting:RRS,fn:'nerv'},more:0.08} ],","{on:'out',if:{casting:RRS,fn:'nerv'},more:0.05} ],",'/ the return'),
  r('Nervous Laughter: that throw',"return !!(r&&r.nervOn===V(T).throwId); },","return !!(r&&r.nervOn>=0); },",'/ the return'),
  r('Nervous Laughter\'s Nerve',"if(T.r.af_1_1&&!r.calledW){ T.fn.addNerve(A,T,u,1); }","if(false){ T.fn.addNerve(A,T,u,1); }",'/ the return'),
  r('Stampede Bone 4 s',"if(cur===RR||cur===BACK) r.sb=4;","if(cur===RR||cur===BACK) r.sb=0;",'/ the return'),
  r('Ricochet Count',"wb_10_2:[ {on:'kit',skill:ULT,opt:{mul:{more:R(0.03)}}} ],","wb_10_2:[ {on:'kit',skill:ULT,opt:{mul:{more:R(0.02)}}} ],",'/ the return'),
  r('Big Laugh',"pl_12_2:[ {on:'kit',skill:ULT,opt:{mul:{more:R(0.03)}}} ],","pl_12_2:[ {on:'kit',skill:ULT,opt:{mul:{more:R(0.02)}}} ],",'/ the return'),
  r('Open Jaws',"af_10_3:[ {on:'kit',skill:ULT,opt:{mul:{more:R(0.03)}}} ],","af_10_3:[ {on:'kit',skill:ULT,opt:{mul:{more:R(0.02)}}} ],",'/ the return'),
  // ---- her marks ----
  r('Pointing Paw',"pl_1_1:[ {param:'pp',add:R(0.01)} ],","pl_1_1:[ {param:'pp',add:R(0.005)} ],",'/ Laughing Mark'),
  r('Long Laugh',"pl_2_1:[ {on:'kit',skill:LM,opt:{dur:{add:R(0.5)}}} ],","pl_2_1:[ {on:'kit',skill:LM,opt:{dur:{add:R(0.3)}}} ],",'/ Laughing Mark'),
  r('Pick the Limping',"pl_4_1:[ {param:'cd.lm',add:R(0.2)} ],","pl_4_1:[ {param:'cd.lm',add:R(0.1)} ],",'/ Laughing Mark'),
  r('Hold It Down 25%',"pl_5_2:[ {param:'hold',add:0.25} ],","pl_5_2:[ {param:'hold',add:0.20} ],",'/ Laughing Mark'),
  r('Pinned 4 points',"pl_6_2:[ {param:'hold',add:R(0.04)} ],","pl_6_2:[ {param:'hold',add:R(0.02)} ],",'/ Laughing Mark'),
  r('Chase It Down',"if(P.rid){ const n=T.fn.lowest(A,T,u,x);","if(false){ const n=T.fn.lowest(A,T,u,x);",'/ Laughing Mark'),
  r('Down the Line',"pl_6_3:[ {param:'dtl',add:1}, {stat:{aspd:R(0.04)},if:{window:'yeDtl'}} ],","pl_6_3:[ {param:'dtl',add:1}, {stat:{aspd:R(0.02)},if:{window:'yeDtl'}} ],",'/ Laughing Mark'),
  r('Echo Laugh',"pl_5_1:[ {param:'echo',add:R(0.4)} ],","pl_5_1:[ {param:'echo',add:R(0.2)} ],",'/ Laughing Mark'),
  r('Hunt Song',"pl_11_3:[ {stat:{atk:R(0.01)},per:'yeHS'} ],","pl_11_3:[ {stat:{atk:R(0.005)},per:'yeHS'} ],",'/ Laughing Mark'),
  r('Lowest First',"pl_8_1:[ {on:'out',if:{fn:'marked'},more:R(0.02)} ],","pl_8_1:[ {on:'out',if:{fn:'marked'},more:R(0.01)} ],",'/ Laughing Mark'),
  r('Clean Finish',"pl_8_3:[ {on:'out',if:{fn:'marked'},critMore:R(0.02)} ],","pl_8_3:[ {on:'out',if:{fn:'marked'},critMore:R(0.01)} ],",'/ Laughing Mark'),
  r('Thin Herd 1%',"pl_11_1:[ {on:'out',if:{fn:'marked'},more:R(0.01),per:{fn:'thinN'}} ],","pl_11_1:[ {on:'out',if:{fn:'marked'},more:R(0.005),per:{fn:'thinN'}} ],",'/ Laughing Mark'),
  r('Thin Herd: allies, not her',"if(x.u!==u&&x.t>0) n++;","if(x.t>0) n++;",'/ Laughing Mark'),
  r('Second Scent',"pl_10_1:[ {param:'scent',add:R(0.01)} ],","pl_10_1:[ {param:'scent',add:R(0.005)} ],",'/ Laughing Mark'),
  r('Lean Year',"pl_9_1:[ {param:'ly',add:R(0.01)} ],","pl_9_1:[ {param:'ly',add:R(0.005)} ],",'/ Laughing Mark'),
  r('Lean Year: her allies',"if(P.ly&&s!==u&&t.hp<0.35*t.maxHp)","if(P.ly&&t.hp<0.35*t.maxHp)",'/ Laughing Mark'),
  r('Litter Mates',"pl_n2:[ {param:'litter',add:R(0.02)} ],","pl_n2:[ {param:'litter',add:R(0.01)} ],",'/ Laughing Mark'),
  r('Laughing Stampede half strength',"mul=half?1+(full-1)/2:full;","mul=full;",'/ Laughing Mark'),
  r('Laughing Stampede marks',"if(t&&t.alive) T.fn.putMark(A,T,u,t,3,true); },","if(t&&t.alive) T.fn.putMark(A,T,u,t,0,true); },",'/ Laughing Mark'),
  // ---- Breath ----
  r('Clean Bite',"pl_1_2:[ {stat:{aspd:R(0.01)},to:{team:'ally'},per:{fn:'brOf'}} ],","pl_1_2:[ {stat:{aspd:R(0.005)},to:{team:'ally'},per:{fn:'brOf'}} ],",'/ Breath'),
  r('Clan Breath',"pl_2_2:[ {stat:{lifesteal:R(0.003)},to:{team:'ally'},per:{fn:'brOf'}} ],","pl_2_2:[ {stat:{lifesteal:R(0.002)},to:{team:'ally'},per:{fn:'brOf'}} ],",'/ Breath'),
  r('Full Chest',"pl_7_2:[ {stat:{atk:R(0.004)},to:{team:'ally'},per:{fn:'brOf'}} ],","pl_7_2:[ {stat:{atk:R(0.002)},to:{team:'ally'},per:{fn:'brOf'}} ],",'/ Breath'),
  r('Pack Pace',"pl_4_2:[ {stat:{move:R(0.04)},to:{team:'ally'},per:{fn:'br3'}} ],","pl_4_2:[ {stat:{move:R(0.02)},to:{team:'ally'},per:{fn:'br3'}} ],",'/ Breath'),
  r('Pack Pace at 3',"return T.fn.brOf(A,T,u,c)>=3?1:0;","return T.fn.brOf(A,T,u,c)>=4?1:0;",'/ Breath'),
  r('Full Lungs 5%',"pl_9_2:[ {stat:{crit:0.05},","pl_9_2:[ {stat:{crit:0.10},",'/ Breath'),
  r('Every Clean Bite',"pl_6_1:[ {param:'ecb',add:R(2)} ],","pl_6_1:[ {param:'ecb',add:R(1)} ],",'/ Breath'),
  r('Breath 6 s',"BR_MAX=5, BR_DUR=6,","BR_MAX=5, BR_DUR=12,",'/ Breath'),
  r('Breath 5 at most',"BR_MAX=5, BR_DUR=6,","BR_MAX=6, BR_DUR=6,",'/ Breath'),
  r('Breath: crits only',"if(c.crit&&!s._summon){ T.fn.addBreath(A,T,u,s,1);","if(!s._summon){ T.fn.addBreath(A,T,u,s,1);",'/ Breath'),
  r('Breath for the Next: 6 s longer',"if(b&&b.n>0) b.t+=6;","if(b&&b.n>0) b.t+=0;",'/ Breath'),
  r('Pack Memory',"pl_12_1:[ {param:'pmem',add:R(1)} ],","pl_12_1:[ {param:'pmem',add:R(0)} ],",'/ Breath'),
  r('Passed Breath',"pl_10_2:[ {on:'yeBr5',chance:R(0.20),","pl_10_2:[ {on:'yeBr5',chance:R(0),",'/ Breath'),
  r('Rally Howl within 6 m',"for(const a of A.pick(T,u,{team:'ally',within:6},{u}))","for(const a of A.pick(T,u,{team:'ally',within:60},{u}))",'/ Breath'),
  // ---- Calls ----
  r('4 Calls',"CALLS=4;","CALLS=3;",'/ Call'),
  r('Called 4 s',"r.called=4+(P['called.dur']||0);","r.called=3+(P['called.dur']||0);",'/ Call'),
  r('Loud Call',"pl_3_4:[ {param:'called.dur',add:R(0.4)} ],","pl_3_4:[ {param:'called.dur',add:R(0.2)} ],",'/ Call'),
  r('Call the Clan 2%',"pl_1_4:[ {param:'cc',add:R(0.02)} ],","pl_1_4:[ {param:'cc',add:R(0.01)} ],",'/ Call'),
  r('Call the Clan: basics',"if(P.cc&&c.auto&&r.called>0)","if(P.cc&&r.called>0)",'/ Call'),
  r('Clan Signal',"pl_7_4:[ {on:'out',if:{auto:true,fn:'calledT'},more:R(0.03)} ],","pl_7_4:[ {on:'out',if:{auto:true,fn:'calledT'},more:R(0.02)} ],",'/ Call'),
  r('Pack Feast',"pl_5_4:[ {param:'pf',add:R(0.02)} ],","pl_5_4:[ {param:'pf',add:R(0.01)} ],",'/ Call'),
  r('Pack Feast on her',"const r=recOf(T,s); if(r){ if(P.pf&&r.called>0) cut(P.pf);","const r=recOf(T,s); if(r){ if(P.pf&&r.called>99) cut(P.pf);",'/ Call'),
  r('Loud Clan',"pl_12_4:[ {param:'lc',add:R(0.05)} ],","pl_12_4:[ {param:'lc',add:R(0.03)} ],",'/ Call'),
  r('Answering Call',"pl_6_4:[ {param:'ac',add:R(0.02)} ],","pl_6_4:[ {param:'ac',add:R(0.01)} ],",'/ Call'),
  r('Fed Clan',"pl_12_3:[ {param:'fed',add:R(0.03)} ],","pl_12_3:[ {param:'fed',add:R(0.02)} ],",'/ Call'),
  r('Close the Circle',"pl_10_4:[ {on:'yeCtc',chance:R(0.10),","pl_10_4:[ {on:'yeCtc',chance:R(0),",'/ Call'),
  r('Two Calls',"if(P.twoCalls&&t.alive) T.fn.addCall(A,T,u,t,1);","if(false) T.fn.addCall(A,T,u,t,1);",'/ Call'),
  // ---- Nerves ----
  r('a hit: 1 Nerve',"T.fn.addNerve(A,T,u,(P.cold&&u.hp<0.5*u.maxHp)?2:1);","T.fn.addNerve(A,T,u,(P.cold&&u.hp<0.5*u.maxHp)?2:2);",'/ Nerves'),
  r('Cold Pups',"T.fn.addNerve(A,T,u,(P.cold&&u.hp<0.5*u.maxHp)?2:1);","T.fn.addNerve(A,T,u,(P.cold&&u.hp<0.5*u.maxHp)?1:1);",'/ Nerves'),
  r('an enemy within 3 m',"const near=A.gap(u,x)<3*M,","const near=A.gap(u,x)<0.5*M,",'/ Nerves'),
  r('Nerves fade after 3 s',"fade:{after:P('nerve.after',3),","fade:{after:P('nerve.after',2),",'/ Nerves'),
  r('Jittery',"af_2_1:[ {param:'nerve.after',add:R(0.5)} ],","af_2_1:[ {param:'nerve.after',add:R(0.3)} ],",'/ Nerves'),
  r('Raw Nerves 0.5%',"af_1_1:[ {stat:{aspd:R(0.005)},per:'yeNerve'} ],","af_1_1:[ {stat:{aspd:R(0.004)},per:'yeNerve'} ],",'/ Nerves'),
  r('Feverish',"af_7_1:[ {stat:{lifesteal:R(0.002)},per:'yeNerve'} ],","af_7_1:[ {stat:{lifesteal:R(0.001)},per:'yeNerve'} ],",'/ Nerves'),
  r('Back to the Wall',"af_6_1:[ {stat:{aspd:R(0.02)},per:{fn:'near3'}} ],","af_6_1:[ {stat:{aspd:R(0.01)},per:{fn:'near3'}} ],",'/ Nerves'),
  r('Fraying at 5',"af_5_1:[ {on:'out',if:{auto:true,stackMin:{yeNerve:5}},more:R(0.03)} ],","af_5_1:[ {on:'out',if:{auto:true,stackMin:{yeNerve:6}},more:R(0.03)} ],",'/ Nerves'),
  r('Brave Face',"af_12_1:[ {param:'brave',add:R(3)} ],","af_12_1:[ {param:'brave',add:R(2)} ],",'/ Nerves'),
  r('Nerve Ends 0.2%',"+20*rk(T,'af_8_1')*stN(T,'yeNerve')","+10*rk(T,'af_8_1')*stN(T,'yeNerve')",'/ Nerves'),
  r('Taut Nerves',"af_4_1:[ {param:'wt',add:R(0.002)} ],","af_4_1:[ {param:'wt',add:R(0.001)} ],",'/ Nerves'),
  // ---- the Cackle ----
  r('the cackle at 10',"stN(T,'yeNerve')>=Math.max(5,NERVE_MAX-(P.shake||0))-1e-9","stN(T,'yeNerve')>=Math.max(5,NERVE_MAX+1-(P.shake||0))-1e-9",'/ the Cackle'),
  r('the fear 0.3 s a rank',"af_2_2:[ {param:'ck',add:R(0.3)} ],","af_2_2:[ {param:'ck',add:R(0.2)} ],",'/ the Cackle'),
  r('Long Fright',"af_7_4:[ {on:'ccOut',if:{cc:['fearT']},add:R(0.1)} ],","af_7_4:[ {on:'ccOut',if:{cc:['fearT']},add:R(0.05)} ],",'/ the Cackle'),
  r('the cackle within 3 m',"for(const x of A.pick(T,u,{team:'enemy',within:3},{u})) if(T.fn.fear(A,T,u,x,secs)) out.push(x);","for(const x of A.pick(T,u,{team:'enemy',within:30},{u})) if(T.fn.fear(A,T,u,x,secs)) out.push(x);",'/ the Cackle'),
  r('every Nerve spent',"A.stSet(T,u,'yeNerve',T.r.af_9_2?Math.min(5,stN(T,'yeNerve')):0);","A.stSet(T,u,'yeNerve',T.r.af_9_2?Math.min(5,stN(T,'yeNerve')):3);",'/ the Cackle'),
  r('Echoing Cackle keeps 5',"A.stSet(T,u,'yeNerve',T.r.af_9_2?Math.min(5,stN(T,'yeNerve')):0);","A.stSet(T,u,'yeNerve',T.r.af_9_2?Math.min(4,stN(T,'yeNerve')):0);",'/ the Cackle'),
  r('the cackle lock 4 s',"CK_LOCK=4,","CK_LOCK=1,",'/ the Cackle'),
  r('Shaking Laugh',"af_7_2:[ {param:'shake',add:R(1)} ],","af_7_2:[ {param:'shake',add:R(0.5)} ],",'/ the Cackle'),
  r('Shrill 20%',"af_3_2:[ {param:'shrill',add:R(0.20)} ],","af_3_2:[ {param:'shrill',add:R(0.15)} ],",'/ the Cackle'),
  r('Laugh It Off 8%',"af_5_2:[ {param:'lio',add:0.08} ],","af_5_2:[ {param:'lio',add:0.06} ],",'/ the Cackle'),
  r('Breathe Out',"af_6_2:[ {param:'lio',add:R(0.02)} ],","af_6_2:[ {param:'lio',add:R(0.01)} ],",'/ the Cackle'),
  r('Shrill Ringing 4%',"af_8_4:[ {param:'re',add:R(0.04)} ],","af_8_4:[ {param:'re',add:R(0.03)} ],",'/ the Cackle'),
  r('Shrill Ringing on the feared',"if(P.re) r.ring=3; }","if(P.re) r.ring=0; }",'/ the Cackle'),
  r('Scattered Pack',"af_10_4:[ {on:'out',if:{fn:'feared'},more:R(0.02)} ],","af_10_4:[ {on:'out',if:{fn:'feared'},more:R(0.01)} ],",'/ the Cackle'),
  r('Fear Feeds',"af_9_3:[ {stat:{atk:R(0.01)},per:'yeFF'} ],","af_9_3:[ {stat:{atk:R(0.005)},per:'yeFF'} ],",'/ the Cackle'),
  r('Keep Laughing',"af_12_2:[ {stat:{aspd:R(0.01)},per:'yeKL'} ],","af_12_2:[ {stat:{aspd:R(0.005)},per:'yeKL'} ],",'/ the Cackle'),
  r('Breathing Room 2%',"af_11_4:[ {param:'brr',add:R(0.02)} ],","af_11_4:[ {param:'brr',add:R(0.01)} ],",'/ the Cackle'),
  r('Breathing Room 3 s',"if(T.r.af_11_4) A.acts(T,u,[{window:'yeBrR',dur:3}],{u});","if(T.r.af_11_4) A.acts(T,u,[{window:'yeBrR',dur:9}],{u});",'/ the Cackle'),
  r('Rattled 5%',"af_12_4:[ {param:'rat',add:R(0.05)} ],","af_12_4:[ {param:'rat',add:R(0.03)} ],",'/ the Cackle'),
  r('Rattled 2 s',"if(P.rat) A.acts(T,u,[{slow:P.rat,dur:2,on:'target'}],{u,tgt:t}); } }","if(P.rat) A.acts(T,u,[{slow:P.rat,dur:1,on:'target'}],{u,tgt:t}); } }",'/ the Cackle'),
  r('Hunted Hunter',"af_11_3:[ {param:'hh',add:R(0.01)} ],","af_11_3:[ {param:'hh',add:R(0.005)} ],",'/ the Cackle'),
  r('Laugh at Them 3 s',"if(P.lat&&x.alive){ T.fn.putMark(A,T,u,x,3,false); r.lat=3; }","if(P.lat&&x.alive){ T.fn.putMark(A,T,u,x,0,false); r.lat=3; }",'/ the Cackle'),
  r('Point Them Out',"af_6_3:[ {param:'ptw',add:R(0.03)} ],","af_6_3:[ {param:'ptw',add:R(0.02)} ],",'/ the Cackle'),
  // ---- Pack Opportunist and her guard ----
  r('Opportunist\'s Eye',"wb_8_2:[ {param:'po.eye',add:R(0.01)} ],","wb_8_2:[ {param:'po.eye',add:R(0.005)} ],",'/ Pack Opportunist'),
  r('Something Has Hold',"af_1_3:[ {param:'po.hold',add:R(0.02)} ],","af_1_3:[ {param:'po.hold',add:R(0.01)} ],",'/ Pack Opportunist'),
  r('Limping One',"af_4_3:[ {param:'po.limp',add:R(0.03)} ],","af_4_3:[ {param:'po.limp',add:R(0.01)} ],",'/ Pack Opportunist'),
  r('Sharpened Edge',"wb_5_4:[ {on:'out',if:{fn:'poOn'},critMore:R(0.02)} ],","wb_5_4:[ {on:'out',if:{fn:'poOn'},critMore:R(0.01)} ],",'/ Pack Opportunist'),
  r('Seize It',"af_8_3:[ {on:'out',if:{fn:'held'},critMore:R(0.02)} ],","af_8_3:[ {on:'out',if:{fn:'held'},critMore:R(0.01)} ],",'/ Pack Opportunist'),
  r('Wary 2%',"af_9_4:[ {param:'wary',add:R(0.02)} ],","af_9_4:[ {param:'wary',add:R(0.01)} ],",'/ Pack Opportunist'),
  r('Wary within 3 m',"if(P.wary&&A.gap(u,s)<3*E.METER()) cut(P.wary);","if(P.wary&&A.gap(u,s)<30*E.METER()) cut(P.wary);",'/ Pack Opportunist'),
  r('Last Ditch',"af_5_4:[ {param:'ld',add:R(0.02)} ],","af_5_4:[ {param:'ld',add:R(0.01)} ],",'/ Pack Opportunist'),
  r('Slippery Hide',"af_4_4:[ {on:'ccIn',less:R(0.04)} ],","af_4_4:[ {on:'ccIn',less:R(0.02)} ],",'/ Pack Opportunist'),
  r('Hackles',"af_6_4:[ {param:'hack',add:R(0.10)} ],","af_6_4:[ {param:'hack',add:R(0.05)} ],",'/ Pack Opportunist'),
  r('Quick Paws',"af_10_1:[ {param:'cd.rr',add:R(0.2)} ],","af_10_1:[ {param:'cd.rr',add:R(0.1)} ],",'/ Pack Opportunist'),
  // ---- the signatures ----
  r('Whatever You Throw 25%',"v.q.push({t:0.45,f:'pass',k:1.25,","v.q.push({t:0.45,f:'pass',k:1.2,",'/ the signatures'),
  r('Whatever You Throw once every 20 s',"v.wyT=20; v.stats.sig1++;","v.wyT=0; v.stats.sig1++;",'/ the signatures'),
  r('Where the Clan Goes 6 energy',"const en=(P.ecb||0)+(r.sigE>0?6:0);","const en=(P.ecb||0)+(r.sigE>0?4:0);",'/ the signatures'),
  r('Where the Clan Goes 6 s',"rn.sigE=6;","rn.sigE=60;",'/ the signatures'),
  r('Where the Clan Goes once every 20 s',"if(P.wcg&&v.wcT<=0){ v.wcT=20;","if(P.wcg&&v.wcT<=0){ v.wcT=0;",'/ the signatures'),
  r('Afraid at Somebody Else 5 m',"for(const x of A.pick(T,u,{team:'enemy',within:5},{u})){ T.fn.fear(A,T,u,x,1.5);","for(const x of A.pick(T,u,{team:'enemy',within:50},{u})){ T.fn.fear(A,T,u,x,1.5);",'/ the signatures'),
  r('Afraid at Somebody Else 1.5 s',"{ T.fn.fear(A,T,u,x,1.5); if(x.alive)","{ T.fn.fear(A,T,u,x,1.0); if(x.alive)",'/ the signatures'),
  r('the bleed 20%',"amt:{pct:0.20,of:'atk'}","amt:{pct:0.10,of:'atk'}",'/ the signatures'),
  r('the Nerves hold',"nerveHold(A,T){ return V(T).s3>0; },","nerveHold(A,T){ return false; },",'/ the signatures'),
  r('the window 6 s',"v.afT=25; v.s3=6;","v.afT=25; v.s3=60;",'/ the signatures'),
  r('once every 25 s',"v.afT=25; v.s3=6;","v.afT=0; v.s3=6;",'/ the signatures'),
  r('the return double',"{on:'out',if:{casting:BACK,fn:'s3Feared'},mul:2}","{on:'out',if:{casting:BACK,fn:'s3Feared'},mul:1.5}",'/ the signatures'),
  r('below 40%',"u.hp<0.40*u.maxHp&&u.hp+(c.hpLost||0)>=0.40*u.maxHp","u.hp<0.35*u.maxHp&&u.hp+(c.hpLost||0)>=0.35*u.maxHp",'/ the signatures'),
  // ---- caps, clocks ----
  r('the 40% group floor',"const DR_FLOOR=0.60, ALLY_FLOOR=0.80,","const DR_FLOOR=0.50, ALLY_FLOOR=0.80,",'one product'),
  r('the 20% ally floor',"cut(P.re); } return Math.max(ALLY_FLOOR,k); }","cut(P.re); } return Math.max(0.70,k); }",'one product'),
  r('the 5% crit pool',"CRIT_POOL=500,","CRIT_POOL=600,",'one product'),
  r('countdowns',"for(const f of ['tbT','wyT','wcT','afT','s3','ckT']) if(v[f]>0) v[f]=Math.max(0,v[f]-dt);","for(const f of ['tbT','wyT','wcT','afT','s3','ckT']) if(v[f]>0) v[f]=Math.max(0,v[f]-dt*2);",'countdowns'),
  r('the records drop at a wave',"v.e={}; v.q=[]; v.air=0;","v.q=[]; v.air=0;",'countdowns'),
];
const SKIP=new Set(['.logs','.base','.bin','.git','.tmp','node_modules','assets','backups','.remote-logs']);
const TMP=(()=>{ const t=os.tmpdir(), r=path.relative(root,t); return (!r.startsWith('..')&&!path.isAbsolute(r))?path.dirname(root):t; })();   // the test host keeps its temp folder inside the checkout: copy beside it instead
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); const top=r.split(path.sep)[0]; return !r||!(SKIP.has(top)||top.startsWith('.remote-')||top.startsWith('.ctl-')); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))){ try{ fs.symlinkSync(path.join(root,k),path.join(dir,k),process.platform==='win32'?'junction':undefined); }
    catch(e){ fs.cpSync(path.join(root,k),path.join(dir,k),{recursive:true}); } } }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(TMP,'ew-yec-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), n=s.split(from).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(from,()=>to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-yenna.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/(?:#|ℹ) fail (\d+)/.exec(out), pm=/(?:#|ℹ) pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||1), only=process.env.ONLY?new RegExp(process.env.ONLY):null, list=only?C.filter(c=>only.test(c[0])):C, out=[]; let i=0;
  async function worker(){ while(i<list.length){ const c=list[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
