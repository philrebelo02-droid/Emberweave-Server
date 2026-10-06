'use strict';
// v1044 Grok fx2 batch (Phil 6 Oct 2026: "there is also a couple of spells grok did" / "finish them all then deploy"): fifteen accepted
// spell clips (md5 matched against Grok's handoff) wired as 320 px plates. Each sheet must exist at the size its def declares, each
// spell's display time must equal its sheet's length (or the plate dies part-way through the clip), and the two passive hooks that
// Phil OK'd must fire their plates: Perfect Pitch over each ally it shields, Deep Reserves every 6 s while it heals.
(function main() {
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const host = require(path.join(ROOT, 'server/sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
const run = src => vm.runInContext(src, host.ctx);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
function webpSize(p) {   // VP8L (lossless) or VP8 (lossy) header
  const b = fs.readFileSync(p); const tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  return null;
}
try {
  const KEYS = ['vulmar_green', 'vireo_green', 'vireo_blue', 'vireo_passive', 'maren_green', 'maren_ult', 'maren_passive', 'rhukk_ult', 'rhukk_passive',
    'orryn_green', 'orryn_blue', 'orryn_ult', 'pellucid_green', 'pellucid_blue', 'pellucid_ult'];
  const D = run(`(${JSON.stringify(KEYS)}).map(k=>[k,FX2_DEF[k]])`);
  for (const [k, d] of D) {
    const f = path.join(ROOT, 'assets/anim/fx', k + '.webp');
    const sz = fs.existsSync(f) ? webpSize(f) : null;
    ck(k + ': v1044 sheet, 48 frames, file matches its def', d && /\?v=30$/.test(d.u) && d.n === 48 && d.cols === 6 && d.rows === 8 && sz && sz[0] === d.fw * 6 && sz[1] === d.fh * 8,
      JSON.stringify({ u: d && d.u, fw: d && d.fw, fh: d && d.fh, sz }));
  }
  // the spell's display time = the sheet's length, so the whole clip plays
  const G = run(`({vulmar_green:KITS.vulmar.green.gdur, vireo_green:KITS.vireo.green.gdur, vireo_blue:KITS.vireo.blue.gdur, maren_green:KITS.maren.green.gdur,
    maren_ult:HERO_ULT_ART.maren.gdur, rhukk_ult:HERO_ULT_ART.rhukk.gdur, orryn_green:KITS.orryn.green.gdur, orryn_blue:KITS.orryn.blue.gdur, orryn_ult:HERO_ULT_ART.orryn.gdur,
    pellucid_green:KITS.pellucid.green.gdur, pellucid_blue:KITS.pellucid.blue.gdur, pellucid_ult:HERO_ULT_ART.pellucid.gdur})`);
  for (const k in G) { const d = D.find(x => x[0] === k)[1]; ck(k + ': display time ' + G[k] + ' s = sheet length', d && Math.abs(d.dur - G[k]) < 1e-9, 'sheet ' + (d && d.dur)); }
  // the passive hooks fire their plates (firePassiveFx is counted, not drawn - no scene on the server)
  const P = run(`(()=>{ const calls=[]; const keep=firePassiveFx; firePassiveFx=(u,t,o)=>{ calls.push([u.key,t&&t.key,!!(o&&o.aboveBar)]); return true; };
    try{ units=[]; ended=false; paused=false; battleTime=0;
      const v=makeUnit('vireo','ally',300,700,20,{owned:false}), a=makeUnit('grosk','ally',340,700,20,{owned:false}), e=makeUnit('brannus','enemy',700,700,20,{owned:false});
      units=[v,a,e]; units.forEach(u=>{u.maxHp=u.hp=1e7;}); v.pass=Object.assign({},v.pass||{},{perfectpitch:true});
      doEffect(v,'crescendo',KITS.vireo.green); const pitch=calls.splice(0);
      v.pass={}; doEffect(v,'crescendo',KITS.vireo.green); const noPitch=calls.splice(0);
      const m=makeUnit('maren','ally',300,700,20,{owned:false}); units=[m,e]; m.maxHp=1e7; m.pass=Object.assign({},m.pass||{},{tidereserve:true});
      m.hp=m.maxHp*0.5; for(let i=0;i<Math.ceil(6.2/SIM_STEP);i++) updateBattle(SIM_STEP); const hurt=calls.splice(0).filter(c=>c[0]==='maren');
      m.hp=m.maxHp; m._drFxT=0; for(let i=0;i<Math.ceil(6.2/SIM_STEP);i++){ m.hp=m.maxHp; updateBattle(SIM_STEP); } const full=calls.splice(0).filter(c=>c[0]==='maren');
      return {pitch, noPitch, hurt, full};
    } finally { firePassiveFx=keep; } })()`);
  ck('Perfect Pitch: a plate over each ally the Crescendo shield lands on (above the bar)', P.pitch.length === 2 && P.pitch.every(c => c[0] === 'vireo' && c[2]), JSON.stringify(P.pitch));
  ck('...and none without the passive', P.noPitch.length === 0);
  ck('Deep Reserves: one pulse over his bar within 6 s while it heals him', P.hurt.length === 1 && P.hurt[0][2], JSON.stringify(P.hurt));
  ck('...and none at full health', P.full.length === 0, JSON.stringify(P.full));
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
