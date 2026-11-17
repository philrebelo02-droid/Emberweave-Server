/* Talents in the POWER NUMBER (14 Nov 2026). ONE file, loaded by the page (<script src>) and by server.js (require), so the card number the
   two compute for a talented hero is the same number by construction (rule 26, one power). No rendering, no RNG, no state but a cache.

   Phil, 14 Nov: "The power needs to make sense, figure out the best approach but essentially 91 talents should be around the same power as
   max glyphs." / "Make it a formula, all of these mechanics need to be created not hijack another one." / "its no longer as simple as power
   fights power".
   Design and measurements: TALENT TREES 13NOV2026/WIRING/41b - TALENT POWER FORMULA - decisions.md.

   HOW IT WORKS (plain words)
   - Max glyphs (an Orange board) add a FLAT 25,000 to every hero's card (the v480 tier curve: the same for every hero, whatever its stars,
     gear or level; glyph stats reach the fight but the card does not price them). Talents are priced the same way: a learned talent adds a
     fixed number for its rank, its depth in the tree and what KIND of effect it is. Talent stats still reach every fight; the card no
     longer prices them through the hero's stats (server: snapshotHeroFromServer {noTalentStats}, page: heroPower), so nothing counts twice.
   - Each rank is worth UNIT x depth(tier) x the weight of its effect kind. depth grows 4% a tier (tier 1 = 1.00, tier 12 = 1.44); the
     one-point signature (tier 13) counts as SIGNATURE points' worth.
   - The KIND comes from the data the game already has for the talent: its stat sentence (talents-fx.js stats) and the rows of its mechanics
     file (talents-mech/<hero>.js: the events a row listens to, the modifiers it carries, the actions it runs). A talent with several kinds
     is priced at the mean of their weights and its value is split evenly over those terms. A talent nothing can classify (a talent whose
     text could not run, a row that only builds a stack) falls in OTHER, priced by tier and ranks alone.
   - A hero with no mechanics file (not wired yet) has no talent power: power() returns 0. So does an empty or unknown list.
   UNIT is fixed so a typical full legal 91-point build is worth about GLYPH_FULL (25,000), the same as max glyphs (measured over every
   hero and several builds each: see the decisions note). The number is added where the glyph tier is added, before the Temple multiplier. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const v=factory(node?require('./talents.js'):(root&&root.TALENTS), node?require('./talents-fx.js'):(root&&root.TalentFx));
  if(node) module.exports=v; if(root) root.TalentPower=v;
})(typeof globalThis!=='undefined'?globalThis:this,function(TALENTS,FX){
  'use strict';
  const GLYPH_FULL=25000;            // = server GLYPH_POWER_TOTAL / page GLYPH_POWER_TOTAL: what an Orange board adds to the card
  const UNIT=236;                    // power per weighted point (calibrated: the roster's typical 91-point build = GLYPH_FULL, see 41b)
  const DEPTH=0.04;                  // each tier deeper is worth 4% more a point (the glyph curve is also back-loaded, much more steeply)
  const SIGNATURE=4;                 // the tier-13 signature (1 point, reachable at 61 in its tree) counts as 4 points of its tree's deepest tier
  /* The terms. w = weight of one point of that kind of effect, against a plain point. */
  const TERMS=Object.freeze({
    damage:   {w:1.00, name:'damage dealt'},              // more damage, crits, armor / resist ignored, talent damage and damage over time, attack, ability power, attack speed
    defence:  {w:1.00, name:'damage taken'},              // less damage taken, dodges, damage diverted, max HP, armor, magic resist
    shields:  {w:0.95, name:'shields'},                   // shields given or made stronger (a shield is spent once; it is not reduction)
    healing:  {w:0.95, name:'healing'},                   // heals, heals over time, lifesteal, healing power (overheal is lost)
    control:  {w:1.10, name:'control time'},              // stuns, slows, silences, taunts, pulls, cleanses, longer or shorter controls
    tempo:    {w:1.05, name:'energy and cooldown'},       // energy given, cooldowns cut, energy-ultimate speed
    summons:  {w:1.00, name:'summons'},                   // what the hero's summons do or get
    trigger:  {w:0.85, name:'on-death and conditional'},  // survive a killing blow, on a death, on a kill: effects that fire only on that moment
    skills:   {w:1.00, name:'skill upgrades'},            // changes to the hero's own skills' numbers (kit options, named numbers other talents read)
    other:    {w:0.90, name:'other (by tier and ranks)'}  // could not be classified from the data: priced by depth and ranks alone
  });
  const KIND_ORDER=Object.keys(TERMS);
  /* ---- classification, from the data only ---- */
  const STAT_KIND={hp:'defence',armor:'defence',mr:'defence',dodge:'defence',immovable:'defence',
                   atk:'damage',apow:'damage',crit:'damage',critDmg:'damage',aspd:'damage',
                   heal:'healing',lifesteal:'healing',shield:'shields',ctrl:'control',nrg:'tempo',cdRate:'tempo'};
  const EV_SUMMON=/^(summon|sOut|sHit|sGone|sCc|sCcIn|sKill)$/, EV_TRIGGER=/^(lethal|teamLethal|death|die|kill|fallen|fallenTick)$/;
  const EV_HEAL=/^(heal|healOut|healed|healMe|teamHeal|hotEnd|hotPre|hotPost)$|^heal:/, EV_SHIELD=/shield/i;
  const EV_CC=/^(ccIn|ccOut|ccHit|teamCc|ccOn|ccEnd|chill|freezeEnd|rootEnd|silEnd)$/, EV_TEMPO=/^(cd|nrgIn|nrgPre|teamNrg)$/;
  const EV_DMG=/^(out|dotOut|dotTick|crit)$|^dmg:/, EV_DEF=/^(in|hurt|dotIn|teamDotIn|dodge|dodged|absorb|evade|missed|miss|veil|veiled|diverted|block)$/;
  const EV_SKILL=/^(kit|cast|num|at|skillTgt|skillAt|land|landPre|pass|passPre|page|pagePre|pageW|pageW0|line|spreadR|spread|pois|poisQ|wax|encase|part|partPre)$/;
  const ACT_CC=['stun','slow','silence','taunt','pull','push','fear','root','cleanse','endCc','unmove','slowMore','lock','lockDur','freeze','sleep','retarget'];
  const ACT_DMG=['dmg','dot','extendDot','copyDot','burstDot','dotAdd','emitDot','dotRate','jumpDots','kill','weaken'];
  const ACT_DEF=['dodge','untarget','miss','divert'];
  const MOD_UP=['more','add','addM','mul','critMore','ignoreArmor','ignoreMr','force'];
  /* every key used anywhere in a row, outside its conditions (an `if` asks; it does not do), and whether a `cd:'green'|'blue'` action is there */
  function keysOf(x,out){ if(!x||typeof x!=='object') return out;
    if(Array.isArray(x)){ for(const y of x) keysOf(y,out); return out; }
    for(const k of Object.keys(x)){ if(k==='if') continue; out.k[k]=1; if(k==='cd'&&typeof x[k]==='string') out.cdAct=1; keysOf(x[k],out); }
    return out; }
  function rowKinds(row,K){
    if(!row||typeof row!=='object') return;
    const ev=[].concat(row.on||[]).map(String), ks=keysOf(row,{k:{},cdAct:0}), k=ks.k, any=re=>ev.some(e=>re.test(e)), mod=MOD_UP.some(m=>m in row);
    if(any(EV_SUMMON)||k.mine) K.summons=1;
    if(any(EV_TRIGGER)||k.undying) K.trigger=1;
    if(k.shield||any(EV_SHIELD)) K.shields=1;
    if(k.heal||k.hot||any(EV_HEAL)) K.healing=1;
    if(ACT_CC.some(a=>k[a])||any(EV_CC)) K.control=1;
    if(k.energy||ks.cdAct||any(EV_TEMPO)) K.tempo=1;
    if(ACT_DMG.some(a=>k[a])||(any(EV_DMG)&&(mod||row.do))||(ev.includes('teamIn')&&(row.more||row.add))) K.damage=1;
    if(ACT_DEF.some(a=>k[a])||any(EV_DEF)||(ev.includes('teamIn')&&(row.less||row.divert||row.mul))) K.defence=1;
    if('param' in row||'opt' in row||any(EV_SKILL)) K.skills=1;
    if(row.stat&&typeof row.stat==='object') for(const s of Object.keys(row.stat)){ const kk=STAT_KIND[s]; if(kk) K[kk]=1;
      if(s==='move'&&row.to&&typeof row.to==='object'&&row.to.team==='enemy') K.control=1; }   // a move-speed cut written on enemies is a slow (own move speed stays OTHER)
  }
  /* hero -> { id: {v: value of one rank (weighted points, before UNIT), ranks, share: {term: fraction}} }, built once per hero */
  const CACHE={}, CACHE_ANY={};
  /* any=true (measurement only, never the card): price a hero that has no mechanics file yet as if it had one with no rows */
  function table(hero,any){ const C=any?CACHE_ANY:CACHE;
    if(Object.prototype.hasOwnProperty.call(C,hero)) return C[hero];
    let out=null;
    try{
      const def=FX&&FX.mech?(FX.mech(hero)||(any?{talents:{}}:null)):null;
      if(def&&TALENTS&&TALENTS.has(hero)){ out={};
        const rows=def.talents||{};
        for(const tr of TALENTS.trees(hero)) for(const t of tr.talents){ const id=t[0], tier=t[1]|0, ranks=t[4]|0, K={};
          for(const r of [].concat(rows[id]||[])) rowKinds(r,K);
          if(!rows[id]&&FX.has(hero,id)){ const s=FX.totals(hero,[[id,1]]); for(const st of Object.keys(s)) if(s[st]>0&&STAT_KIND[st]) K[STAT_KIND[st]]=1; }
          let kinds=KIND_ORDER.filter(x=>K[x]); if(!kinds.length) kinds=['other'];
          const depth=tier>=13?SIGNATURE*(1+DEPTH*11):1+DEPTH*(Math.max(1,tier)-1);
          const w=kinds.reduce((a,x)=>a+TERMS[x].w,0)/kinds.length, share={};
          for(const x of kinds) share[x]=TERMS[x].w/kinds.length/w;
          out[id]={v:depth*w,ranks,tier,share,kinds}; } }
    }catch(e){ out=null; }
    return (C[hero]=out); }
  /* the talent power of a learned list [[id,rank],...]: a whole number, 0 for an unwired hero, an empty list or unknown ids */
  function power(hero,list,any){
    if(!list||!list.length) return 0; const tb=table(hero,any); if(!tb) return 0;
    let s=0; for(const e of list){ const t=tb[e&&e[0]], r=Math.min(t?t.ranks:0,(e&&e[1])|0); if(t&&r>0) s+=t.v*r; }
    return Math.round(s*UNIT); }
  /* the same number split into its terms (for the decisions note and the tests; the card only adds power()) */
  function terms(hero,list,any){ const out={}; for(const x of KIND_ORDER) out[x]=0; const tb=table(hero,any); if(!tb||!list) return out;
    for(const e of list){ const t=tb[e&&e[0]], r=Math.min(t?t.ranks:0,(e&&e[1])|0); if(!t||r<1) continue; for(const x in t.share) out[x]+=t.v*r*t.share[x]*UNIT; }
    return out; }
  const kindsOf=(hero,id,any)=>{ const tb=table(hero,any); return tb&&tb[id]?tb[id].kinds.slice():null; };
  return Object.freeze({GLYPH_FULL,UNIT,DEPTH,SIGNATURE,TERMS,power,terms,kindsOf,wired:hero=>!!table(hero),
    /* measurement only: the price of a hero not wired yet, as it will read once wired with no rows (the card never calls this) */
    potential:(hero,list)=>power(hero,list,true)});
});
