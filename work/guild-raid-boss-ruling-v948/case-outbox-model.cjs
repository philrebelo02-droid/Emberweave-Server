'use strict';
// PRIVATE executable design only. Not imported by any game server or Brain consumer.
const crypto=require('node:crypto');
function validFlag(flag,accountId){return !!flag&&typeof flag==='object'&&!Array.isArray(flag)&&flag.v===1&&flag.kind==='raid-damage-mismatch'&&flag.playerTruth===true&&flag.accountId===accountId&&typeof flag.stage==='string'&&flag.stage.length>0&&typeof flag.attemptId==='string'&&flag.attemptId.length>0&&typeof flag.packetHash==='string'&&/^[a-f0-9]{64}$/.test(flag.packetHash)&&typeof flag.playerDamage==='number'&&Number.isFinite(flag.playerDamage)&&flag.playerDamage>=0&&typeof flag.replayDamage==='number'&&Number.isFinite(flag.replayDamage)&&flag.replayDamage>=0&&flag.playerDamage!==flag.replayDamage&&typeof flag.t==='number'&&Number.isFinite(flag.t);}
function planCase(actor,users){
 const history=actor.raidMismatchFlags;
 if(!Array.isArray(history)||history.some(f=>!validFlag(f,actor.id)))return {held:true,reason:'Unknown prior flag history; preserve unchanged.'};
 const identities=history.map(f=>f.attemptId+':'+f.packetHash);if(new Set(identities).size!==identities.length)return {held:true,reason:'Duplicate prior flag identity; preserve unchanged.'};
 if(history.length<3)return {held:false,caseDraft:null,flags:history.length};
 const trigger=history[2],id='raid-review:'+crypto.createHash('sha256').update(JSON.stringify([actor.id,identities.slice(0,3)])).digest('hex');
 const others=new Set();for(const user of Object.values(users||{})){if(user?.id===actor.id||!Array.isArray(user?.raidMismatchFlags))continue;if(user.raidMismatchFlags.some(f=>validFlag(f,user.id)&&f.stage===trigger.stage))others.add(user.id);}
 return {held:false,flags:history.length,caseDraft:{v:1,id,accountId:actor.id,kind:'battle-review',status:'pending-review',triggerFlag:3,stage:trigger.stage,otherPlayersSameStage:others.size,firstThree:structuredClone(history.slice(0,3)),laterFlags:structuredClone(history.slice(3)),specialistDispatch:false},limits:'DESIGN ONLY. No feedback transport/ack, reviewed/dismissed callback, specialist delivery, history retention policy or live persistence implemented.'};
}
module.exports={validFlag,planCase};
