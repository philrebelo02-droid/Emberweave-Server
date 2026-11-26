// v1455 lockdown audit 25 Nov 2026 - Campaign (audit/campaign-01.md) and Campaign Bonus Stages (audit/campaign-20-bonus.md) fixes,
// checked without a browser: the page runs headless through server/sim-host.js; the panel code is read from the page source.
//  1. CHANCES n/3 - the server's run count redraws the whole stage panel (the box and the Fight / Sweep buttons), not only the lines below.
//  2. First clear label - the reward pop that covers the result screen says "First clear!".
//  3. Gold ring on selected hero - the hero picked at a firebreak (W.selectedHero) gets the gold feet ring.
//  4. Easy tutorial waves - no preset row / Save on the Bonus 1-3 teaching run (coachBonus13).
// CONTROL: LF_HTML=<the v1454 page> LF_SOFT=1 lists the checks the old code fails. Exit 0 = all passed.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const HTML = process.env.LF_HTML || path.join(root, 'emberweave-heroes.html');
const html = fs.readFileSync(HTML, 'utf8');
const SOFT = !!process.env.LF_SOFT; let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); return; } fail++; console.log('  FAIL ' + m); if (!SOFT) { console.log('test_lockdown_campaign_1455.js: FAILED after ' + pass + ' passed'); process.exit(1); } };
const host = require(path.join(root, 'server', 'sim-host.js')).load(HTML);
const R = s => vm.runInContext(s, host.ctx, { timeout: 60000 });
const J = s => { try { const r = R('JSON.stringify(' + s + ')'); return r === undefined ? null : JSON.parse(r); } catch (e) { return { __err: String(e && e.message || e) }; } };
const fnSrc = name => { const i = html.indexOf('function ' + name + '('); if (i < 0) return ''; const j = html.indexOf('\nfunction ', i + 10); return html.slice(i, j < 0 ? i + 20000 : j); };

console.log('== 1. CHANCES n/3: the server count redraws the whole panel ==');
{ const s = fnSrc('openStageModal');
  ok(/function openStageModal\(i,mode,_srvRedraw\)/.test(s), 'openStageModal takes a redraw flag');
  ok(/if\(ACC\.token&&!_srvRedraw\)\{ api\('\/api\/campaign\/stage/.test(s), 'the redraw does not fetch again (no loop)');
  ok(/window\._smLeft=\{key:_smKey,left:_left\};/.test(s), 'the panel remembers the count it drew the CHANCES box with');
  const cb = s.slice(s.indexOf("api('/api/campaign/stage"), s.indexOf('preloadStageArt(r.stage); }'));
  const iCount = cb.indexOf('sd.n[mode+\':\'+i]=Math.max(0,ELITE_BOSS_DAILY-(r.runsLeft|0))'), iRedraw = cb.indexOf('stageRunsLeft(i,mode)!==window._smLeft.left){ openStageModal(i,mode,true);');
  ok(iCount > 0 && iRedraw > iCount, 'after the server count is taken, a different count reopens the panel (box + buttons) from it');
  ok(/openStageModal\(i,mode,true\); const dr=document\.getElementById\('smFragTarget'\); if\(dr&&window\._smReceipt&&window\._smReceipt\.key===_smKey\) dr\.innerHTML=window\._smReceipt\.html;/.test(cb), 'the sweep receipt survives the redraw (blueprint v1321)');
  // the count the box reads is the one the server answer writes
  const v = J(`(function(){ G.stageDaily=null; const before=stageRunsLeft(10,'normal'); const sd=stageDaily(); sd.n['normal:10']=Math.max(0,ELITE_BOSS_DAILY-(0|0)); return [before, stageRunsLeft(10,'normal')]; })()`);
  ok(Array.isArray(v) && v[0] === 3 && v[1] === 0, 'a server answer runsLeft 0 on boss 1-10 makes the box read 0/3 (phone had ' + (v && v[0]) + ', now ' + (v && v[1]) + ')'); }

console.log('== 2. First clear label on the reward pop ==');
{ const s = fnSrc('stageRewardPop');
  ok(/\$\{opt\.first\?`<div class="srNote srFirst"[^`]*\$\{escapeHTML\(ewT\('result\.first_clear'\)\)\}<\/div>`:''\}/.test(s), 'stageRewardPop draws "First clear!" when opt.first');
  ok(/stageRewardPop\(stageRewardItems\(r\.reward\), ewT\('result\.victory'\), \{stars:[^}]*first:!!r\.reward\.first,/.test(html), 'the campaign win passes the server\'s reward.first to the pop');
  ok(J(`ewT('result.first_clear')`) === 'First clear!', 'the label is the existing translated "First clear!" (no new text)'); }

console.log('== 3. Gold ring on the hero picked at a firebreak ==');
{ const r = J(`(function(){ const keep=GSPLIT.window; try{
      const a={team:'ally',alive:true,_bonusCardId:'b7'}, b={team:'ally',alive:true,_bonusCardId:'b8'}, foe={team:'enemy',alive:true,_bonusCardId:'b7'}, dead={team:'ally',alive:false,_bonusCardId:'b7'};
      GSPLIT.window={phase:'move',selectedHero:'b7'}; const on=[gsplitPickedOnField(a),gsplitPickedOnField(b),gsplitPickedOnField(foe),gsplitPickedOnField(dead)];
      GSPLIT.window={phase:'move',selectedHero:null}; const none=gsplitPickedOnField(a);
      GSPLIT.window={phase:'closed',selectedHero:'b7'}; const closed=gsplitPickedOnField(a);
      GSPLIT.window=null; const nowin=gsplitPickedOnField(a); const c=b._bonusCardId;
      return {on,none,closed,nowin,c}; } finally { GSPLIT.window=keep; } })()`) || {};
  ok(!r.__err && JSON.stringify(r.on) === '[true,false,false,false]', 'only the living ally whose tray card is picked is marked (' + JSON.stringify(r.on || r.__err) + ')');
  ok(r.none === false && r.closed === false && r.nowin === false, 'nothing is marked with no pick, a closed firebreak, or no firebreak');
  ok(/if\(u===selected\|\|\(_bn&&gsplitPickedOnField\(u\)\)\)\{ if\(_bn\)\{/.test(html), 'the overlay draws the v1364 feet ring for that hero');
  ok(/function gsplitPickedOnField\(u\)\{[^\n]*u\._bonusCardId===W\.selectedHero/.test(html) && !/function gsplitPickedOnField\(u\)\{[^\n]*gsplitHeroCardId\(/.test(html), 'display only: it reads the tray id and never assigns one'); }

console.log('== 4. no presets on the Bonus 1-3 teaching run ==');
{ const r = J(`(function(){ const keep=G.bonusPresets; G.bonusPresets=[{picked:['vael'],laneOf:{vael:1},t:1}];
      try{ return { tut:gsplitPresetRow({mode:'place',stageInfo:{coachBonus13:true}}), tutPick:gsplitPresetRow({mode:'pick',stageInfo:{coachBonus13:true}}),
                    after:gsplitPresetRow({mode:'place',stageInfo:{coachBonus13:false}}), other:gsplitPresetRow({mode:'pick',stageInfo:{}}) }; } finally { G.bonusPresets=keep; } })()`) || {};
  ok(r.tut === '' && r.tutPick === '', 'teaching run (coachBonus13 true): no preset row and no Save, on PICK and PLACE (' + String(r.tut || r.__err || '').slice(0, 60) + ')');
  ok(/class="gsplitPresets"/.test(r.after || '') && /gsplitPresetSave/.test(r.after || ''), 'Bonus 1-3 once the lesson is done: the preset row and Save are back');
  ok(/class="gsplitPresets"/.test(r.other || ''), 'every other bonus stage keeps its presets');
  const srv = fs.readFileSync(path.join(root, 'server', 'bonus-stages.js'), 'utf8');
  ok(/coachBonus13:isTutorialBonus\(id\) && !led\.tut\?\.bonus13/.test(srv), 'the server marks the teaching run with coachBonus13 (true only on Bonus 1-3 before the lesson is done)'); }

console.log('test_lockdown_campaign_1455.js: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
