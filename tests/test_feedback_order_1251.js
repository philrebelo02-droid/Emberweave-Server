// v1251 (1 Nov 2026): a tester's suggestion (SoMalice, 31 Oct) sat behind ~1,100 unread sim-bot cheat flags - /api/ember/feedback
// gave Ember the OLDEST 100, so no player report ever reached her. Players' bugs and suggestions now come first, cheat flags after.
// Runs the route's own sort expression on a fixture. Asserts (non-zero exit). Control: FB_SRC=<pre-fix server.js> must FAIL.
const fs=require('fs'),path=require('path'),assert=require('assert');
const src=fs.readFileSync(process.env.FB_SRC||path.join(__dirname,'..','server.js'),'utf8');
const i=src.indexOf("p==='/api/ember/feedback' && req.method==='GET'"); assert(i>0,'route found');
const m=src.slice(i,i+800).match(/\.sort\(([^;]+?)\)\.slice\(0,100\)/); assert(m,'sort found');
const sort=eval('('+m[1]+')');
const items=[]; for(let k=0;k<150;k++) items.push({id:'c'+k,kind:'cheat',t:1000+k});
items.push({id:'player-bug',kind:'bug',t:9000},{id:'player-sug',kind:'suggestion',t:9500});
const out=items.slice().sort(sort).slice(0,100).map(x=>x.id);
assert(out[0]==='player-bug'&&out[1]==='player-sug','players\' reports come first: '+out.slice(0,3));
assert(out[2]==='c0','then the oldest cheat flags');
console.log('test_feedback_order_1251.js: 2 checks passed');
