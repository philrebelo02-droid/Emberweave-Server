/* ============================================================================
   v270 — RE-AUTHOR THE CAMPAIGN AGAINST THE REAL BATTLE ENGINE.

   The 100 stages were tuned against server/combat-core.js — an ESTIMATE — plus a 1.35× "skill band".
   The fight the player actually plays is the client engine, and it is far harsher: a fresh line lost
   1-1, 1-2, 1-3, 1-5 and 1-10. The server's allowance hid that by awarding wins the on-screen battle
   had lost. Now that the player's own fight IS the record (v270), the curve has to be true.

   So every stage is tuned by FIGHTING it in the real engine, through server/sim-host.js, with a
   reference line built from the game's own catalogs at the progression the blueprint expects.
   ============================================================================ */
const fs=require('fs'), path=require('path');
const HOST=require('../../server/sim-host.js').load(path.join(__dirname,'../..','emberweave-heroes.html'));
const GLYPH_SRC=JSON.parse(fs.readFileSync(path.join(__dirname,'../../server/glyph-source.json'),'utf8'));
const LADDER=['Grey','Green','Green +1','Blue','Blue +1','Blue +2','Purple','Purple +1','Purple +2','Purple +3','Gold','Gold +1','Gold +2','Gold +3','Gold +4','Orange'];
const MIN_LEVEL=[1,7,13,18,24,30,36,43,50,57,65,72,79,86,93,100];

/* ---- the reference board: six glyphs of a quality, straight out of the shipped catalog ---- */
const STAT_FIELD={'HP':'hp','Physical Attack':'atk','Ability Power':'apow','Armor':'armor','Magic Resist':'mr',
  'Crit Chance':'crit','Crit Damage':'critDmg','Tenacity':'ctrlRes','Control Resist':'ctrlRes','Control Hit':'ctrlHit',
  'Starting Energy':'startEnergy','Healing Power':'healPow','Energy Regen':'energy','HP Regen':'regen',
  'Lifesteal':'lifesteal','Attack Speed':'atkSpd','Haste':'haste','Evasion':'eva','Accuracy':'acc','Block':'block',
  'Damage Bonus':'dmgBonus','Damage Reduction':'dmgRed','Shield Strength':'shieldStr',
  'Armor Penetration':'armorPen','Magic Penetration':'magicPen'};
function parseStats(s){ return String(s||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{
  const m=/^(.+?)\s*\+([\d.]+)(%?)$/.exec(x); return m?{stat:m[1],val:+m[2]}:null; }).filter(Boolean); }
/* A hero's board is not just what is socketed NOW. Every glyph ASCENDED on the way up leaves its
   stats behind permanently (server.js: `board.ascended`), so a Gold hero carries the whole ladder
   underneath it. Modelling only the six current glyphs made the reference line absurdly weak at high
   level — which is exactly how a difficulty curve ends up authored against a player who doesn't exist. */
const BOARD_BY_TIER=(()=>{
  const out=[]; const carried={};
  for(let t=0;t<LADDER.length;t++){
    const pool=GLYPH_SRC.filter(g=>g.quality===LADDER[t]).sort((a,b)=>a.id<b.id?-1:1);
    const tt=Object.assign({},carried);
    for(let i=0;i<6;i++){ const g=pool[i%pool.length]; if(!g) continue;
      for(const st of parseStats(g.passiveStats)){ const f=STAT_FIELD[st.stat]; if(f) tt[f]=(tt[f]||0)+st.val; } }
    // ascending to the next tier banks this tier's whole set of six
    for(const k in tt) carried[k]=tt[k];
    const fin={}; for(const k in tt) fin[k]=Math.round(tt[k]);
    if(fin.crit) fin.crit=Math.min(60,fin.crit);
    out.push(fin);
  }
  return out;
})();
function tierForLevel(lv){ let t=0; for(let i=0;i<MIN_LEVEL.length;i++) if(lv>=MIN_LEVEL[i]) t=i; return t; }

/* ---- the reference line the blueprint expects at a given stage ---- */
const ROSTER=['vael','sylthaine','vireo','fritz','tick'];
function teamSizeFor(s){ return s<=3?3:(s<=6?4:5); }
function starsFor(s){ return Math.max(1,Math.min(5,1+Math.floor((s-1)/25))); }
/* A brand-new player owns NO glyphs. The blueprint says 1-1 and 1-2 must be clearable without any,
   so the reference line carries an empty board until the player has had a chance to craft one. */
const NO_GLYPH_UNTIL=3;
function referenceSpecs(s, tierShift, levelShift){
  const level=Math.max(1,Math.min(100,s+(levelShift||0)));
  const tier=Math.max(0,Math.min(15,tierForLevel(level)+(tierShift||0)));
  const tt=(s<=NO_GLYPH_UNTIL && !tierShift)?{}:(BOARD_BY_TIER[tier]||{});
  return ROSTER.slice(0,teamSizeFor(s)).map(k=>({ key:k, level, stars:starsFor(s), pips:0, ref:0,
    glyphRank:tier, tt:Object.assign({},tt), ex:{},
    fAtk:tt.atk||0, fHp:tt.hp||0, fApow:tt.apow||0, apMul:1, skillLv:[1,1,1,1] }));
}
/* AUTO on is the honest baseline: it is what the engine does with no human timing at all. Manual play
   — held ultimates, aim, focus fire — can only do better, and now actually shows up in the result. */
const AUTO=[[1,'auto',-1,1,null,null]];

/* ---- the target the player should EXPERIENCE (blueprint §difficulty) ---- */
function targetHpFrac(s){
  const st=((s-1)%10)+1;
  let hp=0.62+(0.52-0.62)*((s-1)/99);          // 0.62 at 1-1 → 0.52 at 10-10
  if(st===5) hp-=0.08;                          // the observable elite check
  if(st===10) hp-=0.20;                         // the boss jump
  return Math.max(0.14,hp);
}
function scaleWaves(waves, d){
  return waves.map(w=>w.map(m=>Object.assign({},m,{
    hpMul:+( (m.baseHpMul!=null?m.baseHpMul:m.hpMul) * d ).toFixed(4),
    dmgMul:+( (m.baseDmgMul!=null?m.baseDmgMul:m.dmgMul) * Math.pow(d,0.7) ).toFixed(4) })));
}
function fight(specs, waves, seed){
  const snaps=HOST.snapFromSpecs(specs);
  const r=HOST.campaign(snaps, waves, seed>>>0, AUTO);
  return { won:r.won, hpFrac:r.won?r.hpFrac:0, stars:r.stars };
}
/* Search the difficulty scalar that delivers the target experience. Higher d = harder = less HP left. */
function tuneStage(stage, s, opts){
  opts=opts||{};
  const specs=referenceSpecs(s, opts.tierShift||0);
  const target=(opts.target!=null)?opts.target:targetHpFrac(s);
  const seeds=[1111,2222,3333];
  const measure=(d)=>{ const w=scaleWaves(stage.waves,d);
    const rs=seeds.map(sd=>fight(specs,w,sd));
    const wins=rs.filter(r=>r.won).length;
    const hp=rs.reduce((a,r)=>a+r.hpFrac,0)/rs.length;
    return { wins, hp, stars:Math.round(rs.reduce((a,r)=>a+r.stars,0)/rs.length) }; };
  let lo=0.02, hi=4.0, best=null, hardestWin=null;
  for(let i=0;i<13;i++){
    const mid=Math.sqrt(lo*hi);
    const m=measure(mid);
    const eff=(m.wins===seeds.length)?m.hp:0;              // a loss counts as "no HP left"
    if(m.wins===seeds.length && (!hardestWin || mid>hardestWin.d)) hardestWin={d:mid, eff, m};
    if(!best || Math.abs(eff-target)<Math.abs(best.eff-target)) best={d:mid, eff, m};
    if(eff<target) hi=mid; else lo=mid;                    // too hard → lower d
  }
  /* Some encounters have no middle: below a threshold the line walks through them untouched, above it
     the line is wiped. Chasing the target there would leave the stage UNWINNABLE, which is the one
     outcome that must never ship. In that case take the hardest setting that still wins on every seed. */
  if((!best || best.m.wins<seeds.length) && hardestWin) return Object.assign({}, hardestWin, {cliff:true});
  return best;
}
module.exports={ referenceSpecs, tuneStage, scaleWaves, targetHpFrac, BOARD_BY_TIER, fight, AUTO, HOST };

if(require.main===module){
  const enc=JSON.parse(fs.readFileSync(path.join(__dirname,'../../server/campaign-encounters.json'),'utf8'));
  const only=process.argv[2]?process.argv[2].split(',').map(Number):null;
  console.log('reference board tiers:', BOARD_BY_TIER.map((t,i)=>LADDER[i]+':hp'+(t.hp||0)+'/atk'+(t.atk||0)).slice(0,4).join('  '));
  for(const s of (only||[1,2,3,5,10])){
    const st=enc[s-1];
    const before=fight(referenceSpecs(s), st.waves, 1111);
    const b=tuneStage(st, s);
    console.log(st.id, 'target', targetHpFrac(s).toFixed(2), '| before: won', before.won, 'hp', before.hpFrac.toFixed(2),
      '| tuned d', b.d.toFixed(3), 'hp', b.eff.toFixed(2), 'wins', b.m.wins+'/3');
  }
}
