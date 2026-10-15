// v1144 (15 Oct 2026, live incident on Server 1): tester SOUL EATER registered at 13:20; at 13:22 a browser with no stored token quietly
// called POST /api/guest, became Guest-617D and played two hours there, so his real account looked wiped. Phil: "please make sure the
// first thing someone is forced to to is sign in or create an account" / "Its important that if someone is logged into a guest they
// are aware of it".
// Asserts (non-zero exit on any failure), in a real headless browser (844x390, muted, AudioContext stubbed) against a throwaway server
// started WITHOUT ALLOW_NEW_GUESTS (the live setting):
//   (1) a fresh page with no storage shows the sign-in gate and makes NO /api/guest call; (2) the hub is not reachable before sign-in;
//   (3) Create account works and lands on the game; (4) a stored guest token gets the one-time upgrade step and keeps its ledger (same
//   id) after upgrading; (5) a guest session wears the GUEST marker on the hub and the result screen, and a device that was on a real
//   account says so; (6) a lost real-account token goes to Sign in, never a guest; (7) /api/guest refuses new guests (403) and still
//   resumes an existing one; (8) Servers 2-5 (ACCOUNT_AUTHORITY) register, sign in and upgrade guests the same way; (9) every inline
//   script parses, and the parse check catches an unescaped quote.
// Control: AUD_ROOT=<a checkout of the pre-fix tree, e.g. git archive 255d7b72> runs the same checks against that page + server and
// must FAIL. Screenshots: SHOT_DIR (default C:\Users\Home\Downloads\ew-sweep\signin).
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), http = require('http'), { spawn } = require('child_process');
const ROOT = process.env.AUD_ROOT || path.join(__dirname, '..');
const control = !!process.env.AUD_ROOT;
const SHOTS = process.env.SHOT_DIR || (control ? '' : 'C:\\Users\\Home\\Downloads\\ew-sweep\\signin');
let pass = 0; const missed = [];
const ok = (c, m) => { if (!c) { if (control) { missed.push(m); console.log('  FAIL ' + m); return; } assert(c, m); } pass++; console.log('  ok   ' + m); };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-signin1144-'));
const procs = [];
function start(port, env) {
  const log = fs.openSync(path.join(tmp, 'srv-' + port + '.log'), 'a');
  const c = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', ALLOW_NEW_GUESTS: '', RL_MUL: '1000', REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', PORT: String(port), ...env }, stdio: ['ignore', log, log], windowsHide: true });
  procs.push(c); return c;
}
async function up(port) { for (let i = 0; i < 300; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/health')).ok) return true; } catch (_) {} await delay(100); } return false; }
async function stop(c) { if (c && c.exitCode === null) { c.kill(); await new Promise(r => { c.once('exit', r); setTimeout(r, 3000); }); } }
const call = (port, p, body, tok) => fetch('http://127.0.0.1:' + port + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(tok ? { 'x-token': tok } : {}) }, body: body ? JSON.stringify(body) : undefined })
  .then(async r => { let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, j }; }).catch(() => ({ status: 0, j: {} }));
const AUDIO_STUB = () => { const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {}, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { value: 0, setValueAtTime() {} } });
  function AC() { return { state: 'running', currentTime: 0, sampleRate: 44100, destination: {}, resume() { return Promise.resolve(); }, suspend() { return Promise.resolve(); }, close() { return Promise.resolve(); },
    createGain: node, createBufferSource: node, createOscillator: node, createBiquadFilter: node, createDynamicsCompressor: node, createStereoPanner: node, createBuffer() { return { getChannelData() { return new Float32Array(1); } }; },
    decodeAudioData() { return Promise.resolve({ duration: 1 }); } }; }
  window.AudioContext = AC; window.webkitAudioContext = AC; };

(async () => {
  let browser = null;
  try {
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name) }); };

    /* ---- (9) every inline script parses; the check catches an unescaped quote ---- */
    const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
    const parseAll = src => { const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m, n = 0; const bad = [];
      while ((m = re.exec(src))) { if (m[1] && /\bsrc=/.test(m[1])) continue; n++; try { new Function(m[2]); } catch (e) { bad.push(n + ': ' + e.message); } } return { n, bad }; };
    const pa = parseAll(html);
    ok(pa.n >= 3 && pa.bad.length === 0, 'every inline script parses (' + pa.n + ' blocks' + (pa.bad.length ? ', ' + pa.bad.join('; ') : '') + ')');
    const probe = "msg('Enter a password.')", broken = html.includes(probe) ? html.replace(probe, "msg('Enter a pass'word.')") : html.replace('function online(){', "function online(){ var q='it's'; ");
    ok(parseAll(broken).bad.length > 0, 'the parse check catches an unescaped quote');

    /* ---- server setup: two guests made on an ALLOW_NEW_GUESTS server (the "old device" case), then the live setting ---- */
    const P1 = await freePort(), DB1 = path.join(tmp, 'db1.json');
    let s1 = start(P1, { DB_FILE: DB1, ALLOW_NEW_GUESTS: '1' }); assert(await up(P1), 'setup server did not start');
    const devA = 'ew1144-old-device-a', devB = 'ew1144-old-device-b';
    const gA = (await call(P1, '/api/guest', { deviceId: devA })).j, gB = (await call(P1, '/api/guest', { deviceId: devB })).j;
    assert(gA.token && gB.token, 'setup: two guests on the opted-in server');
    await call(P1, '/api/ledger', null, gA.token); await call(P1, '/api/ledger', null, gB.token);
    await stop(s1);
    { const db = JSON.parse(fs.readFileSync(DB1, 'utf8')); const u = db.users[gA.profile.id]; u.led.gold = 43210; u.led.gems = 777; fs.writeFileSync(DB1, JSON.stringify(db)); }
    s1 = start(P1, { DB_FILE: DB1 }); assert(await up(P1), 'server did not restart');
    const base = 'http://127.0.0.1:' + P1;

    /* ---- (7) /api/guest: new guests refused, existing resumed ---- */
    const nw = await call(P1, '/api/guest', { deviceId: 'ew1144-brand-new-' + Date.now() });
    ok(nw.status === 403 && !nw.j.token && /sign in|account/i.test(nw.j.error || ''), '/api/guest refuses a NEW guest with 403 and a clear message (got ' + nw.status + ' ' + JSON.stringify(nw.j).slice(0, 90) + ')');
    const nd = await call(P1, '/api/guest', {});
    ok(nd.status === 403 && !nd.j.token, '/api/guest with no device id makes no guest either (got ' + nd.status + ')');
    const rs = await call(P1, '/api/guest', { deviceId: devB });
    ok(rs.status === 200 && rs.j.profile && rs.j.profile.id === gB.profile.id, '/api/guest still RESUMES an existing guest by its device (got ' + rs.status + ')');
    gB.token = rs.j.token || gB.token;   // resuming re-issues the guest's token

    try { browser = await require(path.join(ROOT, 'node_modules', 'playwright')).chromium.launch({ args: ['--mute-audio', '--autoplay-policy=user-gesture-required'] }); }
    catch (_) { browser = await require('playwright').chromium.launch({ args: ['--mute-audio'] }); }
    const open = async (storage) => {
      const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
      await ctx.addInitScript(AUDIO_STUB);
      const page = await ctx.newPage(); const calls = [], errors = [];
      page.on('request', r => { const u = r.url(); if (u.includes('/api/')) calls.push(r.method() + ' ' + u.replace(base, '')); });
      page.on('pageerror', e => errors.push(e.message));
      if (storage) { await page.goto(base + '/health'); await page.evaluate(s => { for (const k of Object.keys(s)) localStorage.setItem(k, s[k]); }, storage); }
      await page.goto(base + '/play', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('.splashPlay'), null, { timeout: 30000 });
      await page.waitForTimeout(1800);
      await page.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); });
      await page.waitForTimeout(2600);
      return { ctx, page, calls, errors };
    };
    const gateOpen = page => page.evaluate(() => { const g = document.getElementById('authGate'); return !!(g && getComputedStyle(g).display !== 'none' && g.getBoundingClientRect().width > 0); });
    const visible = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; }, sel);
    const acceptTos = async page => { await page.waitForTimeout(300); const b = await page.$('#tosAccept'); if (b) { await b.click(); await page.waitForTimeout(300); } };

    /* ---- (1) + (2) a fresh page: the sign-in gate, no /api/guest, nothing behind it reachable ---- */
    { const { ctx, page, calls, errors } = await open(null);
      await page.waitForTimeout(1500);
      ok(await gateOpen(page), 'a fresh page with no storage opens on the sign-in gate');
      ok(await page.evaluate(() => !!document.querySelector('#agTabNew') && !!document.querySelector('#agTabIn')), 'the gate offers Create account and Sign in');
      ok(!calls.some(c => c.includes('/api/guest')), 'a fresh page makes NO /api/guest call (' + (calls.filter(c => c.includes('/api/guest')).join(', ') || 'none') + ')');
      ok(await page.evaluate(() => !(window.ACC && ACC.token)), 'a fresh page holds no session');
      await shot(page, '1-first-screen.png');
      const hits = await page.evaluate(() => [[120, 200], [420, 195], [800, 30], [60, 360], [700, 360]].map(([x, y]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('#authGate')); }));
      ok(hits.every(Boolean), 'every tap on the screen lands on the gate, not the town (' + hits.join(',') + ')');
      const nav = await page.evaluate(() => { try { show('arena'); } catch (e) {} const a = state; try { show('campaign'); } catch (e) {} const b = state; try { show('tutorial'); } catch (e) {} return [a, b, state]; });
      await page.waitForTimeout(200);
      ok(nav.every(s => s === 'home') && await gateOpen(page), 'navigating to the Arena / Campaign / tutorial before sign-in is refused (' + nav.join(',') + ')');
      ok(!(await visible(page, '#tutOffer')), 'no tutorial offer before sign-in');
      // (3) Create account: lands on the game
      const nm = 'Sgn' + Date.now().toString(36).slice(-7);
      if (await page.$('#agTabNew')) await page.click('#agTabNew');
      if (await page.$('#agName')) { await page.fill('#agName', nm); await page.fill('#agPass', 'password1144'); await page.fill('#agPass2', 'password1144'); }
      await shot(page, '2-register.png');
      if (await page.$('#agGo')) await page.click('#agGo');
      await acceptTos(page); await page.waitForTimeout(2500);
      const st = await page.evaluate(() => ({ tok: !!(ACC && ACC.token), guest: !!(ACC && ACC.guest), name: ACC && ACC.name, state }));
      ok(st.tok && !st.guest && st.name === nm, 'Create account signs in as the new account (' + JSON.stringify(st) + ')');
      ok(!(await gateOpen(page)) && (st.state === 'home' || st.state === 'tutorial'), 'after Create account the gate is gone and the game is on screen (state ' + st.state + ')');
      const pr = st.tok ? await page.evaluate(() => api('/api/profile')) : {};
      ok(pr && pr.profile && pr.profile.name === nm && !pr.profile.guest, 'the server holds the new account (not a guest)');
      if (await visible(page, '#tutSkip')) { await page.click('#tutSkip'); await page.waitForTimeout(2200); }
      ok(!(await visible(page, '#guestMark')), 'a real account shows no GUEST marker');
      await shot(page, '3-hub-after-signin.png');
      ok(!calls.some(c => c.includes('/api/guest')), 'still no /api/guest call after registering');
      ok(errors.length === 0, 'no page errors on the fresh-page path (' + errors.slice(0, 2).join(' | ') + ')');
      await ctx.close(); }

    /* ---- (6) a lost real-account token goes to Sign in, never a guest ---- */
    { const { ctx, page, calls } = await open({ ew_acc: JSON.stringify({ token: 'expired-' + Date.now(), name: 'LostOne', id: 'nope', created: 0 }), ew_last_acct: JSON.stringify({ name: 'LostOne', id: 'nope' }) });
      await page.waitForTimeout(2500);
      ok(await gateOpen(page), 'a lost / expired real-account token lands on the sign-in gate');
      ok(await page.evaluate(() => !!document.querySelector('#agTabIn.on') && (document.querySelector('#agName') || {}).value === 'LostOne'), 'it opens on Sign in with the last account name filled');
      ok(!calls.some(c => c.includes('/api/guest')), 'a lost real-account token makes NO /api/guest call (' + (calls.filter(c => c.includes('/api/guest')).join(', ') || 'none') + ')');
      await ctx.close(); }

    /* ---- (4) an old device holding a guest token: the one-time upgrade step, progress kept ---- */
    { const { ctx, page, calls } = await open({ ew_device: devA, ew_acc: JSON.stringify({ token: gA.token, name: gA.profile.name, id: gA.profile.id, guest: true, created: gA.profile.created || 0 }) });
      await page.waitForTimeout(2500);
      const t = await page.evaluate(() => { const g = document.getElementById('authGate'); return g ? g.innerText : ''; });
      ok(await gateOpen(page) && /keep your progress/i.test(t), 'a stored guest token gets the "Create your account to keep your progress" step');
      ok(await page.evaluate(() => !!(ACC && ACC.token && ACC.guest)), 'the guest session itself is kept (not dropped, not replaced)');
      const hit = await page.evaluate(() => { const e = document.elementFromPoint(120, 200); return !!(e && e.closest('#authGate')); });
      ok(hit, 'the upgrade step covers the town (no tap reaches it)');
      ok(!(await page.$('#authGate .agX')) && await page.evaluate(() => { const g = document.getElementById('authGate'); if (!g) return false; g.dispatchEvent(new MouseEvent('click', { bubbles: true })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return getComputedStyle(g).display !== 'none'; }), 'the step has no close button and does not close on a backdrop tap or Escape');
      await shot(page, '4-guest-upgrade-step.png');
      const nm = 'Upg' + Date.now().toString(36).slice(-7);
      if (await page.$('#agName')) { await page.fill('#agName', nm); await page.fill('#agPass', 'password1144'); await page.fill('#agPass2', 'password1144'); await page.click('#agGo'); }
      await acceptTos(page); await page.waitForTimeout(2500);
      const st = await page.evaluate(() => ({ id: ACC && ACC.id, guest: !!(ACC && ACC.guest), name: ACC && ACC.name, tok: ACC && ACC.token }));
      ok(st.id === gA.profile.id && !st.guest && st.name === nm, 'upgrading keeps the SAME account id and makes it a real account (' + JSON.stringify({ id: st.id === gA.profile.id, guest: st.guest, name: st.name }) + ')');
      const led = st.tok ? (await call(P1, '/api/ledger', null, st.tok)).j : {}, L = led.ledger || led;
      ok(L.gold === 43210 && L.gems === 777, 'the upgraded account keeps the guest\'s ledger (gold ' + L.gold + ', gems ' + L.gems + ')');
      const lg = await call(P1, '/api/login', { name: nm, pass: 'password1144' });
      ok(lg.status === 200 && lg.j.profile && lg.j.profile.id === gA.profile.id, 'the new name + password sign in to that same account');
      ok(!(await gateOpen(page)) && !(await visible(page, '#guestMark')), 'after upgrading: no gate, no GUEST marker');
      const again = await call(P1, '/api/guest', { deviceId: devA });
      ok(again.status === 403 && !again.j.token, 'the upgraded device can no longer get a fresh guest (got ' + again.status + ')');
      ok(!calls.some(c => c.includes('/api/guest')), 'the guest device made no /api/guest call (its token was valid)');
      await ctx.close(); }

    /* ---- (5) the SOUL EATER case + the GUEST marker on the hub and the result screen ---- */
    { const storage = { ew_device: devB, ew_acc: JSON.stringify({ token: gB.token, name: gB.profile.name, id: gB.profile.id, guest: true, created: 0 }), ew_last_acct: JSON.stringify({ name: 'SoulEaterT', id: 'real-account-id' }) };
      let { ctx, page } = await open(storage);
      await page.waitForTimeout(2000);
      const t = await page.evaluate(() => { const g = document.getElementById('authGate'); return g ? g.innerText : ''; });
      ok(/signed in to\s+SoulEaterT/i.test(t) && /guest\s+\S+\s+now/i.test(t), 'a device that was on a real account says so plainly ("signed in to SoulEaterT ... on guest ... now")');
      ok(await page.evaluate(() => /Sign in to SoulEaterT/.test((document.querySelector('#agToIn') || {}).textContent || '')), 'and offers Sign in to that account');
      await shot(page, '5-guest-other-account.png');
      if (await page.$('#agKeep')) await page.click('#agKeep');
      await page.waitForTimeout(800);
      if (await visible(page, '#tutSkip')) { await page.click('#tutSkip'); await page.waitForTimeout(800); }
      ok(!(await gateOpen(page)), 'the guest may choose to keep playing (the step is one-time)');
      const mk = await page.evaluate(() => { const e = document.getElementById('guestMark'); return e ? e.textContent : ''; });
      ok(await visible(page, '#guestMark') && /GUEST - progress not saved to an account/.test(mk), 'the hub shows the GUEST marker next to the player name (' + mk.trim() + ')');
      ok(/not SoulEaterT/.test(mk), 'the marker names the account this device is NOT on');
      ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(mk), 'the marker has no emoji');
      await shot(page, '6-guest-marker-hub.png');
      await page.evaluate(() => { document.getElementById('resultTitle').textContent = 'VICTORY'; document.getElementById('resultTitle').className = 'result-big win'; document.getElementById('resultReward').innerHTML = ''; show('result'); });
      await page.waitForTimeout(500);
      ok(await visible(page, '#guestMarkRes') && /GUEST - progress not saved to an account/.test(await page.evaluate(() => document.getElementById('guestMarkRes').textContent)), 'the battle result screen shows the GUEST marker');
      await shot(page, '7-guest-marker-result.png');
      await page.evaluate(() => show('home')); await page.waitForTimeout(600);
      if (await visible(page, '#tutSkip')) { await page.click('#tutSkip'); await page.waitForTimeout(600); }
      if (await visible(page, '#guestMark')) await page.click('#guestMark');
      await page.waitForTimeout(500);
      ok(await gateOpen(page) && await page.evaluate(() => !!document.querySelector('#agGo')), 'tapping the marker opens the account step');
      // relaunch the same device (same browser storage)
      await page.goto(base + '/play', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('.splashPlay'), null, { timeout: 30000 }); await page.waitForTimeout(1800);
      await page.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await page.waitForTimeout(3000);
      if (await visible(page, '#tutSkip')) { await page.click('#tutSkip'); await page.waitForTimeout(600); }
      ok(!(await gateOpen(page)) && await visible(page, '#guestMark'), 'on the next launch the step stays seen, but the GUEST marker is still on the hub');
      await ctx.close(); }

    /* ---- (8) Servers 2-5: register, sign in and guest upgrade through the account server ---- */
    { const SECRET = 'ew1144-link-secret', PA = await freePort(), PB = await freePort();
      const a = start(PA, { DB_FILE: path.join(tmp, 'acct.json'), ACCOUNT_LINK_SECRET: SECRET }); assert(await up(PA), 'account server did not start');
      let b = start(PB, { DB_FILE: path.join(tmp, 's2.json'), ACCOUNT_LINK_SECRET: SECRET, ACCOUNT_AUTHORITY: 'http://127.0.0.1:' + PA, ALLOW_NEW_GUESTS: '1', SERVER_NAME: 'Server 2' }); assert(await up(PB), 'server 2 did not start');
      const g2 = (await call(PB, '/api/guest', { deviceId: 'ew1144-s2-old' })).j; await call(PB, '/api/ledger', null, g2.token);
      await stop(b); b = start(PB, { DB_FILE: path.join(tmp, 's2.json'), ACCOUNT_LINK_SECRET: SECRET, ACCOUNT_AUTHORITY: 'http://127.0.0.1:' + PA, SERVER_NAME: 'Server 2' }); assert(await up(PB), 'server 2 did not restart');
      const n2 = await call(PB, '/api/guest', { deviceId: 'ew1144-s2-new' });
      ok(n2.status === 403 && !n2.j.token, 'Server 2 refuses a new guest too');
      const nm = 'Xs' + Date.now().toString(36).slice(-7);
      const r2 = await call(PB, '/api/register', { name: nm, pass: 'password1144', deviceId: 'ew1144-s2-reg' });
      ok(r2.status === 200 && r2.j.token && r2.j.profile && !r2.j.profile.guest, 'Create account on Server 2 makes a real account through the account server (' + r2.status + ' ' + (r2.j.error || '') + ')');
      const l1 = await call(PA, '/api/login', { name: nm, pass: 'password1144' });
      ok(l1.status === 200 && l1.j.token, 'that account signs in on Server 1 (one name, one password game-wide)');
      const l2 = await call(PB, '/api/login', { name: nm, pass: 'password1144' });
      ok(l2.status === 200 && l2.j.token && l2.j.profile.id === r2.j.profile.id, 'and signs in again on Server 2 to the same player');
      const gr = await call(PB, '/api/guest', { deviceId: 'ew1144-s2-old' });
      ok(gr.status === 200 && gr.j.profile && gr.j.profile.id === g2.profile.id, 'Server 2 still resumes its existing guest');
      const nm2 = 'Xu' + Date.now().toString(36).slice(-7);
      const up2 = await call(PB, '/api/register', { name: nm2, pass: 'password1144', deviceId: 'ew1144-s2-old' }, gr.j.token);
      ok(up2.status === 200 && up2.j.profile && up2.j.profile.id === g2.profile.id && !up2.j.profile.guest, 'an existing guest on Server 2 upgrades in place (same id) through the account server');
      await stop(b); await stop(a); }

    console.log('test_signin_first_1144.js: ' + pass + ' checks passed, ' + missed.length + ' failed' + (control ? ' (CONTROL ' + ROOT + ')' : ''));
    if (missed.length) process.exitCode = 1;
  } catch (e) { console.error('FAIL', e && e.message || e); process.exitCode = 1; }
  finally { try { if (browser) await browser.close(); } catch (_) {} for (const c of procs) await stop(c); }
})();
