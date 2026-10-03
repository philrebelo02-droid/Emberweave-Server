'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module'),assert=require('node:assert/strict');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
let source=fs.readFileSync(path.join(__dirname,'start-identity-http.cjs'),'utf8');
assert.equal(hash(Buffer.from(source)),'5fa77aa85d1d6e1a53457a9e8ff3d8941ee250f2aba27d1e23e74731cec214a0');
function once(old,next){assert.equal(source.split(old).length,2);source=source.replace(old,next);}
once("'private-server-start-shape.js'","'private-server-flag-history-hold.js'");
once('0ab8decf535823ffe79a080898fd0550b9be7708ecea73195cd16ee4e7f8b297','ac915324eb523723f2106a49252686285fa5a466578c941932c55bfac0c93c7b');
once("'start-identity-http.json'","'current-identity-integration.json'");
once('Eight scoped identity/input/write-fault/restart checks only','Eight identity/input/write-fault/restart checks newly qualified on cumulative ac915324, not an unchanged parent rerun');
once('START ONLY; no release/expiry/day rollover/legacy resume migration, settlement/player damage fix, actual witnessed combat, balance, live baseline, or deployment approval.','This run qualifies start identity only; cumulative settlement/damage changes have separate certificates. No release/expiry/day rollover/legacy resume migration, actual witnessed combat, balance, live baseline, or deployment approval.');
const m=new Module(__filename);m.filename=__filename;m.paths=Module._nodeModulePaths(__dirname);m._compile(source,__filename);
