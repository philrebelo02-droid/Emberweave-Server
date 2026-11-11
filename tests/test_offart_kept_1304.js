/* v1304 (Phil 7 Nov, Settings > Storage: "Download new art to this device? 1667 new of 1667" / "Download is bugged" / "It lets me download
   what I already have"): a file the device refused to keep (cache.put throwing - storage full, the browser saying no) was swallowed and
   counted as saved, so the bar filled, nothing was kept, and the next visit offered the whole library again. Now a refused write is a FAILED
   file, the result checks what the device really kept, the player is told why, and the refusal reaches the boot-step log.
   Real server (temp DB) + real page (Chromium); the library is cut to 6 files. CONTROL: TP_ROOT=<a pre-v1304 checkout> must FAIL. */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.TP_ROOT || path.join(__dirname, '..'), control = !!process.env.TP_ROOT;
let pass = 0, fail = 0; const ck = (m, c, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 300) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-oa1304-')); let srv = null, browser = null; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  try {
    const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), RL_MUL: '1000', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    for(const _t0=Date.now();Date.now()-_t0<60000&&!(srv&&srv.exitCode!==null);) { try { if ((await fetch(base + '/api/health')).ok) break; } catch (_) {} await delay(100); }   /* 11 Nov: a 60 s deadline, not an iteration count */
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const pg = await (await browser.newContext({ viewport: { width: 1000, height: 462 }, serviceWorkers: 'block' })).newPage();
    const steps = []; pg.on('request', r => { if (/\/api\/boot-step/.test(r.url())) steps.push(r.postData() || ''); });
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof downloadAllAssets === 'function' && typeof assetCachePlan === 'function', null, { timeout: 90000 }); await delay(1500);
    const A = await pg.evaluate(async () => {
      await caches.delete(ASSET_CACHE_NAME); const six = allAssetUrls().slice(0, 6); window.allAssetUrls = () => six.slice();
      const realPut = Cache.prototype.put; Cache.prototype.put = function () { return Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError')); };
      let r; try { r = await downloadAllAssets(); } finally { Cache.prototype.put = realPut; }
      const plan = await assetCachePlan(); return { r, missingAfter: plan.missing.length };
    });
    ck('a refused write is counted as FAILED, not saved (6 of 6)', A.r.failed === 6 && A.r.putFail === 6, JSON.stringify(A.r));
    ck('the result names why (QuotaExceededError) and how many the device really kept (0)', /Quota/.test(A.r.putErr || '') && A.r.kept === 0, JSON.stringify({ putErr: A.r.putErr, kept: A.r.kept }));
    ck('the device really kept nothing (all 6 still missing)', A.missingAfter === 6, A.missingAfter);
    const msg = await pg.evaluate(() => t('offart.device_refused', { n: 6, total: 6, why: 'QuotaExceededError', kept: 0, lib: 6 }));
    ck('the player is told: the device did not keep them, and to free space', /did not keep 6 of 6/.test(msg) && /free some space/.test(msg), msg);
    await delay(800);
    ck('the refusal reaches the boot-step log (err-offart)', steps.some(s => /err-offart/.test(s) && /Quota/.test(s)), steps.join(' | ').slice(0, 300));
    const B = await pg.evaluate(async () => { const r = await downloadAllAssets(); const plan = await assetCachePlan(); return { r, missingAfter: plan.missing.length, cached: plan.cached }; });
    ck('a normal download keeps every file (6 of 6 saved, 0 failed)', B.r.failed === 0 && B.r.kept === 6 && B.cached === 6, JSON.stringify(B.r));
    ck('...and the next check offers NOTHING to download again', B.missingAfter === 0, B.missingAfter);
  } catch (e) { fail++; console.log('  FAIL run: ' + (e.stack || e)); }
  finally { try { if (browser) await browser.close(); } catch (_) {} if (srv) srv.kill(); }
  console.log((control ? 'CONTROL ' : '') + pass + ' passed, ' + fail + ' failed');
  if (control) process.exit(fail > 0 ? 0 : 1);
  process.exit(fail ? 1 : 0);
})();
