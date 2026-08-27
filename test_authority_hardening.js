/* v272 — the account's stored line-up is UI state, and nothing that pays out may read power from it.
   Regression cover for the full-game audit's top finding: a forged team array inflating guild raid
   damage ~560×, and an unbounded/unvalidated roster reaching storage. */
const http=require('http');
const PORT=process.env.PORT||8871;
function req(path, body, token){ return new Promise((res,rej)=>{ const d=body?JSON.stringify(body):null;
  const r=http.request({host:'localhost',port:PORT,path,method:body?'POST':'GET',
    headers:Object.assign({'content-type':'application/json'},token?{'x-token':token}:{},d?{'content-length':Buffer.byteLength(d)}:{})},
    x=>{ let s=''; x.on('data',c=>s+=c); x.on('end',()=>{ try{res(JSON.parse(s));}catch(e){res({raw:s});} }); });
  r.on('error',rej); if(d)r.write(d); r.end(); }); }
let pass=0,fail=0; const ck=(n,c,d)=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n+(d?' — '+d:''))); };
const rid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);

(async()=>{
  console.log('== v272: a forged line-up cannot buy power ==');
  const nm='hard'+Math.floor(Math.random()*1e6);
  const reg=await req('/api/register',{name:nm,pass:'password1'}); const T=reg.token;
  ck('account registered', !!T);

  // a forged roster: impossible levels, unowned heroes, far too many of them
  const forged=[]; for(let i=0;i<40;i++) forged.push({key:'vael', level:99999, rank:999});
  forged.push({key:'not-a-hero', level:99999, rank:999});
  await req('/api/save',{team:forged, wall:forged, roster:{}, requestId:rid()},T);
  const prof=await req('/api/me',null,T);
  const stored=(prof&&(prof.profile?prof.profile.team:prof.team))||[];
  ck('the stored line-up is capped at five', stored.length<=5, 'stored '+stored.length);
  ck('the stored line-up carries no level or rank', stored.every(h=>h && h.level===undefined && h.rank===undefined),
     JSON.stringify(stored).slice(0,120));
  ck('unknown hero keys are dropped', stored.every(h=>h.key!=='not-a-hero'));

  // the raid must not pay out on those numbers
  await req('/api/guild/create',{name:'Aud'+Math.floor(Math.random()*99999),requestId:rid()},T);
  const a=await req('/api/guild/raid/assault',{requestId:rid()},T);
  const dmg=(a&&a.dmg)||(a&&a.raid&&a.raid.lastDmg)||null;
  const raidHp=(a&&a.raid&&a.raid.hp);
  ck('a raid assault resolves', !!a && !a.error, JSON.stringify(a).slice(0,120));
  ck('raid damage is not inflated by the forged line-up (a level-1 account cannot one-shot the boss)',
     !(raidHp===0), 'boss hp after one hit: '+raidHp);

  console.log(''); console.log('PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
