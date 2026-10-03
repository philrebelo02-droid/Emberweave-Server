'use strict';
const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),copy=x=>JSON.parse(JSON.stringify(x));
const html=fs.readFileSync(path.join(__dirname,'private-client-entry-closure.html'),'utf8');
a.equal(hash(html),'c4f330ca4ae0df11f56caa2fab3db6d6483adcaddb0a970c02953ae8516ff115');
const begin=html.indexOf('const EW_RAID_V3_MODULES='),end=html.indexOf('// PRIVATE guarded v3 cutover.',begin);
const M=vm.runInNewContext(html.slice(begin,end)+'\nEW_RAID_V3_MODULES;',{structuredClone});
const H=M.hybrid;
const legacyPath=path.join(__dirname,'../guild-raid-journal-v942/payload/combined/emberweave-heroes.html'),legacy=fs.readFileSync(legacyPath,'utf8');
const la=legacy.indexOf('function raidJournalKey(){'),lb=legacy.indexOf('function raidRecoverSaved(){',la);a(la>0&&lb>la);
const scope={accountId:'actor',guildId:'guild'},entry={requestId:'r3:2026-10-02:one',heroIds:['hero1']},packet={requestId:'result-one',attemptId:'attempt-one',inputLog:[],dmg:12};
function rig(){let row=null,quota=false;const data=new Map(),storage={getItem:k=>data.has(k)?data.get(k):null,setItem(k,v){if(quota)throw Error('Quota');data.set(k,v)}};
 const directory={async insertBounded(r){a.equal(row,null);row=copy(r)},async list(){return row?[copy(row)]:[]},async markConfirmed(r,p){a.deepEqual(row,copy(r));row={...copy(r),state:'confirmed',confirmedPacket:copy(p)}},async retireConfirmed(r){a.deepEqual(row,copy(r));row=null;return true}};
 const make=()=>H.create(directory,storage,{isCurrent:()=>true,legacyCheck:async()=> 'clear'});
 return {data,storage,make,quota(v){quota=v},get row(){return copy(row)}}}
const cases=[];async function test(name,fn){try{await fn();cases.push({name,status:'PASS'})}catch(e){cases.push({name,status:'FAIL',error:e.message})}}
(async()=>{
 await test('Historical legacy writer writes canonical storage while new account lock is held: negative quiescence witness',()=>{
  const data=new Map(),c={ACC:{id:'actor',token:'tok'},G:{guild:{id:'guild'}},localStorage:{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
  vm.createContext(c);vm.runInContext(legacy.slice(la,lb),c);
  // Deliberately model a new-client lock held. The historical function never calls it.
  let requested=0;c.navigator={locks:{request(){requested++;throw Error('Busy account lock')}}};
  a.equal(c.raidJournalWrite({current:()=>true,kind:'start',createdAt:1,packet:{requestId:'old-one',heroIds:['hero1']}}),true);
  a.equal(requested,0);a(data.has('ew_raid_pending_v1_actor'));
 });
 await test('Historical legacy source has no new cutover proof or lock participation',()=>{
  const source=legacy.slice(la,lb);a(!source.includes('EW_RAID_LEGACY_QUIESCENCE_PROOF'));a(!source.includes('locks.request'));
 });
 await test('Confirmed marker prevents raw retained old lease from staging after directory retirement',async()=>{
  const r=rig(),old=r.make(),lease=await old.enroll(scope,entry,'slot');old.stage(lease,packet);const newer=r.make();await newer.confirm(scope,'slot',packet);await newer.cleanup(scope,'slot');const raw=r.data.get(H.key(lease));
  a.equal(r.row,null);a.throws(()=>old.stage(lease,packet));a.equal(r.data.get(H.key(lease)),raw);
 });
 await test('Deleting retained marker lets raw old lease recreate orphan result: unsafe eviction control',async()=>{
  const r=rig(),old=r.make(),lease=await old.enroll(scope,entry,'slot');old.stage(lease,packet);const newer=r.make();await newer.confirm(scope,'slot',packet);await newer.cleanup(scope,'slot');
  r.data.delete(H.key(lease));old.stage(lease,packet);a.equal(r.row,null);a.equal(JSON.parse(r.data.get(H.key(lease))).confirmed,undefined);a.equal((await r.make().recover(scope)).length,0);
 });
 await test('Confirmation cleanup quota preserves exact staged packet plus confirmed directory; retry retains fence',async()=>{
  const r=rig(),old=r.make(),lease=await old.enroll(scope,entry,'slot');old.stage(lease,packet);await r.make().confirm(scope,'slot',packet);const raw=r.data.get(H.key(lease));r.quota(true);
  await a.rejects(()=>r.make().cleanup(scope,'slot'));a.equal(r.row.state,'confirmed');a.equal(r.data.get(H.key(lease)),raw);r.quota(false);await r.make().cleanup(scope,'slot');a.equal(r.row,null);a.equal(JSON.parse(r.data.get(H.key(lease))).confirmed,true);
 });
 await test('Retired marker at reused instance ID blocks new stage rather than overwriting terminal evidence',async()=>{
  const r=rig(),old=r.make(),lease=await old.enroll(scope,entry,'slot');old.stage(lease,packet);await r.make().confirm(scope,'slot',packet);await r.make().cleanup(scope,'slot');const raw=r.data.get(H.key(lease));
  const newer=r.make(),next=await newer.enroll(scope,{requestId:'r3:2026-10-03:two',heroIds:['hero1']},'slot');a.throws(()=>newer.stage(next,{...packet,requestId:'result-two',attemptId:'attempt-two'}));a.equal(r.data.get(H.key(lease)),raw);a.equal(r.row.state,'pending');
 });
 const cert={atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),clientSHA256:hash(html),legacySourceSHA256:hash(legacy),testSHA256:hash(fs.readFileSync(__filename)),pass:cases.filter(x=>x.status==='PASS').length,fail:cases.filter(x=>x.status==='FAIL').length,cases,scope:'New actual embedded hybrid and historical legacy journal functions. Modeled storage/directory/held lock only. Unsafe controls intentionally delete a private MODEL marker, never game data. Raw hybrid lease bypasses facade, not a claim current facade sends an orphan result. No native, migration, eviction fix, activation, balance or deployment proof.',conclusion:'Retain terminal markers; do not infer old writers quiescent from a new Web Lock or empty legacy keys. Real all-writer cutover and bounded durable retention remain OPEN.'};
 fs.writeFileSync(path.join(__dirname,'retention-cutover-certificate.json'),JSON.stringify(cert,null,2));console.log(JSON.stringify(cert,null,2));process.exitCode=cert.fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=2});
