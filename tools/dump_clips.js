(function(){
// v1141: node tools/dump_clips.js <worktree> <out.json|-> - every battle clip and spell-effect sheet table from the page, read through the
// server's own sim-host loader (the same code the replay runs), so the condense build and its test see exactly what the game declares.
const path = require('path'), vm = require('vm'), fs = require('fs');
const WT = path.resolve(process.argv[2]);
const h = require(path.join(WT, 'server/sim-host.js')).load(path.join(WT, 'emberweave-heroes.html'));
const out = JSON.parse(vm.runInContext(`(()=>{ const o=[];
  for(const k in BATTLE_ANIM){ const s=BATTLE_ANIM[k]; for(const st in s){ const c=s[st]; if(c&&c.u&&c.fw) o.push(Object.assign({key:k,st,mon:!!(typeof MONSTER_TYPES!=='undefined'&&MONSTER_TYPES[k]&&!(typeof HERO_TYPES!=='undefined'&&HERO_TYPES[k]))},
    JSON.parse(JSON.stringify(c)))); } }
  const f=[]; for(const n in FX2_DEF){ f.push(Object.assign({key:n,kind:'fx2'},JSON.parse(JSON.stringify(FX2_DEF[n])))); }
  const p=[]; for(const n in FX_PLATE_DEF){ p.push(Object.assign({key:n,kind:'plate'},JSON.parse(JSON.stringify(FX_PLATE_DEF[n])))); }
  return JSON.stringify({clips:o,fx2:f,plates:p}); })()`, h.ctx));
if (process.argv[3] === '-') { process.stdout.write(JSON.stringify(out)); return; }
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log('clips', out.clips.length, 'monster clips', out.clips.filter(c => c.mon).length, 'fx2', out.fx2.length, 'plates', out.plates.length);
})();
