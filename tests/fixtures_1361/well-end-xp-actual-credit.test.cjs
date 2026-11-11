const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8');
const start=s.indexOf('function endXP('),end=s.indexOf('/* ---- the squad:',start);
assert(start>=0&&end>start);
const grant=vm.runInNewContext(s.slice(start,end)+'\ntypeof creditEndXP==="function"?creditEndXP:endXP;',{
 PCT:{normal:0.5},
});
const ctx={playerLevel:()=>99,D_TROOP_INC:{98:100},led:{px:98999998},me:{},ledAddPlayerXP:(l,n)=>{l.px=Math.min(l.px+n,99000000);}};
assert.equal(grant(ctx,'normal'),2);
assert.equal(ctx.led.px,99000000);
assert.equal(grant(ctx,'normal'),0);
