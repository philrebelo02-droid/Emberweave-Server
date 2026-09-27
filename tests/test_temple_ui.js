// Throwaway local server: the Temple panel must boot without a browser error.
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const net=require('net');
const {spawn}=require('child_process');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-temple-ui-'));
let child,browser;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
(async()=>{
  try{
    const port=await freePort(),base='http://127.0.0.1:'+port;
    const dbFile=path.join(temp,'db.json');
    const start=()=>{child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DB_FILE:dbFile},stdio:'ignore',windowsHide:true});};
    start();
    let ready=false;
    for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch(_){}await delay(100);}
    assert(ready,'throwaway server did not start');
    const guest=await (await fetch(base+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:'temple-ui-'+Date.now()})})).json();
    await fetch(base+'/api/ledger',{headers:{'x-token':guest.token}});
    const bases=require('../server/sim.js').HERO_BASE,seen=new Set();
    const keys=Object.keys(bases).filter(k=>{if(seen.has(bases[k].role))return false;seen.add(bases[k].role);return true;}).slice(0,3);
    const classes=['Tank','Bruiser','Assassin','Marksman','Mage','Support'];
    const classKeys=classes.map(c=>Object.keys(bases).find(k=>bases[k].role===c));
    const rosterKeys=[...classKeys,...Object.keys(bases).filter(k=>!classKeys.includes(k)).slice(0,6)];
    child.kill();await delay(350);
    const db=JSON.parse(fs.readFileSync(dbFile,'utf8')),u=db.users[guest.profile.id];
    u.led.px=99000000;
    const T=require('../server/temple-of-ash.js');
    u.led.temple=T.newState();u.led.temple.playerLevel=100;u.led.temple.keeperPoints=100000;
    for(const key of rosterKeys)u.led.unlocked[key]=true;
    for(const [i,key] of keys.entries()){
      u.led.unlocked[key]=true;
      u.led.temple.heroes[key]={cinders:{bar1:40+i,bar2:30+i,bar3:20+i,bar4:10+i},boonsUnlocked:[true,true,false,false,false]};
    }
    fs.writeFileSync(dbFile,JSON.stringify(db));start();
    for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok)break;}catch(_){}await delay(100);}
    try{browser=await chromium.launch();}catch(_){browser=await chromium.launch({channel:'chrome'});}
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/play',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(2000);
    await page.evaluate(()=>{const p=document.querySelector('.splashPlay');if(p)p.click();});
    await page.waitForTimeout(700);
    if(await page.locator('#tutSkip').isVisible())await page.locator('#tutSkip').click();
    await page.evaluate(()=>renderTemple());
    assert(await page.locator('#templeBody').getByText('Temple of Ash').count());
    const parity=await page.evaluate(async({token,keys})=>{
      ACC.token=token;ACC.id='temple-test';
      adoptLedger(await api('/api/ledger'));
      show('temple');
      const mine=Object.fromEntries(keys.map(k=>[k,heroPower(k)]));
      const lines=await api('/api/guild-war/lines');
      return {mine,lines};
    },{token:guest.token,keys});
    assert(parity.lines&&parity.lines.ok,'server guild-war power view');
    const server=Object.fromEntries([...(parity.lines.bench||[]),...(parity.lines.lines||[]).flatMap(l=>l.heroes||[])].map(h=>[h.key,h.power]));
    for(const key of keys)assert.strictEqual(parity.mine[key],server[key],key+' client/server Temple card power');
    const owned=await page.evaluate(()=>HERO_KEYS.filter(k=>G.unlocked[k]));
    assert.deepStrictEqual(await page.locator('.templeClassTab').allTextContents(),['All',...classes],'seven class tabs');
    assert(owned.length>10,'fixture has enough owned heroes to wrap');
    assert.strictEqual(await page.locator('.templeHeroTile').count(),owned.length,'all owned heroes are shown');
    const grid=await page.locator('.templeHeroGrid').evaluate(el=>({
      columns:getComputedStyle(el).gridTemplateColumns.split(' ').length,
      rows:new Set([...el.children].map(x=>Math.round(x.getBoundingClientRect().top))).size}));
    assert.deepStrictEqual(grid,{columns:10,rows:Math.ceil(owned.length/10)},'owned heroes wrap after ten per row');
    for(const role of classes){
      await page.locator(`[data-temple-class="${role}"]`).click();
      const shown=await page.locator('.templeHeroTile').evaluateAll(els=>els.map(x=>x.dataset.templeHero));
      assert.deepStrictEqual(shown,owned.filter(k=>bases[k].role===role),role+' filter shows only its heroes');
      assert.strictEqual(await page.evaluate(()=>templeSelectedHero),shown[0],role+' picks its first hero');
    }
    await page.locator('[data-temple-class="All"]').click();
    await page.locator('.templeHeroTile').nth(1).click();
    assert.strictEqual(await page.evaluate(()=>templeSelectedHero),owned[1],'tapping a portrait selects that hero');
    assert.strictEqual(await page.locator('.templeTierTile:not(.templeBonusChoice)').count(),6,'three rows of two prayer choices');
    const tierGrid=await page.locator('.templeTierGrid').evaluate(el=>({
      columns:getComputedStyle(el).gridTemplateColumns.split(' ').length,
      rows:new Set([...el.children].map(x=>Math.round(x.getBoundingClientRect().top))).size,
      art:[...el.querySelectorAll('img')].every(x=>x.complete&&x.naturalWidth>0)}));
    assert.deepStrictEqual(tierGrid,{columns:2,rows:3,art:true},'six illustrated choices form three rows of two');
    await page.evaluate(()=>{G.temple.keeperPoints=0;renderTemple();});
    const locked=page.locator('[data-temple-tier="kindled"]');
    assert(await locked.isDisabled(),'locked prayer cannot be chosen');
    assert.strictEqual(await locked.evaluate(el=>getComputedStyle(el).filter),'grayscale(1)','locked prayer art is greyed out');
    await page.evaluate(()=>{G.temple.bonusPrayers=1;renderTemple();});
    assert.strictEqual(await page.locator('.templeTierGrid .templeTierTile').count(),6,'banked bonus does not displace a regular choice');
    await page.locator('.templeBonusChoice').click();
    assert.strictEqual(await page.evaluate(()=>templeSelectedTier),'bonus','bonus prayer remains selectable separately');
    await page.evaluate(()=>{G.temple.bonusPrayers=0;renderTemple();});
    assert.strictEqual(await page.evaluate(()=>templeSelectedTier),'gold','spent bonus falls back to Gold');
    if(process.env.TEMPLE_SCREENSHOT_PATH)await page.locator('#templeBody').screenshot({path:process.env.TEMPLE_SCREENSHOT_PATH});
    await page.locator('#templePray').scrollIntoViewIfNeeded({timeout:3000});
    assert(await page.locator('#templePray').isVisible(),'phone can reach Pray button');
    if(process.env.TEMPLE_SCREENSHOT_PATH){
      await page.screenshot({path:process.env.TEMPLE_SCREENSHOT_PATH.replace(/\.png$/,'-prayer.png')});
      await page.setViewportSize({width:844,height:390});
      await page.locator('.templeClassTabs').scrollIntoViewIfNeeded({timeout:3000});
      await page.screenshot({path:process.env.TEMPLE_SCREENSHOT_PATH.replace(/\.png$/,'-landscape-top.png')});
      await page.locator('.templeTierGrid').scrollIntoViewIfNeeded({timeout:3000});
      await page.screenshot({path:process.env.TEMPLE_SCREENSHOT_PATH.replace(/\.png$/,'-landscape-tiers.png')});
    }
    assert.deepStrictEqual(errors,[],'browser errors');
    console.log('temple UI and three-hero card power parity: pass');
  }finally{
    if(browser)await browser.close();
    if(child)child.kill();
    fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
