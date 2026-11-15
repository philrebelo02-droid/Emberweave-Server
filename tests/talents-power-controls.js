'use strict';
/* The controls for tests/talents-power.test.js (run on the cluster through remote_test.sh as a plain node script). Each control copies this
   checkout to a folder under os.tmpdir() (no .logs / .git / backups; node_modules and assets symlinked), breaks ONE thing there with an exact
   text swap, runs the named tests of tests/talents-power.test.js in that copy and expects them to FAIL, then deletes the copy. One copy at a
   time. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any control was not caught. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const SRV='server.js', HTML='emberweave-heroes.html', TPJ='talents-power.js';
const C=[
  ['the formula removed from the server card',SRV,"function talentPowerFlat(key,list){ return TALENT_POWER.power(key,list); }","function talentPowerFlat(key,list){ return 0; }",'ONE POWER|monotonic|the ratio|no double count'],
  ['the formula removed from the page card',HTML,"  { const _tl=talentListLocal(key); if(_tl) _pw+=talentPowerFlat(key,_tl); }","",'ONE POWER|monotonic|no double count'],
  ['the card prices talent stats as well (double count)',SRV,"noGlyphStats:true,noTempleEffects:true,noTalentStats:true}","noGlyphStats:true,noTempleEffects:true}",'ONE POWER|no double count|the ratio'],
  ['the fight unit loses its talent stats',SRV,"const _tl=(unit&&!(sOpts&&sOpts.noTalentStats))?talentListFor(u.led,key):null;","const _tl=(unit&&sOpts&&!sOpts.noTalentStats)?talentListFor(u.led,key):null;",'no double count'],
  ['the switch ignored (the ledger read straight)',SRV,"  let TL=null; try{ TL=talentListFor(u.led,key); }catch(e){ TL=null; }","  let TL=null; try{ const _b=u.led&&u.led.talents&&u.led.talents[key]; TL=_b?TALENTS.learned(key,_b):null; if(TL&&!TL.length) TL=null; }catch(e){ TL=null; }",'no talents learned'],
  ['the formula added for a hero with nothing learned',SRV,"  if(TL) p+=talentPowerFlat(key,TL);","  p+=TL?talentPowerFlat(key,TL):1;",'no talents learned'],
  ['UNIT doubled (91 points worth 2x max glyphs)',TPJ,"const UNIT=236;","const UNIT=472;",'the ratio'],
  ['UNIT halved',TPJ,"const UNIT=236;","const UNIT=118;",'the ratio'],
  ['depth made steep (deep builds far above shallow ones)',TPJ,"const DEPTH=0.04;","const DEPTH=0.20;",'the ratio'],
  ['a rank past the first adds nothing',TPJ,"if(t&&r>0) s+=t.v*r; }","if(t&&r>0) s+=t.v; }",'monotonic|the ratio'],
  ['the page adds a different number from the server',HTML,"?TalentPower.power(key,list):0; }catch(e){ return 0; } }","?TalentPower.power(key,list)+1:0; }catch(e){ return 0; } }",'ONE POWER|no double count'],
  ['unwired heroes priced',TPJ,"const def=FX&&FX.mech?(FX.mech(hero)||(any?{talents:{}}:null)):null;","const def=FX&&FX.mech?(FX.mech(hero)||{talents:{}}):null;",'unwired'],
  ['classification lost (every talent OTHER)',TPJ,"          let kinds=KIND_ORDER.filter(x=>K[x]); if(!kinds.length) kinds=['other'];","          let kinds=['other'];",'unwired heroes and bad lists'],
  ['a rank above the max counted',TPJ,"r=Math.min(t?t.ranks:0,(e&&e[1])|0); if(t&&r>0) s+=t.v*r; }","r=(e&&e[1])|0; if(t&&r>0) s+=t.v*r; }",'unwired heroes and bad lists'],
  ['the page loads no formula file',HTML,'<script src="/talents-power.js?v=t1"></script>','','setup|ONE POWER'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-power-ctl-')); copyTo(dir);
  const done=r=>{ try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(e){} res(r); };
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), n=s.split(from).length-1;
  if(n!==1){ done({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(from,to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-power.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',()=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out); const f=m?+m[1]:-1; done({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')}); }); }); }
(async()=>{ const out=[];
  for(const c of C){ const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }   /* one copy at a time */
  const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
