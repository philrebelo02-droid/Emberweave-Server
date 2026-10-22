// 22 Oct 2026 (ChatGPT's overnight server audit, verified and fixed by Claude): /api/tutorial/claim paid a lesson's reward
// without checking the player had done the lesson. POST win15 then gemwish gave 140 diamonds to a fresh account.
// Runs the real route and tables from server.js against in-memory accounts. Usage: node test_tutorial_authority_22oct.js [server.js]
const fs = require('fs'), vm = require('vm'), path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'server.js');
const src = fs.readFileSync(file, 'utf8');
const a = src.indexOf("  if(p==='/api/tutorial/claim' && req.method==='POST')"), b = src.indexOf("  if(p==='/api/hero/xp-potion'", a);
if (a < 0 || b < 0) { console.log('FAIL: tutorial route not found'); process.exit(1); }
const table = src.match(/const TUTORIAL_REWARDS=Object\.freeze\(\{[\s\S]*?\}\);/)[0];
const groups = src.match(/const TUTORIAL_GROUPS=Object\.freeze\(\[[\s\S]*?\]\);/)[0];
const met = (src.match(/function tutorialStepMet\([\s\S]*?\n  return false; \}/) || [''])[0];

function account(led) {
  const me = { id: 'fixture', led: Object.assign({ tut: {}, camp: { cleared: 0 }, quests: { chainStep: 0 }, pool: {}, skill: {}, unlocked: {} }, led.led || {}), glyphs: led.glyphs || { boards: {} } };
  const paid = { gold: 0, gems: 0, stam: 0 };
  const ctx = { p: '/api/tutorial/claim', req: { method: 'POST' }, res: {}, me, body: async r => r.testBody, _saveScope: () => {},
    ensureLedger: u => u.led, send: (res, status, payload) => ({ status, payload }), ledgerView: () => ({}),
    creditGold: (u, l, n) => { paid.gold += n; }, creditGems: (u, l, n) => { paid.gems += n; }, creditStamina: (u, l, n) => { paid.stam += n; },
    creditFrags: () => {}, ledTx: () => {}, writeDB: () => {}, Date, console };
  vm.createContext(ctx);
  vm.runInContext(table + '\n' + groups + '\n' + met + '\nglobalThis.claim=async function(){' + src.slice(a, b) + '};', ctx);
  return { paid, me, claim: async step => { ctx.req.testBody = { step }; return ctx.claim(); } };
}

let fail = 0, n = 0;
function check(ok, what) { n++; if (!ok) { fail++; console.log('FAIL: ' + what); } }
(async () => {
  // 1) the exploit: nothing cleared, no diamond wish, claim the Stage 1-5 lesson
  let t = account({});
  await t.claim('win15'); await t.claim('gemwish');
  check(t.paid.gems === 0, 'fresh account paid ' + t.paid.gems + ' diamonds for win15+gemwish');
  // 2) every paying step refused on a fresh account; signin/name (no card any more) refused too
  for (const s of ['win11', 'skill', 'rune', 'quest14', 'signin', 'name']) {
    t = account({}); const r = await t.claim(s);
    check(r.status === 409 && t.paid.gold + t.paid.gems + t.paid.stam === 0, s + ' paid a fresh account (status ' + r.status + ')');
  }
  // 3) a player who really did the lessons still gets every reward, once
  t = account({ led: { camp: { cleared: 5 }, quests: { chainStep: 3 }, pool: { history: [{}], gemFirstDone: true }, skill: { vex: [2, 1, 1, 1] }, unlocked: { vex: true } },
    glyphs: { boards: { vex: { slots: ['g1', null, null, null, null, null] } } } });
  for (const s of ['win11', 'quest11', 'skill', 'win12', 'quest12', 'rune', 'win13', 'quest13', 'wish', 'win14', 'quest14', 'win15', 'gemwish']) {
    const r = await t.claim(s); check(r.status === 200 && r.payload.ok, s + ' refused for a player who did it (' + r.status + ' ' + JSON.stringify(r.payload.error || '') + ')');
  }
  check(t.paid.gold === 1300 && t.paid.gems === 170, 'real player paid gold ' + t.paid.gold + ' gems ' + t.paid.gems + ' (want 1300 / 170)');
  const again = await t.claim('gemwish');
  check(again.payload.already === true && t.paid.gems === 170, 'repeat claim paid again');
  // 4) an account that claimed signin before keeps the already:true answer
  t = account({ led: { tut: { signin: 1 } } });
  const old = await t.claim('signin'); check(old.status === 200 && old.payload.already === true, 'old signin claim no longer answers already');
  console.log(fail ? 'FAIL ' + fail + ' of ' + n : 'PASS ' + n + ' checks (lesson rewards need the lesson done)');
  process.exit(fail ? 1 : 0);
})();
