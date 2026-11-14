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
  /* Why a talent cannot take one more rank right now, or '' when it can. */
  function whyNot(hero,build,id,level){
    const ix=index(hero); if(!ix) return 'This hero has no talents yet.';
    const t=ix.byId[id]; if(!t) return 'Unknown talent.';
    const sp=spent(hero,build), have=rankOf(build,id);
    if(have>=t.ranks) return 'Already at max rank.';
    if(sp.total>=pointsTotal(level)) return pointsTotal(level)?'No talent points left.':'Talents open at hero level '+FIRST_LEVEL+'.';
    let above=0; for(let k=1;k<t.tier;k++) above+=sp.tier[t.tree][k];
    if(above<tierOpenAt(t.tier)) return 'Spend '+(tierOpenAt(t.tier)-above)+' more point'+(tierOpenAt(t.tier)-above===1?'':'s')+' in this tree to open this tier.';
    if(t.prereq){ const p=ix.byId[t.prereq]; if(p&&rankOf(build,p.id)<p.ranks) return 'Needs '+p.name+' at max rank.'; }
    if(t.lock&&rankOf(build,t.lock)>0) return 'Locked: '+ix.byId[t.lock].name+' was chosen.';
    return '';
  }
  const canLearn=(hero,build,id,level)=>whyNot(hero,build,id,level)==='';
  /* One point into one talent. Returns { ok, build } (a new build object) or { ok:false, error }. */
  function learn(hero,build,id,level){
    const why=whyNot(hero,build,id,level); if(why) return {ok:false,error:why};
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
  return Object.freeze({FIRST_LEVEL,MAX_POINTS,POINTS_PER_TIER,TIERS,COLS,has,pointsTotal,rankOf,spent,tierOpenAt,whyNot,canLearn,learn,invalid,learned,talent,trees});
});
