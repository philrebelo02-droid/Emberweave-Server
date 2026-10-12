'use strict';
// v1048 sound system (Phil 6 Oct 2026: "can we eventually get ember to add audio?" -> "yes to Claude's plan. He builds the sound
// system once, then Ember adds sounds one at a time with his review"; then "I only want 3 different lines for ult per hero, they
// rotate it per fight, other than that it will be spell FX"; v1124: random per ult, Phil 7 Oct). The server's copy of the engine (sim-host) is where the rules must hold
// hardest: no sound code may run there, change a fight, or throw. Also pins the random ult-line pick (v1124) and the spell-sound hooks.
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
  // v1124 (Phil 7 Oct: "3 different UNIQUE ult lines, that randomly go off in combat when ulting"), playback stubbed
  const RND = run(`(()=>{ const log=[], keepPlay=sndPlay, keepCan=sndCan, keep=JSON.stringify(AUDIO_MAP); sndPlay=(k)=>{ log.push(k); return true; }; sndCan=()=>true;
    try{ for(const k in AUDIO_MAP) delete AUDIO_MAP[k]; [1,2,3].forEach(i=>AUDIO_MAP['hero.veyr.ult.'+i]=[{f:'x'}]);
      for(let i=0;i<300;i++) sndUlt({key:'veyr'});
      const seq=log.splice(0); let repeats=0; for(let i=1;i<seq.length;i++) if(seq[i]===seq[i-1]) repeats++;
      const counts={}; seq.forEach(k=>counts[k]=(counts[k]||0)+1); const nx=k=>'hero.veyr.ult.'+(Number(k.slice(-1))%3+1); let cyc=0; for(let i=1;i<seq.length;i++) if(seq[i]===nx(seq[i-1])) cyc++;
      for(const k in AUDIO_MAP) delete AUDIO_MAP[k]; AUDIO_MAP['hero.veyr.ult.1']=[{f:'x'}]; AUDIO_MAP['hero.veyr.ult.3']=[{f:'x'}];
      for(let i=0;i<6;i++) sndUlt({key:'veyr'}); const two=log.splice(0);
      for(const k in AUDIO_MAP) delete AUDIO_MAP[k]; AUDIO_MAP['hero.veyr.ult.2']=[{f:'x'}];
      for(let i=0;i<3;i++) sndUlt({key:'veyr'}); const one=log.splice(0);
      return {n:seq.length, repeats, counts, cyc, two, one}; } finally { sndPlay=keepPlay; sndCan=keepCan; for(const k in AUDIO_MAP) delete AUDIO_MAP[k]; Object.assign(AUDIO_MAP, JSON.parse(keep)); } })()`);
  ck('every ult plays one of the 3 lines at random: all three are used (300 ults)', RND.n === 300 && Object.keys(RND.counts).length === 3 && Object.values(RND.counts).every(c => c > 60), JSON.stringify(RND.counts));
  ck('the pick is random, not a fixed 1-2-3 rotation (a rotation follows the cycle 299 times of 299)', RND.cyc < 250, 'cycle steps ' + RND.cyc);
  ck('the same line never plays twice in a row for a hero', RND.repeats === 0, 'repeats ' + RND.repeats);
  ck('a hero with 2 lines alternates between them; with 1 line it always plays that one',
    RND.two.every((k, i) => i === 0 || k !== RND.two[i - 1]) && RND.two.every(k => /ult\.(1|3)$/.test(k)) && RND.one.every(k => k === 'hero.veyr.ult.2'), JSON.stringify(RND));
  ck('the line pick never draws from the battle generator (_brng) and keeps nothing on the device (the v1048 ew_sound_rot turn is gone)',
    /function _sndRand\(n\)\{ try\{ if\(window\.crypto&&crypto\.getRandomValues\)/.test(src) && !/_sndRand[^;]*_brng\(/.test(src) && !/ew_sound_rot/.test(src));
  ck('no other voice moments are wired (Phil: ult lines only)', !/sndHero\(|hero\.'\+[^;]*\.attack|'hurt'\)|'victory'\)/.test(src));
  ck('spell sounds: a plate or beam plays fx.<key>; a projectile plays fx.<key>.travel at launch and fx.<key>.impact on landing',
    (src.match(/sndPlay\('fx\.'\+key\);   \/\* v1048 spell sound \*\//g) || []).length === 2 && /sndPlay\('fx\.'\+key\+'\.travel'\); \{ const _oh=onHit; onHit=function\(\)\{ sndPlay\('fx\.'\+key\+'\.impact'\);/.test(src));
  ck('the maps start empty and only HERO_VOICES (Phil-approved voices) fills them - no hand-written map rows', /const AUDIO_MAP = \{\};/.test(src) && /const LORE_AUDIO = \{\};/.test(src) && /const HERO_VOICES = \{/.test(src));
  ck('sound plays only after a tap unlocks audio (pointerdown / touchend / keydown)', /\['pointerdown','touchend','keydown'\]\.forEach\(ev=>document\.addEventListener\(ev,sndUnlock/.test(src));
  ck('lore narration: the play button shows only for a hero with a file', /\$\{\(LORE_AUDIO\[key\]&&SND\.cfg\.voice\.on\)\?`<div style="text-align:center;margin:-4px 0 12px"><button class="btn sm" id="loreBtn"/.test(src));
  ck('lore narration streams (an <audio> element, never preloaded) and stops when the player leaves the lore or the screen',
    /const a=new Audio\('\/assets\/audio\/'\+f\); a\.preload='none';/.test(src) && /if\(!\(heroTab==='lore'&&_lore\.key===key\)\) loreStop\(\);/.test(src) && /try\{ if\(name!==state\) loreStop\(\); \}catch\(e\)\{\}/.test(src));
  ck('lore narration code is harmless on the server (loreStop / loreToggle run without a DOM)', run(`(()=>{ try{ loreStop(); loreToggle('veyr',null); return true; }catch(e){ return e.message; } })()`) === true);
  // v1049 (Phil 6 Oct: "an audio section, where there is a scale to reduce volume or turn off - FX, Music, Voices")
  ck('Settings always has the Audio card: FX, Music and Voices, each with on/off and a volume scale',
    /const soundCard = `<div class="panel">/.test(src) && /\$\{_sndRow\('fx','FX'\)\}\$\{_sndRow\('music','Music'\)\}\$\{_sndRow\('voice','Voices'\)\}/.test(src)
    && /id="snd_\$\{ch\}_on"/.test(src) && /type="range" id="snd_\$\{ch\}_vol" min="0" max="100"/.test(src));
  const CH = run(`(()=>{ const keepCan=sndCan, keepCtx=SND.ctx, keepBus=SND.bus, keepCfg=JSON.stringify(SND.cfg), hit=[];
    const gain=n=>({n, gain:{value:1}, connect(t){ hit.push(this.n+'>'+(t&&t.n)); }});
    try{ sndCan=()=>true; SND.ctx={state:'running', createBufferSource:()=>({n:'src', connect(t){ }, start(){} }), createGain:()=>gain('g')};
      SND.bus={fx:gain('fx'), music:gain('music'), voice:gain('voice')}; SND.buf['x']={};
      AUDIO_MAP['hero.veyr.ult.1']=[{f:'x'}]; AUDIO_MAP['fx.toxcone']=[{f:'x'}]; AUDIO_MAP['music.city']=[{f:'x'}];
      const route=['hero.veyr.ult.1','fx.toxcone','music.city'].map(k=>{ hit.length=0; sndPlay(k,0); SND.last={}; return hit.join(); });
      sndSet('fx',{vol:0.25}); const fxGain=SND.bus.fx.gain.value;
      sndSet('voice',{on:false}); const voiceOffGain=SND.bus.voice.gain.value, voiceOff=sndPlay('hero.veyr.ult.1',0), ultOff=sndUlt({key:'veyr'}), fxStill=sndPlay('fx.toxcone',0);
      SND.last={}; sndSet('fx',{on:false}); const fxOff=sndPlay('fx.toxcone',0), musicStill=sndPlay('music.city',0);
      return {route, fxGain, voiceOffGain, voiceOff, ultOff, fxStill, fxOff, musicStill, ch:[sndCh('hero.a.ult.2'),sndCh('fx.a.impact'),sndCh('music.x')]};
    } finally { sndCan=keepCan; SND.ctx=keepCtx; SND.bus=keepBus; Object.assign(SND.cfg, JSON.parse(keepCfg)); delete SND.buf['x']; SND.last={}; for(const k in AUDIO_MAP) delete AUDIO_MAP[k]; } })()`);
  ck('each sound plays through its own channel: ult lines -> Voices, spell sounds -> FX, music.* -> Music',
    JSON.stringify(CH.route) === JSON.stringify(['g>voice','g>fx','g>music']) && JSON.stringify(CH.ch) === JSON.stringify(['voice','fx','music']), JSON.stringify(CH));
  ck('a channel volume sets only that channel', CH.fxGain === 0.25, JSON.stringify(CH));
  ck('Voices off: no ult line plays, its channel is silent - FX still plays', CH.voiceOff === false && CH.ultOff === false && CH.voiceOffGain === 0 && CH.fxStill === true, JSON.stringify(CH));
  ck('FX off: no spell sound plays - Music still plays', CH.fxOff === false && CH.musicStill === true, JSON.stringify(CH));
  ck('Voices off also stops and hides the lore narration', /if\(ch==='voice'\)\{ try\{ if\(_lore\.a\)\{ if\(!SND\.cfg\.voice\.on\) loreStop\(\);/.test(src) && /if\(!f\|\|!SND\.cfg\.voice\.on\) return;/.test(src));
  ck('a v1048 single sound setting carries over to all three channels', /if\(!_c\.fx&&\('on' in _c\|\|'vol' in _c\)\) SND_CH\.forEach/.test(src));
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
