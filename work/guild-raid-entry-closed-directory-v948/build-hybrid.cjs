'use strict';
const fs=require('node:fs'),a=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const html=fs.readFileSync(__dirname+'/../guild-raid-locked-stage-v948/private-client-locked-stage.html','utf8');a.equal(hash(html),'6559a3d50837800f46a5593c874895f666b472492ac57fff46d2725d3df14d7f');
const b=html.indexOf("'use strict';",html.indexOf('M.hybrid=(()=>')),e=html.indexOf('return module.exports})();',b);a(b>0&&e>b);let s=html.slice(b,e),parent=s,spans=0;
function change(x,y){a.equal(s.split(x).length,2);s=s.replace(x,y);spans++}
change("'use strict';","'use strict';\nconst validateDirectoryRow=require('./directory.cjs').row;");
change("!['pending','confirmed'].includes(r.state)","!['pending','confirmed','entry-closed'].includes(r.state)");
change("entry(r.entry);if(r.state==='confirmed')", "entry(r.entry);if(r.state==='entry-closed')validateDirectoryRow(r);if(r.state==='confirmed')");
change("status:r.state==='confirmed'?'confirmed-cleanup':'entry-recovery-only'","status:r.state==='entry-closed'?'entry-closed-cleanup':r.state==='confirmed'?'confirmed-cleanup':'entry-recovery-only'");
change("if(raw.length>160000)throw Error('Slot size');const p=JSON.parse(raw);","if(raw.length>160000)throw Error('Slot size');const p=JSON.parse(raw);\n   if(r.state==='entry-closed'){if(!same(p,closedMarker(r)))throw Error('Closed marker conflict');results.push({row:copy(r),status:'entry-closed-cleanup'});continue;}");
change(' async function confirm(s,id,p){',` function closedMarker(r){return {v:3,accountId:r.accountId,guildId:r.guildId,instanceId:r.id,entryRequestId:r.entry.requestId,entryClosed:true,entryClosure:copy(r.entryClosure)}}
 async function closeEntry(s,id,proof){s=scope(s);const found=(await recover(s)).find(x=>x.row.id===id);if(!current())throw Error('Stale context');if(!found||found.status!=='entry-recovery-only'||found.row.state!=='pending')throw Error('Entry closure phase');
  // Facade must validate authenticated proof/digest and hold account lock across this call.
  await directory.markEntryClosed(found.row,proof);if(!current())throw Error('Stale context');writers.delete(id);resumedAttempts.delete(id);return true;
 }
 async function cleanupClosed(s,id){s=scope(s);const found=(await recover(s)).find(x=>x.row.id===id);if(!current())throw Error('Stale context');if(!found)return false;if(found.status!=='entry-closed-cleanup'||found.row.state!=='entry-closed')throw Error('Closed cleanup phase');
  const r=found.row,k=key(r),marker=JSON.stringify(closedMarker(r));if(marker.length>160000)throw Error('Slot size');storage.setItem(k,marker);if(storage.getItem(k)!==marker)throw Error('Closed cleanup readback');if(!current())throw Error('Stale context');
  await directory.retireEntryClosed(r);writers.delete(id);resumedAttempts.delete(id);return true;
 }
 async function confirm(s,id,p){`);
change('return {enroll,stage,recover,confirm,cleanup,resumeValidated};','return {enroll,stage,recover,confirm,cleanup,resumeValidated,closeEntry,cleanupClosed};');
new vm.Script(s);fs.writeFileSync(__dirname+'/hybrid.cjs',s);fs.writeFileSync(__dirname+'/hybrid-original.cjs',parent);fs.writeFileSync(__dirname+'/hybrid-build-certificate.json',JSON.stringify({atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),parentHTMLSHA256:hash(html),parentHybridSHA256:hash(parent),hybridSHA256:hash(s),spans,status:'PRIVATE_COMPONENT_NOT_HTML_WIRED'},null,2));console.log(hash(s));
