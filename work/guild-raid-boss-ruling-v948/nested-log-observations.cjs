'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto'),a=require('node:assert/strict');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const raw=fs.readFileSync(path.join(__dirname,'player-damage-http.cjs'),'utf8');a.equal(hash(Buffer.from(raw)),'e56db58fec1a07138bc08812d8a27165628df913f611155000defaaad292b059');
let prefix=raw.split('(async()=>')[0].replace("'private-server-player-damage.js'","'private-server-resolve-fields.js'").replace('4f66439ee5c0ca10e35ff1b4eec3aefda3c9824c7ce48760d8274a3624ce2d69','2fa1a2365607e86d2cb820f67db5a5d9fcada91e41845693c9f0132f3bf9e9d1');
const main=String.raw`
(async()=>{const rows=[];try{for(const [label,inputLog] of [['null row',[null]],['native six-field auto tuple',[[0,'auto',-1,1,null,null]]]]){
fs.writeFileSync(serverFile,candidate);f=await m.exports.fixture({seed:u=>{u.guildId='control-guild';u.led.skill={vael:[1,1,1,1]};u.led.skillImported=1790928000000;}});await f.launch();
const started=await f.call('/api/guild/raid/start',{requestId:'r3:2026-10-02:nested',heroIds:['vael']});a.equal(started.body.ok,true);
const before=f.bytes(),reply=await f.call('/api/guild/raid/resolve',{requestId:'nested-result',attemptId:started.body.attemptId,inputLog,dmg:12345});
a.equal(reply.body.ok,true);a.equal(reply.body.dmg,12345);a.notEqual(f.bytes(),before);
const flags=f.disk().users['fixture-user'].raidMismatchFlags||[];
if(label==='null row'){a.equal(reply.body.incident.kind,'raid-replay-error');a.equal(flags.length,0)}
rows.push({label,inputLog,status:reply.status,accepted:reply.body.ok,incident:reply.body.incident,flags:flags.length});await f.stop();f=null;fs.writeFileSync(serverFile,saved);
}fs.writeFileSync(path.join(__dirname,'nested-log-observations.json'),JSON.stringify({atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),helperSHA256:hash(fs.readFileSync(__filename)),sourceSHA256:hash(candidate),rows,status:'OPEN nested transcript validation: malformed null row reaches replay, becomes engine error, and settlement accepts player12345 with zero mismatch flags. Native six-field auto row is compatibility observation. No source fix or new policy chosen.',limits:'Synthetic private HTTP and real fixture replay, not witnessed fight. Player-truth/engine-error exclusion not silently changed. Strict tuple/time/legacy compatibility requires explicit qualification; no fullQ6/balance/deployment.'},null,2));console.log(JSON.stringify(rows));
}finally{if(f)await f.stop();fs.writeFileSync(serverFile,saved);a.equal(hash(fs.readFileSync(serverFile)),hash(saved));console.log('Owned fixture stopped/root712 restored');}})().catch(e=>{console.error(e);process.exitCode=1;});`;
const mod=new Module(__filename);mod.filename=__filename;mod.paths=Module._nodeModulePaths(__dirname);mod._compile(prefix+main,__filename);
