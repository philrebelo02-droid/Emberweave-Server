'use strict';
/* v1097 CHAT FILTER (App Store user-content rule; 9 Oct 2026 full-game sweep #18).
   One server-side word list for every place a player writes text other players read:
   - chat (world, region, guild) and whispers: a listed word is MASKED with asterisks (the line still goes out);
   - player names and guild names: a name that hits the list is REFUSED (badNewName in server.js).
   The list is a modest, standard English one. Two kinds of entry:
   - ANYWHERE: strong words that never sit inside an innocent word, matched inside other words too ('xXfuckXx');
   - WORD: words that do sit inside innocent words ('class', 'Scunthorpe', 'cocktail', 'spice', 'shiitake'), matched only on their own,
     with a plural / -ed / -er / -ing ending allowed.
   Common evasions are folded before matching: letter-number swaps (f4gg0t, sh1t, a$$), repeated letters (fuuuck), up to three
   separators between letters (f.u.c.k, f u c k), a star for a vowel (f*ck, sh*t), 'v' for 'u' (fvck), full-width and accented
   letters, and the common Cyrillic / Greek look-alike letters. Masking keeps the length of the original text, so a line never
   grows past its 200-character clip. */

const ANYWHERE = ['fuck', 'fck', 'fuk', 'shithead', 'bitch', 'whore', 'slut', 'asshole', 'bastard', 'dickhead', 'cocksucker', 'motherfucker',
  'nigger', 'faggot', 'wanker', 'wank', 'twat', 'dildo', 'jizz', 'bollocks', 'douchebag', 'bullshit'];
const WORD = ['shit', 'shitty', 'ass', 'arse', 'cunt', 'dick', 'cock', 'tit', 'tits', 'piss', 'prick', 'pussy', 'cum', 'porn', 'fag', 'nigga', 'kike', 'spic',
  'retard', 'douche', 'skank', 'boner'];

const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '9': 'g' };
const CONF = { 'а': 'a', 'в': 'b', 'е': 'e', 'ё': 'e', 'к': 'k', 'м': 'm', 'н': 'h', 'о': 'o', 'р': 'p', 'с': 'c', 'т': 't', 'у': 'y', 'х': 'x',
  'і': 'i', 'ї': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'һ': 'h', 'ӏ': 'l', 'α': 'a', 'β': 'b', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ο': 'o',
  'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x' };

// One shadow character per UTF-16 unit of the original, so a match's positions are the original's positions.
function shadow(s) {
  let out = '';
  const chars = Array.from(String(s));
  for (let i = 0; i < chars.length; i++) { const ch = chars[i];
    let c = ch.normalize('NFKC').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
    if ((c === '!' || c === '|') && !/^[\p{L}\p{N}]$/u.test(chars[i + 1] || '')) { out += c; continue; }   // 'sh!t' is a swap, 'shit!' is punctuation
    c = CONF[c] || LEET[c] || c;
    out += (c.length === ch.length && (ch.length === 1)) ? c : '#'.repeat(ch.length);
  }
  return out;
}

const SEP = '[^a-z0-9*]{0,3}';
const VOWEL = { a: 'a*', e: 'e*', i: 'i*y', o: 'o*', u: 'u*v' };
function letter(c) { return '[' + (VOWEL[c] || c) + ']+'; }
function body(w) { return w.split('').map(letter).join(SEP); }
const RX_ANY = new RegExp(ANYWHERE.map(body).join('|'), 'g');
const RX_WORD = new RegExp('(?<![a-z0-9*])(?:' + WORD.map(body).join('|') + ')(?:s|z|ed|er|ers|ing|in)?(?![a-z0-9*])', 'g');

function spans(text) {
  const sh = shadow(text), out = [];
  for (const rx of [RX_ANY, RX_WORD]) { rx.lastIndex = 0; let m;
    while ((m = rx.exec(sh))) { if (!m[0].length) { rx.lastIndex++; continue; } out.push([m.index, m.index + m[0].length]); } }
  return out;
}

// the text with every listed word replaced by asterisks (same length)
function mask(text) {
  const s = String(text == null ? '' : text), sp = spans(s);
  if (!sp.length) return s;
  const a = s.split('');
  for (const [i, j] of sp) for (let k = i; k < j; k++) if (/[^\s]/.test(a[k])) a[k] = '*';
  return a.join('');
}

// true when the text holds a listed word
function hits(text) { return spans(String(text == null ? '' : text)).length > 0; }

// names are often run together ('BigDick99'): split camelCase and letter/digit runs into words first
function nameHits(name) {
  const s = String(name == null ? '' : name);
  return hits(s) || hits(s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2').replace(/_/g, ' '));
}

module.exports = { mask, hits, nameHits, ANYWHERE, WORD };
