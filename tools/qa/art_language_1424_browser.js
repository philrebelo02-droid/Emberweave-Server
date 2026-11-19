'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
const OUT=process.argv[2],fixture=JSON.parse(fs.readFileSync(path.join(OUT,'fixture.json'),'utf8'));
const SHOT_LANGS=new Set(['en','es','de','ru','ja','zh-Hans']);
const LANGS=['en','es','de','ru','ja','zh-Hans','pt-BR','fr','it','nl','tr','ko','zh-Hant','th','id','hi'];
const ARENA_ONLY=process.argv.includes('--arena-only');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const browser=await chromium.launch({args:['--disable-audio-output','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu']});const report={screenshots:[],labels:[],logos:[],leagues:[],pageErrors:[]};try{
 for(const [size,width,height,mobile]of [['desktop',1400,900,false],['phone',390,844,true]]){
  const ctx=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
  await ctx.addInitScript(account=>{localStorage.setItem('ew_acc',JSON.stringify(account));localStorage.setItem('ew_lang','en');localStorage.setItem('ew_guest_step_'+account.id,'1');},fixture.account);
  const page=await ctx.newPage();page.on('pageerror',e=>report.pageErrors.push({size,error:e.message}));
  await page.route(/fonts\.(googleapis|gstatic)\.com/,route=>route.abort());
  await page.goto(fixture.base+'/play?lang=en',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>typeof renderHeroDetail==='function'&&typeof LANG==='object',null,{timeout:120000});
  await wait(1200);
  if(await page.locator('#tutSkip').isVisible().catch(()=>false))await page.locator('#tutSkip').click();
  if(await page.locator('.splashPlay').isVisible().catch(()=>false))await page.locator('.splashPlay').click();
  await page.evaluate(async()=>{G.tutDone=true;G.tutSkipped=true;G.ftutOff=true;await ledgerSync();G.tutDone=true;G.tutSkipped=true;G.ftutOff=true;});
  await wait(3000);
  const shot=async(code,name)=>{if(!SHOT_LANGS.has(code))return;const file=path.join(OUT,`${size}-${code}-${name}.png`);await page.screenshot({path:file});report.screenshots.push(file);};
  for(const code of LANGS){
   if(ARENA_ONLY&&!SHOT_LANGS.has(code))continue;
   await page.evaluate(code=>langSet(code),code);
   await page.waitForFunction(code=>LANG.cur===code&&(code==='en'||(LANG.dictVersion===EW_LANG_V[code]&&LANG.contentVersion===EW_LANG_CV[code])),code,{timeout:60000});
   await page.evaluate(()=>document.fonts.ready);await wait(100);
   if(!ARENA_ONLY&&SHOT_LANGS.has(code))for(const [screen,selector,asset]of [['market','#market h1','market-wordmark.webp'],['shadymarket','#shadymarket h1','shady-wordmark.webp'],['tech','#tech h1','academy'],['rankings','#rankings .bb-title-art','bulletin-board-title-v1.webp']]){
    await page.evaluate(screen=>{closePopout();show(screen);document.querySelectorAll('#tutOffer').forEach(e=>e.remove());},screen);await wait(500);
    const logo=await page.evaluate(([selector,asset])=>{const element=document.querySelector(selector);if(!element)return {missing:true};const style=getComputedStyle(element),rect=element.getBoundingClientRect();return {selector,asset,visible:rect.width>0&&rect.height>0&&style.display!=='none',background:style.backgroundImage,src:element.currentSrc||'',naturalWidth:element.naturalWidth||0};},[selector,asset]);
    report.logos.push({size,code,...logo});assert(logo.visible,`${code} ${screen} logo visible`);if(screen==='rankings')assert(logo.src.includes(asset)&&logo.naturalWidth>0);else if(screen!=='tech')assert(logo.background.includes(asset));else assert(!logo.background.includes('none'),'Academy painted background');await shot(code,screen);
   }
   if(!ARENA_ONLY)for(const rarity of ['common','uncommon','rare','mythical']){
    await page.evaluate(rarity=>{closePopout();show('heroesPanel');detailHero=HERO_KEYS.find(k=>heroRarity(k)===rarity);if(!detailHero)throw Error('No '+rarity+' hero');heroTab='stats';popoutScreen('heroDetail');document.querySelectorAll('#tutOffer').forEach(e=>e.remove());},rarity);
    await page.waitForFunction(rarity=>{const img=document.querySelector('#heroDetail .hd-rarb.rb-'+rarity+' img');return img&&img.complete&&img.naturalWidth>0;},rarity,{timeout:30000});await page.evaluate(()=>fitRarityBanners(document.getElementById('heroDetail')));await wait(100);
    const result=await page.evaluate(rarity=>{const box=document.querySelector('#heroDetail .hd-rarb.rb-'+rarity),label=box.querySelector('.hd-rarb-label'),image=box.querySelector('img'),style=getComputedStyle(label),rect=label.getBoundingClientRect();return {rarity,text:label.textContent,expected:ewT('herolist.rarity_'+rarity),image:image.currentSrc,clientWidth:label.clientWidth,scrollWidth:label.scrollWidth,fontSize:parseFloat(style.fontSize),height:rect.height,fill:style.webkitTextFillColor,background:style.backgroundImage};},rarity);
    report.labels.push({size,code,...result});assert(result.text===result.expected,`${code} ${rarity} translated`);assert(result.image.includes('/'+rarity+'.webp')&&!result.image.includes('-word.webp'));assert(result.clientWidth>0&&result.scrollWidth<=result.clientWidth+1,`${code} ${rarity} label fits: ${result.scrollWidth}/${result.clientWidth}`);assert(result.height>0&&result.fontSize>=8);if(mobile)await page.locator('#heroDetail .hd-rarb').scrollIntoViewIfNeeded();await shot(code,'hero-'+rarity);
   }
   if(SHOT_LANGS.has(code)){
    await page.evaluate(()=>{closePopout();show('arena');});await wait(600);
    const league=await page.evaluate(async()=>{const seen=[];for(const row of ARENA_LEAGUES){const rank=row.max===null?1001:row.max,league=arenaLeague(rank),image=new Image();image.src=league.art;await image.decode();seen.push({id:row.id,name:league.name,rank,art:league.art,width:image.naturalWidth,height:image.naturalHeight});}return seen;});report.leagues.push({size,code,tiers:league});assert(league.length===10&&league.every(row=>row.width===256&&row.height===256));await shot(code,'arena');
   }
  }await ctx.close();
 }
 assert(report.pageErrors.length===0,'Page errors: '+JSON.stringify(report.pageErrors));report.passed=true;
}catch(e){report.passed=false;report.failure=String(e.stack||e);throw e;}finally{fs.writeFileSync(path.join(OUT,ARENA_ONLY?'browser-arena-final-report.json':'browser-art-language-report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({passed:report.passed,screenshots:report.screenshots.length,labels:report.labels.length,logos:report.logos.length,leagueMatrices:report.leagues.length,pageErrors:report.pageErrors.length,failure:report.failure}));}})().catch(e=>{console.error(e);process.exit(1);});
