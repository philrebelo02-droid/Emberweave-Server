'use strict';
/* v1443 (review of the v1441 record cap). The record the server replays holds 400 actions (INPUT_LOG_CAP = server INPUT_LOG_MAX).
   v1441 made a press beyond it "not played either" - in EVERY mode, silently, and an AUTO press beyond it left the button on
   "switching" for the rest of the fight.
     1. the cap gates only the modes whose record the server replays (campaign, province, the Well, the guild raid);
        in the Vault, arena, Emberdraft, online and a bonus run the 401st press is played, as on live;
     2. in a replayed mode the refused press says so once a fight (battle.action_limit) and queueInput answers false;
     3. AUTO is never left pending by a refused press - the button shows its true state;
     4. a spent Gear Active, or one already on its way, adds nothing to the record however often it is clicked;
     5. the line is in all 16 language files.
   Runs the page's own script in the server's headless host. Asserts (non-zero exit). */
const assert=require('assert'), fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.join(__dirname,'..');
const host=require(path.join(ROOT,'server','sim-host.js')).load(path.join(ROOT,'emberweave-heroes.html'));
let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; console.log('  ok  '+m); };
function inPage(){ const R=[]; const ck=(c,m)=>R.push([!!c,m]);
  const said=[]; bannerMsg=function(s){ said.push(String(s)); }; refreshCtrlBtns=function(){}; isAutoBattle=()=>false; autoOpen=()=>true;
  const full=()=>{ INPUT_LOG=[]; for(let i=0;i<400;i++) INPUT_LOG.push([i,'ult',1,-1,null,null]); };
  const fresh=m=>{ CUR={mode:m}; battleInputsReset(); REPLAY_IN=null; said.length=0; state='battle'; ended=false; autoUlt=false; };
  for(const m of ['vault','arena','emberdraft','online','dungeon','training']){ fresh(m); full(); const r=queueInput({k:'ult',uid:7,tid:null,wx:null,wy:null});
    ck(r===true&&_inputQ.length===1&&said.length===0, m+': with 400 actions on the record the next press is still played, and nothing is said'); }
  for(const m of ['campaign','province','well','graid']){ fresh(m); full(); const r=queueInput({k:'ult',uid:7,tid:null,wx:null,wy:null}), r2=queueInput({k:'ult',uid:8,tid:null,wx:null,wy:null});
    ck(r===false&&r2===false&&_inputQ.length===0&&INPUT_LOG.length===400, m+': the 401st and 402nd press are not played and not recorded');
    ck(said.length===1&&said[0].indexOf(t('battle.action_limit'))>=0, m+': the player is told once ("'+t('battle.action_limit')+'")'); }
  fresh('campaign'); ck(queueInput({k:'ult',uid:7,tid:null,wx:null,wy:null})===true&&_inputQ.length===1&&INPUT_LOG.length===1&&said.length===0, 'campaign under the cap: a press is played and recorded, nothing said');
  fresh('campaign'); full(); queueInput({k:'ult',uid:7}); battleInputsReset(); full(); queueInput({k:'ult',uid:7}); ck(said.length===2, 'a new fight may say it again (once per fight)');
  /* AUTO */
  fresh('campaign'); full(); autoBtnPress(); ck(autoPendingTarget===null&&autoUlt===false, 'campaign, record full: an AUTO press is not left "switching" (pending '+autoPendingTarget+')');
  autoBtnPress(); ck(autoPendingTarget===null&&said.length===1, 'and a second press is still answered (said once)');
  fresh('campaign'); autoBtnPress(); ck(autoPendingTarget===true&&_inputQ.length===1, 'campaign, room on the record: AUTO waits for its tick as before'); pumpInputs(); ck(autoUlt===true&&autoPendingTarget===null, 'and switches on at that tick');
  fresh('vault'); full(); autoBtnPress(); pumpInputs(); ck(autoUlt===true&&autoPendingTarget===null, 'the Vault with a full record: AUTO still switches on');
  /* the Gear Active button */
  fresh('campaign'); const u={uid:3,alive:true,gearSkill:{used:false}}; units=[u]; let casts=0; const cg=castGearSkill; castGearSkill=function(x){ casts++; x.gearSkill.used=true; };
  ck(gearBtnPress(u)===true&&INPUT_LOG.length===1, 'a Gear Active press is recorded'); ck(gearBtnPress(u)===false&&gearBtnPress(u)===false&&INPUT_LOG.length===1, 'two more clicks before it lands add nothing');
  pumpInputs(); ck(casts===1&&u.gearSkill.used===true, 'it is cast once'); for(let i=0;i<50;i++) gearBtnPress(u); ck(INPUT_LOG.length===1, 'fifty clicks on the spent Gear Active add nothing to the record ('+INPUT_LOG.length+' entry)');
  const v={uid:4,alive:true,gearSkill:{used:false}}; units=[u,v]; castGearSkill=function(){ casts++; };   /* refused by the fight: not used */
  gearBtnPress(v); pumpInputs(); ck(gearBtnPress(v)===true&&INPUT_LOG.length===3, 'a press the fight refused (not used) can be pressed again');
  simTick+=40; ck(gearBtnPress(v)===true, 'and a press that never reached its tick frees the button after a moment'); castGearSkill=cg;
  return JSON.stringify(R); }
for(const [c,m] of JSON.parse(vm.runInContext('('+inPage.toString()+')()',host.ctx,{timeout:120000}))) ok(c,m);
{ const key='battle.action_limit'; const page=fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8');
  for(const c of ['en','es','pt-BR','fr','de','it','nl','ru','tr','ja','ko','zh-Hans','zh-Hant','th','id','hi']){ const d=JSON.parse(fs.readFileSync(path.join(ROOT,'lang',c+'.json'),'utf8')); assert(typeof d[key]==='string'&&d[key].length>5, c+' has '+key); }
  pass++; console.log('  ok  battle.action_limit is in all 16 language files');
  ok(/const INPUT_LOG_CAP=400;/.test(page)&&/const INPUT_LOG_MAX=400/.test(fs.readFileSync(path.join(ROOT,'server.js'),'utf8')), 'the page cap equals the server cap (400)');
  ok(page.indexOf('"battle.action_limit":"This battle has reached its action limit. Further presses are not counted."')>0, 'the English line is the inline one'); }
console.log('test_action_cap_1443.js: '+pass+' checks passed');
