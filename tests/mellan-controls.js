'use strict';
/* The controls for Mellan's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script). Each control copies this checkout to a
   temp folder (os.tmpdir(): the runner's own temp folder on disk), breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated
   talents-fx.js: a page hook removed, a guard made unguarded with a seeded draw, a row or a cap of his broken), runs the named tests of
   tests/talents-mech-mellan.test.js in that copy, and expects them to FAIL. ONE copy at a time (no parallel child processes); each copy is deleted when its run
   is done; .logs and node_modules are never copied (node_modules is a link). The checkout itself is never changed.
   Prints one line per control and a count; exits 1 if any control was not caught.  Run: node tests/mellan-controls.js [name filter] */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js', DRAW='brnd(); ';
const AT="      if(u._tal&&u._tal.on.at) TalentFx.at(u,'hornetswarm',C,o,apB*(o.dps||0.4));";
const NCP="if(u._tal) TalentFx.partPre(u,t,'nectar');", NCQ="        if(u._tal) TalentFx.part(u,t,'nectar'); });";
const HVP="if(u._tal) TalentFx.partPre(u,t,'hive');", HVQ="  if(u._tal) TalentFx.part(u,t,'hive');\r\n";
const HCP="if(_hcO) TalentFx.partPre(_hcO,b,'hornet');", HCQ="if(_hcO) TalentFx.part(_hcO,b,'hornet');";
const BEE="const h=(o._tal&&o._tal.on.num)?TalentFx.num(o,'bee',";
const ID='no talents';
const C=[
  // ---- the page sites: hook removed (his tests fail) ----
  ['at hook removed (the cloud\'s centre)',HTML,AT,'','Pointed: He Points'],
  ['cloud partPre removed',HTML,HCP,'','Pointed: He Points|Swarm Cloud'],
  ['cloud part removed',HTML,HCQ,'','each page site'],
  ['Nectar partPre removed',HTML,NCP,'','Royal Nectar: Clover'],
  ['Nectar part removed',HTML,NCQ,'        }); ','Comb: Wax Cells'],
  ['Hive partPre removed',HTML,HVP,'','Hornets in the Hive|Gold Rain on'],
  ['Hive part removed',HTML,HVQ,'','Hornets in the Hive'],
  ['worker num removed',HTML,BEE,"const h=(false)?TalentFx.num(o,'bee',",'his workers: Kind Rule'],
  // ---- an unguarded seeded draw at each site (the no-talent identity test fails) ----
  ['draw at the at site',HTML,AT,DRAW+AT.trim(),ID],
  ['draw at the cloud tick',HTML,HCP,DRAW+HCP,ID],
  ['draw at the Nectar landing',HTML,NCP,DRAW+NCP,ID],
  ['draw at a Hive share',HTML,HVP,DRAW+HVP,ID],
  ['draw at a worker pulse',HTML,BEE,DRAW+BEE,ID],
  // ---- the Gentle Rule ----
  ['Wax Cells 1.1%',FXJ,"x.maxHp*(0.01*Math.max(1,T.r.gr_1_2||0)","x.maxHp*(0.011*Math.max(1,T.r.gr_1_2||0)",'Comb: Wax Cells'],
  ['Comb 4 cells',FXJ,"cb.n=3+(Pp['comb.n']||0)","cb.n=4+(Pp['comb.n']||0)",'Comb: Wax Cells'],
  ['Comb: no 0.5 s limit',FXJ,"now-cb.br<0.5-1e-9","now-cb.br<0-1e-9",'Comb: Wax Cells'],
  ['Sealed Comb 7%',FXJ,"M.hq.push([x,x.maxHp*0.06,true]);","M.hq.push([x,x.maxHp*0.07,true]);",'Comb: Wax Cells'],
  ['Sealed Comb before the hit',FXJ,"if(sh){ x.shield=(x.shield||0)+a;","if(false){ x.shield=(x.shield||0)+a;",'Comb: Wax Cells'],
  ['Well Kept Hives 1.6%',FXJ,"k*=1-0.015*r.gr_6_2;","k*=1-0.016*r.gr_6_2;",'Comb: Wax Cells'],
  ['Summer Flowers 0.5%',FXJ,"{param:'summer',add:R(0.004)}","{param:'summer',add:R(0.005)}",'Summer Flowers'],
  ['Comb Builder 10%',FXJ,"c.amt>0.15*x.maxHp","c.amt>0.09*x.maxHp",'Summer Flowers'],
  ['Comb Builder every 5 s',FXJ,"cb.bd=now+6;","cb.bd=now+5;",'Summer Flowers'],
  ['Patient Keeper 4%',FXJ,"{param:'pk',add:R(0.03)}","{param:'pk',add:R(0.04)}",'Patient Keeper'],
  ['Royal Jelly 3%',FXJ,"k+=0.02*r.gr_7_1;","k+=0.03*r.gr_7_1;",'Patient Keeper'],
  ['Tell the Bees 4%',FXJ,"M.tb[s.uid+':'+x.uid]>now) k*=0.97;","M.tb[s.uid+':'+x.uid]>now) k*=0.96;",'Tell the Bees'],
  ['Tell the Bees 3 s',FXJ,"M.tb[s.uid+':'+x.uid]=now+2;                                        // Tell the Bees: that","M.tb[s.uid+':'+x.uid]=now+3;                                        // Tell the Bees: that",'Tell the Bees'],
  ['Tell the Bees Pointed every 0.5 s',FXJ,"M.tbP=now+8;","M.tbP=now+0.5;",'Tell the Bees'],
  ['Tell the Bees Pointed without He Points',FXJ,"if(r.gr_n1&&r.ls_1_1&&s&&s.alive","if(r.gr_n1&&s&&s.alive",'Tell the Bees'],
  ['Foraging 0.6%',FXJ,"x.maxHp*0.005*Math.max(1,r.gr_2_3||0)*0.5","x.maxHp*0.006*Math.max(1,r.gr_2_3||0)*0.5",'Hive store'],
  ['store max 26%',FXJ,"store:{max:{pct:P('store.max',0.25),of:'maxHp'}}","store:{max:{pct:P('store.max',0.26),of:'maxHp'}}",'Hive store'],
  ['Golden Store per 4%',FXJ,"M.ncGs=Math.floor(st/(0.05*u.maxHp)+1e-9)","M.ncGs=Math.floor(st/(0.04*u.maxHp)+1e-9)",'Hive store'],
  ['Queen\'s Gift every 2.5 s',FXJ,"if(M.qg>=3-1e-9){ M.qg-=3;","if(M.qg>=2.5-1e-9){ M.qg-=2.5;",'Hive store'],
  ['store not spent',FXJ,"M.ncSt=st; M.ncGs=Math.floor(st/(0.05*u.maxHp)+1e-9); A.stSet(T,u,'store',0);","M.ncSt=st; M.ncGs=Math.floor(st/(0.05*u.maxHp)+1e-9);",'Hive store'],
  ['Clover Honey 3%',FXJ,"gr_1_4:[ {param:'nc.more',add:R(0.02)} ]","gr_1_4:[ {param:'nc.more',add:R(0.03)} ]",'Royal Nectar: Clover'],
  ['Nectar heal over time not made his',FXJ,"if(h&&!h._talU){ h._talU=u; h._talK='nectar';","if(h&&!h._talU){ h._talK='nectar';",'Royal Nectar: Clover'],
  ['Quick Honey 0.3 s',FXJ,"gr_4_1:[ {on:'cd',skill:'blue',add:R(-0.2)} ]","gr_4_1:[ {on:'cd',skill:'blue',add:R(-0.3)} ]",'Royal Nectar: Clover'],
  ['Gold Weather 3',FXJ,"rm_1_1:[ {param:'gold',add:R(2)} ]","rm_1_1:[ {param:'gold',add:R(3)} ]",'Royal Nectar: Clover'],
  ['Thick Honey 2 s',FXJ,"gr_5_1:[ {param:'thick',add:3} ]","gr_5_1:[ {param:'thick',add:2} ]",'Thick Honey'],
  ['Slow Drip 5%',FXJ,"gr_6_1:[ {param:'drip',add:R(0.04)} ]","gr_6_1:[ {param:'drip',add:R(0.05)} ]",'Thick Honey'],
  ['Thick Nectar not halved',FXJ,"{stat:{aspd:R(0.01)},to:{team:'ally',has:'tn'},req:'gr_5_1'}","{stat:{aspd:R(0.02)},to:{team:'ally',has:'tn'},req:'gr_5_1'}",'Thick Honey'],
  ['Thick Nectar for good',FXJ,"if(Pp.tnec) A.setMark(T,u,x,'tn',{dur:hd});","if(Pp.tnec) A.setMark(T,u,x,'tn',{dur:hd+9});",'Thick Honey'],
  ['Runny Honey 45%',FXJ,"gr_5_3:[ {param:'runny',add:0.40} ]","gr_5_3:[ {param:'runny',add:0.45} ]",'Thick Honey'],
  ['Kind Rule 4%',FXJ,"gr_3_4:[ {param:'kind',add:R(0.03)} ]","gr_3_4:[ {param:'kind',add:R(0.04)} ]",'his workers: Kind Rule'],
  ['Forty Thousand above 40',FXJ,"colony(A,T)+w>50&&Pp.forty","colony(A,T)+w>40&&Pp.forty",'his workers: Kind Rule'],
  ['two workers above 95',FXJ,"if(r.rm_3_3&&n>75) w=2;","if(r.rm_3_3&&n>95) w=2;",'his workers: Kind Rule'],
  ['Spent Colony refill 25% slower',FXJ,"Pp.hatch*dt*(r.rm_6_1?0.7:1)","Pp.hatch*dt*(r.rm_6_1?0.75:1)",'his workers: Kind Rule'],
  ['Steady Colony 5%',FXJ,"gr_10_3:[ {param:'steady',add:R(0.04)} ]","gr_10_3:[ {param:'steady',add:R(0.05)} ]",'his workers: Kind Rule'],
  ['regeneration cap 1.4%',FXJ,"const REGEN=0.012;                                   // the game's regeneration cap (Phil 4 Oct): his per","const REGEN=0.014;                                   // the game's regeneration cap (Phil 4 Oct): his per",'regeneration cap|Brood: The Brood'],
  ['worker extras outside the cap',FXJ,"let got=add<0?add:regen(A,T,x,Math.min(add,room));","let got=add<0?add:Math.min(add,room);",'regeneration cap'],
  ['Guarding Workers at 50%',FXJ,"const GW=0.40;","const GW=0.50;",'Guarding Workers'],
  ['Many Workers 4%',FXJ,"hy*(1+0.03*(r.gr_9_3||0)+","hy*(1+0.04*(r.gr_9_3||0)+",'Guarding Workers'],
  ['Guarding: its own ally healed too',FXJ,"if(a>0) E.healUnit(y,a); c.amt=0; return; } }","if(a>0) E.healUnit(y,a); return; } }",'Guarding Workers'],
  ['The Brood 1.2%',FXJ,"gr_4_4:[ {param:'brood.k',add:R(0.01)} ]","gr_4_4:[ {param:'brood.k',add:R(0.012)} ]",'Brood: The Brood'],
  ['Brood max 5',FXJ,"brood:{max:P('brood.max',4)}","brood:{max:P('brood.max',5)}",'Brood: The Brood'],
  ['Raised Again 1.2%',FXJ,"k*=1-0.01*r.gr_5_4*A.stGet(T,'brood');","k*=1-0.012*r.gr_5_4*A.stGet(T,'brood');",'Brood: The Brood'],
  ['Stung Hands 7 s',FXJ,"A.setMark(T,u,k,'stH',{dur:6});","A.setMark(T,u,k,'stH',{dur:7});",'Brood: The Brood'],
  ['Busy Season 0.12 s',FXJ,"gr_9_4:[ {on:'cd',skill:'blue',add:R(-0.1),per:'brood'} ]","gr_9_4:[ {on:'cd',skill:'blue',add:R(-0.12),per:'brood'} ]",'Brood: The Brood'],
  ['Calm King 2%',FXJ,"k*=1-0.015*r.gr_11_1;","k*=1-0.02*r.gr_11_1;",'damage reduction on hits on him'],
  ['River Country on everything',FXJ,"if(r.gr_11_4&&kind==='magic')","if(r.gr_11_4)",'damage reduction on hits on him'],
  ['self cap 40%',FXJ,"ALLY_CAP=0.25, SELF_CAP=0.35;","ALLY_CAP=0.25, SELF_CAP=0.40;",'damage reduction on hits on him'],
  ['ally cap 30%',FXJ,"ALLY_CAP=0.25, SELF_CAP=0.35;","ALLY_CAP=0.30, SELF_CAP=0.35;",'hits on his allies'],
  ['no group on his DoTs',FXJ,"    {on:'dotIn',reqAny:SELFDR,do:[{fn:'myDot'}]},","",'damage reduction on hits on him'],
  ['Low Gold Weather 0.6%',FXJ,"k*=1-0.005*r.gr_8_2;","k*=1-0.006*r.gr_8_2;",'hits on his allies'],
  ['Grudge Kept on any ally',FXJ,"if(r.ls_4_1&&s&&s.target===x&&isPt(A,T,u,s))","if(r.ls_4_1&&s&&isPt(A,T,u,s))",'hits on his allies'],
  ['Swarmed at 40%',FXJ,"if(p>=0.35&&f<0.35&&r.rm_2_2","if(p>=0.40&&f<0.40&&r.rm_2_2",'hits on his allies'],
  ['Swarmed again at once',FXJ,"M.sw[x.uid]=now+12;","M.sw[x.uid]=now+0;",'hits on his allies'],
  ['Honey Hands not after',FXJ,"A.setMark(T,u,x,'swh',{dur:d+3,longest:true});","A.setMark(T,u,x,'swh',{dur:d+0,longest:true});",'hits on his allies'],
  ['Close Swarm 1.5%',FXJ,"rm_8_4:[ {param:'close',add:R(0.01)} ]","rm_8_4:[ {param:'close',add:R(0.003)} ]",'Close Swarm'],
  ['They Die for Him every time',FXJ,"if(!x||!A.markOf(u,x,'sw')||M.save===T.s.wave||colony(A,T)<30) return;","if(!x||!A.markOf(u,x,'sw')||colony(A,T)<30) return;",'Close Swarm'],
  ['They Die for Him 25',FXJ,"M.save=T.s.wave; A.stSet(T,u,'col',colony(A,T)-30); if(x.hp<1) x.hp=1;","M.save=T.s.wave; A.stSet(T,u,'col',colony(A,T)-25); if(x.hp<1) x.hp=1;",'Close Swarm'],
  // ---- the Leash ----
  ['He Points 7 s',FXJ,"ls_1_1:[ {param:'pt.dur',add:6} ]","ls_1_1:[ {param:'pt.dur',add:7} ]",'Pointed: He Points'],
  ['He Points: the farthest',FXJ,"t=A.pick(T,u,{team:'enemy',of:'pt',order:'near',n:1},c)[0]||null; M.ptPend=t;","t=A.pick(T,u,{team:'enemy',of:'pt',order:'near'},c).slice(-1)[0]||null; M.ptPend=t;",'Pointed: He Points'],
  ['Leashed Fury 4%',FXJ,"0.03*(r.ls_10_1||0)","0.04*(r.ls_10_1||0)",'Pointed: He Points'],
  ['No Mercy x1.5',FXJ,"if(r.ls_9_1&&pt&&frac(t)<0.30) k*=2;","if(r.ls_9_1&&pt&&frac(t)<0.30) k*=1.5;",'Pointed: He Points'],
  ['Hornet Season below 60%',FXJ,"if(r.ls_9_3&&frac(t)<0.50)","if(r.ls_9_3&&frac(t)<0.60)",'Pointed: He Points'],
  ['Marked Again 1.5 s',FXJ,"ls_8_1:[ {param:'again',add:R(1)} ]","ls_8_1:[ {param:'again',add:R(1.5)} ]",'Pointed: He Points'],
  ['One Target radius 0.75',FXJ,"if(Pp.one) R*=Math.SQRT1_2;","if(Pp.one) R*=0.75;",'the cloud: Wide Cloud'],
  ['Free Rein 25%',FXJ,"if(Pp.rein) R*=1.30;","if(Pp.rein) R*=1.25;",'the cloud: Wide Cloud'],
  ['Free Rein drift 1.2 m',FXJ,"st=Math.min(d,1*E.METER()*(b.tick||0.5))","st=Math.min(d,1.2*E.METER()*(b.tick||0.5))",'the cloud: Wide Cloud'],
  ['Stinger Swarm of 7',FXJ,"o.dps=(o.dps||0.4)*(1+Pp.stings/8);","o.dps=(o.dps||0.4)*(1+Pp.stings/7);",'the cloud: Wide Cloud'],
  ['Long Poison 0.3 s',FXJ,"ls_5_1:[ {param:'long',add:R(0.2)} ]","ls_5_1:[ {param:'long',add:R(0.3)} ]",'the cloud: Wide Cloud'],
  ['Sharp Sting on every sting',FXJ,"first=!!R0&&!R0.f[t.uid]; if(R0) R0.f[t.uid]=1;","first=!!R0&&!R0.f[t.uid];",'the cloud: Wide Cloud'],
  ['Bad War 3%',FXJ,"ls_6_1:[ {on:'out',if:{kind:'magic',targetTeam:'enemy'},more:R(0.02)} ]","ls_6_1:[ {on:'out',if:{kind:'magic',targetTeam:'enemy'},more:R(0.03)} ]",'the cloud: Wide Cloud'],
  ['Swarm Cloud 15 Colony',FXJ,"if(Pp.scloud&&colony(A,T)>=20){ A.stSet(T,u,'col',colony(A,T)-20);","if(Pp.scloud&&colony(A,T)>=15){ A.stSet(T,u,'col',colony(A,T)-15);",'Swarm Cloud'],
  ['Swarm Cloud 25%',FXJ,"A.acts(T,u,[{slow:0.20,dur:d,on:'target'}],c);","A.acts(T,u,[{slow:0.25,dur:d,on:'target'}],c);",'Swarm Cloud'],
  ['Thick Cloud 0.3 s',FXJ,"rm_9_2:[ {param:'thickC',add:R(0.2)} ]","rm_9_2:[ {param:'thickC',add:R(0.3)} ]",'Swarm Cloud'],
  ['Running Wild 5%',FXJ,"ls_6_3:[ {param:'wild',add:R(0.04)} ]","ls_6_3:[ {param:'wild',add:R(0.05)} ]",'Swarm Cloud'],
  ['Welts twice a second',FXJ,"lock:'weltL',lockDur:0.95}","lock:'weltL',lockDur:0.4}",'Welts: Rising Welts'],
  ['Welts last 6 s',FXJ,"welt:{unit:true,max:5,dur:P('welt.dur',5)}","welt:{unit:true,max:5,dur:P('welt.dur',6)}",'Welts: Rising Welts'],
  ['Welts max 6',FXJ,"welt:{unit:true,max:5,dur:","welt:{unit:true,max:6,dur:",'Welts: Rising Welts'],
  ['Rising Welts 0.6%',FXJ,"ls_2_2:[ {stat:{aspd:R(-0.005)}","ls_2_2:[ {stat:{aspd:R(-0.006)}",'Welts: Rising Welts'],
  ['Tight Knot 4%',FXJ,"A.ustGet(T,u,t,'welt')>=5) k+=0.03*r.ls_6_2;","A.ustGet(T,u,t,'welt')>=5) k+=0.04*r.ls_6_2;",'Welts: Rising Welts'],
  ['Hard Bargain 8%',FXJ,"chance:R(0.06),do:[{ustack:'welt',on:'target'}]","chance:R(0.08),do:[{ustack:'welt',on:'target'}]",'Hard Bargain'],
  ['Hornet Nectar 3 Welts',FXJ,"[{ustack:'welt',on:'target',add:2,dur:","[{ustack:'welt',on:'target',add:3,dur:",'Hard Bargain'],
  ['Sticky Smell 0.4 s',FXJ,"ls_9_2:[ {param:'sticky',add:R(0.3)} ]","ls_9_2:[ {param:'sticky',add:R(0.4)} ]",'Hard Bargain'],
  ['Eat Well 3%',FXJ,"0.02*(r.ls_4_4||0)*A.stGet(T,'fed')","0.03*(r.ls_4_4||0)*A.stGet(T,'fed')",'Fed: Eat Well'],
  ['Fed max 6',FXJ,"fed:{max:P('fed.max',5)}","fed:{max:P('fed.max',6)}",'Fed: Eat Well'],
  ['Bold Hornets at 2',FXJ,"if:{stackMin:{fed:3}},add:R(-0.1)}","if:{stackMin:{fed:2}},add:R(-0.1)}",'Fed: Eat Well'],
  ['Never Refused 0.6%',FXJ,"ls_7_4:[ {param:'refused',add:R(0.005)} ]","ls_7_4:[ {param:'refused',add:R(0.006)} ]",'Fed: Eat Well'],
  ['Glutton 0.4%',FXJ,"ls_12_4:[ {stat:{aspd:R(0.003)},per:'fed'} ]","ls_12_4:[ {stat:{aspd:R(0.004)},per:'fed'} ]",'Fed: Eat Well'],
  ['a kill fed twice',FXJ,"if(t){ const fs=M.fs||(M.fs={}); if(fs[t.uid]) return; fs[t.uid]=1; }","",'Off the Leash'],
  ['Never Asked every time',FXJ,"if(Math.hypot(x.x-b.cx,x.y-b.cy)<=b.R){ R0.na=true; b.life+=Pp.asked; }","if(Math.hypot(x.x-b.cx,x.y-b.cy)<=b.R){ b.life+=Pp.asked; }",'Never Asked'],
  ['Let Them Go 3 s',FXJ,"ls_3_1:[ {param:'chase',add:2} ]","ls_3_1:[ {param:'chase',add:3} ]",'Never Asked'],
  ['Loose Grip on the cloud 6%',FXJ,"+0.05*(r.ls_6_4||0)+","+0.06*(r.ls_6_4||0)+",'Never Asked'],
  // ---- Hive Mind ----
  ['Hornets in the Hive 4 Welts',FXJ,"A.ustPut(T,u,x,'welt',5); } },","A.ustPut(T,u,x,'welt',4); } },",'Hornets in the Hive'],
  ['Hive Mind Honey 3 cells',FXJ,"cb.n=Math.min(10,cb.n+2); cb.h=Math.min(cb.n,cb.h+2);","cb.n=Math.min(10,cb.n+3); cb.h=Math.min(cb.n,cb.h+3);",'Hornets in the Hive'],
  ['Hive Mind Honey: the store to each',FXJ,"for(const x of tm) E.healUnit(x,st/tm.length);","for(const x of tm) E.healUnit(x,st);",'Hornets in the Hive'],
  ['Golden Comb 0.3%',FXJ,"(hive?0.002*(T.r.gr_12_3||0):0)","(hive?0.003*(T.r.gr_12_3||0):0)",'Hornets in the Hive'],
  ['Royal Share x1.8',FXJ,"if(Pp.royal&&M.rsA===x) k*=2;","if(Pp.royal&&M.rsA===x) k*=1.8;",'shares: Every Sting'],
  ['Crown\'s Due 6%',FXJ,"rm_6_2:[ {param:'due',add:R(0.05)} ]","rm_6_2:[ {param:'due',add:R(0.06)} ]",'shares: Every Sting'],
  ['Fair Rule 4%',FXJ,"gr_12_2:[ {param:'fair',add:R(0.03)} ]","gr_12_2:[ {param:'fair',add:R(0.04)} ]",'shares: Every Sting'],
  ['Fair Shares 20%',FXJ,"rm_5_4:[ {param:'fairS',add:0.15} ]","rm_5_4:[ {param:'fairS',add:0.20} ]",'shares: Every Sting'],
  ['Count the Fallen up to 6',FXJ,"let k=1+(Pp.every||0)+(Pp.fairS||0)+(Pp.fallen||0)*Math.min(5,M.lost)","let k=1+(Pp.every||0)+(Pp.fairS||0)+(Pp.fallen||0)*Math.min(6,M.lost)",'shares: Every Sting'],
  // ---- Replaced by Morning ----
  ['Kept by Morning not carried',FXJ,"(s.wave>1&&T.r.rm_8_3)?100+Math.max(0,was-100):100","100",'the Colony: a full 100'],
  ['Patient Swarm 8%',FXJ,"rm_3_1:[ {param:'patient',add:R(0.04)} ]","rm_3_1:[ {param:'patient',add:R(0.08)} ]",'the Colony: a full 100'],
  ['Hive Song at 100',FXJ,"colony(A,T)>=A.stMax(T,u,'col')-1e-6) k+=Pp.song;","colony(A,T)>=100) k+=Pp.song;",'the Colony: a full 100'],
  ['Dawn Hatch 0.4 s',FXJ,"rm_12_2:[ {param:'dawn',add:R(0.3)} ]","rm_12_2:[ {param:'dawn',add:R(0.4)} ]",'Hive of Morning'],
  ['Whether They Know swarm 4 s',FXJ,"if(Pp.wtk) for(const x of tm) T.fn.swarm(A,T,u,x,3);","if(Pp.wtk) for(const x of tm) T.fn.swarm(A,T,u,x,4);",'Hive of Morning'],
  ['Whether They Know 12 s',FXJ,"A.acts(T,u,[{window:'wtk',dur:10}],{u});","A.acts(T,u,[{window:'wtk',dur:12}],{u});",'Whether They Know: 10 s'],
  ['Whether They Know: not the one it fought',FXJ,"(e.target===x||x.target===e)","(e.target===x)",'Whether They Know: 10 s'],
  ['Last Sting 3%',FXJ,"rm_4_1:[ {param:'barb',add:R(0.02)} ]","rm_4_1:[ {param:'barb',add:R(0.03)} ]",'Barbed: Last Sting'],
  ['Deep Barb 4%',FXJ,"rm_5_1:[ {param:'deep',add:R(0.03)} ]","rm_5_1:[ {param:'deep',add:R(0.04)} ]",'Barbed: Last Sting'],
  ['Broken Stinger 3%',FXJ,"rm_7_1:[ {param:'broken',add:R(0.02)} ]","rm_7_1:[ {param:'broken',add:R(0.03)} ]",'Barbed: Last Sting'],
  ['Barb Spread rank 1 6 s',FXJ,"Pp.spread>=2?{}:{dur:5}","Pp.spread>=2?{}:{dur:6}",'Barbed: Last Sting'],
  ['Wild Barbs 5%',FXJ,"A.markOf(u,t,'barb')) k+=0.04*r.rm_10_1;","A.markOf(u,t,'barb')) k+=0.05*r.rm_10_1;",'Barbed: Last Sting'],
  // ---- signatures and the rest ----
  ['Crown: twice, not three times',FXJ,"if(A.winOn(T,'crown')) got+=2*h;","if(A.winOn(T,'crown')) got+=1*h;",'A Crown of Small Subjects'],
  ['Crown: cells twice a second',FXJ,"if(now-cb.br<1-1e-9) return false;","if(now-cb.br<0.4-1e-9) return false;",'A Crown of Small Subjects'],
  ['Crown: no Brood guard',FXJ,"if(x){ const h=(x.maxHp*0.004+(u.apow||0)*0.08*(u.passMul||1))*0.5*A.stGet(T,'brood'); E.healUnit(x,h); }","",'A Crown of Small Subjects'],
  ['Off the Leash under 12%',FXJ,"!(t.hp<0.10*t.maxHp)","!(t.hp<0.12*t.maxHp)",'Off the Leash'],
  ['Off the Leash boss 9%',FXJ,"A.hurt(T,u,t,t.maxHp*0.08,COL,'olxB');","A.hurt(T,u,t,t.maxHp*0.09,COL,'olxB');",'Off the Leash'],
  ['Off the Leash boss every sting',FXJ,"if(boss){ if(M.olx) return; M.olx=true;","if(boss){",'Off the Leash'],
  ['Off the Leash finishes a boss',FXJ,"const M=me(T), boss=!!((t.t&&t.t.isboss)||t._raidBoss);","const M=me(T), boss=false;",'Off the Leash'],
  ['Soft Hands cap 25%',FXJ,"gr_1_1:[ {on:'ccIn',less:R(0.05),upTo:0.20} ]","gr_1_1:[ {on:'ccIn',less:R(0.05),upTo:0.25} ]",'Soft Hands'],
  ['Low Hum 4%',FXJ,"rm_1_4:[ {on:'wave',once:'fight',do:[{fn:'reach',by:R(0.03)}]} ]","rm_1_4:[ {on:'wave',once:'fight',do:[{fn:'reach',by:R(0.04)}]} ]",'Soft Hands'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||(!SKIP.has(r.split(path.sep)[0])&&!r.startsWith('.ctl-')); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-mlc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from, n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,()=>to));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-mellan.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
const only=process.argv[2]?new RegExp(process.argv[2]):null, out=[];
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
