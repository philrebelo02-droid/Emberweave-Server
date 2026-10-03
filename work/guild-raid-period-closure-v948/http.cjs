'use strict';const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),a=require('node:assert/strict'),crypto=require('node:crypto');const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
let s=fs.readFileSync(path.join(__dirname,'../guild-raid-period-fence-v948/http.cjs'),'utf8');a.equal(hash(s),'21fae26ad5aed07ca4f6896b7b8b650c38a10b9208cf0df923876fd1f5025c3d');
s=s.replace("process.env.PERIOD_FENCE_CONTROL?'../guild-raid-expired-identity-v948/private-server-expired-identity.js':'private-server-period-fence.js'","process.env.PERIOD_FENCE_CONTROL?'../guild-raid-canonical-namespace-v948/private-server-canonical.js':'private-server-period-closure.js'");
const b=s.indexOf('const call=async p=>'),e=s.indexOf('\n}catch(err)',b);a(b>0&&e>b);
s=s.slice(0,b)+String.raw`
a.equal(hash(fs.readFileSync(candidate)),process.env.PERIOD_FENCE_CONTROL?'45b523764006dcac35bfeee1effe3ad790f25a81326180ce67b79607696ef955':'7d2cb9f199382ea77a31ed36bfead8fc03808c9559a40ed5b18bb17c5ef5dbe9');
const call=async packet=>{const r=await f.call('/api/guild/raid/start',packet);calls.push({packet,...r});return r};
await f.stop();f.advanceClock(57599000);await f.launch();
const E={requestId:'r3:2026-10-02:oldlive',heroIds:['vael']},start=await call(E);a.equal(start.status,200);a.equal(start.body.ok,true);
await f.stop();f.advanceClock(2000);await f.launch();const before=f.bytes();
const resumed=await call({...E,recoverOnly:true});a.equal(resumed.body.resumed,true);a.equal(resumed.body.attemptId,start.body.attemptId);a.equal(resumed.body.entryClosure,undefined);a.equal(f.bytes(),before);
const U={requestId:'r3:2026-10-02:unspent',heroIds:['vael']};const unknown=await call({...U,recoverOnly:true});a.equal(unknown.status,409);a(unknown.body.entryClosure,'old day refusal needs exact closure binding');
const check=(body,p)=>{const c=body.entryClosure;a.equal(c.kind,'period-closed');a.equal(c.spent,'unknown');a.equal(c.accountId,'fixture-user');a.equal(c.guildId,'own-guild');a.equal(c.requestId,p.requestId);a.deepEqual(c.heroIds,p.heroIds);a.equal(c.serverPeriod,'2026-10-03');a.equal(c.packetHash,hash(JSON.stringify(p)));};check(unknown.body,U);a.equal(f.bytes(),before);
for(const p of [{...U,requestId:'r3:2026-10-04:future'},{...U,requestId:'r3:2026-09-31:invalid'},{...U,requestId:'R3:2026-10-02:upper'},{...U,requestId:'r3:2026-10-03:current'}]){const r=await call({...p,recoverOnly:true});a.equal(r.status,409);a.equal(r.body.entryClosure,undefined);a.equal(f.bytes(),before);}
await f.stop();f.advanceClock(600001);await f.launch();const expiredBefore=f.bytes(),expired=await call({...E,recoverOnly:true});a.equal(expired.status,409);check(expired.body,E);a.equal(f.bytes(),expiredBefore);
await f.stop();await f.launch();const again=await call({...U,recoverOnly:true});check(again.body,U);a.equal(f.bytes(),expiredBefore);a.equal(f.disk().users['fixture-user'].raidDay.n,1);
console.log('PASS old-live resume first; past-valid exact closure unknown-spent no mutation; future/invalid/uppercase/current held; expired paid entry never mislabeled unpaid; restart exact proof');
`+s.slice(e);
s=s.replace('Client namespace/day acquisition NOTwired; legacy bare IDs unchanged, no native/fullsuite/balance/terminal retirement proof.','One guarded reply-only contract. Actual privateHTTP/fixture-clock pastday closure scope+packetHash, old-live resume before closure, expired paid spent UNKNOWN, future/current/invalid/uppercase not closure, zero mutation/restart. Client directory cleanup NOTwired; no native/fullsuite/balance proof.');
const file=path.join(__dirname,'generated-period-closure-http.cjs'),m=new Module(file);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(s,file);
