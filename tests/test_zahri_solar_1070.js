// v1070 - Zahri's Solar Impalement: Grok's light-spear burst (Phil-picked 8 Oct) rides the tip of her lance in every frame of
// her green clip, drawn behind her, and bursts on the thrust peak. Static checks on the wiring; the look was checked on the rig
// (frames 4 / 22 / after the clip, facing right and left).
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(R, 'emberweave-heroes.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

const def = H.match(/\n\s*zahrisolar:\{u:'([^']+)',n:(\d+),fw:(\d+),fh:(\d+),cols:(\d+),rows:(\d+),dur:[\d.]+,tip:\[([\d.]+),([\d.]+)\],heroPx:([\d.]+)\}/);
ok(def, 'FX2_DEF has the zahrisolar sheet with its tip and size');
const file = def && def[1].split('?')[0];
ok(file && fs.existsSync(path.join(R, file)), 'the sheet exists on disk (' + file + ')');
ok(def && +def[2] <= +def[5] * +def[6], 'n fits the grid');
ok(def && +def[3] * +def[5] <= 4096 && +def[4] * +def[6] <= 4096, 'sheet within the 4096 texture limit');
const tr = H.match(/const TIPFX=\{ zahri:\{ green:\{ fx:'zahrisolar', track:\[(.*?)\] \} \} \};/);
const rows = tr ? JSON.parse('[' + tr[1] + ']') : [];
ok(rows.length === 48, 'the lance is measured on all 48 green frames (' + rows.length + ')');
ok(rows[22] && Math.abs(rows[22][2]) < 8, 'at the thrust peak (frame 22) the lance is near level (' + (rows[22] && rows[22][2]) + ' deg)');
ok(/u\._fxFr=fr; u\._fxMirror=mirror;/.test(H), 'syncMesh records the frame and facing it draws');
ok(/u\._abilStartAt=battleTime; if\(typeof TIPFX!=='undefined'&&TIPFX\[u\.key\]&&TIPFX\[u\.key\]\[st\]\) spawnTipFx\(u,st\);/.test(H), 'the FX starts with her green clip');
ok(/spr\.renderOrder=-1;/.test(H.slice(H.indexOf('function spawnTipFx'), H.indexOf('function updateTipFx'))), 'drawn behind her (renderOrder -1)');
ok(/updateProjFx\(dt\); try\{ updateTipFx\(dt\);[^}]*\}catch\(e\)\{\}/.test(H) && /updateStatusFx\(dt\); updateTipFx\(dt\)/.test(H), 'ticked in battle and after the end');
ok((H.match(/clearTipFx\(\)/g) || []).length >= 2, 'cleared with the other FX');
// display only: the tracker never touches hp, damage or the sim clock
const body = H.slice(H.indexOf('function spawnTipFx'), H.indexOf('function clearTipFx'));
ok(!/dealDamage|\.hp\s*[-+]?=|groundHazards|battleTime\s*=/.test(body), 'CONTROL: the tracker is display only (no damage, hp or clock)');

console.log('\nPASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail ? 1 : 0);
