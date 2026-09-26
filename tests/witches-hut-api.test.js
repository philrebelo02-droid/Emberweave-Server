'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const {spawn} = require('node:child_process');
const mineHost=require('../server/sim-host.js').load(path.join(__dirname,'..','emberweave-heroes.html'));

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function run() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ember-witch-test-'));
  const db=path.join(dir,'db.json'), port=await freePort(), base=`http://127.0.0.1:${port}`;
  let child;
  async function request(method,route,data,token) {
    const response=await fetch(base+route,{method,headers:{...(token?{'x-token':token}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    return response.json();
  }
  async function start(adminId, mineTestMs='20', cityTestMs='20', warTestMs='20') {
    child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),windowsHide:true,
      stdio:'ignore',env:{...process.env,PORT:String(port),DB_FILE:db,ADMIN_IDS:adminId||'',REG_PER_MIN:'200',REG_ACCOUNTS_PER_IP:'200',
        NODE_ENV:'test',WORLD_MINE_TEST_MS:mineTestMs,WORLD_WAR_TEST_MS:warTestMs,WORLD_CITY_TEST_MS:cityTestMs}});
    for(let i=0;i<180;i++) {
      if(child.exitCode!==null) throw Error('Fixture server exited before readiness');
      try { const r=await fetch(base+'/health'); if(r.ok) return; } catch (_) {}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw Error('Fixture server did not start');
  }
  async function stop() {
    if(!child) return;
    const c=child; child=null; c.kill();
    await Promise.race([new Promise(resolve=>c.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);
  }
  try {
    await start();
    const admin=await request('POST','/api/register',{name:'witchAdmin',pass:'password1'});
    assert.ok(admin.token && admin.profile.id);
    await new Promise(resolve=>setTimeout(resolve,700));
    await stop();
    await start(admin.profile.id);
    const foe=await request('POST','/api/register',{name:'witchFoe',pass:'password1'});
    assert.ok(foe.token && foe.profile.id);
    const grant=await request('POST','/api/admin/led-grant',{
      userId:admin.profile.id,unlock:['vael','sylthaine','vireo'],heroKeys:['vael','sylthaine','vireo'],px:900000,heroXp:200000,gems:200
    },admin.token);
    assert.equal(grant.ok,true);
    const grantFoe=await request('POST','/api/admin/led-grant',{
      userId:foe.profile.id,unlock:['vael','sylthaine','vireo'],heroKeys:['vael','sylthaine','vireo'],px:900000
    },admin.token);
    assert.equal(grantFoe.ok,true);
    await request('POST','/api/save',{wall:[{key:'vael'},{key:'sylthaine'},{key:'vireo'}]},foe.token);
    const worldCities=await request('GET','/api/world/cities',null,admin.token);
    assert.equal(worldCities.cities.length,1);
    assert.equal(worldCities.bots.length,399,'server bots fill four regions around the one other real city');
    assert.ok(worldCities.bots.every(bot=>bot.bot&&bot.team.length===5));
    const botId=worldCities.bots[0].id;
    const botWar=await request('POST','/api/world/war/declare',{
      defId:botId,requestId:'witch-bot-war-1'
    },admin.token);
    assert.equal(botWar.ok,true,JSON.stringify(botWar));
    assert.equal(botWar.defId,botId);
    const botWarRetry=await request('POST','/api/world/war/declare',{
      defId:botId,requestId:'witch-bot-war-1'
    },admin.token);
    assert.deepEqual(botWarRetry,botWar,'bot war declaration is idempotent');
    const phantomBot=await request('POST','/api/world/war/declare',{
      defId:'bot_'+worldCities.bots[0].region+'_999',requestId:'witch-bot-forged'
    },admin.token);
    assert.equal(phantomBot.ok,false,'client cannot declare war on a fabricated bot');
    const initial=await request('GET','/api/witch/state',null,admin.token);
    assert.equal(initial.locked,false);
    assert.equal(initial.level,20);
    assert.ok(initial.capacity>0);
    const map=await request('GET','/api/world/mines',null,admin.token);
    assert.equal(map.ok,true);
    assert.equal(map.nodes.length,240);
    const castle=await request('GET','/api/world/state',null,admin.token);
    assert.equal(castle.ok,true);
    assert.equal(castle.locked,false);
    assert.ok(require('../server/world-location.js').valid(castle));
    const forged=await request('POST','/api/save',{
      world:{region:'tefron',x:0,y:100,level:100,power:99999999}
    },admin.token);
    assert.equal(forged.ok,true);
    const afterForge=await request('GET','/api/world/state',null,admin.token);
    assert.deepEqual(afterForge,castle,'browser save cannot move a server-assigned castle');
    const legacy=await request('POST','/api/world/mine',{res:'iron',amount:15,requestId:'unverified-mine'},admin.token);
    assert.equal(legacy.ok,false,'unsigned legacy mine grant is retired by default');
    const unregisteredAttack=await request('POST','/api/pvp/attack',{
      defId:foe.profile.id,requestId:'city-no-march'
    },admin.token);
    assert.equal(unregisteredAttack.ok,false,'city fight cannot bypass a registered march');
    const war=await request('POST','/api/world/war/declare',{
      defId:foe.profile.id,requestId:'witch-war-1'
    },admin.token);
    assert.equal(war.ok,true,JSON.stringify(war));
    const earlyMarch=await request('POST','/api/world/city/start',{
      defId:foe.profile.id,heroIds:['vael','sylthaine','vireo'],requestId:'witch-early-city'
    },admin.token);
    assert.equal(earlyMarch.ok,false,'war preparation is enforced by the server');
    await new Promise(resolve=>setTimeout(resolve,35));
    const cityMarch=await request('POST','/api/world/city/start',{
      defId:foe.profile.id,heroIds:['vael','sylthaine','vireo'],requestId:'witch-city-start'
    },admin.token);
    assert.equal(cityMarch.ok,true,JSON.stringify(cityMarch));
    await new Promise(resolve=>setTimeout(resolve,35));
    const attack=await request('POST','/api/pvp/attack',{
      defId:foe.profile.id,marchId:cityMarch.marchId,requestId:'witch-raid-1'
    },admin.token);
    assert.equal(attack.ok,true,JSON.stringify(attack));
    assert.ok(Array.isArray(attack.injuries.attacker) && Array.isArray(attack.injuries.defender));
    assert.ok(attack.replay?.snaps?.length===3 && attack.replay?.foe?.length===3,
      'real city fight returns both frozen squads');
    const cityReplay=mineHost.auto(attack.replay.snaps,attack.replay.foe,attack.replay.seed);
    assert.equal(cityReplay.won,attack.won,'city receipt replays with the visible real-time engine');
    const retry=await request('POST','/api/pvp/attack',{
      defId:foe.profile.id,marchId:cityMarch.marchId,requestId:'witch-raid-1'
    },admin.token);
    assert.deepEqual(retry,attack,'retry cannot inflict damage twice');
    const botRaider=await request('POST','/api/register',{name:'witchBotRaider',pass:'password1'});
    assert.ok(botRaider.token);
    const botGrant=await request('POST','/api/admin/led-grant',{
      userId:botRaider.profile.id,unlock:['vael','sylthaine','vireo'],
      heroKeys:['vael','sylthaine','vireo'],px:900000,heroXp:200000
    },admin.token);
    assert.equal(botGrant.ok,true);
    const botCities=await request('GET','/api/world/cities',null,botRaider.token);
    const targetBot=botCities.bots[0];
    const noBotMarch=await request('POST','/api/world/city/start',{
      defId:targetBot.id,heroIds:['vael','sylthaine','vireo'],requestId:'bot-before-war'
    },botRaider.token);
    assert.equal(noBotMarch.ok,false,'signed-in bot march requires a registered war');
    const verifiedBotWar=await request('POST','/api/world/war/declare',{
      defId:targetBot.id,requestId:'bot-verified-war'
    },botRaider.token);
    assert.equal(verifiedBotWar.ok,true,JSON.stringify(verifiedBotWar));
    await new Promise(resolve=>setTimeout(resolve,35));
    const beforeBotLedger=await request('GET','/api/ledger',null,botRaider.token);
    const botMarch=await request('POST','/api/world/city/start',{
      defId:targetBot.id,heroIds:['vael','sylthaine','vireo'],requestId:'bot-verified-start'
    },botRaider.token);
    assert.equal(botMarch.ok,true,JSON.stringify(botMarch));
    await new Promise(resolve=>setTimeout(resolve,35));
    const botFight=await request('POST','/api/pvp/attack',{
      defId:targetBot.id,marchId:botMarch.marchId,requestId:'bot-verified-fight'
    },botRaider.token);
    assert.equal(botFight.ok,true,JSON.stringify(botFight));
    assert.equal(mineHost.auto(botFight.replay.snaps,botFight.replay.foe,botFight.replay.seed).won,botFight.won,
      'bot receipt replays with the real-time fight engine');
    const botDigest=JSON.parse(mineHost.auto(botFight.replay.snaps,botFight.replay.foe,botFight.replay.seed).digest);
    const botWounds=await request('GET','/api/witch/state',null,botRaider.token);
    for(const snap of botFight.replay.snaps){
      const row=botDigest.u.find(u=>u[0]===snap.key&&u[1]==='ally');
      const hero=botWounds.heroes.find(h=>h.key===snap.key);
      assert.ok(row&&hero,'the bot replay and Hut both identify the marched hero');
      assert.equal(hero.hp,Math.round(Math.max(0,Math.min(snap.worldEntryHpCap,row[3]))/snap.maxHp*10000),
        'bot battle end health persists in the Witches Hut');
    }
    assert.deepEqual(await request('POST','/api/pvp/attack',{
      defId:targetBot.id,marchId:botMarch.marchId,requestId:'bot-verified-fight'
    },botRaider.token),botFight,'retry cannot pay bot loot or wound heroes twice');
    const afterBotLedger=await request('GET','/api/ledger',null,botRaider.token);
    assert.equal(afterBotLedger.gold-beforeBotLedger.gold,botFight.loot.gold);
    assert.equal(afterBotLedger.guildCoins-beforeBotLedger.guildCoins,botFight.loot.guildCoins);
    const forgedMarchEarn=await request('POST','/api/tx/earn',{
      what:'gold',reason:'march',amount:500,requestId:'bot-forged-earn'
    },botRaider.token);
    assert.equal(forgedMarchEarn.ok,false,'unverified browser march cannot mint gold');
    const hurt=await request('GET','/api/witch/state',null,foe.token);
    assert.ok(hurt.heroes.length>0,'defending heroes keep permanent wounds');
    const target=hurt.heroes[0];
    const healed=await request('POST','/api/witch/heal',{
      hero:target.key,requestId:'witch-heal-1'
    },foe.token);
    assert.equal(healed.ok,true,JSON.stringify(healed));
    assert.ok(healed.result.after>healed.result.before);
    const healedRetry=await request('POST','/api/witch/heal',{
      hero:target.key,requestId:'witch-heal-1'
    },foe.token);
    assert.deepEqual(healedRetry,healed,'heal retry cannot spend brew twice');
    const purchased=await request('POST','/api/witch/buy-brew',{
      tier:'first',requestId:'witch-buy-1'
    },foe.token);
    assert.equal(purchased.ok,true,JSON.stringify(purchased));
    assert.equal(purchased.result.gems,50);
    const purchasedRetry=await request('POST','/api/witch/buy-brew',{
      tier:'first',requestId:'witch-buy-1'
    },foe.token);
    assert.deepEqual(purchasedRetry,purchased,'shop retry cannot charge diamonds twice');
    const node=map.nodes.find(n=>n.level===1);
    assert.ok(node);
    const mining=await request('POST','/api/world/mine/start',{
      mineId:node.id,heroIds:['vael','sylthaine','vireo'],requestId:'mine-start-1'
    },admin.token);
    assert.equal(mining.ok,true,JSON.stringify(mining));
    const fake=await request('POST','/api/world/mine/start',{
      mineId:'mn999999_0',heroIds:['vael'],requestId:'mine-fake-1'
    },admin.token);
    assert.equal(fake.ok,false,'a forged mine id is refused');
    await new Promise(resolve=>setTimeout(resolve,60));
    const mined=await request('POST','/api/world/mine/resolve',{
      marchId:mining.marchId,requestId:'mine-resolve-1'
    },admin.token);
    assert.equal(mined.ok,true,JSON.stringify(mined));
    assert.equal(mined.won,true,'high-level squad should clear a level-one mine');
    assert.equal(mined.granted,15);
    assert.equal(mined.garrison.length,5);
    assert.ok(mined.injuries.length>0,'mine fight records hero injuries');
    assert.ok(mined.replay&&mined.replay.snaps.length===3,'mine returns the real battle snapshot');
    const replayed=mineHost.auto(mined.replay.snaps,mined.replay.foe,mined.replay.seed);
    assert.equal(replayed.won,mined.won,'mine receipt replays in the client combat engine');
    const finalHp=JSON.parse(replayed.digest).u.filter(u=>u[1]==='ally');
    for(const wound of mined.injuries){
      assert.ok(finalHp.some(u=>u[0]===wound.key),'wounded hero appears in real-time digest');
      assert.ok(wound.after<=wound.before,'world fight cannot cure permanent injury');
    }
    const minedRetry=await request('POST','/api/world/mine/resolve',{
      marchId:mining.marchId,requestId:'mine-resolve-2'
    },admin.token);
    assert.deepEqual(minedRetry,mined,'mine cannot pay or injure twice');
    // Keep a real-duration route check separate from the short fixture march above.
    // It verifies the server refuses early settlement without waiting hours for arrival.
    await stop();
    await start(admin.profile.id,'0');
    const persistedCastle=await request('GET','/api/world/state',null,admin.token);
    assert.equal(persistedCastle.region,castle.region,'assigned home region survives a server restart');
    assert.equal(persistedCastle.x,castle.x,'random castle square survives a server restart');
    assert.equal(persistedCastle.y,castle.y);
    const secondNode=map.nodes.find(n=>n.level===1&&n.id!==node.id);
    assert.ok(secondNode);
    const timed=await request('POST','/api/world/mine/start',{
      mineId:secondNode.id,heroIds:['vael','sylthaine','vireo'],requestId:'mine-production-timer'
    },admin.token);
    assert.equal(timed.ok,true,JSON.stringify(timed));
    assert.ok(timed.travel>=60000,'real march travel has at least one full minute');
    assert.equal(timed.gather,38*60000,'level-one gather uses the full production timer');
    assert.equal(timed.arriveAt,timed.depart+timed.travel+timed.gather);
    const L=require('../server/world-location.js');
    const expectedDistance=Math.max(1,Math.round(Math.hypot(
      secondNode.gx-L.cellIndex(castle.x),secondNode.gy-L.cellIndex(castle.y))));
    assert.equal(timed.travel,expectedDistance*60000,'real travel uses the server-assigned castle square');
    const premature=await request('POST','/api/world/mine/resolve',{
      marchId:timed.marchId,requestId:'mine-too-early'
    },admin.token);
    assert.equal(premature.ok,false,'mine cannot resolve before real arrival');
    assert.equal(premature.arriveAt,timed.arriveAt);
    const occupied=new Set(map.nodes.map(n=>n.gx+','+n.gy));
    const otherCities=await request('GET','/api/world/cities',null,admin.token);
    for(const c of otherCities.cities||[]) occupied.add(L.cellKey(c.x,c.y));
    function freeTarget(home,except){
      for(let cy=0;cy<L.GRID_COLS;cy++) for(let cx=0;cx<L.GRID_COLS;cx++){
        const x=L.center(cx),y=L.center(cy),key=cx+','+cy;
        if(key!==except&&!occupied.has(key)&&L.targetAllowed(home,x,y)) return {x,y};
      }
      throw Error('No free teleport target in the fixture');
    }
    const firstTarget=freeTarget(castle.region,L.cellKey(castle.x,castle.y));
    const move=await request('POST','/api/world/relocate',{
      kind:'targeted',...firstTarget,requestId:'world-free-teleport'
    },admin.token);
    assert.equal(move.ok,true,JSON.stringify(move));
    assert.equal(move.teleUsed,1);
    assert.equal(move.x,firstTarget.x);
    const moveRetry=await request('POST','/api/world/relocate',{
      kind:'targeted',...firstTarget,requestId:'world-free-teleport'
    },admin.token);
    assert.deepEqual(moveRetry,move,'teleport retry does not consume another use');
    const secondTarget=freeTarget(castle.region,L.cellKey(move.x,move.y));
    const noScroll=await request('POST','/api/world/relocate',{
      kind:'targeted',...secondTarget,requestId:'world-no-scroll'
    },admin.token);
    assert.equal(noScroll.ok,false,'second same-day targeted teleport needs a scroll');
    const boughtScroll=await request('POST','/api/world/buy-scrolls',{
      offer:'targeted1',requestId:'world-buy-one-scroll'
    },admin.token);
    assert.equal(boughtScroll.ok,true,JSON.stringify(boughtScroll));
    assert.equal(boughtScroll.teleScrolls,1);
    const spentScroll=await request('POST','/api/world/relocate',{
      kind:'targeted',...secondTarget,requestId:'world-use-scroll'
    },admin.token);
    assert.equal(spentScroll.ok,true,JSON.stringify(spentScroll));
    assert.equal(spentScroll.teleScrolls,0);
    const otherRegion=L.REGION_KEYS.find(k=>k!==castle.region);
    const transfer=await request('POST','/api/world/relocate',{
      kind:'transfer',region:otherRegion,requestId:'world-free-transfer'
    },admin.token);
    assert.equal(transfer.ok,true,JSON.stringify(transfer));
    assert.equal(transfer.region,otherRegion);
    const repeatTransfer=await request('POST','/api/world/relocate',{
      kind:'transfer',region:castle.region,requestId:'world-paid-transfer-no-gems'
    },admin.token);
    assert.equal(repeatTransfer.ok,false,'second transfer requires 1000 diamonds');
    const wild=await request('POST','/api/world/relocate',{
      kind:'wild',requestId:'world-free-wild'
    },admin.token);
    assert.equal(wild.ok,true,JSON.stringify(wild));
    assert.equal(wild.region,otherRegion);
    await stop();
    await start(admin.profile.id,'0','0');
    const traveler=await request('POST','/api/register',{name:'witchTraveler',pass:'password1'});
    assert.ok(traveler.token);
    const travelGrant=await request('POST','/api/admin/led-grant',{
      userId:traveler.profile.id,unlock:['vael','sylthaine','vireo'],
      heroKeys:['vael','sylthaine','vireo'],px:900000,heroXp:200000
    },admin.token);
    assert.equal(travelGrant.ok,true);
    const travelWar=await request('POST','/api/world/war/declare',{
      defId:foe.profile.id,requestId:'travel-war'
    },traveler.token);
    assert.equal(travelWar.ok,true,JSON.stringify(travelWar));
    await new Promise(resolve=>setTimeout(resolve,35));
    const longCity=await request('POST','/api/world/city/start',{
      defId:foe.profile.id,heroIds:['vael','sylthaine','vireo'],requestId:'travel-city'
    },traveler.token);
    assert.equal(longCity.ok,true,JSON.stringify(longCity));
    assert.ok(longCity.travel>=60000,'city travel uses a real minute or more');
    const tooSoon=await request('POST','/api/pvp/attack',{
      defId:foe.profile.id,marchId:longCity.marchId,requestId:'travel-too-soon'
    },traveler.token);
    assert.equal(tooSoon.ok,false,'city fight cannot settle before server arrival');
    assert.equal(tooSoon.arriveAt,longCity.arriveAt);
    await stop();
    const saved=JSON.parse(fs.readFileSync(db,'utf8'));
    saved.users[foe.profile.id].witch.hp={vael:0,sylthaine:0,vireo:0};
    fs.writeFileSync(db,JSON.stringify(saved));
    await start(admin.profile.id,'0','20');
    const undefRaider=await request('POST','/api/register',{name:'witchUndefRaider',pass:'password1'});
    assert.ok(undefRaider.token);
    const undefGrant=await request('POST','/api/admin/led-grant',{
      userId:undefRaider.profile.id,unlock:['vael','sylthaine','vireo'],
      heroKeys:['vael','sylthaine','vireo'],px:900000,heroXp:200000
    },admin.token);
    assert.equal(undefGrant.ok,true);
    const undefWar=await request('POST','/api/world/war/declare',{
      defId:foe.profile.id,requestId:'undef-war'
    },undefRaider.token);
    assert.equal(undefWar.ok,true);
    await new Promise(resolve=>setTimeout(resolve,35));
    const undefStart=await request('POST','/api/world/city/start',{
      defId:foe.profile.id,heroIds:['vael','sylthaine','vireo'],requestId:'undef-start'
    },undefRaider.token);
    assert.equal(undefStart.ok,true,JSON.stringify(undefStart));
    await new Promise(resolve=>setTimeout(resolve,35));
    const undefFight=await request('POST','/api/pvp/attack',{
      defId:foe.profile.id,marchId:undefStart.marchId,requestId:'undef-resolve'
    },undefRaider.token);
    assert.equal(undefFight.ok,true,JSON.stringify(undefFight));
    assert.equal(undefFight.won,true,'an undefended castle falls without a fabricated battle');
    assert.equal(undefFight.replay,null,'no defenders means no battle replay');
    assert.deepEqual(undefFight.injuries.attacker,[],'no fight means no new attacker injury');
    await stop();
    await start(admin.profile.id,'0','0','0');
    const warClock=await request('POST','/api/register',{name:'witchWarClock',pass:'password1'});
    assert.ok(warClock.token);
    const clockGrant=await request('POST','/api/admin/led-grant',{
      userId:warClock.profile.id,unlock:['vael','sylthaine','vireo'],
      heroKeys:['vael','sylthaine','vireo'],px:900000,heroXp:200000
    },admin.token);
    assert.equal(clockGrant.ok,true);
    const declaredAt=Date.now();
    const freshWar=await request('POST','/api/world/war/declare',{
      defId:foe.profile.id,requestId:'production-prep-war'
    },warClock.token);
    assert.equal(freshWar.ok,true,JSON.stringify(freshWar));
    assert.ok(freshWar.readyAt-declaredAt>=30*60000-1000,'production war prep lasts 30 minutes');
    const prepRefusal=await request('POST','/api/world/city/start',{
      defId:foe.profile.id,heroIds:['vael','sylthaine','vireo'],requestId:'production-prep-refusal'
    },warClock.token);
    assert.equal(prepRefusal.ok,false,'cannot attack during production war prep');
    console.log('Witches Hut API integration passed');
  } finally { await stop(); fs.rmSync(dir,{recursive:true,force:true}); }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
