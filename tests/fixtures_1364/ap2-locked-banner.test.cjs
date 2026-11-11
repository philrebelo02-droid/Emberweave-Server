const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(process.argv[2], 'emberweave-heroes.html'), 'utf8');
const start = html.indexOf('function bannerMsg(t)');
const code = html.slice(start, html.indexOf('// (matIcon deleted', start));
const classes = new Set();
let writes = 0;
const banner = {style:{}, set innerHTML(value) { this.text = value; writes++; },
  classList:{contains:name => classes.has(name), add:name => classes.add(name), remove:name => classes.delete(name)}};
const timers = new Map();
let seq = 0;
const ctx = vm.createContext({
  window:{}, rewardLocked:() => false, langMsg:x => x,
  document:{getElementById:() => banner,body:{children:[banner]}},
  setTimeout: fn => {timers.set(++seq, fn); return seq;}, clearTimeout:id => timers.delete(id)
});
vm.runInContext(code, ctx);
ctx.bannerMsg('Elite locked');
ctx.bannerMsg('Elite locked');
assert.equal(writes, 1, 'repeat tap must not restart the same animation');
ctx.bannerMsg('Veteran locked');
assert.equal(banner.text, 'Veteran locked');
assert.equal(timers.size, 1, 'only latest banner timer remains active');
assert.ok(classes.has('show'));
timers.get(seq)();
assert.ok(!classes.has('show'));
