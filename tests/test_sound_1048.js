'use strict';
// v1048 sound system (Phil 6 Oct 2026: "can we eventually get ember to add audio?" -> "yes to Claude's plan. He builds the sound
// system once, then Ember adds sounds one at a time with his review"; then "I only want 3 different lines for ult per hero, they
// rotate it per fight, other than that it will be spell FX"). The server's copy of the engine (sim-host) is where the rules must hold
// hardest: no sound code may run there, change a fight, or throw. Also pins the ult-line rotation and the spell-sound hooks.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const host = require(path.join(ROOT, 'server/sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
const run = src => vm.runInContext(src, host.ctx);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
try {
  const src = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
  ck('the sound module is in the build (AUDIO_MAP, sndPlay, sndUlt, sndUnlock)', run(`typeof AUDIO_MAP==='object' && typeof sndPlay==='function' && typeof sndUlt==='function' && typeof sndUnlock==='function'`));
  ck('on the server there is no AudioContext: sndCan() is false', run(`sndCan()`) === false);
  // mapped sounds never play (or throw) on the server, and a fight with every hook mapped plays out exactly as one without
  const R = run(`(()=>{ [1,2,3].forEach(i=>AUDIO_MAP['hero.veyr.ult.'+i]=[{f:'voice/veyr_ult_'+i+'.m4a?v=1'}]); AUDIO_MAP['fx.veyr_ult']=[{f:'sfx/veyr_ult_impact.m4a?v=1'}];
    const played=sndPlay('hero.veyr.ult.1',0)||sndUlt({key:'veyr'});
    const fight=()=>{ units=[]; ended=false; paused=false; battleTime=0; seedBattle(424242);   /* the same seed both times - an unseeded fight uses Math.random */
      const v=makeUnit('veyr','ally',300,700,20,{owned:false}), g=makeUnit('grosk','enemy',360,700,20,{owned:false}); units=[v,g];
      for(let i=0;i<Math.round(12/SIM_STEP)&&!ended;i++){ if(i===150) v.energy=100; updateBattle(SIM_STEP); }
      return [Math.round(v.hp), Math.round(g.hp), +battleTime.toFixed(3)]; };
    const withMap=fight(); for(const k in AUDIO_MAP) delete AUDIO_MAP[k]; const without=fight();
    return {played, withMap, without, ctx:SND.ctx}; })()`);
  ck('a mapped sound does not play on the server', R.played === false);
  ck('a fight with the ult lines and a spell sound mapped plays out exactly as one without (sound never touches the battle)', JSON.stringify(R.withMap) === JSON.stringify(R.without), JSON.stringify(R));
  ck('no audio context was ever created on the server', R.ctx === null);
  // the rotation, with playback stubbed (the logic is what is tested; the server never plays)
  const ROT = run(`(()=>{ const log=[], keepPlay=sndPlay, keepCan=sndCan; sndPlay=(k)=>{ log.push(k); return true; }; sndCan=()=>true;
    try{ for(const k in _sndRot) delete _sndRot[k];
      [1,2,3].forEach(i=>AUDIO_MAP['hero.veyr.ult.'+i]=[{f:'x'}]); const out=[];
      for(let f=0;f<5;f++){ const u={key:'veyr'}; units=[u]; sndUlt(u); units=[u].slice(); sndUlt(u); out.push(log.splice(0).join('+')); }   /* a new unit object per fight; the units array rebuilt mid-fight */
      for(const k in AUDIO_MAP) delete AUDIO_MAP[k]; AUDIO_MAP['hero.veyr.ult.1']=[{f:'x'}]; AUDIO_MAP['hero.veyr.ult.3']=[{f:'x'}]; for(const k in _sndRot) delete _sndRot[k];
      const two=[]; for(let f=0;f<3;f++){ const u={key:'veyr'}; units=[u]; sndUlt(u); two.push(log.splice(0)[0]); }
      return {out, two}; } finally { sndPlay=keepPlay; sndCan=keepCan; for(const k in AUDIO_MAP) delete AUDIO_MAP[k]; } })()`);
  ck('ult lines rotate per fight: 1, 2, 3, 1, 2 (the same line twice inside one fight)',
    JSON.stringify(ROT.out) === JSON.stringify(['hero.veyr.ult.1+hero.veyr.ult.1', 'hero.veyr.ult.2+hero.veyr.ult.2', 'hero.veyr.ult.3+hero.veyr.ult.3', 'hero.veyr.ult.1+hero.veyr.ult.1', 'hero.veyr.ult.2+hero.veyr.ult.2']), JSON.stringify(ROT.out));
  ck('a hero with fewer lines rotates through the ones it has', JSON.stringify(ROT.two) === JSON.stringify(['hero.veyr.ult.1', 'hero.veyr.ult.3', 'hero.veyr.ult.1']), JSON.stringify(ROT.two));
  ck('no other voice moments are wired (Phil: ult lines only)', !/sndHero\(|hero\.'\+[^;]*\.attack|'hurt'\)|'victory'\)/.test(src));
  ck('spell sounds: a plate or beam plays fx.<key>; a projectile plays fx.<key>.travel at launch and fx.<key>.impact on landing',
    (src.match(/sndPlay\('fx\.'\+key\);   \/\* v1048 spell sound \*\//g) || []).length === 2 && /sndPlay\('fx\.'\+key\+'\.travel'\); \{ const _oh=onHit; onHit=function\(\)\{ sndPlay\('fx\.'\+key\+'\.impact'\);/.test(src));
  ck('the shipped map is empty - nothing plays until Phil approves a sound', /const AUDIO_MAP = \{\};/.test(src));
  ck('sound plays only after a tap unlocks audio (pointerdown / touchend / keydown)', /\['pointerdown','touchend','keydown'\]\.forEach\(ev=>document\.addEventListener\(ev,sndUnlock/.test(src));
  ck('lore narration: LORE_AUDIO ships empty; the play button shows only for a hero with a file', /const LORE_AUDIO = \{\};/.test(src) && /\$\{LORE_AUDIO\[key\]\?`<div style="text-align:center;margin:-4px 0 12px"><button class="btn sm" id="loreBtn"/.test(src));
  ck('lore narration streams (an <audio> element, never preloaded) and stops when the player leaves the lore or the screen',
    /const a=new Audio\('\/assets\/audio\/'\+f\); a\.preload='none';/.test(src) && /if\(!\(heroTab==='lore'&&_lore\.key===key\)\) loreStop\(\);/.test(src) && /try\{ if\(name!==state\) loreStop\(\); \}catch\(e\)\{\}/.test(src));
  ck('lore narration code is harmless on the server (loreStop / loreToggle run without a DOM)', run(`(()=>{ try{ loreStop(); loreToggle('veyr',null); return true; }catch(e){ return e.message; } })()`) === true);
  ck('the Sound settings card shows only once the game has a sound', /const soundCard = Object\.keys\(AUDIO_MAP\)\.length \?/.test(src));
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
