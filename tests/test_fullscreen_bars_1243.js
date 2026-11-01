// v1243 (Phil 31 Oct 2026, the Android app: "when I swipe down it reduces the size of the game until the screen goes back to normal").
// assets/ui/fold-viewport.js: in the installed full-screen app a transient shrink (system bars shown by a swipe) keeps the full game size;
// a shrink that lasts 4 s, a focused text field (keyboard) or a turn of the phone is taken at once; a plain browser tab is unchanged.
// Asserts (non-zero exit). Control: FV_FILE=<pre-fix fold-viewport.js> must FAIL.
const assert=require('assert'),path=require('path');
const file=process.env.FV_FILE||path.join(__dirname,'..','assets','ui','fold-viewport.js');
let pass=0,missed=[];const ok=(c,m)=>{ if(process.env.FV_FILE&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ok '+m); };
function rig(app){
  let now=1000;const timers=[];const listeners={};const store={};
  const de={clientWidth:2000,clientHeight:923,style:{setProperty(){}}};
  const body={classList:{contains:()=>false,toggle(){}},style:{setProperty(){}},};
  const d={documentElement:de,body,activeElement:null,referrer:app?'android-app://com.emberweave.heroes/':'',querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,
    addEventListener(){},elementFromPoint:()=>null,createElement:()=>({})};
  const w={document:d,innerWidth:2000,innerHeight:923,visualViewport:null,Element:function(){},MouseEvent:null,Touch:null,
    matchMedia:()=>({matches:false}),sessionStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v}},
    setTimeout:(f,ms)=>{timers.push({at:now+ms,f})},requestAnimationFrame:f=>f(),getComputedStyle:()=>({getPropertyValue:()=>'',backgroundImage:'none'}),
    addEventListener(ev,f){(listeners[ev]=listeners[ev]||[]).push(f)},MutationObserver:function(){this.observe=()=>{}},screen:{}};
  w.Element.prototype={};
  const realNow=Date.now;Date.now=()=>now;
  delete require.cache[require.resolve(file)];const save=global.window;
  const api=require(file);api.install(w);
  return {api,w,de,d,set(W,H){de.clientWidth=W;de.clientHeight=H;w.innerWidth=W;w.innerHeight=H;api.fit();return {w:api.state.width,h:api.state.height}},
    tick(ms){now+=ms;for(const t of timers.splice(0))if(t.at<=now)t.f();else timers.push(t)},done(){Date.now=realNow}};
}
try{
  // ---- the installed app ----
  let r=rig(true);
  ok(r.set(2000,923).w===2000,'app: full size at start (2000 x 923)');
  let s=r.set(1890,923);
  ok(s.w===2000&&s.h===923,'app: the swipe shows the bars (window 1890 wide) - the game keeps 2000 x 923 ('+s.w+' x '+s.h+')');
  r.tick(1500);s=r.set(2000,923);
  ok(s.w===2000,'app: the bars hide again - still 2000 x 923');
  s=r.set(1890,923);r.tick(4200);s=r.set(1890,923);
  ok(s.w===1890,'app: a shrink that stays 4 s is taken ('+s.w+')');
  s=r.set(923,2000);
  ok(s.w===2000&&s.h===923&&r.api.state.rotated,'app: turning the phone is taken at once (portrait rotates the game)');
  r.d.activeElement={tagName:'INPUT'};s=r.set(2000,500);
  ok(s.h===500,'app: a text field with the keyboard open shrinks at once ('+s.h+')');
  r.done();
  // ---- a plain browser tab: unchanged ----
  r=rig(false);r.set(2000,923);s=r.set(1890,923);
  ok(s.w===1890,'browser tab: a resize is taken at once, as before ('+s.w+')');
  r.done();
}catch(e){ console.error('FAIL',e&&e.stack||e); process.exitCode=1; }
if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
console.log('test_fullscreen_bars_1243.js: '+pass+' checks passed, '+missed.length+' failed');
