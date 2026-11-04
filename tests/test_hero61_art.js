'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const ROOT=path.resolve(__dirname,'..'),F=require('./fixtures/hero61-approved-art.json');
const host=require('../server/sim-host').load(path.join(ROOT,'emberweave-heroes.html'));
const run=s=>vm.runInContext(s,host.ctx), get=s=>JSON.parse(run('JSON.stringify('+s+')'));
const actual=get('BATTLE_ANIM.hero61');
for(const [slot,e] of Object.entries(F.entries)){
 const a=actual[slot];assert.ok(a,slot);for(const [k,v]of Object.entries(e))assert.deepEqual(a[k],v,slot+'.'+k);
 const relative=a.u.split('?')[0].slice(1),bytes=fs.readFileSync(path.join(ROOT,relative));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),F.files[relative]);
 assert.ok(bytes.length<=4e6);assert.ok(a.fw*a.cols<=2048&&a.fh*a.rows<=2048);
}
assert.equal(actual.blue,undefined,'unapproved Blue must not be wired');
assert.equal(actual.death.parts.length,14);assert.equal(actual.death.dn,53);assert.equal(actual.death.end,'hold');
for(const k of actual.death.parts){assert.ok(actual[k].lazy);assert.ok(actual[k].n<=4);}
assert.ok(run('deathPeakMB(deathParts(BATTLE_ANIM.hero61,BATTLE_ANIM.hero61.death))')<10,'streaming deaths hold only two small sheets');
const urls=get('allAssetUrls()');for(const e of Object.values(actual))assert.ok(urls.includes(e.u),'offline Update All includes '+e.u);
const bust=require('./fixtures/hero61-temple-provenance.json');
assert.deepEqual(bust.size,[444,912]);assert.equal(bust.fringe.edge_gt24,0);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,bust.output))).digest('hex'),bust.output_sha256);
assert.ok(urls.includes('/assets/img/temple/v2/heroes/hero61-v2.webp'),'Temple portrait is available offline');
for(const d of require('../server/gear-catalog.json').items.filter(d=>d.id.startsWith('H61E'))){
 const html=run('gearImg('+JSON.stringify(d)+',40)');assert.ok(html.includes('/'+d.artId+'.webp'));
 assert.ok(fs.existsSync(path.join(ROOT,'assets/img/gear/items',d.artId+'.webp')),'existing gear illustration exists');
}
for(const c of Object.values(F.cut)){assert.equal(c.problems.length,0);assert.ok(c.min_margin>=2);assert.ok(c.figH>=140&&c.figH<=240);assert.equal(c.fringe_master.edge_gt24,0);assert.ok(c.fringe_q95.edge_gt24<=.005);}
// Art controls: deleting or replacing the art leaves the authoritative fight exactly the same.
const specs=[{key:'hero61',level:30,rank:3,skillLv:[20,20,20,20]},{key:'vael',level:30,rank:3}];
const foes=[{key:'hollow',level:30,rank:3},{key:'grosk',level:30,rank:3}];
const snaps=host.snapFromSpecs(specs),withArt=host.auto(snaps,foes,61003);
// A fresh host runs the identical authoring initializers; only its pixel URLs differ.
const missing=require('../server/sim-host').load(path.join(ROOT,'emberweave-heroes.html'));
vm.runInContext('Object.entries(BATTLE_ANIM.hero61).forEach(([slot,a])=>{a.u="/assets/anim/hero61/missing-render-only-"+slot+".webp";delete a.tex;});',missing.ctx);
const noTextures=missing.auto(missing.snapFromSpecs(specs),foes,61003);
assert.deepEqual(noTextures,withArt,'pixels and texture availability cannot change combat');
console.log('Hero61 art PASS: 7 approved sources, phone bounds/alpha/fringe, streaming ash death, offline assets, no-Blue gate, texture-independent combat');
