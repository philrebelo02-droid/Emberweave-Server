/* v1298 (Phil 6 Nov: "When I click claim fragments on the top right. It should pop up the fragments ui where I can see what I earn per hour
   and allow me to claim what saved up" / "This is bonus stage"). Real server (temp DB) + real page (Chromium): a player with bonus stages
   1-3 and 2-6 cleared, 5.5 h since the last claim. Clicking Claim fragments opens the panel: per hour 3 (1 + 2), a row per glyph quality,
   saved = 5 whole hours = 15, "5 h of 36 h", a next-hour timer; Claim pays the 15 on the server and the panel then shows 0 saved with
   Claim disabled. CONTROL: FRAG_ROOT=<a pre-v1298 checkout> must FAIL (no panel). */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.FRAG_ROOT || path.join(__dirname, '..'), control = !!process.env.FRAG_ROOT;
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 300) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-frag1298-')), dbFile = path.join(tmp, 'db.json');
  let srv = null, browser = null; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  const start = async () => { const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: dbFile, RL_MUL: '1000', REG_PER_MIN: '500', REG_ACCOUNTS_PER_IP: '500', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    for (let i = 0; i < 300; i++) { try { if ((await fetch(base + '/api/health')).ok) return; } catch (_) {} await delay(100); } throw new Error('server did not start'); };
  const stop = async () => { if (!srv) return; srv.kill(); for (let i = 0; i < 60 && srv.exitCode === null; i++) await delay(50); srv = null; };
  const call = async (r, b, t) => { const x = await fetch(base + r, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(t ? { 'x-token': t } : {}) }, body: b ? JSON.stringify(b) : undefined }); let j = {}; try { j = await x.json(); } catch (_) {} return { status: x.status, data: j }; };
  try {
    await start();
    const me = (await call('/api/register', { name: 'fragTester', pass: 'password1' })).data;
    await call('/api/ledger', null, me.token); await call('/api/bonus/state', null, me.token); await delay(500); await stop();
    { const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')), now = Date.now(), u = db.users[me.profile.id];
      u.led.bonus = { done: { '1-3': { stars: 3, at: now }, '2-6': { stars: 3, at: now } }, ts: now - 5.5 * 3600000, att: null };
      fs.writeFileSync(dbFile, JSON.stringify(db)); }
    await start();
    const st0 = (await call('/api/bonus/state', null, me.token)).data;
    ck(st0.perHour === 3 && st0.claim && st0.claim.hours === 5 && st0.claim.total === 15, 'server: 3 per hour, 5 whole hours saved = 15 (' + JSON.stringify(st0.claim) + ')');
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    const args = ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ args }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args }); }
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(2500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(800);
    await pg.evaluate(async () => { const r = await api('/api/login', 'POST', { name: 'fragTester', pass: 'password1' }); ACC.token = r.token; ACC.id = r.profile.id; ACC.name = r.profile.name;
      G.tutStarted = true; G.tutDone = true; try { _whatsNewDone = true; } catch (e) {} try { document.body.classList.remove('gated'); } catch (e) {} show('home'); });
    await delay(1500);
    await pg.evaluate(() => show('campaign')); await delay(2500);
    const cb = await pg.evaluate(() => { const b = document.getElementById('campBonusBtn'); if (!b) return null; const r = b.getBoundingClientRect(), c = document.getElementById('campBonusCnt');
      return { vis: !b.hidden && r.width > 0, left: Math.round(r.left), bottomGap: Math.round(innerHeight - r.bottom), w: innerWidth, cnt: c && !c.hidden ? c.textContent : null }; });
    ck(cb && cb.vis && cb.left < 40 && cb.bottomGap < 80, 'the campaign map has the Bonus Stage claim in the bottom left (above the portal tabs) (' + JSON.stringify(cb) + ')');
    ck(cb && cb.cnt === '15', 'its badge shows the 15 saved fragments');
    if (process.env.FRAG_SHOT2) await pg.screenshot({ path: process.env.FRAG_SHOT2 });
    if (cb) await pg.click('#campBonusBtn'); else await pg.evaluate(() => bonusHourlyClaim());
    await delay(1500);
    const read = () => pg.evaluate(() => { const o = document.getElementById('bonusFragPanel'); const b = o && o.querySelector('#bfClaim'); return o ? { txt: o.innerText, dis: !!(b && b.disabled) } : null; });
    const p1 = await read();
    if (process.env.FRAG_SHOT) await pg.screenshot({ path: process.env.FRAG_SHOT });
    ck(!!p1, 'Claim fragments opens the fragments panel');
    const T = (p1 && p1.txt) || '';
    ck(/Bonus Stage Fragments/i.test(T) && /Per hour\s*3\b/.test(T), 'it shows the fragments earned per hour (3)', T.slice(0, 200));
    ck(/Saved\s*15\b/.test(T) && /5 h of 36 h/.test(T), 'it shows what is saved up: 15, 5 h of 36 h', T.slice(0, 200));
    const rows = (T.match(/\n(Grey|Green|Green \+1|Blue)[^\n]*/g) || []).length;
    ck(rows >= 2, 'each glyph quality has its own row (' + rows + ' rows)', T);
    ck(/Next hour in \d+:\d\d/.test(T), 'a timer to the next hour');
    ck(p1 && !p1.dis && /Claim 15/.test(T), 'Claim 15 is enabled');
    if (p1) { await pg.click('#bfClaim'); await delay(2500); }
    const banner = await pg.evaluate(() => (document.getElementById('banner') || {}).innerText || '');
    const pageTok = await pg.evaluate(() => ACC.token);   // the page's sign-in replaced the test's session
    const st1 = (await call('/api/bonus/state', null, pageTok)).data;
    ck(st1.claim && st1.claim.total === 0, 'Claim pays out on the server: nothing left saved (' + JSON.stringify(st1).slice(0, 300) + ')');
    ck(/Glyph fragments claimed: 15/.test(banner), 'the player is told 15 glyph fragments were claimed', banner);
    const p2 = await read();
    ck(p2 && p2.dis && /Saved\s*0\b/.test(p2.txt), 'the panel refreshes: 0 saved, Claim disabled', p2 && p2.txt.slice(0, 200));
    if (p2) { await pg.click('#bfClose'); await delay(300); }
    ck(await pg.evaluate(() => !document.getElementById('bonusFragPanel')) && !!p2, 'Close closes it');
    ck(errs.length === 0, 'no page errors', errs.join(' | '));
  } catch (e) { ck(false, 'run', e.stack || e); }
  finally { try { if (browser) await browser.close(); } catch (_) {} await stop(); }
  if (control) { console.log('CONTROL: ' + fail + ' check(s) failed as expected'); process.exit(fail ? 0 : 1); }
  console.log('test_frag_panel_1298.js: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
