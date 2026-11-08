'use strict';
// v1313 (Phil 8 Nov 2026): "big flaw with all monsters and bosses" / "they should all scale ability power or attack damage" /
//   "they should have ability power or attack damage and scale off that" (the Irix Glossary card showed a generic "Damage 47");
//   Magmourn: "magmourn seems a bit weak lets change him a bit" / "fireball is an AOE ability now, he always aims for the weakest hero in
//   backline, ignite all is a 20 meter range on all heroes" / "he should be a mage tank".
// Every monster / boss has a damageProfile (Magic: Mage-role + Ashen, Nightgloom, Wintercrag, Magmourn; Attack: the rest). A Magic one's
// abilities and autos scale off its Ability Power (= the old damage number) and land as magic damage (Magic Resist); an Attack one's
// off Attack Damage, physical (Armor). Magmourn is a Tank with Magic damage; his Fireball (2.4 m burst) aims at the lowest-HP back-row
// hero; Ignite All burns every hero within 20 m of him (was the whole field). The Glossary card names the stat.
// Runs the real battle engine (server/sim-host.js) beside the live v1312 page (git a5150597) - the CONTROL.
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const LIVE_SHA = process.env.LIVE_SHA || 'a5150597';
const liveHtml = path.join(ROOT, '.test-mondmg1313-live-' + process.pid + '.html');
fs.writeFileSync(liveHtml, cp.execFileSync('git', ['-C', ROOT, 'show', LIVE_SHA + ':emberweave-heroes.html'], { maxBuffer: 1 << 28 }));
process.on('exit', () => { try { fs.unlinkSync(liveHtml); } catch (e) {} });
const load = p => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(p); return src => vm.runInContext(src, h.ctx); };
const run = load(path.join(ROOT, 'emberweave-heroes.html')), runLive = load(liveHtml);
const runUndo = load(require('./helpers/global-1254-1260.js').page(path.join(ROOT, 'emberweave-heroes.html')));
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? ' - ' + detail : '')); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9) * Math.max(1, Math.abs(b));
const prep = `units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0;
  const mk=(k,t,x,y,ex)=>{ const z=makeUnit(k,t,x,y,50,Object.assign({owned:false,rank:3},ex||{})); z.atkInterval=99; z.speed=0; z.energy=0; z.critChance=0; z.crit=0; z.glyphCrit=0; z.dodge=0; z.evaStat=0; z.blockStat=0; z.maxHp=z.hp=1e7; z.greenCd=z.blueCd=999; z.armorPen=0; z.magicPen=0; z.armorRating=0; z.mrRating=0; return z; };
  const cast=(W,ab)=>{ W._castLv=1; W._aimWX=null; W._aimWY=null; doEffect(W,ab.type,ab.deliver?Object.assign({},ab,{_arrived:true}):ab); };`;   /* v1314: Magmourn's Fireball is a delivered shot - the check runs its landing */
try {
  // ---- 1. the data ----
  const data = r => JSON.parse(r(`JSON.stringify((()=>{ const o={}; for(const k in MONSTER_TYPES){ const t=MONSTER_TYPES[k]; o[k]=[t.role,t.damageProfile||null]; } return o; })())`));
  const d = data(run), dL = data(runLive);
  const keys = Object.keys(d);
  ck('every monster / boss type (' + keys.length + ') has damageProfile Magic or Attack', keys.length > 70 && keys.every(k => d[k][1] === 'Magic' || d[k][1] === 'Attack'), JSON.stringify(keys.filter(k => !/^(Magic|Attack)$/.test(d[k][1]))));
  ck('every Mage-role monster is Magic', keys.filter(k => d[k][0] === 'Mage').every(k => d[k][1] === 'Magic'));
  const extra = keys.filter(k => d[k][0] !== 'Mage' && d[k][1] === 'Magic').sort();
  // v1315 (Phil 8 Nov "audit the game"): classes come from MON_CLASS (art, kit, lore), no more Warrior / Brute; caster bruisers and mage tanks are Magic
  ck('v1315: no monster is left on a label the game has no class for (Warrior / Brute)', keys.every(k => !/^(Warrior|Brute)$/.test(d[k][0])), JSON.stringify(keys.filter(k => /^(Warrior|Brute)$/.test(d[k][0]))));
  ck('v1315: the non-Mage Magic ones are the caster bruisers, mage tanks and the dryad', extra.includes('leviath') && extra.includes('wintercrag') && extra.includes('magmourn') && extra.includes('runic automaton') && !extra.includes('brukk'), JSON.stringify(extra));
  ck('v1315: Brukk / Vharok / Orryx are Attack; Volthex a Mage, Leviath a Bruiser, both Magic', ['brukk', 'vharok', 'orryx'].every(k => d[k][1] === 'Attack') && d.volthex[0] === 'Mage' && d.volthex[1] === 'Magic' && d.leviath[0] === 'Bruiser' && d.leviath[1] === 'Magic', JSON.stringify([d.volthex, d.leviath]));
  ck('Magmourn is a Tank with Magic damage (a mage tank)', d.magmourn[0] === 'Tank' && d.magmourn[1] === 'Magic', JSON.stringify(d.magmourn));
  ck('Magmourn stands in the front line (formation depth 0)', run(`heroFormationDepth('magmourn')`) === 0 && runLive(`heroFormationDepth('magmourn')`) > 0);
  ck('CONTROL: live v1312 has no damageProfile on any monster, Magmourn a Mage', Object.keys(dL).every(k => dL[k][1] === null) && dL.magmourn[0] === 'Mage');

  // ---- 2. a Mage monster's ability (Lost Soul, Soul Bolt) and an Attack one's (Skulk, Rockskin Slam) ----
  const hits = r => JSON.parse(r(`(()=>{ ${prep} const out={};
    for(const [mon,slot] of [['lost soul','greenAb'],['skulk','blueAb'],['magmourn','greenAb']]){ for(const [tag,a,m] of [['zero',0,0],['both',1500,1500],['arm',1500,0],['mr',0,1500]]){
      const W=mk(mon,'enemy',700,700,mon==='magmourn'?{boss:true}:{}), D=mk('vael','ally',700,700+METER); D.armorRating=a; D.mrRating=m; W.target=D; units=[W,D];
      const h=D.hp; cast(W,W[slot]); const ab=h-D.hp; D.hp=D.maxHp;
      const h2=D.hp; dealDamage(W,D,1000,'#fff'); const auto=(h2-D.hp)/1000; D.hp=D.maxHp;
      out[mon+'|'+tag]={ab:+ab.toFixed(6), auto:+auto.toFixed(9), apow:W.apow, dmg:W.dmg}; } }
    out.ref=1-defToDR(1500,50); return JSON.stringify(out); })()`));
  const h = hits(run), hL = hits(runLive);
  const ref = h.ref;
  ck('Lost Soul (Magic): its Ability Power = its damage number', h['lost soul|zero'].apow > 0 && near(h['lost soul|zero'].apow, h['lost soul|zero'].dmg), JSON.stringify(h['lost soul|zero']));
  ck('Lost Soul Soul Bolt on 0 / 0: the live number', h['lost soul|zero'].ab > 0 && near(h['lost soul|zero'].ab, hL['lost soul|zero'].ab, 1e-9), h['lost soul|zero'].ab + ' vs ' + hL['lost soul|zero'].ab);
  ck('... on equal Armor and MR (1500 / 1500): the live number', near(h['lost soul|both'].ab, hL['lost soul|both'].ab, 1e-9), h['lost soul|both'].ab + ' vs ' + hL['lost soul|both'].ab);
  ck('... cut by Magic Resist: 1500 MR -> x (1 - defToDR(1500))', near(h['lost soul|mr'].ab, h['lost soul|zero'].ab * ref, 1e-7), JSON.stringify([h['lost soul|mr'].ab, h['lost soul|zero'].ab * ref]));
  ck('... not by Armor: 1500 Armor -> unchanged', near(h['lost soul|arm'].ab, h['lost soul|zero'].ab, 1e-9), h['lost soul|arm'].ab);
  ck('Lost Soul basic attack is magic too (MR cuts it, Armor does not)', near(h['lost soul|mr'].auto, ref, 1e-7) && near(h['lost soul|arm'].auto, 1, 1e-9), JSON.stringify([h['lost soul|mr'].auto, h['lost soul|arm'].auto]));
  ck('CONTROL: live Lost Soul Soul Bolt was physical (Armor cut it, MR did not)', near(hL['lost soul|arm'].ab, hL['lost soul|zero'].ab * ref, 1e-7) && near(hL['lost soul|mr'].ab, hL['lost soul|zero'].ab, 1e-9));
  ck('Skulk (Attack) Rockskin Slam on 0 / 0: the live number', h['skulk|zero'].ab > 0 && near(h['skulk|zero'].ab, hL['skulk|zero'].ab, 1e-9));
  ck('... cut by Armor, not by MR', near(h['skulk|arm'].ab, h['skulk|zero'].ab * ref, 1e-7) && near(h['skulk|mr'].ab, h['skulk|zero'].ab, 1e-9), JSON.stringify([h['skulk|arm'].ab, h['skulk|mr'].ab]));
  ck('Skulk keeps no Ability Power (Attack)', !(h['skulk|zero'].apow > 0));
  ck('Magmourn Fireball on 0 / 0: the live number x1.3 (v1314: "magmourn needs 30% more ability power"; a mage tank keeps the caster +30%)', h['magmourn|zero'].ab > 0 && near(h['magmourn|zero'].ab, hL['magmourn|zero'].ab * 1.3, 1e-9), h['magmourn|zero'].ab + ' vs ' + hL['magmourn|zero'].ab);
  ck('Magmourn Fireball and auto: magic (MR cuts them, Armor does not)', near(h['magmourn|mr'].ab, h['magmourn|zero'].ab * ref, 1e-7) && near(h['magmourn|arm'].ab, h['magmourn|zero'].ab, 1e-9) && near(h['magmourn|mr'].auto, ref, 1e-7));
  ck('helper undo (MON_DMG_TYPES=false): Lost Soul Soul Bolt physical again', (() => { const u = hits(runUndo); return near(u['lost soul|arm'].ab, u['lost soul|zero'].ab * ref, 1e-7) && near(u['lost soul|mr'].ab, u['lost soul|zero'].ab, 1e-9); })());
  // a damage multiplier applied after the unit is built (campaign dmgMul, Wrath...) reaches the Ability Power too
  ck('Ability Power follows a later damage multiplier (x1.5 on dmg -> the bolt x1.5)', (() => { const r = JSON.parse(run(`(()=>{ ${prep} const W=mk('lost soul','enemy',700,700), D=mk('vael','ally',700,700+METER); W.target=D; units=[W,D];
      let h=D.hp; cast(W,W.greenAb); const a=h-D.hp; D.hp=D.maxHp; W.dmg*=1.5; h=D.hp; cast(W,W.greenAb); return JSON.stringify([a,h-D.hp,W.apow,W.dmg]); })()`)); return near(r[1], r[0] * 1.5, 1e-9) && near(r[2], r[3]); })());

  // ---- 3. Fireball aims at the lowest-HP back-row hero ----
  const backs = JSON.parse(run(`JSON.stringify(Object.keys(HERO_PROFILES).filter(k=>HERO_PROFILES[k].combatRow==='Back'&&HERO_TYPES[k]).slice(0,3))`));
  const fronts = JSON.parse(run(`JSON.stringify(Object.keys(HERO_PROFILES).filter(k=>HERO_PROFILES[k].combatRow==='Front'&&HERO_TYPES[k]).slice(0,1))`));
  const fb = r => JSON.parse(r(`(()=>{ ${prep} const B=${JSON.stringify(backs)}, F=${JSON.stringify(fronts)};
    const M=mk('magmourn','enemy',500,400,{boss:true});
    const fr=mk(F[0],'ally',500,400+2*METER); fr.hp=1e6;                  /* the lowest HP overall, front row, next to him */
    const b1=mk(B[0],'ally',200,400+20*METER); b1.hp=5e6;                 /* back row, healthy */
    const b2=mk(B[1],'ally',800,400+20*METER); b2.hp=3e6;                 /* back row, the weakest back-row hero */
    const nb=mk(B[2],'ally',800+1.5*METER,400+20*METER); nb.hp=8e6;        /* 1.5 m from b2: inside the 2.4 m burst */
    M.target=fr; units=[M,fr,b1,b2,nb]; const hp0=units.map(z=>z.hp);
    let fxT=null, artC=null; const _fx=fxFor, _aa=abilArt; fxFor=function(type,u,t,o){ if(u===M) fxT=t; return _fx.apply(this,arguments); };
    abilArt=function(u,o,t,c,type){ if(u===M) artC=c; return _aa.apply(this,arguments); };
    try{ castKit(M,M.greenAb); const aim=[M._aimWX,M._aimWY]; cast(M,M.greenAb); M._aimWX=aim[0]; M._aimWY=aim[1];
      const lost=units.map((z,i)=>+(hp0[i]-z.hp).toFixed(3));
      return JSON.stringify({fr:lost[1],b1:lost[2],b2:lost[3],nb:lost[4], fx:fxT===b2?'b2':fxT===fr?'fr':String(fxT&&fxT.key), art:artC?(Math.hypot(artC.x-b2.x,artC.y-b2.y)<1?'b2':Math.hypot(artC.x-fr.x,artC.y-fr.y)<1?'fr':'other'):null,
        castAim:(aim[0]!=null&&Math.hypot(aim[0]-b2.x,aim[1]-b2.y)<1)?'b2':'other', target:M.greenAb.target||null, radius:M.greenAb.radius/METER}); }
    finally{ fxFor=_fx; abilArt=_aa; } })()`));
  const f = fb(run), fL = fb(runLive);
  ck('back-row test heroes found (' + backs.join(', ') + ' / front ' + fronts.join(', ') + ')', backs.length === 3 && fronts.length === 1);
  ck('Fireball hits the lowest-HP back-row hero', f.b2 > 0, JSON.stringify(f));
  ck('... and the hero 1.5 m from it (an area hit - v1314: 5 m radius, Phil: "hits everyone within 5 meters of impact")', f.nb > 0 && f.radius === 5, JSON.stringify(f));
  ck('... not the healthier back-row hero, nor the lower-HP front-row hero beside Magmourn', f.b1 === 0 && f.fr === 0, JSON.stringify(f));
  ck('the visual lands on the same hero (fire rain target + plate centre + the cast aim)', f.fx === 'b2' && f.art === 'b2' && f.castAim === 'b2', JSON.stringify(f));
  ck('CONTROL: live v1312 Fireball burst on his current target (the front hero), not the back row', fL.fr > 0 && fL.b2 === 0 && fL.b1 === 0, JSON.stringify(fL));
  // no back-row hero alive -> the lowest-HP hero overall
  const fb2 = JSON.parse(run(`(()=>{ ${prep} const F=${JSON.stringify(fronts)}, M=mk('magmourn','enemy',500,400,{boss:true});
    const a=mk(F[0],'ally',300,400+5*METER); a.hp=6e6; const b=mk('vael','ally',900,400+5*METER); b.hp=2e6; M.target=a; units=[M,a,b];
    const pa=HERO_PROFILES.vael&&HERO_PROFILES.vael.combatRow; const h=[a.hp,b.hp]; cast(M,M.greenAb); return JSON.stringify({a:h[0]-a.hp,b:h[1]-b.hp,row:pa}); })()`));
  ck('no back-row hero: the lowest-HP hero overall takes it (' + fb2.row + ' row Vael)', fb2.row !== 'Back' && fb2.b > 0 && fb2.a === 0, JSON.stringify(fb2));

  // ---- 4. Ignite All: every hero within 20 m of him ----
  const ig = r => JSON.parse(r(`(()=>{ ${prep} const M=mk('magmourn','enemy',500,400,{boss:true});
    const n=mk('vael','ally',500,400+8*METER), far=mk('vael','ally',500,400+12*METER);   /* v1314: 20 m wide = 10 m radius */ M.target=n; units=[M,n,far];
    cast(M,M.blueAb); return JSON.stringify({n:n.dots.length, far:far.dots.length, r:M.blueAb.radius/METER}); })()`));
  const g = ig(run), gL = ig(runLive);
  ck('Ignite All burns the hero at 8 m (v1314: 20 m wide)', g.n > 0, JSON.stringify(g));
  ck('... and not the one at 12 m (radius 10 m = 20 m wide, centred on Magmourn)', g.far === 0 && Math.abs(g.r - 10) < 1e-9, JSON.stringify(g));
  ck('CONTROL: live v1312 Ignite All burned both (whole field)', gL.n > 0 && gL.far > 0, JSON.stringify(gL));

  // ---- 5. the card ----
  const card = (r, id) => r(`glStatsHtml(${JSON.stringify(id)},'bosses')`);
  const nerC = card(run, 'nerissa'), irxC = card(run, 'brukk'), magC = card(run, 'magmourn');
  const AP = run(`ewT('hero.stat_apow')`), AD = run(`ewT('hero.stat_atk')`);
  ck('Nerissa (mage boss) card: "' + AP + '" with the Ability Power icon, no "Damage"', nerC.includes(AP) && nerC.includes('/stat/apow-') && !nerC.includes('>' + run(`ewT('gloss.damage')`) + '<') && !/ Damage</.test(nerC));
  ck('Brukk card (v1315: Irix is a caster now): "' + AD + '" with the Attack icon', irxC.includes(AD) && irxC.includes('/stat/atk-') && !irxC.includes(AP));
  ck('Magmourn card: Ability Power, Tank, front line', magC.includes(AP) && magC.includes(run(`rosterClassName('Tank')`)) && magC.includes(run(`ewT('gloss.front_line')`)));
  ck('the card number is unchanged (Irix ' + (irxC.match(/<b>(\d+)<\/b><\/div><div class="gsRow"><span>⏱/) || [])[1] + ')', (irxC.match(/<b>(\d+)<\/b><\/div><div class="gsRow"><span>⏱/) || [])[1] === (card(runLive, 'irix').match(/<b>(\d+)<\/b><\/div><div class="gsRow"><span>⏱/) || [])[1]);
  // the stats-by-level modal needs a real DOM (the sim's document is a frozen stub): its header is glDmgLabel(t,true) - checked in the source and by value
  ck('"View stats by level" table header names the stat: openStatChart reads glDmgLabel(t,true)', run(`openStatChart.toString()`).includes("<th>'+glDmgLabel(t,true)+'</th>") && !run(`openStatChart.toString()`).includes("gloss.dmg"));
  ck('... Ability Power for a mage boss (Nerissa), Attack Damage for Brukk', run(`glDmgLabel(MONSTER_TYPES.nerissa,true)`).includes(AP) && run(`glDmgLabel(MONSTER_TYPES.nerissa,true)`).includes('/stat/apow-') && run(`glDmgLabel(MONSTER_TYPES.brukk,true)`).includes(AD));
  ck('CONTROL: live v1312 Irix card read "Damage"', card(runLive, 'irix').includes(runLive(`ewT('gloss.damage')`)) && !card(runLive, 'irix').includes(AD));
} catch (e) { fail++; console.log('  FAIL threw: ' + (e && e.stack || e)); }
console.log('test_monster_damage_types_1313.js: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
