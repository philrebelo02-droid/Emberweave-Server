const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(path.resolve(process.argv[3], 'node_modules/playwright'));
const html = fs.readFileSync(path.join(process.argv[2], 'emberweave-heroes.html'), 'utf8');
const start = html.search(/^let _tapSwallowUntil|^const _tapClickUntil/m);
const code = html.slice(start, html.indexOf('let rosterClassF', start));
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({hasTouch:true, isMobile:true, viewport:{width:844,height:390}});
    await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><button id="open" style="position:fixed;left:360px;top:160px;width:120px;height:60px">Open</button>');
    await page.addScriptTag({content:code});
    await page.evaluate(() => {
      wireTap(document.getElementById('open'), () => {
        const overlay = document.createElement('div');
        overlay.id = 'test-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:#aaa';
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);
      });
    });
    for (let trial = 0; trial < 3; trial++) {
      await page.waitForTimeout(700);
      await page.touchscreen.tap(420,190);
      await page.waitForTimeout(700);
      assert.equal(await page.locator('#test-overlay').count(), 1, 'trailing touch click leaves overlay open');
      await page.touchscreen.tap(100,100);
      assert.equal(await page.locator('#test-overlay').count(), 0, 'deliberate backdrop tap closes overlay');
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
