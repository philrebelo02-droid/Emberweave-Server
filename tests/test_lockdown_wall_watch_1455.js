// v1455 lockdown audit 25 Nov 2026 - City Wall + Watch Tower (audit/citywall-watchtower.md) and Starless Well / Arena (audit/vault-arena-well.md)
// fixes, checked without a browser (page source + headless page through server/sim-host.js + the server's pure march / watch read modules).
//  1. RESET COMP - the row holding RESET stays on the wall line editor (only BATTLE hides on defence screens).
//  2. Target names - Watch Tower and the Marches list show "Voidglass", not the raw key "crystal"; a siege march names its site.
//  3. Well "Heroes button" - a tent loan that has not fought yet is listed in the Heroes window.
//  4. Arena "Result screen" - the result line shows the arena coins and glyph fragments the server paid.
// CONTROL: LF_HTML=<the v1454 page> LF_ROOT=<a v1454 checkout's server dir> LF_SOFT=1 lists the checks the old code fails. Exit 0 = all passed.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const HTML = process.env.LF_HTML || path.join(root, 'emberweave-heroes.html');
const SRVDIR = process.env.LF_ROOT || path.join(root, 'server');
const html = fs.readFileSync(HTML, 'utf8');
const SOFT = !!process.env.LF_SOFT; let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); return; } fail++; console.log('  FAIL ' + m); if (!SOFT) { console.log('test_lockdown_wall_watch_1455.js: FAILED after ' + pass + ' passed'); process.exit(1); } };
const host = require(path.join(root, 'server', 'sim-host.js')).load(HTML);
const R = s => vm.runInContext(s, host.ctx, { timeout: 60000 });
const J = s => { try { const r = R('JSON.stringify(' + s + ')'); return r === undefined ? null : JSON.parse(r); } catch (e) { return { __err: String(e && e.message || e) }; } };

console.log('== 1. RESET COMP on the wall line editor ==');
{ ok(/\{ const _row=document\.getElementById\('startRow'\); if\(_row\) _row\.style\.display = 'flex'; \}/.test(html), 'the start row (BATTLE + RESET) is shown on every squad screen');
  ok(/document\.getElementById\('startBtn'\)\.style\.display = setDef\?'none':'block';/.test(html), 'BATTLE still hides on the wall / arena-defence editors');
  ok(/<div id="startRow"[^>]*>[\s\S]{0,400}id="resetCompBtn"/.test(html), 'RESET sits in that row');
  ok(/_rc\.onclick=\(\)=>\{[\s\S]{0,300}isWallCtx\(teamCtx\)&&ACC\.token\)pushSave\(\)/.test(html), 'RESET on a wall line saves the wall (the handler was always written for it)'); }

console.log('== 2. Watch Tower / Marches: resource display names, siege site name ==');
{ ok(/t\('watch\.mine',\{lv:m\.level\?\?'\?',res:m\.resource\?mnResName\(m\.resource\):'resource'\}\)/.test(html), 'Watch Tower mine rows use the display name');
  ok(/ewT\('march\.srv_mine',\{n:m\.level,res:m\.resource\?mnResName\(m\.resource\):''\}\)/.test(html), 'the Marches list server rows use the display name');
  const rows = J(`[t('watch.mine',{lv:1,res:mnResName('crystal')}), ewT('march.srv_mine',{n:3,res:mnResName('iron')})]`) || [];
  ok(rows[0] === 'Lv 1 Voidglass mine' && rows[1] === 'Lv 3 Emberite mine', 'rows read "' + rows.join('" / "') + '" (were "Lv 1 crystal mine")');
  ok(/t\('watch\.city',\{id:m\.defName\|\|m\.siteName\|\|m\.defId\|\|'target'\}\)/.test(html), 'a city row falls back to the siege site name before "target"');
  const { summarize } = require(path.join(SRVDIR, 'world-march-state.js')), { snapshot } = require(path.join(SRVDIR, 'world-watch-state.js'));
  const now = Date.now(), me = { id: 'p1', name: 'Me', worldCityMarches: [{ id: 'm1', kind: 'siege', siteId: 's1', siteName: 'Ashford', heroIds: ['vael'], depart: now - 1000, arriveAt: now + 60000, homeAt: now + 120000 }], worldMineMarches: [] };
  let row = null; try { row = summarize(me, now).marches[0]; } catch (e) { row = { __err: e.message }; }
  ok(row && row.siteName === 'Ashford' && row.kind === 'city', 'the server march read names the siege site (' + JSON.stringify(row && (row.siteName || row.__err)) + ')');
  let w = null; try { w = snapshot({ users: { p1: me }, guilds: {} }, me, now, {}).mates[0].marches[0]; } catch (e) { w = { __err: e.message }; }
  ok(w && w.siteName === 'Ashford', 'the Watch Tower feed carries it (' + JSON.stringify(w && (w.siteName || w.__err)) + ')'); }

console.log('== 3. Starless Well: a tent loan is in the Heroes window before it fights ==');
{ const s = html.slice(html.indexOf('function renderWellHeroList('), html.indexOf('function renderHeroList('));
  ok(/const keys=\[\.\.\.new Set\(\[\.\.\.owned,\.\.\.Object\.keys\(run\),\.\.\.\(Array\.isArray\(S\.loans\)\?S\.loans:\[\]\)\]\)\]/.test(s), 'the list is owned heroes + heroes that fought + the run\'s loans');
  const srv = fs.readFileSync(path.join(SRVDIR, 'starless-well.js'), 'utf8');
  ok(/R\.loans\.push\((sq\.hero|tentPick)\)/.test(srv), 'the server keeps the loan in run.loans (what the view sends)'); }   /* v1457: the tent's chosen hero (tests/test_phil_answers_1457.js) */

console.log('== 4. Arena result line: arena coins + glyph fragments ==');
{ ok(/const _ac=\(d&&\(d\.reward\|0\)>0\)\?` · \$\{uiIcon\('res-arena-coins'\)\} \+\$\{d\.reward\|0\}`:'';/.test(html), 'the arena coins the server paid (d.reward)');
  ok(/const _gf=\(d&&Array\.isArray\(d\.glyphFrags\)&&d\.glyphFrags\.length\)/.test(html), 'the glyph fragments the server paid (d.glyphFrags)');
  ok(/\+\$\{reward\}`\)\+_ac\+_gf\+_mv\+_rc;/.test(html) && /'<\/b>'\}\)\}`\+_ac\+_mv\+_rc\);/.test(html), 'both on the win line; the 5 coins of a loss on the loss line');
  const srv = fs.readFileSync(process.env.LF_SERVER || path.join(root, 'server.js'), 'utf8');
  ok(/const aresp=\{ rank:me\.rank, delta:r\.delta, reward, coins:me\.coins, glyphFrags,/.test(srv), 'the server reply carries reward (coins) and glyphFrags'); }

console.log('test_lockdown_wall_watch_1455.js: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
