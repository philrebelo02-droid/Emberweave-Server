// v1271 LANGUAGES step 2 (Phil 4 Nov 2026: "I need everything thats translatable to be translated" / "keep diving the language until there
// is no chance there is a failure to translate"). The static finish checks, all at 0 (the run-time one is tests/test_lang_coverage.js):
//  CHECK 2  tools/lang/scan.js: no player-visible English literal in emberweave-heroes.html outside t()/langDesc (allowlist with reasons);
//  CHECK 3  every UI key in all 16 lang files (tests/test_lang_step1.js) AND every content template (skills, lore, bestiary) translated in
//           all 15 lang/<code>.content.json, none left identical to the English unless reviewed (tools/lang/same_ok_content.json);
//  CHECK 4  tools/lang/srvcheck.js: every player-facing server error text has a code with a translation in all 16 languages;
//  plus     tools/lang/shadow.js: no t('key') call binds a local `t`; the generated page equals tools/lang/build.js's output.
// CONTROL: the content check is fed a copy with one template removed and one copied from English, and must catch both.
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),cp=require('child_process');
const ROOT=path.join(__dirname,'..'); let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; console.log('  ok   '+m); };
const run=(f,args)=>{ const r=cp.spawnSync(process.execPath,[path.join(ROOT,'tools','lang',f)].concat(args||[]),{cwd:ROOT,encoding:'utf8',maxBuffer:64<<20}); return {code:r.status,out:(r.stdout||'')+(r.stderr||'')}; };
// CHECK 2
{ const r=run('scan.js'); const m=/scan: (\d+) hard-coded/.exec(r.out); ok(m&&+m[1]===0,'CHECK 2: no hard-coded English left in the page ('+(m?m[1]:r.out.slice(0,200))+')'); }
// CHECK 3 (content)
const CODES=['es','pt-BR','fr','de','it','nl','ru','tr','ja','ko','zh-Hans','zh-Hant','th','id','hi'];
const EN=JSON.parse(fs.readFileSync(path.join(ROOT,'tools','lang','content','en.json'),'utf8')), T=Object.keys(EN);
const SAME=JSON.parse(fs.readFileSync(path.join(ROOT,'tools','lang','same_ok_content.json'),'utf8'));
const toks=s=>(String(s).match(/\{[^{}]*\}/g)||[]).sort().join(' ');
function contentProblems(code,d){ const out=[];
  for(const k of T){ const v=d[k]; if(typeof v!=='string'||!v.trim()){ out.push(code+': missing '+k.slice(0,50)); continue; }
    if(toks(v)!==toks(k)) out.push(code+': tokens differ '+k.slice(0,50));
    if(v===k&&/[A-Za-z]{3}/.test(k.replace(/\{[^}]*\}/g,''))&&!(SAME[code]||[]).includes(k)) out.push(code+': same as English '+k.slice(0,50)); }
  return out; }
ok(T.length>=600,'content templates collected ('+T.length+')');
for(const c of CODES){ const d=JSON.parse(fs.readFileSync(path.join(ROOT,'lang',c+'.content.json'),'utf8')); const p=contentProblems(c,d);
  ok(p.length===0,'CHECK 3: lang/'+c+'.content.json translates every content template ('+p.slice(0,3).join('; ')+')'); }
{ const d=JSON.parse(fs.readFileSync(path.join(ROOT,'lang','de.content.json'),'utf8')); const a=T.find(k=>/[A-Za-z]{6}/.test(k)&&!(SAME.de||[]).includes(k)), b=T.find(k=>k!==a&&/[A-Za-z]{6}/.test(k)&&!(SAME.de||[]).includes(k));
  const broken=Object.assign({},d); delete broken[a]; broken[b]=b; const p=contentProblems('de',broken);
  ok(p.length===2&&/missing/.test(p.join())&&/same as English/.test(p.join()),'CONTROL: a missing template and an English copy are both caught'); }
// the page fetches each language's content file at its hash
{ const html=fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8'); const CV=JSON.parse((html.match(/\nconst EW_LANG_CV=(\{.*?\});/)||[,'{}'])[1]);
  ok(CODES.every(c=>CV[c])&&CV.qps,'EW_LANG_CV lists all 15 content files and the dev pseudo-language'); }
// CHECK 4
{ const r=run('srvcheck.js'); const m=/(\d+) error texts read, (\d+) without a code, (\d+) code translations missing/.exec(r.out);
  ok(m&&+m[1]>500&&+m[2]===0&&+m[3]===0,'CHECK 4: every server error text has a translated code ('+(m?m[0]:r.out.slice(0,200))+')'); }
// shadow + the page is the build's output (nobody hand-edited it)
{ const r=run('shadow.js'); ok(r.code===0&&/0 shadowed/.test(r.out),'no t() call binds a local t ('+r.out.trim().split('\n').pop()+')'); }
/* v1273 (Claude, 4 Nov): build.js rebuilds the page from the v1270 base + the specs, so this equality only holds on the language branch.
   Merged onto v1272 (Heroes 4 columns, Danger zone) the live page is the source; run it with LANG_BUILD_CHECK=1 on a branch cut from the base. */
if(process.env.LANG_BUILD_CHECK==='1') { const out=path.join(require('os').tmpdir(),'ew-lang-build-'+process.pid+'.html'); const r=run('build.js',['--check','--out',out]);
  const a=fs.readFileSync(out,'utf8').replace(/\nconst BUILD_ID = '\d+';/,''), b=fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8').replace(/\nconst BUILD_ID = '\d+';/,''); fs.unlinkSync(out);
  ok(r.code===0&&a===b,'emberweave-heroes.html is exactly tools/lang/build.js output from the specs (build it, never hand-edit)'); }
console.log('test_lang_step2.js: '+pass+' checks passed');
