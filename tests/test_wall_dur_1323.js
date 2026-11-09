// v1323 (Phil 9 Nov 2026): "If you see city wall (change to defense), cauldron, make a third tab called city wall. The city wall will have durability,
// when the durability hits zero percent the castle is destroyed and randomly teleported to another location in the region. The city wall will
// regenerate about 4% city wall health per hour, on this same tab there will be an option to repair wall (200 diamonds per 25% wall heal) to speed
// it up, and a buy attacks option". The server's wall functions run here in a sandbox; the routes and tab are checked in the source.
// CONTROL: live v1322 (git show 4eccf066) has none of it.
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8'), html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const oldSrv = cp.execSync('git show 4eccf066:server.js', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
const grab = name => { const i = srv.indexOf(name); const j = srv.indexOf('\nfunction ', i + 10), k = srv.indexOf('\nconst PATRON_COSTS', i); return srv.slice(i, Math.min(...[j, k].filter(x => x > 0))); };
const src = srv.slice(srv.indexOf('const WALL_DUR='), srv.indexOf('const PATRON_COSTS='));
const moved = [];
const ctx = vm.createContext({ Math, Number, Object, Set, Date,
  ensureAcad: u => ({ lv: { academy: u.acadLv | 0 } }), WORLD_LOCATION: { REGIONS: { r1: 1 }, footKeys: (x, y) => [x + ',' + y], openInRegion: (reg, blocked) => { moved.push([reg, blocked.size]); return { region: reg, x: 77, y: 88 }; } },
  worldBlockedKeys: () => new Set(['a', 'b']) });
vm.runInContext(src + '\nthis.wallDur=wallDur; this.wallView=wallView; this.wallHit=wallHit; this.WALL_DUR=WALL_DUR; this.wallHitPct=wallHitPct; this.cityLevel=cityLevel;', ctx);
const H = 3600000, t0 = 1e12;
ck('the numbers are Phil\'s: +4 % an hour, repair +25 % for 200 diamonds', ctx.WALL_DUR.regenPerHour === 4 && ctx.WALL_DUR.repairPct === 25 && ctx.WALL_DUR.repairCost === 200);
const u = { worldLocation: { region: 'r1', x: 5, y: 6 } };
ck('a new wall stands at 100 %', ctx.wallDur(u, t0).pct === 100);
u.wallDur = { pct: 50, t: t0 }; ck('it regenerates 4 % an hour (50 % -> 60 % after 2.5 h)', Math.abs(ctx.wallDur(u, t0 + 2.5 * H).pct - 60) < 1e-9);
u.wallDur = { pct: 98, t: t0 }; ck('and never past 100 %', ctx.wallDur(u, t0 + 10 * H).pct === 100);
u.wallDur = { pct: 50, t: t0 }; const v = ctx.wallView(u, t0); ck('the view says when it is full (50 % -> 12.5 h)', v.fullInMs === 12.5 * H && v.pct === 50);
ck('a won attack takes Phil\'s damage by line size: 5 heroes 8 %, 4 6 %, 3 4 %, 2 2 %, 1 1 %', [5, 4, 3, 2, 1].map(n => ctx.wallHitPct(n)).join() === '8,6,4,2,1');
u.wallDur = { pct: 45, t: t0 }; const r1 = ctx.wallHit(u, 5, t0); ck('a 5-hero line takes 8 % (45 -> 37) and the castle stays', r1 === null && u.wallDur.pct === 37 && u.worldLocation.x === 5);
u.wallDur = { pct: 45, t: t0 }; ctx.wallHit(u, 3, t0); ck('a 3-hero line takes 4 % (45 -> 41)', u.wallDur.pct === 41);
ck('Phil example: Academy 44 vs a level-40 attacker takes 40 % off (8 % -> 4.8 %)', Math.abs(ctx.wallHitPct(5, 44, 40) - 4.8) < 1e-9);
ck('city level (Academy) above the attacker level takes 10 % off per level: 8 % -> 5.6 % at 3 above, capped at 90 % off (0.8 %) from 9 above; never more when below ("The max reduced damage is 90%")', Math.abs(ctx.wallHitPct(5, 13, 10) - 5.6) < 1e-9 && Math.abs(ctx.wallHitPct(5, 30, 10) - 0.8) < 1e-9 && ctx.wallHitPct(5, 4, 9) === 8);
{ const d = { acadLv: 12, wallDur: { pct: 50, t: t0 }, worldLocation: { region: 'r1', x: 1, y: 1 } }; ctx.wallHit(d, 5, t0, 10); ck('a defender 2 Academy levels up loses 6.4 % to a 5-hero line (50 -> 43.6)', Math.abs(d.wallDur.pct - 43.6) < 1e-9, d.wallDur.pct); }
u.wallDur = { pct: 6, t: t0 }; const r2 = ctx.wallHit(u, 5, t0);
ck('at 0 % the castle is destroyed and moved to a random open square of its OWN region, its old square refused', r2 && u.worldLocation.region === 'r1' && u.worldLocation.x === 77 && moved.length === 1 && moved[0][1] === 3, [r2, moved]);
ck('and the wall is rebuilt at 100 %, the fall recorded', u.wallDur.pct === 100 && u.wallFellAt === t0);
ck('an arena bot (no castle) is never hit', ctx.wallHit({ isNpc: true }, 5, t0) === null);
ck('a won city attack hits the defender\'s wall; the report carries wallPct / wallFell / newLoc', /let wallFell=null; if\(won&&!d\.isNpc\)\{ wallFell=wallHit\(d,ids\.length,Date\.now\(\),ledPlayerLevel\(ensureLedger\(me\)\)\); \}/.test(srv) && /wallPct, wallFell:!!wallFell, newLoc:/.test(srv));
ck('POST /api/wall/repair: 200 diamonds, +25 %, refused at 100 % or without the diamonds, one requestId per repair', /p==='\/api\/wall\/repair'/.test(srv) && /if\(w\.pct>=100\) return \{ok:false,error:'Your wall is at full strength\.'\}/.test(srv) && /led\.gems-=c; w\.pct=Math\.min\(100,w\.pct\+WALL_DUR\.repairPct\)/.test(srv));
ck('the ledger carries the wall (wall:wallView)', /patron:patronView\(u,led\), wall:wallView\(u\),/.test(srv));
ck('the wall screen tabs: Defense · Cauldron · City Wall', /data-wall-tab="wall">\$\{t\('wall\.tab_defense'\)\}<\/button>.*data-wall-tab="cauldron">.*data-wall-tab="dur">\$\{t\('bld\.city_wall'\)\}/.test(html) && /"wall\.tab_defense":"Defense"/.test(html));
ck('the City Wall tab: durability, repair and buy attacks', /function renderWallDur\(body\)/.test(html) && /id="wdRepair"/.test(html) && /id="wdBuyAtk"/.test(html) && /act\('\/api\/patron\/buy-attacks'/.test(html));
ck('CONTROL: v1322 had no wall durability', !/WALL_DUR/.test(oldSrv));
console.log('test_wall_dur_1323.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
