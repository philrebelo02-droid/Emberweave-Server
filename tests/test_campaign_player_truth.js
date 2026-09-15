const assert = require('node:assert/strict');
const BASE = 'http://127.0.0.1:' + (process.env.PORT || '18791');
let token = '';
async function api(path, method = 'GET', body) {
  const response = await fetch(BASE + path, {
    method,
    headers: {'content-type': 'application/json', ...(token ? {'x-token': token} : {})},
    ...(body ? {body: JSON.stringify(body)} : {}),
  });
  return {status: response.status, json: await response.json()};
}
async function main() {
  const name = 'truth' + Date.now().toString(36);
  const reg = await api('/api/register', 'POST', {name, pass: 'password1'});
  assert.equal(reg.status, 200);
  token = reg.json.token;
  const squad = ['vael', 'sylthaine', 'vireo'];
  const start = await api('/api/campaign/start', 'POST', {
    mode: 'normal', node: 1, heroIds: squad, requestId: 'pt-start-1',
  });
  assert.equal(start.status, 200, JSON.stringify(start.json));
  const witnessed = JSON.stringify({t: 60, won: true, stars: 3, wave: 2,
    u: squad.map(k => [k, 'ally', 1, 500, 0, 100, 100])});
  const resolve = await api('/api/campaign/resolve', 'POST', {
    attemptId: start.json.attemptId, requestId: 'pt-resolve-1',
    inputLog: [[1, 'auto', -1, 1]], digest: witnessed, won: true, stars: 3,
  });
  assert.equal(resolve.status, 200, JSON.stringify(resolve.json));
  assert.equal(resolve.json.ok, true);
  assert.equal(resolve.json.won, true);
  assert.equal(resolve.json.stars, 3);
  assert.equal(resolve.json.digestMatch, false);
  assert.equal(resolve.json.replayIncident, true);
  assert.equal(resolve.json.reward.first, true);
  assert.equal(resolve.json.ledger.camp.cleared, 1);
  const same = await api('/api/campaign/resolve', 'POST', {
    attemptId: start.json.attemptId, requestId: 'pt-resolve-1',
    inputLog: [], digest: witnessed, won: true, stars: 3,
  });
  assert.equal(same.json.ledger.rev, resolve.json.ledger.rev);
  const second = await api('/api/campaign/resolve', 'POST', {
    attemptId: start.json.attemptId, requestId: 'pt-resolve-2',
    inputLog: [], digest: witnessed, won: true, stars: 3,
  });
  assert.equal(second.json.ok, false);
  const start2 = await api('/api/campaign/start', 'POST', {
    mode: 'normal', node: 2, heroIds: squad, requestId: 'pt-start-2',
  });
  assert.equal(start2.status, 200, JSON.stringify(start2.json));
  const invalid = await api('/api/campaign/resolve', 'POST', {
    attemptId: start2.json.attemptId, requestId: 'pt-invalid',
    inputLog: [], digest: 'broken', won: true, stars: 3,
  });
  assert.equal(invalid.json.ok, false);
  assert.equal(invalid.json.ledger.camp.cleared, 1);
  console.log('PASS: witnessed win paid on replay mismatch, no duplicate grant, malformed verdict refused');
}
main().catch(e => {console.error(e); process.exitCode = 1;});
