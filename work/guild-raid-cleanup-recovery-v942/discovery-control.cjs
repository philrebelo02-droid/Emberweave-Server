'use strict';
// Exact current facade with ONLY the new duplicate-identity guard removed.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),a=require('node:assert/strict');
const file=path.join(__dirname,'composition-facade.cjs'),source=fs.readFileSync(file,'utf8');
const guard="  const ids=new Set(),entries=new Set();for(const found of rows){if(ids.has(found.row.id)||entries.has(found.row.entry.requestId))throw Error('Ambiguous recovery directory');ids.add(found.row.id);entries.add(found.row.entry.requestId);}";
a.equal(source.split(guard).length,2,'Exact inverse guard match');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(source.replace(guard,''),file);
const row={v:3,accountId:'actor',guildId:'guild',id:'one',entry:{requestId:'entry',heroIds:['hero']},state:'pending'};let calls=0;
const client=m.exports.create({directory:{list:async()=>[row,{...row,id:'two'}]},storage:{length:0,key:()=>null,getItem:()=>null},context:()=>({accountId:'actor',guildId:'guild',token:'memory',epoch:1}),locks:{request:async(_n,_o,fn)=>fn({})},legacyWritersQuiescent:async()=>true,transport:async()=>{calls++;throw Error('Unexpected network')}});
(async()=>{const choices=await client.discover();a.equal(choices.length,2);a.equal(calls,0);console.log(JSON.stringify({control:'Exact guard removed; duplicate saved entry incorrectly exposed as two recovery choices',naturalAcceptanceFailure:true,choices,networkCalls:calls}));})().catch(e=>{console.error(e);process.exitCode=1});
