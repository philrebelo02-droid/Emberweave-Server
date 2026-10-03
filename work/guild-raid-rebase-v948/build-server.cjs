'use strict';const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),a=require('node:assert/strict');
if(fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'))throw Error('Shutdown');
const rev='bbbc3a662a4f106153abafafec691cc6d70149a0',hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const source=cp.execFileSync('git',['-C','C:/Users/Home/Downloads/ew-audit','show',rev+':server.js'],{encoding:'utf8',maxBuffer:12000000}),prior=fs.readFileSync(path.join(__dirname,'../guild-raid-settlement-binding-v942/payload/server.js'),'utf8');
a.equal(hash(prior),'be7ff4dbc4a7e11b3b8dcd63b3e7baa012dd23ecfe1de25019e533f659195893');
const start="    if(p==='/api/guild/raid/start' && req.method==='POST')",end="    if(p==='/api/guild/raid/assault-old')";
function bounds(raw){const b=raw.indexOf(start),e=raw.indexOf(end,b);a(b>0&&e>b);a.equal(raw.indexOf(start,b+1),-1);return{b,e}}
const old=bounds(source),incoming=bounds(prior);let routes=prior.slice(incoming.b,incoming.e);
const member="if(!g||me.guildId!==g.id||!Array.isArray(g.members)||!g.members.includes(me.id)) return send(res,403,{ok:false,error:'Current guild membership required.'});";
a.equal(routes.split("if(!g) return send(res,400,{error:'You are not in a guild.'});").length-1,2);
routes=routes.replaceAll("if(!g) return send(res,400,{error:'You are not in a guild.'});",member);
// Cached read replies must not let raidView migrate the live guild outside commit.
routes=routes.replace('raid:raidView(g),...(prior.resp?.ok?', 'raid:raidView(structuredClone(g)),...(prior.resp?.ok?');
const policy="  'world-city-settlement':{related:true,fields:['watch','feedback','reports','meta']}";
const policyAt=source.indexOf(policy);a(policyAt>0);a.equal(source.indexOf(policy,policyAt+1),-1);
// Raid-only prepared writes use their own narrow policy; no management cutover.
routes=routes.replaceAll("'guild-management'","'guild-raid-recovery'");
const edits=[{name:'raid-prepared-policy',b:policyAt,e:policyAt+policy.length,text:policy+",\n  'guild-raid-recovery':{related:false,fields:['guilds']}"},{name:'raid-start-resolve',b:old.b,e:old.e,text:routes}].sort((x,y)=>x.b-y.b);
let out='',pos=0;for(const edit of edits){a(edit.b>=pos);out+=source.slice(pos,edit.b)+edit.text;pos=edit.e;}out+=source.slice(pos);
new vm.Script(out);for(const term of ['svrBoot','v945','v946','v947'])a.equal(out.split(term).length,source.split(term).length,term+' unchanged');
fs.writeFileSync(path.join(__dirname,'server-base-v948.js'),source);fs.writeFileSync(path.join(__dirname,'private-server-v948.js'),out);
fs.writeFileSync(path.join(__dirname,'server-build-certificate.json'),JSON.stringify({atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),status:'NARROW_V948_SERVER_PARSE_ONLY_HTTP_OPEN',sourceCommit:rev,sourceSHA256:hash(source),incomingPrivateSHA256:hash(prior),outputSHA256:hash(out),edits:edits.map(x=>({name:x.name,start:x.b,end:x.e,originalSHA256:hash(source.slice(x.b,x.e)),replacementSHA256:hash(x.text)})),outsideEditsPreserved:true,dependencies:'Existing current durableCommit/durableUserCommit/worldPlanningDB retained. Added RAID-ONLY prepared policy guild-raid-recovery related:false guilds only; explicit current membership at start/resolve. No other Guild management/read cutover.',open:'HTTP/regression/currentuserchanges/legacy compatibility/refusal policy/native two raids/quota/balance/package/release OPEN. Not deployed.'},null,2));console.log('Two declared server spans only, syntax and current version tags retained; actual HTTP not yet verified.');
