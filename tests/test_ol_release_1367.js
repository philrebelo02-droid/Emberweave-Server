// v1367 memory audit (Phil 11 Nov 2026: "Check to make sure no mode slips through"): a live PvP match set OL.active and nothing cleared it,
// so evictBattleArtAll skipped for the rest of the session (and a host could not start a second match). Leaving battle/result ends it.
const fs=require('fs'),path=require('path'),cp=require('child_process'); const ROOT=path.join(__dirname,'..');
let P=0,F=0; const ck=(n,c)=>{ if(c){P++;console.log('  ok   '+n);} else {F++;console.log('  FAIL '+n);} };
const src=fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8');
const i=src.indexOf('function _showScreen('); const body=src.slice(i, src.indexOf('\nfunction ', i+20));
ck('show() ends a live PvP match when it leaves battle/result', /if\(name!=='battle'&&name!=='result'&&typeof OL!=='undefined'&&OL\.active\)\{ OL\.active=false;/.test(body));
ck('it runs before the screen-change memory release', body.indexOf('OL.active=false')>0 && body.indexOf('OL.active=false')<body.indexOf("if(name==='home') setTimeout(()=>{ try{ evictBattleArtAll()"));
const old=cp.execSync('git show 7e49f874:emberweave-heroes.html',{cwd:ROOT,maxBuffer:64<<20}).toString();
ck('CONTROL: v1365 never cleared OL.active', !/OL\.active\s*=\s*false/.test(old));
console.log('test_ol_release_1367.js: '+P+' passed, '+F+' failed'); process.exit(F?1:0);
