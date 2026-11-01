// v1249 (Phil 1 Nov 2026: "When I click a mine i should be able to see how much resources are left in it" / "When I retreated it depleted the
// mine" / "The mine should remain if it still has resources to mine" / "my ship is returning from the wrong location"). Static checks.
// Control: MINE_STOCK_SRC=<pre-fix server.js> must FAIL.
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const srv=fs.readFileSync(process.env.MINE_STOCK_SRC||path.join(root,'server.js'),'utf8'), html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; console.log('  ok '+m); };
ok(/const MINE_HAULS=3;/.test(srv)&&/function mineLeft\(node,epoch\)/.test(srv),'a mine holds MINE_HAULS hauls (mineLeft)');
ok(/nodes:WORLD_MINES\.field\(epoch\)\.map\(n=>\(\{\.\.\.n,left:mineLeft\(n,epoch\),total:/.test(srv),'/api/world/mines sends left and total per mine');
ok(!/That mine was already claimed this cycle/.test(srv)&&/That mine is empty/.test(srv),'no once-a-cycle claim: a mine is refused only when empty');
ok(/_st\.used\[march\.node\.id\]=\(_st\.used\[march\.node\.id\]\|0\)\+take/.test(srv),'only a WON haul takes from the stock');
ok(/p==='\/api\/world\/mine\/recall'/.test(srv)&&/granted:0/.test(srv),'a retreat (recall) settles the march with nothing taken');
ok(/api\('\/api\/world\/mine\/recall','POST'/.test(html),'the client retreat tells the server');
ok(/Left in the mine/.test(html)&&/Your miners are working here/.test(html),'the mine panel shows what is left and your miners');
ok(/const p=Math\.min\(1,\(now-m\.depart\)\/m\.out\);/.test(html),'a retreat leaves from the mine, never beyond it');
ok(/Your troops are out \('\+out\.length\+'\) - recall them or wait until they are home to teleport\./.test(srv),'no teleport while an army is out (march, mine, attack, siege, Defend, garrison)');
console.log('test_mine_stock_1249.js: '+pass+' checks passed, 0 failed');
