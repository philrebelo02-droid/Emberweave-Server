// v1098 (Phil 9 Oct 2026: "no more emojis in this game" / "put all the new icons in"): every icon the page asks for exists.
// Scans emberweave-heroes.html for {i:<k>:<key>} tokens, uiIcon / hudIcon / statusIcon / statIcon('<key>') calls and literal
// /assets/img/icons/... and /assets/img/ui/hud-... paths, resolves each through the page's own ICON_SRC, and asserts the file is
// on disk. CONTROL: a token and a call that point at a missing file must be reported.
// Also a static check that the Wishing Pool is the stage-fit layout (Phil: "neither fit to screen properly") and that the
// Mythical Pool only shows the open lock once it is open.
// Asserts (non-zero exit). AUD_PAGE=<page> checks another copy.
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const page = process.env.AUD_PAGE || path.join(ROOT, 'emberweave-heroes.html');
const html = fs.readFileSync(page, 'utf8');
const icons = require('./helpers/page-icons.js')(html);
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok  ' + m); };

const STAT_KEYS = (() => { const m = html.match(/const STAT_ICON_KEYS=new Set\(\[([^\]]*)\]\)/); return new Set(m ? m[1].match(/'([^']+)'/g).map(s => s.slice(1, -1)) : []); })();
const STAT_ALIAS = (() => { const m = html.match(/const STAT_ICON_ALIAS=(\{[^}]*\})/); return m ? Function('return ' + m[1])() : {}; })();

// every icon reference in a source text -> [{ref, file}]
function refs(src) {
  const out = [];
  const add = (ref, url) => out.push({ ref, url, file: path.join(ROOT, url.split('?')[0]) });
  for (const m of src.matchAll(/\{i:([stuh]):([a-zA-Z0-9-]+)\}/g)) add(m[0], icons.ICON_SRC[m[1]](m[2]));
  const K = { uiIcon: 'u', hudIcon: 'h', statusIcon: 's' };
  for (const m of src.matchAll(/\b(uiIcon|hudIcon|statusIcon)\('([a-zA-Z0-9-]+)'/g)) add(m[0], icons.ICON_SRC[K[m[1]]](m[2]));
  for (const m of src.matchAll(/\bstatIcon\('([a-zA-Z0-9-]+)'/g)) { const k = STAT_ALIAS[m[1]] || m[1]; if (STAT_KEYS.has(k)) add(m[0], icons.ICON_SRC.t(k)); else out.push({ ref: m[0], file: null }); }
  for (const m of src.matchAll(/\/assets\/img\/(?:icons\/(?:ui|stat|status)\/[a-zA-Z0-9-]+-v1\.webp|ui\/hud-[a-z]+\.webp)/g)) add(m[0], m[0]);
  return out;
}
const missing = list => list.filter(r => !r.file || !fs.existsSync(r.file)).map(r => r.ref);

// 1. the page
const all = refs(html);
const uniq = [...new Set(all.map(r => r.ref))];
ok(all.length > 300, 'the page asks for ' + all.length + ' icons (' + uniq.length + ' distinct references)');
const miss = missing(all);
ok(miss.length === 0, 'every referenced icon file exists' + (miss.length ? ' - MISSING: ' + [...new Set(miss)].join(', ') : ''));
const kinds = { u: 0, h: 0, s: 0, t: 0 }; for (const r of all) { const m = /icons\/(ui|status|stat)\/|ui\/hud-/.exec(r.url || ''); if (m) kinds[!m[1] ? 'h' : m[1] === 'ui' ? 'u' : m[1] === 'status' ? 's' : 't']++; }
ok(kinds.u > 0 && kinds.h > 0 && kinds.s > 0, 'ui, HUD and status art are all in use (' + JSON.stringify(kinds) + ')');
ok(icons.iconize('{i:u:check} a {i:h:gold}').split('<img').length === 3 && icons.stripIcons('{i:u:check} a') === 'a', 'iconize draws {i:u:..} / {i:h:..} tokens and stripIcons drops them');
ok(icons.uiIcon('check') === icons.iconize('{i:u:check}') && icons.hudIcon('gem') === icons.iconize('{i:h:gem}'), 'uiIcon / hudIcon return the same <img> as the tokens');

// 2. CONTROL: a token and a call to a missing file are caught
const ctrl = missing(refs("x='{i:u:no-such-icon-1098}'; y=uiIcon('no-such-icon-b'); z=hudIcon('gold');"));
ok(ctrl.length === 2 && ctrl[0] === '{i:u:no-such-icon-1098}' && ctrl[1] === "uiIcon('no-such-icon-b'", 'CONTROL: a token and a call that point at missing files are reported (' + ctrl.join(', ') + ')');

// 3. Wishing Pool: one stage that always fits (the Temple's tp2Fit pattern), closed lock until the Mythical Pool opens
const a = html.indexOf('function renderWishing('), b = html.indexOf('\nfunction ', a + 10);
const rw = html.slice(a, b);
ok(a > 0 && /class="wpsStage" id="wpsStage"/.test(rw) && /\bwpsFit\(\);/.test(rw), 'renderWishing builds the wpsStage and fits it (wpsFit)');
ok(!/class="wishpools"/.test(rw), 'the old flowing three-column layout is gone');
ok(/class="wpsTitle">WISHING POOL <button[^>]*class="wpsHelp"[^>]*onclick="wishShowInfo\(\)"/.test(rw), 'the title banner and the ? help button are inside the stage');
ok(['wpGold', 'wpGold10', 'wpGem', 'wpGem10', 'wpMyth', 'wpMyth10'].every(id => rw.includes('id="' + id + '"')), 'all six wish buttons keep their ids');
const fit = html.slice(html.indexOf('function wpsFit('), html.indexOf('\n', html.indexOf('function wpsFit(') + 400));
ok(/Math\.min\(W, H\*pw\/ph\)/.test(fit) && /setProperty\('--u',\(w\/pw\)\+'px'\)/.test(fit), 'wpsFit sizes the stage to the host (min of width and height) and sets --u');
ok(/window\.addEventListener\('resize',\(\)=>\{ if\(document\.getElementById\('wpsStage'\)\) wpsFit\(\); \}\)/.test(html), 'the stage refits on resize');
const css = (html.match(/\.wpsCard \.btn\{[^}]*\}/) || [''])[0];
ok(/height:calc\(var\(--u\)\*\d+\)/.test(css) && /font-size:calc\(var\(--u\)\*\d+\)/.test(css), 'the wish buttons are sized in --u, not fixed px');
ok(/mythPoolOpen\(\)\?uiIcon\('lock-open'\)\+' Mythical heroes only':hudIcon\('lock'\)\+' Opens at EGP '/.test(rw), 'Mythical Pool: closed lock while locked, lock-open only when open');

console.log('test_icons_1098.js: ' + pass + ' checks passed (page ' + path.basename(page) + ')');
