// v1430 (tester Soul Eater 22 Nov 2026, Phil answered "Fixing"): the 16-10 final boss.
//  1. "Then add 50% more." - Irix, the Sky-Shard Roc, gets +50% health and +50% damage over his ORIGINAL (v1428) strength, replacing the
//     v1429 +20%, in Normal, Elite and Veteran 16-10 (tuneHp / tuneDmg 1.5, applied by campEnemyUnit - enemy card, fight and the server's
//     replay check all read it). Veteran stays Normal x2.
//  2. "Perhaps you could remove the hero who is accompanying him and use a tank instead." - on NORMAL the hero at Irix's side (Tick, the
//     stage's reward hero) is replaced by Rhukk, an existing Tank hero (beetle-kin of the deep roots, so he fits
//     the World-Tree Crown) in the same slot, level, multipliers and rank. The stage still names and pays its reward hero (companionSwap,
//     server.js rewardHeroFoughtSrv), so nobody loses hero fragments. Elite / Veteran keep Oakmir (a healer - measured: swapping him for a tank made Elite easier).
// CONTROLS: a 16-10 without its companionSwap record fails the server check; a swap on any other stage is not allowed by the tests.
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm'), assert=require('assert');
const ROOT=path.join(__dirname,'..');
let P=0; const ok=(c,m)=>{ assert(c,m); P++; console.log('  ok   '+m); };
const load=f=>JSON.parse(fs.readFileSync(path.join(ROOT,'server',f),'utf8'));
const FILES={normal:'campaign-encounters.json',elite:'elite-campaign-encounters.json',veteran:'veteran-campaign-encounters.json'};
const D={}; for(const [m,f] of Object.entries(FILES)) D[m]=load(f);
const srv=fs.readFileSync(path.join(ROOT,'server.js'),'utf8');

console.log('== 1. Irix +50% ==');
const host=require(path.join(ROOT,'server','sim-host.js')).load(path.join(ROOT,'emberweave-heroes.html'));
const wave=(waves)=>{ host.sandbox.__w=waves; return JSON.parse(vm.runInContext(`(function(){
  window._p2guard=true; units=[]; CUR={mode:'campaign',node:160,seed:1,cwaves:__w,headless:true}; waveIdx=__w.length-1; chapterWaves=__w.length;
  buildEnemyWave(); return JSON.stringify(units.filter(u=>u.team==='enemy').map(u=>({key:u.key,boss:!!u.boss,hp:u.maxHp,dmg:u.dmg}))); })()`,host.ctx)); };
const card=(spec)=>{ host.sandbox.__s=spec; return JSON.parse(vm.runInContext(`(function(){ const c=campEnemyUnit(__s,0,0,'campaign',true); return JSON.stringify([c.maxHp,c.dmg]); })()`,host.ctx)); };
const ORIG={normal:[48670,2391.8],elite:[71575,3659.4],veteran:[97341,4783.6]};   // v1428 (7e1675cbf), no tune, measured in this engine
const NOW={normal:73005,elite:107363,veteran:146012};
for(const [m,S] of Object.entries(D)){
  const st=S.find(s=>s.id==='16-10'), spec=st.waves.flat().find(u=>u.boss);
  ok(spec.key==='irix'&&spec.tuneHp===1.5&&spec.tuneDmg===1.5,m+' 16-10: Irix carries tuneHp 1.5 / tuneDmg 1.5');
  const plain=Object.assign({},spec); delete plain.tuneHp; delete plain.tuneDmg;
  const now=wave(st.waves).find(u=>u.key==='irix'), was=wave(st.waves.map(w=>w.map(u=>u===spec?plain:u))).find(u=>u.key==='irix');
  ok(was.hp===ORIG[m][0]&&Math.abs(was.dmg-ORIG[m][1])<0.05,'CONTROL '+m+': without the tune Irix is the original '+was.hp+' HP / '+was.dmg.toFixed(1)+' damage');
  ok(now.hp===NOW[m]&&now.hp===Math.round(was.hp*1.5),m+' 16-10: Irix HP '+was.hp+' -> '+now.hp+' (x1.5)');
  ok(Math.abs(now.dmg/was.dmg-1.5)<1e-9,m+' 16-10: Irix damage '+was.dmg.toFixed(1)+' -> '+now.dmg.toFixed(1)+' (x1.5)');
  const c=card(spec); ok(c[0]===now.hp&&Math.abs(c[1]-now.dmg)<1e-9,m+' 16-10: the enemy card shows the same Irix as the fight');
}
{ const N=Object.fromEntries(D.normal.map(s=>[s.id,s])), v=D.veteran.find(s=>s.id==='16-10');
  ok(v.waves.every((w,wi)=>w.every((u,ui)=>{ const n=N['16-10'].waves[wi][ui]; return (u.key===n.key||(u.rewardHero&&u.key===v.rewardHero))&&Math.abs(u.hpMul/(n.hpMul*2)-1)<1e-3&&(u.tuneHp||1)===(n.tuneHp||1)&&(u.tuneDmg||1)===(n.tuneDmg||1); })),
    'Veteran 16-10 stays exactly Normal x2 - same units (its own reward hero in the hero slot), same tune'); }
{ const B=require(path.join(ROOT,'server','bonus-stages.js')); const b=B.bossFor(D.normal,16);
  ok(b&&b.key==='irix'&&!('tuneHp' in b),'the Bonus stage boss borrowed from 16-10 stays the untuned Irix'); }

console.log('== 2. a tank instead of the hero at his side ==');
const WAS={normal:'tick',elite:'oakmir',veteran:'oakmir'};
/* Normal only. On Elite / Veteran the hero at Irix's side is Oakmir, a HEALER: measured with the v1372 ruler team (40 fights per probe, Affinities
   on), Elite 16-10 with Irix x1.5 and Rhukk instead of Oakmir was 0.81x as hard as the original stage - easier, because Oakmir's healing on Irix
   is worth more than a tank. Elite x1.5 with Oakmir is 1.46x; Normal x1.5 with Rhukk 1.59x (x1.5 with Tick 1.26x). So Elite and Veteran keep Oakmir. */
for(const m of ['elite','veteran']){ const st=D[m].find(s=>s.id==='16-10'), fin=st.waves[st.waves.length-1];
  ok(fin.some(u=>u.key==='oakmir'&&u.isHero&&u.rewardHero)&&!fin.some(u=>u.key==='rhukk')&&!st.companionSwap&&!D[m].some(s=>s.companionSwap),m+' 16-10 keeps Oakmir (the healer at Irix\'s side makes it harder than a tank would) - no swap anywhere in '+m); }
for(const [m,S] of Object.entries({normal:D.normal})){
  const st=S.find(s=>s.id==='16-10'), fin=st.waves[st.waves.length-1];
  ok(!fin.some(u=>u.key===WAS[m]),m+' 16-10: '+WAS[m]+' no longer fights beside Irix');
  const r=fin.filter(u=>u.key==='rhukk');
  ok(r.length===1&&r[0].isHero===true&&!r[0].rewardHero&&!r[0].boss&&r[0].rank===3&&r[0].lvl===100,m+' 16-10: Rhukk (Tank) stands in that slot - a rank-3 level-100 hero, not tagged as the reward');
  ok(st.rewardHero===WAS[m]&&st.companionSwap&&st.companionSwap.out===WAS[m]&&st.companionSwap.in==='rhukk'&&st.companionSwap.rewardHero===WAS[m],
    m+' 16-10: the stage still names and pays '+WAS[m]+' (companionSwap '+WAS[m]+' -> rhukk)');
  ok(S.filter(s=>s.companionSwap).length===1,m+': 16-10 is the only stage with a companion swap');
  const units=wave(st.waves); const rk=units.find(u=>u.key==='rhukk');
  ok(rk&&rk.hp>0&&rk.dmg>0&&units.length===fin.length,m+' 16-10: the final wave builds in the engine ('+units.map(u=>u.key).join(', ')+'; Rhukk '+(rk&&rk.hp)+' HP)');
}
// the hero-fragment payout reads st.rewardHero, never the fight
ok(/const _hk=st\.rewardHero\|\|eliteHeroForSrv\(a\.node\)/.test(srv)&&/function portalPaysHeroFrag\(mode,st,node\)\{ return !!\(st&&st\.rewardHero\)/.test(srv),'the hero fragments a clear pays come from the stage\'s rewardHero, so 16-10 still pays Tick / Oakmir');
// the server's boot check, extracted and run
{ const src=srv.match(/function rewardHeroFoughtSrv\(e,final,key\)\{[\s\S]*?\n  return [^\n]*\}/); ok(!!src,'server.js has rewardHeroFoughtSrv');
  const f=vm.runInNewContext('('+src[0]+')');
  for(const [m,S] of Object.entries(D)){ const st=S.find(s=>s.id==='16-10');
    if(m!=='normal'){ ok(f(st,st.waves[st.waves.length-1],st.rewardHero)===true,m+' 16-10 passes the boot check with Oakmir as before'); continue; }
    ok(f(st,st.waves[st.waves.length-1],st.rewardHero)===true,m+' 16-10 passes the server\'s "fights its reward hero" boot check through its swap');
    const bare=JSON.parse(JSON.stringify(st)); delete bare.companionSwap;
    ok(f(bare,bare.waves[bare.waves.length-1],bare.rewardHero)===false,'CONTROL '+m+': without the companionSwap record the boot check fails');
    const other=S.find(s=>s.id==='16-7'&&s.rewardHero)||S.find(s=>s.rewardHero&&s.id!=='16-10');
    ok(f(other,other.waves[other.waves.length-1],other.rewardHero)===true,m+' '+other.id+': an ordinary hero stage still passes as before'); } }
ok(['portalCompile','campCompile'].every(fn=>new RegExp('function '+fn+'\\(\\)[\\s\\S]{0,4000}rewardHeroFoughtSrv\\(e,').test(srv)),'both boot validators (Normal campCompile, Elite/Veteran portalCompile) use it');

console.log('== 3. patch note ==');
const feed=JSON.parse(fs.readFileSync(path.join(ROOT,'patchnotes.json'),'utf8')).patches;
ok(feed[0].ver==='1.9.9'&&/50% more health/.test(feed[0].items[0])&&/Rhukk/.test(feed[0].items[1]),'patch note 1.9.9 is first in the feed: Irix +50% and Rhukk');
console.log('test_irix_final_boss_1430.js: '+P+' checks passed');
