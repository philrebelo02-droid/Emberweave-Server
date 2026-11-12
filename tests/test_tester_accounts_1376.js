/* v1376 TEST ACCOUNTS (Phil 12 Nov 2026: "Can you make a test account? The test accounts will have the economy part of the dev panel and reset
   all progress option, that's all. These accounts would be deleted and removed when we launch the game, the same time we turn off free diamonds";
   "Give me the rights to be able to do it by clicking them").
   Real server on a free port + temp DB, then the real page:
   - an admin creates a test account (generated username + password) and makes / removes a tester by name;
   - a tester uses the Economy grant (on itself only) and Reset all progress, and is refused every other admin route;
   - a normal player is refused the Economy grant; testers are absent from the Bulletin Board rankings, the Arena ladder and real players' opponents;
   - switch off (restart with SHOP_FREE_PACKS=0): free packs off, test accounts moved to backups/removed-test-accounts-<date>.json and gone from
     the live world, their tokens refused, a normal account untouched, the admin still an admin, no new tester can be made;
   - page: a tester's Settings shows only the Economy group + Reset; an admin sees the whole dev panel and the tester button on a tapped player
     (chat name, Arena rankings row); a normal player sees neither.
   CONTROL: TP_ROOT=<a pre-v1376 checkout (d816d265)> must FAIL. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.TP_ROOT || path.join(__dirname, '..'), control = !!process.env.TP_ROOT;
let pass = 0, fail = 0; const ck = (m, c, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 300) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-tst1376-')), dbFile = path.join(tmp, 'db.json'); let srv = null, br = null; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  const env0 = { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: dbFile, RL_MUL: '1000', REG_PER_MIN: '500', REG_ACCOUNTS_PER_IP: '500', SIM_WORKERS: '0', ADMIN_IDS: '', MUT_PER_MIN: '5000' };
  delete env0.SHOP_FREE_PACKS;
  const start = async (extra) => { srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...env0, ...(extra || {}) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    srv.log = ''; srv.stdout.on('data', d => { srv.log += d; }); srv.stderr.on('data', d => { srv.log += d; });
    for (const t0 = Date.now(); Date.now() - t0 < 60000 && !(srv && srv.exitCode !== null);) { try { if ((await fetch(base + '/api/health')).ok) return; } catch (_) {} await delay(100); } throw new Error('server did not start'); };
  const stop = async () => { if (!srv) return; const c = srv; await delay(1200); c.kill(); for (let i = 0; i < 400 && c.exitCode === null && c.signalCode === null; i++) { if (i === 200) try { c.kill('SIGKILL'); } catch (_) {} await delay(50); } srv = null; };
  const req = async (method, u, b, tok) => { const r = await fetch(base + u, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { 'x-token': tok } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(b || {}) }); let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, body: j }; };
  const post = (u, b, tok) => req('POST', u, b, tok), get = (u, tok) => req('GET', u, null, tok);
  const login = async (n, p) => (await post('/api/login', { name: n, pass: p })).body;
  try {
    await start();
    const tag = Date.now().toString(36).slice(-5), ADM = 'tAdm' + tag, PL = 'tPl' + tag, TG = 'tTg' + tag, PW = 'password1';
    for (const n of [ADM, PL, TG]) await post('/api/register', { name: n, pass: PW });
    await stop();
    { const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); const du = Object.values(db.users).find(x => x.name === ADM); du.role = 'admin'; fs.writeFileSync(dbFile, JSON.stringify(db)); }
    await start();
    const al = await login(ADM, PW), pl = await login(PL, PW); let aTok = al.token, pTok = pl.token;   // one session per account: a new sign-in replaces the token
    ck('the admin signs in as an admin', !!aTok && al.profile.admin === true);
    // --- admin: create a test account
    const mk = await post('/api/admin/test-account', {}, aTok);
    ck('an admin creates a test account: a generated username + password come back once', mk.status === 200 && mk.body.ok && /^Tester[0-9a-f]{6}$/.test(mk.body.name || '') && String(mk.body.pass || '').length >= 10, JSON.stringify(mk));
    const T1 = mk.body.name, T1P = mk.body.pass; const t1 = await login(T1, T1P); const tTok = t1.token;
    ck('the test account signs in with them and its profile says tester', !!tTok && t1.profile && t1.profile.tester === true && !t1.profile.admin, JSON.stringify(t1.profile || t1));
    ck('a normal player\'s profile does not say tester', pl.profile && !pl.profile.tester && !pl.profile.admin);
    // --- admin: make / remove a tester by name; state readable
    let st = await get('/api/admin/tester?name=' + encodeURIComponent(TG), aTok);
    ck('admin reads a player\'s tester state (not a tester yet)', st.status === 200 && st.body.player && st.body.player.tester === false, JSON.stringify(st));
    let mt = await post('/api/admin/tester', { name: TG, on: true }, aTok);
    ck('admin makes a player a tester by name', mt.status === 200 && mt.body.player && mt.body.player.tester === true, JSON.stringify(mt));
    mt = await post('/api/admin/tester', { name: TG, on: false }, aTok);
    ck('admin removes the tester again', mt.status === 200 && mt.body.player && mt.body.player.tester === false, JSON.stringify(mt));
    mt = await post('/api/admin/tester', { name: TG, on: true }, aTok);
    ck('...and makes them a tester once more', mt.body.player && mt.body.player.tester === true);
    ck('an admin cannot be made a tester', (await post('/api/admin/tester', { name: ADM, on: true }, aTok)).status === 400);
    const lst = await get('/api/admin/testers', aTok);
    ck('admin lists the test accounts (both, tagged)', lst.status === 200 && lst.body.count === 2 && lst.body.testers.map(x => x.login).sort().join() === [T1, TG].sort().join(), JSON.stringify(lst.body).slice(0, 200));
    let tgTok = (await login(TG, PW)).token;
    // --- tester: the Economy grant (self only) + ledger flag
    const g = await post('/api/admin/led-grant', { gold: 100000, gems: 2000 }, tTok);
    ck('a tester uses the Economy grant (gold + diamonds)', g.status === 200 && g.body.ok && g.body.ledger.gold >= 100000 && g.body.ledger.gems >= 2000, JSON.stringify(g).slice(0, 200));
    ck('the tester\'s ledger carries tester:1', g.body.ledger && g.body.ledger.tester === 1);
    const plId = pl.profile.id; const plLed0 = (await get('/api/ledger', pTok)).body;
    const gOther = await post('/api/admin/led-grant', { userId: plId, gold: 55555 }, tTok);
    const plLed1 = (await get('/api/ledger', pTok)).body;
    ck('a tester\'s grant never reaches another account (userId ignored)', gOther.body.ok && ((plLed1.ledger || plLed1).gold | 0) === ((plLed0.ledger || plLed0).gold | 0), JSON.stringify([(plLed0.ledger || plLed0).gold, (plLed1.ledger || plLed1).gold]));
    ck('a tester levels via the grant (campaign)', (await post('/api/admin/led-grant', { campCleared: 50 }, tTok)).body.ledger.camp.cleared === 50);
    // --- tester: every other admin route refused
    const closed = [['GET', '/api/admin/accounts'], ['GET', '/api/admin/online'], ['GET', '/api/admin/backup'], ['GET', '/api/admin/reports'], ['GET', '/api/admin/player?id=' + plId],
      ['POST', '/api/admin/grant', { id: plId }], ['POST', '/api/admin/take', { id: plId }], ['POST', '/api/admin/create', { name: 'zz' + tag, pass: 'password1' }], ['POST', '/api/admin/delete', { id: plId }],
      ['POST', '/api/admin/ban', { id: plId, days: 1 }], ['POST', '/api/admin/unban', { id: plId }], ['POST', '/api/admin/email', { id: plId, action: 'clear' }], ['POST', '/api/admin/clearflag', { id: plId }],
      ['POST', '/api/admin/reset', { id: plId }], ['POST', '/api/admin/report', { action: 'clearResolved' }], ['POST', '/api/dev/ban', { id: plId, days: 1 }], ['GET', '/api/dev/reports'], ['GET', '/api/dev/gem-audit'],
      ['GET', '/api/admin/testers'], ['GET', '/api/admin/tester?name=' + PL], ['POST', '/api/admin/tester', { name: PL, on: true }], ['POST', '/api/admin/test-account', {}]];
    const open = []; for (const [m, u, b] of closed) { const r = await req(m, u, b, tTok); if (r.status !== 403) open.push(m + ' ' + u + ' -> ' + r.status); }
    ck('a tester is refused all ' + closed.length + ' other admin / dev routes (403)', open.length === 0, open.join(' | '));
    { const l = await login(PL, PW); pTok = l.token; ck('the normal player was not touched by those attempts (still signs in)', !!pTok); }
    // --- normal player refused the Economy grant
    ck('a normal player is refused the Economy grant', (await post('/api/admin/led-grant', { gold: 100000 }, pTok)).status === 403);
    ck('a normal player is refused the tester admin routes', (await post('/api/admin/tester', { name: PL, on: true }, pTok)).status === 403 && (await post('/api/admin/test-account', {}, pTok)).status === 403);
    // --- reset all progress (tester)
    const rs = await post('/api/account/reset-progress', {}, tTok); const tl = (await get('/api/ledger', tTok)).body; const tled = tl.ledger || tl;
    ck('a tester uses Reset all progress (gold 0, campaign 0)', rs.status === 200 && (tled.gold | 0) === 0 && tled.camp.cleared === 0, JSON.stringify(rs.body).slice(0, 120));
    await post('/api/admin/led-grant', { campCleared: 60 }, tTok); await post('/api/admin/led-grant', { campCleared: 40 }, tgTok);
    // --- rankings / ladder / opponents
    await post('/api/admin/led-grant', { userId: plId, campCleared: 10 }, aTok);
    const rk = await get('/api/rankings?board=campaign', pTok); const names = (rk.body.rows || []).map(r => r.name);
    ck('Bulletin Board campaign: the normal player is listed, no tester (the testers have 60 and 40)', names.includes(PL) && !names.includes(T1) && !names.includes(TG), names.join());
    const ra = await get('/api/rankings?board=arena', pTok); ck('Bulletin Board arena: no tester', ra.status === 200 && !(ra.body.rows || []).some(r => r.name === T1 || r.name === TG));
    const lad = await get('/api/arena/ladder?q=' + encodeURIComponent('Tester'), pTok), lad2 = await get('/api/arena/ladder?q=' + encodeURIComponent(TG), pTok), lad3 = await get('/api/arena/ladder?q=' + encodeURIComponent(PL), pTok);
    ck('Arena ladder: testers absent from the name search, the normal player present', !(lad.body.entries || []).some(e => e.name === T1) && (lad2.body.entries || []).length === 0 && (lad3.body.entries || []).some(e => e.name === PL), JSON.stringify([lad.body.entries && lad.body.entries.length, lad2.body.entries, lad3.body.entries && lad3.body.entries.length]));
    let seenT = false; for (let i = 0; i < 6; i++) { const o = await get('/api/arena/opponents', pTok); if ((o.body.opponents || []).some(x => x.name === T1 || x.name === TG)) seenT = true; }
    ck('a real player is never offered a tester as an Arena opponent (6 draws)', !seenT);
    // --- page checks (switch on)
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    br = await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args: ['--disable-audio-output', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const errs = [];
    const page = async (n, p) => { const ctx = await br.newContext({ viewport: { width: 1000, height: 462 }, serviceWorkers: 'block' }); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(n + ': ' + e.message));
      await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => typeof renderSettings === 'function' && typeof api === 'function' && typeof devAction === 'function', null, { timeout: 90000 }); await delay(1500);
      await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(400);
      pg.tok = await pg.evaluate(async ([n, p]) => { const r = await api('/api/login', 'POST', { name: n, pass: p }); ACC.token = r.token; ACC.id = r.profile.id; ACC.name = r.profile.name; ACC.admin = !!r.profile.admin; ACC.tester = !!r.profile.tester; G.tutStarted = true; G.tutDone = true; try { _whatsNewDone = true; } catch (e) {} document.body.classList.remove('gated'); show('home'); return r.token; }, [n, p]);
      await delay(800); return pg; };
    const look = (pg) => pg.evaluate(() => { try { setTab = 'dev'; } catch (e) {} renderSettings(); const b = document.getElementById('settingsBody'); const q = s => b.querySelectorAll(s).length;
      const acts = [...b.querySelectorAll('[data-dev]')].map(x => x.dataset.dev);
      return { devTabBtn: !!b.querySelector('[data-settab="dev"]'), groups: q('[data-devtab]'), acts, reset: !!b.querySelector('#resetBtn'), badge: (b.querySelector('.dvp-badge') || {}).textContent || '' }; });
    const ECON = ['gold', 'gems', 'shards', 'pieces', 'arenacoin', 'guildcoins', 'stam', 'stam30', 'level', 'squadlvl', 'campstage', 'campall', 'arena', 'shielditem', 'heroes', 'lv100', 'maxteam', 'givefrags'];
    // tester
    const tpg = await page(TG, PW); tgTok = tpg.tok; let v = await look(tpg);
    ck('page, tester: Settings has the Dev tab with ONLY the Economy group (no group tabs) + Reset all progress', v.devTabBtn && v.groups === 0 && v.reset && v.acts.length === ECON.length && v.acts.every(a => ECON.includes(a)) && v.badge === 'TEST', JSON.stringify(v));
    const tg2 = await tpg.evaluate(async () => { const box = document.createElement('div'); box.innerHTML = '<div id="devDone"></div><div id="devAdmin"></div>'; document.body.appendChild(box);
      devAction('gold', box); for (let i = 0; i < 40 && !/gold|refused|unavailable/i.test(box.querySelector('#devDone').textContent); i++) await new Promise(r => setTimeout(r, 150));
      const g1 = box.querySelector('#devDone').textContent; devAction('backup', box); devAction('online', box); await new Promise(r => setTimeout(r, 600));
      return { g1, admin: box.querySelector('#devAdmin').innerHTML }; });
    ck('page, tester: pressing +100,000 gold works; a non-Economy action does nothing', /\+100,000 gold/.test(tg2.g1) && tg2.admin === '', JSON.stringify(tg2));
    const tChat = await tpg.evaluate(async (n) => { const el = document.createElement('span'); el.dataset.w = n; document.body.appendChild(el); chatLineMenu(el); await new Promise(r => setTimeout(r, 500)); const pop = document.getElementById('chmPop'); const has = !!(pop && pop.querySelector('.adm-tst')); closeChatLineMenu(); return has; }, PL);
    ck('page, tester: tapping a chat name shows no tester button', tChat === false);
    // admin
    const apg = await page(ADM, PW); aTok = apg.tok; v = await look(apg);
    const vAcc = await apg.evaluate(() => { devTab = 'accounts'; setTab = 'dev'; renderSettings(); return [...document.getElementById('settingsBody').querySelectorAll('[data-dev]')].map(x => x.dataset.dev); });
    ck('page, admin: the whole dev panel (5 groups, Economy shown, DEV badge) + Reset', v.devTabBtn && v.groups === 5 && v.reset && v.badge === 'DEV' && ECON.slice(0, 6).every(a => v.acts.includes(a)), JSON.stringify(v));
    ck('page, admin: Dev > Accounts has the Test accounts tools', ['mktest', 'testers', 'settester', 'online', 'accounts'].every(a => vAcc.includes(a)), vAcc.join());
    const aChat = await apg.evaluate(async (n) => { const el = document.createElement('span'); el.dataset.w = n; document.body.appendChild(el); chatLineMenu(el);
      const pop = document.getElementById('chmPop'); let bt = null, stx = ''; for (let i = 0; i < 40; i++) { bt = pop && pop.querySelector('.adm-tst-b'); if (bt && !bt.disabled) break; await new Promise(r => setTimeout(r, 150)); }
      const before = { label: bt && bt.textContent, state: pop.querySelector('.adm-tst-st').textContent }; bt.click();
      for (let i = 0; i < 40 && !/Remove tester/.test(bt.textContent); i++) await new Promise(r => setTimeout(r, 150));
      const after = { label: bt.textContent, state: pop.querySelector('.adm-tst-st').textContent }; closeChatLineMenu(); return { before, after }; }, PL);
    ck('page, admin: tapping a player\'s chat name shows their state + "Make tester"', aChat.before.label === 'Make tester' && aChat.before.state === 'Not a test account', JSON.stringify(aChat));
    st = await get('/api/admin/tester?name=' + encodeURIComponent(PL), aTok);
    ck('page, admin: clicking it makes them a tester (server says so; button now "Remove tester")', aChat.after.label === 'Remove tester' && aChat.after.state === 'Test account' && st.body.player.tester === true, JSON.stringify([aChat.after, st.body.player]));
    await post('/api/admin/tester', { name: PL, on: false }, aTok);
    const aRk = await apg.evaluate(async (n) => { openRankings(); await new Promise(r => setTimeout(r, 600)); document.getElementById('rkSearch').value = n; document.getElementById('rkGo').click(); let row = null;   /* the top ranks are bots: search the player */ for (let i = 0; i < 60 && !row; i++) { await new Promise(r => setTimeout(r, 150)); row = document.querySelector('#rkList [data-rkn]'); }
      if (!row) return { row: false }; row.click(); let bt = null; for (let i = 0; i < 40; i++) { bt = document.querySelector('#chmPop .adm-tst-b'); if (bt && !bt.disabled) break; await new Promise(r => setTimeout(r, 150)); }
      const out = { row: true, who: row.dataset.rkn, label: bt && bt.textContent }; closeChatLineMenu(); return out; }, PL);
    ck('page, admin: tapping an Arena rankings row opens the tester button too', aRk.row && /tester/i.test(aRk.label || ''), JSON.stringify(aRk));
    // normal player
    const ppg = await page(PL, PW); pTok = ppg.tok; v = await look(ppg);
    ck('page, normal player: no Dev tab, no dev panel, no Reset all progress', !v.devTabBtn && v.groups === 0 && v.acts.length === 0 && !v.reset, JSON.stringify(v));
    const pChat = await ppg.evaluate(async (n) => { const el = document.createElement('span'); el.dataset.w = n; document.body.appendChild(el); chatLineMenu(el); await new Promise(r => setTimeout(r, 500)); const pop = document.getElementById('chmPop'); const has = !!(pop && pop.querySelector('.adm-tst')); closeChatLineMenu(); return has; }, TG);
    const pRk = await ppg.evaluate(() => _rkRow({ rank: 9, name: 'X', isNpc: false, power: 1 }).includes('data-rkn'));
    ck('page, normal player: no tester button on a chat name or a rankings row', pChat === false && pRk === false);
    ck('no page errors', errs.length === 0, errs.join(' | '));
    await br.close(); br = null;
    // --- the launch switch: restart with SHOP_FREE_PACKS=0
    const ids = (() => { const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); return Object.values(db.users).filter(u => u.name === T1 || u.name === TG).map(u => u.id); })();
    await stop(); await start({ SHOP_FREE_PACKS: '0' });
    const offers = await get('/api/shop/offers', pTok);
    ck('switch off: free packs are off too (one switch)', offers.status === 200 && offers.body.freePacks === false, JSON.stringify(offers.body).slice(0, 120));
    ck('switch off: the testers\' tokens are refused (the Economy grant answers 401/403)', ![200].includes((await post('/api/admin/led-grant', { gold: 1 }, tTok)).status) && ![200].includes((await post('/api/admin/led-grant', { gold: 1 }, tgTok)).status));
    ck('switch off: the test accounts can no longer sign in', !(await login(T1, T1P)).token && !(await login(TG, PW)).token);
    await delay(1300);
    const db2 = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    ck('switch off: both test accounts are gone from the live DB', ids.length === 2 && ids.every(id => !db2.users[id]) && !Object.values(db2.users).some(u => u && u.role === 'tester'), JSON.stringify(ids));
    const bdir = path.join(tmp, 'backups'); const bf = fs.existsSync(bdir) ? fs.readdirSync(bdir).filter(f => /^removed-test-accounts-\d{4}-\d\d-\d\d\.json$/.test(f)) : [];
    let bk = null; try { bk = JSON.parse(fs.readFileSync(path.join(bdir, bf[0]), 'utf8')); } catch (_) {}
    ck('switch off: they were moved into backups/removed-test-accounts-<date>.json first (whole records)', bf.length === 1 && bk && bk.accounts.length === 2 && bk.accounts.map(a => a.login).sort().join() === [T1, TG].sort().join() && bk.accounts.every(a => a.user && a.user.led && a.user.role === 'tester'), bf.join());
    ck('switch off: the server logged each removal', (srv.log.match(/\[testers\] launch: removed test account/g) || []).length === 2, srv.log.slice(-400));
    const pl2 = await login(PL, PW); const pled = (await get('/api/ledger', pl2.token)).body;
    ck('switch off: the normal account is untouched (signs in, campaign 10)', !!pl2.token && (pled.ledger || pled).camp.cleared === 10, JSON.stringify((pled.ledger || pled).camp));
    const a2 = (await login(ADM, PW)).token;
    ck('switch off: the admin is still an admin (Economy grant works)', (await post('/api/admin/led-grant', { gold: 1 }, a2)).status === 200);
    ck('switch off: no tester can be made or created', (await post('/api/admin/tester', { name: PL, on: true }, a2)).status === 400 && (await post('/api/admin/test-account', {}, a2)).status === 400);
    const lst2 = await get('/api/admin/testers', a2); ck('switch off: the list is empty and says the switch is off', lst2.body.count === 0 && lst2.body.prebeta === false);
  } catch (e) { fail++; console.log('  FAIL run: ' + (e.stack || e)); }
  finally { try { if (br) await br.close(); } catch (_) {} if (srv) { try { srv.kill(); } catch (_) {} } }
  console.log((control ? 'CONTROL ' : '') + pass + ' passed, ' + fail + ' failed');
  if (control) process.exit(fail > 0 ? 0 : 1);
  process.exit(fail ? 1 : 0);
})();
