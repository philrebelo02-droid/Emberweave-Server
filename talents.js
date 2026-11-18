/* Talents: shared rules for learning talents (client page and server use this same file, like hero61.js). No rendering, no RNG.
   Phil 14 Nov 2026: "they are only activated when someone clicks learn talent" - a talent does nothing until a point is spent on it.
   Data: talents-data.js (compiled from the approved design files by tools/build_talents.py).
   A hero's build is { r: { talentId: rank } }. One talent point per hero level from 10 to 100 (91 in all). A tier opens for every 5
   points spent above it in the same tree; an arrow needs its upper talent at max rank; a pick-one fork locks its other half. */
(function(root,factory){const v=factory(typeof module==='object'&&module.exports?require('./talents-data.js'):(root&&root.TALENT_DATA));
  if(typeof module==='object'&&module.exports)module.exports=v;if(root)root.TALENTS=v;})(typeof globalThis!=='undefined'?globalThis:this,function(DATA){
  'use strict';
  const FIRST_LEVEL=10, MAX_POINTS=91, POINTS_PER_TIER=5, TIERS=13, COLS=4;
  const HEROES=(DATA&&DATA.heroes)||{};
  const IDX={};                                   // heroKey -> { byId: {id: {t, tree, treeIdx}}, trees }
  function index(hero){
    if(IDX[hero]) return IDX[hero];
    const h=HEROES[hero]; if(!h) return null;
    const byId={};
    h.trees.forEach((tr,ti)=>{ for(const t of tr.talents) byId[t[0]]={id:t[0],tier:t[1],col:t[2],name:t[3],ranks:t[4],text:t[5],prereq:t[6]||null,lock:t[7]||null,tree:tr.id,treeIdx:ti}; });
    return (IDX[hero]={byId,trees:h.trees});
  }
  const has=hero=>!!HEROES[hero];
  const pointsTotal=level=>Math.max(0,Math.min(MAX_POINTS,(level|0)-(FIRST_LEVEL-1)));
  const rankOf=(build,id)=>{ const r=build&&build.r&&build.r[id]; return (r|0)>0?(r|0):0; };
  /* points spent: { total, tree: {treeId: n}, tier: {treeId: [n per tier, index 1..13]} } */
  function spent(hero,build){
    const ix=index(hero), out={total:0,tree:{},tier:{}};
    if(!ix) return out;
    for(const tr of ix.trees){ out.tree[tr.id]=0; out.tier[tr.id]=new Array(TIERS+1).fill(0); }
    for(const id of Object.keys((build&&build.r)||{})){ const t=ix.byId[id], n=rankOf(build,id); if(!t||!n) continue;
      out.total+=n; out.tree[t.tree]+=n; out.tier[t.tree][t.tier]+=n; }
    return out;
  }
  const tierOpenAt=tier=>POINTS_PER_TIER*(tier-1);            // points needed in the tree, in the tiers above this one
  /* the rule itself, for one talent t against points already counted (sp): '' when it can take one more rank */
  function why1(ix,sp,build,t,level,message){
    if(rankOf(build,t.id)>=t.ranks) return message('max_rank','Already at max rank.');
    if(sp.total>=pointsTotal(level)) return pointsTotal(level)?message('no_points','No talent points left.'):message('open_at','Talents open at hero level '+FIRST_LEVEL+'.',{n:FIRST_LEVEL});
    let above=0; for(let k=1;k<t.tier;k++) above+=sp.tier[t.tree][k];
    const need=tierOpenAt(t.tier)-above;
    if(need>0) return message(need===1?'spend_one':'spend_more','Spend '+need+' more point'+(need===1?'':'s')+' in this tree to open this tier.',{n:need});
    if(t.prereq){ const p=ix.byId[t.prereq]; if(p&&rankOf(build,p.id)<p.ranks) return message('prerequisite','Needs '+p.name+' at max rank.',{name:p.name},p.id); }
    if(t.lock&&rankOf(build,t.lock)>0) return message('choice_locked','Locked: '+ix.byId[t.lock].name+' was chosen.',{name:ix.byId[t.lock].name},t.lock);
    return '';
  }
  const englishReason=(_code,text)=>text;
  /* Why a talent cannot take one more rank right now, or '' when it can. */
  function whyNot(hero,build,id,level,message=englishReason){
    const ix=index(hero); if(!ix) return message('unavailable','This hero has no talents yet.');
    const t=ix.byId[id]; if(!t) return message('unknown','Unknown talent.');
    return why1(ix,spent(hero,build),build,t,level,message);
  }
  const canLearn=(hero,build,id,level)=>whyNot(hero,build,id,level)==='';
  /* Can at least one talent of this hero take a point right now (the Talents tab's red dot)? The same rule as canLearn for every talent,
     with the points counted once: no unspent point answers at once, otherwise the first learnable talent ends the search. */
  function anyLearnable(hero,build,level){
    const ix=index(hero); if(!ix) return false;
    const sp=spent(hero,build); if(sp.total>=pointsTotal(level)) return false;
    for(const id in ix.byId) if(why1(ix,sp,build,ix.byId[id],level,englishReason)==='') return true;
    return false;
  }
  /* One point into one talent. Returns { ok, build } (a new build object) or { ok:false, error }. */
  function learn(hero,build,id,level,onBlocked){
    const why=whyNot(hero,build,id,level,onBlocked); if(why) return {ok:false,error:why};
    const r=Object.assign({},(build&&build.r)||{}); r[id]=rankOf(build,id)+1;
    return {ok:true,build:{r}};
  }
  /* Is a whole build legal for this hero at this level (some order of spending reaches it)? Used by the server on every stored or
     received build, so a build that a data correction made illegal is caught. Returns '' or the first reason. */
  function invalid(hero,build,level){
    const ix=index(hero); if(!ix) return (build&&build.r&&Object.keys(build.r).length)?'This hero has no talents yet.':'';
    const r=(build&&build.r)||{};
    for(const id of Object.keys(r)){ const t=ix.byId[id], n=r[id];
      if(!t) return 'Unknown talent '+id+'.';
      if(!Number.isInteger(n)||n<1||n>t.ranks) return 'Bad rank on '+t.name+'.';
      if(t.prereq&&rankOf(build,t.prereq)<ix.byId[t.prereq].ranks) return t.name+' needs '+ix.byId[t.prereq].name+' at max rank.';
      if(t.lock&&rankOf(build,t.lock)>0) return t.name+' and '+ix.byId[t.lock].name+' cannot both be learned.'; }
    const sp=spent(hero,build);
    if(sp.total>pointsTotal(level)) return 'More points spent than this hero has.';
    for(const tr of ix.trees){ let above=0; for(let k=1;k<=TIERS;k++){ if(sp.tier[tr.id][k]>0&&above<tierOpenAt(k)) return 'Tier '+k+' of '+tr.name+' is not open.'; above+=sp.tier[tr.id][k]; } }
    return '';
  }
  /* The learned talents of a build as a compact, order-stable list for fight snapshots: [[id, rank], ...] sorted by id.
     An empty list means the hero fights exactly as a hero with no talents. */
  function learned(hero,build){
    const ix=index(hero); if(!ix) return [];
    return Object.keys((build&&build.r)||{}).filter(id=>ix.byId[id]&&rankOf(build,id)>0).sort().map(id=>[id,rankOf(build,id)]);
  }
  const talent=(hero,id)=>{ const ix=index(hero); return (ix&&ix.byId[id])||null; };
  const trees=hero=>{ const ix=index(hero); return ix?ix.trees:[]; };
  return Object.freeze({FIRST_LEVEL,MAX_POINTS,POINTS_PER_TIER,TIERS,COLS,has,pointsTotal,rankOf,spent,tierOpenAt,whyNot,canLearn,anyLearnable,learn,invalid,learned,talent,trees});
});
