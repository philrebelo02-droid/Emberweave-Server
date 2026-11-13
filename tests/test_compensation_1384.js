/* v1384 COMPENSATION (Phil 12 Nov 2026: "where can i give server compensation?" -> "yes build it").
   Two real servers on free ports with temp DBs and the account link between them (Server 1 = the account authority, Server 2 = a satellite
   that pulls the compensation list over the link every 2 s), then the real page:
   - an admin sends gold + diamonds from the dev panel route; a player, a test account and a signed-out caller get 403;
   - two players (and a guest) see it in their ledger, claim once: balances up exactly once; the same requestId again and a second claim with
     a new requestId do not pay again; an account made AFTER the send does not qualify;
   - the list shows the claim count; the admin log has compensation:send; Ember's feedback feed carries it;
   - it survives a restart (the compensation and who claimed it); it expires (moved past its end: gone from Mail, the claim refused);
   - Server 2 receives it over the link, its player claims it there, a compensation for Server 1 only does not reach Server 2, and Server 1's
     claim count includes Server 2's claim;
   - page: Live Ops > Compensation (form, preview, list) at 1440x900 and 844x390; a player's Mail before / after Claim (badge, Claim -> Claimed).
   CONTROL: TP_ROOT=<269df016> must FAIL. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.TP_ROOT || path.join(__dirname, '..'), control = !!process.env.TP_ROOT;
const SHOTS = control ? '' : (process.env.COMP_SHOTS || 'C:\\Users\\Home\\OneDrive\\Desktop\\Emberweave Archive\\Open Projects\\DEV PANEL REVAMP 12NOV2026\\shots\\compensation');
let pass = 0, fail = 0; const ck = (m, c, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 400) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const SILENT = () => { const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); }; };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-comp1384-')), DB1 = path.join(tmp, 's1', 'db.json'), DB2 = path.join(tmp, 's2', 'db.json'); fs.mkdirSync(path.dirname(DB1)); fs.mkdirSync(path.dirname(DB2)); const SECRET = 'link-' + Date.now();
  const P1 = await freePort(), P2 = await freePort(); const procs = {}; let br = null;
  const base0 = { ...process.env, DATABASE_URL: '', DB_STORE: '', RL_MUL: '1000', REG_PER_MIN: '500', REG_ACCOUNTS_PER_IP: '500', SIM_WORKERS: '0', ADMIN_IDS: '', MUT_PER_MIN: '5000', ALLOW_NEW_GUESTS: '1', ACCOUNT_LINK_SECRET: SECRET };
  delete base0.SHOP_FREE_PACKS; delete base0.ACCOUNT_AUTHORITY; delete base0.SERVER_ID; delete base0.SERVER_NAME;
  const start = async (name, port, extra) => { const p = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...base0, PORT: String(port), ...extra }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    p.log = ''; p.stdout.on('data', d => { p.log += d; }); p.stderr.on('data', d => { p.log += d; }); procs[name] = p;
    for (const t0 = Date.now(); Date.now() - t0 < 60000 && p.exitCode === null;) { try { if ((await fetch('http://127.0.0.1:' + port + '/api/health')).ok) return; } catch (_) {} await delay(100); } throw new Error(name + ' did not start: ' + p.log.slice(-300)); };
  const stop = async (name) => { const c = procs[name]; if (!c) return; await delay(1200); c.kill(); for (let i = 0; i < 400 && c.exitCode === null && c.signalCode === null; i++) { if (i === 200) try { c.kill('SIGKILL'); } catch (_) {} await delay(50); } delete procs[name]; };
  const S1 = { DB_FILE: DB1 }, S2 = { DB_FILE: DB2, ACCOUNT_AUTHORITY: 'http://127.0.0.1:' + P1, SERVER_ID: '2', SERVER_NAME: 'Server 2', COMP_SYNC_MS: '2000', ACCOUNT_STATUS_MS: '2000' };
  const req = async (port, method, u, b, tok) => { const r = await fetch('http://127.0.0.1:' + port + u, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { 'x-token': tok } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(b || {}) }); let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, body: j }; };
  const post = (u, b, tok, port) => req(port || P1, 'POST', u, b, tok), get = (u, tok, port) => req(port || P1, 'GET', u, null, tok);
  const login = async (n, p, port) => (await post('/api/login', { name: n, pass: p }, null, port)).body;
  const led = async (tok, port) => { const r = (await get('/api/ledger', tok, port)).body; return r.ledger || r; };
  try {
    await start('s1', P1, S1);
    const tag = Date.now().toString(36).slice(-4), PW = 'password1', ADM = 'cAdm' + tag, A = 'cPa' + tag, B = 'cPb' + tag, TG = 'cTg' + tag, C2 = 'cPc' + tag;
    for (const n of [ADM, A, B, TG, C2]) { const r = await post('/api/register', { name: n, pass: PW }); if (!r.body.token) throw new Error('register ' + n + ': ' + JSON.stringify(r.body)); }
    await stop('s1');
    { const db = JSON.parse(fs.readFileSync(DB1, 'utf8')); const by = n => Object.values(db.users).find(x => x.name === n); by(ADM).role = 'admin'; by(TG).role = 'tester'; fs.writeFileSync(DB1, JSON.stringify(db)); }
    await start('s1', P1, S1); await start('s2', P2, S2);
    let aTok = (await login(ADM, PW)).token; const aT = (await login(A, PW)), bT = (await login(B, PW)), tT = (await login(TG, PW));
    let aTk = aT.token, bTk = bT.token; const tTk = tT.token;
    const c2 = await login(C2, PW, P2); let c2Tk = c2.token;   // a Server 1 account that plays on Server 2 (linked there before the send)
    const guest = (await post('/api/guest', { deviceId: 'comp-dev-' + tag })).body; const gTk = guest.token;
    ck('setup: admin, two players, a tester, a guest on Server 1 and a player on Server 2', !!aTok && !!aTk && !!bTk && !!tTk && !!gTk && !!c2Tk, JSON.stringify([!!aTok, !!aTk, !!bTk, !!tTk, !!gTk, !!c2Tk, c2]));
    // --- only an admin can send
    const SEND = { subj: 'Server hiccup', text: 'Sorry for the downtime - here is something for you.', rewards: { gold: 1234, gems: 56 }, servers: 'all', days: 14 };
    const denied = []; for (const [who, tok] of [['signed out', null], ['player', aTk], ['tester', tTk]]) { const r = await post('/api/admin/compensation', SEND, tok); if (r.status !== 403) denied.push(who + ' -> ' + r.status); const g = await get('/api/admin/compensation', tok); if (g.status !== 403) denied.push(who + ' GET -> ' + g.status); }
    ck('a signed-out caller, a player and a test account get 403 (send and list)', denied.length === 0, denied.join(' | '));
    const a0 = await led(aTk), b0 = await led(bTk), g0 = await led(gTk);
    let r = await post('/api/admin/compensation', SEND, aTok);
    const CID = r.body.comp && r.body.comp.id;
    ck('admin sends gold + diamonds to every server (14 days)', r.status === 200 && !!CID && r.body.comp.rewards.gold === 1234 && r.body.comp.rewards.gems === 56 && r.body.comp.until - r.body.comp.t === 14 * 86400000 && r.body.eligibleHere >= 5, JSON.stringify(r.body).slice(0, 300));
    ck('a reward over its limit is capped, an empty one refused', (await post('/api/admin/compensation', { subj: 'x', rewards: {}, servers: 'all' }, aTok)).status === 400 && (await post('/api/admin/compensation', { subj: 'x', rewards: { gems: 1 }, servers: [] }, aTok)).status === 400);
    // an account made after the send does not qualify
    const late = (await post('/api/register', { name: 'cLate' + tag, pass: PW })).body; const lTk = late.token;
    // --- players see it and claim once
    let a1 = await led(aTk); const seenA = (a1.comps || []).find(c => c.id === CID);
    ck('player A sees it in the ledger (subject, rewards, not claimed)', !!seenA && seenA.subj === 'Server hiccup' && !seenA.claimed && seenA.rewards.gold === 1234, JSON.stringify(a1.comps));
    const late1 = await led(lTk);
    ck('an account made after the send does not get it (and its claim is refused)', !(late1.comps || []).some(c => c.id === CID) && (await post('/api/comp/claim', { id: CID, requestId: 'late-1' }, lTk)).status === 400);
    const c1 = await post('/api/comp/claim', { id: CID, requestId: 'rq-a-1' }, aTk); a1 = await led(aTk);
    ck('player A claims: gold +1234 and diamonds +56 exactly', c1.status === 200 && c1.body.ok && (a1.gold | 0) === (a0.gold | 0) + 1234 && (a1.gems | 0) === (a0.gems | 0) + 56 && (a1.comps || []).find(c => c.id === CID).claimed === true, JSON.stringify([a0.gold, a1.gold, a0.gems, a1.gems, c1.body.error]));
    const c1b = await post('/api/comp/claim', { id: CID, requestId: 'rq-a-1' }, aTk); const c1c = await post('/api/comp/claim', { id: CID, requestId: 'rq-a-2' }, aTk); const a2 = await led(aTk);
    ck('the same requestId again and a second claim with a new requestId do not pay again', c1b.status === 200 && c1c.status === 200 && c1c.body.already === true && (a2.gold | 0) === (a1.gold | 0) && (a2.gems | 0) === (a1.gems | 0), JSON.stringify([a1.gold, a2.gold, c1c.body]));
    const cB = await post('/api/comp/claim', { id: CID, requestId: 'rq-b-1' }, bTk); const b1 = await led(bTk);
    ck('player B claims once too (balances up exactly once)', cB.status === 200 && (b1.gold | 0) === (b0.gold | 0) + 1234 && (b1.gems | 0) === (b0.gems | 0) + 56, JSON.stringify([b0.gold, b1.gold]));
    const cG = await post('/api/comp/claim', { id: CID, requestId: 'rq-g-1' }, gTk); const g1 = await led(gTk);
    ck('a guest claims it too', cG.status === 200 && (g1.gold | 0) === (g0.gold | 0) + 1234, JSON.stringify(cG.body));
    // --- Server 2 over the link
    const ONE = await post('/api/admin/compensation', { subj: 'Server 1 only', rewards: { stamina: 10 }, servers: ['1'], days: 3 }, aTok); const ONEID = ONE.body.comp && ONE.body.comp.id;
    let c2led = null; for (let i = 0; i < 40; i++) { c2led = await led(c2Tk, P2); if ((c2led.comps || []).some(c => c.id === CID)) break; await delay(500); }
    ck('Server 2 receives the compensation over the account link (its player sees it in Mail)', (c2led.comps || []).some(c => c.id === CID && !c.claimed), JSON.stringify(c2led.comps));
    ck('a compensation for Server 1 only does not reach Server 2', !!ONEID && !(c2led.comps || []).some(c => c.id === ONEID) && (await led(aTk)).comps.some(c => c.id === ONEID));
    const c2g0 = c2led.gold | 0; const cc2 = await post('/api/comp/claim', { id: CID, requestId: 'rq-c2-1' }, c2Tk, P2); const c2l1 = await led(c2Tk, P2);
    ck('the Server 2 player claims it there (once)', cc2.status === 200 && (c2l1.gold | 0) === c2g0 + 1234, JSON.stringify([cc2.status, cc2.body.error, c2g0, c2l1.gold]));
    let list = null; for (let i = 0; i < 30; i++) { list = (await get('/api/admin/compensation', aTok)).body; const it = (list.comps || []).find(c => c.id === CID); if (it && it.claims >= 4) break; await delay(500); }
    const it = (list.comps || []).find(c => c.id === CID);
    ck('the list shows the claim count across servers (A, B, the guest on Server 1 + the Server 2 player = 4)', it && it.claims === 4 && it.live === true, JSON.stringify(it));
    const lg = (await get('/api/admin/log?n=50', aTok)).body.log || [];
    ck('the admin log has compensation:send with the rewards and the count', lg.some(x => x.act === 'compensation:send' && /gold/.test(x.detail) && /players here/.test(x.detail)), JSON.stringify(lg.filter(x => /comp/.test(x.act))));
    const ef = (await get('/api/ember/feedback', aTok)).body;
    ck('Ember\u2019s feedback feed carries the compensation sends', (ef.actions || []).some(x => x.act === 'compensation:send'), JSON.stringify(ef.actions).slice(0, 200));
    // --- page: dev panel Live Ops > Compensation, a player's Mail before / after Claim
    const PAGE_C = await post('/api/admin/compensation', { subj: 'Thanks for testing', text: 'A little something from the team.', rewards: { gold: 5000, gems: 100, pot_minor: 3, stamina: 30 }, servers: 'all', days: 14 }, aTok); const PCID = PAGE_C.body.comp && PAGE_C.body.comp.id;
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    br = await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args: ['--disable-audio-output', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const errs = [];
    const page = async (n, p, vp) => { const ctx = await br.newContext({ viewport: vp, serviceWorkers: 'block' }); await ctx.addInitScript(SILENT); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(n + ': ' + e.message));
      await pg.goto('http://127.0.0.1:' + P1 + '/play', { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => typeof renderSettings === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(1500);
      await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(400);
      pg.tok = await pg.evaluate(async ([n, p]) => { const r = await api('/api/login', 'POST', { name: n, pass: p }); ACC.token = r.token; ACC.id = r.profile.id; ACC.name = r.profile.name; ACC.admin = !!r.profile.admin; ACC.tester = !!r.profile.tester; G.tutStarted = true; G.tutDone = true; try { _whatsNewDone = true; } catch (e) {} document.body.classList.remove('gated'); try { authGateRefresh(); } catch (e) {} show('home'); try { await ledgerSync(); } catch (e) {} return r.token; }, [n, p]);
      await delay(800); return pg; };
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    for (const [lab, w, h] of [['pc-1440x900', 1440, 900], ['phone-844x390', 844, 390]]) {
      const apg = await page(ADM, PW, { width: w, height: h }); aTok = apg.tok;
      const v = await apg.evaluate(async () => { devTab = 'liveops'; setTab = 'dev'; popoutScreen('settings'); await new Promise(r => setTimeout(r, 300)); renderSettings(); devPanelOpen(); await new Promise(r => setTimeout(r, 600));
        document.querySelector('#dvpOv [data-lsel="comp"]').click(); await new Promise(r => setTimeout(r, 200));
        const R = document.getElementById('dvpLiveR'); R.querySelector('[data-comp="gold"]').value = '2500'; R.querySelector('[data-comp="gold"]').dispatchEvent(new Event('input', { bubbles: true }));
        R.querySelector('[data-comp="gems"]').value = '50'; R.querySelector('[data-comp="gems"]').dispatchEvent(new Event('input', { bubbles: true }));
        R.querySelector('#dvpCompSubj').value = 'Maintenance thank-you'; R.querySelector('#dvpCompSubj').dispatchEvent(new Event('input', { bubbles: true }));
        for (let i = 0; i < 30 && !/claimed/.test(document.querySelector('#dvpOv .dvp-left').textContent); i++) await new Promise(r => setTimeout(r, 150));
        return { prev: document.getElementById('dvpCompPrev').textContent, list: document.querySelector('#dvpOv .dvp-left').textContent, send: !!R.querySelector('[data-dev="compsend"]') }; });
      ck('page, ' + lab + ': Live Ops > Compensation: the form, the preview line and the sent list with claim counts', /Every player on S1-S5 gets: 2,500 Gold · 50 Diamonds/.test(v.prev) && /Server hiccup/.test(v.list) && /claimed/.test(v.list) && v.send, JSON.stringify(v));
      if (SHOTS) await apg.screenshot({ path: path.join(SHOTS, 'devpanel-compensation-' + lab + '.png') });
      if (lab === 'pc-1440x900') {   // send it from the page (confirm step)
        const sent = await apg.evaluate(async () => { document.querySelector('#dvpLiveR [data-dev="compsend"]').click(); await new Promise(r => setTimeout(r, 300)); const y = document.getElementById('_gcYes'); const q = !!y; await new Promise(r => setTimeout(r, 600)); y.click();
          for (let i = 0; i < 40 && !/sent/i.test(document.getElementById('devDone').textContent); i++) await new Promise(r => setTimeout(r, 150)); return { q, done: document.getElementById('devDone').textContent }; });
        ck('page: Send asks first, then sends', sent.q && /Compensation sent/.test(sent.done), JSON.stringify(sent));
      }
      await apg.context().close();
      const ppg = await page(B, PW, { width: w, height: h }); bTk = ppg.tok;
      const before = await ppg.evaluate(async () => { show('mail'); mailTab = 'inbox'; renderMail(); await new Promise(r => setTimeout(r, 300));
        const rows = [...document.querySelectorAll('#mailBody .mailrow.comp')]; const md = document.getElementById('mailDot');
        return { n: rows.length, claimBtns: document.querySelectorAll('#mailBody [data-compclaim]').length, claimed: document.querySelectorAll('#mailBody .comp-done').length, badge: md ? md.textContent : '', unclaimed: compUnclaimed(), txt: rows.map(r => r.textContent.replace(/\s+/g, ' ').slice(0, 120)) }; });
      if (SHOTS) await ppg.screenshot({ path: path.join(SHOTS, 'mail-compensation-before-' + lab + '.png') });
      const after = await ppg.evaluate(async (id) => { const g0 = G.gold; const btn = document.querySelector('#mailBody [data-compclaim="' + id + '"]'); if (!btn) return { nobtn: true }; btn.click();
        for (let i = 0; i < 40 && document.querySelector('#mailBody [data-compclaim="' + id + '"]'); i++) await new Promise(r => setTimeout(r, 150));
        const row = document.querySelector('#mailBody .mailrow.comp[data-comp="' + id + '"]'); const md = document.getElementById('mailDot');
        return { claimed: !!(row && row.querySelector('.comp-done')), gold: G.gold - g0, unclaimed: compUnclaimed(), badge: md ? md.textContent : '' }; }, PCID);
      if (SHOTS) await ppg.screenshot({ path: path.join(SHOTS, 'mail-compensation-after-' + lab + '.png') });
      if (lab === 'pc-1440x900') {
        ck('page: player B\u2019s Mail shows the compensations at the top of the Inbox (1 to claim, 1 claimed) and the badge counts the unclaimed', before.n >= 2 && before.claimBtns >= 1 && before.claimed >= 1 && before.unclaimed >= 1 && /Thanks for testing/.test(before.txt.join(' ')), JSON.stringify(before));
        ck('page: Claim pays it (gold +5000), the mail now says Claimed, the unclaimed count drops', after.claimed && after.gold === 5000 && after.unclaimed === before.unclaimed - 1, JSON.stringify([before.unclaimed, after]));
      } else ck('page, phone: the claimed compensations say Claimed, none left to claim from this run', before.n >= 2 && after.nobtn === true || after.claimed, JSON.stringify([before, after]));
      await ppg.context().close();
    }
    ck('no page errors', errs.length === 0, errs.join(' | '));
    await br.close(); br = null;
    // --- restart, then expiry
    await stop('s1'); await start('s1', P1, S1); aTk = (await login(A, PW)).token; aTok = (await login(ADM, PW)).token;
    const ar = await led(aTk);
    ck('after a restart: the compensation is still there and still claimed by A (no second claim)', (ar.comps || []).some(c => c.id === CID && c.claimed) && (await post('/api/comp/claim', { id: CID, requestId: 'rq-a-3' }, aTk)).body.already === true && ((await led(aTk)).gold | 0) === (ar.gold | 0), JSON.stringify(ar.comps));
    await stop('s1');
    { const db = JSON.parse(fs.readFileSync(DB1, 'utf8')); const c = (db.comps || []).find(x => x.id === ONEID); if (c) c.until = Date.now() - 1000; fs.writeFileSync(DB1, JSON.stringify(db)); }
    await start('s1', P1, S1); aTk = (await login(A, PW)).token;
    const ax = await led(aTk);
    ck('it expires: past its end it is gone from Mail and the claim is refused', !(ax.comps || []).some(c => c.id === ONEID) && (await post('/api/comp/claim', { id: ONEID, requestId: 'rq-a-x' }, aTk)).status === 400, JSON.stringify(ax.comps && ax.comps.map(c => c.id)));
  } catch (e) { fail++; console.log('  FAIL run: ' + (e.stack || e)); }
  finally { try { if (br) await br.close(); } catch (_) {} for (const k of Object.keys(procs)) { try { procs[k].kill(); } catch (_) {} } }
  console.log((control ? 'CONTROL ' : '') + pass + ' passed, ' + fail + ' failed');
  if (control) process.exit(fail > 0 ? 0 : 1);
  process.exit(fail ? 1 : 0);
})();
