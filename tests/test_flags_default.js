/* v258 — the three v2 systems must be ON for a NORMAL player straight out of the box, with no
   Railway variable set. Boots the server with a clean environment (flags deliberately unset) and
   reads the production manifest plus a real non-dev account's own view. */
const {spawn}=require('child_process'), http=require('http'), fs=require('fs'), os=require('os'), path=require('path');
let PASS=0, FAIL=0;
const ck=(n,c,x)=>{ if(c){PASS++;console.log('  ✓ '+n);} else {FAIL++;console.log('  ✗ '+n+(x?' — '+x:''));} };
const PORT=8893, DB=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'flg')),'db.json');
const env=Object.assign({},process.env,{DB_FILE:DB,PORT:String(PORT),REG_PER_MIN:'200',REG_ACCOUNTS_PER_IP:'200'});
delete env.DUNGEON_V2_ENABLED; delete env.GEAR_V2_ENABLED; delete env.GUILD_WAR_V2_ENABLED; delete env.ADMIN_IDS;
const srv=spawn('node',[path.join(__dirname,'..','server.js')],{env,stdio:'ignore'});
function req(method,p,body,token){ return new Promise((res,rej)=>{ const d=body?JSON.stringify(body):null;
  const r=http.request({host:'localhost',port:PORT,method,path:p,headers:Object.assign({'content-type':'application/json'},
    token?{'x-token':token}:{}, d?{'content-length':Buffer.byteLength(d)}:{})},resp=>{ let b='';
    resp.on('data',c=>b+=c); resp.on('end',()=>{ try{res(JSON.parse(b));}catch(e){res({raw:b});} }); });
  r.on('error',rej); if(d)r.write(d); r.end(); }); }
const done=code=>{ try{srv.kill();}catch(e){} process.exit(code); };

(async()=>{
  console.log('== v2 systems ship ON by default (no Railway variable needed) ==');
  await new Promise(r=>setTimeout(r,1800));
  const m=await req('GET','/api/manifest');
  ck('the production manifest answers', !!m.flags, JSON.stringify(m).slice(0,120));
  ck('DUNGEON_V2_ENABLED defaults to true', m.flags&&m.flags.DUNGEON_V2_ENABLED===true, String(m.flags&&m.flags.DUNGEON_V2_ENABLED));
  ck('GEAR_V2_ENABLED defaults to true', m.flags&&m.flags.GEAR_V2_ENABLED===true, String(m.flags&&m.flags.GEAR_V2_ENABLED));
  ck('GUILD_WAR_V2_ENABLED defaults to true', m.flags&&m.flags.GUILD_WAR_V2_ENABLED===true, String(m.flags&&m.flags.GUILD_WAR_V2_ENABLED));
  // and a REAL non-dev account can actually reach them (dev accounts bypass flags — that is the
  // exact mistake this suite exists to stop us repeating)
  const reg=await req('POST','/api/register',{name:'flagcheck1',pass:'password1'});
  ck('a fresh normal account registers', !!reg.token, JSON.stringify(reg).slice(0,120));
  const gear=await req('GET','/api/gear/state',null,reg.token);
  ck('a normal player reaches the Forge', gear.enabled===true, JSON.stringify(gear).slice(0,120));
  const vault=await req("GET","/api/dungeon/status",null,reg.token);
  ck('a normal player reaches the Vault', vault.enabled!==false && !vault.error, JSON.stringify(vault).slice(0,120));
  console.log(''); console.log('PASS: '+PASS+'  FAIL: '+FAIL);
  done(FAIL?1:0);
})().catch(e=>{ console.error(e); done(1); });
