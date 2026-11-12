// LANGUAGES step 2: start this checkout's server (temp DB, free port) and a Chromium page on the game - shared by
// tools/lang/collect_content.js and tests/test_lang_coverage.js.  open({lang, query, viewport}) -> {page, browser, base, srv, close, errors}
'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),cp=require('child_process');
const ROOT=path.join(__dirname,'..','..');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{ const s=net.createServer(); s.listen(0,'127.0.0.1',()=>{ const p=s.address().port; s.close(()=>r(p)); }); });
async function startServer(extraEnv){ const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-lang-')), port=await freePort(), base='http://127.0.0.1:'+port;
  const log=fs.openSync(path.join(tmp,'srv.log'),'a');
  const srv=cp.spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,DATABASE_URL:'',DB_STORE:'',PORT:String(port),DB_FILE:path.join(tmp,'db.json'),RL_MUL:'1000',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',SIM_WORKERS:'0',ALLOW_NEW_GUESTS:'1',...(extraEnv||{})},stdio:['ignore',log,log],windowsHide:true});
  for(let i=0;i<300;i++){ try{ if((await fetch(base+'/api/health')).ok) return {srv,base,tmp}; }catch(_){} await delay(100); }
  throw new Error('server did not start (log: '+path.join(tmp,'srv.log')+')'); }
async function open(opts){ opts=opts||{};
  const {srv,base,tmp}=await startServer(opts.env);
  const { chromium }=require(path.join(ROOT,'node_modules','playwright'));
  const browser=await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args:['--disable-audio-output','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu']});
  const ctx=await browser.newContext({viewport:opts.viewport||{width:420,height:860},locale:opts.locale||'en-US'});
  if(opts.lang) await ctx.addInitScript(l=>{ try{ localStorage.setItem('ew_lang',l); }catch(e){} },opts.lang);
  const page=await ctx.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(String(e&&e.message||e)));
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.goto(base+'/play'+(opts.query||''),{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>typeof skillDesc==='function'&&typeof LANG==='object',null,{timeout:120000});
  const close=async()=>{ try{ await browser.close(); }catch(_){} try{ srv.kill(); }catch(_){} };
  return {page,browser,ctx,base,srv,tmp,close,errors}; }
module.exports={open,startServer,delay,ROOT};
