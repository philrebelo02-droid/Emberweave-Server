'use strict';
/* v1097 NAME FILTER (9 Oct 2026 full-game sweep #18; Phil 9 Oct: "this game is 18+ for mature, cursing is ok").
   Chat is NOT filtered: world, region, guild chat, whispers and the guild message go out as typed (players Block and Report).
   This list is only for names other players see everywhere: a player name or guild name holding a SLUR or HATE TERM is refused
   (badNewName in server.js). Plain swearing is allowed in names too.
   Two kinds of entry:
   - ANYWHERE: terms that never sit inside an innocent word, matched inside other words too ('xXslurXx');
   - WORD: terms that do sit inside innocent words ('raccoon', 'Nazir', 'spice', 'Pakistan'), matched only on their own,
     with a plural / -ed / -er / -ing ending allowed.
   Common evasions are folded before matching: letter-number swaps (f4gg0t), repeated letters, up to three separators between
   letters (k.k.k), a star for a vowel, full-width and accented letters, the common Cyrillic / Greek look-alike letters, and
   run-together names ('BigSlur99' is read as 'Big Slur 99'). */

const ANYWHERE = ['nigger', 'nigga', 'faggot', 'hitler', 'wetback', 'raghead', 'towelhead', 'whitepower', 'siegheil'];
const WORD = ['fag', 'kike', 'spic', 'chink', 'gook', 'coon', 'tranny', 'paki', 'beaner', 'dyke', 'retard', 'nazi', 'kkk', 'heil'];

const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '9': 'g' };
const CONF = { 'а': 'a', 'в': 'b', 'е': 'e', 'ё': 'e', 'к': 'k', 'м': 'm', 'н': 'h', 'о': 'o', 'р': 'p', 'с': 'c', 'т': 't', 'у': 'y', 'х': 'x',
  'і': 'i', 'ї': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'һ': 'h', 'ӏ': 'l', 'α': 'a', 'β': 'b', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ο': 'o',
  'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x' };

// one shadow character per UTF-16 unit of the original
function shadow(s) {
  let out = '';
  const chars = Array.from(String(s));
  for (let i = 0; i < chars.length; i++) { const ch = chars[i];
    let c = ch.normalize('NFKC').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
    if ((c === '!' || c === '|') && !/^[\p{L}\p{N}]$/u.test(chars[i + 1] || '')) { out += c; continue; }   // 'n!g' is a swap, 'name!' is punctuation
    c = CONF[c] || LEET[c] || c;
    out += (c.length === ch.length && (ch.length === 1)) ? c : '#'.repeat(ch.length);
  }
  return out;
}

const SEP = '[^a-z0-9*]{0,3}';
const VOWEL = { a: 'a*', e: 'e*', i: 'i*y', o: 'o*', u: 'u*v' };
function letter(c) { return '[' + (VOWEL[c] || c) + ']+'; }
function body(w) { return w.split('').map(letter).join(SEP); }
const RX_ANY = new RegExp(ANYWHERE.map(body).join('|'));
const RX_WORD = new RegExp('(?<![a-z0-9*])(?:' + WORD.map(body).join('|') + ')(?:s|z|ed|er|ers|ing|in)?(?![a-z0-9*])');

// true when the text holds a listed slur or hate term
function hits(text) { const sh = shadow(String(text == null ? '' : text)); return RX_ANY.test(sh) || RX_WORD.test(sh); }

// names are often run together ('BigSlur99'): split camelCase and letter/digit runs into words too
function nameHits(name) {
  const s = String(name == null ? '' : name);
  return hits(s) || hits(s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2').replace(/_/g, ' '));
}

module.exports = { hits, nameHits, ANYWHERE, WORD };
