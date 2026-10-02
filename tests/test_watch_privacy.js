'use strict';
// CR2005 (ChatGPT, 1 Oct 2026) - /api/watch shows reported activity only for the caller and CURRENT guild members:
// a cached report guildId must not leak a departed, removed or foreign member. v923 put this in the suite; it runs the
// real route block from server.js against a fixture.
const vm=require('node:vm'),assert=require('node:assert/strict');
const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8').split(String.fromCharCode(13)).join('');
const route=source.indexOf("p==='/api/watch'")>=0?source.indexOf("p==='/api/watch'"):source.indexOf("'/api/watch'");
assert.notEqual(route,-1,'/api/watch route exists');
const a=source.indexOf('const mates',route-20000>0?route-20000:0);
const startAt=source.lastIndexOf('\n',source.indexOf('const guild=me.guildId',route)>0?source.indexOf('const guild=me.guildId',route):a);
const end=source.indexOf('}));',source.indexOf('const mates',startAt))+4;
const block=source.slice(startAt,end);
assert.ok(block.includes('const mates'),'mates block found');
const DB={guilds:{g1:{members:['own','mate']},g2:{members:['left']}},users:{
  own:{id:'own',name:'Own',guildId:'g1'},mate:{id:'mate',name:'Mate',guildId:'g1'},
  left:{id:'left',name:'Left',guildId:'g2'},removed:{id:'removed',name:'Removed',guildId:'g1'},foreign:{id:'foreign',name:'Foreign',guildId:'g9'}}};
// every report still carries the OLD cached guildId g1
const fresh=['own','mate','left','removed','foreign','ghost'].map(id=>({id,name:id,guildId:'g1',attacks:[],defends:[],scouts:[],t:1}));
const box={DB,me:DB.users.own,fresh};vm.createContext(box);
const helperStart=source.indexOf('function watchEntries(rows){'),helperEnd=source.indexOf("if(p==='/api/watch/report'",helperStart);
assert(helperStart>=0&&helperEnd>helperStart,'watch report helper source found');
vm.runInContext(source.slice(helperStart,helperEnd),box);
vm.runInContext(block+'\n;globalThis.__ids=mates.map(m=>m.id);',box);
assert.deepEqual(box.__ids,['own','mate'],'only the caller and current roster members whose account still points at this guild');
console.log('PASS /api/watch reported activity uses current guild membership (no departed, removed, foreign or unknown members)');
// CR2136 (v931): stored or posted watch entries are validated - a malformed scout no longer breaks the GET
{ const W=box.watchEntries;
  assert.deepEqual(JSON.parse(JSON.stringify(W([{name:'Castle',eta:5,ret:false},{name:null,eta:1},{name:7},null,{name:'X',eta:-1},{name:'Y',eta:'5'}]))),[{name:'Castle',eta:5,ret:false}]);
  assert.deepEqual(JSON.parse(JSON.stringify(W('nope'))),[]);
  console.log('PASS watch entries: malformed scouts are dropped, valid client entries kept'); }
