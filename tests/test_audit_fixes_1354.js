// v1354 (Phil 10 Nov 2026: "fix the 4 bugs chatgpt found and push"): ChatGPT's building audit (Open Projects/BUILDING AUDIT 10NOV2026/ChatGPT).
// F1 Forge temper queue per item, V1 Vault start validates before replacing the attempt, A1 signed-in research is finished by the server
// (timers kept), A2 Academy income carries fractional units across a level-up. CONTROL: v1353 (git show 1fddcd8e).
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8'), srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const oh = cp.execSync('git show 1fddcd8e:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString(), os_ = cp.execSync('git show 1fddcd8e:server.js', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
// ---- F1: run the real two functions with a deferred transport: A x1 in flight, A x10 queued, then B x1 before the reply
function forgeRun(src) { const a = src.indexOf('function forgeTemper(itemId,uses)'), b = src.indexOf('const FORGE_QCOLOR=', a); const code = src.slice(a, b);
  const sent = [], waits = []; const ctx = { FORGE: { st: { revision: 1, items: { A: { temper: 0 }, B: { temper: 0 } } } }, bannerMsg() {}, iconize: s => s, t: s => s, renderForge() {}, forgeSync: () => Promise.resolve(), setTimeout: () => 0, clearTimeout() {}, Date, Math, Object, Promise,
    api: (u, m, body) => { sent.push(body.itemId + ':' + body.uses); return new Promise(r => waits.push(() => r({ revision: 2, gearId: 'g', temper: body.itemId === 'A' ? 7 : 3, prog: 0, dustSpent: 1, uses: body.uses }))); } };
  vm.runInNewContext(code, ctx); return { ctx, sent, waits }; }
(async () => {
  for (const [name, src, want] of [['v1354', html, 'A:1,A:10,B:1'], ['v1353 CONTROL', oh, 'A:1,B:11']]) {
    const R = forgeRun(src); R.ctx.forgeTemper('A', 1); R.ctx.forgeTemper('A', 10); R.ctx.forgeTemper('B', 1);
    for (let i = 0; i < 6; i++) { await new Promise(r => setImmediate(r)); const w = R.waits.shift(); if (w) w(); await new Promise(r => setImmediate(r)); }
    ck('F1 ' + name + ': requests sent = ' + want, R.sent.join() === want, R.sent);
    if (name === 'v1354') ck('F1: each reply updates its own item (A 7, B 3)', R.ctx.FORGE.st.items.A.temper === 7 && R.ctx.FORGE.st.items.B.temper === 3, R.ctx.FORGE.st.items); }
  // ---- V1: the old attempt is only replaced after the team is validated
  const blk = s => { const i = s.indexOf("if(p==='/api/dungeon/start-battle'){"); return s.slice(i, s.indexOf('return send(res,200,{ ok:true, attemptId:attempt.id', i)); };
  ck('V1: no early clear of the active attempt before validation', !/if\(prog\.activeAttempt\) prog\.activeAttempt=null;/.test(blk(srv)) && /prog\.activeAttempt=attempt;/.test(blk(srv)));
  ck('V1 CONTROL: v1353 cleared it first', /if\(prog\.activeAttempt\) prog\.activeAttempt=null;/.test(blk(os_)));
  // ---- A1: signed in, the server finishes research and its timers are adopted
  ck('A1: collect adopts the server levels AND timers', /G\.tech=Object\.assign\(\{\},G\.tech,r\.lv\); G\.techLearn=Object\.assign\(\{\},r\.learn\|\|\{\}\);/.test(html));
  ck('A1: a signed-in pending timer keeps research busy', /function learnBusy\(\)\{ for\(const k in G\.techLearn\)\{ if\(G\.techLearn\[k\]&&\(ACC\.token\|\|G\.techLearn\[k\]>Date\.now\(\)\)\) return k; \} return null; \}/.test(html));
  ck('A1 CONTROL: v1353 dropped the server timers', !/G\.techLearn=Object\.assign\(\{\},r\.learn\|\|\{\}\)/.test(oh));
  // ---- A2: fractional units carry across the Academy level-up
  ck('A2: acadIncome carries fractional units (incCarry)', /A\.incCarry=raw-units; A\.incAt=until; return true;/.test(srv) && /A\.incCarry=\(\+A\.incCarry\|\|0\)\+ACADEMY_ECON\.ratePerHour/.test(srv));
  ck('A2 CONTROL: v1353 had no carry', !/incCarry/.test(os_));
  console.log('test_audit_fixes_1354.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
})();
