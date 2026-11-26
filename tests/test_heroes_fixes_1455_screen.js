// v1455 lockdown audit 25 Nov 2026 (Heroes Panel "Prev / next arrows"), on screen (browser - run on the cluster, never on PC 1).
// The hero window is always a pop-out (v1403); the arrows were hidden in every pop-out. In the hero window pop-out, at a phone
// landscape size, a tablet and a desktop, and in the short Talents layout (a game window 500 px tall or less), each arrow must
// show, sit inside the window, not be covered (the element under its centre is the arrow), not overlap the Heroes / X buttons,
// the name plate or the tab row, and a tap must step to another owned hero with the window still open.
// CONTROL: HF_HTML=<the v1454 page> fails (the arrows are display:none). Exit 0 = all passed.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const PAGE = process.env.HF_HTML || path.join(root, 'emberweave-heroes.html');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{}'); }
  const file = pathname === '/play' ? PAGE : path.join(root, pathname);
  if (!file.startsWith(root) && file !== PAGE) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ok   ' + m); };
const OWNED = ['vael', 'sylthaine', 'meridian', 'grosk', 'fritz', 'oakmir'];

async function measure(page) {
  return page.evaluate(() => {
    const W = document.getElementById('heroDetail'), R = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const over = (a, b) => a && b && a.w > 0 && b.w > 0 && a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
    const pick = sel => { const e = W.querySelector(sel); return e && e.offsetParent !== null ? R(e) : null; };
    const win = R(W), others = { back: pick('.backbtn'), close: pick('.popoutClose'), tabs: pick('.hd-tabbar') };
    if (W.classList.contains('tl-short')) others.plate = pick('.hd-left');
    const arrows = ['heroPrev', 'heroNext'].map(id => { const e = document.getElementById(id), r = R(e), cs = getComputedStyle(e);
      const hit = document.elementFromPoint(r.l + r.w / 2, r.t + r.h / 2);
      return { id, display: cs.display, vis: cs.visibility, r, inside: r.w > 0 && r.l >= win.l - 1 && r.r <= win.r + 1 && r.t >= win.t - 1 && r.b <= win.b + 1, top: !!(hit && hit.closest('#' + id)),
        overlaps: Object.entries(others).filter(([k, o]) => over(r, o)).map(([k]) => k), disabled: e.disabled }; });
    return { popout: W.classList.contains('popout') && W.classList.contains('active'), short: W.classList.contains('tl-short'), hero: detailHero, arrows, overlap2: over(arrows[0].r, arrows[1].r) };
  });
}

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  let shortSeen = 0;
  try {
    for (const [tag, w, h, touch] of [['phone landscape', 844, 390, true], ['tablet', 1024, 768, true], ['desktop', 1400, 900, false]]) {
      const context = await browser.newContext(Object.assign({ viewport: { width: w, height: h }, serviceWorkers: 'block' }, touch ? { hasTouch: true } : {}));
      const page = await context.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
      await page.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; try { localStorage.setItem('ew_lang', 'en'); } catch (e) {} });
      await page.goto(origin + '/play', { waitUntil: 'load' });
      await page.waitForFunction(() => typeof renderHeroDetail === 'function' && typeof popoutScreen === 'function', null, { timeout: 90000 });
      await page.evaluate(OWNED => { G.tutSkipped = true; G.tutDone = true; G.ftutOff = true; G.playerXP = 900000; document.body.classList.remove('gated');
        document.querySelectorAll('#tutOffer,#authGate,#rotateGate,#splash').forEach(n => n.remove());
        G.unlocked = G.unlocked || {}; OWNED.forEach(k => { G.unlocked[k] = true; }); G.talents = G.talents || {}; try { show('heroesPanel'); } catch (e) {} }, OWNED);
      await page.waitForTimeout(500);
      for (const tab of ['stats', 'skills', 'talents']) {
        await page.evaluate(tab => { detailHero = 'vael'; heroTab = tab; popoutScreen('heroDetail'); }, tab);
        await page.waitForTimeout(700);
        const m = await measure(page);
        if (tab === 'talents' && !m.short && h > 500) continue;   // the short layout only exists in a short game window
        if (m.short) shortSeen++;
        const where = tag + ' / ' + tab + (m.short ? ' (short Talents layout)' : '');
        ok(m.popout, where + ': the hero window is a pop-out');
        for (const a of m.arrows) {
          ok(a.display !== 'none' && a.vis !== 'hidden' && a.r.w >= 24 && a.r.h >= 24 && !a.disabled, where + ': ' + a.id + ' shows (' + a.display + ', ' + Math.round(a.r.w) + 'x' + Math.round(a.r.h) + ')');
          ok(a.inside && a.top, where + ': ' + a.id + ' sits inside the window and nothing covers it');
          ok(a.overlaps.length === 0, where + ': ' + a.id + ' clear of the Heroes / X buttons, tabs and name plate (' + (a.overlaps.join(', ') || 'none') + ')'); }
        ok(!m.overlap2, where + ': the two arrows do not overlap');
        const before = m.hero;
        await page.locator('#heroNext').click();
        await page.waitForTimeout(500);
        const after = await page.evaluate(() => ({ hero: detailHero, open: document.getElementById('heroDetail').classList.contains('popout') && document.getElementById('heroDetail').classList.contains('active') }));
        ok(after.open && after.hero !== before && OWNED.includes(after.hero), where + ': a tap on next steps ' + before + ' -> ' + after.hero + ', window still open');
        await page.locator('#heroPrev').click();
        await page.waitForTimeout(500);
        ok(await page.evaluate(b => detailHero === b, before), where + ': a tap on prev steps back to ' + before);
      }
      if (errs.length) console.log('  note ' + tag + ': page errors with the stub server (not judged): ' + errs.slice(0, 3).join(' | '));
      await context.close();
    }
    ok(shortSeen > 0, 'the short Talents layout was checked (' + shortSeen + ' time(s))');
  } finally { await browser.close(); server.close(); }
  console.log('test_heroes_fixes_1455_screen.js: ' + pass + ' checks passed');
}
main().catch(e => { console.error(e && e.stack || e); process.exit(1); });
