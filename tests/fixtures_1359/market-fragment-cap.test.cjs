const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.argv[2], 'utf8');
const start = source.indexOf("    if(p==='/api/market/frag'){");
const end = source.indexOf("    if(p==='/api/arena/daily-claim'){", start);
assert(start >= 0 && end > start);

function purchase(fragments) {
  const led = { gold: 5000, gems: 100, frags: { vex: fragments }, marketDay: { k: 'day', frags: 0 } };
  const market = { offers: [{ i: 0, hero: 'vex', qty: 2, pay: 'gold' }], bought: [] };
  const result = vm.runInNewContext('(() => {' + source.slice(start, end) + '})()', {
    p: '/api/market/frag', reqId: 'purchase', me: { id: 'fixture' }, res: {},
    b: { heroKey: 'vex', offer: 0 }, ensureLedger: () => led, validHero: () => true,
    heroNotSold: () => false, marketOffersSrv: () => market, nyDayKey: () => 'day',
    durableCommit: (account, _, work) => work(account), creditFrags: (_, l, k, n) => { l.frags[k] = Math.min(9999, l.frags[k] + n); },
    ledTx() {}, writeDB() {}, ledgerView: () => led, send: (_, status, payload) => ({ status, payload }),
  });
  return { result, led, market };
}
const capped = purchase(9998);
assert.equal(capped.result.status, 400);
assert.equal(capped.led.gold, 5000);
assert.equal(capped.led.marketDay.frags, 0);
assert.equal(capped.market.bought.length, 0);
const fits = purchase(9997);
assert.equal(fits.result.status, 200);
assert.equal(fits.led.frags.vex, 9999);
assert.equal(fits.led.gold, 3900);
