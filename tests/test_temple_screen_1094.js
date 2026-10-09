// v1094 - the Temple of Ash screen copies the reference prayer screen (Phil 9 Oct: "even ui", our names and pictures):
// one 16:9 stage on ChatGPT's plate; a hero grid ("Purple heroes and above can pray.", % per hero, dots) and a prayer screen
// (the hero's bust in the Temple window, four bars with the pending change shaded green / red with its %, Power +/-N,
// Blessings 1-4 + the 5th dot, the Flame Keeper with level + exp, a tier checklist, Save / Cancel, Auto pray).
// Static checks on the page + the art on disk. Asserts (non-zero exit). Control: AUD_PAGE=<old page> must FAIL.
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'), page=fs.readFileSync(path.join(root,process.env.AUD_PAGE||'emberweave-heroes.html'),'utf8');
let pass=0,missed=[]; const ok=(c,m)=>{ if(process.env.AUD_PAGE&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const fn=page.slice(page.indexOf('function renderTemple(){'),page.indexOf('function startDungeon(){'));
ok(/class="tp2Stage" id="tp2Stage"/.test(fn)&&/plate-v1\.webp/.test(fn),'the screen is one stage on the Temple plate');
ok(/templeView==='grid'/.test(fn)&&/Purple heroes and above can pray\./.test(fn)&&/sort\(\(a,b\)=>b\.s\.pct-a\.s\.pct/.test(fn),'the hero grid: Purple heroes and above, sorted by %');
ok(!/'All'/.test(fn)&&!/templeClassTabs/.test(fn),'no class tabs and no All button');
ok(/heroes\/\$\{key\}-v1\.webp/.test(fn)&&/hero-window-v1\.webp/.test(fn),'the selected hero stands in the Temple window');
ok(/tp2Delta \$\{up\?'up':'down'\}/.test(fn)&&/\.tp2Bar \.tp2Delta\.up\{background:rgba\(70,230,100/.test(page)&&/\.tp2Bar \.tp2Delta\.down\{background:rgba\(240,60,60/.test(page),'the pending change is shaded on the bar: green gain, red loss');
ok(/Math\.round\(1000\*\(to-from\)\/cap\)\/10\)\+'%'/.test(fn),'the bar carries the change as a % of the cap');
ok(/class="tp2Power \$\{power>0\?'up':power<0\?'down':''\}"/.test(fn)&&/\.tp2Bar s\.up,\.tp2Power\.up/.test(page),'Power +N green / -N red');
ok(/Blessings/.test(fn)&&/5th dot: all bonuses/.test(fn)&&/Needs Temple \$\{x\.keeperGate\}/.test(fn),'Blessings 1-4 with their Temple gates, plus the 5th dot');
ok(/Lv\.\$\{level\} Flame Keeper/.test(fn)&&/tp2Exp/.test(fn),'the Flame Keeper with level and exp bar');
ok(/Save or cancel\?/.test(fn)&&/not refunded for cancelling/.test(fn)&&/id="templeSave"/.test(fn)&&/id="templeDiscard"/.test(fn),'Save / Cancel with the no-refund line');
ok(/\/api\/temple\/auto/.test(page)&&/Auto save if power goes up!/.test(page),'Auto pray dialog calls /api/temple/auto');
ok(!/priest|dragon prayer|magic rush/i.test(fn+page.slice(page.indexOf('/* v1094 TEMPLE OF ASH v2 SCREEN'),page.indexOf('/* v1094 TEMPLE OF ASH v2 SCREEN')+400)),'our names only (no reference names)');
const A=path.join(root,'assets/img/temple/v2');
const need=['plate-v1.webp','hero-window-v1.webp','flame-keeper-v1.webp','bar-fill-v1.webp','lock-v1.webp','flare-v1.webp','button-navy-v1.webp','button-red-v1.webp','button-gold-v1.webp',
  'stat-health-v1.webp','stat-attack-v1.webp','stat-armor-v1.webp','stat-penetration-v1.webp','prayer-daily-free-v1.webp','prayer-gold-ritual-v1.webp','prayer-kindled-v1.webp','prayer-stoked-v1.webp','prayer-blazing-v1.webp','prayer-inferno-v1.webp'];
ok(need.every(f=>fs.existsSync(path.join(A,f))),'every Temple art file is on disk ('+need.filter(f=>!fs.existsSync(path.join(A,f))).join(',')+')');
const keys=fs.readdirSync(path.join(root,'assets/img/hero-cards')).map(f=>f.slice(5,-5));
ok(keys.length>=60&&keys.every(k=>fs.existsSync(path.join(A,'heroes',k+'-v1.webp'))),'every hero has a framed bust ('+keys.filter(k=>!fs.existsSync(path.join(A,'heroes',k+'-v1.webp'))).join(',')+')');
if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
console.log('test_temple_screen_1094.js: '+pass+' checks passed, '+missed.length+' failed');
