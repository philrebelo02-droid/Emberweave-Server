// v1359: fixes proven by the 11 Nov night smoke testers (shops + heroes zones), each reproduced in a real browser on a local server before the fix.
// Static guards with a v1358 control (git show 47540784); the Guild Shop check runs the real route text.
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..'); let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n'), old = f => cp.execSync('git show 47540784:' + f, { cwd: ROOT, maxBuffer: 64 << 20 }).toString().replace(/\r\n/g, '\n');
const H = rd('emberweave-heroes.html'), S = rd('server.js'), H0 = old('emberweave-heroes.html'), S0 = old('server.js');
const both = (name, re) => { ck(name, re.test(H)); ck('CONTROL v1358: ' + name, !re.test(H0)); };
both('Guild contribute redraws after the ledger arrived', /if\(ok\) Promise\.resolve\(ledgerSync\(\)\)\.then\(rd,rd\); else rd\(\);/);
both('Quests: a failed FIRST read stays not-ready so Retry can show', /if\(_questStateAt\) _questStateReady=true; return null;[^\n]*\n  \}\)\.catch\(function\(\)\{ if\(_questStateAt\) _questStateReady=true; return null; \}\)/);
both('Quest chain claim: one at a time', /if\(claimChain\._busy\) return; claimChain\._busy=true;/);
both('Arena shop result also shows as a banner', /set textContent\(s\)\{ if\(el\) el\.textContent=s; if\(s\) try\{ bannerMsg\(s\); \}catch\(e\)\{\} \}/);
both('Mail: the tab on screen is marked read when drawn', /if\(state==='mail'&&G\.mail\[mailTab\]&&G\.mail\[mailTab\]\.some\(m=>!m\.read\)\)/);
both('Store free claim: a second tap cannot fall through', /if\(ov\._done\) return; ov\._done=true;[^\n]*setTimeout\(close,450\); grantGemOffer\(i,'prebeta'\);/);
both('Pop-out resets its scroll AFTER it is shown', /el\.classList\.add\('active','popout'\);\n  el\.scrollTop=0;/);
both('Bag fetches the glyph state when signed in without it', /if\(ACC\.token&&typeof RUNE2!=='undefined'&&!RUNE2\.st&&!renderBag\._sync/);
both('no re-check timer loop with the mute button gone', /same=sig===MUTE_SIG\.s&&\(MUTE_BTN_OFF\|\|\(b&&b\.isConnected\)\)/);
both('hero power on the detail panel is grouped like the list card', /<b>\$\{\(\+heroPower\(key\)\|\|0\)\.toLocaleString\(\)\}<\/b>/);
both('filter menus are capped to the game frame', /max-height:min\(260px,calc\(var\(--ew-game-height,100vh\) \* \.46\)\)/);
both('Chat Guild tab with no guild: one guild read per 30 s (was a request loop)', /!renderChat\._gfetch&&Date\.now\(\)-\(renderChat\._gat\|\|0\)>30000/);
both('Confirm takes no real tap for its first 450 ms (paid rename double tap)', /if\(e&&e\.isTrusted&&Date\.now\(\)-_gcT<450\) return;/);
both('the tap that closes the MENU does not reach the town', /hm\.classList\.remove\('open'\); e\.stopPropagation\(\); e\.preventDefault\(\); \} \}catch\(_\)\{\} \},true\);/);
both('Guild create: one request per tap', /if\(_cb\._busy\) return; _cb\._busy=true;/);
both('Bulletin Board shows the server arena rank', /myArena=\(ACC&&ACC\.token&&ACC\.rank\)\|\|G\.arenaRank\|\|5000;/);
// Guild Shop slot 5 (Equipment Pieces): the real branch text, run with stubs
const cut = src => { const a = src.indexOf("if(what==='pieces_guild'){"), b = src.indexOf("ledTx(me,'guildshop:pieces'", a); return src.slice(a, src.indexOf('}', src.indexOf('return {ok:true', b)) + 1) + ' }'; };
const run = (src, me, guilds, coins) => { const led = { guildCoins: coins, eqMats: {} }; const fn = vm.runInNewContext('(function(what,me,led,DB,EQ_MAT_KEYS,ledTx,writeDB,ledgerView){ ' + cut(src) + ' return null; })'); const r = fn('pieces_guild', me, led, { guilds }, ['a', 'b'], () => {}, () => {}, () => ({})); return { r, coins: led.guildCoins }; };
let a = run(S, { id: 'u' }, {}, 900); ck('Equipment Pieces: no guild -> refused, nothing charged', a.r && a.r.ok === false && a.coins === 900, JSON.stringify(a));
a = run(S, { id: 'u', guildId: 'g' }, { g: { level: 1, members: ['u'] } }, 900); ck('guild level 1 -> refused (slot 5 unlocks at level 2), nothing charged', a.r && a.r.ok === false && /not unlocked/.test(a.r.error) && a.coins === 900, JSON.stringify(a));
a = run(S, { id: 'u', guildId: 'g' }, { g: { level: 2, members: ['u'] } }, 900); ck('guild level 2 -> sold for 450', a.r && a.r.ok === true && a.coins === 450, JSON.stringify(a));
a = run(S0, { id: 'u' }, {}, 900); ck('CONTROL v1358: a player in no guild was sold it', a.r && a.r.ok === true && a.coins === 450, JSON.stringify(a));
console.log('test_night_smoke_1359.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
