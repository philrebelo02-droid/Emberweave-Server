'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../emberweave-heroes.html'),'utf8');
const source=html.slice(html.indexOf('let TOWER_SRV=null'),html.indexOf('/* ============================ MAIL'));
const store=new Map();let calls=[],response={ok:true},account={id:'a',token:'token-a'};
const box={ACC:account,G:{team:['grosk'],tower:{floor:0}},PENDING_MEM:{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},pendingDefinite:r=>!!(r&&r.ok),api:async(path,method,body)=>{calls.push({path,body});return response;},apiResultRetry:async(path,body)=>{calls.push({path,body});return response;},uid8:()=> 'request-1',adoptLedger:()=>{},saveG:()=>{},updateHubChrome:()=>{},POWER_SCALE:1,HERO_TYPES:{grosk:{name:'Grosk'}},MONSTER_TYPES:{skarrn:{name:'Skarrn'}},state:'menu',_startCtx:()=> 'tower:normal:0:campaign',CUR:{mode:'tower'},bannerMsg:()=>{},startBattle:()=>{box.started=true;},console};vm.createContext(box);vm.runInContext(source,box);
(async()=>{
  const body={attemptId:'attempt-1',requestId:'stable-result',won:true};box.towerPendingSave(body);assert.equal(box.towerPendingRead('a').requestId,'stable-result');
  response=null;await box.towerResendPending();assert(box.towerPendingRead('a'),'Lost response must retain result');assert.equal(calls[0].body.requestId,'stable-result');
  box.towerPendingSettle('a',{ok:true},'wrong-request');assert(box.towerPendingRead('a'),'Older response cannot clear newer result');
  response={ok:true};await box.towerResendPending();assert.equal(box.towerPendingRead('a'),null);
  const mock={floor:6,best:12,start:0,season:4,seasonEnds:Date.now()+1000,trib:'old',today:'today',rested:[3],records:2,next:{floor:7,type:'echo',req:4200,foes:[{key:'grosk',isHero:true}],echo:{recordedFloor:7,season:3},pay:{gold:0,gems:0,echoBonus:400}}};
  const view=box.towerViewState(mock);assert.equal(view.encounter.recordedSeason,3);assert.equal(view.encounter.heroes[0].name,'Grosk');assert.equal(view.encounter.kind,'echo');assert.equal(view.bestFloor,12);assert.equal(view.encounter.rewardText,'Gold 0 · Echo bonus 400 gold');
  assert.equal(box.towerSeasonEnd('2026-10-26'),Date.parse('2026-10-26T13:00:00Z'));assert.equal(box.towerSeasonEnd('2026-11-09'),Date.parse('2026-11-09T14:00:00Z'));
  mock.next.echo.t=Date.parse('2026-10-18T12:00:00Z');assert.equal(box.towerViewState(mock).encounter.recordedAt,mock.next.echo.t);
  response={ok:true,attemptId:'frozen',floor:7,type:'echo',waves:[[{key:'grosk',isHero:true}]],snaps:[{key:'grosk'}],seed:17,engine:'test'};await box.towerLaunch('tower:normal:0:campaign');assert(box.started);assert.equal(box.CUR.seed,17);assert.equal(box.CUR.attemptId,'frozen');assert.equal(box.CUR.cwaves[0][0].isHero,true);assert.equal(calls.at(-1).path,'/api/tower/start');
  assert(!source.includes("'/api/tower/ascend'"));assert(!source.includes('G.gold='),'Client must not pay Tower rewards');
  console.log('Echo Spire client: lost-result recovery, same-id resend, receipt isolation, contract mapping and frozen battle setup passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
