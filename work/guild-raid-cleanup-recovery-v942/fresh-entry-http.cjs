'use strict';
// Reuse the owned guarded private HTTP fixture setup, not the previous scenario
// or its test counts. Restore its exact snapshot in the inherited finally.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const file=path.join(__dirname,'integration.cjs'),source=fs.readFileSync(file,'utf8');
const begin=source.indexOf(" const E={requestId:'composition-entry'"),end=source.indexOf('\n}finally{',begin);assert(begin>0&&end>begin);
const scenario=`
 lost=false;lostResult=false;retireFail=false;
 deps.validateFreshEntryReply=require('./fresh-entry-validator.cjs').validateFreshEntryReply;
 const E={requestId:'fresh-bound-entry',heroIds:['vael']},client=fresh(),accepted=await client.start(E,'fresh-bound-instance');
 assert.equal(accepted.reply.status,200);assert.equal(accepted.reply.body.ok,true);
 const attempt=accepted.reply.body.attemptId,P={requestId:'fresh-bound-result',attemptId:attempt,inputLog:[],dmg:10};
 assert.throws(()=>client.stage(accepted.row,{...P,attemptId:'other'}),/binding/);assert.equal(slots.size,0);
 client.stage(accepted.row,P);assert.equal(slots.size,1);lostResult=true;
 await assert.rejects(client.settle('fresh-bound-instance'),/Committed result reply lost/);
 await f.stop();await f.launch();const recovered=await fresh().settle('fresh-bound-instance');
 assert.equal(recovered.status,200);assert.equal(recovered.body.ok,true);
 assert.equal(f.disk().users['fixture-user'].raidDay.n,1);assert.equal(f.disk().users['fixture-user'].led.txs.filter(x=>x.src==='guild-raid').length,1);
 assert.equal(rows.size,0);assert.equal(slots.size,1);assert.deepEqual(calls.filter(x=>x.mode==='result-recovery-only').map(x=>x.packet),[P,P]);
 fs.writeFileSync(path.join(__dirname,'fresh-entry-http-results.json'),JSON.stringify({at:new Date().toISOString(),pass:true,facadeHash:hash(fs.readFileSync(path.join(__dirname,'composition-facade.cjs'))),freshValidatorHash:hash(fs.readFileSync(path.join(__dirname,'fresh-entry-validator.cjs'))),serverHash:hash(fs.readFileSync(server)),calls,entryCount:1,raidTransactions:1,pendingRows:0,retainedMarkers:1,scope:'NEW actual private HTTP fresh authenticated bound entry, mismatched result attempt refused before staging, valid synchronous stage, committed result reply lost/server restart, freshVM same packet recovery exactly one entry/grant. Model storage/locks/directory/quiescence; not native/fullHTML.'},null,2));
 console.log('PASS new actualHTTP fresh entry binding + stage + lost-result reply/restart single grant');
`;
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(source.slice(0,begin)+scenario+source.slice(end),file);
