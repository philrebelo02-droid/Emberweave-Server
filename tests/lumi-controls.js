'use strict';
/* The controls for Lumi's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script, together with
   tests/talents-mech-lumi.test.js). Each control copies this checkout to a temp folder (os.tmpdir(): the runner's own temp folder on disk), breaks ONE thing there
   (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guarded site given an unguarded seeded draw, a row or
   a number of hers changed), runs the named tests of tests/talents-mech-lumi.test.js in that copy, and expects them to FAIL. ONE copy at a time (no parallel
   child processes); each copy is deleted when its run is done; .logs, .remote-logs and node_modules are never copied (node_modules is linked). The checkout
   itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught.  Run: node tests/lumi-controls.js [name pattern] */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js', ID='no talents';
const HP="const _huP=(u._tal&&u._tal.on.num)?TalentFx.num(u,'hushP',5):5;";
const HT="if(u._tal&&u._tal.on.skillTgt) e=TalentFx.skillTgt(u,'hush',e,{list:foes})||e;";
const HD="(u._tal&&u._tal.on.num)?TalentFx.num(u,'hushD',ccDur(1*(u.passMul||1)),e):ccDur(1*(u.passMul||1))";
const HS="if(u._tal&&u._tal.on.pass) TalentFx.pass(u,e,'hush');";
const C=[
  // ---- the page sites: hook removed (her tests fail) ----
  ['Hush period hook removed',HTML,HP,'const _huP=5;','Hush: Early'],
  ['Hush target hook removed',HTML,HT,'','One Voice|Sun in the Eyes'],
  ['Hush silence hook removed',HTML,HD,'ccDur(1*(u.passMul||1))','Hush: Early|One Voice'],
  ['Hush pass hook removed',HTML,HS,'','Voices: Taken|Muffled'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the Hush period',HTML,HP,'brnd(); '+HP,ID],
  ['draw at the Hush target',HTML,HT,'brnd(); '+HT,ID],
  ['draw at the Hush silence',HTML,"        e.silencedT=Math.max(e.silencedT||0,(u._tal&&u._tal.on.num)?","        brnd(); e.silencedT=Math.max(e.silencedT||0,(u._tal&&u._tal.on.num)?",ID],
  ['draw at the Hush pass',HTML,HS,'brnd(); '+HS,ID],
  // ---- Willing ----
  ['Willing Heart 2%',FXJ,"{param:'wl.k',add:R(0.015)}","{param:'wl.k',add:R(0.02)}",'Willing:'],
  ['Stubborn Hope 1.1 s',FXJ,"{param:'wl.dur',add:R(1)}","{param:'wl.dur',add:R(1.1)}",'Willing:'],
  ['Willing Hearts multiplies',FXJ,"{param:'wl.dmg2',add:R(0.005)}","{param:'wl.dmg2',add:R(0.0055)}",'Willing:'],
  ['Morning Gold never',FXJ,"if(x&&x.alive&&d>0&&!A.markOf(u,x,'wl')) A.setMark(T,u,x,'wh',{dur:d});","",'Willing:'],
  ['Morning Gold whole',FXJ,"A.markOf(u,x,'wh')?0.5:0","A.markOf(u,x,'wh')?1:0",'Willing:'],
  ['Willing not on the ward',FXJ,"if(rk(T,'fm_1_2')) T.fn.willing","if(false) T.fn.willing",'Willing:'],
  ['Not Yet 16%',FXJ,"T.fn.lheal(A,T,u,x,0.15*x.maxHp)","T.fn.lheal(A,T,u,x,0.16*x.maxHp)",'Not Yet'],
  ['Clear Sky never',FXJ,"if(P['hl.cs']&&team(A,T,u).some(y=>A.markOf(u,y,'wl'))) k*=1+P['hl.cs'];","",'Not Yet'],
  ['They Decide every time',FXJ,"if(low&&!e.was&&e.w!==T.s.wave&&A.markOf(u,x,'wl'))","if(low&&!e.was&&A.markOf(u,x,'wl'))",'Not Yet'],
  ['They Decide keeps the slow',FXJ,"for(const f of ['stunned','fearT','silencedT','_sleepT','slow']) if((x[f]||0)>0) x[f]=0;","for(const f of ['stunned','fearT','silencedT','_sleepT']) if((x[f]||0)>0) x[f]=0;",'Not Yet'],
  // ---- the Watch ----
  ['Watch every 3.2 s',FXJ,"const p=Math.max(0.5,3+(P['wt.p']||0));","const p=Math.max(0.5,3.2+(P['wt.p']||0));",'the Watch'],
  ['Watchtower ignored',FXJ,"k*=1-((P['wt.k']||0)+(P['wt.k2']||0));","k*=1-(P['wt.k']||0);",'the Watch'],
  ['Watch on herself',FXJ,"const x=A.eng().lowestAlly(u); if(x) A.setMark(T,u,x,'wt',{unique:true});","const x=u; if(x) A.setMark(T,u,x,'wt',{unique:true});",'the Watch'],
  ['Last Watchfire 1.2%',FXJ,"{param:'wt.dmg',add:R(0.01)}","{param:'wt.dmg',add:R(0.012)}",'the Watch'],
  ['First Gold 3%',FXJ,"{param:'hl.wt',add:R(0.02)}","{param:'hl.wt',add:R(0.03)}",'the Watch'],
  ['Close Watch 4%',FXJ,"{param:'wt.hr',add:R(0.03)}","{param:'wt.hr',add:R(0.04)}",'the Watch'],
  // ---- Long Night ----
  ['Long Night 0.6%',FXJ,"{param:'ln.k',add:R(0.005)}","{param:'ln.k',add:R(0.006)}",'Long Night'],
  ['Long Night up to 6',FXJ,"mx=5+(P['ln.max']||0);","mx=6+(P['ln.max']||0);",'Long Night'],
  ['Night Long 0.25 s',FXJ,"{param:'ln.fast',add:R(0.2)}","{param:'ln.fast',add:R(0.25)}",'Long Night'],
  ['Long Night paid twice',FXJ,"          e.n=0; e.a=0; } } },","          e.a=0; } } },",'Long Night'],
  ['Sunward 3',FXJ,"{param:'ln.nrg',add:R(2)}","{param:'ln.nrg',add:R(3)}",'Long Night'],
  ['Daylong 0.3',FXJ,"{param:'ln.k2',add:R(0.002)}","{param:'ln.k2',add:R(0.003)}",'Long Night'],
  // ---- Dawnward ----
  ['Long Ward 0.15 s',FXJ,"fm_3_4:[ {on:'kit',skill:DW,opt:{dur:{add:R(0.1)}}} ],","fm_3_4:[ {on:'kit',skill:DW,opt:{dur:{add:R(0.15)}}} ],",'Dawnward:'],
  ['Frostless 0.25 s',FXJ,"qh_10_1:[ {on:'kit',skill:DW,opt:{dur:{add:R(0.2)}}} ],","qh_10_1:[ {on:'kit',skill:DW,opt:{dur:{add:R(0.25)}}} ],",'Dawnward:'],
  ['Light the Road 1.4 s',FXJ,"fm_5_3:[ {on:'kit',skill:DW,opt:{dur:{add:1.5}}} ],","fm_5_3:[ {on:'kit',skill:DW,opt:{dur:{add:1.4}}} ],",'Dawnward:'],
  ['Hold the Wall: no second ally',FXJ,"if(b){ b._wardT=Math.max(b._wardT||0,t._wardT); L.push(b); }","",'Dawnward:'],
  ['Hold the Wall 0.9 s shorter',FXJ,"fm_5_1:[ {on:'kit',skill:DW,opt:{dur:{add:-1}}}","fm_5_1:[ {on:'kit',skill:DW,opt:{dur:{add:-0.9}}}",'Dawnward:'],
  ['Shoulder to Shoulder 3%',FXJ,"{param:'sts',add:R(0.02)}","{param:'sts',add:R(0.03)}",'Dawnward:'],
  ['Dawn Chill 2.5%',FXJ,"{param:'dr.dc',add:R(0.02)}","{param:'dr.dc',add:R(0.025)}",'Dawnward:'],
  ['Patient Light 0.25 s',FXJ,"fm_11_1:[ {on:'cd',skill:'green',add:R(-0.2)} ],","fm_11_1:[ {on:'cd',skill:'green',add:R(-0.25)} ],",'Dawnward:'],
  ['Long Road 0.5 s',FXJ,"fm_6_3:[ {on:'cd',skill:'green',add:R(-0.4)} ],","fm_6_3:[ {on:'cd',skill:'green',add:R(-0.5)} ],",'Dawnward:'],
  ['Sleepless 4%',FXJ,"fm_6_4:[ {on:'in',if:{srcTeam:'enemy'},more:R(0.03)}","fm_6_4:[ {on:'in',if:{srcTeam:'enemy'},more:R(0.04)}",'Dawnward:'],
  ['Quiet Ward on every hit',FXJ,"if(!L||L.indexOf(s.uid)>=0) return; L.push(s.uid);","if(!L) return;",'Quiet Ward'],
  ['Quiet Ward 0.6 s',FXJ,"{param:'qw',add:0.5}","{param:'qw',add:0.6}",'Quiet Ward'],
  // ---- controls ----
  ['Grey Composure and Siege Nerves uncapped',FXJ,"if(P['ten.sn']&&A.markOf(u,u,'wl')) k*=1-P['ten.sn']; c.amt*=Math.max(0.75,k); },","if(P['ten.sn']&&A.markOf(u,u,'wl')) k*=1-P['ten.sn']; c.amt*=k; },",'Grey Composure'],
  ['Siege Nerves on any ally',FXJ,"if(x!==u&&P['ten.sn']&&A.markOf(u,x,'wl')) x[f]=","if(x!==u&&P['ten.sn']) x[f]=",'Grey Composure'],
  ['Siege Nerves cuts a longer control',FXJ,"if(!x||!(a>0)||Math.abs((x[f]||0)-a)>1e-6) return;","if(!x||!(a>0)) return;",'Grey Composure'],
  // ---- Radiant Nova ----
  ['Steady Dawn 3%',FXJ,"{param:'nv.heal',add:R(0.02)}","{param:'nv.heal',add:R(0.03)}","Nova's heal"],
  ['Soft Light 0.6%',FXJ,"{param:'nv.voh',add:R(0.005)}","{param:'nv.voh',add:R(0.006)}","Nova's heal"],
  ['Fourth Morning Nova 25%',FXJ,"if(P.fmn&&A.markOf(u,x,'wt')) k*=1.30;","if(P.fmn&&A.markOf(u,x,'wt')) k*=1.25;","Nova's heal"],
  ['Fourth Morning Nova: no Willing',FXJ,"if(P.fmn) T.fn.willing(A,T,u,x,8+","if(false) T.fn.willing(A,T,u,x,8+","Nova's heal"],
  ['Morning Chorus 0.7 s',FXJ,"{param:'wl.nova',add:R(0.6)}","{param:'wl.nova',add:R(0.7)}","Nova's heal"],
  ['Nova Reach 0.5 m',FXJ,"fm_10_3:[ {on:'kit',skill:NOVA,opt:{radius:{addM:R(0.4)}}} ],","fm_10_3:[ {on:'kit',skill:NOVA,opt:{radius:{addM:R(0.5)}}} ],",'Nova Reach'],
  ['Lightfall 0.25 m',FXJ,"qh_8_3:[ {on:'kit',skill:NOVA,opt:{radius:{addM:R(0.3)}}} ],","qh_8_3:[ {on:'kit',skill:NOVA,opt:{radius:{addM:R(0.25)}}} ],",'Nova Reach'],
  ['Brighter Nova 3%',FXJ,"qh_3_4:[ {on:'out',if:{casting:NOVA,targetTeam:'enemy'},more:R(0.02)} ],","qh_3_4:[ {on:'out',if:{casting:NOVA,targetTeam:'enemy'},more:R(0.03)} ],",'Nova Reach'],
  ['Dawn Edge not on Muffled',FXJ,"return !!t&&((t.silencedT||0)>0||!!A.markOf(u,t,'mf'));","return !!t&&(t.silencedT||0)>0;",'Nova Reach'],
  ['Three Hundred Willing 50%',FXJ,"const share=0.4*c.amt,","const share=0.5*c.amt,",'Three Hundred'],
  ['Three Hundred Willing: her share whole',FXJ,"x===u?per*0.5:per","per",'Three Hundred'],
  ['Three Hundred Willing 11 s',FXJ,"A.acts(T,u,[{window:'thw',dur:10}],c);","A.acts(T,u,[{window:'thw',dur:11}],c);",'Three Hundred'],
  // ---- Hush ----
  ['Early Hours 0.25 s',FXJ,"{param:'hu.p',add:R(-0.2)}","{param:'hu.p',add:R(-0.25)}",'Hush: Early'],
  ['Early Quiet 0.15 s',FXJ,"{param:'hu.d',add:R(0.1)}","{param:'hu.d',add:R(0.15)}",'Hush: Early'],
  ['Lingering Hush: not on Hush',FXJ,"c.amt=Math.min(CC_TALENT_CAP,c.amt*(1+(P['sil.k']||0))+","c.amt=Math.min(CC_TALENT_CAP,c.amt+",'Hush: Early'],
  ['Lingering Hush: not on allies',FXJ,"if(f==='silencedT'&&P['sil.k']&&s&&s.team===u.team&&s!==u) x[f]=","if(false) x[f]=",'Hush: Early'],
  ['Stolen Breath 4',FXJ,"{param:'hu.drain',add:R(3)}","{param:'hu.drain',add:R(4)}",'Hush: Early'],
  ['Still Air 3%',FXJ,"qh_5_4:[ {stat:{aspd:R(-0.02)}","qh_5_4:[ {stat:{aspd:R(-0.03)}",'Hush: Early'],
  ['Swallowed Word off',FXJ,"if(P['hu.sw']&&x._pend&&x._pend.spell){","if(false){",'Hush: Early'],
  ['One Voice: the least ability power',FXJ,"if(x.alive&&(!b||(x.apow||0)>(b.apow||0))) b=x;","if(x.alive&&(!b||(x.apow||0)<(b.apow||0))) b=x;",'One Voice'],
  ['One Voice 0.4 s',FXJ,"{param:'hu.d',add:0.5}","{param:'hu.d',add:0.4}",'One Voice'],
  ['Named Voice 3 s',FXJ,"A.setMark(T,u,x,'nv',{dur:2});","A.setMark(T,u,x,'nv',{dur:3});",'One Voice'],
  ['Many Voices every second Hush',FXJ,"o.dbl=!!P['hu.many']&&o.hc%3===0;","o.dbl=!!P['hu.many']&&o.hc%2===0;",'One Voice'],
  ['Hush of Many 0.2 s',FXJ,"{param:'hu.md',add:R(0.15)}","{param:'hu.md',add:R(0.2)}",'One Voice'],
  // ---- Voices ----
  ['Taken Voices 0.7%',FXJ,"{param:'vo.ap',add:R(0.006)}","{param:'vo.ap',add:R(0.007)}",'Voices: Taken'],
  ['Hoard of Voices 2',FXJ,"{param:'vo.max',add:R(1)}","{param:'vo.max',add:R(2)}",'Voices: Taken'],
  ['Kept Voices none',FXJ,"o.keepV=Math.min(A.stGet(T,'vo'),T.P['vo.keep']||0);","o.keepV=0;",'Voices: Taken'],
  ['Daylit Calm at 2',FXJ,"if(P['dr.vo']&&A.stGet(T,'vo')>=3)","if(P['dr.vo']&&A.stGet(T,'vo')>=2)",'Voices: Taken'],
  ['Nova of Voices 12%',FXJ,"c.amt*=1+(0.10+(P['nv.ev']||0))*o.nvN;","c.amt*=1+(0.12+(P['nv.ev']||0))*o.nvN;",'Nova of Voices'],
  ['Nova of Voices spends on a miss',FXJ,"if(P.nov&&o.nvN>0&&o.nvHit>0){","if(P.nov&&o.nvN>0){",'Nova of Voices'],
  ['Nova of Voices 0.4 s a Voice',FXJ,"Math.min(CC_TALENT_CAP,0.3*o.nvN)","Math.min(CC_TALENT_CAP,0.4*o.nvN)",'Nova of Voices'],
  ['The Street at Dawn at 4',FXJ,"o.nvFull=o.nvN>0&&o.nvN>=A.stMax(T,u,'vo')-1e-9;","o.nvFull=o.nvN>=4;",'Nova of Voices'],
  ['The Street at Dawn 2.5 s',FXJ,"A.control(T,u,x,'silencedT',2); A.setMark(T,u,x,'mf',{}); T.fn.mfAdd","A.control(T,u,x,'silencedT',2.5); A.setMark(T,u,x,'mf',{}); T.fn.mfAdd",'Nova of Voices'],
  ['The Street at Dawn every 2 s',FXJ,"if(A.winOn(T,'std')){ c.amt=1; return; }","if(A.winOn(T,'std')){ c.amt=2; return; }",'Nova of Voices'],
  // ---- Muffled ----
  ['Soft Hands 5%',FXJ,"{param:'mf.k',add:R(0.04)}","{param:'mf.k',add:R(0.05)}",'Muffled:'],
  ['Muffled never ends',FXJ,"A.setMark(T,u,x,'mfc',{dur:(p.t||0)+1}); A.clearMark(u,x,'mf');","A.setMark(T,u,x,'mfc',{dur:(p.t||0)+1});",'Muffled:'],
  ['Thick Muffle 0.4 s',FXJ,"{param:'mf.cd',add:R(0.3)}","{param:'mf.cd',add:R(0.4)}",'Muffled:'],
  ['Dull Blows 2%',FXJ,"{param:'mf.auto',add:R(0.01)}","{param:'mf.auto',add:R(0.02)}",'Muffled:'],
  ['Hollow Echo 2%',FXJ,"{param:'mf.echo',add:R(0.01)}","{param:'mf.echo',add:R(0.02)}",'Muffled:'],
  ['Sealed Lips 4%',FXJ,"{param:'mf.heal',add:R(0.03)}","{param:'mf.heal',add:R(0.04)}",'Muffled:'],
  ['Muffled at once',FXJ,"huEnd(A,T,u,c){ const x=c.tgt;","huEnd(A,T,u,c){ return; const x=c.tgt;",'Muffled:'],
  // ---- quiet ----
  ['The Quietest Part 10%',FXJ,"{param:'dr.qp',add:0.08}","{param:'dr.qp',add:0.10}",'Quietest'],
  ['Unheard 4%',FXJ,"{param:'dr.un',add:R(0.03)}","{param:'dr.un',add:R(0.04)}",'Quietest'],
  ['Unhurried every skill',FXJ,"if(P['dr.uh']&&!c.auto&&o.uhW!==T.s.wave){ o.uhW=T.s.wave;","if(P['dr.uh']&&!c.auto){",'Quietest'],
  ['Quiet Mind 2%',FXJ,"qh_5_1:[ {on:'cd',skill:'green',less:R(0.01)}","qh_5_1:[ {on:'cd',skill:'green',less:R(0.02)}",'Quietest'],
  ['Pale Edge 3%',FXJ,"qh_7_1:[ {on:'out',if:{kind:'magic',targetTeam:'enemy'},more:R(0.02)} ],","qh_7_1:[ {on:'out',if:{kind:'magic',targetTeam:'enemy'},more:R(0.03)} ],",'her damage'],
  ['Dim Morning on anyone',FXJ,"silTgt(A,T,u,c){ return !!c.tgt&&(c.tgt.silencedT||0)>0; },","silTgt(A,T,u,c){ return true; },",'her damage'],
  ['Thin Walls 3%',FXJ,"qh_6_4:[ {on:'in',if:{srcTeam:'enemy'},more:R(0.02)}","qh_6_4:[ {on:'in',if:{srcTeam:'enemy'},more:R(0.03)}",'her damage'],
  // ---- Sunblind ----
  ['Low Sun 0.7%',FXJ,"{param:'sb.k',add:R(0.006)}","{param:'sb.k',add:R(0.007)}",'Sunblind: Low'],
  ['Blinding 1.5 s',FXJ,"{param:'sb.dur',add:R(1)}","{param:'sb.dur',add:R(1.5)}",'Sunblind: Low'],
  ['Sunburnt 2 a rank',FXJ,"{on:'in',if:{srcTeam:'enemy'},more:R(0.03)}, {param:'sb.max',add:R(1)}","{on:'in',if:{srcTeam:'enemy'},more:R(0.03)}, {param:'sb.max',add:R(2)}",'Sunblind: Low'],
  ['Blinding Nova 2 a rank',FXJ,"{param:'sb.nova',add:R(1)}","{param:'sb.nova',add:R(2)}",'Sunblind: Low'],
  ['Low Sun on skill hits',FXJ,"if(c.auto&&P['sb.k']>0&&t.alive) T.fn.sbAdd(A,T,u,t,1);","if(P['sb.k']>0&&t.alive) T.fn.sbAdd(A,T,u,t,1);",'Sunblind: Low'],
  ['the miss chance 10% larger',FXJ,"if(p>0&&A.eng().rnd()<p){ m=true; roll=true; }","if(p>0&&A.eng().rnd()<p*1.1){ m=true; roll=true; }",'Sunblind: Low'],
  ['Squint 4%',FXJ,"{param:'sq',add:0.03}","{param:'sq',add:0.04}",'Squint'],
  ['Squint: Muffled every time',FXJ,"if(rk(T,'qh_1_1')&&!A.markOf(u,s,'sql'))","if(rk(T,'qh_1_1'))",'Squint'],
  ['Sun-Warmed 2%',FXJ,"{param:'dr.sw',add:R(0.015)}","{param:'dr.sw',add:R(0.02)}",'Squint'],
  ['White Heat at 4',FXJ,"if(P.whh&&A.ustGet(T,u,t,'sb')>=5)","if(P.whh&&A.ustGet(T,u,t,'sb')>=4)",'Squint'],
  ['Dazzle 0.6%',FXJ,"fl_8_4:[ {stat:{aspd:R(-0.005)}","fl_8_4:[ {stat:{aspd:R(-0.006)}",'Squint'],
  ['Whiteout 2 s',FXJ,"A.setMark(T,u,t,'wo',{dur:1});","A.setMark(T,u,t,'wo',{dur:2});",'Squint'],
  ['Whiteout: no lock',FXJ,"if(P.wo&&was<5&&v>=5&&!A.markOf(u,t,'wol')){","if(P.wo&&was<5&&v>=5){",'Squint'],
  ['Hot Noon 1.5 s',FXJ,"{param:'sb.noon',add:R(1)}","{param:'sb.noon',add:R(1.5)}",'Squint'],
  ['Sun in the Eyes: not the most',FXJ,"const n=A.ustGet(T,u,x,'sb'); if(x.alive&&n>bn){ bn=n; b=x; }","const n=-A.ustGet(T,u,x,'sb'); if(x.alive&&n>bn){ bn=n; b=x; }",'Sun in the Eyes'],
  ['Sun in the Eyes: no miss',FXJ,"if(P['hu.sun']&&A.markOf(u,s,'hu')) m=true;","if(false) m=true;",'Sun in the Eyes'],
  ['Spread Light: not from allies',FXJ,"if(P.spl&&A.markOf(u,s,'qk')) T.fn.sbAdd(A,T,u,c.tgt,1);","",'Sun in the Eyes'],
  ['Glinting Blades 2%',FXJ,"fl_9_2:[ {param:'gb',add:R(0.01)} ],","fl_9_2:[ {param:'gb',add:R(0.02)} ],",'Sun in the Eyes'],
  // ---- Kindled ----
  ['Kindled: no budget',FXJ,"got=Math.min(want,b.v);","got=want;",'Kindled:'],
  ['Kindling 0.4%',FXJ,"{param:'kd.k',add:R(0.003)}","{param:'kd.k',add:R(0.004)}",'Kindled:'],
  ['Kindled on skill hits',FXJ,"if(P['kd.k']&&c.auto&&kindled(A,u,s))","if(P['kd.k']&&kindled(A,u,s))",'Kindled:'],
  ['Sunlit Ranks 2%',FXJ,"{param:'kd.dmg',add:R(0.01)}","{param:'kd.dmg',add:R(0.02)}",'Kindled:'],
  ['Kindling Heat 3%',FXJ,"{param:'kd.hr',add:R(0.02)}","{param:'kd.hr',add:R(0.03)}",'Kindled:'],
  // ---- Quickening ----
  ['Bright Haste 0.4 s',FXJ,"fm_4_1:[ {on:'kit',skill:QK,opt:{dur:{add:R(0.3)}}} ],","fm_4_1:[ {on:'kit',skill:QK,opt:{dur:{add:R(0.4)}}} ],",'Quickening:'],
  ['Slow Dawn 9 points',FXJ,"opt:{dur:{add:3},mul:{add:-0.1}}","opt:{dur:{add:3},mul:{add:-0.09}}",'Quickening:'],
  ['Racing Dawn 2 s shorter',FXJ,"opt:{dur:{add:-1},mul:{add:0.1}}","opt:{dur:{add:-2},mul:{add:0.1}}",'Quickening:'],
  ['Long Morning 3%',FXJ,"{param:'dr.lm',add:R(0.02)}","{param:'dr.lm',add:R(0.03)}",'Quickening:'],
  ['Lightfoot 4 s',FXJ,"A.acts(T,u,[{window:'lf',dur:3}],c);","A.acts(T,u,[{window:'lf',dur:4}],c);",'Quickening:'],
  ['Bright Footing 2%',FXJ,"{param:'dr.bf',add:R(0.01)}","{param:'dr.bf',add:R(0.02)}",'Quickening:'],
  ['Whispered Haste 2%',FXJ,"qh_10_3:[ {stat:{cdRate:R(0.01)}","qh_10_3:[ {stat:{cdRate:R(0.02)}",'Quickening:'],
  ['Daybreak Dash 5%',FXJ,"fl_6_4:[ {stat:{move:R(0.04)}","fl_6_4:[ {stat:{move:R(0.05)}",'Quickening:'],
  ['Morning Rush 0.3 s',FXJ,"fl_5_3:[ {on:'cd',skill:'blue',add:R(-0.2)} ],","fl_5_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],",'Quickening:'],
  // ---- Sunrise ----
  ['Sunrise at 21 s',FXJ,"o.sunAt=E.now()+Math.max(0,20+(P['sun.at']||0));","o.sunAt=E.now()+Math.max(0,21+(P['sun.at']||0));",'Sunrise:'],
  ['Early Sunrise 1 s',FXJ,"{param:'sun.at',add:R(-1.5)}","{param:'sun.at',add:R(-1)}",'Sunrise:'],
  ['Long Day 1.5',FXJ,"{param:'sun.k2',add:R(0.01)}","{param:'sun.k2',add:R(0.015)}",'Sunrise:'],
  ['Daybreak Energy 6',FXJ,"{param:'sun.nrg',add:R(5)}","{param:'sun.nrg',add:R(6)}",'Sunrise:'],
  ['Midmorning at any time',FXJ,"fl_8_3:[ {on:'cd',skill:'green',if:{window:'sun'},less:R(0.01)}","fl_8_3:[ {on:'cd',skill:'green',less:R(0.011)}",'Sunrise:'],
  ['Sunrise: not doubled',FXJ,"return A.winOn(T,'sd2')?2*k:k; },","return k; },",'Sun Clears'],
  ['Sun Clears: 4 Sunblind',FXJ,"if(P['sun.sig']) T.fn.sbAdd(A,T,u,t,0,5);","if(P['sun.sig']) T.fn.sbAdd(A,T,u,t,0,4);",'Sun Clears'],
  ['Sun Clears: Kindled 9 s',FXJ,"A.setMark(T,u,x,'kd',{dur:8,longest:true}); }","A.setMark(T,u,x,'kd',{dur:9,longest:true}); }",'Sun Clears'],
  ['Dawn Burst at full strength',FXJ,"A.buffOn(x,'haste',(q.mul-1)/2,d);","A.buffOn(x,'haste',(q.mul-1),d);",'Sun Clears'],
  ['Second Morning 0.5 s',FXJ,"{param:'db.dur',add:R(0.4)}","{param:'db.dur',add:R(0.5)}",'Sun Clears'],
  // ---- the rest ----
  ['Daybright 5%',FXJ,"0.04*rk(T,'fl_2_1')*(u.apow||0)","0.05*rk(T,'fl_2_1')*(u.apow||0)",'Daybright'],
  ['Bright Eyes 4%',FXJ,"{param:'rng',add:R(0.03)}","{param:'rng',add:R(0.04)}",'Daybright'],
  ['Thin Frost 2%',FXJ,"{param:'dr.tf',add:R(0.01)}","{param:'dr.tf',add:R(0.02)}",'Daybright'],
  ['Morning Guard 2%',FXJ,"{param:'dr.mg',add:R(0.01)}","{param:'dr.mg',add:R(0.02)}",'Daybright'],
  ['the allies\' group at 30%',FXJ,"const TCAP=0.75, MCAP=0.60,","const TCAP=0.70, MCAP=0.60,",'two capped groups'],
  ['her group at 45%',FXJ,"const TCAP=0.75, MCAP=0.60,","const TCAP=0.75, MCAP=0.55,",'two capped groups'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); if(!r) return true; const top=r.split(path.sep)[0]; return !SKIP.has(top)&&!/^\.(ctl|test|remote)-/.test(top); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-luc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,to));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-lumi.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
const only=(process.argv[2]||process.env.LUMI_CTL)?new RegExp(process.argv[2]||process.env.LUMI_CTL):null, out=[];
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
