'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module'),a=require('node:assert/strict');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
let parent=fs.readFileSync(path.join(__dirname,'player-damage-http.cjs'),'utf8');
a.equal(hash(Buffer.from(parent)),'e56db58fec1a07138bc08812d8a27165628df913f611155000defaaad292b059');
let prefix=parent.split('(async()=>')[0];
a.equal(prefix.split("'private-server-player-damage.js'").length,2);
prefix=prefix.replace("'private-server-player-damage.js'","'private-server-flag-history-hold.js'").replace('4f66439ee5c0ca10e35ff1b4eec3aefda3c9824c7ce48760d8274a3624ce2d69','ac915324eb523723f2106a49252686285fa5a466578c941932c55bfac0c93c7b');
const main=String.raw`
(async()=>{const rows=[];try{
async function run(code,label,fields,rejected){
 fs.writeFileSync(serverFile,code);f=await m.exports.fixture({seed:u=>{u.guildId='control-guild';u.led.skill={vael:[1,1,1,1]};u.led.skillImported=1790928000000;}});await f.launch();
 const start=await f.call('/api/guild/raid/start',{requestId:'r3:2026-10-02:strict',heroIds:['vael']});a.equal(start.body.ok,true);
 const packet={requestId:'strict-result',attemptId:start.body.attemptId,inputLog:[],dmg:12345},before=f.bytes();
 const reply=await f.call('/api/guild/raid/resolve',{...packet,...fields});
 if(rejected){a.equal(reply.status,400);a.equal(reply.body.ok,false);a.equal(f.bytes(),before);await f.stop();await f.launch();a.equal(f.bytes(),before);const valid=await f.call('/api/guild/raid/resolve',packet);a.equal(valid.body.ok,true);a.equal(valid.body.dmg,12345);const settled=f.bytes();a.equal((await f.call('/api/guild/raid/resolve',packet)).body.dmg,12345);a.equal(f.bytes(),settled)}
 else{a.equal(reply.body.ok,true);a.notEqual(f.bytes(),before)}
 rows.push({label,sourceSHA256:hash(code),replyStatus:reply.status,accepted:reply.body.ok,rejectedWithoutMutation:rejected,validExactRetryAfterRestart:rejected});await f.stop();f=null;fs.writeFileSync(serverFile,saved);
}
await run(candidate,'Natural parent: ignored extra result field still spends settlement',{extra:true},false);
const text=candidate.toString('utf8'),needle="if(typeof b.requestId!=='string'||!b.requestId||b.requestId.length>48||typeof b.attemptId!=='string'||!b.attemptId||b.attemptId.length>128||!Array.isArray(b.inputLog)||b.inputLog.length>400||typeof b.dmg!=='number'||!Number.isFinite(b.dmg)||b.dmg<0)return send(res,400,{ok:false,error:'Exact raid result packet required.'});";
a.equal(text.split(needle).length,2);
const replacement=needle.replace("if(typeof b.requestId", "if(Object.keys(b).some(k=>!['requestId','attemptId','inputLog','dmg'].includes(k))||typeof b.requestId");
const fixed=Buffer.from(text.replace(needle,replacement));fs.writeFileSync(path.join(__dirname,'private-server-resolve-fields.js'),fixed);
await run(fixed,'Extra field400 exact disk and paid attempt retained',{extra:true},true);
await run(fixed,'Top-level credential field400 exact disk and paid attempt retained',{password:'synthetic-not-a-secret'},true);
fs.writeFileSync(path.join(__dirname,'resolve-field-controls.json'),JSON.stringify({atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),helperSHA256:hash(fs.readFileSync(__filename)),parentSHA256:hash(candidate),sourceSHA256:hash(fixed),guardedChanges:1,rows,status:'PRIVATE strict top-level settlement field parity with existing client. Natural parent failing control plus corrected refusal/restart/exact valid retry. NOT witnessed combat/fullQ6/balance/deployment.',limits:'Nested inputLog validation/credential screening, release/expiry, review consumer and balance remain separate open gates.'},null,2));console.log(JSON.stringify(rows));
}finally{if(f)await f.stop();fs.writeFileSync(serverFile,saved);a.equal(hash(fs.readFileSync(serverFile)),hash(saved));console.log('Owned fixtures stopped; root712 restored');}})().catch(e=>{console.error(e);process.exitCode=1;});`;
const mod=new Module(__filename);mod.filename=__filename;mod.paths=Module._nodeModulePaths(__dirname);mod._compile(prefix+main,__filename);
