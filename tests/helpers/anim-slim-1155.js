'use strict';
// v1155 animation slim (tests/fixtures/anim_slim_1155.json): the per-hero animation tests of earlier releases check their own hero's clips
// byte-for-byte against the release they shipped in. undoSlim1155(run) puts the v1153 entries back in a loaded page (BATTLE_ANIM states,
// FX2_DEF keys, HERO_SKILL_CLIPS slots) so those checks keep testing what they were written for; tests/test_anim_slim_1155.js checks the
// slim itself (every entry, pixel-exact cells, and whole fights tick-identical to v1153).
const fs = require('fs'), path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'anim_slim_1155.json'), 'utf8'));
const CODE = `(()=>{ const F=${JSON.stringify({ c: FIX.changes, s: FIX.skillClips || [], o: FIX.order || {}, so: FIX.scOrder || {} })};
  for(const c of F.c){ const T=c.kind==='anim'?BATTLE_ANIM:FX2_DEF;
    if(c.kind==='anim'){ if(!T[c.key]) T[c.key]={}; if(c.before) T[c.key][c.state]=JSON.parse(JSON.stringify(c.before)); else delete T[c.key][c.state]; }
    else { if(c.before) T[c.key]=JSON.parse(JSON.stringify(c.before)); else delete T[c.key]; } }
  for(const s of F.s){ if(!HERO_SKILL_CLIPS[s.key]) HERO_SKILL_CLIPS[s.key]={}; if(s.before) HERO_SKILL_CLIPS[s.key][s.slot]=JSON.parse(JSON.stringify(s.before)); else delete HERO_SKILL_CLIPS[s.key][s.slot]; }
  const re=(T,k,ord)=>{ const o=T[k]; if(!o) return; const n={}; for(const x of ord) if(x in o) n[x]=o[x]; for(const x in o) if(!(x in n)) n[x]=o[x];
    for(const x of Object.keys(o)) delete o[x]; Object.assign(o,n); };
  for(const k in F.o) re(BATTLE_ANIM,k,F.o[k]); for(const k in F.so) re(HERO_SKILL_CLIPS,k,F.so[k]);
  return F.c.length; })()`;
module.exports = { undoSlim1155: run => run(CODE), SLIM_1155: FIX };
