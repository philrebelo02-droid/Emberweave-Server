// v1372 GUILD RANKS - the Guild Hall UI on the real page, at phone 844x390, Fold 882x344 and PC 1440x800 (the browser half of
// tests/test_guild_ranks_1372.js). A throwaway server with one guild: leader grLead, Officer grOff, Members grAnna / grBram, a join
// request from grJoin. Checks, per size:
//  - leader: the chat roster names each member's rank; the Ranks tab has a rank picker per member and the Ranks panel (rename, move,
//    delete, one checkbox per permission, Add rank); adding a rank, ticking a permission, assigning it from a picker and deleting it
//    through the UI each land on the SERVER (read back from /api/guild/mine);
//  - Member: Ranks read-only (no picker, no inputs, every box disabled), no Requests tab, the header button is Leave;
//  - Officer: the Requests tab and the Manage button, the Ranks still read-only;
//  - layout: no horizontal page scroll, both columns inside the viewport, every permission label inside its column, no page errors;
//  - no emoji characters in the new tab (the owner's rule).
// SHOTS=<dir> saves leader / member views of the member list and the Ranks panel per size. Exits non-zero on any failure.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'), srvFile=process.env.AUD_SERVER||'server.js';
const {chromium}=require('playwright');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ew-granksui-')), dbFile=path.join(temp,'db.json');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
let child,browser,fails=0,checks=0,base;
const ok=(c,msg)=>{ checks++; if(c) console.log('  ok   '+msg); else { fails++; console.log('  FAIL '+msg); } };
const env=port=>({...process.env,DATABASE_URL:'',PORT:String(port),DB_FILE:dbFile,ALLOW_NEW_GUESTS:'1',REG_PER_MIN:'500',REG_ACCOUNTS_PER_IP:'500',RL_MUL:'1000'});
async function up(){ for(const t0=Date.now();Date.now()-t0<60000;){ try{ if((await fetch(base+'/api/health')).ok) return; }catch(_){} await delay(150); } throw new Error('server did not start'); }
async function stop(){ if(!child) return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++) await delay(50); child=null; await delay(300); }
const J=async(p,b,tok)=>(await fetch(base+p,{method:b?'POST':'GET',headers:Object.assign({'content-type':'application/json'},tok?{'x-token':tok}:{}),body:b?JSON.stringify(b):undefined})).json();
const EMOJI=/\p{Extended_Pictographic}/u;
(async()=>{ try{
  const port=await freePort(); base='http://127.0.0.1:'+port;
  child=spawn(process.execPath,[srvFile],{cwd:ROOT,env:env(port),stdio:'ignore',windowsHide:true}); await up();
  const names=['grLead','grOff','grAnna','grBram','grJoin'], U={};
  for(const n of names){ U[n]=await J('/api/register',{name:n,pass:'password1'}); await J('/api/ledger',null,U[n].token); }
  const id=n=>U[n].profile.id;
  await delay(600); await stop();
  { const db=JSON.parse(fs.readFileSync(dbFile,'utf8')), now=Date.now();
    db.guilds=db.guilds||{};
    db.guilds.g1={id:'g1',name:'Ember Wardens',leader:id('grLead'),members:['grLead','grOff','grAnna','grBram'].map(id),reqs:[{id:id('grJoin'),t:now}],
      level:3,exp:0,motd:'Hold the line',log:[],createdAt:now,
      ranks:[{id:'officer',name:'Officer',perms:{members_accept:true,members_kick:true,notice_edit:true,banner_edit:true,war_register:true,war_manage:true}},{id:'member',name:'Member',perms:{}}],
      memberRank:{[id('grOff')]:'officer'}};
    for(const n of ['grLead','grOff','grAnna','grBram']) db.users[id(n)].guildId='g1';
    for(const n of names){ const u=db.users[id(n)]; if(u.led) u.led.px=99000000; }
    fs.writeFileSync(dbFile,JSON.stringify(db)); }
  child=spawn(process.execPath,[srvFile],{cwd:ROOT,env:env(port),stdio:'ignore',windowsHide:true}); await up();
  const T={}; for(const n of names) T[n]=(await J('/api/login',{name:U[n].profile.name,pass:'password1'})).token;
  browser=await chromium.launch({args:['--disable-audio-output','--use-gl=swiftshader','--enable-unsafe-swiftshader'],ignoreDefaultArgs:['--mute-audio']});
  if(process.env.SHOTS) fs.mkdirSync(process.env.SHOTS,{recursive:true});
  for(const [W,H] of [[844,390],[882,344],[1440,800]]){ const tag=W+'x'+H;
    const ctx=await browser.newContext({viewport:{width:W,height:H},serviceWorkers:'block'}); const page=await ctx.newPage(); const errs=[];
    page.on('pageerror',e=>errs.push(String(e.message||e)));
    await page.addInitScript(()=>{ try{ window.AudioContext=undefined; window.webkitAudioContext=undefined; }catch(e){} });
    try{
      await page.goto(base+'/play',{waitUntil:'load',timeout:120000});
      await page.waitForFunction(()=>typeof show==='function'&&typeof ACC!=='undefined'&&typeof renderGuild==='function',null,{timeout:120000});
      await delay(1500);
      const as=async(n,tab)=>{ await page.evaluate(async([tok,uid,tab])=>{ document.querySelectorAll('.gmodal-ov').forEach(e=>e.remove());
          ACC.token=tok; ACC.id=uid; G.tutStarted=true; G.tutDone=true; try{_whatsNewDone=true;}catch(e){} document.body.classList.remove('gated');
          try{ document.querySelectorAll('#rotateGate').forEach(e=>e.style.display='none'); }catch(e){}
          if(typeof ledgerSync==='function') await ledgerSync(); GS.guild=null; guildTab=tab; show('guild'); await guildFetch(); guildTab=tab; renderGuild(); },[T[n],id(n),tab]);
        await delay(500); };
      const server=async()=>(await J('/api/guild/mine',null,T.grLead)).guild;
      /* the in-game view (scrolled so the tab strip shows) and the whole panel as one picture */
      const shot=async(name,sel)=>{ if(!process.env.SHOTS) return; await page.evaluate(()=>{ const e=document.querySelector('#guildBody .gTabStrip'); if(e) e.scrollIntoView({block:'start'}); }); await delay(250);
        await page.screenshot({path:path.join(process.env.SHOTS,'guild-ranks-'+tag+'-'+name+'.png')});
        await page.evaluate(s=>{ const c=document.querySelector(s+' .gr-list'); const e=c&&c.lastElementChild; if(e) e.scrollIntoView({block:'end'}); },sel); await delay(250);
        await page.screenshot({path:path.join(process.env.SHOTS,'guild-ranks-'+tag+'-'+name+'-lower.png')}); };
      const layout=async who=>{ const L=await page.evaluate(W=>{ const se=document.scrollingElement, gd=document.getElementById('guild');
          const rect=s=>{ const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.left,r:r.right,w:r.width,h:r.height}; };
          const m=rect('#grMembers'), k=rect('#grRanks'); const bad=[];
          for(const col of ['#grMembers','#grRanks']){ const c=document.querySelector(col); if(!c) continue; const cr=c.getBoundingClientRect();
            c.querySelectorAll('.gr-perm,.gr-mrow,.gr-rhead>*,.gr-add>*').forEach(e=>{ const r=e.getBoundingClientRect(); if(r.width&&(r.left<cr.left-1||r.right>cr.right+1)) bad.push(col+' '+e.className+' '+Math.round(r.left)+'-'+Math.round(r.right)+' vs '+Math.round(cr.left)+'-'+Math.round(cr.right)); }); }
          return {sw:Math.max(se.scrollWidth,gd?gd.scrollWidth:0), m, k, bad, text:(document.getElementById('gTabBody')||{}).innerText||''}; },W);
        ok(L.sw<=W+1,tag+' '+who+': no horizontal scroll ('+L.sw+' <= '+W+')');
        ok(L.m&&L.k&&L.m.x>=0&&L.k.r<=W+1&&L.m.w>=150&&L.k.w>=150,tag+' '+who+': both columns inside the viewport '+JSON.stringify([L.m,L.k]));
        ok(!L.bad.length,tag+' '+who+': every row and permission label sits inside its column '+L.bad.slice(0,3).join(' | '));
        ok(!EMOJI.test(L.text),tag+' '+who+': no emoji in the Ranks tab'); return L; };

      // ---- leader ----
      await as('grLead','chat');
      const roster=await page.evaluate(()=>[...document.querySelectorAll('#gRoster .gmem')].map(e=>e.innerText.replace(/\s+/g,' ').trim()));
      ok(roster.some(x=>/grOff.*Officer/.test(x))&&roster.filter(x=>/Member/.test(x)).length===2,tag+' leader: the chat roster shows each rank '+JSON.stringify(roster));
      if(process.env.SHOTS) await page.screenshot({path:path.join(process.env.SHOTS,'guild-ranks-'+tag+'-leader-roster.png')});
      ok(await page.locator('.gTab[data-gt="ranks"]').count()===1&&await page.locator('.gTab[data-gt="requests"]').count()===1,tag+' leader: Ranks and Requests tabs');
      await page.locator('.gTab[data-gt="ranks"]').click(); await delay(400);
      ok(await page.locator('#grMembers select.gr-sel').count()===3,tag+' leader: a rank picker for each of the 3 members');
      ok(await page.locator('#grRanks input[data-grp]:not([disabled])').count()===12,tag+' leader: 6 enabled permission boxes per rank (12)');
      ok(await page.locator('#grRanks input.gr-name').count()===2&&await page.locator('#grAdd').count()===1,tag+' leader: rename fields and Add rank');
      await layout('leader');
      await shot('leader-members','#grMembers'); await shot('leader-ranks','#grRanks');
      // add a rank through the UI
      const nm='Vet'+W; await page.fill('#grNew',nm); await page.click('#grAdd'); await delay(900);
      let sg=await server(); const vr=(sg.ranks||[]).find(r=>r.name===nm);
      ok(!!vr&&sg.ranks.map(r=>r.id).indexOf(vr.id)===1,tag+' leader: Add rank created '+nm+' above Member on the server');
      // tick members_kick on it
      if(vr){ await page.locator(`#grRanks input[data-grp="${vr.id}"][data-perm="members_kick"]`).check(); await delay(900);
        sg=await server(); ok(JSON.stringify(sg.ranks.find(r=>r.id===vr.id).perms)==='["members_kick"]',tag+' leader: ticking a box saves that permission on the server');
        // assign grAnna from her picker
        await page.locator(`#grMembers select[data-grm="${id('grAnna')}"]`).selectOption(vr.id); await delay(900);
        sg=await server(); ok((sg.members.find(m=>m.id===id('grAnna'))||{}).rankId===vr.id,tag+' leader: the picker promotes grAnna on the server');
        // move it above Officer, then delete it (confirm) - grAnna falls back to Member
        await page.locator(`#grRanks [data-grmv="-1"][data-grid="${vr.id}"]`).click(); await delay(900);
        sg=await server(); ok(sg.ranks[0].id===vr.id,tag+' leader: the up arrow reorders on the server');
        await layout('leader with 3 ranks');
        await page.locator(`#grRanks [data-grdel="${vr.id}"]`).click(); await delay(700); await page.locator('#_gcYes').click(); await delay(900);   /* the game's confirm takes no tap for its first 450 ms */
        sg=await server(); ok(!sg.ranks.some(r=>r.id===vr.id)&&(sg.members.find(m=>m.id===id('grAnna'))||{}).rankId==='member',tag+' leader: Delete (confirmed) removes the rank; grAnna is a Member again'); }
      // the member menu from the roster: rank picker
      await as('grLead','chat');
      await page.evaluate(n=>{ const r=[...document.querySelectorAll('#gRoster [data-mem]')].find(e=>e.dataset.mn===n); guildMemberMenu(r.dataset.mem,r.dataset.mn); },'grBram'); await delay(300);
      ok(await page.locator('.gmodal-ov #gmRank').count()===1&&await page.locator('.gmodal-ov #gmKick').count()===1,tag+' leader: the member menu carries the rank picker and Remove');
      await page.locator('.gmodal-ov #gmRank').selectOption('officer'); await delay(900);
      sg=await server(); ok((sg.members.find(m=>m.id===id('grBram'))||{}).rankId==='officer',tag+' leader: promoting from the member menu reaches the server');
      await J('/api/guild/rank/assign',{id:id('grBram'),rankId:'member'},T.grLead);

      // ---- a Member ----
      await as('grAnna','ranks');
      ok(await page.locator('.gTab[data-gt="requests"]').count()===0,tag+' member: no Requests tab');
      ok((await page.locator('#gLeave').innerText()).trim()==='Leave',tag+' member: the header button is Leave');
      ok(await page.locator('#grMembers select').count()===0&&await page.locator('#grRanks input.gr-name').count()===0&&await page.locator('#grAdd').count()===0&&await page.locator('[data-grdel],[data-grmv]').count()===0,tag+' member: no pickers, no edit controls');
      ok(await page.locator('#grRanks input[data-grp]').count()===12&&await page.locator('#grRanks input[data-grp]:not([disabled])').count()===0,tag+' member: permissions shown read-only (12 disabled boxes)');
      const mrk=await page.evaluate(()=>[...document.querySelectorAll('#grMembers .gr-mrow')].map(e=>e.innerText.replace(/\s+/g,' ').trim()));
      ok(mrk.some(x=>/grLead.*Leader/.test(x))&&mrk.some(x=>/grOff.*Officer/.test(x)),tag+' member: the member list names each rank '+JSON.stringify(mrk));
      await layout('member');
      await shot('member-members','#grMembers'); await shot('member-ranks','#grRanks');

      // ---- the Officer ----
      await as('grOff','ranks');
      ok(await page.locator('.gTab[data-gt="requests"]').count()===1&&(await page.locator('#gLeave').innerText()).trim()==='Manage',tag+' officer: Requests tab and Manage');
      ok(await page.locator('#grMembers select').count()===0&&await page.locator('#grRanks input[data-grp]:not([disabled])').count()===0,tag+' officer: ranks are still read-only (leader-only)');
      ok(!errs.length,tag+' no page errors '+errs.slice(0,3).join(' | '));
    }catch(e){ fails++; console.log('  FAIL '+tag+' '+String(e&&e.message||e).split('\n')[0]); }
    finally{ await ctx.close(); }
  }
  console.log('test_guild_ranks_ui_1372: '+(checks-fails)+'/'+checks+' checks passed, '+fails+' failed');
  if(fails) process.exitCode=1;
} catch(e){ console.error('FAIL',e); process.exitCode=1; } finally { if(browser) await browser.close(); await stop(); } })();
