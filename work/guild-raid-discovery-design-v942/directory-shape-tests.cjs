'use strict';
const A=require(process.argv[2]||'./native-directory.cjs');
const p={v:3,accountId:'actor',guildId:'guild',id:'slot',entry:{requestId:'entry',heroIds:['hero']},state:'pending'},packet={requestId:'result',attemptId:'attempt',inputLog:[],dmg:10};let pass=0,fail=0;
function check(name,f){try{f();pass++;console.log('PASS '+name)}catch(e){fail++;console.log('FAIL '+name+': '+e.message)}}
function refuses(p){let denied=false;try{A.row(p)}catch{denied=true}if(!denied)throw Error('malformed row accepted')}
check('valid pending',()=>A.row(p));
check('valid confirmed',()=>A.row({...p,state:'confirmed',confirmedPacket:packet}));
check('unknown directory field refuses',()=>refuses({...p,override:true}));
check('unknown entry field refuses',()=>refuses({...p,entry:{...p.entry,reward:100}}));
check('pending confirmed packet refuses',()=>refuses({...p,confirmedPacket:packet}));
check('confirmed missing packet refuses',()=>refuses({...p,state:'confirmed'}));
check('confirmed negative damage refuses',()=>refuses({...p,state:'confirmed',confirmedPacket:{...packet,dmg:-1}}));
check('confirmed unknown packet field refuses',()=>refuses({...p,state:'confirmed',confirmedPacket:{...packet,grant:1}}));
check('duplicate hero identities refuse',()=>refuses({...p,entry:{...p.entry,heroIds:['hero','hero']}}));
check('confirmed oversized input log refuses',()=>refuses({...p,state:'confirmed',confirmedPacket:{...packet,inputLog:Array(401).fill(1)}}));
console.log(JSON.stringify({pass,fail,scope:'Pure schema controls only, not native transaction/game proof'}));process.exitCode=fail?1:0;
