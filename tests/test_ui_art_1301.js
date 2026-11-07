/* v1301 (Phil 6 Nov: "give the art job to chatgpt" / "i want it good quality like temple of ash"): ChatGPT's painted Forge and Bonus Stage
   pieces are served and used - Forge screen background, item rows, quality tabs, item popup, Temper bar + button; the Bonus Stage panel
   frame, plaques, row bands and gold Claim. On a landscape phone (844x390) the Claim button stays on screen with 9 quality rows (the
   list scrolls, not the panel). Real server (temp DB) + real page (Chromium). CONTROL: TP_ROOT=<a pre-v1301 checkout> must FAIL. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.TP_ROOT || path.join(__dirname, '..'), control = !!process.env.TP_ROOT;
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 300) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const ART = ['forge/forge-bg', 'forge/forge-popup', 'forge/forge-row', 'forge/forge-tab', 'forge/forge-tab-on', 'forge/forge-temper-bar',
  'forge/forge-temper-fill', 'forge/forge-temper-btn', 'forge/close-button', 'bonus/panel-frame', 'bonus/stat-plaque', 'bonus/row-band', 'bonus/claim-button'];
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-art1301-')), dbFile = path.join(tmp, 'db.json');
  let srv = null, browser = null; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  try {
    const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: dbFile, RL_MUL: '1000', REG_PER_MIN: '500', REG_ACCOUNTS_PER_IP: '500', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    for (let i = 0; i < 300; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch (_) {} await delay(100); }
    for (const a of ART) { const r = await fetch(base + '/assets/img/ui/' + a + '.webp?v=1'); ck(r.ok && /image\/webp/.test(r.headers.get('content-type') || ''), 'served: ' + a + '.webp', r.status); }
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    const args = ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ args }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args }); }
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(1500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(600);
    await pg.evaluate(async () => { const r = await api('/api/register', 'POST', { name: 'art' + Date.now().toString(36), pass: 'password1' }); ACC.token = r.token; ACC.id = r.profile.id; ACC.name = r.profile.name;
      G.tutStarted = true; G.tutDone = true; try { _whatsNewDone = true; } catch (e) {} document.body.classList.remove('gated'); show('home'); });
    await delay(1500);
    const f = await pg.evaluate(async () => {
      show('forge'); await new Promise(r => setTimeout(r, 2500)); if (!FORGE.cat) return { err: 'no catalog' };
      const grey = FORGE.cat.items.filter(d => d.quality === 'Grey'), it = grey[0];
      FORGE.st = Object.assign({}, FORGE.st || {}, { enabled: true, dust: 291, resonance: { rank: 0, total: 5, next: 20 }, items: { i1: { d: it.id, temper: 5 } }, equipped: {}, temperByType: { [it.id]: { temper: 5, prog: 3 } }, active: {} });
      FORGE.tab = 'items'; FORGE.q = 0; FORGE.open = null; FORGE.stAt = Date.now() + 1e9; renderForge(); await new Promise(r => setTimeout(r, 400));
      const cs = (sel, p) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[p] : ''; };
      const out = { bg: cs('#forge', 'backgroundImage'), row: cs('.fgRow', 'borderImageSource'), tab: cs('.fgQ:not(.on)', 'backgroundImage'), tabOn: cs('.fgQ.on', 'backgroundImage') };
      forgeRow(it.id); await new Promise(r => setTimeout(r, 400));
      Object.assign(out, { pop: cs('.fgPopCard', 'borderImageSource'), bar: cs('.fgBar.big', 'backgroundImage'), fill: cs('.fgBar.big i', 'backgroundImage'), btn: cs('.fgTBtn', 'backgroundImage'), x: cs('.fgPopX', 'backgroundImage') });
      forgePopClose(); return out; });
    ck(!f.err, 'Forge catalog loaded', f.err);
    ck(/forge-bg\.webp/.test(f.bg), 'Forge screen uses forge-bg', f.bg);
    ck(/forge-row\.webp/.test(f.row), 'item rows use forge-row', f.row);
    ck(/forge-tab\.webp/.test(f.tab) && /forge-tab-on\.webp/.test(f.tabOn), 'quality tabs use the navy / gold tab art', f.tab + ' | ' + f.tabOn);
    ck(/forge-popup\.webp/.test(f.pop), 'item popup uses forge-popup', f.pop);
    ck(/forge-temper-bar\.webp/.test(f.bar) && /forge-temper-fill\.webp/.test(f.fill), 'Temper bar uses the bar + molten fill', f.bar + ' | ' + f.fill);
    ck(/forge-temper-btn\.webp/.test(f.btn), 'Temper x1 uses the gold button', f.btn);
    ck(/close-button\.webp/.test(f.x), 'popup close uses the round close button', f.x);
    const b = await pg.evaluate(async () => {
      const real = api; window.api = async (u, m, bd) => { if (String(u).startsWith('/api/bonus/state')) return { ok: true, perHour: 42, since: Date.now() - 1800000, serverNow: Date.now(),
        claim: { rates: { Grey: 20, Green: 14, 'Green +1': 9, Blue: 6, 'Blue +1': 5, 'Blue +2': 4, Purple: 2, 'Purple +1': 2, Gold: 1 }, perQuality: { Grey: 240, Green: 168, Blue: 72, Purple: 24 }, capHours: 36, hours: 12, total: 504 } }; return real(u, m, bd); };
      await bonusHourlyClaim(); await new Promise(r => setTimeout(r, 500)); window.api = real;
      const P = document.getElementById('bonusFragPanel'); if (!P) return { err: 'no panel' };
      const card = P.querySelector('.bfCard'), claim = P.querySelector('#bfClaim'), cr = claim && claim.getBoundingClientRect();
      const cs = (e, p) => e ? getComputedStyle(e)[p] : '';
      return { frame: cs(card, 'borderImageSource'), plaque: cs(P.querySelector('.bfPlaque'), 'backgroundImage'), band: cs(P.querySelector('.bfRow'), 'backgroundImage'),
        claimBg: cs(claim, 'backgroundImage'), rows: P.querySelectorAll('.bfRow').length, claimBottom: cr ? cr.bottom : 9999, vh: innerHeight, claimTxt: claim && claim.innerText,
        close: !!P.querySelector('#bfClose') };
    });
    ck(!b.err, 'Bonus Stage panel opens', b.err);
    ck(/panel-frame\.webp/.test(b.frame), 'panel uses the glyph-bowl frame', b.frame);
    ck(/stat-plaque\.webp/.test(b.plaque), 'stat boxes use the plaque', b.plaque);
    ck(/row-band\.webp/.test(b.band) && b.rows === 9, 'quality rows use the row band (9 rows)', b.band + ' rows=' + b.rows);
    ck(/claim-button\.webp/.test(b.claimBg) && /504/.test(b.claimTxt || ''), 'Claim uses the gold button and shows 504', b.claimBg + ' ' + b.claimTxt);
    ck(b.claimBottom <= b.vh, 'Claim stays on screen on a landscape phone with 9 rows', b.claimBottom + ' > ' + b.vh);
    ck(b.close, 'panel has its close button');
    ck(errs.length === 0, 'no page errors', errs.join(' | '));
  } catch (e) { fail++; console.log('  FAIL run: ' + (e.stack || e)); }
  finally { try { if (browser) await browser.close(); } catch (_) {} if (srv) srv.kill(); }
  console.log((control ? 'CONTROL ' : '') + pass + ' passed, ' + fail + ' failed');
  if (control) process.exit(fail > 0 ? 0 : 1);
  process.exit(fail ? 1 : 0);
})();
