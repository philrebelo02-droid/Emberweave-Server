'use strict';
// Undo only this impact-alignment batch when older tests compare against BASE.
const base=require('../fixtures/hobb_impact_base_18oct.json');
exports.undoHobbImpact18Oct=run=>run(`(()=>{
 const b=${JSON.stringify(base)};
 Object.assign(BATTLE_ANIM.hobb,b.body);
 Object.assign(FX2_DEF,b.fx);
 HOBB_EDGE.splice(0,HOBB_EDGE.length,...b.edge);
})()`);
