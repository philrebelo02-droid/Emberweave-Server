const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(process.argv[2], 'utf8');
const route = src.indexOf("  if(p==='/api/campaign/resolve'");
const start = src.indexOf('      const won=witnessed.won;', route);
const end = src.indexOf('      /* The receipt:', start);
assert(route >= 0 && start > route && end > start);
const transactions = [];
const state = {
  witnessed:{won:true,stars:3},a:{node:1,heroIds:[]},prog:{cleared:1,stars:{}},
  led:{frags:{}},mode:'normal',me:{id:'fixture'},reqId:'claim',
  st:{id:'stage',rewardHero:'vex',rewards:{repeatGold:50,playerXpRepeat:10,heroXpRepeat:10}},
  campCapStageSrv:() => true,nyDayKey:() => 'today',xpPotionGrant:() => ({}),srvSeed:() => 0,
  creditGold:() => 2,ledAddPlayerXP(){},ledTx:(_,__,delta) => transactions.push(delta),
  glyphGrantNamedList:() => [],campaignGlyphDrops:() => [],portalPaysHeroFrag:() => true,
  PORTAL_HERO_FRAG_MUL:{normal:2},creditFrags:() => 1,
};
const reward = vm.runInNewContext(src.slice(start,end) + '\nreward;', state);
assert.equal(reward.gold,2);
assert.equal(reward.eliteFrag.qty,1);
assert.equal(reward.runCounted,true);
assert.equal(transactions[0].gold,2);
assert.equal(transactions[1].frag,1);
