// Isolated real-browser campaign replay with server-owned Temple progress.
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const net=require('net');
const {spawn}=require('child_process');
const root=path.join(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-temple-replay-'));
const dbFile=path.join(temp,'db.json');
let server=null;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
async function run(){
  const port=await freePort(),base='http://127.0.0.1:'+port;
  const start=async()=>{
    server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});
    for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok)return;}catch(_){}await delay(100);}
    throw new Error('throwaway server did not start');
  };
  try{
    await start();
    const name='temple'+Date.now().toString(36);
    const reg=await (await fetch(base+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,pass:'password1'})})).json();
    assert(reg.token,'test account registration');
    await fetch(base+'/api/ledger',{headers:{'x-token':reg.token}});
    server.kill();await delay(350);
    const db=JSON.parse(fs.readFileSync(dbFile,'utf8')),u=db.users[reg.profile.id];
    const T=require('../server/temple-of-ash.js');
    u.led.px=99000000;u.led.temple=T.newState();u.led.temple.playerLevel=100;u.led.temple.keeperPoints=100000;
    for(const [i,key] of ['vael','sylthaine','vireo'].entries()){
      u.led.unlocked[key]=true;
      u.led.temple.heroes[key]={cinders:{bar1:60+i,bar2:50+i,bar3:40+i,bar4:30+i},boonsUnlocked:[true,true,true,false,false]};
    }
    fs.writeFileSync(dbFile,JSON.stringify(db));await start();
    const test=spawn(process.execPath,['tests/test_live_campaign.js'],{
      cwd:root,env:{...process.env,PORT:String(port),TEMPLE_TEST_NAME:name},stdio:'inherit',windowsHide:true});
    const code=await new Promise(resolve=>test.on('exit',resolve));
    assert.strictEqual(code,0,'Temple-progress campaign replay');
    console.log('temple replay: pass');
  }finally{
    if(server)server.kill();
    fs.rmSync(temp,{recursive:true,force:true});
  }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
