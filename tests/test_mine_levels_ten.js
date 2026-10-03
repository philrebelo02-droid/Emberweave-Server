// Phil 3 Oct 2026: "Resources outside in region should be level 1-6 the level 6 near the end of the region 7-10 in wild".
// For the current fields (from the terrain cutover on): region nodes are levels 1-6 with every edge node at 6, wild nodes 7-10 with
// every region-bordering node at 7; every node keeps the exact place, id and resource it had before (same random draws). Levels 9-10
// have a hero-level gate (server needLevel = client mineReqLevel) and a real guardian level, not the level-1 fallback.
// Asserts, exits non-zero. Control: MLT_MODULE=<previous server/world-mines.js> MLT_HTML=<previous client> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'); let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; };
const load=(file)=>{ const src=fs.readFileSync(file,'utf8').replace("require('./world-terrain-blocked.json')","require("+JSON.stringify(path.join(root,'server','world-terrain-blocked.json'))+")");
  const tmp=path.join(os.tmpdir(),'mlt-'+process.pid+'-'+Math.random().toString(36).slice(2)+'.js'); fs.writeFileSync(tmp,src); return require(tmp); };
try{
  const M=load(process.env.MLT_MODULE||path.join(root,'server','world-mines.js'));
  const ep=M.epochAt(Date.parse('2026-10-03T14:00:00Z')); const f=M.field(ep);
  ok(f.length>200,'a full field ('+f.length+' nodes)');
  const region=f.filter(n=>!n.region.startsWith('wild')), wild=f.filter(n=>n.region.startsWith('wild'));
  ok(region.every(n=>n.level>=1&&n.level<=6)&&new Set(region.map(n=>n.level)).size===6,'region nodes use levels 1-6, all present');
  ok(wild.every(n=>n.level>=7&&n.level<=10)&&new Set(wild.map(n=>n.level)).size===4,'wild nodes use levels 7-10, all present');
  // previous scheme mapped edge->4 / 5 and interior 1-3 / 6-8: the same nodes must sit where they sat, with the same ids and resources
  const legacy=require(path.join(root,'tests','helpers','mine-field-legacy-levels.json'));
  ok(legacy.epoch===ep&&legacy.nodes.length===f.length,'same node count as the previous field for this epoch');
  ok(f.every((n,i)=>n.id===legacy.nodes[i].id&&n.gx===legacy.nodes[i].gx&&n.gy===legacy.nodes[i].gy&&n.res===legacy.nodes[i].res),'every node keeps its place, id and resource');
  ok(f.every((n,i)=>(legacy.nodes[i].level===4)===(n.level===6)&&(legacy.nodes[i].level===5)===(n.level===7)),'region-edge nodes are level 6 and wild-edge nodes level 7 exactly where the old edges were');
  const old=M.field(30000); ok(old.every(n=>n.level>=1&&n.level<=8),'fields before the terrain cutover keep their legacy levels');
  const srv=fs.readFileSync(path.join(root,'server.js'),'utf8'), html=fs.readFileSync(process.env.MLT_HTML||path.join(root,'emberweave-heroes.html'),'utf8');
  const sTab=JSON.parse(srv.match(/const needLevel=(\[[0-9,]+\])\[node\.level-1\]/)[1]);
  const ctx=vm.createContext({}); const i=html.indexOf('function mineReqLevel('); vm.runInContext(html.slice(i,html.indexOf('\n',i)),ctx);
  for(let L=1;L<=10;L++) ok(vm.runInContext('mineReqLevel('+L+')',ctx)===sTab[L-1],'level '+L+' hero gate: client = server ('+sTab[L-1]+')');
  ok(sTab.length===10&&sTab[8]>sTab[7]&&sTab[9]>sTab[8],'levels 9 and 10 have rising gates, not the level-1 fallback');
  console.log('test_mine_levels_ten.js: '+pass+' checks passed (epoch '+ep+')');
}catch(e){ console.error('FAIL',e.message); process.exitCode=1; }
