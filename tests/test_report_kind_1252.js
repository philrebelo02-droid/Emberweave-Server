// v1252 (Phil 1 Nov 2026: "yes please have a option to select ingame, suggestion or bug"): the report form has a Bug / Suggestion
// choice and sends kind; the server keeps 'suggestion' and files everything else as 'bug'. Static checks, asserts (non-zero exit).
// Control: RK_HTML=<pre-fix emberweave-heroes.html> must FAIL.
const fs=require('fs'),path=require('path'),assert=require('assert');
const html=fs.readFileSync(process.env.RK_HTML||path.join(__dirname,'..','emberweave-heroes.html'),'utf8');
const srv=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
assert(/id="rpKind"[^]*?data-k="bug"[^]*?data-k="suggestion"/.test(html),'the report form offers Bug and Suggestion');
assert(/api\('\/api\/report','POST',\{text:t, meta, kind:\(window\._rpKind==='suggestion'\?'suggestion':'bug'\)\}\)/.test(html),'the report sends the chosen kind');
assert(/const kind=b\.kind==='suggestion'\?'suggestion':/.test(srv),'the server keeps a suggestion as a suggestion');
console.log('test_report_kind_1252.js: 3 checks passed');
