// v1084/v1085 - exploit scan round 5 batch B + scan 6 review (static checks on the server source; a live nameSkeleton run):
//  #7 one replay per campaign / province battle attempt in flight - a second resolve WAITS for the first (v1085: no 409, the client read it as a loss);
//  #8 /api/pvp/attack limited per account before any account copy; #12 reports capped per IP per day (100, dev exempt);
//  scan 6: guildLogCap at top level, RL_MUL never NaN, look-alikes I/1/0, symbol-only guild names, no shield while your army is out,
//  a throttled chat join still gets a light history, the rename cost shown is the server's.
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..',process.env.AUD_SERVER||'server.js'),'utf8');
let pass=0,missed=[]; const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
ok(/const _simInflight=new Map\(\);/.test(src),'#7 an in-flight map of battle attempts exists');
ok(/if\(_simInflight\.has\(_ak\)\)\{ try\{ await _simInflight\.get\(_ak\); \}catch\(e\)\{\} \}/.test(src)&&/const _pr=simPrefetch\(_campaignSimCandidates\(me,b\)\); _simInflight\.set\(_ak,_pr\); try\{ await _pr; \} finally\{ _simInflight\.delete\(_ak\); \}/.test(src),'#7 a second campaign resolve waits for the running replay (no 409), and the slot is always freed');
ok(/const _pr=simPrefetch\(_provinceSimCandidates\(me,b\)\); _simInflight\.set\(_ak,_pr\);/.test(src),'#7 the same for the Training Province');
ok(!/This battle is already being settled/.test(src),'#7 no 409 "already being settled" answer remains');
ok(/if\(p==='\/api\/pvp\/attack'&&rateLimited\(req,'pvpatk:'\+me\.id,Math\.round\(20\*RL_MUL\),60000\)\)/.test(src),'#8 /api/pvp/attack: 20 a minute per account, before the account copies');
ok(/if\(!isDev\(me\)&&rateLimited\(req,'reportDay',100,86400000\)\)/.test(src),'#12 bug reports: 100 a day per IP, the dev bot exempt');
// scan 6
const i=src.indexOf('function guildLogCap('), tryWs=src.lastIndexOf("require('ws')", i);
ok(i>0&&i<src.indexOf("require('ws')"),'scan 6 #1 guildLogCap is declared at top level, before the ws block');
ok(/const RL_MUL=Math\.max\(1,\(\+\(process\.env\.RL_MUL\|\|\(process\.env\.CLOCK_FILE\?1000:1\)\)\)\|\|1\);/.test(src),'scan 6 #8 a non-number RL_MUL falls back to 1');
const conf=src.match(/const NAME_CONFUSABLE=\{[\s\S]*?\};/), sk=src.match(/function nameSkeleton\(n\)\{[^\n]*\n[^\n]*/);
const ctx={}; if(conf&&sk) vm.runInNewContext(conf[0]+'\n'+sk[0]+'\nthis.s=nameSkeleton;',ctx);
ok(ctx.s&&ctx.s('PhiI')===ctx.s('Phil')&&ctx.s('Phi1')===ctx.s('Phil')&&ctx.s('B0b')===ctx.s('Bob')&&ctx.s('Tom')!==ctx.s('Tim'),'scan 6 #5 capital I, 1 and 0 fold to l / o; different names stay different');
ok(/\|\|\(nameSkeleton\(name\)&&nameSkeleton\(g\.name\)===nameSkeleton\(name\)\)/.test(src),'scan 6 #5 two symbol-only guild names do not collide on an empty skeleton');
ok(/if\(\(me\.worldCityMarches\|\|\[\]\)\.some\(m=>m&&!m\.resolved&&\(\+m\.homeAt\|\|0\)>now\)\) return \{ok:false,error:'Your army is still out/.test(src),'scan 6 #6 no fresh shield while your own army is out');
ok(/const lite=a=>a\.slice\(-20\)\.map\(m=>\(\{who:m\.who,txt:m\.txt,t:m\.t\}\)\); return wsend\(ws,\{t:'chathist'/.test(src),'scan 6 #7 a throttled chat join still gets the last 20 lines (no chips)');
ok(/renames:u\.renames\|0, (patron:patronView\(u,led\), )?shields:/.test(src),'scan 6 #9 the ledger carries the server rename count');
if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
console.log('test_abuse_1084.js: '+pass+' checks passed, '+missed.length+' failed');
