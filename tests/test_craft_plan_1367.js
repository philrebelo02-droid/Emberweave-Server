// v1367 (tester via Phil 11 Nov 2026: "When the quick equipment manufacturing key is pressed, it takes approximately 10 seconds to execute
// the action" / Phil: "should be instant"). Real server, temp DB: /api/gear/craft-plan runs a whole quick-build plan in ONE request with the
// same rules as /craft-sub + /craft. Same end state as the step-by-step calls; a plan that runs out of materials keeps the steps that ran
// and says where it stopped; a stale revision is refused (409). CONTROL: the step-by-step calls on a second account give the same items.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const root = path.join(__dirname, '..'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-cp-')), dbFile = path.join(dir, 'db.json');
let port, base, child, pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok   ' + m); }, delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
async function start() { child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, ALLOW_NEW_GUESTS: '1', DATABASE_URL: '', PORT: String(port), DB_FILE: dbFile }, stdio: 'ignore', windowsHide: true });
  for(const _t0=Date.now();Date.now()-_t0<60000&&!(child&&child.exitCode!==null);) { try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await delay(100); }   /* 11 Nov: a 60 s deadline, not an iteration count */ throw Error('no start'); }
async function stop() { if (!child) return; child.kill(); for(let i=0;i<400&&child.exitCode===null&&child.signalCode===null;i++){ if(i===200) try{ child.kill('SIGKILL'); }catch(_){} await delay(50); }   /* 11 Nov: until it has exited (the port is free) */ child = null; }
const call = async (tok, route, data) => { const r = await fetch(base + route, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-token': tok }, body: data ? JSON.stringify(data) : undefined });
  let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, data: j }; };
(async () => { try {
  port = await freePort(); base = 'http://127.0.0.1:' + port; await start();
  const cat = JSON.parse(fs.readFileSync(path.join(root, 'server', 'gear-catalog.json'), 'utf8')); const meta = cat.meta, items = cat.items;
  const green = items.find(d => d.quality === 'Green'), grey = items.find(d => d.quality === 'Grey');
  const acct = async (n) => { const g = await call('', '/api/guest', { deviceId: 'cp-' + n + '-' + Date.now() }); await call(g.data.token, '/api/ledger'); return { tok: g.data.token, id: g.data.profile.id }; };
  const A = await acct('a'), B = await acct('b'), C = await acct('c');
  const frags = { [grey.frag]: meta.greyFragCost * 2, [green.frag]: green.subFragCost + (grey.frag === green.frag ? meta.greyFragCost * 2 : 0) };
  await delay(300); await stop();
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  for (const u of [A, B, C]) db.users[u.id].gear = { revision: 1, heroGearV: 1, fragments: Object.assign({}, frags), subs: {}, seq: 10, active: {}, items: {}, equipped: {} };
  db.users[C.id].gear.fragments = { [grey.frag]: meta.greyFragCost * 2 };   // C: enough for the two greys, not the sub
  fs.writeFileSync(dbFile, JSON.stringify(db)); await start();
  const steps = [{ kind: 'craft', gearId: grey.id }, { kind: 'craft', gearId: grey.id }, { kind: 'sub', gearId: green.id }, { kind: 'craft', gearId: green.id }];
  const t0 = Date.now(); const r = await call(A.tok, '/api/gear/craft-plan', { expectedRevision: 1, steps }); const ms = Date.now() - t0;
  ok(r.data.ok === true && r.data.done === 4 && r.data.gearId === green.id && r.data.revision === 2, 'a 4-step plan (2 Grey, sub, Green) runs in ONE request (' + ms + ' ms): ' + JSON.stringify(r.data).slice(0, 140));
  const sa = (await call(A.tok, '/api/gear/state')).data;
  // CONTROL: B builds the same thing step by step with the old routes
  let rev = 1; for (const s of steps) { const x = await call(B.tok, s.kind === 'sub' ? '/api/gear/craft-sub' : '/api/gear/craft', { expectedRevision: rev, gearId: s.gearId }); assert(x.data.ok, JSON.stringify(x.data)); rev = x.data.revision; }
  const sb = (await call(B.tok, '/api/gear/state')).data;
  const shape = s => JSON.stringify({ items: Object.values(s.items).map(i => i.d).sort(), frags: s.fragments, subs: s.subs });
  ok(shape(sa) === shape(sb), 'same end state as the step-by-step calls (CONTROL account): ' + shape(sa));
  const rc = await call(C.tok, '/api/gear/craft-plan', { expectedRevision: 1, steps });
  ok(rc.data.ok === true && rc.data.done === 2 && /Need/.test(rc.data.error || ''), 'out of materials at the sub: the two Greys that ran are kept, and it says why (' + JSON.stringify(rc.data).slice(0, 120) + ')');
  const st = await call(A.tok, '/api/gear/craft-plan', { expectedRevision: 1, steps });
  ok(st.status === 409 || st.data.error === 'STALE' || (st.data.ok && st.data.done === 4 && st.data.revision === 2), 'a stale revision cannot build twice (409 or the same receipt replayed)');
  const after = (await call(A.tok, '/api/gear/state')).data; ok(Object.keys(after.items).length === Object.keys(sa.items).length, 'nothing was built twice');
  const e = await call(A.tok, '/api/gear/craft-plan', { expectedRevision: after.revision, steps: [] }); ok(e.status === 400, 'an empty plan is refused');
  console.log('test_craft_plan_1367.js: ' + pass + ' checks passed');
} catch (e) { console.error('FAIL', e && e.message || e); process.exitCode = 1; } finally { await stop(); } })();
