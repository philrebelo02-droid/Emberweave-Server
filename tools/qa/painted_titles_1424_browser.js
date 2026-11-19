'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const OUT=process.argv[2],fixture=JSON.parse(fs.readFileSync(path.join(OUT,'fixture.json'),'utf8'));
const LANGS=['en','es','pt-BR','fr','de','it','nl','ru','tr','ja','ko','zh-Hans','zh-Hant','th','id','hi'];
const TITLES=[
 ['arena','#arena h1','arena-title.webp'],['forge','#forge h1','forge-title.webp'],['dungeon','#dungeon .vtTitle','vault-title.webp'],
 ['rankings','#rankings .bb-title-art','bulletin-board-title-v1.webp'],['guild','#guild .titlebar h1','guild-hall-title.webp'],
 ['tech','#tech h1','academy-wordmark.webp'],['emberdraft','#edLobby .edl-logo','emberdraft-wordmark.webp'],
 ['market','#market h1','market-wordmark.webp'],['shadymarket','#shadymarket h1','shady-wordmark.webp'],
 ['arenaShop','#arenaShop .titlebar h1','arena-shop-title.webp'],['elite','#elite .titlebar h1','elite-stages-title.webp'],
 ['skyisland','#skyisland > .titlebar h1','island-of-trials-title.webp'],['skyfall','#skyfall .skyHud','skyfall-title.webp','::before'],
 ['temple','#temple #tp2Stage','temple-title.webp','::after'],['watchtower','#watchtower h1','watch-tower-title.webp'],
 ['wishing','#wishing .wpsTitle','wishing-pool-title.webp','::before'],['devpanel','#dvpOv .dvp-title img','title@2x.webp']
];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const browser=await chromium.launch({args:['--disable-audio-output','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu']});const report={checks:[],screenshots:[],pageErrors:[]};try{
 for(const [size,width,height,mobile]of [['desktop',1400,900,false],['phone',390,844,true]]){
  const ctx=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
  await ctx.addInitScript(account=>{localStorage.setItem('ew_acc',JSON.stringify(account));localStorage.setItem('ew_lang','en');localStorage.setItem('ew_guest_step_'+account.id,'1');},fixture.account);
  const page=await ctx.newPage();page.on('pageerror',e=>report.pageErrors.push({size,error:e.message}));await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.goto(fixture.base+'/play?lang=en',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>typeof LANG==='object'&&typeof renderHeroDetail==='function',null,{timeout:120000});await wait(1200);
  if(await page.locator('#tutSkip').isVisible().catch(()=>false))await page.locator('#tutSkip').click();
  if(await page.locator('.splashPlay').isVisible().catch(()=>false))await page.locator('.splashPlay').click();
  await page.evaluate(async()=>{G.tutDone=true;G.tutSkipped=true;G.ftutOff=true;await ledgerSync();G.tutDone=true;G.tutSkipped=true;G.ftutOff=true;});await wait(3000);
  const english=new Map();
  for(const code of mobile?['en','es']:LANGS){
   await page.evaluate(code=>langSet(code),code);await page.waitForFunction(code=>LANG.cur===code&&(code==='en'||(LANG.dictVersion===EW_LANG_V[code]&&LANG.contentVersion===EW_LANG_CV[code])),code,{timeout:60000});
   for(const [screen,selector,asset,pseudo]of TITLES){
    await page.evaluate(screen=>{document.getElementById('edLobby')?.remove();devPanelClose();closePopout();if(screen==='emberdraft'){show('skyisland');openEmberdraft();}else if(screen==='devpanel'){show('base');DEV.on=true;devPanelOpen();}else show(screen);document.querySelectorAll('#tutOffer').forEach(e=>e.remove());},screen);await wait(250);
    const result=await page.evaluate(async({selector,asset,pseudo})=>{const e=document.querySelector(selector);if(!e)return {missing:true};const style=getComputedStyle(e,pseudo||null),r=e.getBoundingClientRect(),src=e.currentSrc||'',background=style.backgroundImage,url=src||(background.match(/url\(["']?([^"')]+)/)||[])[1]||'';if(url){const img=new Image();img.src=url;await img.decode();}let visible=r.width>0&&r.height>0;for(let n=e;n;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||+s.opacity===0)visible=false;}return {visible,url,asset,background,pseudo:pseudo||null,width:r.width,height:r.height};},{selector,asset,pseudo});
    report.checks.push({size,code,screen,...result});assert(!result.missing&&result.visible,`${size}/${code}/${screen} title visible`);assert(result.url.includes('/'+asset),`${screen} original painted asset: ${result.url}`);
    const identity=new URL(result.url).pathname;if(code==='en')english.set(screen,identity);else assert.equal(identity,english.get(screen),`${code} ${screen} matches English logo`);
    if(code==='es'){const file=path.join(OUT,`${size}-es-title-${screen}.png`);await page.screenshot({path:file});report.screenshots.push(file);}
   }
  }await ctx.close();
 }
 assert.equal(report.pageErrors.length,0,'No page errors');report.passed=true;
}catch(e){report.passed=false;report.failure=String(e.stack||e);throw e;}finally{fs.writeFileSync(path.join(OUT,'painted-titles-report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,screenshots:report.screenshots.length,pageErrors:report.pageErrors.length,failure:report.failure}));}})().catch(e=>{console.error(e);process.exit(1);});
