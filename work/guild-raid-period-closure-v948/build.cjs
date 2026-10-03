'use strict';const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict'),crypto=require('node:crypto');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const base=fs.readFileSync(path.join(__dirname,'../guild-raid-canonical-namespace-v948/private-server-canonical.js'),'utf8');a.equal(hash(base),'45b523764006dcac35bfeee1effe3ad790f25a81326180ce67b79607696ef955');
const before="      if(v3Entry&&reqId.slice(3,13)!==r.day)return send(res,409,{ok:false,entryPeriodHeld:true,error:'That saved raid request is from a different day. No new attempt was spent.'});";
const after=`      if(v3Entry&&reqId.slice(3,13)!==r.day){
        const entryPeriod=reqId.slice(3,13),validDate=Number.isFinite(Date.parse(entryPeriod+'T00:00:00Z'))&&new Date(entryPeriod+'T00:00:00Z').toISOString().slice(0,10)===entryPeriod;
        // Existing live exact resume ran first. Closed period proves no fresh
        // entry is possible, NOT that an old payment/result never happened.
        const entryClosure=validDate&&entryPeriod<r.day?{v:1,kind:'period-closed',spent:'unknown',accountId:me.id,guildId:g.id,requestId:reqId,heroIds:structuredClone(b.heroIds),serverPeriod:r.day,packetHash:crypto.createHash('sha256').update(JSON.stringify({requestId:reqId,heroIds:b.heroIds})).digest('hex')}:undefined;
        return send(res,409,{ok:false,entryPeriodHeld:true,...(entryClosure?{entryClosure}:{}),error:'That saved raid request is from a different day. No new attempt was spent.'});
      }`;
a.equal(base.split(before).length,2);const out=base.replace(before,after);fs.writeFileSync(__dirname+'/private-server-period-closure.js',out);fs.writeFileSync(__dirname+'/build-certificate.json',JSON.stringify({atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),baseSHA256:hash(base),serverSHA256:hash(out),spans:1,scope:'Private server reply contract only; no client cleanup, no fullsuite/native/balance/deployment approval.'},null,2));console.log(hash(out));
