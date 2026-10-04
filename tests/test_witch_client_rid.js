// 3 Oct 2026 audit (Witches Hut P2 #7): the Hut panel must keep ONE requestId per action until a definite answer.
// Runs the real renderCauldron from emberweave-heroes.html in a vm with a stub DOM and a scripted api():
// a lost response (offline) and a refused save (storageFailed) must retry with the SAME id; a definite answer
// (ok, or a plain refusal) must start a fresh id. Control: WITCH_HTML=<old file> must fail (a new id per tap).
const fs=require('fs'), path=require('path'), vm=require('vm'), assert=require('assert');
const file=process.env.WITCH_HTML||path.join(__dirname,'..','emberweave-heroes.html');
const html=fs.readFileSync(file,'utf8');
const start=html.indexOf('async function renderCauldron(body){'); assert(start>0,'renderCauldron found');
let pre=html.lastIndexOf('\n',start); const preBlock=html.slice(html.lastIndexOf('let WALL_TAB',start),start);
let depth=0,i=html.indexOf('{',start); for(;i<html.length;i++){ const c=html[i]; if(c==='{')depth++; else if(c==='}'){ depth--; if(!depth)break; } }
const src=preBlock+';WALL_TAB="cauldron";'+html.slice(start,i+1);
let n=0, sent=[], script=[];
function el(){ const e={isConnected:true,innerHTML:'',className:'',disabled:false,dataset:{},style:{},children:[],
  appendChild(c){this.children.push(c);}, remove(){}, querySelectorAll(sel){ if(sel==='[data-witch-heal]')return []; if(sel==='.panel')return []; return []; },
  querySelector(sel){ if(sel==='[data-witch-buy]'){ const b=this._buy||(this._buy=el()); b.dataset.witchBuy='first'; return b; } return null; } }; return e; }
const ctx={ ACC:{token:'t'}, document:{createElement:()=>el(), getElementById:()=>({textContent:''})}, bindNav(){}, bannerMsg(){}, adoptLedger(){},
  uid8:()=>'id'+(++n), HERO_TYPES:{}, heroIcon:()=>'', fmtDur:()=>'', WALL_UNLOCK_LEVEL:20, Math, JSON, Object, console,
  setInterval:()=>0, clearInterval:()=>{},   /* v965's live panel ticker (Hut #8) needs these; without them the test stopped running (caught 3 Oct 23:0x) */
  api:async(p,m,b)=>{ if(p==='/api/witch/state') return {ok:true,brew:10,capacity:100,heroes:[],offer:{tier:'first',gems:200},injured:[]}; sent.push(b.requestId); return script.shift(); } };
vm.createContext(ctx); vm.runInContext(src+'\nthis.renderCauldron=renderCauldron;',ctx);
(async()=>{ let pass=0; const ok=(c,m)=>{assert(c,m);pass++;};
  const body=el(); body.querySelectorAll=()=>[]; await ctx.renderCauldron(body);
  const panel=body.children[0]; const buy=panel._buy; ok(buy&&typeof buy.onclick==='function','buy button wired');
  const tap=async r=>{ script.push(r); buy.disabled=false; await buy.onclick(); await new Promise(r=>setImmediate(r)); };
  await tap({error:'offline'}); await tap({ok:false,storageFailed:true,error:'Save failed. Retry the same request.'}); await tap({ok:false,error:'The cauldron is full.'});
  ok(sent[0]===sent[1],'retry after a lost response reuses the id ('+sent[0]+','+sent[1]+')');
  ok(sent[1]===sent[2],'retry after a refused save reuses the id ('+sent[1]+','+sent[2]+')');
  await tap({ok:false,error:'The cauldron is full.'});
  ok(sent[3]!==sent[2],'after a definite refusal the next tap is a new request ('+sent[2]+','+sent[3]+')');
  console.log('test_witch_client_rid.js: '+pass+' checks passed');
})().catch(e=>{ console.error('FAIL',e.message); process.exitCode=1; });
