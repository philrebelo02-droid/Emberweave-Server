const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(process.argv[2], 'emberweave-heroes.html'), 'utf8');
const start = html.indexOf('async function g2buildDo(bpId)');
const code = html.slice(start, html.indexOf('/* ---- Glyph v2 ART', start));
const posted = [];
const ctx = vm.createContext({
  RUNE2:{st:{revision:12},build:{slot:2,data:{revision:13}}},
  detailHero:'vael', uid8:() => 'test-id',
  api:async (route,method,payload) => {
    posted.push(payload.expectedRevision);
    return payload.expectedRevision === 13 ? {ok:true,name:'Stone Glyph'} : {error:'STALE'};
  },
  glyphV2Sync:async () => {}, g2buildOpen() {}, g2RenderOverlays() {}, bannerMsg() {},
  renderHeroDetail() {}, ewT:key => key
});
vm.runInContext(code,ctx);
(async () => {
  await ctx.g2buildDo('stone');
  assert.deepEqual(posted,[13],'first craft uses revision from the rendered tree');
  assert.equal(ctx.RUNE2.build,null,'successful first craft closes the build view');
})().catch(error => {console.error(error); process.exitCode=1;});
