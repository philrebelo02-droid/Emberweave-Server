'use strict';
/* The controls for Umbris's talent tests (run on the cluster through tools/remote_test.sh as a plain node script, TOGETHER with
   tests/talents-mech-umbris.test.js: the runner sends the pre-talent page only for SHAs named in the files of the run). Each control copies this checkout
   to a folder under os.tmpdir() (which follows TMPDIR: on the cluster a folder beside the slot, wiped after the run), breaks ONE thing there (an exact text
   swap in emberweave-heroes.html, talents-mech/_engine.js's copy or the generated talents-fx.js: a page line his talents added, an unguarded seeded draw at
   one of those lines, or a row, a cap or a function of his), runs the named tests of tests/talents-mech-umbris.test.js in that copy, and expects them to
   FAIL. One copy at a time; each is deleted as soon as it has run; .logs, node_modules and the art are not copied (node_modules and assets are linked). The
   checkout itself is never changed. Prints one line per control and a count; exits 1 if any was not caught.  node tests/umbris-controls.js [--list] */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
  // ---- the page lines his talents added (each removed: his tests fail), and an unguarded seeded draw at each (the no-talent identity test fails) ----
  ['at line in Shadeburst removed',HTML,"if(u._tal&&u._tal.on.at) TalentFx.at(u,type,_c,o,0);","",'page site|Grey Air'],
  ['landPre at the orb removed',HTML,"if(u._tal&&u.key==='umbris') TalentFx.landPre(u,vc,'umbralcata');","",'page site|Second Candle'],
  ['land at the orb removed',HTML,"if(u._tal&&u.key==='umbris') TalentFx.land(u,vc,'umbralcata');","",'page site|Second Candle|Lamp Turned'],
  ['partPre at the zone tick removed',HTML,"if(_zO) TalentFx.partPre(_zO,e,'umZone');","",'page site|the zone:'],
  ['part at the zone tick removed',HTML,"if(_zO) TalentFx.part(_zO,e,'umZone');","",'page site|the zone:'],
  ['shade line removed',HTML,"u.target=TalentFx.shade(u.target._talShd,u,u.target)||u.target;","",'page site|Shroud of Shade'],
  ['his bound zones removed',HTML,"umZones:()=>voidZones, ","",'page site|Nothing Between|Swallowed|Lingering Dark talents'],
  ['the shade hook does nothing',FXJ,"run(T,o,'shade',ctx); return ctx.tgt||t; }","return t; }",'Shroud of Shade|page site'],
  ['unguarded draw: Shadeburst at line',HTML,"if(u._tal&&u._tal.on.at) TalentFx.at(u,type,_c,o,0);","brnd(); if(u._tal&&u._tal.on.at) TalentFx.at(u,type,_c,o,0);",'no talents'],
  ['unguarded draw: the orb landing',HTML,"if(u._tal&&u.key==='umbris') TalentFx.landPre(u,vc,'umbralcata');","brnd(); if(u._tal&&u.key==='umbris') TalentFx.landPre(u,vc,'umbralcata');",'no talents'],
  ['unguarded draw: the zone tick',HTML,"if(_zO) TalentFx.partPre(_zO,e,'umZone');","brnd(); if(_zO) TalentFx.partPre(_zO,e,'umZone');",'no talents'],
  ['unguarded draw: the shade line',HTML,"  if(u.target&&u.target._talShd&&u.target._talShd._tal&&","  brnd(); if(u.target&&u.target._talShd&&u.target._talShd._tal&&",'no talents'],
  // ---- The Spreading Dark ----
  ['Thinning 0.3% -> 0.4%',FXJ,"sd_1_1:[ {param:'th.dmg',add:R(0.003)} ]","sd_1_1:[ {param:'th.dmg',add:R(0.004)} ]",'Thinning:'],
  ['Thinning max 11',FXJ,"const DR_ME=0.35, DR_AL=0.15, SLOW_CAP=0.40, REGEN=0.012, TH_MAX=10,","const DR_ME=0.35, DR_AL=0.15, SLOW_CAP=0.40, REGEN=0.012, TH_MAX=11,",'Thinning:|Nothing Left'],
  ['Thinning kept after the rot',FXJ,"else if(r.th>0){ if(r.keep>0) r.keep-=dt; else r.th=0; }","else if(r.th>0){ if(r.keep>0) r.keep-=dt; }",'Thinning:'],
  ['Thinning not on his DoT ticks',FXJ,"      if(P['th.dmg']){ const n=thOf(T,t); if(n) k*=1+P['th.dmg']*n; }\n      if(P.ink&&T.fn.mostHp","      if(P.ink&&T.fn.mostHp",'Thinning:'],
  ['Eaten Through 1 s -> 2 s',FXJ,"sd_2_1:[ {param:'th.keep',add:R(1)} ]","sd_2_1:[ {param:'th.keep',add:R(2)} ]",'Thinning:'],
  ['Marrow Rot 10% -> 20%',FXJ,"sd_8_1:[ {param:'th.rate',add:R(0.1)} ]","sd_8_1:[ {param:'th.rate',add:R(0.2)} ]",'Thinning:'],
  ['Nothing Left heals',FXJ,"if(P.nl&&Math.floor(r.th+1e-9)>=TH_MAX){ c.amt=0;","if(false){ c.amt=0;",'Nothing Left'],
  ['Nothing Left shields',FXJ,"if(P.nl&&Math.floor(r.th+1e-9)>=TH_MAX) k=0; else {","if(false) k=0; else {",'Nothing Left'],
  ['Hollow Bones 0.2% -> 0.3%',FXJ,"sd_4_1:[ {param:'hb',add:R(0.002)} ]","sd_4_1:[ {param:'hb',add:R(0.003)} ]",'Nothing Left'],
  ['Ash Grey at 4',FXJ,"if(P.ash&&Math.floor(r.th+1e-9)>=5) sl(P.ash);","if(P.ash&&Math.floor(r.th+1e-9)>=4) sl(P.ash);",'Nothing Left|the caps'],
  ['Past Mending 6% -> 7%',FXJ,"sd_n2:[ {param:'pm',add:R(0.06)} ]","sd_n2:[ {param:'pm',add:R(0.07)} ]",'Nothing Left'],
  ['Past Mending above 50%',FXJ,"if(P.pm&&r.rot&&x.hp<0.5*x.maxHp) c.amt*=1-P.pm;","if(P.pm&&r.rot) c.amt*=1-P.pm;",'Nothing Left'],
  ['Withheld Warmth 2% -> 3%',FXJ,"wl_2_2:[ {param:'ww',add:R(0.02)} ]","wl_2_2:[ {param:'ww',add:R(0.03)} ]",'Nothing Left'],
  ['Borrowed Light 2% -> 3%',FXJ,"sd_1_3:[ {param:'bl',add:R(0.02)} ]","sd_1_3:[ {param:'bl',add:R(0.03)} ]",'Borrowed Light'],
  ['Borrowed Light on rotting ones too',FXJ,"if(P.bl&&!rotting(T,u,t)) k*=1+P.bl;","if(P.bl) k*=1+P.bl;",'Borrowed Light'],
  ['Tended Rot 4% -> 5%',FXJ,"sd_n1:[ {on:'out',if:{auto:true,fn:'tgtRot'},more:R(0.04)} ]","sd_n1:[ {on:'out',if:{auto:true,fn:'tgtRot'},more:R(0.05)} ]",'Borrowed Light'],
  ['Deep Thinning 2% -> 3%',FXJ,"sd_11_1:[ {param:'dt',add:R(0.02)} ]","sd_11_1:[ {param:'dt',add:R(0.03)} ]",'Borrowed Light'],
  ['Withering Energy 1 -> 2',FXJ,"sd_10_3:[ {param:'we',add:R(1)} ]","sd_10_3:[ {param:'we',add:R(2)} ]",'Borrowed Light'],
  ['Hollow Burst within 4 m',FXJ,"if(y===x||gapM(E,x,y)>=3) continue; const q=recMk(T,y); q.th=Math.min(TH_MAX,q.th+5); }","if(y===x||gapM(E,x,y)>=40) continue; const q=recMk(T,y); q.th=Math.min(TH_MAX,q.th+5); }",'Borrowed Light'],
  ['Hungry Dark 0.4 -> 0.3',FXJ,"sd_5_4:[ {param:'reach',add:R(0.4)} ]","sd_5_4:[ {param:'reach',add:R(0.3)} ]",'Lingering Dark talents|the field:'],
  ['Generations 4% -> 5%',FXJ,"sd_1_4:[ {param:'gen',add:R(0.04)} ]","sd_1_4:[ {param:'gen',add:R(0.05)} ]",'Lingering Dark talents'],
  ['Generations do not age',FXJ,"T.fn.genOf(A,T,u,dead)+1)","T.fn.genOf(A,T,u,dead))",'Lingering Dark talents'],
  ['Generation cap 6',FXJ,"gmax(A,T){ return 5+(T.P.gmax||0); },","gmax(A,T){ return 6+(T.P.gmax||0); },",'Lingering Dark talents'],
  ['Old Bloodline past the second',FXJ,"if(P.ob&&g>3) m*=1+P.ob;","if(P.ob&&g>2) m*=1+P.ob;",'Lingering Dark talents'],
  ['Quiet Spread 4% -> 5%',FXJ,"sd_12_4:[ {param:'qs',add:R(0.04)} ]","sd_12_4:[ {param:'qs',add:R(0.05)} ]",'Lingering Dark talents'],
  ['Fast Breeding 0.3 -> 0.4',FXJ,"sd_3_4:[ {param:'fb',add:R(0.3)} ]","sd_3_4:[ {param:'fb',add:R(0.4)} ]",'Lingering Dark talents'],
  ['Strong Line 1 -> 2',FXJ,"sd_8_4:[ {param:'sl',add:R(1)} ]","sd_8_4:[ {param:'sl',add:R(2)} ]",'Lingering Dark talents'],
  ['Endless Line 3 -> 4',FXJ,"sd_9_4:[ {param:'gmax',add:3} ]","sd_9_4:[ {param:'gmax',add:4} ]",'Lingering Dark talents'],
  ['Swallowed 0.5 -> 0.2',FXJ,"sd_12_2:[ {param:'swal',add:R(0.5)} ]","sd_12_2:[ {param:'swal',add:R(0.2)} ]",'Lingering Dark talents'],
  // ---- Creeping Rot, Shadeburst, the zone ----
  ['Twin Rot off',FXJ,"if(twin){ cp(twin,1,'umTwin');","if(false){ cp(twin,1,'umTwin');",'Creeping Rot:'],
  ['Spreading Foot full damage',FXJ,"cp(x,0.5,'umFoot');","cp(x,1,'umFoot');",'Creeping Rot:'],
  ['Spreading Foot 1 m -> 2 m',FXJ,"sd_4_2:[ {param:'foot',add:R(1)} ]","sd_4_2:[ {param:'foot',add:R(2)} ]",'Creeping Rot:'],
  ['Patient Rot 2 Thinning -> 3',FXJ,"{param:'pr',add:2} ]","{param:'pr',add:3} ]",'Creeping Rot:'],
  ['Mark Lingers 0.4 -> 0.5',FXJ,"sd_9_2:[ {on:'kit',skill:CR,opt:{dur:{add:R(0.4)}}} ]","sd_9_2:[ {on:'kit',skill:CR,opt:{dur:{add:R(0.5)}}} ]",'Creeping Rot:'],
  ['Rot Worked In 3% -> 4%',FXJ,"sd_2_2:[ {on:'kit',skill:CR,opt:{dps:{more:R(0.03)}}} ]","sd_2_2:[ {on:'kit',skill:CR,opt:{dps:{more:R(0.04)}}} ]",'Creeping Rot:'],
  ['Hushed 0.3 -> 0.4',FXJ,"wl_4_3:[ {param:'hush',add:R(0.3)} ]","wl_4_3:[ {param:'hush',add:R(0.4)} ]",'Creeping Rot:'],
  ['Eyepiece 6% -> 7%',FXJ,"oc_3_3:[ {on:'out',if:{casting:CR},more:R(0.06)} ]","oc_3_3:[ {on:'out',if:{casting:CR},more:R(0.07)} ]",'Creeping Rot:'],
  ['Measured Rot at 60%',FXJ,"if(P.meas&&s.cur===CR&&t.hp<0.5*t.maxHp) k*=1+P.meas;","if(P.meas&&s.cur===CR&&t.hp<0.6*t.maxHp) k*=1+P.meas;",'Creeping Rot:'],
  ['Patient Eyepiece 1% -> 2%',FXJ,"oc_4_3:[ {param:'lw',add:R(0.01)} ]","oc_4_3:[ {param:'lw',add:R(0.02)} ]",'Patient Eyepiece'],
  ['Fixed Gaze off',FXJ,"if(b){ c.o._arrived=true; c.o._tgtU=b; } },","},",'Patient Eyepiece'],
  ['Wandering Eye off',FXJ,"if(P.wand){ const D=x.dots||[];","if(false){ const D=x.dots||[];",'Patient Eyepiece'],
  ['Last Reading at 30%',FXJ,"t.hp>=0.2*t.maxHp) return;","t.hp>=0.3*t.maxHp) return;",'Patient Eyepiece'],
  ['Last Reading every time',FXJ,"if(A.markOf(u,t,'umLR')) return; A.setMark","A.setMark",'Patient Eyepiece'],
  ['Short Candle 0.3 -> 0.4',FXJ,"sd_2_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ]","sd_2_3:[ {on:'cd',skill:'blue',add:R(-0.4)} ]",'Patient Eyepiece'],
  ['Patient Star 1% -> 2%',FXJ,"sd_9_3:[ {on:'cd',less:R(0.01)} ]","sd_9_3:[ {on:'cd',less:R(0.02)} ]",'Patient Eyepiece'],
  ['Thick Shade 5% -> 6%',FXJ,"sd_4_3:[ {on:'kit',skill:SB,opt:{dps:{more:R(0.05)}}} ]","sd_4_3:[ {on:'kit',skill:SB,opt:{dps:{more:R(0.06)}}} ]",'Grey Air'],
  ['Grey Air 0.2 -> 0.3',FXJ,"wl_5_2:[ {on:'kit',skill:SB,opt:{radius:{addM:R(0.2)}}} ]","wl_5_2:[ {on:'kit',skill:SB,opt:{radius:{addM:R(0.3)}}} ]",'Grey Air'],
  ['Long Field 0.3 -> 0.4',FXJ,"wl_6_2:[ {on:'kit',skill:SB,opt:{dur:{add:R(0.3)}}} ]","wl_6_2:[ {on:'kit',skill:SB,opt:{dur:{add:R(0.4)}}} ]",'Grey Air'],
  ['Focused Burst full width',FXJ,"c.o.radius=(c.o.radius||7*A.eng().METER())*0.5;","",'Grey Air'],
  ['Focused Burst not twice as strong',FXJ,"c.o.dps=(c.o.dps||0.3)*2;","",'Grey Air'],
  ['Focused Burst on the cluster',FXJ,"c.o._aim={x:t.x,y:t.y};","",'Grey Air'],
  ['Seeping Field 33% -> 10%',FXJ,"if:{fn:'tgtInField'},chance:R(0.33),","if:{fn:'tgtInField'},chance:R(0.10),",'the field:'],
  ['No Warmth 2% -> 3%',FXJ,"wl_9_2:[ {param:'nw',add:R(0.02)} ]","wl_9_2:[ {param:'nw',add:R(0.03)} ]",'the field:'],
  ['Field of Rot off',FXJ,"if(P.for){ const f=fieldAt(T,x);","if(false){ const f=fieldAt(T,x);",'the field:'],
  ['Vast Hole 3% -> 4%',FXJ,"sd_7_3:[ {on:'kit',skill:UC,opt:{mul:{more:R(0.03)},dps:{more:R(0.03)}}} ]","sd_7_3:[ {on:'kit',skill:UC,opt:{mul:{more:R(0.04)},dps:{more:R(0.03)}}} ]",'the zone:'],
  ['Wide Gap 0.2 -> 0.3',FXJ,"sd_8_3:[ {on:'kit',skill:UC,opt:{radius:{addM:R(0.2)}}} ]","sd_8_3:[ {on:'kit',skill:UC,opt:{radius:{addM:R(0.3)}}} ]",'the zone:'],
  ['Seeping Hole 1 -> 0',FXJ,"sd_11_2:[ {param:'seep',add:R(1)} ]","sd_11_2:[ {param:'seep',add:R(0)} ]",'the zone:'],
  ['Gnawing Dark off',FXJ,"um.rb-=h; A.eng().healUnit(u,h);","um.rb-=h;",'the zone:|the caps'],
  ['the regeneration budget 1.2% -> 2%',FXJ,"SLOW_CAP=0.40, REGEN=0.012,","SLOW_CAP=0.40, REGEN=0.02,",'the caps'],
  ['the signature does not widen',FXJ,"if(z._umN<6){ z._umN++; z.r+=E.METER(); z.life+=1;","if(z._umN<6){ z._umN++;",'Nothing Between'],
  ['the signature widens past 6',FXJ,"if(z._umN<6){ z._umN++; z.r+=E.METER();","if(z._umN<99){ z._umN++; z.r+=E.METER();",'Nothing Between'],
  ['the signature no full Thinning',FXJ,"if(z&&P.nbs) r.th=TH_MAX; }","}",'Nothing Between'],
  ['the signature spreads only as the passive',FXJ,"if(z&&P.nbs){ const L=foes(E,u).filter(y=>y!==x&&Math.hypot(y.x-z.x,y.y-z.y)<=z.r); T.fn.mspread(A,T,u,x,L,x._plagueDps||z.pd||0); return; }","",'Nothing Between'],
  // ---- Withheld Light ----
  ['Dimming 2% -> 3%',FXJ,"wl_1_4:[ {param:'miss',add:R(0.02)} ]","wl_1_4:[ {param:'miss',add:R(0.03)} ]",'Dimmed: misses'],
  ['Faint Glow 1 -> 2 points',FXJ,"wl_12_2:[ {param:'miss',add:R(0.01)} ]","wl_12_2:[ {param:'miss',add:R(0.02)} ]",'Dimmed: misses'],
  ['misses on skills too',FXJ,"{on:'in',reqAny:MISS,if:{auto:true,fn:'srcDim'}","{on:'in',reqAny:MISS,if:{fn:'srcDim'}",'Dimmed: misses'],
  ['no misses on allies',FXJ,"{on:'teamIn',reqAny:MISS,if:{auto:true,fn:'allyDim'},","{on:'teamIn',reqAny:MISS,if:{auto:true,fn:'allyDim',crit:true},",'Dimmed: misses'],
  ['Lamps Out off',FXJ,"if(m>1) c.amt/=m;","",'Dimmed: misses'],
  ['Shortened Sight 4% -> 5%',FXJ,"wl_8_4:[ {param:'bs',add:R(0.04)} ]","wl_8_4:[ {param:'bs',add:R(0.05)} ]",'Dimmed: misses'],
  ['the reach never given back',FXJ,"else if(r.rg!=null){ if(x.range===r.rs) x.range=r.rg; r.rg=null; } }","}",'Dimmed: misses'],
  ['Turned Down 10% -> 20%',FXJ,"wl_4_2:[ {param:'td',add:R(0.1)} ]","wl_4_2:[ {param:'td',add:R(0.2)} ]",'Dimmed: misses'],
  ['No Cover Left 4% -> 5%',FXJ,"wl_n3:[ {param:'ncl',add:R(0.04)} ]","wl_n3:[ {param:'ncl',add:R(0.05)} ]",'Dimmed: misses'],
  ['Night Eyes 1% -> 2%',FXJ,"wl_6_4:[ {param:'dr.ne',add:R(0.01)} ]","wl_6_4:[ {param:'dr.ne',add:R(0.02)} ]",'Dimmed: misses|the caps'],
  ['Darker Still 1 s -> 2 s',FXJ,"wl_2_4:[ {param:'ds',add:R(1)} ]","wl_2_4:[ {param:'ds',add:R(2)} ]",'Dimmed: misses'],
  ['Dimmed Hand not half',FXJ,"if(P.lt&&!c.auto&&r.lw>0) c.amt*=0.5;","",'Dimmed Hand'],
  ['Dimmed Hand every 10 s',FXJ,"LT_CD=15, LT_WIN=2;","LT_CD=1, LT_WIN=2;",'Dimmed Hand'],
  ['Dimmed Hand 4 s',FXJ,"LT_CD=15, LT_WIN=2;","LT_CD=15, LT_WIN=4;",'Dimmed Hand'],
  ['Withdrawn 1.5% -> 2%',FXJ,"wl_11_4:[ {param:'dr.wd',add:R(0.015)} ]","wl_11_4:[ {param:'dr.wd',add:R(0.02)} ]",'Dimmed Hand|the caps'],
  ['Unlit no Dimmed',FXJ,"if(r.cr&&!cr&&P.unlit){ r.dimL=Math.max(r.dimL,3);","if(r.cr&&!cr&&P.unlit){",'Dimmed Hand'],
  ['Unlit no cooldown',FXJ,"if(x.greenAb) x.greenCd=(x.greenCd||0)+1.5;","",'Dimmed Hand'],
  ['Withholding off',FXJ,"if(P.wh&&cr&&(x.energy||0)>r.en) x.energy=r.en;","",'Dimmed Hand'],
  ['No Stars Overhead 2% -> 3%',FXJ,"wl_8_3:[ {param:'sless',add:R(0.02)} ]","wl_8_3:[ {param:'sless',add:R(0.03)} ]",'Dimmed Hand'],
  ['The Dim Hour 2% -> 3%',FXJ,"wl_12_3:[ {param:'dr.dh',add:R(0.02)} ]","wl_12_3:[ {param:'dr.dh',add:R(0.03)} ]",'Dimmed Hand|the caps'],
  ['Correction 2% -> 3%',FXJ,"wl_1_1:[ {param:'cor',add:R(0.02)} ]","wl_1_1:[ {param:'cor',add:R(0.03)} ]",'Correction:'],
  ['Correction on the second brightest',FXJ,"const b=T.fn.bright(A,T,u,[]); if(!b){ um.tally={}; return; }","const b=T.fn.bright(A,T,u,[T.fn.bright(A,T,u,[])]); if(!b){ um.tally={}; return; }",'Correction:'],
  ['Correction on an enemy that did nothing',FXJ,"const v=m[x.uid]||0; if(v>bv){ bv=v; b=x; } } return b; },","const v=m[x.uid]||0; if(v>=bv){ bv=v; b=x; } } return b; },",'Correction:'],
  ['Second Correction 25% -> 30%',FXJ,"wl_6_1:[ {param:'cor2',add:R(0.25)} ]","wl_6_1:[ {param:'cor2',add:R(0.30)} ]",'Correction:'],
  ['Scrutiny 3% -> 4%',FXJ,"wl_10_1:[ {param:'scr',add:R(0.03)} ]","wl_10_1:[ {param:'scr',add:R(0.04)} ]",'Correction:'],
  ['Strict Reader 1 -> 2',FXJ,"wl_2_1:[ {param:'cor.dur',add:R(1)} ]","wl_2_1:[ {param:'cor.dur',add:R(2)} ]",'Correction:'],
  ['Every Light Checked 5 s -> 6 s',FXJ,"C.cd+=(P.elc?5:8);","C.cd+=(P.elc?6:8);",'Correction:'],
  ['Every Light Checked does not move',FXJ,"if(P.elc){ const b=T.fn.bright(A,T,u,[x]);","if(false){ const b=T.fn.bright(A,T,u,[x]);",'Correction:'],
  ['Brightness Taxed 2% -> 3%',FXJ,"wl_4_1:[ {param:'bt',add:R(0.02)} ]","wl_4_1:[ {param:'bt',add:R(0.03)} ]",'Correction:'],
  ['Correcting Hand 2% -> 3%',FXJ,"wl_7_1:[ {param:'ch',add:R(0.02)} ]","wl_7_1:[ {param:'ch',add:R(0.03)} ]",'Correction:'],
  ['Marked Down 4 s -> 3 s',FXJ,"wl_n1:[ {param:'md',add:4},","wl_n1:[ {param:'md',add:3},",'Correction:'],
  ['Bright Ones Fall 5 -> 6',FXJ,"wl_8_1:[ {param:'bof',add:R(5)} ]","wl_8_1:[ {param:'bof',add:R(6)} ]",'Correction:'],
  ['Shroud of Shade keeps the pick',FXJ,"if(b){ c.tgt=b; T.s.um.shadeN++; } },","},",'Shroud of Shade'],
  ['Shroud of Shade for enemies inside too',FXJ,"if(!by||!t||fieldAt(T,by)) return;","if(!by||!t) return;",'Shroud of Shade'],
  ['the Lamp single strength',FXJ,"return Math.min(0.9,base*((C.tri&&um.lamp>0)?3:1));","return Math.min(0.9,base);",'Lamp Turned'],
  ['the Lamp no strip',FXJ,"for(const k of BUFFT) if((b[k]||0)>0) b[k]=0; um.stripN","um.stripN",'Lamp Turned'],
  ['the Lamp Dims nobody',FXJ,"||um.lamp>0; else r.dim=false;","; else r.dim=false;",'Lamp Turned'],
  ['the Lamp 7 s',FXJ,"if(P.lamp){ um.lamp=6;","if(P.lamp){ um.lamp=7;",'Lamp Turned'],
  // ---- One Candle ----
  ['Candle 20 s -> 21 s',FXJ,"um.cdl=Math.max(0,20+(P.wick||0));","um.cdl=Math.max(0,21+(P.wick||0));",'Candle and Stare'],
  ['Stare 0.3% -> 0.4%',FXJ,"oc_1_2:[ {stat:{apow:R(0.003)},per:'umStare'} ]","oc_1_2:[ {stat:{apow:R(0.004)},per:'umStare'} ]",'Candle and Stare'],
  ['Stare max 16',FXJ,"umStare:{max:P('stare.max',15)}","umStare:{max:P('stare.max',16)}",'Candle and Stare'],
  ['a stun does not halve',FXJ,"A.stSet(T,u,'umStare',Math.floor(n/2));","",'Candle and Stare'],
  ['Short Wick 2 -> 1',FXJ,"oc_2_2:[ {param:'wick',add:R(-2)} ]","oc_2_2:[ {param:'wick',add:R(-1)} ]",'Candle and Stare'],
  ['Burned Down 3 -> 4',FXJ,"oc_6_2:[ {param:'burn',add:R(3)} ]","oc_6_2:[ {param:'burn',add:R(4)} ]",'Candle and Stare'],
  ['Small Hours at 14',FXJ,"st15(A,T){ return stN(T)>=15-1e-9; },","st15(A,T){ return stN(T)>=14-1e-9; },",'Candle and Stare'],
  ['Wick Smoke within 8 m',FXJ,"if(P.smoke) for(const x of foes(E,u)) if(gapM(E,u,x)<6) recMk(T,x).cs=2;","if(P.smoke) for(const x of foes(E,u)) if(gapM(E,u,x)<30) recMk(T,x).cs=2;",'Candle and Stare'],
  ['Reader\'s Calm every 4 Stare',FXJ,"if(P['dr.rc']) cut(P['dr.rc']*Math.floor(stN(T)/5+1e-9));","if(P['dr.rc']) cut(P['dr.rc']*Math.floor(stN(T)/4+1e-9));",'Candle and Stare'],
  ['Lidless off',FXJ,"&&!P.unbl&&!(um.full>0)){","&&!(um.full>0)){",'Candle and Stare'],
  ['a second candle every wave',FXJ,"if(um.stOn){ if(!(P.sc2&&um.wave>1)){","if(um.stOn){ if(true){",'Second Candle'],
  ['Deep Stare 0.1% -> 0.2%',FXJ,"oc_5_2:[ {param:'mr.st',add:R(0.001)} ]","oc_5_2:[ {param:'mr.st',add:R(0.002)} ]",'Deep Stare'],
  ['Burned Eyes below full Stare',FXJ,"if(P['mr.be']&&st>=A.stMax(T,u,'umStare')-1e-9) x+=P['mr.be'];","if(P['mr.be']) x+=P['mr.be']*2;",'Deep Stare'],
  ['Gap Reading 3% -> 4%',FXJ,"wl_1_3:[ {param:'mr.gap',add:R(0.03)} ]","wl_1_3:[ {param:'mr.gap',add:R(0.04)} ]",'Deep Stare'],
  ['MR ignored by basic attacks',FXJ,"if(P.meas&&s.cur===CR&&t.hp<0.5*t.maxHp) k*=1+P.meas; if(c.kind==='magic') k*=T.fn.mrK(A,T,u,c); }","if(P.meas&&s.cur===CR&&t.hp<0.5*t.maxHp) k*=1+P.meas; } if(c.kind==='magic') k*=T.fn.mrK(A,T,u,c);",'Deep Stare'],
  ['Two Stars 6% -> 7%',FXJ,"oc_1_4:[ {param:'echo',add:R(0.06)} ]","oc_1_4:[ {param:'echo',add:R(0.07)} ]",'Two Stars:'],
  ['Distant Light 0.4 -> 0.5',FXJ,"oc_3_4:[ {param:'stars.dur',add:R(0.4)} ]","oc_3_4:[ {param:'stars.dur',add:R(0.5)} ]",'Two Stars:'],
  ['Drifting Apart every 1 m',FXJ,"Math.floor(Math.max(0,gapM(E,p.a,p.b))/2+1e-9)","Math.floor(Math.max(0,gapM(E,p.a,p.b))/1+1e-9)",'Two Stars:'],
  ['Bound Orbits 2% -> 3%',FXJ,"oc_4_4:[ {param:'orb',add:R(0.02)} ]","oc_4_4:[ {param:'orb',add:R(0.03)} ]",'Two Stars:'],
  ['Star Map 3% -> 4%',FXJ,"oc_6_4:[ {param:'smap',add:R(0.03)} ]","oc_6_4:[ {param:'smap',add:R(0.04)} ]",'Two Stars:'],
  ['Pulled Apart 15% -> 16%',FXJ,"oc_9_4:[ {param:'pa',add:R(0.15)} ]","oc_9_4:[ {param:'pa',add:R(0.16)} ]",'Two Stars:'],
  ['Night Ink 2% -> 3%',FXJ,"oc_1_1:[ {param:'ink',add:R(0.02)} ]","oc_1_1:[ {param:'ink',add:R(0.03)} ]",'Two Stars:'],
  ['Paired Again never',FXJ,"if(b) um.pr.push({a:t,b,t:6+(T.P['stars.dur']||0),cr:false});","",'Two Stars:'],
  ['the armed cast 3 times',FXJ,"{on:'out',if:{casting:UC,fn:'armedHit'},mul:4}","{on:'out',if:{casting:UC,fn:'armedHit'},mul:3}",'Second Candle'],
  ['the armed cast strikes everyone',FXJ,"vc.cx=b.x; vc.cy=b.y; vc.R=0.5;","vc.cx=b.x; vc.cy=b.y;",'Second Candle'],
  ['the armed cast never armed',FXJ,"if(P.sc2&&!um.armed&&stN(T)>=mx-1e-9){ um.armed=true;","if(false){ um.armed=true;",'Second Candle'],
  ['the armed cast Stare not kept full',FXJ,"um.full=6; A.stSet(T,u,'umStare',A.stMax(T,u,'umStare')); }","}",'Second Candle'],
  // ---- the caps ----
  ['his group 35% -> 40%',FXJ,"const DR_ME=0.35, DR_AL=0.15,","const DR_ME=0.40, DR_AL=0.15,",'the caps|most defensive'],
  ['his allies\' group 15% -> 20%',FXJ,"const DR_ME=0.35, DR_AL=0.15,","const DR_ME=0.35, DR_AL=0.20,",'the caps'],
  ['his group adds its shares',FXJ,"let k=1; const cut=x=>{ if(x>0) k*=1-Math.min(1,x); };\n      if(src){ const r=recOf(T,src);","let k=1; const cut=x=>{ if(x>0) k-=Math.min(1,x); };\n      if(src){ const r=recOf(T,src);",'the caps'],
  ['Unseen Reader within 6 m',FXJ,"if(E&&P['dr.ur']&&gapM(E,u,src)>8) cut(P['dr.ur']);","if(E&&P['dr.ur']&&gapM(E,u,src)>20) cut(P['dr.ur']);",'the caps'],
  ['Pale Hood on the front row',FXJ,"E.depth(src.key)>=3) cut(P['dr.ph']); }","E.depth(src.key)>=9) cut(P['dr.ph']); }",'the caps'],
  ['slows 40% -> 50%',FXJ,"SLOW_CAP=0.40, REGEN","SLOW_CAP=0.50, REGEN",'the caps'],
  ['Unwavering 20% -> 25%',FXJ,"oc_5_1:[ {on:'ccIn',less:R(0.04),upTo:0.2} ]","oc_5_1:[ {on:'ccIn',less:R(0.05),upTo:0.25} ]",'the caps'],
];

const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTo(dir){ const ex=[...SKIP].map(k=>'--exclude=./'+k).join(' ');
  const r=cp.spawnSync('bash',['-c','tar cf - '+ex+' --exclude="./.ctl-*" --exclude="./.remote-*" . | tar xf - -C "'+dir+'"'],{cwd:root,encoding:'utf8',maxBuffer:1<<26});
  if(!fs.existsSync(path.join(dir,HTML))) throw new Error('copy failed: rc '+r.status+' '+String(r.stderr||r.error||'').slice(0,400));
  for(const k of ['node_modules','assets','.bin','.base']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function count(file,from){ const s=fs.readFileSync(path.join(root,file),'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'); return s.split(a).length-1; }
if(process.argv.includes('--list')){ let bad=0; for(const [name,file,from] of C){ const n=count(file,from); if(n!==1){ bad++; console.log('FOUND '+n+'x: '+name); } } console.log(C.length+' controls, '+bad+' not found exactly once'); process.exit(bad?1:0); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ctl-umbris-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), b=to.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,()=>b));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-umbris.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    const why=/error: [^\n]*/.exec(out); return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')+(why?' | '+why[0].slice(0,140):'')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
const only=process.argv.find(a=>a.startsWith('--only='));
const list=only?C.filter(c=>c[0].indexOf(only.slice(7))>=0):C;
if(!only){ const d=fs.mkdtempSync(path.join(os.tmpdir(),'ctl-umbris-')); try{ copyTo(d); const r=cp.spawnSync(process.execPath,['--test','tests/talents-mech-umbris.test.js'],{cwd:d,env:process.env,encoding:'utf8',maxBuffer:1<<26}); const o=(r.stdout||'')+(r.stderr||'');
  console.log('BASELINE (nothing broken, every test): '+((/# fail (\d+)/.exec(o)||[])[0])+', '+((/# pass (\d+)/.exec(o)||[])[0])); if(!/# fail 0/.test(o)){ console.log(o.slice(-3000)); process.exit(1); } } finally{ fs.rmSync(d,{recursive:true,force:true}); } }
const out=[]; for(const c of list){ const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }   // one copy at a time
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
