// v1451 lockdown audit 25 Nov (Battle Engine > Player controls): three player-facing control bugs.
//  1. Arena auto-pause menu: Restart Stage started a fake fight (one level 1 Grosk, RAID banner, still ARENA LOSS); Quit went to the hub.
//  2. The one-time x2 teaching flash never showed in a campaign fight (buttons drawn before show('battle')).
//  3. AUTO "SWITCHING ON/OFF" was cut off ("AUTO: SWITCHIN") in the 92 px button.
// Static page checks + the page's own functions run in a sandbox. Exit 0 = all passed.
// Control: CF_HTML=<the v1450 page> FAILS. Proven on screen with a headless Chromium run (844x390 and 1280x720) on 25 Nov.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(process.env.CF_HTML || path.join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok   ' + m); };
const grab = name => { const i = html.indexOf('function ' + name + '('); assert(i >= 0, name + ' is defined'); let d = 0, k = html.indexOf('{', i);
  for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}') { d--; if (!d) break; } } return html.slice(i, k + 1); };
const handler = id => { const i = html.indexOf("document.getElementById('" + id + "').onclick="); assert(i >= 0, id + ' handler exists');
  const j = html.indexOf("\ndocument.getElementById('", i + 10); return html.slice(i, j); };

// ---- 1. Pause menu Restart / Quit ----
{ const ctx = { CUR: null }; vm.createContext(ctx); vm.runInContext(grab('pauseCanRestart'), ctx);
  const can = m => { ctx.CUR = { mode: m }; return vm.runInContext('pauseCanRestart()', ctx); };
  for (const m of ['campaign', 'dungeon', 'vault', 'province', 'well']) ok(can(m) === true, 'Restart Stage is offered in ' + m + ' (startBattle re-runs the same stage)');
  for (const m of ['arena', 'replay', 'raid', 'graid', 'elite', 'emberdraft', 'online']) ok(can(m) === false, 'no Restart Stage in ' + m);
  ctx.CUR = null; ok(vm.runInContext('pauseCanRestart()', ctx) === false, 'no Restart Stage with no fight'); }
// every mode that shows the pause button can restart (the button list and the restart list agree)
{ const m = html.match(/getElementById\('pauseBtn'\)\.classList\.toggle\('active', name==='battle' && \(([^)]*)\)\)/); ok(!!m, 'the pause button mode list is found');
  const modes = [...m[1].matchAll(/CUR\.mode==='(\w+)'/g)].map(x => x[1]); const ctx = { CUR: null }; vm.createContext(ctx); vm.runInContext(grab('pauseCanRestart'), ctx);
  ok(modes.length >= 5 && modes.every(md => { ctx.CUR = { mode: md }; return vm.runInContext('pauseCanRestart()', ctx); }), 'every mode with a pause button keeps Restart Stage: ' + modes.join(', ')); }
ok(/#restartBtn\.pmOff\{display:none!important\}/.test(html), 'the hidden Restart is display:none (not just greyed)');
ok(/function pauseMenuSync\(\)\{ const r=document\.getElementById\('restartBtn'\); if\(r\) r\.classList\.toggle\('pmOff',!pauseCanRestart\(\)\); \}/.test(html), 'pauseMenuSync hides Restart where it cannot restart');
ok(/getElementById\('pauseBtn'\)\.onclick=\(\)=>\{ paused=true; pauseSndRender\(\); pauseMenuSync\(\);/.test(html), 'the pause button syncs the menu before opening it');
{ const i = html.indexOf("CUR.mode!=='online' && !(typeof OL!=='undefined'&&OL.active)"); ok(i > 0, 'the auto-pause handler is found');
  const seg = html.slice(i, html.indexOf('streamStall(true)', i)); ok(/pauseMenuSync\(\)/.test(seg) && /CUR\.mode==='arena'/.test(seg), 'leaving the app mid-Arena (auto-pause) syncs the menu too'); }
ok(/getElementById\('restartBtn'\)\.onclick=\(\)=>\{ if\(!pauseCanRestart\(\)\) return;/.test(handler('restartBtn')), 'a Restart that slips through does nothing in Arena (no fake fight)');
{ const q = handler('exitBtn'); const a = q.indexOf("if(CUR&&CUR.mode==='arena'){ clearBattle(); show('arena');");
  ok(a > 0, "Quit mid-Arena lands on the Arena screen");
  ok(a < q.indexOf("show('home')"), 'the Arena branch runs before the hub fallback');
  ok(!/actSend|api\(/.test(q.slice(a, q.indexOf('}', a))), 'Quit sends nothing for Arena - the server keeps the fixed fight open (same opponent + squad = same fight, any other = forfeit)'); }
// the server rule that makes the walk-away safe is still there
{ const srv = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  ok(/old&&now<old\.exp&&old\.oppId===oppId&&JSON\.stringify\(old\.myKeys\|\|\[\]\)===JSON\.stringify\(myKeys\)\) return send\(res,200,arenaPendView\(me,old\)\)/.test(srv), 'server: the same opponent + squad resumes the same fight (no new seed)');
  ok(/if\(old\)\{ const aa=arenaAtt\(led\);[^\n]*aa\.used\+\+; ledTx\(me,'arena:forfeit'/.test(srv), 'server: starting another fight spends the open one as a forfeit'); }

// ---- 2. x2 teaching flash ----
{ const i = html.indexOf('function _startBattleNow('); const body = html.slice(i, html.indexOf('\nfunction ', i + 10));
  const sb = body.indexOf("show('battle');"); ok(sb > 0, '_startBattleNow shows the battle screen');
  ok(/try\{ refreshCtrlBtns\(\); \}catch\(e\)\{\}/.test(body.slice(sb)), 'the control buttons are drawn again AFTER show(\'battle\') (state is battle, so the flash can show)'); }
ok(/\(!_spLock&&!G\.spdTaught&&state==='battle'\)\?' tut-next-glow'/.test(html) && /if\(!G\.spdTaught\)\{ G\.spdTaught=1;/.test(html), 'the flash stays a one-time lesson: on until the first speed tap, never after');
{ // refreshCtrlBtns in a sandbox: state battle + x2 open + not taught = glow; taught = no glow; x2 locked = no glow
  const mk = () => { const el = () => ({ innerHTML: '', className: '', style: {}, disabled: false, title: '' }); const E = { speedBtn: el(), autoBtn: el(), skipBtn: el(), leaveBtn: el() };
    return { E, document: { getElementById: id => E[id] || null }, uiIcon: () => '', hudIcon: () => '', t: k => k, gameSpeed: 1, autoUlt: false, autoPendingTarget: null, CUR: { mode: 'campaign' }, GSPLIT: { active: false }, state: 'battle', G: { campaignCleared: 3 }, patEgp1: () => false, playerLevel: () => 1 }; };
  const src = ['spd2Open', 'autoOpen', 'spdChoices', 'isAutoBattle', 'autoSwLabel', 'refreshCtrlBtns'].map(grab).join('\n');
  const run = c => { vm.createContext(c); vm.runInContext(src + '\nrefreshCtrlBtns();', c); return c.E; };
  let c = mk(); ok(/tut-next-glow/.test(run(c).speedBtn.className), 'campaign fight, x2 just unlocked, never tapped: the speed button flashes');
  c = mk(); c.state = 'menu'; ok(!/tut-next-glow/.test(run(c).speedBtn.className), '(why it never showed) drawn while state is not battle: no flash');
  c = mk(); c.G.spdTaught = 1; ok(!/tut-next-glow/.test(run(c).speedBtn.className), 'after the first tap: no flash again');
  c = mk(); c.G.campaignCleared = 0; ok(!/tut-next-glow/.test(run(c).speedBtn.className), 'x2 still locked: no flash');
  // ---- 3. AUTO switching label (same sandbox) ----
  c = mk(); c.autoPendingTarget = true; c.t = k => ({ 'bhud.auto_sw_on': 'AUTO: SWITCHING ON…' })[k] || k; let E = run(c);
  ok(E.autoBtn.innerHTML === 'AUTO:<br>SWITCHING ON…' && /pending/.test(E.autoBtn.className), 'SWITCHING ON reads on two lines: AUTO: / SWITCHING ON…');
  c = mk(); c.autoPendingTarget = false; c.autoUlt = true; c.t = k => ({ 'bhud.auto_sw_off': 'AUTO: SWITCHING OFF…' })[k] || k; E = run(c);
  ok(E.autoBtn.innerHTML === 'AUTO:<br>SWITCHING OFF…', 'SWITCHING OFF reads on two lines: AUTO: / SWITCHING OFF…');
  c = mk(); c.autoUlt = true; c.G.campaignCleared = 3; c.patEgp1 = () => true; c.t = k => ({ 'bhud.auto_on': 'AUTO: ON' })[k] || k; E = run(c);
  ok(E.autoBtn.innerHTML === 'AUTO: ON', 'the applied states are unchanged (one line)'); }
{ const ctx = {}; vm.createContext(ctx); vm.runInContext(grab('autoSwLabel'), ctx);
  const langs = ['en', 'de', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'nl', 'pt-BR', 'ru', 'th', 'tr', 'zh-Hans', 'zh-Hant'];
  for (const l of langs) { const J = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'lang', l + '.json'), 'utf8'));
    for (const k of ['bhud.auto_sw_on', 'bhud.auto_sw_off']) { ctx.s = J[k]; const out = vm.runInContext('autoSwLabel(s)', ctx); const parts = out.split('<br>');
      ok(parts.length === 2 && parts[0].length && parts[1].length && /[:：]$/.test(parts[0]) && (parts[0] + parts[1]).replace(/\s+/g, '') === J[k].replace(/\s+/g, ''), l + ' ' + k + ' splits after the colon: "' + parts.join(' / ') + '"'); } } }
ok(/#battleCtrls\{[^}]*align-items:flex-end;/.test(html), 'the control column is right-aligned, so a wider SWITCHING button grows to the left and the others stay put');
ok(/\.ctrlBtn\.pending\{[^}]*width:auto;min-width:92px;line-height:1\.15;\}/.test(html) && /\.ctrlBtn\{[^}]*white-space:nowrap;/.test(html), 'the SWITCHING button sizes to its two lines (never narrower than the 92 px buttons, never wraps further)');
console.log('test_controls_fix_1451.js: ' + pass + ' checks passed');
