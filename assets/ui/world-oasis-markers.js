(function(root){
  'use strict';
  // v1228 (Phil 30 Oct 2026: "There of 2 of each oasis" / "The drawn one should be garrisonable like the cities"): the oases ARE the 4
  // ponds painted on the World Tree island. The game draws no oasis picture of its own any more - only a tap target over each
  // painted pond and its name. The sites come from /api/world-tree/sites (server/world-tree-sites.js, from world-oasis-layout.json).
  const IDS=['oasis-nw','oasis-ne','oasis-sw','oasis-se'];
  function read(receipt){
    const R=root.EmberweaveRealm||(typeof require==='function'?require('../../world-realm.js'):null),G=R&&R.GEO;
    if(!G||!receipt||receipt.enabled!==false||receipt.layoutPlaced!==true||receipt.coordinateSpace!=='world-percent'||receipt.gridColumns!==G.COLS||receipt.gridRows!==G.ROWS||!Array.isArray(receipt.sites))return null;
    const rows=[];
    for(const id of IDS){
      const matches=receipt.sites.filter(s=>s.id===id&&s.kind==='oasis');
      if(matches.length!==1)return null;
      const s=matches[0],b=s.bounds,c=s.cellOrigin;
      if(!b||!c||!Number.isInteger(c.x)||!Number.isInteger(c.y)||!Number.isInteger(s.widthCells)||!Number.isInteger(s.heightCells))return null;
      const expected={left:c.x*G.CELL,top:G.Y0+c.y*G.CELL,right:(c.x+s.widthCells)*G.CELL,bottom:G.Y0+(c.y+s.heightCells)*G.CELL};
      if(!Object.keys(expected).every(k=>Number.isFinite(b[k])&&Math.abs(b[k]-expected[k])<1e-9))return null;
      if(!s.centre||!(s.centre.x>b.left&&s.centre.x<b.right&&s.centre.y>b.top&&s.centre.y<b.bottom))return null;
      rows.push({id,name:typeof s.name==='string'?s.name:'Oasis',bounds:expected,centre:{x:s.centre.x,y:s.centre.y},garrison:s.garrison===true});
    }
    return rows;
  }
  function create(fetcher){
    let pending=null;
    function load(){
      if(!pending)pending=Promise.resolve().then(()=>fetcher('/api/world-tree/sites',{cache:'no-store'})).then(r=>{if(!r.ok)throw Error('Sites unavailable');return r.json();}).then(read).catch(()=>null);
      return pending;
    }
    async function mount(inner){
      const rows=await load();
      if(!rows||!inner.isConnected)return false;
      inner.querySelectorAll('.worldOasisMarker').forEach(el=>el.remove());
      for(const s of rows){
        const doc=inner.ownerDocument,b=s.bounds,el=doc.createElement('button');
        el.type='button';el.className='worldOasisMarker';el.dataset.siteId=s.id;el.setAttribute('aria-label',s.name);
        el.style.cssText='position:absolute;left:'+b.left+'%;top:'+b.top+'%;width:'+(b.right-b.left)+'%;height:'+(b.bottom-b.top)+'%;z-index:3;background:transparent;border:0;padding:0;margin:0;cursor:pointer';
        const name=doc.createElement('div');name.className='worldOasisName';name.textContent=s.name;
        name.style.cssText='position:absolute;left:50%;top:100%;transform:translateX(-50%) scale(var(--wm-lab,1));transform-origin:50% 0;white-space:nowrap;pointer-events:none;font-size:10px;font-weight:800;color:#bff3ff;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000,0 0 3px #000';
        el.appendChild(name);
        el.onclick=e=>{e.stopPropagation();if(typeof root.ewOpenOasis==='function')root.ewOpenOasis(s.id);};
        inner.appendChild(el);
      }
      return true;
    }
    return {mount};
  }
  const api={read,create,IDS};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.EmberweaveWorldOasisMarkers=create(root.fetch.bind(root));
})(typeof globalThis==='object'?globalThis:this);
