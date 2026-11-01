// v1248 (Phil 1 Nov 2026: "put the attack times for buildings to be 2x the speed for the distance. Since you attack the center of them" /
// "That means cities, world tree, oasis. Is 2x attack speed"): a siege march (city, oasis, World Tree) plans HALF the time per square on the
// server, and the client's march-time preview shows the same. Static checks on the shipped code. Control: SIEGE_SPEED_SRC=<old server.js> must FAIL.
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const srv=fs.readFileSync(process.env.SIEGE_SPEED_SRC||path.join(root,'server.js'),'utf8'), html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
const S=require(path.join(root,'assets','ui','world-siege.js'));
let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; console.log('  ok '+m); };
ok(S.ATTACK_SPEED===2,'WORLD_SIEGE.ATTACK_SPEED is 2');
const start=srv.slice(srv.indexOf("if(p==='/api/world/siege/start'"), srv.indexOf("if(p==='/api/world/siege/resolve'"));
ok(start.length>100 && /patronMarchMs\(led,distance\*60000\/WORLD_SIEGE\.ATTACK_SPEED\)/.test(start),'the siege start march plans distance*60000/ATTACK_SPEED');
const other=srv.replace(start,'');
ok(!/distance\*60000\/WORLD_SIEGE\.ATTACK_SPEED/.test(other),'no other march (mine, castle attack, Defense line) changed speed');
ok(/ctype==='siege'\)\?MARCH_MS_PER_SQUARE\/\(\(window\.EmberweaveWorldSiege&&window\.EmberweaveWorldSiege\.ATTACK_SPEED\)\|\|2\)/.test(html),'the client march-time preview halves a siege the same way');
console.log('test_siege_speed_1248.js: '+pass+' checks passed, 0 failed');
