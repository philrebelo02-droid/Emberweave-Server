const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(process.argv[2], 'emberweave-heroes.html'), 'utf8');
const i = html.indexOf('function introContinue(){');
assert.ok(i >= 0, 'manual continue action exists');
const button = {hidden:true,style:{},offsetWidth:120,offsetHeight:30};
const ctx = vm.createContext({
  CUR:{_introSay:{uid:1}}, state:'battle', ended:false, CW:844, CH:390,
  document:{getElementById:() => button}, t:() => 'Tap to continue'
});
vm.runInContext(html.slice(i,html.indexOf('function introDrawBubble()',i)),ctx);
for(const [x,y,w] of [[120,50,200],[610,60,200],[90,100,700],[90,345,700]]){
  ctx.introContinueButton(x,y,w);
  const l = parseFloat(button.style.left), t = parseFloat(button.style.top);
  assert.ok(l + 120 <= x || l >= x + w || t + 30 <= y || t >= y + 38, 'button clear of bubble');
}
ctx.introContinue();
assert.equal(ctx.CUR._introSay.read,true);
assert.equal(button.hidden,true);
assert.match(html,/if\(held&&last\) introContinueButton\(bx,by,w\)/);
assert.match(html,/S\.segs\.find\(g=>age>=g\.a&&age<g\.b\)/);
