'use strict';
/* The controls for Meridian's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script, together with
   tests/talents-mech-meridian.test.js). Each control copies this checkout to a temp folder under os.tmpdir(), breaks ONE thing there (an exact text swap in
   emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a guard made unguarded with a seeded draw, a primitive or a row of his
   broken), runs the named tests of tests/talents-mech-meridian.test.js in that copy, and expects them to FAIL. ONE copy at a time; each copy is deleted when
   its run is done (node_modules and assets are symlinked, .logs never copied). The checkout itself is never changed.
   Prints one line per control and a count; exits 1 if any control was not caught.  Run: node tests/meridian-controls.js [name filter] */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js', DRAW='brnd();';
const FW="if(src&&src._tal&&src._tal.on.foiled) TalentFx.foiled(src,tgt,'wall');", FM="if(src&&src._tal&&src._tal.on.foiled) TalentFx.foiled(src,tgt,'miss');";
const FB2="amt*=0.5; floatTexts.push({x:tgt.x,y:tgt.y-8,txt:'BLOCK',t:.5,color:'#8fb7ff',vy:1.1,sz:11}); if(src&&src._tal&&src._tal.on.foiled) TalentFx.foiled(src,tgt,'block');";
const C=[
  // ---- the page lines: removed (his tests fail) ----
  ['foiled removed at Evasion',HTML,FM,'','Windage'],
  ['foiled removed at Block',HTML,FB2,"amt*=0.5; floatTexts.push({x:tgt.x,y:tgt.y-8,txt:'BLOCK',t:.5,color:'#8fb7ff',vy:1.1,sz:11});",'Windage'],
  ['momCap missing',HTML,"TalentFx.bindMore({ momCap:u=>","TalentFx.bindMore({ momCapX:u=>",'Well-Read|Stride'],
  // ---- an unguarded seeded draw at each new site (the no-talent identity test fails) ----
  ['draw at the shield wall',HTML,FW,DRAW+FW,'no talents'],
  ['draw at Evasion',HTML,FM,DRAW+FM,'no talents'],
  ['draw at the Block',HTML,FB2,FB2.replace("if(src&&",DRAW+"if(src&&"),'no talents'],
  // ---- the engine piece ----
  ['foiled runs no rows',FXJ,"if(T.on.foiled) run(T,s,'foiled',{u:s,src:s,tgt:t,unit:t,why}); }","}",'Windage'],
  // ---- his rows, caps and bookkeeping ----
  ['Sightline 4%',FXJ,"ls_1_1:[ {on:'out',if:{casting:PL,targetTeam:'enemy'},more:R(0.03)","ls_1_1:[ {on:'out',if:{casting:PL,targetTeam:'enemy'},more:R(0.04)",'Sightline'],
  ['Sightline max 6',FXJ,"mdSight:{max:5},","mdSight:{max:6},",'Sightline'],
  ['Sightline not broken',FXJ,"if(near){ A.stSet(T,u,'mdSight',0); o.sAcc=0; }","if(false){ }",'Sightline'],
  ['Sightline 3.5 m',FXJ,"A.gap(u,x)<4*E.METER()){ near=true;","A.gap(u,x)<3.5*E.METER()){ near=true;",'Sightline'],
  ['Held Breath no pause',FXJ,"else if(!(P['sight.held']&&now-(o.hurtAt==null?-9:o.hurtAt)<1)){","else if(true){",'Sightline'],
  ['Patient Sighting 20%',FXJ,"ls_2_1:[ {param:'sight.rate',add:R(0.15)} ],","ls_2_1:[ {param:'sight.rate',add:R(0.20)} ],",'Sightline'],
  ['Long Sightline floor gone',FXJ,"const at=o[slot+'At'], lo=at==null?0:Math.max(0,FLOOR[slot]-(A.eng().now()-at));","const at=o[slot+'At'], lo=0;",'Sightline|cooldowns'],
  ['Breathless at 4',FXJ,"T.s.cur===PL&&(o.spent||0)>=5){ c.force=true;","T.s.cur===PL&&(o.spent||0)>=4){ c.force=true;",'Breathless'],
  ['crit cap 6%',FXJ,"critS(A,T){ const P=T.P; return Math.min(0.05,","critS(A,T){ const P=T.P; return Math.min(0.06,",'Breathless|caps|Stride'],
  ['Survey Complete any kill',FXJ,"ls_12_2:[ {on:'kill',if:{casting:PL},","ls_12_2:[ {on:'kill',",'Survey Complete'],
  ['Triangulate 5%',FXJ,"{on:'out',if:{targetHas:'mdTri'},more:R(0.04)} ],","{on:'out',if:{targetHas:'mdTri'},more:R(0.05)} ],",'Triangulation:'],
  ['Triangulate 4.5 s window',FXJ,"A.setMark(T,u,t,'mdGq',{dur:(P.tfp&&o.qNew===t)?6:4});","A.setMark(T,u,t,'mdGq',{dur:(P.tfp&&o.qNew===t)?6:4.5});",'Triangulation:'],
  ['Triangulate one order only',FXJ,"if(P['tri.on']){ if(A.markOf(u,t,'mdGq')) T.fn.triOn(A,T,u,{tgt:t}); else A.setMark(T,u,t,'mdPl',{dur:4}); }","if(P['tri.on']){ if(A.markOf(u,t,'mdGq')) T.fn.triOn(A,T,u,{tgt:t}); }",'Triangulation:'],
  ['Three Points 0.6',FXJ,"ls_4_4:[ {param:'tri.dur',add:R(0.5)} ],","ls_4_4:[ {param:'tri.dur',add:R(0.6)} ],",'Triangulation:|Gilded'],
  ['Fixed Position 6%',FXJ,"ls_2_4:[ {stat:{move:R(-0.05)}","ls_2_4:[ {stat:{move:R(-0.06)}",'Triangulation:'],
  ['Fixed Star 3%',FXJ,"ls_5_4:[ {on:'out',if:{targetHas:'mdTri'},critMore:R(0.02)} ],","ls_5_4:[ {on:'out',if:{targetHas:'mdTri'},critMore:R(0.03)} ],",'Triangulation:'],
  ['Grid Reference 1%',FXJ,"ls_9_4:[ {stat:{atk:R(0.008)},per:'mdGrid'} ],","ls_9_4:[ {stat:{atk:R(0.01)},per:'mdGrid'} ],",'Triangulation:'],
  ['Two Fixed Points link always 6 s',FXJ,"{dur:(P.tfp&&o.qNew===t)?6:4}","{dur:P.tfp?6:4}",'Two Fixed Points'],
  ['Two Fixed Points every Plumb Line',FXJ,"if(rk(T,'gi_n1')&&A.markOf(u,t,'mdCh')) A.setMark(T,u,t,'mdPl1',{});","",'Two Fixed Points'],
  ['Gilded Line any target',FXJ,"ls_9_3:[ {on:'hit',if:{casting:GQ,targetTeam:'enemy',fn:'isFar'},","ls_9_3:[ {on:'hit',if:{casting:GQ,targetTeam:'enemy'},",'Gilded'],
  ['Final Bearing 4 s',FXJ,"do:[{fn:'triOn',dur:3}]} ],","do:[{fn:'triOn',dur:4}]} ],",'Gilded'],
  ['Bearing Kept 1.5 s a rank',FXJ,"ls_6_4:[ {on:'death',if:{unitHas:'mdTri'},do:[{mark:'mdTri',on:{team:'enemy',of:'unit',n:1},dur:R(1),","ls_6_4:[ {on:'death',if:{unitHas:'mdTri'},do:[{mark:'mdTri',on:{team:'enemy',of:'unit',n:1},dur:R(1.5),",'Gilded'],
  ['Plotted Course 2%',FXJ,"ls_8_4:[ {on:'teamIn',if:{targetHas:'mdTri',srcTeam:'ally'},more:R(0.01)} ],","ls_8_4:[ {on:'teamIn',if:{targetHas:'mdTri',srcTeam:'ally'},more:R(0.02)} ],",'Triangulated enemies'],
  ['Last Point below 35%',FXJ,"if:{targetHas:'mdTri',targetHpBelow:0.30},more:R(0.04)}","if:{targetHas:'mdTri',targetHpBelow:0.35},more:R(0.04)}",'Triangulated enemies'],
  ['Wide Margin 7%',FXJ,"opt:{width:{more:R(0.06)}}","opt:{width:{more:R(0.07)}}",'Golden Quill:'],
  ['Unbroken Line 3 s',FXJ,"[{window:'mdUl',dur:4,n:o.qN}]","[{window:'mdUl',dur:3,n:o.qN}]",'Golden Quill:'],
  ['Quill and Line each enemy',FXJ,"if(!o.qHit){ o.qHit=true; if(P['ql.ref'])","if(true){ o.qHit=true; if(P['ql.ref'])",'Golden Quill:'],
  ['Quiet Hands 0.4',FXJ,"ls_8_3:[ {param:'cd.q',add:R(0.3)} ],","ls_8_3:[ {param:'cd.q',add:R(0.4)} ],",'cooldowns'],
  ['Nearest Threat 2 s',FXJ,"T.fn.cdOff(A,T,u,'green',1.5);","T.fn.cdOff(A,T,u,'green',2);",'cooldowns'],
  ['Close Call 4 s',FXJ,"[{window:'mdCc',dur:3}]","[{window:'mdCc',dur:4}]",'cooldowns'],
  ['Surveyor\'s Reach 0.4 m',FXJ,"ls_4_1:[ {param:'pl.reach',add:R(0.3)}","ls_4_1:[ {param:'pl.reach',add:R(0.4)}",'Plumb Line:'],
  ['Long Shot Habit 5 points',FXJ,"opt:{farBonus:{add:R(0.04)}}","opt:{farBonus:{add:R(0.05)}}",'Plumb Line:'],
  ['Plumb True up to 12',FXJ,"per:{stack:'mdStride',max:10}} ],","per:{stack:'mdStride',max:12}} ],",'Plumb Line:'],
  ['Farthest First ignored',FXJ,"ls_5_2:[ {on:'skillTgt',skill:PL,do:[{fn:'plFar'}]} ],","ls_5_2:[ ],",'Plumb Line:'],
  ['Nearest Threat no retarget',FXJ,"if(L[0]) c.tgt=L[0]; },","},",'Plumb Line:'],
  ['Far Point 90%',FXJ,"const k=i===0?0.8:0.6;","const k=i===0?0.9:0.6;",'Far Point'],
  ['Far Point no lock',FXJ,"o.fpT=now+15;","o.fpT=now;",'Far Point'],
  ['Far Point at 4',FXJ,"if(!(o.spent>=5)||!t||now<(o.fpT||0)) return;","if(!(o.spent>=4)||!t||now<(o.fpT||0)) return;",'Far Point'],
  ['Windage 15%',FXJ,"c.amt*=1+0.12*rk(T,'ls_n1');","c.amt*=1+0.15*rk(T,'ls_n1');",'Windage'],
  ['Windage skip kept',FXJ,"o.windSkip=null; if(sk&&sk.t===c.tgt&&sk.at===A.eng().now()) return;","if(sk&&sk.t===c.tgt) return;",'Windage'],
  ['Windage 6 s',FXJ,"o.wind={t:c.tgt,until:A.eng().now()+5};","o.wind={t:c.tgt,until:A.eng().now()+6};",'Windage'],
  ['Windage any enemy',FXJ,"if(!w||w.t!==c.tgt||A.eng().now()>=w.until) return;","if(!w||A.eng().now()>=w.until) return;",'Windage'],
  ['Gold Ink 2%',FXJ,"gi_1_1:[ {on:'out',if:{targetHas:'mdCh'},more:R(0.015)} ],","gi_1_1:[ {on:'out',if:{targetHas:'mdCh'},more:R(0.02)} ],",'Charted:'],
  ['Indelible 5%',FXJ,"gi_2_1:[ {on:'teamHeal',if:{unitHas:'mdCh'},less:R(0.04)} ],","gi_2_1:[ {on:'teamHeal',if:{unitHas:'mdCh'},less:R(0.05)} ],",'Charted:'],
  ['Noted Recovery no lock',FXJ,"if:{unitHas:'mdCh'},icd:4,do:[{energy:R(2)}]}","if:{unitHas:'mdCh'},do:[{energy:R(2)}]}",'Charted:'],
  ['Chart Room from him too',FXJ,"if:{targetHas:'mdCh',srcIs:'ally'},more:R(0.01)}","if:{targetHas:'mdCh',srcTeam:'ally'},more:R(0.01)}",'Charted:'],
  ['Map Legend up to 1',FXJ,"return Math.min(5,n); },","return Math.min(1,n); },",'Charted:'],
  ['Every Mark an X 35%',FXJ,"gi_7_1:[ {on:'hit',if:{casting:GQ,targetHas:'mdCh'},do:[{dmg:{pct:0.30,","gi_7_1:[ {on:'hit',if:{casting:GQ,targetHas:'mdCh'},do:[{dmg:{pct:0.35,",'Charted:'],
  ['Coastline ignored',FXJ,"if(P['ch.pl']&&!A.markOf(u,t,'mdCh')) A.setMark(T,u,t,'mdCh',{});","",'Charted:'],
  ['Discovery every wave',FXJ,"return (T.s.wave<=1)?(P.disc||0):","return true?(P.disc||0):",'Discovery and Field Notes'],
  ['Discovery twice',FXJ,"if(P.disc&&t&&!A.markOf(u,t,'mdDisc')&&(T.s.wave<=1||P['disc.late'])){ A.setMark(T,u,t,'mdDisc',{});","if(P.disc&&t&&!A.markOf(u,t,'mdDisc')&&(T.s.wave<=1||P['disc.late'])){",'Discovery and Field Notes'],
  ['Bound Notebook 3 a rank',FXJ,"gi_6_4:[ {param:'note.keep',add:R(2)} ],","gi_6_4:[ {param:'note.keep',add:R(3)} ],",'Discovery and Field Notes'],
  ['Nothing Unknown 10%',FXJ,"gi_7_4:[ {param:'disc.late',add:R(0.08)} ],","gi_7_4:[ {param:'disc.late',add:R(0.10)} ],",'Discovery and Field Notes'],
  ['Margins Full at 9',FXJ,"if:{stackMin:{mdNote:10}},critMore:R(0.03)}","if:{stackMin:{mdNote:9}},critMore:R(0.03)}",'Discovery and Field Notes'],
  ['Field Journal 2 a rank',FXJ,"gi_11_4:[ {param:'note.max',add:R(1)} ],","gi_11_4:[ {param:'note.max',add:R(2)} ],",'Discovery and Field Notes'],
  ['Cross-Reference past the cap',FXJ,"if(P['crit.xr']&&T.fn.disc(A,T,u,c)) p+=P['crit.xr'];\n      p=Math.min(p,Math.max(0,0.05-T.fn.critS(A,T)));","if(P['crit.xr']&&T.fn.disc(A,T,u,c)) p+=P['crit.xr'];\n      p=Math.min(p,1);",'Cross-Reference'],
  ['Long Expedition 5%',FXJ,"opt:{bleedPct:{more:R(0.04)}}","opt:{bleedPct:{more:R(0.05)}}",'Final Expedition: Long'],
  ['Long Bleed 0.5 s',FXJ,"gi_4_2:[ {param:'fe.dur',add:R(0.4)} ],","gi_4_2:[ {param:'fe.dur',add:R(0.5)} ],",'Final Expedition: Long'],
  ['Set Ink on everyone',FXJ,"const add=(P['fe.dur']||0)+((P['fe.set']&&charted(A,u,x))?P['fe.set']:0); if(add>0) x.mortalT","const add=(P['fe.dur']||0)+((P['fe.set'])?P['fe.set']:0); if(add>0) x.mortalT",'Final Expedition: Long'],
  ['Settled Ink 3%',FXJ,"gi_6_2:[ {param:'dr.si',add:R(0.02)}","gi_6_2:[ {param:'dr.si',add:R(0.03)}",'Final Expedition: Long'],
  ['Running Ink full drain',FXJ,"h=(c.hpLost||0)*pct*0.5*(1+","h=(c.hpLost||0)*pct*1.0*(1+",'Running Ink'],
  ['Thirst 2 s',FXJ,"if((u._lifestealT||0)>0) u._lifestealT+=1; },","if((u._lifestealT||0)>0) u._lifestealT+=2; },",'Running Ink'],
  ['Night Copy 6',FXJ,"u.energy=Math.min(100,(u.energy||0)+5*Math.min(5,n)); },","u.energy=Math.min(100,(u.energy||0)+6*Math.min(5,n)); },",'Running Ink'],
  ['Red Margins 2%',FXJ,"gi_10_2:[ {on:'dotTick',if:{tag:'fs'},do:[{heal:{pct:R(0.01),of:'hit'}}]} ],","gi_10_2:[ {on:'dotTick',if:{tag:'fs'},do:[{heal:{pct:R(0.02),of:'hit'}}]} ],",'Running Ink'],
  ['Ink no lock',FXJ,"if(ink) o.inkT=now+25;","",'Stays Charted'],
  ['Ink heals pass',FXJ,"{on:'teamHeal',if:{unitHas:'mdInk'},mul:0},","",'Stays Charted'],
  ['Ink shield untouched',FXJ,"if((x.shield||0)>0) x.shield*=0.5;","",'Stays Charted'],
  ['Ink notes 1',FXJ,"{on:'death',if:{unitHas:'mdInk'},do:[{stack:'mdNote',add:2}]} ],","{on:'death',if:{unitHas:'mdInk'},do:[{stack:'mdNote',add:1}]} ],",'Stays Charted'],
  ['Ink bleed normal speed',FXJ,"{on:'tick',do:[{dotRate:1,on:{team:'enemy',has:'mdInk'}}]},","",'Stays Charted'],
  ['Warm Up 5%',FXJ,"ty_2_1:[ {param:'ramp',add:R(0.04)} ],","ty_2_1:[ {param:'ramp',add:R(0.05)} ],",'Well-Read'],
  ['Ever Faster 20 points',FXJ,"return full(A,u)?0.15/(1+cap(A,u)):0; },","return full(A,u)?0.20/(1+cap(A,u)):0; },",'Well-Read'],
  ['Quiet Study always',FXJ,"if(P['dr.qs']&&full(A,u)) k*=1-P['dr.qs'];","if(P['dr.qs']) k*=1-P['dr.qs'];",'Well-Read'],
  ['Stride before the full ramp',FXJ,"if(P['stride.on']&&c.auto&&full(A,u))","if(P['stride.on']&&c.auto)",'Stride:'],
  ['Into Stride 0.4%',FXJ,"ty_1_1:[ {param:'stride.on',add:1}, {stat:{atk:R(0.003)},per:'mdStride'} ],","ty_1_1:[ {param:'stride.on',add:1}, {stat:{atk:R(0.004)},per:'mdStride'} ],",'Stride:'],
  ['Long March 3 a rank',FXJ,"ty_4_1:[ {param:'stride.keep',add:R(2)} ],","ty_4_1:[ {param:'stride.keep',add:R(3)} ],",'Stride:'],
  ['Blur of the Hand every second',FXJ,"stackMin:{mdStride:10}},every:3,","stackMin:{mdStride:10}},every:2,",'Stride:'],
  ['Expedition Pace per Stride',FXJ,"per:{stack:'mdStride',div:2}}}} ],","per:{stack:'mdStride'}}}} ],",'Stride:'],
  ['Provisions 1 a wave',FXJ,"mdProv:{max:P('prov.max',2)},","mdProv:{max:P('prov.max',1)},",'Provisions:'],
  ['Provisions eaten twice below',FXJ,"if(u.hp>=0.5*u.maxHp) o.ate=false; else if(!o.ate&&","if(u.hp>=0.5*u.maxHp) o.ate=false; else if(", 'Provisions:'],
  ['Hard Tack 12%',FXJ,"ty_2_3:[ {param:'prov.more',add:R(0.10)} ],","ty_2_3:[ {param:'prov.more',add:R(0.12)} ],",'Provisions:'],
  ['Well Provisioned 1.2%',FXJ,"ty_11_3:[ {param:'prov.ally',add:R(0.01)} ],","ty_11_3:[ {param:'prov.ally',add:R(0.012)} ],",'Provisions:'],
  ['Last Biscuit every time',FXJ,"ty_9_3:[ {on:'lethal',once:'fight',","ty_9_3:[ {on:'lethal',",'Provisions:'],
  ['Charted Rest no ramp',FXJ,"if(u.pass&&u.pass.momentum) u._momStk=Math.max(u._momStk||0,cap(A,u)); } },","} },",'Provisions:'],
  ['Sit It Out 35%',FXJ,"{param:'dr.sit',add:0.30} ],","{param:'dr.sit',add:0.35} ],",'Sit It Out'],
  ['Camp Discipline 0.6',FXJ,"ty_6_2:[ {param:'sit.dur',add:R(0.5)} ],","ty_6_2:[ {param:'sit.dur',add:R(0.6)} ],",'Sit It Out'],
  ['Push On heals',FXJ,"if(!P.push){ const h=","if(true){ const h=",'Sit It Out'],
  ['Forced March 4%',FXJ,"ty_6_3:[ {param:'po.as',add:R(0.03)} ],","ty_6_3:[ {param:'po.as',add:R(0.04)} ],",'Sit It Out'],
  ['blur twice a wave',FXJ,"if(!T.P.blur||o.blurW===T.s.wave) return;","if(!T.P.blur) return;",'Unhurried Hand'],
  ['blur 9 s',FXJ,"[{window:'mdBlur',dur:8}]","[{window:'mdBlur',dur:9}]",'Unhurried Hand'],
  ['blur eats',FXJ,"else if(!o.ate&&!A.winOn(T,'mdBlur')&&","else if(!o.ate&&",'Unhurried Hand'],
  ['blur quills four',FXJ,"for(const x of A.pick(T,u,{team:'enemy',n:3},c)) if(x!==c.tgt)","for(const x of A.pick(T,u,{team:'enemy',n:4},c)) if(x!==c.tgt)",'Unhurried Hand'],
  ['blur extension three times',FXJ,"if((o.blurX||0)>=2||","if((o.blurX||0)>=3||",'Unhurried Hand'],
  ['blur Quill normal speed',FXJ,"if(rk(T,'ty_13_1')&&A.winOn(T,'mdBlur')&&!(u.stunned>0)&&(u.greenCd||0)>0) T.fn.cdOff(A,T,u,'green',dt); },","},",'Unhurried Hand'],
  ['Steady Old Hand up to 1',FXJ,"return Math.max(0,Math.min(4,(T.s.wave||1)-1)); },","return Math.max(0,Math.min(1,(T.s.wave||1)-1)); },",'Steady Old Hand'],
  ['Seasoned at 20 s',FXJ,"late(A,T){ return A.eng().now()>=30; },","late(A,T){ return A.eng().now()>=20; },",'Steady Old Hand'],
  ['Far Horizon at 5 m',FXJ,"far6(A,T,u,c){ return gapM(A,u,c.tgt)>=6; },","far6(A,T,u,c){ return gapM(A,u,c.tgt)>=0.5; },",'Steady Old Hand'],
  ['Thin Air at 6 m',FXJ,"far8(A,T,u,c){ return gapM(A,u,c.tgt)>=8; },","far8(A,T,u,c){ return gapM(A,u,c.tgt)>=6; },",'Steady Old Hand'],
  ['DR cap 45%',FXJ,"return Math.max(0.60,k); },","return Math.max(0.55,k); },",'caps'],
  ['tenacity cap 25%',FXJ,"const x=Math.min(0.20,","const x=Math.min(0.25,",'caps'],
  ['Unhurried Calm without Provisions',FXJ,"((P['ten.uc']&&A.stGet(T,'mdProv')>0)?P['ten.uc']:0)","((P['ten.uc'])?P['ten.uc']:0)",'caps'],
  ['regen cap 1.5%',FXJ,"E.healUnit(u,Math.min(0.012,r)*u.maxHp);","E.healUnit(u,Math.min(0.015,r)*u.maxHp);",'caps'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs','.tmp']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||(!SKIP.has(r.split(path.sep)[0])&&!/^\.ctl-|^\.remote-|^\.test-/.test(r.split(path.sep)[0])); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-mdc-'));
  try{ copyTo(dir); const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), a=from.replace(/\r\n/g,'\n').replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), b=to.replace(/\r\n/g,'\n').replace(/\n/g,s.indexOf('\r\n')>=0?'\r\n':'\n'), n=s.split(a).length-1;
    if(n!==1) return {name,ok:false,why:'the text to break was found '+n+' times'};
    fs.writeFileSync(p,s.replace(a,()=>b));
    const r=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-meridian.test.js'],{cwd:dir,env:process.env,encoding:'utf8',maxBuffer:1<<26});
    const out=(r.stdout||'')+(r.stderr||''), m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out), f=m?+m[1]:-1;
    return {name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}; }
  finally{ fs.rmSync(dir,{recursive:true,force:true}); } }
const only=process.argv[2]?new RegExp(process.argv[2]):null, out=[];
for(const c of C){ if(only&&!only.test(c[0])) continue; const r=runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }
const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0);
