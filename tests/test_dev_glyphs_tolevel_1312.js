// v1312 (Phil 8 Nov 2026, dev panel): "switch the max all heroes glyphs to the 'max for current heroes level' quality".
// /api/admin/led-grant {maxGlyphs:true, toLevel:true} walks each board only as far as /api/glyphs/ascend would: a tier is ascended while
// the hero's level meets its gate (GLYPH_MIN_LEVEL). CONTROL: maxGlyphs without toLevel still walks to Orange (index 16).
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const root = path.join(__dirname, '..'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-dgl-')), dbFile = path.join(dir, 'db.json');
let port, base, child, P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
async function start(admin) { child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, DATABASE_URL: '', PORT: String(port), DB_FILE: dbFile, ADMIN_IDS: admin || '' }, stdio: 'ignore', windowsHide: true });
  for(const _t0=Date.now();Date.now()-_t0<60000&&!(child&&child.exitCode!==null);) { try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await delay(100); }   /* 11 Nov: a 60 s deadline, not an iteration count */ throw Error('no start'); }
async function stop() { if (!child) return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); }   /* 11 Nov: until it has exited (the port is free) */ child = null; }
const call = async (p, b, tok) => { const r = await fetch(base + p, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(tok ? { 'x-token': tok } : {}) }, body: b ? JSON.stringify(b) : undefined }); try { return await r.json(); } catch (_) { return {}; } };
const SRC = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const GATES = JSON.parse(SRC.match(/GLYPH_MIN_LEVEL=Object\.freeze\((\[[^\]]+\])\)/)[1]);
const STEP = JSON.parse(SRC.match(/const D_HERO_STEP=(\[[^\]]+\])/)[1]); const CUM = [0, 0]; for (let L = 2; L <= 100; L++) CUM[L] = CUM[L - 1] + STEP[L - 2];
const ascFor = L => Math.min(16, GATES.filter(g => g <= L).length);   // 16 = fully ascended (GLYPH_MAX_ASC)
(async () => { try {
  port = await freePort(); base = 'http://127.0.0.1:' + port; await start('');
  const d = await call('/api/register', { name: 'dgl1312', pass: 'password1' }); const id = d.profile.id; await delay(400); await stop(); await start(id);
  let tok = (await call('/api/login', { name: 'dgl1312', pass: 'password1' })).token;
  const keys = ['meridian', 'astra', 'grimsby'];
  await call('/api/admin/led-grant', { heroKeys: keys, unlock: keys, px: 99000000 }, tok);   // account level high: a hero's level is capped by it
  // levels: meridian 1, astra 40, grimsby 70 - through the grant's own heroXp (the save file is not the only store)
  const LV = { meridian: 1, astra: 40, grimsby: 70 };
  for (const [k, L] of Object.entries(LV)) if (CUM[L]) await call('/api/admin/led-grant', { heroKeys: [k], heroXp: CUM[L] }, tok);
  const r = await call('/api/admin/led-grant', { heroKeys: keys, stars: 5, maxGlyphs: true, toLevel: true }, tok);
  ck('the grant answers ok', r && r.ok, r && r.error);
  await delay(500); await stop(); db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  for (const [k, L] of Object.entries(LV)) {
    const ai = db.users[id].glyphs.boards[k].ascensionIndex;
    ck(k + ' at level ' + L + ': board ascended to tier ' + ascFor(L) + ' (the best its level allows), got ' + ai, ai === ascFor(L), ai);
  }
  // CONTROL: without toLevel the same grant walks every board to Orange
  await start(id); tok = (await call('/api/login', { name: 'dgl1312', pass: 'password1' })).token;
  await call('/api/admin/led-grant', { heroKeys: keys, maxGlyphs: true }, tok); await delay(500); await stop();
  db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  ck('CONTROL: maxGlyphs without toLevel walks every board to fully ascended (16)', keys.every(k => db.users[id].glyphs.boards[k].ascensionIndex === 16), keys.map(k => db.users[id].glyphs.boards[k].ascensionIndex));
  const html = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8');
  ck('the dev button sends toLevel:true', html.includes("{heroKeys:keys,stars:MAX_STARS,maxGlyphs:true,toLevel:true}"));
} catch (e) { F++; console.log('  FAIL run: ' + e.stack); } finally { await stop(); }
  console.log('test_dev_glyphs_tolevel_1312.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0); })();
