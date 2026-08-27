/* v257 balance probe. Captures, from the REAL server stat model:
   A) empty-board hero snapshots at every level 1..60 (base curve)
   B) glyph-board deltas at each of the 16 ladder tiers (level 60, so the gate never blocks)
   unit(L,T) = A[L] + delta(T)   — glyph stats are flat and level-independent. */
const http=require('http'), fs=require('fs');
const B={host:'localhost',port:process.env.PORT||8871};
function req(method,path,body,token){ return new Promise((res,rej)=>{
  const data=body?JSON.stringify(body):null;
  const r=http.request({...B,method,path,headers:Object.assign({'content-type':'application/json'},
    token?{'x-token':token}:{}, data?{'content-length':Buffer.byteLength(data)}:{})},resp=>{
    let b=''; resp.on('data',c=>b+=c); resp.on('end',()=>{ try{res(JSON.parse(b));}catch(e){res({raw:b});} }); });
  r.on('error',rej); if(data)r.write(data); r.end(); }); }

const D_MAX_LEVEL=70;
const D_TROOP_INC=[8,10,35,45,60,70,70,80,90,110,110,120,120,130,130,130,130,130,150,250,0,0,0,300,330,350,0,370,0,0,450,0,0,600,700,800,0,0,1200,1200,1300,1400,0,0,1900,0,0,0,3000,3250,0,3250,3250,3250,0,3400,0,3520,3640,0,3760,0,3880,4000,0,4120,4240,0,4360];
const D_HERO_STEP=[8,10,12,26,40,60,80,100,120,140,200,260,320,380,440,500,560,620,680,740,800,1000,1200,1400,1600,1800,2000,2200,2500,2800,3100,3400,3700,4000,4300,4600,4900,5200,5500,5800,6900,7200,7500,7800,8100,8400,8700,9000,9300,10200,10500,10800,11100,11700,12300,12900,13500,14100,14700,15300,15900,16500,17100,17700,18300,18900,19500,20100,20700];
function runSum(inc){const o=[];let r=0;for(const v of inc){r+=v;o.push(r);}return o;}
function cum(st){const c=new Array(D_MAX_LEVEL+1);c[1]=0;for(let L=2;L<=D_MAX_LEVEL;L++)c[L]=c[L-1]+st[L-2];return c;}
const T_CUM=cum(runSum(D_TROOP_INC)), H_CUM=cum(D_HERO_STEP);

const FAMS=['Stoneheart','Ironwall','Veilward','Ravager','Starfire','Windstep','Hawkeye','Lifebloom',
  'Shadepath','Sunder','Bastion','Voidbind','Bloodroot','Tidecall','Dawnshield','Keenmind','Cataclysm','Worldheart'];
const BASEQ=['Grey','Green','Blue','Purple','Gold','Orange'];
const SQUAD=['vael','sylthaine','vireo','vex','tick'];

(async()=>{
  const devTok=(await req('POST','/api/login',{name:'dev1',pass:'password1'})).token;

  // ---------- A) level curve, empty board ----------
  const rA=await req('POST','/api/login',{name:'tuneA',pass:'password1'});
  await req('POST','/api/admin/led-grant',{userId:rA.profile.id,unlock:SQUAD},devTok);
  const levels={};
  let pxHave=0, hxHave=0;
  for(let L=1;L<=70;L++){
    const wantPx=T_CUM[L], wantHx=H_CUM[L];
    const dpx=Math.max(0,wantPx-pxHave), dhx=Math.max(0,wantHx-hxHave);
    if(dpx||dhx){ await req('POST','/api/admin/led-grant',{userId:rA.profile.id,heroKeys:SQUAD,heroXp:dhx,px:dpx},devTok);
      pxHave=wantPx; hxHave=wantHx; }
    const snaps={};
    for(const h of SQUAD) snaps[h]=(await req('GET','/api/admin/snapshot?hero='+h,null,rA.token)).snapshot||null;
    levels[L]=snaps;
    if(snaps.vael && snaps.vael.level!==L) console.error('level mismatch at',L,snaps.vael.level);
  }

  // ---------- B) glyph ladder at level 60 ----------
  const rB=await req('POST','/api/login',{name:'tuneB',pass:'password1'});
  await req('POST','/api/admin/led-grant',{userId:rB.profile.id,unlock:SQUAD,heroKeys:SQUAD,heroXp:H_CUM[70],px:T_CUM[70]},devTok);
  const cat=await req('GET','/api/glyphs/catalog',null,rB.token);
  const ladder=cat.ladder;
  const tiers=[]; let err='';
  const grant=async(key,n)=>{ const sp=key.indexOf(' '); const q=key.slice(0,sp), fam=key.slice(sp+1);
    let left=n; while(left>0){ const chunk=Math.min(500,left);
      const rv=(await req('GET','/api/glyphs/state',null,devTok)).revision;
      const r=await req('POST','/api/glyphs/grant',{userId:rB.profile.id,quality:q,family:fam,n:chunk,expectedRevision:rv},devTok);
      if(r.error){ err+=' grant '+key+':'+r.error; break; } left-=chunk; } };
  for(let ti=0;ti<ladder.length;ti++){
    const q=ladder[ti];
    for(const h of SQUAD){
      for(let slot=0;slot<6;slot++){
        const tree=await req('GET','/api/glyphs/build-tree?heroKey='+h+'&slot='+slot,null,rB.token);
        if(tree.error){ err+=' tree '+q+'/'+h+'/'+slot+':'+tree.error; continue; }
        if(tree.locked) continue;
        for(const t of (tree.totals||[])){ const d=t.need-t.have; if(d>0) await grant(t.key, d); }
        const rv=(await req('GET','/api/glyphs/state',null,rB.token)).revision;
        const r=await req('POST','/api/glyphs/build-in-slot',
          {heroKey:h,slot,blueprintId:tree.blueprintId,expectedRevision:rv,requestId:'b'+ti+h+slot},rB.token);
        if(r.error) err+=' build '+q+'/'+h+'/'+slot+':'+r.error;
      }
    }
    const snaps={};
    for(const h of SQUAD) snaps[h]=(await req('GET','/api/admin/snapshot?hero='+h,null,rB.token)).snapshot||null;
    tiers.push({tier:ti,quality:q,snaps});
    for(const h of SQUAD){
      const rv=(await req('GET','/api/glyphs/state',null,rB.token)).revision;
      const a=await req('POST','/api/glyphs/ascend',{heroKey:h,expectedRevision:rv},rB.token);
      if(a.error) err+=' asc '+q+'/'+h+':'+a.error;
    }
    console.log('tier',q,'done');
  }
  fs.writeFileSync('/tmp/tune_snaps.json',JSON.stringify({ladder,minLevel:cat.ladderMinLevel,levels,tiers,err},null,1));
  console.log('levels:',Object.keys(levels).length,'tiers:',tiers.length,'err:',err||'-');
})().catch(e=>{console.error('PROBE FAIL',e);process.exit(1);});
