// v1421 (Phil 18 Nov: "Reduce grosks ultimate damage its really strong and i cannot imagine how strong now with double hp").
// Croc Drop deals a share of Grosk's OWN max HP. v1400 doubled hero HP (HP_MULT=2; tanks get no +1000 bonus), so the ult's damage
// doubled with it and Grosk won 100% of 1v1s (Kimi, KIMI BALANCE/10 - GROSK ULT FIX PROPOSAL.md). The share is halved: 10% -> 20%
// across levels became 5% -> 10%, which is exactly the pre-v1400 damage at every level; done as coefficients so the tooltip shows the
// true number. Static checks on the page (the same engine the servers replay).
// CONTROL: the v1420 values (0.10 / 0.20) must fail the damage-equals-pre-HP-x2 check.
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const html=fs.readFileSync(process.env.EW_HTML||path.join(__dirname,'..','emberweave-heroes.html'),'utf8');
let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; console.log('  ok   '+m); };
const def=html.match(/hipposlam:\{hpMul:([\d.]+),hpMul100:([\d.]+),/); ok(def,'ULT_DEF.hipposlam carries hpMul / hpMul100');
const hpMul=+def[1], hpMul100=+def[2];
const mult=+html.match(/const HP_MULT=(\d+(?:\.\d+)?)/)[1];
ok(mult===2,'hero HP is doubled (HP_MULT '+mult+')');
ok(/return \{hp:\(t\.hp\+g\.hp\)\*HP_MULT\+hpBonusAt\(t,lvl\)/.test(html),'a hero\'s max HP is (base + gear) x HP_MULT + the non-tank bonus');
// the damage line reads these two coefficients
ok(/_hp=\(o\.hpMul\|\|0\.10\)\+\(\(o\.hpMul100\|\|0\.20\)-\(o\.hpMul\|\|0\.10\)\)\*_hl\/99;\s*\r?\n\s*const dmg=u\.maxHp\*_hp\*rm;/.test(html),'Croc Drop damage = his max HP x the level share (hpMul -> hpMul100)');
// the tooltip reads the same coefficients
ok(/if\(d\.hpMul\) return '\{i:s:attack\} '\+Math\.round\(hp\*\(d\.hpMul100!=null\?d\.hpMul\+\(d\.hpMul100-d\.hpMul\)/.test(html),'the tooltip number comes from the same hpMul / hpMul100');
function preEqual(a,b){ // tank: new maxHp = 2 x old; old share 0.10 -> 0.20; damage must equal at level 1 and 100
  return Math.abs(mult*a-0.10)<1e-9 && Math.abs(mult*b-0.20)<1e-9; }
ok(preEqual(hpMul,hpMul100),'Croc Drop = exactly the pre-HP x2 damage at every level ('+hpMul+' -> '+hpMul100+' of the doubled HP = 0.10 -> 0.20 of the old)');
ok(hpMul===0.05&&hpMul100===0.10,'the share is 5% at level 1 and 10% at level 100');
ok(!preEqual(0.10,0.20),'CONTROL: the v1420 values (0.10 / 0.20) give double the pre-HP x2 damage and fail the check');
console.log('test_grosk_ult_1421.js: '+pass+' checks passed');
