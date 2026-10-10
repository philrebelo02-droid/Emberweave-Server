// v1101 (Phil 9 Oct, screenshot "The Forge is being built"): one failed request cached "Forge off" until the next account change.
// Runs the page's own forgeSync with a stubbed api(): a failure is OFFLINE (Retry), only the server's enabled:false is "being built".
const fs = require('fs'), path = require('path'), vm = require('vm');
const page = fs.readFileSync(path.join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const i = page.indexOf('async function forgeSync(){'), j = page.indexOf('function forgeDef(', i);
ok(i > 0 && j > i, 'forgeSync found');
const src = page.slice(i, j);
async function run(responses) {
  const ctx = { FORGE: { cat: null, src: null, st: null }, api: async (p) => responses[p] };
  vm.runInNewContext(src + '\nthis.forgeSync=forgeSync;', ctx); await ctx.forgeSync(); return ctx.FORGE.st;
}
(async () => {
  const cat = { items: [{ id: 'x' }] };
  const a = await run({ '/api/gear/catalog': null, '/api/gear/sources': null, '/api/gear/state': null });
  ok(a && a.offline === true && a.enabled === false, 'a failed load is offline (Retry), not "being built"');
  const b = await run({ '/api/gear/catalog': cat, '/api/gear/sources': null, '/api/gear/state': { enabled: false } });
  ok(b && b.enabled === false && !b.offline, 'control: the server saying enabled:false is the real "being built"');
  const c = await run({ '/api/gear/catalog': cat, '/api/gear/sources': null, '/api/gear/state': { enabled: true, dust: 5 } });
  ok(c && c.enabled === true && c.dust === 5, 'a normal load opens the Forge');
  const d = await run({ '/api/gear/catalog': null, '/api/gear/sources': null, '/api/gear/state': { enabled: true } });
  ok(d && d.offline === true, 'state loaded but the catalog failed: offline too (Retry)');
  ok(/if\(FORGE\.st\.offline\)\{[^\n]*Could not reach the Forge[^\n]*forgeRetry/.test(page) && /rt\.onclick=\(\)=>\{ FORGE\.st=null; renderForge\(\); \}/.test(page), 'the offline screen has a Retry that loads again');
  ok(page.indexOf('⚒') < 0, 'no anvil emoji left on the page');
  console.log('test_forge_retry_1101.js: ' + pass + ' checks passed' + (fail ? ', ' + fail + ' FAILED' : ''));
  process.exit(fail ? 1 : 0);
})();
