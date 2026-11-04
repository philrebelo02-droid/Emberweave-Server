'use strict';
// v1120 (Phil 10 Oct 2026: "S1 didnt even show it was down ... didnt allow me to see the server list to switch" / "the reconnect
// button doesnt nothing"): the connection-lost screen names the server, says DOWN on the front door's 503 serverDown after one
// check, lists the other servers, Retry shows it is checking and reconnects the live socket when the server is back, and a
// dropped socket checks at once. Source checks; the browser run is in the SHIPPED note. Control: v1119 fails all.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
// v1271 LANGUAGES step 2: netGateUpdate's words are t('key') calls now - accept the old literal OR the t() call whose English in
// lang/en.json is the same words (an English player still reads them).
const EN = JSON.parse(fs.readFileSync(path.join(ROOT, 'lang', 'en.json'), 'utf8'));
const said = (src, re, call, key, en) => re.test(src) || (src.includes(call) && EN[key] === en);
let pass = 0, fail = 0;
const ck = (n, ok, d) => { if (ok) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' - ' + d : '')); } };
function checks(src) {
  const gu = src.slice(src.indexOf('function netGateUpdate('), src.indexOf('async function netGateCheck('));
  const gc = src.slice(src.indexOf('async function netGateCheck('), src.indexOf('function netGateLoop('));
  return {
    names: said(gu, /is down right now\./, "t('svr2.is_down',{name:_svN})", 'svr2.is_down', '{name} is down right now.') && said(gu, /'Lost '\+_svN/, "t('svr2.lost_reconnecting',{name:_svN})", 'svr2.lost_reconnecting', 'Lost {name} — reconnecting…'),
    oneCheck: /NETGATE\.serverDown=true; NETGATE\.down=Math\.max\(1,NETGATE\.down\+1\)/.test(gc) && /NETGATE\.serverDown&&NETGATE\.down>=1\) return true/.test(src.slice(src.indexOf('function netGateShown('), src.indexOf('function netGateOk('))),
    list: /data-ngsvr/.test(gu) && /svrGo\(\+b\.dataset\.ngsvr\)/.test(gu),
    retry: said(gu, /Checking…/, "t('boot.checking')", 'boot.checking', 'Checking…') && said(gu, /Still down — Retry/, "t('svr2.still_down_retry')", 'svr2.still_down_retry', 'Still down — Retry'),
    reconnect: /if\(ok&&_was\)\{ try\{ CHATNET\.tries=0; chatConnect\(\);/.test(gc),
    socketDrop: /CHATNET\.ws\.onclose=\(\)=>\{[^\n]*\n\s*try\{ netGateCheck\(\)/.test(src),
  };
}
const now = checks(fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8'));
ck('the screen names the server ("Server 1 is down right now." / "Lost Server 1")', now.names);
ck('the front door\'s 503 serverDown shows DOWN after one check', now.oneCheck);
ck('the other servers are listed and switch with svrGo', now.list);
ck('Retry shows Checking… and "Still down — Retry"', now.retry);
ck('the live socket reconnects as soon as the server is back', now.reconnect);
ck('a dropped live socket checks the server at once', now.socketDrop);
let old = null;
try { old = checks(cp.execSync('git show c17fb592:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 1 << 30 }).toString()); } catch (e) { old = null; }
if (old) ck('CONTROL: the v1119 file fails all six', Object.values(old).every(v => v === false), JSON.stringify(old));
else console.log('  skip CONTROL (git history not available)');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail);
