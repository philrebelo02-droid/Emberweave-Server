// v1368 (Ember BUG SWEEP 10-1, checked by Claude against server.js 7776-7778): the mine panel showed the full haul even when the mine had less
// than one haul of stock left, while the server pays take*minerMul. The panel now shows what the server pays. CONTROL: v1367 ignores stock.
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'); const ROOT=path.join(__dirname,'..');
let P=0,F=0; const ck=(n,c,x)=>{ if(c){P++;console.log('  ok   '+n);} else {F++;console.log('  FAIL '+n+(x?' - '+x:''));} };
const load=src=>{ const a=src.indexOf('function mineYieldShown('); const e=src.indexOf('\n',src.indexOf('return',a+40)); const fn=src.slice(a,src.indexOf('}',src.lastIndexOf('return',src.indexOf('\nfunction ',a+10)))+1);
  const ctx={mineYield:(r,l)=>Math.round((40+l*55)*(1+(l-1)*0.18)*MUL), embassyMineMul:()=>MUL}; vm.runInNewContext(fn+';this.f=mineYieldShown;',ctx); return ctx.f; };
let MUL=1;
const base=L=>Math.round((40+L*55)*(1+(L-1)*0.18)), srvPays=(L,left)=>left>=base(L)?base(L):Math.round(left);   // minerMul = 1 here
const f=load(fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8'));
for(const [L,left] of [[1,base(1)*3],[3,base(3)],[3,100],[5,1],[10,base(10)-1]]) ck('L'+L+' with '+left+' stock left shows what the server pays ('+srvPays(L,left)+')', f('gold',L,{left,total:base(L)*3})===srvPays(L,left), String(f('gold',L,{left,total:base(L)*3})));
for(const mul of [1.05,1.1,1.15,1.2,1.25,1.3]){ MUL=mul; let bad=0,n=0; for(let L=1;L<=10;L++) for(let left=0;left<base(L);left++){ n++; const srv=Math.round(left*mul); if(f('gold',L,{left,total:base(L)*3})!==srv) bad++; } ck('guild x'+mul+': every partial-stock case ('+n+') matches the server rounding', bad===0, bad+' differ'); }
MUL=1;
ck('no stock info: the full haul as before', f('gold',3,{})===base(3) && f('gold',3)===base(3));
const old=load(cp.execSync('git show dc537165:emberweave-heroes.html',{cwd:ROOT,maxBuffer:64<<20}).toString());
ck('CONTROL: v1367 showed the full haul on a nearly empty mine', old('gold',3,{left:100,total:base(3)*3})===base(3));
console.log('test_mine_shown_1368.js: '+P+' passed, '+F+' failed'); process.exit(F?1:0);
