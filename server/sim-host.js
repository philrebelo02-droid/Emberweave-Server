/* ============================================================================
   sim-host.js — RUN THE GAME'S OWN BATTLE CODE ON THE SERVER.

   Phil's rule: "the server should go off what the player did." The strongest possible
   version of that is not a re-implementation of combat on the server — a re-implementation
   drifts from the client the day someone tunes a kit. It is the SAME CODE, running here.

   So this module loads the client's own <script> block into a Node VM with a stubbed
   browser (no DOM, no WebGL, no three.js) and exposes the headless fight resolver. Every
   render call lands on a no-op proxy; every simulation line is the real thing.

   Usage:
     const host = require('./sim-host').load(pathToGameHtml);
     const r = host.replay(allySnapshots, foeTeam, seed, inputLog);   // {won, digest, ...}
   ============================================================================ */
const fs=require('fs'), vm=require('vm');

/* A stub that answers ANY property with another stub and can be called, newed, or coerced
   to a number/string. Rendering code walks deep property chains (scene.add, mesh.material.map…)
   and must never throw — but must also never be mistaken for real data by the sim. */
function makeStub(name){
  const fn=function(){ return makeStub(name+'()'); };
  fn._stub=name;
  return new Proxy(fn,{
    get(t,k){
      if(k===Symbol.toPrimitive) return ()=>0;
      if(k==='toString') return ()=>'';
      if(k==='valueOf') return ()=>0;
      if(k===Symbol.iterator) return function*(){};
      if(k==='length') return 0;
      if(k==='then') return undefined;          // never look like a promise
      if(k==='_stub') return name;
      if(k in t && typeof t[k]!=='function') return t[k];
      return makeStub(name+'.'+String(k));
    },
    set(){ return true; },
    has(){ return true; },
    apply(){ return makeStub(name+'()'); },
    construct(){ return makeStub('new '+name); }
  });
}

function buildSandbox(knownIds){
  const store={};
  const localStorage={ getItem:k=>(k in store?store[k]:null), setItem:(k,v)=>{store[k]=String(v);},
    removeItem:k=>{delete store[k];}, clear:()=>{for(const k in store)delete store[k];} };
  /* The simulation itself reads the DOM in exactly one place — it checks whether the Vault's
     "pick a backup fighter" modal is open before deciding a wave is won or lost. A blanket stub
     answers "yes, it's open" and the fight then never resolves. So getElementById tells the truth:
     a stub for ids that actually exist in the shipped page, null for anything created at runtime. */
  const ids=knownIds||new Set();
  const doc=new Proxy(makeStub('document'),{
    get(t,k){
      if(k==='getElementById') return (id)=> ids.has(String(id)) ? makeStub('#'+id) : null;
      if(k==='querySelector') return (sel)=>{ const m=/^#([\w-]+)$/.exec(String(sel));
        if(m) return ids.has(m[1])?makeStub(sel):null; return makeStub(sel); };
      return t[k];
    },
    set(){ return true; }
  });
  const sandbox={
    console:{log(){},warn(){},error(){},info(){},debug(){}},
    Math, JSON, Date, Object, Array, String, Number, Boolean, Error, RegExp, Map, Set,
    WeakMap, WeakSet, Promise, Symbol, parseInt, parseFloat, isNaN, isFinite,
    Uint8Array, Uint32Array, Int32Array, Float32Array, Float64Array, ArrayBuffer,
    setTimeout:()=>0, clearTimeout:()=>{}, setInterval:()=>0, clearInterval:()=>{},
    requestAnimationFrame:()=>0, cancelAnimationFrame:()=>{},
    fetch:()=>Promise.resolve({ ok:false, status:0, json:()=>Promise.resolve({}), text:()=>Promise.resolve('') }),
    localStorage, sessionStorage:localStorage,
    document:doc, navigator:{userAgent:'node', language:'en'},
    location:{href:'http://server/play', pathname:'/play', search:'', hash:'', origin:'http://server'},
    performance:{now:()=>0},
    alert(){}, confirm(){return false;}, prompt(){return null;},
    WebSocket: makeStub('WebSocket'), Image: makeStub('Image'), Audio: makeStub('Audio'),
    THREE: makeStub('THREE'), TH: makeStub('TH'),
    matchMedia:()=>({matches:false, addEventListener(){}, addListener(){}}),
    getComputedStyle:()=>makeStub('style'),
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){return true;},
    innerWidth:1000, innerHeight:600, devicePixelRatio:1,
    screen:{width:1000,height:600}, history:makeStub('history'),
    CustomEvent: function(){ return makeStub('CustomEvent'); },
    Event: function(){ return makeStub('Event'); },
    URL: (typeof URL!=='undefined'?URL:makeStub('URL')),
    TextEncoder:(typeof TextEncoder!=='undefined'?TextEncoder:makeStub('TextEncoder')),
    btoa:s=>Buffer.from(String(s),'binary').toString('base64'),
    atob:s=>Buffer.from(String(s),'base64').toString('binary')
  };
  sandbox.window=sandbox; sandbox.globalThis=sandbox; sandbox.self=sandbox; sandbox.top=sandbox;
  return sandbox;
}

/* Pull the game's own script block out of the single-file client. The three.js bundle lives in
   its own earlier <script> and is deliberately NOT loaded — nothing in the sim needs it. */
function extractGameScript(html){
  const opens=[...html.matchAll(/^<script>/gm)].map(m=>m.index);
  const closes=[...html.matchAll(/^<\/script>/gm)].map(m=>m.index);
  if(!opens.length) throw new Error('sim-host: no <script> block found in the client');
  const start=opens[opens.length-1]+'<script>'.length;
  const end=closes[closes.length-1];
  if(!(end>start)) throw new Error('sim-host: could not bound the game script block');
  return html.slice(start,end);
}

function load(htmlPath){
  const html=fs.readFileSync(htmlPath,'utf8');
  const code=extractGameScript(html);
  const knownIds=new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map(m=>m[1]));
  const sandbox=buildSandbox(knownIds);
  const ctx=vm.createContext(sandbox);
  try{ new vm.Script(code,{filename:'emberweave-game.js'}).runInContext(ctx,{timeout:60000}); }
  catch(e){ const err=new Error('sim-host: the game script threw while loading — '+e.message); err.cause=e; throw err; }
  const need=['simFightResult','simFightReplay','seedBattle','snapAllySquad','snapSquadFromSpecs','simCampaignReplay'];
  for(const n of need) if(typeof sandbox[n]!=='function') throw new Error('sim-host: '+n+' is not defined after load');
  return {
    ctx, sandbox,
    /* BUILD_ID is a top-level const inside the game script (script-scoped, never on the sandbox), so
       read the shipped build straight out of the file — this is the engine version a result is tied to. */
    buildVersion: (html.match(/const BUILD_ID='(\d+)'/)||[])[1]||null,
    snapSquad(keys){ return sandbox.snapAllySquad(keys); },
    /* Resolve the server's frozen per-hero specs into full combat snapshots using the CLIENT's own
       unit builder — the same code the player's browser runs. */
    snapFromSpecs(specs){ return sandbox.snapSquadFromSpecs(specs); },
    /* Replay the player's recorded fight. manual=true means the ultimate AI stands down and the
       recorded input log fires the ultimates — the player's timing, not the machine's. */
    replay(allySnaps, foeTeam, seed, inputLog){
      const won=sandbox.simFightReplay(allySnaps, foeTeam, seed>>>0, inputLog||[], true);
      return { won:!!won, digest:sandbox._p2digest||null };
    },
    /* THE campaign entry: the authored waves, the server's seed, and the player's own transcript. */
    campaign(allySnaps, cwaves, seed, inputLog){
      const won=sandbox.simCampaignReplay(allySnaps, cwaves, seed>>>0, inputLog||[], true);
      return { won:!!won, stars:sandbox._p2stars|0, alive:sandbox._p2alive|0, total:sandbox._p2total|0,
        hpFrac:+(sandbox._p2hpf||0), digest:sandbox._p2digest||null };
    },
    auto(allySnaps, foeTeam, seed){
      const won=sandbox.simFightResult(allySnaps, foeTeam, seed>>>0);
      return { won:!!won, digest:sandbox._p2digest||null };
    }
  };
}
module.exports={ load, extractGameScript, makeStub };
