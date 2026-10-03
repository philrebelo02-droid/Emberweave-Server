'use strict';const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),a=require('node:assert/strict');const hash=x=>crypto.createHash('sha256').update(x).digest('hex');a(!fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'));
const server=fs.readFileSync(path.join(__dirname,'../guild-raid-period-fence-v948/private-server-period-fence.js'),'utf8'),client=fs.readFileSync(path.join(__dirname,'../guild-raid-period-fence-v948/private-client-guild-discovery.html'),'utf8');a.equal(hash(server),'7b91b71e72f80417e7459219d33147d892675aa4922c1e442f86da3a310944ba');a.equal(hash(client),'a7f98abc7978dfc691c377e9566bb0c059642f2b7cfed604a141c7de932ec062');
const anchor="    if(p==='/api/guild/raid'){";a.equal(server.split(anchor).length,2);
const prefix="reqId.startsWith('r3:')";a.equal(server.split(prefix).length,2);
const nextServer=server.replace(prefix,"/^r3:/i.test(reqId)").replace(anchor,`    if(p==='/api/guild/raid/entry-period' && req.method==='GET'){
      const g=myGuild();
      if(!g||me.guildId!==g.id||!Array.isArray(g.members)||!g.members.includes(me.id))return send(res,403,{ok:false,error:'Current guild membership required.'});
      return send(res,200,{v:1,accountId:me.id,guildId:g.id,period:new Date().toISOString().slice(0,10),namespace:'r3'});
    }
`+anchor);
const old="async function raidLaunch(){try{const r=await raidGetV3();if(RAID_SETTLEMENT&&RAID_SETTLEMENT.current())throw Error('Recover the pending raid result first.');const sq=squadFor('graid').slice(0,TEAM_SIZE*2);if(!sq.length)return;await r.bootstrap.launch({heroIds:sq,requestId:uid8()},'raid-'+uid8());}catch(e){bannerMsg(String(e.message||e));}}";a.equal(client.split(old).length,2);
const nextClient=client.replace(old,`async function raidFreshIdentity(){
 const current=raidClientFence(),accountId=ACC&&ACC.id,guildId=G.guild&&G.guild.id,token=ACC&&ACC.token;
 if(!accountId||!guildId||typeof token!=='string'||!token)throw Error('Sign in to start a raid.');
 const response=await fetch('/api/guild/raid/entry-period',{method:'GET',headers:{'x-token':token}});if(!current())throw Error('Raid account changed.');
 const x=await response.json();if(!current())throw Error('Raid account changed.');
 if(response.status!==200||!x||Object.keys(x).sort().join(',')!=='accountId,guildId,namespace,period,v'||x.v!==1||x.accountId!==accountId||x.guildId!==guildId||x.namespace!=='r3'||!/^\\d{4}-\\d{2}-\\d{2}$/.test(x.period))throw Error('Could not verify the raid day. Try again.');
 const nonce=uid8();if(typeof nonce!=='string'||!/^[-a-z0-9]{1,24}$/i.test(nonce))throw Error('Could not save a raid request.');return 'r3:'+x.period+':'+nonce;
}
async function raidLaunch(){try{const r=await raidGetV3();if(RAID_SETTLEMENT&&RAID_SETTLEMENT.current())throw Error('Recover the pending raid result first.');const sq=squadFor('graid').slice(0,TEAM_SIZE*2);if(!sq.length)return;const requestId=await raidFreshIdentity();await r.bootstrap.launch({heroIds:sq,requestId},'raid-'+uid8());}catch(e){bannerMsg(String(e.message||e));}}`);
const b=nextClient.indexOf('const EW_RAID_V3_MODULES='),e=nextClient.indexOf('// PRIVATE guarded v3 cutover.',b);new vm.Script(nextClient.slice(b,e));new vm.Script(nextClient.slice(nextClient.indexOf('async function raidFreshIdentity(){'),nextClient.indexOf('function raidStartAccepted(')));
fs.writeFileSync(path.join(__dirname,'private-server-namespaced.js'),nextServer);fs.writeFileSync(path.join(__dirname,'private-client-namespaced.html'),nextClient);fs.writeFileSync(path.join(__dirname,'build-certificate.json'),JSON.stringify({atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),serverSHA256:hash(nextServer),clientSHA256:hash(nextClient),serverParentSHA256:hash(server),clientParentSHA256:hash(client),status:'PRIVATE_NAMESPACED_PAIR_NOT_RELEASE',edits:'One authenticated read-only period route (no ensureRaid/read DB mutation). Guarded client helper captures session across fetch/json, strictly verifies server period/scope/namespace before bootstrap saves namespaced entry. No browser-date source, no paid request on failed identity verification. Existing bootstrap persists complete entry before paid transport. Legacy quiescence/terminal/native/fullsuite/balance gates OPEN.'},null,2));
