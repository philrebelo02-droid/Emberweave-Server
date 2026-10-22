// 22 Oct 2026 (ChatGPT's run-ahead audit, confirmed by Claude): pollPvpReports imported war reports into G.mail and told the
// server to delete its copy (reports-ack) with the mail still only in memory - a crash or reload before an unrelated save lost
// them. Now it saves first and acks only after the cloud save answers ok; a report is imported once by its id.
// Runs the real pollPvpReports from emberweave-heroes.html with stubbed api/save. Usage: node test_mail_ack_after_save_22oct.js [repo root]
const fs = require('fs'), path = require('path');
const root = process.argv[2] || path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8');
let fail = 0, n = 0;
const check = (ok, what) => { n++; if (!ok) { fail++; console.log('FAIL: ' + what); } };
const i = html.indexOf('function pollPvpReports(){');
let d = 0, j = html.indexOf('{', i); for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}' && --d === 0) break; }
const src = html.slice(i, j + 1);
check(i > 0 && src.length > 200, 'pollPvpReports not found');

async function run(saveOk, G, reports) {
  const log = [], mail = [];
  const env = {
    ACC: { token: 't' }, online: () => true, G,
    api: (route, method, body) => { log.push('api ' + route); if (route === '/api/pvp/reports') return Promise.resolve({ reports }); if (route === '/api/pvp/reports-ack') { log.push('ACK ' + JSON.stringify(body.ids)); return Promise.resolve({ ok: true }); } return Promise.resolve({}); },
    addMail: (box, m) => { mail.push(m.subj); log.push('addMail'); }, hasWarMail: () => false,
    updateMailBadges: () => {}, bannerMsg: () => {}, statusIcon: () => '',
    saveG: () => log.push('saveG'), pushSave: () => { log.push('pushSave'); return Promise.resolve(saveOk ? { ok: true } : { error: 'Save too large.' }); },
  };
  const f = Function(...Object.keys(env), src + '\nreturn pollPvpReports;')(...Object.values(env));
  f(); for (let k = 0; k < 20; k++) await new Promise(r => setImmediate(r));
  return { log, mail };
}
(async () => {
  const reps = [{ id: 'r1', from: 'Bram', won: false, t: 1 }, { id: 'r2', kind: 'war-declared', from: 'Iver', t: 2 }];
  // a) cloud save ok: saved before the ack, and the ack happens
  let G = { mail: [] };
  let a = await run(true, G, reps);
  const iSave = a.log.indexOf('saveG'), iAck = a.log.findIndex(x => x.startsWith('ACK'));
  check(iSave >= 0 && iAck > iSave, 'the mail is not saved before the server is told to delete it: ' + JSON.stringify(a.log));
  check(iAck >= 0 && a.log[iAck] === 'ACK ["r1","r2"]', 'no ack after a successful save');
  // b) cloud save fails: no ack, so the server keeps the reports
  let b = await run(false, { mail: [] }, reps);
  check(!b.log.some(x => x.startsWith('ACK')), 'acked although the cloud save failed - the reports would be lost: ' + JSON.stringify(b.log));
  // c) the same reports come back after a failed save: no duplicate mail
  let c = await run(true, G, reps);
  check(c.mail.length === 0, 'a re-delivered report was imported twice (' + c.mail.length + ' duplicates)');
  check(c.log.some(x => x.startsWith('ACK')), 'the re-delivered reports are never acked');
  console.log(fail ? 'FAIL ' + fail + ' of ' + n : 'PASS ' + n + ' checks (war mail saved before the ack, once per report)');
  process.exit(fail ? 1 : 0);
})();
