'use strict';
// Add a row per newly migrated route, not another process/fault/retry harness.
// Each case must arrange a genuinely eligible mutation and observable memory view.
module.exports=[
 {name:'Pool paid pity roll',route:'/api/pool/wish',observe:'/api/pool/state',packet:{pool:'gem',n:1,requestId:'generic-pool-paid'},receipt:'fixture-user:wish:generic-pool-paid',assertSaved(db,reply,assert){assert.equal(reply.cost,300);assert.equal(reply.results[0].pity,true);assert.equal(db.users['fixture-user'].qc.wish,1);assert.equal(db.users['fixture-user'].led.pool.history.length,1);}},
 {name:'Pool ten paid Gold rolls',route:'/api/pool/wish',observe:'/api/pool/state',packet:{pool:'gold',n:10,requestId:'generic-pool-ten'},receipt:'fixture-user:wish:generic-pool-ten',assertSaved(db,reply,assert){assert.equal(reply.cost,9000);assert.equal(reply.results.length,10);assert.equal(db.users['fixture-user'].qc.wish,10);}},
 {name:'Shipped Watch report lane',route:'/api/watch/report',observe:'/api/watch',packet:{attacks:[{name:'New target',eta:10,ret:false}],defends:[],scouts:[]},assertSaved(db,reply,assert){assert.deepEqual(db.watch['fixture-user'].attacks,[{name:'New target',eta:10,ret:false}]);}},
 {name:'Shipped Quest chain lane',route:'/api/quest/chain-claim',observe:'/api/quest/state',packet:{requestId:'generic-quest'},receipt:'fixture-user:qchain:generic-quest',assertSaved(db,reply,assert){assert.equal(db.users['fixture-user'].led.quests.chainStep,1);}}
];

'use strict';
const catalog=require('../server/gear-catalog.json'),grey=catalog.items.find(x=>x.qi===0),green=catalog.items.find(x=>x.qi===1);
function gearSeed(u){u.dust=1000;u.gear={revision:1,fragments:Object.fromEntries(catalog.items.map(d=>[d.frag,100])),subs:{},items:{q1:{d:grey.id,temper:0,prog:0,dustSpent:20,bound:false,createdAt:1},q2:{d:grey.id,temper:0,prog:0,dustSpent:0,bound:false,createdAt:2}},equipped:{},active:{},seq:3};}
const packet=(extra)=>({expectedRevision:1,...extra}),g=(d)=>d.users['fixture-user'].gear;
module.exports.push(
 {name:'Batch market fragment',route:'/api/market/frag',observe:'/api/ledger',packet:{heroKey:'vael',qty:1,pay:'gold',requestId:'batch-market'},receipt:'fixture-user:mfrag:batch-market',assertSaved(d,r,a){a.equal(r.qty,1);a.equal(r.paid.gold,550);a.equal(d.users['fixture-user'].led.frags.vael,1);}},
 {name:'Batch shop pieces',route:'/api/shop/buy',observe:'/api/ledger',packet:{what:'pieces',requestId:'batch-shop'},receipt:'fixture-user:shop:batch-shop',assertSaved(d,r,a){a.equal(r.cost,450);a.equal(d.users['fixture-user'].led.gems,99550);a.ok(Object.values(r.mats).every(x=>x===100));}},
 {name:'Batch arena daily',route:'/api/arena/daily-claim',observe:'/api/ledger',packet:{requestId:'batch-arena'},receipt:'fixture-user:adaily:batch-arena',assertSaved(d,r,a){a.ok(r.reward.gold>0);a.equal(d.users['fixture-user'].arenaDaily.k,'2026-10-02');}},
 {name:'Batch authorized developer pack',route:'/api/shop/devpack',observe:'/api/ledger',seed(u){u.role='admin';},packet:{i:2,requestId:'batch-devpack'},receipt:'fixture-user:devpack:batch-devpack',assertSaved(d,r,a){a.equal(r.gems,500);a.equal(d.users['fixture-user'].led.gems,100500);a.ok(d.reports.some(x=>x.kind==='dev-pack'));}},
 {name:'Batch Forge sub-component',route:'/api/gear/craft-sub',observe:'/api/gear/state',seed:gearSeed,packet:packet({gearId:green.id}),assertSaved(d,r,a){a.equal(g(d).subs[green.sub],1);a.equal(g(d).fragments[green.frag],100-green.subFragCost);a.equal(g(d).revision,2);}},
 {name:'Batch Forge higher craft',route:'/api/gear/craft',observe:'/api/gear/state',seed(u){gearSeed(u);u.gear.subs[green.sub]=1;},packet:packet({gearId:green.id,ingredients:['q1','q2']}),assertSaved(d,r,a){a.equal(g(d).items.q1,undefined);a.equal(g(d).items.q2,undefined);a.equal(g(d).items.q3.d,green.id);a.equal(g(d).subs[green.sub],undefined);}},
 {name:'Batch Forge equip permanently binds',route:'/api/gear/equip',observe:'/api/gear/state',seed:gearSeed,packet:packet({heroKey:'vael',itemId:'q1'}),assertSaved(d,r,a){a.equal(g(d).equipped.vael[grey.slot],'q1');a.equal(g(d).items.q1.bound,true);}},
 {name:'Batch Forge temper dust debit',route:'/api/gear/temper',observe:'/api/gear/state',seed:gearSeed,packet:packet({itemId:'q1',uses:1}),assertSaved(d,r,a){a.equal(d.users['fixture-user'].dust,995);a.equal(g(d).items.q1.prog,1);a.equal(g(d).items.q1.dustSpent,25);}},
 {name:'Batch Forge extract item refund',route:'/api/gear/extract',observe:'/api/gear/state',seed:gearSeed,packet:packet({itemId:'q1'}),assertSaved(d,r,a){a.equal(g(d).items.q1,undefined);a.equal(d.users['fixture-user'].dust,1016);a.equal(r.refund,16);}},
 {name:'Batch Forge select owned equipped active',route:'/api/gear/select-active',observe:'/api/gear/state',seed(u){gearSeed(u);u.gear.equipped.vael={[grey.slot]:'q1'};u.gear.items.q1.bound=true;},packet:packet({heroKey:'vael',itemId:'q1'}),assertSaved(d,r,a){a.equal(g(d).active.vael,'q1');}},
 {name:'Batch Forge authorized developer grant',route:'/api/gear/grant',observe:'/api/gear/state',seed(u){gearSeed(u);u.role='admin';},packet:packet({dust:7,frag:grey.id,n:3}),assertSaved(d,r,a){a.equal(d.users['fixture-user'].dust,1007);a.equal(g(d).fragments[grey.frag],103);}}
);
