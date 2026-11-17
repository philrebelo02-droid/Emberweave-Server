'use strict';
/* TALENT POWER - measurements for WIRING/41b (run on the cluster: node tests/talents-power-measure.js; writes nothing but os.tmpdir()).
   1. MAX GLYPHS: for every hero, at three progression points, the card power with an Orange board minus the card with no board (server
      heroCardPower, this checkout, switch off - the glyph term does not depend on talents).
   2. TODAY (origin/talents 52a564a22, before this formula): what a full legal 91-point build adds to the card - stat talents through the
      unit's stats, mechanic talents 0 - for the builds of tests/talents-power-builds.js.
   3. NOW (this checkout): what the same builds add, and the ratio to max glyphs. Also unwired heroes' "potential" (priced as if wired).
   4. COST: the page's heroPower for all 61 heroes (each with a full build), and the server's heroCardPower, before and after.
   5. LEVEL CURVE: max glyphs reachable at a hero level vs the talent points that level gives (deep in one tree).
   Output: a table on stdout (the cluster runner copies the log back), also written as JSON to os.tmpdir()/talents-power-measure.json. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),cp=require('node:child_process'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),T=require(path.join(root,'talents.js')),TP=require(path.join(root,'talents-power.js')),B=require('./talents-power-builds.js');
const SIM=require(path.join(root,'server/sim.js')),SH=require(path.join(root,'server/sim-host.js'));
const OLD_SHA='52a564a22f5581e802d3ea47ef87d6d8e74e5343';
const dirs=[]; process.on('exit',()=>{ for(const d of dirs) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
function loadServer(src,flag){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-power-')); dirs.push(tmp);
  process.env.DB_FILE=path.join(tmp,'db.json'); process.env.PORT='0'; process.env.DATABASE_URL='';
  if(flag) process.env.TALENTS_ENABLED='true'; else delete process.env.TALENTS_ENABLED;
  const http=require('http'), fakeHttp=Object.assign({},http,{createServer:()=>({listen(){},on(){},prependListener(){},close(){},address(){ return {port:0}; }})});
  const req=Module.createRequire(path.join(root,'server.js')), myReq=n=>n==='http'?fakeHttp:req(n), noop=()=>({unref(){},ref(){}});
  const log=console.log; console.log=()=>{};
  try{ const wrap=vm.runInThisContext('(function(exports,require,module,__filename,__dirname,setInterval,setTimeout){'+src+
      '\n;return {heroCardPower,ensureLedger,D_HERO_CUM,D_TROOP_CUM,getDB:()=>DB};})',{filename:'server.js'});
    const m={exports:{}}; return wrap(m.exports,myReq,m,path.join(root,'server.js'),root,noop,noop); }
  finally{ console.log=log; delete process.env.TALENTS_ENABLED; } }
const J=JSON.stringify, SRC=fs.readFileSync(path.join(root,'server.js'),'utf8'), OLD_SRC=cp.execFileSync('git',['-C',root,'show',OLD_SHA+':server.js'],{maxBuffer:1<<28}).toString('utf8');
const NEW=loadServer(SRC,true), NEWOFF=loadServer(SRC,false), OLD=loadServer(OLD_SRC,true);
let uid=0;
function user(S,key,st,build){ const u={id:'tpow-'+(++uid),name:'TP'+uid,guest:true,created:Date.now(),roster:{}}; S.getDB().users[u.id]=u; S.ensureLedger(u);
  const led=u.led; led.px=S.D_TROOP_CUM[100]; led.unlocked=led.unlocked||{}; led.unlocked[key]=true;
  led.hero[key]={xp:S.D_HERO_CUM[st.level],stars:st.stars,pips:0,ref:0}; led.skill=led.skill||{}; led.skill[key]=st.skill.slice();
  led.acad={lv:{academy:0,atk:st.ac,hp:st.ac,ap:st.ac,heal:st.ac,armor:st.ac,mr:st.ac,crit:0,critres:st.ac},learn:{},res:{iron:0,crystal:0,silver:0,coal:0}};
  u.glyphs={revision:1,fragments:{},subGlyphs:{},finished:{},boards:{[key]:{slots:[null,null,null,null,null,null],ascensionIndex:st.asc,ascended:{},personalPathVersion:1}}};
  if(build) led.talents={[key]:JSON.parse(J(build))}; return u; }
const pow=(S,key,st,build)=>{ const u=user(S,key,st,build); const p=S.heroCardPower(u,key); delete S.getDB().users[u.id]; return p; };
const HEROES=Object.keys(require(path.join(root,'talents-data.js')).heroes).filter(k=>SIM.HERO_BASE[k]);
const base=k=>SIM.HERO_BASE[k].stars||1;
const STATES=k=>({fresh:{level:100,stars:base(k),skill:[1,1,1,1],asc:0,ac:0}, mid:{level:100,stars:5,skill:[40,30,20,10],asc:0,ac:30}, maxed:{level:100,stars:5,skill:[100,100,100,100],asc:0,ac:60}});
const med=a=>{ const s=a.slice().sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; };
const out={heroes:{}}; const t0=Date.now();
for(const key of HEROES){ const bs=B.builds(key), row={wired:TP.wired(key),glyph:{},today:{},now:{},potential:null};
  for(const b of bs) if(T.invalid(key,b[1],100)) throw new Error(key+' '+b[0]+' illegal: '+T.invalid(key,b[1],100));
  for(const [sn,st] of Object.entries(STATES(key))){
    row.glyph[sn]=pow(NEWOFF,key,Object.assign({},st,{asc:16}),null)-pow(NEWOFF,key,st,null);
    const o0=pow(OLD,key,st,null), n0=pow(NEW,key,st,null);
    row.today[sn]=bs.map(([n,b])=>pow(OLD,key,st,b)-o0);
    row.now[sn]=bs.map(([n,b])=>pow(NEW,key,st,b)-n0); }
  row.potential=bs.map(([n,b])=>TP.potential(key,T.learned(key,b)));
  row.builds=bs.map(x=>x[0]); out.heroes[key]=row; }
out.buildMs=Date.now()-t0;
/* the table */
const f=x=>String(x).padStart(7), r2=x=>x.toFixed(2);
console.log('hero        wired  glyph(fresh/mid/maxed)    today 91pts median (fresh/mid/maxed)   now median  min   max   ratio med/min/max  potential med ratio');
const ratios=[];
for(const key of HEROES){ const r=out.heroes[key], g=r.glyph.maxed, nm=med(r.now.maxed), mn=Math.min(...r.now.maxed), mx=Math.max(...r.now.maxed), pm=med(r.potential);
  if(r.wired) ratios.push([key,nm/g,mn/g,mx/g]);
  console.log(key.padEnd(11),r.wired?'  W  ':'  -  ',f(r.glyph.fresh),f(r.glyph.mid),f(r.glyph.maxed),'  ',f(med(r.today.fresh)),f(med(r.today.mid)),f(med(r.today.maxed)),'   ',f(nm),f(mn),f(mx),'  ',r2(nm/g),r2(mn/g),r2(mx/g),'  ',f(pm),r2(pm/g)); }
ratios.sort((a,b)=>a[1]-b[1]); console.log('wired: median ratio lowest',ratios[0][0],r2(ratios[0][1]),'highest',ratios[ratios.length-1][0],r2(ratios[ratios.length-1][1]),
  '| any build lowest',r2(Math.min(...ratios.map(x=>x[2]))),'highest',r2(Math.max(...ratios.map(x=>x[3]))));
/* the same builds at three progression points must add the same number (the formula does not read stats) */
let drift=0; for(const key of HEROES){ const r=out.heroes[key]; for(let i=0;i<r.builds.length;i++){ const a=r.now.fresh[i],b=r.now.mid[i],c=r.now.maxed[i]; if(a!==b||b!==c) drift++; } }
console.log('builds whose added power differs between fresh / mid / maxed: '+drift);
/* level curve */
const GMIN=[1,5,13,18,24,30,36,43,50,57,65,72,79,86,93,100], R=1.18, tot=(()=>{ let s=0; for(let i=0;i<16;i++) s+=Math.pow(R,i); return s; })();
console.log('level  glyph max  talent deep (wired median)');
for(const L of [10,20,30,40,50,60,70,80,90,100]){ const n=GMIN.filter(x=>x<=L).length; let g=0; for(let i=0;i<n;i++) g+=Math.pow(R,i)/tot*25000;
  const v=med(HEROES.filter(k=>TP.wired(k)).map(k=>TP.power(k,T.learned(k,B.partial(k,0,L-9,L)))));
  console.log(String(L).padStart(5),f(Math.round(g)),'   ',f(v)); }
/* cost: the page's heroPower over all 61 heroes, before (52a564a22) and after */
function pageAt(html){ const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-power-page-')); dirs.push(tmp);
  for(const raw of [...html.matchAll(/<script\s+src=["']\/([^"']+)["'][^>]*><\/script>/g)].map(m=>m[1])){ const src=raw.split('?')[0]; if(src.startsWith('assets/')) continue;
    const from=path.join(root,src); if(fs.existsSync(from)){ fs.mkdirSync(path.dirname(path.join(tmp,src)),{recursive:true}); fs.copyFileSync(from,path.join(tmp,src)); } }
  fs.writeFileSync(path.join(tmp,'emberweave-heroes.html'),html); return SH.load(path.join(tmp,'emberweave-heroes.html')); }
const pages={before:pageAt(cp.execFileSync('git',['-C',root,'show',OLD_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}).toString('utf8')), after:SH.load(path.join(root,'emberweave-heroes.html'))};
const full={}; for(const k of HEROES) full[k]=B.builds(k)[0][1];
for(const name of ['before','after']){ const P=pages[name], Rn=c=>vm.runInContext(c,P.ctx);
  Rn('G.playerXP=TROOP_CUM[100]; G.talents='+J(full)+'; for(const k of '+J(HEROES)+'){ G.heroXP[k]=HERO_CUM[100]; G.starLevel[k]=5; }');
  for(const withT of [false,true]){ Rn(withT?'G.talents='+J(full):'delete G.talents');
    Rn('for(const k of '+J(HEROES)+') heroPower(k)');   /* warm */
    const ms=[]; for(let i=0;i<7;i++){ const a=process.hrtime.bigint(); Rn('for(let j=0;j<20;j++) for(const k of '+J(HEROES)+') heroPower(k)'); ms.push(Number(process.hrtime.bigint()-a)/1e6/20); }
    console.log('page heroPower x61 heroes, '+name+', '+(withT?'every hero a full build':'no talents')+': median '+med(ms).toFixed(2)+' ms per list ('+ms.map(x=>x.toFixed(2)).join(' ')+')'); } }
for(const [name,S] of [['before',OLD],['after',NEW]]){ const st={level:100,stars:5,skill:[40,30,20,10],asc:15,ac:30};
  const us=HEROES.map(k=>[k,user(S,k,st,full[k])]); for(const [k,u] of us) S.heroCardPower(u,k);
  const ms=[]; for(let i=0;i<5;i++){ const a=process.hrtime.bigint(); for(const [k,u] of us) S.heroCardPower(u,k); ms.push(Number(process.hrtime.bigint()-a)/1e6); }
  console.log('server heroCardPower x61 heroes with full builds, '+name+': median '+med(ms).toFixed(2)+' ms'); }
fs.writeFileSync(path.join(os.tmpdir(),'talents-power-measure.json'),J(out));
console.log('done in '+((Date.now()-t0)/1000).toFixed(1)+' s');
