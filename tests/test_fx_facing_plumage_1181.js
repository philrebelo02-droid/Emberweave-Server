'use strict';
// v1181 - (1) FACING: every directional spell FX wired on 16 Oct flips with its hero - Fault Claws (flat, from his claws back behind him), Bloodthirst /
//   Last Stand (upright on him), Soporific Bouquet (by the side its enemy is on). Warcry is a radially symmetric top-down disc: no direction.
//   Each is drawn facing RIGHT and facing LEFT through its own painter; the UV x-scale sign, the sprite anchor and the art's ends must mirror exactly.
//   CONTROL: a painter that ignores the facing (forced) fails the same checks.
// (2) IMPERIAL PLUMAGE small (Phil 16 Oct: "make her feather burst small", "not massive"): each per-unit burst is badgeH 0.45 x the unit's height
//   across (was 0.8 over the bar, 0.52 at the feet), the same timing and play-once; fxBadgeSpread shrinks any two that overlap on screen.
// Display only: casts and whole fights tick-identical to BASE.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.env.EW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const BASE_SHA = process.env.EW_BASE || '15ddba3f';   // live v1180 (Rim Breaker, on v1178 Brannus / Quorrel), before this change
let OLD = process.env.EW_HTML_OLD;
if (!OLD) { try { OLD = path.join(ROOT, '.test-face1181-base.html'); fs.writeFileSync(OLD, cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
  const tmp = OLD; process.on('exit', () => { try { fs.unlinkSync(tmp); } catch (e) {} }); } catch (e) { OLD = null; } }
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const run = load(HTML), R0 = OLD ? load(OLD) : null;   require('./helpers/kharos-fx-1186.js').undoKFX1186(run);   // v1186: Kharos's FX back to BASE, so this test keeps testing v1181
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 900) : '')); } };
const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
// a fake sprite / mesh that records what the painter sets (sim-host has no WebGL)
const FAKE = `const fake=()=>({center:{x:0,y:0,set(x,y){this.x=x;this.y=y;}},scale:{x:0,y:0,set(x,y){this.x=x;this.y=y;}},position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;},copy(p){this.x=p.x||0;this.y=p.y||0;this.z=p.z||0;}},rotation:{},_uv:[0.14,0.09,0.2,0.3],material:{}});`;
const FACE = (forceBroken) => `(()=>{ ${FAKE} const out={}; const _flat=_fx22Flat, _spr=_fx22Spr;
  _fx22Flat=function(){ return fake(); }; _fx22Spr=function(){ return fake(); };
  const brk=${forceBroken ? 'true' : 'false'};
  try{
    /* Fault Claws (flat): his facing is his drawn mirror (sheet faces right) */
    const g=makeUnit('deepcleft','ally',500,700,30,{owned:false}); g._bodyR=30; g.anim=BATTLE_ANIM.deepcleft; const d=FX2_DEF.deepcleft_green; out.claws=[];
    for(const left of [false,true]){ g._fxMirror=brk?false:left; const o={vk:'dclaws',d,u:g,t:0,ts:0}; o.s=fx16Show(o); fx2SetFrame(o.s,d,5); if(o.mir){ const v=o.s._uv; if(v[0]>0) o.s._uv=[-v[0],v[1],v[2]+v[0],v[3]]; }
      const ax=o.mir?1-d.anchor[0]:d.anchor[0], W=o.s.scale.x, cx=o.s.position.x, claw=wx(500+(left?-1:1)*30*d.reach);
      out.claws.push({left,uvSign:Math.sign(o.s._uv[0]),endX:+(cx+(ax-0.5)*W).toFixed(4),claw:+claw.toFixed(4),farX:+(cx-(ax-0.5)*W).toFixed(4),heroX:+wx(500).toFixed(4)}); }
    /* Bloodthirst / Last Stand (upright on him) */
    const v=makeUnit('vael','ally',500,700,30,{owned:false}); v.anim=BATTLE_ANIM.vael; out.up=[];
    for(const k of ['vael_blue','vael_ult']) for(const left of [false,true]){ v._fxMirror=brk?false:left; const o={d:FX2_DEF[k],u:v,s:fake()}; fx2SetFrame(o.s,o.d,3); _fx22Fx16Up(o);
      out.up.push({k,left,uvSign:Math.sign(o.s._uv[0]),cx:+o.s.center.x.toFixed(4),ax:o.d.anchor[0]}); }
    /* Soporific Bouquet: by the side its enemy is on */
    const m=makeUnit('mirelle','ally',500,700,30,{owned:false}); m.anim=BATTLE_ANIM.mirelle; out.bq=[];
    for(const left of [false,true]){ const e=makeUnit('tick','enemy',left?300:700,700,30,{owned:false}); const o={vk:'msleep',d:FX2_DEF.mirelle_blue,u:m,T:e,t:0,ts:0}; o.s=fx16Show(o); if(brk) o.mir=false;
      fx2SetFrame(o.s,o.d,4); _fx22Fx16On(o); out.bq.push({left,mir:!!o.mir,uvSign:Math.sign(o.s._uv[0]),cx:+o.s.center.x.toFixed(4),ax:o.d.anchor[0]}); }
  } finally{ _fx22Flat=_flat; _fx22Spr=_spr; }
  return JSON.stringify(out); })()`;
const facingOk = F => {
  const [cr, cl] = F.claws;
  const claws = cr.uvSign > 0 && cl.uvSign < 0 && Math.abs(cr.endX - cr.claw) < 1e-3 && Math.abs(cl.endX - cl.claw) < 1e-3 && cr.farX < cr.heroX && cl.farX > cl.heroX &&
    Math.abs((cr.heroX - cr.farX) - (cl.farX - cl.heroX)) < 1e-3;
  const up = [0, 2].every(i => { const r = F.up[i], l = F.up[i + 1]; return r.uvSign > 0 && l.uvSign < 0 && Math.abs(r.cx - r.ax) < 1e-6 && Math.abs(l.cx - (1 - l.ax)) < 1e-6; });
  const [br, bl] = F.bq;
  const bq = !br.mir && bl.mir && br.uvSign > 0 && bl.uvSign < 0 && Math.abs(br.cx - br.ax) < 1e-6 && Math.abs(bl.cx - (1 - bl.ax)) < 1e-6;
  return { claws, up, bq };
};
const CAST = (K, kind) => `(()=>{ units=[]; ended=false; paused=false; battleTime=0; groundHazards.length=0; seedBattle(9); if(typeof clearFx1123==='function') clearFx1123();
  const g=makeUnit('${K}','ally',420,700,30,{owned:false,rank:3}); const a=makeUnit('vael','ally',520,660,30,{owned:false}); const e=makeUnit('tick','enemy',700,700,30,{owned:false}); const e2=makeUnit('sylthaine','enemy',760,740,30,{owned:false});
  units=[g,a,e,e2]; units.forEach(u=>{ try{ buildFigure(u); }catch(_e){} }); units.forEach(u=>{u.maxHp=u.hp=1e9; u.energy=0;}); a.hp=a.maxHp*0.4; [a,e,e2].forEach(x=>{x.atkInterval=99; x.atkCd=99; x.greenCd=x.blueCd=99; x.speed=0;}); g.atkCd=99; g.speed=0; g.target=e;
  g._castSM=1; g._castLv=1; const tr=[];
  if('${kind}'==='ult'){ g.energy=100; castAbility(g); } else castKit(g,'${kind}'==='blue'?(g.blueAb||KITS.${K}.blue):(g.greenAb||KITS.${K}.green));
  for(let i=0;i<Math.round(6/SIM_STEP);i++){ updateBattle(SIM_STEP); g.greenCd=g.blueCd=99; g.atkCd=99; tr.push(units.map(u=>[u.key,Math.round(u.hp),Math.round(u.x*10),Math.round(u.y*10),+(u.stunned||0).toFixed(2),Math.round(u.shield||0),+(u._shredT||0).toFixed(2)].join(':')).join('|')); }
  return tr.join('#'); })()`;
const fight = (r, seed, a, f) => H(r(`(()=>{ window._p2guard=true; const svA=autoUlt; autoUlt=true;
    try{ ended=false; state='battle'; CUR={mode:'replay',seed:${seed}}; battleTime=0; gameSpeed=1; groundHazards.length=0; seedBattle(${seed});
      units=[]; ${JSON.stringify(a)}.forEach((k,i)=>units.push(makeUnit(k,'ally',300+i*40,600+i*90,30,{owned:false,rank:3})));
      ${JSON.stringify(f)}.forEach((k,i)=>units.push(makeUnit(k,'enemy',900+i*40,600+i*90,30,{owned:false,rank:3})));
      units.forEach(u=>buildFigure(u));
      const tr=[]; for(let i=0;i<Math.round(45/SIM_STEP)&&!ended;i++){ updateBattle(SIM_STEP); tr.push(units.map(u=>[u.key,Math.round(u.hp*100),Math.round(u.x*10),Math.round(u.y*10),u.alive?1:0].join(':')).join('|')); }
      return tr.length+'@'+tr.join('#'); } finally{ autoUlt=svA; window._p2guard=false; } })()`));
try {
  ck('control file (BASE ' + BASE_SHA + ', the live build) loaded', !!R0);
  { const html = fs.readFileSync(HTML, 'utf8'); let n = 0, bad = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new vm.Script(m[1]); } catch (e) { bad.push(n + ': ' + e.message); } }
    ck('every inline <script> block parses (' + n + ')', n > 0 && bad.length === 0, bad.join('; ')); }
  const src = fs.readFileSync(HTML, 'utf8');
  // 1. facing
  const F = JSON.parse(run(FACE(false))), ok = facingOk(F);
  ck('Fault Claws flips with his facing: as painted facing right (UV +), mirrored facing left (UV -); its right end on his claws either side and the slashes behind him on his own side, the same length each way: ' + JSON.stringify(F.claws), ok.claws, JSON.stringify(F.claws));
  ck('Bloodthirst and Last Stand flip with his facing: UV sign + / -, anchor x = a / 1 - a: ' + JSON.stringify(F.up), ok.up, JSON.stringify(F.up));
  ck('Soporific Bouquet flips with its enemy\'s side: as painted on her right, mirrored on her left (UV - and anchor 1 - a): ' + JSON.stringify(F.bq), ok.bq, JSON.stringify(F.bq));
  ck('Warcry has no direction to flip: a radially symmetric top-down disc, drawn the same either way', run("FX16_ART.vwarcry.mode") === 'disc' && !!run('FX2_DEF.vael_green.disc') && Math.abs(run('FX2_DEF.vael_green.disc.cx') - 0.5) < 1e-6);
  { const C = facingOk(JSON.parse(run(FACE(true))));
    ck('CONTROL: the same checks on painters forced to ignore the facing FAIL for all three (claws ' + C.claws + ', upright ' + C.up + ', bouquet ' + C.bq + ')', !C.claws && !C.up && !C.bq); }
  // 2. plumage
  const D = JSON.parse(run('JSON.stringify(FX2_DEF.mirelle_ult)')), D0 = JSON.parse(R0('JSON.stringify(FX2_DEF.mirelle_ult)'));
  ck('Imperial Plumage: badgeH 0.45 x the unit height across (in [0.4, 0.5], err small); the same sheet, timing and play-once (dur, hold, n) as BASE',
    D.badgeH === 0.45 && D.u === D0.u && D.dur === D0.dur && D.hold === true && D0.hold === true && D.n === D0.n && JSON.stringify(Object.assign({}, D, { badgeH: undefined })) === JSON.stringify(D0));
  const S = run('JSON.stringify([FEET_BADGE_H])');
  ck('the badge sizing reads badgeH: over the bar upSize = badgeH x 0.95 (S = th x upSize / 0.95 = 0.45 th), at the feet the same (BASE: 0.8 and ' + (JSON.parse(S)[0] * 0.95).toFixed(4) + ' x min(1, fw/fh))',
    /upSize:\(d\.badgeH>0\?d\.badgeH\*0\.95:FEET_BADGE_H\*0\.95\*Math\.min\(1,d\.fw\/d\.fh\)\)/.test(src) && /upSize:\(window\._fxBadgeSize\|\|\(d\.badgeH>0\?d\.badgeH\*0\.95:0\.8\)\)/.test(src));
  ck('the fieldWide loop hands every badgeH badge it spawned to fxBadgeSpread (shrink overlapping pairs about their anchors, down to 0.3, with a gap)',
    /if\(FX2_DEF\[o\.gfx\]&&FX2_DEF\[o\.gfx\]\.badgeH>0\) fxBadgeSpread\(_spread\)/.test(src) && /function fxBadgeSpread\(list\)/.test(src) && /Math\.max\(0\.3,lo\*0\.88\)/.test(src));
  ck('only Imperial Plumage carries badgeH (no other sheet changes size)', JSON.parse(run('JSON.stringify(Object.keys(FX2_DEF).filter(k=>FX2_DEF[k].badgeH))')).join() === 'mirelle_ult');
  const others = r => r("JSON.stringify(Object.keys(FX2_DEF).filter(k=>k!=='mirelle_ult').map(k=>[k,FX2_DEF[k]]))");
  ck('every other FX2_DEF entry is byte-for-byte BASE', H(others(run)) === H(others(R0)));
  { const stage = fs.readFileSync(path.join(ROOT, 'assets/ui/skill-preview-stage.js'), 'utf8');
    ck('the Skills-tab preview sizes the badges the same way (badgeH) and the page loads the stage at a new ?v= (sp1181)', (stage.match(/d\.badgeH>0\?d\.badgeH\*0\.95/g) || []).length === 2 && src.includes('skill-preview-stage.js?v=sp1181')); }
  // 3. display only
  for (const [K, kind] of [['mirelle', 'ult'], ['deepcleft', 'green'], ['vael', 'blue']]) ck(`${K} ${kind}: a cast is tick-identical to BASE for 6 s`, H(run(CAST(K, kind))) === H(R0(CAST(K, kind))));
  { const T = [[11, ['mirelle', 'vael', 'tick', 'lumi', 'korvux'], ['grosk', 'vireo', 'sylthaine', 'carn', 'hollow']], [5, ['deepcleft', 'mirelle'], ['vael', 'umbris', 'nox']]];
    const a = T.map(([s, x, y]) => fight(run, s, x, y)), b = T.map(([s, x, y]) => fight(R0, s, x, y));
    ck('whole fights (a 5v5 with Mirelle; Deepcleft + Mirelle vs Vael) are tick-identical to BASE', JSON.stringify(a) === JSON.stringify(b));
    run("globalThis.__m=ULT_DEF.plumage.heal; ULT_DEF.plumage.heal*=0.5; 1"); const c = fight(run, T[0][0], T[0][1], T[0][2]); run('ULT_DEF.plumage.heal=globalThis.__m; 1');
    ck('CONTROL: the 5v5 with the plumage heal halved is NOT identical', c !== b[0]); }
  ck('no emoji added', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src.slice(src.indexOf('function fxBadgeSpread'), src.indexOf('function fxBadgeSpread') + 2500)));
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
