const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(process.argv[2], 'emberweave-heroes.html'), 'utf8');
const start = html.indexOf('function highlightTutorialTarget(){');
const code = html.slice(start, html.indexOf("document.addEventListener('click'", start));
const glows = new Set();
const make = name => ({
  textContent: name,
  classList: { add: () => glows.add(name), remove: () => glows.delete(name) },
  getClientRects: () => [{}]
});
const roster = make('Vael roster');
const skill = make('Skill tab');
const glyph = make('Glyph tab');
const build = make('Construir rápido');
const selectors = {
  '#heroesPanel .hero-card[data-hero-key="vael"]': [roster],
  '#heroDetail [data-tab="skills"]': [skill],
  '#heroDetail [data-tab="glyphs"]': [glyph],
  '#heroDetail button': [build],
  '#heroDetail [data-tut-glyph-build]': [build]
};
const ctx = vm.createContext({
  G: {tutStarted:true, tutFocusStep:'skill', unlocked:{vael:true}},
  state:'heroesPanel', detailHero:'other', TUTORIAL_GROUPS:[],
  document:{querySelectorAll: selector => selector === '.tut-target-glow'
    ? [roster,skill,glyph,build] : selectors[selector] || []}
});
vm.runInContext(code, ctx);
ctx.highlightTutorialTarget();
assert.deepEqual([...glows], ['Vael roster']);
ctx.detailHero='vael';
ctx.highlightTutorialTarget();
assert.deepEqual([...glows], ['Skill tab']);
ctx.G.tutFocusStep='rune';
ctx.highlightTutorialTarget();
assert.deepEqual([...glows], ['Construir rápido']);
ctx.detailHero='other';
ctx.highlightTutorialTarget();
assert.deepEqual([...glows], ['Vael roster']);
ctx.G.unlocked.vael=false;
ctx.highlightTutorialTarget();
assert.deepEqual([...glows], []);
