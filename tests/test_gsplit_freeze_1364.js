// v1364 (tester reports 11 Nov: "Bonus 1-3 freezes instantly at the starting gate", "Retreat in the pause menu does nothing", "Connection slow"):
// (A) gsplitEnd left GSPLIT._finishing set, so the NEXT bonus run never ticked (gsplitStep returns on it) and its Retreat returned at once;
// (B) gsplitEnterBattle kept the last campaign fight's action stream on, so the first tap went to a dead session and gave up with "Connection slow".
// Browser proof: scratchpad gsfreeze/run2.js + camp_then_gs.js (second run moves, Retreat resolves, rejects []). This runs the real function text.
// CONTROL: fails on v1363.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
function fn(src, name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error(name); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { const c = src[k]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } throw new Error('unclosed ' + name); }
function run(src) {
  const out = {}; const banners = []; let resetCalls = 0;
  const ctx = { GSPLIT: { active: true, _finishing: true, _verdictPending: 'won', lanes: [], stage: '1-3', attemptId: 'a' }, banners,
    bannerMsg: s => banners.push(s), ewT: k => k, console };
  // gsplitEnd: run with every helper it may call stubbed
  const endSrc = fn(src, 'gsplitEnd');
  const stubs = new Proxy(ctx, { has: () => true, get: (t, k) => (k in t ? t[k] : (k === Symbol.unscopables ? undefined : function () { return undefined; })) });
  try { vm.runInNewContext('with(S){ (' + endSrc + ')(); }', { S: stubs }); } catch (e) { out.endErr = String(e).slice(0, 120); }
  out.finishingAfterEnd = ctx.GSPLIT._finishing;
  // gsplitRetreat while a result is being confirmed: must say so, not return silently
  ctx.GSPLIT.active = true; ctx.GSPLIT._finishing = true; banners.length = 0;
  try { vm.runInNewContext('with(S){ (' + fn(src, 'gsplitRetreat') + ')(); }', { S: stubs }); } catch (e) { out.retErr = String(e).slice(0, 120); }
  out.retreatSpoke = banners.length > 0;
  out.enterResetsStream = /battleInputsReset\(\)/.test(fn(src, 'gsplitEnterBattle').slice(0, 900));
  return out;
}
const cur = run(fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8'));
const old = run(cp.execSync('git show e68f7437:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString());
ck('a finished run clears _finishing (the next run can tick)', cur.finishingAfterEnd === false, JSON.stringify(cur));
ck('Retreat during result confirmation tells the player, never silent', cur.retreatSpoke === true, JSON.stringify(cur));
ck('entering a bonus run drops the last fight\'s action stream', cur.enterResetsStream === true);
ck('CONTROL: v1363 left _finishing set', old.finishingAfterEnd === true, JSON.stringify(old));
ck('CONTROL: v1363 Retreat was silent', old.retreatSpoke === false);
ck('CONTROL: v1363 kept the stream', old.enterResetsStream === false);
console.log('test_gsplit_freeze_1364.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
