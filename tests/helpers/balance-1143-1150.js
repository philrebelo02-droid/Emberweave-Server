'use strict';
// v1161 re-baseline: the intended GAMEPLAY changes of v1143-v1150, written into an older BASE page's text.
// Several art / sound / weapon tests compare whole fights (or scripted blows) with a BASE release from before these changes. Phil changed
// these numbers on purpose, so those fights move. withChanges(html, ids) gives that BASE the same changes, each copied from its own commit
// (each anchor must be found exactly once, or the change must already be in the file - anything else throws, so a BASE the patch does not fit
// fails loudly and never compares against a half-patched file). What is left between BASE + these changes and the live page is what the test
// is about (the art, the sound, the weapons) - every other difference still fails it.
// Bisected (v1161, every first-parent commit 216c328c..c6c0523e that touched the page): these are the only commits after each test's BASE that
// move the fights those tests run - besides the change each test is about.
const CHANGES = {
  // v1143 0c5e8a29 - Hollow's Vanishing Point 2.0 -> 1.2 x Attack (pre-beta tester report)
  'v1143-hollow-vp': [["vanishpoint:{mul:2.0,exec:0.20,", "vanishpoint:{mul:1.2,exec:0.20,"]],
  // v1144 5121b055 - Hollow drops in 2 s later (3.5 -> 5.5 s) and base attack 40 -> 36 (Phil 15 Oct)
  'v1144-hollow': [
    ["swing:1.7,stars:3,hp:360,dmg:40,range:26,speed:89,", "swing:1.7,stars:3,hp:360,dmg:36,range:26,speed:89,"],
    ["if(key==='hollow'){ u._dropT=3.5; u._dropHidden=true;", "if(key==='hollow'){ u._dropT=5.5; u._dropHidden=true;"],
    ["u._dropT=3.5; u._dropHidden=true; u._dropHome={x:sl.x,y:sl.y};", "u._dropT=5.5; u._dropHidden=true; u._dropHome={x:sl.x,y:sl.y};"]],
  // v1144 5121b055 - Hurne's Feed Them always casts: +10% damage / attack speed / damage reduction for 10 s, +3% per beast devoured (Phil 15 Oct)
  'v1144-hurne': [
    ["const ULT_SUMMON=['devourpack'];", "const ULT_SUMMON=[];"],
    ["if(!pack.length){ floatTexts.push({x:u.x,y:u.y-12,txt:'NOTHING TO FEED ON',t:1.0,color:'#8a7a3a',vy:1,sz:12}); break; }",
     "{ const _fp=(o.feedBase||0.10)+(o.feedPer||0.03)*pack.length, _fd=o.feedDur||10;" +
     " u.dmgBuffMul=Math.max(u.dmgBuffT>0?u.dmgBuffMul:1,1+_fp); u.dmgBuffT=Math.max(u.dmgBuffT||0,_fd);" +
     " u.hasteMul=Math.max(u.hasteT>0?u.hasteMul:1,1+_fp); u.hasteT=Math.max(u.hasteT||0,_fd);" +
     " u.drMul=Math.min(u.drT>0?u.drMul:1,1-_fp); u.drT=Math.max(u.drT||0,_fd);" +
     " floatTexts.push({x:u.x,y:u.y-12,txt:'FED +'+Math.round(_fp*100)+'%',t:1.2,color:'#ff6a6a',vy:1,sz:12}); }" +
     " if(!pack.length){ for(let i=0;i<2;i++)ringBurst(u.x,u.y,0xb03a3a,16); if(u.team==='ally')screenFlash=Math.max(screenFlash,.2); break; }"]],
  // v1150 cf3bf0c4 - a summon takes its owner's fight level, not the device save (the server replay has no save)
  'v1150-summon-level': [["makeUnit(key,owner.team,px,py,heroLevel(owner.key));", "makeUnit(key,owner.team,px,py,owner.lvl||heroLevel(owner.key));"]],
  // v1150 d171d5b6 - Aureth's autos 70% physical / 30% magic, 1.8 s swing, light/dark arms in turn (Phil 15 Oct)
  'v1150-aureth': [
    ["aureth: {name:'Aureth',    emoji:'☯️',role:'Bruiser', swing:2.4,", "aureth: {name:'Aureth',    emoji:'☯️',role:'Bruiser', swing:1.8, autoSplit:{phys:0.7,mag:0.3}, autoAlt:true,"],
    ["u._atkClip=_swCrit?'crit':null; }", "u._atkClip=_swCrit?'crit':null; } if(u.t&&u.t.autoAlt){ u._armN=((u._armN|0)+1); u._atkArm=(u._armN&1)?'attackLight':'attackDark'; if(!_swCrit) u._atkClip=(u.anim&&u.anim[u._atkArm])?u._atkArm:null; }"],
    ["dealDamage(u,t,dmg,u.hybrid?'#ffe6b0':'#fff'); } finally{ _preCrit=null; } },_fly,u._atkSpdMul);", "dealDamage(u,t,dmg,u.hybrid?'#ffe6b0':'#fff',(u.t&&u.t.autoSplit)?'split':undefined); } finally{ _preCrit=null; } },_fly,u._atkSpdMul);"],
    ["  if(kind==='magic'){ amt*=1-defToDR(Math.max(0,_shM-((src&&src.magicPen)||0)),tgt.lvl); }      // MR vs Magic Pen", "  if(kind==='magic'){ amt*=1-defToDR(Math.max(0,_shM-((src&&src.magicPen)||0)),tgt.lvl); } else if(kind==='split'){ const _sp=(src&&src.t&&src.t.autoSplit)||{phys:1,mag:0}; let _ph=amt*_sp.phys*(1-defToDR(Math.max(0,_shA-((src&&src.armorPen)||0)),tgt.lvl)); const _mg=amt*_sp.mag*(1-defToDR(Math.max(0,_shM-((src&&src.magicPen)||0)),tgt.lvl)); if((tgt.blockStat||0)>0&&brnd()<tgt.blockStat){ _ph*=0.5; floatTexts.push({x:tgt.x,y:tgt.y-8,txt:'BLOCK',t:.5,color:'#8fb7ff',vy:1.1,sz:11}); } amt=_ph+_mg; tgt._splitLast={phys:_ph,mag:_mg}; }"]],
};
const BALANCE = ['v1143-hollow-vp', 'v1144-hollow', 'v1144-hurne', 'v1150-summon-level'];   // every hero but Aureth
// already in the file (a BASE after that release) = its marker (a piece of the new text only that release wrote) is there
const MARK = { 'v1143-hollow-vp': 'vanishpoint:{mul:1.2,', 'v1144-hollow': "if(key==='hollow'){ u._dropT=5.5;", 'v1144-hurne': 'o.feedBase||0.10',
  'v1150-summon-level': 'owner.lvl||heroLevel(owner.key)', 'v1150-aureth': "autoSplit:{phys:0.7,mag:0.3}, autoAlt:true" };
function withChanges(html, ids) {
  let h = String(html); const done = [];
  for (const id of ids || BALANCE) { const R = CHANGES[id]; if (!R) throw new Error('balance-1143-1150: no change ' + id);
    const has = h.includes(MARK[id]), fits = R.every(([a]) => h.split(a).length === 2);
    if (has) { done.push(id + ' (already in BASE)'); continue; }
    if (!fits) throw new Error('balance-1143-1150: ' + id + ' does not fit this BASE: ' + R.filter(([a]) => h.split(a).length !== 2).map(([a]) => a.slice(0, 60)).join(' | '));
    for (const [a, b] of R) h = h.replace(a, () => b); done.push(id); }
  withChanges.last = done; return h; }
module.exports = { CHANGES, BALANCE, withChanges };
