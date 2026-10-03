'use strict';
const test=require('node:test'),a=require('node:assert/strict'),H=require(process.env.SLOT_CONTROL?'./hybrid-before-slot-size.cjs':'./hybrid-adapter.cjs');
test('identity envelope exceeding recover bound rejects before any slot write',async()=>{
 const rows=[],slots=new Map(),scope={accountId:'actor',guildId:'guild'};
 const h=H.create({list:async()=>rows,insertBounded:async r=>rows.push(r)},{getItem:k=>slots.get(k)??null,setItem:(k,v)=>slots.set(k,v)},{isCurrent:()=>true,legacyCheck:async()=> 'clear'});
 const row=await h.enroll(scope,{requestId:'entry',heroIds:['hero']},'one');
 const packet={requestId:'result',attemptId:'attempt',inputLog:['x'.repeat(159850)],dmg:1};
 a.ok(JSON.stringify(packet).length<160000);
 a.ok(JSON.stringify({v:3,accountId:'actor',guildId:'guild',instanceId:'one',entryRequestId:'entry',packet}).length>160000);
 a.throws(()=>h.stage(row,packet),/Slot size/);a.equal(slots.size,0);
 a.equal((await h.recover(scope))[0].status,'entry-recovery-only');
});
test('stage reserves terminal marker size for interrupted retirement recovery',async()=>{
 const rows=[],slots=new Map(),scope={accountId:'actor',guildId:'guild'};
 const h=H.create({list:async()=>rows,insertBounded:async r=>rows.push(r)},{getItem:k=>slots.get(k)??null,setItem:(k,v)=>slots.set(k,v)},{isCurrent:()=>true,legacyCheck:async()=> 'clear'});
 const row=await h.enroll(scope,{requestId:'entry',heroIds:['hero']},'one');
 const p={requestId:'result',attemptId:'attempt',inputLog:[''],dmg:1};
 const envelope={v:3,accountId:'actor',guildId:'guild',instanceId:'one',entryRequestId:'entry',packet:p};
 p.inputLog[0]='x'.repeat(159995-JSON.stringify(envelope).length);
 a.equal(JSON.stringify(envelope).length,159995);a.ok(JSON.stringify({...envelope,confirmed:true}).length>160000);
 a.throws(()=>h.stage(row,p),/Slot size/);a.equal(slots.size,0);
});
