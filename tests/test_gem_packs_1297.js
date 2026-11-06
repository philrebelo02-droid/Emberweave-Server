// v1297 (Phil 6 Nov: "$5 should be 600, $10 should be 1250, $20 should be 2600, $50 should be 6600, $100 ... 13400 diamonds" /
// "always 4.99 9.99 19.99 49.99 99.99"). The server (what a purchase pays) and the shop page (what it shows) agree on every pack.
// Control: SRV=<v1296 server.js> HTML=<v1296 html> must FAIL.
const fs = require('fs'), path = require('path'), R = path.join(__dirname, '..');
const srv = fs.readFileSync(process.env.SRV || path.join(R, 'server.js'), 'utf8');
const html = fs.readFileSync(process.env.HTML || path.join(R, 'emberweave-heroes.html'), 'utf8');
const want = [['d500', '$4.99', 4.99, 600, '600'], ['d1200', '$9.99', 9.99, 1250, '1,250'], ['d2800', '$19.99', 19.99, 2600, '2,600'], ['d6000', '$49.99', 49.99, 6600, '6,600'], ['d12500', '$99.99', 99.99, 13400, '13,400']];
let bad = 0;
for (const [id, price, usd, amt, shown] of want) {
  const s = (srv.match(new RegExp("\{id:'" + id + "',[^}]*\}")) || [''])[0];
  const c = (html.match(new RegExp("\n  \{id:'" + id + "',[^\n]*")) || [''])[0];
  const okS = s.includes("price:'" + price + "'") && new RegExp('usd:' + usd.toString().replace('.', '\.') + ',').test(s) && s.includes('amount:' + amt + '}');
  const okC = c.includes("price:'" + price + "'") && c.includes("n:'" + shown + "'") && !/n:'(?!(?:\d|,)*'\b)/.test('');
  const line = id + ': ' + price + ' = ' + shown + ' diamonds (server ' + (okS ? 'ok' : 'WRONG') + ', shop ' + (okC ? 'ok' : 'WRONG') + ')';
  console.log((okS && okC ? '  ok   ' : '  FAIL ') + line); if (!(okS && okC)) bad++;
}
if (process.env.SRV) { console.log('CONTROL: ' + bad + ' failed as expected'); process.exit(bad ? 0 : 1); }
if (bad) process.exit(1); console.log('test_gem_packs_1297.js: 5 checks passed');
