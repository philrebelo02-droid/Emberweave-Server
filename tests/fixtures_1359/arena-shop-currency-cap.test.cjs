const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(process.argv[2], 'utf8');
const start = src.indexOf("  if(p==='/api/arena/shop'");
const end = src.indexOf("  if(p==='/api/shop/buy'", start);
assert(start >= 0 && end > start);
const run = (field, balance) => {
  const ledger = {gold:0,gems:0,[field]:balance};
  const account = {id:'fixture',coins:100,arenaShopDay:{k:'today'}};
  const credit = (_, led, n) => {
    const added = Math.min(n, 100-led[field]);
    led[field] += added;
    return added;
  };
  const dispatch = vm.runInNewContext('(async () => {' + src.slice(start,end) + '})', {
    p:'/api/arena/shop',req:{method:'POST'},res:{},me:account,
    body:async () => ({requestId:'purchase',item:'offer'}),ensureLedger:() => ledger,
    ARENA_SHOP_SRV:{offer:{cost:30,day:2,[field]:10}},ledPlayerLevel:() => 10,nyDayKey:() => 'today',
    ECON_CAP:{gold:100,gems:100},creditGold:credit,creditGems:credit,
    durableCommit:(u,_,work) => work(u),ledTx(){},writeDB(){},ledgerView:() => ledger,
    send:(_,status,payload) => ({status,payload}),
  });
  return dispatch().then(result => ({result,ledger,account}));
};
(async () => {
  for (const field of ['gold','gems']) {
    const capped = await run(field, 91);
    assert.equal(capped.result.status, 400);
    assert.equal(capped.account.coins, 100);
    assert.equal(capped.account.arenaShopDay.offer, undefined);
    assert.equal(capped.ledger[field], 91);
    const fits = await run(field, 90);
    assert.equal(fits.result.status, 200);
    assert.equal(fits.account.coins, 70);
    assert.equal(fits.ledger[field], 100);
  }
})().catch(error => { console.error(error); process.exitCode=1; });
