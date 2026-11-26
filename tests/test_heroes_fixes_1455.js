// v1455 lockdown audit 25 Nov 2026 (Heroes > 15 - Heroes Panel): the Heroes Panel fixes, checked without a browser.
// The page runs headless through server/sim-host.js (the same engine the server replays fights with); the server runs
// in-process with its listener switched off and a temp DB (nothing is written into the worktree). The on-screen part
// of fix 1 (the arrows) is tests/test_heroes_fixes_1455_screen.js (browser, cluster only).
// CONTROL: HF_HTML=<the v1454 page> HF_SERVER=<the v1454 server.js> HF_SOFT=1 lists the checks the old code fails.
// Exit 0 = all passed.
'use strict';
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm'), crypto = require('crypto'), Module = require('module'), EE = require('events');
const root = path.join(__dirname, '..');
const HTML = process.env.HF_HTML || path.join(root, 'emberweave-heroes.html');
const html = fs.readFileSync(HTML, 'utf8');
const SOFT = !!process.env.HF_SOFT; let pass = 0, fail = 0;
const ok = (c, m) => { if (!c && SOFT) { fail++; console.log('  FAIL ' + m); return; } assert(c, m); pass++; console.log('  ok   ' + m); };
const host = require(path.join(root, 'server', 'sim-host.js')).load(HTML);
const R = s => vm.runInContext(s, host.ctx, { timeout: 60000 });
const J = s => { try { const r = R('JSON.stringify(' + s + ')'); return r === undefined ? null : JSON.parse(r); } catch (e) { if (SOFT) return null; throw e; } };
R(`G.unlocked=G.unlocked||{}; HERO_KEYS.forEach(k=>G.unlocked[k]=true); G.heroXP=G.heroXP||{}; HERO_KEYS.forEach(k=>G.heroXP[k]=xpForLevel(30));
window.__sheetAp=function(k){ const t=HERO_TYPES[k]; return Math.round(heroStat(k,t.apow||0,'apow'))+heroFlatApow(k)+((t.apow||0)>0?techFlat('ap'):0); };
window.__sheetAtk=function(k){ const t=HERO_TYPES[k],mul=heroMuls(k); return Math.round(heroStat(k,t.dmg,'dmg')*mul.atk)+heroFlatAtk(k); };`);
const CODES = ['es', 'pt-BR', 'fr', 'de', 'it', 'nl', 'ru', 'tr', 'ja', 'ko', 'zh-Hans', 'zh-Hant', 'th', 'id', 'hi'];
const pack = c => JSON.parse(fs.readFileSync(path.join(root, 'lang', c + '.content.json'), 'utf8'));
const withLang = (c, fn) => { host.ctx.__C = c === 'en' ? null : pack(c); R(`LANG.cur=${JSON.stringify(c)}; LANG.content=__C;`); try { return fn(); } finally { R("LANG.cur='en'; LANG.content=null;"); } };

console.log('== 1. prev / next arrows: no CSS rule hides them in the hero window pop-out ==');
{ const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const hiding = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => /hero-nav|#heroPrev|#heroNext/.test(m[1]) && /display\s*:\s*none/.test(m[2]))
    .flatMap(m => m[1].split(',').map(s => s.trim())).filter(s => /hero-nav|#heroPrev|#heroNext/.test(s));
  const hitsPopout = hiding.filter(s => /\.popout/.test(s) && !/:not\(#heroDetail\)/.test(s) && !/:not\(\.popout\)/.test(s));
  ok(hitsPopout.length === 0, 'no display:none rule reaches the arrows in #heroDetail.popout (' + (hitsPopout.join(' | ') || 'none') + ')');
  ok(/\.screen\.popout:not\(#heroDetail\) \.hero-nav\{display:none;\}/.test(html), 'other pop-outs still hide stray arrows');
  ok(/#heroDetail\.tl-short\.popout > \.hero-nav\{[^}]*z-index:42/.test(html), 'short Talents layout in the pop-out: the arrows sit above the pinned top row (z-index 42 > 40)'); }

console.log('== 2. Hero XP from trials: reported as "line out of date" (no code change) - the trial route still refuses all three kinds ==');
{ const srv = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  ok(/kind==='gauntlet'\) return \{ok:false,error:'The Gauntlet is retired.'\}/.test(srv) && /kind==='tower'\) return \{ok:false/.test(srv) && /kind==='dungeon'\) return \{ok:false/.test(srv), 'tower / gauntlet / dungeon refused on /api/trial/resolve (retired modes - no new reward invented)');
  ok(/const VAULT_HERO_XP_PER_FLOOR=30;/.test(srv), 'the Vault (the old "dungeon") pays 30 hero XP a floor on its own ladder'); }

console.log('== 3. skill readout uses the real Ability Power (Stats tab = fight) ==');
{ const rows = J(`HERO_KEYS.filter(k=>['Magic','Healer'].includes(HERO_TYPES[k].damageProfile)&&k!==HERO61.KEY).map(k=>{ const a=__sheetAtk(k), ap=__sheetAp(k);
    return [k,[0,1,2,3].map(i=>skillEffectStr(k,i,a,1000)).join('|'),[0,1,2,3].map(i=>skillEffectStr(k,i,a,1000,ap)).join('|')]; })`) || [];
  const diff = rows.filter(r => r[1] !== r[2]);
  ok(rows.length >= 25 && diff.length === 0, rows.length + ' Magic / Healer heroes: the readout with no AP passed equals the one with the Stats tab AP (was 29 of 29 different; first now: ' + (diff[0] ? diff[0][0] : 'none') + ')');
  const sy = J(`(function(){ const k='sylthaine', ap=__sheetAp(k), snap=snapAllySquad([k])[0]; return {ap, snapAp:Math.round(snap.apow||0), sm:skillMul(skillLevel(k,0)), line:skillEffectStr(k,0,__sheetAtk(k),1)}; })()`) || {};
  ok(sy.ap === 56 && sy.snapAp === 56, 'Sylthaine L30: Stats tab AP ' + sy.ap + ', fight snapshot AP ' + sy.snapAp);
  const tick = Math.round(sy.snapAp * 0.5 * sy.sm);
  ok(new RegExp(' ' + tick + '/tick').test(sy.line || '') && tick === 28, 'Blizzard readout "' + sy.line + '" = the fight tick apow x 0.5 = ' + tick + ' (was 44/tick)');
  ok(!/\(t\.apow\|\|0\)\*\(t\.dmg\?atk\/t\.dmg:1\)/.test(html), 'the Attack-based Ability Power estimate is gone from the page'); }

console.log('== 4. caster damage numbers carry the Ability Power icon ==');
{ for (const [k, slots] of [['sylthaine', [0, 1, 2]], ['bloatus', [0, 1, 2]], ['fritz', [0, 1, 2]], ['maren', [1]], ['orryn', [0, 2]], ['vaelora', [0]], ['vesper', [1]]]) {
    const lines = J(`[0,1,2,3].map(i=>skillEffectStr(${JSON.stringify(k)},i,__sheetAtk(${JSON.stringify(k)}),1000,__sheetAp(${JSON.stringify(k)})))`) || [];
    ok(slots.every(i => /\{i:s:[a-z-]+\} \{i:t:apow\} \d/.test(lines[i] || '')), k + ': damage lines ' + slots.join('/') + ' show the Ability Power icon (' + slots.map(i => lines[i]).join(' || ') + ')'); }
  const keep = J(`[skillEffectStr('mirelle',2,100,1000,60),skillEffectStr('lysara',0,100,1000,60),skillEffectStr('vesper',0,100,1000,60),skillEffectStr('lumi',2,100,1000,60),skillEffectStr('sylthaine',3,100,1000,60)]`) || [];
  ok(keep.length === 5 && keep.every(s => !/apow/.test(s)), 'durations, percents and passives keep their own icon only (' + keep.join(' || ') + ')');
  const phys = J(`skillEffectStr('deepcleft',2,100,1000,60)`) || '';
  ok(!/apow/.test(phys), 'an Attack hero gets no Ability Power icon (' + phys + ')');
  for (const c of ['de', 'ja']) { const s = withLang(c, () => J(`[skillEffectStr('fritz',0,1,1,60),skillEffectStr('bloatus',2,1,1,60)]`)) || [];
    ok(s.length === 2 && s.every(x => /\{i:t:apow\}/.test(x)) && !/tick ·/.test(s[0]), c + ': translated lines keep the icon (' + s.join(' || ') + ')'); } }

console.log('== 5. no emoji or text symbols in any skill readout (all heroes, all slots, every language) ==');
{ const SYM = /[←-⇿☀-➿✀-➿]|\p{Extended_Pictographic}/u;
  const ALLOW = /[→×·−]/g;   // arrows / times / middle dot / minus are punctuation in the readouts, not icons
  const all = J(`HERO_KEYS.map(k=>[k,[0,1,2,3].map(i=>{ try{ return skillEffectStr(k,i,__sheetAtk(k),1000,__sheetAp(k))||''; }catch(e){ return ''; } })])`) || [];
  const bad = []; for (const [k, a] of all) a.forEach((s, i) => { if (SYM.test(String(s).replace(ALLOW, ''))) bad.push(k + ':' + i + ' ' + s); });
  ok(all.length === 61 && bad.length === 0, all.length + ' heroes x 4 slots: no emoji / symbol (' + (bad.slice(0, 5).join(' || ') || 'none') + ')');
  const want = { vael: [2, '{i:t:lifesteal}'], deepcleft: [2, '{i:s:untargetable}'], sorrel: [3, '{i:s:attack} every'], nerisse: [0, '{i:s:silence}'], linnet: [0, '{i:s:heal} team health'] };
  for (const [k, [i, tok]] of Object.entries(want)) { const s = J(`skillEffectStr(${JSON.stringify(k)},${i},100,1000,60)`) || ''; ok(s.includes(tok), k + ' slot ' + i + ': "' + s + '"'); }
  ok((J(`skillEffectStr('nerisse',0,100,1000,60)`) || '').includes('{i:s:heal} each silenced'), 'Nerisse ult: the heal part carries the heal icon');
  const en = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'lang', 'content', 'en.json'), 'utf8'));
  const oldK = Object.keys(en).filter(k => /[♥🕳🃏🔇✚↺]/u.test(k));
  ok(oldK.length === 0, 'tools/lang/content/en.json carries no emoji template (' + oldK.length + ')');
  const NEW = ['{i:s:energy} +{0}% atk spd · {i:s:crit-burst} +{1}% crit · {i:t:lifesteal} {2}% lifesteal', '{i:s:heal} team health from {0}s ago + revive at {1}%', '{i:s:attack} every {0}th attack draws a suit',
    '{i:s:silence} {0}s silence in {1}m, re-sung every {2}s for {3}s · {i:s:heal} each silenced enemy heals the ally nearest it for {4} per second · no damage', '{i:s:untargetable} untargetable {0}s → {i:s:attack} {1}'];
  ok(NEW.every(k => k in en), 'the five new templates are in tools/lang/content/en.json');
  const CV = JSON.parse(html.match(/\nconst EW_LANG_CV=(\{.*?\});/)[1]);
  for (const c of CODES.concat(['en-XA'])) { const raw = fs.readFileSync(path.join(root, 'lang', c + '.content.json'), 'utf8'), j = JSON.parse(raw);
    const tokOf = s => (String(s).match(/\{[^{}]*\}/g) || []).sort().join(' ');
    ok(NEW.every(k => typeof j[k] === 'string' && tokOf(j[k]) === tokOf(k) && !/[♥🕳🃏🔇✚↺]/u.test(j[k])) && !Object.keys(j).some(k => /[♥🕳🃏🔇✚↺]/u.test(k)) && crypto.createHash('sha1').update(raw).digest('hex').slice(0, 8) === CV[c === 'en-XA' ? 'qps' : c],
      c + ': the five lines translated with the same icons, no emoji left, pack hash matches EW_LANG_CV'); }
  const lk = withLang('ko', () => J(`skillEffectStr('linnet',0,100,1000,60)`)) || '';
  ok(/^\{i:s:heal\} /.test(lk) && /[가-힯]/.test(lk), 'Korean Linnet ult is translated and starts with the heal icon (' + lk + ')'); }

console.log('== 6. Critical Strike preview row includes the class base crit (as the Stats tab and the fight) ==');
{ const m = html.match(/\['crit',ewT\('hero\.critical_strike'\),ewT\('hero\.pct_chance',\{n:([^}]*)\}\)\]/);
  ok(!!m && /CLASS_BASE_CRIT\[t\.role\]/.test(m[1]) && /Math\.min\(0\.6/.test(m[1]), 'the crit row formula adds CLASS_BASE_CRIT and the 60% cap');
  if (m) { for (const [k, want] of [['meridian', 10], ['yenna', 10], ['hollow', 10], ['veyr', 10], ['rhukk', null]]) {
      const got = J(`(function(){ const key=${JSON.stringify(k)}, t=HERO_TYPES[key], mul=heroMuls(key); return [${m[1]}, Math.round(Math.min(0.6,(mul.crit||0)+(CLASS_BASE_CRIT[t.role]||0))*100), Math.round((snapAllySquad([key])[0].glyphCrit||0)*100), t.role]; })()`) || [];
      ok(got[0] === got[1] && got[0] === got[2] && (want == null || got[0] === want), k + ' (' + got[3] + '): row ' + got[0] + '%, Stats tab ' + got[1] + '%, fight ' + got[2] + '%'); }
    const br = J(`HERO_KEYS.filter(k=>HERO_TYPES[k].role==='Bruiser').map(k=>{ const key=k, t=HERO_TYPES[key], mul=heroMuls(key); return ${m[1]}; })`) || [];
    ok(br.length > 0 && br.every(x => x === 3), 'every Bruiser row shows 3% (' + br.length + ' heroes)'); } }

console.log('== 7. SUMMON NOW shows the stars the hero really arrives at ==');
{ const SIM = require(path.join(root, 'server', 'sim.js'));
  const TWELVE = ['veyr', 'mirelle', 'pellucid', 'orryn', 'hobb', 'tharl', 'askel', 'deepcleft', 'brannus', 'kharos', 'zahri', 'vaelora'];
  const before = J(`(function(){ const keep=SUMMON_SRV; SUMMON_SRV=null; const r=HERO_KEYS.map(k=>[k,summonStars(k)]); SUMMON_SRV=keep; return r; })()`) || [];
  const wrong = before.filter(([k, s]) => s !== Math.max(1, (SIM.HERO_BASE[k] || {}).stars || 1));
  ok(before.length === 61 && wrong.length === 0, 'before the server table loads: all 61 heroes show the server grant stars (wrong: ' + (wrong.map(w => w.join(' ')).join(', ') || 'none') + ')');
  ok(TWELVE.every(k => (before.find(b => b[0] === k) || [])[1] === 3), 'the 12 heroes with start:2 (Veyr ... Vaelora) show 3 stars');
  const tab = J(`(function(){ const keep=SUMMON_SRV; SUMMON_SRV={veyr:{cost:80,stars:3}}; const r=summonStars('veyr'); SUMMON_SRV=keep; return r; })()`);
  ok(tab === 3, 'with the server table loaded: Veyr 3 stars');
  const seg = html.slice(html.indexOf("const summonBar = (!owned && t.locked)"), html.indexOf("body.innerHTML=`${summonBar}"));
  ok(seg.length > 100 && !/heroStartStars\(key\)/.test(seg) && (seg.match(/summonStars\(key\)/g) || []).length === 2, 'the line under SUMMON NOW and the fragment bar both use summonStars (no heroStartStars left)'); }

console.log('== 8. the 9,999 fragment cap holds on the Wishing Pool and the duplicate quest hero (server, in-process) ==');
{ process.env.ALLOW_NEW_GUESTS = '1'; const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-hf1455-'));
  process.env.DB_FILE = path.join(tmp, 'db.json'); process.env.PORT = '0'; process.env.DATABASE_URL = ''; delete process.env.GITHUB_BACKUP_TOKEN; delete process.env.GITHUB_BACKUP_REPO;
  let src = fs.readFileSync(process.env.HF_SERVER || path.join(root, 'server.js'), 'utf8');
  assert(src.includes('server.listen(PORT,'), 'server.listen not found'); src = src.replace('server.listen(PORT,', '(function(){})(PORT,') + '\nmodule.exports.__get=function(n){ return eval(n); };';
  const file = path.join(root, 'server.js'); const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(root); mod._compile(src, file);
  const S = new Proxy({}, { get: (t, k) => mod.exports.__get(k) }); const server = S.server; let ipn = 0;
  const call = (route, data, token) => new Promise(resolve => { const req = new EE(); req.method = data ? 'POST' : 'GET'; req.url = route; req.headers = { 'content-type': 'application/json' }; if (token) req.headers['x-token'] = token;
    req.socket = { remoteAddress: '10.9.0.' + ((ipn++ % 250) + 1) }; req.pause = () => {}; req.destroy = () => {};
    const res = { statusCode: 200, headersSent: false, _h: {}, setHeader(k, v) { this._h[k] = v; }, getHeader(k) { return this._h[k]; }, writeHead(c) { this.statusCode = c; this.headersSent = true; },
      end(b) { let j = null; try { j = JSON.parse(String(b || '')); } catch (e) { j = String(b || ''); } resolve({ status: this.statusCode, data: j }); }, write() {}, on() {} };
    server.emit('request', req, res); setImmediate(() => { if (data) req.emit('data', Buffer.from(JSON.stringify(data))); req.emit('end'); }); });
  module.exports.__serverPromise = (async () => {
    const g = await call('/api/guest', { deviceId: 'hf1455-' + Date.now() }); const T = g.data.token, id = g.data.profile.id; await call('/api/ledger', null, T);
    const u = S.DB.users[id]; let led = u.led;
    led.frags.vael = 9998; S.creditFrags(u, led, 'vael', 5, 'test'); ok(led.frags.vael === 9999, 'CONTROL: a plain credit at 9,998 + 5 stops at 9,999');
    led.unlocked.vael = true; led.frags.vael = 9998; const d = S.poolGrantHero(u, 'vael');
    ok(led.frags.vael === 9999 && d.type === 'dupe' && d.frags === 1, 'Wishing Pool duplicate at 9,998: ' + led.frags.vael + ' fragments, receipt says +' + d.frags + ' (was 10,005, receipt +7)');
    led.frags.vael = 9999; const d2 = S.poolGrantHero(u, 'vael'); ok(led.frags.vael === 9999 && d2.frags === 0, 'Wishing Pool duplicate at 9,999: stays 9,999, receipt +0');
    const pools = []; const gold = S.POOL_GOLD_HEROES || []; for (const k of gold) led.frags[k] = 9998;
    for (let i = 0; i < 6000 && pools.length < 3; i++) { const r = S.poolRollGold(u); if (r && r.type === 'frags' && gold.includes(r.hero)) pools.push([r.hero, led.frags[r.hero], r.frags]); for (const k of gold) led.frags[k] = 9998; }
    ok(pools.length > 0 && pools.every(p => p[1] === 9999 && p[2] === 1), 'Gold wish fragments at 9,998: ' + pools.map(p => p[0] + ' ' + p[1] + ' (+' + p[2] + ')').join(', ') + ' (was 10,001)');
    const srv = fs.readFileSync(process.env.HF_SERVER || path.join(root, 'server.js'), 'utf8');
    ok(!/uncapped:true/.test(srv), 'no creditFrags call passes {uncapped:true} (Mythical, Diamond Pool and quest grants included)');
    led = S.DB.users[id].led; led.camp.cleared = Math.max(6, led.camp.cleared | 0); led.unlocked.vex = true; led.frags.vex = 9998; if (led.quests && led.quests.claimed) delete led.quests.claimed.q_vex;
    const q = await call('/api/quest/claim', { id: 'q_vex', requestId: 'hf-qvex' }, T); led = S.DB.users[id].led;
    ok(q.status === 200 && led.frags.vex === 9999 && q.data && JSON.stringify(q.data).includes('"heroFrags":1'), 'quest "Blade in the Dark" with Vex owned at 9,998: ' + led.frags.vex + ' fragments, receipt +1 (was 10,005, receipt +7) ' + JSON.stringify(q.data && (q.data.got || q.data.reward || q.data.error)).slice(0, 120));
  })(); }

console.log('== 9. Morvayne\'s lore has his title ==');
{ const L = J(`HERO_KEYS.map(k=>[k,(HERO_LORE[k]||{}).title||''])`) || [];
  ok(L.length === 61 && L.every(x => x[1]), 'all 61 heroes have a lore title (missing: ' + (L.filter(x => !x[1]).map(x => x[0]).join(', ') || 'none') + ')');
  const t61 = J('HERO_LORE.hero61.title'), sub = require(path.join(root, 'hero61.js')).IDENTITY.subname;
  ok(t61 === 'The Open Gate' && t61 === sub, 'Morvayne: "' + t61 + '" = his approved title in hero61.js (IDENTITY.subname, Phil 4 Nov)');
  ok(CODES.every(c => typeof pack(c)['The Open Gate'] === 'string' && pack(c)['The Open Gate'] !== 'The Open Gate'), 'the title is translated in all 15 content packs'); }

(module.exports.__serverPromise || Promise.resolve()).then(() => {
  console.log((SOFT ? 'SOFT ' : '') + 'test_heroes_fixes_1455.js: ' + pass + ' passed' + (SOFT ? ', ' + fail + ' failed' : ''));
  process.exit(SOFT && fail ? 1 : 0); }, e => { console.error(e && e.stack || e); process.exit(1); });
