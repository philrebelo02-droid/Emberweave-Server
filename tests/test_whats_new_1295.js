// v1295 (Phil 6 Nov: "when someone opens the game after an update it pops up a "whats new" explaining what was just updated. Without ever
// using another games description or any Ai names"). Checks: the popup is wired (town only, once, after the tutorial, behind a result,
// remembers G.whatsNewSeen), its block list stops AI and other-game names but keeps the game's own Ember words, and NO patch note in
// patchnotes.json names an AI or another game. Control: AUD_HTML=<the v1294 html> must FAIL.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(process.env.AUD_HTML || path.join(root, 'emberweave-heroes.html'), 'utf8');
const m = src.match(/const WHATSNEW_BLOCK = (\/.*\/i);/);
const re = m ? eval(m[1]) : null;
const notes = JSON.parse(fs.readFileSync(path.join(root, 'patchnotes.json'), 'utf8')).patches;
const hits = re ? notes.flatMap(p => [p.title || ''].concat(p.items || []).filter(t => re.test(t)).map(t => p.ver + ': ' + t)) : ['no block list'];
const checks = [
  ['the popup is defined and opened from the town', /async function whatsNewMaybe\(\)/.test(src) && /if\(name==='home'\) setTimeout\(whatsNewMaybe,700\);/.test(src)],
  ['once per session, signed in, never during the tutorial, town only', /if\(_whatsNewDone \|\| !\(ACC&&ACC\.token\) \|\| \(G\.tutStarted&&!G\.tutDone\) \|\| state!=='home'\) return;/.test(src)],
  ['it waits behind a battle result and remembers the last patch seen', /queueBehindReward\(show\)/.test(src) && /G\.whatsNewSeen = newest/.test(src)],
  ['the block list stops AI and other-game names', !!re && ['Claude', 'ChatGPT', 'Grok', 'Kimi', 'Vigil', 'Gemini', 'an AI', 'Magic Rush', 'Fractalia', 'Dragon Prayer'].every(w => re.test(w))],
  ['the game\'s own words pass (Ember Roast, Ember Cleave, Ember Gold, Emberweave)', !!re && ['Ember Roast', 'Ember Cleave', 'Ember Gold Patron', 'Emberweave Heroes'].every(w => !re.test(w))],
  ['no patch note names an AI or another game (' + hits.length + ')' + (hits.length ? ': ' + hits.slice(0, 3).join(' | ') : ''), hits.length === 0]];
const bad = checks.filter(c => !c[1]).map(c => c[0]);
if (process.env.AUD_HTML) { console.log('CONTROL: ' + bad.length + ' check(s) failed as expected'); process.exit(bad.length ? 0 : 1); }
if (bad.length) { console.error('FAIL: ' + bad.join('; ')); process.exit(1); }
console.log('test_whats_new_1295.js: ' + checks.length + ' checks passed');
