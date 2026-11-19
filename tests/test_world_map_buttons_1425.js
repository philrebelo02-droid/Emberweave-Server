'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8');
const locales = Object.keys(JSON.parse(html.match(/const EW_LANG_V=(\{[^\n]+?\});/)[1]));
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{}');
  }
  const file = path.join(root, pathname === '/play' ? 'emberweave-heroes.html' : pathname);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

async function checkRow(page, dictionary, active, tag) {
  const actual = await page.locator('.wmhud-top').evaluate(bar => {
    const zoneText = [...bar.querySelectorAll('.wmhud-zone-copy > *')];
    const rect = bar.getBoundingClientRect();
    const controls = [...bar.querySelectorAll('button')].map(button => {
      const box = button.getBoundingClientRect();
      const icon = button.querySelector('img');
      // A point below the painted 26px frame is still inside the real button.
      const hit = document.elementFromPoint(box.x + box.width / 2, box.bottom - 2);
      return {
        id: button.id, label: button.querySelector('.wmhud-label').textContent,
        count: button.querySelector('.wmhud-count')?.textContent, name: button.getAttribute('aria-label'),
        width: box.width, height: box.height, y: box.top, right: box.right, left: box.left,
        icon: icon?.complete && icon.naturalWidth > 0, hit: hit?.closest('button') === button,
        frame: getComputedStyle(button, '::before').borderImageSource,
      };
    });
    return { controls, left: rect.left, right: rect.right, viewport: innerWidth, zoneFits: zoneText.every(item => item.scrollWidth <= item.clientWidth) };
  });
  const { teleport, shielded } = active;
  const keys = {
    wmCity: 'wover.city', wmBack: 'nav.base', wbInfo: 'march.marches',
    wbTele: teleport ? 'common.cancel' : 'wover.teleport', wbGrid: 'wover.grid', wbShield: 'wover.shield',
  };
  assert.deepEqual(actual.controls.map(button => button.id), Object.keys(keys), tag);
  assert.ok(actual.left >= 0 && actual.right <= actual.viewport && actual.zoneFits, JSON.stringify({ tag, actual }));
  for (const [index, button] of actual.controls.entries()) {
    assert.equal(button.label, dictionary[keys[button.id]], tag + ' ' + button.id);
    assert.ok(button.name.startsWith(button.label) && button.icon && button.hit, JSON.stringify({ tag, button }));
    assert.match(button.frame, /hud-panel\.webp/);
    assert.ok(button.width >= 40 && button.height >= 40 && button.y === actual.controls[0].y, JSON.stringify({ tag, button }));
    if (index) assert.ok(button.left >= actual.controls[index - 1].right, tag + ' buttons overlap');
  }
  const tele = actual.controls.find(button => button.id === 'wbTele');
  const shield = actual.controls.find(button => button.id === 'wbShield');
  assert.equal(tele.count, teleport ? undefined : '108(0)');
  if (shielded) assert.match(shield.count, /^\d{2,}:\d{2}:\d{2}$/);
  else assert.equal(shield.count, '12');
  console.log(tag + ' passed · ' + Math.ceil(actual.right - actual.left) + 'px');
}

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.addInitScript(() => {
      window.AudioContext = undefined;
      window.webkitAudioContext = undefined;
    });
    await page.goto(origin + '/play', { waitUntil: 'load' });
    await page.evaluate(() => {
      G.playerXP = 900000;
      G.tutSkipped = true;
      G.ftutOff = true;
      document.body.classList.remove('gated');
      document.querySelectorAll('#tutOffer,#authGate,#rotateGate,#splash').forEach(node => node.remove());
      ACC.token = _worldServerAccount = 'local-map-test';
      G.castleX = null;
      G.castleY = null;
      G.shieldUntil = 0;
      G.beginnerBroken = true;
      G.shieldItems = 12;
      G.teleScrolls = 108;
      G.showGrid = true;
      teleportsLeft = () => 0;
      show('world');
    });
    const render = async (locale, options) => {
      await page.evaluate(async ({ locale, options }) => {
        if (LANG.cur !== locale) await langLoad(locale, false);
        _teleMode = options.teleport;
        G.shieldUntil = options.shielded ? Date.now() + 23.5 * 3600000 : 0;
        if (options.tree) myCastleZone = () => 'worldtree';
        else myCastleZone = () => zoneOfPos(myCastlePos().x, myCastlePos().y);
        renderWorldMap(true);
        await document.fonts.ready;
        await Promise.all([...document.querySelectorAll('.wmhud-top img')].map(image => image.decode()));
      }, { locale, options });
      const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'lang', locale + '.json'), 'utf8'));
      const tag = locale + ' · ' + options.label;
      await checkRow(page, dictionary, options, tag);
      if (process.env.EW_MAP_SHOTS && ['en', 'de', 'hi'].includes(locale) && options.teleport === options.shielded) {
        fs.mkdirSync(process.env.EW_MAP_SHOTS, { recursive: true });
        await page.screenshot({ path: path.join(process.env.EW_MAP_SHOTS, locale + (options.teleport ? '-active' : '') + '.png') });
      }
    };
    assert.equal(locales.length, 16, 'English and all 15 translated languages');
    for (const locale of locales) {
      await render(locale, { label: 'region / idle', tree: false, teleport: false, shielded: false });
      await render(locale, { label: 'World Tree / active shield', tree: true, teleport: false, shielded: true });
      await render(locale, { label: 'World Tree / targeting', tree: true, teleport: true, shielded: true });
    }

    await page.locator('#wbTele').tap();
    await page.waitForFunction(() => !_teleMode);
    await page.locator('#wbTele').tap();
    assert.ok(await page.locator('#telePopout').isVisible());
    await page.locator('#tpClose').tap();
    const grid = page.locator('#wbGrid');
    assert.equal(await grid.getAttribute('aria-pressed'), 'true');
    await grid.tap();
    assert.equal(await grid.getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('.wmGridOverlay').count(), 0);
    await grid.tap();
    assert.equal(await grid.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.wmGridOverlay').count(), 1);
    await page.evaluate(() => {
      window.mapActions = {};
      for (const [name, fn] of Object.entries({ openMarchInfo, openShield, centerOnCastle })) {
        window[name] = (...args) => {
          window.mapActions[name] = (window.mapActions[name] || 0) + 1;
          return fn(...args);
        };
      }
      renderWorldMap(true);
    });
    await page.locator('#wmBack').tap();
    await page.locator('#wbInfo').tap();
    const modal = page.locator('.gmodal-ov');
    assert.ok(await modal.isVisible());
    await modal.locator('button').first().tap();
    await page.locator('#wbShield').tap();
    assert.ok(await modal.isVisible());
    await modal.locator('button').first().tap();
    assert.deepEqual(await page.evaluate(() => window.mapActions), { centerOnCastle: 1, openMarchInfo: 1, openShield: 1 });
    await page.locator('#wmCity').tap();
    assert.ok(await page.locator('#home.active').isVisible());
    console.log('All six world map controls passed their action checks.');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => server.close());
