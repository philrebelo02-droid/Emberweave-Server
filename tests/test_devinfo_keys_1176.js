/* v1176 - two things in one real-page run (Chromium, a real local server with a temp DB, phone 844x390, SILENT: --mute-audio and every
   AudioContext output through a gain of 0, SwiftShader, service workers blocked).
   A) THE DEV PANEL PLAYER INFO (Phil 16 Oct: "can you make it so that I can see their info? their level, diamonds, gold, top campaign/vault
      level etc etc"): a dev opens Settings > Developer Panel > Accounts > Players online, taps the fixture player, and the popup shows the
      seven sections with the fixture's numbers from the server; the existing buttons are still there; the mute button is docked under the
      popup's X and overlaps no text, button or section; nothing is wider than the screen. Screenshot: SHOT_DIR (default
      C:\Users\Home\Downloads\ew-sweep\devinfo).
   B) KEYBOARD (Phil 16 Oct: "can you make the esc button exit to main city and backspace to go back one menu, unless in chat typing of
      course"): Esc from a nested window (Arena > Arena Shop > a confirm window) lands on the hub; Backspace steps back one level at a
      time (profile -> Arena Shop -> Arena -> hub, then nothing on the hub) and never navigates history; typing in chat and in the report
      box is untouched (Backspace deletes, Esc does nothing); mid-battle Esc does not end the fight (no pause button: nothing; with the
      pause button: Pause, then Resume - never Quit); on the result screen Esc = Continue; nothing happens on the sign-in gate.
   C) v1177 OVERLAYS: the campaign stage popup (no X) and six other overlay types - Esc leaves the hub with nothing on top; Backspace on
      the stage popup = Back to Map.
   CONTROL: KEYS_ROOT=<a pre-v1176 checkout> (or the v1176 page, which fails C on the stage popup) serves that page and server - this test must FAIL. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.KEYS_ROOT || path.join(__dirname, '..'), control = !!process.env.KEYS_ROOT;
const SHOTS = process.env.SHOT_DIR || (control ? '' : 'C:\\Users\\Home\\Downloads\\ew-sweep\\devinfo');
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 600) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const SILENT = () => { const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); }; };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-keys1176-')), dbFile = path.join(tmp, 'db.json');
  let srv = null, browser = null; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  const start = async admin => { const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: dbFile, RL_MUL: '1000', REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', SIM_WORKERS: '0', ADMIN_IDS: admin || '' }, stdio: ['ignore', log, log], windowsHide: true });
    for (let i = 0; i < 300; i++) { try { if ((await fetch(base + '/api/health')).ok) return; } catch (_) {} await delay(100); } throw new Error('server did not start'); };
  const stop = async () => { if (!srv) return; srv.kill(); for (let i = 0; i < 60 && srv.exitCode === null; i++) await delay(50); srv = null; };
  const post = async (r, b, t) => (await fetch(base + r, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(t ? { 'x-token': t } : {}) }, body: b ? JSON.stringify(b) : undefined })).json();
  try {
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    /* fixture: a dev account and a player with a ledger and known numbers */
    await start('');
    const dev = await post('/api/register', { name: 'kbDev', pass: 'password1' }), pl = await post('/api/register', { name: 'StevenFixture', pass: 'password1' });
    await post('/api/ledger', null, pl.token); await post('/api/heartbeat', {}, pl.token).catch(() => {}); await delay(500); await stop();
    { const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')), u = db.users[pl.profile.id];
      Object.assign(u.led, { gems: 23456, gold: 345678, px: 180000, stamItems: 2 }); u.led.camp.cleared = 47; u.lastSeen = Date.now(); u.dust = 512; u.email = 'fixture@example.com';
      db.dungeonProgress = db.dungeonProgress || {}; db.dungeonProgress[u.id] = { accountId: u.id, currentFloor: 13, highestClearedFloor: 12, vaultStatus: 'active', claimedFloors: {}, sweep: {}, activeAttempt: null, lastTeamHeroIds: [], version: 1 };
      fs.writeFileSync(dbFile, JSON.stringify(db)); }
    await start(dev.profile.id);
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    const args = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ args }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args }); }
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
    await ctx.addInitScript(SILENT);
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(2500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(1200);
    /* the sign-in gate: the keys do nothing */
    { const before = await pg.evaluate(() => [state, history.length, (document.getElementById('authGate') || {}).style ? document.getElementById('authGate').style.display : '']);
      await pg.keyboard.press('Escape'); await pg.keyboard.press('Backspace'); await delay(300);
      const after = await pg.evaluate(() => [state, history.length, (document.getElementById('authGate') || {}).style ? document.getElementById('authGate').style.display : '']);
      ck(JSON.stringify(before) === JSON.stringify(after), 'sign-in gate: Esc and Backspace change nothing', JSON.stringify([before, after])); }
    /* sign in as the dev */
    await pg.evaluate(async () => { const r = await api('/api/login', 'POST', { name: 'kbDev', pass: 'password1' }); ACC.token = r.token; ACC.id = r.profile.id; ACC.name = r.profile.name; try { ACC.admin = !!r.profile.admin; } catch (e) {}
      try { if (typeof PROFILE !== 'undefined') PROFILE = r.profile; } catch (e) {} G.tutStarted = true; G.tutDone = true; try { document.body.classList.remove('gated'); } catch (e) {} try { authGateRefresh(); } catch (e) {} show('home'); });
    await delay(2500);

    /* ===== A) the player-info popup ===== */
    const opened = await pg.evaluate(async () => { try { if (typeof _serverAdmin !== 'undefined') _serverAdmin = true; } catch (e) {}
      devTab = 'accounts'; popoutScreen('settings'); await new Promise(r => setTimeout(r, 900));
      const b = document.querySelector('[data-dev="online"]'); if (!b) return 'no Players online button (dev panel not shown)'; b.click();
      for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 150)); const row = [...document.querySelectorAll('.devrow')].find(x => /StevenFixture/.test(x.textContent)); if (row) { row.click(); return 'ok'; } }
      return 'fixture row not listed'; });
    ck(opened === 'ok', 'dev panel: Accounts > Players online lists the fixture player and the popup opens', opened);
    await pg.waitForFunction(() => { const i = document.getElementById('paInfo'); return i && i.querySelectorAll('.pai-sec').length >= 5; }, null, { timeout: 15000 }).catch(() => {});
    await delay(1500); try { await pg.evaluate(() => muteBtnPlace(true)); } catch (e) {} await delay(400);
    const A = await pg.evaluate(() => { if (!document.querySelector('.pai-card')) { const o = document.querySelector('#paX'); try { if (o) o.click(); } catch (e) {} return { t: '', secs: [], btns: false, docked: false, over: [], fits: false, wide: false }; } const info = document.getElementById('paInfo'), t = info ? info.innerText : '';
      const secs = info ? [...info.querySelectorAll('.pai-st')].map(x => x.textContent.trim().toLowerCase()) : [];
      const m = document.getElementById('muteBtn'), x = document.getElementById('paX'), mr = m && m.getBoundingClientRect(), xr = x && x.getBoundingClientRect();
      const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const over = []; if (mr) { const rg = document.createRange(), card = document.querySelector('.pai-card');
        for (const el of card.querySelectorAll('*')) { if (el === m || m.contains(el) || el.classList.contains('pai-hd') || el.classList.contains('pai-xc') || el.classList.contains('pai-xs') || el.classList.contains('pai-body') || el.id === 'paInfo') continue;
          if (/^(BUTTON|IMG)$/.test(el.tagName) || el.classList.contains('pai-sec')) { const g = el.getBoundingClientRect(); if (g.width && hit(g, mr) && el !== x && !x.contains(el)) over.push(el.tagName + '#' + el.id + '.' + el.className); }
          for (const n of el.childNodes) if (n.nodeType === 3 && /\S/.test(n.data)) { rg.selectNodeContents(n); for (const g of rg.getClientRects()) if (hit(g, mr)) over.push('text:' + n.data.trim().slice(0, 20)); } } }
      const btns = ['paGrant', 'paTake', 'paBan'].every(id => !!document.getElementById(id)) && !!(document.getElementById('paReset') || document.getElementById('paUndo'));
      const card = document.querySelector('.pai-card').getBoundingClientRect();
      return { t, secs, btns, docked: !!(mr && xr && m.dataset.why === 'win-under-x' && mr.top >= xr.bottom - 1 && Math.abs((mr.left + mr.width / 2) - (xr.left + xr.width / 2)) <= 2), why: m && m.dataset.why,
        mr: mr && [Math.round(mr.left), Math.round(mr.top), Math.round(mr.width)], xr: xr && [Math.round(xr.left), Math.round(xr.top), Math.round(xr.width)], over: [...new Set(over)].slice(0, 6),
        fits: card.left >= 0 && card.right <= innerWidth && card.top >= 0 && card.bottom <= innerHeight, wide: document.documentElement.scrollWidth <= innerWidth + 1 };
    });
    for (const s of ['identity', 'progress', 'currencies', 'roster', 'account', 'reports', 'integrity']) ck(A.secs.includes(s), 'popup section: ' + s, A.secs.join(','));
    ck(/23,456/.test(A.t) && /345,678/.test(A.t), 'diamonds 23,456 and gold 345,678 from the server ledger', A.t.slice(0, 300));
    ck(/5-7\s+\(47\/160\)/.test(A.t) && /Floor 12/.test(A.t), 'top Normal stage 5-7 (47/160) and Aether Vault floor 12', A.t.slice(0, 400));
    ck(/Lv \d+/.test(A.t) && /Forge Dust\s*512/.test(A.t) && /Ember Roasts\s*2/.test(A.t), 'player level, Forge Dust 512, Ember Roasts 2');
    ck(/Email on file\s*Yes/.test(A.t) && !/fixture@example\.com/.test(A.t), 'has email: Yes - the address itself is not shown');
    ck(A.btns, 'the existing buttons stay (+2000, -2000, Recover password, Ban)');
    ck(A.why === 'offmain' && A.over.length === 0, 'v1230 (Phil: mute only on the main screens): no mute button over this popup, nothing overlapped', JSON.stringify({ why: A.why, mr: A.mr, xr: A.xr, over: A.over }));
    ck(A.fits && A.wide, 'the popup fits 844x390 (no horizontal scroll)');
    { const em = (A.t.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F2FF}]/gu) || []).length; ck(em === 0, 'no emoji in the popup', em); }
    if (SHOTS) { await pg.screenshot({ path: path.join(SHOTS, 'devinfo-popup-844x390.png') });
      await pg.evaluate(() => { const b = document.querySelector('.pai-body'); if (b) b.scrollTop = b.scrollHeight; }); await delay(300); await pg.screenshot({ path: path.join(SHOTS, 'devinfo-popup-844x390-scrolled.png') });
      await pg.setViewportSize({ width: 1600, height: 900 }); await delay(700); try { await pg.evaluate(() => muteBtnPlace(true)); } catch (e) {} await delay(300); await pg.screenshot({ path: path.join(SHOTS, 'devinfo-popup-desktop.png') });
      await pg.setViewportSize({ width: 844, height: 390 }); await delay(500); }

    /* ===== B) keyboard ===== */
    const S = () => pg.evaluate(() => ({ st: state, pop: (typeof _popout !== 'undefined' && _popout) || '', prof: !!document.getElementById('_gcNo'), pa: !!document.getElementById('paX'), hist: history.length, url: location.href }));
    // Esc from the dev popup (a window over a pop-out) lands on the hub
    await pg.keyboard.press('Escape'); await delay(700);
    { const s = await S(); ck(s.st === 'home' && !s.pop && !s.pa, 'Esc from the player popup over Settings lands on the hub', JSON.stringify(s)); }
    const nest = async () => { await pg.evaluate(() => { show('arena'); }); await delay(600); await pg.evaluate(() => { show('arenaShop'); }); await delay(600); await pg.evaluate(() => { gameConfirm('Buy this?', () => { window.__bought = true; }); }); await delay(500); };
    await nest();
    { const s = await S(); ck(s.st === 'arenaShop' && s.prof, 'nested: Arena > Arena Shop > a confirm window', JSON.stringify(s)); }
    await pg.keyboard.press('Escape'); await delay(700);
    { const s = await S(); ck(s.st === 'home' && !s.prof && !s.pop && !(await pg.evaluate(() => !!window.__bought)), 'Esc from the nested window lands on the hub (the confirm was cancelled, not confirmed)', JSON.stringify(s)); }
    await nest(); const h0 = (await S()).hist, u0 = (await S()).url;
    const seq = []; for (let i = 0; i < 4; i++) { await pg.keyboard.press('Backspace'); await delay(700); const s = await S(); seq.push(s.st + (s.prof ? '+confirm' : '')); }
    ck(seq.join(' > ') === 'arenaShop > arena > home > home', 'Backspace steps back one level at a time: ' + seq.join(' > '), seq.join(' > '));
    { const s = await S(); ck(s.hist === h0 && s.url === u0, 'Backspace never navigates browser history', JSON.stringify([h0, s.hist, s.url])); }
    // typing: chat and the report box
    { const r = await pg.evaluate(async () => { ensureChatWidget(); const w = document.getElementById('chatWidget'); if (w) { w.style.display = 'block'; w.classList.remove('min'); } const i = document.getElementById('cwInput'); if (!i) return 'no chat input'; i.focus(); i.value = 'hello'; return document.activeElement === i ? 'ok' : 'not focused'; });
      ck(r === 'ok', 'chat input focused', r);
      await pg.keyboard.press('End'); await pg.keyboard.press('Backspace'); await pg.keyboard.press('Escape'); await delay(400);
      const v = await pg.evaluate(() => [document.getElementById('cwInput').value, state]);
      ck(v[0] === 'hell' && v[1] === 'home', 'typing in chat: Backspace deletes a letter, Esc does nothing ("' + v[0] + '", ' + v[1] + ')'); }
    await pg.evaluate(() => { try { document.activeElement.blur(); } catch (e) {} popoutScreen('settings'); }); await delay(800);
    { const r = await pg.evaluate(() => { const t = document.getElementById('rpText'); if (!t) return 'no report box'; t.focus(); t.value = 'bug!'; return document.activeElement === t ? 'ok' : 'not focused'; });
      ck(r === 'ok', 'report box focused', r);
      await pg.keyboard.press('End'); await pg.keyboard.press('Backspace'); await pg.keyboard.press('Backspace'); await pg.keyboard.press('Escape'); await delay(400);
      const v = await pg.evaluate(() => [document.getElementById('rpText') && document.getElementById('rpText').value, _popout]);
      ck(v[0] === 'bu' && v[1] === 'settings', 'typing in the report box: Backspace deletes, Esc leaves Settings open ("' + v[0] + '", ' + v[1] + ')'); }
    await pg.evaluate(() => { try { document.activeElement.blur(); } catch (e) {} }); await pg.keyboard.press('Backspace'); await delay(500);
    { const s = await S(); ck(s.st === 'home' && !s.pop, 'Backspace (not typing) closes Settings', JSON.stringify(s)); }
    /* v1177 (Phil: "escape brought me back to city but didnt remove the pop out"): every overlay type - Esc lands on the hub with
       NOTHING on top (the overlay list empty, uiWindowOpen() false, and the screen at five points is the hub, not a window) */
    const hubClean = () => pg.evaluate(() => { const pts = [[.5, .5], [.25, .3], [.75, .3], [.25, .75], [.75, .75]].map(([a, b]) => document.elementFromPoint(innerWidth * a, innerHeight * b));
      const onTop = pts.map(e => e && e.closest('#stageModal,#profileModal,#hudShop,#glModal,.gmodal-ov,#popoutBackdrop,.popout,[id^=uiCf],.pai-card')).filter(Boolean).map(e => e.id || e.className);
      let ov = []; try { ov = kbOverlays().map(o => o.root.id || o.root.className); } catch (e) { ov = []; }   // (the v1176 control has no kbOverlays: judged by uiWindowOpen, the stage flag and the five points)
      let win = null; try { win = uiWindowOpen(); } catch (e) {}
      const sm = document.getElementById('stageModal'); return { st: state, ov, win, onTop, stage: !!(sm && sm.classList.contains('active')), pop: (typeof _popout !== 'undefined' && _popout) || '' }; });
    const cleanOk = r => r.st === 'home' && r.ov.length === 0 && r.win === false && r.onTop.length === 0 && !r.stage && !r.pop;
    { const h0 = await hubClean(); ck(cleanOk(h0), 'the hub itself has no overlay (the overlay list is empty there)', JSON.stringify(h0)); }
    const OVERLAYS = [
      ['the campaign stage popup (Stage 1-1, no X: Back to Map)', async () => { show('campaign'); await new Promise(r => setTimeout(r, 900)); openStageModal(1, 'normal'); }, () => document.getElementById('stageModal').classList.contains('active')],
      ['the profile window', async () => { show('home'); await new Promise(r => setTimeout(r, 400)); openProfile(); }, () => document.getElementById('profileModal').classList.contains('active')],
      ['the food shop window', async () => { show('home'); await new Promise(r => setTimeout(r, 400)); openHudShop('food'); }, () => document.getElementById('hudShop').classList.contains('active')],
      ['the glossary card over the glossary', async () => { show('glossary'); await new Promise(r => setTimeout(r, 900)); openGlossaryCard('heroes', 'vael'); }, () => document.getElementById('glModal').classList.contains('open')],
      ['a confirm over the Arena Shop', async () => { show('arena'); await new Promise(r => setTimeout(r, 400)); show('arenaShop'); await new Promise(r => setTimeout(r, 400)); gameConfirm('Buy?', () => { window.__bought2 = true; }); }, () => !!document.getElementById('_gcNo')],
      ['the hero window over the Heroes pop-out', async () => { show('home'); popoutScreen('heroesPanel'); await new Promise(r => setTimeout(r, 900)); const c = document.querySelector('#heroesPanel .hero-card'); if (c) c.click(); }, () => typeof _popout !== 'undefined' && !!_popout],
      ['the expanded chat panel', async () => { show('home'); await new Promise(r => setTimeout(r, 400)); ensureChatWidget(); const w = document.getElementById('chatWidget'); w.style.display = 'block'; w.classList.remove('min'); }, () => !document.getElementById('chatWidget').classList.contains('min')],
    ];
    for (const [name, open, isOpen] of OVERLAYS) {
      await pg.evaluate(() => { try { document.activeElement.blur(); } catch (e) {} });
      await pg.evaluate(open); await delay(1200);
      const o = await pg.evaluate(isOpen); ck(o === true, name + ': opened', o);
      if (name.startsWith('the campaign') && SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'esc-stage-popup-before.png') });
      await pg.keyboard.press('Escape'); await delay(900);
      const r = await hubClean(); const chat = name.includes('chat') ? await pg.evaluate(() => document.getElementById('chatWidget').classList.contains('min') || document.getElementById('chatWidget').style.display === 'none') : true;
      ck(cleanOk(r) && chat, name + ': Esc -> the hub with nothing on top', JSON.stringify(r));
      if (name.startsWith('the campaign') && SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'esc-stage-popup-after.png') });
    }
    ck(!(await pg.evaluate(() => !!window.__bought2)), 'Esc cancelled the confirm - it never confirmed');
    /* Backspace on the stage popup = Back to Map: one level, the campaign map stays */
    await pg.evaluate(async () => { show('campaign'); await new Promise(r => setTimeout(r, 900)); openStageModal(1, 'normal'); }); await delay(1000);
    await pg.keyboard.press('Backspace'); await delay(700);
    { const r = await pg.evaluate(() => ({ st: state, stage: document.getElementById('stageModal').classList.contains('active') }));
      ck(r.st === 'campaign' && !r.stage, 'Backspace on the stage popup = Back to Map (the campaign map stays)', JSON.stringify(r)); }
    await pg.keyboard.press('Backspace'); await delay(700);
    { const r = await hubClean(); ck(cleanOk(r), 'Backspace again: the campaign map -> the hub', JSON.stringify(r)); }
    // battle
    await pg.evaluate(() => { closePopout(); show('home'); CUR = { node: 1, mode: 'arena' }; _startVersusNow([{ key: 'grosk', level: 5, rank: 1 }, { key: 'gruel', level: 5, rank: 1 }], true); }); await delay(2000);
    { const b = await pg.evaluate(() => [state, ended]); ck(b[0] === 'battle' && !b[1], 'a fight is running', JSON.stringify(b)); }
    for (const k of ['Escape', 'Backspace', 'Escape']) { await pg.keyboard.press(k); await delay(300); }
    { const b = await pg.evaluate(() => [state, ended, paused, document.getElementById('pauseModal').classList.contains('active')]);
      ck(b[0] === 'battle' && !b[1] && !b[3], 'mid-battle (no pause button): Esc / Backspace do nothing - the fight goes on', JSON.stringify(b)); }
    await pg.evaluate(() => { document.getElementById('pauseBtn').classList.add('active'); }); await pg.keyboard.press('Escape'); await delay(300);
    { const b = await pg.evaluate(() => [state, ended, paused, document.getElementById('pauseModal').classList.contains('active')]);
      ck(b[0] === 'battle' && !b[1] && b[2] && b[3], 'mid-battle with the pause button: Esc opens Pause (the fight is not ended)', JSON.stringify(b)); }
    await pg.keyboard.press('Escape'); await delay(300);
    { const b = await pg.evaluate(() => [state, ended, paused, document.getElementById('pauseModal').classList.contains('active')]);
      ck(b[0] === 'battle' && !b[1] && !b[2] && !b[3], 'Esc again = Resume (never Quit)', JSON.stringify(b)); }
    await pg.evaluate(() => { document.getElementById('pauseBtn').classList.remove('active'); endBattle(true); }); await delay(2600);
    { const s0 = await S(); await pg.keyboard.press('Escape'); await delay(1500); const s = await S();
      ck(s0.st === 'result' && s.st !== 'result' && s.st !== 'battle', 'result screen: Esc = Continue (' + s0.st + ' -> ' + s.st + ')', JSON.stringify([s0, s])); }
    ck(errs.length === 0, 'no page errors', errs.join(' | '));
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  finally { try { if (browser) await browser.close(); } catch (e) {} await stop(); }
  console.log('test_devinfo_keys_1176.js: ' + pass + ' passed, ' + fail + ' failed' + (control ? ' (CONTROL ' + ROOT + ')' : ''));
  process.exitCode = fail ? 1 : 0;
})();
