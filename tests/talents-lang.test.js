// Talent names and texts in the player's language (talents RC, 16 Nov 2026): lang/<code>.talents.json (tools/lang/talents_build.js).
// Checks, with no network and no source folder: each file is one line of JSON whose ?v= in the page (EW_LANG_TALV) is its hash; every hero /
// talent id in it exists in talents-data.js; every translated name / text carries the same numbers as today's English; the server serves the
// file; the page asks for it only from the Talents tab (never at language load) and falls back to English for anything it lacks.
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
let pass=0, fail=0; const ok=(c,m)=>{ if(c){ pass++; console.log('PASS '+m); } else { fail++; console.log('FAIL '+m); } };
const page=fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8');
const m=page.match(/\nconst EW_LANG_TALV=(\{.*?\});/); ok(!!m,'the page carries EW_LANG_TALV');
const V=m?JSON.parse(m[1]):{};
const D=require(path.join(ROOT,'talents-data.js')); const EN={};
for(const [k,h] of Object.entries(D.heroes)){ EN[k]={}; for(const tr of h.trees) for(const t of tr.talents) EN[k][t[0]]=[t[3],t[5]]; }
const ZEROS=[0x30,0x660,0x6F0,0x7C0,0x966,0x9E6,0xA66,0xAE6,0xB66,0xBE6,0xC66,0xCE6,0xD66,0xE50,0xED0,0xF20,0x1040,0x17E0,0x1810,0xFF10];
const asciiDigits=s=>String(s).replace(/\p{Nd}/gu,c=>{ const p=c.codePointAt(0); for(const z of ZEROS) if(p>=z&&p<z+10) return String(p-z); return c; });
const NUM=/\d{1,3}(?:[   ]\d{3})+(?!\d)|\d+(?:[.,]\d+)*/g;
const nums=s=>(asciiDigits(s).match(NUM)||[]).map(x=>x.replace(/[   .,]/g,'')).sort().join(' ');
const CODES=['es','pt-BR','fr','de','it','nl','ru','tr','ja','ko','zh-Hans','zh-Hant','th','id','hi'];
const files=fs.readdirSync(path.join(ROOT,'lang')).filter(f=>f.endsWith('.talents.json')).map(f=>f.slice(0,-'.talents.json'.length));
ok(files.every(c=>CODES.includes(c)),'only known languages have a talents file ('+files.join(',')+')');
ok(JSON.stringify(Object.keys(V).sort())===JSON.stringify(files.slice().sort()),'EW_LANG_TALV names exactly the talents files on disk');
for(const c of files){ const raw=fs.readFileSync(path.join(ROOT,'lang',c+'.talents.json'),'utf8');
  ok(!/\n/.test(raw),c+'.talents.json is one line');
  ok(crypto.createHash('sha1').update(raw).digest('hex').slice(0,8)===V[c],c+'.talents.json ?v= is the hash of its text');
  let d=null; try{ d=JSON.parse(raw); }catch(e){} ok(!!d&&typeof d==='object',c+'.talents.json is JSON');
  const bad=[], badN=[]; let n=0;
  for(const [hk,tl] of Object.entries(d||{})) for(const [id,v] of Object.entries(tl||{})){ n++;
    const en=EN[hk]&&EN[hk][id]; if(!en||!Array.isArray(v)||v.length!==2){ bad.push(hk+'/'+id); continue; }
    if(typeof v[0]==='string'&&nums(v[0])!==nums(en[0])) badN.push(hk+'/'+id+' name');
    if(typeof v[1]==='string'&&nums(v[1])!==nums(en[1])) badN.push(hk+'/'+id+' text'); }
  ok(bad.length===0,c+': every one of '+n+' entries is a talent of talents-data.js, as [name, text] ('+bad.slice(0,5).join(', ')+')');
  ok(badN.length===0,c+': every translated name / text has the English numbers ('+badN.slice(0,5).join(', ')+')'); }
const srv=fs.readFileSync(path.join(ROOT,'server.js'),'utf8'); const rm=srv.match(/if\((\/\^\\\/lang\\\/[^\n]*?\$\/)\.test\(p\)\)/);
let re=null; try{ re=rm&&eval(rm[1]); }catch(e){}
ok(!!re&&re.test('/lang/de.talents.json')&&re.test('/lang/zh-Hans.talents.json')&&re.test('/lang/de.json')&&!re.test('/lang/de.talents.json.bak'),'server.js serves /lang/<code>.talents.json');
// the page side: the lookup in a small context
const i=page.indexOf('const TAL_LANG='), j=page.indexOf('function talentText'); ok(i>0&&j>i,'the page has the talent text lookup');
const ctx={LANG:{cur:'de'},heroTab:'talents',detailHero:'x',EW_LANG_TALV:{de:'h1'},urls:[],redraws:0,renderHeroDetail(){ ctx.redraws++; },
  fetch:u=>{ ctx.urls.push(u); return Promise.resolve({ok:true,json:()=>Promise.resolve({vael:{[D.heroes.vael.trees[0].talents[0][0]]:['NAME-DE',null]}})}); }};
vm.createContext(ctx); vm.runInContext(page.slice(i,page.indexOf('\n',j)),ctx);
const t0=D.heroes.vael.trees[0].talents[0], t1=D.heroes.vael.trees[0].talents[1];
ctx.a={id:t0[0],name:t0[3],text:t0[5]}; ctx.b={id:t1[0],name:t1[3],text:t1[5]};
ok(vm.runInContext("talentName('vael',a)",ctx)===t0[3],'before the file arrives: English');
vm.runInContext('talentLangLoad(); talentLangLoad();',ctx);
(async()=>{
  const settle=()=>new Promise(setImmediate);
  await settle();
  ok(ctx.urls.length===1&&ctx.urls[0]==='/lang/de.talents.json?v=h1','one fetch, at ?v=: '+ctx.urls.join(','));
  ok(ctx.redraws===1,'the open Talents tab is drawn again when the file arrives');
  ok(vm.runInContext("talentName('vael',a)",ctx)==='NAME-DE','a translated name is shown');
  ok(vm.runInContext("talentText('vael',a)",ctx)===t0[5],'a missing text is English');
  ok(vm.runInContext("talentName('vael',b)",ctx)===t1[3],'a talent with no entry is English');
  ctx.LANG.cur='en'; ok(vm.runInContext("talentName('vael',a)",ctx)===t0[3],'English players see English');
  ctx.LANG.cur='fr'; vm.runInContext('talentLangLoad()',ctx); ok(ctx.urls.length===1&&vm.runInContext("talentName('vael',a)",ctx)===t0[3],'a language with no file: no fetch, English');
  const langLoad=page.slice(page.indexOf('function langLoad('),page.indexOf('function langSet('));
  ok(!/talents\.json|talentLangLoad/.test(langLoad),'the language switch itself never fetches the talents file');
  ok(/function talentsTabHTML\(key\)\{ talentIconsLoad\(\); talentLangLoad\(\);/.test(page),'the Talents tab asks for it when drawn');
  ok(/escapeHTML\(talentName\(key,tl\)\)/.test(page)&&/escapeHTML\(talentText\(key,tl\)\)/.test(page)&&/talentTr\(key,id,0,x\[3\]\)/.test(page),'the talent card and the grid use the lookup');
  const pending=[];
  ctx.fetch=()=>new Promise(resolve=>pending.push(resolve));
  const load=code=>{ ctx.LANG.cur=code; ctx.talentLangLoad(); };
  const pack=name=>({ok:true,json:async()=>({vael:{[t0[0]]:[name,null]}})});
  const redraws=ctx.redraws;
  load('de');
  ctx.LANG.cur='en';
  pending[0](pack('RETAINED')); await settle();
  ok(ctx.redraws===redraws,'a background pack does not redraw English');
  load('de');
  ok(pending.length===1&&ctx.talentName('vael',ctx.a)==='RETAINED','returning to the locale uses its completed pack');
  ctx.EW_LANG_TALV.fr='h2';
  load('fr'); load('de'); load('fr');
  pending[3](pack('NEWEST')); await settle();
  pending[1](pack('SUPERSEDED')); pending[2](pack('OTHER')); await settle();
  ok(ctx.talentName('vael',ctx.a)==='NEWEST','an older response for the same language cannot overwrite the newest one');
  console.log('\n'+pass+' passed, '+fail+' failed');
  process.exitCode=fail?1:0;
})().catch(error=>{ console.error(error); process.exitCode=1; });
