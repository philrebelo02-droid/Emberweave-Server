// v1355 (Phil 10 Nov 2026: "fix what chatgpt found in round 2 and push" / "also scan yourself behind him to find anything he missed").
// ChatGPT audit round 2 (10 client fixes) + Claude's review behind him (3). CONTROL: v1354 (git show 1089108e).
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8'), sp = fs.readFileSync(path.join(ROOT, 'survivors-dev.html'), 'utf8');
const old = cp.execSync('git show 1089108e:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString(), osp = cp.execSync('git show 1089108e:survivors-dev.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
const both = (name, re) => { ck(name, re.test(html)); ck('CONTROL v1354: ' + name + ' was missing', !re.test(old)); };
(async () => {
  // behaviour: arenaSync with an error reply must report false (and true when a reply is adopted)
  const run = async (src, reply) => { const a = src.indexOf('async function arenaSync(){'), b2 = src.indexOf('async function arenaSyncLadder(){', a); const ctx = { ACC: { token: 't' }, ARENA: {}, G: {}, HERO_TYPES: {}, saveG() {}, _arenaTeamPow: () => 0, api: async () => reply };
    vm.runInNewContext(src.slice(a, b2) + '\nthis.go=arenaSync;', ctx); return ctx.go(); };
  ck('Arena: arenaSync is false on an error reply', (await run(html, { error: 'offline' })) === false);
  ck('Arena: arenaSync is true when a reply is adopted', (await run(html, { rank: 5, opponents: [] })) === true);
  ck('CONTROL v1354: arenaSync said true on an error reply', (await run(old, { error: 'offline' })) === true);
  // behaviour: skyStatus keeps a transport failure retryable
  const sky = async (src, reply) => { const a = src.indexOf('async function skyStatus(){'); const ctx = { SKY: { st: null }, api: async () => reply }; vm.runInNewContext(src.slice(a, src.indexOf('\n', a)) + '\nthis.go=skyStatus;', ctx); await ctx.go(); return ctx.SKY.st; };
  ck('Skyfall: a failed status fetch stays retryable (SKY.st null)', (await sky(html, { error: 'offline' })) === null);
  ck('Skyfall: a real "disabled" reply is still cached', JSON.stringify(await sky(html, { enabled: false })) === '{"enabled":false}');
  ck('CONTROL v1354: the failure was cached as disabled', JSON.stringify(await sky(old, { error: 'offline' })) === '{"enabled":false}');
  both('Arena Top Pick: a late vote reply does not reopen a closed pop-out', /if\(!ov\.isConnected\|\|!ov\.contains\(btn\)\) return;/);
  both('Arena daily: "already claimed" clears the stale Claim button', /already claimed\/i\.test\(String\(r\.error\|\|''\)\)\)\{ G\.arenaDailyDay=arenaDayKey\(\);/);
  both('Watch Tower: an error reply shows "unavailable"', /const reportsAvailable=Array\.isArray\(reported\?\.mates\)&&!reported\.error;/);
  ck('Watch Tower: both tabs use it', (html.match(/if\(!reportsAvailable\)html\+=empty\(t\('watch\.unavailable'\)\);/g) || []).length === 2);
  both('Training Province: a reply after sign-out is dropped', /const _tk=ACC\.token; try\{ const r=await api\('\/api\/province\/state'\); if\(ACC\.token!==_tk\) return null;/);
  both('Emberdraft: Solo stays off without an attempts view', /solo\.disabled=!\(d&&d\.edraft\);/);
  both('Guild raid: a new boss under the poll re-renders', /if\(q\.level!==r\.level\|\|q\.name!==r\.name\|\|q\.bossKey!==r\.bossKey\)\{ clearInterval\(window\._raidPoll\); window\._raidPoll=null; renderGuild\(\); return; \}/);
  both('Starless Well: a stale open never paints', /if\(document\.getElementById\('wlMap'\)!==ov\) return;/);
  both('Academy: collect backs off (no post every second)', /Date\.now\(\)<\(collectLearns\.nextAt\|\|0\)/);
  both('Temple Multi pray: the button locks while a run is in flight', /const _go=q\('#tp2AutoGo'\); if\(_go\.disabled\) return; _go\.disabled=true;/);
  ck('Temple Multi pray: a busy reply no longer closes the dialog', !/count:a\.n\}\); if\(!r\)\{ templeAuto=null; return; \}/.test(html) && /count:a\.n\}\); if\(!r\)\{ templeAuto=null; return; \}/.test(old));
  both('Vault: the status is re-read after the daily sweep reset', /Date\.now\(\)>=VAULT\.st\.sweep\.nextResetAt\) VAULT\.st=null;/);
  ck('Swarm Spire: quit only closes after the saved run is deleted', /st\.delete\('run'\)\)\.then\(\(\) => toGame\('survivors-close'\), \(\) => \{ leaving = false;/.test(sp) && !/st\.delete\('run'\)\)\.then\(\(\) => toGame\('survivors-close'\), \(\) =>/.test(osp));
  console.log('test_audit_round2_1355.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
})();
