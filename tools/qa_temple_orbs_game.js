// Isolated local-game visual QA. Start server.js with a temporary DB_FILE before running.
const path = require('path');
const { chromium } = require('playwright');

const out = process.argv[2];
const base = process.argv[3] || 'http://127.0.0.1:18080/play';
if (!out) throw new Error('Pass an output directory');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3 });
  await page.goto(base);
  await page.getByText('Skip Tutorial', { exact: true }).click();
  await page.locator('#splashPlay').click();
  const file = (name) => path.join(out, name);
  const crop = async (locator, name) => {
    const box = await locator.boundingBox();
    const pad = 22;
    await page.screenshot({ path: file(name), clip: {
      x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
      width: Math.min(844 - Math.max(0, box.x - pad), box.width + pad * 2),
      height: Math.min(390 - Math.max(0, box.y - pad), box.height + pad * 2),
    } });
  };
  const inspect = async (scope, count, label) => {
    const orb = scope.locator('.tOrbs .tOrb').first();
    const box = await orb.boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const hit = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el && { tag: el.tagName, className: el.className, id: el.id, text: (el.textContent || '').trim().slice(0, 50) };
    }, { x: cx, y: cy });
    console.log(JSON.stringify({ label, count, topOrb: box, elementFromPoint: hit }));
  };

  for (const count of [2, 5]) {
    await page.evaluate(n => { DEV.orbPreview = n; show('heroesPanel'); }, count);
    const tile = page.locator('.hero-card[data-hero-key="vael"]');
    await tile.scrollIntoViewIfNeeded();
    await page.screenshot({ path: file(`orbs-game-roster-${count}of5-844x390-dsf3.png`) });
    await crop(tile, `orbs-game-roster-crop-${count}of5-844x390-dsf3.png`);
    await inspect(tile, count, 'roster');

    await page.locator('#rcp_vael').click();
    const detail = page.locator('#heroDetail');
    const detailOrb = detail.locator('.tOrbs').last();
    await detailOrb.scrollIntoViewIfNeeded();
    await page.screenshot({ path: file(`orbs-game-hero-${count}of5-844x390-dsf3.png`) });
    const detailCard = detailOrb.locator('..');
    await crop(detailCard, `orbs-game-hero-crop-${count}of5-844x390-dsf3.png`);
    await inspect(detailCard, count, 'hero');
  }
  await page.evaluate(() => { DEV.orbPreview = 5; show('home'); });
  await page.screenshot({ path: file('orbs-game-hub-5of5-844x390-dsf3.png') });
  console.log(JSON.stringify({ label: 'hub', visibleOrbs: await page.locator('#home .tOrbs:visible').count() }));
  await page.evaluate(() => { CUR.mode = 'campaign'; CUR.node = 1; teamCtx = 'campaign'; show('menu'); });
  const teamCard = page.locator('#roster .hero-card').first();
  await teamCard.scrollIntoViewIfNeeded();
  await page.screenshot({ path: file('orbs-game-team-picker-5of5-844x390-dsf3.png') });
  await crop(teamCard, 'orbs-game-team-picker-crop-5of5-844x390-dsf3.png');
  console.log(JSON.stringify({ label: 'team-picker', visibleOrbs: await page.locator('#roster .tOrbs:visible').count() }));
  await page.evaluate(() => showBattleLoader({ mine: ['vael', 'vireo', 'sylthaine'] }));
  await page.waitForTimeout(350);
  const loaderCard = page.locator('#battleLoader .bl-card.ally').first();
  await page.screenshot({ path: file('orbs-game-battle-loader-5of5-844x390-dsf3.png') });
  await crop(loaderCard, 'orbs-game-battle-loader-crop-5of5-844x390-dsf3.png');
  console.log(JSON.stringify({ label: 'battle-loader', visibleOrbs: await page.locator('#battleLoader .tOrbs:visible').count() }));
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
