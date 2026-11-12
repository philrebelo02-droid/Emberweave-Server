// v1265 LANGUAGES step 1 (Phil 3 Nov 2026: "One very very big thing we missed - Languages"; plan: Archive Open Projects/LANGUAGES -
// LOCALIZATION PLAN). Static + runtime checks of the language system in emberweave-heroes.html and lang/<code>.json:
//  1. every key in lang/en.json exists (non-empty, same {vars}) in all 15 other files - DELIBERATE_FALLBACK lists any key a language
//     is meant to leave to English (none today) - and a file has no key English lacks;
//  2. the page's inline English equals lang/en.json and each ?v= is the hash of that file's text (a changed file is a new URL);
//  3. every t('key') / data-i18n="key" in the page exists in English, and the strings converted in this batch are no longer hard-coded;
//  4. no function that calls t() declares its own local `t` (it would shadow the global and throw);
//  5. the module itself, run in a sandbox: auto-pick from navigator.languages, only the chosen file is fetched, English fallback,
//     a missing key never prints raw, the pick persists (device + save G.lang), the cloud save's pick wins, hub labels shrink, never cut.
// CONTROL: the key check is fed a copy of es.json with one key removed and must fail. Asserts, exits non-zero.
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8');
const CODES=['en','es','pt-BR','fr','de','it','nl','ru','tr','ja','ko','zh-Hans','zh-Hant','th','id','hi'];
const DELIBERATE_FALLBACK={};   // code -> [keys that are meant to show English]; empty in step 1
let pass=0;const ok=(c,m)=>{assert(c,m);pass++;};
const raw={},dict={};
for(const c of CODES){ const f=path.join(ROOT,'lang',c+'.json'); ok(fs.existsSync(f),'lang/'+c+'.json exists');
  raw[c]=fs.readFileSync(f,'utf8'); dict[c]=JSON.parse(raw[c]); }
const EN=dict.en, KEYS=Object.keys(EN);
ok(KEYS.length>=100,'step 1 has at least 100 keys ('+KEYS.length+')');
const vars=s=>(String(s).match(/\{\w+\}/g)||[]).sort().join(',');

// ---- 1. key coverage (the checker is a function so the control can run it on a broken copy) ----
function keyProblems(code,d){ const out=[], skip=new Set(DELIBERATE_FALLBACK[code]||[]);
  for(const k of KEYS){ if(skip.has(k)) continue;
    if(typeof d[k]!=='string'||!d[k].trim()) out.push(code+': missing '+k);
    else if(vars(d[k])!==vars(EN[k])) out.push(code+': '+k+' placeholders '+vars(d[k])+' vs '+vars(EN[k]));
    else if(/[<>"]/.test(d[k])) out.push(code+': '+k+' has < > or " (the text goes into HTML and attributes)'); }
  for(const k of Object.keys(d)) if(!(k in EN)) out.push(code+': extra key '+k);
  return out; }
for(const c of CODES){ const p=keyProblems(c,dict[c]); ok(p.length===0,'lang/'+c+'.json covers every English key: '+p.slice(0,5).join('; ')); }
{ // CONTROL: one key gone -> the check must fail and name it
  const broken=Object.assign({},dict.es); delete broken['set.language'];
  const p=keyProblems('es',broken); ok(p.length===1&&/missing set\.language/.test(p[0]),'CONTROL: a deliberately missing key is caught ('+p.join('; ')+')'); }
const SAME_OK=JSON.parse(fs.readFileSync(path.join(ROOT,'tools','lang','same_ok.json'),'utf8'));   // v1271: cells reviewed as the same word in that language (cognates, loanwords, abbreviations)
for(const c of CODES.slice(1)){ const same=KEYS.filter(k=>!(SAME_OK[c]||[]).includes(k)&&dict[c][k]===EN[k]&&/[a-z]{3}/.test(EN[k])&&!/^(OK|Arena|Audio|Menu|Server|Bug|Start|Reset|Guild|Gratis|Base|Temple|Forge|Glossary)$/.test(EN[k]));
  ok(same.length<=8,'lang/'+c+'.json is a translation, not English copied across ('+same.length+' identical: '+same.slice(0,8).join(', ')+')'); }

// ---- 2. inline English + versions ----
const modM=html.match(/\n(\/\* v1265 LANGUAGES step 1 \(Phil[\s\S]*?\/\* \/v1265 LANGUAGES step 1 \*\/)/); ok(modM,'the language module is in the page');
{ // it lives in the game's own script block: the server's sim host (server/sim-host.js) loads only that block, and the page's
  // code calls t() - a separate <script> left the replay host with "t is not defined"
  const blk=html.slice(html.lastIndexOf('\n<script>',modM.index),html.indexOf('\n</script>',modM.index));
  ok(/function simFightResult\s*\(/.test(blk),'the language module is inside the block that defines simFightResult'); }
const MOD=modM[1];
const inlineEn=JSON.parse(MOD.match(/const EW_LANG_EN=(\{.*?\});\r?\n/)[1]);
ok(JSON.stringify(inlineEn)===JSON.stringify(EN),'the page\'s inline English equals lang/en.json');
const V=JSON.parse(MOD.match(/const EW_LANG_V=(\{.*?\});\r?\n/)[1]);
ok(JSON.stringify(Object.keys(V).sort())===JSON.stringify(CODES.slice().sort()),'EW_LANG_V lists exactly the 16 languages');
for(const c of CODES){ const h=crypto.createHash('sha1').update(raw[c]).digest('hex').slice(0,8);
  ok(V[c]===h,'lang/'+c+'.json ?v= is the hash of its text ('+V[c]+' vs '+h+') - regenerate EW_LANG_V when a file changes'); }
for(const c of CODES) ok(!/\n/.test(raw[c]),'lang/'+c+'.json is one line (line endings never change its hash)');
ok(/if\(\/\^\\\/lang\\\/\[a-z\]\{2\}/.test(fs.readFileSync(path.join(ROOT,'server.js'),'utf8')),'server.js serves /lang/<code>.json');
ok(/url\.pathname\.startsWith\('\/lang\/'\)/.test(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8')),'sw.js caches a versioned /lang/ file like art');

// ---- 3. keys used by the page exist; converted strings are gone ----
const used=new Set([...html.matchAll(/(?<![\w$.])t\('([a-z]+\.[a-z_]+)'/g)].map(m=>m[1]).concat([...html.matchAll(/data-i18n="([^"]+)"/g)].map(m=>m[1]))
  .concat(['bld.campaign','nav.vault','bld.arena','nav.wall','menu.heroes','common.back','set.lang_auto']));
for(const k of used) ok(k in EN,'the page uses '+k+' and English has it');
ok(used.size>=90,'the page uses '+used.size+' keys');
const GONE=[   // [pattern, what] - each must appear 0 times now
  [/<span class="ml">/,'a hub menu label without data-i18n'],[/<span>Menu<\/span><span class="chev">/,'the Menu button'],
  [/>◀ (Base|Menu|Arena|Guild|Heroes)<\/button>/,'a back button'],[/z-index:22">World </,'the World button'],[/alt=""> Glossary<\/button>/,'a Glossary button'],
  [/label:'(City Wall|Market|Shady Market|Temple|Campaign|Academy|Bulletin Board|The Vault|Wishing Pool|Arena|Watch Tower|Guild Hall|Island of Trials|Witches Hut|Forge|The Starless Well)',/,'a town building name'],
  [/Unlocks at Lv '\+/,'the town lock tip'],[/'Research: '\+/,'the research tip'],
  [/<h1>(TECHNOLOGY|CITY WALL|ACCOUNT|ARENA|ARENA SHOP|THE FORGE|ELITE STAGES|GUILD HALL|TEMPLE|MARKET|SHADY MARKET|WATCH TOWER|BULLETIN BOARD|ONLINE ARENA|HEROES|BAG|SETTINGS|QUESTS|DAILY SIGN-IN|START HERE|ISLAND OF TRIALS|MAIL|WISHING POOL)\b/,'a screen title'],
  [/>BATTLE <img/,'the BATTLE button'],[/↺ RESET</,'the RESET button'],[/'◀ Campaign'/,'the team-select back label'],
  [/\(okLabel\|\|'OK'\)/,'the confirm OK'],[/id="uiCfNo" style="flex:1">Cancel</,'the confirm Cancel'],[/\?'Claim':'(Claimed|In progress)'/,'a Quests claim button'],[/chReady\?'Claim'/,'the quest-chain claim'],
  [/id="kickedOk">OK</,'the logged-out OK'],[/id="(spClose|ciClose)">Close</,'a map popup Close'],
  [/Cloud Account<\/div>/,'Settings: Cloud Account'],[/<div style="font-size:13px">Signed in as <b>/,'Settings: Signed in as'],[/your progress syncs to any device/,'Settings: sync note'],
  [/id="acLogout">Log out</,'Settings: Log out'],[/>Blocked players</,'Settings: Blocked players'],[/ff6b6b66">Delete account</,'Settings: Delete account'],
  [/id="acTab(In|New)" style="flex:1">(Sign In|Create Account)</,'Settings: sign-in tabs'],[/'Pick a username &amp; password/,'Settings: create hint'],
  [/id="acUser" type="text" placeholder="Username"/,'Settings: username'],[/id="acPass" type="password" placeholder="Password" autocomplete="off" style="\$\{inp\}"/,'Settings: password'],
  [/text-decoration:none">Forgot your password\?</,'Settings: forgot'],[/\} Recovery email: <b|> No recovery email linked|margin-left:4px">change<|"color:#9ab0d6">add email</,'Settings: recovery email row'],
  [/Reset password by email\$\{em\?'':' \(add an email first\)'\}/,'Settings: reset by email'],[/\} Audio<\/div>/,'Settings: Audio'],[/> Mute all<\/label>/,'Settings: Mute all'],[/_sndRow\('fx','FX'\)/,'Settings: FX/Music/Voices'],
  [/Offline Art<\/div>/,'Settings: Offline Art'],[/>Download every hero, monster and boss animation/,'Settings: Offline Art text'],[/>Update all features</,'Settings: Update all features'],
  [/min-width:110px">Clear cache</,'Settings: Clear cache'],[/'Stop download':'Update all features'/,'Settings: download label'],[/Report a bug \/ feedback</,'Settings: report title'],
  [/>Spotted something broken/,'Settings: report text'],[/placeholder="Describe the bug or suggestion/,'Settings: report placeholder'],[/>Send report</,'Settings: Send report'],
  [/'Please add a little detail\.'|'Thanks! Report sent\.'|'Failed to send\.'/,'Settings: report messages'],[/>Terms of Service &amp; Privacy</,'Settings: terms link'],[/Heroes™ · All rights reserved\.<\/div>/,'Settings: rights'],
];
const PAGE=html.replace(MOD,'');   // the strings themselves live in the module's EW_LANG_EN
for(const [re,what] of GONE){ const n=(PAGE.match(new RegExp(re.source,'g'))||[]).length; ok(n===0,what+' is no longer hard-coded ('+n+' left)'); }
// v1267 Settings tabs (v1377: the General pane grew graphics/sound/guides cards after it - Language must still come first): General is the first tab, the fallback tab, and its pane opens with the Language row (no scrolling to find it)
ok(/const TABS=\[\['general',t\('set\.tab_general'\)\]/.test(html)&&/\$\{pane\('general',langCard\+/.test(html)&&/if\(!TABS\.some\(x=>x\[0\]===setTab\)\) setTab='general';/.test(html),'Settings shows the Language card first, above the account (no scrolling to find it)');
ok(/ls\.onchange=\(\)=>\{ langSet\(ls\.value,\{save:true\}\); \}/.test(html),'the Language select saves the pick');
ok(/pushSave\(\); try\{ langAdoptSave\(\); \}catch\(e\)\{\}/.test(html),'a loaded cloud save adopts its language');

// ---- 4. no local `t` in a function that calls t() ----
// v1271: the scope is read by a real parser (Babel, bundled in playwright - tools/lang/shadow.js): each t('key') call must bind the global t.
// The step-1 regex scan flagged any `t` declared anywhere in a function body, even in a nested callback that never calls t() (14 false
// alarms once step 2 put t() in every screen); the parser checks the binding each call really resolves to.
{ const shadowCheck=require(path.join(ROOT,'tools','lang','shadow.js'));
  const r=shadowCheck(html); ok(r.hits===0,'no t() call binds a local t ('+r.list.slice(0,8).join(', ')+')'); ok(r.calls>=100,'shadow check read '+r.calls+' t() calls');
  // CONTROL: a function with its own local t that calls t('x.y') must be caught
  const c=shadowCheck(['<script>',"function t(k){ return k; }","function bad(){ const t=1; return t('set.language'); }","function good(){ return t('set.language'); }",'</script>'].join('\n'));
  ok(c.hits===1&&c.calls===2,'CONTROL: a shadowed t() call is caught ('+c.hits+' of '+c.calls+')'); }

// ---- 5. the module at run time ----
function sandbox(opts){ opts=opts||{};
  const store=opts.store||{}, fetched=[], warns=[];
  const mkEl=(attrs,text)=>{ const a=Object.assign({},attrs); const st={}; return { textContent:text||'', style:Object.assign(st,{fontSize:''}),
    getAttribute:k=>k in a?a[k]:null, hasAttribute:k=>k in a, setAttribute:(k,v)=>{a[k]=String(v);}, _cs:opts.fs||10.5 }; };
  const els=opts.els||[]; const link=[];
  const root={ lang:'en', classList:{ s:new Set(), toggle(c,on){ on?this.s.add(c):this.s.delete(c); }, contains(c){ return this.s.has(c); } },
    style:{ p:{}, setProperty(k,v){ this.p[k]=v; }, removeProperty(k){ delete this.p[k]; } } };
  const document={ readyState:opts.ready||'loading', documentElement:root, head:{ appendChild:e=>{ link.push(e); } },
    getElementById:id=>id==='ewLangFont'?(link[0]||null):null, createElement:()=>mkEl({}),
    querySelectorAll:sel=>sel==='[data-i18n]'?els.filter(e=>e.hasAttribute('data-i18n')):sel==='[data-i18n-fit]'?els.filter(e=>e.hasAttribute('data-i18n-fit')):[],
    addEventListener:()=>{} };
  const ctx=vm.createContext({ document, console:{ warn:(...a)=>warns.push(a.join(' ')) }, JSON, Math, String, Promise, Object, parseFloat,
    navigator:{ languages:opts.langs||['en-US'], language:(opts.langs||['en-US'])[0] },
    localStorage:{ getItem:k=>k in store?store[k]:null, setItem:(k,v)=>{ store[k]=String(v); }, removeItem:k=>{ delete store[k]; } },
    getComputedStyle:e=>({ fontSize:(e._cs)+'px' }),
    fetch:u=>{ fetched.push(u); const mc=/^\/lang\/([\w-]+)\.content\.json\?v=(\w+)$/.exec(u);   // v1271: a language's content file
      if(mc){ const cf=path.join(ROOT,'lang',mc[1]+'.content.json'); const ok2=fs.existsSync(cf); return Promise.resolve({ ok:ok2, json:()=>Promise.resolve(ok2?JSON.parse(fs.readFileSync(cf,'utf8')):null) }); }
      const m=/^\/lang\/([\w-]+)\.json\?v=(\w+)$/.exec(u); const d=m&&dict[m[1]];
      return Promise.resolve({ ok:!!d, json:()=>Promise.resolve(opts.dictOverride&&m&&opts.dictOverride[m[1]]||JSON.parse(JSON.stringify(d))) }); } });
  if(opts.G) ctx.G=opts.G, ctx.saveG=()=>{ ctx._saved=(ctx._saved|0)+1; };
  vm.runInContext(MOD+'\n;this.__L={LANG,t,langSet,langApply,langFit,langAdoptSave,langDetect,langOptionsHTML,EW_LANG_V};',ctx);
  return { ctx, L:ctx.__L, store, fetched, warns, root, link, mkEl };
}
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
  // first run on a Thai phone: Thai picked, ONLY th.json fetched, Noto Sans Thai linked, html lang set
  { const S=sandbox({ langs:['th-TH','en-US'] }); await flush(); await flush();
    ok(S.L.LANG.cur==='th'&&S.L.LANG.pref==='','a Thai phone opens in Thai (auto, not a saved pick)');
    // v1271: plus that language's content file (skill text ...) at its own hash, and nothing else
    const CV=JSON.parse((html.match(/\nconst EW_LANG_CV=(\{.*?\});/)||[,'{}'])[1]);
    ok(S.fetched.slice().sort().join(',')===['/lang/th.json?v='+V.th].concat(CV.th?['/lang/th.content.json?v='+CV.th]:[]).sort().join(','),'only the chosen language files are fetched: '+S.fetched.join(','));
    ok(!CV.th||(S.L.LANG.content&&JSON.parse(S.store.ew_lang_content).code==='th'),'the content file is in and kept on the device');
    for(const c of CODES.slice(1)) if(CV[c]) ok(crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT,'lang',c+'.content.json'),'utf8')).digest('hex').slice(0,8)===CV[c],'lang/'+c+'.content.json ?v= is the hash of its text');
    ok(S.root.lang==='th'&&S.root.classList.contains('ew-lang-noto')&&S.link.length===1&&/family=Noto\+Sans\+Thai/.test(S.link[0].getAttribute('href')),'Thai loads Noto Sans Thai only');
    ok(S.L.t('menu.settings')===dict.th['menu.settings'],'t() gives the Thai text once the file is in');
    ok(JSON.parse(S.store.ew_lang_dict).code==='th','the file is kept on the device for the next open');
    // next open: from the device copy, no fetch at all
    const S2=sandbox({ langs:['th-TH'], store:S.store }); await flush();
    ok(S2.fetched.length===0&&S2.L.t('menu.bag')===dict.th['menu.bag'],'a second open uses the kept copy (no fetch)'); }
  // English device: nothing fetched, no font
  { const S=sandbox({ langs:['en-GB'] }); await flush();
    ok(S.L.LANG.cur==='en'&&S.fetched.length===0&&S.link.length===0&&!S.root.classList.contains('ew-lang-noto'),'English needs no fetch and no extra font'); }
  // tag mapping
  { const S=sandbox(); const d=x=>S.L.langDetect(x);
    ok(d(['zh-TW'])==='zh-Hant'&&d(['zh-HK'])==='zh-Hant'&&d(['zh-Hant-TW'])==='zh-Hant'&&d(['zh-CN'])==='zh-Hans'&&d(['zh'])==='zh-Hans','Chinese tags map to Simplified / Traditional');
    ok(d(['pt-PT'])==='pt-BR'&&d(['in-ID'])==='id'&&d(['hi-IN'])==='hi'&&d(['es-MX'])==='es'&&d(['ms-MY','th'])==='th'&&d(['ms-MY'])==='en'&&d([])==='en','other tags map, an unsupported one falls through to English'); }
  // fallback: a language file missing a key shows English; a key nobody has shows nothing, never the raw key
  { const partial=Object.assign({},dict.de); delete partial['set.audio'];
    const S=sandbox({ langs:['de-DE'], dictOverride:{ de:partial } }); await flush(); await flush();
    ok(S.L.t('set.audio')===EN['set.audio'],'a key the German file lacks falls back to English');
    ok(S.L.t('menu.settings')===dict.de['menu.settings'],'German text otherwise');
    const r=S.L.t('no.such_key'); ok(r===''&&!/no\.such_key/.test(r)&&S.warns.length===1,'a missing key never prints raw (empty + one console warning)');
    ok(S.L.t('hub.unlocks_at',{n:20})==='Ab Stufe 20','vars fill in');
    ok(S.L.t('hub.unlocks_at')===dict.de['hub.unlocks_at'].replace('{n}',''),'a missing var leaves no {placeholder}'); }
  // the pick persists: device (ew_lang) + save (G.lang); a new open follows it over the phone's language
  { const G={}; const S=sandbox({ langs:['fr-FR'], G }); await flush(); await flush(); ok(S.L.LANG.cur==='fr','French phone -> French');
    await S.L.langSet('de',{save:true}); await flush();
    ok(S.store.ew_lang==='de'&&G.lang==='de'&&S.ctx._saved===1,'picking German saves it on the device and in the save (cloud on the next sync)');
    ok(S.L.LANG.cur==='de'&&S.L.LANG.pref==='de','German now');
    const S2=sandbox({ langs:['fr-FR'], store:S.store }); await flush(); await flush();
    ok(S2.L.LANG.cur==='de','the pick survives a restart over the phone language');
    const S3=sandbox({ langs:['fr-FR'], store:{ emberweave_save_v08:JSON.stringify({gold:1,lang:'ja'}) } }); await flush(); await flush();
    ok(S3.L.LANG.cur==='ja'&&S3.L.LANG.pref==='ja','a save that carries G.lang (restored cloud save, ew_lang gone) is followed');
    await S.L.langSet('',{save:true}); await flush();
    ok(!('ew_lang' in S.store)&&!('lang' in G)&&S.L.LANG.cur==='fr','"Device language" clears the pick and follows the phone again'); }
  // cloud save adoption
  { const S=sandbox({ langs:['en-US'], G:{ lang:'ko' } }); await flush(); ok(S.L.LANG.cur==='en','before the cloud save: English');
    S.L.langAdoptSave(); await flush(); await flush(); ok(S.L.LANG.cur==='ko'&&S.store.ew_lang==='ko','the account\'s language wins after sign-in');
    const G2={}; const S2=sandbox({ store:{ ew_lang:'it' }, G:G2 }); await flush(); S2.L.langAdoptSave(); ok(G2.lang==='it','a pick made before sign-in goes into the account save'); }
  // applying to the page + the hub-menu fit
  { const S=sandbox({ langs:['de-DE'], ready:'interactive' }); await flush(); await flush();
    const lab=S.mkEl({'data-i18n':'menu.settings','data-i18n-fit':'64'},'Settings'), ttl=S.mkEl({'data-i18n':'menu.settings','data-i18n-upper':''},'SETTINGS');
    S.L.langApply({ querySelectorAll:sel=>sel==='[data-i18n]'?[lab,ttl]:[lab] });
    ok(lab.textContent==='Optionen'&&ttl.textContent==='OPTIONEN','data-i18n labels change language; titles stay upper-case');
    const long=S.mkEl({'data-i18n-fit':'64'},'Einstellungen'); S.L.langFit(long); const f=parseFloat(long.style.fontSize);
    ok(f>=7&&f<10.5&&13*0.62*f<=64.01,'a word wider than the tile is shrunk to fit ('+f+'px), never cut');
    const short=S.mkEl({'data-i18n-fit':'64'},'Mail'); S.L.langFit(short); ok(short.style.fontSize==='','a label that fits is left alone'); }
  // every language: no hub-menu label shrinks below 7.5 px (the tile is 64 px, the label 10.5 px)
  { const S=sandbox();
    for(const c of CODES) for(const k of KEYS.filter(k=>k.startsWith('menu.'))){ const el=S.mkEl({'data-i18n-fit':'64'},dict[c][k]); S.L.langFit(el);
      const f=el.style.fontSize?parseFloat(el.style.fontSize):10.5; ok(f>=7.5,c+' '+k+' "'+dict[c][k]+'" stays readable in the hub menu ('+f+'px)'); } }
  // the Settings list: 16 languages in their own names + Device language
  { const S=sandbox({ langs:['es-ES'] }); await flush(); const o=S.L.langOptionsHTML();
    ok((o.match(/<option /g)||[]).length===17&&/value="zh-Hant"[^>]*>繁體中文/.test(o)&&/value="hi"[^>]*>हिन्दी/.test(o)&&/value="" selected>[^<]*\(Español\)/.test(o),'the Language list has 16 languages + Device language'); }
  console.log('test_lang_step1.js: '+pass+' checks passed');
})().catch(e=>{ console.error(e&&e.message||e); process.exit(1); });
