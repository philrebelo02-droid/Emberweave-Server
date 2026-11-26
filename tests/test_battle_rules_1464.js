// v1464 BATTLE RULE PROOFS (lockdown checklist 25 Nov 2026, "01 - EVERY FEATURE IN THE GAME.md", Battle Engine lines).
// Each section proves (or disproves) one checklist line against the live game code: the page's own battle engine, run headless through
// server/sim-host.js exactly as the server replays fights (real fights with updateBattle / SIM_STEP where the line is about combat), plus
// the page's own UI functions run in the same VM with a small fake DOM. Every section has a CONTROL: a patched copy of the page (or a
// deliberately wrong value) that must make the same check come out the other way, so a check can never pass by measuring nothing.
//
// A line the live game does NOT meet is printed as "FINDING <line> FAIL|WORDING: ..." with the measured numbers, and the test still exits
// 0 (the finding is the result; this test changes no game code). BR_STRICT=1 makes any FAIL finding exit 1.
// Run: node tests/test_battle_rules_1464.js   (about 90 s; BR_ONLY=4,6 runs only those line sections)
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const PAGE = path.join(root, 'emberweave-heroes.html');
const html = fs.readFileSync(PAGE, 'utf8').replace(/\r\n/g, '\n');
const SimHost = require(path.join(root, 'server', 'sim-host.js'));
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok   ' + m); };
const FIND = []; const finding = (line, kind, msg) => { FIND.push({ line, kind, msg }); console.log('  FINDING line ' + line + ' ' + kind + ': ' + msg); };
const VERDICT = {};

/* ---------- loading the live page, or a patched copy of it (a CONTROL) ---------- */
const tmp = [];
process.on('exit', () => tmp.forEach(f => { try { fs.unlinkSync(f); } catch (e) {} }));
function patchedPage(tag, edits) {   // edits: [[from, to], ...] - each `from` must occur exactly once, so a control can never silently patch nothing
  let h = html;
  for (const [a, b] of edits) { const i = h.indexOf(a); assert(i >= 0 && h.indexOf(a, i + 1) < 0, 'control ' + tag + ': the patched text occurs exactly once: ' + a.slice(0, 80)); h = h.slice(0, i) + b + h.slice(i + a.length); }
  const f = path.join(root, '.test-br1464-' + tag + '-' + process.pid + '.html'); fs.writeFileSync(f, h); tmp.push(f); return f;   // beside the page: sim-host loads the page's local scripts from its folder
}
function boot(file) {
  const host = SimHost.load(file || PAGE), R = s => vm.runInContext(s, host.ctx);
  const J = s => { const r = R('JSON.stringify(' + s + ')'); return r === undefined ? null : JSON.parse(r); };
  /* a fake DOM for the few elements the checked UI functions write to; every other id keeps sim-host's behaviour */
  const els = {}, D0 = host.sandbox.document;
  const mkEl = id => { const cl = new Set(); return els[id] = { id, innerHTML: '', className: '', disabled: false, title: '', style: {}, onclick: null,
    classList: { add: c => cl.add(c), remove: c => cl.delete(c), contains: c => cl.has(c), toggle: (c, on) => { if (on === undefined ? !cl.has(c) : on) cl.add(c); else cl.delete(c); } }, _cl: cl }; };
  ['speedBtn', 'autoBtn', 'skipBtn', 'leaveBtn', 'pauseModal', 'restartBtn'].forEach(mkEl);
  host.sandbox.document = new Proxy({}, { get(t, k) { if (k === 'getElementById') return id => els[id] || D0.getElementById(id); if (k === 'visibilityState') return t.visibilityState || 'visible'; return D0[k]; },
    set(t, k, v) { t[k] = v; return true; } });
  R(`window.__banners=[]; bannerMsg=function(m){ window.__banners.push(String(m)); };
  window.__setup=function(al,fo,seed,mode){ ended=false; state='battle'; CUR={mode:mode||'replay',seed,manualReplay:false}; battleTime=0; gameSpeed=1; window._p2win=null; autoUlt=true;
    try{groundHazards.length=0;shots.length=0;particles.length=0;floatTexts.length=0;}catch(e){} waveXfer=null; chapterWaves=1; waveIdx=0;
    window._p2guard=true; seedBattle(seed); setupMarchTeams(al,fo,false); units.forEach(u=>{ u.anim=BATTLE_ANIM[u.key]||null; }); ddReset(); return units.length; };
  window.__step=function(n){ for(let i=0;i<n&&!ended;i++) updateBattle(SIM_STEP); return battleTime; };
  window.U=function(k,team){ return units.find(x=>x.key===k&&(!team||x.team===team)); };
  window.__freeze=function(list){ (list||units).forEach(u=>{ u.speed=0; u.atkCd=1e9; u.greenAb=null; u.blueAb=null; u.energy=0; u.gearSkill=null; u.ctrlRes=0; u.maxHp=1e9; u.hp=1e9; }); };`);
  const spec = (key, level, skill, extra) => Object.assign({ key, level, stars: 3, rank: 3, pips: 0, ref: 0, glyphRank: 0, tt: {}, ex: {}, fAtk: 0, fHp: 0, fApow: 0, apMul: 1, skillLv: [skill || 1, skill || 1, skill || 1, skill || 1] }, extra || {});
  const setup = (A, B, seed, mode, mut) => { const a = JSON.parse(JSON.stringify(host.snapFromSpecs(A))), b = JSON.parse(JSON.stringify(host.snapFromSpecs(B))); if (mut) mut(a, b);
    return R('window.__setup(' + JSON.stringify(a) + ',' + JSON.stringify(b) + ',' + (seed | 0) + ',' + JSON.stringify(mode || 'replay') + ')'); };
  return { host, R, J, els, spec, setup, page: fs.readFileSync(file || PAGE, 'utf8').replace(/\r\n/g, '\n') };
}
const L = boot();
const HEROES = L.J("Object.keys(KITS).filter(k=>HERO_TYPES[k]&&!HERO_TYPES[k].monster)");
ok(HEROES.length === 61, 'the live page has 61 heroes with kits');
const SIM_STEP = L.J('SIM_STEP');
const ONLY = process.env.BR_ONLY ? process.env.BR_ONLY.split(',').map(Number) : null, want = n => !ONLY || ONLY.includes(n);

/* ======================================================================================================================================
   1. AUTO toggle - shows SWITCHING ON/OFF until applied, then ON/OFF; forced on in auto modes.
   ====================================================================================================================================== */
console.log('== 1. AUTO toggle ==');
function autoToggle(B) {
  const { R, J, els, spec, setup } = B, out = {};
  const lbl = () => els.autoBtn.innerHTML.replace(/<span[^>]*>.*?<\/span>|<i[^>]*>.*?<\/i>|<img[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  setup(['grosk', 'vex'].map(k => spec(k, 30)), ['tharl', 'hobb'].map(k => spec(k, 30)), 7, 'campaign');
  R("CUR.mode='campaign'; REPLAY_IN=null; autoUlt=false; autoPendingTarget=null; autoOpen=function(){ return true; }; refreshCtrlBtns();");
  out.off0 = lbl(); R('autoBtnPress()'); out.sw1 = lbl(); out.sw1cls = els.autoBtn.className; out.sw1dis = els.autoBtn.disabled; out.sw1auto = J('autoUlt');
  R('autoBtnPress()'); out.queued = J('_inputQ.length');   // a second tap while switching adds nothing
  R('__step(1)'); out.on = lbl(); out.onAuto = J('autoUlt'); out.onCls = els.autoBtn.className;
  R('autoBtnPress()'); out.sw2 = lbl(); R('__step(1)'); out.off = lbl(); out.offAuto = J('autoUlt');
  out.logged = J("INPUT_LOG.filter(e=>e[1]==='auto').map(e=>e[3])");
  /* a live server stream: the switch waits for the SERVER's tick, so SWITCHING shows for every tick until the receipt's tick is reached */
  R(`window.__sent=[]; ACC.token='t'; CHATNET.ws={readyState:1}; chatNetSend=function(o){ window.__sent.push(o); return true; }; CUR.attemptId='a1'; actBegin(); autoUlt=false; autoPendingTarget=null; refreshCtrlBtns(); autoBtnPress();`);
  const seq = J("window.__sent.filter(o=>o.kind==='auto').pop().seq"), t0 = J('simTick'); out.stream = [];
  for (let i = 0; i < 6; i++) { R('__step(1)'); if (i === 2) R(`onActAck({seq:${seq},ok:true,tick:${t0 + 5}})`); out.stream.push([J('simTick'), lbl(), J('autoUlt')]); }
  R("ACC.token=null; CHATNET.ws=null; _actStreamOn=false;");
  /* forced on in every automatic mode */
  out.forced = {};
  for (const m of ['arena', 'raid', 'elite', 'replay', 'emberdraft', 'campaign', 'vault', 'province', 'well', 'graid']) {
    R(`CUR={mode:'${m}'}; autoUlt=false; autoPendingTarget=null; INPUT_LOG=[]; _inputQ=[]; refreshCtrlBtns(); autoBtnPress();`);
    out.forced[m] = { auto: J('autoUlt'), label: lbl(), locked: els.autoBtn.className.includes('locked'), queued: J('_inputQ.length') }; }
  R("CUR={mode:'replay',manualReplay:true}; autoUlt=false; refreshCtrlBtns();"); out.manualReplay = J('autoUlt');
  return out;
}
if (want(1)) { const a = autoToggle(L), AUTO = ['arena', 'raid', 'elite', 'replay', 'emberdraft'], PLAYER = ['campaign', 'vault', 'province', 'well', 'graid'];
  ok(a.off0 === 'AUTO: OFF', 'campaign, AUTO off: the button reads "' + a.off0 + '"');
  ok(a.sw1 === 'AUTO:<br>SWITCHING ON…' && /pending/.test(a.sw1cls) && a.sw1dis === true && a.sw1auto === false, 'pressed: "AUTO: / SWITCHING ON…" (pending, disabled) while AUTO is still off - "' + a.sw1 + '"');
  ok(a.queued === 1, 'a second tap while switching adds no second input (' + a.queued + ' queued)');
  ok(a.on === 'AUTO: ON' && a.onAuto === true && !/pending/.test(a.onCls), 'on the tick the input is applied: "AUTO: ON", AUTO on');
  ok(a.sw2 === 'AUTO:<br>SWITCHING OFF…' && a.off === 'AUTO: OFF' && a.offAuto === false, 'and back: "SWITCHING OFF…" then "AUTO: OFF"');
  ok(JSON.stringify(a.logged) === '[1,0]', 'both switches are in the fight record (' + JSON.stringify(a.logged) + ')');
  const st = a.stream; ok(st.slice(0, 4).every(s => /SWITCHING ON/.test(s[1]) && s[2] === false) && /AUTO: ON/.test(st[5][1]) && st[5][2] === true,
    'live server stream: SWITCHING ON stays up until the server-named tick, then ON (' + st.map(s => s[0] + ':' + (s[2] ? 'on' : (/SWITCH/.test(s[1]) ? 'sw' : 'off'))).join(' ') + ')');
  for (const m of AUTO) ok(a.forced[m].auto === true && a.forced[m].locked && /AUTO: ON/.test(a.forced[m].label) && a.forced[m].queued === 0, m + ': AUTO forced ON and locked; a tap does nothing');
  for (const m of PLAYER) ok(a.forced[m].auto === false && !a.forced[m].locked, m + ': AUTO is the player\'s (not forced)');
  ok(a.manualReplay === false, 'a MANUAL replay (the player\'s own recorded ult timing) is not forced - by design (isAutoBattle v269)');
  /* CONTROLS */
  const c1 = autoToggle(boot(patchedPage('auto1', [['const forced=isAutoBattle();   // deterministic', 'const forced=false;   // deterministic']])));
  ok(AUTO.some(m => c1.forced[m].auto !== true), 'CONTROL: a page that never forces AUTO fails the "forced on" check (arena auto=' + c1.forced.arena.auto + ')');
  const c2 = autoToggle(boot(patchedPage('auto2', [["if(inp.k==='auto'){ autoUlt=!!inp.tid; autoPendingTarget=null;", "if(inp.k==='auto'){ autoUlt=!!inp.tid;"]])));
  ok(c2.on !== 'AUTO: ON', 'CONTROL: a page that never clears the pending switch stays on "' + c2.on + '" (fails the check)');
  VERDICT[1] = 'PASS'; }

/* ======================================================================================================================================
   2. Speed x1 / x2 - x2 unlocks after stage 1-3 or EGP 1; the button flashes once to teach it. (Since v1457 a guild raid offers x2 only to EGP 1+.)
   ====================================================================================================================================== */
console.log('== 2. Speed x1 / x2 ==');
const SPEED_SRC = html => { const a = html.indexOf("document.getElementById('speedBtn').onclick="), k0 = html.indexOf('{', a); let d = 0, k = k0;
  for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}') { d--; if (!d) break; } } return html.slice(a, k + 1) + ';'; };
function speed(B) {
  const { R, J, els } = B, out = { ch: {} };
  R(`window.__egp=false; patNow=function(){ return {egp:window.__egp?1:0, prestiged:false}; }; saveG=function(){};`);
  for (const [cl, egp, mode] of [[0, false, 'campaign'], [2, false, 'campaign'], [3, false, 'campaign'], [0, true, 'campaign'], [3, false, 'graid'], [0, true, 'graid'], [40, false, 'arena'], [3, false, 'replay']])
    out.ch[cl + '|' + egp + '|' + mode] = J(`(function(){ G.campaignCleared=${cl}; window.__egp=${egp}; CUR={mode:'${mode}'}; return spdChoices(); })()`);
  R(SPEED_SRC(B.page));   // the page's own speed button handler, bound to the fake button
  R("state='battle'; ended=false; CUR={mode:'campaign'}; G.campaignCleared=3; window.__egp=false; G.spdTaught=0; gameSpeed=1; refreshCtrlBtns();");
  out.glow0 = els.speedBtn.className;
  R("refreshCtrlBtns(); state='hub'; refreshCtrlBtns(); state='battle'; refreshCtrlBtns();"); out.glowNext = els.speedBtn.className;   // a later fight, still untapped
  R("document.getElementById('speedBtn').onclick()"); out.tapped = { speed: J('gameSpeed'), taught: J('G.spdTaught'), cls: els.speedBtn.className };
  R("document.getElementById('speedBtn').onclick()"); out.back = J('gameSpeed');
  R("state='battle'; refreshCtrlBtns();"); out.glowAfter = els.speedBtn.className;
  R("G.campaignCleared=2; G.spdTaught=0; window.__banners=[]; gameSpeed=1; refreshCtrlBtns(); document.getElementById('speedBtn').onclick();");
  out.locked = { speed: J('gameSpeed'), banner: J('window.__banners'), cls: els.speedBtn.className };
  R("CUR={mode:'graid'}; G.campaignCleared=40; window.__banners=[]; refreshCtrlBtns(); document.getElementById('speedBtn').onclick();"); out.raidLocked = J('window.__banners');
  return out;
}
if (want(2)) { const s = speed(L), S = k => JSON.stringify(s.ch[k]);
  ok(S('0|false|campaign') === '[1]' && S('2|false|campaign') === '[1]', 'x1 only before stage 1-3 is cleared (0 and 2 stages cleared: ' + S('2|false|campaign') + ')');
  ok(S('3|false|campaign') === '[1,2]', 'x2 opens once 1-3 is cleared: ' + S('3|false|campaign'));
  ok(S('0|true|campaign') === '[1,2]', 'x2 opens at EGP 1 with nothing cleared: ' + S('0|true|campaign'));
  ok(S('3|false|graid') === '[1]' && S('0|true|graid') === '[1,2]', 'guild raid: x2 for EGP 1+ only (1-3 cleared, no EGP: ' + S('3|false|graid') + '; EGP 1: ' + S('0|true|graid') + ')');
  ok(S('3|false|replay') === '[0.5,1,2]' && S('40|false|arena') === '[1,2]', 'x0.5 only in replays (replay ' + S('3|false|replay') + ', arena ' + S('40|false|arena') + ')');
  ok(/tut-next-glow/.test(s.glow0) && /tut-next-glow/.test(s.glowNext), 'x2 open and never tapped: the button carries the teaching glow - in this fight and in the next one');
  ok(s.tapped.speed === 2 && s.tapped.taught === 1 && !/tut-next-glow/.test(s.tapped.cls) && s.back === 1, 'the first tap sets x2, records the lesson (G.spdTaught=1) and the glow is gone; a second tap goes back to x1');
  ok(!/tut-next-glow/.test(s.glowAfter), 'after that first tap the glow never comes back');
  ok(s.locked.speed === 1 && /locked/.test(s.locked.cls) && !/tut-next-glow/.test(s.locked.cls) && /1-3/.test(s.locked.banner[0] || ''), 'locked (1-3 not cleared): a tap keeps x1 and says "' + s.locked.banner[0] + '"');
  ok(/EGP|VIP/i.test(s.raidLocked[0] || ''), 'locked in a guild raid: a tap says "' + s.raidLocked[0] + '"');
  const css = (html.match(/\.tut-next-glow\{[^}]*\}/) || [''])[0];
  ok(/animation:tutGoldPulse [\d.]+s ease-in-out infinite/.test(css), 'the glow is the tutorial pulse, repeating until the tap (' + (css.match(/animation:[^!;]*/) || [''])[0] + ')');
  /* CONTROL: x2 opened one stage later */
  const c = speed(boot(patchedPage('spd', [['return (G.campaignCleared||0)>=3 || patEgp1();', 'return (G.campaignCleared||0)>=4 || patEgp1();']])));
  ok(JSON.stringify(c.ch['3|false|campaign']) === '[1]', 'CONTROL: a page that opens x2 at 1-4 fails the "x2 after 1-3" check (' + JSON.stringify(c.ch['3|false|campaign']) + ')');
  finding(2, 'WORDING', 'the rules hold, but the button does not "flash once": it pulses gold (tutGoldPulse 1.25 s, infinite) in every fight until the first tap. Corrected: "Speed x1 / x2 - x2 unlocks after stage 1-3 or EGP 1 (a guild raid: EGP 1 only); until the player first taps it, the button pulses gold to teach it."');
  VERDICT[2] = 'WORDING'; }

/* ======================================================================================================================================
   3. Auto-pause - leaving the app pauses campaign, Vault, arena and similar fights.
   ====================================================================================================================================== */
console.log('== 3. Auto-pause ==');
const VIS_SRC = html => { const a = html.indexOf("document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden'){ try{ flushCloud(); }");
  assert(a > 0, 'the visibilitychange handler is found'); const k0 = html.indexOf('()=>', a); let d = 0, k = html.indexOf('{', k0);
  for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}') { d--; if (!d) break; } } return html.slice(k0, k + 1); };
const MODES = ['campaign', 'dungeon', 'vault', 'arena', 'province', 'well', 'graid', 'raid', 'elite', 'emberdraft', 'replay', 'online', 'pvp'];
function autoPause(B) {
  const { R, J, els, spec, setup } = B, out = {};
  R('window.__vis=' + VIS_SRC(B.page) + '; flushCloud=function(){};');
  for (const m of MODES) {
    setup(['grosk', 'vex'].map(k => spec(k, 30)), ['tharl', 'hobb'].map(k => spec(k, 30)), 3, m);
    els.pauseModal._cl.clear(); R(`CUR.mode='${m}'; paused=false; ended=false; state='battle'; document.visibilityState='hidden'; window.__vis(); document.visibilityState='visible';`);
    out[m] = { paused: J('paused'), modal: els.pauseModal._cl.has('active') }; }
  /* paused freezes the fight: the loop's own gate (freeze = paused || ...) holds updateBattle */
  out.freeze = /const freeze = paused \|\| \(aiming && CUR\.mode!=='online'\) \|\| ULTCOACH\.hold;/.test(B.page) && /else if\(!freeze && !actHold\(\) && !_battleHalted\)\{/.test(B.page);
  return out;
}
if (want(3)) { const p = autoPause(L), on = MODES.filter(m => p[m].paused && p[m].modal), off = MODES.filter(m => !p[m].paused);
  for (const m of ['campaign', 'dungeon', 'vault', 'arena', 'province', 'well']) ok(p[m].paused && p[m].modal, m + ': leaving the app pauses the fight and opens the pause menu');
  for (const m of ['online', 'pvp']) ok(!p[m].paused, m + ' (live PvP): not paused - the other player is still fighting');
  ok(p.freeze, 'a paused fight does not tick: the frame loop runs updateBattle only when !freeze (freeze = paused || ...)');
  console.log('  info paused on leaving: ' + on.join(', ') + ' | not paused: ' + off.join(', '));
  const c = autoPause(boot(patchedPage('pause', [["(CUR.mode==='campaign'||CUR.mode==='dungeon'||CUR.mode==='vault'||CUR.mode==='arena'||CUR.mode==='province'||CUR.mode==='well')){", "(CUR.mode==='campaign'||CUR.mode==='dungeon'||CUR.mode==='arena'||CUR.mode==='province'||CUR.mode==='well')){"]])));
  ok(!c.vault.paused, 'CONTROL: a page without Vault in the auto-pause list fails the Vault check (paused=' + c.vault.paused + ')');
  finding(3, 'WORDING', 'measured: leaving the app pauses ' + on.join(', ') + ' fights; it does NOT pause ' + off.join(', ') + '. Corrected: "Auto-pause - leaving the app pauses campaign, Vault, Arena, Province and Starless Well fights (menu open until Resume); guild raid, world-map raids, Elite, Emberdraft, replays and live PvP do not pause."');
  VERDICT[3] = 'WORDING'; }


/* ======================================================================================================================================
   9. Boss stat boost - bosses get extra health, damage and range.
   ====================================================================================================================================== */
function bossBoost(B) {
  return B.J(`(function(){ CUR={mode:'replay'}; const keys=[...new Set((typeof BOSS_POOL!=='undefined'?BOSS_POOL:[]).concat(Object.keys(MONSTER_TYPES).filter(k=>MONSTER_TYPES[k].isboss)))].filter(k=>MONSTER_TYPES[k]);
    return keys.map(k=>{ const n=makeUnit(k,'enemy',500,500,40,{}), b=makeUnit(k,'enemy',500,500,40,{boss:true});
      return {k, ranged:!n.melee, hp:b.maxHp/n.maxHp, dmg:b.dmg/n.dmg, spell:(monScaleMode(b)?monSkillStat(b)/Math.max(1e-9,monSkillStat(n)):b.dmg/n.dmg), range:b.range/n.range, hold:b.combatDist/n.combatDist, rangeM:+(b.range/METER).toFixed(2), rangeNM:+(n.range/METER).toFixed(2)}; }); })()`);
}
if (want(9)) { console.log('== 9. Boss stat boost ==');
  const r = bossBoost(L), near = (a, b) => Math.abs(a - b) < 1e-6;
  ok(r.length >= 15, r.length + ' bosses measured (BOSS_POOL + every isboss monster), level 40, the same monster built as a boss and as a normal unit');
  const hp = r.filter(x => near(x.hp, 2.4)), dmg = r.filter(x => near(x.dmg, 1.8) && near(x.spell, 1.8)), rng = r.filter(x => x.range > 1.2 && x.hold > 1.2);
  ok(hp.length === r.length, 'health x2.4 on every boss (' + hp.length + '/' + r.length + ')');
  ok(dmg.length === r.length, 'damage x1.8 on every boss, basic attack and spell power alike (' + dmg.length + '/' + r.length + ')');
  ok(rng.length === r.length, 'range on every boss: melee x1.4 reach (hold x1.5), ranged x1.4 hold and reach (' + rng.length + '/' + r.length + '; e.g. ' + r.filter(x => x.ranged).slice(0, 3).map(x => x.k + ' ' + x.rangeNM + ' -> ' + x.rangeM + ' m').join(', ') + ')');
  console.log('  info ' + r.map(x => x.k + (x.ranged ? '(R)' : '') + ' hp x' + x.hp.toFixed(2) + ' dmg x' + x.dmg.toFixed(2) + ' range x' + x.range.toFixed(2)).join('; '));
  const c = bossBoost(boot(patchedPage('boss', [['const bhp=boss?2.4:1,bdmg=boss?1.8:1,br=boss?2.2:1;', 'const bhp=1,bdmg=boss?1.8:1,br=boss?2.2:1;']])));
  ok(c.some(x => !near(x.hp, 2.4)), 'CONTROL: a page with no boss health boost fails the health check (hp x' + c[0].hp.toFixed(2) + ')');
  VERDICT[9] = 'PASS'; }

/* ======================================================================================================================================
   10. Connection slow - if the server stops answering for 3 s, the fight keeps recording locally.
   ====================================================================================================================================== */
function connSlow(B, wallClock) {
  const { R, J, spec, setup } = B;
  setup(['grosk', 'vex'].map(k => spec(k, 30)), ['tharl', 'hobb'].map(k => spec(k, 30)), 9, 'campaign');
  R(`CUR.mode='campaign'; REPLAY_IN=null; CUR.attemptId='a1'; window.__sent=[]; window.__banners=[]; ACC.token='t'; CHATNET.ws={readyState:1};
     chatNetSend=function(o){ window.__sent.push(o); return true; }; autoOpen=function(){ return true; }; autoUlt=false; autoPendingTarget=null; actBegin(); autoBtnPress();`);
  const t0 = J('simTick'), rows = [];
  if (wallClock) R('_actWaitAt=Date.now()-3100;');   // the press has waited 3.1 s of real time (a fight held still, e.g. paused)
  for (let i = 0; i < 30; i++) { const held = J('actHold()'); if (!held) R('updateBattle(SIM_STEP)'); rows.push({ tick: J('simTick') - t0, held, auto: J('autoUlt'), stream: J('_actStreamOn') }); }
  const out = { rows, banner: J('window.__banners'), abandon: J("window.__sent.some(o=>o.kind==='abandon')"), log: J("INPUT_LOG.filter(e=>e[1]==='auto')"), delay: J('ACT_INPUT_DELAY_CLIENT'), timeout: J('ACT_ACK_TIMEOUT_MS'), pace: J('SIM_HZ*BATTLE_PACE') };
  R("ACC.token=null; CHATNET.ws=null; _actStreamOn=false;");
  return out;
}
if (want(10)) { console.log('== 10. Connection slow ==');
  const c = connSlow(L, false), on = c.rows.findIndex(r => r.auto), first = c.rows.findIndex(r => !r.stream);
  ok(c.rows.every((r, i) => !r.held && r.tick === i + 1), 'no answer from the server: the fight never stands still (30 frames, 30 ticks: ' + c.rows.map(r => r.tick).slice(0, 12).join(',') + ',...)');
  ok(first >= 0 && first <= c.delay && on === first, 'the stream is dropped and AUTO applied on the tick the press lands on (tick ' + (first + 1) + ' after the press; ACT_INPUT_DELAY ' + c.delay + ' ticks = ' + (c.delay / c.pace).toFixed(3) + ' s at x1)');
  ok(c.abandon && c.log.length === 1, 'the server is told to drop its partial list (abandon) and the press is in the local record (' + JSON.stringify(c.log) + ')');
  ok(/Connection slow/.test(c.banner.join(' ')), 'the player is told: "' + c.banner.join(' ').replace(/<[^>]*>/g, '').trim() + '"');
  const w = connSlow(L, true);
  ok(w.rows[0].auto === true && !w.rows[0].stream && c.timeout === 3000, 'the 3 s wall clock (ACT_ACK_TIMEOUT_MS ' + w.timeout + ') is still the backstop: a press that waited 3.1 s is handed over on the next frame');
  const k = connSlow(boot(patchedPage('conn', [['if(simTick>=_actWaitFrom+ACT_INPUT_DELAY_CLIENT){ actGiveUp(); return false; }', '']])), false);
  ok(!k.rows.some(r => r.auto), 'CONTROL: a page without the land-tick hand-over leaves AUTO unapplied for all 30 ticks (fails the check)');
  finding(10, 'WORDING', 'the fight never waits 3 s: when the server has not answered a press by the tick it lands on (' + c.delay + ' ticks, ' + (c.delay / c.pace).toFixed(2) + ' s at x1), the press is applied, the fight carries on and records locally, and "Connection slow" shows; 3 s of real time is only the backstop. Corrected: "Connection slow - if the server has not answered a press by the moment it lands (about 0.4 s), the fight carries on without waiting, records locally and says Connection slow."');
  VERDICT[10] = 'WORDING'; }

/* ======================================================================================================================================
   12. Rule cards - hover or tap a class or element to see its rule with exact numbers.
   ====================================================================================================================================== */
const AFF_KEYS = ['Support', 'Tank', 'Marksman', 'Mage', 'Bruiser', 'Assassin', 'Water', 'Fire', 'Ice', 'Nature', 'Lightning', 'Light', 'Dark', 'Neutral'];
function ruleCards(B) {
  const { J } = B;
  const tips = J('(' + JSON.stringify(AFF_KEYS) + ').map(k=>affTip(k))'), E = J('EDGE'), pct = J('Math.round(ELEM_BONUS*100)');
  const nums = s => (String(s).match(/\d+(\.\d+)?/g) || []).map(Number);
  const want = { Support: [E.armorIgnore * 100, E.healBonus * 100], Tank: [E.block * 100, E.tauntPlus], Marksman: [E.drain], Mage: [Math.round((E.hexAtk - 1) * 100), Math.round((1 - E.hexMove) * 100), E.hexDur],
    Bruiser: [100, E.riposteCd], Assassin: [E.healCut * 100, E.healCutDur] };
  const out = { rows: {}, E, pct };
  AFF_KEYS.forEach((k, i) => { const w = want[k] || ((k === 'Neutral') ? [] : [pct]); out.rows[k] = { text: tips[i][1], has: w.every(n => nums(tips[i][1]).includes(n)), want: w }; });
  /* the engine really uses those numbers: an element hit, a Marksman's drain, an Assassin's heal cut and shield damage, a Bruiser's riposte */
  out.meas = J(`(function(){ CUR={mode:'replay'}; const mk=(k,team)=>{ const u=makeUnit(k,team,500,500,40,{}); u.glyphCrit=0; u.evaStat=0; u.blockStat=0; u.armorRating=0; u.mrRating=0; u.critRes=0; u.glyphDR=0; u.maxHp=1e9; u.hp=1e9; u.pass=null; return u; };
    const el=k=>Object.keys(AFF_ELEMENT).find(x=>AFF_ELEMENT[x]===k&&HERO_TYPES[x]&&!HERO_TYPES[x].monster&&x!=='aureth');
    const cls=c=>Object.keys(HERO_TYPES).find(x=>!HERO_TYPES[x].monster&&HERO_TYPES[x].role===c&&KITS[x]&&AFF_ELEMENT[x]==='Neutral');
    battleTime=10; const hit=(s,t)=>{ const h=t.hp; _preCrit=false; dealDamage(s,t,1000,'#fff','true'); return +(h-t.hp).toFixed(3); };
    const w=mk(el('Water'),'ally'), f=mk(el('Fire'),'enemy'), n=mk(cls('Support'),'enemy');
    const r={ waterFire:hit(w,f) }; w.team='enemy'; f.team='ally'; r.fireWater=hit(f,w); w.team='ally'; r.waterNeutral=hit(w,n);
    const m=mk(cls('Marksman'),'ally'), g=mk(cls('Mage'),'enemy'), q=mk(cls('Tank'),'ally'); g.energy=50; hit(q,g); const e1=g.energy; g.energy=50; hit(m,g); r.drain=e1-g.energy;   /* against the same hit from a class with no edge on a Mage (both give the +7 a hit to health gives) */
    const a=mk(cls('Assassin'),'ally'), s=mk(cls('Support'),'enemy'); s.shield=5000; const s0=s.shield; hit(a,s); r.shieldLost=s0-s.shield; r.healCut=+(s._healCutUntil-battleTime).toFixed(3);
    const b=mk(cls('Bruiser'),'enemy'), a2=mk(cls('Assassin'),'ally'); const ah=a2.hp; hit(a2,b); r.riposte=+((ah-a2.hp)/b.dmg).toFixed(3); r.ripCd=+(b._ripReady-battleTime).toFixed(3);
    return r; })()`);
  out.ui = /el\.addEventListener\('mouseenter',\(\)=>show\(el\)\); el\.addEventListener\('focus',\(\)=>show\(el\)\); el\.addEventListener\('click',e=>\{ e\.stopPropagation\(\); show\(el\); \}\);/.test(B.page);
  out.regions = J('AFF_REGIONS.map(r=>r[1])');
  return out;
}
if (want(12)) { console.log('== 12. Rule cards ==');
  const c = ruleCards(L);
  for (const k of AFF_KEYS) ok(c.rows[k].has, k + ' card carries the engine\'s numbers ' + JSON.stringify(c.rows[k].want) + ': "' + c.rows[k].text + '"');
  ok(AFF_KEYS.every(k => c.regions.includes(k)), 'every class and element has a hit region on the chart (' + c.regions.length + ' regions)');
  ok(c.ui, 'each region opens its card on hover (mouseenter), keyboard focus and tap/click');
  const m = c.meas;
  console.log('  info measured ' + JSON.stringify(m));
  ok(Math.abs(m.waterFire / m.waterNeutral - 1.2) < 1e-6 && Math.abs(m.fireWater / m.waterNeutral - 0.8) < 1e-6, 'measured: Water hits Fire for +20% (' + m.waterFire + ' vs ' + m.waterNeutral + ' on Neutral), Fire hits Water for -20% (' + m.fireWater + ')');
  ok(m.drain === c.E.drain, 'measured: a Marksman hit takes ' + m.drain + ' energy from a Mage');
  ok(m.healCut === c.E.healCutDur && Math.abs(m.shieldLost - 2000) < 1e-6, 'measured: an Assassin hit cuts a Support\'s healing for ' + m.healCut + ' s and takes ' + m.shieldLost + ' off a shield for a 1,000 hit (double)');
  ok(Math.abs(m.riposte - 1) < 0.02 && m.ripCd === c.E.riposteCd, 'measured: a Bruiser struck by an Assassin strikes back for ' + (m.riposte * 100).toFixed(0) + '% of its Attack, then waits ' + m.ripCd + ' s');
  /* CONTROL: a card whose number is not the engine's */
  const k = ruleCards(boot(patchedPage('aff', [['const EDGE={ armorIgnore:0.5, healBonus:0.20, block:0.25, tauntPlus:1, drain:10,', 'const EDGE={ armorIgnore:0.5, healBonus:0.20, block:0.25, tauntPlus:1, drain:12,']])));
  ok(!k.rows.Marksman.has, 'CONTROL: an engine drain of 12 makes the Marksman card ("10 energy") fail the check');
  VERDICT[12] = 'PASS'; }

/* ======================================================================================================================================
   Real fights for lines 4 and 6: all 61 heroes, level 40, quality 3 (Green, Blue and passive open), skill level 40, AUTO on both sides,
   5 v 5, 60 s of battle time, in shuffled line-ups over three seeds - every cast start, every cast release and every basic-attack blow
   is recorded by wrapping the engine's own functions (castKit / castAbility / hero61Cast / _doEffectCore / fuseStrike).
   ====================================================================================================================================== */
const FIGHT_INSTR = `window.__CW=null; window.__HH=null; (function(){
  const wrapStart=(name,slotOf)=>{ const f=globalThis[name]; globalThis[name]=function(u){ const W=window.__CW; if(!W||!u) return f.apply(this,arguments);
      const slot=slotOf(u,arguments), p0=u._pend; W.depth++; W.cur=u; W.startCore=0; let r; try{ r=f.apply(this,arguments); } finally{ W.depth--; if(!W.depth) W.cur=null; }
      const p=u._pend; if(slot&&p&&p!==p0){ const rec={k:u.key,team:u.team,slot,t0:simTick,ct:castTimeFor(u,slot),fire:null,core:0,startCore:W.startCore,cancel:false};
        const fz=p.fire; p.fire=function(){ rec.fire=simTick; const pi=W.inFire, pr=W.fireRec; W.inFire=u; W.fireRec=rec; try{ return fz.apply(this,arguments); } finally{ W.inFire=pi; W.fireRec=pr; } };
        W.recs.push(rec); W.live.set(u,rec); }
      return r; }; };
  wrapStart('castKit',(u,a)=>(u.blueAb&&a[1]===u.blueAb)?'blue':'green');
  wrapStart('castAbility',u=>{ u.__ultT=simTick; return u.key===HERO61.KEY?null:'ult'; });
  wrapStart('hero61Cast',(u,a)=>a[1]);
  const cc=castCancel; castCancel=function(u){ const W=window.__CW; if(W&&u&&u._pend){ const r=W.live.get(u); if(r&&r.fire==null) r.cancel=true; } return cc.apply(this,arguments); };
  const core=_doEffectCore; _doEffectCore=function(u){ const W=window.__CW; if(W&&u){ if(W.depth>0&&W.cur===u) W.startCore++; if(W.inFire===u&&W.fireRec) W.fireRec.core++; } return core.apply(this,arguments); };
  /* a swing's CONTACT moment (the clip's hit / release cell: clip x relFrac, as fuseStrike times it, without a shot's flight) is when the
     blow is shown - or hidden. The swing is classified there; it counts when its blow then lands. A ranged shot that left the bow in view
     and lands while the shooter casts is not hidden. */
  const _cls=u=>((((u._lockPri|0)===6)&&((u._animLockT||0)>0))||((u._ultRootT||0)>0))?'ult':((((u.stunned||0)>0)||((u.fearT||0)>0)||((u._airT||0)>0))?'cc':((((u._lockPri|0)===4)&&((u._animLockT||0)>0))?'skill':''));
  const fz0=fuseStrike; fuseStrike=function(u,tgt,clip,go,extra,rate){ const H=window.__HH; if(!H||!u) return fz0.apply(this,arguments);
    const sw={c:null,done:false,t0:simTick}, cls=()=>{ if(!sw.done){ sw.done=true; sw.c=_cls(u); if(sw.c==='ult') sw.vis=Math.max(0,((u.__ultT!=null?u.__ultT:simTick)-sw.t0)*SIM_STEP); } };
    const cdur=clipDur(clip)*(clip&&clip.relFrac!=null?clip.relFrac:0.5)*BATTLE_PACE/(rate||1);
    const g=function(){ cls(); H.n++; if(sw.c){ (H[sw.c]=H[sw.c]||[]).push(u.key+'@'+(simTick*SIM_STEP).toFixed(2)); if(sw.c==='ult') (H.vis=H.vis||[]).push(+sw.vis.toFixed(3)); } return go.apply(this,arguments); };
    const r=fz0.call(this,u,tgt,clip,g,extra,rate);
    if((extra||0)>0){ if(cdur>0.02) (u._fuse||(u._fuse=[])).push({t:cdur,tgt:u,go:cls}); else cls(); }   /* a shot: its contact is the release, before the flight */
    return r; };
})(); 1`;
function lineups(seed) { const r = (() => { let x = seed >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296); })();
  const a = HEROES.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  while (a.length % 10) a.push(a[a.length % 61]); const out = []; for (let i = 0; i < a.length; i += 10) out.push([a.slice(i, i + 5), a.slice(i + 5, i + 10)]); return out; }
function realFights(B, seeds) {
  const { R, J, spec, setup } = B; R(FIGHT_INSTR);
  const recs = [], H = { n: 0, ult: [], cc: [], skill: [], vis: [] };
  for (const sd of seeds) for (const [A, E] of lineups(sd)) {
    setup(A.map(k => spec(k, 40, 40)), E.map(k => spec(k, 40, 40)), sd, 'replay');
    R("window.__CW={recs:[],depth:0,cur:null,live:new Map()}; window.__HH={n:0}; autoUlt=true;");
    R('__step(Math.round(60/SIM_STEP))');
    recs.push(...J('window.__CW.recs')); const h = J('window.__HH'); H.n += h.n; for (const k of ['ult', 'cc', 'skill', 'vis']) H[k].push(...(h[k] || []));
    R('window.__CW=null; window.__HH=null;'); }
  return { recs, H };
}
const FIGHTS = (want(4) || want(6)) ? (() => { const t = Date.now(), f = realFights(L, [11, 22, 33]); console.log('  info real fights: ' + ((Date.now() - t) / 1000).toFixed(1) + ' s, ' + f.recs.length + ' cast starts, ' + f.H.n + ' basic-attack blows'); return f; })() : null;

/* ======================================================================================================================================
   4. Cast time is the wind-up - every skill has a wind-up; the effect lands when the hand comes down.
      Measured: for every hero's Green / Blue / ultimate, the effect core runs after the cast's wind-up (ABILITY_CAST / castTimeFor), not at the press.
   ====================================================================================================================================== */
function windupCheck(F) {
  const by = {}, bad = [], early = [];
  for (const r of F.recs) { const k = r.k + '.' + r.slot, e = by[k] || (by[k] = { n: 0, fired: 0, cancel: 0, maxOff: 0, core: 0, ct: r.ct });
    e.n++; if (r.cancel) e.cancel++;
    if (r.startCore > 0) early.push(k + ' (effect ran at the press)');
    if (r.fire != null) { e.fired++; const off = Math.abs((r.fire - r.t0) * SIM_STEP - r.ct); e.maxOff = Math.max(e.maxOff, off); if (off > SIM_STEP * 1.05) bad.push(k + ' released ' + ((r.fire - r.t0) * SIM_STEP).toFixed(3) + ' s after the press (wind-up ' + r.ct + ' s)'); if (r.core > 0 || r.k === 'hero61' || /hero61/.test(r.k)) e.core++; } }
  return { by, bad, early };
}
if (want(4)) { console.log('== 4. Cast time is the wind-up ==');
  const W = windupCheck(FIGHTS), keys = Object.keys(W.by), slots = HEROES.flatMap(h => ['green', 'blue', 'ult'].map(s => h + '.' + s));
  const tbl = L.J('(' + JSON.stringify(HEROES) + ').map(k=>{ const u={key:k,t:HERO_TYPES[k]}; return [k,castTimeFor(u,"green"),castTimeFor(u,"blue"),castTimeFor(u,"ult")]; })');
  ok(tbl.every(r => r[1] > 0 && r[2] > 0 && r[3] > 0), 'every hero\'s Green, Blue and ultimate has a wind-up > 0 (castTimeFor, ABILITY_CAST else 0.5 / 0.8 s): ' + Math.min(...tbl.flatMap(r => r.slice(1))).toFixed(3) + ' .. ' + Math.max(...tbl.flatMap(r => r.slice(1))).toFixed(3) + ' s');
  const miss = slots.filter(s => !W.by[s] || !W.by[s].fired);
  console.log('  info hero-slots cast and released in the fights: ' + (slots.length - miss.length) + ' of ' + slots.length + (miss.length ? ' (not released: ' + miss.join(', ') + ')' : ''));
  ok(slots.length - miss.length >= 170, (slots.length - miss.length) + ' of 183 hero-slots were cast and released in real fights');
  ok(W.early.length === 0, 'no cast ran its effect core at the press (' + FIGHTS.recs.length + ' presses; ' + W.early.length + ' early)');
  const fired = keys.reduce((s, k) => s + W.by[k].fired, 0), maxOff = Math.max(...keys.map(k => W.by[k].maxOff));
  ok(W.bad.length === 0, 'every released cast released at press + its wind-up, within one tick (' + fired + ' releases; worst ' + maxOff.toFixed(4) + ' s; tick ' + SIM_STEP.toFixed(4) + ' s)' + (W.bad.length ? ': ' + W.bad.slice(0, 5).join('; ') : ''));
  const noCore = keys.filter(k => W.by[k].fired && !W.by[k].core && !/^hero61\./.test(k));
  ok(noCore.length === 0, 'and the effect core ran inside that release for every hero-slot (hero61 / Morvayne releases his own heal)' + (noCore.length ? ': missing ' + noCore.join(', ') : ''));
  console.log('  info ' + keys.reduce((s, k) => s + W.by[k].cancel, 0) + ' casts were interrupted (stun, fear, silence, sleep or death in the wind-up) and never released');
  /* CONTROL: a page whose Green/Blue releases at the press (no wind-up) */
  const C = windupCheck(realFights(boot(patchedPage('windup', [['  u._pend={ t:ct, sm:(u._castSM||1), lv:(u._castLv||1), ax:u._aimWX, ay:u._aimWY, spell:true,', '  u._pend={ t:0, sm:(u._castSM||1), lv:(u._castLv||1), ax:u._aimWX, ay:u._aimWY, spell:true,']])), [11]));
  ok(C.bad.length > 50, 'CONTROL: a page that releases every Green/Blue with no wind-up fails the release check (' + C.bad.length + ' early releases, e.g. ' + C.bad[0] + ')');
  /* the art: where the clip itself marks its hit cell, does the wind-up end on it? (the "hand comes down" half of the line) */
  const art = L.J(`(function(){ const out=[]; for(const k of ${JSON.stringify(HEROES)}){ const A=BATTLE_ANIM[k]; if(!A) continue; for(const s of ['green','blue','ult']){ const c=A[s]; if(!c) continue;
      const cell=(c.contact!=null)?c.contact:(c.release!=null)?c.release:(c.apex!=null)?c.apex:(c.relFrac!=null?Math.round(c.relFrac*(c.n||0)):null); if(cell==null) continue;
      const hit=cell/(c.fps||10)*BATTLE_PACE, ct=castTimeFor({key:k,t:HERO_TYPES[k]},s); out.push([k+'.'+s,+hit.toFixed(3),ct,+((ct-hit)*(c.fps||10)/BATTLE_PACE).toFixed(1)]); } } return out; })()`);
  const off = art.filter(a => Math.abs(a[1] - a[2]) > 0.25);
  console.log('  info clips that mark their hit cell: ' + art.length + '; wind-up within 0.25 s of that cell: ' + (art.length - off.length) + '; further off: ' + off.length + (off.length ? ' (' + off.slice(0, 12).map(a => a[0] + ' cell ' + a[1] + ' s vs wind-up ' + a[2] + ' s').join('; ') + (off.length > 12 ? '; ...' : '') + ')' : ''));
  if (off.length) { finding(4, 'WORDING', 'the engine rule holds everywhere (' + fired + ' releases at press + wind-up, none at the press), but on ' + off.length + ' of the ' + art.length + ' clips that mark their hit cell the wind-up ends more than 0.25 s away from that cell (e.g. ' + off.slice(0, 4).map(a => a[0] + ' ' + a[2] + ' s vs cell ' + a[1] + ' s').join(', ') + '), so "when the hand comes down" is not true for those. Corrected: "Cast time is the wind-up - every skill has a wind-up (ABILITY_CAST, else 0.5 s skills / 0.8 s ults); its effect lands when the wind-up ends, never at the press."'); VERDICT[4] = 'WORDING'; }
  else VERDICT[4] = 'PASS'; }

/* ======================================================================================================================================
   6. No hidden hits - a basic attack never lands hidden under a skill animation.
      Measured on the same real fights: at the moment each basic-attack blow lands, is the attacker's screen taken by its ultimate clip
      (sim lock priority 6 still running, or the ult root), a Green/Blue clip (priority 4), or a control that cut the swing (stun / fear / airborne)?
   ====================================================================================================================================== */
if (want(6)) { console.log('== 6. No hidden hits ==');
  const H = FIGHTS.H, tally = a => { const m = {}; a.forEach(s => { const k = s.split('@')[0]; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((x, y) => y[1] - x[1]).map(e => e[0] + ' ' + e[1]).join(', '); };
  ok(H.n > 2000, H.n + ' basic-attack blows landed in the fights');
  console.log('  info blows under the ult clip: ' + H.ult.length + ' (' + tally(H.ult).slice(0, 300) + ')');
  const v = H.vis.slice().sort((a, b) => a - b), short = v.filter(x => x < 0.1).length;
  console.log('  info of those, the swing was on screen before the ult took it: median ' + (v[v.length >> 1] || 0).toFixed(2) + ' s; under 0.1 s (practically never drawn): ' + short);
  console.log('  info blows under a Green/Blue or passive clip (sim priority 4): ' + H.skill.length + (H.skill.length ? ' (' + tally(H.skill).slice(0, 200) + ')' : ''));
  console.log('  info blows while the attacker was stunned / feared / airborne: ' + H.cc.length + (H.cc.length ? ' (' + tally(H.cc).slice(0, 200) + ')' : ''));
  /* CONTROL: a patched page where a blow is dropped when the ult or a control has cut its swing - the same count must read 0 */
  const K = realFights(boot(patchedPage('hidden', [
    ['  u._animLockT=0;   // the ult outranks everything: it is the one action allowed to cut a clip short', '  u._animLockT=0; u._fuse=null;   // the ult outranks everything: it is the one action allowed to cut a clip short'],
    ["function castKit(u,ab){ const slot=", "function castKit(u,ab){ u._fuse=null; const slot="],
    ['if(F.t<=0){ u._fuse.splice(i,1); if(u.alive && F.tgt && F.tgt.alive){', 'if(F.t<=0){ u._fuse.splice(i,1); if(u.alive && F.tgt && F.tgt.alive && !(((u.stunned||0)>0)||((u.fearT||0)>0)||((u._airT||0)>0))){']])), [11, 22, 33]).H;
  ok(K.ult.length <= 2 && K.cc.length === 0 && K.n > 2000, 'CONTROL: on a patched page where the ult / a Green-Blue / a control cancels the swing it cuts, the count reads ' + K.ult.length + ' under the ult and ' + K.cc.length + ' under control (of ' + K.n + ' blows; passive clips, which that patch leaves alone, ' + K.skill.length + ')');
  const hidden = H.ult.length + H.skill.length;
  if (hidden + H.cc.length > 0) { finding(6, 'FAIL', hidden + ' of ' + H.n + ' basic-attack blows (' + (100 * hidden / H.n).toFixed(1) + '%) landed while the attacker\'s ult or skill/passive clip held the screen at the swing\'s contact moment (ult ' + H.ult.length + ' - the swing had shown a median ' + (v[v.length >> 1] || 0).toFixed(2) + ' s, under 0.1 s for ' + short + ' - ; Green/Blue/passive ' + H.skill.length + '), plus ' + H.cc.length + ' while stunned/feared/airborne. Cause: a swing\'s blow is fused at the swing (fuseStrike, page ~9392) and the fuse loop in think (~18402) fires it whatever the unit is doing; castAbility (~16688) and the hard-control block (~18434) cut the swing\'s clip but not its fuse. Worst: ' + tally(H.ult).split(', ').slice(0, 6).join(', ')); VERDICT[6] = 'FAIL'; }
  else VERDICT[6] = 'PASS'; }

/* ======================================================================================================================================
   5. Skill level effects - levelling a skill raises its damage, its chance to land control and slow strength.
      Measured: one real cast (doEffect, the engine's own path) on a still, unarmoured dummy, only the skill level changed.
   ====================================================================================================================================== */
function skillCast(B, hero, slot, lv, opt) {
  const o = Object.assign({ heroLv: 60, foeLv: 60, seed: 5, ticks: 110 }, opt || {});
  B.setup([B.spec(hero, o.heroLv, lv)], [B.spec('carn', o.foeLv)], o.seed);
  return B.J(`(function(){ const A=U('${hero}','ally'), B=U('carn','enemy'); units.forEach(u=>{ u.speed=0; u.atkCd=1e9; u.energy=0; u.gearSkill=null; u.ctrlRes=0; u.pass=null; u._tal=null; });
    A.greenAb=null; A.blueAb=null; A.glyphCrit=0; B.maxHp=1e9; B.hp=1e9; B.armorRating=0; B.mrRating=0; B.evaStat=0; B.blockStat=0; B.greenAb=null; B.blueAb=null; A.x=500;A.y=700;B.x=500;B.y=560; A.target=B;
    const o=Object.assign({},KITS['${hero}'].${slot}); A._castLv=${lv}; A._castSM=skillMul(${lv}); A._castSlot='${slot}'; o._tgtU=B; o._arrived=true; doEffect(A,o.type,o); A._castSlot=null; A._castSM=1; A._castLv=0;
    let st=0, n=0; for(;n<${o.ticks};n++){ updateBattle(SIM_STEP); if((B.stunned||0)>st) st=B.stunned; } return {dmg:+(1e9-B.hp).toFixed(2), stun:st, slowMul:B.slowMul==null?1:B.slowMul}; })()`);
}
function skillLevels(B) {
  const out = { dmg: {}, chance: {}, slow: {} };
  for (const [h, s] of [['quorrel', 'blue'], ['vex', 'green'], ['fritz', 'green'], ['maren', 'green']]) out.dmg[h + '.' + s] = [1, 50, 100].map(l => skillCast(B, h, s, l).dmg);
  /* control chance: Quorrel's Contempt (a single-target stun) on a level-51 enemy, 120 seeded casts per skill level */
  for (const l of [1, 26, 51]) { let n = 0; for (let sd = 1; sd <= 120; sd++) if (skillCast(B, 'quorrel', 'blue', l, { heroLv: 51, foeLv: 51, seed: sd, ticks: 2 }).stun > 0) n++; out.chance[l] = n / 120; }
  out.slow = Object.fromEntries([1, 50, 100].map(l => [l, +(1 - skillCast(B, 'maren', 'green', l, { heroLv: 100, foeLv: 1, ticks: 30 }).slowMul).toFixed(4)]));
  out.slowOrryn = Object.fromEntries([1, 100].map(l => [l, +(1 - skillCast(B, 'orryn', 'blue', l, { heroLv: 100, foeLv: 1, ticks: 30 }).slowMul).toFixed(4)]));
  out.mul = B.J('[skillMul(50),skillMul(100)]');
  return out;
}
if (want(5)) { console.log('== 5. Skill level effects ==');
  const s = skillLevels(L), m = s.mul;
  for (const k in s.dmg) { const d = s.dmg[k]; ok(Math.abs(d[1] / d[0] - m[0]) < 1e-3 && Math.abs(d[2] / d[0] - m[1]) < 1e-3, k + ' damage at skill level 1 / 50 / 100: ' + d.join(' / ') + ' (x' + (d[1] / d[0]).toFixed(3) + ' / x' + (d[2] / d[0]).toFixed(3) + ' = skillMul)'); }
  ok(Math.abs(s.chance[1] - 0.5) < 0.12 && Math.abs(s.chance[26] - 0.75) < 0.12 && s.chance[51] === 1, 'control chance on a level-51 enemy: skill level 1 lands ' + (100 * s.chance[1]).toFixed(0) + '% (50% expected), 26 lands ' + (100 * s.chance[26]).toFixed(0) + '% (75%), 51 lands ' + (100 * s.chance[51]).toFixed(0) + '% (120 casts each)');
  ok(Math.abs(s.slow[1] - 0.45) < 1e-6 && Math.abs(s.slow[50] - 0.5725) < 1e-6 && Math.abs(s.slow[100] - 0.6975) < 1e-6, 'slow strength (Maren\'s Ashfall, a ground slow): skill level 1 / 50 / 100 slows ' + [1, 50, 100].map(l => (100 * s.slow[l]).toFixed(2) + '%').join(' / '));
  ok(Math.abs(s.slowOrryn[1] - 0.45) < 1e-6 && Math.abs(s.slowOrryn[100] - 0.6975) < 1e-6, 'and Orryn\'s Blue the same: ' + (100 * s.slowOrryn[1]).toFixed(2) + '% -> ' + (100 * s.slowOrryn[100]).toFixed(2) + '%');
  const c = skillLevels(boot(patchedPage('sklv', [
    ['function skillMul(lv){ return 1+((lv||1)-1)*SKILL_STEP; }', 'function skillMul(lv){ return 1; }'],
    ['  return Math.max(0, Math.min(1, 1 - Math.max(0, tl - lv) * CC_MISS_PER_LEVEL));', '  return Math.max(0, Math.min(1, 1 - Math.max(0, tl - 1) * CC_MISS_PER_LEVEL));'],
    ['  return Math.max(SLOW_MUL_FLOOR, SLOW_MUL_BASE-Math.max(0,((lv|0)||1)-1)*SLOW_MUL_PER_LEVEL);', '  return SLOW_MUL_BASE;']])));
  ok(c.dmg['quorrel.blue'][2] === c.dmg['quorrel.blue'][0] && c.chance[51] < 0.8 && c.slow[100] === c.slow[1], 'CONTROL: a page where the skill level changes nothing fails all three checks (damage ' + c.dmg['quorrel.blue'].join('/') + ', chance at 51 ' + (100 * c.chance[51]).toFixed(0) + '%, slow ' + c.slow[1] + ' / ' + c.slow[100] + ')');
  VERDICT[5] = 'PASS'; }

/* ======================================================================================================================================
   7. Damage type growth - Attack heroes scale on Attack, Magic and healers on Ability Power, hybrids both.
      Measured three ways for all 61 heroes: (a) what a level gives (baseAtLevel, level 1 -> 100), (b) which stat moves each Green / Blue
      (one real cast with Attack doubled, then with Ability Power doubled), (c) which stat moves a basic attack.
   ====================================================================================================================================== */
function dmgType(B) {
  const { J } = B;
  const prof = J('Object.fromEntries(' + JSON.stringify(HEROES) + '.map(k=>[k,HERO_TYPES[k].damageProfile||"Attack"]))');
  const grow = J('Object.fromEntries(' + JSON.stringify(HEROES) + '.map(k=>{ const t=HERO_TYPES[k], a=baseAtLevel(t,1), b=baseAtLevel(t,100); return [k,[+(b.dmg-a.dmg).toFixed(1),+(b.apow-a.apow).toFixed(1)]]; }))');
  const eff = (hero, slot, mode, auto) => { B.setup([B.spec(hero, 40, 20), B.spec('gruel', 40)], [B.spec('carn', 40), B.spec('vex', 40)], 3);
    return J(`(function(){ const A=units.find(u=>u.team==='ally'&&u.key==='${hero}'), P=units.find(u=>u.team==='ally'&&u!==A), F=units.filter(u=>u.team==='enemy');
      const _sp=A.speed; units.forEach(u=>{ u.speed=0; u.atkCd=1e9; u.energy=0; u.gearSkill=null; u.ctrlRes=0; u.pass=null; u._tal=null; u.greenAb=null; u.blueAb=null; u.glyphCrit=0; u.evaStat=0; u.blockStat=0; u.armorRating=0; u.mrRating=0; });
      autoUlt=false; F.forEach((f,i)=>{ f.maxHp=1e9; f.hp=1e9; f.x=500+i*40; f.y=560; }); P.maxHp=1e9; P.hp=5e8; P.x=470; P.y=720; A.x=500; A.y=700; A.target=F[0];
      ${mode === 'ad' ? 'A.dmg*=2;' : mode === 'ap' ? 'A.apow=(A.apow||0)*2;' : ''}
      if(${auto ? 1 : 0}){ A.atkCd=0; A.speed=_sp; } else { const o=Object.assign({},KITS['${hero}'].${slot}); A._castLv=20; A._castSM=skillMul(20); A._castSlot='${slot}'; o._tgtU=F[0]; o._arrived=true; doEffect(A,o.type,o); A._castSlot=null; A._castSM=1; A._castLv=0; }
      for(let n=0;n<${auto ? 150 : 90};n++){ updateBattle(SIM_STEP); if(!${auto ? 1 : 0}) A.atkCd=1e9; }
      return +(F.reduce((s,f)=>s+(1e9-f.hp),0)+(P.hp-5e8)).toFixed(2); })()`); };
  const skills = {}, autos = {};
  for (const h of HEROES) {
    for (const s of ['green', 'blue']) { if (!J(`!!(KITS['${h}']&&KITS['${h}'].${s})`)) continue; const b = eff(h, s, ''); if (!(b > 1)) continue;
      const ad = eff(h, s, 'ad') / b, ap = eff(h, s, 'ap') / b; skills[h + '.' + s] = { b, ad: +ad.toFixed(3), ap: +ap.toFixed(3), on: (ad > 1.3 && ap > 1.3) ? 'both' : ad > 1.3 ? 'Attack' : ap > 1.3 ? 'AP' : 'neither' }; }
    const b = eff(h, null, '', true); if (b > 1) { const ad = eff(h, null, 'ad', true) / b, ap = eff(h, null, 'ap', true) / b; autos[h] = { ad: +ad.toFixed(3), ap: +ap.toFixed(3), on: (ad > 1.15 && ap > 1.15) ? 'both' : ad > 1.15 ? 'Attack' : ap > 1.15 ? 'AP' : 'neither' }; }
  }
  return { prof, grow, skills, autos };
}
if (want(7)) { console.log('== 7. Damage type growth ==');
  const D = dmgType(L), P = D.prof, want7 = { Attack: 'Attack', Magic: 'AP', Healer: 'AP' };
  const sk = Object.entries(D.skills), wrongSk = sk.filter(([k, v]) => want7[P[k.split('.')[0]]] && v.on !== want7[P[k.split('.')[0]]] && v.on !== 'neither');
  const hyb = sk.filter(([k]) => P[k.split('.')[0]] === 'Hybrid');
  console.log('  info profiles: ' + ['Attack', 'Magic', 'Healer', 'Hybrid'].map(p => p + ' ' + HEROES.filter(h => P[h] === p).length).join(', '));
  ok(sk.length > 80 && wrongSk.length <= 3, 'skills: ' + sk.length + ' Green/Blue casts measured; ' + (sk.length - wrongSk.length) + ' move with their hero\'s damage type (Attack heroes on Attack, Magic and Healers on Ability Power)' + (wrongSk.length ? '; not: ' + wrongSk.map(([k, v]) => k + ' on ' + v.on + ' (x' + v.ad + ' with Attack doubled, x' + v.ap + ' with AP doubled)').join(', ') : ''));
  console.log('  info hybrids\' skills (Aureth, Calypsa): ' + hyb.map(([k, v]) => k + ' on ' + v.on).join(', '));
  const au = Object.entries(D.autos), magicAuto = au.filter(([h]) => P[h] === 'Magic' || P[h] === 'Healer'), hybAuto = au.filter(([h]) => P[h] === 'Hybrid');
  ok(hybAuto.length >= 2 && hybAuto.every(([, v]) => v.on === 'both'), 'hybrids\' basic attacks use both (' + hybAuto.map(([h, v]) => h + ' x' + v.ad + ' / x' + v.ap).join(', ') + ')');
  const mOnAtk = magicAuto.filter(([, v]) => v.on === 'Attack');
  console.log('  info Magic/Healer basic attacks measured: ' + magicAuto.length + '; on Attack: ' + mOnAtk.length + ' (e.g. ' + mOnAtk.slice(0, 4).map(([h, v]) => h + ' x' + v.ad + ' Attack / x' + v.ap + ' AP').join(', ') + ')');
  const g = D.grow, atkAP = HEROES.filter(h => P[h] === 'Attack' && g[h][1] > 0), magAtk = HEROES.filter(h => (P[h] === 'Magic' || P[h] === 'Healer') && g[h][0] > 0);
  console.log('  info level 1 -> 100 growth: Attack heroes that also grow Ability Power ' + atkAP.length + '/' + HEROES.filter(h => P[h] === 'Attack').length + ' (e.g. ' + atkAP.slice(0, 3).map(h => h + ' +' + g[h][0] + ' Atk +' + g[h][1] + ' AP').join(', ') + '); Magic/Healer heroes that also grow Attack ' + magAtk.length + '/' + HEROES.filter(h => P[h] === 'Magic' || P[h] === 'Healer').length + ' (e.g. ' + magAtk.slice(0, 3).map(h => h + ' +' + g[h][0] + ' Atk +' + g[h][1] + ' AP').join(', ') + ')');
  const C = dmgType(boot(patchedPage('dtype', [["  const d=h.damageProfile||'Attack'; if(d==='Hybrid')return null; return (d==='Magic'||d==='Healer')?'ap':'ad'; }", "  const d=h.damageProfile||'Attack'; if(d==='Hybrid')return null; return 'ad'; }"]])));
  const cw = Object.entries(C.skills).filter(([k, v]) => want7[C.prof[k.split('.')[0]]] && v.on !== want7[C.prof[k.split('.')[0]]] && v.on !== 'neither');
  ok(cw.length > 10, 'CONTROL: a page where every hero\'s skills read Attack fails the skills check (' + cw.length + ' Magic/Healer skills now on Attack)');
  if (atkAP.length || magAtk.length || mOnAtk.length) { finding(7, 'FAIL', 'skills follow the damage type (' + (sk.length - wrongSk.length) + ' of ' + sk.length + ' casts' + (wrongSk.length ? '; not ' + wrongSk.map(([k, v]) => k + ' (on ' + v.on + ')').join(', ') : '') + ') and hybrids\' basic attacks use both, but (1) level growth is by CLASS, not damage type: ' + atkAP.length + ' Attack heroes grow Ability Power and ' + magAtk.length + ' Magic/Healer heroes grow Attack every level (roleGrow / ROLE_GROWTH, page ~4832-4848; e.g. ' + atkAP.slice(0, 2).concat(magAtk.slice(0, 2)).map(h => h + ' +' + g[h][0] + ' Atk +' + g[h][1] + ' AP').join(', ') + '); (2) ' + mOnAtk.length + ' of ' + magicAuto.length + ' Magic/Healer basic attacks scale on Attack, not Ability Power (think ~18631: non-hybrid autos deal u.dmg). If the line means skills only, the true wording is: "Damage type scaling - Attack heroes\' skills scale on Attack, Magic and Healer heroes\' skills on Ability Power; hybrids\' basic attacks use both (60% + 60%)."'); VERDICT[7] = 'FAIL'; }
  else VERDICT[7] = 'PASS'; }

/* ======================================================================================================================================
   8. Control lengths table - fixed lengths by type, single target or area (e.g. stun 2.45 s / 1.4 s).
      Measured: each of the 61 heroes alone (level 40, every skill level 40, AUTO) against three still, unkillable dummies of the same level
      (so every control lands, Control Resist 0) for 40 s; every control that LANDS on a dummy is read off the dummy (stun, fear, silence,
      slow, sleep, taunt) and compared with the table (CC_SECONDS x CC_NERF 0.70).
   ====================================================================================================================================== */
function ctrlLengths(B) {
  const { J, spec, setup } = B, out = {};
  const table = J('Object.fromEntries(Object.entries(CC_SECONDS).map(([k,v])=>[k,[+(v.single*CC_NERF).toFixed(3),+(v.aoe*CC_NERF).toFixed(3)]]))'), cap = J('CC_DUR_MAX');
  const allowed = { stunned: ['stun', 'root', 'freeze', 'sleep'], fearT: ['fear'], silencedT: ['silence', 'muSilence', 'tauntDur'], slow: ['slow'], _sleepT: ['sleep'], forcedTargetT: ['tauntDur'] };
  const okLen = (f, v) => allowed[f].some(k => table[k].some(T => v >= T - SIM_STEP - 0.003 && v <= T + 0.003)) || (cap[f] && v >= cap[f] - SIM_STEP - 0.003 && v <= cap[f] + 0.003);
  for (const h of HEROES) {
    setup([spec(h, 40, 40)], ['carn', 'vex', 'zahri'].map(k => spec(k, 40)), 3);
    const land = J(`(function(){ const F=['stunned','fearT','silencedT','slow','_sleepT','forcedTargetT']; const foes=units.filter(u=>u.team==='enemy');
      foes.forEach(u=>{ u.speed=0; u.atkCd=1e9; u.greenAb=null; u.blueAb=null; u.energy=0; u.gearSkill=null; u.ctrlRes=0; u.maxHp=1e12; u.hp=1e12; u.pass=null; u.abilityOverride=null; });
      const prev=new Map(foes.map(u=>[u,F.map(f=>+u[f]||0)])), land=[];
      for(let i=0;i<Math.round(40/SIM_STEP);i++){ updateBattle(SIM_STEP); for(const u of foes){ const p=prev.get(u); F.forEach((f,j)=>{ const v=+u[f]||0; if(v>p[j]+1e-6) land.push([f,+v.toFixed(3)]); p[j]=v; }); } if(ended) break; }
      return land; })()`);
    out[h] = { n: land.length, off: [...new Set(land.filter(([f, v]) => !okLen(f, v)).map(([f, v]) => ({ stunned: 'stun', fearT: 'fear', silencedT: 'silence', slow: 'slow', _sleepT: 'sleep', forcedTargetT: 'taunt' })[f] + ' ' + (v + SIM_STEP).toFixed(2)))] };
  }
  return { table, cap, out };
}
if (want(8)) { console.log('== 8. Control lengths table ==');
  const C = ctrlLengths(L), t = C.table;
  ok(Math.abs(t.stun[0] - 2.45) < 1e-9 && Math.abs(t.stun[1] - 1.4) < 1e-9, 'the table: stun ' + t.stun.join(' / ') + ' s (single / area), as the line says');
  console.log('  info table (single / area, s): ' + Object.entries(t).map(([k, v]) => k + ' ' + v.join('/')).join(', ') + '; ceilings ' + JSON.stringify(C.cap));
  const all = Object.entries(C.out), n = all.reduce((s, [, v]) => s + v.n, 0), off = all.filter(([, v]) => v.off.length);
  ok(n > 500, n + ' landed controls read off the dummies (61 heroes)');
  console.log('  info heroes whose every landed control is a table length (or its ceiling): ' + all.filter(([, v]) => v.n && !v.off.length).length + '; heroes with other lengths: ' + off.length);
  console.log('  info other lengths (field and seconds as landed): ' + off.map(([h, v]) => h + ' [' + v.off.join(', ') + ']').join('; '));
  const K = ctrlLengths(boot(patchedPage('cclen', [['  dur=ccDur(dur);   /* v818: every control 30% shorter', '  dur=(+dur||0)*0.80;   /* v818: every control 30% shorter']])));
  const koff = Object.values(K.out).filter(v => v.off.length).length;
  ok(koff > off.length + 15, 'CONTROL: a page whose controls land 20% shorter (not the table 30%) fails the table check on ' + koff + ' heroes (live: ' + off.length + ')');
  finding(8, 'WORDING', 'the table holds for most controls (stun 2.45 / 1.4, root 2.8, freeze 2.1 / 1.05, silence 2.1 / 1.05, slow 2.1, sleep 3.5, the ceilings), but ' + off.length + ' heroes land other lengths: ' + off.map(([h, v]) => h + ' ' + v.off.join('/')).join('; ') + '. Taunts are set from the skill\'s own seconds (page ~15768 forcedTargetT=(o.dur||3), ~16147 tauntDur||2) and a few skills type in their own length. Corrected: "Control lengths table - fixed lengths by type, single target or area (e.g. stun 2.45 s / 1.4 s); taunts and a few hand-set skills use their own lengths."');
  VERDICT[8] = 'WORDING'; }

/* ======================================================================================================================================
   11. Crit, regen, slow caps - talent crit capped at 5%, regen 1.2%/s, slow 40%.
      Measured on the fight unit for every hero and every legal full talent build of tests/talents-power-builds.js (deep / shallow / random per
      tree, splits, even; level 100), in a 20 s fight against three level-100 heroes with the hero held at 50% health:
        crit  = the talents' crit chance on the unit (stat talents, read at the start, + the crit rows the fight applies) - on BOTH build paths:
                the snapshot path every server-built fight uses (campaign, Province, Well, guild raid, Arena: buildUnitFromSnapshot) and the
                device path (makeUnit, the Vault)
        regen = the talents' own per-second healing on the hero (heals made inside TalentFx.tick), per second, of max health
        slow  = the deepest slow the talented hero puts on an enemy, against the same hero with no talents
   ====================================================================================================================================== */
function capsRun(B, heroes) {
  const { R, J, spec, setup } = B, TB = require(path.join(root, 'tests', 'talents-power-builds.js')), T = require(path.join(root, 'talents.js'));
  R(`Error.stackTraceLimit=80; window.__tH=null; (function(){ const h=healUnit; healUnit=function(u,a){ const W=window.__tH; if(W&&u===W.u){ const hp0=u.hp; const r=h.apply(this,arguments); const g=u.hp-hp0;
      const st=g>0?(new Error().stack||''):''; if(st.indexOf('at tick (talents-fx.js')>=0){ const fr=st.split(String.fromCharCode(10)).find(l=>l.indexOf('talents-fx.js')>=0)||'?', id=fr.trim().split(' ')[1]||'?', S=W.src[id]||(W.src[id]={}), k=Math.floor(battleTime); S[k]=(S[k]||0)+g; } return r; } return h.apply(this,arguments); }; })(); 1`);
  const fight = (s, direct) => { setup([s], ['carn', 'vex', 'zahri'].map(k => spec(k, 100, 100)), 5);
    return J(`(function(){ let H=units.find(u=>u.team==='ally'); if(${direct}){ const d=makeUnit(${JSON.stringify(s.key)},'ally',H.x,H.y,100,{spec:${JSON.stringify(s)}}); d.homeX=H.homeX; d.homeY=H.homeY; d.laneX=H.laneX; d.anim=BATTLE_ANIM[d.key]||null; units[units.indexOf(H)]=d; H=d; }
      const c0=H.glyphCrit||0; window.__tH={u:H,src:{}}; let row=0, slow=0;
      for(let i=0;i<Math.round(20/SIM_STEP);i++){ if(H.hp>0.5*H.maxHp) H.hp=0.5*H.maxHp; updateBattle(SIM_STEP); const ap=H._tal&&H._tal.s&&H._tal.s.ap; if(ap&&ap.crit>row) row=ap.crit;
        units.forEach(e=>{ if(e.team==='enemy'&&(e.slow||0)>0) slow=Math.max(slow,1-(e.slowMul==null?1:e.slowMul)); }); if(ended||!H.alive) break; }
      /* regeneration = a talent heal that runs on the tick clock and heals in at least 5 different seconds of the fight (a steady heal); a one-off
         heal from the same clock (a provision eaten, a shed skin) is a burst, reported apart */
      const src=window.__tH.src, reg={}; let burst=0, bsrc=''; for(const id in src){ const secs=Object.keys(src[id]); if(secs.length>=5){ for(const k of secs) reg[k]=(reg[k]||0)+src[id][k]; } else for(const k of secs){ if(src[id][k]>burst){ burst=src[id][k]; bsrc=id; } } }
      const sec=Object.values(reg).map(v=>v/H.maxHp); window.__tH=null; return {c0, row, regen:sec.length?Math.max(...sec):0, burst:burst/H.maxHp, bsrc, slow}; })()`); };
  const rows = [];
  for (const h of heroes) {
    const base = J(`(function(){ CUR={mode:'replay'}; return makeUnit('${h}','ally',0,0,100,{spec:${JSON.stringify(spec(h, 100, 100))}}).glyphCrit; })()`);
    const none = fight(spec(h, 100, 100), false);
    for (const [name, b] of TB.builds(h, 100)) {
      if (T.invalid(h, b, 100)) continue;
      const s = spec(h, 100, 100, { talents: T.learned(h, b) }), a = fight(s, false), d = fight(s, true);
      rows.push({ h, name, snap: +(a.c0 - base + a.row).toFixed(4), dev: +(d.c0 - base + d.row).toFixed(4), regen: a.regen, burst: a.burst, bsrc: a.bsrc, slow: a.slow, slow0: none.slow }); }
  }
  return rows;
}
if (want(11)) { console.log('== 11. Crit, regen, slow caps ==');
  const t0 = Date.now(), rows = capsRun(L, HEROES);
  console.log('  info ' + rows.length + ' legal builds of ' + HEROES.length + ' heroes, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  const top = (k, n) => rows.slice().sort((a, b) => b[k] - a[k]).slice(0, n);
  const devMax = Math.max(...rows.map(r => r.dev)), snapOver = rows.filter(r => r.snap > 0.05 + 1e-9);
  ok(devMax <= 0.05 + 1e-9, 'crit, device-built hero (the Vault): talents add at most ' + (100 * devMax).toFixed(2) + '% crit chance on every build (cap 5%)');
  console.log('  info crit, server-built hero (snapshot path): highest ' + top('snap', 6).map(r => r.h + ' ' + r.name + ' ' + (100 * r.snap).toFixed(1) + '%').join(', ') + '; builds over 5%: ' + snapOver.length + ' (' + [...new Set(snapOver.map(r => r.h))].join(', ') + ')');
  const rgMax = Math.max(...rows.map(r => r.regen));
  console.log('  info regen (talent heals on their own clock, per second): highest ' + top('regen', 6).map(r => r.h + ' ' + r.name + ' ' + (100 * r.regen).toFixed(3) + '%').join(', '));
  console.log('  info one-off talent heals on the same clock (not regeneration): highest ' + top('burst', 4).map(r => r.h + ' ' + r.name + ' ' + (100 * r.burst).toFixed(1) + '% (' + r.bsrc + ')').join(', '));
  const rgBy = {}; rows.forEach(r => { if (r.regen > 0.012 + 0.0002 && !(rgBy[r.h] && rgBy[r.h].regen >= r.regen)) rgBy[r.h] = r; });
  const rgOver = Object.values(rgBy).sort((a, b) => b.regen - a.regen), rgN = rows.filter(r => r.regen > 0.012 + 0.0002).length;
  console.log('  info regen over 1.2%/s: ' + rgN + ' builds of ' + rgOver.length + ' heroes: ' + rgOver.map(r => r.h + ' ' + (100 * r.regen).toFixed(2) + '% (' + r.name + ')').join(', '));
  ok(rows.some(r => r.regen > 0.009), 'regen is really measured: some builds regenerate close to the cap (' + rows.filter(r => r.regen > 0.009).length + ' builds above 0.9%/s)');
  const KIT_MAX = 1 - L.J('slowMulFor(100)'), sl40 = rows.filter(r => r.slow > 0.40 + 1e-6), slKit = rows.filter(r => r.slow > KIT_MAX + 0.002), slBy = {};
  slKit.forEach(r => { if (!(slBy[r.h] && slBy[r.h].slow >= r.slow)) slBy[r.h] = r; }); const sl = Object.values(slBy).sort((a, b) => b.slow - a.slow);
  console.log('  info slow on enemies: ' + sl40.length + ' talented builds slow an enemy by more than 40% (a skill slows 45% at skill level 1, ' + (100 * KIT_MAX).toFixed(2) + '% at 100); past the kit\'s own ' + (100 * KIT_MAX).toFixed(2) + '%: ' + sl.map(r => r.h + ' ' + (100 * r.slow).toFixed(1) + '%').join(', '));
  /* CONTROLS: a patched page whose snapshot carries the talent crit already spent (_talCrit0) is capped on the snapshot path too; and the
     regen check fails at a deliberately wrong cap of 0.9% */
  const ctlHeroes = [...new Set(snapOver.map(r => r.h))].slice(0, 3);
  if (ctlHeroes.length) { const K = capsRun(boot(patchedPage('crit', [['apow:u.apow, apMul:u.apMul, hybrid:!!u.hybrid,', 'apow:u.apow, apMul:u.apMul, hybrid:!!u.hybrid, _talCrit0:u._talCrit0||0,'], ['u.apow=s.apow; u.apMul=s.apMul; u.hybrid=s.hybrid;', 'u.apow=s.apow; u.apMul=s.apMul; u.hybrid=s.hybrid; u._talCrit0=s._talCrit0||0;']])), ctlHeroes);
    ok(Math.max(...K.map(r => r.snap)) <= 0.05 + 1e-9, 'CONTROL (cause): a patched copy whose snapshot keeps the stat talents\' crit (_talCrit0) caps ' + ctlHeroes.join(', ') + ' at ' + (100 * Math.max(...K.map(r => r.snap))).toFixed(1) + '% on the snapshot path too'); }
  ok(!(devMax <= 0.04), 'CONTROL: the crit check fails at a deliberately wrong cap of 4% (device path highest ' + (100 * devMax).toFixed(2) + '%)');
  if (snapOver.length || rgOver.length) { finding(11, 'FAIL', 'crit: the 5% talent cap holds on a device-built hero (Vault; highest ' + (100 * devMax).toFixed(1) + '%) but NOT on a server-built one: ' + snapOver.length + ' legal builds of ' + [...new Set(snapOver.map(r => r.h))].join(', ') + ' reach ' + (100 * Math.max(...snapOver.map(r => r.snap))).toFixed(1) + '% (campaign, Province, Well, guild raid, Arena spawn from snapshots). Cause: TalentFx.applyStats sets u._talCrit0 (talents-fx.js:23), the crit rows cap at 5% minus it (talents-fx.js:22717), but snapUnitResolved / buildUnitFromSnapshot (page ~12930 / ~12967) do not carry _talCrit0, so the rows add a full 5% on top of the stat talents\' 5%. Regen: talent heals on the tick clock that recur (5+ different seconds) go over 1.2% of max HP a second on ' + rgN + ' builds of ' + rgOver.length + ' heroes (' + rgOver.slice(0, 6).map(r => r.h + ' ' + (100 * r.regen).toFixed(1) + '%').join(', ') + '; Tick\'s number includes the heals his own file marks as bursts outside his 1.2% budget), so the 1.2% holds only where a hero file writes the budget (Hobb, Vulmar, Tick, Sloe and others). Slow: "slow 40%" is not a cap on slow strength - a skill slows 45-69.75% by its level before any talent, ' + sl40.length + ' talented builds slow enemies past 40% and talents take ' + sl.map(r => r.h + ' to ' + (100 * r.slow).toFixed(1) + '%').join(', ') + ' (past the kit maximum); the 40% in the hero files caps grouped talent slows or how much a talent weakens slows on the hero. Corrected once crit is fixed: "Crit, regen, slow caps - talent crit chance at most +5% in all; talent regeneration at most 1.2% max HP a second; talents that weaken slows on a hero at most 40%."'); VERDICT[11] = 'FAIL'; }
  else VERDICT[11] = 'PASS'; }

/* ====================================================================================================================================== */
console.log('\n== SUMMARY (lockdown lines) ==');
const NAMES = { 1: 'AUTO toggle', 2: 'Speed x1 / x2', 3: 'Auto-pause', 4: 'Cast time is the wind-up', 5: 'Skill level effects', 6: 'No hidden hits', 7: 'Damage type growth', 8: 'Control lengths table', 9: 'Boss stat boost', 10: 'Connection slow', 11: 'Crit, regen, slow caps', 12: 'Rule cards' };
for (let i = 1; i <= 12; i++) if (VERDICT[i]) console.log('  ' + String(i).padStart(2) + '. ' + NAMES[i].padEnd(26) + VERDICT[i]);
console.log('test_battle_rules_1464: ' + pass + ' checks passed; ' + FIND.length + ' findings (' + FIND.filter(f => f.kind === 'FAIL').length + ' FAIL, ' + FIND.filter(f => f.kind === 'WORDING').length + ' WORDING)');
if (process.env.BR_STRICT && FIND.some(f => f.kind === 'FAIL')) process.exit(1);
