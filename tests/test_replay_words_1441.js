'use strict';
/* v1441 - THE PLAYER CARD SAYS "REPLAY DISAGREEMENT" (Phil 24 Nov 2026, reading the dev panel's player card: "Whats this digest mismatch" /
   "I know hes not cheating"). The stored reason of a battle record stays 'digest-mismatch' (data and tests read it); what a person
   reads on the card is "replay disagreement", with one line saying what it is: the server's replay ended differently, the player kept
   their own result, a record - not a cheat flag. The Cheat signals row says how many of its count are replay disagreements.
   The page's own label function is run in the engine host; the card's rows are checked in the page source; the server's player view
   is checked in server.js. CONTROL: the v1439 page (git af4aab45c) prints the raw stored reason. Asserts (non-zero exit). */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), CONTROL_SHA = 'af4aab45c';
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok  ' + m); };
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8'), srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const host = require(path.join(ROOT, 'server', 'sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
const L = JSON.parse(vm.runInContext(`JSON.stringify({ dm:incidentWhyLabel('digest-mismatch'), un:incidentWhyLabel('replay-unavailable'), er:incidentWhyLabel('replay-error'), other:incidentWhyLabel('something-new'), none:incidentWhyLabel(null), note:INCIDENT_NOTE })`, host.ctx));
console.log('== v1441: the player card names a replay disagreement in plain words ==');
ok(L.dm === 'replay disagreement', "the stored reason 'digest-mismatch' is shown as \"" + L.dm + '"');
ok(L.un === 'replay not available' && L.er === 'replay failed to run' && L.other === 'something-new' && L.none === '', 'the other stored reasons have plain names; an unknown one is shown as stored');
ok(/different ending/.test(L.note) && /kept their own result/.test(L.note) && /not a cheat flag/.test(L.note), 'the note says what it is: "' + L.note + '"');
ok(/row\('Replay records \(not a cheat flag\)',n\(X\.battleIncidents\)\+\(X\.lastIncident\?' · last: '\+incidentWhyLabel\(X\.lastIncident\.why\)/.test(html), 'Integrity row: "Replay records (not a cheat flag)" with the last one named by incidentWhyLabel');
ok(/sec\('Battle log',[^\n]*row\('What these are',INCIDENT_NOTE\)[^\n]*incidentWhyLabel\(x\.why\)/.test(html), 'Battle log: the note first, each line named by incidentWhyLabel');
ok(!/X\.lastIncident\.why:''\)/.test(html) && !/row\(dt\(x\.t\)\+' · '\+x\.stage,x\.why\|\|x\.mode\)/.test(html) && !/'Battle incidents'/.test(html) && !/'Flagged fights'/.test(html), 'the card no longer prints the raw stored reason, "Battle incidents" or "Flagged fights"');
ok(/replaySignals:cheat\.filter\(x=>\/\^\(campaign\|province\|well\|siege\)-replay\(:\|\$\)\/\.test/.test(srv) && /X\.replaySignals\?' \('\+n\(X\.replaySignals\)\+' replay disagreement'/.test(html), 'Cheat signals row: the count of replay disagreements among them is given by the server and shown');
ok(/why:'digest-mismatch'/.test(srv) && /why=replayFailure\|\|'digest-mismatch'/.test(srv) && /'campaign-replay'/.test(srv), "the stored reason ('digest-mismatch') and signal ('campaign-replay') are unchanged in server.js");
ok(/'Replay disagreement at '\+x\.mode\+' stage '/.test(srv) && /not proof of cheating/.test(srv) && !/Campaign replay digest mismatch at/.test(srv), 'the review entry text says replay disagreement, not proof of cheating');
const old = cp.execFileSync('git', ['show', CONTROL_SHA + ':emberweave-heroes.html'], { cwd: ROOT, maxBuffer: 256 << 20 }).toString('utf8');
ok(/X\.lastIncident\.why:''\)/.test(old) && /x\.why\|\|x\.mode/.test(old) && !/incidentWhyLabel/.test(old), 'CONTROL v1439: the card prints the raw stored reason (digest-mismatch)');
console.log(''); console.log('test_replay_words_1441.js: ' + pass + ' passed, 0 failed');
