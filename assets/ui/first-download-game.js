(function(root){
  'use strict';
  let engine=null,initPromise=null,booted=false,previousEssentials=false,unavailable=false,tutorialDismissed=false,playWhileLoading=false;
  const CORE='/assets/ui/first-download.js?v=first18oct',GAME='/assets/ui/first-download-game.js?v=first18oct';
  const wait=(task,ms)=>{let t;return Promise.race([Promise.resolve().then(task),new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('Still loading')),ms);})]).finally(()=>clearTimeout(t));};
  async function plan(){
    await wait(()=>artTiersLoad(),6000).catch(()=>{});
    const catalog=await wait(()=>fetch('/api/download-catalog',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Catalog unavailable');return r.json();}),8000);
    const api=root.EmberweaveFirstDownload,byHero={},essentials=new Set([CORE,GAME,ART_TIERS_URL]),remaining=new Set(allAssetUrls());
    const literal=new Map();for(const u of catalog.literal||[]){let p;try{p=new URL(u,location.origin).pathname;}catch(_){continue;}if(catalog.files.includes(p)){if(!literal.has(p))literal.set(p,[]);literal.get(p).push(u);}}
    const versions=p=>literal.get(p)||[p];
    const tier=c=>{if(!c||!c.u)return null;try{const f=!_keepsImage(c)&&artFile(c.u);return f?f.u:c.u;}catch(_){return c.u;}};
    function fighter(key){
      const out=new Set();for(const c of Object.values(BATTLE_ANIM[key]||{})){const u=tier(c);if(u)out.add(u);}
      if(HERO_PORTRAITS[key])out.add(HERO_PORTRAITS[key]);if(HERO_SPRITES[key])out.add(HERO_SPRITES[key]);
      for(const name of fxSheetKeys([key]))api.urls(FX2_DEF[name]||((typeof FX_PLATE_DEF!=='undefined')&&FX_PLATE_DEF[name]),out);
      for(const slot of [KITS[key]?.green,KITS[key]?.blue,HERO_ULT_ART[key]]){if(slot?.ownFx){const view=FX16_ART[slot.ownFx];if(view)api.urls(FX2_DEF[view.k],out);}}
      if(SFX_DATA.heroes[key])for(const name of sfxFiles(SFX_DATA.heroes[key])){const f=SFX_DATA.files[name];if(f)out.add('/assets/audio/'+f[0]);}
      if(LORE_AUDIO[key])out.add('/assets/audio/'+LORE_AUDIO[key]);
      for(const [event,layers] of Object.entries(AUDIO_MAP))if(event.startsWith('hero.'+key+'.'))for(const layer of layers||[])if(layer.f)out.add('/assets/audio/'+layer.f);
      for(const u of out)remaining.add(u);return [...out];
    }
    const heroes=HERO_KEYS.filter(k=>!HERO_TYPES[k].monster);for(const k of heroes)byHero[k]=fighter(k);
    for(const k of catalog.chapter1||[])for(const u of fighter(k))essentials.add(u);
    // Shared status art is needed before a starter's first fight; other authored FX
    // stay with their hero when identifiable, or in the last part otherwise.
    for(const [key,d] of Object.entries(FX2_DEF)){api.urls(d,remaining);if(/^(voidzone|burn|poison|bleed|shield|heal|frost|nature)/i.test(key))api.urls(d,essentials);}
    for(const [name,f] of Object.entries(SFX_DATA.files))remaining.add('/assets/audio/'+f[0]);
    for(const p of catalog.files){
      if(p.startsWith('/assets/anim/'))continue; // active records above select the device's actual sheets
      if(p.startsWith('/assets/img/hero-portraits/')||p.startsWith('/assets/img/hero-cards/'))continue;
      if(p.startsWith('/assets/audio/'))continue; // wired music, voices and sound records above
      if(!/\.(webp|png|jpg|jpeg|svg|json|js|woff2?|glb)$/i.test(p))continue;
      const list=/\/world-v02\/world-v02-l\d+-r\d+-c\d+\.webp$/.test(p)?[p+'?v='+WORLD_PICTURE_V]:versions(p);
      for(const u of list){remaining.add(u);if(!p.startsWith('/assets/models/')&&!p.startsWith('/assets/img/temple/')&&!p.startsWith('/assets/img/witches-hut/'))essentials.add(u);}
    }
    // Only the first hub and battle tracks are required on day one; the full
    // music library is already represented by allAssetUrls in the last part.
    for(const scene of ['city','home','hub','battle','campaign','world']){const song=MUSIC_LISTS[scene]?.[0];if(song?.f)essentials.add('/assets/audio/'+song.f);}
    const result=api.partition({heroes,starters:['vael','sylthaine','vireo'],byHero,essentials:[...essentials],remaining:[...remaining]});
    if(!result.parts[0].length)throw Error('Essentials missing');return result;
  }
  function assetSaved(u){
    const path=new URL(u,location.origin).pathname;
    // Refill a failed, already-bound texture when its real asset becomes available.
    if(typeof TH!=='undefined'&&TH)for(const set of Object.values(BATTLE_ANIM))for(const c of Object.values(set||{})){
      if(!c||!c.tex||(!c._err&&c.tex.image)||!c.u)continue;const current=c._fu||c.u;if(new URL(current,location.origin).pathname!==path)continue;
      c._err=false;new TH.TextureLoader().load(current,t=>{const g=c._grid||[c.cols||c.n,c.rows||1],trim=c._lay&&c._lay.tc;c.tex.image=capSheet(t.image,g[0],g[1],cellCapFor(c.u),(c.figH&&c.fh)?(c.figH/c.fh)/(trim?trim[3]:1):0);_applyTexQual(c.tex);c.tex.needsUpdate=true;},undefined,()=>{c._err=true;});
    }
    for(const img of document.querySelectorAll('img[data-fd-loading]'))if(new URL(img.src,location.origin).pathname===path){const src=img.src;img.removeAttribute('src');img.src=src;}
  }
  function snapshot(){return engine?engine.snapshot():{status:unavailable?'waiting':'checking',percent:0,essentialsReady:false,error:unavailable?'Downloads are unavailable. Please try again.':null};}
  async function ensure(force){
    if(!force&&engine&&engine.plan&&!['checking','waiting'].includes(engine.snapshot().status))return engine.snapshot();
    if(initPromise)return initPromise;
    initPromise=(async()=>{if(!root.EmberweaveFirstDownload)throw Error('Downloader unavailable');if(!engine){engine=root.EmberweaveFirstDownload.create({plan,assetSaved,persistStorage:()=>askPersistentStorage()});engine.subscribe(changed);}const s=await engine.init();unavailable=false;changed(s);return s;})().catch(()=>{unavailable=true;changed(snapshot());return snapshot();}).finally(()=>{initPromise=null;});return initPromise;
  }
  function needsEssentials(){return !!(!playWhileLoading&&typeof G!=='undefined'&&!G.tutDone&&!(G.campaignCleared>0)&&!snapshot().essentialsReady);}
  function changed(s){
    for(const card of document.querySelectorAll('[data-fd-card]'))paint(card,s);
    if(s.essentialsReady&&!previousEssentials&&typeof state!=='undefined'&&state==='tutorial')setTimeout(()=>renderTutorial(),0);
    previousEssentials=s.essentialsReady;
  }
  function paint(card,s){
    const bar=card.querySelector('[data-fd-bar]');bar.style.width=s.percent+'%';bar.parentNode.setAttribute('aria-valuenow',s.percent);
    const percent=card.querySelector('[data-fd-percent]');if(percent.textContent!==s.percent+'%')percent.textContent=s.percent+'%';
    const status=card.querySelector('[data-fd-status]'),message=s.error||({checking:'Checking saved content…',ready:'Ready to download.',downloading:'Downloading…',saved:'This part is saved. Continue now, or come back later for the rest.',paused:'Saved. The next opening resumes where you left off.',complete:'All content is saved on this device.',waiting:'Waiting for your connection.'}[s.status]||'Ready.');if(status.textContent!==message)status.textContent=message;
    const start=card.querySelector('[data-fd-next]');start.disabled=s.status==='downloading'||s.status==='checking'||s.percent===100;start.textContent=s.status==='waiting'?'Retry download':s.percent?'Continue download':'Download essentials';
    const exit=card.querySelector('[data-fd-exit]');exit.hidden=!s.essentialsReady;exit.disabled=s.status==='checking';
    const play=card.querySelector('[data-fd-play]');play.hidden=!s.essentialsReady&&s.status!=='waiting';play.textContent=!s.essentialsReady?'Play while loading':card.dataset.fdGuide==='1'?'Continue tutorial':'Continue playing';
  }
  function mount(parent,tutorial){
    const inGuide=parent.id==='tutorialBody';if(inGuide&&!tutorial&&tutorialDismissed)return;
    let card=parent.querySelector('[data-fd-card]');if(card)return paint(card,snapshot());
    card=document.createElement('section');card.className='panel';card.dataset.fdCard='1';card.dataset.fdGuide=inGuide?'1':'0';
    card.innerHTML='<div style="font-weight:900;margin-bottom:6px">'+(tutorial?'Step 1 · Get ready to play':'Download your game')+'</div><p style="font-size:12px;line-height:1.5;color:#b7c4d6;margin:6px 0">Save the essentials first. Your heroes, maps and the world map will be ready. Come back later to finish the rest.</p><div role="progressbar" aria-label="Game download" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" style="position:relative;height:14px;background:#0f1420;border:1px solid #65728b;border-radius:8px;overflow:hidden"><div data-fd-bar style="height:100%;width:0;background:linear-gradient(90deg,#bd913f,#ffe6a2)"></div><span style="position:absolute;inset:0;background:linear-gradient(90deg,transparent 24.7%,#152033 24.7%,#152033 25.3%,transparent 25.3%,transparent 49.7%,#152033 49.7%,#152033 50.3%,transparent 50.3%,transparent 74.7%,#152033 74.7%,#152033 75.3%,transparent 75.3%)"></span></div><div data-fd-percent style="font-size:18px;font-weight:900;text-align:center;margin:6px">0%</div><div data-fd-status role="status" aria-live="polite" style="font-size:12px;min-height:32px;color:#b7c4d6"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn sm" data-fd-next>Download essentials</button><button class="btn sm secondary" data-fd-exit hidden>Save and exit</button><button class="btn sm secondary" data-fd-play hidden>Continue playing</button></div>';
    parent.prepend(card);paint(card,snapshot());
    card.querySelector('[data-fd-next]').onclick=async()=>{await ensure();if(engine)await engine.next();};
    card.querySelector('[data-fd-exit]').onclick=async()=>{if(engine)await engine.saveAndExit();document.getElementById('firstDownloadOverlay')?.remove();show('home',{downloadSaved:true});bannerMsg('Saved. Come back later to continue downloading.');};
    card.querySelector('[data-fd-play]').onclick=()=>{if(!snapshot().essentialsReady)playWhileLoading=true;tutorialDismissed=true;document.getElementById('firstDownloadOverlay')?.remove();if(inGuide){G.tutStarted=true;saveG();renderTutorial();}else show('home');};
    ensure();return card;
  }
  function open(auto){
    let overlay=document.getElementById('firstDownloadOverlay');if(!overlay){overlay=document.createElement('div');overlay.id='firstDownloadOverlay';overlay.style.cssText='position:fixed;inset:0;z-index:19000;background:#070b13e8;display:flex;align-items:center;justify-content:center;padding:12px;overflow:auto';const inner=document.createElement('div');inner.style.cssText='width:min(520px,100%);max-height:95vh;overflow:auto';overlay.appendChild(inner);document.body.appendChild(overlay);mount(inner,false);}
    if(auto)ensure().then(()=>engine&&engine.next());
  }
  function boot(){if(booted)return;booted=true;ensure().then(s=>{if(s.started&&s.resumeOnOpen&&s.percent<100)open(true);});}
  function watchImages(){
    const mark=img=>{if(img.tagName!=='IMG'||!img.src||!img.src.includes('/assets/'))return;if(!img.complete){img.dataset.fdLoading='1';img.setAttribute('aria-busy','true');img.style.backgroundColor='#1c2738';}};
    document.addEventListener('load',e=>{const img=e.target;if(img.tagName==='IMG'){delete img.dataset.fdLoading;img.removeAttribute('aria-busy');img.style.backgroundColor='';if(img.title==='Still loading')img.removeAttribute('title');}},true);
    document.addEventListener('error',e=>{const img=e.target;if(img.tagName==='IMG'&&img.src.includes('/assets/')){img.dataset.fdLoading='1';img.setAttribute('aria-busy','true');img.style.backgroundColor='#1c2738';if(!img.title)img.title='Still loading';}},true);
    new MutationObserver(rows=>{for(const row of rows){if(row.type==='attributes')mark(row.target);for(const node of row.addedNodes||[])if(node.nodeType===1){mark(node);node.querySelectorAll('img').forEach(mark);}}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
    document.querySelectorAll('img').forEach(mark);
  }
  const api={plan,ensure,snapshot,needsEssentials,mount,open,boot,reset:async()=>{if(engine)await engine.reset();},assetSaved};root.FirstDownloadGame=api;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchImages);else watchImages();
})(typeof globalThis==='object'?globalThis:this);
