'use strict';
/* The controls for tests/talents-powergates.test.js (WIRING/41d), run on the cluster through remote_test.sh as a plain node script. Each control
   copies this checkout to a folder under os.tmpdir() (no .logs / .git / backups; node_modules and assets symlinked), puts ONE change back the
   way it was (an exact text swap), runs the named tests of tests/talents-powergates.test.js in that copy and expects them to FAIL, then deletes
   the copy. One copy at a time. The checkout itself is never changed. Prints one line per control and a count; exits 1 if any was not caught.
   The test reads the BASE server and page through git show c2764f5afb36435929b221c67068b34b21987267 (named here so the runner sends them). */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const SRV='server.js', HTML='emberweave-heroes.html';
const C=[
  ['the gate number keeps the talent term (heroGatePower = the card)',SRV,"  if(TL&&!(opt&&opt.noTalents)) p+=talentPowerFlat(key,TL);","  if(TL) p+=talentPowerFlat(key,TL);",'identity|tower|witch|mine|vault|skyfall'],
  ['the cache serves the card as the gate number',SRV,"const ck=String(u.id)+'|'+key+(nt?'|nt':''), hit","const ck=String(u.id)+'|'+key, hit",'identity'],
  ['the Tower climb compares the full card',SRV,"pow=towerSquadPower(me);","pow=ledgerTeamPower(me);",'tower'],
  ['the Tower migration cap reads the full card',SRV,"towerMaxForPower(towerBenchPower(me,NO_TALENTS))","towerMaxForPower(towerBenchPower(me))",'tower'],
  ['the Hut shows a heal cost on the full card',SRV,"healCost:Math.ceil(witchHealPower(u,key)*0.1","healCost:Math.ceil(power*0.1",'witch'],
  ['the Hut heal charges on the full card',SRV,"WITCH.heal(w.state,key,witchHealPower(me,key),w.capacity,now)","WITCH.heal(w.state,key,heroCardPower(me,key),w.capacity,now)",'witch'],
  ['the Hut heal-all charges and orders on the full card',SRV,".map(key=>({key,power:witchHealPower(me,key)}));",".map(key=>({key,power:heroCardPower(me,key)}));",'witch'],
  ['the mine gate compares the full card',SRV,"const power=mineSquadPower(me,ids);","const power=ids.reduce((sum,k)=>sum+heroCardPower(me,k),0);",'mine'],
  ['the Vault review sums the full card',SRV,"squad=vaultReviewSquadPower(pw);","squad=pw&&Array.isArray(pw.fighters)?pw.fighters.reduce((t,h)=>t+(h.power|0),0):null;",'vault'],
  ['the Vault row stores the full card as its gate number',SRV,"gate:Math.round(cardPower(u,k,true,NO_TALENTS)||0)","gate:Math.round(cardPower(u,k,true)||0)",'vault'],
  ['the automatic deal sorts by the full card',SRV,"all.sort((a,b)=>heroGatePower(u,b&&b.key)-heroGatePower(u,a&&a.key));","all.sort((a,b)=>heroCardPower(u,b&&b.key)-heroCardPower(u,a&&a.key));",'skyfall deal'],
  ['a line\'s gate number is its full card sum',SRV,"gatePower:Math.round(heroes.reduce((s,h)=>s+heroGatePower(u,h&&h.key),0))","gatePower:Math.round(heroes.reduce((s,h)=>s+heroCardPower(u,h&&h.key),0))",'skyfall'],
  ['the Monday cut and seeds sort by the shown pool',SRV,"t.entrants.sort((a,b)=>warSeedPool(b)-warSeedPool(a));","t.entrants.sort((a,b)=>b.powerPool-a.powerPool);",'skyfall seed'],
  ['the seed pool is the shown pool',SRV,"seedPool:lines.reduce((s,l)=>s+(l.gatePower|0),0) };","seedPool:lines.reduce((s,l)=>s+l.power,0) };",'skyfall seed|skyfall tiebreak'],
  ['the tie-break reads the shown pool',SRV,"const pa=warSeedPool(warEntrant(t,ga)), pb=warSeedPool(warEntrant(t,gb));","const pa=(warEntrant(t,ga)||{}).powerPool||0, pb=(warEntrant(t,gb)||{}).powerPool||0;",'skyfall tiebreak'],
  ['a locked defender carries no gate number',SRV,"power:L.power|0, gatePower:warPickPower(L),","power:L.power|0,",'skyfall march'],
  ['the marching line is the weakest by the shown power',SRV,"    .sort((x,y)=>(warPickPower(x)-warPickPower(y)) || ((x.line|0)-(y.line|0)));","    .sort((x,y)=>((x.power|0)-(y.power|0)) || ((x.line|0)-(y.line|0)));",'skyfall march'],
  ['the answering defender is the weakest by the shown power',SRV,"    const t=tot[d.memberId]||0, p=warPickPower(d), id=String(d.memberId||''), ln=d.line|0;","    const t=tot[d.memberId]||0, p=d.power|0, id=String(d.memberId||''), ln=d.line|0;",'skyfall march'],
  ['the assault route picks its own line again (inline, by the shown power)',SRV,"      const attacker=warAttackerLine(mine,me.id);","      const attacker=mine.defenders.filter(d=>d.memberId===me.id&&d.alive!==false).sort((x,y)=>((x.power|0)-(y.power|0)))[0];",'skyfall march'],
  ['the page gate number keeps the talent term',HTML,"const _tl=_powerNoTalent?null:talentListLocal(key);","const _tl=talentListLocal(key);",'page'],
  ['the page mine panel compares the full card',HTML,"const pow=marchGatePower([...sel])||0, okP=pow>=reqP,","const pow=marchPower([...sel])||0, okP=pow>=reqP,",'page'],
];
const SKIP=new Set(['.logs','.base','.bin','.git','node_modules','assets','backups','.remote-logs']);
function copyTo(dir){ fs.cpSync(root,dir,{recursive:true,filter:s=>{ const r=path.relative(root,s); return !r||!SKIP.has(r.split(path.sep)[0]); }});
  for(const k of ['node_modules','assets']) if(fs.existsSync(path.join(root,k))) fs.symlinkSync(path.join(root,k),path.join(dir,k)); }
function runOne(c){ return new Promise(res=>{ const [name,file,from,to,pat]=c, dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-powergates-ctl-')); copyTo(dir);
  const done=r=>{ try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(e){} res(r); };
  const p=path.join(dir,file), s=fs.readFileSync(p,'utf8'), n=s.split(from).length-1;
  if(n!==1){ done({name,ok:false,why:'the text to break was found '+n+' times'}); return; }
  fs.writeFileSync(p,s.replace(from,to));
  const ch=cp.spawn(process.execPath,['--test','--test-name-pattern='+pat,'tests/talents-powergates.test.js'],{cwd:dir,env:process.env}); let out='';
  ch.stdout.on('data',d=>out+=d); ch.stderr.on('data',d=>out+=d);
  ch.on('close',()=>{ const m=/# fail (\d+)/.exec(out), pm=/# pass (\d+)/.exec(out); const f=m?+m[1]:-1;
    const failed=[...out.matchAll(/^not ok \d+ - (.*)$/gm)].map(x=>x[1].split(':')[0]);
    done({name,ok:f>0,why:'fail '+f+', pass '+(pm?pm[1]:'?')+(failed.length?' - failed: '+failed.join(', '):'')}); }); }); }
(async()=>{ const out=[];
  for(const c of C){ const r=await runOne(c); out.push(r); console.log((r.ok?'CAUGHT ':'MISSED ')+r.name+'  ('+r.why+')'); }   /* one copy at a time */
  const miss=out.filter(r=>!r.ok); console.log('controls: '+(out.length-miss.length)+' of '+out.length+' caught'); process.exit(miss.length?1:0); })();
