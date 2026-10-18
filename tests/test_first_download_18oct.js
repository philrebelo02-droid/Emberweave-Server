'use strict';
const assert=require('node:assert/strict'),test=require('node:test');
const FD=require('../assets/ui/first-download.js');
function rig(options={}){
 const origin='https://game.test',files=new Map(),saved=new Map(),fetched=[];let failWrite=false;
 const cache={keys:async()=>[...files.keys()].map(url=>({url})),put:async(u,r)=>{if(failWrite)throw Error('quota');if(r.bodyWait)await r.bodyWait;files.set(new URL(u,origin).href,r);}};
 const storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
 const plan=options.plan||{parts:[['/assets/a'],['/assets/b'],['/assets/c'],['/assets/d']]};
 const fetch=async(u,o)=>{fetched.push(u);return options.fetch?options.fetch(u,o):{ok:true,status:200};};
 const make=()=>FD.create({plan:async()=>plan,origin,storage,caches:{open:async name=>{assert.equal(name,'ember-assets-v1');return cache;}},fetch,timeout:40,concurrency:1});
 return {make,files,saved,fetched,plan,setFailWrite:v=>{failWrite=v;}};
}
test('four disjoint parts: starters, 25 heroes, 25 heroes, remainder; shared assets belong to earliest part',()=>{
 const heroes=['vael','sylthaine','vireo',...Array.from({length:57},(_,i)=>'hero'+String(i).padStart(2,'0'))];
 const byHero=Object.fromEntries(heroes.map(k=>[k,['/assets/'+k,'/assets/shared']]));
 const p=FD.partition({heroes,byHero,essentials:['/assets/world','/assets/shared'],remaining:['/assets/world','/assets/rest']});
 assert.deepEqual(p.heroes.map(h=>h.length),[3,25,25,7]);assert.ok(p.parts[0].includes('/assets/world'));
 assert.equal(new Set(p.parts.flat()).size,p.parts.flat().length);assert.equal(p.parts.flat().length,63);
});
test('one quarter saved at a time, survives a new session, and already cached files are never fetched again',async()=>{
 const r=rig(),one=r.make();await one.init();assert.equal(one.snapshot().percent,0);
 await one.next();assert.equal(one.snapshot().percent,25);assert.equal(one.snapshot().status,'saved');await one.saveAndExit();
 const two=r.make();await two.init();assert.equal(two.snapshot().percent,25);assert.equal(two.snapshot().resumeOnOpen,true);
 await two.next();assert.equal(two.snapshot().percent,50);assert.deepEqual(r.fetched,['/assets/a','/assets/b']);
 await two.next();await two.next();assert.equal(two.snapshot().percent,100);assert.equal(two.snapshot().status,'complete');
});
test('saved flags never substitute for actual cache contents, including browser eviction and bumped art URLs',async()=>{
 const r=rig(),one=r.make();await one.init();await one.next();r.files.clear();
 const two=r.make();await two.init();assert.equal(two.snapshot().percent,0);assert.equal(two.snapshot().essentialsReady,false);
 await two.next();r.plan.parts[0]=['/assets/a?v=new'];const three=r.make();await three.init();assert.equal(three.snapshot().percent,0);await three.next();assert.equal(three.snapshot().percent,25);assert.equal(r.fetched.at(-1),'/assets/a?v=new');
});
test('files cached by normal play after initialization are skipped before another download starts',async()=>{
 const r=rig(),d=r.make();await d.init();r.files.set('https://game.test/assets/a',{ok:true,status:200});await d.next();assert.equal(d.snapshot().percent,50);assert.deepEqual(r.fetched,['/assets/b']);
});
test('quota failures and unavailable responses remain incomplete and can be retried',async()=>{
 const r=rig();r.setFailWrite(true);const d=r.make();await d.init();await d.next();assert.equal(d.snapshot().percent,0);assert.equal(d.snapshot().status,'waiting');
 r.setFailWrite(false);await d.next();assert.equal(d.snapshot().percent,25);
 const bad=rig({fetch:async()=>({ok:false,status:404})}).make();await bad.init();await bad.next();assert.equal(bad.snapshot().essentialsReady,false);
});
test('a hanging request and hanging response body cannot keep a download running forever',async()=>{
 for(const fetch of [()=>new Promise(()=>{}),async()=>({ok:true,status:200,bodyWait:new Promise(()=>{})})]){
  const d=rig({fetch}).make();await d.init();const t=Date.now();await d.next();assert.ok(Date.now()-t<500);assert.equal(d.snapshot().status,'waiting');assert.equal(d.snapshot().percent,0);
 }
});
test('simultaneous starts share one job; pausing waits for safe completion and resumes only missing content',async()=>{
 const r=rig({plan:{parts:[['/assets/a','/assets/a2'],['/assets/b'],['/assets/c'],['/assets/d']]}}),d=r.make();
 await Promise.all([d.next(),d.next()]);assert.deepEqual(r.fetched,['/assets/a','/assets/a2']);assert.equal(d.snapshot().percent,25);
 await d.saveAndExit();const resumed=r.make();await resumed.init();await resumed.next();assert.equal(resumed.snapshot().percent,50);
});
test('an interrupted quarter retains successful files, cancels the active request and resumes the unfinished quarter',async()=>{
 let hanging=true;const r=rig({plan:{parts:[['/assets/a','/assets/a2'],['/assets/b'],['/assets/c'],['/assets/d']]},fetch:async(u,o)=>{
  if(u==='/assets/a2'&&hanging)return new Promise((_,reject)=>{if(o.signal.aborted)reject(Error('aborted'));else o.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});});return {ok:true,status:200};
 }}),d=r.make();await d.init();let saved;
 const oneSaved=new Promise(resolve=>{saved=d.subscribe(s=>{if(s.percent>0&&s.percent<25)resolve();});});
 const job=d.next();await oneSaved;await d.saveAndExit();await job;saved();assert.equal(d.snapshot().percent,12);assert.equal(d.snapshot().essentialsReady,false);assert.equal(d.snapshot().status,'paused');
 hanging=false;const next=r.make();await next.init();assert.equal(next.snapshot().part,0);await next.next();assert.equal(next.snapshot().percent,25);assert.equal(r.fetched.filter(u=>u==='/assets/a').length,1);
});
test('an unavailable cache or catalog resolves to a retry state, not a false completed quarter',async()=>{
 const d=FD.create({plan:()=>new Promise(()=>{}),storage:{getItem:()=>null,setItem:()=>{}},caches:{open:async()=>{throw Error('private mode');}},fetch:async()=>{},origin:'https://game.test',timeout:30});
 await d.init();assert.equal(d.snapshot().status,'waiting');assert.equal(d.snapshot().essentialsReady,false);assert.equal(d.snapshot().percent,0);
});
