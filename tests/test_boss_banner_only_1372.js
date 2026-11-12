// v1372 (Phil 11 Nov: "I only want boss banner on boss fights, not ever stage. that means x-10 for campaign and every 5 level in vault").
// The BOSS INCOMING ribbon (bossIntro) runs only when isBossFight(): campaign x-10 (any chapter, any portal) and Vault floors 5, 10, 15 ...
// Every other last wave shows "WAVE n". Checks the rule table in the real page and that both wave-start call sites go through it.
// CONTROL: EW_ROOT=<a v1371 copy> fails (no isBossFight; every last wave called bossIntro).
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const ROOT=process.env.EW_ROOT?path.resolve(process.env.EW_ROOT):path.join(__dirname,'..');
const {chromium}=require(require.resolve('playwright',{paths:[ROOT,__dirname]}));
const delay=ms=>new Promise(r=>setTimeout(r,ms)); let child,browser,fails=0,checks=0;
const ok=(c,m)=>{ checks++; if(c) console.log('  ok   '+m); else { fails++; console.log('  FAIL '+m); } };
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
(async()=>{ try{
  const src=fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8');
  ok((src.match(/waveIdx===chapterWaves-1&&isBossFight\(\)\) bossIntro\(\)/g)||[]).length===2,'both wave-start sites show the boss ribbon only through isBossFight()');
  ok(!/waveIdx===chapterWaves-1\) bossIntro\(\)/.test(src),'no site shows it on every last wave any more');
  const port=await freePort(), base='http://127.0.0.1:'+port, temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-bossonly-'));
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,PORT:String(port),DB_FILE:path.join(temp,'db.json')},stdio:'ignore',windowsHide:true});
  for(let i=0;i<200;i++){ try{ if((await fetch(base+'/api/health')).ok) break; }catch(_){} await delay(150); }
  browser=await chromium.launch({ignoreDefaultArgs:['--mute-audio'],args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  const page=await (await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'})).newPage();
  await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
  await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof isBossStage==='function'&&typeof CUR!=='undefined',null,{timeout:120000});
  const R=await page.evaluate(()=>{ if(typeof isBossFight!=='function') return null; const keep=CUR, out={};
    const t=(k,c)=>{ CUR=c; out[k]=isBossFight(); };
    t('c1-3',{mode:'campaign',node:3}); t('c1-9',{mode:'campaign',node:9}); t('c1-10',{mode:'campaign',node:10}); t('c2-10',{mode:'campaign',node:20}); t('c16-10',{mode:'campaign',node:160}); t('c2-1',{mode:'campaign',node:11});
    t('v4',{mode:'vault',floor:4}); t('v5',{mode:'vault',floor:5}); t('v10',{mode:'vault',floor:10}); t('v11',{mode:'vault',floor:11}); t('v50',{mode:'vault',floor:50});
    for(const m of ['arena','province','well','graid','emberdraft','online','replay','raid','dungeon']) t(m,{mode:m,node:10,floor:10});
    CUR=keep; return out; });
  ok(R!==null,'isBossFight exists');
  if(R){ ok(R['c1-10']&&R['c2-10']&&R['c16-10'],'campaign x-10 stages are boss fights (1-10, 2-10, 16-10)');
    ok(!R['c1-3']&&!R['c1-9']&&!R['c2-1'],'campaign 1-3, 1-9 and 2-1 are not');
    ok(R.v5&&R.v10&&R.v50,'Vault floors 5, 10 and 50 are boss fights');
    ok(!R.v4&&!R.v11,'Vault floors 4 and 11 are not');
    const other=['arena','province','well','graid','emberdraft','online','replay','raid','dungeon'].filter(m=>R[m]);
    ok(other.length===0,'no other mode shows the boss banner ('+(other.join(',')||'none')+')'); }
} catch(e){ fails++; console.log('  FAIL '+(e&&e.message||e)); }
  finally{ try{ await browser.close(); }catch(_){} if(child){ child.kill(); for(let i=0;i<100&&child.exitCode===null&&child.signalCode===null;i++) await delay(50); } }
  console.log('test_boss_banner_only_1372.js: '+(checks-fails)+'/'+checks+' passed, '+fails+' failed'); process.exit(fails?1:0); })();
