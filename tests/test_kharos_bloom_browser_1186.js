'use strict';
// v1186 - BLOOMSTEP in the real client (Phil 16 Oct 2026): "the flower pedals need to be above him on a layer"; "when the flower mannequin starts to
// form kharos vanishes into the flowers"; "he then instantly teleports behind the target and strikes". Needs playwright; runs under the GPU lock
// with the other browser tests (muted, swiftshader).
//   1. the client's run of whole Kharos fights - with the render (syncMesh; the FX tick runs inside updateBattle) run between every engine tick - is the server replay's
//      (sim-host) tick for tick: the display (his fade, the pinned figure, the counter cut) moves nothing.
//   2. a staged Bloomstep in the page, drawn every tick: the petals drawn IN FRONT of him (renderOrder above his sprite); his sprite's alpha 1 until
//      the figure forms, down to 0 over a few cells, held at 0, back to 1 on the jump; his HP bar / ring untouched (only the sprite's opacity moves);
//      after the jump the figure stays where he stood (pinned to _bloomFrom) and fades; his blue clip shows on arrival (the counter cut).
//   CONTROL: the same check on the page with the jump switched off (bloom false) never jumps and never brings the alpha back early.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), os = require('os'), net = require('net');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 900) : '')); } };
// a whole fight; `rend` = draw every tick in the client (syncMesh for each unit), as the game loop does between engine steps
const FIGHT = (seed, a, f, rend) => `(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
  try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed}); if(typeof clearFx1123==='function') clearFx1123();
    units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
    ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
    units.forEach(u=>{ try{ buildFigure(u); }catch(_){} }); let jumps=0, hid=0;
    const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ units.forEach(u=>{ u.glyphCrit=0; }); updateBattle(SIM_STEP);
      ${rend ? "units.forEach(u=>{ try{ syncMesh(u,SIM_STEP); }catch(_){} }); units.forEach(u=>{ if(u._fxHideA!=null&&u._fxHideA<1) hid++; });" : ''}
      tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0,Math.round((u.energy||0)*10),+(u.stunned||0).toFixed(2)].join(':')).join('|')); }
    units.forEach(u=>{ jumps+=(u._bloomJumpSeq|0); });
    let h=2166136261>>>0; const s=tr.length+'@'+tr.join('#'); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
    return JSON.stringify({h:s.length+':'+h.toString(16),jumps,hid}); } finally{ autoUlt=svA; window._p2guard=false; } })()`;
const KF = [[['kharos', 'tick', 'sylthaine'], ['vael', 'vireo', 'grosk'], 11], [['kharos', 'vael', 'lumi'], ['brannus', 'korvux', 'astra'], 17], [['hobb', 'kharos', 'korvux'], ['kharos', 'aureth', 'carn'], 23]];
// a staged Bloomstep (Kharos at (500,700), Vael at `tx`, held), drawn every tick; what his sprite, the petals and his clip do
const STAGE = (tx, bloom) => `(()=>{ units=[]; ended=false; paused=false; state='battle'; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(9); clearFx1123(); KITS.kharos.blue.bloom=${bloom};
  const g=makeUnit('kharos','ally',500,700,30,{owned:false,rank:3}), e=makeUnit('vael','enemy',${tx},700,30,{owned:false,rank:3}); units=[g,e];
  units.forEach(u=>{ u.maxHp=u.hp=1e9; u.energy=0; u.atkInterval=99; u.atkCd=99; u.speed=0; u.greenCd=u.blueCd=99; buildFigure(u); }); g.target=e;
  const hpOp=()=>{ const o=[]; g.mesh.traverse(c=>{ if(c!==g.sprite&&c.material&&c.material.opacity!=null) o.push(+c.material.opacity.toFixed(3)); }); return o.join(','); };
  const hp0=hpOp(); g._castSM=1; g._castLv=1; castKit(g,KITS.kharos.blue); const rows=[]; let jumpT=null, from=null;
  try{ for(let i=0;i<Math.round(5/SIM_STEP);i++){ updateBattle(SIM_STEP); g.atkCd=99; g.greenCd=g.blueCd=99; e.x=e._ax=${tx}; e.y=e._ay=700;
      units.forEach(u=>syncMesh(u,SIM_STEP));   /* the FX tick runs inside updateBattle (battleFrameTail) */
      if(jumpT==null&&(g._bloomJumpSeq|0)>0){ jumpT=+battleTime.toFixed(4); from=g._bloomFrom; }
      const o=_fx1123.find(q=>q.kind==='fx16'&&q.vk==='kblue'&&q.u===g);
      rows.push({j:(g._bloomJumpSeq|0)>0?1:0,t:+battleTime.toFixed(3),a:+g.sprite.material.opacity.toFixed(3),hide:g._fxHideA==null?null:+g._fxHideA.toFixed(3),st:g._animSt,x:+g.x.toFixed(1),face:g._faceDir,
        fx:o&&o.s?{ro:o.s.renderOrder,me:g.sprite.renderOrder,vis:o.s.visible!==false,pin:o.pin?[o.pin.x,o.pin.y]:null,px:+o.s.position.x.toFixed(3),pz:+o.s.position.z.toFixed(3),wpx:o.pin?+wx(o.pin.x).toFixed(3):null,wpz:o.pin?+wz(o.pin.y).toFixed(3):null,op:+(o.s.material.opacity||0).toFixed(3)}:null,hp:hpOp()}); } }
  finally{ KITS.kharos.blue.bloom=true; }
  return JSON.stringify({rows,jumpT,from,hp0,ex:${tx}}); })()`;
const tests = async () => {
  let chromium = null; try { ({ chromium } = require(path.join(ROOT, 'node_modules/playwright'))); } catch (e) {}
  if (!chromium || process.env.EW_NO_BROWSER) { console.log('  info no playwright here - this check runs with the browser tests'); return; }
  const port = await new Promise((res, rej) => { const s = net.createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  const db = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kbloom-db-')), 'db.json');
  const srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DB_FILE: db }, stdio: 'ignore', windowsHide: true });
  let b;
  try {
    for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch (_) {} await new Promise(r => setTimeout(r, 250)); }
    b = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
    const p = await b.newPage({ viewport: { width: 844, height: 390 } });
    await p.addInitScript(() => { try { window.AudioContext = undefined; window.webkitAudioContext = undefined; } catch (e) {} });
    await p.goto(`http://127.0.0.1:${port}/play`, { waitUntil: 'load', timeout: 90000 });
    await p.waitForFunction(() => typeof makeUnit === 'function' && typeof updateBattle === 'function' && typeof scene !== 'undefined' && !!scene, null, { timeout: 90000 });
    // warm his sheets and the petals (the art must be loaded for the sprite and the FX to draw)
    await p.evaluate(`(()=>{ const g=makeUnit('kharos','ally',500,700,30,{owned:false}); buildFigure(g); fx2Tex('kharos_blue'); window.__kw=g; 1 })()`);
    await p.waitForFunction(() => { const g = window.__kw, A = g && g.anim && g.anim.blue, t = fx2Tex('kharos_blue'), im = A && A.tex && A.tex.image, ti = t && t.image;
      const ok = x => !!x && (('naturalWidth' in x) ? (x.complete && x.naturalWidth > 0) : (x.width | 0) > 0); return ok(im) && ok(ti); }, null, { timeout: 120000 }).catch(() => {});
    // 1. the client = the server replay, with the render between ticks
    const web = []; for (const [a, f, s] of KF) web.push(JSON.parse(await p.evaluate(FIGHT(s, a, f, true))));
    const srvH = KF.map(([a, f, s]) => JSON.parse(load(HTML)(FIGHT(s, a, f, false))));
    ck('the client\'s Kharos fights, drawn every tick (' + web.map(w => w.jumps + ' jumps, hidden ' + w.hid + ' unit-ticks').join(' / ') + '), are the server replay\'s tick for tick (' + web.map(w => w.h).join(' ') + ')',
      web.every((w, i) => w.h === srvH[i].h) && web.reduce((n, w) => n + w.jumps, 0) > 0 && srvH.every((w, i) => w.jumps === web[i].jumps), JSON.stringify({ web, srvH }));
    // 2. staged, right (enemy at 600) and left (enemy at 400)
    for (const tx of [600, 400]) {
      const S = JSON.parse(await p.evaluate(STAGE(tx, true))), R = S.rows, side = tx > 500 ? 'right' : 'left';
      const shown = R.filter(r => r.fx), pre = R.filter(r => !r.j), post = R.filter(r => r.j);
      ck(`${side}: the petals are drawn IN FRONT of him (renderOrder ${shown[0] && shown[0].fx.ro} over his sprite's ${shown[0] && shown[0].fx.me}) every tick they show (${shown.length})`,
        shown.length > 10 && shown.every(r => r.fx.ro > r.fx.me), JSON.stringify(shown.slice(0, 3)));
      const first0 = pre.findIndex(r => r.a === 0), firstDip = pre.findIndex(r => r.a < 1);
      ck(`${side}: he fades into the flowers - alpha 1 until the figure forms (first dip at ${firstDip >= 0 && pre[firstDip].t} s), down to 0 over a few cells (0 at ${first0 >= 0 && pre[first0].t} s), held at 0 until the jump (${S.jumpT} s)`,
        firstDip > 0 && first0 > firstDip && pre.slice(0, firstDip).every(r => r.a === 1) && pre.slice(firstDip, first0 + 1).every((r, i, a) => i === 0 || r.a <= a[i - 1].a) && pre.slice(first0).every(r => r.a === 0) && (pre[first0].t - pre[firstDip].t) < 0.8,
        JSON.stringify(pre.map(r => [r.t, r.a]).filter(r => r[1] < 1)));
      ck(`${side}: his HP bar, ring and shadow keep their opacity the whole time (only the sprite fades): ${S.hp0}`, R.every(r => r.hp === S.hp0), JSON.stringify(R.filter(r => r.hp !== S.hp0).slice(0, 2)));
      const j0 = post[0] || {};
      ck(`${side}: on the jump he is back at once (alpha ${j0.a}) behind the enemy (x ${j0.x}, the enemy at ${tx}, from ${S.from && S.from.x}) and his blue clip shows the counter cut (${post.slice(0, 3).map(r => r.st).join('/')})`,
        S.jumpT != null && post.every(r => r.a === 1) && Math.sign(j0.x - tx) === Math.sign(tx - 500) && j0.st === 'blue', JSON.stringify(post.slice(0, 4)));
      const pinned = post.filter(r => r.fx);
      ck(`${side}: the flower figure stays where he stood (pinned at ${pinned[0] && JSON.stringify(pinned[0].fx.pin)}, drawn there ${pinned.length} ticks) and fades out (${pinned.map(r => r.fx.op).filter((_, i) => i % 3 === 0).join(' ')})`,
        pinned.length > 0 && pinned.every(r => r.fx.pin && r.fx.pin[0] === S.from.x && Math.abs(r.fx.px - r.fx.wpx) < 1e-3 && Math.abs(r.fx.pz - r.fx.wpz) < 1e-3) && pinned.every((r, i, a) => i === 0 || r.fx.op <= a[i - 1].fx.op + 1e-6) && post[post.length - 1].fx === null,
        JSON.stringify(pinned.slice(0, 3)));
    }
    // CONTROL: the jump off - he never comes back early (the instrument sees the jump)
    const C = JSON.parse(await p.evaluate(STAGE(600, false)));
    ck('CONTROL: with the jump switched off he never jumps and the fade is never undone by one (jump ' + C.jumpT + ')', C.jumpT === null && !C.rows.some((r, i, a) => i > 0 && a[i - 1].a === 0 && r.a === 1 && r.x !== a[i - 1].x));
  } finally { try { if (b) await b.close(); } catch (e) {} srv.kill(); }
};
tests().then(() => { console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : '')); if (fail) process.exitCode = 1; })
  .catch(e => { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; });
})();
