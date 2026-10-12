'use strict';
// v1124 hero voices - the first one in the game is Vael (Phil 11 Oct 2026: "vael is perfect, put it in game"). Pins:
//  - HERO_VOICES is the one place a hero voice is declared; it fills AUDIO_MAP (ult lines) and LORE_AUDIO (lore read)
//  - v1127 (Phil 11 Oct: "i dont like the ult voices anymore stop them"): ult voice lines are OFF for every hero - nothing mapped,
//    primed, fetched or played in a fight; Vael keeps only his lore read; vael_ult_1..3.m4a stay on disk, unreferenced
//  - every file exists, is AAC .m4a with a ?v=, and holds the bytes Phil approved
//    (sha256 of the takes the round 6 review page "Hero Voices - Vael.html" plays by default)
//  - every file under assets/audio/ is referenced (no orphans) and no voice file is in the startup download
//  - the server answers .m4a as audio/mp4 with Range (the lore streams through an <audio> element)
//  - a fight with Vael's lines mapped plays out exactly as one without (sound never moves game logic)
// Usage: node tests/test_hero_voices_1124.js [path/to/emberweave-heroes.html]  (a path lets a control run against an older build)
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const HTML = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'emberweave-heroes.html');
const host = require(path.join(ROOT, 'server/sim-host.js')).load(HTML);
const run = src => vm.runInContext(src, host.ctx);
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
// The approved takes (Archive: Game Art/Hero Voices/round 6 11OCT2026 - five new heroes/takes/vael/approved/): page default picks.
const APPROVED = {
  'voice/vael_ult_1.m4a': '22b71cc906bb85a090b44a96d91e2b784256d87d70491b69c2332e694b05dc0d',        // vael_ult1_64k.m4a "Here! I hold here!"
  'voice/vael_ult_2.m4a': '4ddae7c086fe1ccad44fa1d161933ce26ef8cefe3d1c01fe2012213959020e93',        // vael_ult2_64k.m4a "Cut me! It only makes me stronger!"
  'voice/vael_ult_3.m4a': '3f1fd2fc2f7f856ee8b7bd8019c1bedb1f9ec8ff8bdad964d505df220c8522d0',        // vael_ult3_64k.m4a "Last Stand! Come and break me!"
  'voice/lore/vael_lore.m4a': 'e57629b86583c7495ece15f7e178f188cab7928c9354e01ad71b9c4f6c6a71a7',    // v1133 Vael v9: vael_lore_with_ending_paceB_48k.m4a built 12 Oct 12:58 (205.8 s; Carn + Aureth on the wall, 'not sated', five-ten..five-twelve). v1124 bytes were b9d217f2... at ?v=1
};
try {
  const src = fs.readFileSync(HTML, 'utf8');
  const M = run(`(()=>{ try{ return {hv:JSON.parse(JSON.stringify(HERO_VOICES)), a:JSON.parse(JSON.stringify(AUDIO_MAP)), l:JSON.parse(JSON.stringify(LORE_AUDIO))}; }catch(e){ return {err:e.message}; } })()`);
  ck('HERO_VOICES exists and declares Vael: no ult lines (v1127) and his lore read', !M.err && M.hv.vael && Array.isArray(M.hv.vael.ult) && M.hv.vael.ult.length === 0 && M.hv.vael.lore > 0, JSON.stringify(M));
  if (M.err) throw new Error('no HERO_VOICES: ' + M.err);
  const wantUlt = Object.keys(M.hv).flatMap(k => M.hv[k].ult.map((v, i) => 'hero.' + k + '.ult.' + (i + 1))).sort();
  ck('AUDIO_MAP voice keys are exactly the HERO_VOICES ult lines', JSON.stringify(Object.keys(M.a).filter(k => /^hero\./.test(k)).sort()) === JSON.stringify(wantUlt), JSON.stringify(Object.keys(M.a)));
  ck('v1127: ult voice lines are switched off for every hero (HERO_ULT_VOICES false) and no hero voice key is in AUDIO_MAP',
    run('HERO_ULT_VOICES') === false && Object.keys(M.a).filter(k => /^hero\./.test(k)).length === 0, JSON.stringify(Object.keys(M.a)));
  ck('LORE_AUDIO is exactly the heroes with a lore read (Vael)', JSON.stringify(Object.keys(M.l).sort()) === JSON.stringify(Object.keys(M.hv).filter(k => M.hv[k].lore).sort()) && M.l.vael === 'voice/lore/vael_lore.m4a?v=' + M.hv.vael.lore, JSON.stringify(M.l));
  const refs = Object.values(M.a).flat().map(l => l.f).concat(Object.values(M.l));
  ck('every mapped file is AAC .m4a under assets/audio/ with a numeric ?v=', refs.every(f => /^voice\/(lore\/)?[a-z0-9_]+\.m4a\?v=\d+$/.test(f)), refs.join(', '));
  const missing = refs.filter(f => !fs.existsSync(path.join(ROOT, 'assets/audio', f.split('?')[0])));
  ck('every mapped file exists', missing.length === 0, 'missing: ' + missing.join(', '));
  const vaelRefs = refs.filter(f => /(^|\/)vael_/.test(f)).map(f => f.split('?')[0]).sort();
  ck('Vael references exactly 1 voice file - the lore read (no ult line)', JSON.stringify(vaelRefs) === JSON.stringify(['voice/lore/vael_lore.m4a']), JSON.stringify(vaelRefs));
  const bad = Object.entries(APPROVED).filter(([f, h]) => { try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'assets/audio', f))).digest('hex') !== h; } catch (e) { return true; } });
  ck('each Vael file holds exactly the take Phil approved (sha256 of the review page default)', bad.length === 0, bad.map(b => b[0]).join(', '));
  const isM4A = f => { try { const b = fs.readFileSync(path.join(ROOT, 'assets/audio', f)); return b.slice(4, 8).toString() === 'ftyp' && /^M4A/.test(b.slice(8, 12).toString()); } catch (e) { return false; } };
  ck('each file is an MPEG-4 audio container (ftyp M4A)', Object.keys(APPROVED).every(isM4A));
  const size = f => { try { return fs.statSync(path.join(ROOT, 'assets/audio', f)).size; } catch (e) { return -1; } };
  ck('sizes stay compressed: each ult line under 48 KB, the lore read under 1.5 MB',
    [1, 2, 3].every(i => size('voice/vael_ult_' + i + '.m4a') > 4000 && size('voice/vael_ult_' + i + '.m4a') < 48 * 1024) && size('voice/lore/vael_lore.m4a') > 200000 && size('voice/lore/vael_lore.m4a') < 1.5 * 1024 * 1024,
    Object.keys(APPROVED).map(f => f + '=' + size(f)).join(', '));
  // no orphans: every file in assets/audio is referenced by the maps
  const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
  const onDisk = walk(path.join(ROOT, 'assets/audio')).map(p => path.relative(path.join(ROOT, 'assets/audio'), p).split(path.sep).join('/')).sort();
  const refd = new Set(refs.map(f => f.split('?')[0]));
  const RETIRED = ['voice/vael_ult_1.m4a', 'voice/vael_ult_2.m4a', 'voice/vael_ult_3.m4a'];   // v1127: kept on disk, unreferenced (Phil: "stop them")
  ck('every file under assets/audio/ is referenced, except the three retired Vael ult lines kept on disk (no other orphans, no work WAVs)',
    onDisk.length > 0 && onDisk.every(f => (refd.has(f) || RETIRED.includes(f)) && /\.m4a$/.test(f)) && RETIRED.every(f => onDisk.includes(f) && !refd.has(f)), JSON.stringify(onDisk));
  // never in the startup download
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ck('no audio in the service worker shell or preloaded by the page', !/audio\//.test((sw.match(/const SHELL = \[[^\]]*\]/) || [''])[0]) && !/<link[^>]+(m4a|audio\/)/.test(src) && !/<audio[^>]*(src|preload)=/.test(src));
  ck('the first tap fetches spell sounds only - voice lines wait for their hero to take the field (sndPrimeHero from makeUnit)',
    /for\(const k in AUDIO_MAP\) if\(!\/\^hero\\\.\/\.test\(k\)\) \(AUDIO_MAP\[k\]\|\|\[\]\)\.forEach\(l=>sndLoad\(l\.f\)\);/.test(src) && /if\(HERO_TYPES\[key\]\) sndPrimeHero\(key\);/.test(src));
  ck('the service worker lets Range requests (the streamed lore) go to the network', /if \(isOwnAsset && req\.headers\.has\('range'\)\) return;/.test(sw));
  const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  ck('the server answers .m4a as audio/mp4, with Range support like video', /'\.m4a':'audio\/mp4'/.test(srv) && /if\(type\.startsWith\('video\/'\)\|\|type\.startsWith\('audio\/'\)\) return fs\.readFile/.test(srv));
  // the lore button: a real control (icon art, no emoji), tap while playing stops, closing a pop-out stops it
  ck('lore button: a tap while the story plays stops it; closing a pop-out panel stops it',
    /if\(_lore\.a&&_lore\.key===key&&!_lore\.a\.ended&&!_lore\.a\.paused\)\{ loreStop\(\); loreBtnSync\(btn\); return; \}/.test(src) && /function closePopout\(\)\{ try\{ loreStop\(\); \}catch\(e\)\{\}/.test(src));
  ck('lore button is icon art with a label (uiIcon play / pause, aria-label), never an emoji',
    /btn\.innerHTML=on\?uiIcon\('pause'\):uiIcon\('play'\); btn\.setAttribute\('aria-label',on\?'Stop the story':'Play the story'\);/.test(src));
  // v1124 (Phil 11 Oct: "make sure the lore is re-written to match the new lore"): the screen lore is the third-person telling of the
  // narration, beat for beat (Archive vael_screen_lore_v7.txt; v1133: vael_screen_lore_v9.txt, Phil 12 Oct); both HERO_LORE copies in the page carry it, and the live one shows it
  const LO = run(`(()=>{ const L=HERO_LORE.vael||{}; return {title:L.title, text:L.text}; })()`);
  const loreCopies = (src.match(/\n  vael:\{title:(['"])After Ashford\1,\s?text:"((?:[^"\\]|\\.)*)"\}/g) || []).map(x => x.replace(/^[\s\S]*?text:"/, '').slice(0, -2));
  const paras = String(LO.text || '').split('\n\n');
  ck('Vael screen lore: "After Ashford", 5 paragraphs, opens at the fire and ends with the sword counting', LO.title === 'After Ashford' && paras.length === 5
    && /^They still tell it at every fire in the valley\. It was cold that morning/.test(paras[0]) && /five hundred and ten, five hundred and eleven, five hundred and twelve\. One day he will let it finish\.$/.test(paras[4]), JSON.stringify(LO).slice(0, 200));
  ck('v1133 Vael v9: Carn and Aureth hold the city wall behind him, not sated at the hundredth man, and the text is exactly vael_screen_lore_v9.txt (sha256)', /Behind him, Carn and Aureth dragged the gates shut and held the city wall/.test(paras[0]) && /thin the horde before it ever reached that wall\./.test(paras[0])
    && crypto.createHash('sha256').update(String(LO.text || '')).digest('hex') === 'c76967eea7805e24bd29f9e47d221e1b38c8c18d32b5c9aba4d2c93ad775ad18', crypto.createHash('sha256').update(String(LO.text || '')).digest('hex'));
  ck('v1133: the lore read is the v9 file at a new version (?v=2 - the v1124 bytes shipped as ?v=1)', M.l.vael === 'voice/lore/vael_lore.m4a?v=2', M.l.vael);
  ck('the screen lore stays third person (about Vael, never I/me/my outside his quoted thoughts)', !/\b(I|me|my)\b/.test(LO.text || '') && /\bVael\b/.test(LO.text || ''));
  ck('both HERO_LORE copies of Vael carry the same new text (no stale second copy)', loreCopies.length === 2 && loreCopies[0] === loreCopies[1] && loreCopies[0] === JSON.stringify(LO.text || '').slice(1, -1),'copies ' + loreCopies.length);
  // on the server: makeUnit primes nothing, and a fight with Vael's real lines mapped plays out exactly as one without
  const R = run(`(()=>{ const keep=JSON.stringify(AUDIO_MAP);
    const fight=()=>{ units=[]; ended=false; paused=false; battleTime=0; seedBattle(777001);
      const v=makeUnit('vael','ally',300,700,30,{owned:false}), g=makeUnit('grosk','enemy',360,700,30,{owned:false}); units=[v,g];
      let ults=0; const keepUlt=castAbility; castAbility=function(u){ if(u&&u.key==='vael') ults++; return keepUlt.apply(this,arguments); };   /* counts the ult casts (v1127: sndUlt is no longer called) */
      const keepAuto=autoUlt; autoUlt=true;   /* AUTO on: an ally ult fires by itself */
      try{ for(let i=0;i<Math.round(14/SIM_STEP)&&!ended;i++){ if(i===150||i===600) v.energy=100; updateBattle(SIM_STEP); } } finally { castAbility=keepUlt; autoUlt=keepAuto; }
      return [Math.round(v.hp), Math.round(g.hp), +battleTime.toFixed(3), ults]; };
    const withMap=fight(); const pend=Object.keys(SND.pend).length, ctx=SND.ctx;
    for(const k in AUDIO_MAP) delete AUDIO_MAP[k]; const without=fight(); Object.assign(AUDIO_MAP, JSON.parse(keep));
    return {withMap, without, pend, ctx}; })()`);
  ck('on the server nothing is fetched or decoded (no AudioContext, no pending loads)', R.ctx === null && R.pend === 0, JSON.stringify(R));
  ck('a fight where Vael ults plays out exactly as one with the sound map emptied', JSON.stringify(R.withMap) === JSON.stringify(R.without) && R.withMap[3] >= 1, JSON.stringify(R));
  // v1127: the same fight as a CLIENT would run it - audio unlocked (a running AudioContext), Voices on, every fetch and play logged
  const C = run(`(()=>{ const got=[], plays=[]; const kf=fetch, kp=sndPlay, kA=window.AudioContext, kAu=Audio, kctx=SND.ctx;
    fetch=function(u){ got.push(String(u)); return Promise.resolve({ok:true,arrayBuffer:()=>Promise.resolve(new ArrayBuffer(8))}); };
    sndPlay=function(k){ plays.push(k); return kp.apply(this,arguments); };
    window.AudioContext=function(){}; SND.ctx={state:'running',decodeAudioData:(a,res)=>res({}),createBufferSource:()=>({connect(){},start(){}}),createGain:()=>({gain:{value:1},connect(){}})}; SND.cfg.voice.on=true;
    const auds=[]; Audio=function(src){ auds.push(String(src)); this.src=src; this.paused=true; this.play=()=>{ this.paused=false; return Promise.resolve(); }; this.pause=()=>{ this.paused=true; }; this.removeAttribute=()=>{}; this.load=()=>{}; };
    let ults=0; try{ units=[]; ended=false; paused=false; battleTime=0; seedBattle(777001);
      const v=makeUnit('vael','ally',300,700,30,{owned:false}), g=makeUnit('grosk','enemy',360,700,30,{owned:false}); units=[v,g];
      const kc=castAbility; castAbility=function(u){ if(u&&u.key==='vael') ults++; return kc.apply(this,arguments); };
      const ka=autoUlt; autoUlt=true;
      try{ for(let i=0;i<Math.round(14/SIM_STEP)&&!ended;i++){ if(i===150||i===600) v.energy=100; updateBattle(SIM_STEP); } } finally{ castAbility=kc; autoUlt=ka; }
      const fightGot=got.splice(0), fightPlays=plays.splice(0);
      /* CONTROL: the instrument sees a voice play when one IS mapped - the dormant sndUlt with a test key plays and fetches */
      AUDIO_MAP['hero.vael.ult.1']=[{f:'voice/vael_ult_1.m4a?v=1',vol:1}]; const ctl=sndUlt(v); delete AUDIO_MAP['hero.vael.ult.1'];
      const ctlGot=got.splice(0), ctlPlays=plays.splice(0);
      const btn={setAttribute(){},innerHTML:''}; loreToggle('vael',btn); const lore=auds.slice(), loreOn=!!(_lore.a&&!_lore.a.paused); loreStop();
      return JSON.stringify({ults, fightGot, fightPlays, ctl, ctlGot, ctlPlays, lore, loreOn}); }
    finally{ fetch=kf; sndPlay=kp; window.AudioContext=kA; Audio=kAu; SND.ctx=kctx; SND.pend={}; SND.buf={}; } })()`);
  const CJ = JSON.parse(C);
  ck('v1127: Vael ults in a client fight (audio unlocked, Voices on) and no ult audio is requested, fetched or played - no voice file at all',
    CJ.ults >= 1 && !CJ.fightGot.some(u => /voice\//.test(u)) && !CJ.fightPlays.some(k => /^hero\./.test(k)), C);
  ck('CONTROL: the same instrument catches a voice line when one is mapped (dormant sndUlt plays and fetches it)', CJ.ctl === true && CJ.ctlPlays.includes('hero.vael.ult.1') && CJ.ctlGot.some(u => /voice\/vael_ult_1\.m4a/.test(u)), C);
  ck('the lore narration still plays: the lore button streams /assets/audio/voice/lore/vael_lore.m4a', CJ.loreOn && CJ.lore.length === 1 && CJ.lore[0] === '/assets/audio/' + M.l.vael, C);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
