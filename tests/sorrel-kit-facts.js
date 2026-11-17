'use strict';
/* Sorrel's real kit, measured (not a test: a plain node script, run on the cluster through tools/remote_test.sh). What his talents build on, with NO talents learned,
   in 20 seeded fights (12 campaign, 8 two-sided), Sorrel at skill level 100: how often each skill fires and whom it reaches (Marked Deal's target against his own
   target, its three cards, the mark and when it lands against the third card), House Edge (whether a marked enemy stands when it is cast, its speed), Loaded
   Hand (his swings, the draws, each suit and what it wrote), Grand Reveal (enemies struck), how long a marked enemy stands, his kills by cards and their overkill,
   and how long one enemy stays stunned by him in a row.
   Run: node tests/sorrel-kit-facts.js */
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const {NOW,V,spec,snaps}=require('./talents-lab.js');
const VMX=s=>vm.runInContext(s,NOW.ctx), ENC=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server/campaign-encounters.json'),'utf8'));
VMX('var __sk={fights:0,ticks:0,green:0,greenNear:0,greenOwn:0,greenDist:[],cards:[],cur:null,markFirst:0,markAfter:0,markNone:0,blue:0,blueMarked:0,blueMul:[],blueDur:[],ult:0,ultHit:[],ultDist:[],'+
  'swings:0,draws:0,suit:{},stun:[],shred:[],healK:[],heavyK:[],markedT:0,markedEnemyT:0,enemyT:0,cardKills:0,autoKills:0,over:[],hitsLow40:0,hitsLow30:0,hits:0,deaths:0,runs:[],cardHits:0,autoHits:0,suitHits:0,gaps:[]};'+
  'var __skD=_doEffectCore, __skH=_dealDamageCore, __skU=_updateBattleCore, __skP=firePassiveFx, __skHeal=healUnit, __skRec=null, __skPend=[], __skRun=new Map(), __skDead=new Set();'+
  '_doEffectCore=function(u,type,o){ const me=u&&u.key==="sorrel"&&(!o||!o.deliver||o._arrived);'+
  '  if(me&&type==="volley"&&u._castSlot!=="ult"){ __sk.green++; const L=enemiesOf(u).sort((a,b)=>dist(u,a)-dist(u,b)); const t=L[0]; if(t){ if(t===L[0]) __sk.greenNear++; if(t===u.target) __sk.greenOwn++; __sk.greenDist.push(+((dist(u,t)-bodyR(u)-bodyR(t))/METER).toFixed(1)); __skPend.push({t,n:0,m0:t._markT||0,at:battleTime}); } }'+
  '  if(me&&type==="volley"&&u._castSlot==="ult"){ __sk.ult++; const L=enemiesOf(u).sort((a,b)=>dist(u,a)-dist(u,b)).slice(0,6); __sk.ultHit.push(L.length); for(const e of L) __sk.ultDist.push(+((dist(u,e)-bodyR(u)-bodyR(e))/METER).toFixed(1)); }'+
  '  if(me&&type==="haste"){ __sk.blue++; if(units.some(e=>e.alive&&e.team!==u.team&&(e._markT||0)>0)) __sk.blueMarked++; }'+
  '  const r=__skD.apply(this,arguments); if(me&&type==="haste"){ __sk.blueMul.push(+u.hasteMul.toFixed(3)); __sk.blueDur.push(+u.hasteT.toFixed(2)); } return r; };'+
  'firePassiveFx=function(u,t,o){ if(u&&u.key==="sorrel"&&t){ __sk.draws++; __skRec={u,t,f:floatTexts.length,st:t.stunned||0,sh:t._shredPct||0,hp:u.hp,thp:t.hp+(t.shield||0),dmg:u.dmg*(u.dmgBuffT>0?u.dmgBuffMul:1)*rageMul}; } return __skP.apply(this,arguments); };'+
  '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=src&&src.key==="sorrel"&&tgt&&tgt.team!==src.team; let h0=0;'+
  '  if(me){ h0=tgt.hp; __sk.hits++; if(tgt.hp<0.4*tgt.maxHp) __sk.hitsLow40++; if(tgt.hp<0.3*tgt.maxHp) __sk.hitsLow30++; if(_autoAtk) __sk.autoHits++; else if(color==="#5ee89b") __sk.cardHits++; else if(color==="#c0392b") __sk.suitHits++;'+
  '    if(color==="#5ee89b"){ const p=__skPend.find(q=>q.t===tgt&&q.n<3&&battleTime-q.at<2); if(p){ p.n++; if(p.n===3){ if((tgt._markT||0)>p.m0+1e-9&&(tgt._markT||0)>5.5) __sk.markFirst++; else p.after=true; } } } }'+
  '  const r=__skH.apply(this,arguments); if(me&&h0>0&&!tgt.alive){ if(color==="#5ee89b"){ __sk.cardKills++; __sk.over.push(+(Math.max(0,-tgt.hp)/tgt.maxHp*100).toFixed(1)); } else if(_autoAtk) __sk.autoKills++; } return r; };'+
  '_updateBattleCore=function(dt){ const S=units.filter(u=>u&&u.key==="sorrel"); const r=__skU.apply(this,arguments);'+
  '  if(__skRec){ const q=__skRec; __skRec=null; const ft=floatTexts.slice(q.f).map(f=>f.img).filter(x=>x&&x.indexOf("fx-")===0); const s=ft[0]||"none"; __sk.suit[s]=(__sk.suit[s]||0)+1;'+
  '    if(s==="fx-spade") __sk.stun.push(+(q.t.stunned||0).toFixed(3)); if(s==="fx-diamond") __sk.shred.push(+(q.t._shredPct||0).toFixed(3)); if(s==="fx-club") __sk.healK.push(+((q.u.hp-q.hp)/Math.max(1,q.dmg)).toFixed(3)); if(s==="fx-heart") __sk.heavyK.push(+((q.thp-q.t.hp-(q.t.shield||0))/Math.max(1,q.dmg)).toFixed(3)); }'+
  '  for(const p of __skPend){ if(!p.done&&p.after&&(p.t._markT||0)>p.m0+1e-9&&(p.t._markT||0)>5.5){ p.done=1; __sk.markAfter++; } }'+
  '  for(let i=__skPend.length-1;i>=0;i--){ const p=__skPend[i]; if(battleTime-p.at>2||battleTime<p.at){ if(!p.done&&p.n<3) __sk.markNone++; __skPend.splice(i,1); } }'+
  '  for(const u of S){ if(!u.alive){ if(!__skDead.has(u)){ __skDead.add(u); __sk.deaths++; } continue; } __sk.ticks++; let any=false; for(const e of units){ if(!e.alive||e.team===u.team) continue; __sk.enemyT++; if((e._markT||0)>0){ any=true; __sk.markedEnemyT++; }'+
  '      const k=e.uid, st=(e.stunned||0)>0; let w=__skRun.get(k)||0; if(st) w+=dt; else if(w>0){ __sk.runs.push(+w.toFixed(2)); w=0; } __skRun.set(k,w); } if(any) __sk.markedT++; }'+
  '  return r; };');
const team=['sorrel','vael','vireo','sylthaine','gruel'];
const sn=snaps(team.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
const fin=()=>VMX('for(const [k,w] of __skRun) if(w>0) __sk.runs.push(+w.toFixed(2)); __skRun=new Map(); __skDead=new Set(); __skPend=[];');
for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ VMX('__sk.fights++'); NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); fin(); }
const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
for(const seed of [5,77,31337,4242]){ VMX('__sk.fights++'); NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); fin(); VMX('__sk.fights++'); NOW.auto(JSON.parse(JSON.stringify(foe)),JSON.parse(JSON.stringify(sn)),seed); fin(); }
const c=VMX('__sk'), step=VMX('SIM_STEP'), avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3):'-', hist=a=>{ const h={}; for(const x of a) h[x]=(h[x]||0)+1; return JSON.stringify(h); },
  q=(a,p)=>{ const s=a.slice().sort((x,y)=>x-y); return s.length?(+s[Math.min(s.length-1,Math.floor(p*s.length))]).toFixed(2):'-'; };
console.log('fights '+c.fights+'; Sorrel alive '+(c.ticks*step).toFixed(0)+' s in all; died '+c.deaths+' times');
console.log('Marked Deal: '+c.green+' casts; it went to the nearest enemy '+c.greenNear+', to his own target '+c.greenOwn+'; gap to it (body to body) median '+q(c.greenDist,0.5)+' m, max '+q(c.greenDist,1)+' m; the mark landed BEFORE the third card '+c.markFirst+', after it '+c.markAfter+', no third card '+c.markNone);
console.log('House Edge: '+c.blue+' casts, a marked enemy standing at the cast '+c.blueMarked+'; his speed multiplier '+hist(c.blueMul)+', for '+hist(c.blueDur)+' s');
console.log('Grand Reveal: '+c.ult+' casts, enemies struck '+hist(c.ultHit)+', their gap median '+q(c.ultDist,0.5)+' m, max '+q(c.ultDist,1)+' m');
console.log('Loaded Hand: '+c.draws+' draws; suits '+JSON.stringify(c.suit)+'; stun as written '+hist(c.stun)+'; armour break '+hist(c.shred)+'; heal / his attack '+hist(c.healK)+'; heavy hit / his attack (after the target\'s armour) median '+q(c.heavyK,0.5));
console.log('hits on enemies '+c.hits+': basic '+c.autoHits+', cards '+c.cardHits+', heavy suits '+c.suitHits+'; below 40% HP '+c.hitsLow40+', below 30% '+c.hitsLow30+'; kills by a card '+c.cardKills+' (overkill, % of max HP: median '+q(c.over,0.5)+', mean '+avg(c.over)+'), by a basic attack '+c.autoKills);
console.log('a marked enemy stands '+(100*c.markedT/Math.max(1,c.ticks)).toFixed(1)+'% of his time; enemies marked '+(100*c.markedEnemyT/Math.max(1,c.enemyT)).toFixed(1)+'% of enemy-time');
console.log('stunned in a row (any stun, every enemy): longest '+q(c.runs,1)+' s, runs '+c.runs.length);
const L=V.arena(snaps([Object.assign(spec('sorrel',100),{skillLv:[100,100,100,100]})]),snaps([spec('vael',100)]),7);
console.log('Sorrel: body radius '+V.bodyR(L[0]).toFixed(2)+' m, attack interval '+L[0].atkInterval.toFixed(3)+' s, max HP '+Math.round(L[0].maxHp)+', attack '+Math.round(L[0].dmg)+', crit '+L[0].glyphCrit+', crit damage '+L[0].critDmg+', melee '+!!L[0].melee+', range '+(L[0].range/V.METER).toFixed(2)+' m; passMul '+L[0].passMul+'; passive '+JSON.stringify(L[0].pass)+', green '+JSON.stringify(L[0].greenAb)+', blue '+JSON.stringify(L[0].blueAb)+', armour '+Math.round(L[0].armorRating)+', mr '+Math.round(L[0].mrRating));
