'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),fixture=require('./fixtures/hero61-approved-fx.json');
const host=require('../server/sim-host').load(path.join(root,'emberweave-heroes.html'));
const run=s=>vm.runInContext(s,host.ctx),get=s=>JSON.parse(run('JSON.stringify('+s+')'));
// sim-host deliberately discards THREE writes. Keep its real release/lifecycle/
// placement functions, replacing only the GPU sprite and camera transform.
run(`_fx22Spr=function(key,ro){return {renderOrder:ro,material:{opacity:1,dispose(){}},center:{set(){}},scale:{set(){}},position:{x:0,copy(p){this.x=p.x;this.y=p.y;this.z=p.z;return this;}}};};
 _fx22On=function(u,up){return {x:u.rx==null?u.x:u.rx,y:up,z:u.ry==null?u.y:u.ry};};`);
for(const [key,d]of Object.entries(fixture.entries)){
 assert.deepEqual(get('FX2_DEF.'+key),d);
 const file=path.join(root,d.u.split('?')[0]);const bytes=fs.readFileSync(file);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),fixture.provenance[key].sheet_sha256);
 assert.ok(bytes.length<4e6&&d.fw*d.cols<=2048&&d.fh*d.rows<=2048);
 assert.ok(get("fxSheetKeys(['hero61'])").includes(key));
 assert.ok(get('allAssetUrls()').includes(d.u));
}
function reset(){run(`units=[];battleTime=0;autoUlt=false;CUR={mode:'replay'};clearFx1123();
 globalThis.king=makeUnit('hero61','ally',300,300,1,{rank:3});
 globalThis.friend=makeUnit('vael','ally',420,300,1,{rank:3});
 units=[king,friend];friend.hp=friend.maxHp*.2;king.energy=100;`);}
for(const [slot,ct]of [['green',1.5],['blue',2.5],['ult',1.2]]){
 reset();run(`hero61Cast(king,'${slot}',friend);castTick(king,${ct-.01})`);
 assert.equal(run('_fx1123.length'),0,'no effect on press or before release');
 run('castTick(king,.011)');
 assert.equal(run('_fx1123.length'),1);
 assert.equal(run('_fx1123[0].T===friend'),true,'exact heal/protection recipient, not caster');
 assert.equal(run('_fx1123[0].vk'),'h61'+slot);
 run('updateFx1123(.02)');assert.equal(run('!!_fx1123[0].s'),true);
 assert.equal(run('_fx1123[0].s.renderOrder'),-1,'effect is behind the visible ally');
 const before=run('_fx1123[0].s.position.x');run('friend.rx=friend.x+80;updateFx1123(.01)');
 assert.notEqual(run('_fx1123[0].s.position.x'),before,'effect follows its ally');
 run('friend.alive=false;updateFx1123(.01);updateFx1123(.3)');assert.equal(run('_fx1123.length'),0,'dead recipient releases effect');
}
reset();run("hero61Cast(king,'blue');king.stunned=1;castTick(king,3)");assert.equal(run('_fx1123.length'),0,'interrupted heal has no visual');
reset();run("hero61Effect(king,friend,'ult');hero61Effect(king,friend,'green');hero61Effect(king,friend,'blue')");
assert.equal(run('_fx1123.length'),2,'repeated heals replace their aura, preserve protection');
assert.ok(run("hero61FxFrame(FX2_DEF.hero61_bubble,3.39)<=24"),'intact bubble before its final dissolve');
assert.equal(run("hero61FxFrame(FX2_DEF.hero61_bubble,3.7)>24"),true,'preferred dissolve finishes with protection');
assert.equal(run("hero61FxFrame(FX2_DEF.hero61_bubble,4)"),-1);
assert.equal(run("hero61FxFrame(FX2_DEF.hero61_heal,2.5)"),-1);
assert.ok(Math.abs(run("hero61FxStyle('green').size/hero61FxStyle('blue').size")-.6)<1e-9);
assert.equal(run("hero61FxStyle('green').hero61Opacity"),.6);
assert.equal(run("hero61FxStyle('green').hero61Life"),1.5);
assert.equal(run("hero61FxFrame(hero61FxStyle('green'),1.5)"),-1,'short Green plays its full fade');
for(const [slot,key]of [[1,'hero61_heal'],[0,'hero61_bubble']]){
 const p=get(`skillPreviewPlan('hero61',${slot})`);assert.equal(p.fx[0].k,key);assert.equal(p.fx[0].at,'target');assert.equal(p.fx[0].t0,p.rel);
}
// Same frozen snapshots and seeds, with the visual release hook enabled/disabled.
const specs=[{key:'hero61',level:30,rank:3,skillLv:[20,20,20,20]},{key:'vael',level:30,rank:3}],foes=[{key:'hollow',level:30,rank:3},{key:'grosk',level:30,rank:3}];
const snaps=host.snapFromSpecs(specs),visual=host.auto(snaps,foes,61003);
const off=require('../server/sim-host').load(path.join(root,'emberweave-heroes.html'));
vm.runInContext('hero61Effect=function(){}',off.ctx);
assert.deepEqual(off.auto(off.snapFromSpecs(specs),foes,61003),visual,'FX cannot alter combat or replay');
console.log('Hero61 FX PASS: approved hashes, phone atlas limits, alpha assets/preload/offline, exact release/recipient, motion, interruption/death cleanup, four-second guard + preferred dissolve, previews, unchanged replay.');
