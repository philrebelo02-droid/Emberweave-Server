// LANGUAGES step 2: find English a player can still see that is hard-coded in emberweave-heroes.html (not t()).
// A heuristic tuned to this page: every JS string literal (', ", ` with ${} skipped) is cut at HTML tags into text pieces; a piece
// that reads as English words (not code, CSS, an id, a path, a number) is a hit. Outside <script> blocks the text between tags is
// checked the same way. Comments, t('key') calls, console/log calls and the big data tables (scanned by the content check) are skipped.
// Usage: node tools/lang/scan.js [--base] [--from N --to M] [--list] [--json out.json]
//   --base  scan the v1270 base page (line numbers for specs); default: the current page.
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const ROOT=path.join(__dirname,'..','..');
const arg=k=>{ const i=process.argv.indexOf(k); return i<0?null:(process.argv[i+1]||true); };
const page=arg('--base')?cp.execFileSync('git',['show','88bcea5a8eea4be1df48e3111ecbf9ad7a64f7d1:emberweave-heroes.html'],{cwd:ROOT,maxBuffer:64<<20}).toString('utf8')
  :fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8');
const L=page.split(/\r?\n/);
const from=+arg('--from')||1, to=+arg('--to')||L.length;
const SKIP_LINE=/^(?:const (?:SFX_DATA|GLOSSARY_INFO|PASS_DESC|KIT_DESC|HERO_ULT_DESC|ULT_DESC|HERO_LORE|LORE_AUDIO|EW_LANG_EN|EW_LANG_V|EW_LANGS)\b|\s*<path |\s*@font-face|!function)|console\.(log|warn|error)\(|^\s*\/\//;
const CSSW=/\b(solid|px|rgba?|translate[XY]?|ease|linear|inset|cubic|bold|italic|serif|sans-serif|monospace|nowrap|ellipsis|pointer|absolute|relative|flex|inline-block|uppercase|center|transparent|important|cover|contain|repeat|scale|rotate|blur|drop-shadow|opacity|hidden|visible|display|margin|padding|border|width|height)\b/;
function english(x){ x=x.replace(/&[a-z]+;|&#x?[\da-f]+;/gi,' ').replace(/\s+/g,' ').trim(); if(x.length<2) return null;
  const w=x.match(/[A-Za-z]{2,}/g)||[]; if(!w.length) return null;
  if(/[{};=<>]|=>|\(\)|\\u|^\.|^#|^\/|https?:|\.(png|webp|js|json|svg|m4a|mp3|html)\b|^[\w$.-]+$/.test(x)&&!(w.length===1&&/^[A-Z][a-z]{2,}[!.?]?$/.test(x))) return null;
  if(CSSW.test(x)&&!/[.!?]$/.test(x)&&w.length<5) return null;
  if(/^[a-z]+(?:[-_][a-z0-9]+)+$/.test(x)) return null;   // css class / id
  if(w.length===1&&!/^[A-Z][a-z]{2,}/.test(w[0])&&!/^[A-Z]{3,}$/.test(w[0])) return null;
  if(/^(?:Math|Date|Object|Array|String|Number|Promise|Error|Map|Set|JSON|POST|GET|PUT|Infinity|NaN|Arial|Georgia|Cinzel|Inter|Segoe|Noto|THREE|DOMContentLoaded|Enter|Escape|Tab|Backspace|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Shift|Control|Meta|Alt)$/.test(x)) return null;
  return x.slice(0,90); }
// the literals on one line (state carried across lines for template literals and block comments)
let st={mode:'code',depth:0,stack:[]};
function literals(s){ const out=[]; let cur='', i=0;
  const push=()=>{ if(cur) out.push(cur); cur=''; };
  while(i<s.length){ const c=s[i], m=st.mode;
    if(m==='cmt'){ if(c==='*'&&s[i+1]==='/'){ st.mode=st.stack.pop()||'code'; i+=2; continue; } i++; continue; }
    if(m==='code'){
      if(c==='/'&&s[i+1]==='*'){ st.stack.push('code'); st.mode='cmt'; i+=2; continue; }
      if(c==='/'&&s[i+1]==='/') break;
      if(c==='/'){ const prev=s.slice(0,i).replace(/\s+$/,''); const pc=prev[prev.length-1];
        if(!pc||/[(,=:[!&|?{};+\-*%<>~^]/.test(pc)||/\b(return|typeof|in|of|case)$/.test(prev)){   // a regex literal: skip it whole
          let j=i+1, cls=false; for(;j<s.length;j++){ const d=s[j]; if(d==='\\'){ j++; continue; } if(d==='[') cls=true; else if(d===']') cls=false; else if(d==='/'&&!cls) break; }
          i=j+1; continue; } }
      if(c==="'"||c==='"'||c==='`'){ st.mode=c; i++; continue; }
      if(c==='}'&&st.stack.length&&st.stack[st.stack.length-1]==='`'&&st.depth===0){ st.mode=st.stack.pop(); st.depth=st.stackDepth.pop(); i++; continue; }
      if(c==='{') st.depth++; if(c==='}') st.depth=Math.max(0,st.depth-1);
      i++; continue; }
    // in a string
    if(c==='\\'){ cur+=s[i+1]||''; i+=2; continue; }
    if(c===m){ push(); st.mode='code'; i++; continue; }
    if(m==='`'&&c==='$'&&s[i+1]==='{'){ push(); st.stack.push('`'); (st.stackDepth=st.stackDepth||[]).push(st.depth); st.depth=0; st.mode='code'; i+=2; continue; }
    cur+=c; i++; }
  if(st.mode==="'"||st.mode==='"'){ push(); st.mode='code'; } else if(st.mode==='`') { push(); cur=''; }
  return out; }
const hits=[];
let inScript=false;
for(let i=0;i<Math.min(to,L.length);i++){ const raw=L[i];
  if(/^<script>/.test(raw)){ inScript=true; st={mode:'code',depth:0,stack:[],stackDepth:[]}; }
  if(/^<\/script>/.test(raw)){ inScript=false; continue; }
  const want=i>=from-1;
  if(!inScript){ if(!want) continue; if(/^\s*<(path|style)|^\s*[.#@a-z-]+[^<]*\{|^\s*[a-z-]+:/.test(raw)) continue;
    const seen=new Set(); for(const m of raw.replace(/<!--.*?-->/g,'').matchAll(/>([^<>]+)</g)){ const x=english(m[1]); if(x&&!seen.has(x)){ seen.add(x); hits.push({line:i+1,text:x}); } }
    continue; }
  if(SKIP_LINE.test(raw)){ continue; }
  let s=raw.replace(/(?<![\w$.])(?:t|ewT)\('[^']*'/g,'T(0');
  const lits=literals(s); if(!want) continue;
  const seen=new Set();
  for(const lit of lits){ for(const piece of lit.split(/<[^>]*>|^[^<]*>|<[^>]*$/)){ const x=english(piece); if(x&&!seen.has(x)){ seen.add(x); hits.push({line:i+1,text:x}); } } } }
if(arg('--json')) fs.writeFileSync(arg('--json'),JSON.stringify(hits));
if(arg('--list')) for(const h of hits) console.log(h.line+': '+h.text);
console.log('scan: '+hits.length+' hard-coded English strings in lines '+from+'-'+Math.min(to,L.length));
