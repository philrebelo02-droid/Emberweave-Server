'use strict';
const assert=require('node:assert/strict');
const ui=require('../assets/echo-spire-ui.js');
const heroes=['Grosk','Fritz','Meridian','Hobb','KonWu'].map(name=>({key:name.toLowerCase(),name}));
const base={floor:6,bestFloor:12,nextFloor:7,restedCount:2,hasHistory:true,selectedHeroes:heroes,encounter:{floor:7,kind:'echo',name:'Your Floor 7 lineup',recordedFloor:7,recordedAt:'2026-10-18T12:00:00Z',heroes,power:4200,rewardText:'Gold 4,799'},floors:[{floor:6,cleared:true},{floor:7,kind:'echo'}],tribute:{ready:true,description:'Daily tribute ready'}};
const html=ui.render(base);
assert.match(html,/ECHO WARDEN/);assert.match(html,/Your F7 run/);assert.match(html,/2026/);assert.match(html,/Fight · Floor 7/);assert.doesNotMatch(html,/data-es="ascend" disabled/);
assert.match(ui.render({...base,selectedHeroes:[]}),/data-es="ascend" disabled/);
assert.match(ui.render({...base,busy:true}),/data-es="ascend" disabled/);
assert.match(ui.render({...base,error:'Offline'}),/data-es="ascend" disabled/);
assert.match(ui.render({...base,encounter:{...base.encounter,name:'<img src=x onerror=alert(1)>'}}),/&lt;img/);
assert.doesNotMatch(ui.render({...base,encounter:{...base.encounter,name:'<img src=x onerror=alert(1)>'}}),/<img src=x/);
assert.match(ui.render({...base,hasHistory:false,encounter:{floor:1,kind:'guardian',heroes:[]}}),/GUARDIAN/);
assert.match(ui.render({...base,tribute:{claimed:true}}),/Claimed today/);
assert.match(ui.render({...base,encounter:{...base.encounter,recordedAt:'bad'}}),/Date unavailable/);
console.log('Echo Spire view: state gates, provenance, escaping and new-player checks passed.');

assert.doesNotMatch(html,/YOUR PAST IS WAITING|Climb beyond/);
assert.match(ui.render({...base,encounter:{...base.encounter,rewardLabel:'Echo bonus',rewardText:'Gold 480'}}),/Echo bonus/);
