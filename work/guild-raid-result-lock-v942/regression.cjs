'use strict';const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
process.env.RAID_CLIENT_HTML=path.join(__dirname,'payload/combined/emberweave-heroes.html');
const name=path.join(__dirname,'regression-impl.cjs'),m=new Module(name);m.filename=name;m.paths=Module._nodeModulePaths(__dirname);let source=fs.readFileSync(path.join(__dirname,'../guild-raid-journal-v942/tests.cjs'),'utf8');
source=source.replace('function setup(shared=new Map(),failure=null){','const stages=new WeakMap();\nfunction setup(shared=new Map(),failure=null){');
const a='const f=m.exports.fixture();',b="const f=m.exports.fixture();f.c.navigator={locks:{request:(_key,_options,fn)=>Promise.resolve(fn({name:_key,mode:'exclusive'}))}};if(!stages.has(shared))stages.set(shared,new Map());const stage=stages.get(shared);f.c.sessionStorage={getItem:k=>stage.has(k)?stage.get(k):null,setItem:(k,v)=>stage.set(k,v),removeItem:k=>stage.delete(k)};";assert.equal(source.split(a).length,2);source=source.replace(a,b);
// Changed storage contract: complete pre-timer packet is tab-scoped staging,
// canonical journal transition is now locked and may not run before timer.
source=source.replace("JSON.parse(f.shared.get(key)||'null')?.kind","f.c.raidJournalRead()?.kind");
m._compile(source,name);
