// v1051 (Phil, 7 Oct 2026: "make sure the server list shows all 5 servers when i click server ingame"): the in-game server list
// (SVR_LIST) holds Servers 1-5 with ids 1-5 and their sN.emberweaveheroes.com hosts, and the front door's /switch page forwards
// ?server=5 to s5. Control: on v1050 the list has four entries and this test fails.
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };

const m = html.match(/const SVR_LIST=(\[[\s\S]*?\]);/);
ok(m, 'SVR_LIST found');
const list = Function('return ' + m[1])();
ok(list.length === 5, 'five servers in the list (got ' + list.length + ')');
list.forEach((s, i) => {
  ok(s.id === i + 1, 'server ' + (i + 1) + ' has id ' + (i + 1));
  ok(s.name === 'Server ' + (i + 1), 'server ' + (i + 1) + ' is named "Server ' + (i + 1) + '"');
  ok(s.host === 's' + (i + 1) + '.emberweaveheroes.com', 'server ' + (i + 1) + ' host is s' + (i + 1) + '.emberweaveheroes.com');
});
ok(new Set(list.map(s => s.host)).size === 5, 'every host is different');

// the row builder, the pings and ?server=N all read SVR_LIST - no other hard-coded server count
ok(/SVR_LIST\.map\(s=>'<button class="svrRow"/.test(html), 'the panel rows are built from SVR_LIST');
ok(/SVR_LIST\.some\(s=>s\.id===id\)/.test(html), '?server=N is checked against SVR_LIST');

// the front door /switch page accepts 5 and forwards to s5
const srv = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const sw = srv.match(/if\(!\(n>=1&&n<=(\d+)\)\)n=1;/);
ok(sw && +sw[1] >= 5, '/switch accepts server 5');
ok(srv.includes('"s"+n+".emberweaveheroes.com"'), '/switch forwards server N to sN.emberweaveheroes.com');

console.log('test_servers_1051: ' + pass + ' checks passed');
