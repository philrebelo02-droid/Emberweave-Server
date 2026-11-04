#!/usr/bin/env node
/* Emits every hero's glyph board path and every glyph's full build lineage, as JSON.
 *
 * 12 Sep 2026 (Phil: "update html with all glyphs, including all glyph paths").
 *
 * NEVER REIMPLEMENT THE ENGINE — RUN IT. This does not copy the pre-choice rules into a second
 * language where they can drift. It lifts the ACTUAL declarations out of server.js (the constants,
 * glyphAllowed, glyphSupplyOK, g2ExpandIngredients, glyphPreChoice) and evaluates them against the
 * real glyph-source.json, then asserts the compiled catalogue matches the numbers server.js itself
 * prints at boot. If any declaration cannot be found it exits non-zero rather than guessing.
 *
 *   node glyph_paths.js            # from "Base files"
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const SRC = fs.readFileSync(process.env.GLYPH_SERVER_SOURCE || 'server.js', 'utf8');

/* Pull one top-level declaration out by name, balanced across braces/brackets/parens and aware of
 * strings, template literals, regex-ish slashes and both comment kinds. */
function decl(name, kind) {
  const re = new RegExp('^' + kind + '\\s+' + name + '\\b', 'm');
  const m = re.exec(SRC);
  if (!m) throw new Error('declaration not found: ' + kind + ' ' + name);
  let i = m.index, depth = 0, started = false;
  let inS = null, inLine = false, inBlock = false;
  for (; i < SRC.length; i++) {
    const c = SRC[i], p = SRC[i - 1];
    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '/' && p === '*') inBlock = false; continue; }
    if (inS) { if (c === inS && p !== '\\') inS = null; continue; }
    if (c === '/' && SRC[i + 1] === '/') { inLine = true; continue; }
    if (c === '/' && SRC[i + 1] === '*') { inBlock = true; continue; }
    if (c === '"' || c === "'" || c === '`') { inS = c; continue; }
    // a function's body is delimited by BRACES ONLY - counting its parameter list would close the
    // declaration at the ')' after the arguments (caught 12 Sep 2026, it truncated glyphAllowed).
    const opens = kind === 'function' ? '{' : '{[(';
    const closes = kind === 'function' ? '}' : '}])';
    if (opens.indexOf(c) >= 0) { depth++; started = true; continue; }
    if (closes.indexOf(c) >= 0) {
      depth--;
      if (started && depth === 0) {
        // a const ends at its semicolon/newline; a function ends at the closing brace
        let j = i + 1;
        while (j < SRC.length && /[\s;]/.test(SRC[j])) { if (SRC[j] === ';') { j++; break; } j++; }
        return SRC.slice(m.index, j);
      }
      continue;
    }
    if (started && depth === 0 && c === ';') return SRC.slice(m.index, i + 1);
  }
  throw new Error('could not close declaration: ' + name);
}

const WANT_CONST = ['GLYPH_LADDER','GLYPH_MIN_LEVEL','GLYPH_SLOTS','GLYPH_SLOT_FAMILIES','GLYPH_FAMS','GLYPH_ROLE_OVERRIDES'];
// glyphSupplyOK() calls glyphTierFams(). Lift that dependency too; without it every supply check
// throws inside glyphSupplyOK's catch and returns false, so the export silently falls through to
// non-canonical slot choices (most visibly replacing a Tank's bulwark path with Stoneheart).
const WANT_FN = ['glyphTierFams','glyphAllowed','glyphSupplyOK','g2ExpandIngredients','g2CurrentIngredients','g2BuildCost','glyphHeroTraits','glyphPathFamily','glyphPlanForTraits','glyphPersonalPlan','glyphPreChoice'];

const ctx = { console, GLYPHS: null, GLYPH_TIER_FAMS: {}, HERO_PROFILES:require(path.resolve('hero-profiles.js')), HERO_PATHS:require(path.resolve('hero-paths.js')),
  HERO_PERSONAL_GLYPH_PATHS:require(path.resolve('server','hero-personal-glyph-paths.json')) };
vm.createContext(ctx);
/* All of it in ONE script, then published onto the context explicitly. `const` inside
 * vm.runInContext binds in the SCRIPT scope, not on the global object, so running the declarations
 * separately left every constant undefined (caught 12 Sep 2026). */
{
  const src = [...WANT_CONST.map(n => decl(n, 'const')),
               ...WANT_FN.map(n => decl(n, 'function')),
               '(' + JSON.stringify([...WANT_CONST, ...WANT_FN]) + ').forEach(function(n){ this[n] = eval(n); }, this);'
              ].join('\n');
  vm.runInContext(src, ctx);
}
for (const n of [...WANT_CONST, ...WANT_FN]) if (ctx[n] === undefined) throw new Error('not published: ' + n);

/* Compile the catalogue exactly as glyphCompile() does — that block is inside a function, so its
 * body is lifted rather than the declaration. Guarded by the boot numbers afterwards. */
const raw = JSON.parse(fs.readFileSync(path.join('server', 'glyph-source.json'), 'utf8'));
const byId = {}, byName = {};
for (const d of raw) { byId[d.id] = d; byName[d.name] = d; }
const FRAG = /^(\d+)\s*[×x]\s*(.+?)\s+Fragments$/;
for (const d of raw) {
  if (!d.family) {
    const m = /(\w+)\s+(Glyph|Core|Crown)$/.exec(d.name);
    if (!m) throw new Error('no family and unparsable name: ' + d.name);
    d.family = m[1];
  }
  d.qi = ctx.GLYPH_LADDER.indexOf(d.quality);
  if (d.qi < 0) throw new Error('unknown quality ' + d.quality);
  d.ing = [];
  for (const part of d.recipeText.split(' + ').map(s => s.trim())) {
    const fm = FRAG.exec(part);
    if (fm) { d.ing.push({ kind: 'frag', key: fm[2], qty: +fm[1] }); continue; }
    if (/Sub-Glyph$/.test(part)) { d.ing.push({ kind: 'sub', key: part, qty: 1 }); continue; }
    const ref = byName[part];
    if (!ref) throw new Error('unknown recipe token "' + part + '" in ' + d.id);
    d.ing.push({ kind: 'finished', defId: ref.id, qty: 1 });
  }
}
const gold4 = {};
for (const d of raw) if (d.quality === 'Gold +4') gold4[d.family] = 1;
const subs = {};
for (const d of raw) for (const g of d.ing) {
  if (g.kind !== 'sub' || subs[g.key]) continue;
  const mm = /^(?:(Rare|Superior|Mythic)\s+)?(.+?)\s+(\w+)\s+Sub-Glyph$/.exec(g.key);
  if (!mm) throw new Error('sub-glyph name unparsable: ' + g.key);
  const prefix = mm[1] || '', qual = mm[2], fam = mm[3];
  const fragQual = qual === 'Worldfire' ? 'Orange' : qual;
  const n = { '': 3, Superior: 4, Rare: 5, Mythic: 6 }[prefix];
  const ing = [{ kind: 'frag', key: fragQual + ' ' + fam, qty: n }];
  if (qual === 'Worldfire') {
    if (gold4[fam]) ing.push({ kind: 'frag', key: 'Gold +4 ' + fam, qty: 2 });
    else ing[0].qty += 2;
  }
  subs[g.key] = { key: g.key, ing };
}
for (const d of raw) {
  const l = (ctx.GLYPH_TIER_FAMS[d.quality] = ctx.GLYPH_TIER_FAMS[d.quality] || []);
  const family=d.fragmentFamily||d.family; if (!l.includes(family)) l.push(family);
}
for (const q in ctx.GLYPH_TIER_FAMS) {
  const l = ctx.GLYPH_TIER_FAMS[q];
  ctx.GLYPH_TIER_FAMS[q] = [...ctx.GLYPH_FAMS.filter(f => l.includes(f)),
                            ...l.filter(f => !ctx.GLYPH_FAMS.includes(f)).sort()];
}
const fragName = {};
for (const d of raw) fragName[d.quality + ' ' + d.family] = d.name.replace(/ (Glyph|Core|Crown)$/, '') + ' Fragment';
ctx.GLYPHS = { raw, byId, byName, subs, fragName, version: 1 };

// the guard: these are the two numbers server.js prints at boot
if (raw.length !== 314) throw new Error('expected 314 definitions, got ' + raw.length);
if (Object.keys(subs).length !== 169) throw new Error('expected 169 sub-glyph recipes, got ' + Object.keys(subs).length);

/* Hero roles: the SIM table glyphPreChoice actually reads. REQUIRE the module - do not read
 * hero_base.json, which is a 40-hero snapshot; server/sim.js carries all 60 (the 20 roster heroes
 * added 4 Sep live only in the module). Getting this wrong silently drops a third of the roster. */
const SIM = require(path.resolve('server', 'sim.js'));
if (Object.keys(SIM.HERO_BASE).length !== 61)
  throw new Error('expected 61 heroes in SIM.HERO_BASE, got ' + Object.keys(SIM.HERO_BASE).length);

/* ---- every glyph's full lineage, memoised ---- */
const totalMemo = {};
function lineage(def) {
  if (totalMemo[def.id]) return totalMemo[def.id];
  const frags = {};
  let depth = 1, nodes = 1;
  for (const g of def.ing) {
    if (g.kind === 'frag') { frags[g.key] = (frags[g.key] || 0) + g.qty; nodes++; continue; }
    if (g.kind === 'sub') {
      const s = subs[g.key]; nodes++;
      for (const f of s.ing) { frags[f.key] = (frags[f.key] || 0) + f.qty * g.qty; nodes++; }
      continue;
    }
    const sub = lineage(byId[g.defId]);
    depth = Math.max(depth, sub.depth + 1); nodes += sub.nodes;
    for (const k in sub.frags) frags[k] = (frags[k] || 0) + sub.frags[k] * g.qty;
  }
  const total = Object.values(frags).reduce((a, b) => a + b, 0);
  return (totalMemo[def.id] = { frags, total, kinds: Object.keys(frags).length, depth, nodes });
}

function payable(def) {
  const ex = ctx.g2CurrentIngredients(def), frags = { ...ex.frags };
  for (const key in ex.subs) {
    const s = subs[key];
    for (const f of (s ? s.ing : [])) frags[f.key] = (frags[f.key] || 0) + f.qty * ex.subs[key];
  }
  return frags;
}

/* CROSS-CHECK. payable() mirrors the current direct recipe; g2BuildCost is the game's charge. */
for (const d of raw) {
  const mine = payable(d);
  const theirs = ctx.g2BuildCost({ subGlyphs: {} }, d).need;
  const keys = new Set([...Object.keys(mine), ...Object.keys(theirs)]);
  for (const k of keys) {
    if ((mine[k] || 0) !== (theirs[k] || 0))
      throw new Error('lineage mismatch on ' + d.id + ' ' + d.name + ' / ' + k +
                      ': mine ' + (mine[k] || 0) + ' vs engine ' + (theirs[k] || 0));
  }
}

const glyphs = raw.map(d => {
  const ancestry = lineage(d), frags = payable(d);
  const total = Object.values(frags).reduce((a, b) => a + b, 0);
  return { id: d.id, name: d.name, family: d.family, quality: d.quality, qi: d.qi,
           strength: d.strength, statFocus: d.statFocus, passiveStats: d.passiveStats,
           recipeText: d.recipeText, subGlyph: d.subGlyph,
           total, kinds: Object.keys(frags).length, depth: ancestry.depth,
           frags: Object.entries(frags).sort((a, b) => b[1] - a[1])
                    .map(([k, n]) => ({ key: k, name: fragName[k] || (k + ' Fragment'), n })) };
});

/* ---- every hero's board path: 6 slots x 16 tiers, straight from glyphPreChoice ---- */
const heroes = {};
for (const key in SIM.HERO_BASE) {
  const rows = [];
  for (let qi = 0; qi < ctx.GLYPH_LADDER.length; qi++) {
    const tier = { quality: ctx.GLYPH_LADDER[qi], minLevel: ctx.GLYPH_MIN_LEVEL[qi], slots: [] };
    for (let si = 0; si < ctx.GLYPH_SLOTS.length; si++) {
      let d = null;
      try { d = ctx.glyphPreChoice(key, si, qi); } catch (e) { d = null; }
      tier.slots.push(d ? { slot: ctx.GLYPH_SLOTS[si], id: d.id, name: d.name, family: d.family,
                            stats: d.passiveStats } : null);
    }
    rows.push(tier);
  }
  const b = SIM.HERO_BASE[key] || {};
  heroes[key] = { role: b.role || 'Bruiser', healer: !!b.healer,
                  traits: ctx.glyphHeroTraits(key), path: rows };
}

/* The approved launch system contains exactly 14 canonical paths. Early qualities may share
 * individual glyphs; identity is the stable path ID, not a forced artificial collision rule. */
const archetypes={};
for(const pathId of Object.keys(ctx.HERO_PATHS)){
  const heroKey=Object.keys(ctx.HERO_PROFILES).find(k=>ctx.HERO_PROFILES[k].glyphPath===pathId);
  if(!heroKey) throw new Error('unused canonical path '+pathId);
  const traits=ctx.glyphHeroTraits(heroKey), path=[];
  for(let qi=0;qi<ctx.GLYPH_LADDER.length;qi++){
    const picks=ctx.glyphPlanForTraits(traits,qi);
    if(picks.length!==6||picks.some(x=>!x)) throw new Error('incomplete path '+pathId+' '+ctx.GLYPH_LADDER[qi]);
    path.push({quality:ctx.GLYPH_LADDER[qi],signature:picks.map(d=>d.family).join('|'),
               slots:picks.map(d=>({id:d.id,name:d.name,family:d.family}))});
  }
  archetypes[pathId]={label:ctx.HERO_PATHS[pathId].label,traits,path};
}
if(Object.keys(archetypes).length!==15) throw new Error('expected 15 canonical paths');

process.stdout.write(JSON.stringify({
  ladder: ctx.GLYPH_LADDER, minLevel: ctx.GLYPH_MIN_LEVEL, slots: ctx.GLYPH_SLOTS,
  fragName, glyphs, heroes, archetypes
}));
