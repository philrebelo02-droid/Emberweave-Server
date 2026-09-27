// A reset must not resurrect an old tutorial or one-hero campaign squad from cloud save.
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const net=require('net');
const {spawn}=require('child_process');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-reset-onboarding-'));
let child,browser;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
(async()=>{
  try{
    const port=await freePort(),base='http://127.0.0.1:'+port;
    child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json')},stdio:'ignore',windowsHide:true});
    let ready=false;
    for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch(_){}await delay(100);}
    assert(ready,'throwaway server did not start');
    const stale={tutStarted:true,tutRewarded:{win11:true},tutFocusStep:'quest11',questChainStep:1,squads:{campaign:['vireo']}};
    const deviceId='reset-onboarding-'+Date.now();
    const guest=await (await fetch(base+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId,roster:{__save:JSON.stringify(stale)}})})).json();
    assert(guest.token,'throwaway guest account');
    const headers={'Content-Type':'application/json','x-token':guest.token};
    const before=await (await fetch(base+'/api/profile',{headers})).json();
    assert.deepStrictEqual(JSON.parse(before.profile.roster.__save).squads.campaign,['vireo'],'fixture has old one-hero squad');
    const reset=await (await fetch(base+'/api/account/reset-progress',{method:'POST',headers,body:'{}'})).json();
    assert(reset.ok,'reset receipt');
    assert.strictEqual(reset.ledger.camp.cleared,0,'campaign reset on server');
    const after=await (await fetch(base+'/api/profile',{headers})).json();
    const cloud=after.profile.roster&&after.profile.roster.__save?JSON.parse(after.profile.roster.__save):{};
    assert(!cloud.tutRewarded?.win11,'reset must clear stale completed tutorial step from cloud');
    assert(!cloud.tutFocusStep,'reset must clear stale tutorial target from cloud');
    assert(!cloud.squads?.campaign||cloud.squads.campaign.length===3,'reset must not preserve a one-hero campaign squad');
    assert.deepStrictEqual(after.profile.team.map(x=>x.key),['vael','sylthaine','vireo'],'server team returns to starters');
    const resumed=await (await fetch(base+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId,roster:{__save:JSON.stringify(stale)}})})).json();
    assert(resumed.token,'guest resumes after reset');
    assert(!JSON.parse(resumed.profile.roster.__save).tutRewarded?.win11,'stale device seed cannot revive old tutorial');
    try{browser=await chromium.launch();}catch(_){browser=await chromium.launch({channel:'chrome'});}
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(id=>localStorage.setItem('ew_device',id),deviceId);
    await page.goto(base+'/play',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1000);
    await page.evaluate(()=>{const p=document.querySelector('.splashPlay');if(p)p.click();});
    await page.waitForFunction(()=>ACC.token&&_cloudReady,null,{timeout:10000});
    assert.deepStrictEqual(await page.evaluate(()=>squadFor('campaign')),['vael','sylthaine','vireo'],'fresh browser fields all three starters');
    await page.locator('#tutStart').click();
    await page.locator('[data-tut-go="win11"]').click();
    assert.strictEqual(await page.evaluate(()=>state),'campaign','reset tutorial starts at win11 and opens Campaign');
    await page.evaluate(()=>openStageModal(1,'normal'));
    assert(await page.locator('#smBattle').isEnabled(),'Stage 1-1 Fight Now is enabled after reset');
    await page.locator('#smBattle').click();
    assert.strictEqual(await page.evaluate(()=>state),'menu','Fight Now opens the starter-squad screen');
    await page.evaluate(()=>{G.stamina=5;show('campaign');openStageModal(1,'normal');});
    assert(await page.locator('#smBattle').isDisabled(),'Fight Now is disabled below the six-stamina stage cost');
    assert(await page.locator('#stageModalBody').getByText('Not enough stamina.').count(),'low stamina is explained in the stage card');
    assert.deepStrictEqual(errors,[],'no browser errors');
    console.log('reset onboarding cloud and squad: pass');
  }finally{
    if(browser)await browser.close();
    if(child)child.kill();
    fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
