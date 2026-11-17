'use strict';
/* The controls for Nerisse's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script, together with
   tests/talents-mech-nerisse.test.js). Each control copies this checkout to a temp folder (os.tmpdir(): the runner's own temp folder on disk), breaks ONE thing there
   (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guarded site given an unguarded seeded draw, a row or a
   number of hers changed), runs the named tests of tests/talents-mech-nerisse.test.js in that copy, and expects them to FAIL. ONE copy at a time (no parallel child
   processes); each copy is deleted when its run is done; .logs, .remote-logs and node_modules are never copied (node_modules is linked). The checkout itself is never
   changed. Prints one line per control and a count; exits 1 if any control was not caught.  Run: node tests/nerisse-controls.js [name pattern] */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js', ID='no talents';
const OT="if(h.owner&&h.owner._tal&&h.owner._tal.on.skillTgt){ nx=TalentFx.skillTgt(h.owner,'orbHop',nx,h); if(nx){ if(h.left.indexOf(nx)<0) h.left.push(nx); nd=Math.hypot(nx.x-h.x,nx.y-h.y); } }";
const OD="if(h.owner&&h.owner._tal&&h.owner._tal.on.num) h.hopDur=TalentFx.num(h.owner,'orbDur',h.hopDur,nx);";
const PP="if(_oT) TalentFx.partPre(_oT,t,'orbHop');", PT="if(_oT) TalentFx.part(_oT,t,'orbHop');";
const AT="if(u._tal&&u._tal.on.at) TalentFx.at(u,type,C,groundHazards[groundHazards.length-1],0);";
const CS="(h.choir&&h.owner&&h.owner._tal&&h.owner._tal.on.num)?TalentFx.num(h.owner,'choirSil',ccDur(h.silence),e):ccDur(h.silence)";
const CH="(h.owner&&h.owner._tal&&h.owner._tal.on.num)?TalentFx.num(h.owner,'choirHeal',h.choir*(e.apow||0),_b,e):h.choir*(e.apow||0)";
const C=[
  // ---- the page sites: hook removed (her tests fail) ----
  ['orb next-hop hook removed',HTML,OT,'','Returning Star|Quick Orb'],
  ['orb hop-time hook removed',HTML,OD,'','Quick Orb'],
  ['orb hop partPre removed',HTML,PP,'','orb.s heals|Wake: In'],
  ['orb hop part removed',HTML,PT,'','Phosphor: Blue'],
  ['Choir at hook removed',HTML,AT,'','the Current: The'],
  ['Choir silence hook removed',HTML,CS,'ccDur(h.silence)','the Choir: Choir'],
  ['Choir heal hook removed',HTML,CH,'h.choir*(e.apow||0)','the Choir: Choir'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the orb next-hop site',HTML,OT,'brnd(); '+OT,ID],
  ['draw at the orb hop-time site',HTML,OD,'brnd(); '+OD,ID],
  ['draw at the hop partPre site',HTML,PP,'brnd(); '+PP,ID],
  ['draw at the hop part site',HTML,PT,'brnd(); '+PT,ID],
  ['draw at the Choir at site',HTML,AT,'brnd(); '+AT,ID],
  ['draw at the Choir silence site',HTML,CS,'(brnd(),'+CS.slice(1),ID],
  ['draw at the Choir heal site',HTML,CH,'(brnd(),'+CH.slice(1),ID],
  // ---- Phosphor ----
  ['Blue Glow 0.11%',FXJ,"ds_1_2:[ {param:'ph.k',add:R(0.001)} ]","ds_1_2:[ {param:'ph.k',add:R(0.0011)} ]",'Phosphor: Blue'],
  ['Long Glow 1.6 s',FXJ,"ds_2_2:[ {param:'ph.dur',add:R(1.5)} ]","ds_2_2:[ {param:'ph.dur',add:R(1.6)} ]",'Phosphor: Blue'],
  ['Phosphor up to 5',FXJ,"HEAL_RATE=0.012, PH_MAX=4;","HEAL_RATE=0.012, PH_MAX=5;",'Phosphor: Blue'],
  ['heal cap 1.3%',FXJ,"HEAL_RATE=0.012, PH_MAX=4;","HEAL_RATE=0.013, PH_MAX=4;",'Phosphor: Blue'],
  ['heals every 0.5 s',FXJ,"if(o.secA>=1-1e-9){ o.secA-=1; T.fn.sec(A,T,u); }","if(o.secA>=0.5-1e-9){ o.secA-=0.5; T.fn.sec(A,T,u); }",'Phosphor: Blue'],
  ['Trench Born every time',FXJ,"if(was===0&&put>0) T.fn.trench(A,T,u,x);","if(put>0) T.fn.trench(A,T,u,x);",'Phosphor: Blue'],
  ['Trench Born 0.7%',FXJ,"ds_3_1:[ {param:'ph.sh',add:R(0.006)} ]","ds_3_1:[ {param:'ph.sh',add:R(0.007)} ]",'Phosphor: Blue'],
  ['Floodlight 4%',FXJ,"ds_10_2:[ {param:'ph.fl',add:R(0.03)} ]","ds_10_2:[ {param:'ph.fl',add:R(0.04)} ]",'Phosphor: Blue'],
  ['Thin Shell heals 7%',FXJ,"{param:'ph.ts',add:R(0.06)}","{param:'ph.ts',add:R(0.07)}",'Bright Bloom'],
  // ---- the orb ----
  ['Soft Current 4%',FXJ,"ds_2_4:[ {param:'orb.h',add:R(0.03)} ]","ds_2_4:[ {param:'orb.h',add:R(0.04)} ]",'orb.s heals'],
  ['Deep Mending 3%',FXJ,"sb_9_1:[ {param:'orb.h',add:R(0.02)} ]","sb_9_1:[ {param:'orb.h',add:R(0.03)} ]",'orb.s heals'],
  ['Tidal Mending at 70%',FXJ,"if(P['orb.low']&&x.hp<0.5*x.maxHp) k*=1+P['orb.low'];","if(P['orb.low']&&x.hp<0.7*x.maxHp) k*=1+P['orb.low'];",'orb.s heals'],
  ['Patient Glow 0.3 s',FXJ,"ds_3_4:[ {param:'orb.hot',add:R(0.2)} ]","ds_3_4:[ {param:'orb.hot',add:R(0.3)} ]",'orb.s heals'],
  ['Patient Glow whole tick',FXJ,"H._talF=fr<1-1e-9?fr:null;","H._talF=null;",'orb.s heals'],
  ['Drifting Spark 2',FXJ,"ds_10_3:[ {param:'orb.nrg',add:R(1)} ]","ds_10_3:[ {param:'orb.nrg',add:R(2)} ]",'orb.s heals'],
  ['Returning Star to herself',FXJ,"const x=A.eng().lowestAlly(u); if(x&&x.alive){ t=x; h._talRH=1; }","const x=u; if(x&&x.alive){ t=x; h._talRH=1; }",'Returning Star'],
  ['Homeward 9%',FXJ,"ds_6_1:[ {param:'ret.h',add:R(0.08)} ]","ds_6_1:[ {param:'ret.h',add:R(0.09)} ]",'Returning Star'],
  ['Wandering Star 30% smaller',FXJ,"if(P.wand) k*=0.65;","if(P.wand) k*=0.70;",'Returning Star'],
  ['Wandering Star straight back',FXJ,"if(!a.alive||(a===prev&&h.left.some(y=>y!==prev&&y.alive))) continue;","if(!a.alive) continue;",'Returning Star'],
  ['Long Drift nothing more',FXJ,"ds_6_3:[ {param:'wand.ph',add:R(1)} ]","ds_6_3:[ {param:'wand.ph',add:R(0)} ]",'Returning Star'],
  ['Quick Orb 6%',FXJ,"ds_4_1:[ {param:'orb.spd',add:R(0.05)} ]","ds_4_1:[ {param:'orb.spd',add:R(0.06)} ]",'Quick Orb'],
  ['Warning Light 35%',FXJ,"k*=1.30+(P['wl.k']||0);","k*=1.35+(P['wl.k']||0);",'Quick Orb'],
  ['Warning Light without Heard',FXJ,"w=(e&&e.alive&&A.markOf(u,e,'nr_hd'))?e.target:null;","w=(e&&e.alive)?e.target:null;",'Quick Orb'],
  ['Forewarned Friends 3%',FXJ,"wh_9_2:[ {param:'wl.k',add:R(0.02)} ]","wh_9_2:[ {param:'wl.k',add:R(0.03)} ]",'Quick Orb'],
  ['Slow Tide 0.2 s',FXJ,"ds_6_2:[ {on:'cd',skill:'blue',add:R(-0.15)} ]","ds_6_2:[ {on:'cd',skill:'blue',add:R(-0.2)} ]",'Quick Orb'],
  // ---- Wake ----
  ['Wake 3.5 s',FXJ,"if(WK.some(id=>T.r[id])) T.fn.wake(A,T,u,x,3+(P['wk.dur']||0));","if(WK.some(id=>T.r[id])) T.fn.wake(A,T,u,x,3.5+(P['wk.dur']||0));",'Wake: In'],
  ['In Its Wake 2%',FXJ,"ds_2_3:[ {param:'wk.k',add:R(0.01)} ]","ds_2_3:[ {param:'wk.k',add:R(0.02)} ]",'Wake: In'],
  ['Long Wake 0.6 s',FXJ,"ds_4_3:[ {param:'wk.dur',add:R(0.5)} ]","ds_4_3:[ {param:'wk.dur',add:R(0.6)} ]",'Wake: In'],
  ['Gentle Hands 3%',FXJ,"ds_7_1:[ {param:'hl.wk',add:R(0.02)} ]","ds_7_1:[ {param:'hl.wk',add:R(0.03)} ]",'Wake: In'],
  ['Heavy Glow 0.6%',FXJ,"ds_12_2:[ {param:'ph.dr',add:R(0.005)} ]","ds_12_2:[ {param:'ph.dr',add:R(0.006)} ]",'Wake: In'],
  ['Abyssal Calm up to 4',FXJ,"ac:{unit:true,max:3,dur:3}","ac:{unit:true,max:4,dur:3}",'Wake: In'],
  ['Abyssal Calm 4 s',FXJ,"ac:{unit:true,max:3,dur:3}","ac:{unit:true,max:3,dur:4}",'Wake: In'],
  ['Abyssal Calm 2%',FXJ,"ds_11_4:[ {param:'ac.k',add:R(0.01)} ]","ds_11_4:[ {param:'ac.k',add:R(0.02)} ]",'Wake: In'],
  ['Abyssal Calm before its own hit',FXJ,"T.fn.preHit(A,T,u,s,c); let k=Math.max(TCAP,T.fn.teamF(A,T,u,t,c));","T.fn.preHit(A,T,u,s,c); T.fn.postHit(A,T,u,t,s); let k=Math.max(TCAP,T.fn.teamF(A,T,u,t,c));",'Wake: In'],
  // ---- Pressure ----
  ['Pressure every 0.5 s',FXJ,"while(e.a>=1-1e-9){ e.a-=1; if(e.n<mx) e.n++; }","while(e.a>=0.5-1e-9){ e.a-=0.5; if(e.n<mx) e.n++; }",'Pressure: Weight'],
  ['Pressure within 8 m',FXJ,"mx=5+(P['pr.max']||0), lim=4*A.eng().METER();","mx=5+(P['pr.max']||0), lim=8*A.eng().METER();",'Pressure: Weight'],
  ['Pressure lost after 3 s',FXJ,"if(now-e.last>=2-1e-9) e.n=0;","if(now-e.last>=3-1e-9) e.n=0;",'Pressure: Weight'],
  ['Weight of Water 0.5%',FXJ,"ds_4_4:[ {param:'pr.k',add:R(0.004)} ]","ds_4_4:[ {param:'pr.k',add:R(0.005)} ]",'Pressure: Weight'],
  ['Crushing Depth 2',FXJ,"ds_5_4:[ {param:'pr.max',add:R(1)} ]","ds_5_4:[ {param:'pr.max',add:R(2)} ]",'Pressure: Weight'],
  ['Deep Weight on magic resist too',FXJ,"prM(A,T,u,c){ return T.fn.prN(A,T,u,c.tgt)*(T.P['pr.k']||0); },","prM(A,T,u,c){ return T.fn.prN(A,T,u,c.tgt)*((T.P['pr.k']||0)+(T.P['pr.k2']||0)); },",'Pressure: Weight'],
  ['Equal Weight 5%',FXJ,"ds_8_4:[ {param:'ew',add:R(0.04)} ]","ds_8_4:[ {param:'ew',add:R(0.05)} ]",'Pressure: Weight'],
  ['Equal Weight on any skill',FXJ,"if(P.ew&&!c.auto&&s._castSlot==='ult'&&","if(P.ew&&!c.auto&&",'Pressure: Weight'],
  ['Held Down 4%',FXJ,"ds_10_4:[ {param:'hdn',add:R(0.03)} ]","ds_10_4:[ {param:'hdn',add:R(0.04)} ]",'Pressure: Weight'],
  // ---- Bloom, Deep, Lanternfish, Glow Rich, Quiet Trench, Still Water, Cold Calm ----
  ['Bright Bloom 7%',FXJ,"T.fn.lheal(A,T,u,x,0.06*x.maxHp); spare=n;","T.fn.lheal(A,T,u,x,0.07*x.maxHp); spare=n;",'Bright Bloom'],
  ['Bright Deep never',FXJ,"if(spare>0&&P.bd){","if(false&&P.bd){",'Bright Bloom'],
  ['Lanternfish 4%',FXJ,"T.fn.lheal(A,T,u,x,0.03*n*x.maxHp); e.cd=10;","T.fn.lheal(A,T,u,x,0.04*n*x.maxHp); e.cd=10;",'Bright Bloom'],
  ['Lanternfish every time',FXJ,"T.fn.lheal(A,T,u,x,0.03*n*x.maxHp); e.cd=10;","T.fn.lheal(A,T,u,x,0.03*n*x.maxHp); e.cd=0;",'Bright Bloom'],
  ['Glow Rich 3%',FXJ,"ds_8_1:[ {param:'ph.hr',add:R(0.02)} ]","ds_8_1:[ {param:'ph.hr',add:R(0.03)} ]",'Bright Bloom'],
  ['Quiet Trench with one ally',FXJ,"if(!(A.ustGet(T,u,x,'ph')>0)) return false; n++;","if(!(A.ustGet(T,u,x,'ph')>0)) continue; n++;",'Bright Bloom'],
  ['Quiet Trench 2%',FXJ,"ds_11_1:[ {param:'dr.qt',add:R(0.015)} ]","ds_11_1:[ {param:'dr.qt',add:R(0.02)} ]",'Bright Bloom'],
  ['Still Water 3%',FXJ,"ds_1_1:[ {param:'dr.sw',add:R(0.02)} ]","ds_1_1:[ {param:'dr.sw',add:R(0.03)} ]",'Bright Bloom'],
  ['Still Water when it is down',FXJ,"if(P['dr.sw']&&T.fn.orbFly(A,T)) k*=1-P['dr.sw'];","if(P['dr.sw']) k*=1-P['dr.sw'];",'Bright Bloom'],
  ['Cold Calm 2%',FXJ,"ds_8_2:[ {param:'dr.cc',add:R(0.01)} ]","ds_8_2:[ {param:'dr.cc',add:R(0.02)} ]",'Bright Bloom'],
  // ---- Heard ----
  ['Heard every 4.5 s',FXJ,"const p=Math.max(1.5,4+(P['hd.p']||0));","const p=Math.max(1.5,4.5+(P['hd.p']||0));",'Heard: Listening'],
  ['Heard: the least energy',FXJ,"const e=x.energy||0; if(e>be){ be=e; b=x; }","const e=-(x.energy||0); if(e>be){ be=e; b=x; }",'Heard: Listening'],
  ['Listening 2%',FXJ,"wh_1_1:[ {param:'hd.k',add:R(0.015)} ]","wh_1_1:[ {param:'hd.k',add:R(0.02)} ]",'Heard: Listening'],
  ['Sharp Ears 0.3 s',FXJ,"wh_2_1:[ {param:'hd.p',add:R(-0.4)} ]","wh_2_1:[ {param:'hd.p',add:R(-0.3)} ]",'Heard: Listening'],
  ['Breath Before 2%',FXJ,"wh_4_1:[ {param:'hd.bb',add:R(0.01)} ]","wh_4_1:[ {param:'hd.bb',add:R(0.02)} ]",'Heard: Listening'],
  ['She Lets Them Say It 9 m',FXJ,"if(P['hd.near']&&hd&&A.gap(u,x)<4*A.eng().METER())","if(P['hd.near']&&hd&&A.gap(u,x)<9*A.eng().METER())",'Heard: Listening'],
  ['Forewarned 2%',FXJ,"wh_6_1:[ {param:'hd.fw',add:R(0.01)} ]","wh_6_1:[ {param:'hd.fw',add:R(0.02)} ]",'Heard: Listening'],
  ['Long Listening 3%',FXJ,"wh_10_1:[ {stat:{aspd:R(-0.02)}","wh_10_1:[ {stat:{aspd:R(-0.03)}",'Heard: Listening'],
  ['Before It Lands 20%',FXJ,"wh_9_1:[ {param:'hd.bil',add:0.15} ]","wh_9_1:[ {param:'hd.bil',add:0.20} ]",'Heard: Listening'],
  ['Heard never spent',FXJ,"else if(!A.winOn(T,'nr_abb')) A.clearMark(u,x,'nr_hd'); }","}",'Heard: Listening'],
  ['its skill for 3 s',FXJ,"T.fn.press(A,T,u,x,(p.t||0)+1.5);","T.fn.press(A,T,u,x,(p.t||0)+3);",'Heard: Listening'],
  ['Known Hunter 0.8 s',FXJ,"wh_8_1:[ {param:'hd.kh',add:R(1)} ]","wh_8_1:[ {param:'hd.kh',add:R(0.8)} ]",'Heard: Listening'],
  ['Known Hunter heard once',FXJ,"e.w===T.s.wave&&e.n>=2&&","e.w===T.s.wave&&e.n>=1&&",'Heard: Listening'],
  ['Open Ears 0.4 s',FXJ,"{param:'hd.p',add:R(-0.5)}","{param:'hd.p',add:R(-0.4)}",'Open Ears'],
  ['Tuned 1.5 s',FXJ,"((P.tuned&&hd)?1:0)","((P.tuned&&hd)?1.5:0)",'Open Ears'],
  ['Tuned does not choose',FXJ,"rsTgt(A,T,u,c){","rsTgt(A,T,u,c){ return; ",'Open Ears'],
  ['Tuning Fork 4%',FXJ,"wh_12_3:[ {on:'out',if:{casting:RS,targetTeam:'enemy',targetHas:'nr_hd'},more:R(0.03)} ]","wh_12_3:[ {on:'out',if:{casting:RS,targetTeam:'enemy',targetHas:'nr_hd'},more:R(0.04)} ]",'Open Ears'],
  ['Deep Rings Back 5%',FXJ,"k*=1-0.04;","k*=1-0.05;",'Open Ears'],
  ['Deep Rings Back no second Toll',FXJ,"A.stGet(T,'tl')+1+(o.drbT?1:0));","A.stGet(T,'tl')+1+(o.drbT?0:0));",'Open Ears'],
  // ---- Brace ----
  ['Bracing 0.6%',FXJ,"wh_2_2:[ {param:'br.pi',add:R(0.005)} ]","wh_2_2:[ {param:'br.pi',add:R(0.006)} ]",'Brace: Bracing'],
  ['Brace up to 5',FXJ,"br:{max:P('br.max',4),dur:P('br.dur',6)}","br:{max:P('br.max',5),dur:P('br.dur',6)}",'Brace: Bracing'],
  ['Brace 7 s',FXJ,"br:{max:P('br.max',4),dur:P('br.dur',6)}","br:{max:P('br.max',4),dur:P('br.dur',7)}",'Brace: Bracing'],
  ['Long Brace 1.2 s',FXJ,"wh_4_2:[ {param:'br.dur',add:R(1)} ]","wh_4_2:[ {param:'br.dur',add:R(1.2)} ]",'Brace: Bracing'],
  ['Brace Again 2',FXJ,"wh_12_4:[ {param:'br.max',add:R(1)} ]","wh_12_4:[ {param:'br.max',add:R(2)} ]",'Brace: Bracing'],
  ['no Brace at a press',FXJ,"brace(A,T,u,c){ A.acts(T,u,[{stack:'br',add:1}],c); },","brace(A,T,u,c){ },",'Brace: Bracing'],
  ['Low Hum 0.5%',FXJ,"wh_3_4:[ {param:'br.hl',add:R(0.004)} ]","wh_3_4:[ {param:'br.hl',add:R(0.005)} ]",'Brace: Bracing'],
  ['Hollow Shell 0.5',FXJ,"wh_9_3:[ {param:'pi.pt',add:R(0.004)} ]","wh_9_3:[ {param:'pi.pt',add:R(0.005)} ]",'Brace: Bracing'],
  ['Pelagic extras while it is down',FXJ,"if(piUp(u)&&(P['br.pi']||P.iob||P['pi.pt'])){","if((P['br.pi']||P.iob||P['pi.pt'])){",'Brace: Bracing'],
  ['Hunter\'s Breath 0.3 s',FXJ,"wh_5_1:[ {param:'pi.dur',add:R(0.2)} ]","wh_5_1:[ {param:'pi.dur',add:R(0.3)} ]",'Brace: Bracing'],
  ['Stand Fast at 5',FXJ,"if(P.sf&&c.field==='stunned'&&A.stGet(T,'br')>=4){","if(P.sf&&c.field==='stunned'&&A.stGet(T,'br')>=5){",'Stand Fast'],
  ['Stand Fast keeps a direct stun',FXJ,"if((u.stunned||0)>(o.st0||0)+1e-9) u.stunned=o.st0||0;","",'Stand Fast'],
  ['Stand Fast can be knocked',FXJ,"on=A.stGet(T,'br')>=4; if(on){ if(!((u._gearImmovableT||0)>=0.1)) u._gearImmovableT=0.1;","on=A.stGet(T,'br')>=4; if(on){ ",'Stand Fast'],
  ['Rooted Feet 3%',FXJ,"wh_6_2:[ {param:'dr.rf',add:R(0.02)} ]","wh_6_2:[ {param:'dr.rf',add:R(0.03)} ]",'Stand Fast'],
  ['Quiet Mind 6%',FXJ,"wh_1_4:[ {param:'ten.qm',add:R(0.05)} ]","wh_1_4:[ {param:'ten.qm',add:R(0.06)} ]",'Stand Fast'],
  ['Quiet Mind cap 10%',FXJ,"Math.min(0.15,P['ten.qm'])","Math.min(0.10,P['ten.qm'])",'Stand Fast'],
  ['Slip Away every 4 s',FXJ,"o.saCd=5; c.amt=0;","o.saCd=4; c.amt=0;",'Stand Fast'],
  ['Slip Away at 3 Brace',FXJ,"if(P.sa&&A.stGet(T,'br')>=4&&","if(P.sa&&A.stGet(T,'br')>=3&&",'Stand Fast'],
  ['Gone Already 4',FXJ,"wh_6_3:[ {param:'sa.nrg',add:R(3)} ]","wh_6_3:[ {param:'sa.nrg',add:R(4)} ]",'Stand Fast'],
  ['Patience Below 2%',FXJ,"wh_11_1:[ {on:'cd',skill:'green',less:R(0.01)}","wh_11_1:[ {on:'cd',skill:'green',less:R(0.02)}",'Stand Fast'],
  // ---- Echo ----
  ['Echo up to 4',FXJ,"ec:{max:3,wave:'reset'}","ec:{max:4,wave:'reset'}",'Echo: a silence'],
  ['Echo kept across waves',FXJ,"ec:{max:3,wave:'reset'}","ec:{max:3}",'Echo: a silence'],
  ['Echo when not casting',FXJ,"if(t._pend&&EC.some(id=>T.r[id])) T.fn.echo(A,T,u);","if(EC.some(id=>T.r[id])) T.fn.echo(A,T,u);",'Echo: a silence'],
  ['Cancelled Note 3%',FXJ,"wh_4_4:[ {param:'ec.ap',add:R(0.02)} ]","wh_4_4:[ {param:'ec.ap',add:R(0.03)} ]",'Echo: a silence'],
  ['Ringing Back 1.2%',FXJ,"wh_5_4:[ {param:'ec.hl',add:R(0.01)} ]","wh_5_4:[ {param:'ec.hl',add:R(0.012)} ]",'Echo: a silence'],
  ['Echo Chamber 0.6%',FXJ,"wh_7_4:[ {param:'dr.ec',add:R(0.005)} ]","wh_7_4:[ {param:'dr.ec',add:R(0.006)} ]",'Echo: a silence'],
  ['Answering Note 0.6 s',FXJ,"wh_8_4:[ {param:'ec.cd',add:R(0.5)} ]","wh_8_4:[ {param:'ec.cd',add:R(0.6)} ]",'Echo: a silence'],
  // ---- Resonant Star ----
  ['True Pitch 0.12 s',FXJ,"wh_2_3:[ {param:'rs.sil',add:R(0.1)} ]","wh_2_3:[ {param:'rs.sil',add:R(0.12)} ]",'Resonant Star.s silence'],
  ['Echoing Steel 0.1 s',FXJ,"sb_8_3:[ {param:'rs.sil',add:R(0.08)} ]","sb_8_3:[ {param:'rs.sil',add:R(0.1)} ]",'Resonant Star.s silence'],
  ['One Clear Note 1.2 s',FXJ,"+(P.ocn?1:0)","+(P.ocn?1.2:0)",'Resonant Star.s silence'],
  ['Long Silence 3%',FXJ,"sb_11_4:[ {param:'sil.k',add:R(0.02)} ]","sb_11_4:[ {param:'sil.k',add:R(0.03)} ]",'Resonant Star.s silence'],
  ['her silences up to 4.2 s',FXJ,"CC_TALENT_CAP=4.0, HEAL_RATE","CC_TALENT_CAP=4.2, HEAL_RATE",'Resonant Star.s silence'],
  ['Bright Fork 4%',FXJ,"sb_1_1:[ {on:'out',if:{casting:RS,targetTeam:'enemy'},more:R(0.03)} ]","sb_1_1:[ {on:'out',if:{casting:RS,targetTeam:'enemy'},more:R(0.04)} ]",'Resonant Star.s silence'],
  ['Clean Note 4%',FXJ,"wh_1_3:[ {on:'out',if:{casting:RS,targetTeam:'enemy'},more:R(0.03)} ]","wh_1_3:[ {on:'out',if:{casting:RS,targetTeam:'enemy'},more:R(0.04)} ]",'Resonant Star.s silence'],
  ['Deep Voice 3%',FXJ,"sb_3_4:[ {on:'out',if:{kind:'magic',targetTeam:'enemy'},more:R(0.02)} ]","sb_3_4:[ {on:'out',if:{kind:'magic',targetTeam:'enemy'},more:R(0.03)} ]",'Resonant Star.s silence'],
  ['Deep Pulse on everything',FXJ,"wh_7_1:[ {on:'out',if:{kind:'magic',targetTeam:'enemy'},more:R(0.02)} ]","wh_7_1:[ {on:'out',if:{targetTeam:'enemy'},more:R(0.02)} ]",'Resonant Star.s silence'],
  ['Pure Tone 6%',FXJ,"sb_6_4:[ {on:'out',if:{casting:RS,targetTeam:'enemy'},more:R(0.05)} ]","sb_6_4:[ {on:'out',if:{casting:RS,targetTeam:'enemy'},more:R(0.06)} ]",'Resonant Star.s silence'],
  ['Ringing Fork 0.25 s',FXJ,"sb_4_4:[ {on:'cd',skill:'green',add:R(-0.2)} ]","sb_4_4:[ {on:'cd',skill:'green',add:R(-0.25)} ]",'Resonant Star.s silence'],
  ['Full Peal 60%',FXJ,"0.5*o.rsSil*(1+(P['fp.k']||0))","0.6*o.rsSil*(1+(P['fp.k']||0))",'Full Peal'],
  ['Wide Peal 11%',FXJ,"sb_6_2:[ {param:'fp.k',add:R(0.1)} ]","sb_6_2:[ {param:'fp.k',add:R(0.11)} ]",'Full Peal'],
  ['Full Peal the farthest',FXJ,"const g=A.gap(t,x); if(g<bd){ bd=g; b=x; }","const g=-A.gap(t,x); if(g<bd){ bd=g; b=x; }",'Full Peal'],
  ['Storm Bell at 4',FXJ,"if(P.storm&&A.stGet(T,'tl')>=5&&","if(P.storm&&A.stGet(T,'tl')>=4&&",'Full Peal'],
  ['Storm Bell 8 m',FXJ,"const t=o.rsT, lim=2*A.eng().METER();","const t=o.rsT, lim=8*A.eng().METER();",'Full Peal'],
  ['Storm Bell keeps its Tolls',FXJ,"A.stSet(T,u,'tl',0); const t=o.rsT","const t=o.rsT",'Full Peal'],
  // ---- Toll ----
  ['2 Tolls a cast',FXJ,"A.stGet(T,'tl')+1+(o.drbT?1:0));","A.stGet(T,'tl')+2+(o.drbT?1:0));",'Toll: First'],
  ['First Toll 0.6%',FXJ,"sb_1_3:[ {param:'tl.ap',add:R(0.005)} ]","sb_1_3:[ {param:'tl.ap',add:R(0.006)} ]",'Toll: First'],
  ['Heavy Bell 2',FXJ,"sb_2_3:[ {param:'tl.max',add:R(1)} ]","sb_2_3:[ {param:'tl.max',add:R(2)} ]",'Toll: First'],
  ['Cracked Bell 0.4%',FXJ,"{param:'tl.ap',add:R(0.003)}","{param:'tl.ap',add:R(0.004)}",'Toll: First'],
  ['Toll kept across waves',FXJ,"tl:{max:P('tl.max',5),wave:'reset'}","tl:{max:P('tl.max',5)}",'Toll: First'],
  ['Toll for the Fallen 2%',FXJ,"sb_10_3:[ {param:'tff',add:R(0.01)} ]","sb_10_3:[ {param:'tff',add:R(0.02)} ]",'Toll: First'],
  ['Toll for the Fallen 6 s',FXJ,"{window:'nr_tff',dur:5}","{window:'nr_tff',dur:6}",'Toll: First'],
  ['Toll for the Fallen unsilenced',FXJ,"if(!x||x.team===u.team||!((x.silencedT||0)>0)||!T.P.tff) return;","if(!x||x.team===u.team||!T.P.tff) return;",'Toll: First'],
  ['Insight of the Bell 2% a Toll',FXJ,"(P.iob?0.01*A.stGet(T,'tl'):0)","(P.iob?0.02*A.stGet(T,'tl'):0)",'Toll: First'],
  ['Insight of the Bell the farthest ally',FXJ,"const g=A.gap(u,x); if(g<bd){ bd=g; b=x; } } return b; },","const g=-A.gap(u,x); if(g<bd){ bd=g; b=x; } } return b; },",'Toll: First'],
  ['Ringing Insight 0.6%',FXJ,"sb_9_2:[ {param:'iob.k',add:R(0.005)} ]","sb_9_2:[ {param:'iob.k',add:R(0.006)} ]",'Toll: First'],
  // ---- Drowned ----
  ['Drowned after 3.5 s',FXJ,"need=Math.max(0.5,3+(P['dw.in']||0))","need=Math.max(0.5,3.5+(P['dw.in']||0))",'Drowned: Under'],
  ['Drowned 5 s',FXJ,"A.setMark(T,u,x,'nr_dw',{dur:4+(T.P['dw.dur']||0),longest:true});","A.setMark(T,u,x,'nr_dw',{dur:5+(T.P['dw.dur']||0),longest:true});",'Drowned: Under'],
  ['Under the Surface 3%',FXJ,"sb_2_2:[ {param:'dw.k',add:R(0.02)} ]","sb_2_2:[ {param:'dw.k',add:R(0.03)} ]",'Drowned: Under'],
  ['Under the Surface on every kind',FXJ,"if(P['dw.k']&&c.kind==='magic') k*=1+P['dw.k'];","if(P['dw.k']) k*=1+P['dw.k'];",'Drowned: Under'],
  ['Sinking Fast 0.4 s',FXJ,"sb_4_2:[ {param:'dw.in',add:R(-0.3)} ]","sb_4_2:[ {param:'dw.in',add:R(-0.4)} ]",'Drowned: Under'],
  ['Heavy Water 0.6 s',FXJ,"sb_8_4:[ {param:'dw.dur',add:R(0.5)} ]","sb_8_4:[ {param:'dw.dur',add:R(0.6)} ]",'Drowned: Under'],
  ['No Air lets energy in',FXJ,"if(k!=null&&(x.energy||0)>k) x.energy=k;","",'Drowned: Under'],
  ['Hard Water 2%',FXJ,"sb_3_1:[ {param:'dr.hw',add:R(0.015)} ]","sb_3_1:[ {param:'dr.hw',add:R(0.02)} ]",'Drowned: Under'],
  ['Drowning Weight 0.7%',FXJ,"sb_12_3:[ {param:'dw.all',add:R(0.006)} ]","sb_12_3:[ {param:'dw.all',add:R(0.007)} ]",'Drowned: Under'],
  ['Ringing Ears 2%',FXJ,"sb_6_3:[ {param:'sil.re',add:R(0.01)} ]","sb_6_3:[ {param:'sil.re',add:R(0.02)} ]",'Drowned: Under'],
  ['Trench Hunter 4%',FXJ,"sb_7_4:[ {on:'out',if:{auto:true,targetTeam:'enemy',fn:'silTgt'},more:R(0.03)} ]","sb_7_4:[ {on:'out',if:{auto:true,targetTeam:'enemy',fn:'silTgt'},more:R(0.04)} ]",'Drowned: Under'],
  // ---- the Current ----
  ['The Current 2%',FXJ,"sb_4_1:[ {param:'cur.as',add:R(0.015)} ]","sb_4_1:[ {param:'cur.as',add:R(0.02)} ]",'the Current: The'],
  ['Strong Current 1.5 points',FXJ,"sb_12_1:[ {param:'cur.as2',add:R(0.01)} ]","sb_12_1:[ {param:'cur.as2',add:R(0.015)} ]",'the Current: The'],
  ['Swift Current 6%',FXJ,"sb_8_1:[ {param:'cur.mv',add:R(0.05)} ]","sb_8_1:[ {param:'cur.mv',add:R(0.06)} ]",'the Current: The'],
  ['Slack Water 5%',FXJ,"sb_5_1:[ {param:'cur.slow',add:R(0.04)} ]","sb_5_1:[ {param:'cur.slow',add:R(0.05)} ]",'the Current: The'],
  ['Undercurrent 0.4%',FXJ,"sb_10_1:[ {param:'cur.hl',add:R(0.003)} ]","sb_10_1:[ {param:'cur.hl',add:R(0.004)} ]",'the Current: The'],
  ['Undertone 3%',FXJ,"sb_11_1:[ {param:'cur.hr',add:R(0.02)} ]","sb_11_1:[ {param:'cur.hr',add:R(0.03)} ]",'the Current: The'],
  ['Pressure Wave 0.2 m',FXJ,"sb_10_2:[ {on:'kit',skill:CH,opt:{radius:{addM:R(0.3)}}} ]","sb_10_2:[ {on:'kit',skill:CH,opt:{radius:{addM:R(0.2)}}} ]",'the Current: The'],
  ['the Current 50% wider',FXJ,"for(const x of team(A,u)) if(Math.hypot(x.x-h.x,x.y-h.y)<=h.r) cur[x.uid]","for(const x of team(A,u)) if(Math.hypot(x.x-h.x,x.y-h.y)<=1.5*h.r) cur[x.uid]",'the Current: The'],
  ['the Choir never ends',FXJ,"if(!(h.life>0)||!sung(u)){","if(false){",'the Current: The|Every Light'],
  // ---- the Choir ----
  ['Choir of the Deep 4%',FXJ,"wh_12_2:[ {param:'ch.h',add:R(0.03)} ]","wh_12_2:[ {param:'ch.h',add:R(0.04)} ]",'the Choir: Choir'],
  ['Whole Deep at Once 4%',FXJ,"sb_12_2:[ {param:'ch.h',add:R(0.03)} ]","sb_12_2:[ {param:'ch.h',add:R(0.04)} ]",'the Choir: Choir'],
  ['Choir of Warnings 1.5 s',FXJ,"+((P.cow&&hd)?1:0)","+((P.cow&&hd)?1.5:0)",'the Choir: Choir'],
  ['Choir of Warnings hears nobody',FXJ,"if(P.cow){ if(!hd) T.fn.heard(A,T,u,e,10); hd=true; }","if(P.cow){ hd=true; }",'the Choir: Choir'],
  ['Choir: no Long Silence',FXJ,"c.amt=Math.min(CC_TALENT_CAP,c.amt*(1+(P['sil.k']||0))+((P.cow&&hd)?1:0));","c.amt=Math.min(CC_TALENT_CAP,c.amt+((P.cow&&hd)?1:0));",'the Choir: Choir'],
  ['Spent Echo 0.25 s',FXJ,"wh_10_4:[ {param:'ec.ch',add:R(0.2)} ]","wh_10_4:[ {param:'ec.ch',add:R(0.25)} ]",'the Choir: Choir'],
  ['Ring the Bell 0.5 s',FXJ,"add+=0.4*n; A.stSet(T,u,'tl',0);","add+=0.5*n; A.stSet(T,u,'tl',0);",'the Choir: Choir'],
  ['Ring the Bell keeps its Tolls',FXJ,"add+=0.4*n; A.stSet(T,u,'tl',0);","add+=0.4*n;",'the Choir: Choir'],
  ['Ring the Bell drowns nobody',FXJ,"if(o.rtbOn||(free&&P.whsb)) for(const x of foes(A,u))","if((free&&P.whsb)) for(const x of foes(A,u))",'the Choir: Choir'],
  ['Sky Full of Stars: no Phosphor',FXJ,"if(P.sky&&mate(u,x)){ T.fn.phAdd","if(false){ T.fn.phAdd",'the Choir: Choir'],
  ['Choir Glow 1.2 s',FXJ,"ds_12_3:[ {param:'sky.dur',add:R(1)} ]","ds_12_3:[ {param:'sky.dur',add:R(1.2)} ]",'the Choir: Choir'],
  // ---- the signatures ----
  ['Every Light: 3 Phosphor',FXJ,"A.ustPut(T,u,x,'ph',PH_MAX,8+(P['ph.dur']||0)); if(was===0) T.fn.trench(A,T,u,x);","A.ustPut(T,u,x,'ph',3,8+(P['ph.dur']||0)); if(was===0) T.fn.trench(A,T,u,x);",'Every Light'],
  ['Every Light: Pressure 7 s',FXJ,"T.fn.wake(A,T,u,x,6); pf[x.uid]=now+6; }","T.fn.wake(A,T,u,x,6); pf[x.uid]=now+7; }",'Every Light'],
  ['A Breath Before 55% on her',FXJ,"SIG_ME=0.50, SIG_ALLY=0.70","SIG_ME=0.45, SIG_ALLY=0.70",'A Breath Before'],
  ['A Breath Before 25% on allies',FXJ,"SIG_ME=0.50, SIG_ALLY=0.70","SIG_ME=0.50, SIG_ALLY=0.75",'A Breath Before'],
  ['A Breath Before 7 s',FXJ,"A.acts(T,u,[{window:'nr_abb',dur:6}],c);","A.acts(T,u,[{window:'nr_abb',dur:7}],c);",'A Breath Before'],
  ['A Breath Before: no Echo',FXJ,"if(win){ T.fn.echo(A,T,u); A.acts","if(win){ A.acts",'A Breath Before'],
  ['A Breath Before on basic attacks',FXJ,"if(A.winOn(T,'nr_abb')&&!c.auto) k=Math.min(k,SIG_ALLY);","if(A.winOn(T,'nr_abb')) k=Math.min(k,SIG_ALLY);",'A Breath Before'],
  ['When Her Side Breaks at 4 Tolls',FXJ,"A.stGet(T,'tl')>=5&&sung(u)&&E.castUlt","A.stGet(T,'tl')>=4&&sung(u)&&E.castUlt",'When Her Side'],
  ['When Her Side Breaks every 0.5 s',FXJ,"if(low&&!was&&!(o.whCd>0)&&A.stGet(T,'tl')>=5&&sung(u)&&E.castUlt){ o.whCd=30;","if(low&&!was&&!(o.whCd>0)&&A.stGet(T,'tl')>=5&&sung(u)&&E.castUlt){ o.whCd=0.5;",'When Her Side'],
  ['When Her Side Breaks: single Current',FXJ,"const k=e.free?2:1;","const k=1;",'When Her Side'],
  ['When Her Side Breaks drowns nobody',FXJ,"if(o.rtbOn||(free&&P.whsb)) for(const x of foes(A,u))","if(o.rtbOn) for(const x of foes(A,u))",'When Her Side'],
  // ---- Pelagic Insight on allies, range, the caps ----
  ['Wake of Insight off',FXJ,"if(pi>0&&P.woi&&A.markOf(u,x,'nr_wk')) cov=Math.max(cov,pi+(P['woi.k']||0));","",'Wake of Insight'],
  ['Insight Shared 0.5 points',FXJ,"ds_9_3:[ {param:'woi.k',add:R(0.004)} ]","ds_9_3:[ {param:'woi.k',add:R(0.005)} ]",'Wake of Insight'],
  ['Long Reach 4%',FXJ,"sb_1_4:[ {param:'rng',add:R(0.03)} ]","sb_1_4:[ {param:'rng',add:R(0.04)} ]",'Wake of Insight'],
  ['her group at 40%',FXJ,"MCAP=0.65, TCAP=0.75,","MCAP=0.60, TCAP=0.75,",'two capped groups'],
  ['the allies\' group at 30%',FXJ,"MCAP=0.65, TCAP=0.75,","MCAP=0.65, TCAP=0.70,",'two capped groups'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); if(!r) return true; const top=r.split(path.sep)[0]; return !SKIP.has(top)&&!/^\.(ctl|test|remote)-/.test(top); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-nrc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,to));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-nerisse.test.js'],{cwd:dir,env:Object.assign({},process.env,pat===ID?{}:{NERISSE_NOBASE:'1'}),encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
if(process.argv[2]==='--count'){ let bad=0; for(const c of C){ const s=fs.readFileSync(path.join(root,c[1]),'utf8'), n=s.split(c[2]).length-1; if(n!==1){ bad++; console.log('FOUND '+n+'x: '+c[0]); } } console.log(C.length+' controls, '+bad+' not found exactly once'); process.exit(bad?1:0); }
const only=(process.argv[2]||process.env.NERISSE_CTL)?new RegExp(process.argv[2]||process.env.NERISSE_CTL):null, out=[];
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
