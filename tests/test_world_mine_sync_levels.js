// v1131: signed-in players saw NO mines on the world map. assets/ui/world-mine-sync.js validated every node with level<=8 (the legacy
// pre-cutover range) while server/world-mines.js deals levels 1-10 since the terrain cutover (Phil 3 Oct: region 1-6, wild 7-10). One
// level-9 or level-10 node threw 'Invalid node', the whole receipt was dropped and the map drew nothing.
// This test feeds the client validator the payload exactly as GET /api/world/mines builds it, plus a synthetic field holding every
// level 1-10, and asserts every node comes back. It also ties the client's range to the server's: every level the generator can deal
// (legacy and current epochs) must be accepted, and 0 / 11 must still be refused.
// Asserts, exits non-zero. Control: WMS_SYNC=<v1130 assets/ui/world-mine-sync.js> must FAIL.
'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const root=path.join(__dirname,'..'); let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; };
(async()=>{try{
  const S=require(process.env.WMS_SYNC?path.resolve(process.env.WMS_SYNC):path.join(root,'assets','ui','world-mine-sync.js'));
  const src=fs.readFileSync(path.join(root,'server','world-mines.js'),'utf8').replace(/require\('(\.{1,2}\/[^']+)'\)/g,(m,f)=>"require("+JSON.stringify(path.join(root,'server',f))+")")   /* v1226: every relative require (the v02 outlines, ../world-realm.js) */;
  const tmp=path.join(os.tmpdir(),'wms-'+process.pid+'.js'); fs.writeFileSync(tmp,src); const M=require(tmp);
  // the payload, shaped exactly like server.js GET /api/world/mines
  const payload=(now)=>{ const epoch=M.epochAt(now); return {ok:true,epoch,nodes:M.field(epoch),serverNow:now,epochEndsAt:(epoch+1)*M.EPOCH_MS}; };
  const now=Date.parse('2026-10-12T14:00:00Z'), live=payload(now);
  ok(live.nodes.some(n=>n.level===9)&&live.nodes.some(n=>n.level===10),'the live field holds level 9 and 10 nodes');
  let v; try{ v=S.validate(live); }catch(e){ v=null; }
  ok(v&&v.nodes.length===M.COUNT,'the client accepts the live server field: '+(v?v.nodes.length:0)+'/'+M.COUNT+' nodes');
  // every level 1-10, all shown
  const all=JSON.parse(JSON.stringify(live)); all.nodes.forEach((n,i)=>{ n.level=1+(i%10); });
  let a; try{ a=S.validate(all); }catch(e){ a=null; }
  ok(a&&a.nodes.length===M.COUNT,'a field with levels 1-10 validates whole');
  for(let L=1;L<=10;L++) ok(a&&a.nodes.filter(n=>n.level===L).length===all.nodes.filter(n=>n.level===L).length,'level '+L+' nodes all kept');
  // the cache the map draws from (create().sync -> state().nodes)
  const c=S.create({token:()=>'t',online:()=>true,fetchState:()=>all,clock:()=>0});
  const st=await c.sync(true);
  ok(st.status==='ready'&&st.nodes.length===M.COUNT&&new Set(st.nodes.map(n=>n.level)).size===10,'the map cache is ready with all 240 nodes, levels 1-10 ('+st.status+', '+st.nodes.length+')');
  // client range covers everything the server can deal, legacy and current
  let hi=0,lo=99; for(let ep=61900;ep<62400;ep+=7) for(const n of M.field(ep)){ hi=Math.max(hi,n.level); lo=Math.min(lo,n.level); }
  ok(lo===1&&hi===10&&M.MAX_LEVEL===hi,'server deals levels '+lo+'-'+hi+' and declares MAX_LEVEL '+M.MAX_LEVEL);
  ok(S.MAX_LEVEL===M.MAX_LEVEL,'client MAX_LEVEL ('+S.MAX_LEVEL+') = server MAX_LEVEL');
  for(const bad of [0,11,8.5]){ const b=JSON.parse(JSON.stringify(live)); b.nodes[0].level=bad;
    let threw=false; try{ S.validate(b); }catch(e){ threw=true; } ok(threw,'level '+bad+' is still refused'); }
  console.log('test_world_mine_sync_levels.js: '+pass+' checks passed');
}catch(e){ console.error('FAIL',e.message); process.exitCode=1; }})();
