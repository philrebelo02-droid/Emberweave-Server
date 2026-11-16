// Phil 3 Oct 2026: "Resources outside in region should be level 1-6 the level 6 near the end of the region 7-10 in wild".
// v1226: every field is dealt on Grok's realm: region nodes 1-6 (6 on the coast band), islet (wild) nodes 7-10. Levels 9-10
// have a hero-level gate (server needLevel = client mineReqLevel) and a real guardian level, not the level-1 fallback.
// Asserts, exits non-zero. Control: MLT_MODULE=<previous server/world-mines.js> MLT_HTML=<previous client> must FAIL.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'); let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; };
const load=(file)=>{ const src=fs.readFileSync(file,'utf8').replace(/require\('(\.{1,2}\/[^']+)'\)/g,(m,f)=>"require("+JSON.stringify(path.join(root,'server',f))+")")   /* v1226: every relative require (the v02 outlines, ../world-realm.js) */;
  const tmp=path.join(os.tmpdir(),'mlt-'+process.pid+'-'+Math.random().toString(36).slice(2)+'.js'); fs.writeFileSync(tmp,src); return require(tmp); };
try{
  const M=load(process.env.MLT_MODULE||path.join(root,'server','world-mines.js'));
  const ep=M.epochAt(Date.parse('2026-10-03T14:00:00Z')); const f=M.field(ep);
  ok(f.length>200,'a full field ('+f.length+' nodes)');
  const region=f.filter(n=>!n.region.startsWith('wild')), wild=f.filter(n=>n.region.startsWith('wild'));
  ok(region.every(n=>n.level>=1&&n.level<=6)&&new Set(region.map(n=>n.level)).size===6,'region nodes use levels 1-6, all present');
  // v1226: the wild is the islets (~17 nodes a field), so all four wild levels are checked over ten fields
  const wild10=[...Array(10).keys()].flatMap(k=>M.field(ep+k).filter(n=>n.region.startsWith('wild')));
  ok(wild.length>0&&wild10.every(n=>n.level>=7&&n.level<=10)&&new Set(wild10.map(n=>n.level)).size===4,'wild (islet) nodes use levels 7-10, all present');
  // v1226 realm map (Phil 30 Oct 2026): region edge = the coast (6 within 4 squares of the sea), wild = the islets (7 within 8 squares of a region)
  // v1227: those are 220-grid squares (M.COAST_BAND = 18 cells at 1000 columns), measured from any cell of the mine square
  const R=require(path.join(root,'world-realm.js')), B=M.COAST_BAND;
  ok(B===2,'the coast band is 2 cells of this grid (v1392: the 15-cell band made 136 of 240 mines level 6): '+B+' cells');
  // v1392 (Phil 16 Nov: "it should be per region" / "and wild has higher level ones"): 360 mines in every home region, 120 on the wild islets
  const per={}; f.forEach(n=>per[n.region]=(per[n.region]||0)+1);
  ok(['crystor','draymon','tefron','alumron'].every(z=>per[z]===M.REGION_QUOTA)&&M.REGION_QUOTA===360,'every home region has 360 mines: '+JSON.stringify(per));
  ok(f.filter(n=>n.region.startsWith('wild')).length===M.WILD_QUOTA&&M.WILD_QUOTA===120&&f.length===M.COUNT&&M.COUNT===1560,'the wild islets share 120 mines; 1560 in all');
  const r6=region.filter(n=>n.level===6).length/region.length, r13=region.filter(n=>n.level<=3).length/region.length;
  ok(r6<0.2&&r13>0.5,'level 6 is a minority of region mines and levels 1-3 are most of them ('+(r6*100).toFixed(1)+'% L6, '+(r13*100).toFixed(1)+'% L1-3)');
  const toSea=(x,y)=>{for(let d=0;d<=B;d++)for(let dx=-d;dx<=d;dx++){const dy=d-Math.abs(dx);for(const yy of [y-dy,y+dy])if(!R.isLand(x+dx,yy))return true;}return false;};
  const cellsOf=n=>R.GEO.mineCellsAt(n.gx,n.gy);   // v1227: a mine on an intersection: the 4 cells around it
  ok(f.every(n=>cellsOf(n).every(([x,y])=>R.isLand(x,y)&&R.landZone(x,y)===n.region)&&n.region!=='worldtree'),'every node stands on land of its own zone, never the World Tree island');
  ok(region.every(n=>cellsOf(n).some(([x,y])=>toSea(x,y))===(n.level===6)),'region nodes are level 6 exactly on the coast band (v1392: 2 cells)');
  const srv=fs.readFileSync(path.join(root,'server.js'),'utf8'), html=fs.readFileSync(process.env.MLT_HTML||path.join(root,'emberweave-heroes.html'),'utf8');
  const sTab=JSON.parse(srv.match(/const needLevel=(\[[0-9,]+\])\[node\.level-1\]/)[1]);
  const ctx=vm.createContext({}); const i=html.indexOf('function mineReqLevel('); vm.runInContext(html.slice(i,html.indexOf('\n',i)),ctx);
  for(let L=1;L<=10;L++) ok(vm.runInContext('mineReqLevel('+L+')',ctx)===sTab[L-1],'level '+L+' hero gate: client = server ('+sTab[L-1]+')');
  ok(sTab.length===10&&sTab[8]>sTab[7]&&sTab[9]>sTab[8],'levels 9 and 10 have rising gates, not the level-1 fallback');
  console.log('test_mine_levels_ten.js: '+pass+' checks passed (epoch '+ep+')');
}catch(e){ console.error('FAIL',e.message); process.exitCode=1; }
