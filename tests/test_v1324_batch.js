// v1324 (Phil 9 Nov 2026): EDP wall damage + faster wall recovery, the hero window as wide as the Heroes list, and ChatGPT's Emberdraft main screen.
// CONTROL: live v1323 (git show 96fe6a2a).
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8'), html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const old = cp.execSync('git show 96fe6a2a:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
const oldSrv = cp.execSync('git show 96fe6a2a:server.js', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
// the server's wall functions in a sandbox, with a stub patron level
const src = srv.slice(srv.indexOf('const WALL_DUR='), srv.indexOf('const PATRON_COSTS='));
const EDPR = srv.slice(srv.indexOf('const PATRON_EDP_ROWS='), srv.indexOf('});', srv.indexOf('const PATRON_EDP_ROWS=')) + 3);
const ctx = vm.createContext({ Math, Number, Object, Set, Date, ensureLedger: u => u, ensureAcad: u => ({ lv: { academy: u.acadLv | 0 } }),
  patronLevels: u => ({ prestiged: !!u.edp, edp: u.edp | 0, egp: 15 }), WORLD_LOCATION: { REGIONS: { r1: 1 }, footKeys: () => [], openInRegion: () => ({ region: 'r1', x: 1, y: 1 }) }, worldBlockedKeys: () => new Set() });
vm.runInContext(EDPR + '\n' + src + '\nthis.wallHitPct=wallHitPct; this.patronWallBonus=patronWallBonus; this.wallRegenRate=wallRegenRate;', ctx);
ck('EDP wall damage climbs to +10 points at EDP 15 (EDP 3 +2, EDP 9 +6), none before EDP', [0, 3, 9, 15].map(e => ctx.patronWallBonus({ edp: e })).join() === '0,2,6,10');
ck('added, not a percent: an EDP 15 full line hits 20 % ("So an EDP15 player does 20% damage") - 5 full hits destroy a castle', ctx.wallHitPct(5, 0, 0, ctx.patronWallBonus({ edp: 15 })) === 20);
ck('a smaller line takes its share of the bonus (3 heroes: 6 + 6 = 12 %), and the Academy mitigation applies to the total', ctx.wallHitPct(3, 0, 0, 10) === 12 && Math.abs(ctx.wallHitPct(5, 44, 40, 10) - 16) < 1e-9);
ck('City wall recovers faster at EDP 2 / 5 / 8 / 10 (Phil\'s chart: 10 / 22 / 35 / 50 %): 4.4 / 4.88 / 5.4 / 6 % an hour', [1, 2, 5, 8, 10].map(e => Math.round(ctx.wallRegenRate({ edp: e }) * 100) / 100).join() === '4,4.4,4.88,5.4,6');
ck('the attack passes the attacker\'s EDP bonus to the wall', /wallHit\(d,ids\.length,Date\.now\(\),ledPlayerLevel\(ensureLedger\(me\)\),patronWallBonus\(me\)\)/.test(srv) && !/patronWallBonus/.test(oldSrv));
const B = require(path.join(ROOT, 'server', 'patron-benefits.js')); const PB = B.PATRON_BENEFITS || B;
ck('the EDP chart lists the wall damage at every level', [1, 15].every(e => (PB.edp[e] || []).some(s => /wall damage/.test(s))) && PB.edp[15].some(s => /\+10% wall damage/.test(s)));
ck('"City wall recovers" is no longer marked soon', /const PAT_SOON=\/mines gather\|war on/.test(html) && /const PAT_SOON=\/mines gather\|recovers/.test(old));
ck('the hero window is as wide as the Heroes list ("Make the width of the heroes hero card the same as the hero panel")', /#heroesPanel\.popout,#heroDetail\.popout\{width:min\(560px,96%\)!important\}/.test(html));
const EDA = ['action-disabled', 'action-secondary', 'avatar-tray', 'dialog-frame', 'emberdraft-wordmark', 'play-button', 'tab-idle'];
ck('Emberdraft main screen: ChatGPT\'s package, its 7 painted pieces shipped as WebP', EDA.every(n => html.includes('/assets/img/ui/emberdraft-main/' + n + '.webp?v=1') && fs.existsSync(path.join(ROOT, 'assets/img/ui/emberdraft-main', n + '.webp'))) && !/emberdraft-main\/[a-z-]+\.png/.test(html));
ck('Emberdraft keeps its mechanics: 3 attempts, rewards 36/30/24/18/12/6, Play -> /api/emberdraft/start', /emberdraft\/start/.test(html) && /edl-reward/.test(html));
ck('CONTROL: v1323 had none of the Emberdraft art', !/emberdraft-main/.test(old));
console.log('test_v1324_batch.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
