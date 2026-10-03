'use strict';
const fs=require('node:fs'),a=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const html=fs.readFileSync(__dirname+'/../guild-raid-locked-stage-v948/private-client-locked-stage.html','utf8');a.equal(hash(html),'6559a3d50837800f46a5593c874895f666b472492ac57fff46d2725d3df14d7f');const b=html.indexOf("'use strict';",html.indexOf('M.facade=(()=>')),e=html.indexOf('return module.exports})();',b);a(b>0&&e>b);let s=html.slice(b,e),parent=s,spans=0;function change(x,y){a.equal(s.split(x).length,2);s=s.replace(x,y);spans++}
change('validateFreshEntryReply,validateSettlementReply})','validateFreshEntryReply,validateSettlementReply,validateEntryClosureReply})');
change("if(!found||found.status==='confirmed-cleanup')throw Error('No recoverable instance');","if(!found||['confirmed-cleanup','entry-closed-cleanup'].includes(found.status))throw Error('No recoverable instance');");
change(' async function settle(id){',` async function closeEntryRecovery(id){return locked(async()=>{await legacy();guard();const found=(await h.recover(scope)).find(x=>x.row.id===id);guard();
  // Explicit cleanup of a committed closure is storage-only: never request entry again.
  if(found?.status==='entry-closed-cleanup'){await h.cleanupClosed(scope,id);guard();return {status:200,body:{cleanupOnly:true,entryClosed:true}};}
  if(!found||found.status!=='entry-recovery-only'||found.row.state!=='pending')throw Error('No entry-only closure candidate');
  if(typeof validateEntryClosureReply!=='function')throw Error('Authenticated closure validator required');
  const reply=await transport({mode:'entry-recovery-only',packet:copy(found.row.entry),scope:copy(scope)});guard();
  const proof=await validateEntryClosureReply({reply,entry:copy(found.row.entry),scope:copy(scope),recoveryStatus:found.status});guard();
  if(!proof)throw Error('Entry period not proven closed');await legacy();guard();
  // Hybrid re-reads exact entry-only state under this same account lock before commit.
  await h.closeEntry(scope,id,copy(proof));guard();acceptedAttempts.delete(id);await h.cleanupClosed(scope,id);guard();return {status:200,body:{cleanupOnly:true,entryClosed:true}};
 })}
 async function settle(id){`);
change('return {start,stage,recover,current,resume,settle,discover};','return {start,stage,recover,current,resume,settle,discover,closeEntryRecovery};');
new vm.Script(s);fs.writeFileSync(__dirname+'/facade.cjs',s);fs.writeFileSync(__dirname+'/facade-original.cjs',parent);fs.writeFileSync(__dirname+'/facade-build-certificate.json',JSON.stringify({atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),parentHTMLSHA256:hash(html),parentFacadeSHA256:hash(parent),facadeSHA256:hash(s),spans,status:'PRIVATE_COMPONENT_NOT_HTML_WIRED'},null,2));console.log(hash(s));
