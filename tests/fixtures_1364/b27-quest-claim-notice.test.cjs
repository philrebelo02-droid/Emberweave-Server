const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(process.argv[2], 'emberweave-heroes.html'), 'utf8');
const start = html.indexOf('function showQuestClaim(');
const claim = html.indexOf('function claimQuest(q)');
const code = html.slice(start < 0 ? claim : start, html.indexOf('/* 30 Aug', claim));
const notices = [];
const notice = {innerHTML:''};
let timer;
const ctx = vm.createContext({
  G:{questClaimed:{}}, ACC:{}, state:'quest', document:{getElementById:() => notice},
  bannerMsg:msg => notices.push(msg), uiIcon:() => 'Check',
  t:(key,args) => args.title+' claimed!', ledCapture:(key,fn) => fn(),
  saveG() {}, updateHubChrome() {}, updateMailBadges() {}, renderQuests() {},
  setTimeout: fn => {timer=fn; return 1;}, clearTimeout() {}
});
vm.runInContext(code, ctx);
ctx.claimQuest({id:'squad', ready:true, title:'Choose your first squad',claim:() => '500 gold'});
assert.equal(notices.length, 0, 'quest reward does not use the overlay banner');
assert.equal(notice.innerHTML, 'Check Choose your first squad claimed!<br>500 gold');
assert.ok(html.indexOf('id="questClaimNotice"') < html.indexOf('id="questBody"'));
timer();
assert.equal(notice.innerHTML, '');
