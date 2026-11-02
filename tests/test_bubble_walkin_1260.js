// v1260 (Phil 2 Nov 2026, 4 screenshots: "The bubbles are wrong" / "Thats too high" / "Also it should appear above the timer above" /
// "The point of the bubble should be essentially touching the top of his head"; and "Please make it so when heroes and monsters walk in,
// they dont start fighting until everyone is in their start position" / "This should be for all nodes" / "Modes" / "They all meet in the
// middle of the screen and fight. Please dont start the fight until everyone reaches their point"). Runs the page's own wave walk-in
// (updateWaveXfer) in the sim engine through server/sim-host.js, and checks the bubble wiring in the page. Exit 0 = passed.
// Control: BW_HTML=<the v1259 page> FAILS (no stand on the spots, bubble on the overlay under the HUD).
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.join(__dirname, '..'), FILE = process.env.BW_HTML || path.join(ROOT, 'emberweave-heroes.html');
const html = fs.readFileSync(FILE, 'utf8');
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok   ' + m); };
const h = require(path.join(ROOT, 'server/sim-host.js')).load(FILE); const run = s => vm.runInContext(s, h.ctx);
// a wave walk-in: two heroes and two monsters off screen, run the enter phase tick by tick
const r = JSON.parse(run(`(()=>{ CUR={mode:'campaign',node:5}; units=[];
  const mk=(k,team,x,y)=>{ const u=makeUnit(k,team,x,y,10,{}); u.homeX=x; u.homeY=y; u.alive=true; units.push(u); return u; };
  mk('vael','ally',500,800); mk('vireo','ally',380,900); mk('grushak','enemy',900,400); mk('grushak','enemy',1000,330);
  units.forEach(u=>{ const st=u.team==='ally'?heroOffscreenStart(u.homeX,u.homeY):monsterOffscreenStart(u.homeX,u.homeY); u.x=st.x; u.y=st.y; });
  waveXfer={phase:'enter',t:0}; const dt=1/30; let t=0, inAt=null, endAt=null, movedWhileStanding=false, last=null;
  for(let i=0;i<600&&waveXfer;i++){ updateWaveXfer(dt); t+=dt;
    const allHome=units.every(u=>Math.hypot(u.homeX-u.x,u.homeY-u.y)<0.5);
    if(allHome&&inAt==null) inAt=t;
    if(inAt!=null&&last&&units.some((u,j)=>u.x!==last[j][0]||u.y!==last[j][1])) movedWhileStanding=true;
    if(inAt!=null) last=units.map(u=>[u.x,u.y]);
    if(!waveXfer) endAt=t; }
  return JSON.stringify({inAt,endAt,movedWhileStanding,hold:WAVE_READY_HOLD}); })()`));
ok(r.inAt != null && r.inAt < 6, 'everyone reaches their start spot (at ' + (r.inAt || 0).toFixed(2) + ' s)');
ok(r.endAt != null && r.endAt - r.inAt >= r.hold - 0.05, 'the fight starts only after everyone has stood on their spot for ' + r.hold + ' s (' + ((r.endAt || 0) - (r.inAt || 0)).toFixed(2) + ' s)');
ok(!r.movedWhileStanding, 'nobody moves while they stand on their spots');
ok(/\(waveXfer\.phase==='enter'&&waveIdx!==I\.wave\) introWave\(I,vael\)/.test(html), '1-1: a hero who joins at a wave (Sylthaine) joins that wave\'s walk-in, so the wave waits for her too');
ok(/<canvas id="introOv"><\/canvas>/.test(html) && /#introOv\{[^}]*z-index:16/.test(html) && /#battleBanner\{[^}]*z-index:15/.test(html), 'the speech bubble is drawn on its own layer above the wave timer');
ok(/u\._barTop=\{x:_p0\.x, y:_p0\.y/.test(html) && /by=head\.y-hh-10;/.test(html), 'the bubble tail tip sits on the measured top of the head (the point the HP bar is placed from)');
ok(!/hitsO\(bx,by\)\)? *by-=16/.test(html), 'the bubble is never raised above the speaker');
console.log('test_bubble_walkin_1260.js: ' + pass + ' checks passed');
