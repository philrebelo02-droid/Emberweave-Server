// v1413 (Phil 17 Nov 2026, after a player wrote "When the game is in Spanish, the patch notes are not fully translated":
// "please make sure patch notes also translate"). Patch Notes and What's New show the latest 10 notes through langDesc(), keyed by
// the English text with numbers turned into {0},{1}.. (tools/lang/collect_content.js, the page's langTpl). A deploy must never ship
// a note line that any language pack lacks - so every title and item of the latest 10 notes must be in every lang/<code>.content.json.
// CONTROL: a note line that is not in the packs must be caught.
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const ROOT=path.join(__dirname,'..');
const CODES=['es','pt-BR','fr','de','it','nl','ru','tr','ja','ko','zh-Hans','zh-Hant','th','id','hi'];
let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; console.log('  ok   '+m); };
// same template rule as collect_content.js's patch-note collector
function tpl(text){ let n=0; return text.replace(/\{[^{}]*\}|<[^>]*>|&#?\w+;|\d+(?:\.\d+)?/g,m=>('{<&'.includes(m[0])?m:'{'+(n++)+'}')); }
const feed=JSON.parse(fs.readFileSync(path.join(ROOT,'patchnotes.json'),'utf8'));
const notes=(Array.isArray(feed)?feed:feed.patches||[]).slice(0,10);
ok(notes.length===10,'the feed has at least 10 notes');
const lines=[]; for(const n of notes) for(const t of [n.title,...(n.items||[])]) if(typeof t==='string'&&t) lines.push({ver:n.ver,k:tpl(t)});
const packs={}; for(const c of CODES) packs[c]=JSON.parse(fs.readFileSync(path.join(ROOT,'lang',c+'.content.json'),'utf8'));
function missing(pk,ls){ const out=[]; for(const c of CODES) for(const l of ls) if(!(l.k in pk[c])) out.push(c+' '+l.ver+': '+l.k.slice(0,60)); return out; }
const miss=missing(packs,lines);
ok(miss.length===0,'every line of the latest 10 patch notes is translated in all 15 languages ('+lines.length+' lines'+(miss.length?'; missing '+miss.length+': '+[...new Set(miss.map(m=>m.split(': ')[0].split(' ')[1]+': '+m.split(': ')[1]))].slice(0,6).join(' | '):'')+')');
// CONTROL
const fake=missing(packs,[{ver:'0.0.0',k:tpl('A patch note line nobody translated, 12 times.')}]);
ok(fake.length===CODES.length,'CONTROL: an untranslated note line is caught in all '+CODES.length+' languages');
console.log('test_patchnotes_translated.js: '+pass+' checks passed');
