(function(root){
  'use strict';
  function read(receipt){
    if(!receipt||receipt.enabled!==false||receipt.layoutPlaced!==true||receipt.coordinateSpace!=='world-percent'||receipt.gridColumns!==220||!Array.isArray(receipt.sites))return null;
    const rows=[];
    for(const direction of ['north','south','east','west']){
      const matches=receipt.sites.filter(s=>s.id==='oasis-'+direction&&s.kind==='oasis'&&s.direction===direction);
      if(matches.length!==1)return null;
      const s=matches[0],b=s.bounds,c=s.cellOrigin;
      if(s.widthCells!==2||s.heightCells!==2||!b||!c||!Number.isInteger(c.x)||!Number.isInteger(c.y)||c.x<0||c.y<0||c.x>218||c.y>218)return null;
      const expected={left:c.x*100/220,top:c.y*100/220,right:(c.x+2)*100/220,bottom:(c.y+2)*100/220};
      if(!Object.keys(expected).every(k=>Number.isFinite(b[k])&&Math.abs(b[k]-expected[k])<1e-9))return null;
      rows.push({id:s.id,direction,bounds:expected});
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
        const el=inner.ownerDocument.createElement('img'),b=s.bounds;
        el.className='worldOasisMarker';el.dataset.siteId=s.id;
        el.src='/assets/img/world-map/oases/oasis-'+s.direction+'-painted-01oct-v1.webp';
        el.alt=s.direction+' healing oasis';el.draggable=false;el.decoding='async';
        el.onerror=()=>el.remove();
        el.style.cssText='position:absolute;left:'+b.left+'%;top:'+b.top+'%;width:'+(b.right-b.left)+'%;height:'+(b.bottom-b.top)+'%;object-fit:contain;z-index:3;pointer-events:none';
        inner.appendChild(el);
      }
      return true;
    }
    return {mount};
  }
  const api={read,create};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.EmberweaveWorldOasisMarkers=create(root.fetch.bind(root));
})(typeof globalThis==='object'?globalThis:this);
