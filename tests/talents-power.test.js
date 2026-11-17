'use strict';
/* TALENT POWER (14 Nov 2026, WIRING/41b - TALENT POWER FORMULA - decisions.md). The card number with talents learned.
   Phil: "91 talents should be around the same power as max glyphs" / "Make it a formula, all of these mechanics need to be created not
   hijack another one". talents-power.js is the formula; server.js heroCardPower and the page's heroPower both add its number.
   This file proves:
     (1) no talents learned = the card of every hero (61) is the one the server gave before this formula (origin/talents 52a564a22), on the
         server and on the page, at three progression points; switch off = identical too, whatever the ledger holds;
     (2) server = page for a set of builds (every wired hero, 13 legal builds each, two progression points);
     (3) monotonic: every point spent raises the number (one point at a time, three seeded orders per wired hero, and on the server card);
     (4) the ratio: every wired hero's legal full 91-point builds add 0.80x to 1.20x of what max glyphs add on the same hero (median 0.90x
         to 1.10x); the same build adds the same at every progression point (the formula, like the glyph tier, does not read stats);
     (5) no double count: the CARD unit carries no talent stat (it is the no-talent card unit), the FIGHT unit still does, and the card moves
         by exactly the formula's number;
     (6) unwired heroes and bad lists price 0; every talent of a wired hero lands in a named term; the terms add up to the number.
   Controls: tests/talents-power-controls.js breaks each of these once in a throwaway copy and expects this file to fail.
   Run: node --test tests/talents-power.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),cp=require('node:child_process'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),T=require(path.join(root,'talents.js')),FX=require(path.join(root,'talents-fx.js')),TP=require(path.join(root,'talents-power.js'));
const SIM=require(path.join(root,'server/sim.js')),SH=require(path.join(root,'server/sim-host.js')),B=require('./talents-power-builds.js');
const BASE_SHA='52a564a22f5581e802d3ea47ef87d6d8e74e5343';   /* origin/talents before this formula: talentPowerFlat returned 0, stat talents priced through the unit */
const dirs=[]; process.on('exit',()=>{ for(const d of dirs) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
function loadServer(src,flag){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-power-test-')); dirs.push(tmp);
  process.env.DB_FILE=path.join(tmp,'db.json'); process.env.PORT='0'; process.env.DATABASE_URL='';
  if(flag) process.env.TALENTS_ENABLED='true'; else delete process.env.TALENTS_ENABLED;
  const http=require('http'), fakeHttp=Object.assign({},http,{createServer:()=>({listen(){},on(){},prependListener(){},close(){},address(){ return {port:0}; }})});
  const req=Module.createRequire(path.join(root,'server.js')), myReq=n=>n==='http'?fakeHttp:req(n), noop=()=>({unref(){},ref(){}});
  const log=console.log; console.log=()=>{};
  try{ const wrap=vm.runInThisContext('(function(exports,require,module,__filename,__dirname,setInterval,setTimeout){'+src+
      '\n;return {heroCardPower,snapshotHeroFromServer,unitCardPower,ensureLedger,D_HERO_CUM,D_TROOP_CUM,getDB:()=>DB,talentPowerFlat:(typeof talentPowerFlat==="function"?talentPowerFlat:null)};})',{filename:'server.js'});
    const m={exports:{}}; return wrap(m.exports,myReq,m,path.join(root,'server.js'),root,noop,noop); }
  finally{ console.log=log; delete process.env.TALENTS_ENABLED; } }
const J=JSON.stringify, strip=u=>JSON.parse(J(u));
const SRC=fs.readFileSync(path.join(root,'server.js'),'utf8');
const ON=loadServer(SRC,true), OFF=loadServer(SRC,false);
let BASE=null; try{ BASE=loadServer(cp.execFileSync('git',['-C',root,'show',BASE_SHA+':server.js'],{maxBuffer:1<<28}).toString('utf8'),false); }catch(e){ console.log('BASE server not available ('+String(e.message||e).slice(0,120)+')'); }
const PAGE=SH.load(path.join(root,'emberweave-heroes.html')), R=c=>vm.runInContext(c,PAGE.ctx);

let uid=0; const USERS=new Map();
function serverUser(S,key,st,build){ let m=USERS.get(S); if(!m) USERS.set(S,m=new Map()); let u=m.get(key);
  if(!u){ u={id:'tpow-'+(++uid),name:'TP'+uid,guest:true,created:Date.now(),roster:{}}; S.getDB().users[u.id]=u; S.ensureLedger(u); m.set(key,u); }
  const led=u.led; led.px=S.D_TROOP_CUM[100]; led.unlocked=led.unlocked||{}; led.unlocked[key]=true;
  led.hero[key]={xp:S.D_HERO_CUM[st.level],stars:st.stars,pips:0,ref:0}; led.skill=led.skill||{}; led.skill[key]=st.skill.slice();
  led.acad={lv:{academy:0,atk:0,hp:0,ap:0,heal:st.ac,armor:0,mr:0,crit:0,critres:st.ac},learn:{},res:{iron:0,crystal:0,silver:0,coal:0}};
  u.glyphs={revision:1,fragments:{},subGlyphs:{},finished:{},boards:{[key]:{slots:[null,null,null,null,null,null],ascensionIndex:st.asc,ascended:{},personalPathVersion:1}}};
  if(build) led.talents={[key]:JSON.parse(J(build))}; else delete led.talents; return u; }
function clientSet(key,st,build){ const k=J(key);
  R('G.playerXP=TROOP_CUM[100]; G.heroXP['+k+']=HERO_CUM['+st.level+']; G.starLevel['+k+']='+st.stars+'; G.starPip=G.starPip||{}; G.starPip['+k+']=0; G.starRefine=G.starRefine||{}; G.starRefine['+k+']=0;'+
    'G.skillLevel=G.skillLevel||{}; G.skillLevel['+k+']='+J(st.skill)+'; G.glyphRank=G.glyphRank||{}; G.glyphRank['+k+']='+st.asc+'; G.tech={heal:'+st.ac+',critres:'+st.ac+'}; G.temple=undefined;'+
    (build?'G.talents={['+k+']:'+J(build)+'};':'delete G.talents;')); }
const cPow=(key,st,build)=>{ clientSet(key,st,build); return R('heroPower('+J(key)+')'); };
const sPow=(S,key,st,build)=>S.heroCardPower(serverUser(S,key,st,build),key);
const sUnit=(S,key,st,build,opts)=>S.snapshotHeroFromServer(serverUser(S,key,st,build),key,null,opts);
const HEROES=Object.keys(require(path.join(root,'talents-data.js')).heroes).filter(k=>SIM.HERO_BASE[k]);
const WIRED=HEROES.filter(k=>TP.wired(k)), UNWIRED=HEROES.filter(k=>!TP.wired(k));
const stars=key=>SIM.HERO_BASE[key].stars||1;
/* fresh / mid / maxed. Level 100 throughout where a 91-point build is priced (91 points need level 100). */
const STATES=key=>[ {level:1,stars:stars(key),skill:[1,1,1,1],asc:0,ac:0}, {level:56,stars:5,skill:[30,20,10,1],asc:6,ac:60}, {level:100,stars:5,skill:[100,100,100,100],asc:15,ac:60} ];
const L100=key=>[ {level:100,stars:stars(key),skill:[1,1,1,1],asc:0,ac:0}, {level:100,stars:5,skill:[40,30,20,10],asc:6,ac:30}, {level:100,stars:5,skill:[100,100,100,100],asc:15,ac:60} ];
const BUILDS={}; for(const k of HEROES){ BUILDS[k]=B.builds(k); for(const [n,b] of BUILDS[k]){ const why=T.invalid(k,b,100); if(why) throw new Error(k+' '+n+': '+why); } }
const CARD={noGlyphStats:true,noTempleEffects:true};
const LO=0.80, HI=1.20, MLO=0.90, MHI=1.10;   /* the tolerance (WIRING/41b) */

test('setup: 61 heroes, wired and unwired, the formula file is the one the page loaded',()=>{
  assert.equal(HEROES.length,61); assert.ok(WIRED.length>=20,'wired heroes: '+WIRED.length); assert.ok(UNWIRED.length>0||WIRED.length===61);
  assert.equal(R('typeof TalentPower'),'object','the page loads talents-power.js');
  assert.equal(R('TalentPower.UNIT'),TP.UNIT); assert.equal(typeof ON.talentPowerFlat,'function');
  const k=WIRED[0], l=T.learned(k,BUILDS[k][0][1]); assert.equal(R('TalentPower.power('+J(k)+','+J(l)+')'),TP.power(k,l)); assert.equal(ON.talentPowerFlat(k,l),TP.power(k,l));
});

test('(1) no talents learned, or the switch off: every hero\'s card is the pre-formula card, on the server and on the page',{skip:!BASE},()=>{
  let n=0;
  for(const key of HEROES) for(const st of STATES(key)){ const want=sPow(BASE,key,st,null), m=key+' L'+st.level;
    const full=st.level>=100?BUILDS[key][0][1]:B.partial(key,0,Math.max(0,st.level-9),st.level);
    assert.equal(sPow(ON,key,st,null),want,m+': switch on, nothing learned');
    assert.equal(sPow(ON,key,st,{r:{}}),want,m+': switch on, an empty build');
    assert.equal(sPow(OFF,key,st,null),want,m+': switch off');
    assert.equal(sPow(OFF,key,st,full),want,m+': switch off, a full build in the ledger');
    assert.deepEqual(strip(sUnit(OFF,key,st,full)),strip(sUnit(BASE,key,st,null)),m+': switch off, the fight unit');
    assert.equal(cPow(key,st,null),want,m+': the page, nothing learned'); n+=6; }
  assert.ok(n>=61*3*6);
});

test('(2) ONE POWER: the page\'s heroPower == the server\'s heroCardPower for every wired hero, 13 legal builds, two progression points',()=>{
  const bad=[]; let n=0, moved=0;
  for(const key of WIRED) for(const st of [L100(key)[0],L100(key)[2]]){ const s0=sPow(ON,key,st,null);
    for(const [name,b] of BUILDS[key]){ const s=sPow(ON,key,st,b), c=cPow(key,st,b); n++; if(s!==c) bad.push([key,name,c,s]); if(s>s0) moved++; } }
  assert.deepEqual(bad.slice(0,8),[],bad.length+' of '+n+' cards differ between page and server');
  assert.equal(moved,n,'every full build raises the card');
});

test('(3) monotonic: every point spent raises the number - one point at a time, three orders per wired hero, and on both cards',()=>{
  let steps=0;
  for(const key of WIRED) for(let o=0;o<3;o++){ const r=B.rng(31337*(o+1)+key.length); let b={r:{}}, last=0;
    for(let p=1;p<=91;p++){ const nb=B.fill(key,b,()=>B.all(key,o===2?null:o),1,c=>c[Math.floor(r()*c.length)],100); if(T.spent(key,nb).total!==p) break;
      const v=TP.power(key,T.learned(key,nb)); assert.ok(v>last,key+' order '+o+' point '+p+': '+last+' -> '+v); last=v; b=nb; steps++; } }
  assert.ok(steps>=WIRED.length*3*80,'steps '+steps);
  /* on the cards, every 10th point */
  for(const key of WIRED.slice(0,6)){ const st=L100(key)[1]; let lastS=sPow(ON,key,st,null), lastC=cPow(key,st,null);
    for(let p=10;p<=91;p+=10){ const b=B.partial(key,1,p,100), s=sPow(ON,key,st,b), c=cPow(key,st,b);
      assert.ok(s>lastS&&c>lastC,key+' '+p+' points: server '+lastS+' -> '+s+', page '+lastC+' -> '+c); lastS=s; lastC=c; } }
});

test('(4) the ratio: a full legal 91-point build adds about what max glyphs add, on every wired hero, at every progression point',()=>{
  const rows=[]; const bad=[];
  for(const key of WIRED){ const per=[];
    for(const [si,st] of L100(key).entries()){
      /* max glyphs on THIS hero at THIS progression point: the flat tier (25,000) and, for a hero whose purple Fury passive the board's quality
         rank switches on (Carn, Quorrel), that passive's share of the card too */
      const g=sPow(OFF,key,Object.assign({},st,{asc:16}),null)-sPow(OFF,key,Object.assign({},st,{asc:0}),null);
      assert.ok(g>=TP.GLYPH_FULL,key+': max glyphs add at least the flat tier total on the card ('+g+')');
      const p0=sPow(ON,key,st,null), add=BUILDS[key].map(([n,b])=>sPow(ON,key,st,b)-p0);
      if(per.length) assert.deepEqual(add,per[0].add,key+': the same builds add the same at every progression point');
      per.push({add,g});
      const a=add.map(x=>x/g), s=a.slice().sort((x,y)=>x-y), m=s[Math.floor(s.length/2)];
      if(si===2) rows.push(key.padEnd(10)+' glyphs '+g+'  median '+m.toFixed(3)+'  min '+s[0].toFixed(3)+' ('+BUILDS[key][a.indexOf(s[0])][0]+')  max '+s[s.length-1].toFixed(3)+' ('+BUILDS[key][a.indexOf(s[s.length-1])][0]+')');
      if(!(m>=MLO&&m<=MHI)) bad.push(key+' state '+si+' median '+m.toFixed(3));
      for(let i=0;i<a.length;i++) if(!(a[i]>=LO&&a[i]<=HI)) bad.push(key+' state '+si+' '+BUILDS[key][i][0]+' '+a[i].toFixed(3)); } }
  console.log('    91 points / max glyphs, per wired hero (13 builds each):\n    '+rows.join('\n    '));
  /* unwired heroes: no talent power on the card; their table as it will read once wired (no rows: OTHER and stats) */
  const pot=[]; for(const key of UNWIRED){ const v=BUILDS[key].map(([n,b])=>TP.potential(key,T.learned(key,b))/TP.GLYPH_FULL).sort((x,y)=>x-y); pot.push(v[Math.floor(v.length/2)]);
    assert.ok(v[Math.floor(v.length/2)]>=0.85&&v[Math.floor(v.length/2)]<=HI,key+' potential median '+v[Math.floor(v.length/2)]); }
  if(pot.length) console.log('    unwired heroes, priced as if wired with no rows: median of medians '+pot.sort()[Math.floor(pot.length/2)].toFixed(3));
  assert.deepEqual(bad,[],'outside the tolerance');
});

test('(5) no double count: the CARD prices talents by the formula only; the FIGHT unit still carries the stats',()=>{
  let n=0, statBuilds=0;
  for(const key of WIRED){ const st=L100(key)[2]; const card0=strip(sUnit(ON,key,st,null,CARD)), fight0=strip(sUnit(ON,key,st,null));
    for(const [name,b] of BUILDS[key].slice(0,4)){ const l=T.learned(key,b), tot=FX.totals(key,l), m=key+' '+name;
      assert.deepEqual(strip(sUnit(ON,key,st,b,Object.assign({noTalentStats:true},CARD))),card0,m+': the card unit (noTalentStats) is the no-talent card unit');
      if(Object.values(tot).some(v=>v>0)){ statBuilds++; assert.notDeepEqual(strip(sUnit(ON,key,st,b)),fight0,m+': the fight unit carries the stat talents'); }
      assert.equal(sPow(ON,key,st,b)-sPow(ON,key,st,null),TP.power(key,l),m+': the card moves by exactly the formula (no stat route on top)');
      assert.equal(cPow(key,st,b)-cPow(key,st,null),TP.power(key,l),m+': the page card too'); n++; } }
  assert.ok(n>=WIRED.length*4&&statBuilds>=WIRED.length,n+' builds, '+statBuilds+' with stats');
});

test('(6) unwired heroes and bad lists price nothing; every wired talent is in a named term; the terms add up',()=>{
  for(const key of UNWIRED){ const l=T.learned(key,BUILDS[key][0][1]); assert.ok(l.length>0); assert.equal(TP.power(key,l),0,key+': unwired, no talent power');
    assert.equal(ON.talentPowerFlat(key,l),0); assert.equal(R('talentPowerFlat('+J(key)+','+J(l)+')'),0); }
  const k=WIRED[0];
  assert.equal(TP.power(k,[]),0); assert.equal(TP.power(k,null),0); assert.equal(TP.power(k,[['no_such',3]]),0); assert.equal(TP.power('no_such_hero',[['x',1]]),0);
  const id=T.trees(k)[0].talents[0][0], mx=T.talent(k,id).ranks; assert.equal(TP.power(k,[[id,mx+5]]),TP.power(k,[[id,mx]]),'a rank above the max counts as the max');
  const used={}; let n=0, other=0;
  for(const key of WIRED) for(const tr of T.trees(key)) for(const t of tr.talents){ const ks=TP.kindsOf(key,t[0]); assert.ok(ks&&ks.length,key+'/'+t[0]); for(const x of ks){ assert.ok(TP.TERMS[x],x); used[x]=1; } n++; if(ks[0]==='other') other++;
    if(FX.has(key,t[0])){ const s=FX.totals(key,[[t[0],1]]); for(const st in s) if(s[st]>0){ const want={hp:'defence',armor:'defence',mr:'defence',atk:'damage',apow:'damage',crit:'damage',critDmg:'damage',aspd:'damage',heal:'healing',shield:'shields'}[st]; assert.ok(ks.includes(want),key+'/'+t[0]+' '+st+' -> '+want+' (got '+ks+')'); } } }
  for(const x of Object.keys(TP.TERMS)) assert.ok(used[x],'term '+x+' is used by some wired talent');
  assert.ok(other/n<0.15,'unclassified share '+(other/n).toFixed(3));
  for(const key of WIRED.slice(0,8)) for(const [name,b] of BUILDS[key]){ const l=T.learned(key,b), tm=TP.terms(key,l); const s=Object.values(tm).reduce((a,x)=>a+x,0);
    assert.ok(Math.abs(s-TP.power(key,l))<=0.5+1e-6,key+' '+name+': terms '+s+' vs '+TP.power(key,l)); }
});
