// Echo Spire advances and pays only through the server ledger; tribute retries keep one day key.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../emberweave-heroes.html'),'utf8');
const src=html.slice(html.indexOf('let TOWER_SRV=null'),html.indexOf('/* ============================ MAIL'));
let reply=null,calls=[],adopted=[];
const box={G:{gold:50,gems:10,tower:{floor:9,trib:''}},ACC:{id:'wallet-test',token:'token'},PENDING_MEM:{},localStorage:{getItem:()=>null},POWER_SCALE:1,HERO_TYPES:{},MONSTER_TYPES:{},uid8:()=> 'state-id',pendingDefinite:r=>!!(r&&r.ok),saveG:()=>{},updateHubChrome:()=>{},resultNotCountedText:()=> 'Not confirmed',adoptLedger:L=>adopted.push(L),apiResultRetry:async(route,body)=>{calls.push({route,body});return route==='/api/tower/state'?{ok:true,floor:9,today:'2026-10-24',trib:'2026-10-24'}:reply;}};
vm.createContext(box);vm.runInContext(src,box);
(async()=>{
 vm.runInContext("TOWER_ACCT=ACC.id;TOWER_SRV={floor:9,today:'2026-10-24',trib:''}",box);
 let r=await box.towerTribute();assert(r.pending);assert.equal(box.G.gold,50);assert.equal(box.G.tower.trib,'');assert.equal(adopted.length,0);
 reply={ok:false,error:'Save refused'};r=await box.towerTribute();assert(r.pending);assert.equal(box.G.tower.trib,'');assert.equal(adopted.length,0);
 reply={ok:true,gold:800,ledger:{gold:850,gems:10}};r=await box.towerTribute();assert.equal(r.gold,800);assert.equal(adopted.length,1);assert.equal(adopted[0].gold,850);assert.equal(box.G.gold,50,'only adoptLedger applies money, never a local grant');assert.equal(box.G.tower.trib,'2026-10-24');
 const tribute=calls.filter(c=>c.route==='/api/tower/tribute');assert.equal(tribute.length,3);assert.equal(new Set(tribute.map(c=>c.body.requestId)).size,1);
 assert((await box.towerTribute()).none,'confirmed daily claim cannot be repeated');assert.equal(calls.filter(c=>c.route==='/api/tower/tribute').length,3);
 assert(!src.includes('/api/tower/ascend'),'retired power ladder is not called');assert(!src.includes('txEarnP('),'server ledger owns all reward grants');
 console.log('wallet tower claim: durable tribute receipt, refusal, same-day retry and no optimistic money passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
