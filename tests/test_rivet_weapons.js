'use strict';
// v1137 - RIVET'S TEN WEAPONS (Phil 14 Oct 2026; Mechanics blueprints/Heroes/Rivet.md, his numbers exact). A GAMEPLAY change, on purpose:
//   every basic attack fires the NEXT weapon of the group the target's current distance picks (the ground between the two bodies; 3 m exactly = melee):
//   RANGED (> 3 m) gatling -> revolver -> flying saw -> bolt launcher -> chest cannon; MELEE (<= 3 m) curved blade -> hammer -> upper spike -> lower spike.
//   Each weapon has its own effect (they REPLACE the old six-step Whatever's Loaded cycle). The chain hook is automatic: an enemy inside his 3 m melee
//   range that dashes/teleports away is hooked back, 50% damage + stun 3 s (no cooldown - Phil gave none).
// What must NOT change: a fight WITHOUT Rivet is tick-for-tick the BASE fight (the engine edits are gated on his passive or on two new fields that are
//   undefined on every other unit). The swing TIMING data is unchanged (every weapon clip = 2.0 clip s, relFrac 0.5 = his old attack clip), so his
//   melee hits land on the old ball-release tick and his ranged rounds land on the old hit tick.
// Every CC goes through ccApply (the game's control rule: x0.70, CC_NERF) - the test asserts that path, not a hand-coded number.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || 'b5b4723f';   // claude/maren-orryn-anim (v1137 before Rivet)
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-rivet-base-control.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
  const tmp = OLD; process.on('exit', () => { try { fs.unlinkSync(tmp); } catch (e) {} }); } catch (e) { OLD = null; } }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML);
const R0 = OLD ? load(OLD) : null;
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
const J = (r, src) => JSON.parse(r(src));
function webpSize(file) {
  const b = fs.readFileSync(file); const tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  return null;
}
const WPN = ['gatling', 'revolver', 'saw', 'bolt', 'cannon', 'blade', 'hammer', 'uspike', 'lspike', 'hook'];
// A scripted duel: Rivet (rank 3 = his passive) vs a big-HP target at `gapM` metres of ground; every dealDamage from him logged with the weapon,
// the amount passed in, the target's hp loss, and the crit flag. `pre` runs after setup (force a counter, armour, a second enemy ...).
const DUEL = (gapM, secs, pre, seed) => `(()=>{ globalThis.__UB=globalThis.__UB||updateBattle; updateBattle=globalThis.__UB; units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(${seed || 5});
  const g=makeUnit('rivet','ally',300,700,30,{owned:false,rank:3}); const e=makeUnit('vael','enemy',300,700,30,{owned:false});
  e.x=g.x+bodyR(g)+bodyR(e)+${gapM}*METER; g.anim=BATTLE_ANIM.rivet; e.anim=null; units=[g,e];
  units.forEach(u=>{ u.maxHp=u.hp=1e9; u.energy=0; u.greenCd=u.blueCd=999; }); e.atkInterval=99; e.atkCd=99; e.speed=0; g.speed=0; g.glyphCrit=0;
  e.armorRating=0; e.mrRating=0; e.evaStat=0; e.blockStat=0; e.defenseStat=0;
  ${pre || ''}
  const log=[]; const _dd=dealDamage; dealDamage=function(s,t,amt,c,k){ const hp0=t.hp, crit0=t._critHit; t._critHit=false; const r=_dd.apply(this,arguments);
    if(s===g) log.push({t:+battleTime.toFixed(4),w:g._rvWpn,amt:+amt.toFixed(4),lost:+(hp0-t.hp).toFixed(4),crit:t._critHit?1:0,who:t.key,cr:+((s._wpnCrit)||0).toFixed(2),ai:+((s._wpnArmIgn)||0).toFixed(2)}); return r; };
  const swings=[]; let lastA=0;
  try{ for(let i=0;i<Math.round(${secs}/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); units.forEach(u=>{u.energy=0; u.greenCd=u.blueCd=999;}); e.atkCd=99;
      if(g.attackAnim>lastA+0.1) swings.push({t:+battleTime.toFixed(4),w:g._rvWpn,clip:g._atkClip}); lastA=g.attackAnim; } }
  finally{ dealDamage=_dd; }
  return JSON.stringify({log,swings,dmg:g.dmg,e:{stunned:+(e.stunned||0).toFixed(3),sil:+(e.silencedT||0).toFixed(3),shred:[e._shredPct||0,+(e._shredT||0).toFixed(3)],dots:e.dots.map(d=>[+d.dps.toFixed(4),d.remaining,d.interval]),gap:(typeof rivetGap==='function')?+(rivetGap(g,e)/METER).toFixed(3):null},
    ctx:{CC_NERF,STEP:SIM_STEP,ai:g.atkInterval}}); })()`;
const trace = (r, seed, a, f) => crypto.createHash('sha256').update(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0].join(':')).join('|')); }
      return tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`)).digest('hex');

try {
  ck('control file (BASE emberweave-heroes.html from git) loaded', !!R0, 'git show failed');
  // 0. the sheets
  const A = J(run, 'JSON.stringify(BATTLE_ANIM.rivet)'), A0 = J(R0, 'JSON.stringify(BATTLE_ANIM.rivet)');
  ck('Rivet has the ten weapon clips w_<weapon> and keeps every old state', WPN.every(w => A['w_' + w]) && Object.keys(A0).every(k => A[k]));
  ck('his old states are byte-for-byte BASE (idle, walk, attack, hit, green, blue, ult, passive)', Object.keys(A0).every(k => JSON.stringify(A[k]) === JSON.stringify(A0[k])));
  const bad = [];
  for (const w of WPN) { const S = A['w_' + w], f = path.join(ROOT, S.u.split('?')[0]); if (!fs.existsSync(f)) { bad.push(w + ' missing'); continue; }
    const sz = webpSize(f); if (!sz || sz[0] !== S.fw * S.cols || sz[1] !== S.fh * S.rows) bad.push(w + ' file ' + sz);
    if (S.fw * S.cols > 4096 || S.fh * S.rows > 4096) bad.push(w + ' >4096');
    if (S.u !== `/assets/anim/rivet/rivet_${w}_1137.webp?v=1137`) bad.push(w + ' url');
    if (!(S.n === 36 && S.fps === 18 && S.relFrac == null && !S.hold && S.contact === 20 && S.flip === false && S.feet - S.top === S.figH && S.figH === 422)) bad.push(w + ' data'); }
  ck('every weapon sheet: new file at ?v=1137, file = grid, under 4096, 36 @18 (2.0 clip s, no relFrac = the old attack clip\'s timing), contact 20, flip:false, frame-0 anchors (figH 422)', bad.length === 0, bad.join('; '));
  ck('timing data: every weapon clip and the old attack clip are 2.0 clip s at relFrac 0.5', WPN.every(w => A['w_' + w].n / A['w_' + w].fps === 2) && A.attack.n / A.attack.fps === 2 && A.attack.relFrac == null);

  // 1. fights WITHOUT Rivet are BASE, tick for tick
  const noRivet = [[['maren', 'orryn', 'askel'], ['vesper', 'hurne', 'grosk'], 11], [['vael', 'pellucid', 'umbris'], ['rhukk', 'sloe', 'vex'], 222], [['hollow', 'konwu', 'tick'], ['sylthaine', 'brannus', 'zahri'], 5]];
  ck('whole fights WITHOUT Rivet (autoUlt, heroes carry BATTLE_ANIM as the server replay) are tick-for-tick identical to BASE',
    noRivet.every(([a, f, s]) => trace(run, s, a, f) === trace(R0, s, a, f)));
  const withRivet = [[['rivet', 'askel', 'vex'], ['vesper', 'hurne', 'grosk'], 11], [['maren', 'rivet'], ['rivet', 'konwu', 'vael'], 31]];
  ck('CONTROL: fights WITH Rivet are not BASE (the trace sees his weapons - the change is real)', withRivet.every(([a, f, s]) => trace(run, s, a, f) !== trace(R0, s, a, f)));
  ck('fights with Rivet are deterministic (the same fight twice = the same trace; no Math.random in his code)',
    withRivet.every(([a, f, s]) => trace(run, s, a, f) === trace(run, s, a, f)) && !/Math\.random/.test(run('String(rivetPick)+String(rivetFire)+String(rivetHook)+String(rivetHookTick)+String(rivetGap)')));

  // 2. the cycles
  const rg = J(run, DUEL(6, 12)); const order = rg.swings.map(s => s.w);
  ck('RANGED: five consecutive attacks at 6 m are gatling, revolver, flying saw, bolt launcher, chest cannon - in that order, then gatling again',
    JSON.stringify(order.slice(0, 6)) === JSON.stringify(['gatling', 'revolver', 'saw', 'bolt', 'cannon', 'gatling']), order.join(','));
  ck('each swing plays its own weapon clip (_atkClip = w_<weapon>)', rg.swings.every(s => s.clip === 'w_' + s.w));
  const ml = J(run, DUEL(0.2, 10)); const morder = ml.swings.map(s => s.w);
  ck('MELEE: four consecutive attacks at 0.2 m are curved blade, hammer, upper spike, lower spike - then the blade again (the chain hook is not in the cycle)',
    JSON.stringify(morder.slice(0, 5)) === JSON.stringify(['blade', 'hammer', 'uspike', 'lspike', 'blade']), morder.join(','));
  ck('no weapon repeats twice in a row within a group', [order, morder].every(o => o.every((w, i) => i === 0 || w !== o[i - 1])));
  const edge = J(run, DUEL(3, 1)), over = J(run, DUEL(3.02, 1));
  ck('3 m of ground EXACTLY counts as melee (blade); 3.02 m is ranged (gatling)', edge.swings[0] && edge.swings[0].w === 'blade' && over.swings[0] && over.swings[0].w === 'gatling', JSON.stringify([edge.swings[0], over.swings[0], edge.e.gap, over.e.gap]));
  // re-evaluated every attack, each group keeps its own counter: ranged, ranged, then the target walks in, melee, then back out -> the ranged cycle resumes
  const mix = J(run, DUEL(6, 12, `globalThis.__mv=(t)=>{ if(t>2.5&&t<6) e.x=g.x+bodyR(g)+bodyR(e)+0.2*METER; else if(t>=6) e.x=g.x+bodyR(g)+bodyR(e)+6*METER; };
    const _ub=updateBattle; updateBattle=function(dt){ __mv(battleTime); return _ub.apply(this,arguments); };`));
  ck('the group is re-evaluated every attack and each group keeps its own counter (ranged, ranged, melee, melee, ranged resumes at the saw)',
    JSON.stringify(mix.swings.filter(s => s.clip !== 'w_hook').slice(0, 5).map(s => s.w)) === JSON.stringify(['gatling', 'revolver', 'blade', 'hammer', 'saw']), mix.swings.map(s => s.clip).join(','));

  // 3. each weapon's numbers (target armour 0, no crit chance unless the weapon adds it)
  const one = (w, gap, pre, secs) => J(run, DUEL(gap, secs || 1.6, (w ? `g.${['blade', 'hammer', 'uspike', 'lspike'].includes(w) ? '_rvMi' : '_rvRi'}=${JSON.stringify(['gatling', 'revolver', 'saw', 'bolt', 'cannon', 'blade', 'hammer', 'uspike', 'lspike'].indexOf(w) % 5 === -1 ? 0 : (['blade', 'hammer', 'uspike', 'lspike'].includes(w) ? ['blade', 'hammer', 'uspike', 'lspike'].indexOf(w) : ['gatling', 'revolver', 'saw', 'bolt', 'cannon'].indexOf(w)))};` : '') + (pre || '')));
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  { const r = one('gatling', 6); const h = r.log.filter(x => x.w === 'gatling');
    ck('roof gatling: 9 shots, each 15% of attack damage, single target', h.length === 9 && h.every(x => near(x.amt, r.dmg * 0.15) && x.who === 'vael'), JSON.stringify(h.map(x => x.amt)) + ' dmg ' + r.dmg); }
  { const r = one('revolver', 6); const h = r.log.filter(x => x.w === 'revolver');
    ck('revolver: one hit of 120% of attack damage, with +15% crit chance on that hit (the field is 0.15 during the hit and 0 after)', h.length === 1 && near(h[0].amt, r.dmg * 1.2) && h[0].cr === 0.15, JSON.stringify(h)); }
  { // the +15% crit is real: over many seeded revolver shots ~15% crit; the bolt (no crit added) at the same 0% base never crits
    let c = 0, n = 0, cb = 0, nb = 0;
    for (let s = 1; s <= 60; s++) { const r = J(run, DUEL(6, 10, '', s)); r.log.forEach(x => { if (x.w === 'revolver') { n++; c += x.crit; } if (x.w === 'bolt') { nb++; cb += x.crit; } }); }
    ck(`revolver crit rate over ${n} seeded shots is ~15% (${(100 * c / n).toFixed(1)}%); CONTROL: the bolt at the same 0% base: ${cb}/${nb}`, n >= 50 && c / n > 0.08 && c / n < 0.23 && cb === 0); }
  { const r = one('saw', 6); const h = r.log.filter(x => x.w === 'saw');
    const dots = r.e.dots; const total = dots.reduce((s, d) => s + d[0] * d[1], 0);
    ck('flying saw: 70% of attack damage + a bleed of 50% over 4 s (4 ticks of 12.5%, 1 s apart)', h.length === 1 && near(h[0].amt, r.dmg * 0.7) && dots.length === 1 && dots[0][2] === 1 && near(dots[0][0], r.dmg * 0.125) && dots[0][1] === 4 && near(total, r.dmg * 0.5), JSON.stringify({ h, dots })); }
  { const r = one('bolt', 6, 'e.armorRating=400; e.lvl=30;'); const h = r.log.filter(x => x.w === 'bolt')[0];
    const dr = J(run, `JSON.stringify([defToDR(400*0.5,30),defToDR(400,30)])`);
    const rc = one('revolver', 6, 'e.armorRating=400; e.lvl=30; g.glyphCrit=0;'); const hc = rc.log.filter(x => x.w === 'revolver')[0];
    ck(`bolt launcher: 100% of attack damage and it ignores 50% of the armour (400 armour: lost = amt x (1 - DR(200)) = ${(1 - dr[0]).toFixed(3)}; CONTROL: the revolver on the same target loses amt x (1 - DR(400)) = ${(1 - dr[1]).toFixed(3)})`,
      h && near(h.amt, r.dmg) && Math.abs(h.lost - h.amt * (1 - dr[0])) < 1e-3 && hc && (hc.crit || Math.abs(hc.lost - hc.amt * (1 - dr[1])) < 1e-3), JSON.stringify({ h, hc, dr })); }
  { const pre = `const e2=makeUnit('tick','enemy',0,0,30,{owned:false}), e3=makeUnit('umbris','enemy',0,0,30,{owned:false}), e4=makeUnit('grosk','enemy',0,0,30,{owned:false});
      const L=(m,deg)=>[g.x+Math.cos(deg*Math.PI/180)*m*METER, g.y+Math.sin(deg*Math.PI/180)*m*METER];
      [[e2,12,20],[e3,10,30],[e4,21,0]].forEach(([u,m,d])=>{ const p=L(m,d); u.x=p[0]; u.y=p[1]; u.anim=null; u.maxHp=u.hp=1e9; u.speed=0; u.atkCd=99; u.atkInterval=99; u.armorRating=0; u.evaStat=0; units.push(u); });`;
    const r = one('cannon', 6, pre); const h = r.log.filter(x => x.w === 'cannon');
    const who = h.map(x => x.who).sort().join(',');
    ck('chest cannon: 75% of attack damage to EVERY enemy in a 45-degree cone, 20 m long - the target and a foe 20 deg off at 12 m are hit; 30 deg off (outside 22.5) and 21 m out are not',
      who === 'tick,vael' && h.every(x => near(x.amt, r.dmg * 0.75)), JSON.stringify(h)); }
  { const r = one('blade', 0.2); const h = r.log.filter(x => x.w === 'blade');
    ck('curved blade: 160% of attack damage', h.length === 1 && near(h[0].amt, r.dmg * 1.6), JSON.stringify(h)); }
  { const r = one('hammer', 0.2, '', 0.9); const h = r.log.filter(x => x.w === 'hammer');
    ck(`hammer: 100% of attack damage and a 2 s stun through the game's control rule (ccApply x CC_NERF ${r.ctx.CC_NERF} = ${(2 * r.ctx.CC_NERF).toFixed(2)} s, ticked down from the hit)`,
      h.length === 1 && near(h[0].amt, r.dmg) && r.e.stunned > 2 * r.ctx.CC_NERF - 0.1 && r.e.stunned <= 2 * r.ctx.CC_NERF, JSON.stringify({ h, e: r.e })); }
  { const r = one('uspike', 0.2, '', 0.9); const h = r.log.filter(x => x.w === 'uspike');
    ck(`upper spike arm: 80% of attack damage and a 3 s silence (x ${r.ctx.CC_NERF} = ${(3 * r.ctx.CC_NERF).toFixed(2)} s)`, h.length === 1 && near(h[0].amt, r.dmg * 0.8) && r.e.sil > 3 * r.ctx.CC_NERF - 0.1 && r.e.sil <= 3 * r.ctx.CC_NERF, JSON.stringify({ h, e: r.e })); }
  { const r = one('lspike', 0.2, '', 0.9); const h = r.log.filter(x => x.w === 'lspike');
    ck('lower spike arm: 130% of attack damage and the target\'s armour -20% for 5 s', h.length === 1 && near(h[0].amt, r.dmg * 1.3) && r.e.shred[0] === 0.2 && r.e.shred[1] > 4.9 && r.e.shred[1] <= 5, JSON.stringify({ h, e: r.e })); }
  { // the old Whatever's Loaded extras are gone: a blade hit is ONE dealDamage, no splash, no dot, no stun
    const r = one('blade', 0.2); ck('the old six-step Whatever\'s Loaded effects are gone (a blade hit: one hit, no stun/slow/dot/splash)', r.log.length === 1 && r.e.stunned === 0 && r.e.dots.length === 0, JSON.stringify(r)); }

  // 4. timing: the swing fuse did not move. BASE's ranged hit tick = his ranged rounds now; BASE's ball-release tick = his melee hits now (no flight).
  const baseRanged = J(R0, DUEL(6, 1.6, 'g.pass={};'));   // BASE, plain swing (no passive extras): first hit = fuse + 0.22 s flight
  const nowRev = one('revolver', 6), nowBlade = one('blade', 0.2);
  const fly = 0.22, STEP = nowRev.ctx.STEP, fuse = J(run, 'JSON.stringify(clipDur(BATTLE_ANIM.rivet.w_blade)*0.5*BATTLE_PACE)');
  ck(`ranged rounds land on BASE's hit tick (${baseRanged.log[0] && baseRanged.log[0].t}): the swing fuse and the flight are unchanged`, baseRanged.log[0] && nowRev.log[0] && nowRev.log[0].t === baseRanged.log[0].t, JSON.stringify([baseRanged.log[0], nowRev.log[0]]));
  ck(`melee weapons land ON the fuse (${fuse.toFixed(3)} fight s after the swing - BASE's ball-release moment), not ${fly} s later: no projectile flight for a blade`,
    nowBlade.log[0] && nowBlade.swings[0] && Math.abs(nowBlade.log[0].t - nowBlade.swings[0].t - fuse) <= 2 * STEP && nowBlade.log[0].t < baseRanged.log[0].t, JSON.stringify([nowBlade.swings[0], nowBlade.log[0]]));
  ck('the swing interval is unchanged (his attacks are 1.8 s apart, as BASE)', rg.swings.length >= 6 && rg.swings.slice(1).every((s, i) => Math.abs(s.t - rg.swings[i].t - rg.ctx.ai) <= STEP + 1e-9), rg.swings.map(s => s.t).join(','));

  // 5. the automatic chain hook
  const DASH = `globalThis.__dash=(t)=>{ if(t>0.3&&!globalThis.__dashed){ globalThis.__dashed=1; e._dash={x0:e.x,y0:e.y,x1:e.x+7*METER,y1:e.y,t:0,dur:0.25,run:function(){}}; } };
    globalThis.__dashed=0; g.atkCd=99; const _ub2=updateBattle; updateBattle=function(dt){ __dash(battleTime); g.atkCd=99; return _ub2.apply(this,arguments); };`;
  const hk = J(run, DUEL(0.2, 2.6, DASH)); const hh = hk.log.filter(x => x.w !== 'blade');
  ck('AUTO HOOK: an enemy inside his 3 m range that dashes away is hooked once - 50% of attack damage, stunned 3 s (x 0.70 via ccApply), pulled back inside melee range',
    hk.log.length === 1 && near(hk.log[0].amt, hk.dmg * 0.5) && hk.e.gap <= 3 && hk.e.stunned > 0 && hk.e.stunned <= 3 * hk.ctx.CC_NERF, JSON.stringify(hk));
  const KNOCK = `globalThis.__k=(t)=>{ if(t>0.3&&!globalThis.__kd){ globalThis.__kd=1; e.x+=7*METER; e._ax=e.x; e._airT=0.25; } }; globalThis.__kd=0; g.atkCd=99;
    const _ub3=updateBattle; updateBattle=function(dt){ __k(battleTime); g.atkCd=99; return _ub3.apply(this,arguments); };`;
  const kn = J(run, DUEL(0.2, 2.6, KNOCK));
  ck('CONTROL: an enemy KNOCKED out of range (_airT - a push, not its own move) is not hooked', kn.log.length === 0, JSON.stringify(kn.log));
  const st = J(run, DUEL(0.2, 2.6, DASH + 'g.stunned=5;'));
  ck('CONTROL: a stunned Rivet does not hook', st.log.length === 0, JSON.stringify(st.log));
  const im = J(run, DUEL(0.2, 2.6, DASH + "e.immovable=true;"));
  ck('an immovable enemy is still hooked (damage + stun) but not pulled', im.log.length === 1 && im.e.gap > 3, JSON.stringify({ log: im.log, gap: im.e.gap }));
  const far = J(run, DUEL(6, 2.6, DASH));
  ck('CONTROL: an enemy that was never inside 3 m dashing is not hooked', far.log.length === 0, JSON.stringify(far.log));
  const ctlPct = J(run, DUEL(0.2, 2.6, DASH + 'RIVET_WPN.hookPct=0.6;')); run('RIVET_WPN.hookPct=0.5; 1');
  ck('CONTROL: the damage check sees a wrong number (hook at 60% fails the 50% assertion)', !(ctlPct.log.length === 1 && near(ctlPct.log[0].amt, ctlPct.dmg * 0.5)));
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
