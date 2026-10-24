/* Echo Spire view only. Server adapter supplies encounter/reward facts; this module never computes a fight or pays a reward. */
(function(root){
  'use strict';
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=v=>Number.isFinite(Number(v))?Number(v).toLocaleString():'—';
  function date(value){if(!value)return 'Date unavailable';const d=new Date(value);return Number.isNaN(+d)?'Date unavailable':d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});}
  function escapeSeason(value){const ms=Number(value)-Date.now();return Number.isFinite(ms)?(ms<=0?'Season ending':Math.ceil(ms/3600000)+'h remaining'):'End time unavailable';}
  function heroes(list,portrait,echo){return (list||[]).map(h=>{const src=portrait(h.key,h);return `<div class="es-hero${echo?' es-ghost':''}">${src?`<img src="${esc(src)}" alt="" loading="lazy">`:'<span class="es-silhouette" aria-hidden="true"></span>'}<span>${esc(h.name||h.key||'Unknown hero')}</span></div>`;}).join('');}
  function render(state,options){
    const s=state||{},o=options||{},portrait=o.portrait||(()=>''),e=s.encounter||null,echo=e&&e.kind==='echo',floor=e?e.floor:s.nextFloor;
    const selected=s.selectedHeroes||[],ready=selected.length>0&&selected.length<=5&&!s.busy&&!s.loading&&!!e&&!s.error;
    return `<section class="echo-spire" aria-label="Echo Spire">
      <header class="es-header"><div><div class="es-eyebrow">TOWER OF TRIALS</div><h1>Echo Spire</h1></div><button type="button" class="es-close" data-es="close" aria-label="Close Echo Spire">×</button></header>
      <div class="es-intro"><span class="es-eyebrow">YOUR PAST IS WAITING</span><p>Climb beyond the teams you once were.</p>${s.season!=null?`<div class="es-season">Season ${number(s.season)} · ${s.seasonEnds?escapeSeason(s.seasonEnds):'End time unavailable'}</div>`:''}<div class="es-stats"><div><b>${number(s.floor||0)}</b><span>Current floor</span></div><div><b>${number(s.bestFloor||0)}</b><span>Personal best</span></div><div><b>${number(s.restedCount||0)}</b><span>Echoes laid to rest</span></div></div></div>
      ${s.loading?'<p class="es-notice" role="status">The Spire is taking shape…</p>':s.error?`<div class="es-notice" role="alert">${esc(s.error)}<button type="button" data-es="retry">Try again</button></div>`:''}
      <section class="es-encounter"><div class="es-row"><span class="es-eyebrow">NEXT · FLOOR ${number(floor)}</span><span class="es-badge${echo?' es-badge-echo':''}">${echo?'ECHO WARDEN':e&&e.elite?'ELITE GUARDIAN':'GUARDIAN'}</span></div>
      <h2>${esc(e&&e.name||(echo?'Your past lineup':'The next Warden'))}</h2>
      ${echo?`<p class="es-origin">Your F${number(e.recordedFloor)} run${e.recordedSeason!=null?' · Season '+number(e.recordedSeason):''}${e.recordedAt?' · '+esc(date(e.recordedAt)):''}</p><div class="es-heroes">${heroes(e.heroes,portrait,true)}</div>`:`<div class="es-heroes">${heroes(e&&e.heroes,portrait,false)}</div>`}
      ${e&&e.power!=null?`<div class="es-facts"><span>Warden power <b>${number(e.power)}</b></span>${e.rewardText?`<span>${esc(e.rewardText)}</span>`:''}</div>`:''}</section>
      <section class="es-squad"><div class="es-row"><h2>Your lineup</h2><span>${selected.length}/5 heroes</span></div><div class="es-heroes">${heroes(selected,portrait,false)}${Array.from({length:Math.max(0,5-selected.length)},()=>'<div class="es-empty-slot" aria-hidden="true">+</div>').join('')}</div><button class="es-link" type="button" data-es="lineup" ${s.busy?'disabled':''}>${selected.length?'Change lineup':'Choose heroes'}</button></section>
      <button type="button" class="es-ascend" data-es="ascend" ${ready?'':'disabled'}>${s.busy?'Resolving your climb…':'Fight · Floor '+number(floor)}</button>
      <p class="es-feedback" role="status" aria-live="polite">${esc(s.message||(!selected.length?'Choose your lineup.':''))}</p>
      <details class="es-floors"><summary>Floor memories</summary><ol>${(s.floors||[]).map(f=>`<li${f.floor===floor?' class="es-current"':''}><span>Floor ${number(f.floor)}</span><span>${f.rested?'Laid to rest':f.kind==='echo'?'Echo Warden':f.cleared?'Cleared':f.kind==='guardian'?'Guardian':'Unrevealed'}</span></li>`).join('')||'<li>Your cleared floors will appear here.</li>'}</ol></details>
      <section class="es-tribute"><div><h2>Spire Tribute</h2><p>${esc(s.tribute&&s.tribute.description||'Clear your first floor to unlock daily tribute.')}</p></div><button type="button" data-es="tribute" ${s.busy||!s.tribute||!s.tribute.ready?'disabled':''}>${s.tribute&&s.tribute.claimed?'Claimed today':'Claim'}</button></section>
    </section>`;
  }
  function mount(host,state,options){let current=state,locked=false,destroyed=false;const o=options||{};function update(next){if(destroyed)return;current=next;host.innerHTML=render(current,o);}update(current);host.onclick=async event=>{const button=event.target.closest('[data-es]');if(!button||!host.contains(button)||button.disabled)return;const action=button.dataset.es;const fn=o.actions&&o.actions[action];if(!fn)return;if(locked&&['ascend','tribute'].includes(action))return;const mutation=['ascend','tribute'].includes(action);if(mutation){locked=true;update({...current,busy:true});}try{const next=await fn(current);if(next)update(next);}catch(error){update({...current,message:'Your result is not confirmed. Try again to recover it.'});if(o.onError)o.onError(error);}finally{if(mutation){locked=false;update({...current,busy:false});}}};return {update,destroy(){destroyed=true;host.onclick=null;host.innerHTML='';}};}
  const api={render,mount};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EchoSpireUI=api;
})(typeof window!=='undefined'?window:globalThis);
