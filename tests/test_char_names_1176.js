/* v1176 CHARACTER NAMES (Phil 16 Oct 2026: "please allow numbers in someones character name" / "dont make any special characters that
   may mess up coding" / "or backup"). The server is the authority (badCharName): sign-up, guest upgrade, rename and the dev panel's
   Create account all answer 400 with a short reason for a blocked name.
   (1) SERVER RULES over HTTP: digits names and the safe symbols _ - . ! ? # @ $ % * + = ~ ( ) [ ] : , ^ are accepted; each of
       < > & " ' ` \ / | ; { } is refused (never silently stripped); emoji, hidden / zero-width characters, stacked accents, only-symbol
       names, the Guest pattern, a look-alike of an existing name (impersonation) are refused; runs of spaces collapse; 16 characters max;
       rename follows the same rules.
   (2) ESCAPING (real page, Chromium, SILENT): legacy names made before this rule - a player named <b class=pwn>x</b>&"' and one named
       <img src=x onerror=__xss=1>, in a guild named <i class=pwn>g</i>&"', with a world chat message - render as TEXT on the rankings,
       arena, guild, chat and the dev panel (list + player popup): no .pwn element is ever created, the onerror never runs, and the
       literal name shows in chat and the dev panel.
   CONTROL: NAMES_ROOT=<a pre-v1176 checkout> must FAIL (it strips < > silently and accepts emoji). */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.NAMES_ROOT || path.join(__dirname, '..'), control = !!process.env.NAMES_ROOT;
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 400) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const SILENT = () => { const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); }; };
const EVIL = '<b class=pwn>x</b>&"\'', EVIL2 = '<img src=x onerror=__xss=1>', EVILG = '<i class=pwn>g</i>&"\'';
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-names1176-')), dbFile = path.join(tmp, 'db.json');
  let srv = null, browser = null; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  const start = async admin => { const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: dbFile, RL_MUL: '1000', REG_PER_MIN: '500', REG_ACCOUNTS_PER_IP: '500', SIM_WORKERS: '0', ADMIN_IDS: admin || '' }, stdio: ['ignore', log, log], windowsHide: true });
    for (let i = 0; i < 300; i++) { try { if ((await fetch(base + '/api/health')).ok) return; } catch (_) {} await delay(100); } throw new Error('server did not start'); };
  const stop = async () => { if (!srv) return; srv.kill(); for (let i = 0; i < 60 && srv.exitCode === null; i++) await delay(50); srv = null; };
  const call = async (r, b, t) => { const x = await fetch(base + r, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(t ? { 'x-token': t } : {}) }, body: b ? JSON.stringify(b) : undefined }); let j = {}; try { j = await x.json(); } catch (_) {} return { status: x.status, data: j }; };
  const reg = n => call('/api/register', { name: n, pass: 'password1' });
  try {
    await start('');
    /* ---- (1) server rules ---- */
    for (const n of ['Steve97', '12345', 'Kai_99', 'Ana-Lu.2', 'Zed!?', 'A#1@b$', 'x%y*z+', 'q=w~e', 'Lo(r)[d]', 'a:b,c^d', 'Renée 7', '李小龙88'])
      { const r = await reg(n); ck(r.status === 200 && r.data.profile && r.data.profile.name === n, 'accepted: ' + JSON.stringify(n), JSON.stringify([r.status, r.data.error, r.data.profile && r.data.profile.name])); }
    for (const ch of ['<', '>', '&', '"', "'", '`', '\\', '/', '|', ';', '{', '}'])
      { const r = await reg('Ab' + ch + 'cd'); ck(r.status === 400 && /cannot use/i.test(r.data.error || ''), 'blocked character ' + ch + ' (400: ' + (r.data.error || r.status) + ')'); }
    for (const [n, why] of [['Fire\u{1F525}', 'emoji'], ['Hi❤', 'emoji (heart)'], ['Kai​', 'zero-width space'], ['Mo‮on', 'bidi override'], ['Zá́́', 'stacked accents'],
      ['!!!', 'only symbols'], ['#@$%', 'only symbols'], ['Guest12', 'the Guest pattern'], ['Tab\tx', 'a control character'], ['Steve97!', 'impersonation of Steve97 (punctuation)'], ['STEVE97', 'impersonation of Steve97 (case)'], ['Stеve97', 'impersonation of Steve97 (Cyrillic e)']])
      { const r = await reg(n); ck(r.status >= 400 && r.status < 500 && !r.data.token, 'blocked: ' + why + ' (' + r.status + ': ' + (r.data.error || '') + ')'); }
    { const r = await reg('  Max   Power  '); ck(r.status === 200 && r.data.profile.name === 'Max Power', 'spaces trimmed and runs collapsed ("' + (r.data.profile && r.data.profile.name) + '")'); }
    { const r = await reg('ABCDEFGHIJKLMNOPQRSTU'); ck(r.status === 200 && r.data.profile.name.length === 16, 'length limit 16 (' + (r.data.profile && r.data.profile.name) + ')'); }
    { const a = await reg('RenameMe1'), t = a.data.token;
      const bad = await call('/api/account/rename', { name: 'Re<na>me', requestId: 'rn1' }, t), ok2 = await call('/api/account/rename', { name: 'Renamed 2!', requestId: 'rn2' }, t);
      ck(!bad.data.ok && /cannot use/i.test(bad.data.error || ''), 'rename: a blocked character is refused (' + (bad.data.error || bad.status) + ')');
      ck(ok2.data.ok === true || /diamond|cost|gem/i.test(ok2.data.error || ''), 'rename: digits and safe symbols pass the name rules (' + (ok2.data.error || 'ok') + ')'); }

    /* ---- (2) escaping of legacy names on the real page ---- */
    const dev = (await reg('nmDev')).data, ev = (await reg('EvilLegacy')).data, ev2 = (await reg('EvilLegacy2')).data;
    await call('/api/ledger', null, ev.token); await call('/api/ledger', null, ev2.token); await delay(500); await stop();
    { const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')), now = Date.now();
      const u = db.users[ev.profile.id], u2 = db.users[ev2.profile.id];
      delete db.byName[u.name.toLowerCase()]; delete db.byName[u2.name.toLowerCase()]; u.name = EVIL; u2.name = EVIL2; db.byName[EVIL.toLowerCase()] = u.id; db.byName[EVIL2.toLowerCase()] = u2.id;
      u.rank = 1; u2.rank = 2; u.lastSeen = now; u2.lastSeen = now;
      const gid = 'gEvil1'; db.guilds = db.guilds || {}; db.guilds[gid] = { id: gid, name: EVILG, leader: u.id, members: [u.id, u2.id], reqs: [], level: 1, exp: 0, motd: 'hi', log: [], createdAt: now }; u.guildId = gid; u2.guildId = gid;
      db.chat = db.chat || { world: [], region: [] }; db.chat.world = (db.chat.world || []).concat([{ who: EVIL, txt: 'hello from ' + EVIL, t: now, mid: 'm1', sid: u.id }, { who: EVIL2, txt: 'hey', t: now, mid: 'm2', sid: u2.id }]);
      fs.writeFileSync(dbFile, JSON.stringify(db)); }
    await start(dev.profile.id);
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    const args = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ args }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args }); }
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' }); await ctx.addInitScript(SILENT);
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(2500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(1000);
    await pg.evaluate(async () => { const r = await api('/api/login', 'POST', { name: 'nmDev', pass: 'password1' }); ACC.token = r.token; ACC.id = r.profile.id; ACC.name = r.profile.name; ACC.admin = !!r.profile.admin;
      G.tutStarted = true; G.tutDone = true; try { document.body.classList.remove('gated'); } catch (e) {} try { authGateRefresh(); } catch (e) {} show('home'); });
    await delay(2500);
    const probe = () => pg.evaluate(([E, E2, EG]) => ({ pwn: document.querySelectorAll('.pwn').length, img: document.querySelectorAll('img[src="x"]').length, xss: typeof window.__xss !== 'undefined',
      lit: document.body.innerText.includes(E), lit2: document.body.innerText.includes(E2), litG: document.body.innerText.includes(EG) }), [EVIL, EVIL2, EVILG]);
    const seen = {};
    const screen = async (name, fn, wait) => { try { await pg.evaluate(fn); } catch (e) { ck(false, name + ' opened', e.message); return; } await delay(wait || 2500);
      const p = await probe(); seen[name] = p; ck(p.pwn === 0 && p.img === 0 && !p.xss, name + ': legacy names render as text (no element built, no script ran)', JSON.stringify(p)); };
    await screen('rankings', () => { show('rankings'); });
    await screen('arena', () => { show('arena'); });
    await screen('guild', () => { show('guild'); });
    await screen('chat', () => { show('home'); ensureChatWidget(); const w = document.getElementById('chatWidget'); if (w) { w.style.display = 'block'; w.classList.remove('min'); } try { if (CHATNET.ws) CHATNET.ws.close(); } catch (e) {} setTimeout(chatConnect, 300); setTimeout(() => { try { chatTab = 'world'; renderChat(); } catch (e) {} }, 4500); }, 6000);
    if (seen.chat && !seen.chat.lit) console.log('  (chat debug) ' + await pg.evaluate(() => JSON.stringify({ n: (CHAT.world || []).length, w: (CHAT.world || []).slice(-2), conn: CHATNET.connected, tab: typeof chatTab !== 'undefined' && chatTab })));
    ck(seen.chat && seen.chat.lit, 'chat shows the legacy name literally');
    await screen('dev panel list', async () => { devTab = 'accounts'; popoutScreen('settings'); await new Promise(r => setTimeout(r, 900)); document.querySelector('[data-dev="online"]').click(); }, 3000);
    ck(seen['dev panel list'] && seen['dev panel list'].lit && seen['dev panel list'].lit2, 'the dev panel list shows both legacy names literally');
    await screen('dev panel popup', () => { const row = [...document.querySelectorAll('.devrow')].find(x => x.textContent.includes('<b class=pwn>')); row.click(); }, 3000);
    ck(seen['dev panel popup'] && seen['dev panel popup'].lit, 'the player popup shows the legacy name literally');
    ck(errs.length === 0, 'no page errors', errs.join(' | '));
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  finally { try { if (browser) await browser.close(); } catch (e) {} await stop(); }
  console.log('test_char_names_1176.js: ' + pass + ' passed, ' + fail + ' failed' + (control ? ' (CONTROL ' + ROOT + ')' : ''));
  process.exitCode = fail ? 1 : 0;
})();
