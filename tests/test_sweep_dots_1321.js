// v1321 (Phil 9 Nov 2026): "elite staged that have 3 chances. Allow x3 sweep for it instead of having the x10 sweep there" / "when I sweep
// it doesnt remove from the sweep chance display until I exit the stage and come back, also preventing me from resetting chances is
// unavailable until I exit stage". CONTROL: v1320 (git show 68b0d29b).
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const old = cp.execSync('git show 68b0d29b:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();

ck('Guardian / boss / elite / veteran stages get a Sweep xN button (N = runs left today, capped by stamina)', /id="smSweepN" data-n="\$\{n\}"/.test(html) && /const n=Math\.max\(0,Math\.min\(_left,Math\.floor\(\(G\.stamina\|\|0\)\/Math\.max\(1,stageStamCost\(i,mode\)\)\)\)\)/.test(html));
ck('its label is Sweep xN (x3 when out of runs, disabled)', /t\('stage\.sweep'\)\+' ×'\+\(n>0\?n:ELITE_BOSS_DAILY\)/.test(html));
ck('it sweeps exactly N runs', /swN\.onclick=\(\)=>\{ const n=\+swN\.dataset\.n\|\|0; if\(n>0\) sweepStage\(i,n,mode\); \}/.test(html));
ck('normal stages keep Sweep x10', /cleared&&!_eb\?`<button class="btn secondary" id="smSweep10"/.test(html));
ck('CONTROL: v1320 showed a disabled x10 on these stages and had no xN', !/smSweepN/.test(old));
ck('after a sweep the stage panel is drawn again from the new counts (chances n/3, buttons, EGP reset) before the receipt', /openStageModal\(i,mode\); \}catch\(e\)\{\}\r?\n\s*const tgt=document\.getElementById\('smFragTarget'\);/.test(html));
ck('the receipt survives the panel\'s own stage refresh', /window\._smReceipt=\{key:mode\+':'\+i, html:tgt\.innerHTML\}/.test(html) && /\(window\._smReceipt&&window\._smReceipt\.key===_smKey\)\?window\._smReceipt\.html:stageDropsHTML/.test(html));
ck('closing the panel forgets the receipt (a fresh open shows the drops)', /function closeStageModal\(\)\{ window\.SM_KEY=null; window\._smReceipt=null;/.test(html));
ck('CONTROL: v1320 never redrew the panel after a sweep', !/_smReceipt/.test(old));

// v1321 red dots (Phil 9 Nov: "If they have available upgrades ... the bottom left of their hero card has a little red dot ... a little red dot in the corner of each tab there is an upgrade in")
const vm = require('vm');
const NEW = require(path.join(ROOT, 'server', 'sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
const E = c => vm.runInContext(c, NEW.ctx);
E('G.unlocked=G.unlocked||{}; G.unlocked.vael=true; G.heroXP=G.heroXP||{}; G.playerXP=1e7; G.heroXP.vael=5e6;');
const owned = E('heroOwned("vael")');
E('G.gold=0'); const noGold = E('heroSkillsCanUp("vael")');
E('G.gold=5e6'); const rich = E('heroSkillsCanUp("vael")');
ck('Skills: the dot needs the gold for a skill the hero can still raise (same rule as the skill +)', owned && noGold === false && rich === true, [owned, noGold, rich]);
E('G.heroXP.vael=0'); const lv1 = E('heroSkillsCanUp("vael")');
ck('a level-1 hero (skills already at its level) shows no skills dot even with gold', lv1 === false);
ck('Equipment: the dot follows the slot + that is green (gearCanCraft / owned fresh / gearPlan ok)', /if\(gearCanCraft\(st,d\)\|\|gearOwnedFresh\(st,d\.id\)\|\|gearPlan\(st,d,role\)\.ok\) return true;/.test(html));
ck('Glyphs: all six slotted (Ascend) or the server\'s build-tree canBuild / canBuildAll for the next slot, asked once per glyph revision, two at a time', /if\(sl<0\) return true;/.test(html) && /HUP_GLY\[k\]=!!\(r\.canBuild\|\|r\.canBuildAll\)/.test(html) && /while\(_hupBusy<2&&_hupQ\.length\)/.test(html));
ck('the hero card gets the dot bottom left; each tab with an upgrade gets one in its corner', /heroUpDotSet\(card,u\.skills\|\|u\.glyphs\|\|u\.equip\)/.test(html) && /\$\{_hup\[id\]\?'<span class="hupDot"><\/span>':''\}/.test(html) && /\.hupDot\{position:absolute;left:7px;bottom:7px/.test(html));
ck('CONTROL: v1320 had no upgrade dots', !/hupDot/.test(old));
console.log('test_sweep_dots_1321.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
