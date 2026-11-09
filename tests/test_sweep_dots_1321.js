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
ck('the hero card gets the dot bottom left; each tab with an upgrade gets one in its corner', /heroUpDotSet\(card,u\.skills\|\|u\.glyphs\|\|u\.equip\)/.test(html) && /\$\{_hup\[id\]\?'<span class="hupDot"><\/span>':''\}/.test(html) && /\.hupDot\{position:absolute;left:3px;bottom:3px/.test(html));
ck('CONTROL: v1320 had no upgrade dots', !/hupDot/.test(old));

// campaign top bar (Phil 9 Nov, arrows drawn: "Fix this" / "Center then better" / "Not touching the base/glossary buttons" / "Raise them slightly" / "Make it more pleasing to the eyes, these buttons and ui are all messed up")
ck('food and diamonds are framed pills in the Base / Glossary style (navy gradient, gold border, 34 px, top 4 px)', /#campaign \.campPill\{position:absolute!important;top:4px;height:34px;[^}]*border:1px solid #b8913f;border-radius:9px;background:linear-gradient\(#1f2b48,#0c1326\)/.test(html) && /<div class="campPill" id="campStamF">/.test(html) && /<div class="campPill" id="campGemF">/.test(html));
ck('each is centred in its gap (Base..stars bar, stars bar..Glossary)', /#campaign #campStamF\{left:calc\(25% - 67px\)\}/.test(html) && /#campaign #campGemF\{left:calc\(75% \+ 43px\)\}/.test(html));
ck('Base, Glossary and the stars bar share the same top and height; the chapter title sits under the bar', /#campaign\.active>\.backbtn,#campaign\.active #campGlossBtn\{top:4px!important;height:34px!important/.test(html) && /#campaign\.active #cmapHdr\{top:42px!important/.test(html) && /#campaign\.active #starTrack>div\{border-color:#b8913f!important;border-radius:9px!important;box-sizing:border-box;min-height:34px!important\}/.test(html));
ck('their wrapper makes no layer of its own (they draw over the stars strip, z 9)', /<div id="campRes" style="position:static!important;z-index:auto!important">/.test(html));
ck('on a phone (under 900 px) the pills drop the + and the timer', /@media \(max-width:900px\)\{ #campaign \.campPill \.campPlus,#campaign \.campPill i\{display:none\}/.test(html));

// EGP button (Phil 9 Nov: "The EGP button needs to be bigger, and its own button separate from the commander plate" / "So I can press it")
ck('the EGP button is its own element in the corner HUD, no longer inside the commander plate', !/<div id="profileBtn">[\s\S]*?id="patBadge"[\s\S]*?<div id="hubMenu">/.test(html.slice(html.indexOf('<div id="profileBtn">'), html.indexOf('<div id="hubMenu">')).replace(/<\/div>\s*<button id="patBadge"[\s\S]*$/, '')) && /<\/div>\r?\n    <button id="patBadge" hidden/.test(html));
ck('Commander ring + level badge + EGP live in their own top-left group; MENU alone keeps the top-right corner', /<div id="leftHud">[\s\S]*?<div id="profileBtn">[\s\S]*?<button id="patBadge"[\s\S]*?<\/div>\r?\n    <div id="cornerHud">\r?\n    <div id="hubMenu">/.test(html) && /#leftHud\{position:absolute;left:calc\(0\.5% \+ 43px\);top:2%;/.test(html));
ck('EGP is the same plate as Commander (the same plaque art and font, sized to the Commander plate, right under it)', /#patBadge\{position:absolute;[^}]*border-image:url\(\/assets\/img\/ui\/hud-plaque\.webp\?v=1\) 0 92 fill \/ 0 12px stretch/.test(html) && /pb\.style\.width=Math\.round\(n\.width\/sc\)\+'px'; pb\.style\.height=Math\.round\(n\.height\/sc\)\+'px'; pb\.style\.left=Math\.round\(\(n\.left-h\.left\)\/sc\)\+'px'; pb\.style\.top=Math\.round\(\(n\.bottom-h\.top\)\/sc-7\)\+'px'/.test(html));
ck('the hub mute button docks LEFT of MENU (it used to sit left of the commander ring)', /mbt=document\.getElementById\('hubMenu'\)/.test(html) && /const x=r\.left-MUTE_GAP-8-MUTE_SZ, y=Math\.max\(4,r\.top\+r\.height\/2-MUTE_SZ\/2\);/.test(html));
ck('the base food / gold / diamond bar is centred at the top', /#home #townHud\{left:50%;transform:translateX\(-50%\);flex-wrap:nowrap;justify-content:center\}/.test(html));
ck('CONTROL: v1320 drew it as a 10 px badge inside the commander plate', /<div id="profileBtn">[\s\S]*?<button id="patBadge"/.test(old.slice(old.indexOf('<div id="profileBtn">'), old.indexOf('<div id="hubMenu">'))) && /#patBadge\{position:absolute;[^}]*font:800 10px/.test(old));
console.log('test_sweep_dots_1321.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
