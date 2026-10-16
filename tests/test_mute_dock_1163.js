/* v1163 - THE MUTE BUTTON NEVER SITS ON TOP OF OTHER UI (Phil 16 Oct 2026, on his phone: "can you make the audio button not layered
   over buttons" - v1159's spot logic only avoided clickable controls, so in the Heroes window it sat on the HEROES title plate).
   Real page (Chromium) on a real local server with a temp DB, at phone 844x390, a tall phone 915x412 (Phil's) and desktop 1920x1080.
   EVERY RIG IS SILENT: --mute-audio, and every connection to an AudioContext's destination goes through a gain of 0. SwiftShader WebGL.
   Asserts (non-zero exit on any failure):
     (1) every inline script parses
     (2) ZERO OVERLAP on every screen and window: the button's square, sampled every 2 px, shows nothing but background under it. The
         judge is this test's own (not the game's muteScan): with every element made hit-testable (pointer-events forced on, so decorative
         frames, plates, ornaments and icons are found too), elementsFromPoint at each sample point, top down to the first opaque
         window-level surface; anything there that paints - a fill, an image or icon, a border or border-image band, a text run, a
         ::before/::after - counts, unless it is the page, a screen, a floating window/overlay covering >= 40% of the viewport, the box
         the button is docked in, or a full-screen image/canvas. Screens: the sign-in gate, the hub, 28 screens (every building, the
         campaign map, team select, the Wall, Skyfall), the 8 pop-out windows, the hub menu, the profile and food-shop windows, the hero
         window, two confirms, a card modal, the glossary card, the battle and its result screen.
     (3) the button is topmost at its centre and fully on screen; on the hub it sits immediately left of the portrait as drawn (its ring
         frame), 2-12 px away, centred on it within 8 px
     (4) a window with a close X: the button is docked to that X - directly below it (or left of it), the X's size within 1 px, centred
         on it within 4 px; it lives in the X's own box, so after scrolling the window to the bottom it is still beside the X and still
         overlaps nothing; the full-screen Heroes list scrolled to the bottom: still zero overlap
     (5) a tap on the docked button mutes and unmutes (master gain 0/1, ew_mute), the window stays open and no game listener sees it
     (6) CONTROLS: the judge FAILS the button put back on the HEROES title plate (Phil's screenshot) and on a hero card; the v1162 page
         (MUTE_ROOT=<a v1162 checkout>) must FAIL this test
     (7) FIGHTS: 200 seeded 5v5 fights are tick-identical to live v1162 466a65c1 (node, server/sim-host.js), and the harness sees a
         one-number change to a sim-read clip
   Every screen that scrolls is also judged scrolled to the bottom, with no placement call from the test (the game's own handling).
   Screenshots: SHOT_DIR (default C:\Users\Home\Downloads\ew-sweep\mute2) + contact-sheet.jpg (python + Pillow, if present). */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), vm = require('vm'), cp = require('child_process');
const ROOT = process.env.MUTE_ROOT || path.join(__dirname, '..');
const control = !!process.env.MUTE_ROOT;
const SHOTS = process.env.SHOT_DIR || (control ? '' : 'C:\\Users\\Home\\Downloads\\ew-sweep\\mute2');
const BASE_SHA = process.env.EW_BASE || '466a65c160776f99477b94b03d7bd708e652217d';   // live v1162
let pass = 0, fail = 0; const ck = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 700) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const SILENT = () => {
  const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) { const c = this.context;
      if (!c.__z) { c.__z = c.createGain(); c.__z.gain.value = 0; oc.call(c.__z, d); } return oc.call(this, c.__z, ...r); } return oc.call(this, d, ...r); };
  window.__AC = []; const AC = window.AudioContext; window.AudioContext = function () { const c = new AC(...arguments); window.__AC.push(c); return c; };
  window.AudioContext.prototype = AC.prototype; window.webkitAudioContext = window.AudioContext;
  window.__gameHits = { click: 0, down: 0 };
  window.addEventListener('load', () => { document.addEventListener('click', () => window.__gameHits.click++); document.addEventListener('pointerdown', () => window.__gameHits.down++); });
  /* THE JUDGE (this test's own): what visible thing is under the button? */
  window.__judge = (rectOverride) => {
    const b = document.getElementById('muteBtn'); if (!b) return { none: true };
    const r = rectOverride || b.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
    const cTop = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), onTop = !!cTop && (cTop === b || b.contains(cTop));
    const css = document.createElement('style'); css.textContent = '*{pointer-events:auto!important}#muteBtn,#muteBtn *{pointer-events:none!important}'; document.head.appendChild(css);
    const A = c => { if (!c || c === 'transparent') return 0; const s = c.indexOf('/'); if (s >= 0) return parseFloat(c.slice(s + 1)) || 0; const m = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/.exec(c); return m ? +m[1] : 1; };
    const visArea = g => Math.max(0, Math.min(g.right, vw) - Math.max(g.left, 0)) * Math.max(0, Math.min(g.bottom, vh) - Math.max(g.top, 0));
    const host = new Set(); if (b.parentElement !== document.body) for (let e = b.parentElement; e; e = e.parentElement) host.add(e);   // (v1165: the box it is docked in - a stage popup's header bar - is its ground)
    const framed = cs => (cs.borderImageSource && cs.borderImageSource !== 'none') || ['Top', 'Right', 'Bottom', 'Left'].some(k => parseFloat(cs['border' + k + 'Width']) >= 2 && cs['border' + k + 'Style'] !== 'none' && A(cs['border' + k + 'Color']) > 0.04);
    /* the window of each uncovered close X (the box the X sits in: its nearest painted ancestor at least 3x the X) is background too */
    for (const x of document.querySelectorAll('button,[role=button]')) { const gx = x.getBoundingClientRect(); if (gx.width < 16 || gx.width > 64 || gx.height < 16 || gx.height > 64) continue;
      const im = x.querySelector('img'); if (!(/^close$/i.test(x.getAttribute('aria-label') || '') || x.matches('.popoutClose,.glClose') || (im && /\/icons\/ui\/close-v1/.test(im.getAttribute('src') || '') && (x.textContent || '').trim().length <= 2))) continue;
      for (let e = x.parentElement; e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e), w = e.getBoundingClientRect();
        if ((A(c.backgroundColor) > 0.3 || c.backgroundImage !== 'none' || (c.borderImageSource && c.borderImageSource !== 'none')) && w.width >= 3 * gx.width && w.height >= 3 * gx.height) { host.add(e); break; } } }
    const back = (e, cs, g) => e === document.documentElement || e === document.body || e.id === 'app' || e.classList.contains('screen') || host.has(e)
      || ((cs.position === 'fixed' || cs.position === 'absolute') && visArea(g) >= 0.4 * vw * vh) || (visArea(g) >= 0.4 * vw * vh && !framed(cs))   // a frameless full-screen picture (town, map, sky)
      || visArea(g) >= 0.7 * vw * vh;   // a framed stage filling the screen (the Skyfall board): its inside is the field, its frame band still counts
    const desc = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '') + (e.textContent && e.children.length < 3 ? '[' + e.textContent.trim().slice(0, 14) + ']' : '');
    const found = new Map(), rg = document.createRange();
    const band = (e, cs, g, x, y) => { const bw = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].map(v => parseFloat(v) || 0);
      let w = [0, 0, 0, 0], o = [0, 0, 0, 0];
      if (cs.borderImageSource && cs.borderImageSource !== 'none' && !host.has(e)) { const W = cs.borderImageWidth.split(/\s+/), O = (cs.borderImageOutset || '0').split(/\s+/);
        const at = (a, i) => a[i] != null ? a[i] : a[i === 3 ? 1 : i === 2 ? 0 : 0];
        w = [0, 1, 2, 3].map(i => { const v = at(W, i); if (v === 'auto') return bw[i]; if (/px$/.test(v)) return parseFloat(v); if (/%$/.test(v)) return parseFloat(v) / 100 * (i % 2 ? g.width : g.height); return (parseFloat(v) || 0) * bw[i]; });
        o = [0, 1, 2, 3].map(i => { const v = at(O, i); return /px$/.test(v) ? parseFloat(v) : (parseFloat(v) || 0) * bw[i]; });
      } else { const st = [cs.borderTopStyle, cs.borderRightStyle, cs.borderBottomStyle, cs.borderLeftStyle], co = [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor];
        w = bw.map((v, i) => (st[i] !== 'none' && st[i] !== 'hidden' && A(co[i]) > 0.04) ? v : 0); }
      const L = g.left - o[3], T = g.top - o[0], R = g.right + o[1], B = g.bottom + o[2];
      if (x < L || x >= R || y < T || y >= B) return false;
      return y < T + w[0] || y >= B - w[2] || x < L + w[3] || x >= R - w[1]; };
    const pseudo = e => ['::before', '::after'].some(p => { const pc = getComputedStyle(e, p), ct = pc.content;
      return ct && ct !== 'none' && ct !== 'normal' && pc.display !== 'none' && pc.visibility === 'visible' && parseFloat(pc.opacity) > 0.04
        && ((ct !== '""' && ct !== "''") || A(pc.backgroundColor) > 0.04 || pc.backgroundImage !== 'none' || parseFloat(pc.borderTopWidth) > 0 || parseFloat(pc.borderLeftWidth) > 0 || (pc.borderImageSource && pc.borderImageSource !== 'none')); });
    let pts = 0;
    for (let y = r.top + 0.5; y < r.bottom; y += 2) for (let x = r.left + 0.5; x < r.right; x += 2) { pts++;
      const stack = document.elementsFromPoint(x, y);
      for (let i = 0; i < stack.length; i++) { const e = stack[i]; if (e === b || b.contains(e)) continue;
        if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        const cs = getComputedStyle(e), g = e.getBoundingClientRect(), bk = back(e, cs, g), inBox = x >= g.left - 1 && x < g.right + 1 && y >= g.top - 1 && y < g.bottom + 1;   // 1 px: hit tests snap to device pixels
        const descHit = stack.slice(0, i).some(d => e.contains(d));
        let why = null;
        if (band(e, cs, g, x, y)) why = 'frame';   // (the window the button is docked in: its real border only - the game's own X and header bar sit inside its wide border-image band)
        else if (inBox && !bk && (A(cs.backgroundColor) > 0.04 || cs.backgroundImage !== 'none' || (cs.borderImageSource !== 'none' && /fill/.test(cs.borderImageSlice)) || /^(IMG|CANVAS|VIDEO|IFRAME|INPUT|SELECT|TEXTAREA|PROGRESS|METER)$/.test(e.tagName) || e instanceof SVGElement)) why = 'box';
        if (!why && !(e instanceof SVGElement)) for (const n of e.childNodes) if (n.nodeType === 3 && /\S/.test(n.data)) { rg.selectNodeContents(n);
          for (const t of rg.getClientRects()) if (x >= t.left && x < t.right && y >= t.top && y < t.bottom) { why = 'text'; break; } if (why) break; }
        if (!why && !bk && !descHit && pseudo(e)) why = 'art';
        if (!why && !bk && !inBox && !descHit && !(e instanceof SVGElement)) why = 'art';
        if (why && !found.has(e)) found.set(e, why + '@' + Math.round(x) + ',' + Math.round(y) + (inBox ? '' : '(out)'));
        if (bk && inBox && A(cs.backgroundColor) >= 0.6 && parseFloat(cs.opacity) >= 0.95) break;   // nothing under an opaque window shows
      } }
    css.remove();
    const on = r.left >= 0 && r.top >= 0 && r.right <= vw && r.bottom <= vh;
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), onTop, on, pts, why: b.dataset.why || '', docked: b.parentElement !== document.body,
      over: [...found].slice(0, 8).map(([e, w]) => desc(e) + ':' + w), n: found.size };
  };
};
const POPOUTS = ['heroesPanel', 'bag', 'quest', 'signin', 'mail', 'settings', 'tutorial'];
const SCREENS = ['campaign', 'menu', 'heroesPanel', 'bag', 'settings', 'temple', 'wishing', 'forge', 'guild', 'arena', 'arenaShop', 'market',
  'dungeon', 'elite', 'quest', 'signin', 'mail', 'tech', 'wall', 'world', 'skyisland', 'skyfall', 'rankings', 'glossary', 'shadymarket', 'watchtower', 'account', 'online'];

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-mute1163-'));
  let srv = null, browser = null; const shots = [];
  try {
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    /* ---- (1) parse ---- */
    const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
    { const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m, n = 0; const bad = [];
      while ((m = re.exec(html))) { if (m[1] && /\bsrc=/.test(m[1])) continue; n++; try { new Function(m[2]); } catch (e) { bad.push(n + ': ' + e.message); } }
      ck(n >= 3 && !bad.length, 'every inline script parses (' + n + ' blocks)', bad.join('; ')); }

    /* ---- (7) fights: this page vs live v1162, node only ---- */
    if (!control && !process.env.SKIP_FIGHTS) {
      const OLD = path.join(ROOT, '.test-mute-base-control.html'); process.on('exit', () => { try { fs.unlinkSync(OLD); } catch (e) {} }); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
      const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
      const run = load(path.join(ROOT, 'emberweave-heroes.html')), R0 = load(OLD);
      const heroes = JSON.parse(run('JSON.stringify(Object.keys(HERO_TYPES))'));
      const FIGHT = (a, b, seed, rank, crit) => `(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
        try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
          units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:${rank}})));
          ${JSON.stringify(b)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:${rank}})));
          units.forEach(u=>buildFigure(u)); ${crit ? "units.forEach(u=>{ u.glyphCrit=(u.glyphCrit||0)+0.3; });" : ''}
          let H=2166136261>>>0; const mix=s=>{ for(let i=0;i<s.length;i++){ H^=s.charCodeAt(i); H=Math.imul(H,16777619)>>>0; } };
          let t=0; for(let i=0;i<Math.round(60/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); t++;
            mix(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*100),Math.round((u.atkCd||0)*1000),Math.round((u.greenCd||0)*1000),Math.round((u.blueCd||0)*1000)].join(':')).join('|')); }
          return t+':'+H.toString(16); } finally{ autoUlt=svA; window._p2guard=false; } })()`;
      const NF = +(process.env.MUTE_FIGHTS || 200); const diff = []; let ticks = 0;
      for (let f = 0; f < NF; f++) { const a = [], c = []; for (let i = 0; i < 5; i++) { a.push(heroes[(f * 10 + i) % heroes.length]); c.push(heroes[(f * 10 + 5 + i) % heroes.length]); }
        const x = run(FIGHT(a, c, 3000 + f, [1, 3, 5][f % 3], f % 2)), y = R0(FIGHT(a, c, 3000 + f, [1, 3, 5][f % 3], f % 2)); ticks += +x.split(':')[0]; if (x !== y) diff.push(f + ' ' + x + ' vs ' + y); }
      ck(diff.length === 0 && ticks > 0, 'FIGHTS: ' + NF + ' seeded 5v5 fights (' + ticks + ' ticks, ranks 1/3/5, crit on/off) are tick-identical to live v1162 ' + BASE_SHA.slice(0, 8), diff.slice(0, 3).join('; '));
      const a = heroes.slice(0, 5), c = heroes.slice(5, 10), k = heroes[0];
      const base = run(FIGHT(a, c, 3000, 3, 0)), mut = run(`(()=>{ const T=BATTLE_ANIM[${JSON.stringify(k)}].attack, sv=T.n; T.n=sv-12; try{ return eval(${JSON.stringify(FIGHT(a, c, 3000, 3, 0))}); } finally{ T.n=sv; } })()`);
      ck(base !== mut, 'CONTROL: the fight harness sees a change to sim-read clip data (' + k + '\'s attack clip 12 cells shorter -> a different digest)', base + ' vs ' + mut);
    }

    const port = await freePort(), base = 'http://127.0.0.1:' + port;
    const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), RL_MUL: '1000', REG_PER_MIN: '200', REG_ACCOUNTS_PER_IP: '200', SIM_WORKERS: '0' }, stdio: ['ignore', log, log], windowsHide: true });
    let up = false; for (let i = 0; i < 300 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch (_) {} if (!up) await delay(100); }
    if (!up) throw new Error('server did not start');
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    const args = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
    try { browser = await chromium.launch({ args }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args }); }
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(SILENT);
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    const shot = async name => { if (!SHOTS) return; try { const f = path.join(SHOTS, name + '.png'); await pg.screenshot({ path: f }); shots.push(f); } catch (e) {} };
    const UNL = new Set();
    const judge = async () => { const j = await pg.evaluate(() => { try { muteBtnPlace(); } catch (e) {} const j = window.__judge(); j.unl = (typeof MUTE_DBG !== 'undefined' && MUTE_DBG.unlisted) || ''; return j; });
      if (j.unl) UNL.add(j.unl); return j; };
    let VW = '844x390';
    const clean = (name, r, extra) => ck(!r.none && r.onTop && r.on && r.n === 0 && r.w >= 28, VW + ' ' + name + ': zero overlap, on top, on screen (' + r.x + ',' + r.y + ' ' + r.w + 'px, ' + r.why + (r.docked ? ', docked' : '') + ')' + (extra || ''), JSON.stringify(r));
    const xInfo = () => pg.evaluate(() => { const b = document.getElementById('muteBtn').getBoundingClientRect(); const X = [...document.querySelectorAll('.popoutClose,.glClose,#profClose,#hudShopClose,button[aria-label=Close]')]
        .map(x => [x, x.getBoundingClientRect()]).filter(([x, g]) => g.width > 0 && (() => { const t = document.elementFromPoint(g.left + g.width / 2, g.top + g.height / 2); return t && (t === x || x.contains(t)); })());
      if (!X.length) return null; const g = X[X.length - 1][1];
      const s = Math.round(Math.max(30, Math.min(44, Math.min(g.width, g.height)))), cx = g.left + g.width / 2, cy = g.top + g.height / 2;
      const bl = window.__judge(new DOMRect(cx - s / 2, g.bottom + 6, s, s)), lf = window.__judge(new DOMRect(g.left - 6 - s, cy - s / 2, s, s));
      const bl3 = window.__judge(new DOMRect(cx - s / 2, g.bottom + 3, s, s)), lf3 = window.__judge(new DOMRect(g.left - 3 - s, cy - s / 2, s, s));
      const out = { why: document.getElementById('muteBtn').dataset.why || '', size: s, bw: Math.round(b.width), dcx: Math.round((b.left + b.width / 2) - cx), dcy: Math.round((b.top + b.height / 2) - cy), below: b.top >= g.bottom - 0.5, left: b.right <= g.left + 0.5,
        dist: Math.round(Math.hypot((b.left + b.width / 2) - cx, (b.top + b.height / 2) - cy)), belowTaken: bl.n > 0 && bl3.n > 0, leftTaken: lf.n > 0 && lf3.n > 0, belowOver: bl.over.slice(0, 2), leftOver: lf.over.slice(0, 2) };
      /* a spot over a scrolling box the button could not live in (the X scrolls in it, but the X's own containing block is outside it) is taken:
         that box's content scrolls under it */
      const xo = X[X.length - 1][0], cb = xo.offsetParent;
      for (let e = xo.parentElement; e && e !== cb && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e);
        if ((c.overflowY === 'auto' || c.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 1) { const w = e.getBoundingClientRect(), hit = q => q.l < w.right && q.r > w.left && q.t < w.bottom && q.b > w.top;
          if (hit({ l: cx - s / 2, t: g.bottom + 3, r: cx + s / 2, b: g.bottom + 3 + s })) { out.belowTaken = true; out.belowOver = ['scrolling ' + (e.className || e.tagName)]; }
          if (hit({ l: g.left - 3 - s, t: cy - s / 2, r: g.left - 3, b: cy + s / 2 })) { out.leftTaken = true; out.leftOver = ['scrolling ' + (e.className || e.tagName)]; } } }
      return out; });
    /* docked to the X: below it (or left of it), its size, centred within 8 px - or, only when BOTH are taken (judged), the nearest free spot */
    /* v1165: the window's fixed spot - directly under its X (its size, centred), the hero window left of its X, the glossary card beside it */
    const docked = (name, xi) => { const sz = xi && Math.abs(xi.bw - xi.size) <= 1;
      const ok = xi && ((xi.why === 'win-under-x' && sz && xi.below && Math.abs(xi.dcx) <= 1) || (xi.why === 'win-left-x' && sz && xi.left && Math.abs(xi.dcy) <= 1) || (xi.why === 'win-beside' && xi.dist <= 120));
      ck(ok, VW + ' ' + name + ': the window\'s fixed spot - ' + (xi && xi.why === 'win-left-x' ? 'left of its X' : xi && xi.why === 'win-beside' ? 'beside the card, level with its X' : 'directly under its X') + ', the X\'s size, centred on it', JSON.stringify(xi)); };

    /* ---- the sign-in gate (a fresh page, no token) ---- */
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof show === 'function' && typeof api === 'function', null, { timeout: 90000 }); await delay(2500);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(1500);
    clean('the sign-in gate', await judge()); await shot('01-signin-gate');

    /* ---- sign in ---- */
    await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'mt' + Date.now().toString(36), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id;
      G.tutStarted = true; G.tutDone = true; try { document.body.classList.remove('gated'); } catch (e) {} try { authGateRefresh(); } catch (e) {} show('home'); });
    await delay(2500);

    const hubCheck = async () => { const r = await judge(); clean('hub', r);
      const h = await pg.evaluate(() => { const b = document.getElementById('muteBtn').getBoundingClientRect(), p = document.getElementById('profileBtn').getBoundingClientRect(), f = document.getElementById('pfFrame').getBoundingClientRect();
        const L = Math.min(p.left, f.width ? f.left : p.left); return { gap: Math.round(L - b.right), dy: Math.round((b.top + b.height / 2) - (p.top + p.height / 2)), b: [Math.round(b.left), Math.round(b.top)], frameLeft: Math.round(L) }; });
      ck(h.gap >= 2 && h.gap <= 12 && Math.abs(h.dy) <= 8, VW + ' hub: immediately left of the profile portrait as drawn, centred on it (' + JSON.stringify(h) + ')'); return h; };

    const sweep = async (vw, vh, doShots) => {
      VW = vw + 'x' + vh; await pg.setViewportSize({ width: vw, height: vh }); await pg.evaluate(() => { try { closePopout(); } catch (e) {} show('home'); }); await delay(1200);
      const res = { vp: VW, hub: await hubCheck(), screens: {} };
      if (doShots) await shot(doShots + '-01-hub');
      /* windows over the hub */
      for (const p of POPOUTS) { await pg.evaluate(p => { closePopout(); popoutScreen(p); }, p); await delay(900);
        const r = await judge(); clean('pop-out window ' + p, r); res.screens['pop:' + p] = r; docked('pop-out ' + p, await xInfo());
        if (doShots && ['heroesPanel', 'settings', 'bag', 'quest', 'mail'].includes(p)) await shot(doShots + '-pop-' + p);
        if (p === 'heroesPanel') {   // scrolled to the bottom: the button went with the X, nothing slid under it
          const sc = await pg.evaluate(async () => { const el = document.getElementById('heroesPanel'); el.scrollTop = el.scrollHeight; await new Promise(r => setTimeout(r, 400)); try { muteBtnPlace(); } catch (e) {}
            const b = document.getElementById('muteBtn').getBoundingClientRect(), x = el.querySelector('.popoutClose').getBoundingClientRect();
            const j = window.__judge(); const out = { top: el.scrollTop, dx: Math.round(b.left - x.left), dy: Math.round(b.top - x.bottom), j }; el.scrollTop = 0; return out; });
          ck(sc.top > 50 && sc.dx >= -10 && sc.dx <= 14 && sc.dy >= 0 && sc.dy <= 8 && sc.j.n === 0, VW + ' heroes window scrolled to the bottom (' + sc.top + ' px): the button stayed with the X and overlaps nothing', JSON.stringify(sc));
          // the hero window over the list
          await pg.evaluate(() => { const c = document.querySelector('#heroList .hero-card'); if (c) c.click(); }); await delay(1000);
          const hd = await judge(); clean('hero window', hd); res.screens['pop:heroDetail'] = hd; if (doShots) await shot(doShots + '-pop-heroDetail');
        }
      }
      await pg.evaluate(() => { closePopout(); show('home'); }); await delay(700);
      /* the hub menu, profile and food shop */
      for (const [name, open, close] of [
        ['hub menu (open)', () => { document.getElementById('hubMenu').classList.add('open'); }, () => document.getElementById('hubMenu').classList.remove('open')],
        ['profile window', () => { document.getElementById('profileBtn').click(); }, () => { try { document.getElementById('profClose').click(); } catch (e) {} }],
        ['food shop window', () => { document.getElementById('staminaPlus').click(); }, () => { try { document.getElementById('hudShopClose').click(); } catch (e) {} }] ]) {
        await pg.evaluate(open); await delay(900); const r = await judge(); clean(name, r); res.screens[name] = r;
        if (name !== 'hub menu (open)') docked(name, await xInfo());
        if (doShots) await shot(doShots + '-' + name.replace(/\W+/g, '-'));
        await pg.evaluate(close); await delay(400);
      }
      /* confirms and a card modal */
      await pg.evaluate(() => gameConfirm('Spend 50 gems on this?', () => {})); await delay(700);
      { const r = await judge(); clean('confirm (gameConfirm)', r); res.screens.confirm = r; if (doShots) await shot(doShots + '-confirm'); }
      await pg.evaluate(() => document.querySelectorAll('#_gcNo').forEach(b => b.click())); await delay(300);
      await pg.evaluate(() => { uiConfirm('Leave the guild?', ['You lose your guild coins.'], 'Leave', true); }); await delay(700);
      { const r = await judge(); clean('confirm (uiConfirm)', r); res.screens.uiConfirm = r; }
      await pg.evaluate(() => document.querySelectorAll('#uiConfirmWrap').forEach(n => n.remove())); await delay(300);
      /* full screens */
      for (const s of SCREENS) {
        await pg.evaluate(s => { try { closePopout(); } catch (e) {} try { show(s); } catch (e) {} }, s); await delay(1200);   // (the game re-checks 0.9 s after a screen opens)
        const st = await pg.evaluate(() => state); if (st !== s) { ck(false, VW + ' screen ' + s + ' opened', 'state=' + st); continue; }
        const r = await judge(); clean('screen ' + s, r); res.screens[s] = r;
        { /* a screen that scrolls: scrolled to the bottom, the game alone (its own scroll / DOM handling, no call from here) keeps it clear */
          const sc = await pg.evaluate(async s => { const el = document.getElementById(s); if (!(el.scrollHeight > el.clientHeight + 1)) return null;
            el.scrollTop = el.scrollHeight; await new Promise(r => setTimeout(r, 900)); const j = window.__judge(); j.top = el.scrollTop; el.scrollTop = 0; await new Promise(r => setTimeout(r, 600)); return j; }, s);
          if (sc && sc.docked && /^(screen-dock|arena)/.test(sc.why))   // docked into the screen's scrolling box: it went up with the content (may be partly out of view)
            ck(sc.n === 0, VW + ' screen ' + s + ' scrolled to the bottom (' + sc.top + ' px): docked in the screen, it scrolled with the content and overlaps nothing (' + sc.x + ',' + sc.y + ')', JSON.stringify(sc));
          else if (sc) clean('screen ' + s + ' scrolled to the bottom (' + sc.top + ' px)', sc); }
        if (doShots && ['campaign', 'menu', 'temple', 'forge', 'guild', 'arena', 'wall', 'skyfall', 'watchtower', 'glossary', 'heroesPanel', 'tech'].includes(s)) await shot(doShots + '-' + s);
        if (s === 'heroesPanel') {   // the full-screen Heroes list scrolled to the bottom: still nothing under it
          const r2 = await pg.evaluate(async () => { const el = document.getElementById('heroesPanel'); el.scrollTop = el.scrollHeight; await new Promise(r => setTimeout(r, 400)); try { muteBtnPlace(); } catch (e) {}
            const j = window.__judge(); j.top = el.scrollTop; el.scrollTop = 0; return j; });
          clean('screen heroesPanel scrolled to the bottom (' + r2.top + ' px)', r2);
        }
        if (s === 'glossary') {   // the glossary's big card (a modal with its own X)
          await pg.evaluate(() => { const c = document.querySelector('#glossary .glCard'); if (c) c.click(); }); await delay(800);
          const open = await pg.evaluate(() => { const g = document.getElementById('glCardBig'); return !!(g && g.getBoundingClientRect().width); });
          if (open) { const r3 = await judge(); clean('glossary card (modal)', r3); res.screens.glCard = r3; docked('glossary card', await xInfo()); if (doShots) await shot(doShots + '-glossary-card'); }
          else ck(false, VW + ' glossary card opened');
          await pg.evaluate(() => { const x = document.querySelector('#glCardBig .glClose'); if (x) x.click(); }); await delay(300);
        }
      }
      /* v1165: a stage popup over the campaign map (it fills the screen; the spot is in its header bar, left of the stars) */
      await pg.evaluate(() => { try { closePopout(); } catch (e) {} CUR = { mode: 'campaign', node: 1, portal: 'normal' }; show('campaign'); }); await delay(900);
      const smOk = await pg.evaluate(() => { try { openStageModal(1, 'normal'); return document.getElementById('stageModal').classList.contains('active'); } catch (e) { return String(e); } }); await delay(1300);
      if (smOk === true) { const r = await judge(); clean('stage popup (Stage 1-1)', r); res.screens.stagePopup = r; ck(r.why === 'stage-head', VW + ' stage popup: the spot is its header bar, left of the stars', r.why); if (doShots) await shot(doShots + '-stage-popup'); }
      else ck(false, VW + ' stage popup opened', smOk);
      await pg.evaluate(() => { const c = document.getElementById('smClose'); if (c) c.click(); document.getElementById('stageModal').classList.remove('active'); show('home'); }); await delay(600);
      /* the battle and its result */
      await pg.evaluate(() => { show('home'); CUR = { node: 1, mode: 'arena' }; _startVersusNow([{ key: 'grosk', level: 5, rank: 1 }, { key: 'gruel', level: 5, rank: 1 }], true); paused = true; }); await delay(1600);
      { const r = await judge(); clean('battle', r); res.screens.battle = r; if (doShots) await shot(doShots + '-battle'); }
      await pg.evaluate(() => { paused = false; endBattle(true); }); await delay(2400);
      { const r = await judge(); clean('result screen', r); res.screens.result = r; if (doShots) await shot(doShots + '-result'); }
      await pg.evaluate(() => { try { cancelResult(); } catch (e) {} show('home'); }); await delay(800);
      return res;
    };
    const all = [];
    all.push(await sweep(844, 390, 'p844'));
    all.push(await sweep(915, 412, 'p915'));
    all.push(await sweep(1920, 1080, ''));
    await pg.setViewportSize({ width: 844, height: 390 }); VW = '844x390'; await pg.evaluate(() => show('home')); await delay(1200);

    /* ---- v1165: ONE spot per screen - identical over 3 entries, and the same place (in proportion) on two phone sizes ---- */
    { const spotOf = async open => { await pg.evaluate(open); await delay(1300); return pg.evaluate(() => { const r = document.getElementById('muteBtn').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), document.getElementById('muteBtn').dataset.why]; }); };
      const ENTRIES = [['hub', () => { try { closePopout(); } catch (e) {} show('home'); }], ['campaign', () => show('campaign')], ['team select', () => show('menu')], ['City Wall', () => show('wall')],
        ['Skyfall', () => show('skyfall')], ['Temple', () => show('temple')], ['Arena', () => show('arena')], ['Heroes window', () => { show('home'); popoutScreen('heroesPanel'); }],
        ['Settings window', () => { closePopout(); show('home'); popoutScreen('settings'); }],
        ['battle', () => { closePopout(); show('home'); CUR = { node: 1, mode: 'arena' }; _startVersusNow([{ key: 'grosk', level: 5, rank: 1 }, { key: 'gruel', level: 5, rank: 1 }], true); paused = true; }]];
      for (const [name, open] of ENTRIES) { const seen = [];
        for (let k = 0; k < 3; k++) { seen.push(JSON.stringify(await spotOf(open))); await pg.evaluate(() => { try { ended = true; closePopout(); } catch (e) {} try { cancelResult(); } catch (e) {} show('glossary'); }); await delay(500); }
        ck(seen[0] === seen[1] && seen[1] === seen[2], '844x390 ' + name + ': the same spot on 3 entries ' + seen[0], seen.join(' / ')); }
      await pg.evaluate(() => show('home')); await delay(800); }
    { const A = all[0], B = all[1], va = A.vp.split('x').map(Number), vb = B.vp.split('x').map(Number), bad = [];
      for (const k of Object.keys(A.screens)) { const a = A.screens[k], b = B.screens[k]; if (!a || !b || a.none || b.none || a.docked && /scroll/.test(k)) continue;
        const ra = (va[0] - (a.x + a.w)) / va[0], rb = (vb[0] - (b.x + b.w)) / vb[0], ya = (a.y + a.h / 2) / va[1], yb = (b.y + b.h / 2) / vb[1];
        if (Math.abs(ra - rb) > 0.03 || Math.abs(ya - yb) > 0.04) bad.push(k + ' ' + ra.toFixed(3) + '/' + rb.toFixed(3) + ' ' + ya.toFixed(3) + '/' + yb.toFixed(3)); }
      ck(bad.length === 0, 'every screen\'s spot is the same place in proportion at 844x390 and 915x412 (right inset / width within 3%, centre / height within 4%)', bad.join('; ')); }
    console.log('  unlisted screens (placed on the fallback corner - add them to the table): ' + ([...UNL].join(', ') || 'none'));
    ck(UNL.size === 0, 'no screen of this sweep is missing from the spot table');

    /* ---- (6) CONTROLS: the judge fails a button on the title plate and on a hero card ---- */
    await pg.evaluate(() => { closePopout(); popoutScreen('heroesPanel'); }); await delay(1000);
    const ctl = await pg.evaluate(() => { const h = document.querySelector('#heroesPanel .hdrbox').getBoundingClientRect(), x = document.querySelector('#heroesPanel .popoutClose').getBoundingClientRect();
      const s = 40, plate = new DOMRect(h.right - s - 14, x.top - 4, s, s);   // where v1159 put it in Phil's screenshot: on the plate, left of the X
      const c = document.querySelector('#heroList .hero-card').getBoundingClientRect(), card = new DOMRect(c.left + 20, c.top + 20, s, s);
      return { plate: window.__judge(plate), card: window.__judge(card) }; });
    ck(ctl.plate.n > 0 && ctl.plate.over.some(o => /hdrbox|h1|sub/.test(o)), 'CONTROL: the judge FAILS the button put back on the HEROES title plate (' + ctl.plate.over.join(', ') + ')', JSON.stringify(ctl.plate));
    ck(ctl.card.n > 0, 'CONTROL: the judge FAILS the button on a hero card (' + ctl.card.over.slice(0, 3).join(', ') + ')', JSON.stringify(ctl.card));
    await shot('p844-heroes-docked-final');

    /* ---- (5) a tap on the docked button ---- */
    const btnC = async () => pg.evaluate(() => { const r = document.getElementById('muteBtn').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await pg.evaluate(() => { window.__gameHits.click = 0; window.__gameHits.down = 0; sndMuteSet(false); });
    { const [x, y] = await btnC(); await pg.mouse.click(x, y); await delay(300); }
    const t1 = await pg.evaluate(() => ({ on: SND_MUTE.on, gain: SND.out && SND.out.gain.value, ls: localStorage.getItem('ew_mute'), open: _popout, img: document.querySelector('#muteBtn img').src, hits: window.__gameHits, docked: document.getElementById('muteBtn').parentElement.id }));
    { const [x, y] = await btnC(); await pg.mouse.click(x, y); await delay(300); }
    const t2 = await pg.evaluate(() => ({ on: SND_MUTE.on, gain: SND.out && SND.out.gain.value, ls: localStorage.getItem('ew_mute'), open: _popout, hits: window.__gameHits }));
    ck(t1.on && t1.gain === 0 && t1.ls === '1' && /audio-off/.test(t1.img) && t1.open === 'heroesPanel' && t1.docked === 'heroesPanel', 'a tap on the docked button mutes (gain 0, saved, muted icon) and the window stays open', JSON.stringify(t1));
    ck(!t2.on && t2.gain === 1 && t2.ls === '0' && t2.open === 'heroesPanel' && t2.hits.click === 0 && t2.hits.down === 0, 'a second tap unmutes; neither tap reached a game listener', JSON.stringify(t2));
    await pg.evaluate(() => { closePopout(); show('home'); }); await delay(500);

    ck(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, 'screens.json'), JSON.stringify(all, null, 1));
    await pg.evaluate(async () => { try { for (const c of (window.__AC || [])) await c.close(); } catch (e) {} });
  } catch (e) { fail++; console.log('  FAIL harness: ' + (e && e.stack || e)); }
  finally { try { if (browser) await browser.close(); } catch (_) {} try { if (srv) srv.kill(); } catch (_) {} try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
  if (SHOTS && shots.length) { try {   // contact sheet
      const py = `import sys,math\nfrom PIL import Image,ImageDraw\nfs=sys.argv[2:]\nW=560\nims=[Image.open(f).convert('RGB') for f in fs]\nims=[i.resize((W,int(i.height*W/i.width))) for i in ims]\nH=max(i.height for i in ims)+22\ncols=4\nrows=math.ceil(len(ims)/cols)\nS=Image.new('RGB',(cols*W+(cols+1)*8,rows*H+(rows+1)*8),(16,16,20))\nd=ImageDraw.Draw(S)\nimport os\nfor k,(i,f) in enumerate(zip(ims,fs)):\n  x=8+(k%cols)*(W+8); y=8+(k//cols)*(H+8); S.paste(i,(x,y+20)); d.text((x+2,y+3),os.path.basename(f)[:-4],fill=(240,220,160))\nS.save(sys.argv[1],quality=86)\n`;
      const pf = path.join(os.tmpdir(), 'ew-mute-sheet.py'); fs.writeFileSync(pf, py);
      cp.execFileSync('python', ['-I', pf, path.join(SHOTS, 'contact-sheet.jpg'), ...shots], { stdio: 'ignore' }); console.log('  contact sheet: ' + path.join(SHOTS, 'contact-sheet.jpg') + ' (' + shots.length + ' shots)'); } catch (e) { console.log('  (no contact sheet: ' + e.message.slice(0, 80) + ')'); } }
  console.log(''); console.log('PASS: ' + pass + '  FAIL: ' + fail);
  if (control) { console.log(fail ? 'CONTROL: failed as it must' : 'CONTROL DID NOT FAIL'); process.exit(fail ? 0 : 1); }
  process.exit(fail ? 1 : 0);
})();
