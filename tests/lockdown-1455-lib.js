// Shared helper for the v1455 lockdown fix tests (test_lockdown_*_1455.js): the live server.js loaded in-process with its listener
// switched off and a temp DB (nothing is written into the worktree), and a fake-request caller for its real routes.
// Same loader as tests/test_heroes_fixes_1455.js section 8. LF_SERVER=<another server.js> loads that one instead (controls).
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), Module = require('module'), EE = require('events'), assert = require('assert');
const root = path.join(__dirname, '..');
function loadServer(parent) {
  process.env.ALLOW_NEW_GUESTS = '1'; const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-lf1455-'));
  process.env.DB_FILE = path.join(tmp, 'db.json'); process.env.PORT = '0'; process.env.DATABASE_URL = ''; delete process.env.GITHUB_BACKUP_TOKEN; delete process.env.GITHUB_BACKUP_REPO;
  let src = fs.readFileSync(process.env.LF_SERVER || path.join(root, 'server.js'), 'utf8');
  assert(src.includes('server.listen(PORT,'), 'server.listen not found'); src = src.replace('server.listen(PORT,', '(function(){})(PORT,') + '\nmodule.exports.__get=function(n){ return eval(n); };';
  const file = path.join(root, 'server.js'); const mod = new Module(file, parent); mod.filename = file; mod.paths = Module._nodeModulePaths(root); mod._compile(src, file);
  const S = new Proxy({}, { get: (t, k) => { try { return mod.exports.__get(k); } catch (e) { return undefined; } } }); const server = S.server; let ipn = 0;
  const call = (route, data, token) => new Promise(resolve => { const req = new EE(); req.method = data ? 'POST' : 'GET'; req.url = route; req.headers = { 'content-type': 'application/json' }; if (token) req.headers['x-token'] = token;
    req.socket = { remoteAddress: '10.9.1.' + ((ipn++ % 250) + 1) }; req.pause = () => {}; req.destroy = () => {};
    const res = { statusCode: 200, headersSent: false, _h: {}, setHeader(k, v) { this._h[k] = v; }, getHeader(k) { return this._h[k]; }, writeHead(c) { this.statusCode = c; this.headersSent = true; },
      end(b) { let j = null; try { j = JSON.parse(String(b || '')); } catch (e) { j = String(b || ''); } resolve({ status: this.statusCode, data: j }); }, write() {}, on() {} };
    server.emit('request', req, res); setImmediate(() => { if (data) req.emit('data', Buffer.from(JSON.stringify(data))); req.emit('end'); }); });
  const guest = async tag => { const g = await call('/api/guest', { deviceId: 'lf1455-' + tag + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) }); const T = g.data.token, id = g.data.profile.id; await call('/api/ledger', null, T); return { T, id, u: S.DB.users[id] }; };
  return { S, call, guest, tmp };
}
module.exports = { loadServer, root };
