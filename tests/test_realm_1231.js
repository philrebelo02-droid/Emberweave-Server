// v1231: (1) Grok's detail2x tiles are a sparse z0 level: every listed z0 tile exists and matches realm.json, every one lies inside Grok's
// detail tiles, z1 stays drawn under it and a view outside the detail gets no z0 tile; (2) 16 cities (+ Ochreth, Hallowrime, Lanternmere,
// Skarrow), every city square blocked; (3) Phil: the lake / stilt city "seems this city is able to be teleported on" - Groll's squares over
// its lake are city squares now and the server refuses a teleport there. Fails on 6d5648b3 (live v1229: Groll's lake squares were open).
// Asserts, exits non-zero.
'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto'),net=require('net'),{spawn}=require('child_process');
const root=path.join(__dirname,'..'),R=require('../world-realm.js'),L=require('../server/world-location.js'),M=require('../server/world-mines.js');
let pass=0;const ok=(c,m)=>{assert(c,m);pass++;};
(async()=>{
  // ---- 1. the detail level
  const D=R.META.detail,man=JSON.parse(fs.readFileSync(path.join(root,'assets','img','world-map','realm-v25','realm.json'),'utf8')).files;
  ok(D&&D.z===0&&D.scale===2*R.META.levels[0].scale&&Array.isArray(D.tiles)&&D.tiles.length>0,'a z0 detail level at twice z1');
  const X0=R.META.levels[0].width?(34640-R.META.levels[0].width/R.META.levels[0].scale):0;   // the crop's left edge in master px
  let missing=0,badHash=0,outside=0;
  for(const t of D.tiles){const [r,c]=t.split(',').map(Number),rel='tiles/z0/r'+String(r).padStart(2,'0')+'c'+String(c).padStart(2,'0')+'.webp',f=path.join(root,'assets','img','world-map','realm-v25',rel);
    if(!fs.existsSync(f)){missing++;continue;}
    if(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')!==man[rel])badHash++;
    const mx0=X0+c*512/D.scale,my0=r*512/D.scale,mx1=mx0+512/D.scale,my1=my0+512/D.scale;
    if(!D.sources.some(s=>mx0>=s.x0-1&&my0>=s.y0-1)||![[mx0,my0],[mx1-1,my0],[mx0,my1-1],[mx1-1,my1-1]].every(([x,y])=>D.sources.some(s=>x>=s.x0&&x<s.x0+4096&&y>=s.y0&&y<s.y0+4096)))outside++;}
  ok(missing===0,'every z0 tile exists ('+missing+' missing of '+D.tiles.length+')');ok(badHash===0,'every z0 tile matches realm.json ('+badHash+' differ)');
  ok(outside===0,'every z0 tile lies inside Grok\'s detail tiles ('+outside+' outside)');
  ok(D.sources.length>=3&&new Set(D.sources.map(s=>s.r+','+s.c)).size===D.sources.length&&D.sources.every(s=>/^[0-9a-f]{64}$/.test(s.sha256)),'the '+D.sources.length+' detail sources are recorded with their sha256, one file per tile position (v1232: 7, the latest round each)');
  // a view outside the detail (the south-west) gets no z0 tile: the client filters by the same tile set
  const set=new Set(D.tiles);let hits=0;for(let r=60;r<70;r++)for(let c=20;c<30;c++)if(set.has(r+','+c))hits++;ok(hits===0,'no z0 tile outside the detail');
  const html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
  ok(/paintRealmTiles\(inner\.querySelector\('#realmTiles'\),z0\.length\?base\.concat\(z0\):base\)/.test(html),'z1 stays drawn under the z0 tiles (no gap while a z0 tile loads, none outside)');
  ok(/filter\(t=>_wmDetailSet\.has\(t\.row\+','\+t\.col\)\)/.test(html)&&/const WM_DETAIL_FROM=0\.6;/.test(html),'z0 only where a tile exists, near max zoom');
  // ---- 2. 16 cities, every square blocked
  const names=R.META.cities.map(c=>c.name);ok(names.length===16,'16 cities: '+names.join(', '));
  for(const n of ['Ochreth','Hallowrime','Lanternmere','Skarrow'])ok(names.includes(n),n);
  ok(!R.META.cities.some(c=>/PROVISIONAL/i.test(c.name)),'no provisional city');
  const mines=new Set();for(let e=M.epochAt(Date.now());e<M.epochAt(Date.now())+3;e++)for(const n of M.field(e))for(const k of L.GEO.mineKeys(n.x,n.y))mines.add(k);
  let bad=0;for(const c of R.META.cities){ok(c.kind==='city'&&c.garrison===true,c.name+' is a garrison site');
    for(const [x,y] of c.cells){if(!R.isCity(x,y)||R.isOpen(x,y)||mines.has(x+','+y)||L.REGION_KEYS.some(h=>L.targetAllowed(h,L.cornerX(x),L.cornerY(y))))bad++;}}
  ok(bad===0,'every city square is a city square: no castle, teleport or mine ('+bad+' not)');
  // ---- 3. the lake city: Groll's squares over its lake (land in the zone mask) were open on live v1229
  const LAKE=[[157,387],[159,387],[158,388],[159,388],[170,386]];
  for(const [x,y] of LAKE)ok(R.cityAt(x,y)==='Groll'&&!R.isOpen(x,y),'Groll lake square '+x+','+y+' is the city');
  // the server refuses a teleport onto it
  const free=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'realm-1231-')),db=path.join(dir,'db.json'),port=await free(),base='http://127.0.0.1:'+port;let child=null;
  const req=async(m,r,d,t)=>(await fetch(base+r,{method:m,headers:{...(t?{'x-token':t}:{}),...(d?{'content-type':'application/json'}:{})},body:d?JSON.stringify(d):undefined})).json();
  const start=async admin=>{child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,PORT:String(port),DB_FILE:db,ADMIN_IDS:admin||'',NODE_ENV:'test',SIM_WORKERS:'0',DATABASE_URL:'',REG_PER_MIN:'50',REG_ACCOUNTS_PER_IP:'50'}});
    for(let i=0;i<300;i++){try{if((await fetch(base+'/health')).ok)return;}catch(e){}await new Promise(r=>setTimeout(r,100));}throw Error('no server');};
  const stop=async()=>{if(child){const c=child;child=null;c.kill();await new Promise(r=>setTimeout(r,700));}};
  try{
    await start();const a=await req('POST','/api/register',{name:'lakeTest',pass:'password1'});await stop();await start(a.profile.id);
    await req('POST','/api/admin/led-grant',{userId:a.profile.id,unlock:['vael'],heroKeys:['vael'],px:900000,gems:500},a.token);
    const st=await req('GET','/api/world/state',null,a.token);ok(st&&st.ok&&!st.locked,'the test castle is placed');
    const [x,y]=LAKE[0],r=await req('POST','/api/world/relocate',{kind:'targeted',x:L.cornerX(x),y:L.cornerY(y),requestId:'lake-1'},a.token);
    ok(r&&r.ok===false&&/city/.test(r.error||''),'the server refuses a teleport onto the lake city: '+JSON.stringify(r).slice(0,120));
  }finally{await stop();}
  console.log('test_realm_1231.js: '+pass+' checks passed');
})().catch(e=>{console.error('FAIL',e.message);process.exitCode=1;});
