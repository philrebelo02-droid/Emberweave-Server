/* v1165 - THE CHAT BAR ONLY ON THE CITY AND THE WORLD MAP (Phil 16 Oct 2026 10:02: "Why is chat in campaign and over pop outs it should
   only be in city and world map" - it covered the Stage popup's left action button).
   Real page (Chromium, phone 844x390) on a local server with a temp DB; silent. #chatWidget must be shown on:
     the hub, the World view (state 'world')
   and hidden on: the campaign chapter map, a stage popup over it, a battle, a building screen (Temple), a pop-out window over the hub
   (Heroes), a confirm over the hub, the profile window over the hub - and come back on the hub when each closes.
   Chat keeps running underneath: the socket object and the message list are untouched while the bar is hidden.
   Control: CB_ROOT=<a v1164 checkout> must FAIL (it showed the bar on the campaign map and over pop-outs). */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.CB_ROOT || path.join(__dirname, '..');
const control = !!process.env.CB_ROOT;
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 400) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const SILENT = () => { const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); }; };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-cb-'));
  let srv = null, browser = null;
  try {
    const port = await freePort(), base = 'http://127.0.0.1:' + port;
    const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), RL_MUL: '1000', REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    let up = false; for (let i = 0; i < 300 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch (_) {} if (!up) await delay(100); }
    if (!up) throw new Error('server did not start');
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    const args = ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ args }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args }); }
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(SILENT);
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(2500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(1200);
    await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'cb' + Date.now().toString(36), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id;
      G.tutStarted = true; G.tutDone = true; try { document.body.classList.remove('gated'); } catch (e) {} try { authGateRefresh(); } catch (e) {} show('home'); });
    await delay(2500);
    const bar = () => pg.evaluate(() => { const w = document.getElementById('chatWidget'); if (!w) return null; const r = w.getBoundingClientRect(); return w.style.display !== 'none' && r.width > 0 && r.height > 0; });
    const step = async (name, f, want, wait) => { await pg.evaluate(f); await delay(wait || 1100); const v = await bar(); ck(v === want, name + ': the chat bar is ' + (want ? 'SHOWN' : 'hidden'), 'shown=' + v); };
    const sock0 = await pg.evaluate(() => typeof CHATNET !== 'undefined' && CHATNET.ws ? CHATNET.ws.readyState : null);
    await step('the hub', () => show('home'), true);
    await step('the World view', () => show('world'), true, 1600);
    await step('the campaign chapter map', () => { CUR = { mode: 'campaign', node: 1, portal: 'normal' }; show('campaign'); }, false);
    await step('a stage popup on the campaign map', () => { openStageModal(1, 'normal'); }, false);
    await step('the stage popup closed (still the campaign map)', () => { const c = document.getElementById('smClose'); if (c) c.click(); document.getElementById('stageModal').classList.remove('active'); }, false);
    await step('a battle', () => { show('home'); CUR = { node: 1, mode: 'arena' }; _startVersusNow([{ key: 'grosk', level: 5, rank: 1 }, { key: 'gruel', level: 5, rank: 1 }], true); paused = true; }, false);
    await step('back on the hub after the battle', () => { ended = true; try { cancelResult(); } catch (e) {} show('home'); }, true, 1500);
    await step('a building screen (Temple)', () => show('temple'), false);
    await step('back on the hub', () => show('home'), true);
    await step('a pop-out window over the hub (Heroes)', () => popoutScreen('heroesPanel'), false);
    await step('the pop-out closed: back on the hub', () => closePopout(), true);
    await step('a confirm over the hub', () => gameConfirm('Spend 50 gems?', () => {}), false);
    await step('the confirm closed', () => document.querySelectorAll('#_gcNo').forEach(b => b.click()), true);
    await step('the profile window over the hub', () => document.getElementById('profileBtn').click(), false);
    await step('the profile window closed', () => { const c = document.getElementById('profClose'); if (c) c.click(); }, true);
    await step('a window over the World view (a pop-out)', () => { show('world'); popoutScreen('mail'); }, false, 1600);
    await step('the window closed: the World view', () => closePopout(), true);
    const sock1 = await pg.evaluate(() => typeof CHATNET !== 'undefined' && CHATNET.ws ? CHATNET.ws.readyState : null);
    ck(sock0 === sock1 || sock1 === 1, 'chat keeps running while the bar is hidden (socket state ' + sock0 + ' -> ' + sock1 + ')');
    ck(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
  } catch (e) { fail++; console.log('  FAIL harness: ' + (e && e.stack || e)); }
  finally { try { if (browser) await browser.close(); } catch (_) {} try { if (srv) srv.kill(); } catch (_) {} try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
  console.log(''); console.log('PASS: ' + pass + '  FAIL: ' + fail);
  if (control) { console.log(fail ? 'CONTROL: failed as it must' : 'CONTROL DID NOT FAIL'); process.exit(fail ? 0 : 1); }
  process.exit(fail ? 1 : 0);
})();
