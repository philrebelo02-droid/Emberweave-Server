/* ===========================================================================
   v274 — FORGED-STATE MATRIX (hardening directive §2 proof + acceptance §7.2).
   Tamper with every legacy field a browser could hold — wallet, hero progression, refine, gear,
   materials, temper, equipped slots, active skill, glyphs, academy, campaign progress — then start
   real battles and prove the SERVER-BUILT snapshot, the recorded result and the ledger are unmoved.
   =========================================================================== */
const http=require('http');
const PORT=process.env.PORT||8871;
function req(path, body, token){ return new Promise((res,rej)=>{ const d=body?JSON.stringify(body):null;
  const r=http.request({host:'localhost',port:PORT,path,method:body?'POST':'GET',
    headers:Object.assign({'content-type':'application/json'},token?{'x-token':token}:{},d?{'content-length':Buffer.byteLength(d)}:{})},
    x=>{ let s=''; x.on('data',c=>s+=c); x.on('end',()=>{ try{res(JSON.parse(s));}catch(e){res({raw:s});} }); });
  r.on('error',rej); if(d)r.write(d); r.end(); }); }
let pass=0,fail=0; const ck=(n,c,d)=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n+(d?' — '+d:''))); };
const rid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const SQUAD=['vael','sylthaine','vireo'];
const stats=(snaps)=>snaps.map(s=>[s.key,Math.round(s.maxHp),Math.round(s.dmg),Math.round(s.armorRating||0),Math.round(s.apow||0),s.rank].join('/')).join(' ');

(async()=>{
  console.log('== v274: forged local state cannot reach a battle ==');
  const reg=await req('/api/register',{name:'fg'+Math.floor(Math.random()*1e6),pass:'password1'});
  const T=reg.token; ck('account registered', !!T);

  const clean=await req('/api/campaign/start',{mode:'normal',node:1,heroIds:SQUAD,requestId:rid()},T);
  const baseline=stats(clean.snaps);
  ck('a clean session produces server-built snapshots', !!baseline && clean.snaps.length===3, baseline);

  /* every legacy field family, forged at once */
  const FORGED={
    gold:999999999, gems:4999999, playerXP:98000000,
    heroXP:{vael:98000000, sylthaine:98000000, vireo:98000000},
    starLevel:{vael:5,sylthaine:5,vireo:5}, starPip:{vael:5}, starRefine:{vael:15},
    heroFrag:{vael:9999}, unlocked:{konwu:true,grosk:true}, stamina:999,
    campaignCleared:100, stageStars:{1:3,2:3,3:3},
    tech:{atk:60,hp:60,armor:60,mr:60,crit:60,def:60,ap:60}, prayer:200,
    skillLevel:{vael:[10,10,10,10]},
    // gear + equipment, every shape the old client used
    equip:{vael:['w9','a9','h9','b9','r9','t9']}, eqInv:{w9:99}, eqMats:{cloth:99999,blade:99999,wood:99999,ore:99999},
    gear:{items:{x:{d:'orange_blade',t:30}}, equipped:{vael:{Weapon:'x'}}, active:{vael:'x'}, fragments:{orange:9999}},
    temper:{vael:30}, glyphRank:{vael:15}, glyphInv:{'Orange Stoneheart':99}, dust:9999999, starShards:9999
  };
  await req('/api/save',{roster:{__save:JSON.stringify(FORGED)}, team:[{key:'vael',level:99999,rank:999}], requestId:rid()},T);

  const after=await req('/api/campaign/start',{mode:'normal',node:1,heroIds:SQUAD,requestId:rid()},T);
  ck('the session after tampering still resolves from the ledger', after.ok===true||after.resumed===true, JSON.stringify(after).slice(0,120));
  ck('the server-built combat snapshot is IDENTICAL after tampering', stats(after.snaps)===baseline,
     '\n      before: '+baseline+'\n      after : '+stats(after.snaps));

  const led=await req('/api/ledger',null,T);
  ck('wallet unchanged by the forged save', led.gold<=1000 && led.gems<=300, 'gold '+led.gold+' gems '+led.gems);
  ck('hero progression unchanged', !(led.hero&&led.hero.vael&&led.hero.vael.xp>0), JSON.stringify(led.hero&&led.hero.vael));
  ck('refine level unchanged', !(led.hero&&led.hero.vael&&led.hero.vael.ref>0));
  ck('no hero unlocked by the forged save', !(led.unlocked&&led.unlocked.konwu));
  ck('campaign progress unchanged', (led.camp&&led.camp.cleared|0)===0);
  ck('equipment materials unchanged', !(led.eqMats&&(led.eqMats.cloth>0)), JSON.stringify(led.eqMats));
  ck('skill levels unchanged', !(led.skill&&led.skill.vael&&led.skill.vael[0]>1), JSON.stringify(led.skill&&led.skill.vael));

  const gear=await req('/api/gear/state',null,T);
  const items=(gear&&gear.state&&gear.state.items)||(gear&&gear.items)||{};
  ck('the Forge inventory is unchanged by a forged gear payload', Object.keys(items).length===0, JSON.stringify(items).slice(0,120));

  /* the stored blob itself keeps none of it */
  const me=await req('/api/me',null,T);
  const blob=(me&&(me.profile||me).roster&&(me.profile||me).roster.__save)||'';
  let kept=[]; try{ const g=JSON.parse(blob); kept=Object.keys(FORGED).filter(k=>g[k]!==undefined); }catch(e){}
  ck('the stored save keeps none of the server-owned fields', kept.length===0, 'still stored: '+kept.join(','));

  /* and the snapshot builder refuses to invent a hero without a ledger */
  const src=require('fs').readFileSync(__dirname+'/server.js','utf8');
  ck('the legacy snapshot fallback branch is deleted, not merely unreachable',
     !/save=save\|\|parseSaveOf\(u\);/.test(src) && /refusing to build a snapshot from a client save/.test(src));
  const cli=require('fs').readFileSync(__dirname+'/emberweave-heroes.html','utf8');
  ck('a signed-in client grants no combat power from the legacy equip bundle',
     /if\(ACC && ACC\.token\) return out;\s+\/\/ signed in: the server owns gear/.test(cli));

  console.log(''); console.log('PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
