// v1429 (tester Soul Eater, Phil's WhatsApp group 21 Nov 2026, forwarded by Phil) - three fixes:
//  1. Irix, the Sky-Shard Roc, the 16-10 boss: +20% health and damage ("10%, or maybe 20%, and then I'll tell you if it's okay"), in that
//     fight only. A per-stage tune on the boss's authored spec (tuneHp / tuneDmg), applied by campEnemyUnit - the one function the enemy card,
//     the fight and the server's replay check all use. Normal, Elite and Veteran 16-10 all carry it (Veteran stays Normal x2, Elite keeps its
//     ratio). The Bonus stage that borrows the chapter boss copies only hpMul / dmgMul, so its Irix is unchanged.
//  2. City Wall: the wall art is drawn whole in height, anchored left, and the lines panel column is never wider than the space right of
//     the art's banner (the browser shots are in Archive Open Projects/TESTER FIXES v1429 22NOV2026/).
//  3. Witches Hut > Cauldron: "Full in {t}" / "Full", from the server's exact refill time (witchFullInMs, fullInMs on /api/witch/state).
// CONTROLS: a spec without the tune gives the v1428 numbers; a full time one tick early is caught; a missing language key is caught.
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm'), assert=require('assert');
const ROOT=path.join(__dirname,'..');
let P=0; const ok=(c,m)=>{ assert(c,m); P++; console.log('  ok   '+m); };
const load=f=>JSON.parse(fs.readFileSync(path.join(ROOT,'server',f),'utf8'));
const FILES={normal:'campaign-encounters.json',elite:'elite-campaign-encounters.json',veteran:'veteran-campaign-encounters.json'};
const html=fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8'), srv=fs.readFileSync(path.join(ROOT,'server.js'),'utf8');

console.log('== 1. Irix on 16-10 ==');
const D={}; for(const [m,f] of Object.entries(FILES)) D[m]=load(f);
for(const [m,S] of Object.entries(D)){
  const tuned=[]; S.forEach(s=>s.waves.forEach((w,wi)=>w.forEach((u,ui)=>{ if('tuneHp' in u||'tuneDmg' in u) tuned.push({id:s.id,wi,ui,u}); })));
  ok(tuned.length===1&&tuned[0].id==='16-10'&&tuned[0].u.key==='irix'&&tuned[0].u.boss===true,m+': exactly one unit carries a tune - the 16-10 boss Irix');
  ok(tuned[0].u.tuneHp===1.2&&tuned[0].u.tuneDmg===1.2,m+': its tune is +20% health and +20% damage');
}
{ const N=Object.fromEntries(D.normal.map(s=>[s.id,s])), V=D.veteran;
  ok(V.every(v=>v.waves.every((w,wi)=>w.every((u,ui)=>Math.abs(u.hpMul/(N[v.id].waves[wi][ui].hpMul*2)-1)<1e-3&&(u.tuneHp||1)===(N[v.id].waves[wi][ui].tuneHp||1)))),
    'Veteran stays exactly Normal x2, tune included'); }
const host=require(path.join(ROOT,'server','sim-host.js')).load(path.join(ROOT,'emberweave-heroes.html'));
const fight=(spec,waves)=>{ host.sandbox.__s=spec; host.sandbox.__w=waves; return JSON.parse(vm.runInContext(`(function(){
  const c=campEnemyUnit(__s,0,0,'campaign',true); window._p2guard=true; units=[]; CUR={mode:'campaign',node:160,seed:1,cwaves:__w,headless:true}; waveIdx=__w.length-1; chapterWaves=__w.length;
  buildEnemyWave(); const u=units.find(x=>x.key===__s.key&&x.boss);
  return JSON.stringify({card:[c.maxHp,c.dmg],fight:u?[u.maxHp,u.dmg]:null}); })()`,host.ctx)); };
const EXPECT={normal:[48670,58404],elite:[71575,85890],veteran:[97341,116809]};   // v1428 (7e1675cbf) HP -> v1429 HP, measured in this engine
for(const [m,S] of Object.entries(D)){
  const st=S.find(s=>s.id==='16-10'), spec=st.waves.flat().find(u=>u.boss);
  const plain=Object.assign({},spec); delete plain.tuneHp; delete plain.tuneDmg;
  const now=fight(spec,st.waves), was=fight(plain,st.waves.map(w=>w.map(u=>u===spec?plain:u)));
  ok(now.fight&&now.fight[0]===now.card[0]&&Math.abs(now.fight[1]-now.card[1])<1e-9,m+' 16-10: the enemy card and the fight build the same Irix ('+now.fight[0]+' HP, '+now.fight[1].toFixed(1)+' damage)');
  ok(was.fight[0]===EXPECT[m][0],'CONTROL '+m+': without the tune Irix is the v1428 '+EXPECT[m][0]+' HP');
  ok(now.fight[0]===EXPECT[m][1]&&now.fight[0]===Math.round(was.fight[0]*1.2),m+' 16-10: Irix HP '+was.fight[0]+' -> '+now.fight[0]+' (x1.2)');
  ok(Math.abs(now.fight[1]/was.fight[1]-1.2)<1e-9,m+' 16-10: Irix damage '+was.fight[1].toFixed(1)+' -> '+now.fight[1].toFixed(1)+' (x1.2)');
}
{ const B=require(path.join(ROOT,'server','bonus-stages.js')); const b=B.bossFor(D.normal,16), spec=D.normal.find(s=>s.id==='16-10').waves.flat().find(u=>u.boss);
  ok(b&&b.key==='irix'&&!('tuneHp' in b)&&!('tuneDmg' in b)&&b.hpMul===spec.hpMul&&b.dmgMul===spec.dmgMul,'the Bonus stage boss read off 16-10 is the untuned Irix (hpMul '+b.hpMul+') - the tune stays in the 16-10 fight'); }
ok(/const args=\[pl\.snaps,st\.waves,f\.rc\.seed>>>0,pl\.transcript\|\|\[\]\]/.test(srv)&&/sandbox\.simCampaignReplay\(allySnaps, cwaves/.test(fs.readFileSync(path.join(ROOT,'server','sim-host.js'),'utf8')),
  'the server\'s replay check fights the authored st.waves through the client engine (simCampaignReplay -> campEnemyUnit), so it sees the same tuned Irix');
{ const plainOther=D.normal.find(s=>s.id==='15-10').waves.flat().find(u=>u.boss), r=fight(plainOther,D.normal.find(s=>s.id==='15-10').waves);
  ok(r.fight&&r.fight[0]===r.card[0],'other chapter bosses build as before (15-10 '+plainOther.key+' '+r.fight[0]+' HP, no tune)'); }

console.log('== 2. City Wall art ==');
const W='#wall:not(:has([data-wall-tab="cauldron"]:not(.secondary)))';
ok(html.includes(W+"{background:linear-gradient(90deg,#080d1626,transparent 40%,#080b1450),url('/assets/img/ui/building-main/wall-hall.webp?v=1') left center/auto 100% no-repeat #0c0f17!important}"),
  'the wall art is drawn whole in height, anchored left, dark hall colour beyond it (was center/cover)');
ok(!html.includes(W+"{background:linear-gradient(90deg,#080d1626,transparent 40%,#080b1450),url('/assets/img/ui/building-main/wall-hall.webp?v=1') center/cover"),'no City Wall rule still draws the wall art center/cover (the raid prep screen #atkPrep keeps its own)');
ok(html.includes(W+' #wallBody>.panel{box-shadow:none!important}'),'the lines panel draws no box-shadow rectangle over the art');
ok(html.includes('@media(min-width:701px){'+W+' #wallBody{width:max(380px,min(57%,calc(100% - min(var(--ew-game-height,100vh),var(--ew-game-width,100vw)*572/1024)*0.95 - 3%)))!important')
  &&html.includes('@media(max-height:560px) and (min-width:701px){'+W+' #wallBody{width:max(380px,min(66%,calc(100% - min(var(--ew-game-height,100vh),var(--ew-game-width,100vw)*572/1024)*0.95 - 2%)))!important'),
  'the lines column is never wider than the space right of the art banner (0.95 x the game height = #app min(H, W*572/1024)), on phones (560 px high) and larger screens');
{ // the geometry those rules give (the picture is 1672x941; the banner ends at x=910; the frame art starts 7.4% inside the panel box)
  const col=(W,VH)=>{ const H=Math.min(VH,W*572/1024), pct=H<=560?0.66:0.57, mr=H<=560?0.02:0.03; const w=Math.min(860,Math.max(380,Math.min(pct*W,W-0.95*H-mr*W))); return {left:W-mr*W-w, w, H}; };
  for(const [n,w,h] of [['phone 844x390',844,390],['phone 915x412',915,412],['tablet 1024x572',1024,572],['desktop 1400x900 (game 1400x782)',1400,900],['wide 1920x1080',1920,1080],['iPad 1024x768',1024,768]]){
    const c=col(w,h), banner=910*c.H/941, frame=c.left+0.074*c.w;
    ok(frame>=banner-2,n+': the panel frame starts at '+Math.round(frame)+' px, right of the art banner ('+Math.round(banner)+' px)'); }
  const oldPhone=844-0.02*844-0.66*844; ok(oldPhone+0.074*0.66*844<760*844/1672,'CONTROL: the v1428 phone column (66%) started over the gate itself'); }

console.log('== 3. Cauldron "Full in" ==');
const WITCH=require(path.join(ROOT,'server','witches-hut.js'));
const fsrc=srv.match(/function witchFullInMs\(state,cap,now\)\{[\s\S]*?\n  return [^\n]*\}/); ok(fsrc,'server.js has witchFullInMs');
const witchFullInMs=new Function('WITCH','return '+fsrc[0])(WITCH);
ok(/refillMs:WITCH\.TICK_MS\*WITCH\.FULL_TICKS,fullInMs:witchFullInMs\(w\.state,w\.capacity,now\)/.test(srv),'/api/witch/state answers fullInMs next to refillMs');
const check=(fn,cap,missing,phase)=>{ const now=1e12, st={level:20,brew:cap-missing,tickAt:now-phase,hp:{},spent:[],shopUses:{first:0,second:0},surgeUntil:0};
  const ms=fn(st,cap,now); const a=JSON.parse(JSON.stringify(st)), b=JSON.parse(JSON.stringify(st));
  WITCH.settle(a,cap,now+ms-1); WITCH.settle(b,cap,now+ms); return {ms, before:a.brew, at:b.brew}; };
let good=0, total=0;
for(const [cap,missing,phase] of [[11592,70,0],[11592,70,3000],[11592,70,5999],[11592,1,1000],[11592,11592,0],[9000,4500,2500],[123457,0.5,0],[11592,11591.9,4000]]){
  const r=check(witchFullInMs,cap,missing,phase); total++;
  if(r.at>=cap-1e-6&&r.before<cap-1e-6&&r.ms>0) good++; else console.log('   bad',cap,missing,phase,JSON.stringify(r)); }
ok(good===total,'fullInMs is exact on the 6 s refill ticks: not full 1 ms before, full at that moment ('+good+'/'+total+' cases, every tick phase)');
{ const now=1e12; ok(witchFullInMs({brew:11592,tickAt:now-2000},11592,now)===0,'a full cauldron answers 0 ("Full")'); }
{ const early=(st,cap,now)=>Math.max(0,witchFullInMs(st,cap,now)-WITCH.TICK_MS), r=check(early,11592,70,3000);
  ok(!(r.at>=11592-1e-6),'CONTROL: a time one tick early is caught (the cauldron is not full then)'); }
const rc=html.slice(html.indexOf('async function renderCauldron('),html.indexOf('function renderWallDur('));
ok(/class="whFull"[^>]*>\$\{whFullTxt\(whFullAt-Date\.now\(\)\)\}/.test(rc)&&/const bf=panel\.querySelector\('\.whFull'\); if\(bf\) bf\.textContent=whFullTxt\(whFullAt-t\);/.test(rc),
  'the Cauldron tab shows the counter and the panel\'s 1 s tick counts it down');
ok(/ewT\('hut\.full_in',\{t:fmtDur\(ms\)\}\):ewT\('hut\.full'\)/.test(rc)&&/w\.fullInMs!=null/.test(rc),'"Full in {t}" while filling, "Full" at the top, from the server\'s fullInMs');
const CODES=['en','es','pt-BR','fr','de','it','nl','ru','tr','ja','ko','zh-Hans','zh-Hant','th','id','hi'];
const miss=(packs)=>CODES.filter(c=>!(typeof packs[c]['hut.full_in']==='string'&&packs[c]['hut.full_in'].includes('{t}')&&typeof packs[c]['hut.full']==='string'&&packs[c]['hut.full'].trim()));
const packs={}; for(const c of CODES) packs[c]=JSON.parse(fs.readFileSync(path.join(ROOT,'lang',c+'.json'),'utf8'));
ok(miss(packs).length===0,'hut.full_in ({t}) and hut.full are in all 16 language files');
{ const p2=JSON.parse(JSON.stringify(packs)); delete p2.ja['hut.full']; ok(miss(p2).join()==='ja','CONTROL: a language without the key is caught'); }
console.log('test_irix_wall_cauldron_1429.js: '+P+' checks passed');
