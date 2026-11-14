  /* ====================================================================================================================
     MECHANICS RUNTIME  (source: talents-mech/_engine.js - tools/build_talent_fx.py copies it into talents-fx.js)
     What a learned talent DOES in a fight, beyond plain stats. The page's fight code calls a small fixed set of hooks, each
     behind a guard that is false for a unit with no learned mechanic talent (`u._tal` is only ever set by attach()).
     A talent is ROWS OF DATA (talents-mech/<hero>.js); this file is the dozen generic primitives that read those rows.
     Rules (design doc: WIRING/03 - MECHANICS LAYER): no Math.random / clocks - chance is E.rnd() (the fight's seeded stream) and
     is drawn only inside a learned row; per-fight state lives in u._tal.s (and, for marks / DoTs, on the other unit keyed by the
     owner's uid); nothing here is ever written to a snap; rows run in sorted talent-id order.
     ==================================================================================================================== */
  let E=null;                                   // the fight's own functions, handed over once by the page: TalentFx.bind({...})
  const OVER={};                                // TalentFx.define(hero, def): a definition supplied at run time (the tests' scripted talents)
  const defOf=hero=>Object.prototype.hasOwnProperty.call(OVER,hero)?OVER[hero]:MECH[hero];
  function bind(api){ E=api; }
  function bindMore(api){ if(E) Object.assign(E,api); }     // more of the fight's functions, handed over by a later line of the page (Blood Rage)
  function define(hero,def){ if(def==null) delete OVER[hero]; else OVER[hero]=def; }

  /* ---- a value at a rank. number | [by rank] | {r: per rank, b: base, rk: 'other talent id' (use ITS rank), $: 'named number'
          (everything learned talents add to it), $m: 'named number' used as a multiplier (1 + it)} | any object / list (resolved deep) */
  const isVal=v=>('r' in v)||('$' in v)||('$m' in v);
  function rv(v,rank,P,R){
    if(v==null||typeof v!=='object') return v;
    if(Array.isArray(v)){ if(v.length&&v.every(x=>typeof x==='number')) return v[Math.max(1,Math.min(rank,v.length))-1]; return v.map(x=>rv(x,rank,P,R)); }
    if(isVal(v)){ let x=(v.b||0)+(v.r||0)*(v.rk?(R[v.rk]||0):rank); if(v.$) x+=(P[v.$]||0); if(v.$m) x*=1+(P[v.$m]||0); return x; }
    const o={}; for(const k in v) o[k]=rv(v[k],rank,P,R); return o; }

  /* ---- attach: build u._tal from the learned list [[id, rank], ...]. Returns null (and sets nothing) when the hero has no mechanics
          definition or none of the learned talents has a mechanic row - such a unit then runs none of the hooks. */
  function attach(u,hero,list){
    const M=defOf(hero); if(!u||!M||!M.talents||!list||!list.length) return null;
    const r={}, ids=[]; for(const e of list){ const n=e&&(e[1]|0); if(n>0&&typeof e[0]==='string'&&!(e[0] in r)){ r[e[0]]=n; ids.push(e[0]); } }
    ids.sort();
    const tr=TREES[hero], pts={}; if(tr) for(const id of ids){ const t=tr.of[id]; if(t!=null) pts[tr.ids[t]]=(pts[tr.ids[t]]||0)+r[id]; }
    const live=row=>!((row.req&&!r[row.req])||(row.unless&&r[row.unless])||(row.pts&&!((pts[row.pts[0]]||0)>=row.pts[1])));
    const NEED=M.needs||{}, has=id=>!NEED[id]||!!r[NEED[id]];              // needs: {talent: the talent that introduces what it improves} - without that one it does nothing
    const P={}; let any=false;
    for(const id of ids){ const rows=M.talents[id]; if(!rows) continue; any=true; if(!has(id)) continue;
      for(const row of rows) if(row.param&&live(row)) P[row.param]=(P[row.param]||0)+rv(row.add,r[id],{},r); }
    if(!any) return null;
    const T={hero,r,pts,P,on:{},stats:[],auras:[],st:{},fn:M.fn||{},watch:false,
      s:{k:{},w:{},lim:{},m:{},ml:{},roll:{},ap:{},z:{},zn:{},tm:[],au:[],later:[],cur:null,wave:0,undy:0,d:0,fresh:true,moved:false}};
    for(const k in (M.states||{})) T.st[k]=rv(M.states[k],0,P,r);
    const add=(id,row,i,rank)=>{ if(row.param||!live(row)) return; const c=rv(row,rank,P,r); c.key=id+'#'+i; c.id=id;
      if(c.stat){ (c.to?T.auras:T.stats).push(c); if(c.stat.nrg) T.nrg=true; return; }
      for(const ev of (Array.isArray(c.on)?c.on:[c.on])) (T.on[ev]=T.on[ev]||[]).push(c); };
    (M.always||[]).forEach((row,i)=>add('',row,i,1));
    for(const id of ids){ const rows=M.talents[id]; if(rows&&has(id)) rows.forEach((row,i)=>add(id,row,i,r[id])); }
    if(M.casting){ T.on.kit=T.on.kit||[]; T.on.cast=T.on.cast||[]; }        // the hero's rows ask "which skill is this hit from": keep the two skill hooks on
    if(T.on.healed||T.on.hotEnd) T.on.healOut=T.on.healOut||[];              // rows about her heals landing: the healOut hook must run for every heal of hers
    if(T.on.skillAt) T.on.skillTgt=T.on.skillTgt||[];                         // rows about a skill's chosen target: the skillTgt hook must run
    for(const k in T.st){ const d=T.st[k]; if(d.start==='max') T.s.k[k]={n:stMax(T,u,k),t:0,idle:0}; }   // a pool that starts full (Vireo's Strings)
    T.watch=!!(T.on.death||T.on.teamIn||T.on.teamHeal||T.on.teamLethal||M.watch===true||(Array.isArray(M.watch)&&M.watch.some(id=>r[id])));   // watch: true, or the talents whose rows read what other units remember ('lastHit')
    u._tal=T; return T; }

  /* ---- named stacks / pools (T.st[name] = {max, dur, fade:{after,every,lose,unless}, wave:'reset'}) ---- */
  const stGet=(T,name)=>{ const k=T.s.k[name]; return k?k.n:0; };
  function stMax(T,u,name){ const d=T.st[name]; return (!d||d.max==null)?Infinity:amtOf(T,u,d.max,null); }
  function stSet(T,u,name,n){ const d=T.st[name]||{}, k=T.s.k[name]||(T.s.k[name]={n:0,t:0,idle:0}); const was=k.n;
    k.n=Math.max(0,Math.min(stMax(T,u,name),n)); if(k.n>was){ k.idle=0; if(d.dur) k.t=d.dur; }
    if(d.refill&&k.n<was){ const rf=k.rf||(k.rf=[]), at=E.now()+amtOf(T,u,d.refill,null); for(let i=Math.round(was-k.n);i>0;i--) rf.push(at); }   // refill: each unit spent comes back on its own after that many seconds
    return k.n-was; }
  /* stacks a hero keeps ON OTHER UNITS (states.<name> = {unit:true, max, dur, step, gain:'event', full:'event', chain}: Vireo's Dissonance). Stored with her marks
     (t._talM[uid]['#'+name] = {v, until}); all of it lapses `dur` after the last gain, or with `step` one stack at a time, `step` seconds apart. Read lazily (no tick). */
  function ustGet(T,u,t,name){ const o=t&&t._talM&&t._talM[u.uid], m=o&&o['#'+name]; if(!m) return 0; const now=E.now();
    if(now>=m.until){ const st=(T.st[name]&&T.st[name].step)||0; if(!(st>0)){ delete o['#'+name]; return 0; }
      const k=Math.floor((now-m.until)/st+1e-9)+1; m.v-=k; m.until+=k*st; if(m.v<=0){ delete o['#'+name]; return 0; } }
    return m.v; }
  function ustPut(T,u,t,name,n,dur){ const M=t._talM||(t._talM={}), o=M[u.uid]||(M[u.uid]={}); if(!(n>0)){ delete o['#'+name]; return; }
    const d=T.st[name]||{}, p=o['#'+name]; let until=E.now()+(dur!=null?dur:amtOf(T,u,d.dur||Infinity,null));
    if(d.longest&&p&&p.until>until) until=p.until;                                // longest: a gain never shortens a longer lapse (Vex's Deep Wounds: the 6 s ones and the wound's own)
    o['#'+name]={v:n,until}; }
  /* a unit stack reached its max: the state's `full` event. Inside such an event a further unit reaching max is set off only while the cascade allowance
     (`chain`) lasts, and after the current one (no re-entry): one at a time, in order. */
  function ustFull(T,u,t,d,ctx){ const s=T.s; if(!d.full||!T.on[d.full]) return;
    if(s.fq){ if(s.fb>0&&s.fq.indexOf(t)<0){ s.fb--; s.fq.push(t); } return; }
    s.fq=[t]; s.fb=amtOf(T,u,d.chain||0,null);
    try{ while(s.fq.length){ const x=s.fq.shift(); if(x.alive) run(T,u,d.full,Object.assign({},ctx,{tgt:x,unit:x})); } } finally{ s.fq=null; } }
  const ustField=(T,u,name)=>{ let n=0; const U=E.units(); for(let i=0;i<U.length;i++){ const x=U[i]; if(x.alive&&x.team!==u.team) n+=ustGet(T,u,x,name); } return n; };
  const isBoss=x=>!!((x.t&&x.t.isboss)||x._raidBoss);
  const winOn=(T,name)=>{ const w=T.s.w[name]; return !!w&&w.t>0; };

  /* ---- marks: on the OTHER unit, keyed by the owner's uid: t._talM[uid][name] = {t0, until, v} ---- */
  function markOf(u,t,name){ if(!t||!t._talM) return null; const o=t._talM[u.uid], m=o&&o[name]; if(!m) return null;
    if(m.until!=null&&E.now()>=m.until){ delete o[name]; return null; } return m; }
  function setMark(T,u,t,name,a){ if(!t) return; const now=E.now(); a=a||{};
    if(a.unique){ const old=T.s.m[name]; if(old&&old!==t&&old.alive&&old._talM&&old._talM[u.uid]) delete old._talM[u.uid][name]; T.s.m[name]=t; }
    if(a.cap!=null){ const L=T.s.ml[name]||(T.s.ml[name]=[]), n=Math.max(1,Math.floor(a.cap+1e-9));   // cap: at most n units carry it; a new one pushes out the one renewed longest ago
      for(let i=L.length-1;i>=0;i--) if(!L[i].alive||!markOf(u,L[i],name)) L.splice(i,1);
      const j=L.indexOf(t); if(j>=0) L.splice(j,1); else while(L.length>=n){ const o=L.shift(); clearMark(u,o,name); } L.push(t); }
    const M=t._talM||(t._talM={}), o=M[u.uid]||(M[u.uid]={}), prev=o[name];
    const live=prev&&(prev.until==null||now<prev.until);                     // marking the same unit again keeps the mark's age
    let until=a.dur!=null?now+a.dur:null; if(a.longest&&live&&(prev.until==null||(until!=null&&prev.until>until))) until=prev.until;   // longest: a shorter mark never cuts a longer one
    o[name]={t0:live?prev.t0:now,until,v:prev?prev.v:0}; }
  function clearMark(u,t,name){ if(t&&t._talM&&t._talM[u.uid]) delete t._talM[u.uid][name]; }
  /* a mark with a clock that tells its owner when it is over: {mark, dur, while:'field of the holder that must stay above 0', ends:'event'}.
     The owner's tick ends it when the time is up or the field ran out first; {mark, clear:true, fire:true} ends it now. ctx.broke: it ended before
     its time (the field ran out, or a talent cut it). A holder that died is dropped silently. */
  function timedMark(T,u,t,name,a,ctx){ const d=amtOf(T,u,a.dur,ctx); if(!(d>0)) return; setMark(T,u,t,name,{dur:d,unique:a.unique}); const tm=T.s.tm;
    for(let i=0;i<tm.length;i++) if(tm[i].t===t&&tm[i].name===name){ tm[i].until=E.now()+d; tm[i].w=a.while||null; tm[i].ends=a.ends; return; }
    tm.push({t,name,until:E.now()+d,w:a.while||null,ends:a.ends}); }
  function endMark(T,u,t,name,fire,ctx){ const tm=T.s.tm; let e=null; for(let i=0;i<tm.length;i++) if(tm[i].t===t&&tm[i].name===name){ e=tm[i]; tm.splice(i,1); break; }
    const had=!!markOf(u,t,name); clearMark(u,t,name); if(fire&&e&&had&&e.ends&&T.on[e.ends]) run(T,u,e.ends,Object.assign({},ctx,{u,tgt:t,unit:t,broke:true})); }
  function tickMarks(T,u){ const tm=T.s.tm, now=E.now(); for(let i=0;i<tm.length;i++){ const e=tm[i], t=e.t; if(t.alive&&now<e.until-1e-9&&!(e.w&&!(t[e.w]>0))) continue;
      tm.splice(i--,1); const broke=now<e.until-1e-9; clearMark(u,t,e.name); if(t.alive&&e.ends&&T.on[e.ends]) run(T,u,e.ends,{u,tgt:t,unit:t,broke}); } }
  /* ---- ground zones: circles on the field that the owner's rows can ask about. T.s.zn[name] = [{x,y,r (pixels),until,centre}]. A unit is ON a zone
          when any part of its body is over it (centre:true: when its centre is inside, as the engine's own skill circles measure). No picture. ---- */
  function inZone(T,x,name){ const L=T.s.zn[name]; if(!L||!x) return false; const now=E.now();
    for(let i=0;i<L.length;i++){ const z=L[i]; if(now>=z.until) continue; const d=Math.hypot(x.x-z.x,x.y-z.y); if(z.centre?(d<z.r):(d-E.bodyR(x)<z.r)) return true; } return false; }
  const zoneOn=(T,name)=>{ const L=T.s.zn[name]; if(!L) return false; const now=E.now(); for(let i=0;i<L.length;i++) if(now<L[i].until) return true; return false; };
  const myDot=(u,d,tag)=>d._talO===u.uid&&(tag===true||d._talK===tag)&&d.remaining>0;   // tag true: any DoT of hers (her skills' DoTs she tagged, and her talents')
  function hasDot(u,t,tag){ if(!t||!t.dots) return false; for(let i=0;i<t.dots.length;i++) if(myDot(u,t.dots[i],tag)) return true; return false; }
  function countDots(u,tag){ let n=0; const U=E.units(); for(let i=0;i<U.length;i++){ const x=U[i]; if(!x.alive||!x.dots) continue; for(let j=0;j<x.dots.length;j++) if(myDot(u,x.dots[j],tag)) n++; } return n; }

  /* ---- how many (the `per` of a row, the `x` of an amount): 'stackName' | 'windowName' | 'spent' | {stack} | {window} | {markAge,every} | {dots}
          | {roll,step}, each with an optional max ---- */
  function cnt(T,u,per,ctx){ if(per==null) return 1;
    if(typeof per==='string'){ if(per==='spent') return ctx?(ctx.spent||0):0; if(T.st[per]) return stGet(T,per); const w=T.s.w[per]; return (w&&w.t>0)?w.n:0; }
    let n=0;
    if(per.stack){ n=stGet(T,per.stack); if(per.missing) n=Math.max(0,stMax(T,u,per.stack)-n); if(per.over!=null) n=Math.max(0,n-per.over);   // missing: how many short of full; over: how many above that count
      if(per.frac){ const m=stMax(T,u,per.stack); n=(m>0&&m<Infinity)?Math.floor(n/m*per.frac+1e-9):0; }   // frac: whole tenths (frac:10) of the pool that are filled
      if(per.div) n=Math.floor(n/per.div+1e-9); }                                  // div: whole multiples of that (every 3 m)
    else if(per.ust) n=per.of==='field'?ustField(T,u,per.ust):ustGet(T,u,per.of==='unit'?(ctx&&ctx.unit):(ctx&&ctx.tgt),per.ust);   // a unit stack: on the target, or on every enemy of the field
    else if(per.window){ const w=T.s.w[per.window]; n=(w&&w.t>0)?w.n:0; }
    else if(per.markAge){ const m=markOf(u,ctx&&ctx.tgt,per.markAge); n=m?Math.floor((E.now()-m.t0)/(per.every||1)+1e-9):0; }
    else if(per.dots) n=countDots(u,per.dots);
    else if(per.field){ const x=per.of==='self'?u:per.of==='unit'?(ctx&&ctx.unit):per.of==='source'?(ctx&&ctx.src):(ctx&&ctx.tgt); n=x?(+x[per.field]||0):0; }
    else if(per.units) n=pick(T,u,per.units,ctx).length;
    else if(per.fn) n=+T.fn[per.fn](API,T,u,ctx,per)||0;                         // a count the hero file works out (Vael's Blood Rage stacks)
    else if(per.roll){ const q=T.s.roll[per.roll]; let sum=0; if(q){ const t0=E.now()-q.span; for(let i=0;i<q.e.length;i++) if(q.e[i][0]>t0) sum+=q.e[i][1]; } const st=amtOf(T,u,per.step,ctx); n=st>0?Math.floor(sum/st+1e-9):0; }
    if(per.max!=null) n=Math.min(per.max,n); return n; }

  /* ---- an amount: number | {flat, pct, of, x} | {opt:'name of an option of the skill being cast', d: fallback}
          of: maxHp | hp | armor | atk (a basic attack's damage now) | shield | hit (the hit as it landed) | hpLost | overkill | over (overheal)
              | spent (what the enclosing spend / divert / damage took) | lifesteal (what the running lifesteal buff healed off this hit) */
  function baseOf(T,u,of,ctx){ switch(of){
    case 'maxHp': return u.maxHp||0; case 'hp': return Math.max(0,u.hp||0); case 'armor': return u.armorRating||0; case 'shield': return u.shield||0;
    case 'apow': return (u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1);                 // ability power now (with a running damage buff, as the hero's own skills read it)
    case 'tgtMaxHp': return (ctx&&ctx.tgt)?(ctx.tgt.maxHp||0):0;                          // the target's max HP (an ally's shield sized on the ally)
    case 'atk': return (u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*E.rage();
    case 'hit': return ctx?(ctx.amt||0):0; case 'hpLost': return ctx?(ctx.hpLost||0):0; case 'overkill': return ctx?(ctx.overkill||0):0;
    case 'over': return ctx?(ctx.over||0):0; case 'spent': return ctx?(ctx.spent||0):0;
    case 'heal': return ctx?(ctx.heal||0):0;                                              // a heal of hers as it was offered (after her talents and healing power, before the room left)
    case 'lastHeal': return T.s.lh||0;                                                    // the last heal her skill gave one ally, as the skill computed it (before talents and healing power)
    case 'pitch': return ctx?(ctx.raw||0)*E.pitch(u,T.s.cur==='symphony'):0;             // Perfect Pitch's shield for this heal, as the skill writes it
    case 'tgtShield': return (ctx&&ctx.tgt)?(ctx.tgt.shield||0):0;
    case 'lifesteal': return ctx?(ctx.hpLost||0)*((u._lifestealT>0)?(u._lifestealPct||0):0):0;
    case 'dmg': return u.dmg||0;                                                          // her Attack stat as it stands (no running buff, no Blood Rage of the fight)
    case 'passMul': return u.passMul||1;                                                  // her passive's strength at its skill level (the engine's own multiplier)
    case 'gap': return (ctx&&ctx.tgt)?Math.max(0,gap(u,ctx.tgt))/E.METER():0;              // metres between her body and the target's
    case 'a0': return ctx?(ctx.a0||0):0;                                                 // a heal on a watched unit as it reached the talent rows
    case 'cut': return ctx?Math.max(0,(ctx.a0||0)-(ctx.amt||0)):0;                       // what the rows before have cut from that heal
    default: return 0; } }
  function amtOf(T,u,a,ctx){ if(typeof a==='number') return a; if(!a) return 0;
    if(a.left){ const x=a.of==='unit'?(ctx&&ctx.unit):(ctx&&ctx.tgt), m=markOf(u,x,a.left); return (m&&m.until!=null)?Math.max(0,m.until-E.now()):0; }   // left: the seconds that mark of hers has left on that unit
    if(a.opt) return ((ctx&&ctx.o&&typeof ctx.o[a.opt]==='number'&&ctx.o[a.opt])||a.d||0)*(a.mul==null?1:a.mul);
    if(a.field||a.units||a.stack||a.ust) return cnt(T,u,a,ctx);
    let x=(a.flat||0)+(a.pct?a.pct*baseOf(T,u,a.of,ctx):0); if(a.x!=null) x*=cnt(T,u,a.x,ctx); if(a.k&&ctx&&ctx.k!=null) x*=ctx.k; return x; }

  /* ---- who: 'self' | 'target' | 'source' | 'unit' | 'holder:<mark>' | {team:'enemy'|'ally', of:'self'|'target'|'unit'|'source', within: metres,
          withinOpt:'radius', n, skipN, skip:'target'|'unit'|'self', others:true, order:'near'|'lowHp', has:'mark', hpBelow, fearedBy:true, centre:true}
          DISTANCE: `within` is measured BODY TO BODY (the gap between the two units' bodies). A hero's body is 1.6 to 2 m in radius, so two units
          that touch are about 3.6 m apart centre to centre: "within 3 m" measured between centres would hold nobody. `withinOpt` (the radius of the
          skill being cast) and `centre:true` measure centre to centre, as the engine's own skills do. ---- */
  function pick(T,u,sel,ctx){
    if(sel==null||sel==='target') return (ctx&&ctx.tgt)?[ctx.tgt]:[]; if(sel==='self') return [u];
    if(sel==='source') return (ctx&&ctx.src)?[ctx.src]:[]; if(sel==='unit') return (ctx&&ctx.unit)?[ctx.unit]:[];
    if(sel==='lastHit'){ const b=ctx&&ctx.tgt&&ctx.tgt._talBy; return (b&&b.alive&&b.team!==u.team)?[b]:[]; }       // the enemy that last hit the unit the event is about
    if(sel==='lowestAlly'){ const x=E.lowestAlly(u); return x?[x]:[]; }                 // the ally the engine itself picks as the most wounded (Harmony's centre)
    if(typeof sel==='string'){ if(sel.slice(0,7)==='holder:'){ const nm=sel.slice(7), h=T.s.m[nm]; return (h&&h.alive&&markOf(u,h,nm))?[h]:[]; } return []; }
    const ref=o=>o==='target'?(ctx&&ctx.tgt):o==='unit'?(ctx&&ctx.unit):o==='source'?(ctx&&ctx.src):o==='self'?u:null;
    const c=ref(sel.of||'self'); if(!c) return [];
    const skip=sel.skip?ref(sel.skip):null, foe=sel.team!=='ally';
    const R=sel.within!=null?sel.within*E.METER():(sel.withinOpt?(((ctx&&ctx.o&&ctx.o[sel.withinOpt])||0)+(sel.withinAdd||0)*E.METER()):Infinity);   // withinAdd: metres beyond the skill's own reach
    const sb=sel.seg?(ctx&&ctx.tgt):null; if(sel.seg&&!sb) return [];                // seg: the units whose body the straight line from `of` to the target crosses (within: metres of slack)
    const out=[], U=E.units();
    let bh=null; if(sel.behind){ let sx=0,sy=0,k=0; for(let i=0;i<U.length;i++){ const x=U[i]; if(x.alive&&x.team!==u.team){ sx+=x.x; sy+=x.y; k++; } } if(!k) return []; bh={x:sx/k,y:sy/k}; bh.d=Math.hypot(c.x-bh.x,c.y-bh.y); }   // behind: farther from the enemy side (the middle of the living enemies) than `of`
    for(let i=0;i<U.length;i++){ const x=U[i]; if(!x.alive||x===skip||x._dropHidden||x._noTarget) continue;
      if(foe?(x.team===u.team):(x.team!==u.team)) continue;
      if(!foe&&(x._summon||(sel.others&&x===u))) continue;
      if(sel.has&&!markOf(u,x,sel.has)) continue;
      if(sel.lacks&&markOf(u,x,sel.lacks)) continue;
      if(sel.ust){ let okU=true; for(const k in sel.ust) if(ustGet(T,u,x,k)<sel.ust[k]) okU=false; if(!okU) continue; }   // carries at least that many of her unit stacks
      if(sel.ctrl&&!CLEANSE.some(f=>(x[f]||0)>0)) continue;                         // is under a control effect
      if(sel.boss!=null&&isBoss(x)!==sel.boss) continue;
      if(sel.below){ let okB=true; for(const f in sel.below) if(!((+x[f]||0)<sel.below[f])) okB=false; if(!okB) continue; }
      if(sel.min&&!fmin(x,sel.min)) continue;
      if(sel.inZone&&!inZone(T,x,sel.inZone)) continue;
      if(sel.hpBelow!=null&&!(x.hp<sel.hpBelow*x.maxHp)) continue;
      if(sel.dot!=null&&!hasDot(u,x,sel.dot)) continue;                              // carries a DoT of hers (true: any)
      if(sel.seg){ if(!(segDist(x,c,sb)-E.bodyR(x)<R)) continue; out.push([x,E.dist(c,x)]); continue; }
      if(sel.fearedBy&&!((x.fearT||0)>0&&x._fearFrom===u)) continue;
      if(bh&&!(Math.hypot(x.x-bh.x,x.y-bh.y)>bh.d)) continue;
      const d=E.dist(c,x); if(!((sel.withinOpt||sel.centre)?(d<R):(x===c||d-E.bodyR(c)-E.bodyR(x)<R))) continue; out.push([x,d]); }
    const od=typeof sel.order==='string'?sel.order:'';
    if(od==='lowHp') out.sort((a,b)=>a[0].hp-b[0].hp);
    else if(od==='lowMax') out.sort((a,b)=>(a[0].maxHp||0)-(b[0].maxHp||0));        // the most fragile first (the lowest max HP, as Hookline itself ranks them)
    else if(od.slice(0,5)==='high:'){ const f=od.slice(5); out.sort((a,b)=>(+b[0][f]||0)-(+a[0][f]||0)); }              // the highest engine number first ('high:dmg': the highest attack)
    else if(od.slice(0,5)==='most:'){ const nm=od.slice(5); out.sort((a,b)=>ustGet(T,u,b[0],nm)-ustGet(T,u,a[0],nm)); }   // the most of her unit stacks first
    else if(od==='near'||sel.n) out.sort((a,b)=>a[1]-b[1]);   // stable: ties keep the units' own order
    const from=sel.skipN||0; return (sel.n?out.slice(from,from+sel.n):out.slice(from)).map(e=>e[0]); }

  function segDist(p,a,b){ const dx=b.x-a.x, dy=b.y-a.y, L=dx*dx+dy*dy; let k=L>0?((p.x-a.x)*dx+(p.y-a.y)*dy)/L:0; k=Math.max(0,Math.min(1,k)); return Math.hypot(p.x-(a.x+dx*k),p.y-(a.y+dy*k)); }
  /* ---- conditions (the `if` of a row or of an action; all must hold) ---- */
  const COND={
    auto:(T,u,v,c)=>!!c.auto===v,                         // a basic attack
    crit:(T,u,v,c)=>!!c.crit===v,
    skill:(T,u,v,c)=>c.skill===v,                         // the skill being cast (its effect type string)
    tag:(T,u,v,c)=>c.tag===v,                             // the DoT's tag
    cc:(T,u,v,c)=>v.indexOf(c.field)>=0,                  // the control's field: 'stunned','fearT','slow','silencedT'
    who:(T,u,v,c)=>{ const x=c.unit; if(!x) return false; return v==='self'?x===u:(v==='ally'?(x.team===u.team&&x!==u&&!x._summon):x.team!==u.team); },
    unitHas:(T,u,v,c)=>!!markOf(u,c.unit,v),
    targetHas:(T,u,v,c)=>!!markOf(u,c.tgt,v),
    srcHas:(T,u,v,c)=>!!markOf(u,c.src,v),
    holderAlive:(T,u,v)=>{ const h=T.s.m[v]; return !!(h&&h.alive&&markOf(u,h,v)); },
    targetDot:(T,u,v,c)=>hasDot(u,c.tgt,v),
    anyDot:(T,u,v)=>countDots(u,v)>0,
    targetTeam:(T,u,v,c)=>!!c.tgt&&((c.tgt.team!==u.team)===(v==='enemy')),
    srcTeam:(T,u,v,c)=>!!c.src&&((c.src.team!==u.team)===(v==='enemy')),
    srcMelee:(T,u,v,c)=>!!c.src&&(!!c.src.melee===v),
    targetHpBelow:(T,u,v,c)=>!!c.tgt&&c.tgt.hp<v*c.tgt.maxHp,
    selfHpBelow:(T,u,v)=>u.hp<v*u.maxHp,
    selfHpAbove:(T,u,v)=>u.hp>v*u.maxHp,
    stackMin:(T,u,v)=>{ for(const k in v) if(stGet(T,k)<v[k]) return false; return true; },
    stackFull:(T,u,v)=>{ const n=stGet(T,v); return n>0&&n>=stMax(T,u,v)-1e-9; },
    stackEmpty:(T,u,v)=>!(stGet(T,v)>0),
    window:(T,u,v)=>winOn(T,v),
    noWindow:(T,u,v)=>!winOn(T,v),
    hitMin:(T,u,v,c)=>(c.amt||0)>=amtOf(T,u,v,c),         // the hit, as it is about to land / as it landed
    lostMin:(T,u,v,c)=>(c.hpLost||0)>=amtOf(T,u,v,c),     // the HP it took off
    lostBelow:(T,u,v,c)=>(c.hpLost||0)<amtOf(T,u,v,c),
    overMin:(T,u,v,c)=>(c.over||0)>v,
    moved:(T,u,v)=>T.s.moved===v,
    casting:(T,u,v)=>Array.isArray(v)?v.indexOf(T.s.cur)>=0:T.s.cur===v,   // the skill of his that is resolving right now (null: none - a basic attack, a channel's tick)
    srcFlag:(T,u,v,c)=>!!(c.src&&c.src[v]),                 // an engine flag on the attacker for this hit ('_frostHit': a frost ability)
    selfPass:(T,u,v)=>!!(u.pass&&u.pass[v]),                // the hero's passive is unlocked
    targetMin:(T,u,v,c)=>fmin(c.tgt,v), unitMin:(T,u,v,c)=>fmin(c.unit,v), srcMin:(T,u,v,c)=>fmin(c.src,v),   // an engine counter on that unit: {field: at least}
    targetIn:(T,u,v,c)=>inZone(T,c.tgt,v),                  // the target stands on one of his ground zones of that name
    zone:(T,u,v)=>zoneOn(T,v),                              // a ground zone of that name is down
    targetLacks:(T,u,v,c)=>!markOf(u,c.tgt,v),
    noHolder:(T,u,v)=>{ const h=T.s.m[v]; return !(h&&h.alive&&markOf(u,h,v)); },
    targetHpAbove:(T,u,v,c)=>!!c.tgt&&c.tgt.hp>v*c.tgt.maxHp,
    srcIs:(T,u,v,c)=>{ const x=c.src; if(!x) return false; return v==='self'?x===u:(v==='ally'?(x.team===u.team&&x!==u):x.team!==u.team); },
    srcWithin:(T,u,v,c)=>!!c.src&&gap(u,c.src)<v*E.METER(), srcBeyond:(T,u,v,c)=>!!c.src&&gap(u,c.src)>v*E.METER(),   // body to body, from the owner
    broke:(T,u,v,c)=>!!c.broke===v,                         // how a timed mark ended: its field ran out (or a talent cut it) before its time
    talent:(T,u,v,c)=>!!c.talent===v,                       // the control comes from a talent action (not from a skill of the hero)
    some:(T,u,v,c)=>pick(T,u,v,c).length>0,                 // at least one unit matches the selector
    targetWithin:(T,u,v,c)=>!!c.tgt&&gap(u,c.tgt)<v*E.METER(), unitWithin:(T,u,v,c)=>!!c.unit&&gap(u,c.unit)<v*E.METER(),
    kind:(T,u,v,c)=>c.kind===v,                             // the hit's damage kind ('magic', 'phys')
    hot:(T,u,v,c)=>!!c.hot===v,                             // the heal is a tick of a heal over time (not the skill's own heal)
    p:(T,u,v)=>!!T.P[v],                                    // a named number some learned talent adds to (a row that only matters when one of them is learned)
    targetUst:(T,u,v,c)=>{ for(const k in v) if(ustGet(T,u,c.tgt,k)<v[k]) return false; return true; },   // the target carries at least that many of her unit stacks
    targetIs:(T,u,v,c)=>!!c.tgt&&pick(T,u,v,c).indexOf(c.tgt)>=0,   // the target is one of the units the selector picks ("the lowest-HP Listening ally")
    atLeast:(T,u,v,c)=>pick(T,u,v.of,c).length>=v.n,       // at least n units match
    none:(T,u,v,c)=>pick(T,u,v,c).length===0,               // no unit matches
    hero:(T,u,v,c)=>!!c.tgt&&!c.tgt._summon===v,            // the target is a hero, not a summon
    any:(T,u,v,c)=>v.some(x=>ok(T,u,x,c)),                  // at least one of these condition sets holds ("Snagged or Blindsided")
    np:(T,u,v)=>!T.P[v],                                    // no learned talent adds to that named number (a fork that switches a behaviour off)
    selfMin:(T,u,v)=>fmin(u,v),                             // an engine counter on the owner: {field: at least}
    unitUst:(T,u,v,c)=>{ for(const k in v) if(ustGet(T,u,c.unit,k)<v[k]) return false; return true; },
    unitDot:(T,u,v,c)=>hasDot(u,c.unit,v),                  // the unit the event is about carries a DoT of hers
    targetRow:(T,u,v,c)=>!!(c.tgt&&c.tgt.t&&c.tgt.t.row===v), // the game's own combat row of that hero ('Back'); a monster has none
    targetAlive:(T,u,v,c)=>!!c.tgt&&!!c.tgt.alive===v,     // the target still stands (a strike may have killed it)
    tgtNone:(T,u,v,c)=>!c.tgt===v,                          // the skill found no target
    dropBelow:(T,u,v,c)=>u.hp>=v*u.maxHp&&(u.hp+(u.shield||0)-(c.amt||0))<v*u.maxHp,   // this hit, as it reaches her (after armor, through her shield), would take her below that share
    fn:(T,u,v,c)=>!!T.fn[v](API,T,u,c)
  };
  const fmin=(x,v)=>{ if(!x) return false; for(const f in v) if(!((+x[f]||0)>=v[f])) return false; return true; };
  const gap=(a,b)=>E.dist(a,b)-E.bodyR(a)-E.bodyR(b);
  function ok(T,u,cond,ctx){ for(const k in cond){ const f=COND[k]; if(!f||!f(T,u,cond[k],ctx)) return false; } return true; }

  /* ---- a row at its event: conditions, limiters, then its modifiers and its actions ----
     limiters: edge (fires when `if` turns true) | period+rate (fires each `period` s the `if` has held; tick only) | once:'wave'|'fight' | uses:n
               | icd: seconds | every: n (each n-th time) | chance: p (the only place the seeded stream is drawn, and last, so nothing else changes how often) */
  const PROC_SKIP={out:1,hit:1,crit:1,heal:1};          // a row does not react to what the hero's own talent actions do, unless it says procs:true
  function run(T,u,ev,ctx){ const rows=T.on[ev]; if(!rows) return; const s=T.s;
    const st0=ctx.stop; if(st0) ctx.stop=false;           // an event set off after a row said "stop" (a save, then its 'encore') still runs all its rows; the stop is kept for the outer event
    try{ runRows(T,u,ev,ctx,rows,s); } finally{ if(st0) ctx.stop=true; } }
  function runRows(T,u,ev,ctx,rows,s){
    for(let i=0;i<rows.length;i++){ const row=rows[i]; const L0=s.lim[row.key]||(s.lim[row.key]={t:0,n:0,c:0,w:-1,was:false,acc:0,busy:0,by:null});
      if(L0.busy) continue;                               // never re-entered by its own consequences
      if(ctx.proc&&!row.procs&&PROC_SKIP[ev]) continue;
      if(ctx.viaDot&&!row.dots) continue;                 // a kill by a DoT tick counts only for rows that say dots:true
      if(row.skill&&ctx.skill!==row.skill) continue;
      /* each:<who> - the row is asked once for every such unit (it becomes the row's target) and keeps its limiters per unit;
         by:'source'|'target'|'unit' - one event, but the limiters are kept per that unit ("once per enemy every 4 s") */
      if(row.each){ const us=pick(T,u,row.each,ctx), by=L0.by||(L0.by={});
        for(let j=0;j<us.length;j++){ const x=us[j]; fire(T,u,row,ev,Object.assign({},ctx,{tgt:x}),by[x.uid]||(by[x.uid]={t:0,n:0,c:0,w:-1,was:false,acc:0}),L0); }
        continue; }
      let L=L0; if(row.by){ const x=row.by==='source'?ctx.src:row.by==='unit'?ctx.unit:ctx.tgt; if(!x) continue; const by=L0.by||(L0.by={}); L=by[x.uid]||(by[x.uid]={t:0,n:0,c:0,w:-1,was:false,acc:0}); }
      fire(T,u,row,ev,ctx,L,L0);
      if(ctx.stop) break; } }
  function fire(T,u,row,ev,ctx,L,L0){ const s=T.s;
      const pass=!row.if||ok(T,u,row.if,ctx);
      if(row.edge){ const was=L.was; L.was=pass; if(!pass||was) return; }
      else if(row.period){ if(!pass){ L.acc=0; return; } let rt=row.rate==null?1:row.rate;
        if(row.rateUp) for(let q=0;q<row.rateUp.length;q++){ const x=row.rateUp[q]; if(x.if&&!ok(T,u,x.if,ctx)) continue; rt+=x.add*(x.per!=null?cnt(T,u,x.per,ctx):1); }   // rateUp: the clock runs that much faster while each condition holds (or per stack)
        L.acc+=(ctx.dt||0)*rt; if(L.acc<row.period-1e-9) return; L.acc-=row.period; }
      else if(!pass) return;
      if(row.once==='wave'&&L.w===s.wave) return;
      if(row.once==='fight'&&L.n>0) return;
      if(row.uses&&L.n>=row.uses) return;
      if(row.icd&&E.now()<L.t) return;
      if(row.every){ if(++L.c<row.every) return; L.c=0; }
      if(row.chance!=null){ const p=typeof row.chance==='number'?row.chance:amtOf(T,u,row.chance,ctx); if(!(p>0)||!(E.rnd()<p)) return; }   // an amount: a chance the fight works out now (her dodge chance)
      L.n++; L.w=s.wave; if(row.icd) L.t=E.now()+row.icd;
      modify(T,u,row,ctx);
      if(row.do){ L0.busy=1; s.d++; try{ acts(T,u,row.do,ctx); } finally{ s.d--; L0.busy=0; } } }

  /* modifiers: change the number the event carries (damage, heal, cooldown, control seconds) or the options of the skill being cast */
  function modify(T,u,row,ctx){
    const n=(row.per!=null?cnt(T,u,row.per,ctx):1)*(row.scale==null?1:row.scale);
    if(row.more!=null) ctx.amt*=1+row.more*n;
    if(row.less!=null) ctx.amt*=Math.max(0,1-row.less*n);
    if(row.mul!=null){ ctx.amt*=row.mul; if(row.mul===0) ctx.mv=0; }   // a hit made to deal nothing ("cannot be hurt") is immunity, not reduction: the 95% ceiling leaves it at 0
    if(row.add!=null) ctx.amt+=row.add*n;
    if(row.critMore!=null&&ctx.crit) ctx.amt*=1+row.critMore*n;
    if(row.ignoreArmor!=null&&ctx.kind==='phys'&&ctx.tgt&&ctx.src){ const src=ctx.src, a=E.defMul(src,ctx.tgt,'phys');
      if(a>0){ const sv=src._wpnArmIgn; src._wpnArmIgn=1-(1-(sv||0))*(1-Math.min(1,row.ignoreArmor*n)); const b=E.defMul(src,ctx.tgt,'phys'); src._wpnArmIgn=sv; ctx.amt*=b/a; } }
    if(row.ignoreMr!=null&&ctx.kind==='magic'&&ctx.tgt&&ctx.src){ const t=ctx.tgt, a=E.defMul(ctx.src,t,'magic');     // the hit ignores that share of the target's magic resist
      if(a>0){ const sv=t.mrRating; t.mrRating=(sv||0)*Math.max(0,1-row.ignoreMr*n); const b=E.defMul(ctx.src,t,'magic'); t.mrRating=sv; ctx.amt*=b/a; } }
    if(row.addM!=null) ctx.amt+=row.addM*n*E.METER();                              // metres, for a number the engine keeps in its own length unit
    if(row.divert!=null){ const cut=ctx.amt*Math.min(1,row.divert*n);            // the owner takes this share of the hit in the target's place
      if(cut>0){ ctx.amt-=cut; ctx.mv=(ctx.mv==null?1:ctx.mv)*(1-Math.min(1,row.divert*n)); E.damage(u,cut,'#ffb37a',true); if(T.on.diverted) run(T,u,'diverted',Object.assign({},ctx,{spent:cut})); } }
    if(row.force) ctx.force=true;
    if(row.opt&&ctx.o) for(const k in row.opt){ const op=row.opt[k], m=op.per!=null?cnt(T,u,op.per,ctx):1; let v=ctx.o[k];
      if(op.set!=null) v=op.set;
      if(op.add!=null) v=(v||0)+op.add*m/(op.ccRaw?(E.ccDur(1)||1):1);       // ccRaw: seconds as the player gets them (the engine shortens every control afterwards)
      if(op.addM!=null) v=(v||0)+op.addM*m*E.METER();                           // metres, for an option the engine keeps in its own length unit (a reach)
      if(op.mul!=null) v=(v||0)*op.mul;
      if(op.more!=null) v=(v||0)*(1+op.more*m);                                  // more: x (1 + x per count) - "the shield is 1% larger per Bar"
      if(op.bonus!=null) v=1+((v||1)-1)*(1+op.bonus*m);                        // strengthens the part above 1 (a "+10%" multiplier of 1.1)
      ctx.o[k]=v; } }

  /* damage a talent itself deals: taken straight off the target (like a DoT tick: the stated amount, no second pass through Blood Rage,
     crit or lifesteal, and no seeded draw); the target's own shield and damage reduction still apply. Returns the HP it removed. */
  function hurt(T,u,t,a,color,tag){ if(!t||!t.alive||!(a>0)) return 0; const hp0=t.hp; E.damage(t,a,color||'#ffb37a',true);
    const lost=Math.max(0,hp0-Math.max(0,t.hp));
    if(!t.alive&&hp0>0&&T.on.kill) run(T,u,'kill',{u,src:u,tgt:t,amt:a,hpLost:lost,overkill:Math.max(0,-t.hp),proc:true,tag});
    return lost; }

  /* a control effect a talent states in seconds: shortened / lengthened by the same rows as any other control (ccIn of the one struck, ccOut of the owner),
     cut to the engine's cap, written straight onto the unit, then told to the owner's 'ccHit' rows (a control that landed) */
  function control(T,u,t,field,secs,asIs){ let d=asIs?secs:cc(u,t,field,secs,true); const cap=E.ccCap(field); if(cap&&d>cap) d=cap; if(!(d>0)) return;   // asIs: seconds copied from a control that already landed (no second pass through ccOut)
    t[field]=Math.max(t[field]||0,d); if(T.on.ccHit) run(T,u,'ccHit',{u,src:u,tgt:t,field,amt:d,talent:true}); }
  function acts(T,u,list,ctx){ for(let i=0;i<list.length;i++){ const a=list[i]; if(a.if&&!ok(T,u,a.if,ctx)) continue; if(act(T,u,a,ctx)===false) break; } }
  const CLEANSE=['stunned','fearT','silencedT','_sleepT','slow'];
  function act(T,u,a,ctx){ const s=T.s;
    if(a.stack){ const have=stGet(T,a.stack);
      if(a.spend!=null){ const n=a.spend==='all'?have:a.spend; if(a.spend!=='all'&&have<n) return false; if(!(n>0)) return;
        stSet(T,u,a.stack,have-n); if(a.then) acts(T,u,a.then,Object.assign({},ctx,{spent:n})); return; }
      if(a.touch){ const k=s.k[a.stack], d=T.st[a.stack]; if(k){ k.idle=0; if(k.n>0&&d&&d.dur) k.t=d.dur; } return; }   // touch: its lapse starts again, and its fade waits again (as a gain would)
      if(a.refillIn!=null){ const k=s.k[a.stack]; if(k&&k.rf){ const at=E.now()+a.refillIn; for(let i=0;i<k.rf.length;i++) if(k.rf[i]>at) k.rf[i]=at; } return; }   // every spent unit comes back that soon
      if(a.set!=null){ stSet(T,u,a.stack,a.set==='max'?stMax(T,u,a.stack):amtOf(T,u,a.set,ctx)); return; }
      if(a.keep!=null){ const n=have*Math.max(0,Math.min(1,a.keep)); stSet(T,u,a.stack,a.whole?Math.floor(n+1e-9):n); return; }   // keep that share (whole: rounded down)
      if(a.atLeast!=null){ const x=amtOf(T,u,a.atLeast,ctx); if(have<x) stSet(T,u,a.stack,x); return; }
      const got=stSet(T,u,a.stack,have+amtOf(T,u,a.add==null?1:a.add,ctx));
      if(a.full&&got>0&&stGet(T,a.stack)>=stMax(T,u,a.stack)-1e-9) acts(T,u,a.full,ctx);
      return; }
    if(a.mark){ const ts=pick(T,u,a.on,ctx); for(const t of ts){ if(a.clear){ if(a.fire!=null) endMark(T,u,t,a.mark,a.fire,ctx); else clearMark(u,t,a.mark); }
        else if(a.ends||a.while) timedMark(T,u,t,a.mark,a,ctx);
        else { const had=a.added?!!markOf(u,t,a.mark):true; setMark(T,u,t,a.mark,typeof a.dur==='object'?Object.assign({},a,{dur:amtOf(T,u,a.dur,ctx)}):a);
          if(!had&&T.on[a.added]) run(T,u,a.added,Object.assign({},ctx,{tgt:t})); } } return; }   // added: an event when the unit did not carry it before (newly on her list)
    if(a.zone){ const L=s.zn[a.zone]||(s.zn[a.zone]=[]);
      const at=a.at||'target', c=typeof at==='object'?{x:u[at.x],y:u[at.y]}:pick(T,u,at,ctx)[0]; if(!c||c.x==null) return;
      const now=E.now(); for(let i=L.length-1;i>=0;i--) if(a.only||now>=L[i].until) L.splice(i,1); if(L.length>=24) L.shift();   // only: this one replaces the ones still down
      L.push({x:c.x,y:c.y,r:a.radiusPx!=null?amtOf(T,u,a.radiusPx,ctx):amtOf(T,u,a.radius,ctx)*E.METER(),until:now+amtOf(T,u,a.dur,ctx),centre:!!a.centre}); return; }   // radiusPx: a radius already in the engine's length unit (a skill's own `radius` option)
    if(a.ustack){ const d=T.st[a.ustack]||{}, mx=d.max==null?Infinity:d.max, burst=[];
      if(a.touch){ for(const t of pick(T,u,a.on,ctx)){ const v=ustGet(T,u,t,a.ustack); if(v>0) ustPut(T,u,t,a.ustack,v); } return; }   // touch: what it carries lapses again from now ("refreshed with the wound")
      for(const t of pick(T,u,a.on,ctx)){ if(!t.alive) continue;
        if(a.set!=null){ ustPut(T,u,t,a.ustack,a.set==='max'?mx:Math.min(mx,amtOf(T,u,a.set,ctx))); if(a.burst) burst.push(t); continue; }   // set (burst: then each one's `full` event, after all are set)
        if(a.lock&&markOf(u,t,a.lock)) continue;                                                       // lock: each unit at most once every lockDur seconds from this action
        const was=ustGet(T,u,t,a.ustack), add=amtOf(T,u,a.add==null?1:a.add,ctx); if(!(add>0)) continue;
        const lim=a.cap!=null?Math.min(mx,Math.max(a.cap,was)):mx, nw=Math.min(lim,was+add), got=nw-was; ustPut(T,u,t,a.ustack,nw,a.dur); if(a.lock) setMark(T,u,t,a.lock,{dur:a.lockDur||1});   // cap: this action fills it only up to n; dur: this gain's own lapse
        if(got>0){ const c2=Object.assign({},ctx,{tgt:t,k:got}); if(d.gain&&T.on[d.gain]) run(T,u,d.gain,c2); if(a.emit&&T.on[a.emit]) run(T,u,a.emit,c2); }
        if(nw>=mx) ustFull(T,u,t,d,ctx); }                                                             // "reaches 5": any gain that leaves it full
      for(const t of burst) ustFull(T,u,t,d,ctx); return; }
    /* her skills' own DoTs made hers ({tagDots:'kit'} on kit, {tagDots:'<tag>', exact, emit} on cast): the DoTs the skill pushed in between, with her as the source, carry her tag,
       so their ticks run her rows (dotOut, dotTick, kill by a DoT). exact: a duration the skill's options give in part-seconds ends on a part tick (the engine counts whole ticks).
       ctx.dot / ctx.tgt: the DoT tagged last and its holder (Bleed Them Dry's wound); emit: an event for each DoT tagged */
    if(a.tagDots){ if(a.tagDots==='kit'){ const al=[]; for(const x of E.units()) if(x.alive&&x.team!==u.team&&x.dots) al.push([x,x.dots.length]); s.dl=al; return; }
      const L=s.dl||[]; s.dl=null; for(const e of L){ const D=e[0].dots; for(let i=e[1];i<D.length;i++){ const d=D[i]; if(d.src!==u||d._talO!=null) continue; d._talO=u.uid; d._talK=a.tagDots;
          if(a.exact&&ctx.o&&ctx.o.dur>0){ const q=ctx.o.dur/(d.interval||1); if(Math.abs(q-Math.round(q))>1e-9){ d.remaining=Math.ceil(q-1e-9); d._talF=q-(d.remaining-1); } }
          ctx.dot=d; ctx.tgt=e[0]; if(a.emit&&T.on[a.emit]) run(T,u,a.emit,Object.assign({},ctx,{tgt:e[0],dot:d})); } } return; }
    if(a.dotAdd){ const d=ctx.dot; if(!d||!(d.remaining>0)) return; const n=d.remaining-1+(d._talF!=null?d._talF:1), x=amtOf(T,u,a.total,ctx); if(n>0&&x>0) d.dps+=x/n; return; }   // that much more over the DoT's ticks left
    if(a.burstDot){ const d=ctx.dot, h=ctx.tgt; if(!d||!(d.remaining>0)||!h) return; const rest=d.dps*(d.remaining-1+(d._talF!=null?d._talF:1)); const ts=pick(T,u,a.on,ctx);   // the rest of the DoT at once, to each unit picked; the DoT is over
      const i=h.dots.indexOf(d); if(i>=0) h.dots.splice(i,1); for(const t of ts) hurt(T,u,t,rest,a.color,a.tag); return; }
    if(a.copyDot){ const d=ctx.dot; if(!d||!(d.remaining>0)) return; const k=amtOf(T,u,a.scale==null?1:a.scale,ctx); if(!(k>0)) return;   // the same DoT again on another unit, at that strength, as hers
      for(const t of pick(T,u,a.on,ctx)){ if(!t.alive) continue; E.pushDot(t,d.dps*k,d.remaining*d.interval,d.interval,d.color,u,d.kind||'true'); const nd=t.dots[t.dots.length-1]; nd._talO=u.uid; nd._talK=a.copyDot; if(d._talF!=null) nd._talF=d._talF; } return; }
    if(a.untarget!=null){ const x=amtOf(T,u,a.untarget,ctx); if(x>0){ u._noTarget=true; u._noTargetT=Math.max(u._noTargetT||0,x); } return; }   // she cannot be targeted for that long (the engine's own untargetable state, as Hookline's evade)
    if(a.retarget){ const x=pick(T,u,a.retarget,ctx)[0]; if(x) ctx.tgt=x; return; }                // on skillTgt: the skill goes to that unit instead (when one is picked)
    if(a.miss){ ctx.amt=0; u._talMiss=1; return; }                                                // on 'in': this hit misses her (the page leaves the hit before any damage)
    if(a.dodge){ ctx.dodged=true; return; }                                                       // on 'dodge': she dodges this hit
    if(a.weaken){ const f=a.weaken, cur=u[f], m=s.wk||(s.wk={}); if(cur==null||!(cur<1)){ m[f]=null; return; } if(m[f]===cur) return;   // a control on her that much weaker (a slow's strength), once per new value
      u[f]=1-(1-cur)*Math.max(0,1-amtOf(T,u,a.by,ctx)); m[f]=u[f]; return; }
    if(a.restore){ for(const t of pick(T,u,a.on,ctx)) if(t.alive) t[a.restore]=ctx.was||0; return; }   // an engine timer back to what it was before her passive wrote it (ctx.was)
    if(a.later){ if(s.cur!=null) s.later.push([a.later,ctx]); else acts(T,u,a.later,ctx); return; }   // later: once the skill being cast has finished (its own shields written), else now
    if(a.tagHots){ const al=[]; for(const x of E.units()) if(x.alive&&x.team===u.team&&x.hots) al.push(x);   // the heals over time her skill is about to push / just pushed become hers (their ticks run her rows)
      if(a.tagHots==='kit'){ s.hl=al.map(x=>[x,x.hots.length]); return; }
      for(const e of (s.hl||[])){ const H=e[0].hots; for(let i=e[1];i<H.length;i++) if(!H[i]._talU){ H[i]._talU=u; H[i]._talK=a.tagHots; } } s.hl=null; return; }
    if(a.unhot){ for(const x of E.units()){ const H=x.hots; if(!H) continue; for(let i=H.length-1;i>=0;i--) if(H[i]._talX===u.uid&&H[i]._talK===a.unhot) H.splice(i,1); } return; }   // her talent's heal over time stops
    if(a.field){ for(const t of pick(T,u,a.on||'self',ctx)){ let v=+t[a.field]||0; if(a.add!=null) v+=a.add; if(a.max!=null) v=Math.min(a.max,v); t[a.field]=v; } return; }   // an engine counter on a unit (Crescendo's ring count)
    if(a.kill){ for(const t of pick(T,u,a.on,ctx)) if(t.alive) hurt(T,u,t,((t.hp||0)+(t.shield||0))*20+1,a.color,a.tag); return; }   // a talent kill: through the engine's own damage (a unit kept alive by a save stays alive)
    if(a.strip!=null){ for(const t of pick(T,u,a.on,ctx)) if((t.shield||0)>0) t.shield*=Math.max(0,1-a.strip); return; }   // that share of a unit's shield is gone
    if(a.call){ const f=E.fx&&E.fx[a.call]; if(!f) return; const n=a.n==null?1:Math.floor(amtOf(T,u,a.n,ctx)+1e-9);                 // one of the engine's own effects, by name (bind: fx)
      for(const t of pick(T,u,a.on,ctx)){ for(let i=0;i<n&&t.alive;i++){ if(f(t,u)===false) break; if(a.emit&&T.on[a.emit]) run(T,u,a.emit,Object.assign({},ctx,{tgt:t,proc:true})); } } return; }   // the effect may refuse (false); emit: once per application
    if(a.stun!=null||a.silence!=null){ const f=a.stun!=null?'stunned':'silencedT', secs=amtOf(T,u,a.stun!=null?a.stun:a.silence,ctx); if(!(secs>0)) return;
      for(const t of pick(T,u,a.on,ctx)) if(t.alive) control(T,u,t,f,secs,a.asIs); return; }                                           // the stated seconds, written straight on (no resist roll, no seeded draw)
    if(a.endCc){ for(const t of pick(T,u,a.on,ctx)) if(t.alive) t[a.endCc]=0; return; }                                   // a control on that unit ends now (a shattered freeze)
    if(a.timer){ const x=amtOf(T,u,a.min,ctx); for(const t of pick(T,u,a.on,ctx)) if(t.alive&&!((t[a.timer]||0)>=x)) t[a.timer]=x; return; }   // an engine timer on a unit is raised to at least that ('_chillT': Chill lasts longer)
    if(a.atOne){ for(const t of pick(T,u,a.atOne,ctx)) if(t.hp<1) t.hp=1; ctx.stop=true; return; }                                 // on a teamLethal row: that unit does not die from this blow
    if(a.window){ const w=s.w[a.window]||(s.w[a.window]={t:0,n:0,cdT:0,at:-1,wave:false});
      if(a.end){ w.t=0; return; }
      if(a.add!=null){ if(w.t>0&&w.at!==E.now()) w.t+=a.add; return; }
      if(a.cd&&E.now()<w.cdT) return false;
      const n=a.count!=null?cnt(T,u,a.count,ctx):(a.n==null?1:a.n); if(a.min!=null&&n<a.min) return false;
      const d=a.dur==='wave'?Infinity:amtOf(T,u,a.dur,ctx);
      w.n=(a.most&&w.t>0)?Math.max(w.n,n):n; w.t=d; w.wave=a.dur==='wave'; w.at=E.now(); if(a.cd) w.cdT=E.now()+a.cd; return; }
    if(a.dot){ const ts=pick(T,u,a.on,ctx), every=a.every||1, dur=amtOf(T,u,a.dur,ctx), ticks=Math.max(1,Math.ceil(dur/every-1e-9)), frac=dur/every-(ticks-1);
      let per=amtOf(T,u,a.amt,ctx); if(a.total) per=per/(dur/every); if(!(per>0)) return;
      for(const t of ts){ if(a.refresh){ let f=null; for(const d of t.dots) if(myDot(u,d,a.dot)){ f=d; break; } if(f){ f.dps=per; f.remaining=ticks; f._talF=(frac<1-1e-9)?frac:null; continue; } }
        E.pushDot(t,per,ticks*every,every,a.color||'#8f8fa8',u,a.kind||'true'); const d=t.dots[t.dots.length-1]; d._talO=u.uid; d._talK=a.dot; if(frac<1-1e-9) d._talF=frac;
        if(a.emitDot&&T.on[a.emitDot]) run(T,u,a.emitDot,Object.assign({},ctx,{tgt:t,dot:d})); }   // emitDot: an event about the DoT just applied
      return; }
    if(a.jumpDots){ const from=pick(T,u,a.from||'unit',ctx)[0]; if(!from||!from.dots) return; const to=pick(T,u,a.to,ctx)[0]; if(!to) return;
      for(const d of from.dots.slice()){ if(!myDot(u,d,a.jumpDots)) continue; const left=d.remaining-(d._talNow?1:0); if(left<1) continue;
        E.pushDot(to,d.dps,left*d.interval,d.interval,d.color,u,d.kind||'true'); const nd=to.dots[to.dots.length-1]; nd._talO=u.uid; nd._talK=d._talK; if(d._talF!=null) nd._talF=d._talF; d.remaining=d._talNow?1:0; }
      return; }
    if(a.heal!=null||a.hot!=null){ const A=a.heal!=null?a.heal:a.hot, pw=a.pow?(u.healPowMul||1):1;   // pow: the hero's healing power applies, as to the heals of his skills
      for(const t of pick(T,u,a.on||'self',ctx)){ if(!t.alive) continue; const c2=Object.assign({},ctx,{tgt:t}); c2.amt=amtOf(T,u,A,c2)*pw;
        if(a.tag&&T.on['heal:'+a.tag]) run(T,u,'heal:'+a.tag,c2);                                   // rows may change this heal ("... heals 5% more on allies below half")
        if(!(c2.amt>0)) continue;
        if(a.hot!=null){ const every=a.every||1, dur=amtOf(T,u,a.dur,ctx)||3; E.pushHot(t,a.perTick?c2.amt:c2.amt/Math.max(1,Math.round(dur/every)),dur,every);   // perTick: the amount is each tick's heal
          if(a.htag){ const h=t.hots[t.hots.length-1]; if(h){ h._talX=u.uid; h._talK=a.htag; } } } else E.healUnit(t,c2.amt);   // htag: her talent's heal over time, so a row can stop it (unhot)
        if(a.emit&&T.on[a.emit]) run(T,u,a.emit,c2); } return; }
    if(a.shield!=null){ const d=amtOf(T,u,a.dur,ctx)||4, pw=a.pow?(u.shieldStrMul||1):1;
      for(const t of pick(T,u,a.on||'self',ctx)){ const c2=Object.assign({},ctx,{tgt:t}), x=amtOf(T,u,a.shield,c2)*pw; if(!(x>0)) continue;
        t.shield=a.mode==='max'?Math.max(t.shield||0,x):(t.shield||0)+x; t.shieldT=Math.max(t.shieldT||0,d); if(a.emit&&T.on[a.emit]){ c2.amt=x; run(T,u,a.emit,c2); } } return; }   // mode max: as the engine's own skill shields (the larger one stays)
    if(a.unshield){ u.shield=0; return; }
    if(a.energy!=null){ for(const t of pick(T,u,a.on||'self',ctx)) t.energy=Math.max(0,Math.min(100,(t.energy||0)+a.energy)); return; }
    if(a.dmg!=null){ const sc=a.scale==null?1:a.scale; let done=0;
      for(const t of pick(T,u,a.on,ctx)){ const x=amtOf(T,u,a.dmg,Object.assign({},ctx,{tgt:t}))*sc; if(!(x>0)) continue; let y=x;   // the amount is read for each unit struck ("6% of its max HP")
        if(a.tag&&T.on['dmg:'+a.tag]){ const c2=Object.assign({},ctx,{tgt:t,amt:x}); run(T,u,'dmg:'+a.tag,c2); y=c2.amt; }   // rows may change this damage
        done+=hurt(T,u,t,y,a.color,a.tag); }
      if(a.emit&&done>0) run(T,u,a.emit,Object.assign({},ctx,{spent:done})); return; }
    if(a.cd){ const f=a.cd==='blue'?'blueCd':'greenCd'; if(a.set!=null) u[f]=a.set; else if(a.mul!=null) u[f]=Math.max(0,(u[f]||0)*a.mul); else u[f]=Math.max(0,(u[f]||0)+a.add); return; }   // mul: the time left that many times
    if(a.slow!=null){ let d=a.dur||1; if(T.on.ccOut){ const c={u,src:u,field:'slow',amt:d}; run(T,u,'ccOut',c); d=c.amt; }
      for(const t of pick(T,u,a.on,ctx)){ t.slow=Math.max(t.slow||0,d); t.slowMul=Math.min(t.slowMul==null?1:t.slowMul,Math.max(0.05,1-a.slow)); } return; }
    if(a.slowMore!=null){ const m=E.slowMul(u); for(const t of pick(T,u,a.on,ctx)) if((t.slow||0)>0) t.slowMul=Math.min(t.slowMul==null?1:t.slowMul,Math.max(0.05,1-(1-m)*(1+a.slowMore))); return; }   // the slow his skill just applied, that much stronger
    if(a.taunt!=null){ for(const t of pick(T,u,a.on,ctx)){ t.forcedTarget=u; t.forcedTargetT=Math.max(t.forcedTargetT||0,a.taunt); } return; }
    if(a.cleanse){ for(const t of pick(T,u,a.on||'self',ctx)) for(const f of CLEANSE) if((t[f]||0)>0){ t[f]=0; break; } return; }
    if(a.undying!=null){ s.undy=Math.max(s.undy,a.undying); if(u.hp<1) u.hp=1; ctx.stop=true; return; }
    if(a.roll){ const q=s.roll[a.roll]||(s.roll[a.roll]={span:a.span||3,e:[]}); q.span=a.span||3; const now=E.now(); q.e.push([now,amtOf(T,u,a.add,ctx)]); while(q.e.length&&q.e[0][0]<=now-q.span) q.e.shift(); return; }
    if(a.emit){ if(a.amt!=null){ run(T,u,a.emit,Object.assign({},ctx,{amt:amtOf(T,u,a.amt,ctx)})); return; }   // amt: the event carries that number (its rows may change it)
      if(a.on==null&&a.k==null){ run(T,u,a.emit,ctx); return; }                           // on:<who>: once for each such unit (it becomes the event's target); k: a size the event's amounts read
      for(const t of (a.on==null?[ctx.tgt]:pick(T,u,a.on,ctx))) run(T,u,a.emit,Object.assign({},ctx,{tgt:t,k:a.k==null?ctx.k:a.k})); return; }
    if(a.fn){ return T.fn[a.fn](API,T,u,ctx,a); } }

  /* ---- stats that change during the fight (rows {stat:{...}, per, if}): the difference is applied to the unit's own number, so whatever
          else the engine does to that number is kept. atk, armor, mr, move: "x more" (multiply); aspd: attack speed; crit, lifesteal: added;
          immovable: a flag. Recomputed once a tick; a number is touched only when its total changed. ---- */
  const S_MUL={atk:'dmg',armor:'armorRating',mr:'mrRating',move:'speed',apow:'apow',heal:'healPowMul'}, S_ADD={crit:'glyphCrit',lifesteal:'lifestealStat',dodge:'_talDodge'};   // dodge: her talent dodge chance (read by the dodge rows' chance)
  function restat(T,u){ if(!T.stats.length) return; const tot={}, ctx={u,tgt:u.target};
    for(let i=0;i<T.stats.length;i++){ const row=T.stats[i]; if(row.if&&!ok(T,u,row.if,ctx)) continue; const n=row.per!=null?cnt(T,u,row.per,ctx):1; if(!n) continue; for(const k in row.stat) tot[k]=(tot[k]||0)+row.stat[k]*n; }
    setStats(u,tot,T.s.ap,T.s.z);
    if(T.nrg){ const e=u.energy||0, p=T.s.e0; if(p!=null&&e>p&&tot.nrg>0) u.energy=Math.min(100,e+(e-p)*tot.nrg); T.s.e0=u.energy||0; } }   // nrg: ultimate energy she gained since the last tick, that share more (from any source)
  function setStats(u,tot,ap,z){
    { const nw=Math.max(0.05,1+(tot.hp||0)), old=ap.hp==null?1:ap.hp; if(nw!==old){ const k=nw/old; u.maxHp*=k; u.hp*=k; ap.hp=nw; } }     // max HP: the HP he has keeps its share
    ap.cdRate=tot.cdRate||0;                                                                                                                // cooldowns recover that much faster (negative: slower); see auras()
    for(const k in S_MUL){ const nw=Math.max(0,1+(tot[k]||0)), old=ap[k]==null?1:ap[k]; if(nw===old) continue; const f=S_MUL[k];
      if(old===0) u[f]=(z[k]||0)*nw; else if(nw===0){ z[k]=(u[f]||0)/old; u[f]=0; } else u[f]=(u[f]||0)/old*nw; ap[k]=nw; }
    { const nw=Math.max(0.05,1+(tot.aspd||0)), old=ap.aspd==null?1:ap.aspd; if(nw!==old){ u.atkInterval=u.atkInterval*old/nw; ap.aspd=nw; } }
    for(const k in S_ADD){ const f=S_ADD[k], old=ap[k]||0; let nw=tot[k]||0; if(k==='crit') nw=Math.min(nw,Math.max(0,0.6-((u[f]||0)-old))); if(nw!==old){ u[f]=(u[f]||0)-old+nw; ap[k]=nw; } }
    { const nw=!!tot.immovable; if(nw!==!!ap.imm){ if(nw){ ap.immWas=u.immovable; u.immovable=true; } else u.immovable=ap.immWas; ap.imm=nw; } } }
  /* stat rows that sit on OTHER units ({stat, to:<who>, per, if}: an aura, a debuff on marked enemies). Each tick: who is picked now, what they get; a unit
     no longer picked gets its numbers back. T.s.au = [{x: the unit, ap, z, g0, b0}], in the order units were first touched. Taken off when the owner dies. */
  function auras(T,u,dt){ const au=T.s.au; if(!T.auras.length&&!au.length) return; const ctx={u,tgt:u.target};
    for(let i=0;i<au.length;i++) au[i].tot=null;
    for(let i=0;i<T.auras.length;i++){ const row=T.auras[i]; if(row.if&&!ok(T,u,row.if,ctx)) continue; const us=pick(T,u,row.to,ctx);
      for(let j=0;j<us.length;j++){ const x=us[j]; let e=null; for(let q=0;q<au.length;q++) if(au[q].x===x){ e=au[q]; break; }
        if(!e){ e={x,ap:{},z:{},tot:null,g0:null,b0:null}; au.push(e); } const c2={u,tgt:x}, n=row.per!=null?cnt(T,u,row.per,c2):1; if(!n) continue;
        const tot=e.tot||(e.tot={}); for(const k in row.stat) tot[k]=(tot[k]||0)+row.stat[k]*n; } }
    for(let i=0;i<au.length;i++){ const e=au[i], x=e.x; if(!x.alive){ au.splice(i--,1); continue; } setStats(x,e.tot||{},e.ap,e.z);
      if(e.ap.cdRate){ for(const f of CDF){ const k=f==='greenCd'?'g0':'b0', was=e[k], cur=x[f]; if(was!=null&&cur>0&&was>cur&&was-cur<=dt*4) x[f]=cur-(was-cur)*e.ap.cdRate; e[k]=x[f]; } }   // what the cooldown recovered this tick, that share given back / taken
      else{ e.g0=null; e.b0=null; if(!e.tot){ au.splice(i--,1); } } } }
  const CDF=['greenCd','blueCd'];
  function unaura(T){ const au=T.s.au; for(let i=0;i<au.length;i++) if(au[i].x.alive) setStats(au[i].x,{},au[i].ap,au[i].z); au.length=0; }

  /* =========================== THE HOOKS (called by the page; every call site is guarded on u._tal) =========================== */
  /* outgoing damage: in _dealDamageCore once the hit has landed and its crit is known, just before the HP is removed */
  function out(src,tgt,amt,kind,auto,crit){ const T=src._tal, ctx={u:src,src,tgt,amt,kind,auto:!!auto,crit:!!crit,proc:T.s.d>0}; run(T,src,'out',ctx); return ctx.amt; }
  /* incoming damage: the same place. The target's own rows ('in'), then the rows of talented units watching it ('teamIn': team-wide effects) */
  function inc(tgt,src,amt,kind,auto,crit){ const T=tgt._tal, a0=amt; let mv=1; if(tgt._talW&&src&&src.team!==tgt.team) tgt._talBy=src;   // a watched unit remembers the enemy that last hit it
    if(T&&T.on.in&&src&&src.team!==tgt.team){ const ctx={u:tgt,src,tgt,amt,kind,auto:!!auto,crit:!!crit}; run(T,tgt,'in',ctx); amt=ctx.amt; if(ctx.mv!=null) mv*=ctx.mv; }
    const W=tgt._talW; if(W) for(let i=0;i<W.length;i++){ const o=W[i], To=o._tal; if(o===tgt||!o.alive||!To||!To.on.teamIn) continue;
      const ctx={u:o,src,tgt,amt,kind,auto:!!auto,crit:!!crit}; run(To,o,'teamIn',ctx); amt=ctx.amt; if(ctx.mv!=null) mv*=ctx.mv; }
    tgt._talIr=(amt!==a0)?[a0,mv]:null;   // the 95% ceiling (the page's drPreOf): the hit before these rows, and the share of it not moved onto another unit (divert)
    return amt; }
  /* crit: just before the engine decides the hit's crit. A row may force it (returns true); otherwise the engine's own value / roll stands */
  function crit(src,tgt,pre,kind,auto){ const T=src._tal, ctx={u:src,src,tgt,kind,auto:!!auto,proc:T.s.d>0,force:false}; run(T,src,'crit',ctx); return ctx.force?true:pre; }
  /* after a hit landed: 'hit' for the attacker (then 'kill' if it killed), 'hurt' for the one struck */
  function hit(src,tgt,hpLost,amt,kind,auto,crit,hpBefore){
    if(src&&src._tal){ const T=src._tal, ctx={u:src,src,tgt,amt,hpLost,kind,auto:!!auto,crit:!!crit,proc:T.s.d>0};
      if(T.on.hit) run(T,src,'hit',ctx);
      if(T.on.kill&&hpBefore>0&&!tgt.alive){ ctx.overkill=Math.max(0,-tgt.hp); run(T,src,'kill',ctx); } }
    if(tgt._tal&&tgt._tal.on.hurt&&src&&src.team!==tgt.team&&tgt.alive){ const T=tgt._tal; run(T,tgt,'hurt',{u:tgt,src,tgt,amt,hpLost,kind,auto:!!auto,crit:!!crit}); } }
  /* the 95% ceiling's balance measurement (tests/balance-dr-ceiling.test.js): what the incoming rows of tgt and of the units watching it WOULD do to a
     hit of `amt`, with no side effect - no action, no seeded draw, no limiter spent, no divert taken. Rows that hang on a chance, on counting events
     (every / edge / period) or on per-unit limiters are left out. Returns {amt, mv}: the hit after the rows, and the share not moved onto another unit
     (0: the rows make it deal nothing - immunity). Never called by a fight. */
  function incProbe(tgt,src,amt,kind,auto){ let mv=1; const ctx0={src,tgt,kind,auto:!!auto,crit:false};
    const one=(T,o,ev)=>{ const rows=T.on[ev]; if(!rows) return; const ctx=Object.assign({},ctx0,{u:o,amt});
      for(const row of rows){ if(row.chance!=null||row.every||row.edge||row.period||row.each||row.by||row.skill) continue;
        const L=T.s.lim[row.key]; if(L&&((row.once==='wave'&&L.w===T.s.wave)||(row.once==='fight'&&L.n>0)||(row.uses&&L.n>=row.uses)||(row.icd&&E.now()<L.t))) continue;
        if(row.if&&!ok(T,o,row.if,ctx)) continue; const n=(row.per!=null?cnt(T,o,row.per,ctx):1)*(row.scale==null?1:row.scale);
        if(row.more!=null) ctx.amt*=1+row.more*n; if(row.less!=null) ctx.amt*=Math.max(0,1-row.less*n); if(row.add!=null) ctx.amt+=row.add*n;
        if(row.mul!=null){ ctx.amt*=row.mul; if(row.mul===0) mv=0; }
        if(row.divert!=null){ const sh=Math.min(1,row.divert*n); ctx.amt*=1-sh; mv*=1-sh; } }
      amt=ctx.amt; };
    if(tgt._tal&&tgt._tal.on.in&&src&&src.team!==tgt.team) one(tgt._tal,tgt,'in');
    const W=tgt._talW; if(W) for(const o of W) if(o!==tgt&&o.alive&&o._tal&&o._tal.on.teamIn) one(o._tal,o,'teamIn');
    return {amt,mv}; }
  /* a hit is about to kill: a row may keep the unit alive (action `undying`); while that holds, it cannot drop below 1 HP */
  function lethal(u){ const T=u._tal; if(T.s.undy>0){ u.hp=1; return; } run(T,u,'lethal',{u,tgt:u}); if(T.s.undy>0&&u.hp<1) u.hp=1; }
  /* a unit died: its own 'die' rows, then 'death' for every talented unit watching it */
  function death(u){ const T=u._tal; if(T&&T.on.die) run(T,u,'die',{u,unit:u,tgt:u}); if(T&&T.s.au.length) unaura(T);
    const W=u._talW; if(W) for(let i=0;i<W.length;i++){ const o=W[i]; if(o===u||!o.alive||!o._tal||!o._tal.on.death) continue; run(o._tal,o,'death',{u:o,unit:u,tgt:u}); } }
  /* healing received, before the engine cuts it to the room left: over = what will not fit */
  function heal(u,a){ const T=u._tal; run(T,u,'heal',{u,tgt:u,amt:a,over:Math.max(0,a-Math.max(0,E.healCap(u)-u.hp)),proc:T.s.d>0}); }
  /* skill options, before the skill resolves (returns a changed copy) and after it resolved */
  const skTgt=(u,o)=>(o&&o._arrived&&o._tgtU)||u.target;                 // a skill that travels to its target lands on the unit it was thrown at
  function kit(u,type,o){ const T=u._tal, ctx={u,tgt:skTgt(u,o),skill:type,o:Object.assign({},o)}; T.s.cur=type; run(T,u,'kit',ctx); return ctx.o; }
  function cast(u,type,o){ const T=u._tal; T.s.cur=null; const q=T.s.later; if(q.length){ T.s.later=[]; for(let i=0;i<q.length;i++) acts(T,u,q[i][0],q[i][1]); }   // what rows put off until the skill had finished
    run(T,u,'cast',{u,tgt:skTgt(u,o),skill:type,o:o||{}}); }
  /* HER HEALS. healOut: a heal of a skill of hers (the page's healFrom, src = her): 'healOut' rows change it (before her healing power, as healFrom applies it),
     the engine heals through its own healFrom, then 'healed' rows see it land: amt = HP it restored, heal = what was offered (after healing power),
     over = what did not fit (0 unless it filled the room left), raw = the skill's own number, skill = the skill being cast. Never lets an error out, and
     always heals exactly once. hotPre / hotPost: the same for each tick of a heal over time her rows made hers (tagHots), then 'hotEnd' on its last tick. */
  function healOut(s,t,a){ const T=s._tal; let ctx=null;
    try{ ctx={u:s,src:s,tgt:t,unit:t,amt:a,raw:a,skill:T.s.cur,hot:false}; if(T.s.cur) T.s.lh=a; run(T,s,'healOut',ctx); a=Math.max(0,ctx.amt); }catch(e){ ERR.n++; ERR.last=String((e&&e.stack)||e).slice(0,600); ctx=null; }
    const hp0=t.hp, room=Math.max(0,E.healCap(t)-hp0); T.hb=1; try{ E.healFrom(s,t,a); } finally{ T.hb=0; }
    if(ctx) try{ ctx.heal=a*(s.healPowMul||1); landed(T,s,t,ctx,hp0,room); }catch(e){ ERR.n++; ERR.last=String((e&&e.stack)||e).slice(0,600); } }
  function landed(T,o,t,c,hp0,room){ const got=Math.max(0,t.hp-hp0); c.amt=got; c.over=(got>=room-1e-9)?Math.max(0,c.heal-room):0; if(T.on.healed) run(T,o,'healed',c); }
  function hotPre(t,h){ const o=h._talU, T=o&&o._tal; if(!T||!o.alive) return null;
    const ctx={u:o,src:o,tgt:t,unit:t,amt:h.hps,raw:h.hps,skill:h._talK,hot:true}; run(T,o,'healOut',ctx);
    const keep=h.hps; h.hps=Math.max(0,ctx.amt); return {keep,ctx,hp0:t.hp,room:Math.max(0,E.healCap(t)-t.hp)}; }
  function hotPost(t,h,k){ const o=h._talU, T=o._tal, c=k.ctx; c.heal=h.hps; h.hps=k.keep; landed(T,o,t,c,k.hp0,k.room);
    if(h.remaining<=1&&T.on.hotEnd) run(T,o,'hotEnd',{u:o,tgt:t,unit:t,amt:k.keep,tag:h._talK}); }
  /* a number the engine keeps inside a skill's own code (a channel's radius, a proc chance): rows {on:'num',skill:'<name>', add / addM / more / mul} */
  function num(u,name,v){ const ctx={u,skill:name,amt:v,tgt:u.target}; run(u._tal,u,'num',ctx); return ctx.amt; }
  /* a control effect LANDED (after the resist roll): 'ccHit' for the one who applied it. direct: the engine wrote this
     control without ccApply (a channel's proc) - the owner's ccOut rows get their say now, and the longer time is written on. */
  function ccHit(by,t,field,dur,direct){ const T=by&&by._tal;
    if(direct&&T&&T.on.ccOut){ const c={u:by,src:by,tgt:t,field,amt:dur}; run(T,by,'ccOut',c); let d=c.amt; const cap=E.ccCap(field); if(cap&&d>cap) d=cap; if(d>dur){ t[field]=Math.max(t[field]||0,d); dur=d; } }
    if(T&&T.on.ccHit) run(T,by,'ccHit',{u:by,src:by,tgt:t,field,amt:dur}); }
  /* healing about to land on u: 'teamHeal' for the talented units watching it (an enemy's healing cut, an ally's raised) */
  function healIn(u,a){ const W=u._talW; if(W) for(let i=0;i<W.length;i++){ const o=W[i], To=o._tal; if(o===u||!o.alive||!To||!To.on.teamHeal) continue; const c={u:o,tgt:u,unit:u,amt:a,a0:a}; run(To,o,'teamHeal',c); a=c.amt; }
    return Math.max(0,a); }
  /* a Chill the hero's own skill just put on t (Sylthaine's Cold Snap): 'chill' rows. Only when her passive is unlocked - without it the skill applies no Chill */
  function chill(u,t){ if(!(u.pass&&u.pass.coldsnap)||!t) return; run(u._tal,u,'chill',{u,src:u,tgt:t}); }
  /* u is about to die from a blow (its own talents and Dawnward did not hold it): 'teamLethal' rows of the talented units watching it may keep it at 1 HP */
  function teamLethal(u){ const W=u._talW; if(!W) return; for(let i=0;i<W.length&&u.hp<=0;i++){ const o=W[i], To=o._tal; if(o===u||!o.alive||!To||!To.on.teamLethal) continue; run(To,o,'teamLethal',{u:o,unit:u,tgt:u}); } }
  /* an enemy's hit is coming at her (before any miss): 'aimed' rows ("an enemy that attacks Vex, hit or miss"); then, unless the hit cannot miss (true damage, a
     can't-miss gear effect), her 'dodge' rows may dodge it (action {dodge:true}, normally behind a seeded chance): true = dodged, the page leaves the hit, and 'dodged' rows run */
  function dodge(t,s,auto,kind,sure){ const T=t._tal, ctx={u:t,src:s,tgt:t,unit:t,auto:!!auto,kind};
    if(T.on.aimed) run(T,t,'aimed',ctx);
    if(kind==='true'||sure||!T.on.dodge) return false;
    ctx.dodged=false; run(T,t,'dodge',ctx); if(!ctx.dodged) return false;
    if(T.on.dodged) run(T,t,'dodged',Object.assign({},ctx,{dodged:true})); return true; }
  /* after the 'in' rows: a row said this hit misses her ({miss:true}) - the page leaves the hit before any damage */
  function miss(t){ const m=!!t._talMiss; t._talMiss=0; return m; }
  /* her passive just acted on t at a swing (Vex's Killer Instinct): passPre right before (what the engine timer was), pass right after: 'pass' rows (ctx.was) */
  function passPre(u,t){ u._tal.s.pw=(t&&t.mortalT)||0; }
  function pass(u,t,name){ const T=u._tal; run(T,u,'pass',{u,src:u,tgt:t,skill:name,was:T.s.pw||0}); }
  /* a skill has picked its target (Hookline's mark): 'skillTgt' rows may send it to another unit ({retarget:<who>}); then 'skillAt' rows see the final target, the skill's
     options (ctx.o, the very object the skill reads its numbers from next) and the caster where she stands. Returns the target (null: the skill does not fire) */
  function skillTgt(u,skill,mark,o){ const T=u._tal, ctx={u,src:u,tgt:mark||null,skill,o:o||{}};
    if(T.on.skillTgt) run(T,u,'skillTgt',ctx); if(ctx.tgt&&T.on.skillAt) run(T,u,'skillAt',ctx); return ctx.tgt||null; }
  /* a skill that travels lands (Hookline: she lands behind its mark). landPre: right before its strike - while it resolves the strike is that skill's ('casting');
     land: right after - 'land' rows ("the moment she lands behind someone") */
  function landPre(u,t,skill){ const T=u._tal; T.s.cur=skill; if(T.on.landPre) run(T,u,'landPre',{u,src:u,tgt:t,skill}); }
  function land(u,t,skill){ const T=u._tal; T.s.cur=null; if(T.on.land) run(T,u,'land',{u,src:u,tgt:t,skill}); }
  /* a cooldown was just set after a cast: slot 'green' | 'blue' */
  function cd(u,slot,v){ const ctx={u,slot,skill:slot,amt:v}; run(u._tal,u,'cd',ctx); return Math.max(0,ctx.amt); }
  /* a control effect is being applied by `by` to `t`: seconds in, seconds out */
  function cc(by,t,field,dur,tal){ if(t._tal&&t._tal.on.ccIn){ const c={u:t,src:by,tgt:t,field,amt:dur,talent:!!tal}; run(t._tal,t,'ccIn',c); dur=c.amt; }
    if(by&&by._tal&&by._tal.on.ccOut){ const c={u:by,src:by,tgt:t,field,amt:dur,talent:!!tal}; run(by._tal,by,'ccOut',c); dur=c.amt; } return dur; }
  /* a DoT tick: before it (the target's 'dotIn' rows, and a talent DoT's shorter last tick), and after it (the owner's 'dotTick', a kill by the DoT) */
  function dotPre(u,d){ const keep=[d.dps,u.hp,u.shield||0]; let x=d.dps, p=x; const T=u._tal;   // p: the tick without the target's own DoT rows (the 95% ceiling's reference)
    if(T&&T.on.dotIn){ const ctx={u,src:d.src,tgt:u,amt:x,dot:d}; run(T,u,'dotIn',ctx); x=ctx.amt; }
    const o=d.src, To=o&&o._tal; if(To&&To.on.dotOut&&d._talO===o.uid&&o.alive){ const xi=x, c={u:o,src:o,tgt:u,amt:x,dot:d,tag:d._talK}; run(To,o,'dotOut',c); x=c.amt; p=xi>0?p*x/xi:x; }   // the owner's rows change her own DoT's tick
    if(d._talF!=null&&d.remaining<=1){ x*=d._talF; p*=d._talF; } d.dps=x; d._talNow=true; if(x<p) u._talDp=p; return keep; }   // _talDp: read by the page's dotTickAmt for this tick
  function dotPost(u,d,keep){ d.dps=keep[0]; d._talNow=false; if(u._talDp!=null) u._talDp=null; const o=d.src, T=o&&o._tal; if(!T||d._talO!==o.uid) return;
    if(T.on.dotTick&&o.alive) run(T,o,'dotTick',{u:o,src:o,tgt:u,dot:d,tag:d._talK,amt:Math.max(0,((keep[1]||0)-Math.max(0,u.hp))+((keep[2]||0)-(u.shield||0)))});   // amt: what the tick took off (HP and shield)
    if(!u.alive&&T.on.kill&&o.alive) run(T,o,'kill',{u:o,src:o,tgt:u,dot:d,overkill:0,viaDot:true}); }
  /* between waves (the page's per-wave reset): 'waveEnd' now; the new wave's start is run on the unit's next tick, when the field is set */
  function wave(u){ const T=u._tal, s=T.s; if(s.fresh) return; if(u.alive&&T.on.waveEnd) run(T,u,'waveEnd',{u}); s.fresh=true; }
  function startWave(T,u){ const s=T.s; s.wave++;
    for(const k in s.k){ const d=T.st[k]; if(d&&d.wave==='reset') s.k[k].n=0; }
    for(const k in s.w) if(s.w[k].wave) s.w[k].t=0;
    if(T.on.wave) run(T,u,'wave',{u,tgt:u.target}); }
  /* once a tick per talented living unit, after every unit has thought and moved */
  function tick(u,dt){ const T=u._tal, s=T.s;
    if(T.watch){ const U=E.units(); for(let i=0;i<U.length;i++){ const x=U[i], w=x._talW; if(!w) x._talW=[u]; else if(w.indexOf(u)<0) w.push(u); } }
    if(s.fresh){ s.fresh=false; startWave(T,u); }
    s.moved=(u.x!==u.px||u.y!==u.py);
    if(s.tm.length) tickMarks(T,u);
    for(const k in s.w){ const w=s.w[k]; if(w.t>0&&w.t!==Infinity){ w.t-=dt; if(w.t<=1e-9){ w.t=0; if(T.on['end:'+k]) run(T,u,'end:'+k,{u,tgt:u.target}); } } }
    for(const k in s.k){ const st=s.k[k], d=T.st[k]; if(st.rf&&st.rf.length){ const now=E.now(); for(let i=0;i<st.rf.length;i++){ if(now<st.rf[i]-1e-9) continue; st.rf.splice(i--,1);   // a spent unit of a refilling pool is back
          if(stSet(T,u,k,st.n+1)>0&&d.refilled&&T.on[d.refilled]) run(T,u,d.refilled,{u,tgt:u}); } }
      if(!d||!(st.n>0)) continue;
      if(d.dur){ st.t-=dt; if(st.t<=1e-9){ st.n=0; continue; } }
      if(d.fade&&!(d.fade.unless&&ok(T,u,d.fade.unless,{u}))){ st.idle+=dt*(d.fade.rate==null?1:Math.max(0,d.fade.rate));   // rate: the fade's clock (0.5 = it fades half as fast)
        if(st.idle>=d.fade.after+d.fade.every-1e-9){ st.idle-=d.fade.every; st.n=Math.max(0,st.n-(d.fade.pct!=null?st.n*d.fade.pct:(d.fade.lose||1))); } } }   // pct: it loses that share of what it holds
    if(s.undy>0) s.undy=Math.max(0,s.undy-dt);
    if(T.on.tick) run(T,u,'tick',{u,tgt:u.target,dt});
    restat(T,u); auras(T,u,dt); }

  const API={stGet,stSet,stMax,winOn,markOf,setMark,clearMark,endMark,inZone,zoneOn,hasDot,countDots,pick,amtOf,cnt,hurt,control,run,acts,gap,eng:()=>E};
  /* A hook never lets an error out into the fight: it is counted (TalentFx.errors() - the tests require zero) and the hook answers as if the hero
     had no talent row there. An error is as deterministic as anything else here, so device and server still agree. Diagnostics only: nothing in a
     fight reads ERR. */
  const ERR={n:0,last:''};
  const guard=(f,dflt)=>function(){ try{ return f.apply(null,arguments); }catch(e){ ERR.n++; ERR.last=String((e&&e.stack)||e).slice(0,600); return dflt?dflt.apply(null,arguments):undefined; } };
  const RUNTIME={bind,bindMore,define,attach:guard(attach,()=>null),
    out:guard(out,(s,t,amt)=>amt),inc:guard(inc,(t,s,amt)=>amt),crit:guard(crit,(s,t,pre)=>pre),hit:guard(hit),lethal:guard(lethal),death:guard(death),heal:guard(heal),
    kit:guard(kit,(u,type,o)=>o),cast:guard(cast),incProbe,healOut,hotPre:guard(hotPre,()=>null),hotPost:guard(hotPost,(t,h,k)=>{ if(k) h.hps=k.keep; }),num:guard(num,(u,n,v)=>v),ccHit:guard(ccHit),healIn:guard(healIn,(u,a)=>a),dodge:guard(dodge,()=>false),miss:guard(miss,()=>false),passPre:guard(passPre),pass:guard(pass),skillTgt:guard(skillTgt,(u,sk,m)=>m),landPre:guard(landPre),land:guard(land),chill:guard(chill),teamLethal:guard(teamLethal),cd:guard(cd,(u,slot,v)=>v),cc:guard(cc,(by,t,f,dur)=>dur),dotPre:guard(dotPre,(u,d)=>[d.dps]),dotPost:guard(dotPost),wave:guard(wave),tick:guard(tick),
    errors:()=>({n:ERR.n,last:ERR.last}), errorsReset:()=>{ ERR.n=0; ERR.last=''; },
    mech:hero=>defOf(hero)||null, mechHeroes:()=>Object.keys(MECH)};
