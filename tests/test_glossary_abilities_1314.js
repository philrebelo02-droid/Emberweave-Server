// v1314 (Phil 8 Nov 2026): "please put a better description in glossary of abilities of heroes, monsters and bosses".
// Every monster / boss / summon ability on its Glossary card is one sentence generated from the kit the fight runs, with the fight's numbers
// (burst = mul x 1.3 caster bonus x the type's ap multiplier, DoT = dps x the stat, control = ccSecFor, cooldown); passives carry their
// numbers; a hero's ultimate (and damage skills) keep the abilityMeta numbers line. Expected values are computed from the kit data here,
// and two are cross-checked against a real engine cast (_doEffectCore with dealDamage recorded).
// CONTROL: the v1313 page (git show 0884d29a) - Magmourn's Ignite All line had no number, Rhukk's ult line had no %.
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let PASS = 0, FAIL = 0;
const ck = (n, c, x) => { if (c) { PASS++; console.log('  ok   ' + n); } else { FAIL++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + x : '')); } };
const load = f => require(path.join(ROOT, 'server', 'sim-host.js')).load(f);
const NEW = load(path.join(ROOT, 'emberweave-heroes.html'));
const oldFile = path.join(ROOT, '.test-1314-v1313.html');
fs.writeFileSync(oldFile, cp.execSync('git show 0884d29a:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
process.on('exit', () => { try { fs.unlinkSync(oldFile); } catch (e) {} });
const OLD = load(oldFile);
const R = (h, c) => vm.runInContext(c, h.ctx);
const J = JSON.stringify;
R(NEW, 'glFill()'); R(OLD, 'glFill()');
const strip = s => String(s).replace(/<[^>]+>/g, '');
const rows = (h, id) => [...R(h, 'monKitHtml(' + J(id) + ')').matchAll(/<div class="glAb[^"]*">([\s\S]*?)<\/div>/g)].map(m => strip(m[1]));
const row = (h, id, name) => rows(h, id).find(r => r.startsWith(name)) || '';
const kit = (id) => R(NEW, '(function(){ const k=MONSTER_KITS[' + J(id) + '], t=MONSTER_TYPES[' + J(id) + ']; return {k:JSON.parse(JSON.stringify(k)), role:t.role, dp:t.damageProfile, ap:t.ap||1, METER:METER}; })()');
const burst = (K, mul) => Math.round(mul * ((K.role === 'Mage' || (K.role === 'Tank' && K.dp === 'Magic')) ? 1.3 : 1) * K.ap * 100);
const m1 = (K, r) => (+(r / K.METER).toFixed(1)) + ' m';
const cc = (ab, k) => R(NEW, 'ccSecFor(' + J(ab) + ',' + J(k) + ')');

console.log('== Magmourn ==');
{ const K = kit('magmourn'), g = K.k.green, b = K.k.blue, fb = row(NEW, 'magmourn', g.name), ig = row(NEW, 'magmourn', b.name);
  const p = burst(K, g.mul);
  ck('Fireball: ' + p + '% of Ability Power, aimed at the lowest-health back-row hero, ' + m1(K, g.radius) + ', every ' + g.cd + ' s',
    fb.includes(p + '% of Ability Power') && /lowest-health back-row hero/.test(fb) && fb.includes(m1(K, g.radius)) && fb.includes('Every ' + g.cd + ' s'), fb);
  ck('Ignite All: ' + Math.round(b.dps * 100) + '% of Ability Power a second for ' + b.dur + ' s to every hero within ' + m1(K, b.radius),
    ig.includes(Math.round(b.dps * 100) + '% of Ability Power a second for ' + b.dur + ' s') && ig.includes(m1(K, b.radius)) && ig.includes('Every ' + b.cd + ' s'), ig);
  const ps = row(NEW, 'magmourn', 'Passive'), imm = Math.round(R(NEW, 'SKLV.immolate(1)') * 100);
  ck('Immolate passive: ' + imm + '% of Ability Power every second within 2.4 m', ps.includes(imm + '% of Ability Power') && ps.includes('2.4 m'), ps);
  // the engine: one real Fireball / Ignite All cast against a hero standing in the blast
  const eng = R(NEW, `(function(){ const rec=[], _dd=dealDamage; dealDamage=function(u,t,a){ rec.push(a); }; const out={};
    try{ for(const s of ['green','blue']){ rec.length=0; const m=makeUnit('magmourn','enemy',600,300,1,{boss:true}), h=makeUnit('lumi','ally',580,300,1,{});
      units=[m,h]; m.target=h; m._castSM=1; m._castLv=1; m._aimWX=h.x; m._aimWY=h.y; const ab=MONSTER_KITS.magmourn[s]; _doEffectCore(m,ab.type,ab);
      out[s]={hit:rec.length?rec[0]/monSkillStat(m):0, dot:(h.dots&&h.dots[0])?h.dots[0].dps/monSkillStat(m):0}; } } finally{ dealDamage=_dd; units=[]; }
    return out; })()`);
  ck('the engine agrees: a real Fireball deals ' + (eng.green.hit * 100).toFixed(1) + '% of his Ability Power (shown ' + p + '%)', Math.round(eng.green.hit * 100) === p, J(eng));
  ck('the engine agrees: a real Ignite All burns ' + Math.round(eng.blue.dot * 100) + '% a second (shown ' + Math.round(b.dps * 100) + '%)', Math.round(eng.blue.dot * 100) === Math.round(b.dps * 100), J(eng));
}
console.log('== Irix ==');
{ const K = kit('irix'), g = K.k.green, b = K.k.blue, a = row(NEW, 'irix', g.name), c = row(NEW, 'irix', b.name), ps = row(NEW, 'irix', 'Passive');
  ck('Meteor Pinions: the ' + g.n + ' nearest heroes, ' + burst(K, g.mul) + '% of Attack Damage each', a.includes(g.n + ' nearest heroes') && a.includes(burst(K, g.mul) + '% of Attack Damage'), a);
  const st = +cc(b, 'stun').toFixed(2);
  ck('Talon Eclipse: ' + burst(K, b.mul) + '% of Attack Damage and a ' + st + ' s stun (the fight\'s CC table)', c.includes(burst(K, b.mul) + '% of Attack Damage') && c.includes(st + ' s'), c);
  const sd = Math.round(R(NEW, 'SKLV.stardust(1)') * 100);
  ck('Stardust passive: ' + sd + '% of Attack Damage burn', ps.includes(sd + '% of Attack Damage') && /burn/.test(ps), ps);
}
console.log('== Nerissa ==');
{ const K = kit('nerissa'), g = K.k.green, b = K.k.blue, a = row(NEW, 'nerissa', g.name), c = row(NEW, 'nerissa', b.name), ps = row(NEW, 'nerissa', 'Passive');
  ck('Royal Undertow: ' + burst(K, g.mul) + '% of Ability Power within ' + m1(K, g.radius), a.includes(burst(K, g.mul) + '% of Ability Power') && a.includes(m1(K, g.radius)), a);
  ck('Pearl Sentence: ' + burst(K, b.mul) + '% of Ability Power + stun', c.includes(burst(K, b.mul) + '% of Ability Power') && c.includes(+cc(b, 'stun').toFixed(2) + ' s'), c);
  ck('Tide Reserve passive has its numbers', /\d+% of its max health/.test(ps), ps);
}
console.log('== a summon (Ink Horror) ==');
{ const K = kit('ink horror'), g = K.k.green, a = row(NEW, 'ink horror', g.name);
  ck('Ink Spin: ' + burst(K, g.mul) + '% of Ability Power within ' + m1(K, g.radius), a.includes(burst(K, g.mul) + '% of Ability Power') && a.includes(m1(K, g.radius)), a); }
console.log('== every monster, boss and summon ==');
{ const list = R(NEW, `['monsters','bosses','summons'].flatMap(c=>GLOSSARY_DATA[c].map(e=>e.id)).filter(id=>MONSTER_KITS[id])`);
  const bad = [];
  for (const id of list) { const k = R(NEW, 'MONSTER_KITS[' + J(id) + ']'); const rs = rows(NEW, id);
    for (const s of ['green', 'blue']) if (k[s]) { const r = rs.find(x => x.startsWith(k[s].name + ' — ')) || ''; const d = r.slice(k[s].name.length + 3);
      if (!d || !/\d/.test(d) || /undefined|NaN|\{\w+\}/.test(d)) bad.push(id + '/' + s + ': ' + r); }
    if (k.pass) { const r = rs.find(x => x.startsWith('Passive')) || ''; const d = r.split(' — ').slice(1).join(' — ');
      if (!d || /undefined|NaN|\{\w+\}/.test(d)) bad.push(id + '/pass: ' + r); } }
  ck(list.length + ' kits: every ability has a numbered description and every passive a description', bad.length === 0, bad.slice(0, 5).join(' | '));
}
console.log('== heroes ==');
for (const k of ['rhukk', 'lumi', 'sorrel']) {
  const html = R(NEW, 'heroKitHtml(' + J(k) + ')'), ult = strip((html.match(/<div class="glAb">([\s\S]*?)<\/div>/) || [])[1] || '');
  const meta = R(NEW, 'langMeta(abilityMeta(' + J(k) + ',0))');
  ck(k + ': the ultimate line carries its numbers (' + (meta.match(/\d+% of [A-Z][a-z]+(?: [A-Z][a-z]+)?/) || [''])[0] + ')', /\d+% of /.test(ult) && ult.includes(strip(meta).trim().replace(/^— /, '')), ult);
}
console.log('== language ==');
{ const keys = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'lang', 'en.json'), 'utf8'))).filter(k => /^gloss\.abp?_/.test(k) && !/^gloss\.abil_/.test(k));
  const vars = s => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
  const EN = JSON.parse(fs.readFileSync(path.join(ROOT, 'lang', 'en.json'), 'utf8')); const miss = [];
  for (const c of ['es', 'pt-BR', 'fr', 'de', 'it', 'nl', 'ru', 'tr', 'ja', 'ko', 'zh-Hans', 'zh-Hant', 'th', 'id', 'hi']) { const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'lang', c + '.json'), 'utf8'));
    for (const k of keys) if (typeof d[k] !== 'string' || !d[k].trim() || vars(d[k]) !== vars(EN[k]) || d[k] === EN[k]) miss.push(c + ':' + k); }
  ck(keys.length + ' new gloss.ab_* keys translated in all 15 languages with the same placeholders', keys.length >= 50 && miss.length === 0, miss.slice(0, 5).join(' '));
  const inl = R(NEW, 'Object.keys(EW_LANG_EN).filter(k=>/^gloss\\.abp?_/.test(k)&&!/^gloss\\.abil_/.test(k)).length');
  ck('the page\'s inline English has them too', inl === keys.length, inl + ' vs ' + keys.length);
  R(NEW, 'LANG.dict=' + fs.readFileSync(path.join(ROOT, 'lang', 'de.json'), 'utf8') + '; LANG.cur="de";');
  const de = row(NEW, 'magmourn', 'Fireball');
  R(NEW, 'LANG.dict=null; LANG.cur="en";');
  ck('in German the card reads German (Fireball: ' + de.slice(0, 60) + '...)', /Feuerball/.test(de) && /333%/.test(de), de);
}
console.log('== CONTROL: v1313 ==');
{ const ig = row(OLD, 'magmourn', 'Ignite All'); ck('CONTROL: v1313 Ignite All had no number ("' + ig + '")', ig && !/\d/.test(ig), ig);
  const ult = strip((R(OLD, "heroKitHtml('rhukk')").match(/<div class="glAb">([\s\S]*?)<\/div>/) || [])[1] || '');
  ck('CONTROL: v1313 Rhukk ultimate line had no %', ult && !/%/.test(ult), ult); }
console.log('test_glossary_abilities_1314.js: ' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
