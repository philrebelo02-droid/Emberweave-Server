'use strict';const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),a=require('node:assert/strict');
if(fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'))throw Error('Shutdown');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');let source=fs.readFileSync(path.join(__dirname,'../guild-raid-strict-start-v948/private-server-strict-start.js'),'utf8');
a.equal(hash(source),'e1775ee9de03aa3f9fe2e6a9cf89123cc29eb07c7dc43da0e4bef6ddedfb93aa');const parent=source,edits=[];
function replace(old,text,name){a.equal(source.split(old).length,2,name);edits.push({name,originalSHA256:hash(old),replacementSHA256:hash(text)});source=source.replace(old,text)}
replace('      const open=r.att[me.id];',`      const currentOpen=r.att[me.id];
      const history=actor.raidEntryHistory;
      if(history!==undefined&&(!Array.isArray(history)||history.length>8))return send(res,409,{ok:false,error:'Raid history requires recovery.'});
      const open=(currentOpen&&currentOpen.reqId===reqId?currentOpen:null)||
        (history||[]).find(x=>x.guildId===g.id&&x.attempt&&x.attempt.reqId===reqId)?.attempt;`,'resume-exact-history');
const debit='      r.used[me.id]=((r.used[me.id])||0)+1;   /* the attempt is spent on entry — quitting does not refund it */';
replace(debit,`      // Keep a replaced paid snapshot independently; fresh-entry behavior and caps stay unchanged.
      const entryNow=Date.now();
      const retained=(history||[]).filter(x=>!x.attempt||!Number.isSafeInteger(x.attempt.startedAt)||entryNow<x.attempt.startedAt||entryNow-x.attempt.startedAt<=RAID_SESSION_MS);
      if(currentOpen&&Number.isSafeInteger(currentOpen.startedAt)&&entryNow>=currentOpen.startedAt&&entryNow-currentOpen.startedAt<=RAID_SESSION_MS&&!retained.some(x=>x.guildId===g.id&&x.attempt?.id===currentOpen.id))retained.push({guildId:g.id,attempt:structuredClone(currentOpen)});
      if(retained.length>8)return send(res,503,{ok:false,error:'Raid history capacity held. No new attempt was spent.'});
      actor.raidEntryHistory=retained;
`+debit,'retain-before-charge');
replace(`        const a=r.att[me.id];
        if(!a || a.id!==String(b.attemptId||'')) return {ok:false, error:'No matching raid battle.', raid:raidView(guild)};
        r.att[me.id]=null; delete r.att[me.id];`,`        const currentAttempt=r.att[me.id];
        const a=(currentAttempt&&currentAttempt.id===attemptId?currentAttempt:null)||
          (Array.isArray(actor.raidEntryHistory)?actor.raidEntryHistory:[]).find(x=>x.guildId===g.id&&x.attempt?.id===attemptId)?.attempt;
        if(!a) return {ok:false, error:'No matching raid battle.', raid:raidView(guild)};
        if(currentAttempt?.id===a.id)delete r.att[me.id];
        if(Array.isArray(actor.raidEntryHistory))actor.raidEntryHistory=actor.raidEntryHistory.filter(x=>!(x.guildId===g.id&&x.attempt?.id===a.id));`,'resolve-independent-attempt');
new vm.Script(source);fs.writeFileSync(path.join(__dirname,'private-server-retained-attempt.js'),source);fs.copyFileSync(path.join(__dirname,'../guild-raid-rebase-v948/private-client-v948.html'),path.join(__dirname,'private-client-v948.html'));
fs.writeFileSync(path.join(__dirname,'build-certificate.json'),JSON.stringify({atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),status:'PRIVATE_PARSE_ONLY_NOT_RELEASE',sourceCommit:'bbbc3a662a4f106153abafafec691cc6d70149a0',parentServerSHA256:hash(parent),serverSHA256:hash(source),clientSHA256:hash(fs.readFileSync(path.join(__dirname,'private-client-v948.html'))),edits,semantics:'Alternative to489 blockingguard: preserves historically allowed second paid fresh entry and original3/day caps. Retains still-valid overwritten snapshots account-owned/guild-bound, resolves exact old attempt without deleting newer slot. Durable stageduser+guild+receipt commit unchanged.',open:'Cross-feature/save-field authority, guildswitch discovery/expired terminal/history malformed clocks/receipt pruning/boss-tier advancement, full native client integration and all release gates remain OPEN. Not a full issuedticket integration.'},null,2));console.log('Three declared server spans built/parsed, current client unchanged');
