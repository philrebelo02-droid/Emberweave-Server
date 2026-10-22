// 22 Oct 2026 (ChatGPT's second-pass audit, confirmed by Claude and Grok; Phil: "Embassy shouldnt raise stamina" / "Yes make it"):
// the Embassy advertised perks the server never gave. Envoy's Favor (+5% contribution exp per guild level) is now real on the
// server; Rallying Call (+2 max stamina per level) is gone, so the client's max stamina is the server's own.
// Runs the real formulas from server.js and emberweave-heroes.html side by side.
// Usage: node test_embassy_perks_22oct.js [server.js] [emberweave-heroes.html]
const fs = require('fs'), path = require('path');
const srv = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'server.js'), 'utf8');
const html = fs.readFileSync(process.argv[3] || path.join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
let fail = 0, n = 0;
const check = (ok, what) => { n++; if (!ok) { fail++; console.log('FAIL: ' + what); } };

// 1) contribution exp: the server pays what the Embassy and the Contribute button promise, at every guild level
const line = srv.split('\n').find(l => /gg\.exp=\(gg\.exp\|\|0\)\+/.test(l));
check(!!line, 'server contribution exp line not found');
const rhs = line ? line.replace(/^\s*gg\.exp=/, '').replace(/;\s*$/, '') : '0';
const clientMul = (html.match(/function embassyContribMul\(\)\{ return G\.guild \? (1\+guildLevel\(\)\*[\d.]+) : 1; \}/) || [])[1];
check(!!clientMul, 'client embassyContribMul not found');
let worst = null;
for (let L = 1; L <= 20 && clientMul && line; L++) {
  const got = Function('GUILD_CONTRIB_EXP', 'gg', 'return ' + rhs)(100, { level: L, exp: 0 });
  const promised = Math.round(100 * Function('guildLevel', 'return ' + clientMul)(() => L));
  if (got !== promised && !worst) worst = 'guild level ' + L + ': server adds ' + got + ', the Embassy promises ' + promised;
}
check(!worst, 'contribution exp mismatch - ' + worst);
check(/\+\$\{Math\.round\(GUILD_CONTRIB\.exp\*embassyContribMul\(\)\)\} guild exp/.test(html), 'the Contribute button does not show the Embassy-boosted exp');

// 2) max stamina: the client shows the server's own max (59 + player level) for a guild member at every level
check(!/embassyStamBonus/.test(html), 'embassyStamBonus still in the client');
check(!/Rallying Call/.test(html), 'the Embassy still lists the stamina perk');
const base = +(srv.match(/STAM_MAX_BASE=(\d+)/) || [])[1];
const clientMax = (html.match(/function maxStamina\(\)\{ return ([^;]+); \}/) || [])[1];
check(!!clientMax && base === 59, 'stamina max formulas not found');
for (let P = 1; P <= 120 && clientMax; P++) {
  const c = Function('playerLevel', 'embassyStamBonus', 'return ' + clientMax)(() => P, () => 2 * 10);
  if (c !== base + P) { check(false, 'player level ' + P + ': client max ' + c + ' vs server ' + (base + P)); break; }
}
console.log(fail ? 'FAIL ' + fail + ' of ' + n : 'PASS ' + n + ' checks (Embassy perks match the server)');
process.exit(fail ? 1 : 0);
