// Isolated real-game crop and measured level-badge gaps at landscape phone size.
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const net=require('net');
const {spawn}=require('child_process');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
const output=process.argv[2];
if(!output)throw new Error('Pass one QA screenshot path');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-badge-'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const freePort=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
let child,browser;
(async()=>{
  const port=await freePort(),base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json')},stdio:'ignore',windowsHide:true});
  let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw new Error('QA server exited');try{ready=(await fetch(base+'/health')).ok;if(ready)break;}catch(_){}await delay(100);}
  assert(ready,'QA server started');
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:3});
  await page.goto(base+'/play');
  await page.getByText('Skip Tutorial',{exact:true}).click();
  await page.locator('#splashPlay').click();
  await page.evaluate(()=>show('heroesPanel'));
  const measurements=await page.locator('#heroesPanel .hero-card:has(.hc-lv)').evaluateAll(cards=>cards.slice(0,3).map(card=>{
    const frame=card.querySelector('.hc-imgwrap').getBoundingClientRect();
    const badge=card.querySelector('.hc-lv').getBoundingClientRect();
    return {hero:card.dataset.heroKey,leftGap:+(badge.left-frame.left).toFixed(2),topGap:+(badge.top-frame.top).toFixed(2),badgeWidth:+badge.width.toFixed(2)};
  }));
  assert.strictEqual(measurements.length,3,'three roster badges');
  for(const m of measurements){assert.strictEqual(m.leftGap,0);assert.strictEqual(m.topGap,0);}
  const card=page.locator('#heroesPanel .hero-card:has(.hc-lv)').first();
  await card.scrollIntoViewIfNeeded();
  const box=await card.boundingBox(),pad=22;
  await page.screenshot({path:output,clip:{x:Math.max(0,box.x-pad),y:Math.max(0,box.y-pad),width:Math.min(844-Math.max(0,box.x-pad),box.width+pad*2),height:Math.min(390-Math.max(0,box.y-pad),box.height+pad*2)}});
  console.log(JSON.stringify(measurements));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();
  if(child){child.kill();for(let i=0;i<40&&child.exitCode===null;i++)await delay(50);}
  const resolved=path.resolve(temp),parent=path.resolve(os.tmpdir());
  if(resolved.startsWith(parent+path.sep)&&path.basename(resolved).startsWith('ew-badge-'))fs.rmSync(resolved,{recursive:true,force:true});
});
