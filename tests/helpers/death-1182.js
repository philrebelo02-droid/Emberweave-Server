'use strict';
// v1182 hero deaths - undoDeath1182(run) takes every DEATH state back out of a loaded page (BATTLE_ANIM <hero>: death, death2 .. - the first four of
// v1182 and every batch after), so the older per-hero, slim, condense and whole-table tests keep comparing what they were written for (a BASE before
// the death type). Display only: nothing else changed in the tables. Safe on any page (an older page has no death state). tests/test_death_state.js checks it.
const CODE = `(()=>{ if(typeof BATTLE_ANIM==='undefined') return 0; let n=0;
  for(const k of Object.keys(BATTLE_ANIM)){ const s=BATTLE_ANIM[k]; if(!s) continue;
    for(const st of Object.keys(s)) if(/^death\\d*$/.test(st)&&s[st]&&/_death\\d*_\\d{4}\\.webp/.test(s[st].u||'')){ delete s[st]; n++; } }
  return n; })()`;
module.exports = { undoDeath1182: run => run(CODE) };
