// v1228 (Phil 30 Oct 2026: "please make it so that locked buildings no longer need to double click the lock to see what level it opens,
// all they need to do is click and hold the name of the building to see what level it unlocks"). Runs the page's own townLockHold on a
// small fake label: a locked label held 300 ms shows its 'Unlocks at Lv N' tip, letting go hides it 1.4 s later, a drag past 8 px
// cancels the hold (the town still scrolls), and an unlocked label (no lock) never gets the hold class.
// Asserts, exits non-zero.
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'..','emberweave-heroes.html'),'utf8');
const src=name=>{const i=html.indexOf('function '+name+'(');assert(i>0,name+' in the page');let d=0,j=html.indexOf('{',i);for(;j<html.length;j++){if(html[j]==='{')d++;else if(html[j]==='}'&&--d===0)break;}return html.slice(i,j+1);};
let now=0,timers=[],id=0;
const ctx=vm.createContext({setTimeout:(f,ms)=>{timers.push({id:++id,at:now+ms,f});return id;},clearTimeout:x=>{timers=timers.filter(t=>t.id!==x);},Math,
  document:{getElementById:()=>null}});
vm.runInContext(src('townLockHold')+'\n'+src('clampLockTip'),ctx);
const advance=ms=>{now+=ms;for(;;){const t=timers.filter(t=>t.at<=now).sort((a,b)=>a.at-b.at)[0];if(!t)break;timers=timers.filter(x=>x!==t);t.f();}};
function el(){const cls=new Set(),ls={};return {classList:{add:c=>cls.add(c),remove:c=>cls.delete(c),contains:c=>cls.has(c)},querySelector:()=>null,
  addEventListener:(t,f)=>{(ls[t]=ls[t]||[]).push(f);},fire:(t,e={})=>(ls[t]||[]).forEach(f=>f({clientX:0,clientY:0,preventDefault(){},...e}))};}
let pass=0;const ok=(c,m)=>{assert(c,m);pass++;};
// a locked building: the label gets the hold class; hold 300 ms -> tip; release -> gone 1.4 s later
const lab=el(),w=el();ctx.townLockHold(lab,w);
ok(lab.classList.contains('tl-locked'),'a locked label is the hold target');
lab.fire('pointerdown');advance(250);ok(!w.classList.contains('show'),'not yet at 250 ms (a quick tap does nothing)');
advance(60);ok(w.classList.contains('show'),'the tip shows after a 300 ms hold');
lab.fire('pointerup');advance(1300);ok(w.classList.contains('show'),'still up 1.3 s after letting go');
advance(150);ok(!w.classList.contains('show'),'gone 1.4 s after letting go');
// a quick tap: down + up at 100 ms -> never shows
lab.fire('pointerdown');advance(100);lab.fire('pointerup');advance(2000);ok(!w.classList.contains('show'),'a quick tap never shows the tip');
// a drag across the name (scrolling the town) cancels the hold
lab.fire('pointerdown',{clientX:10,clientY:10});lab.fire('pointermove',{clientX:14,clientY:12});advance(100);
lab.fire('pointermove',{clientX:30,clientY:10});advance(500);ok(!w.classList.contains('show'),'a drag past 8 px cancels the hold');
// a long-press menu never opens on the name
let prevented=false;lab.fire('contextmenu',{preventDefault(){prevented=true;}});ok(prevented,'no long-press menu');
// an unlocked building: no lock, so the page never calls townLockHold - and the call itself refuses a missing lock
const open=el();ctx.townLockHold(open,null);ok(!open.classList.contains('tl-locked'),'an unlocked label has no tl-locked class (taps reach the building)');
ok(/if\(wrapEl && !wrapEl\.classList\.contains\('acatimer'\)\) townLockHold\(lab, wrapEl\);/.test(html),'renderHome wires only labels that carry a lock');
ok(/\.townlbl\{[^}]*pointer-events:none/.test(html)&&/\.townlbl\.tl-locked\{pointer-events:auto/.test(html),'only locked labels catch the pointer');
console.log('test_town_lock_hold.js: '+pass+' checks passed');
