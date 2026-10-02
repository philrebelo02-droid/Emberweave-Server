'use strict';
// Add a row per newly migrated route, not another process/fault/retry harness.
// Each case must arrange a genuinely eligible mutation and observable memory view.
module.exports=[
 {name:'Pool paid pity roll',route:'/api/pool/wish',observe:'/api/pool/state',packet:{pool:'gem',n:1,requestId:'generic-pool-paid'},receipt:'fixture-user:wish:generic-pool-paid',assertSaved(db,reply,assert){assert.equal(reply.cost,300);assert.equal(reply.results[0].pity,true);assert.equal(db.users['fixture-user'].qc.wish,1);assert.equal(db.users['fixture-user'].led.pool.history.length,1);}},
 {name:'Pool ten paid Gold rolls',route:'/api/pool/wish',observe:'/api/pool/state',packet:{pool:'gold',n:10,requestId:'generic-pool-ten'},receipt:'fixture-user:wish:generic-pool-ten',assertSaved(db,reply,assert){assert.equal(reply.cost,9000);assert.equal(reply.results.length,10);assert.equal(db.users['fixture-user'].qc.wish,10);}},
 {name:'Shipped Watch report lane',route:'/api/watch/report',observe:'/api/watch',packet:{attacks:[{name:'New target',eta:10,ret:false}],defends:[],scouts:[]},assertSaved(db,reply,assert){assert.deepEqual(db.watch['fixture-user'].attacks,[{name:'New target',eta:10,ret:false}]);}},
 {name:'Shipped Quest chain lane',route:'/api/quest/chain-claim',observe:'/api/quest/state',packet:{requestId:'generic-quest'},receipt:'fixture-user:qchain:generic-quest',assertSaved(db,reply,assert){assert.equal(db.users['fixture-user'].led.quests.chainStep,1);}}
];
