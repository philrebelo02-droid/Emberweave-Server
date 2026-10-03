'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),a=require('node:assert/strict'),c=require('node:crypto');
const root=path.join(__dirname,'../shady-gold-v942/snapshot'),file=path.join(root,'server.js'),saved=fs.readFileSync(file),hash=x=>c.createHash('sha256').update(x).digest('hex');
a.equal(hash(saved),'71202733c70b7e0d5e301918a594214eef1087f7b3cdd8161e152ed6c113de65');
a(!fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'));
const candidate=process.env.STRICT_START_CONTROL?path.join(__dirname,'../guild-raid-rebase-v948/private-server-v948.js'):path.join(__dirname,'private-server-strict-start.js');
const cases=[{requestId:17,heroIds:['vael']},{requestId:'x'.repeat(49),heroIds:['vael']},{requestId:'dup',heroIds:['vael','vael']},{requestId:'oversquad',heroIds:Array(11).fill('vael')},{requestId:'extra',heroIds:['vael'],dmg:10}];
let f;const results=[];
(async()=>{try{
 fs.copyFileSync(candidate,file);
 const virtual=path.join(root,'tests/private-strict-start.cjs'),m=new Module(virtual);m.filename=virtual;m.paths=Module._nodeModulePaths(path.dirname(virtual));
 m._compile(fs.readFileSync(path.join(__dirname,'../guild-raid-recovery-only-v942/tests.cjs'),'utf8').split('const E=')[0].replace('root=process.env.GUILD_FIXTURE_ROOT','root='+JSON.stringify(root)).replace("path.join(root,'tests/guild-leadership.test.cjs')",JSON.stringify(path.join(__dirname,'../guild-leadership-v942/tests.cjs')))+'\nmodule.exports={setup};',virtual);
 ({f}=await m.exports.setup());
 for(const packet of cases){const before=f.bytes(),r=await f.call('/api/guild/raid/start',packet);results.push({packet,status:r.status,body:r.body,diskUnchanged:before===f.bytes(),pass:r.status===400&&before===f.bytes()});}
 if(!process.env.STRICT_START_CONTROL){a(results.every(x=>x.pass));const r=await f.call('/api/guild/raid/start',{requestId:'valid',heroIds:['vael']});a.equal(r.status,200);a.equal(r.body.entryBinding.requestId,'valid');a.equal(f.disk().users['fixture-user'].raidDay.n,1);results.push({case:'valid entry',pass:true,status:r.status});}
 fs.writeFileSync(path.join(__dirname,process.env.STRICT_START_CONTROL?'original-controls.json':'fixed-http.json'),JSON.stringify({atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),serverSHA256:hash(fs.readFileSync(file)),results,scope:'Actual isolated private HTTP, synthetic account. Shape only; no native/fullgame/balance approval.'},null,2));
 console.log(JSON.stringify(results));if(process.env.STRICT_START_CONTROL&&results.some(x=>!x.pass))process.exitCode=1;
 }finally{if(f)await f.stop();fs.writeFileSync(file,saved);a.equal(hash(fs.readFileSync(file)),hash(saved));console.log('Owned fixture stopped; original private snapshot restored');}
})().catch(e=>{console.error(e);process.exitCode=1});
