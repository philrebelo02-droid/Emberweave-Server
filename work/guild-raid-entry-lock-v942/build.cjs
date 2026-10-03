'use strict';const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');assert(!fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'));
const source=fs.readFileSync(path.join(__dirname,'../guild-raid-journal-ownership-v942/payload/combined/emberweave-heroes.html'),'utf8');assert.equal(hash(source),'13dd1eb9a0b1445cad1608da4f95d57aa6ead741ff6c5de4590a5fa8ffd0a797');const a='async function raidLaunch(){',b=`async function raidLaunch(){
 const current=raidClientFence(),key=raidJournalKey();
 if(!key){bannerMsg('Sign in to raid with your guild.');return;}
 if(typeof navigator==='undefined'||!navigator.locks||typeof navigator.locks.request!=='function'){bannerMsg('Safe raid entry coordination is unavailable. No request sent.');return;}
 try{return await navigator.locks.request(key,{mode:'exclusive',ifAvailable:true},async(lock)=>{
  if(!current())return;
  if(!lock){bannerMsg('Another tab is handling this raid request. Recover the saved request after it finishes.');return;}
  return await raidLaunchLocked();
 });}catch(e){if(current())bannerMsg('Could not coordinate raid entry. No replacement request sent.');}
}
async function raidLaunchLocked(){`;
assert.equal(source.split(a).length,2);const next=source.replace(a,b),dest=path.join(__dirname,'payload/combined/emberweave-heroes.html');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,next,{flag:'wx'});fs.writeFileSync(path.join(__dirname,'spans.json'),JSON.stringify({base:hash(source),output:hash(next),spans:[[a,b]]},null,2));console.log(hash(next));
