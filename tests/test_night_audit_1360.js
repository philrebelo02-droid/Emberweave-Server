// v1360: second batch from the 11 Nov night audit (world + Spire/new-player play-testers, the ledger-diff currency audit, the unlocks audit, Grok's eyes).
// Each fault was reproduced on a real local server / browser first. Static guards with a v1359 control (git show ec954ad0).
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'); let P = 0, F = 0; const ck = (n, c) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n); } };
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n'), old = f => cp.execSync('git show ec954ad0:' + f, { cwd: ROOT, maxBuffer: 64 << 20 }).toString().replace(/\r\n/g, '\n');
const both = (cur, prev, name, re) => { ck(name, re.test(cur)); ck('CONTROL v1359: ' + name, !re.test(prev)); };
const H = rd('emberweave-heroes.html'), H0 = old('emberweave-heroes.html'), S = rd('server.js'), S0 = old('server.js'), V = rd('survivors-dev.html'), V0 = old('survivors-dev.html');
both(H, H0, 'Arena: the squad that fought is sent with the result', /api\('\/api\/arena\/result','POST',\{oppId:CUR\.oppId,won,def:_arepDef,team:_ateam,requestId:_rid\}\)/);
both(H, H0, 'Arena: the Record row follows the server verdict', /_arepMine\.won!==d\.won\)\{ _arepMine\.won=d\.won; saveG\(\); \}/);
both(S, S0, 'Arena route: body team first (owned heroes only, max 5), saved team as fallback', /let myKeys=\(Array\.isArray\(b\.team\)&&b\.team\.length&&b\.team\.length<=8\)\?rosterKeys\(b\.team\.map\(x=>String\(x\|\|''\)\.slice\(0,40\)\)\)\.filter\(k=>ownsHeroK\(myLed,k\)\)\.slice\(0,5\):\[\];\n      if\(!myKeys\.length\) myKeys=rosterKeys\(me\.team\)\.filter\(k=>ownsHeroK\(myLed,k\)\)\.slice\(0,5\);/);
both(S, S0, 'Witches Hut: +20% brew refused before the charge unless it all fits', /if\(w\.capacity-w\.state\.brew < w\.capacity\*offer\.brewFraction-1e-6\) return \{ok:false,error:'The cauldron cannot hold that much brew yet\.'\};\n      if\(\(led\.gems\|0\)<offer\.gems\)/);
both(H, H0, 'Witches Hut: the buy button is off above 80% full', /data-witch-buy="\$\{offer\.tier\}" \$\{w\.brew>w\.capacity\*0\.8\+1e-6\?'disabled':''\}>/);
both(S, S0, 'guild/create saves before the ok', /DB\.guilds\[id\]=g; me\.guildId=id; writeDBNow\(\[me\.id\]\);/);
both(S, S0, 'province/start saves before the ok', /writeDBNow\(\[me\.id\]\);   \/\/ v1124: led\.prov is this player's/);
both(S, S0, 'quest random fragments never pick a not-sold hero', /filter\(k=>!ownsHeroK\(led,k\)&&!heroNotSold\(k\)\); const n=rw\.randFrags;/);
both(V, V0, 'Swarm Spire: page close also writes the run synchronously', /if \(SAVE && !leaving\) localStorage\.setItem\(SAVE_KEY, JSON\.stringify\(SAVE\)\);/);
both(V, V0, 'Swarm Spire: the newer of the two saves is loaded', /\(!SAVE \|\| \(\+j\.at \|\| 0\) > \(\+SAVE\.at \|\| 0\)\)/);
ck('Swarm Spire result line has no dev counter', !/inputs recorded`/.test(V) && /inputs recorded`/.test(V0));
both(H, H0, 'Skill lesson returns to the lesson list after the upgrade', /if\(G\.tutStarted&&!G\.tutDone&&G\.tutFocusStep==='skill'\)\{ checkTutorial\(\); tutReturnAfterAction\(\); \}/);
both(H, H0, 'a finished lesson glows nothing more', /if\(_c&&_c\.id===id&&_c\.done\(\)\) return;/);
both(H, H0, 'the tutorial target is brought into view', /target\.scrollIntoView\(\{block:'center',inline:'nearest'\}\)/);
both(H, H0, 'Academy: short screens take the compact layout at any width', /@media\(max-width:1100px\) and \(min-width:701px\),\(max-height:620px\) and \(min-width:701px\)\{\n #tech #techPanel\{height:100%\}/);
both(H, H0, 'Arena: Buy +1 keeps its small size when enabled on short screens', /#arena \.arDay #arenaBuyAtt\{font-size:9px!important;line-height:1\.1!important;min-height:25px!important/);
console.log('test_night_audit_1360.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
