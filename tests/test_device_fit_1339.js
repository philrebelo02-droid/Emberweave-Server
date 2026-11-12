// v1339 (Phil 10 Nov: "all art and ui needs to fit their device" / "Not 3 chances a day")
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const fv = fs.readFileSync(path.join(ROOT, 'assets/ui/fold-viewport.js'), 'utf8'), html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
// the swaps themselves, run as written
const mediaSwap = eval(fv.match(/const mediaSwap=(t=>[^;]+);/)[1]), unitSwap = eval(fv.match(/const unitSwap=(t=>[^;]+);/)[1]);
assert.strictEqual(mediaSwap('(max-height: 560px) and (min-width: 701px)'), '(max-width: 560px) and (min-height: 701px)');
assert.strictEqual(mediaSwap('(orientation: landscape)'), 'orientation:portrait)'.replace(/^/, '(').replace('((', '('));
assert.strictEqual(unitSwap('height: 100dvh; width: 3.5vw; min-height: 50vh;'), 'height: 100dvw; width: 3.5vh; min-height: 50vw;');
assert.strictEqual(mediaSwap('(prefers-reduced-motion: reduce)'), '(prefers-reduced-motion: reduce)');
assert(/layoutW\/layoutH<1;/.test(fv), 'an upright Fold (0.83) must turn');
assert(/flipMedia\(rotate\);/.test(fv), 'fit() must apply the swap');
assert(+((html.match(/fold-viewport\.js\?v=(\d+)/)||[])[1]||0)>=1339, 'new script version');   // v1374 bumped it again (shade hold)
function arenaProblems(h) { const o = []; if (/arenaRefreshLeft\(\)\}\/\$\{ARENA_FREE_REFRESH\}/.test(h)) o.push('refresh counter shown'); if (!/function useArenaRefresh\(\)\{ genArenaOpps\(\); saveG\(\); return true; \}/.test(h)) o.push('refresh still limited'); return o; }
assert.deepStrictEqual(arenaProblems(html), []);
// CONTROL: the old limited refresh must be caught
const bad = html.replace(/function useArenaRefresh\(\)\{ genArenaOpps\(\); saveG\(\); return true; \}/, 'function useArenaRefresh(){ if((G.arenaRefreshUsed||0)>=ARENA_FREE_REFRESH) return false; genArenaOpps(); saveG(); return true; }');
assert(bad !== html && arenaProblems(bad).length === 1, 'CONTROL failed');
console.log('PASS device fit 1339');
