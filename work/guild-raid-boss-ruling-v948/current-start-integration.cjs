'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module'),assert=require('node:assert/strict');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const baseFile=path.join(__dirname,'start-extra-http.cjs');
let source=fs.readFileSync(baseFile,'utf8');
assert.equal(sha(Buffer.from(source)),'faea136408cf5d907166b23dd57f8ff6b1a370a1f7843e48434dd5dca9d9a6d2');
assert.equal(sha(fs.readFileSync(path.join(__dirname,'private-server-flag-history-hold.js'))),'ac915324eb523723f2106a49252686285fa5a466578c941932c55bfac0c93c7b');
function once(old,next){assert.equal(source.split(old).length,2,'exact source guard');source=source.replace(old,next);}
once("await run('private-server-start-only.js','malformed');",'');
assert.equal(source.split("await run('private-server-start-shape.js'").length,4);
source=source.replaceAll("await run('private-server-start-shape.js'","await run('private-server-flag-history-hold.js'");
once("'start-extra-http.json'","'current-start-integration.json'");
once('One natural malformed-map failure plus three scoped corrected start-only controls. NOT complete Q6/deploy/balance.','Three start invariants newly qualified on cumulative ac915324 candidate: malformed attempt-map safe hold, two-player exclusive paid-start race, legacy attempt safe hold. Prior parent failing-control evidence remains start-extra-http.json; no unchanged parent rerun. NOT complete Q6/deploy/balance.');
const m=new Module(__filename);m.filename=__filename;m.paths=Module._nodeModulePaths(__dirname);m._compile(source,__filename);
