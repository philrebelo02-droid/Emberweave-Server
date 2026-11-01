// v1249 (Phil 1 Nov 2026: "if someone is in a battle. Campaign, vault, spire, etc ... it doesnt kick them out if the server is off. Instead it
// switches to their local fight, then the server automatically reconnects their device when its back online"). Static checks on the page:
// the down screen (netGate) never shows during a fight or its result screen; a lost result reply waits for /api/health and re-sends the SAME
// request (campaign + every apiResultRetry route). Control: BATTLE_OFFLINE_SRC=<pre-fix page> must FAIL.
const assert=require('assert'),fs=require('fs'),path=require('path');
const html=fs.readFileSync(process.env.BATTLE_OFFLINE_SRC||path.join(__dirname,'..','emberweave-heroes.html'),'utf8');
let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; console.log('  ok '+m); };
const gate=html.slice(html.indexOf('function netGateShown(){'), html.indexOf('function netGateOk(){'));
ok(/updateUnsafe\(\)\) return false;/.test(gate) && gate.indexOf('updateUnsafe')<gate.indexOf('NETGATE.serverDown'),'netGateShown returns false during a fight / result screen, before any down check');
ok(/function updateUnsafe\(\)\{ return state==='battle' \|\| state==='result'/.test(html),'updateUnsafe() covers the battle and result screens');
const wait=html.slice(html.indexOf('async function resultWaitServer('), html.indexOf('async function resultWaitServer(')+1400);
ok(wait.length>200 && /_netProbe\(\)\)==='ok'/.test(wait) && /15\*60000/.test(wait) && /await send\(\)/.test(wait),'resultWaitServer waits for /api/health up to 15 min, then re-sends');
ok(/else if\(\+\+upTries>=3\) break;/.test(wait),'a server that answers health but still fails the result 3 times ends the wait (NOT COUNTED, test_results_retry_1151)');
ok(/if\(resultReplyLost\(r\)\) r=await resultWaitServer\(\(\)=>api\(path,'POST',body\),r\);/.test(html),'apiResultRetry (Vault, Elite, Province, Tower, Trial) waits for the server');
ok(/resultWaitServer\(\(\)=>api\('\/api\/campaign\/resolve','POST',\{attemptId:att, requestId:_rid/.test(html),'the campaign result waits for the server with the SAME requestId');
const m=html.match(/const BATTLE_RESULT_ROUTES=(\/.*?\/);/); ok(!!m,'BATTLE_RESULT_ROUTES is defined');
const RE=eval(m[1]);
for(const r of ['/api/campaign/resolve','/api/bonus/resolve','/api/dungeon/resolve-battle','/api/elite/resolve','/api/province/resolve','/api/tower/ascend','/api/tower/tribute','/api/trial/resolve','/api/well/resolve','/api/arena/result','/api/emberdraft/result','/api/emberdraft/round','/api/guild/raid/resolve','/api/guild/war/attack','/api/world/mine/resolve','/api/world/siege/resolve','/api/pvp/attack','/api/pvp/attack-report'])
  ok(RE.test(r),'battle route waits for the server: '+r);
ok(!RE.test('/api/tx/spend')&&!RE.test('/api/guild/chat'),'non-battle routes are not held');
ok(/async function api\(path,method,bodyObj\)\{ const r=await _apiRaw\(path,method,bodyObj\);\s*if\(method==='POST'&&bodyObj&&bodyObj\.requestId&&BATTLE_RESULT_ROUTES\.test/.test(html),'api() waits only for a POST with a requestId on a battle route');
console.log('test_battle_offline_1249.js: '+pass+' checks passed, 0 failed');
