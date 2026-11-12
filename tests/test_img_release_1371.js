// v1371 memory (MEMORY BY MODE 11NOV2026, "Still open": renderer +30 MB a fight with the GPU clean, DOM <img> count 38 -> 200 over a
// 10-fight campaign soak). The screens the hub hides kept their last render (campaign map, squad roster, result screen, closed stage card,
// battle portrait bar), so each fight left its hero cards, reward tiles and star/lock icons in the page with their decoded images.
// On the hub releaseHiddenScreenImgs() empties them; each is rebuilt from scratch when its screen opens.
// Real DOM: the page's own markup (scripts stripped) in one headless Chromium, the function taken from the page text.
// Fails on f1f78a3e (no release), passes patched.
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n); } };
const src = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const fnOf = (name) => { const i = src.indexOf('function ' + name + '('); return i < 0 ? '' : src.slice(i, src.indexOf('\nfunction ', i + 20)); };

(async () => {
  const a = src.indexOf('const HIDDEN_SCREEN_ART='), b = a < 0 ? -1 : src.indexOf('\nfunction fmtMB', a);
  ck('the page has the hidden-screen image release', a > 0 && b > a);
  const sh = fnOf('_showScreen');
  ck('the hub runs it with the battle-art release', sh.indexOf("if(name==='home') setTimeout(()=>{ try{ evictBattleArtAll(); }catch(e){} try{ releaseHiddenScreenImgs(); }catch(e){} },0);") >= 0);
  /* every emptied container is rebuilt by its screen, so nothing shown changes */
  ck('the campaign map is rebuilt on open (renderRoadmap)', /map\.innerHTML=/.test(fnOf('renderRoadmap')) && /hdr\.innerHTML=/.test(fnOf('renderRoadmap')) && sh.indexOf('renderRoadmap();') > 0);
  ck('the roster is rebuilt on open (renderRoster)', fnOf('renderRoster').indexOf("r.innerHTML='';") > 0 && sh.indexOf('renderRoster();') > 0);
  ck('the result squad + stars are rebuilt on open (renderResultExtras)', /squad\.innerHTML=/.test(fnOf('renderResultExtras')) && /stars\.innerHTML=/.test(fnOf('renderResultExtras')) && sh.indexOf('renderResultExtras();') > 0);
  ck('the star track + portal tabs are rebuilt with the map', /el\.innerHTML=/.test(fnOf('renderStarTrack')) && fnOf('renderRoadmap').indexOf('renderStarTrack();') > 0 && fnOf('renderRoadmap').indexOf('renderPortalTabs();') > 0);
  ck('the portrait bar is rebuilt at battle start (buildPortraitBar)', fnOf('buildPortraitBar').indexOf("bar.innerHTML='';") > 0);
  ck('the stage card is rebuilt on open (openStageModal)', /body\.innerHTML=/.test(fnOf('openStageModal')));
  if (!(a > 0 && b > a)) { console.log('test_img_release_1371.js: ' + P + ' passed, ' + F + ' failed'); process.exit(1); }

  const code = src.slice(a, b);
  const markup = src.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
  const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
  const browser = await chromium.launch({ headless: true, args: ['--disable-audio-output'] });
  try {
    const page = await browser.newPage();
    await page.route('**/*', r => r.abort());
    await page.setContent(markup, { waitUntil: 'domcontentloaded' });
    const R = await page.evaluate((code) => {
      (0, eval)(code.replace('const HIDDEN_SCREEN_ART=', 'window.HIDDEN_SCREEN_ART=') + '\nwindow.releaseHiddenScreenImgs=releaseHiddenScreenImgs;');
      const IMG = '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">';
      const ids = window.HIDDEN_SCREEN_ART;
      /* #starTrack is made by renderStarTrack the first time the campaign opens, in front of #cmapHdr - made the same way here */
      if (!document.getElementById('starTrack')) { const h = document.getElementById('cmapHdr'), el = document.createElement('div'); el.id = 'starTrack'; h.parentNode.insertBefore(el, h); }
      const fill = () => { for (const id of ids) { const e = document.getElementById(id); if (e) e.innerHTML = IMG + IMG + '<div>' + IMG + '</div>'; } };
      const count = () => ids.reduce((n, id) => { const e = document.getElementById(id); return n + (e ? e.getElementsByTagName('img').length : 0); }, 0);
      const toHub = () => { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById('home').classList.add('active');
        document.getElementById('stageModal').classList.remove('active'); window.state = 'home'; window.ED = { active: false }; window.OL = { active: false }; window.GSPLIT = { active: false }; };
      const out = { missing: ids.filter(id => !document.getElementById(id)) };
      const mark = document.createElement('div'); mark.id = 'hubMark'; mark.innerHTML = IMG; document.getElementById('home').appendChild(mark);
      toHub(); fill(); out.filled = count(); out.released = releaseHiddenScreenImgs(); out.afterHub = count();
      out.hubKept = document.querySelectorAll('#hubMark img').length;
      fill(); window.state = 'campaign'; document.getElementById('home').classList.remove('active'); document.getElementById('campaign').classList.add('active');
      out.offHub = releaseHiddenScreenImgs(); out.offHubKept = count();
      toHub(); fill(); document.getElementById('stageModal').classList.add('active'); releaseHiddenScreenImgs();
      out.openCardKept = document.getElementById('stageModalBody').getElementsByTagName('img').length; out.openCardOthers = count() - out.openCardKept;
      toHub(); fill(); window.ED = { active: true }; out.edKept = (releaseHiddenScreenImgs(), count());
      toHub(); fill(); window.OL = { active: true }; out.olKept = (releaseHiddenScreenImgs(), count());
      return out; }, code);
    const N = 3 * (12 - R.missing.length);
    ck('every listed container is in the page markup (' + R.missing.join(',') + ')', R.missing.length === 0);
    ck('on the hub every hidden screen\'s images are released (' + R.filled + ' -> ' + R.afterHub + ', reported ' + R.released + ')', R.filled === N && R.afterHub === 0 && R.released === N);
    ck('the hub\'s own images are untouched (' + R.hubKept + ')', R.hubKept === 1);
    ck('nothing is released off the hub (state campaign: ' + R.offHub + ' released, ' + R.offHubKept + ' kept)', R.offHub === 0 && R.offHubKept === N);
    ck('an open stage card keeps its images, the rest go (' + R.openCardKept + ' kept, ' + R.openCardOthers + ' others left)', R.openCardKept === 3 && R.openCardOthers === 0);
    ck('a live Emberdraft / online match keeps everything (' + R.edKept + ', ' + R.olKept + ')', R.edKept === N && R.olKept === N);
  } finally { await browser.close(); }
  console.log('test_img_release_1371.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
})().catch(e => { console.log('  FAIL ' + (e && e.message || e)); console.log('test_img_release_1371.js: ' + P + ' passed, ' + (F + 1) + ' failed'); process.exit(1); });
