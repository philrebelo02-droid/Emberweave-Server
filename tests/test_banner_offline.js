// 4 Oct 2026 re-audit (v1014, Guild #8 / Market #10): api() answers {error:'offline'} on a lost connection, and many screens did
// bannerMsg(d.error), so players read the raw word "offline". bannerMsg maps exactly that word (with or without a warning sign) to
// "Connection lost." once, for every site; any other text is shown as written. Runs the page's own bannerMsg with a stub banner.
// Asserts (non-zero exit). Control: AUD_PAGE=<pre-fix emberweave-heroes.html> must FAIL.
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const page=process.env.AUD_PAGE||path.join(__dirname,'..','emberweave-heroes.html'), src=fs.readFileSync(page,'utf8');
const a=src.indexOf('function bannerMsg(t)'), b=src.indexOf('\n// (matIcon deleted with MATS)',a); assert(a>0&&b>a,'bannerMsg found');
let pass=0, missed=[]; const ok=(c,m)=>{ if(process.env.AUD_PAGE&&!c){ missed.push(m); return; } assert(c,m); pass++; };
const el={innerHTML:'',classList:{remove(){},add(){}},offsetWidth:0};
const ctx={window:{}, document:{getElementById:()=>el}, rewardLocked:()=>false, queueBehindReward:()=>{}, setTimeout:()=>{}};
vm.createContext(ctx); vm.runInContext(src.slice(a,b)+';this.bm=bannerMsg;',ctx);
const show=t=>{ ctx.bm(t); return el.innerHTML; };
ok(show('offline')==='Connection lost.','the raw word becomes "Connection lost." ('+show('offline')+')');
ok(show('&#9888; offline')==='&#9888; Connection lost.','also behind a warning sign ('+show('&#9888; offline')+')');
ok(show('We are offline')==='We are offline','other text that merely contains the word is unchanged');
ok(show('Not enough gold.')==='Not enough gold.','ordinary messages are unchanged');
if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
console.log('test_banner_offline.js: '+pass+' checks passed, '+missed.length+' failed (page '+path.basename(page)+')');
