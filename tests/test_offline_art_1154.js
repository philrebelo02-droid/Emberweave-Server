'use strict';
// v1154 OFFLINE ART LIST (Settings > "Update all features"). Before: it saved every table's ORIGINAL file on every device and its card showed
// the whole origin's storage (Phil's phone: "941 of 941 files ... 1708.5 MB"). Now it saves only what THIS device loads:
//   1. a phone lists each tiered battle sheet as its PHONE file (assets/anim/tiers_1141.json), a desktop as its trimmed file; idle/walk and
//      any sheet another screen paints from the original (Skills-tab previews) keep the original; no file removed in v1154 is listed and
//      every listed URL answers 200;
//   2. the card says "<saved> of <N> files saved on this device - <X> MB of <T> MB": N = the list, X/T = the bytes of those files
//      (/api/asset-sizes), and after a real download X = T = the bytes the device's art cache really holds for the list;
//   3. a device that saved the OLD (v1153) set keeps working: the plan finds it saved, fetches only the tier files, clears the originals this
//      device no longer loads (the v583 guards: never over a quarter of the library), ends N of N, and a fight with Carn + Aureth then
//      loads every sheet from the cache with no 404;
//   CONTROL: the BASE page (v1153) on the same phone lists no tier file and its MB is not the list's bytes.
(async function main() {
const path = require('path'), fs = require('fs'), cp = require('child_process'), os = require('os'), net = require('net');
const ROOT = path.resolve(__dirname, '..');
const BASE_SHA = process.env.EW_BASE || 'c5adff17';   // live v1153
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
let chromium = null; try { ({ chromium } = require(path.join(ROOT, 'node_modules/playwright'))); } catch (e) {}
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort(), base = 'http://127.0.0.1:' + port, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-oart-'));
const srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200' }, stdio: 'ignore', windowsHide: true });
let browser;
try {
  for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch (_) {} await delay(150); }
  if (!chromium) throw new Error('playwright missing');
  const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/anim/tiers_1141.json'), 'utf8')).sheets;
  const sizes = (await (await fetch(base + '/api/asset-sizes')).json()).sizes;
  ck('/api/asset-sizes gives the byte size of every file under assets/', sizes && Object.keys(sizes).length > 2000 && sizes['/assets/anim/tiers_1141.json'] === fs.statSync(path.join(ROOT, 'assets/anim/tiers_1141.json')).size);
  const retired = path.join(ROOT, 'tests/fixtures/retired_assets_1154.txt'), RET = fs.existsSync(retired) ? fs.readFileSync(retired, 'utf8').split(/\r?\n/).filter(Boolean) : [];
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] })
    .catch(() => chromium.launch({ headless: true, args: ['--mute-audio'] }));   // 18 Oct: no Google Chrome on the cluster CTs -> bundled Chromium
  const PHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' };
  const DESK = { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 };
  const open = async (opts, html) => { const ctx = await browser.newContext(Object.assign({ serviceWorkers: 'allow' }, opts));
    if (html) { await ctx.route(u => /\/play(\?|$)/.test(new URL(u).pathname), r => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
      await ctx.route('**/version.json*', r => r.fulfill({ status: 200, contentType: 'application/json', body: cp.execSync('git show ' + BASE_SHA + ':version.json', { cwd: ROOT }).toString() })); }
    const pg = await ctx.newPage(); const errs = [], bad = []; pg.on('pageerror', e => errs.push(String(e.message))); pg.on('response', r => { if (r.status() >= 400 && /\/assets\//.test(r.url())) bad.push(r.status() + ' ' + r.url()); });
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' }); await delay(3000);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(1000);
    await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'oa' + Date.now().toString(36), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id;
      G.tutStarted = true; G.tutDone = true; try { document.body.classList.remove('gated'); } catch (e) {} show('home'); });
    await delay(1200); return { ctx, pg, errs, bad }; };
  const plan = pg => pg.evaluate(async () => { const p = await assetCachePlan(); const s = (typeof assetSetBytes === 'function') ? await assetSetBytes(p) : null;
    const clipU = new Set(), keepU = new Set(); for (const k in BATTLE_ANIM) { const set = BATTLE_ANIM[k]; for (const st in set) { if (st[0] === '_') continue; const c = set[st]; if (!c || !c.u) continue; (_keepsImage(c) ? keepU : clipU).add(c.u); } }
    const other = new Set(); try { for (const k in HERO_SKILL_CLIPS) { const g = HERO_SKILL_CLIPS[k]; for (const i in g) if (g[i] && g[i].u) other.add(g[i].u); } } catch (e) {}
    return { tier: typeof ART_TIER !== 'undefined' ? ART_TIER : null, urls: p.urls, cached: p.cached, missing: p.missing.length, stale: p.stale.length, bytes: s, clipU: [...clipU], keepU: [...keepU], other: [...other] }; });
  const card = async pg => { await pg.evaluate(() => show('settings')); for (let i = 0; i < 40; i++) { const t = await pg.evaluate(() => (document.getElementById('alMsg') || {}).textContent || ''); if (/files saved/.test(t)) return t; await delay(250); } return ''; };
  const fmt = b => (b / 1048576).toFixed(1) + ' MB';
  const OLD = [];
  for (const [rig, opts, tkey] of [['phone', PHONE, 'p'], ['desktop', DESK, 'h']]) {
    const S = await open(opts), P = await plan(S.pg);
    const wantTier = new Set(), wantOrig = new Set();
    for (const u of P.clipU) { const e = T[u.split('?')[0]]; if (e && e[tkey]) wantTier.add(e[tkey][0]); else wantOrig.add(u); }
    for (const u of P.keepU.concat(P.other)) wantOrig.add(u);
    const L = new Set(P.urls), listedOrigOfTier = P.urls.filter(u => { const e = T[u.split('?')[0]]; return e && e[tkey] && !wantOrig.has(u); });
    ck(rig + ': tier ' + P.tier + ' - every battle sheet is listed as the file this device loads (' + wantTier.size + ' tier files), no original it no longer loads (' + listedOrigOfTier.length + ')',
      P.tier === (rig === 'phone' ? 'phone' : 'high') && [...wantTier].every(u => L.has(u)) && listedOrigOfTier.length === 0 && P.urls.length > 800, listedOrigOfTier.slice(0, 3).join(' '));
    const st = await Promise.all(P.urls.map(u => fetch(base + u).then(r => { r.body && r.body.cancel && r.body.cancel(); return r.status; }, () => 0)));
    ck(rig + ': every listed URL answers 200 and none is a file removed in v1154 (' + RET.length + ' retired)', st.every(s => s === 200) && !P.urls.some(u => RET.includes(u.split('?')[0].slice(1))), P.urls.filter((u, i) => st[i] !== 200).slice(0, 3).join(' '));
    const T0 = P.urls.reduce((a, u) => a + (sizes[u.split('?')[0]] || 0), 0);
    const c0 = await card(S.pg);
    ck(rig + ': fresh card = "' + c0 + '" (the list: ' + P.urls.length + ' files, ' + fmt(T0) + ')', c0.indexOf(' of ' + P.urls.length + ' files saved') > 0 && c0.endsWith(' of ' + fmt(T0)));
    console.log('  info ' + rig + ': saves ' + P.urls.length + ' files, ' + fmt(T0));
    if (rig === 'phone') {
      // the old v1153 list, from the BASE page on this phone (CONTROL: it lists no tier file, and its card is the storage estimate)
      const html = cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
      const B = await open(Object.assign({}, PHONE, { serviceWorkers: 'block' }), html)   /* v1157: no SW - on a tree past BASE the newer sw.js swaps the BASE page for the current one */, BP = await plan(B.pg), bc = await card(B.pg);
      OLD.push(...BP.urls);
      const oldT = BP.urls.reduce((a, u) => a + (sizes[u.split('?')[0]] || 0), 0);
      ck('CONTROL: the BASE page lists ' + BP.urls.filter(u => /_[pt]1141\./.test(u)).length + ' tier files and its card ("' + bc + '") is not the list\'s bytes (' + fmt(oldT) + ')', !BP.urls.some(u => /_[pt]1141\./.test(u)) && bc.indexOf(fmt(oldT)) < 0);
      console.log('  info BASE: saves ' + BP.urls.length + ' files, ' + fmt(oldT));
      await B.ctx.close();
    }
    // a device that saved the OLD set: real files, keyed like an old run
    await S.pg.evaluate(async L0 => { const c = await caches.open(ASSET_CACHE_NAME); const q = L0.slice();
      await Promise.all(Array.from({ length: 6 }, async () => { while (q.length) { const u = q.shift(); const r = await fetch(u, { cache: 'no-store' }); if (r.ok) await c.put(new URL(u, location.origin).href, r); } })); }, OLD);
    const P1 = await plan(S.pg);
    /* v1157: 'replaced' = an old URL whose PATH this device still wants (a new ?v=) or an original it now loads through a tier file - the v577 rule. A file whose path left the game (the v1155 slim's superseded sheets) is not touched by the plan, as for every renamed sheet before it. */
    const LP = new Set(P.urls.map(u => u.split('?')[0])), replaced = OLD.filter(u => { const q = u.split('?')[0]; return !L.has(u) && (LP.has(q) || !!(T[q] && T[q][tkey])); }).length;
    ck(rig + ': old-set device - ' + P1.cached + ' saved, ' + P1.missing + ' to fetch (the tier files), ' + P1.stale + ' replaced originals to clear',
      P1.missing <= P.urls.filter(u => !OLD.includes(u)).length && P1.missing > 0 && P1.stale === replaced && P1.stale <= Math.floor((P1.cached + P1.stale) * 0.25));
    const R = await S.pg.evaluate(() => downloadAllAssets());
    const P2 = await plan(S.pg);
    const held = await S.pg.evaluate(async U => { const c = await caches.open(ASSET_CACHE_NAME); let b = 0, n = 0; for (const u of U) { const r = await c.match(new URL(u, location.origin).href); if (r) { b += (await r.blob()).size; n++; } } return { b, n }; }, P.urls);
    await S.pg.evaluate(() => show('home')); await delay(300); const c2 = await card(S.pg);
    ck(rig + ': after the download ' + R.done + ' fetched, ' + R.dropped + ' cleared; card "' + c2 + '" = ' + held.n + ' files, ' + fmt(held.b) + ' really in the cache',
      R.failed === 0 && R.dropped === replaced && P2.missing === 0 && P2.stale === 0 && held.n === P.urls.length && held.b === T0 && c2.startsWith(P.urls.length + ' of ' + P.urls.length + ' files saved') && c2.endsWith(fmt(T0) + ' of ' + fmt(T0)));
    const seen = []; S.pg.on('response', r => { if (/\/assets\/anim\//.test(r.url())) seen.push([r.status(), r.url()]); });
    await S.pg.evaluate(() => show('home'));
    S.bad.length = 0;   /* v1157: the fight's own requests - the old-set fill above fetched v1153 URLs, and files the slim retired answer 404 there by design */
    await S.pg.evaluate(() => { const A = ['carn', 'aureth', 'sylthaine', 'maren', 'orryn']; G.team = A.slice(); CUR = { mode: 'arena', seed: 9 }; startVersus(['zahri', 'seyla', 'vex', 'lysara', 'mirelle'].map(k => ({ key: k, level: 30, rank: 3 })), true, A); });
    for (let i = 0; i < 240; i++) { if (await S.pg.evaluate(() => state === 'battle' && units.length > 0)) break; await delay(250); }
    await delay(5000);
    const inBattle = await S.pg.evaluate(() => state === 'battle' && units.length === 10);
    ck(rig + ': then a fight with Carn + Aureth loads ' + seen.length + ' sheets, none failing, no page error, no asset 4xx', inBattle && seen.length > 20 && seen.every(s => s[0] === 200) && S.errs.length === 0 && S.bad.length === 0,
      JSON.stringify({ inBattle, bad: S.bad.slice(0, 3), errs: S.errs.slice(0, 2) }));
    try { await S.pg.evaluate(() => { try { SND.ctx && SND.ctx.close(); } catch (e) {} }); } catch (e) {}
    await S.ctx.close();
  }
} catch (e) { ck('test crashed', false, String(e && e.stack || e)); }
finally { try { await browser.close(); } catch (e) {} try { srv.kill(); } catch (e) {} }
console.log((fail ? 'FAIL ' : 'PASS ') + (pass + fail) + ' checks, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
})();
