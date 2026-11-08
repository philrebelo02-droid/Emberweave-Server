// v1310 (Phil 8 Nov 2026): "scale enemies skill by their level in campaign and vault" / "not level 1" - a campaign or Vault enemy casts at
// skill level = its own level (was always 1); "reduce thick chittin to 3% per 3 seconds, maxing at 15% at level 1 and 25% at 100" - Rhukk's
// own warden numbers, the other warden passives unchanged; "lower carapace to 20% and 35% at 100" (checked in test_rhukk_bitwraith_1308.js).
// CONTROL: the live v1309 page (git show 3aeb2146) builds the same enemies at skill level 1 and has no wardenCut.
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let PASS = 0, FAIL = 0;
const ck = (n, c, x) => { if (c) { PASS++; console.log('  ok   ' + n); } else { FAIL++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + x : '')); } };
const load = f => require(path.join(ROOT, 'server', 'sim-host.js')).load(f);
const NEW = load(path.join(ROOT, 'emberweave-heroes.html'));
const oldFile = path.join(ROOT, '.test-1310-live.html');
fs.writeFileSync(oldFile, cp.execSync('git show 3aeb2146:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
process.on('exit', () => { try { fs.unlinkSync(oldFile); } catch (e) {} });
const OLD = load(oldFile);
const run = (h, code) => JSON.parse(vm.runInContext('JSON.stringify((function(){' + code + '})())', h.ctx));
const BUILD = `const mk=(k,lv,ex)=>{ const u=makeUnit(k,'enemy',0,0,lv,ex); return u.skillLv; };
  return { camp:mk('rhukk',57,{enemySkillLv:true,campaignHero:true}), camp100:mk('rhukk',140,{enemySkillLv:true}), mon:mk('ooznik',73,{enemySkillLv:true}),
           arena:mk('rhukk',57,{}), src:[/makeUnit\\(s\\.key,'enemy',sl\\.x,sl\\.y,s\\.lvl\\|\\|1,\\{boss:!!s\\.boss,enemySkillLv:true\\}\\)/.test(makeUnit.toString()+''),
             (typeof spawnWave==='function'?spawnWave.toString():'')] };`;
const n = run(NEW, BUILD);
console.log('== enemy skill level = own level (campaign + Vault) ==');
ck('a campaign enemy hero at level 57 casts at skill level 57 on all four slots', JSON.stringify(n.camp) === '[57,57,57,57]', JSON.stringify(n.camp));
ck('the level is capped at 100', JSON.stringify(n.camp100) === '[100,100,100,100]', JSON.stringify(n.camp100));
ck('a campaign MONSTER at level 73 casts at 73 too ("enemies skill")', JSON.stringify(n.mon) === '[73,73,73,73]', JSON.stringify(n.mon));
ck('an enemy built without the flag (Arena / other modes) stays at skill level 1', JSON.stringify(n.arena) === '[1,1,1,1]', JSON.stringify(n.arena));
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
ck('the campaign spawn passes enemySkillLv (campaign mode only)', html.includes("campaignHero:CUR.mode==='campaign'&&!!m.isHero,enemySkillLv:CUR.mode==='campaign'});"));
ck('the Vault spawn passes enemySkillLv', html.includes("makeUnit(s.key,'enemy',sl.x,sl.y,s.lvl||1,{boss:!!s.boss,enemySkillLv:true});"));
const o = run(OLD, BUILD);
ck('CONTROL: live v1309 builds the same campaign enemy at skill level 1', JSON.stringify(o.camp) === '[1,1,1,1]', JSON.stringify(o.camp));
console.log('== Thick Chitin (Rhukk) ==');
const W = `const mk=(k,st,lv)=>({key:k,wardenStk:st,passMul:skillMul(lv),skillLv:[1,1,1,lv]});
  return {s1:wardenCut(mk('rhukk',1,1)), cap1:wardenCut(mk('rhukk',99,1)), cap100:wardenCut(mk('rhukk',99,100)), s3:wardenCut(mk('rhukk',3,50)),
          other:wardenCut(mk('gruel',99,1)), otherRule:Math.min(SKLV.wardenCap(1),0.04*99), d1:passDescAt(KITS.rhukk.purple,1), d100:passDescAt(KITS.rhukk.purple,100)};`;
const w = run(NEW, W);
const near = (a, b) => Math.abs(a - b) < 1e-9;
ck('one stack = 3% less damage', near(w.s1, 0.03), w.s1);
ck('three stacks = 9%', near(w.s3, 0.09), w.s3);
ck('cap 15% at passive level 1', near(w.cap1, 0.15), w.cap1);
ck('cap 25% at passive level 100', near(w.cap100, 0.25), w.cap100);
ck('the other warden passives keep the shared rule (cap 20% at level 1)', near(w.other, w.otherRule), w.other + ' vs ' + w.otherRule);
ck('the hover text reads the real numbers', /3% less damage taken every 3s in combat \(up to 15%\)/.test(w.d1) && /\(up to 25%\)/.test(w.d100), w.d1 + ' | ' + w.d100);
let liveHas = true; try { run(OLD, 'return typeof wardenCut'); liveHas = run(OLD, 'return typeof wardenCut') === 'function'; } catch (e) { liveHas = false; }
ck('CONTROL: live v1309 has no wardenCut (Thick Chitin used the shared 4% rule)', !liveHas);
console.log('test_enemy_skill_lv_1310.js: ' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
