// v1320 (Phil 9 Nov 2026): "Can you please make stamina and diamonds visible on campaign screen somewhere also after a stage is done, show
// the rewards just like wishing pool, 1 items at a time domino effect style in a nice pop out screen" / "It should be the actual fragments art"
// / "The prompt in the back of the glyph screen should be infront so you can see". CONTROL: live v1319 (git show 492a2676).
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const old = cp.execSync('git show 492a2676:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
const NEW = require(path.join(ROOT, 'server', 'sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
const R = c => JSON.parse(vm.runInContext(c, NEW.ctx));
// the glyph catalog the server sends (GET /api/glyphs/catalog slotFamilies, as the live client receives it) - the sim host loads none
vm.runInContext('RUNE2.cat={slotFamilies:{vitality:["Stoneheart","Worldheart","Gateheart"],bulwark:["Ironwall","Veilward","Bastion","Dawnshield","Ironoath"]}}', NEW.ctx);

ck('the campaign screen has the food (stamina) and diamond chips, with their + buttons', /<div id="campRes"[^>]*>.*id="campStam".*id="campStamPlus".*id="campGems".*id="campGemPlus"/s.test(html));
ck('updateHubChrome keeps them current (stamina n/max + timer, diamonds)', /set\('campStam',G\.stamina\+'\/'\+mx\); set\('campGems',G\.gems\)/.test(html));
ck('the + buttons open the same shops as the base HUD', /campStamPlus'\)\.onclick=.*openHudShop\('food'\)/.test(html) && /campGemPlus'\)\.onclick=.*openHudShop\('gem'\)/.test(html));
ck('CONTROL: v1319 had no chips on the campaign screen', !/id="campRes"/.test(old));

const rw = { glyphFragments: [{ key: 'Grey Veilward', displayName: 'Rough Silk Fragment', quantity: 1 }, { key: 'Grey Stoneheart', displayName: 'Rough Gravel Fragment', quantity: 2 }],
  eliteFrag: { heroKey: 'tick', qty: 1 }, xpPotions: { minor: 1 }, gold: 130, playerXp: 6, gems: 5 };
const items = R(`JSON.stringify(stageRewardItems(${JSON.stringify(rw)}).map(x=>({n:x.name,q:x.qty,a:x.art})))`);
ck('one card per reward: 2 fragments, the hero fragment, the potion, diamonds, gold, XP', items.length === 7 && items.map(x => x.n).join('|') === 'Rough Silk Fragment|Rough Gravel Fragment|Tick Fragment|Minor XP Potion|Diamonds|Gold|Player XP', items.map(x => x.n));
ck('each glyph fragment shows its OWN art (quality + glyph slot), not a generic icon', /glyphs-v2\/Grey\/fragment-bulwark\.png/.test(items[0].a) && /glyphs-v2\/Grey\/fragment-vitality\.png/.test(items[1].a), [items[0].a.slice(0, 90), items[1].a.slice(0, 90)]);
ck('quantities come from the receipt', items[1].q === 2 && items[5].q === 130 && items[6].q === 6);
ck('a sweep receipt (px, no playerXp) reads the same way', R(`JSON.stringify(stageRewardItems({gold:10,px:4}).map(x=>x.qty))`).join(',') === '10,4');
ck('the pop-out deals the cards one after another (domino) and Collect closes it', /forEach\(\(c,i\)=>setTimeout\(\(\)=>c\.classList\.add\('on'\),260\+i\*180\)\)/.test(html) && /ov\.querySelector\('\.srGo'\)\.onclick=\(\)=>ov\.remove\(\)/.test(html));
ck('a won campaign fight opens it over the result screen', /show\('result'\);\r?\n\s*if\(sWon && r && r\.reward\) try\{ stageRewardPop\(stageRewardItems\(r\.reward\), ewT\('result\.victory'\)\); \}catch\(e\)\{\}/.test(html));
ck('a sweep opens it too', /stageRewardPop\(stageRewardItems\(r\), t\('stage\.swept',\{n:r\.times\}\)\)/.test(html));
ck('CONTROL: v1319 had no reward pop-out', !/function stageRewardPop/.test(old));

const z = s => +((s.match(/#banner\{[^}]*z-index:(\d+)/) || [])[1] || 0);
const pop = +((html.match(/\.screen\.popout\{[^}]*z-index:(\d+)/) || [])[1] || 9000), back = +((html.match(/#popoutBackdrop\{[^}]*z-index:(\d+)/) || [])[1] || 0);
ck('the banner (e.g. "Gust Glyph locked into the board!") draws in front of the hero pop-out and its backdrop', z(html) > Math.max(pop, back, 9200), [z(html), pop, back]);
ck('the reward pop-out stays in front of the banner', z(html) < 9800);
ck('CONTROL: v1319 drew the banner behind the pop-out (z-index 75)', z(old) === 75);
console.log('test_campaign_rewards_1320.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
