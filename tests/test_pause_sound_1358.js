// v1358 (Phil 10 Nov 2026: "just remove the mute button from the game" / "instead add sound settings to every pause menu in game modes").
// The floating mute button is gone on every screen; the battle pause menu and the Swarm Spire pause carry the game's sound panel
// (Mute all + FX / Music / Voices), wired to the same functions as Settings. CONTROL: v1356 (git show 08826a7d).
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8'), sp = fs.readFileSync(path.join(ROOT, 'survivors-dev.html'), 'utf8');
const old = cp.execSync('git show 08826a7d:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString(), osp = cp.execSync('git show 08826a7d:survivors-dev.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
ck('the mute button is never made (MUTE_BTN_OFF)', /const MUTE_BTN_OFF=true;/.test(html) && /function muteBtnMake\(\)\{ try\{ if\(MUTE_BTN_OFF\) return;/.test(html));
ck('a button left from an older page is removed', /if\(MUTE_BTN_OFF\)\{ const ob=document\.getElementById\('muteBtn'\); if\(ob\) ob\.remove\(\); return; \}/.test(html));
ck('CONTROL v1356: the button was made', !/MUTE_BTN_OFF/.test(old));
ck('no World-map rule pins a mute button any more', !/body:has\(#world\.active\) #muteBtn\{/.test(html) && /body:has\(#world\.active\) #muteBtn\{/.test(old));
// the panel: run the real sndPanelHTML / sndPanelWire against a small DOM stand-in
const a = html.indexOf('function sndPanelHTML(p){'), b = html.indexOf('function renderSettings(){', a);
ck('sndPanelHTML / sndPanelWire / pauseSndRender exist', a > 0 && b > a && /function pauseSndRender\(\)/.test(html.slice(a, b)));
const calls = []; const SND = { cfg: { fx: { on: true, vol: 0.8 }, music: { on: false, vol: 0.6 }, voice: { on: true, vol: 0.9 } } };
const ctx = { SND, SND_MUTE: { on: true }, SND_CH: ['fx', 'music', 'voice'], uiIcon: () => '', t: k => k, sndMuteSet: v => calls.push('mute:' + v), sndSet: (ch, o) => calls.push(ch + ':' + JSON.stringify(o)), sndUnlock: () => calls.push('unlock'), document: { getElementById: () => null }, Math };
vm.runInNewContext(html.slice(a, b) + '\nthis.H=sndPanelHTML;this.W=sndPanelWire;', ctx);
const h = ctx.H('psnd');
ck('the panel has Mute all + three channels, each with a switch, a slider and a %', ['psnd_mute', 'psnd_fx_on', 'psnd_fx_vol', 'psnd_fx_pct', 'psnd_music_on', 'psnd_music_vol', 'psnd_voice_on', 'psnd_voice_vol'].every(id => h.includes('id="' + id + '"')));
ck('it shows the saved state (muted checked, Music off + its slider disabled, FX 80%)', /id="psnd_mute" checked/.test(h) && /id="psnd_music_on" >/.test(h.replace(/\s+>/g, ' >')) && /id="psnd_music_vol"[^>]*disabled/.test(h) && />80%</.test(h));
const els = {}; const root = { querySelector: s => (els[s] = els[s] || { checked: false, value: '0', disabled: false, textContent: '' }) };
ctx.W(root, 'psnd');
els['#psnd_mute'].checked = false; els['#psnd_mute'].onchange();
els['#psnd_music_on'].checked = true; els['#psnd_music_on'].onchange();
els['#psnd_fx_vol'].value = '30'; els['#psnd_fx_vol'].oninput();
ck('the controls call the game\'s own sound functions', calls.join('|') === 'mute:false|unlock|music:{"on":true}|unlock|fx:{"vol":0.3}', calls);
ck('the slider enables with its channel and the % follows', els['#psnd_music_vol'].disabled === false && els['#psnd_fx_pct'].textContent === '30%');
// where it shows
ck('the battle pause menu holds the panel', /<div id="pauseSnd" class="set-sec"/.test(html) && html.indexOf('id="pauseSnd"') > html.indexOf('id="pauseModal"') && html.indexOf('id="pauseSnd"') < html.indexOf('id="hud"'));
ck('opening the pause draws it (the button and the auto-pause)', /pauseBtn'\)\.onclick=\(\)=>\{ paused=true; pauseSndRender\(\);/.test(html) && /paused=true; try\{ pauseSndRender\(\); \}catch\(e\)\{\} document\.getElementById\('pauseModal'\)\.classList\.add\('active'\); try\{ streamStall/.test(html));
ck('the pause panel stays inside the game frame; two columns on a short screen', /#pauseModal \.pm\{max-height:calc\(var\(--ew-game-height,100vh\) - 14px\);overflow:auto/.test(html) && /@media \(max-height:560px\)\{#pauseModal \.pm\{display:grid/.test(html));
ck('the Swarm Spire pause holds the panel, drawn by the hosting page', /<div id="pzSnd" class="pzSnd"><\/div>/.test(sp) && /G0\.sndPanelHTML\('zsnd'\); G0\.sndPanelWire\(h, 'zsnd'\)/.test(sp));
ck('CONTROL v1356: neither pause menu had sound settings', !/pauseSnd/.test(old) && !/pzSnd/.test(osp));
ck('Settings keeps its own sound card', /id="snd_mute"/.test(html) && /_sndRow\('fx'/.test(html));
console.log('test_pause_sound_1358.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
