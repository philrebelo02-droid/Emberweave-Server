'use strict';
// v1342 Rafe's Pirate's Instinct (Phil 10 Nov: "It should go up from like 50 at level 1 and raise to 200 at 100"): the bonus true damage on every 4th
// attack became instinctPct(lv) = 50% .. 200%, and the kit text says so. undoRafeInstinct1342(run) puts the old rule back in a loaded page
// (0.45 x the passive multiplier, the old kit text) so older BASE fight checks keep testing what they were written for. Safe on an older page.
const CODE = `(()=>{ let n=0; try{ if(typeof instinctDmg==='function'){ instinctDmg=function(u){ return 0.45*(u.passMul||1); }; n++; } }catch(e){}
  try{ if(typeof KITS!=='undefined'&&KITS.rafe&&KITS.rafe.purple){ KITS.rafe.purple.desc="Every few shots, the next attack ignores part of the target's Defense."; n++; } }catch(e){}
  return n; })()`;
module.exports = { undoRafeInstinct1342: run => run(CODE) };
