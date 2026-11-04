// LANGUAGES step 2 - FINISH CHECK 2: English a player can still see that is hard-coded in emberweave-heroes.html (not t()).
// Script blocks are read by a real parser (Babel, bundled in playwright): every string literal and template-literal piece is cut at
// HTML tags and checked; a piece that reads as English words is a hit unless it is code (a selector, an id, a key compared or looked up,
// a console / DOM-API argument) or listed in tools/lang/scan_allow.json (proper names and intentional non-text, each with a reason).
// Outside <script> the text between tags and title / placeholder / aria-label values are checked (an element with data-i18n is
// filled by t() at run time). Content tables routed through langDesc() (lang/<code>.content.json) are skipped by name.
// Usage: node tools/lang/scan.js [--base] [--list] [--json out.json] [--from N --to M]
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const ROOT=path.join(__dirname,'..','..');
const bb=require(path.join(ROOT,'node_modules','playwright','lib','transform','babelBundle.js'));
const arg=k=>{ const i=process.argv.indexOf(k); return i<0?null:(process.argv[i+1]||true); };
const page=arg('--base')?cp.execFileSync('git',['show','88bcea5a8eea4be1df48e3111ecbf9ad7a64f7d1:emberweave-heroes.html'],{cwd:ROOT,maxBuffer:64<<20}).toString('utf8')
  :fs.readFileSync((arg('--file')&&arg('--file')!==true)?arg('--file'):path.join(ROOT,'emberweave-heroes.html'),'utf8');
const NL=String.fromCharCode(10);
const from=+arg('--from')||1, to=+arg('--to')||1e9;
// scan_allow.json + every tools/lang/scan_allow.d/*.json (one file per worker, merged)
const ALLOW=(()=>{ const A={tables:{},functions:{},text:{},patterns:[],lines:[]}; const files=[path.join(__dirname,'scan_allow.json')];
  const d=path.join(__dirname,'scan_allow.d'); if(fs.existsSync(d)) for(const f of fs.readdirSync(d).filter(f=>f.endsWith('.json')).sort()) files.push(path.join(d,f));
  for(const f of files){ let j; try{ j=JSON.parse(fs.readFileSync(f,'utf8')); }catch(e){ if(fs.existsSync(f)){ console.error('scan: bad JSON '+f+': '+e.message); process.exit(2); } continue; }
    Object.assign(A.tables,j.tables||{}); Object.assign(A.functions,j.functions||{}); for(const [k,v] of Object.entries(j.text||{})) A.text[path.basename(f)+':'+k]=v; A.patterns.push(...(j.patterns||[])); A.lines.push(...(j.lines||[])); }
  return A; })();
const ALLOW_TEXT=new Set(Object.values(ALLOW.text||{}).flat());   // exact pieces: proper names, brand, symbols
const ALLOW_RE=(ALLOW.patterns||[]).map(p=>new RegExp(p.re));
const ALLOW_VARS=new Set(Object.keys(ALLOW.tables||{}));            // top-level consts whose strings are content / names (with reason)
const ALLOW_FUNCS=new Set(Object.keys(ALLOW.functions||{}));        // dev-only / admin-only functions (with reason)
const ALLOW_LINES=new Set((ALLOW.lines||[]).map(String));           // "<text>" exact hits allowed anywhere (legacy)
const CSSW=/\b(solid|px|rgba?|translate[XY]?|ease|linear|inset|cubic|bold|italic|serif|sans-serif|monospace|nowrap|ellipsis|pointer|absolute|relative|flex|inline-block|uppercase|center|transparent|important|cover|contain|repeat|scale|rotate|blur|drop-shadow|opacity|hidden|visible|display|margin|padding|border|width|height|grid|none|auto|block)\b/;
function english(x){ x=String(x).replace(/&[a-z]+;|&#x?[\da-f]+;/gi,' ').replace(/\{i:[a-z]:[\w-]+\}/g,' ').replace(/\s+/g,' ').trim(); if(x.length<2) return null;
  const w=x.match(/[A-Za-z]{2,}/g)||[]; if(!w.length) return null;
  if(/^[\[.#:]|\]$|^\(.*:.*\)$|[{};=<>]|\b\d+px\b|#[0-9a-fA-F]{6}\b|=>|\(\)|\\u|https?:|@[\w-]+\.\w|\.(png|webp|jpe?g|js|json|svg|m4a|mp3|ogg|html|css|glb|gltf)\b|^[\w$.\/-]+$/.test(x)&&!(w.length===1&&/^[A-Z][a-z]{2,}[!.?]?$/.test(x))) return null;
  if(CSSW.test(x)&&!/[.!?]$/.test(x)&&w.length<5) return null;
  if(/^[a-z][\w-]*(?: [a-z][\w-]*)*$/.test(x)&&!/ /.test(x)) return null;      // one lower-case token: a key / class / id
  if(/^(?:[a-z][\w-]*\s)+[a-z][\w-]*$/.test(x)&&/(?:^|\s)(?:btn|on|off|active|sel|hide|show|xs|sm|lg|is-|has-)/.test(x)) return null;   // class lists
  if(w.length===1&&!/^[A-Z][a-z]{2,}/.test(w[0])&&!/^[A-Z]{3,}$/.test(w[0])) return null;
  if(/^(?:Math|Date|Object|Array|String|Number|Promise|Error|Map|Set|JSON|POST|GET|PUT|DELETE|Infinity|NaN|Arial|Georgia|Cinzel|Inter|Segoe|Noto|THREE|DOMContentLoaded|Enter|Escape|Tab|Backspace|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Shift|Control|Meta|Alt|UTF|GMT|UTC|ASCII)$/.test(x)) return null;
  if(ALLOW_TEXT.has(x)||ALLOW_LINES.has(x)||ALLOW_RE.some(r=>r.test(x))) return null;
  return x.slice(0,120); }
const pieces=s=>String(s).split(/<[^>]*>|^[^<]*>|<[^>]*$/);
const hits=[]; const LINELEN=[0].concat(page.split(NL).map(l=>l.length));
const push=(line,text,ctx)=>{ if(line<from||line>to) return; hits.push({line,text,ctx:ctx||''}); };
// ---- HTML outside scripts ----
const scripts=[]; for(const m of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) scripts.push({start:m.index+8,end:m.index+8+m[1].length,src:m[1],line0:page.slice(0,m.index+8).split(NL).length-1});
{ let pos=0, line=1; const outside=[]; for(const s of scripts){ outside.push([pos,s.start]); pos=s.end; } outside.push([pos,page.length]);
  for(const [a,b] of outside){ const chunk=page.slice(a,b).replace(/<style>[\s\S]*?<\/style>/g,m=>m.replace(/[^\n]/g,' ')).replace(/<!--[\s\S]*?-->/g,m=>m.replace(/[^\n]/g,' ')).replace(/<svg[\s\S]*?<\/svg>/g,m=>m.replace(/[^\n]/g,' '));
    const l0=page.slice(0,a).split(NL).length;
    for(const m of chunk.matchAll(/(?:<([a-zA-Z][^<>]*)>|>)([^<>]+)(?=<)/g)){ if(m[1]&&/\bdata-i18n=/.test(m[1])) continue; const x=english(m[2]); if(x) push(l0+chunk.slice(0,m.index).split(NL).length-1,x,'html'); }
    for(const m of chunk.matchAll(/<([a-zA-Z][^<>]*)>/g)) for(const at of m[1].matchAll(/\s(title|placeholder|aria-label|alt)=(["'])([^"']+)\2/g)){
      if(at[1]==='title'&&/data-i18n-title=/.test(m[1])) continue; if(at[1]==='placeholder'&&/data-i18n-ph=/.test(m[1])) continue; if(at[1]==='aria-label'&&/data-i18n-aria=/.test(m[1])) continue;
      const x=english(at[3]); if(x) push(l0+chunk.slice(0,m.index).split(NL).length-1,'['+at[1]+'] '+x,'html-attr'); } } }
// ---- scripts ----
const CODE_CALLS=/^(?:console\.\w+|querySelector(?:All)?|getElementById|getElementsByClassName|closest|matches|addEventListener|removeEventListener|setAttribute|getAttribute|removeAttribute|hasAttribute|toggleAttribute|add|remove|toggle|contains|createElement|createElementNS|setItem|getItem|removeItem|fetch|api|apiPost|apiGet|_apiRaw|postJSON|getJSON|require|importScripts|postMessage|dispatchEvent|Event|CustomEvent|RegExp|Error|TypeError|assert|ok|ck|warn|log|track|metric|telemetry|dbg|debug|devLog|serverLog|clientLog|reportError|sfx|playSfx|playSound|sound|music|loadImg|loadTex|img|tex|preload|setProperty|getPropertyValue|insertAdjacentHTML|split|join|replace|replaceAll|indexOf|includes|startsWith|endsWith|test|match|has|get|set|delete|t|ewT|langDesc|langMeta|langMsg|iconize|uiIcon|hudIcon|statusIcon|statIcon|iconImg|stripIcons|toLocaleString|toLocaleDateString|toLocaleTimeString|Intl\.\w+|DateTimeFormat|NumberFormat|localeCompare|animate|scrollIntoView|requestAnimationFrame|setTimeout|setInterval|Worker|Audio|load|play|vibrate)$/;
const calleeName=c=>c.type==='Identifier'?c.name:(c.type==='MemberExpression'&&!c.computed&&c.property.type==='Identifier')?((c.object.type==='Identifier'&&c.object.name==='console')?'console.'+c.property.name:c.property.name):'';
for(const sc of scripts){
  let src=sc.src, ast=null;
  for(let tries=0;tries<800&&!ast;tries++){ try{ ast=bb.babelParse(src,'page.js',false); }catch(e){ const msg=String(e.message).split(NL)[0];
    const d=/Identifier '([\w$]+)' has already been declared/.exec(msg);
    if(d&&e.pos!=null){ const at=src.indexOf(d[1],e.pos); if(at>=0&&at<e.pos+200){ src=src.slice(0,at)+'__dup'+tries+'_'+src.slice(at); continue; } }
    console.error('scan: parse error near line '+(sc.line0+(e.loc?e.loc.line:0))+': '+msg); process.exit(2); } }
  const seen=new Set();
  const visit=(p,raw,isTpl)=>{
    let q=p.parentPath, node=p.node;
    if(isTpl){ node=p.parentPath.node; q=p.parentPath.parentPath; }   // the TemplateLiteral
    // skip: object keys, member keys, import/directive, comparisons, switch cases, `in`, code-call arguments, skipped tables/functions
    if(!isTpl&&q.isObjectProperty()&&q.node.key===node&&!q.node.computed) return;
    if(q.isMemberExpression()&&q.node.property===node) return;
    if(q.isBinaryExpression()&&/^(===|!==|==|!=|in|instanceof)$/.test(q.node.operator)) return;
    if(q.isSwitchCase()) return;
    { let r=q; while(r&&(r.isBinaryExpression({operator:'+'})||r.isLogicalExpression()||r.isConditionalExpression()||r.isTemplateLiteral()||r.isParenthesizedExpression())) r=r.parentPath;   // a string built for a code call is code too
      if(r&&(r.isCallExpression()||r.isNewExpression())){ const n=calleeName(r.node.callee); if(CODE_CALLS.test(n)) return; } if(r&&r.isThrowStatement()) return; }
    if(q.isAssignmentExpression()&&q.node.left.type==='MemberExpression'){ const pn=q.node.left.property&&q.node.left.property.name; if(/^(className|id|cssText|src|href|type|name|value|display|background|backgroundImage|cursor|transform|color|width|height|left|top|filter|dataset|key|code|tagName|rel|as|crossOrigin|lang|dir)$/.test(pn||'')) return; }
    let fnName='', top='';
    for(let a=p;a;a=a.parentPath){ if(!fnName&&(a.isFunctionDeclaration()&&a.node.id)) fnName=a.node.id.name;
      if(a.parentPath&&a.parentPath.isProgram()){ if(a.isVariableDeclaration()) top=a.node.declarations.map(d=>d.id&&d.id.name).join(','); else if(a.isFunctionDeclaration()&&a.node.id) top=a.node.id.name;
        else if(a.isExpressionStatement()&&a.node.expression.type==='CallExpression'){ const c=a.node.expression; if(c.callee.type==='MemberExpression'&&c.callee.object.name==='Object'&&c.arguments[0]&&c.arguments[0].name) top=c.arguments[0].name; else if(c.callee.type==='MemberExpression'&&c.callee.object.type==='Identifier') top=c.callee.object.name; }
        else if(a.isExpressionStatement()&&a.node.expression.type==='AssignmentExpression'){ let l=a.node.expression.left; while(l&&l.type==='MemberExpression') l=l.object; if(l&&l.type==='Identifier') top=l.name; } break; } }
    if(top&&top.split(',').some(n=>ALLOW_VARS.has(n))) return; if(fnName&&ALLOW_FUNCS.has(fnName)) return; if(top&&ALLOW_FUNCS.has(top)) return;
    const line=sc.line0+p.node.loc.start.line; if((LINELEN[line]||0)>50000) return;   // an inlined minified library (three.js)
    for(const pc of pieces(raw)){ const x=english(pc); if(x&&!seen.has(line+'|'+x)){ seen.add(line+'|'+x); push(line,x,fnName||top); } }
    for(const at of String(raw).matchAll(/\s(title|placeholder|aria-label|alt)=(["'])([^"'$]+)\2/g)){ const x=english(at[3]); if(x) push(line,'['+at[1]+'] '+x,fnName||top); } };
  bb.traverse(ast,{ StringLiteral(p){ if(p.parentPath.isImportDeclaration()||p.parentPath.isDirective&&p.parentPath.isDirective()) return; visit(p,p.node.value,false); },
    TemplateElement(p){ visit(p,p.node.value.cooked!=null?p.node.value.cooked:p.node.value.raw,true); } });
}
hits.sort((a,b)=>a.line-b.line);
if(arg('--json')) fs.writeFileSync(arg('--json'),JSON.stringify(hits));
if(arg('--list')) for(const h of hits) console.log(h.line+': '+h.text+(h.ctx?'   ['+h.ctx+']':''));
console.log('scan: '+hits.length+' hard-coded English strings');
module.exports={hits};
