'use strict';
// v1112 (Phil 10 Oct 2026): "1. yes" (fix the bugs, every card line and hover text shows the real levelled number) /
// "2. yes propose the gains" (the audit's per-level gains for the skills that did not scale) /
// "3. if they are too strong at 100 level we need to nerf it and scale back the gains per level to climb".
// Runs the real battle engine (server/sim-host.js loads emberweave-heroes.html headless, the file the server replays fights with):
//   - the FIGHT value at level 1 is the old level-1 value, at level 100 it is the planned value, and the level-100 caps hold;
//   - the CARD line (skillEffectStr) and the HOVER text (skillDesc) carry the fight's number at levels 1, 50 and 100;
//   - CONTROLS: the old formulas (wrong-way DR at level 46, uncapped shred, 4.38 s Layered Hide, sm-less channels) give different numbers.
// One line per check; exit code = number of failures.
const path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const host = require(path.join(ROOT, 'server/sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
const run = src => vm.runInContext(src, host.ctx);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? ' - ' + detail : '')); } };
const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-9);
const SM = lv => 1 + (lv - 1) * 0.012;                       // the standard curve (SKILL_STEP 0.012)
const pct = x => (Math.round(x * 1000 + 1e-6) / 10) + '%';   // the card's one-decimal percent
const sec = x => (+(+x).toFixed(2)) + 's';
const LVS = [1, 50, 100];

// ---------------------------------------------------------------- helpers that run the page
const card = (key, idx, lv) => run(`(()=>{ G.skillLevel=G.skillLevel||{}; G.skillLevel['${key}']=[${lv},${lv},${lv},${lv}]; return stripIcons(skillEffectStr('${key}',${idx},1000,10000)); })()`);
const hover = (key, idx, lv) => run(`(()=>{ G.skillLevel=G.skillLevel||{}; G.skillLevel['${key}']=[${lv},${lv},${lv},${lv}]; return skillDesc('${key}',${idx}); })()`);
// cast a kit slot (1 green, 2 blue) or the ult (0) at a skill level against one dummy enemy; returns what `probe` reads
const cast = (key, slot, lv, probe, foe) => JSON.parse(run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0;
  const u=makeUnit('${key}','ally',300,700,20,{owned:false}), a=makeUnit('vael','ally',340,700,20,{owned:false}), e=makeUnit('${foe || 'grosk'}','enemy',420,700,20,{owned:false});
  units=[u,a,e]; units.forEach(x=>{ x.atkInterval=99; x.speed=0; x.greenAb=null; x.blueAb=null; x.energy=0; });
  e.maxHp=e.hp=1e9; u.skillLv=[${lv},${lv},${lv},${lv}];
  const ab=${slot}===0?Object.assign({},ULT_DEF[u.t.ability]||{}):Object.assign({},${slot}===1?KITS['${key}'].green:KITS['${key}'].blue); delete ab.deliver;
  const type=${slot}===0?u.t.ability:ab.type;
  u._castSM=skillMul(${lv}); u._castLv=${lv}; u._castSlot=${slot}===0?'ult':(${slot}===1?'green':'blue');
  doEffect(u,type,ab); if(u._dash&&u._dash.run) u._dash.run();
  const r=(${probe})(u,a,e); u._castSM=1; u._castLv=0; return JSON.stringify(r); })()`));
// a passive ticking for `steps` frames at a level
const tick = (key, pass, lv, setup, probe, steps) => JSON.parse(run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0;
  const u=makeUnit('${key}','ally',300,700,20,{owned:false}), e=makeUnit('grosk','enemy',420,700,20,{owned:false});
  units=[u,e]; units.forEach(x=>{ x.atkInterval=99; x.speed=0; x.greenAb=null; x.blueAb=null; x.energy=0; });
  e.maxHp=e.hp=1e9; u.skillLv=[${lv},${lv},${lv},${lv}]; u.pass={${pass}:true}; u.passMul=skillMul(${lv});
  (${setup})(u,e); for(let i=0;i<${steps || 1};i++) updateBattle(SIM_STEP);
  return JSON.stringify((${probe})(u,e)); })()`));

try {
  // ================================================================ A. BUGS
  // A1 - the five dodge-and-counter blues: reduction GROWS 0.1 pt a level, the counter takes the skill curve
  for (const [key, dr, mul] of [['veyr', 0.55, 2.0], ['kharos', 0.55, 2.1], ['vaelora', 0.55, 2.0], ['seyla', 0.6, 1.9], ['calypsa', 0.6, 1.6]]) {
    const plan = lv => dr - 0.001 * (lv - 1);
    const f = {}; for (const lv of LVS) f[lv] = cast(key, 2, lv, '(u)=>({dm:u.drMul, em:u._evadeMul})');
    ck(`${key} blue L1: damage-taken x${dr} (${pct(1 - dr)} reduction) and counter x${mul} - unchanged`, near(f[1].dm, dr) && near(f[1].em, mul), JSON.stringify(f[1]));
    ck(`${key} blue L100: ${pct(1 - plan(100))} reduction (grows), counter x${(mul * SM(100)).toFixed(3)}`, near(f[100].dm, plan(100), 1e-9) && near(f[100].em, mul * SM(100), 1e-9), JSON.stringify(f[100]));
    ck(`${key} blue L100 reduction <= 60%`, 1 - f[100].dm <= 0.60 + 1e-9);
    const oldL46 = Math.min(0.85, dr * SM(46));   // CONTROL: the old SKILL_SCALE_FRAC path made the multiplier GROW = less protection
    ck(`${key} CONTROL: old wrong-way value at L46 (x${oldL46.toFixed(3)} = ${pct(1 - oldL46)} reduction) differs from the fight's x${cast(key, 2, 46, '(u)=>u.drMul').toFixed(3)}`, !near(oldL46, cast(key, 2, 46, '(u)=>u.drMul'), 1e-3));
    // v1114: the counter swings off the hero's own stat - Magic heroes (Veyr, Vaelora) off Ability Power (card: apw = apow x Attack/dmg)
    const base = run(`(()=>{ const t=HERO_TYPES['${key}']; return (t.damageProfile==='Magic'||t.damageProfile==='Healer') ? Math.round((t.apow||0)*(1000/t.dmg)) : 1000; })()`);
    for (const lv of LVS) { const c = card(key, 2, lv); ck(`${key} blue card L${lv} shows -${pct(1 - plan(lv))} and the ${Math.round(base * mul * SM(lv))} counter`, c.includes('−' + pct(1 - plan(lv))) && c.includes(String(Math.round(base * mul * SM(lv)))), c); }
  }
  // A2 - Askel Rallying Ground
  { const f = {}; for (const lv of LVS) f[lv] = cast('askel', 2, lv, '(u,a)=>a.drMul');
    ck('askel banner L1: allies x0.82 (18%) - unchanged', near(f[1], 0.82));
    ck('askel banner L50/L100: 22.9% / 27.9% reduction', near(f[50], 0.771) && near(f[100], 0.721), JSON.stringify(f));
    ck('askel CONTROL: old wrong-way value at L46 was x' + Math.min(0.85, 0.82 * SM(46)).toFixed(3) + ' (15%)', !near(Math.min(0.85, 0.82 * SM(46)), cast('askel', 2, 46, '(u,a)=>a.drMul'), 1e-3));
    for (const lv of LVS) { const c = card('askel', 2, lv); ck(`askel card L${lv} shows team -${pct(1 - f[lv])}`, c.includes('team −' + pct(1 - f[lv])), c); }
    ck('askel hover L100 says 27.9% less damage', hover('askel', 2, 100).includes('27.9% less damage')); }
  // A3 - channelled ults carry the cast's curve into every tick
  for (const [key, ab, field] of [['sylthaine', 'blizzard', '_blizzSM'], ['vaelora', 'blizzard', '_blizzSM'], ['fritz', 'thundershower', '_stormSM'], ['calypsa', 'thundershower', '_stormSM']]) {
    const dmgAt = (lv, force) => JSON.parse(run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0;
      const u=makeUnit('${key}','ally',300,700,20,{owned:false}), e=makeUnit('grosk','enemy',360,700,20,{owned:false});
      units=[u,e]; units.forEach(x=>{ x.atkInterval=99; x.speed=0; x.greenAb=null; x.blueAb=null; x.energy=0; x.critChance=0; x.crit=0; });
      e.maxHp=e.hp=1e9; e.ctrlRes=1; u.skillLv=[${lv},1,1,1]; u._castSM=skillMul(${lv}); u._castLv=${lv}; u._castSlot='ult';
      doEffect(u,'${ab}',Object.assign({},ULT_DEF['${ab}'],{deliver:null})); const sm=u.${field}; u._castSM=1; u._castLv=0; ${force ? `u.${field}=1;` : ''}
      const _dd=dealDamage, _df=dealFrostDamage; let got=0; const rec=c=>c==='#f2e07a'||c==='#bfefff';   // the tick amount the channel asks for, before armour and crits
      dealDamage=function(s,t,a,c){ if(s===u&&rec(c)) got+=a; return _dd.apply(this,arguments); }; dealFrostDamage=function(s,t,a,c){ if(s===u&&rec(c)) got+=a; return _df.apply(this,arguments); };
      try{ for(let i=0;i<Math.round(1.0/SIM_STEP);i++) updateBattle(SIM_STEP); } finally{ dealDamage=_dd; dealFrostDamage=_df; } return JSON.stringify({sm, d:got}); })()`));
    const a = dmgAt(1), b = dmgAt(100), c = dmgAt(100, true);
    ck(`${key} ${ab}: the channel stores the cast's curve (${field} ${a.sm} at L1, ${b.sm} at L100)`, near(a.sm, 1) && near(b.sm, SM(100)), JSON.stringify([a.sm, b.sm]));
    ck(`${key} ${ab}: 1 s of ticks at L100 deals ~x2.188 the L1 damage`, a.d > 0 && Math.abs(b.d / a.d - SM(100)) < 1e-6, (b.d / a.d).toFixed(3));
    ck(`${key} ${ab} CONTROL: without the stored curve L100 deals the L1 damage (the old bug)`, Math.abs(c.d / a.d - 1) < 1e-6, (c.d / a.d).toFixed(3));
    const cl = card(key, 0, 100); ck(`${key} ${ab} card L100 is the levelled tick`, /\/tick/.test(cl), cl);
  }
  // A4 - Veyr Gravity Crescent deals its 150% on the standard curve
  { const slash = (key, slot, lv) => { run(`var _vdd=dealDamage, _vgot=0; dealDamage=function(s,t,a,c){ if(c==='#8B5CF6') _vgot+=a; return _vdd.apply(this,arguments); };`);
      try { cast(key, slot, lv, '(u)=>0'); return run('_vgot'); } finally { run('dealDamage=_vdd;'); } };   // the slash's requested amount, before armour and crits
    const d1 = slash('veyr', 1, 1), d100 = slash('veyr', 1, 100), v = slash('vulmar', 2, 1);
    ck('veyr green L1 deals damage (the slash used to never land)', d1 > 0, d1);
    ck('veyr green L100 deals x2.188 the L1 slash', Math.abs(d100 / d1 - SM(100)) < 1e-6, (d100 / d1).toFixed(3));
    ck('veyr CONTROL: Vulmar Grasping Vow (same type, no mul) still deals nothing', v === 0, v);
    const X = parseInt(card('veyr', 1, 1), 10) / 1.5;   // the card's damage stat (Veyr is a Magic hero: Ability Power, as the fight's dB)
    for (const lv of LVS) { const c = card('veyr', 1, lv); ck(`veyr green card L${lv} shows ${Math.round(X * 1.5 * SM(lv))} (150% on the curve)`, Math.abs(parseInt(c, 10) - X * 1.5 * SM(lv)) <= 2 && /pull/.test(c), c); } }

  // ================================================================ B + C. GAINS and NERFS on actives (fight value at 1 / 50 / 100, card at 1 / 50 / 100)
  const ACT = [
    // key, slot, probe, L1 old value, per-level, card text builder
    ['tick', 1, '(u)=>u.hasteMul', 1.35, 0.002, v => '+' + pct(v - 1) + ' atk speed'],
    ['lumi', 2, '(u,a)=>a.hasteMul', 1.30, 0.001, v => '+' + pct(v - 1) + ' atk speed'],
    ['sorrel', 2, '(u)=>u.hasteMul', 1.32, 0.002, v => '+' + pct(v - 1) + ' atk speed'],
    ['tessit', 1, '(u,a)=>a.dmgBuffMul', 1.30, 0.001, v => '+' + pct(v - 1) + ' team dmg'],
    ['yenna', 2, '(u,a,e)=>e._markMul', 1.28, 0.001, v => '+' + pct(v - 1) + ' damage taken'],
    ['rhukk', 1, '(u)=>u.drMul', 0.50, -0.001, v => '−' + pct(1 - v) + ' damage taken'],
    ['hobb', 2, '(u)=>u.drMul', 0.45, -0.0005, v => '−' + pct(1 - v) + ' damage taken'],
    ['tharl', 2, '(u)=>u.drMul', 0.35, 0, v => '−' + pct(1 - v) + ' damage taken'],
    ['rhukk', 2, '(u)=>u.drMul', 0.60, -0.002, v => '−' + pct(1 - v) + ' dmg taken'],
    ['brannus', 2, '(u)=>u.drMul', 0.60, -0.002, v => '−' + pct(1 - v) + ' dmg taken'],
    ['gruel', 0, '(u)=>u.drMul', 0.60, -0.002, v => '−' + pct(1 - v) + ' dmg taken'],
    ['nox', 2, '(u,a)=>a.energy', 25, 0.1, v => 'ally +' + (+v.toFixed(1)) + ' energy'],
    ['lumi', 1, '(u,a)=>Math.max(a._wardT||0,u._wardT||0)', 3, 0.01, v => 'for ' + sec(v)],
    ['vael', 0, '(u)=>u.hp', null, null, null],
    ['lysara', 0, '(u,a)=>a.dmgBuffMul', 1.30, 0.001, v => 'team +' + pct(v - 1)],
    ['grosk', 0, '(u,a)=>a._mwDrPct', 0.30, 0.0015, v => 'team −' + pct(v) + ' dmg'],
  ];
  for (const [key, slot, probe, v1, per, txt] of ACT) {
    if (v1 === null) continue;
    const f = {}; for (const lv of LVS) f[lv] = cast(key, slot, lv, probe);
    const plan = lv => v1 + per * (lv - 1);
    ck(`${key} ${['ult', 'green', 'blue'][slot]} L1 = ${v1} (unchanged)`, near(f[1], v1, 1e-9), f[1]);
    ck(`${key} ${['ult', 'green', 'blue'][slot]} L50 / L100 = ${plan(50).toFixed(4)} / ${plan(100).toFixed(4)}`, near(f[50], plan(50), 1e-9) && near(f[100], plan(100), 1e-9), JSON.stringify(f));
    for (const lv of LVS) { const c = card(key, slot, lv); ck(`${key} card L${lv} shows ${txt(f[lv])}`, c.includes(txt(f[lv])), c); }
  }
  // C limits on the actives
  ck('C: taunt reduction at L100 <= 60% (Rhukk, Brannus, Gruel)', ['rhukk', 'brannus'].every(k => 1 - cast(k, 2, 100, '(u)=>u.drMul') <= 0.60) && 1 - cast('gruel', 0, 100, '(u)=>u.drMul') <= 0.60);
  ck('C CONTROL: the old taunt formula gave 85% at L100', near(1 - Math.max(0.15, 1 - 0.4 * SM(100)), 0.85));
  ck('C: Grosk Croc Drop team reduction at L100 <= 45% (was 65.6%)', cast('grosk', 0, 100, '(u,a)=>a._mwDrPct') <= 0.45, cast('grosk', 0, 100, '(u,a)=>a._mwDrPct'));
  ck('C: every single-skill damage reduction at L100 <= 60% except Fortress Curl, which is 65% from level 1 and does not grow', ['rhukk:1', 'hobb:2'].every(s => { const [k, i] = s.split(':'); return 1 - cast(k, +i, 100, '(u)=>u.drMul') <= 0.6 + 1e-9; }) && near(cast('tharl', 2, 100, '(u)=>u.drMul'), 0.35));
  // ults with heals / revive / shares
  { const v = {}; for (const lv of LVS) v[lv] = run(`skLvNum('laststand',ULT_DEF.laststand,${lv})`);
    ck('vael Last Stand heal 15% / 19.9% / 24.9%', near(v[1], 0.15) && near(v[50], 0.199) && near(v[100], 0.249), JSON.stringify(v));
    const h = cast('vael', 0, 100, '(u)=>{ return 0; }'); void h;
    for (const lv of LVS) { const c = card('vael', 0, lv); ck(`vael ult card L${lv} shows ${pct(v[lv])} max HP and no damage hit`, c.includes(pct(v[lv]) + ' max HP') && /dmg taken/.test(c), c); } }
  for (const [key, ab, b, per] of [['dandra', 'rally', 0.30, 0.001], ['linnet', 'rewind', 0.40, 0.0015]]) {
    for (const lv of LVS) { const v = run(`skLvNum('${ab}',ULT_DEF.${ab},${lv})`); const c = card(key, 0, lv);
      ck(`${key} ${ab} L${lv} = ${pct(b + per * (lv - 1))} and the card shows it`, near(v, b + per * (lv - 1)) && c.includes(pct(v)), c); } }
  { // Dandra's heal really lands at the levelled share
    const f = lv => cast('dandra', 0, lv, '(u,a)=>{ return 0; }');
    void f;
    const healed = lv => JSON.parse(run(`(()=>{ units=[]; ended=false; battleTime=0; const u=makeUnit('dandra','ally',300,700,20,{owned:false}), a=makeUnit('vael','ally',340,700,20,{owned:false});
      units=[u,a]; a.hp=1; u._castLv=${lv}; u._castSM=skillMul(${lv}); doEffect(u,'rally',Object.assign({},ULT_DEF.rally)); const r=(a.hp-1)/a.maxHp; u._castLv=0; u._castSM=1; return JSON.stringify(r); })()`));
    ck('dandra Queen\'s Call heals 30% at L1 and 39.9% at L100 in the fight', near(healed(1), 0.30, 0.002) && near(healed(100), 0.399, 0.002), [healed(1), healed(100)].join(' / ')); }
  // summons: Hurne, Aldren, Zahri - the summon's stats grow with the summoning skill
  for (const [key, slot, skey, base] of [['hurne', 1, 'boar warrior', null], ['hurne', 2, 'boar shaman', null], ['aldren', 1, 'ink spirit', null], ['aldren', 0, 'ink horror', null], ['zahri', 2, 'zahri mirage', null]]) {
    const ratio = lv => JSON.parse(run(`(()=>{ units=[]; ended=false; battleTime=0; const u=makeUnit('${key}','ally',300,700,20,{owned:false}); units=[u];
      const ab=${slot}===0?Object.assign({},ULT_DEF[u.t.ability]):Object.assign({},${slot}===1?KITS['${key}'].green:KITS['${key}'].blue); delete ab.deliver; ab.groundFrame=0; ab.handFrame=0;
      u.anim=null; u._castLv=${lv}; u._castSM=skillMul(${lv}); doEffect(u,${slot}===0?u.t.ability:ab.type,ab); (u._fuse||[]).forEach(f=>f.go()); u._fuse=[];
      const s=units.find(x=>x._summonOwner===u&&x.key==='${skey}'); u._castLv=0; u._castSM=1; return JSON.stringify(s?s.maxHp/u.maxHp:null); })()`));
    const r1 = ratio(1), r100 = ratio(100), sc = run(`SUMMON_SCALE['${skey}'].hp`), sd = run(`SUMMON_SCALE['${skey}'].dmg`);
    const mul100 = skey === 'zahri mirage' ? 0.399 / 0.30 : 1.495;
    ck(`${key} ${skey}: health share ${pct(sc)} at L1 (unchanged) and ${pct(sc * mul100)} at L100 (attack share grows the same)`, r1 !== null && Math.abs(r1 - sc) < 0.005 && Math.abs(r100 - sc * mul100) < 0.005, [r1, r100].join(' / '));
    const c = card(key, slot, 100), want = skey === 'zahri mirage' ? '39.9% stats' : pct(sd * mul100);
    ck(`${key} ${skey} card L100 shows ${want}`, c.includes(want), c);
  }
  // Aureth Duality (Light shield), Tessit Sleight of Hours (steal)
  { const sh = lv => cast('aureth', 2, lv, '(u,a)=>u._darkStance?null:(a.shield-(u.apow||0)*2)/a.maxHp');
    // first cast turns Dark on; cast twice so the Light shield lands
    const light = lv => JSON.parse(run(`(()=>{ units=[]; ended=false; battleTime=0; const u=makeUnit('aureth','ally',300,700,20,{owned:false}), a=makeUnit('vael','ally',340,700,20,{owned:false}); units=[u,a];
      u._castLv=${lv}; u._castSM=skillMul(${lv}); u._darkStance=true; a.shield=0; doEffect(u,'duality',Object.assign({},KITS.aureth.blue)); const r=(a.shield-(u.apow||0)*2)/u.maxHp; u._castLv=0; u._castSM=1; return JSON.stringify(r); })()`));
    void sh;
    ck('aureth Duality Light shield 12% at L1, 17.9% at L100 of max HP', near(light(1), 0.12, 1e-6) && near(light(100), 0.1794, 1e-6), [light(1), light(100)].join(' / '));
    for (const lv of LVS) { const c = card('aureth', 2, lv); ck(`aureth card L${lv} shows ${pct(0.12 + 0.0006 * (lv - 1))}`, c.includes('Light shield ' + pct(0.12 + 0.0006 * (lv - 1))), c); }
    const st = lv => run(`skLvNum('spdsteal',KITS.tessit.blue,${lv})`);
    ck('tessit Sleight of Hours 35% / 39.9% / 44.9%', near(st(1), 0.35) && near(st(50), 0.399) && near(st(100), 0.449));
    for (const lv of LVS) { const c = card('tessit', 2, lv); ck(`tessit blue card L${lv} shows ${pct(st(lv))}`, c.includes(pct(st(lv))), c); } }

  // ================================================================ shred cap (C)
  { const sh = (v, lv) => run(`skillScaleOpts({shred:${v}}, skillMul(${lv}), ${lv}).shred`);
    ck('shred L1 unchanged (0.32 / 0.30 / 0.25)', near(sh(0.32, 1), 0.32) && near(sh(0.30, 1), 0.30) && near(sh(0.25, 1), 0.25));
    ck('C: shred at L100 <= 45% for every hero (0.32 -> ' + pct(sh(0.32, 100)) + ')', sh(0.32, 100) <= 0.45 && sh(0.30, 100) <= 0.45 && sh(0.25, 100) <= 0.45);
    ck('C CONTROL: the old curve gave 0.32 x 2.188 = 70% at L100', near(0.32 * SM(100), 0.70016, 1e-6) && !near(sh(0.32, 100), 0.32 * SM(100), 0.01));
    ck('BUG FIX: skillScaleOpts no longer multiplies dr (a damage-TAKEN multiplier) - 0.55 stays 0.55 at L46', near(run(`(skillScaleOpts({dr:0.55}, skillMul(46), 46)||{}).dr`), 0.55));
    for (const [key, slot, v] of [['zahri', 1, 0.32], ['hobb', 1, 0.30], ['absalie', 1, 0.32]]) for (const lv of LVS) {
      const c = card(key, slot, lv); ck(`${key} shred card L${lv} shows -${pct(sh(v, lv))}`, c.includes('−' + pct(sh(v, lv))), c); }
    ck('mirelle ult card L100 shows the capped defence cut', card('mirelle', 0, 100).includes('−' + pct(sh(0.3, 100)) + ' enemy defence')); }

  // ================================================================ PASSIVES (SKLV): L1 = old constant, L100 = planned, card at 1/50/100
  const PV = [
    // name, SKLV key, old L1, planned L100, card key, card text
    ['warden cap', 'wardenCap', 0.20, 0.299, 'konwu', v => 'cap ' + pct(v)],
    ['Unmovable cap', 'wardenCap', 0.20, 0.299, 'pellucid', v => 'cap ' + pct(v)],
    ['Momentum cap', 'momentumCap', 0.50, 0.7475, 'tick', v => '+' + pct(v)],
    ['Well-Read cap', 'momentumCap', 0.50, 0.7475, 'meridian', v => '+' + pct(v)],
    ['Cold Snap per stack', 'coldsnap', 0.05, 0.0797, 'sylthaine', v => '+' + pct(v) + ' frost'],
    ['Contagion spread', 'contagionDur', 4, 5.98, 'bloatus', v => sec(v)],
    ['Perfect Pitch share', 'pitch', 0.50, 0.7475, 'vireo', v => pct(v) + ' of the heal'],
    ['Static Veil dodge', 'stormdodge', 0.30, 0.4485, 'fritz', v => pct(v) + ' dodge'],
    ['Blood Rage cap', 'bloodrageCap', 0.25, 0.3985, 'vael', v => 'up to +' + pct(v)],
    ['Stardust burn', 'stardust', 0.10, 0.199, 'astra', v => pct(v) + ' attack burn'],
    ['Emberskin aura', 'immolate', 0.25, 0.3985, 'korvux', v => pct(v) + ' of attack'],
    ['Not There timer', 'notthere', 4, 3.01, 'hollow', v => 'every ' + sec(v)],
    ['Unwind timer', 'unwind', 5, 3.515, 'tessit', v => 'every ' + sec(v)],
    ['Compound Interest', 'debtaura', 0.20, 0.299, 'grimsby', v => pct(v) + ' longer'],
    ['Abyssal Reserve', 'abyssres', 0.45, 0.648, 'orryn', v => '+' + pct(v)],
    ['Rising Heat cap', 'risingheatCap', 0.45, 0.5985, 'pyroclast', v => 'up to +' + pct(v)],
    ['Layered Hide immunity', 'layered', 2.0, 3.0, 'tharl', v => sec(v) + ' control immunity'],
  ];
  for (const [name, k, v1, v100, key, txt] of PV) {
    const v = {}; for (const lv of LVS) v[lv] = run(`SKLV.${k}(${lv})`);
    ck(`${name}: L1 ${v1} (unchanged), L100 ${v100}`, near(v[1], v1, 1e-9) && near(v[100], v100, 1e-9), JSON.stringify(v));
    for (const lv of LVS) { const c = card(key, 3, lv); ck(`${key} passive card L${lv} shows ${txt(v[lv])}`, c.includes(txt(v[lv])), c); }
  }
  ck('Mirewall: 20% at L1 -> 35% at L100 on one line (Phil: 35% is the level-100 stat)', near(run('SKLV.mirewall(1)'), 0.20) && near(run('SKLV.mirewall(50)'), 0.20 + 0.15 * 49 / 99, 1e-9) && near(run('SKLV.mirewall(100)'), 0.35, 1e-9) && [...Array(99)].every((_, i) => run(`SKLV.mirewall(${i + 2})`) > run(`SKLV.mirewall(${i + 1})`)));
  ck('Mirewall CONTROL: the old curve stalled at 35% from L64 (L80 = L100); the new line still grows there', near(Math.min(0.35, 0.2 * SM(80)), Math.min(0.35, 0.2 * SM(100))) && run('SKLV.mirewall(100)') > run('SKLV.mirewall(80)'));
  for (const lv of LVS) { const c = card('grosk', 3, lv), h = hover('grosk', 3, lv), w = run(`SKLV.mirewall(${lv})`); ck(`grosk Mirewall card+hover L${lv} show ${pct(w)}`, c.includes(pct(w)) && h.includes(pct(w)), c + ' || ' + h); }
  // Ironcoil - the owner's report: the card printed 2s at every level
  { const fightLay = lv => tick('tharl', 'layered', lv, '(u)=>{ u._layStk=5; }', '(u)=>u._layT');
    ck('C: Layered Hide in the fight = 2.0 s at L1, 2.49 s at L50, 3.0 s at L100', near(fightLay(1), 2.0, 1e-6) && near(fightLay(50), 2.49, 1e-6) && near(fightLay(100), 3.0, 1e-6), [fightLay(1), fightLay(50), fightLay(100)].join(' / '));
    ck('Layered Hide CONTROL: the old 2.0 x skillMul was 4.38 s at L100', !near(2.0 * SM(100), fightLay(100), 0.01));
    for (const lv of LVS) { const c = card('tharl', 3, lv), h = hover('tharl', 3, lv); ck(`tharl Layered Hide card + hover L${lv} show ${sec(fightLay(lv))}`, c.includes('5 layers → ' + sec(fightLay(lv))) && h.includes(sec(fightLay(lv))), c + ' || ' + h); } }
  // a passive measured in the fight: Static Veil dodge chance is what the fight rolls against; Unwind interval; Immolate damage
  { const burn = lv => JSON.parse(run(`(()=>{ units=[]; ended=false; paused=false; battleTime=0;
      const u=makeUnit('korvux','ally',300,700,20,{owned:false}), e=makeUnit('lumi','enemy',320,700,20,{owned:false});
      units=[u,e]; units.forEach(x=>{ x.atkInterval=99; x.speed=0; x.greenAb=null; x.blueAb=null; x.energy=0; }); e.maxHp=e.hp=1e9;
      u.skillLv=[1,1,1,${lv}]; u.pass={immolate:true}; u.passMul=skillMul(${lv});
      const _dist=dist, _dmg=damage; let got=0; dist=()=>0; damage=function(t,a,c){ if(c==='#ff6a3a') got+=a; return _dmg.apply(this,arguments); };   // the aura's own hits, bodies ignored
      try{ for(let i=0;i<Math.round(1.05/SIM_STEP);i++) updateBattle(SIM_STEP); } finally{ dist=_dist; damage=_dmg; }
      return JSON.stringify(got/u.dmg); })()`));
    const imm = lv => burn(lv);
    ck('Emberskin aura in the fight: one tick = 25% of attack at L1, 39.85% at L100', near(imm(1), 0.25, 1e-9) && near(imm(100), 0.3985, 1e-9), [imm(1), imm(100)].join(' / ')); }
  // the Twin Fonts and Skeleton Key passives on the curve
  ck('Twin Fonts x1 at L1, x1.6534 at L100', near(run('SKLV.twinfonts(1)'), 1) && near(run('SKLV.twinfonts(100)'), 1.6534, 1e-9));
  ck('Skeleton-Key Fortune at L100: +10.9% crit damage, +6.6% dodge on the card', card('nox', 3, 100).includes('+10.9% crit dmg') && card('nox', 3, 100).includes('+6.6% dodge'));

  // ================================================================ D. hover text reads the level
  ck('hover: Rhukk Carapace at L100 says 59.9% less damage (was "half damage")', hover('rhukk', 1, 100).includes('59.9% less damage'));
  ck('hover: Grosk Croc Drop at L100 says 44.9% less damage (was 30%)', hover('grosk', 0, 100).includes('44.9% less damage'));
  ck('hover: KonWu ult at L100 says 219% ATK and the meta ratio is 219% of Attack (was the level-1 100%)', hover('konwu', 0, 100).includes('dealing 219% ATK') && hover('konwu', 0, 100).includes('219% of Attack'));
  ck('hover: KonWu Cleaving Arc meta ratio is levelled (150% at L1, 328% at L100)', hover('konwu', 1, 1).includes('150% of Attack') && hover('konwu', 1, 100).includes('328% of Attack'));
  ck('hover: Gruel Reckoning at L1 says 40% less damage (was "half", wrong even at L1)', hover('gruel', 0, 1).includes('40% less damage'));
  ck('hover: Vael Blood Rage at L100 says up to +39.9%', hover('vael', 3, 100).includes('+39.9%'));
  ck('hover: Zahri Mirage Herd at L50 says 34.9% of her stats', hover('zahri', 2, 50).includes('34.9% of her stats'));
  ck('hover: Bloatus Contagion keeps his words and adds the levelled spread', /his poison/.test(hover('bloatus', 3, 100)) && hover('bloatus', 3, 100).includes('5.98s'));
  ck('hover: Calypsa Fighting Current at L100 says 49.9% less damage', hover('calypsa', 2, 100).includes('49.9% less damage'));
  ck('hover CONTROL: a level-1 hover still reads the level-1 numbers (Rhukk 50%)', hover('rhukk', 1, 1).includes('50% less damage'));
  // D. no card line falls to the Attack-hit default for a skill that deals no hit
  for (const [key, slot, re] of [['grosk', 1, /silence/], ['grimsby', 2, /silence/], ['vulmar', 2, /pull the farthest/], ['hurne', 1, /boar warrior/], ['lumi', 1, /cannot fall below 1/], ['tessit', 2, /steals/], ['oakmir', 2, /max HP to every ally/], ['oakmir', 0, /max HP/], ['korvux', 0, /every 0\.5s/], ['umbris', 1, /DoT/], ['vesper', 0, /freeze/]])
    { const c = card(key, slot, 1); ck(`card ${key} ${['ult', 'green', 'blue'][slot]} is not a fake Attack hit: "${c}"`, re.test(c), c); }
  ck('card Kharos camouflage: the +25% damage is fixed (the fight never scaled it)', card('kharos', 3, 100).includes('+25% dmg'));
} catch (e) { fail++; console.log('  FAIL threw: ' + (e && e.stack || e)); }
console.log('test_skill_levels_1112.js: ' + pass + ' passed, ' + fail + ' failed');
process.exit(Math.min(255, fail));
