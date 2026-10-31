'use strict';
// v1231 MAP NEVER JUMPS (Phil 30 Oct 2026: "sometimes in map it will randomly bounce my screen to the middle of no where, find out why").
// A real server + the real client (Chromium, phone landscape 844 x 390). The page's #wzone scrollLeft / scrollTop setters are wrapped
// (every write logged with its stack) and the view centre is sampled in WORLD coordinates every 50 ms. Then we play like Phil: zoom in
// on the castle, drag-pan, wheel-zoom, let city refreshes land (idle, mid-drag, mid-pinch), open and close a castle menu, toggle the
// grid, start a mine march, leave the map for the city and come back after a refresh landed while away, rotate the phone and back.
// FAIL: any change of the view centre over 2 squares (or of the zoom) that no input of ours asked for.
// Control: the same script on the tree before the fix (CONTROL_SHA) must find at least one such jump.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const R = require('./helpers/split-rig.cjs');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CONTROL = process.env.MAPJUMP_CONTROL || '53c8110b';
const ONLY_THIS = process.argv.includes('--this');

const INSTRUMENT = () => {
  const L = window.__mj = { writes: [], samples: [], jumps: [], user: 0, userTag: '', on: false, last: null };
  const now = () => performance.now();
  for (const prop of ['scrollLeft', 'scrollTop']) {
    const d = Object.getOwnPropertyDescriptor(Element.prototype, prop);
    Object.defineProperty(Element.prototype, prop, { configurable: true, get: d.get, set(v) {
      if (this.id === 'wzone' && L.on) { const from = d.get.call(this); d.set.call(this, v); const to = d.get.call(this);
        if (Math.abs(to - from) > 1) L.writes.push({ t: Math.round(now()), prop, from: Math.round(from), to: Math.round(to), connected: this.isConnected, user: L.user > now(), tag: L.userTag, stack: (new Error().stack || '').split('\n').slice(2, 9).map(s => s.trim()).join(' < ') }); return; }
      d.set.call(this, v); } });
  }
  // a user input marks the next 250 ms as asked-for (drag, wheel, pinch, button taps, screen changes we make)
  const mark = tag => { L.user = now() + 250; L.userTag = tag; };
  for (const ev of ['mousedown', 'mousemove', 'mouseup', 'wheel', 'touchstart', 'touchmove', 'touchend', 'click', 'keydown'])
    document.addEventListener(ev, e => { if (ev === 'mousemove' && !e.buttons) return; mark(ev); }, { capture: true, passive: true });
  window.__mjMark = mark;
  L.hidden = [];
  const wrap = () => { if (typeof window.renderWorldMap !== 'function' || window.renderWorldMap.__mj) return; const orig = window.renderWorldMap;
    window.renderWorldMap = function (keep) { const z = document.getElementById('wzone');
      if (L.on && z && !z.clientWidth) L.hidden.push({ keep: !!keep, stack: (new Error().stack || '').split('\n').slice(2, 6).map(x => x.trim()).join(' < ') });
      return orig.apply(this, arguments); }; window.renderWorldMap.__mj = true; };
  document.addEventListener('DOMContentLoaded', wrap); window.addEventListener('load', wrap);
  setInterval(() => { if (!L.on) return; const zone = document.getElementById('wzone');
    if (!zone || !zone.clientWidth || typeof wzLeft !== 'function') { L.last = null; return; }
    const sq = WORLD_W / GRID_COLS, cx = (wzLeft(zone) + zone.clientWidth / 2 / worldZoom) / sq, cy = (wzTop(zone) + zone.clientHeight / 2 / worldZoom) / sq;
    const s = { t: Math.round(now()), cx: +cx.toFixed(2), cy: +cy.toFixed(2), z: +worldZoom.toFixed(4), w: zone.clientWidth, h: zone.clientHeight };
    const p = L.last; L.last = s;
    if (p && !(L.user > now()) && p.w === s.w && p.h === s.h) {
      const d = Math.hypot(s.cx - p.cx, s.cy - p.cy);
      if (d > 2 || Math.abs(s.z - p.z) > 1e-4) L.jumps.push({ t: s.t, from: [p.cx, p.cy, p.z], to: [s.cx, s.cy, s.z], squares: +d.toFixed(1), step: L.step || '' });
    }
  }, 50);
};

async function play(S, B, label) {
  const v = B.players[0];
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
  try {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
    const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(INSTRUMENT);
    await page.goto(S.base + '/play', { waitUntil: 'domcontentloaded' });
    await page.evaluate(token => { ACC.token = token; G.playerXP = 900000; }, v.token);
    if (await page.locator('#tutSkip').isVisible()) await page.locator('#tutSkip').click();
    await page.locator('#splashPlay').click();
    await page.waitForFunction(() => document.getElementById('rotateGate')?.style.display === 'none', null, { timeout: 15000 });
    await page.evaluate(token => { ACC.token = token; G.tutSkipped = true; document.querySelectorAll('#tutOffer').forEach(n => n.remove()); show('world'); }, v.token);
    await page.waitForFunction(() => _worldServerAccount === ACC.token && document.getElementById('wzoneInner'), null, { timeout: 15000 });
    await page.evaluate(() => document.querySelectorAll('#tutOffer').forEach(n => n.remove()));
    await page.waitForTimeout(800);
    const step = async (name, fn, wait) => { await page.evaluate(n => { __mj.step = n; }, name); await fn(); await page.waitForTimeout(wait == null ? 900 : wait); if (process.env.MJ_DEBUG) console.log('   after ' + name + ': ' + await page.evaluate(() => state + ' ' + JSON.stringify(__mj.last))); };
    const box = await page.locator('#wzone').boundingBox();
    const mx = box.x + box.width / 2, my = box.y + box.height / 2, sx = box.x + box.width * 0.3, sy = box.y + box.height * 0.62;   // drags start off your castle (a tap on it goes home)
    const drag = async (dx, dy, mid) => { await page.mouse.move(sx, sy); await page.mouse.down();
      for (let i = 1; i <= 10; i++) { await page.mouse.move(sx + dx * i / 10, sy + dy * i / 10); await page.waitForTimeout(30); if (i === 5 && mid) { await mid(); await page.waitForTimeout(120); } }
      await page.mouse.up(); };
    const touch = async (type, pts) => { await page.evaluate(() => __mjMark('touch')); await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i + 1 })) }); };   // (a touch that began on a zone the rebuild replaced never reaches document - mark it here)
    const pinch = async (spread, mid) => { let a = 60; await touch('touchStart', [[mx - a, my], [mx + a, my]]);
      for (let i = 1; i <= 8; i++) { a = 60 + spread * i / 8; await touch('touchMove', [[mx - a, my], [mx + a, my]]); await page.waitForTimeout(30); if (i === 4 && mid) { await mid(); await page.waitForTimeout(120); } }
      await touch('touchEnd', []); };
    const refresh = () => page.evaluate(() => { _rcFetchedAt = 0; return fetchRealCities(true); });   // the 60 s poll's own call
    const kept = {};   // a refresh landing mid-gesture must leave the zone under the finger alone until it lifts
    const midRefresh = name => async () => { await page.evaluate(() => { window.__mjZone = document.getElementById('wzone'); }); await refresh();
      kept[name] = await page.evaluate(() => document.getElementById('wzone') === window.__mjZone); };
    await page.evaluate(() => { __mj.on = true; });
    // zoom in on the castle (castles + mines drawn), then settle
    await step('zoom-close', () => page.evaluate(() => { __mjMark('zoom'); const c = myCastlePos(); mapZoomCloseAt(c.x, c.y); }), 1500);
    await step('drag', () => drag(-260, -90));
    await step('idle-refresh', refresh, 1200);
    await step('wheel', async () => { await page.mouse.move(mx + 80, my); await page.mouse.wheel(0, 120); await page.waitForTimeout(150); await page.mouse.wheel(0, -120); });
    await step('drag-across-tiles', () => drag(400, 150), 1500);          // new tiles -> mapViewChangedSoon -> a fetch lands after the pan
    await step('refresh-mid-drag', () => drag(-300, 60, midRefresh('drag')), 1200);
    await step('refresh-mid-pinch', () => pinch(50, midRefresh('pinch')), 1200);
    await step('castle-menu', async () => { const c = page.locator('#wzoneInner .wnode.city:not(.me)').first();
      if (await c.count()) { await page.evaluate(() => __mjMark('menu')); await c.dispatchEvent('click'); await page.waitForTimeout(500); await page.evaluate(() => { __mjMark('menu'); closeCityMenu(); }); } });
    await step('grid-toggle', async () => { if (process.env.MJ_SHOT) { await page.screenshot({ path: process.env.MJ_SHOT }); console.log('state', await page.evaluate(() => state)); } await page.locator('#wbGrid').click(); await page.waitForTimeout(600); await page.locator('#wbGrid').click(); });
    await step('mine-march', () => page.evaluate(async () => { const r = (typeof worldMines === 'function' ? worldMines() : []).find(m => mineAvailable(m)); if (r && typeof syncWorldMarches === 'function') await syncWorldMarches(true); }), 900);
    await step('march-redraw', () => page.evaluate(() => { if (typeof drawMarches === 'function') drawMarches(); }), 600);
    // where the view was before leaving, in squares
    const pos = () => page.evaluate(() => __mj.last && [__mj.last.cx, __mj.last.cy, __mj.last.z]);
    const before0 = await pos();
    await step('leave-plain', () => page.evaluate(() => { __mjMark('leave'); show('home'); }), 600);
    await step('return-plain', () => page.evaluate(() => { __mjMark('return'); show('world'); }), 1200);
    const after0 = await pos();
    const before = await pos();
    // the poll's / a pan's castle request is in flight when you tap City: its answer lands with the map hidden and rebuilds it there
    await step('leave-map', () => page.evaluate(() => { __mjMark('leave'); _rcFetchedAt = 0; const p = fetchRealCities(true); document.getElementById('wmCity').click(); return p; }), 600);
    await step('refresh-while-away', () => page.evaluate(() => { _rcFetchedAt = 0; renderWorldMap(true); }), 600);   // any other rebuild (march / shield / grid) landing while hidden
    await step('return-map', () => page.evaluate(() => { __mjMark('return'); show('world'); }), 1500);
    const after = await page.evaluate(() => __mj.last && [__mj.last.cx, __mj.last.cy, __mj.last.z]);
    // signed in again (a new token) and the map opened: "Locating your castle..." then the map
    const tok = (await S.req('POST', '/api/login', { name: v.name, pass: 'password1' }, null, v.ip)).body.token;
    const beforeSign = await pos();
    await step('re-sign-in', () => page.evaluate(t => { __mjMark('signin'); ACC.token = t; show('home'); show('world'); }, tok), 2000);
    const afterSign = await pos();
    await step('rotate', async () => { await page.evaluate(() => __mjMark('rotate')); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(700);
      await page.evaluate(() => __mjMark('rotate')); await page.setViewportSize({ width: 844, height: 390 }); }, 1200);
    const rotated = await page.evaluate(() => __mj.last && [__mj.last.cx, __mj.last.cy, __mj.last.z]);
    const L = await page.evaluate(() => ({ jumps: __mj.jumps, writes: __mj.writes.filter(w => !w.user), hidden: __mj.hidden }));
    return { label, ...L, kept, before0, after0, before, after, beforeSign, afterSign, rotated, errors };
  } finally { await browser.close(); }
}

const far = (a, b) => !a || !b || Math.hypot(a[0] - b[0], a[1] - b[1]) > 2 || Math.abs(a[2] - b[2]) > 1e-3;
function report(res) {
  console.log('  [' + res.label + '] unprompted jumps: ' + res.jumps.length);
  for (const j of res.jumps.slice(0, 12)) console.log('    ' + j.step + ': ' + j.squares + ' squares ' + JSON.stringify(j.from) + ' -> ' + JSON.stringify(j.to));
  const big = res.writes.filter(w => Math.abs(w.to - w.from) > 30 && !(w.from === 0 && /:2515\d:/.test(w.stack) && false));
  for (const w of big.slice(0, 10)) console.log('    write ' + w.prop + ' ' + w.from + '->' + w.to + (w.connected ? '' : ' (detached)') + ' @ ' + w.stack.slice(0, 400));
  for (const h of res.hidden.slice(0, 4)) console.log('    rebuilt while hidden (keepView ' + h.keep + ') @ ' + h.stack.slice(0, 300));
  console.log('    re-sign-in: ' + JSON.stringify(res.beforeSign) + ' -> ' + JSON.stringify(res.afterSign));
  console.log('    leave/return plain: ' + JSON.stringify(res.before0) + ' -> ' + JSON.stringify(res.after0)); console.log('    leave/return: ' + JSON.stringify(res.before) + ' -> ' + JSON.stringify(res.after) + '; after rotate ' + JSON.stringify(res.rotated));
}
function judge(res, ok) {
  ok(res.errors.length === 0, res.label + ': no page errors (' + res.errors.slice(0, 2).join(' | ') + ')');
  ok(res.jumps.length === 0, res.label + ': the view never moved on its own over 2 squares (' + res.jumps.length + ' jump(s)' + (res.jumps[0] ? ', first at ' + res.jumps[0].step + ' ' + res.jumps[0].squares + ' squares' : '') + ')');
  ok(res.kept.drag === true && res.kept.pinch === true, res.label + ': a refresh landing mid-drag and mid-pinch waits for the finger to lift (' + JSON.stringify(res.kept) + ')');
  ok(!far(res.before0, res.after0), res.label + ': leaving the map for the city and coming back keeps the view (' + JSON.stringify(res.before0) + ' -> ' + JSON.stringify(res.after0) + ')');
  ok(!far(res.before, res.after), res.label + ': leaving the map and coming back (a refresh landed while away) keeps the view (' + JSON.stringify(res.before) + ' -> ' + JSON.stringify(res.after) + ')');
  ok(!far(res.beforeSign, res.afterSign), res.label + ': a new sign-in with the map open keeps the view (' + JSON.stringify(res.beforeSign) + ' -> ' + JSON.stringify(res.afterSign) + ')');
  ok(!far(res.afterSign, res.rotated), res.label + ': rotating the phone and back keeps the view centre (' + JSON.stringify(res.afterSign) + ' -> ' + JSON.stringify(res.rotated) + ')');
}

function controlTree(sha) {
  const path = require('node:path'), { execFileSync } = require('node:child_process');
  const dir = path.join(R.root, '.ctl-' + sha);
  if (fs.existsSync(path.join(dir, 'server.js'))) return dir;
  fs.mkdirSync(dir, { recursive: true });
  const tar = execFileSync('git', ['archive', '--format=tar', sha, '--', '.', ':!assets'], { cwd: R.root, maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', dir.split(path.sep).join('/')], { input: tar, maxBuffer: 1 << 30 });
  fs.symlinkSync(path.join(R.root, 'assets'), path.join(dir, 'assets'), 'junction');
  return dir;
}

async function runOn(dir, tag, label) {
  const S = await R.server({ dir });
  try { const B = await R.boot(S, tag, 3); return await play(S, B, label); } finally { await S.kill(); }
}

(async () => {
  let failed = false;
  try {
    console.log('== this tree');
    const res = await runOn(R.root, 'mj', 'this tree'); report(res); judge(res, R.ok);
    if (!ONLY_THIS) {
      console.log('== control ' + CONTROL + ' (must fail)');
      const ctl = await runOn(controlTree(CONTROL), 'mc', 'control'); report(ctl);
      let ctlFails = 0; try { judge(ctl, (c, m) => assert.ok(c, m)); } catch (e) { ctlFails++; console.log('  control fails as it must: ' + e.message.slice(0, 200)); }
      R.ok(ctlFails >= 1 && far(ctl.before, ctl.after), 'CONTROL: ' + CONTROL + ' (before the fix) throws the view to ' + JSON.stringify(ctl.after) + ' after a refresh landed with the map hidden (was ' + JSON.stringify(ctl.before) + ')');
    }
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { R.removeControlTree(CONTROL); }
  console.log('test_map_no_jump.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
