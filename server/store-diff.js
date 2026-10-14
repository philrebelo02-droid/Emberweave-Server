'use strict';
/* v1128 PLAYER DIFFS FOR THE SAVE JOURNAL (server/store-journal.js). Bench 12 Oct 2026: a whole player per save was 38 KB for a war
   player (13 settled marches of 2.5 KB each) and 12 KB for a campaign player (the ledger), rewritten with every action.

   diff(player, prev) compares a player with the signature kept from its last write and returns the patch that turns the last
   written player into this one:
     {"w": player}                                   no signature yet (first write since boot / a full save): the whole player
     {"f":{field:value}, "x":[field],                fields set / removed
      "o":{field:{"s":{key:value},"x":[key]}},       a big plain-object field (> BIG chars): only its changed keys
      "a":{field:{"n":length,"s":{index:value}}}}    a big array field: its new length and the changed elements
   apply(player, patch) applies one patch (patches of a player are applied in the order they were written).
   A signature stores each small part as its JSON text and each big one as an md5 - the memory is a few KB per player. */
const crypto = require('crypto');
const BIG = 1024, SMALL = 48;
const md5 = s => crypto.createHash('md5').update(s).digest('base64');
const sig = s => s.length <= SMALL ? s : '#' + md5(s);
const J = x => { const s = JSON.stringify(x); return s === undefined ? undefined : s; };
const put = (o, k, v) => { if (k === '__proto__') Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true }); else o[k] = v; };   // as JSON.parse would
const plain = v => v && typeof v === 'object' && !Array.isArray(v) && typeof v.toJSON !== 'function';

/* returns {patch: JSON text | null (nothing changed), sig: the new signature, whole: the player's JSON text (only when asked)} */
function diff(u, prev, wantWhole) {
  const next = new Map(), f = [], o = [], a = [], wholeParts = wantWhole || !prev ? [] : null;
  for (const k of Object.keys(u)) {
    const v = u[k];
    if (Array.isArray(v)) {
      const parts = v.map(e => { const s = J(e); return s === undefined ? 'null' : s; });
      let total = 2; for (const s of parts) total += s.length + 1;
      if (total > BIG) {
        const sigs = parts.map(sig); next.set(k, { k: 'a', n: parts.length, m: sigs });
        const whole = wholeParts || null, p = prev && prev.get(k);
        if (whole) whole.push(JSON.stringify(k) + ':[' + parts.join(',') + ']');
        if (p && p.k === 'a') {
          const set = []; for (let i = 0; i < parts.length; i++) if (p.m[i] !== sigs[i]) set.push(i);
          if (!set.length && p.n === parts.length) continue;
          if (set.length * 2 > parts.length) f.push([k, '[' + parts.join(',') + ']']);   // most of it moved (a shift): the whole array
          else a.push([k, parts.length, set.map(i => [i, parts[i]])]);
        } else f.push([k, '[' + parts.join(',') + ']']);
        continue;
      }
      const s = '[' + parts.join(',') + ']'; if (wholeParts) wholeParts.push(JSON.stringify(k) + ':' + s);
      const g = sig(s); next.set(k, { k: 'v', s: g }); const p = prev && prev.get(k); if (!p || p.k !== 'v' || p.s !== g) f.push([k, s]);
      continue;
    }
    if (plain(v)) {
      const keys = [], parts = []; let total = 2;
      for (const sk of Object.keys(v)) { const s = J(v[sk]); if (s === undefined) continue; keys.push(sk); parts.push(s); total += sk.length + s.length + 4; }
      const body = () => keys.map((sk, i) => JSON.stringify(sk) + ':' + parts[i]).join(',');
      if (total > BIG) {
        const m = new Map(); for (let i = 0; i < keys.length; i++) m.set(keys[i], sig(parts[i]));
        next.set(k, { k: 'o', m }); const p = prev && prev.get(k);
        let b = null; if (wholeParts) { b = body(); wholeParts.push(JSON.stringify(k) + ':{' + b + '}'); }
        if (p && p.k === 'o') {
          const sets = []; for (let i = 0; i < keys.length; i++) if (p.m.get(keys[i]) !== m.get(keys[i])) sets.push([keys[i], parts[i]]);
          const dels = []; for (const sk of p.m.keys()) if (!m.has(sk)) dels.push(sk);
          if (sets.length || dels.length) o.push([k, sets, dels]);
        } else f.push([k, '{' + (b === null ? body() : b) + '}']);
        continue;
      }
      const s = '{' + body() + '}'; if (wholeParts) wholeParts.push(JSON.stringify(k) + ':' + s);
      const g = sig(s); next.set(k, { k: 'v', s: g }); const p = prev && prev.get(k); if (!p || p.k !== 'v' || p.s !== g) f.push([k, s]);
      continue;
    }
    const s = J(v); if (s === undefined) continue;   // undefined / functions are not in JSON
    if (wholeParts) wholeParts.push(JSON.stringify(k) + ':' + s);
    const g = sig(s); next.set(k, { k: 'v', s: g }); const p = prev && prev.get(k); if (!p || p.k !== 'v' || p.s !== g) f.push([k, s]);
  }
  const whole = wholeParts ? '{' + wholeParts.join(',') + '}' : undefined;
  if (!prev) return { patch: '{"w":' + whole + '}', sig: next, whole };
  const x = []; for (const k of prev.keys()) if (!next.has(k)) x.push(k);
  if (!f.length && !x.length && !o.length && !a.length) return { patch: null, sig: next, whole };
  let p = '{';
  const sep = () => (p.length > 1 ? ',' : '');
  if (f.length) p += sep() + '"f":{' + f.map(([k, s]) => JSON.stringify(k) + ':' + s).join(',') + '}';
  if (x.length) p += sep() + '"x":' + JSON.stringify(x);
  if (o.length) p += sep() + '"o":{' + o.map(([k, sets, dels]) => JSON.stringify(k) + ':{"s":{' + sets.map(([sk, s]) => JSON.stringify(sk) + ':' + s).join(',') + '}' + (dels.length ? ',"x":' + JSON.stringify(dels) : '') + '}').join(',') + '}';
  if (a.length) p += sep() + '"a":{' + a.map(([k, n, sets]) => JSON.stringify(k) + ':{"n":' + n + ',"s":{' + sets.map(([i, s]) => '"' + i + '":' + s).join(',') + '}}').join(',') + '}';
  return { patch: p + '}', sig: next, whole };
}

// one patch onto the player as last written (null = the player is gone)
function apply(u, p) {
  if (p === null || p === undefined) return null;
  if (p.w !== undefined) return p.w;
  if (!u || typeof u !== 'object') u = {};
  if (p.f) for (const k of Object.keys(p.f)) put(u, k, p.f[k]);
  if (p.x) for (const k of p.x) delete u[k];
  if (p.o) for (const k of Object.keys(p.o)) { let t = u[k]; if (!plain(t)) { t = {}; put(u, k, t); } const q = p.o[k];
    if (q.s) for (const sk of Object.keys(q.s)) put(t, sk, q.s[sk]); if (q.x) for (const sk of q.x) delete t[sk]; }
  if (p.a) for (const k of Object.keys(p.a)) { let t = u[k]; if (!Array.isArray(t)) { t = []; put(u, k, t); } const q = p.a[k];
    t.length = q.n; if (q.s) for (const i of Object.keys(q.s)) t[+i] = q.s[i]; }
  return u;
}

module.exports = { diff, apply, BIG, SMALL, sig, J, plain };   // v1134: sig / J / plain for the world store's per-key piece patches
