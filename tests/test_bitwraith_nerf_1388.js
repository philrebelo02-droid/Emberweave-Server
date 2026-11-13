// v1388 (tester via Phil 13 Nov: "bitwraith is a bit too strong, needs a 10% damage nerf"): Bitwraith dmg 18 -> 16.2 on the
// client (MONSTER_TYPES) and the server's monster table, so replays and sims agree. Every Bitwraith hit and skill scales off dmg.
const fs=require('fs'), path=require('path'); const R=path.join(__dirname,'..');
const page=fs.readFileSync(path.join(R,'emberweave-heroes.html'),'utf8'), srv=fs.readFileSync(path.join(R,'server.js'),'utf8');
const c=/"name": "Bitwraith",[^}]*"dmg": ([\d.]+)/.exec(page), s=/'bitwraith':\{hp:\d+,dmg:([\d.]+)/.exec(srv);
let ok=0,bad=0; const ck=(m,v)=>{ if(v){ok++;console.log('  ok   '+m);} else {bad++;console.log('  FAIL '+m);} };
ck('client Bitwraith dmg is 16.2 (was 18)', c && +c[1]===16.2);
ck('server Bitwraith dmg is 16.2 (was 18)', s && +s[1]===16.2);
ck('client and server agree', c && s && c[1]===s[1]);
const vex=/"name": "Vexmite",[^}]*"dmg": ([\d.]+)/.exec(page); ck('Vexmite (same base row) untouched at 18', vex && +vex[1]===18);
console.log(`test_bitwraith_nerf_1388: ${ok} passed, ${bad} failed`); process.exit(bad?1:0);
