// TALENT TEXTS IN THE PLAYER'S LANGUAGE (talents release candidate, 16 Nov 2026).
// ChatGPT's cumulative talent translations (one file per language: { heroKey: { talentId: {name, text} } }, plus en-XA.json = the
// English each one was translated from) become lang/<code>.talents.json = { heroKey: { talentId: [name|null, text|null] } }.
// The page fetches that file only when the Talents tab is drawn in that language (talentLangLoad) and shows the translation where
// one exists, English (talents-data.js) everywhere else. Display only: no rule, number or fight reads it.
// An entry is left out (English shown) when:
//   - its hero or talent id is not in talents-data.js;
//   - ChatGPT's English source (en-XA.json) for it is not today's English (the translation is of an older text);
//   - the numbers of a translated name / text differ from the English one's (separators and script digits normalised) - then that
//     half alone is dropped; nothing is ever "fixed" here.
// Usage: node tools/lang/talents_build.js [--src <folder>] [--check] [--md]
//   --check  write nothing, exit 1 if the files on disk differ from what would be written
//   --md     print the coverage table (Markdown) and every dropped entry
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..','..');
const arg=k=>{ const i=process.argv.indexOf(k); return i<0?null:(process.argv[i+1]||true); };
const SRC=(typeof arg('--src')==='string')?arg('--src'):'E:/Emberweave Archive/5 Crew/ChatGPT/Documents/2026-11-14/emberweave-talent-art-roster/outputs/talent-names-texts';
const CHECK=!!arg('--check'), MD=!!arg('--md');
const CODES=['es','pt-BR','fr','de','it','nl','ru','tr','ja','ko','zh-Hans','zh-Hant','th','id','hi'];
const D=require(path.join(ROOT,'talents-data.js'));
const EN={}; let TOTAL=0;
for(const [k,h] of Object.entries(D.heroes)){ EN[k]={}; for(const tr of h.trees) for(const t of tr.talents){ EN[k][t[0]]=[t[3],t[5]]; TOTAL++; } }
const HEROES=Object.keys(EN).length;
const readJ=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const XA=fs.existsSync(path.join(SRC,'en-XA.json'))?readJ(path.join(SRC,'en-XA.json')):{};

// numbers: every run of digits (any script's decimal digits read as 0-9), group / decimal separators removed, compared as a multiset
const ZEROS=[0x30,0x660,0x6F0,0x7C0,0x966,0x9E6,0xA66,0xAE6,0xB66,0xBE6,0xC66,0xCE6,0xD66,0xE50,0xED0,0xF20,0x1040,0x17E0,0x1810,0xFF10];
const asciiDigits=s=>String(s).replace(/\p{Nd}/gu,c=>{ const p=c.codePointAt(0); for(const z of ZEROS) if(p>=z&&p<z+10) return String(p-z); return c; });
const NUM=/\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?!\d)|\d+(?:[.,]\d+)*/g;
const nums=s=>(asciiDigits(s).match(NUM)||[]).map(m=>m.replace(/[ \u00a0\u202f.,]/g,'')).sort().join(' ');

const out={}, rows=[], dropped=[];
for(const c of CODES){ const f=path.join(SRC,c+'.json'); const d=fs.existsSync(f)?readJ(f):{}; const o={};
  let heroes=0, full=0, names=0, texts=0, both=0;
  for(const [hk,tl] of Object.entries(d)){ if(!EN[hk]||!tl||typeof tl!=='object'){ dropped.push([c,hk,'*','hero not in talents-data.js']); continue; }
    let got=0;
    for(const [id,v] of Object.entries(tl)){ const en=EN[hk][id]; if(!en){ dropped.push([c,hk,id,'talent not in talents-data.js']); continue; }
      const src=(XA[hk]||{})[id]; if(src&&(src.name!==en[0]||src.text!==en[1])){ dropped.push([c,hk,id,'translated from an older English text']); continue; }
      let n=(v&&typeof v.name==='string'&&v.name.trim())?v.name.trim():null, t=(v&&typeof v.text==='string'&&v.text.trim())?v.text.trim():null;
      if(n&&nums(n)!==nums(en[0])){ dropped.push([c,hk,id,'name numbers differ: en ['+nums(en[0])+'] vs ['+nums(n)+']']); n=null; }
      if(t&&nums(t)!==nums(en[1])){ dropped.push([c,hk,id,'text numbers differ: en ['+nums(en[1])+'] vs ['+nums(t)+']']); t=null; }
      if(!n&&!t) continue;
      (o[hk]=o[hk]||{})[id]=[n,t]; got++; if(n) names++; if(t) texts++; if(n&&t) both++; }
    if(got){ heroes++; if(got===Object.keys(EN[hk]).length) full++; } }
  const sorted={}; for(const hk of Object.keys(o).sort()){ sorted[hk]={}; for(const id of Object.keys(o[hk]).sort()) sorted[hk][id]=o[hk][id]; }
  out[c]=sorted; rows.push({c,heroes,full,names,texts,both}); }

const text={}, V={};
for(const c of CODES){ if(!Object.keys(out[c]).length) continue; text[c]=JSON.stringify(out[c]); V[c]=crypto.createHash('sha1').update(text[c]).digest('hex').slice(0,8); }
const PAGE=path.join(ROOT,'emberweave-heroes.html'); let page=fs.readFileSync(PAGE,'utf8');
const line='const EW_LANG_TALV='+JSON.stringify(V)+';';
const RE=/\nconst EW_LANG_TALV=\{.*?\};/;
if(!RE.test(page)) { console.error('talents lang: the page has no EW_LANG_TALV line'); process.exit(1); }
const page2=page.replace(RE,()=>'\n'+line);
let differ=page2!==page;
for(const c of CODES){ const f=path.join(ROOT,'lang',c+'.talents.json'); const want=text[c];
  const have=fs.existsSync(f)?fs.readFileSync(f,'utf8'):null; if(want!==have&&!(want==null&&have==null)) differ=true;
  if(!CHECK){ if(want!=null) fs.writeFileSync(f,want); else if(have!=null) fs.unlinkSync(f); } }
if(!CHECK&&page2!==page) fs.writeFileSync(PAGE,page2);

console.log('talents lang: '+HEROES+' heroes, '+TOTAL+' talents in talents-data.js; '+rows.map(r=>r.c+' '+r.heroes+'/'+r.texts).join(', ')+'; '+dropped.length+' entries left in English');
if(MD){
  console.log('\n| Language | Heroes with any translation (/'+HEROES+') | Heroes complete | Talent names (/'+TOTAL+') | Talent texts (/'+TOTAL+') | Names + texts | Share of talents |');
  console.log('|---|---|---|---|---|---|---|');
  for(const r of rows) console.log('| '+r.c+' | '+r.heroes+' | '+r.full+' | '+r.names+' | '+r.texts+' | '+r.both+' | '+(100*r.both/TOTAL).toFixed(1)+'% |');
  const miss={}; for(const r of rows){ const have=new Set(Object.keys(out[r.c])); miss[r.c]=Object.keys(EN).filter(k=>!have.has(k)); }
  const m0=JSON.stringify(miss[CODES[0]]); const same=CODES.every(c=>JSON.stringify(miss[c])===m0);
  console.log('\nHeroes with no translation'+(same?' (every language)':'')+':'); for(const c of (same?[CODES[0]]:CODES)) console.log((same?'':c+': ')+miss[c].map(k=>D.heroes[k].name+' ('+k+')').join(', '));
  console.log('\nLeft in English ('+dropped.length+'):'); for(const d of dropped) console.log('- '+d.join(' / '));
}
if(CHECK&&differ){ console.error('talents lang: lang/*.talents.json or EW_LANG_TALV is not what the build writes - run node tools/lang/talents_build.js'); process.exit(1); }
