'use strict';
/* The controls for Vesper's talent tests (run on the cluster test host through tools/remote_test.sh as a plain node script). Each control copies this checkout to a
   temp folder, breaks ONE thing there (an exact text swap in emberweave-heroes.html or in the generated talents-fx.js: a page hook removed, a row or a number of
   hers broken), runs the named tests of tests/talents-mech-vesper.test.js in that copy, and expects them to FAIL. The checkout itself is never changed. Prints one
   line per control and a count; exits 1 if any control was not caught. J=1 by default: one copy at a time, each deleted as soon as it has run (the wiring brief's
   rule). Every `to` below was verified by a probe: the amplified break makes the targeted test fail. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const HTML='emberweave-heroes.html', FXJ='talents-fx.js';
const C=[
  // ---- the page: the field lands on her target (her kit test reads the field's spot) ----
  ['the field is laid on her target',HTML,"case 'erratafield':{ const px=(tgt&&tgt.alive)?tgt.x:u.x, py=(tgt&&tgt.alive)?tgt.y:u.y;","case 'erratafield':{ const px=u.x, py=u.y;",'her real kit'],
  ['Loose Leaf 110%',HTML,"hit.forEach(e=>dealDamage(u,e,dB*(o.mul||1.1)*rm,'#c9a227'));","hit.forEach(e=>dealDamage(u,e,dB*(o.mul||1.1)*0*rm,'#c9a227'));",'her real kit'],
  ['the back pass 70%',HTML,"u._pageBack={list:hit,t:(o.back||0.45)*BATTLE_PACE,mul:dB*(o.backMul||0.7)*rm};","u._pageBack={list:hit,t:(o.back||0.45)*BATTLE_PACE,mul:dB*(o.backMul||0.7)*0*rm};",'her real kit'],
  // ---- the page hooks her talents hang on ----
  ["a Correction cancels by the game's own cancel",HTML,"castCancel:(u,why)=>castCancel(u,why),","castCancel:()=>{},","/ Marginalia"],
  ["the return pass is the skill's (vpBack)",HTML,"if(u._tal) TalentFx.part(u,pb,'vpBack');","if(false&&u._tal) TalentFx.part(u,pb,'vpBack');","/ Marginalia"],
  // ---- Notes and Corrected ----
  ['Notes lapse 8 s',FXJ,"vpN:{unit:true,max:3,dur:P('nt.dur',8)}","vpN:{unit:true,max:3,dur:P('nt.dur',6)}","/ Marginalia"],
  ['3 Notes Correct',FXJ,"if(v>=3&&(force||!(r.lock>0))) T.fn.correct(A,T,u,t,r);","if(v>=4&&(force||!(r.lock>0))) T.fn.correct(A,T,u,t,r);","/ Marginalia"],
  ['a Correction locked 15 s',FXJ,"r.lock=15; r.corr=1; o.corrN=(o.corrN||0)+1;","r.lock=20; r.corr=1; o.corrN=(o.corrN||0)+1;","/ Marginalia"],
  ['Footnotes +1 s a rank',FXJ,"rp_4_3:[ {param:'nt.dur',add:R(1)} ],","rp_4_3:[ {param:'nt.dur',add:R(2)} ],","/ Marginalia"],
  ['Marginalia 1% a Note',FXJ,"if(P['nt.k']){ const n=A.ustGet(T,u,s,'vpN'); if(n>0) k*=1-P['nt.k']*n; }","if(P['nt.k']){ const n=A.ustGet(T,u,s,'vpN'); if(n>0) k*=1-P['nt.k']*0; }","/ Marginalia"],
  ['a Note for the enemy both passes cut',FXJ,"if(R0.out.has(e)){ if(!P['ri.on']) T.fn.addNote(A,T,u,e,1); if(cx) A.setMark(T,u,e,'vpX',{dur:4,longest:true}); if(P['ink.tp']) T.fn.addInk(A,T,u,P['ink.tp']); }","if(R0.out.has(e)){ if(!P['ri.on']) T.fn.addNote(A,T,u,e,2); if(cx) A.setMark(T,u,e,'vpX',{dur:4,longest:true}); if(P['ink.tp']) T.fn.addInk(A,T,u,P['ink.tp']); }","/ Marginalia"],
  ['Red Ink a Note on the out pass',FXJ,"if(cur==='pagestorm'){ R0.out.add(t); if(T.P['ri.on']) T.fn.addNote(A,T,u,t,1); }","if(cur==='pagestorm'){ R0.out.add(t); }","/ Red Ink"],
  ['Black Ink 3 m',FXJ,"if(P['bi.on']){ const E=A.eng(), M=E.METER(); for(const x of foes(A,u)) if(x!==t&&A.gap(t,x)<3*M) T.fn.addNote(A,T,u,x,1); }","if(P['bi.on']){ const E=A.eng(), M=E.METER(); for(const x of foes(A,u)) if(x!==t&&A.gap(t,x)<1*M) T.fn.addNote(A,T,u,x,1); }","/ Red Ink"],
  // ---- Errata Slip, Marked for Reprint, Proof Copy ----
  ['Errata Slip 0.7 s',FXJ,"if(P['cr.sil']) T.fn.silence(A,T,u,t,1);","if(P['cr.sil']) T.fn.silence(A,T,u,t,2);","/ Errata Slip"],
  ['Marked for Reprint 6%',FXJ,"if(T.r.rp_n1&&A.markOf(u,t,'vpMR')) k*=1.06;","if(T.r.rp_n1&&A.markOf(u,t,'vpMR')) k*=1.05;","/ Errata Slip"],
  ['the link arms on a Correction',FXJ,"if(P['cr.mr']){ A.setMark(T,u,t,'vpMR',{dur:3});","if(false&&P['cr.mr']){ A.setMark(T,u,t,'vpMR',{dur:3});","/ Errata Slip"],
  ['Proof Copy 2% a rank',FXJ,"if(P['cr.pc']&&A.markOf(u,s,'vpPC')) k*=1-P['cr.pc'];","if(P['cr.pc']&&A.markOf(u,s,'vpPC')) k*=1-P['cr.pc']*0.5;","/ Errata Slip"],
  // ---- Struck Out ----
  ['Struck Out 0.3 s a rank',FXJ,"add=P['so.k']||0;","add=(P['so.k']||0)*0.5;","/ Struck Out"],
  ['once a field per enemy',FXJ,"for(const e of foes(A,u)) if(Math.hypot(e.x-h.x,e.y-h.y)<=h.r&&(e.silencedT||0)>0&&!h._vpF.sil.has(e)){ h._vpF.sil.add(e); T.fn.struckOut(A,T,u,e); }","for(const e of foes(A,u)) if(Math.hypot(e.x-h.x,e.y-h.y)<=h.r&&(e.silencedT||0)>0){ T.fn.struckOut(A,T,u,e); }","/ Struck Out"],
  ['Lost Lines 1 energy a rank',FXJ,"if(P['so.nrg']) u.energy=Math.min(100,(u.energy||0)+P['so.nrg']);","if(P['so.nrg']) u.energy=Math.min(100,(u.energy||0));","/ Struck Out"],
  ['Errant Hand 1.5%',FXJ,"if(P['so.eh']&&A.markOf(u,s,'vpEH')) k*=1-P['so.eh'];","if(P['so.eh']&&A.markOf(u,s,'vpEH')) k*=1-P['so.eh']*0.5;","/ Struck Out"],
  // ---- Final Draft, Cross Reference ----
  ['Cross Reference from Puncture',FXJ,"if(P['so.pun']||(any(T,SO)&&T.r.rp_11_1)) T.fn.struckOut(A,T,u,t);","if(false&&(P['so.pun']||(any(T,SO)&&T.r.rp_11_1))) T.fn.struckOut(A,T,u,t);","/ Final Draft"],
  // ---- Errata's own rows ----
  ['Narrow Margin 0.3 s',FXJ,"rp_2_1:[ {on:'cd',skill:'green',add:R(-0.3)} ],","rp_2_1:[ {on:'cd',skill:'green',add:R(-0.2)} ],","/ Errata'"],
  ['Broad Margin 0.2 m',FXJ,"rp_4_1:[ {on:'kit',skill:'erratafield',opt:{radius:{addM:R(0.2)}}} ],","rp_4_1:[ {on:'kit',skill:'erratafield',opt:{radius:{addM:R(0.1)}}} ],","/ Errata'"],
  ['Long Errata 0.2 s a rank',FXJ,"rp_6_4:[ {on:'kit',skill:'erratafield',opt:{dur:{add:R(0.2)}}} ],","rp_6_4:[ {on:'kit',skill:'erratafield',opt:{dur:{add:R(0.1)}}} ],","/ Errata'"],
  ['Caustic Ink 5%',FXJ,"rp_8_4:[ {on:'kit',skill:'erratafield',opt:{dps:{more:R(0.05)}}} ],","rp_8_4:[ {on:'kit',skill:'erratafield',opt:{dps:{more:R(0.04)}}} ],","/ Errata'"],
  ['Quiet Room 3%',FXJ,"if(P['qr.k']&&(t.silencedT||0)>0) k*=1+P['qr.k'];","if(P['qr.k']&&(t.silencedT||0)>0) k*=1+P['qr.k']*0.5;","/ Errata'"],
  ['Strike Through 0.5 s raw',FXJ,"rp_3_4:[ {on:'kit',skill:'erratafield',opt:{silence:{add:R(0.1),ccRaw:true}}} ],","rp_3_4:[ {on:'kit',skill:'erratafield',opt:{silence:{add:R(0.2),ccRaw:true}}} ],","/ Errata'"],
  ["Redaction on the field's end",FXJ,"d=0.7*(1-Math.min(1,e.ctrlRes||0))","d=0.1*(1-Math.min(1,e.ctrlRes||0))","/ Errata'"],
  ['Safe Shelf 4%',FXJ,"if(P['dr.ss']&&T.fn.inField(A,T,u,true)) k*=1-P['dr.ss'];","if(P['dr.ss']&&T.fn.inField(A,T,u,true)) k*=1-P['dr.ss']*0.5;","/ Errata'"],
  ['Ink Stain 3%',FXJ,"if(P['amp.is']&&T.fn.inField(A,T,t,false)) k*=1+P['amp.is'];","if(P['amp.is']&&T.fn.inField(A,T,t,false)) k*=1+P['amp.is']*0.5;","/ Errata'"],
  ['her damage out hook',FXJ,"myOut(A,T,u,c){ const P=T.P, t=c.tgt, cur=T.s.cur; let k=T.fn.myK(A,T,u,t);","myOut(A,T,u,c){ const P=T.P, t=c.tgt, cur=T.s.cur; let k=T.fn.myK(A,T,u,t)*0.5;","/ Errata'"],
  // ---- Ink ----
  ['2 Ink an ability-hit enemy',FXJ,"T.fn.addInk(A,T,u,2+(P['ink.n']||0));","T.fn.addInk(A,T,u,1+(P['ink.n']||0));","/ Ink:"],
  ['the Ink cap 30',FXJ,"vpInk:{max:P('ink.max',30)}","vpInk:{max:P('ink.max',25)}","/ Ink:"],
  ['Overflowing Ink +5',FXJ,"sv_8_4:[ {param:'ink.max',add:R(5)}, {param:'pf.ov',add:R(0.02)} ],","sv_8_4:[ {param:'ink.max',add:R(4)}, {param:'pf.ov',add:R(0.02)} ],","/ Ink:"],
  ['Brimming Well +1',FXJ,"sv_2_4:[ {param:'ink.n',add:R(1)} ],","sv_2_4:[ {param:'ink.n',add:R(2)} ],","/ Ink:"],
  // ---- the Proof ----
  ['the Proof 12% a rank',FXJ,"sv_1_4:[ {param:'pf.k',add:R(0.12)} ],","sv_1_4:[ {param:'pf.k',add:R(0.10)} ],","/ the Proof"],
  ['the Proof at 30 Ink',FXJ,"if(c.auto&&T.r.sv_1_4&&A.stGet(T,'vpInk')>=30&&!o.pfOn) T.fn.proof(A,T,u,t);","if(c.auto&&T.r.sv_1_4&&A.stGet(T,'vpInk')>=35&&!o.pfOn) T.fn.proof(A,T,u,t);","/ the Proof"],
  ['Spilled Ink 3%',FXJ,"sv_5_4:[ {param:'pf.sp',add:R(0.03)} ],","sv_5_4:[ {param:'pf.sp',add:R(0.04)} ],","/ the Proof"],
  ['Blotted 0.5 s',FXJ,"sv_3_4:[ {param:'pf.sil',add:0.5} ],","sv_3_4:[ {param:'pf.sil',add:2.0} ],","/ the Proof"],
  ['Inkfall 2 energy',FXJ,"sv_6_4:[ {param:'pf.nrg',add:R(2)} ],","sv_6_4:[ {param:'pf.nrg',add:R(10)} ],","/ the Proof"],
  ['Wet Nib keeps 2',FXJ,"sv_n1:[  {param:'pf.keep',add:R(2)} ],","sv_n1:[  {param:'pf.keep',add:R(3)} ],","/ the Proof"],
  ["Printer's Mark half back",FXJ,"if(P['pf.pm']&&killed) T.fn.addInk(A,T,u,Math.floor(spent/2));","if(P['pf.pm']&&killed) T.fn.addInk(A,T,u,Math.floor(spent/3));","/ the Proof"],
  ['Halfway Down the Page 4',FXJ,"sv_n2:[  {param:'ink.hd',add:R(4)} ],","sv_n2:[  {param:'ink.hd',add:R(0)} ],","/ the Proof"],
  ['Turned Page 1',FXJ,"sv_9_2:[ {param:'ink.tp',add:R(1)} ],","sv_9_2:[ {param:'ink.tp',add:R(2)} ],","/ the Proof"],
  // ---- the Second Verse ----
  ['Chorus every 2nd',FXJ,"const every=P['ec.ch']?2:3, uv=","const every=P['ec.ch']?3:4, uv=","/ Second Verses"],
  ['the echo 10% a rank',FXJ,"sv_1_1:[ {param:'ec.k',add:R(0.10)} ],","sv_1_1:[ {param:'ec.k',add:R(-0.10)} ],","/ Twice Written"],
  ['Refrain 0.2 s sooner a rank',FXJ,"const d=Math.max(0.05,1-(P['ec.soon']||0));","const d=Math.max(0.05,2-(P['ec.soon']||0));","/ Twice Written"],
  ['Bold Type 4%',FXJ,"sv_8_3:[ {param:'ec.bt',add:R(0.04)} ],","sv_8_3:[ {param:'ec.bt',add:R(0.05)} ],","/ Second Verses"],
  ['Verse and Chorus the return too',FXJ,"sv_10_1:[ {param:'ec.vc',add:1} ],","sv_10_1:[ {param:'ec.vc',add:0} ],","/ Second Verses"],
  ['Margin Rush 1 energy',FXJ,"sv_11_3:[ {param:'ec.nrg',add:R(1)} ],","sv_11_3:[ {param:'ec.nrg',add:R(2)} ],","/ Second Verses"],
  // ---- Crossed ----
  ['Crossed 4 s',FXJ,"if(cx) A.setMark(T,u,e,'vpX',{dur:4,longest:true});","if(false&&cx) A.setMark(T,u,e,'vpX',{dur:4,longest:true});","/ Crossed Lines"],
  ['Crossed on both passes',FXJ,"if(!B.sec){ const cx=any(T,CROSS);","if(false){ const cx=any(T,CROSS);","/ Crossed Lines"],
  ['Cross Hatch 1.5%',FXJ,"if(P['amp.ch']&&A.markOf(u,t,'vpX')) k*=1+P['amp.ch'];","if(P['amp.ch']&&A.markOf(u,t,'vpX')) k*=1+P['amp.ch']*0.5;","/ Crossed Lines"],
  ['Rift Script 15%',FXJ,"sv_11_2:[ {param:'rs.k',add:R(0.15)} ],","sv_11_2:[ {param:'rs.k',add:R(0.60)} ],","/ Crossed Lines"],
  ['Torn Margin the Crossed on the return',FXJ,"if(T.P['tm.on']&&!pb._vp2) for(const e of foes(A,u)) if(A.markOf(u,e,'vpX')&&pb.list.indexOf(e)<0) pb.list.push(e);","if(false&&T.P['tm.on']&&!pb._vp2) for(const e of foes(A,u)) if(A.markOf(u,e,'vpX')&&pb.list.indexOf(e)<0) pb.list.push(e);","/ Crossed Lines"],
  // ---- Loose Leaf's rows ----
  ["Copyist's Eye 3%",FXJ,"rp_1_1:[ {param:'ll.k',add:R(0.03)} ],","rp_1_1:[ {param:'ll.k',add:R(0.06)} ],","/ Loose Leaf'"],
  ['Sharp Pages 2%',FXJ,"sv_1_3:[ {param:'ll.k',add:R(0.02)} ],","sv_1_3:[ {param:'ll.k',add:R(0.03)} ],","/ Loose Leaf'"],
  ['Paper Cut 4% the back',FXJ,"sv_3_3:[ {param:'ll.back',add:R(0.04)} ],","sv_3_3:[ {param:'ll.back',add:R(0.12)} ],","/ Loose Leaf'"],
  ['Side Notes 2% wider',FXJ,"rp_7_1:[ {on:'kit',skill:'pagestorm',opt:{width:{more:R(0.02)}}} ],","rp_7_1:[ {on:'kit',skill:'pagestorm',opt:{width:{more:R(0.03)}}} ],","/ Loose Leaf'"],
  ['Index 0.3 s',FXJ,"rp_6_1:[ {on:'cd',skill:'blue',add:R(-0.3)} ],","rp_6_1:[ {on:'cd',skill:'blue',add:R(-0.2)} ],","/ Loose Leaf'"],
  ['Inkpot 0.15 s',FXJ,"sc_8_3:[ {on:'cd',skill:'blue',add:R(-0.15)} ],","sc_8_3:[ {on:'cd',skill:'blue',add:R(-0.10)} ],","/ Loose Leaf'"],
  ['Margin Help 1 energy',FXJ,"sc_10_2:[ {param:'mh.k',add:R(1)} ],","sc_10_2:[ {param:'mh.k',add:R(2)} ],","/ Loose Leaf'"],
  ['Long Stanza the reach',FXJ,"sv_5_3:[ {on:'kit',skill:'pagestorm',opt:{width:{more:0.3},reach:{addM:3}}} ],","sv_5_3:[ {on:'kit',skill:'pagestorm',opt:{width:{more:0.3},reach:{addM:2}}} ],","/ Loose Leaf'"],
  ['Twice Torn the second return',FXJ,"if(P['tt.on']&&!u._pageBack&&o.pbT) u._pageBack={list:pb.list,t:o.pbT,mul:pb.mul*0.5,_vp2:1,_vpR:R0};","if(false&&P['tt.on']&&!u._pageBack&&o.pbT) u._pageBack={list:pb.list,t:o.pbT,mul:pb.mul*0.5,_vp2:1,_vpR:R0};","/ Loose Leaf'"],
  // ---- her ability rows ----
  ['Steady Nib 2%',FXJ,"rp_1_3:[ {param:'ab.nt',add:R(0.02)} ],","rp_1_3:[ {param:'ab.nt',add:R(0.10)} ],","/ Steady Nib"],
  ['Early Verse above 70%',FXJ,"if(P['ab.ev']&&f>0.70) k*=1+P['ab.ev'];","if(P['ab.ev']&&f>1.10) k*=1+P['ab.ev'];","/ Steady Nib"],
  ['Unfinished below 40%',FXJ,"if(P['ab.uf']&&f<0.40) k*=1+P['ab.uf'];","if(P['ab.uf']&&f<0.20) k*=1+P['ab.uf'];","/ Steady Nib"],
  // ---- the Deadline ----
  ['Press Date 4 a rank',FXJ,"sc_1_1:[ {param:'dl.k',add:R(4)} ],","sc_1_1:[ {param:'dl.k',add:R(12)} ],","/ Press Date"],
  ['the Deadline every 10 s',FXJ,"if(o.f.dl&&F.length){ if(o.dl==null) o.dl=Math.max(1,10-(P['dl.soon']||0)); o.dl-=dt; if(o.dl<=1e-9){ o.dl+=Math.max(1,10-(P['dl.soon']||0)); T.fn.deadline(A,T,u); } }","if(o.f.dl&&F.length){ if(o.dl==null) o.dl=Math.max(1,12-(P['dl.soon']||0)); o.dl-=dt; if(o.dl<=1e-9){ o.dl+=Math.max(1,12-(P['dl.soon']||0)); T.fn.deadline(A,T,u); } }","/ Press Date"],
  ['Early Deadline 0.5 s',FXJ,"sc_2_1:[ {param:'dl.soon',add:R(0.5)} ],","sc_2_1:[ {param:'dl.soon',add:R(0.4)} ],","/ Press Date"],
  ['Closing Hour at the wave',FXJ,"if(P['dl.ch']&&any(T,DL)){ o.dl=Math.max(1,10-(P['dl.soon']||0)); T.fn.deadline(A,T,u); }","if(false&&P['dl.ch']&&any(T,DL)){ o.dl=Math.max(1,10-(P['dl.soon']||0)); T.fn.deadline(A,T,u); }","/ Press Date"],
  ['Urgent Order the wounded first',FXJ,"if(P['dl.ro']){ for(const a of L){ const f=a.hp/Math.max(1,a.maxHp); if(f<P['dl.ro']&&(!b||f<b.hp/Math.max(1,b.maxHp))) b=a; } }","if(false&&P['dl.ro']){ for(const a of L){ const f=a.hp/Math.max(1,a.maxHp); if(f<P['dl.ro']&&(!b||f<b.hp/Math.max(1,b.maxHp))) b=a; } }","/ Deadline"],
  ['All Hands 1% a rank',FXJ,"sc_9_1:[ {stat:{apow:R(0.01)},to:{team:'ally',others:true,has:'vpAH'}} ],","sc_9_1:[ {stat:{apow:R(0.02)},to:{team:'ally',others:true,has:'vpAH'}} ],","/ Deadline"],
  ['Collected Works 2%',FXJ,"if(P['dl.cw']&&A.markOf(u,t,'vpCW')) k*=1-P['dl.cw'];","if(P['dl.cw']&&A.markOf(u,t,'vpCW')) k*=1-P['dl.cw']*0.5;","/ Deadline"],
  ['Late Lamp 1%',FXJ,"if(P['dl.ll']&&A.winOn(T,'vpLL')) k*=1+P['dl.ll'];","if(P['dl.ll']&&A.winOn(T,'vpLL')) k*=1+P['dl.ll']*0.5;","/ Deadline"],
  // ---- Proofread ----
  ['Proofread 5% a rank',FXJ,"if(Math.abs((x[f]||0)-c.amt)<1e-9) x[f]=c.amt*Math.max(0,1-P['pr.k']);","if(Math.abs((x[f]||0)-c.amt)<1e-9) x[f]=c.amt*Math.max(0,1-P['pr.k']*0.5);","/ Proofread"],
  ['Clear Copy on entry',FXJ,"if(P['pr.cc']&&inn&&!o.pin[a.uid]&&!(o.ccL[a.uid]>0)){ for(const f of ['stunned','fearT','silencedT','_sleepT','slow']) if((a[f]||0)>0){ a[f]=0; o.ccL[a.uid]=8; break; } }","if(false&&P['pr.cc']&&inn&&!o.pin[a.uid]&&!(o.ccL[a.uid]>0)){ for(const f of ['stunned','fearT','silencedT','_sleepT','slow']) if((a[f]||0)>0){ a[f]=0; o.ccL[a.uid]=8; break; } }","/ Proofread"],
  ['Desk Leather only the Proofread',FXJ,"sc_3_3:[ {stat:{armor:R(0.02)},to:{team:'ally',others:true,fn:'prU'}} ],","sc_3_3:[ {stat:{armor:R(0.02)},to:{team:'ally',others:true}} ],","/ Proofread"],
  ['Second Proof 2%',FXJ,"if(P['pr.dr']&&o.pr[t.uid]) k*=1-P['pr.dr'];","if(P['pr.dr']&&o.pr[t.uid]) k*=1-P['pr.dr']*0.5;","/ Proofread"],
  ['Study Hall 1%',FXJ,"sc_7_3:[ {param:'pr.sh',add:0.01} ],","sc_7_3:[ {param:'pr.sh',add:0} ],","/ Proofread"],
  // ---- Unrushed ----
  ['Unrushed 4% a rank',FXJ,"sc_3_2:[ {on:'ccIn',less:R(0.04)} ],","sc_3_2:[ {on:'ccIn',less:R(0.03)} ],","/ Unrushed"],
  // ---- Fair Copy ----
  ['Fair Copy 0.8 s a rank',FXJ,"sc_4_2:[ {param:'fc.dur',add:R(0.8)} ],","sc_4_2:[ {param:'fc.dur',add:R(0)} ],","/ True Copy"],
  ['three times as fast',FXJ,"if(fc&&x!==o.fcBy) g+=2*rate*(1+(P['scr.bd']||0));","if(fc&&x!==o.fcBy) g+=rate*(1+(P['scr.bd']||0));","/ True Copy"],
  ['Shared Desk 1 s',FXJ,"if(P['fc.sd']) for(const a of mates(A,u)){ if(a.greenCd>0) a.greenCd=Math.max(0,a.greenCd-1); if(a.blueCd>0) a.blueCd=Math.max(0,a.blueCd-1); }","if(P['fc.sd']) for(const a of mates(A,u)){ if(a.greenCd>0) a.greenCd=Math.max(0,a.greenCd-2); if(a.blueCd>0) a.blueCd=Math.max(0,a.blueCd-2); }","/ True Copy"],
  ['Head Copyist 10',FXJ,"if(P['fc.hc']) u.energy=Math.min(100,(u.energy||0)+P['fc.hc']);","if(P['fc.hc']) u.energy=Math.min(100,(u.energy||0)+P['fc.hc']-5);","/ True Copy"],
  ['Illuminated 10%',FXJ,"if(P['fc.il']&&!c.auto&&A.winOn(T,'vpFC')) k*=1+P['fc.il'];","if(P['fc.il']&&!c.auto&&A.winOn(T,'vpFC')) k*=1+P['fc.il']*0.5;","/ True Copy"],
  ['Long Shift 1% a rank',FXJ,"sc_11_2:[ {stat:{apow:R(0.01)},per:{fn:'lsN'}} ],","sc_11_2:[ {stat:{apow:R(0.02)},per:{fn:'lsN'}} ],","/ True Copy"],
  ['Busy Desks 2%',FXJ,"sc_2_3:[ {param:'scr.bd',add:R(0.02)} ],","sc_2_3:[ {param:'scr.bd',add:R(0.20)} ],","/ True Copy"],
  ['Gilded Edge 0.2% a rank',FXJ,"sc_6_2:[ {stat:{aspd:R(0.002)},to:{team:'ally'},per:{fn:'ultN'},if:{selfPass:'scriptorium'}} ],","sc_6_2:[ {stat:{aspd:R(0.003)},to:{team:'ally'},per:{fn:'ultN'},if:{selfPass:'scriptorium'}} ],","/ True Copy"],
  // ---- Puncture's rows ----
  ['Eleven Errors 0.1 s a rank',FXJ,"rp_10_3:[ {param:'fz.ext',add:R(0.1)} ],","rp_10_3:[ {param:'fz.ext',add:R(0.2)} ],","/ Eleven Errors"],
  ['Margin of Error 0.1 s a rank',FXJ,"if(x>0) t.silencedT=Math.max(t.silencedT||0,Math.min((t.stunned||0)+CTRL_MAX,(c.amt||0)+x));","if(x>1) t.silencedT=Math.max(t.silencedT||0,Math.min((t.stunned||0)+CTRL_MAX,(c.amt||0)+x));","/ Eleven Errors"],
  ['Puncture Proof 1% a rank',FXJ,"sc_10_3:[ {param:'pp.k',add:R(0.01)} ],","sc_10_3:[ {param:'pp.k',add:R(0.02)} ],","/ Puncture Proof"],
  ['For the Record 5%',FXJ,"if(P['fr.k']&&A.markOf(u,s,'vpFR')) k*=1-P['fr.k'];","if(P['fr.k']&&A.markOf(u,s,'vpFR')) k*=1-P['fr.k']*0.5;","/ Puncture Proof"],
  // ---- the signatures ----
  ['True Version 3 Notes at the freeze end',FXJ,"if(r.tvz&&!((e.stunned||0)>0)){ r.tvz=0; T.fn.addNote(A,T,u,e,3,true); }","if(r.tvz&&!((e.stunned||0)>0)){ r.tvz=0; T.fn.addNote(A,T,u,e,2,true); }","/ The True Version"],
  ['the True Version window 6 s',FXJ,"if(P['sig.tv']){ A.acts(T,u,[{window:'vpTV',dur:6}],c);","if(P['sig.tv']){ A.acts(T,u,[{window:'vpTV',dur:0}],c);","/ The True Version"],
  ['the window once an enemy',FXJ,"else if(tvOn&&!r.tvF&&T.fn.inField(A,T,e,false)){ r.tvF=1; fail=true; T.fn.struckOut(A,T,u,e); }","else if(tvOn&&!r.tvF&&T.fn.inField(A,T,e,false)){ fail=true; T.fn.struckOut(A,T,u,e); }","/ The True Version"],
  ['the Unprinted Verse at full damage',FXJ,"let k=0; if(uv) k=1; else if((o.cn%every===0)||link) k=P['ec.k']||0;","let k=0; if(uv) k=0.5; else if((o.cn%every===0)||link) k=P['ec.k']||0;","/ The Unprinted Verse"],
  ['the Verse Crosses the frozen',FXJ,"if(P['sig.uv']) for(const e of R0.fz) if(e.alive) A.setMark(T,u,e,'vpX',{dur:6,longest:true});","if(false&&P['sig.uv']) for(const e of R0.fz) if(e.alive) A.setMark(T,u,e,'vpX',{dur:6,longest:true});","/ The Unprinted Verse"],
  ['the Fourth Year 20 energy',FXJ,"if(P['sig.fy']){ for(const a of mates(A,u)) a.energy=Math.min(100,(a.energy||0)+20);","if(P['sig.fy']){ for(const a of mates(A,u)) a.energy=Math.min(100,(a.energy||0)+60);","/ The Fourth Year"],
  ['the copy 30%',FXJ,"if(b&&sum>0) A.hurt(T,u,b,0.30*sum,'#c9a227','vpCopy');","if(b&&sum>0) A.hurt(T,u,b,0.25*sum,'#c9a227','vpCopy');","/ The Fourth Year"],
  ['the copy 2 s later',FXJ,"o.fy={on:true,by:x,sum:0,left:2};","o.fy={on:true,by:x,sum:0,left:3};","/ The Fourth Year"],
  // ---- the caps ----
  ['Bound Spine 1.5% a rank',FXJ,"rp_11_4:[ {param:'dr.bs',add:R(0.015)} ],","rp_11_4:[ {param:'dr.bs',add:R(0.02)} ],","her damage-reduction"],
  ['Margin Weight 0.1% an Ink',FXJ,"if(P['dr.mw']) k*=1-P['dr.mw']*A.stGet(T,'vpInk');","if(P['dr.mw']) k*=1-P['dr.mw']*A.stGet(T,'vpInk')*2;","her damage-reduction"],
  ['Collected Works in the ally group',FXJ,"if(P['dl.cw']&&A.markOf(u,t,'vpCW')) k*=1-P['dl.cw'];","if(P['dl.cw']&&A.markOf(u,t,'vpCW')) k*=1-P['dl.cw']*0;","allies' damage-reduction"],
  ['Puncture Proof in the ally group',FXJ,"if(P['pp.k']&&A.winOn(T,'vpPP')) k*=1-P['pp.k'];","if(P['pp.k']&&A.winOn(T,'vpPP')) k*=1-P['pp.k']*0;","allies' damage-reduction"],
  ['the freeze run cap 4.0 s',FXJ,"const DR_FLOOR=0.70, ALLY_FLOOR=0.75, CTRL_MAX=4.0, RUN_TOP=4.0, LOCK=0.5;","const DR_FLOOR=0.70, ALLY_FLOOR=0.75, CTRL_MAX=4.0, RUN_TOP=5.0, LOCK=0.5;","/ her freezes"],
  ['the free window after a run',FXJ,"if(r.re>=RUN_TOP-0.05) r.cap=LOCK; r.st=0; r.re=0; }","if(r.re>=RUN_TOP-0.05) r.cap=0; r.st=0; r.re=0; }","/ her freezes"],
  ['Eleven Errors in the freeze cap',FXJ,"const L=(r.cap>0)?0:Math.min(CTRL_MAX,(c.amt||0)+x,room); t.stunned=L>c.amt?L:Math.min(t.stunned||0,Math.max(L,0));","const L=(r.cap>0)?0:Math.min(CTRL_MAX,(c.amt||0),room); t.stunned=L>c.amt?L:Math.min(t.stunned||0,Math.max(L,0));","/ her freezes"],
  // ---- determinism and the worst-build ----
  ['no Second Verse untalented',FXJ,"const every=P['ec.ch']?2:3, uv=","const every=P['ec.ch']?2:1, uv=",'whole fights are deterministic'],
  ['her DR group reads the enemy',FXJ,"srcK(A,T,u,s){ const P=T.P; let k=1; if(!s) return k;","srcK(A,T,u,s){ const P=T.P; let k=0.5; if(!s) return k;","allies' damage-reduction"],
];
const SKIP=new Set(['.logs','.base','.bin','.git','.tmp','node_modules','assets','backups','.remote-vesper','.remote-vaelora','.remote-logs']);
const TMP=(()=>{ const t=os.tmpdir(), r=path.relative(root,t); return (!r.startsWith('..')&&!path.isAbsolute(r))?path.dirname(root):t; })();   // the test host keeps its temp folder inside the checkout: copy beside it instead
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(TMP,'ew-vsc-')); copyTo(dir);
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), n=s.split(from).length-1;
  if(n!==1){ fs.rmSync(dir,{recursive:true,force:true}); res({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(from,()=>to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-mech-vesper.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',rc=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out); const f=m?+m[1]:-1; fs.rmSync(dir,{recursive:true,force:true});
    res({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const J=+(process.env.J||1), out=[]; let i=0;
  async function worker(){ while(i<C.length){ const c=C[i++]; const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); } }
  await Promise.all(Array.from({length:J},worker)); const miss=out.filter(r=>!r.ok);
  console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
