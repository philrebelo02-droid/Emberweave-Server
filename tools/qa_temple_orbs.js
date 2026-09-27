// Local visual QA for Phil's five left-edge Temple sockets; no game server required.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const asData = (p, mime = 'image/png') => `data:${mime};base64,${fs.readFileSync(path.join(root, p)).toString('base64')}`;
const lit = asData('assets/img/temple/card-orb-lit-v2.webp', 'image/webp');
const unlit = asData('assets/img/temple/card-orb-unlit-v2.webp', 'image/webp');
const portrait = asData('assets/img/hero-portraits/hero-vael.png');
const card = (size, count) => {
  const slot = (index, big = false) => `<span class="tOrb${big ? ' c' : ''}${count >= index ? ' lit' : ''}"></span>`;
  return `<div class="sample"><div class="card" style="width:${size}px;height:${size}px"><img src="${portrait}"><div class="tOrbs">${slot(1)}${slot(2)}${slot(5, true)}${slot(3)}${slot(4)}</div></div><div class="label">${size}px · ${count}/5 earned</div></div>`;
};
const phone = process.argv.includes('--phone');
const cards = phone ? card(240, 2) + card(104, 5) :
  card(240, 0) + card(240, 2) + card(240, 4) + card(240, 5) + card(104, 0) + card(104, 2) + card(104, 5);
const html = `<!doctype html><html><head><style>
body{margin:0;padding:${phone ? 12 : 44}px;background:#111827;color:#ddd;font:12px Arial;display:flex;flex-wrap:wrap;gap:${phone ? 12 : 46}px;align-items:flex-start}
.sample{text-align:center}.card{position:relative;border:2px solid #8a6a36;border-radius:10px;background:#152033;container-type:inline-size}
.card>img{width:100%;height:100%;object-fit:cover;border-radius:8px}
.label{margin-top:12px}.tOrbs{position:absolute;left:0;top:50%;transform:translate(-50%,-50%);height:62%;width:26px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;pointer-events:none;z-index:5}
.tOrb{display:block;flex:0 0 auto;width:clamp(7px,9cqw,22px);aspect-ratio:1;background:url('${unlit}') center/150% 150% no-repeat;filter:drop-shadow(0 1px 2px #000b)}
.tOrb.c{width:clamp(11px,14.5cqw,35px)}.tOrb.lit{background-image:url('${lit}')}
</style></head><body>${cards}</body></html>`;

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: phone ? 390 : 1460, height: phone ? 440 : 780 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.screenshot({ path: process.argv[2] || path.join(root, 'temple-orb-qa.png'), fullPage: true });
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
