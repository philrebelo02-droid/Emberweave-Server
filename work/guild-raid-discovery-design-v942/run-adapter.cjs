'use strict';const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
assert(!fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'));
const r=cp.spawnSync(process.execPath,['--test','--test-reporter=tap',path.join(__dirname,'adapter-tests.cjs')],{windowsHide:true,encoding:'utf8',timeout:10000});
fs.writeFileSync(path.join(__dirname,'adapter.log'),r.stdout+r.stderr);
const proof={at:new Date().toISOString(),exit:r.status,error:r.error?.message,pass:Number(r.stdout.match(/# pass (\d+)/)?.[1]||0),fail:Number(r.stdout.match(/# fail (\d+)/)?.[1]||0),adapterSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'indexed-adapter.cjs'))).digest('hex'),scope:'Private adapter event handling under explicitly serialized transaction model. NOT native IndexedDB/concurrency/crash/game recovery verification.'};
fs.writeFileSync(path.join(__dirname,'adapter-results.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));assert.ifError(r.error);assert.equal(r.status,0);assert.equal(proof.pass,13);assert.equal(proof.fail,0);
