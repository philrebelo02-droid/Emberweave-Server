// v1455 lockdown audit 25 Nov 2026 - Account, HUD, Sound, Servers (audit/account-hud-sound-servers.md) fixes.
// Server in-process (temp DB, tests/lockdown-1455-lib.js); page headless (server/sim-host.js) + page source.
//  1. SECURITY: look-alike staff names (Adm1n, D3v, DEV Team, Ph1l, M0derator, Supp0rt, Cyrillic Systеm, Deleted p1ayer) are refused.
//  2. Whisper not delivered: the server answers why (offline / no such player), names match ignoring case; the chat shows it.
//  3. Patch notes: every note from 1.9.5 on has a time; the zone is ET.
//  4. The 51 glossary creature names are in every content pack (24 translated, 27 proper names kept in Latin script, reviewed).
//  5. Kharos, Hourglass Sentinel has lore (translated); the three kit-less summons say "Basic attacks only."
//  6. No blur behind the stage card, the currency shop, the profile window and the pause window.
//  7. The campaign Back and the hero pop-out Back meet 44 x 40.
// CONTROL: LF_HTML=<v1454 page> LF_SERVER=<v1454 server.js> LF_SOFT=1 lists the checks the old code fails. Exit 0 = all passed.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const { loadServer, root } = require('./lockdown-1455-lib.js');
const HTML = process.env.LF_HTML || path.join(root, 'emberweave-heroes.html');
const html = fs.readFileSync(HTML, 'utf8');
const SRC = fs.readFileSync(process.env.LF_SERVER || path.join(root, 'server.js'), 'utf8');
const SOFT = !!process.env.LF_SOFT; let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); return; } fail++; console.log('  FAIL ' + m); if (!SOFT) { console.log('test_lockdown_account_hud_1455.js: FAILED after ' + pass + ' passed'); process.exit(1); } };
const host = require(path.join(root, 'server', 'sim-host.js')).load(HTML);
const R = s => vm.runInContext(s, host.ctx, { timeout: 60000 });
const J = s => { try { const r = R('JSON.stringify(' + s + ')'); return r === undefined ? null : JSON.parse(r); } catch (e) { return { __err: String(e && e.message || e) }; } };
const LC = ['es', 'pt-BR', 'fr', 'de', 'it', 'nl', 'ru', 'tr', 'ja', 'ko', 'zh-Hans', 'zh-Hant', 'th', 'id', 'hi'], CODES = ['en'].concat(LC);
const pack = c => JSON.parse(fs.readFileSync(path.join(root, 'lang', c + '.content.json'), 'utf8'));
const { S, call, guest } = loadServer(module);

(async () => {
  console.log('== 1. SECURITY: look-alike staff names are reserved ==');
  { const BAD = ['Adm1n', 'D3v', 'DEV Team', 'DEV Phil', 'Ph1l', 'M0derator', 'Supp0rt', 'Systеm', 'Deleted p1ayer', 'Emberweave Team', 'GM', 'Owner', 'ADMIN', 'A d m i n', 'Ｍｏｄｅｒａｔｏｒ', '$upport', 'Moder@tor'];
    const OKN = ['Marigold', 'Devon', 'Supporter', 'Ember Fox', 'Philip', 'Admiral', 'Owen', 'Model', 'dev1', 'Soul Eater', 'SoMalice', 'Gemma', 'Moddy'];
    const bad = BAD.filter(n => !/reserved/.test(S.badNewName(n) || '')), good = OKN.filter(n => S.badNewName(n));
    ok(bad.length === 0, BAD.length + ' look-alike staff names refused (let through: ' + (bad.join(', ') || 'none') + ')');
    ok(good.length === 0, OKN.length + ' ordinary names still free, incl. "dev1" (the dev account) (refused: ' + (good.join(', ') || 'none') + ')');
    const r = await call('/api/register', { name: 'Adm1n', pass: 'password1' });
    ok(r.status === 400 && /reserved/.test(String(r.data && r.data.error)), 'sign-up as "Adm1n": 400 ' + JSON.stringify(r.data && r.data.error));
    const r2 = await call('/api/register', { name: 'Systеm', pass: 'password1' });
    ok(r2.status === 400 && /reserved/.test(String(r2.data && r2.data.error)), 'sign-up as "Systеm" (Cyrillic e): refused');
    const reg = await call('/api/register', { name: 'lfRenamer', pass: 'password1' });
    const tok = reg.data && reg.data.token;
    const rn = tok ? await call('/api/account/rename', { name: 'M0derator', requestId: 'lf-rn1' }, tok) : { data: {} };
    ok(rn.data && rn.data.ok !== true && /reserved/.test(String(rn.data.error)), 'rename to "M0derator": refused (' + JSON.stringify(rn.data && rn.data.error) + ')');
    const rn2 = tok ? await call('/api/account/rename', { name: 'Marigolden', requestId: 'lf-rn2' }, tok) : { data: {} };
    ok(rn2.data && rn2.data.ok === true, 'CONTROL: an ordinary rename works (' + JSON.stringify(rn2.data && (rn2.data.error || rn2.data.ok)) + ')'); }

  console.log('== 2. undelivered whispers are answered ==');
  { const w = SRC.slice(SRC.indexOf("else if(m.t==='whisper'){"), SRC.indexOf("}catch(e){ console.error('ws frame refused"));
    ok(/if\(!targets&&toU&&DB\.users\[toU\]&&DB\.users\[toU\]\.name\) targets=_chatByName\.get\(DB\.users\[toU\]\.name\);/.test(w) && /String\(k\)\.toLowerCase\(\)===lo/.test(w), 'the target name is matched ignoring case');
    ok(/if\(!sent\) wsend\(ws,\{t:'whisperfail',to,reason:\(toU\|\|targets\)\?'offline':'noplayer'\}\);/.test(w), 'a whisper that reached nobody is answered: offline / noplayer');
    const r = J(`(function(){ const keep=G.whispers, kt=chatTab; G.whispers={}; chatTab='x'; try{ onChatNet({t:'whisperfail',to:'Marigold',reason:'offline'}); onChatNet({t:'whisperfail',to:'NoSuchName',reason:'noplayer'}); return [G.whispers.Marigold&&G.whispers.Marigold[0]&&G.whispers.Marigold[0].txt, G.whispers.NoSuchName&&G.whispers.NoSuchName[0]&&G.whispers.NoSuchName[0].txt]; } finally { G.whispers=keep; chatTab=kt; } })()`) || [];
    ok(r[0] === 'Not delivered: Marigold is offline.' && r[1] === 'Not delivered: no player is named NoSuchName.', 'the conversation shows "' + r.join('" / "') + '"');
    const V = JSON.parse(html.match(/\nconst EW_LANG_V=(\{.*?\});\r?\n/)[1]);
    for (const c of CODES) { const raw = fs.readFileSync(path.join(root, 'lang', c + '.json'), 'utf8'), j = JSON.parse(raw);
      ok(/\{name\}/.test(j['chat.not_delivered_offline'] || '') && /\{name\}/.test(j['chat.not_delivered_noplayer'] || '') && j['gloss.abil_basic'] && crypto.createHash('sha1').update(raw).digest('hex').slice(0, 8) === V[c], c + ': whisper notices + "Basic attacks only." present, hash matches'); } }

  console.log('== 3. patch notes: times, ET ==');
  { const notes = JSON.parse(fs.readFileSync(path.join(root, 'patchnotes.json'), 'utf8')).patches;
    const iv = notes.findIndex(n => n.ver === '1.9.5'), newest = notes.slice(0, iv + 1);
    ok(iv >= 16 && newest.every(n => /^[0-2]\d:[0-5]\d ET$/.test(n.time || '')), 'every note 1.9.5 .. ' + notes[0].ver + ' has a time (' + newest.filter(n => !n.time).map(n => n.ver).join(', ') + ' missing)');
    ok(!notes.some(n => / EST$/.test(n.time || '')), 'no note says EST');
    ok(notes[0].ver === '1.9.21' && notes[0].time === '20:06 ET', '1.9.21: ' + notes[0].time + ' (build 1795655184656 = 25 Nov 20:06 ET)');
    const de = J(`(function(){ const k=LANG.cur; LANG.cur='de'; try{ return [patchNoteTime('17:00 ET'), patchNoteTime('17:00 EST')]; } finally { LANG.cur=k; } })()`) || [];
    ok(/ ET$/.test(de[0] || '') && / ET$/.test(de[1] || '') && /17/.test(de[0] || ''), 'translated clock keeps the zone as ET (' + de.join(' / ') + ')'); }

  console.log('== 4. every glossary creature name is in every pack ==');
  { const rows = J(`(function(){ glFill(); const o=[]; for(const cat of ['monsters','bosses','summons']) for(const e of (GLOSSARY_DATA[cat]||[])){ const gi=GLOSSARY_INFO[e.id]; o.push((gi&&gi.name)||e.name); } return o; })()`) || [];
    const P = LC.map(pack), miss = rows.filter(n => P.some(p => !(n in p)));
    ok(rows.length >= 75 && miss.length === 0, rows.length + ' creature names, missing from a pack: ' + (miss.slice(0, 6).join(', ') || 'none') + ' (were 51)');
    const ja = P[LC.indexOf('ja')], de = P[LC.indexOf('de')];
    ok(ja['Storm Eel'] === '嵐のウナギ' && de['Magma Hound'] === 'Magmahund', 'Storm Eel / Magma Hound are translated (ja ' + ja['Storm Eel'] + ', de ' + de['Magma Hound'] + ')');
    const SO = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'lang', 'same_ok_content.json'), 'utf8'));
    ok(LC.every(c => ['Skarrn', 'Magmourn', 'Wintercrag'].every(n => pack(c)[n] === n && (SO[c] || []).includes(n))), 'proper names (Skarrn, Magmourn ...) stay as written, reviewed in same_ok_content.json');
    const EN = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'lang', 'content', 'en.json'), 'utf8'));
    ok(['Storm Eel', 'Skarrn', 'Clockwork Lantern'].every(n => EN[n] === 'creature display name'), 'the names are templates in tools/lang/content/en.json');
    const CV = JSON.parse(html.match(/\nconst EW_LANG_CV=(\{.*?\});/)[1]);
    ok(LC.concat(['en-XA']).every(c => crypto.createHash('sha1').update(fs.readFileSync(path.join(root, 'lang', c + '.content.json'), 'utf8')).digest('hex').slice(0, 8) === CV[c === 'en-XA' ? 'qps' : c]) && JSON.parse(fs.readFileSync(path.join(root, 'lang', 'en-XA.content.json'), 'utf8'))['Storm Eel'] === 'Storm Eel', 'all 16 content packs re-hashed (EW_LANG_CV), en-XA marks them'); }

  console.log('== 5. Kharos lore; kit-less summons ==');
  { const lore = J(`(GLOSSARY_INFO['hourglass sentinel']||{}).lore||''`) || '';
    ok(/^Kharos was built to keep time/.test(lore) && /half-circle/.test(lore), 'Kharos, Hourglass Sentinel has lore (proposal for Phil)');
    ok(LC.every(c => { const v = pack(c)[lore]; return typeof v === 'string' && v !== lore && /Kharos/.test(v); }), 'translated in all 15 packs (the name kept in Latin script, as for every boss)');
    const basic = J(`['zahri mirage','boar warrior','ink spirit'].map(id=>!monKitHtml(id))`) || [];
    ok(basic.length === 3 && basic.every(Boolean), 'the three summons really have no kit');
    ok(/monKitHtml\(id\)\|\| \(cat==='summons'\?'<div class="glAb">'\+t\('gloss\.abil_basic'\)\+'<\/div>':/.test(html) && J(`t('gloss.abil_basic')`) === 'Basic attacks only.', 'their card says "Basic attacks only." (was "Abilities pending.")'); }

  console.log('== 6. no blur behind panels ==');
  { const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
    const blur = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => /#(profileModal|stageModal|hudShop|pauseModal)\b/.test(m[1]) && /backdrop-filter\s*:\s*blur/.test(m[2]));
    ok(blur.length === 0, 'no backdrop blur on the stage card, currency shop, profile window or pause window (' + blur.map(b => b[1].trim()).join(' | ') + ')');
    ok(/#profileModal,#stageModal,#hudShop,#pauseModal\{backdrop-filter:none;-webkit-backdrop-filter:none;\}/.test(html), 'explicitly none'); }

  console.log('== 7. standard back button 44 x 40 ==');
  { const std = html.slice(html.indexOf('<style id="ewBackStd">'), html.indexOf('</style>', html.indexOf('<style id="ewBackStd">')));
    ok(!/#campaign[^{]*\{[^}]*height:38px/.test(std) && /#campaign\.active > \.backbtn, #campaign > \.btn\.backbtn\{[^}]*min-height:40px!important;min-width:56px!important/.test(std), 'campaign Back: min 56 x 40 (was 38 tall)');
    ok(/\.screen\.popout > \.ew-pinned-exits \.backbtn\{[^}]*min-width:44px!important;min-height:40px!important/.test(std), 'the pop-out Back in the pinned exits row (hero window): min 44 x 40'); }
})().then(() => { console.log((SOFT ? 'SOFT ' : '') + 'test_lockdown_account_hud_1455.js: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); },
  e => { console.error(e && e.stack || e); process.exit(1); });
