// A signed-in quest is paid by /api/quest/claim, never a second local earn.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const _EN=JSON.parse(fs.readFileSync(path.join(__dirname,'..','lang','en.json'),'utf8')), _t=(k,v)=>(_EN[k]==null?k:_EN[k]).replace(/\{(\w+)\}/g,(m,x)=>v&&v[x]!=null?String(v[x]):''), LANG={t:_t,ewT:_t,langMsg:s=>s,langDesc:s=>s,langMeta:s=>s};   // v1271 LANGUAGES step 2: the page's English t()/ewT() from lang/en.json
const html = fs.readFileSync(require('path').join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
const start = html.indexOf('function claimQuest(q)');
const end = html.indexOf('/* 30 Aug', start);
assert(start >= 0 && end > start, 'claimQuest source found');
const calls = { claim: 0, capture: 0, adopt: 0, messages: [] };
const ctx = { ...require('./helpers/page-icons.js')(html), ...LANG,
  G: { questClaimed: {} }, ACC: { token: 'test' }, uid8: () => 'req-1',
  api: async () => ({ ok: true, ledger: { gems: 20 } }),
  apiOnce: async () => ({ ok: true, ledger: { gems: 20 } }),   // v989: claimQuest goes through apiOnce (one in flight, one requestId)
  ledgerSync: () => {},
  ledCapture: () => { calls.capture++; throw new Error('signed-in claim must not run ledCapture'); },
  adoptLedger: () => { calls.adopt++; },
  saveG: () => {}, updateHubChrome: () => {}, updateMailBadges: () => {},
  bannerMsg: msg => calls.messages.push(msg), showQuestClaim: msg => calls.messages.push(msg),   // v1366 (tester B 2.7): the claim message shows in the quest screen's own notice line renderQuests: () => {}, tutReturnAfterAction: () => {},
};
vm.runInNewContext(html.slice(start, end), ctx);
ctx.claimQuest({ id: 'q_name', ready: true, title: 'Make a Name', reward: '💎 20 diamonds', claim: () => { calls.claim++; } });
setTimeout(() => {
  assert.strictEqual(calls.claim, 0, 'client reward closure did not mint a second payment');
  assert.strictEqual(calls.capture, 0, 'no generic earn was submitted');
  assert.strictEqual(calls.adopt, 1, 'server ledger was adopted once');
  assert.strictEqual(ctx.G.questClaimed.q_name, true);
  assert(calls.messages[0].includes('20 diamonds'));
  console.log('wallet quest claim: pass');
}, 20);
