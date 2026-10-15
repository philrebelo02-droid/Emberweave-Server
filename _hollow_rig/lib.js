const path=require('path'), vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
function load(){
  const host=require(path.join(ROOT,'server/sim-host.js')).load(path.join(ROOT,'emberweave-heroes.html'));
  const S=host.sandbox, ctx=host.ctx;
  // ---- damage attribution (read-only instrumentation inside the VM; game files untouched) ----
  const T={ cur:null, rec:new Map() };   // rec: unit -> {dmg:{slot:amt}, kills, casts:{slot:n}}
  S.__T=T;
  const ownerOf=u=>{ let o=u; for(let i=0;i<4&&o;i++){ const p=o._summonOwner||o._owner||o._summoner||o.owner||o._master||o._summonBy||o._by; if(p&&p!==o&&p.team===o.team) o=p; else break; } return o; };
  const R=u=>{ u=ownerOf(u); let r=T.rec.get(u); if(!r){ r={key:u.key,team:u.team,dmg:{},kills:0,casts:{},hits:{}}; T.rec.set(u,r);} return r; };
  const slotOf=(u,type)=>{ const K=vm.runInContext('KITS',ctx)[u.key]||{};
    if(type===(u.abilityOverride||u.t.ability)) return 'ult';
    if(K.green&&K.green.type===type) return 'green'; if(K.blue&&K.blue.type===type) return 'blue'; return 'other:'+type; };
  const wrap=(name,fn)=>{ const orig=S[name]; if(typeof orig!=='function') throw new Error('no '+name); S[name]=fn(orig); };
  wrap('_doEffectCore',o=>function(u,type,opt){ const prev=T.cur; const slot=u&&u._castSlot==='ult'?'ult':slotOf(u,type);
    if(u) u.__lastSlot=slot;
    T.cur={src:u,slot}; try{ return o.apply(this,arguments); } finally{ T.cur=prev; } });
  for(const [fn,slot] of [['hollowStrike','ult'],['konwuBlinkExec','blue'],['konwuKickExec','blue']])
    wrap(fn,o=>function(u){ const prev=T.cur; T.cur={src:u,slot}; try{ return o.apply(this,arguments);} finally{ T.cur=prev; } });
  wrap('castAbility',o=>function(u){ const r=R(u); r.casts.ult=(r.casts.ult||0)+1; u.__lastSlot='ult'; return o.apply(this,arguments); });
  wrap('castKit',o=>function(u,ab){ const slot=(u.blueAb&&ab===u.blueAb)?'blue':'green'; const r=R(u); r.casts[slot]=(r.casts[slot]||0)+1; return o.apply(this,arguments); });
  wrap('fuseStrike',o=>function(u,tgt,clip,go){ const g=go; arguments[3]=function(){ const prev=T.cur; T.cur={src:u,slot:'basic'}; try{ return g.apply(this,arguments);} finally{ T.cur=prev; } }; return o.apply(this,arguments); });
  wrap('dealDamage',o=>function(src,tgt){ const prev=T.cur; if(!(prev&&prev.src===src)) T.cur={src,slot:(src&&src.__lastSlot)?src.__lastSlot+'~':'other'};
    try{ return o.apply(this,arguments);} finally{ T.cur=prev; } });
  wrap('pushDot',o=>function(t){ const r=o.apply(this,arguments); const d=t&&t.dots&&t.dots[t.dots.length-1]; if(d&&T.cur){ d.__src=T.cur.src; d.__slot=T.cur.slot+'(dot)'; } return r; });
  wrap('damage',o=>function(u,a,c,noEnergy){ const hp0=u.hp, al0=u.alive; let src=T.cur;
    if(!src && noEnergy && u.dots){ const d=u.dots.find(d=>d.dps===a&&d.__src); if(d) src={src:d.__src,slot:d.__slot}; }
    const r=o.apply(this,arguments);
    if(src&&src.src&&src.src.team!==u.team){ const done=Math.max(0,hp0-Math.max(0,u.hp)); const rr=R(src.src); rr.dmg[src.slot]=(rr.dmg[src.slot]||0)+done;
      if(al0&&!u.alive) rr.kills++; }
    else if(al0&&!u.alive){ T.unk=(T.unk||0)+1; }
    if(!src||!src.src){ T.unattrib=(T.unattrib||0)+Math.max(0,hp0-Math.max(0,u.hp)); }
    return r; });
  function reset(){ T.rec=new Map(); T.unattrib=0; T.unk=0; T.cur=null; }
  function report(){ const out=[]; for(const [u,r] of T.rec) out.push(r); return {rows:out, unattrib:T.unattrib}; }
  return {host,S,ctx,reset,report};
}
function spec(key,o){ const z={hp:0,atk:0,apow:0,pen:0,armor:0,mr:0,armorPen:0,magicPen:0,crit:0,critDmg:0,critRes:0,energy:0,regen:0,startEnergy:0,ctrlRes:0,ctrlHit:0,healPow:0,lifesteal:0,atkSpd:0,haste:0,moveSpd:0,range:0,eva:0,acc:0,block:0,dmgBonus:0,dmgRed:0,shieldStr:0,defense:0};
  return {key,level:o.level,stars:o.stars,pips:0,ref:0,glyphRank:o.glyphRank,tt:z,ex:{techCrit:0,techCritRes:0,techHeal:0,equip:{}},fAtk:0,fHp:0,fApow:0,techArmor:0,techMr:0,techHeal:0,apMul:1,skillLv:o.skillLv.slice(),gearSkill:null,templeBonuses:{}}; }
module.exports={load,spec,ROOT};
