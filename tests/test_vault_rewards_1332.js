// v1332 (Phil 10 Nov): reward popup art, reward item row, Vault on one phone screen, Offline Art plan. EW_ROOT points this at another tree for a control run.
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = process.env.EW_ROOT || path.join(__dirname, '..');
const c = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8');
assert(/#stageRewPop \.srCard\{[^}]*bonus\/panel-frame\.webp/.test(c), 'the reward popup uses the Bonus Stage frame');
assert(/#stageRewPop \.srGo\{[^}]*bonus\/claim-button\.webp/.test(c), 'the reward popup uses the Bonus Stage button');
assert(c.includes('<div class="rpTiles">'), 'floor rewards are a row of item tiles');
assert(c.includes('class="panel vtPick"') && c.includes('#dungeon .vtFoot{display:none}'), 'the Vault has its one-screen phone layout');
assert(!c.includes("uiIcon('recycle')} ${t('vault.salvage')}"), 'the Salvage button has no icon');
assert(c.includes('hud-lock.webp?v=2" alt="locked"'), 'the World Tree lock carries its version');
assert(/cache\.match\(u,\{ignoreVary:true\}\)/.test(c) && c.includes("'offart-plan'+(tag||'')"), 'Offline Art asks the cache before calling a file missing, and reports it');
assert(/const HERO_GEAR=Object\.freeze\(\{/.test(c) && c.includes("return 'hero:'+key"), 'each hero has its own nine-item loadout');
assert(c.includes('#forge .fgRow .fgName{display:none!important}'), 'the Forge rows have no item names');
console.log('PASS vault rewards 1332');
