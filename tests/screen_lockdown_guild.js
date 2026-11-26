'use strict';
/* Lockdown audit 25 Nov 2026, round 2, building 06 - Guild Hall (guild-06.md, the UNPROVEN-ON-SCREEN lines), in a real browser on this
   checkout's server (temp DB), at phone 844x390 (touch) and desktop sizes (1280x720, 1440x800 for the title/frame line):
   - Guild Hall title art and frame: painted GUILD HALL title; header + tab strip + tab body inside ONE carved gold frame, tabs inside it.
   - Raid team screen: Guild > Raid > Fight the boss opens the hero select (5 columns, class row), 5 Fighter + 5 Backup slots; Battle starts the raid.
   - Skyfall board screen: a real LIVE war (our guild vs its R16 rival): floating towers, 5 bridges, march lines, swords, garrison discs
     alive/total, the SKYFALL title and the HUD.
   - Falling and burning towers: the live war has one destroyed enemy citadel: its tower is the burning ruin, resting on its island, the
     ruin art animates; and in a replayed war a tower drops onto its island when its last line dies and a finished lane's lines clear.
   - Bracket panel: a 16-guild bracket: 16 crests (each guild's banner) and every path meets at the centre cup.
   - Import picture: import a landscape PNG, drag + zoom in the crop window, Use this, Save: the saved banner = the window's square.
   The war, the 16 guilds and the members are seeded in the temp DB (the server made the tournament itself first). One screenshot per check. */
const fs=require('fs'), crypto=require('crypto');
const H=require('./helpers/screens-lockdown.js');
const TEST='screen_lockdown_guild.js', C=H.checker(TEST), shot=H.shooter(TEST);
const HEROES={vael:60,aureth:60,sylthaine:60,vireo:60,brannus:60,calypsa:60,dandra:60,grosk:60,umbris:60,lumi:60};
const ADMIN_TOKEN='screens-lockdown-admin-token', ADMIN_ID='sl2-admin';
const GNAMES=['Ember Wardens','Ashen Vow','Iron Choir','Storm Ledger','Gilded Thorn','Night Anvil','Crown Embers','Rift Walkers',
  'Salt Crowns','Hollow Pike','Lantern Oath','Frost Banner','Cinder Court','Pale Harbor','Oak Sentinels','Last Beacon'];
const SIZES={
  phone:{w:844,h:390,touch:true,tag:'phone 844x390'},
  desktop:{w:1280,h:720,touch:false,tag:'desktop 1280x720'},
  wide:{w:1440,h:800,touch:false,tag:'desktop 1440x800'},
};
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');

function seedWorld(file){ const db=JSON.parse(fs.readFileSync(file,'utf8')), now=Date.now(), me=db.users[H.UID];
  me.guildId='g1'; me.led.gems=5000;
  const mk=(id,name,guildId)=>{ const u=JSON.parse(JSON.stringify(me)); u.id=id; u.name=name; u.guildId=guildId; u.created=now-5000; db.users[id]=u; db.byName[name.toLowerCase()]=id; return u; };
  const admin=mk(ADMIN_ID,'Screen Admin',null); admin.role='admin';
  db.tokens[sha(ADMIN_TOKEN)]={id:ADMIN_ID,iat:now,exp:now+90*86400000};
  db.guilds={};
  for(let i=0;i<16;i++){ const gid='g'+(i+1), lead=i===0?H.UID:'sl2-lead-'+(i+1), mates=i<2?[lead,'sl2-m'+(i+1)+'a','sl2-m'+(i+1)+'b']:[lead];
    if(i>0) mk(lead,'Lord '+(i+1),gid); if(i<2){ mk('sl2-m'+(i+1)+'a','Knight '+(i+1)+'A',gid); mk('sl2-m'+(i+1)+'b','Knight '+(i+1)+'B',gid); }
    db.guilds[gid]={id:gid,name:GNAMES[i],leader:lead,members:mates,officers:[],reqs:[],level:3,exp:0,motd:'Hold the line.',log:[],createdAt:now-86400000,
      banner:{shape:i%5,emblem:(i*3)%7,color:(i*5)%9,img:null}}; }
  /* the tournament the server made on its first /api/guild-war/status, turned into a LIVE round of 16 */
  const t=db.tournaments.current; t.state='bracket'; t.roundIndex=0; t.roundBase=0;
  const line=(uid,n)=>({memberId:uid,line:n,power:4000+n*100,name:db.users[uid].name});
  t.entrants=Object.values(db.guilds).map((g,i)=>({guildId:g.id,name:g.name,banner:g.banner,seed:i+1,powerPool:90000-i*3000,seedPool:90000-i*3000,
    lines:g.members.flatMap(u=>[line(u,0),line(u,1)])}));
  const def=(uid,n,alive)=>({memberId:uid,line:n,power:4000+n*100,name:db.users[uid].name,alive,kills:alive?1:0,fights:1,
    lineSnapshot:[{key:'vael',maxHp:5000,atk:200},{key:'aureth',maxHp:6000,atk:150}],hpState:[{hp:alive?3000:0},{hp:alive?4000:0}]});
  const side=(g,deadLane)=>({guildId:g.id,name:g.name,unplaced:[],citadels:[0,1,2,3,4].map(i=>{ const m=g.members[i%g.members.length];
    const dead=i===deadLane; return {lane:i,key:['irongate','stormwatch','crownspire','verdant','rift'][i],destroyed:dead,defenders:[def(m,0,!dead),def(g.members[(i+1)%g.members.length],1,!dead)]}; })});
  const pairs=[[0,15],[7,8],[3,12],[4,11],[1,14],[6,9],[2,13],[5,10]];
  t.matches={}; t.rounds=[{name:'R16',matchIds:[]}];
  pairs.forEach(([a,b],k)=>{ const A=t.entrants[a], B=t.entrants[b], ga=db.guilds[A.guildId], gb=db.guilds[B.guildId], id='gwm_sl2_'+k;
    const live=k===0;
    t.matches[id]={id,tournamentId:t.id,roundIndex:0,state:'live',aGuildId:A.guildId,bGuildId:B.guildId,revealAt:now-6*3600000,lockedAt:now-3600000,
      planningEndsAt:now-3600000,startsAt:now-3600000,endsAt:now+3*3600000,winnerGuildId:null,
      sides:{[A.guildId]:live?side(ga,-1):side(ga,-1),[B.guildId]:live?side(gb,0):side(gb,-1)},assaults:{},eventLog:[{t:now-3600000,e:'WAR_LOCKED'}],version:1};
    t.rounds[0].matchIds.push(id); });
  t.version=(t.version|0)+1;
  fs.writeFileSync(file,JSON.stringify(db)); }

const press=(pg,S,sel)=>S.touch?pg.tap(sel,{timeout:10000}):pg.click(sel,{timeout:10000});
async function openGuild(pg,S,tab){ await H.openBuilding(pg,'guild',S.touch);
  await pg.waitForFunction(()=>document.getElementById('guild').classList.contains('active')&&document.querySelector('#guildBody .gTabStrip'),null,{timeout:30000}).catch(()=>{});
  if(tab){ await pg.evaluate(t=>{ const b=document.querySelector('#guildBody [data-gt="'+t+'"]'); if(b) b.scrollIntoView({block:'center',inline:'center'}); },tab);
    await press(pg,S,'#guildBody [data-gt="'+tab+'"]'); }
  await H.wait(1500); await H.prep(pg); }

/* ---------------- Guild Hall title art and frame ---------------- */
async function titleFrame(pg,S){ await openGuild(pg,S,'chat');
  const r=await pg.evaluate(async()=>{ const scr=document.getElementById('guild'), h1=scr.querySelector('.titlebar h1'), cs=getComputedStyle(h1), body=document.getElementById('guildBody');
    const title=await SL.bgLoaded(h1), bcs=getComputedStyle(body,'::before'), fu=((bcs.borderImageSource||'').match(/url\(["']?([^"')]+)/)||[])[1], frame=fu?await SL.loadImg(fu):null;
    const B=SL.R(body), inside=el=>{ const r=SL.R(el); return !!r&&r.x>=B.x-1&&r.r<=B.r+1&&r.y>=B.y-1&&r.b<=B.b+1; };
    const head=body.querySelector('.gHead'), strip=body.querySelector('.gTabStrip'), tb=body.querySelector('#gTabBody'), tabs=[...body.querySelectorAll('.gTab')];
    const own=[head,strip].map(e=>getComputedStyle(e,'::before').display);
    return {title:title.map(x=>x.url.replace(location.origin,'')+(x.ok?' '+x.w+'x'+x.h:' NOT LOADED')),titleOk:title.some(x=>x.ok&&/guild-hall-title/.test(x.url)),font:cs.fontSize,
      titleBox:SL.R(h1),titleOn:SL.inView(h1),frame:fu?fu.replace(location.origin,''):null,frameOk:!!(frame&&frame.ok),frameW:bcs.borderImageWidth,frameShown:bcs.display!=='none'&&bcs.content!=='none',
      body:B,head:inside(head),strip:inside(strip),tabBody:inside(tb),tabsInside:tabs.every(t=>{ if(inside(t)) return true; const r=SL.R(t), S=SL.R(strip), sc=getComputedStyle(strip); return strip.scrollWidth>strip.clientWidth+1&&/auto|scroll|hidden/.test(sc.overflowX)&&r.y>=B.y-1&&r.b<=B.b+1; }),stripScrolls:strip.scrollWidth>strip.clientWidth+1,tabs:tabs.length,ownFrames:own,
      tabRow:tabs.map(t=>SL.R(t)).filter(r=>r.x<SL.V().width).length}; });
  const s=await shot(pg,S.tag+' Guild Hall title art and frame');
  C.ok(r.titleOk&&parseFloat(r.font)===0&&r.titleOn&&r.titleBox.w>60&&r.titleBox.h>40,S.tag+' Guild Hall title art and frame: the painted GUILD HALL title art is loaded and on screen (no text title)',{title:r.title,box:r.titleBox,font:r.font,shot:s});
  C.ok(r.frameOk&&/guild-ornate-panel/.test(r.frame||'')&&r.frameShown&&r.head&&r.strip&&r.tabBody&&r.tabsInside&&r.tabs>=6&&r.ownFrames.every(d=>d==='none'),
    S.tag+' Guild Hall title art and frame: header, tab strip ('+r.tabs+' tabs) and tab body all sit inside ONE carved gold frame (guild-ornate-panel on #guildBody; header and strip draw no frame of their own)',
    {frame:r.frame,width:r.frameW,body:r.body,inside:{head:r.head,strip:r.strip,tabBody:r.tabBody,tabs:r.tabsInside,stripScrolls:r.stripScrolls},ownFrames:r.ownFrames,shot:s}); }

/* ---------------- Import picture ---------------- */
async function importPicture(pg,S,s){ await openGuild(pg,S,'chat');
  await press(pg,S,'#gLeave'); await pg.waitForSelector('#gmBanner',{timeout:10000}); await press(pg,S,'#gmBanner');
  await pg.waitForSelector('#gbImport',{timeout:10000});
  /* a landscape 600x300 PNG with strong gradients both ways (an offset crop is easy to tell from the right one) */
  const png=await pg.evaluate(()=>{ const c=document.createElement('canvas'); c.width=600; c.height=300; const x=c.getContext('2d');
    for(let i=0;i<600;i+=4) for(let j=0;j<300;j+=4){ x.fillStyle='rgb('+Math.round(i/600*255)+','+Math.round(j/300*255)+','+(((i>>5)+(j>>5))%2?220:30)+')'; x.fillRect(i,j,4,4); }
    return c.toDataURL('image/png').split(',')[1]; });
  const [chooser]=await Promise.all([pg.waitForEvent('filechooser',{timeout:10000}).catch(()=>null),press(pg,S,'#gbImport')]);
  if(chooser) await chooser.setFiles({name:'landscape.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  else await pg.setInputFiles('#gbFile',{name:'landscape.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await pg.waitForSelector('#gbCropBox',{timeout:10000}); await H.wait(500);
  const box=await pg.evaluate(()=>{ const b=document.getElementById('gbCropBox').getBoundingClientRect(); return {x:b.left,y:b.top,w:b.width,h:b.height}; });
  /* drag the picture 70 px left and 20 px up inside the window, then zoom in with the slider (keyboard steps) */
  await pg.mouse.move(box.x+box.w*0.5,box.y+box.h*0.5); await pg.mouse.down();
  for(let i=1;i<=10;i++){ await pg.mouse.move(box.x+box.w*0.5-7*i,box.y+box.h*0.5-2*i); await H.wait(30); }
  await pg.mouse.up(); await H.wait(200);
  await pg.focus('#gbCropZ'); for(let i=0;i<70;i++) await pg.keyboard.press('ArrowRight'); await H.wait(200);
  await pg.mouse.move(box.x+box.w*0.5,box.y+box.h*0.5); await pg.mouse.down();
  for(let i=1;i<=6;i++){ await pg.mouse.move(box.x+box.w*0.5+5*i,box.y+box.h*0.5+6*i); await H.wait(30); }
  await pg.mouse.up(); await H.wait(300);
  /* the window as the player sees it: which part of the picture is inside the square (read from the screen rectangles only) */
  const win=await pg.evaluate(()=>{ const b=document.getElementById('gbCropBox').getBoundingClientRect(), im=document.getElementById('gbCropImg'), r=im.getBoundingClientRect(), k=r.width/im.naturalWidth;
    return {sx:(b.left-r.left)/k,sy:(b.top-r.top)/k,sw:b.width/k,sh:b.height/k,zoom:document.getElementById('gbCropZ').value,boxPx:Math.round(b.width)+'x'+Math.round(b.height),inView:SL.inView(document.getElementById('gbCropBox'))}; });
  const s1=await shot(pg,S.tag+' Import picture crop window');
  await press(pg,S,'#gbCropOk'); await pg.waitForSelector('#gbSave',{timeout:10000}); await H.wait(300);
  await press(pg,S,'#gbSave'); await H.wait(1500);
  const g=(await s.api('/api/guild/mine')).body, saved=g&&g.guild&&g.guild.banner&&g.guild.banner.img;
  const cmp=saved?await pg.evaluate(async([png,saved,w])=>{ const load=src=>new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src=src; });
    const o=await load('data:image/png;base64,'+png), sv=await load(saved); if(!o||!sv) return {err:'decode'};
    const px=(img,sx,sy,sw,sh)=>{ const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'); x.drawImage(img,sx,sy,sw,sh,0,0,128,128); return x.getImageData(0,0,128,128).data; };
    const a=px(sv,0,0,sv.naturalWidth,sv.naturalHeight), want=px(o,w.sx,w.sy,w.sw,w.sh), centre=px(o,(600-300)/2,0,300,300);
    const diff=(p,q)=>{ let s=0; for(let i=0;i<p.length;i+=4) s+=Math.abs(p[i]-q[i])+Math.abs(p[i+1]-q[i+1])+Math.abs(p[i+2]-q[i+2]); return Math.round(s/(p.length/4*3)*10)/10; };
    return {size:sv.naturalWidth+'x'+sv.naturalHeight,vsWindow:diff(a,want),vsCentreCrop:diff(a,centre),type:saved.slice(5,15)}; },[png,saved,win]):null;
  await H.wait(300); const s2=await shot(pg,S.tag+' Import picture saved banner');
  C.ok(!!chooser&&win.inView&&+win.zoom>100&&win.sw<600&&win.sx>0,S.tag+' Import picture: the PNG picker opened, the crop window is on screen, the picture was dragged and zoomed (zoom '+win.zoom+'%)',{chooser:!!chooser,win,shot:s1});
  C.ok(!!cmp&&cmp.size==='128x128'&&cmp.vsWindow<=12&&cmp.vsCentreCrop>=3*Math.max(1,cmp.vsWindow),S.tag+' Import picture: the saved banner (server) is the square that was in the window (mean colour difference '+(cmp&&cmp.vsWindow)+' vs '+(cmp&&cmp.vsCentreCrop)+' for an untouched centre crop)',{cmp,window:win,shots:[s1,s2]});
  await pg.evaluate(()=>document.querySelectorAll('.gmodal-ov,.modalOv,.mdl-ov').forEach(n=>n.remove())); }

/* ---------------- Skyfall: board, ruin, bracket, replay ---------------- */
async function openSkyfall(pg,S){ await openGuild(pg,S,'war');
  const btn=await pg.evaluate(()=>{ const b=[...document.querySelectorAll('#gTabBody button')].find(x=>/show\('skyfall'\)/.test(x.getAttribute('onclick')||'')); if(b){ b.id='slSkyEnter'; b.scrollIntoView({block:'center'}); } return !!b; });
  if(btn) await press(pg,S,'#slSkyEnter'); else await pg.evaluate(()=>show('skyfall'));
  await pg.waitForFunction(()=>document.getElementById('skyfall').classList.contains('active')&&document.querySelectorAll('#skyStage .skyTower').length===10&&SKY.st&&SKY.st.match,null,{timeout:30000}).catch(()=>{});
  await H.wait(2500); await H.prep(pg); return btn; }

async function skyBoard(pg,S){ const btn=await openSkyfall(pg,S);
  const r=await pg.evaluate(async()=>{ const st=document.getElementById('skyStage'), m=SKY.st.match, V=SL.V();
    const towers=[...st.querySelectorAll('.skyTower')], bridges=[...st.querySelectorAll('.skyBridge')], lines=[...st.querySelectorAll('.skyMarchLine')], clash=[...st.querySelectorAll('.skyLaneClash')], gar=[...st.querySelectorAll('.skyGarrison')];
    for(let i=0;i<50&&towers.some(t=>!t.complete);i++) await new Promise(r=>setTimeout(r,100));
    const on=el=>SL.vis(el)&&SL.inView(el,2);
    const br=await Promise.all(bridges.map(b=>SL.bgLoaded(b))), sky=await SL.bgLoaded(st.querySelector('.skyBoardSky'));
    const hud=st.querySelector('.skyHud'), hb=getComputedStyle(hud,'::before'), tu=((hb.backgroundImage||'').match(/url\(["']?([^"')]+)/)||[])[1], ti=tu?await SL.loadImg(tu):null, hr=SL.R(hud);
    const garWant=[...m.you.citadels.map((c,i)=>['you',i,c.destroyed?0:c.alive,c.total]),...m.foe.citadels.map((c,i)=>['foe',i,c.destroyed?0:c.alive,c.total])];
    const garGot=garWant.map(([s,i])=>{ const e=document.getElementById('skyGar-'+s+'-'+i); return e?SL.txt(e).replace(/\s/g,''):null; });
    return {state:m.state,stage:(document.getElementById('skyStagePill')||{}).textContent,
      towers:towers.length,towersOk:towers.filter(t=>t.complete&&t.naturalWidth>0&&on(t)).length,bob:towers.filter(t=>!t.classList.contains('down')&&t.getAnimations().length>0).length,
      bridges:bridges.length,bridgesOk:bridges.filter((b,i)=>on(b)&&br[i].length&&br[i].every(x=>x.ok)&&SL.R(b).w>20).length,
      lines:lines.length,linesOn:lines.filter(l=>SL.vis(l)&&SL.R(l).w*SL.R(l).h>0).length,marching:st.classList.contains('marching'),
      swords:clash.length,swordsOk:clash.filter(c=>on(c)&&c.querySelector('img')&&c.querySelector('img').complete&&c.querySelector('img').naturalWidth>0).length,
      discs:gar.length,discsOn:gar.filter(on).length,garWant:garWant.map(x=>x[2]+'/'+x[3]),garGot,sky:sky.every(x=>x.ok),
      title:tu?tu.replace(location.origin,''):null,titleOk:!!(ti&&ti.ok),titleW:hb.width,titleH:hb.height,hudOn:SL.vis(hud)&&hr.y>=-1&&hr.y<V.height,
      status:SL.txt(st.querySelector('.skyStatus')).slice(0,120),menu:on(st.querySelector('#skyMenuBtn')),editTeam:on(st.querySelector('#skyEditTeam'))}; });
  const s=await shot(pg,S.tag+' Skyfall board screen');
  C.ok(r.state==='live'&&r.stage==='MARCH',S.tag+' Skyfall board screen: opened from the Guild > Skyfall tab'+(btn?' (its Enter button)':' (no Enter button found - opened by show)')+' on a real LIVE war (stage MARCH)',{state:r.state,stage:r.stage,shot:s});
  C.ok(r.towers===10&&r.towersOk===10&&r.bob>=9,S.tag+' Skyfall board screen: 10 floating towers drawn on screen ('+r.bob+' bobbing)',{towers:r.towers,ok:r.towersOk,bob:r.bob,shot:s});
  C.ok(r.bridges===5&&r.bridgesOk===5&&r.sky,S.tag+' Skyfall board screen: 5 bridges (art loaded, on screen) under the sky',{bridges:r.bridges,ok:r.bridgesOk,sky:r.sky,shot:s});
  C.ok(r.marching&&r.lines===10&&r.linesOn===10,S.tag+' Skyfall board screen: march lines drawn on all 5 lanes (10 runs)',{lines:r.lines,shown:r.linesOn,marching:r.marching,shot:s});
  C.ok(r.swords===5,S.tag+' Skyfall board screen: one crossed-swords clash built on each of the 5 bridges (v729: they show only while that lane is fighting - seen in the replay check below)',{swords:r.swords,shownNow:r.swordsOk,shot:s});
  C.ok(r.discs===10&&r.discsOn===10&&JSON.stringify(r.garGot)===JSON.stringify(r.garWant),S.tag+' Skyfall board screen: 10 garrison discs show alive/total = the server ('+r.garGot.join(' ')+')',{want:r.garWant,got:r.garGot,shot:s});
  C.ok(r.titleOk&&/skyfall-title/.test(r.title||'')&&r.hudOn&&r.menu&&r.editTeam,S.tag+' Skyfall board screen: the painted SKYFALL title and the HUD (status, War menu, Edit Team) on screen',{title:r.title,size:r.titleW+'x'+r.titleH,status:r.status,menu:r.menu,editTeam:r.editTeam,shot:s}); }

async function ruinLive(pg,S){ /* still on the live board: enemy Iron Gate (lane 0) was destroyed */
  const r=await pg.evaluate(async()=>{ const st=document.getElementById('skyStage'), tw=document.getElementById('skyTower-foe-0'), pl=st.querySelector('.skyPlat[data-key="foe:0"]'), up=document.getElementById('skyTower-foe-1');
    for(let i=0;i<50&&!tw.complete;i++) await new Promise(r=>setTimeout(r,100));
    const frame=()=>{ const c=document.createElement('canvas'); c.width=96; c.height=96; const x=c.getContext('2d'); x.drawImage(tw,0,0,96,96); return x.getImageData(0,0,96,96).data; };
    const f=[frame()]; for(let i=0;i<4;i++){ await new Promise(r=>setTimeout(r,350)); f.push(frame()); }
    let changed=0; for(let i=1;i<f.length;i++){ let d=0; for(let j=0;j<f[0].length;j+=4) d+=Math.abs(f[i][j]-f[0][j])+Math.abs(f[i][j+1]-f[0][j+1])+Math.abs(f[i][j+2]-f[0][j+2]); changed=Math.max(changed,Math.round(d/(96*96))); }
    const T=SL.R(tw), P=SL.R(pl), U=SL.R(up), PU=SL.R(st.querySelector('.skyPlat[data-key="foe:1"]'));
    return {src:(tw.getAttribute('src')||''),down:tw.classList.contains('down'),loaded:tw.naturalWidth>0,frameChange:changed,
      tower:T,plat:P,baseOnDisc:T.b>=P.y&&T.b<=P.b&&(T.x+T.w/2)>=P.x&&(T.x+T.w/2)<=P.r,
      upBase:U.b,upPlatTop:PU.y,upHovers:U.b<PU.y+PU.h*0.5,disc:SL.txt(document.getElementById('skyGar-foe-0'))}; });
  /* the loop as the player sees it: 5 screenshots of the ruin's box 350 ms apart, compared pixel by pixel (a canvas drawImage of an
     animated WebP can return the same frame in headless Chromium, so the canvas number above is only printed) */
  const T0=r.tower, clip={x:Math.max(0,T0.x),y:Math.max(0,T0.y),width:Math.max(4,T0.w),height:Math.max(4,T0.h)}, pngs=[];
  for(let i=0;i<5;i++){ pngs.push((await pg.screenshot({type:'png',scale:'css',clip})).toString('base64')); await H.wait(350); }
  const scr=await pg.evaluate(async pngs=>{ const px=[]; for(const b of pngs){ const im=new Image(); await new Promise(r=>{ im.onload=r; im.onerror=r; im.src='data:image/png;base64,'+b; });
      const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight; const x=c.getContext('2d'); x.drawImage(im,0,0); px.push(x.getImageData(0,0,c.width,c.height).data); }
    let best=0; for(let i=1;i<px.length;i++){ let d=0; for(let j=0;j<px[0].length;j+=4) d+=Math.abs(px[i][j]-px[0][j])+Math.abs(px[i][j+1]-px[0][j+1])+Math.abs(px[i][j+2]-px[0][j+2]); best=Math.max(best,Math.round(d/(px[0].length/4))); }
    return best; },pngs);
  r.canvasChange=r.frameChange; r.frameChange=scr;
  const s=await shot(pg,S.tag+' Falling and burning towers live war ruin');
  C.ok(r.down&&/ruin-irongate/.test(r.src)&&r.loaded&&r.baseOnDisc&&r.upHovers,S.tag+' Falling and burning towers: the destroyed enemy Iron Gate is drawn as the burning ruin, resting on its island (its base on the disc), while a standing tower still floats above its own',
    {src:r.src,tower:r.tower,island:r.plat,standingBase:r.upBase,standingIslandTop:r.upPlatTop,disc:r.disc,shot:s});
  C.ok(r.frameChange>=2,S.tag+' Falling and burning towers: the ruin art animates (the burning loop changes between frames: mean change '+r.frameChange+')',{change:r.frameChange,canvasChange:r.canvasChange,shot:s}); }

async function bracket(pg,S){
  await pg.evaluate(()=>{ const p=document.getElementById('skyPanel'); if(p) p.remove(); });
  await press(pg,S,'#skyMenuBtn'); await H.wait(300); await press(pg,S,'#skyBracket'); await H.wait(1200);
  const r=await pg.evaluate(()=>{ const b=document.querySelector('.skyBrkBody'); if(!b) return {none:true}; const B=b.getBoundingClientRect();
    const nodes=[...b.querySelectorAll('.skyBrkNode')], cup=b.querySelector('.skyBrkCup2'), C0=cup.getBoundingClientRect(), cx=C0.left+C0.width/2, cy=C0.top+C0.height/2;
    const names=nodes.map(n=>SL.txt(n.querySelector('.nm'))), crests=nodes.filter(n=>n.querySelector('.crest svg')).length;
    const svg=b.querySelector('svg.skyBrkSvg'), S0=svg.getBoundingClientRect(), paths=[...svg.querySelectorAll('path')];
    const pt=(x,y)=>({x:S0.left+x/100*S0.width,y:S0.top+y/100*S0.height});
    const segs=paths.map(p=>{ const n=(p.getAttribute('d').match(/-?[\d.]+/g)||[]).map(Number); const pts=[]; for(let i=0;i<n.length;i+=2) pts.push(pt(n[i],n[i+1])); return pts; });
    /* walk the tree in the panel's own % space: from each crest, follow the path that starts where the last one ended, until it reaches the cup */
    const segsP=paths.map(p=>{ const n=(p.getAttribute('d').match(/-?[\d.]+/g)||[]).map(Number); const pts=[]; for(let i=0;i<n.length;i+=2) pts.push({x:n[i],y:n[i+1]}); return pts; });
    const nearP=(a,b)=>Math.abs(a.x-b.x)<0.05&&Math.abs(a.y-b.y)<0.05, cupX=parseFloat(cup.style.left), cupY=parseFloat(cup.style.top);
    const reach=nodes.map(n=>{ let at={x:parseFloat(n.style.left),y:parseFloat(n.style.top)}; for(let step=0;step<6;step++){ const s=segsP.find(s=>nearP(s[0],at)); if(!s) return {ok:false,at}; at=s[s.length-1];
        if(Math.abs(at.x-cupX)<0.05&&Math.abs(at.y-cupY)<=10) return {ok:true,steps:step+1}; } return {ok:false,at}; });
    const cupBox=SL.R(cup), cupMid={x:cupBox.x+cupBox.w/2,y:cupBox.y+cupBox.h/2}, svgMid=pt(cupX,cupY), cupOnMid=Math.abs(cupMid.x-svgMid.x)<3&&Math.abs(cupMid.y-svgMid.y)<3;
    const ys=[...new Set(nodes.map(n=>Math.round(n.getBoundingClientRect().top)))];
    return {nodes:nodes.length,names,crests,cup:SL.vis(cup)&&SL.inView(cup)&&cupOnMid,cupMid,svgMid,allReach:reach.every(x=>x.ok),reach:reach.map(x=>x.ok?x.steps:'X'),rows:ys.length,
      inView:nodes.every(n=>SL.inView(n,2)),cupAt:Math.round((cx-B.left)/B.width*100)+'%,'+Math.round((cy-B.top)/B.height*100)+'%'}; });
  const s=await shot(pg,S.tag+' Bracket panel');
  const want=new Set(GNAMES);
  C.ok(!r.none&&r.nodes===16&&r.crests===16&&r.names.every(n=>want.has(n))&&new Set(r.names).size===16&&r.inView,S.tag+' Bracket panel: 16 guild crests (each guild\'s own banner) with the 16 guild names, all on screen',{nodes:r.nodes,crests:r.crests,names:r.names,shot:s});
  C.ok(!r.none&&r.cup&&r.allReach,S.tag+' Bracket panel: every crest\'s path runs to the cup in the centre ('+r.cupAt+')',{steps:r.reach,cup:r.cupAt,shot:s});
  console.log('  INFO   '+S.tag+' Bracket panel layout: the crests sit in '+r.rows+' rows (8 along the top, 8 along the bottom), not round a circle');
  await pg.evaluate(()=>{ document.querySelectorAll('.skyPanel,#skyPanel').forEach(n=>n.remove()); }); }

async function replayFall(pg,S){ /* a replayed war (the war simulator's real server result, played by the board's own replay) */
  const res=await fetch('http://127.0.0.1:'+pg._port+'/api/guild-war/sim',{method:'POST',headers:{'content-type':'application/json','x-token':ADMIN_TOKEN},
    body:JSON.stringify({seed:'sl2-'+S.tag,players:3,linesPer:1,botLevel:60,botSkill:10,botStars:5,stage:'march'})});
  const r=await res.json().catch(()=>null);
  if(!r||r.error||!Array.isArray(r.log)){ C.ok(false,S.tag+' Falling and burning towers: the war replay could be built (server simulator)',{status:res.status,body:JSON.stringify(r).slice(0,300)}); return; }
  await pg.evaluate(rr=>{ SKYSIM.speed=8; SKYSIM.p.stage='prep'; skySimOpen(); window._slRep=skySimReplay(rr).then(()=>'done',e=>'err '+e); },r);
  /* the war starts the way a player starts it: PREP, then Begin the march (a replay started straight in MARCH never sets the board marching,
     so its lines and swords stay hidden - seen 26 Nov run 2) */
  await pg.waitForSelector('#skyStage .skyBegin',{timeout:20000}).catch(()=>{}); await H.wait(500);
  await press(pg,S,'#skyStage .skyBegin').catch(()=>pg.evaluate(()=>{ const b=document.querySelector('#skyStage .skyBegin'); if(b) b.click(); }));
  /* sample the board until the first tower falls and lands, and until every lane is finished */
  const seen=await pg.evaluate(async()=>{ const t0=performance.now(), out={fall:null,land:null,spent:[],laneEnds:{},clash:null}; let shotT=null;
    while(performance.now()-t0<150000){ const st=document.getElementById('skyStage'); if(st){
        const f=st.querySelector('.skyTower.falling'); if(f&&!out.fall){ const p=st.querySelector('.skyPlat[data-key="'+f.dataset.key+'"]'); out.fall={id:f.id,t:Math.round(performance.now()-t0),tower:SL.R(f),plat:SL.R(p),src:f.getAttribute('src')}; window._slFallId=f.id; }
        if(out.fall&&!out.land){ const d=document.getElementById(out.fall.id); if(d&&d.classList.contains('down')){ const p=st.querySelector('.skyPlat[data-key="'+d.dataset.key+'"]'); const T=SL.R(d),P=SL.R(p);
            out.land={t:Math.round(performance.now()-t0),tower:T,plat:P,src:d.getAttribute('src'),onDisc:T.b>=P.y&&T.b<=P.b&&(T.x+T.w/2)>=P.x&&(T.x+T.w/2)<=P.r,dropped:T.b-out.fall.tower.b}; } }
        if(!out.clash){ const hc=[...st.querySelectorAll('.skyLaneClash.skyHot')].find(c=>SL.vis(c)&&SL.inView(c,2)); if(hc){ const im=hc.querySelector('img'); out.clash={id:hc.id,t:Math.round(performance.now()-t0),box:SL.R(hc),art:im?((im.getAttribute('src')||'').replace(/^.*\//,'')+' '+im.naturalWidth+'x'+im.naturalHeight):'placeholder',artOk:!im||(im.complete&&im.naturalWidth>0)}; } }
        for(let i=0;i<5;i++){ const lc=document.getElementById('skyLC-'+i); if(lc&&lc.classList.contains('spent')&&out.laneEnds[i]==null){ out.laneEnds[i]=Math.round(performance.now()-t0);
            const a=document.getElementById('skyML-you-'+i), b=document.getElementById('skyML-foe-'+i), live=[0,1,2,3,4].filter(j=>j!==i&&!document.getElementById('skyLC-'+j).classList.contains('spent'));
            out.spent.push({lane:i,linesHidden:!SL.vis(a)&&!SL.vis(b)&&!SL.vis(lc),othersStillShown:live.every(j=>SL.vis(document.getElementById('skyLC-'+j)))}); } }
        if(Object.keys(out.laneEnds).length===5&&out.land) break; }
      await new Promise(r=>setTimeout(r,40)); }
    out.done=await Promise.race([window._slRep,new Promise(r=>setTimeout(()=>r('still running'),100))]); return out; });
  const s=await shot(pg,S.tag+' Falling and burning towers replay landed');
  C.ok(!!seen.fall&&!!seen.land&&seen.land.onDisc&&seen.land.dropped>2&&/\/ruin-/.test(seen.land.src)&&/\/tower-/.test(seen.fall.src),
    S.tag+' Falling and burning towers: in the replay a tower ('+(seen.fall&&seen.fall.id)+') drops when its last line dies, lands on its island and turns into the burning ruin',{fall:seen.fall,land:seen.land,shot:s});
  C.ok(!!seen.clash&&seen.clash.artOk&&seen.clash.box.w>10,S.tag+' Skyfall board screen: crossed swords (clash art) show on a bridge while its lane is fighting ('+(seen.clash&&seen.clash.id)+')',{clash:seen.clash,shot:s});
  const sp=seen.spent;
  C.ok(sp.length===5&&sp.every(x=>x.linesHidden)&&sp.filter(x=>x.othersStillShown).length>=1,S.tag+' Falling and burning towers: each finished lane\'s march lines and swords clear while the lanes still fighting keep theirs',{spent:sp,ends:seen.laneEnds,done:seen.done,shot:s});
  await pg.evaluate(()=>{ try{ SKYSIM.skipReplay=true; SKYSIM.running=false; }catch(e){} }); }

/* ---------------- Raid team screen ---------------- */
async function raid(pg,S,s){ await openGuild(pg,S,'raid');
  await pg.waitForSelector('#gbAssault',{timeout:20000}).catch(()=>{}); await H.wait(600);
  await pg.evaluate(()=>document.getElementById('gbAssault').scrollIntoView({block:'center'}));
  await press(pg,S,'#gbAssault');
  await pg.waitForFunction(()=>document.getElementById('menu').classList.contains('active')&&document.querySelectorAll('#roster .hero-card').length>0,null,{timeout:20000}).catch(()=>{}); await H.wait(800);
  const pick=async()=>{ for(let i=0;i<14;i++){ const sel=await pg.evaluate(()=>{ const all=[...document.querySelectorAll('#roster .hero-card')]; if(all.filter(c=>c.classList.contains('selected')).length>=10) return null;
      const c=all.find(c=>!c.classList.contains('selected')&&!c.dataset.slTried); if(!c) return null; c.dataset.slTried='1'; document.querySelectorAll('#slPick').forEach(e=>e.removeAttribute('id')); c.id='slPick'; c.scrollIntoView({block:'center'}); return '#slPick'; });
      if(!sel) break; await press(pg,S,sel); await H.wait(200); } };
  const before=await pg.evaluate(()=>{ const cards=[...document.querySelectorAll('#roster .hero-card')].filter(SL.vis), xs=[...new Set(cards.slice(0,10).map(c=>Math.round(c.getBoundingClientRect().left)))];
    const cls=[...document.querySelectorAll('#rosterClass [data-rs-class]')];
    return {mode:CUR.mode,title:SL.txt(document.getElementById('menuTitle')),cards:cards.length,cols:getComputedStyle(document.getElementById('roster')).gridTemplateColumns.split(' ').length,firstRowX:xs.length,
      classRow:cls.map(b=>b.dataset.rsClass),classOn:cls.every(b=>SL.vis(b))}; });
  await pick(); await H.wait(400);
  const after=await pg.evaluate(()=>{ const box=document.getElementById('rosterSlots'), slots=[...box.querySelectorAll('.rsSlot')], lbl=[...box.querySelectorAll('.rsSlotLbl')].map(SL.txt);
    return {slots:slots.length,full:slots.filter(x=>x.classList.contains('full')).length,labels:lbl,battle:SL.vis(document.getElementById('startBtn'))}; });
  const s1=await shot(pg,S.tag+' Raid team screen');
  C.ok(before.mode==='graid'&&before.cols===5&&before.firstRowX===5&&before.classRow.length>=6&&before.classOn,S.tag+' Raid team screen: Fight the boss opens the new hero select: 5 columns, the class row ('+before.classRow.join(', ')+')',{...before,shot:s1});
  C.ok(after.slots===10&&after.full===10&&after.labels.length===2&&/fighter/i.test(after.labels[0])&&/backup/i.test(after.labels[1]),S.tag+' Raid team screen: 5 Fighter slots + 5 Backup slots (10 heroes picked by tapping cards)',{...after,shot:s1});
  const att0=(s.disk().guildRaid||null);
  await press(pg,S,'#startBtn');
  await pg.waitForFunction(()=>state==='battle'&&CUR&&CUR.mode==='graid'&&CUR.attemptId,null,{timeout:40000}).catch(()=>{}); await H.wait(1500);
  const b=await pg.evaluate(()=>({state,mode:CUR&&CUR.mode,attempt:!!(CUR&&CUR.attemptId),fighters:(typeof units!=='undefined'&&Array.isArray(units))?units.filter(u=>u.side==='ally'||u.team==='ally').length:null}));
  const s2=await shot(pg,S.tag+' Raid team screen battle started');
  C.ok(b.state==='battle'&&b.mode==='graid'&&b.attempt,S.tag+' Raid team screen: Battle starts the guild raid fight (server attempt open)',{...b,shot:s2}); }

(async()=>{
  const {file}=H.seedDB(HEROES,u=>{ u.led.gold=100000; });
  /* the server makes this week's tournament itself on the first Skyfall request; then the war is written into it */
  let s=await H.server(file,{ADMIN_IDS:ADMIN_ID}); await s.api('/api/guild-war/status'); await H.wait(800); await s.stop();
  try{ seedWorld(file); }catch(e){ C.ok(false,'the guilds and the live war could be seeded',String(e&&e.stack||e).slice(0,400)); C.done(); return; }
  s=await H.server(file,{ADMIN_IDS:ADMIN_ID}); let pg=null;
  const st=(await s.api('/api/guild-war/status')).body;
  C.ok(st&&st.match&&st.match.state==='live'&&st.tournament&&st.tournament.bracket&&st.tournament.bracket[0].matches.length===8,'setup: the server reads the seeded war: a LIVE round of 16 (8 matches), our match live',
    {match:st&&st.match&&{state:st.match.state,you:st.match.you&&st.match.you.name,foe:st.match.foe&&st.match.foe.name},bracket:st&&st.tournament&&(st.tournament.bracket||[]).map(r=>r.name+':'+r.matches.length)});
  try{
    for(const [k,parts] of [['wide',['title']],['phone',['title','import','sky','raid']],['desktop',['title','import','sky','raid']]]){ const S=SIZES[k];
      pg=await H.game(s.port,{w:S.w,h:S.h,touch:S.touch}); pg._port=s.port;
      const run=async(name,fn)=>{ try{ await fn(); }catch(e){ C.ok(false,S.tag+' '+name+' ran to the end',String(e&&e.stack||e).slice(0,500)); try{ await shot(pg,S.tag+' '+name+' error'); }catch(_){} } };
      if(parts.includes('title')) await run('Guild Hall title art and frame',()=>titleFrame(pg,S));
      if(parts.includes('import')) await run('Import picture',()=>importPicture(pg,S,s));
      if(parts.includes('sky')){ await run('Skyfall board screen',()=>skyBoard(pg,S)); await run('Falling and burning towers (live)',()=>ruinLive(pg,S));
        await run('Bracket panel',()=>bracket(pg,S)); await run('Falling and burning towers (replay)',()=>replayFall(pg,S)); }
      if(parts.includes('raid')) await run('Raid team screen',()=>raid(pg,S,s));
      C.ok(pg._errs.length===0,S.tag+' no page errors',pg._errs.slice(0,3));
      await pg._ctx.close(); pg=null; }
  }catch(e){ C.ok(false,'the test ran to the end',String(e&&e.stack||e).slice(0,600)); }
  finally{ if(pg) try{ await pg._ctx.close(); }catch(_){} await H.closeBrowser(); await s.stop(); }
  C.done();
})();
