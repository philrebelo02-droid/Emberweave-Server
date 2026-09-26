'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');

async function port(){
  const s=net.createServer();
  await new Promise(r=>s.listen(0,'127.0.0.1',r));
  const n=s.address().port;
  await new Promise(r=>s.close(r));
  return n;
}

async function run(){
  const root=path.join(__dirname,'..');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ember-war-current-'));
  const db=path.join(temp,'db.json'), n=await port(), base=`http://127.0.0.1:${n}`;
  let child;
  const req=async(method,route,data,token)=>{
    const res=await fetch(base+route,{method,headers:{...(token?{'x-token':token}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    return res.json();
  };
  const start=async adminId=>{
    child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,PORT:String(n),DB_FILE:db,ADMIN_IDS:adminId||'',NODE_ENV:'test',REG_PER_MIN:'200',REG_ACCOUNTS_PER_IP:'200'}});
    for(let i=0;i<100;i++){
      if(child.exitCode!==null) throw Error('fixture server exited');
      try{if((await fetch(base+'/health')).ok)return;}catch(_){}
      await new Promise(r=>setTimeout(r,100));
    }
    throw Error('fixture server not ready');
  };
  const stop=async()=>{
    if(!child)return;
    const c=child;child=null;c.kill();
    await Promise.race([new Promise(r=>c.once('exit',r)),new Promise(r=>setTimeout(r,2000))]);
  };
  try{
    await start('');
    const dev=await req('POST','/api/register',{name:'warAdmin',pass:'password1'});
    assert.ok(dev.token&&dev.profile.id);
    await stop();
    await start(dev.profile.id);
    const a=await req('POST','/api/register',{name:'warAlpha',pass:'password1'});
    const b=await req('POST','/api/register',{name:'warBeta',pass:'password1'});
    assert.ok(a.token&&b.token);
    const keys=['vael','sylthaine','vireo','vex','tallow'];
    for(const u of [a,b]){
      const grant=await req('POST','/api/admin/led-grant',{userId:u.profile.id,unlock:keys,heroKeys:keys,heroXp:200000,px:900000},dev.token);
      assert.equal(grant.ok,true,JSON.stringify(grant));
      const guild=await req('POST','/api/guild/create',{name:u===a?'War Alpha':'War Beta'},u.token);
      assert.ok(guild.guild?.id,JSON.stringify(guild));
    }
    const status=await req('GET','/api/guild-war/status',null,a.token);
    assert.equal(status.enabled,true);
    const t=status.tournament, now=Date.now();
    let opening=t.registrationOpensAt;
    if(now>=t.registrationLocksAt)opening+=7*86400000;
    const target=Math.max(now,opening+60000);
    const warp=async at=>req('POST','/api/guild-war/debug-warp',{offsetMs:at-Date.now()},dev.token);
    assert.equal((await warp(target)).state,'registration');
    const active=await req('GET','/api/guild-war/status',null,a.token);
    const registrationLocksAt=active.tournament.registrationLocksAt;
    for(const u of [a,b]){
      const reg=await req('POST','/api/guild-war/register',{},u.token);
      assert.equal(reg.ok,true,JSON.stringify(reg));
      const placed=await req('POST','/api/guild-war/place',{lane:0},u.token);
      assert.equal(placed.ok,true,JSON.stringify(placed));
    }
    const bracket=await warp(registrationLocksAt+60000);
    assert.equal(bracket.state,'bracket',JSON.stringify(bracket));
    const afterLock=await req('GET','/api/guild-war/status',null,a.token);
    const firstRound=afterLock.tournament.bracket[0];
    assert.ok(firstRound&&firstRound.schedule);
    await warp(firstRound.schedule.lockAt+60000);
    const live=await req('GET','/api/guild-war/match',null,a.token);
    assert.equal(live.match?.state,'live',JSON.stringify(live));
    const beforeA=await req('GET','/api/witch/state',null,a.token);
    const beforeB=await req('GET','/api/witch/state',null,b.token);
    const assault=await req('POST','/api/guild-war/assault',{fromLane:0},a.token);
    assert.equal(assault.ok,true,JSON.stringify(assault));
    assert.ok(assault.result?.aState&&assault.result?.bState,'a real fight occurred');
    const afterA=await req('GET','/api/witch/state',null,a.token);
    const afterB=await req('GET','/api/witch/state',null,b.token);
    assert.equal(beforeA.heroes.length+beforeB.heroes.length,0);
    assert.ok([...assault.result.aState,...assault.result.bState].some(h=>h.hp<h.maxHp),
      'the war battle caused at least one wound');
    for(const [rows,view] of [[assault.result.aState,afterA],[assault.result.bState,afterB]]){
      for(const row of rows.filter(h=>h.hp<h.maxHp)){
        const wound=view.heroes.find(h=>h.key===row.key);
        assert.ok(wound,`${row.key} war injury must persist in its owner's Witches Hut`);
        assert.equal(wound.hp,Math.round(row.hp/row.maxHp*10000));
      }
    }
  }finally{await stop();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
