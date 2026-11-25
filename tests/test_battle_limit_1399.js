// v1399 - Phil 17 Nov 2026: "all battles should be 3 minutes to time out now, not 90 seconds" / "every wave every battle" /
// "every single battle mode" / (Skyfall) "fix that for skyfall". Every battle mode's time limit is 180 s, in the page and on the server.
//   - the page's constants: BATTLE_TIME_LIMIT (every mode that runs updateBattle), SKY_FIGHT_CAP_S (the Skyfall board), ED_FIGHT_LIMIT (Emberdraft)
//   - the ENGINE, run headless the way the server runs it (server/sim-host.js): a fight nobody can win ends at 180 s - arena / mine / city
//     (simFightResult), campaign / elite / veteran, province, Well and Vault (simCampaignReplay, the wave that never falls), the guild raid
//     (simRaidReplay) - and a multi-wave replay has room for every wave at 180 s (simTickCap)
//   - the World Tree resolver (server/world-tree-battle.js) and its validator (server/world-tree-control.js): 180 battle-seconds = 90,000 ms
//   - the guild raid's line in every language says 180 seconds
// Live PvP rooms ('online') never had a time limit and still have none - checked here so a change to that is a decision, not an accident.
// Run: node tests/test_battle_limit_1399.js
'use strict';
const assert=require('assert'), fs=require('fs'), path=require('path'), vm=require('vm');
const root=path.join(__dirname,'..'), html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8').replace(/\r\n/g,'\n');
let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; console.log('  ok  '+m); };
const LIMIT=180;

/* 1. the page's constants */
const num=re=>{ const m=html.match(re); assert(m,'not found: '+re); return +m[1]; };
ok(num(/\nconst BATTLE_TIME_LIMIT=(\d+);/)===LIMIT, 'BATTLE_TIME_LIMIT = 180 (every mode that runs updateBattle)');
ok(num(/\nconst SKY_FIGHT_CAP_S\s*=\s*(\d+);/)===LIMIT, 'SKY_FIGHT_CAP_S = 180 (Skyfall lane fights on the board)');
ok(num(/\nconst GRAID_TIME_LIMIT=(\d+);/)===90, 'GRAID_TIME_LIMIT = 90 (guild raid - v1450, Phil 25 Nov: "Guild raid is 90 seconds")');
ok(/function battleLimit\(\)\{ return \(typeof CUR!=='undefined'&&CUR&&CUR\.mode==='graid'\)\?GRAID_TIME_LIMIT:BATTLE_TIME_LIMIT; \}/.test(html), 'battleLimit(): the guild raid 90 s, every other battle 180 s');
ok(num(/ED_FIGHT_LIMIT = (\d+), ED_OVERTIME/)===90, 'ED_FIGHT_LIMIT = 90 (Emberdraft - v1450, Phil 25 Nov: "Only 90 seconds")');
ok(num(/ED_FIGHT_LIMIT = \d+, ED_OVERTIME = (\d+)/)===30, 'Emberdraft attack-speed ramp = its last 30 s');
ok(/if\(battleTime>=ED_FIGHT_LIMIT\) return endBattle\('draw'\);/.test(html), 'Emberdraft ends its fight at ED_FIGHT_LIMIT');
ok(/if\(!ended && CUR\.mode!=='online' && CUR\.mode!=='emberdraft' && battleTime>=battleLimit\(\)\)\{ endBattle\(false\); return; \}/.test(html),
  'one time-out check for every mode but Emberdraft (its own) and live PvP rooms (none, as before)');
ok(!/battleTime\s*(>=|>|<|<=)\s*(90|45)\b/.test(html), 'no fight in the page compares battleTime to a hard-coded 90 or 45');
/* the Skyfall board maps the server's rounds onto 20 s .. SKY_FIGHT_CAP_S */
{ const grab=re=>{ const m=html.match(re); assert(m,'not found: '+re); return m[0]; };
  const c={Math}; vm.createContext(c);
  vm.runInContext([grab(/const SKY_FIGHT_CAP_S\s*=[^;]*;/),grab(/const SKY_FIGHT_MIN_S = [^;]*;/),grab(/const SKY_ROUNDS_LO = [^;]*;/),
    grab(/function skyFightMs\(e\)\{[\s\S]*?\n\}/)].join('\n'),c);
  ok(c.skyFightMs({rounds:300})===LIMIT*1000 && c.skyFightMs({rounds:9999})===LIMIT*1000, 'Skyfall: the longest lane fight is shown for 180 s');
  ok(c.skyFightMs({rounds:2})===20000, 'Skyfall: the shortest still 20 s'); }

/* 2. the engine the server runs - a fight nobody can win ends at 180 s in every headless mode */
const host=require(path.join(root,'server/sim-host.js')).load(path.join(root,'emberweave-heroes.html'));
const X=code=>vm.runInContext(code,host.ctx);
X(`window.__endT=null; const __eb0=endBattle; endBattle=function(){ if(window.__endT==null) window.__endT=battleTime; return __eb0.apply(this,arguments); };`);
const endT=()=>{ const t=X('window.__endT'); X('window.__endT=null'); return t; };
const near=(t,m)=>ok(typeof t==='number' && t>=LIMIT && t<LIMIT+0.05, m+' (ended at '+(t==null?'never':t.toFixed(3))+' s)'); const nearT=(t,L,m)=>ok(typeof t==='number' && t>=L && t<L+0.05, m+' (ended at '+(t==null?'never':t.toFixed(3))+' s)');
const TEAM=['vael','gruel','sylthaine','vireo','vex'], FOES=['tharl','hobb','rhukk','aureth','calypsa'];
const immortal=keys=>host.snapSquad(keys).map(s=>Object.assign(s,{maxHp:1e12,hp:1e12}));
const SIM_STEP=X('SIM_STEP');
{ const r=host.auto(immortal(TEAM),immortal(FOES),7); near(endT(),'arena / mine / city fight (simFightResult): times out at 180 s');
  ok(r.won===false && Math.abs(JSON.parse(r.digest).t-LIMIT)<0.05, 'its digest says a loss at 180 s'); }
const WALL=[{key:'granith',lvl:30,hpMul:1e9,dmgMul:0.001},{key:'rustclank',lvl:30,hpMul:1e9,dmgMul:0.001}];
for(const mode of ['campaign','province','well','vault']){
  const r=host.campaign(immortal(TEAM),[WALL,WALL,WALL],11,[[0,'auto',-1,1,null,null]],mode);
  near(endT(),mode+' (simCampaignReplay): the first wave nobody can win times out at 180 s');
  ok(r.won===false && JSON.parse(r.digest).wave===0, mode+': a loss on wave 1'); }
{ const sn=immortal(TEAM); host.raid(sn,{key:'wintercrag',lvl:15,hp:2e9,def:0,dmgMul:0.001,tier:1},5,[]); nearT(endT(),90,'guild raid boss (simRaidReplay): the attempt lasts 90 s (v1450, Phil 25 Nov: "Guild raid is 90 seconds")'); }   /* hp is read hp|0: 2e9 is the most a boss can carry */
for(let w=1;w<=8;w++) ok(X('simTickCap('+w+')')*SIM_STEP>=w*(LIMIT+30), 'a '+w+'-wave headless run has room for every wave at 180 s (+30 s walk-on each)');
ok(X('simTickCap(1)')===14400, 'a one-wave run keeps the old 14400-tick bound (every earlier fight ends on the same tick)');
ok(/for\(let i=0, _cap=simTickCap\(chapterWaves\);i<_cap && !ended;i\+\+\) updateBattle\(SIM_STEP\);/.test(html), 'simCampaignReplay runs to simTickCap(chapterWaves)');
ok(/for\(let i=0, _cap=simTickCap\(chapterWaves\);i<_cap && !ended && state==='battle';i\+\+\)/.test(html), 'the Skip button runs to simTickCap(chapterWaves)');

/* 3. the World Tree: 180 battle-seconds, reported at 500 ms each = 90,000 ms */
const WTB=require(path.join(root,'server/world-tree-battle.js')), wtSrc=fs.readFileSync(path.join(root,'server/world-tree-battle.js'),'utf8');
const wtcSrc=fs.readFileSync(path.join(root,'server/world-tree-control.js'),'utf8');
ok(WTB.FIGHT_MS===LIMIT*500, 'world-tree-battle FIGHT_MS = 90,000 (180 battle-seconds)');
ok(/const WT_FIGHT_MS=(\d+);/.exec(wtcSrc) && +/const WT_FIGHT_MS=(\d+);/.exec(wtcSrc)[1]===WTB.FIGHT_MS, 'world-tree-control validates against the same 90,000 ms');
ok(!/[<>(,]45000\b|\b90\/SIM_STEP|battleTime<90\b/.test(wtSrc+wtcSrc), 'no 45,000 ms / 90 s left in the World Tree resolver or validator');
{ const wt=WTB.create(host), a=immortal(TEAM.slice(0,3)), d=immortal(FOES.slice(0,3)); const r=wt(a,d,99);
  ok(r.won===false && r.durationMs===WTB.FIGHT_MS, 'a World Tree fight nobody can win lasts 90,000 ms and is not a win ('+r.durationMs+')'); }

/* 4. what the player reads */
for(const f of fs.readdirSync(path.join(root,'lang')).filter(f=>/^[a-zA-Z-]+\.json$/.test(f))){
  const j=JSON.parse(fs.readFileSync(path.join(root,'lang',f),'utf8')); if(!j['roster.raid_sub']) continue;
  ok(/90/.test(j['roster.raid_sub']) && !/180/.test(j['roster.raid_sub']), f+': the guild raid line says 90 seconds'); }
ok(html.includes('"roster.raid_sub":"First {n} fight the boss — the rest step in as they fall · 90 seconds · all damage counts"'), "the page's own English copy says 90 seconds");
console.log('test_battle_limit_1399: '+pass+' checks passed');
