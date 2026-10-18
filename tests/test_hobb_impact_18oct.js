'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),html=path.join(root,'emberweave-heroes.html');
const load=()=>{const host=require('../server/sim-host.js').load(html);return s=>vm.runInContext(s,host.ctx)};
const r=load();let pass=0;
const ck=(name,yes)=>{assert(yes,name);console.log('ok '+name);pass++};
for(const st of ['green','blue','ult']){
 const data=r(`JSON.parse(JSON.stringify({A:BATTLE_ANIM.hobb.${st},D:FX2_DEF.hobb_${st}}))`),{A,D}=data,t=A.impact.at;
 ck(st+' burst and body impact share the same exact real clock',Math.abs(t-(D.startReal+D.burstCell/D.fps2))<1e-12);
 ck(st+' held wind-up cannot show impact early',r(`impactClipCell(BATTLE_ANIM.hobb.${st},${t}-1e-6)===${A.contact-1}`));
 ck(st+' impact cell is shown on the burst',r(`impactClipCell(BATTLE_ANIM.hobb.${st},${t})===${A.contact}`));
 ck(st+' natural recovery one frame later',r(`impactClipCell(BATTLE_ANIM.hobb.${st},${t}+1/24)===${A.contact+1}`));
 ck(st+' hero-page preview uses the same timing',r(`skillPreviewCell(BATTLE_ANIM.hobb.${st},${t})===${A.contact}&&Math.abs(skillPreviewClipDur(BATTLE_ANIM.hobb.${st})-clipDur(BATTLE_ANIM.hobb.${st}))<1e-9`));
 ck(st+' full native effect is untrimmed',D.n===73&&Math.abs(D.n/D.fps2-145/24)<1e-9&&D.startSec==null);
 if(st!=='ult')ck(st+' deterministic release equals screen impact',r(`Math.abs(castTimeFor({key:'hobb',t:HERO_TYPES.hobb},'${st}')-${t}*FX_RT)<1e-12`));
}
ck('ult root covers the held wind-up plus natural recovery',r('Math.abs(ultClipDur({key:"hobb",t:HERO_TYPES.hobb})-clipDur(BATTLE_ANIM.hobb.ult)*FX_RT)<1e-12'));
ck('ult holds its orb wind-up pose, then resumes a natural-speed swing',r('impactClipCell(BATTLE_ANIM.hobb.ult,2)===32&&impactClipCell(BATTLE_ANIM.hobb.ult,BATTLE_ANIM.hobb.ult.impact.at-4/24)===36'));
ck('front arrivals never precede visible burst',r('HOBB_EDGE.every(p=>p[0]>=BATTLE_ANIM.hobb.ult.impact.at)'));
ck('creation tick cannot advance the effect ahead of the body clock',r(`(()=>{
 state='battle';ended=false;battleTime=5.5;
 _fx22Fx16On=()=>{};fx2SetFrame=()=>{};
 const o={d:FX2_DEF.hobb_green,u:{alive:true},vk:'hobbgreen',s:{material:{}},ok:true,began:5,t:99,ts:0};
 _fx22Fx16Tick(o);return o.t===.5;
})()`));
ck('an ended battle still lets the remaining effect finish',r(`(()=>{
 ended=true;battleTime=5.5;
 const o={d:FX2_DEF.hobb_green,u:{alive:true},vk:'hobbgreen',s:{material:{}},ok:true,began:5,t:1,ts:0};
 _fx22Fx16Tick(o);return o.t===1;
})()`));
ck('other heroes retain original cast times',r('Object.keys(HERO_TYPES).filter(k=>k!=="hobb").every(k=>["green","blue","ult"].every(st=>castTimeFor({key:k,t:HERO_TYPES[k]},st)===((ABILITY_CAST[k]||{})[st]||(st==="ult"?.8:.5))))'));
const fresh=load();require('./helpers/hobb-impact-18oct-undo.js').undoHobbImpact18Oct(fresh);
ck('undo helper restores original Hobb data and cast timings',fresh('!BATTLE_ANIM.hobb.green.impact&&!BATTLE_ANIM.hobb.ult.impact&&FX2_DEF.hobb_blue.startReal==null&&castTimeFor({key:"hobb",t:HERO_TYPES.hobb},"green")===.5&&HOBB_EDGE[0][0]===3.2'));
for(const m of fs.readFileSync(html,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
ck('all shipped script blocks parse',true);
console.log('PASS '+pass+' checks');
