'use strict';const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');assert(!fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'));
const source=fs.readFileSync(path.join(__dirname,'../guild-raid-entry-lock-v942/payload/combined/emberweave-heroes.html'),'utf8');assert.equal(hash(source),'7a1a61f8437bd1ce1d1e8f14e7189f83b15284b9e47fa068df3725ab3d1a9cac');const a='function raidJournalClear(p){',b=`function raidJournalClear(p){
 const key=raidJournalKey();
 if(!key||!p.current()||typeof navigator==='undefined'||!navigator.locks||typeof navigator.locks.request!=='function')return Promise.resolve(false);
 try{return Promise.resolve(navigator.locks.request(key,{mode:'exclusive',ifAvailable:true},lock=>lock&&p.current()?raidJournalClearLocked(p):false)).catch(()=>false);}catch(e){return Promise.resolve(false);}
}
function raidJournalClearLocked(p){`;
assert.equal(source.split(a).length,2);const next=source.replace(a,b),dest=path.join(__dirname,'payload/combined/emberweave-heroes.html');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,next,{flag:'wx'});fs.writeFileSync(path.join(__dirname,'spans.json'),JSON.stringify({base:hash(source),output:hash(next),spans:[[a,b]]},null,2));console.log(hash(next));
