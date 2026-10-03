'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),a=require('node:assert/strict'),crypto=require('node:crypto'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let s=fs.readFileSync(path.join(__dirname,'../guild-raid-cleanup-recovery-v942/native-html-http.cjs'),'utf8');a.equal(hash(s),'7d6fb8653bce6afde53449e6d12f24b0ef419ad73a3c473396b025091dd0b38f');
function replace(before,after){a(s.includes(before),'Missing exact inherited span '+before.slice(0,70));s=s.replace(before,after)}
replace("'private-bootstrap-heroes.html'","'private-client-instance-reservation.html'");
replace('5636f71697dc6b75c59279b779fdaf76a837b4b2c878cf5232f551edc044f0e2','28ec2c6d66f33b9d730d3b1d224992e1a1205070affaf23f71be19637ff45283');
replace("fs.copyFileSync(path.join(__dirname,'../guild-raid-settlement-binding-v942/payload/server.js'),serverFile);","const pinnedServer=path.join(__dirname,'../guild-raid-period-closure-v948/private-server-period-closure.js');assert.equal(hash(fs.readFileSync(pinnedServer)),'7d2cb9f199382ea77a31ed36bfead8fc03808c9559a40ed5b18bb17c5ef5dbe9');fs.copyFileSync(pinnedServer,serverFile);");
replace("const body=JSON.parse(raw),reply=await f.call(req.url,body,req.headers['x-token']);","const body=req.method==='GET'?undefined:JSON.parse(raw),reply=await f.call(req.url,body,req.headers['x-token']);");
replace("'native-html-http-evidence.json'","'native-hooks-http-evidence.json'");
replace("htmlHash:hash(candidate),serverHash:","htmlHash:hash(candidate),hooksHash:hash(hooks),serverHash:");
replace("scope:'Real native storage/locks/DOM with EXACT generated Guild block and actual private HTTP. Synthetic account/no combat; test-only quiescence true on isolated origin, not production/full game page.'","scope:'Current28ec2c exact extracted Guild HTML hooks plus7d2cb9 actual private authenticated HTTP. Native IDB/localStorage/WebLocks/DOM, synthetic combat and renderer hooks, not full game page/combat/authored balance. Strict proof true ONLY test origin has no legacy game writer; production provider remains missing, activation held.'");
const file=path.join(__dirname,'generated-native-hooks-http.cjs'),m=new Module(file);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(s,file);
