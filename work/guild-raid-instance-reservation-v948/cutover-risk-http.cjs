'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),a=require('node:assert/strict'),crypto=require('node:crypto'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let s=fs.readFileSync(path.join(__dirname,'../guild-raid-period-fence-v948/http.cjs'),'utf8');a.equal(hash(s),'21fae26ad5aed07ca4f6896b7b8b650c38a10b9208cf0df923876fd1f5025c3d');
s=s.replace("process.env.PERIOD_FENCE_CONTROL?'../guild-raid-expired-identity-v948/private-server-expired-identity.js':'private-server-period-fence.js'","'../guild-raid-period-closure-v948/private-server-period-closure.js'");
const b=s.indexOf('const call=async p=>'),e=s.indexOf('\n}catch(err)',b);a(b>0&&e>b);
s=s.slice(0,b)+String.raw`
a.equal(hash(fs.readFileSync(candidate)),'7d2cb9f199382ea77a31ed36bfead8fc03808c9559a40ed5b18bb17c5ef5dbe9');
const call=async(route,packet)=>{const r=await f.call(route,packet);calls.push({route,packet,...r});return r};
const E={requestId:'r3:2026-10-02:known-paid',heroIds:['vael']},paid=await call('/api/guild/raid/start',E);a.equal(paid.body.ok,true);
await f.stop();f.advanceClock(600001);await f.launch();const next=await call('/api/guild/raid/start',{...E,requestId:'r3:2026-10-02:replacement'});a.equal(next.body.ok,true);
const db=f.disk();a(db.users['fixture-user'].raidV3Spent.entries.some(x=>x.requestId===E.requestId));a(!db.users['fixture-user'].raidEntryHistory.some(x=>x.attempt?.id===paid.body.attemptId));a.notEqual(db.guilds['own-guild'].raid.att['fixture-user'].id,paid.body.attemptId);
const beforeResolve=f.bytes(),resolve=await call('/api/guild/raid/resolve',{requestId:'result-known-paid',attemptId:paid.body.attemptId,inputLog:[],dmg:17});a.equal(resolve.status,200);a.equal(resolve.body.ok,false);a.equal(resolve.body.error,'No matching raid battle.');a.equal(f.bytes(),beforeResolve);a.equal(db.users['fixture-user'].led.txs.filter(x=>x.src==='guild-raid').length,0);
// NEW negative time-fence control. Only the private fixture clock is changed.
await f.stop();f.advanceClock(86400000);await f.launch();const old={requestId:'r3:2026-10-02:closed-then-rewind',heroIds:['vael']},beforeClosed=f.bytes();
const closed=await call('/api/guild/raid/start',old);a.equal(closed.status,409);a.equal(closed.body.entryClosure?.kind,'period-closed');a.equal(closed.body.entryClosure?.serverPeriod,'2026-10-03');a.equal(f.bytes(),beforeClosed);
await f.stop();f.advanceClock(-86400000);await f.launch();const beforeRewind=f.bytes(),reopened=await call('/api/guild/raid/start',old);a.equal(reopened.status,200);a.equal(reopened.body.ok,true);a.notEqual(f.bytes(),beforeRewind);a.equal(f.disk().users['fixture-user'].raidDay.n,3);a.equal(f.disk().users['fixture-user'].led.txs.filter(x=>x.src==='guild-raid').length,0);
console.log('VERIFIED negative controls: spent book without snapshot cannot resolve; prior closed period can reopen after synthetic fixture-clock rewind. No live clock or backup touched.');
`+s.slice(e);
s=s.replace("process.env.PERIOD_FENCE_CONTROL?'original-control.json':'certificate.json'","'cutover-risk-http-certificate.json'").replace('Actual privateHTTP syntheticaccount/clock. Opt-in namespace ONLY. Client namespace/day acquisition NOTwired; legacy bare IDs unchanged, no native/fullsuite/balance/terminal retirement proof.','Two NEW actual private authenticated HTTP negative controls, exact7d2cb9 server. Paid spent-book identity lacks pruned attempt snapshot and resolves read-only without grant. Closed old period later accepts fresh entry only after deliberate synthetic fixture clock rewind; demonstrates nonregressing-clock dependency, NOT observed live clock regression or backup restore. No candidate fix, native/browser/client cutover, balance or deployment proof.');
const file=path.join(__dirname,'generated-cutover-risk-http.cjs'),m=new Module(file);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(s,file);
