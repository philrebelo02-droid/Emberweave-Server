const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(process.argv[2], 'utf8');
const start = src.indexOf("  if(p==='/api/campaign/sweep'");
const end = src.indexOf("  if(p==='/api/admin/led-grant'", start);
assert(start >= 0 && end > start);
const ledger = {stam:{v:50}};
let transaction;
const noop = () => {};
const run = vm.runInNewContext('(async () => {' + src.slice(start,end) + '})', {
  p:'/api/campaign/sweep',req:{method:'POST'},res:{},me:{id:'fixture'},
  body:async () => ({requestId:'sweep',node:1,times:1}),idem:(_,work) => work(),ensureLedger:() => ledger,
  portalModeOf:() => 'normal',portalProg:() => ({cleared:1,stars:{1:3}}),
  portalLocked:noop,portalChapterLocked:noop,portalStageOf:() => ({id:1,rewardHero:'vex',rewards:{repeatGold:50,playerXpRepeat:10,heroXpRepeat:10}}),
  campCapStageSrv:() => true,nyDayKey:() => 'today',portalHardMode:() => false,campIsBoss:() => false,STAM_COST_NORMAL:6,
  ledStamRegen:noop,creditGold:() => 2,ledAddPlayerXP:noop,xpPotionGrant:() => ({}),srvSeed:noop,
  ledTx:(_,__,value) => { transaction=value; },glyphGrantNamedList:() => [],campaignGlyphDrops:() => [],
  portalPaysHeroFrag:() => true,PORTAL_HERO_FRAG_MUL:{normal:2},creditFrags:() => 1,
  writeDB:noop,ledgerView:() => ledger,send:(_,status,payload) => ({status,payload}),
});
run().then(({status,payload}) => {
  assert.equal(status,200);
  assert.equal(payload.gold,2);
  assert.equal(payload.eliteFrag.qty,1);
  assert.equal(transaction.gold,2);
  assert.equal(ledger.stam.v,44);
}).catch(error => { console.error(error); process.exitCode=1; });
