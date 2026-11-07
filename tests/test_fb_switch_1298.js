// v1298 (Phil 6 Nov: Facebook "auto chose xanthyrgames" / "make it better" / "it forces my phil.rebelo02 facebook"): before a Facebook
// login is used, the game shows WHICH account (name) with Continue / Use another Facebook account / Cancel; "another" logs that account
// out of Facebook here and reopens Facebook's login with a fresh sign-in (auth_type reauthenticate). The FB SDK is stubbed (no network).
// Control: FB_ROOT=<pre-v1298 checkout> must FAIL.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.FB_ROOT || path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
let pass = 0, fail = 0; const ck = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const a = src.indexOf('function fbConfirmAccount'), b = src.indexOf('async function mountFacebookSignin');
ck(a > 0 && b > a, 'fbConfirmAccount exists');
ck(/auth_type:'reauthenticate'/.test(src) && /window\.FB\.logout\(/.test(src), '"another account" logs out and reopens login with reauthenticate');
ck(/"auth\.fb_continue_as":"Continue as \{name\}"/.test(src) && /"auth\.fb_other":"Use another Facebook account"/.test(src), 'the texts exist');
if (a > 0 && b > a) {
  // run the helper against a tiny DOM stub
  const els = {}; const mk = id => (els[id] = { id, style: {}, textContent: '', onclick: null });
  const ov = { style: {}, set innerHTML(h) { ['fbcPic', 'fbcName', 'fbcGo', 'fbcOther', 'fbcNo'].forEach(mk); }, querySelector: s => els[s.slice(1)], remove() { ov.removed = true; } };
  const ctx = { document: { createElement: () => ov, body: { appendChild() {}, contains: () => !ov.removed } }, escapeHTML: x => x,
    t: (k, o) => k === 'auth.fb_continue_as' ? 'Continue as ' + o.name : k, bannerMsg: m => { ctx.banner = m; },
    window: { FB: { api: (p, q, cb) => cb({ name: 'Xanthyr Games', picture: { data: { url: 'https://x/p.jpg' } } }) } } };
  vm.createContext(ctx); vm.runInContext(src.slice(a, b), ctx);
  let cont = null, sw = 0;
  ctx.fbConfirmAccount('TOK', t => { cont = t; }, () => { sw++; });
  ck(els.fbcName.textContent === 'Continue as Xanthyr Games', 'it names the Facebook account (' + els.fbcName.textContent + ')');
  els.fbcGo.onclick(); ck(cont === 'TOK', 'Continue uses that login');
  ctx.fbConfirmAccount('TOK2', () => {}, () => { sw++; }); els.fbcOther.onclick(); ck(sw === 1, 'Use another Facebook account starts the switch');
  ctx.fbConfirmAccount('TOK3', () => { cont = 'WRONG'; }, () => {}); els.fbcNo.onclick(); ck(cont === 'TOK' && ctx.banner === 'auth.fb_cancelled', 'Cancel links nothing');
}
if (process.env.FB_ROOT) { console.log('CONTROL: ' + fail + ' failed as expected'); process.exit(fail ? 0 : 1); }
console.log('test_fb_switch_1298.js: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
