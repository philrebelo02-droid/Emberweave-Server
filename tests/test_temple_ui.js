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
      u.led.temple.heroes[key]={steps:{health:40+i,attack:30+i,armorMr:20+i,pen:10+i},boonsUnlocked:[true,true,false,false,false]};   /* v1094: Temple v2 steps (flat stats + blessings) - the card power parity below covers them */
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
    assert(await page.locator('#tp2Stage .tp2Plate').count(),'the Temple of Ash stage renders (v1094 screen)');
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
    /* v1094 (Phil 9 Oct: copy the reference screen): no class tabs, a hero grid sorted by %, then one hero's prayer screen */
    await page.evaluate(()=>{G.playerXP=Number.MAX_SAFE_INTEGER;RUNE2.enabled=false;G.glyphRank=G.glyphRank||{};HERO_KEYS.filter(k=>G.unlocked[k]).forEach(k=>G.glyphRank[k]=TempleOfAsh.CONFIG.MIN_ASCENSION_INDEX);templeView='grid';renderTemple();});
    assert.strictEqual(await page.locator('.templeClassTab').count(),0,'no class tabs and no All button');
    const owned=await page.evaluate(()=>HERO_KEYS.filter(k=>G.unlocked[k]));
    assert.strictEqual(await page.locator('.tp2Tile').count(),owned.length,'every Purple hero is on the grid');
    const pcts=await page.locator('.tp2Tile b').allTextContents();
    assert.deepStrictEqual(pcts.map(x=>parseInt(x)),pcts.map(x=>parseInt(x)).slice().sort((a,b)=>b-a),'the grid is sorted by completion %');
    const first=await page.locator('.tp2Tile').first().getAttribute('data-tp2-hero');
    await page.locator('.tp2Tile').first().click();
    assert.strictEqual(await page.evaluate(()=>[templeView,templeSelectedHero].join()),'pray,'+first,'tapping a hero opens its prayer screen');
    assert.strictEqual(await page.locator('.tp2Bar').count(),4,'four bars');
    assert(await page.locator('.tp2Bust').count(),'the hero stands in the Temple window');
    assert.strictEqual(await page.locator('.tp2Bless').count(),5,'Blessings 1-4 plus the 5th dot');
    assert(await page.locator('.tp2KeeperPlate').getByText('Flame Keeper').count(),'the Flame Keeper plate');
    assert.strictEqual(await page.locator('.tp2Opt[data-tp2-tier="gold"]').count(),1,'the Gold ritual is in the tier checklist');
    await page.evaluate(()=>{G.temple.keeperPoints=0;renderTemple();});
    assert(await page.locator('[data-tp2-tier="kindled"]').isDisabled(),'a locked tier cannot be chosen');
    await page.evaluate(()=>{G.temple.keeperPoints=100000;G.gold=0;G.gems=0;renderTemple();});
    assert(await page.locator('[data-tp2-tier="gold"]').isDisabled(),'unaffordable Gold ritual is greyed out');
    await page.evaluate(()=>{G.gold=TempleOfAsh.nextGoldCost(G.temple);renderTemple();});
    assert(await page.locator('[data-tp2-tier="gold"]').isEnabled(),'Gold reopens when the wallet can pay');
    await page.evaluate(()=>{G.temple.bonusPrayers=1;renderTemple();});
    assert.strictEqual(await page.locator('[data-tp2-tier="bonus"]').count(),1,'a banked bonus prayer is offered');
    for(const vp of [{width:844,height:390},{width:390,height:844},{width:320,height:700}]){
      await page.setViewportSize(vp); await page.evaluate(()=>renderTemple()); await page.waitForTimeout(100);
      const box=await page.evaluate(()=>{const s=document.getElementById('tp2Stage').getBoundingClientRect();return {w:s.width,h:s.height,r:s.right,b:s.bottom,vw:innerWidth,vh:innerHeight};});
      assert(Math.abs(box.w/box.h-16/9)<0.02&&box.r<=box.vw+1&&box.b<=box.vh+1,'the 16:9 stage fits '+JSON.stringify(vp)+' '+JSON.stringify(box));
    }
    if(process.env.TEMPLE_SCREENSHOT_PATH)await page.screenshot({path:process.env.TEMPLE_SCREENSHOT_PATH});
    assert.deepStrictEqual(errors,[],'browser errors');
    console.log('temple UI and three-hero card power parity: pass');
  }finally{
    if(browser)await browser.close();
    if(child)child.kill();
    fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
