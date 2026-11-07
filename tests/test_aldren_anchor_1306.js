/* v1306 (Phil 7 Nov: "Aldren isnt anchored he slides"): his hit, green and passive clips drift 11-70 px across their own cells and carried no
   per-frame anchor (ax), so he slid through them and snapped back. FILMED IN THE GAME (Phil 5 Nov: anchor complaints are checked on the
   live build's render, not the sheet): a real versus fight in Chromium (SwiftShader), Aldren forced into each clip, every rendered frame
   read off his sprite - the cell the renderer DREW (its UV window), the anchor and scale it SET - and his drawn feet placed in the world
   from that cell's own foot pixels. Planted = the feet stay within 3% of his height for the whole clip.
   CONTROL: TP_ROOT=<a pre-v1306 checkout> must FAIL (hit / green slide there). */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), cp = require('child_process');
const ROOT = process.env.TP_ROOT || path.join(__dirname, '..'), control = !!process.env.TP_ROOT;
let pass = 0, fail = 0; const ck = (m, c, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? ' - ' + String(d).slice(0, 300) : '')); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-al1306-')); let srv = null, br = null; const port = await freePort(), base = 'http://127.0.0.1:' + port;
  try {
    srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATABASE_URL: '', DB_STORE: '', PORT: String(port), DB_FILE: path.join(tmp, 'db.json'), RL_MUL: '1000', SIM_WORKERS: '0' }, stdio: 'ignore', windowsHide: true });
    for (let i = 0; i < 300; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch (_) {} await delay(100); }
    const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
    br = await chromium.launch({ args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const pg = await (await br.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => typeof startVersus === 'function' && typeof loop === 'function', null, { timeout: 90000 }); await delay(2000);
    await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await delay(600);
    await pg.evaluate(async () => { const r = await api('/api/register', 'POST', { name: 'al' + Date.now().toString(36), pass: 'password1' }); ACC.token = r.token; ACC.id = r.profile.id; ACC.name = r.profile.name;
      G.tutStarted = true; G.tutDone = true; try { _whatsNewDone = true; } catch (e) {} document.body.classList.remove('gated'); show('home'); });
    await delay(1500);
    await pg.evaluate(() => { const T = ['aldren', 'aureth', 'sylthaine', 'vex', 'korvux']; T.concat(['grosk']).forEach(k => G.unlocked[k] = true); G.team = T.slice(); CUR = { mode: 'arena', seed: 7 }; startVersus([{ key: 'grosk', level: 30 }], true, T.slice()); });
    for (let i = 0; i < 240; i++) { if (await pg.evaluate(() => state === 'battle' && units.length >= 2 && units.length >= 6 && units.every(u => u.mesh || u.sprite))) break; await delay(250); }
    await pg.evaluate(() => { window.__raf0 = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; window.__t = performance.now(); last = window.__t;
      units.forEach(u => { u.greenCd = 999; u.blueCd = 999; u.energy = 0; u.maxHp = u.hp = 1e7; u.speed = 0; u.atkCd = 99; });
      units.filter(u => u.team === 'ally').forEach((u, i) => { u.x = u._ax = 300 + (i % 3) * 200; u.y = u._ay = 450 + i * 160; }); const e = units.find(u => u.team === 'enemy'); e.x = e._ax = 1400; e.y = e._ay = 700; });
    await pg.evaluate(() => { units.forEach(u => { if (u.team === 'ally') for (const k in u.anim) { if (k[0] !== '_') try { _loadClip(u.anim[k]); } catch (e) {} } }); });
    await delay(9000);   // his sheets load (hit / green / passive load lazily in a fight - asked for here)
    const film = async (hero, clip) => {
      const rows = await pg.evaluate(async ([hero, clip]) => {
        const u = units.find(x => x.key === hero), set = u.anim, A = set[clip]; if (!A || !A.tex || !A.tex.image) return { err: 'sheet not loaded: ' + clip };
        // the sheet's own pixels, read once, to find the foot in the cell the renderer draws
        // the GPU copy keeps only its size (the CPU image is freed after upload) - read the same file the renderer loaded
        const im = A.tex.image; const F = (typeof artFile === 'function') ? artFile(A.u) : null, url = (F && F.u) || A.u;
        const bmp = await createImageBitmap(await (await fetch(url)).blob()); const W = bmp.width, H = bmp.height;
        if (W !== im.width || H !== im.height) return { err: 'sheet size ' + W + 'x' + H + ' != drawn ' + im.width + 'x' + im.height };
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.drawImage(bmp, 0, 0); const px = g.getImageData(0, 0, W, H).data;
        const  cols = A._lay ? A._lay.c : A.cols, rws = A._lay ? A._lay.r : A.rows, cw = W / cols, ch = H / rws;
        const footX = (c, r) => { let b = -1; for (let y = Math.floor((r + 1) * ch) - 1; y >= r * ch && b < 0; y--) for (let x = Math.floor(c * cw); x < (c + 1) * cw; x++) if (px[(y * W + x) * 4 + 3] > 60) { b = y; break; }
          if (b < 0) return null; let s = 0, n = 0; for (let y = Math.max(Math.floor(r * ch), b - 9); y <= b; y++) for (let x = Math.floor(c * cw); x < (c + 1) * cw; x++) if (px[(y * W + x) * 4 + 3] > 60) { s += x - c * cw; n++; } return n ? s / n : null; };
        const out = [], seen = new Set();
        for (let i = 0; i < 400 && seen.size < (A.n || 48); i++) {
          if (clip === 'hit') { u._hitHold = 5; } else { u._abilAnim = clip; u._abilHold = 5; u._abilPri = 9; u._castSlot = clip; }
          window.__t += 1000 / 60; loop(window.__t);
          const s = u.sprite || u.mesh; if (!s || s.material.map !== A.tex) continue;
          const v = s._uv; if (!v) continue;
          const x0 = Math.min(v[2], v[2] + v[0]), c = Math.round(x0 * cols - 0.0001 * cols), r = Math.round(rws * (1 - v[3]) - 1), cell = r * cols + c;
          const mir = v[0] < 0, fx = footX(c, r); if (fx == null) continue;
          // world x of the drawn foot: the quad is scale.x wide, its anchor (center.x) at position.x
          const frac = fx / cw, fxw = mir ? 1 - frac : frac, wx = s.position.x + (fxw - s.center.x) * s.scale.x;
          seen.add(cell); out.push({ cell, wx: +wx.toFixed(3), h: s.scale.y });
        }
        return { rows: out, cells: seen.size };
      }, [hero, clip]);
      return rows;
    };
    if (process.env.DBG) await pg.evaluate(() => { window.__dbg = 1; });
    const FILM = [['aldren', 'hit'], ['aldren', 'green'], ['aldren', 'passive'], ['aureth', 'ult']];   // v1306: only Aldren is pinned (a roster-wide pass pinned banners / capes / lunges - reverted, per-clip visual review)
    for (const [hero, clip] of FILM) {
      const r = await film(hero, clip);
      if (r.err) { ck(hero + ' ' + clip + ': filmed', false, r.err); continue; }
      const xs = r.rows.map(o => o.wx), H = r.rows.length ? r.rows[0].h : 1, drift = Math.max(...xs) - Math.min(...xs);
      ck(hero + ' ' + clip + ': filmed ' + r.cells + ' cells in the game, his drawn feet stay planted (drift ' + (100 * drift / H).toFixed(1) + '% of his quad height, limit 3%)', r.cells >= 40 && drift / H <= 0.03, JSON.stringify(xs.slice(0, 12)));
    }
    await pg.evaluate(() => { window.__t += 16; loop(window.__t); });
    await pg.screenshot({ path: path.join(tmp, 'aldren.png') }); console.log('  (screenshot ' + path.join(tmp, 'aldren.png') + ')');
    ck('no page errors', errs.length === 0, errs.join(' | '));
  } catch (e) { fail++; console.log('  FAIL run: ' + (e.stack || e)); }
  finally { try { if (br) await br.close(); } catch (_) {} if (srv) srv.kill(); }
  console.log((control ? 'CONTROL ' : '') + pass + ' passed, ' + fail + ' failed');
  if (control) process.exit(fail > 0 ? 0 : 1);
  process.exit(fail ? 1 : 0);
})();
