// v1368 memory audit (Phil 11 Nov 2026: "Check to make sure no mode slips through"; measured per mode in
// Open Projects/MEMORY BY MODE 11NOV2026). Static checks on the real page text; CONTROL: v1367 (dc537165) has none of them.
const fs=require('fs'),path=require('path'),cp=require('child_process'); const ROOT=path.join(__dirname,'..');
let P=0,F=0; const ck=(n,c)=>{ if(c){P++;console.log('  ok   '+n);} else {F++;console.log('  FAIL '+n);} };
const src=fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8');
const old=cp.execSync('git show dc537165:emberweave-heroes.html',{cwd:ROOT,maxBuffer:64<<20}).toString();
const checks=[
 ['A1 Emberdraft left any way but Quit no longer blocks the release (only its start loader keeps art)', "ED.active&&!((ED.round|0)>0&&typeof state!=='undefined'&&state!=='battle'&&state!=='result')"],
 ['A2 spell sheets free outside the Emberdraft start loader', "ED.active && (ED.round|0)===0)) fxFreeAll();"],
 ['A3 edQuit cannot be stopped by its decor clear, and frees spell sheets', "try{ edClearDecor(); }catch(e){} try{ edEvictArt(true); }catch(e){} ED.active=false; try{ fxFreeAll(); }catch(e){}"],
 ['A4 a sheet freed while loading is marked freed', "tx._ewFreed=1; tx.dispose();"],
 ['B the GPU tally forgets a forced context loss', "/lose_context/i.test(n)&&!e.__ewTally"],
 ['C aimed-ult tint canvases leave with the battle art', "try{ aimArtFree(); }catch(_){} return evictUnusedArt([]);"],
 ['the Witch\'s Hut cauldron video leaves with its screen', "document.querySelectorAll('#wallBody video')"],
 ['a set Emberdraft half-freed (not _loaded) still has its sheets released', "      if(!set) continue;   /* v1368 memory audit"],
 ['the splash video stops once the game is entered', "const sv=document.getElementById('splashVid'); if(sv){ sv.pause();"]];
for(const [n,s] of checks){ ck(n, src.indexOf(s)>=0); }
ck('CONTROL: v1367 had none of them', checks.every(([n,s])=>old.indexOf(s)<0));
console.log('test_mem_audit_1368.js: '+P+' passed, '+F+' failed'); process.exit(F?1:0);
