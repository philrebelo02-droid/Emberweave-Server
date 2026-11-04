// LANGUAGES step 2: gather every CONTENT template the game can show (skill / passive / ultimate descriptions at every skill level,
// their meta lines ...) by running the real page with LANG.collect on, and write tools/lang/content/en.json {template: area}.
// Translators fill tools/lang/content/<code>/*.json; tools/lang/build.js writes lang/<code>.content.json.
// Usage: node tools/lang/collect_content.js
'use strict';
const fs=require('fs'),path=require('path');
const H=require('./harness.js');
(async()=>{
  const h=await H.open();
  try{
    const res=await h.page.evaluate(()=>{
      const out={}; const take=area=>{ for(const k of LANG.collect) if(!(k in out)) out[k]=area; LANG.collect=new Set(); };
      LANG.collect=new Set();
      const keys=Object.keys(HERO_TYPES).filter(k=>KITS[k]);
      const realLv=window.skillLevel;
      const LVS=[1,2,3,4,5,6,8,10,12,15,20,25,30,40,50,60,70,80,90,100];
      for(const lv of LVS){ window.skillLevel=()=>lv;
        for(const k of keys) for(let i=0;i<4;i++){ try{ skillDesc(k,i); }catch(e){} try{ skillDesc(k,i,true); }catch(e){} } }
      window.skillLevel=realLv; take('skill');
      // the battle tooltip reads the tables directly
      for(const k of keys){ const kit=KITS[k], t=HERO_TYPES[k];
        try{ langDesc(HERO_ULT_DESC[k]||ULT_DESC[t.ability]||''); }catch(e){}
        for(const s of ['green','blue']) if(kit[s]) try{ langDesc(kit[s].desc||KIT_DESC[kit[s].type]||''); }catch(e){}
        if(kit.purple) for(const lv of LVS) try{ langDesc(passDescAt(kit.purple,lv)); }catch(e){} }
      take('skill');
      return {out,heroes:keys.length}; });
    const dir=path.join(__dirname,'content'); fs.mkdirSync(dir,{recursive:true});
    const f=path.join(dir,'en.json'); let prev={}; try{ prev=JSON.parse(fs.readFileSync(f,'utf8')); }catch(_){}
    // other areas (written by other collectors) are kept; this collector owns 'skill'
    const merged={}; for(const [k,a] of Object.entries(prev)) if(a!=='skill') merged[k]=a; Object.assign(merged,res.out);
    const keys=Object.keys(merged).sort();
    fs.writeFileSync(f,'{\n'+keys.map(k=>JSON.stringify(k)+':'+JSON.stringify(merged[k])).join(',\n')+'\n}\n');
    console.log('collect: '+res.heroes+' heroes, '+Object.keys(res.out).length+' skill templates ('+Object.values(res.out).length+'), '+keys.length+' total, '+keys.join('').length+' chars');
    if(h.errors.length) console.log('page errors: '+h.errors.slice(0,5).join(' | '));
  } finally { await h.close(); }
})().catch(e=>{ console.error(e); process.exit(1); });
