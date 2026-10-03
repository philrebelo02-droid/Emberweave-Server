'use strict';
// START-ONLY PRIVATE EXPERIMENT: no release/expiry/settlement policy is implemented.
// This artifact is intentionally NOT a deployable integrated Guild candidate.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),a=require('node:assert/strict');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),parent=fs.readFileSync(path.join(__dirname,'../guild-raid-period-closure-v948/private-server-period-closure.js'));a.equal(hash(parent),'7d2cb9f199382ea77a31ed36bfead8fc03808c9559a40ed5b18bb17c5ef5dbe9');let s=parent.toString();
function replace(old,next){a.equal(s.split(old).length,2,'Exactly one guarded source span');s=s.replace(old,next);}
replace("      if(((r.used[me.id])||0)>=RAID_ATT) return send(res,200,{ none:true, raid:raidView(guild) });",`      // PRIVATE START-ONLY reservation. Never infer release from age or missing clients.
      // Legacy outstanding attempts and malformed reservations require explicit recovery.
      if(r.bossReservation!==undefined || Object.keys(r.att).length)
        return send(res,409,{ok:false,bossBusy:true,error:'The raid boss is reserved. No new attempt was spent.'});
      if(((r.used[me.id])||0)>=RAID_ATT) return send(res,200,{ none:true, raid:raidView(guild) });`);
replace("      if(v3Entry){spentBook.entries.push({guildId:g.id,requestId:reqId,heroIds:structuredClone(ids)});actor.raidV3Spent=spentBook;}",`      r.bossReservation={v:1,accountId:me.id,guildId:g.id,attemptId:r.att[me.id].id,requestId:reqId,tier:r.level,bossKey:bb.key,startedAt:r.att[me.id].startedAt};
      if(v3Entry){spentBook.entries.push({guildId:g.id,requestId:reqId,heroIds:structuredClone(ids)});actor.raidV3Spent=spentBook;}`);
const target=path.join(__dirname,'private-server-start-only.js');fs.writeFileSync(target,s);console.log(JSON.stringify({parentSHA256:hash(parent),outputSHA256:hash(s),status:'PRIVATE START-ONLY experiment; release/expiry/settlement NOT implemented; NOT deployable'}));
