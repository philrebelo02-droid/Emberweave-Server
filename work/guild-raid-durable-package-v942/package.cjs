'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const W=path.resolve(__dirname,'..'),hash=s=>crypto.createHash('sha256').update(s).digest('hex'),read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
assert(!fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'));
const oldDir=path.join(W,'guild-raid-journal-v942'),oldPlan=JSON.parse(read(path.join(oldDir,'spans.json'))),oldManifest=JSON.parse(read(path.join(oldDir,'manifest.json'))).variants[0];
let spans=[...oldPlan['emberweave-heroes.html']],expected=oldManifest.output['emberweave-heroes.html'];
for(const d of ['guild-raid-journal-ownership-v942','guild-raid-entry-lock-v942','guild-raid-cleanup-lock-v942','guild-raid-result-lock-v942','guild-raid-durable-stage-v942']){const p=JSON.parse(read(path.join(W,d,'spans.json')));assert.equal(p.base,expected);spans.push(...p.spans);expected=p.output;}
const html=read(path.join(W,'guild-raid-durable-stage-v942/payload/combined/emberweave-heroes.html'));assert.equal(hash(html),expected);
const platform="const journalStore=new Map();c.localStorage={getItem:k=>journalStore.has(k)?journalStore.get(k):null,setItem:(k,v)=>journalStore.set(k,v),removeItem:k=>journalStore.delete(k),key:i=>[...journalStore.keys()][i]??null,get length(){return journalStore.size;}};c.crypto={randomUUID:require('node:crypto').randomUUID};c.navigator={locks:{request:(_key,_options,fn)=>Promise.resolve(fn({name:_key,mode:'exclusive'}))}};vm.createContext(c);";
const originalClient=read(path.join(W,'guild-raid-client-v942/payload/combined/tests/guild-raid-client.test.cjs')),anchor='vm.createContext(c);';assert.equal(originalClient.split(anchor).length,2);const client=originalClient.replace(anchor,platform),prefix=client.split("test('Double launch")[0];
const journalSource=read(path.join(oldDir,'tests.cjs')),entrySource=read(path.join(W,'guild-raid-entry-lock-v942/tests.cjs')),durableSource=read(path.join(W,'guild-raid-durable-stage-v942/tests.cjs'));
const locks=entrySource.slice(entrySource.indexOf('function locks()'),entrySource.indexOf('function setup('));
let setup=journalSource.slice(journalSource.indexOf('function setup('),journalSource.indexOf("const key='ew_raid_pending_v1_actor';")).replace('m.exports.fixture()','fixture()');
const ret='return{...f,shared};';assert.equal(setup.split(ret).length,2);setup=setup.replace(ret,"Object.defineProperty(f.c.localStorage,'length',{get:()=>shared.size});f.c.localStorage.key=i=>[...shared.keys()][i]??null;const lock=locks();f.c.navigator={locks:lock};return{...f,shared,lock};");
const journalTests=journalSource.slice(journalSource.indexOf("test('Actual delayed" )).replace("JSON.parse(f.shared.get(key)||'null')?.kind","f.c.raidJournalRead()?.kind").replace("fs.readFileSync(process.env.RAID_CLIENT_HTML,'utf8')","fs.readFileSync(process.env.RAID_CLIENT_HTML||(fs.existsSync(local)?local:path.resolve(__dirname,'../emberweave-heroes.html')),'utf8')");
// Dedicated shared-lock setup for the newer interleaving checks, no imports outside the small package.
const durableSetup="function durableSetup(shared=new Map(),lock=locks()){const f=setup(shared);f.c.navigator={locks:lock};return{...f,lock};}\n";
let durableTests=durableSource.slice(durableSource.indexOf('function seed(')).replace(/\bsetup\(/g,'durableSetup(');
const journal=prefix+locks+setup+"const crypto=require('node:crypto'),key='ew_raid_pending_v1_actor',packet=(id,dmg=10)=>({requestId:id,attemptId:'attempt',inputLog:[],dmg});\n"+journalTests+durableSetup+durableTests;
const runner=read(path.join(oldDir,'payload/combined/tests/run_all_tests.sh'));
const outputs={'emberweave-heroes.html':html,'tests/run_all_tests.sh':runner,'tests/guild-raid-client.test.cjs':client,'tests/guild-raid-journal.test.cjs':journal};
const previous=fs.existsSync(path.join(__dirname,'manifest.json'))?JSON.parse(read(path.join(__dirname,'manifest.json'))).variants[0].output:{};
const base={...oldManifest.base},out={};for(const [f,s]of Object.entries(outputs)){out[f]=hash(s);const dest=path.join(__dirname,'payload/combined',f);if(fs.existsSync(dest))assert.equal(hash(read(dest)),previous[f],'Preserve intervening edits');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,s);}
assert.equal(base['tests/guild-raid-client.test.cjs'],hash(originalClient));
fs.writeFileSync(path.join(__dirname,'manifest.json'),JSON.stringify({status:'PRIVATE_PACKAGE_UNVERIFIED_NOT_REVIEW_READY_NOT_SHIPPED',variants:[{name:'combined',base,output:out}]},null,2));
fs.writeFileSync(path.join(__dirname,'spans.json'),JSON.stringify({'emberweave-heroes.html':spans,'tests/run_all_tests.sh':oldPlan['tests/run_all_tests.sh'],'tests/guild-raid-client.test.cjs':[[anchor,platform]]},null,2));
for(const f of ['patch.cjs','install.cjs','guards.cjs'])fs.copyFileSync(path.join(oldDir,f),path.join(__dirname,f));
const env={...process.env,RAID_CLIENT_HTML:path.join(__dirname,'payload/combined/emberweave-heroes.html'),API_SESSION_HTML:path.join(__dirname,'payload/combined/emberweave-heroes.html'),GUILD_CLIENT_HTML:path.join(__dirname,'payload/combined/emberweave-heroes.html')};
const files=['payload/combined/tests/guild-raid-client.test.cjs','payload/combined/tests/guild-raid-journal.test.cjs'].map(f=>path.join(__dirname,f)).concat([path.join(W,'api-session-v942/tests.cjs'),path.join(W,'guild-client-session-v942/tests.cjs')]);
const r=cp.spawnSync(process.execPath,['--test','--test-reporter=tap',...files],{env,windowsHide:true,encoding:'utf8',timeout:20000});fs.writeFileSync(path.join(__dirname,'composition.log'),r.stdout+r.stderr);assert.ifError(r.error);assert.equal(r.status,0,r.stdout+r.stderr);
const proof={at:new Date().toISOString(),pass:Number(r.stdout.match(/# pass (\d+)/)?.[1]),fail:Number(r.stdout.match(/# fail (\d+)/)?.[1]),scope:'New portable4output harness composition, not new distinct assertions or full canonical run'};fs.writeFileSync(path.join(__dirname,'composition.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
