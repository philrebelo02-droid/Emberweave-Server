// v1202 SPELL TEXT (Kimi's two audit passes, 18 Oct 2026). No browser: the text tables, the control table and the helpers are read
// out of the page and run in a sandbox. Checks:
//  1. every sentence a player reads that quotes a control time (ult texts, kit texts, passives) says the time the FIGHT applies
//     (CC_SECONDS x CC_NERF, single or area - ccSecFor - or ccDur for a time the fight code sets itself);
//  2. the effects the texts left out are now named (Grosk taunt, Maren slow, Korvux stun, Zahri stun, Vaelora freeze chance,
//     Pellucid stun, Joss stun, Vesper Errata damage, Mirelle slow, Orryn damage + slow) and Featherfang no longer says "two enemies";
//  3. every hero kit type with a damage or heal ratio has a KIT_SCALE entry (its card says what it grows from);
//  4. the findings that were NOT real stay as they are: Oakmir's passive is Deep Roots, Askel's ult carries the ally shield and the
//     knock-aside, Lumi's levelled Hush text reads 0.7 s.
// CONTROL: SPELL_ROOT=<a pre-v1202 checkout> must FAIL 1-3.
const fs=require('fs'), path=require('path'), vm=require('vm');
const root=process.env.SPELL_ROOT?path.resolve(process.env.SPELL_ROOT):path.join(__dirname,'..');
const L=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8').split(/\r?\n/);
let fails=0, checks=0; const ok=(c,m)=>{ checks++; if(c) console.log('  ✓ '+m); else { fails++; console.log('  ✗ '+m); } };
const block=(start)=>{ const i=L.findIndex(l=>l.startsWith(start)); if(i<0) return null; let s='', d=0, seen=false;
  for(let j=i;j<L.length;j++){ const l=L[j]; s+=l+'\n'; for(const ch of l){ if(ch==='{'){d++;seen=true;} else if(ch==='}')d--; } if(seen&&d<=0) break; if(!seen&&/;\s*$/.test(l)) break; } return s; };
const ctx={METER:40, Math, console:{log(){},warn(){}}}; vm.createContext(ctx);
const run=(start,asVar)=>{ const b=block(start); if(!b) return false; try{ vm.runInContext(asVar?b.replace(/^const /,'var '):b, ctx); return true; }catch(e){ console.log('  (could not run '+start+': '+e.message.slice(0,80)+')'); return false; } };
['const CC_NERF=','const CC_SECONDS=','const ULT_DEF=','const HERO_ULT_DESC=','const ULT_DESC=','const KIT_DESC=','const PASS_DESC=','const KITS=','const ULT_SCALE=','const KIT_SCALE=','const HERO_ULT_ART=']
  .forEach(s=>run(s,true));
run('function ccDur('); run('function ccSecFor(');
const oa=L.findIndex(l=>l.startsWith('Object.assign(KIT_SCALE')); if(oa>=0){ vm.runInContext(L[oa]+'\n'+(L[oa+1]||'')+'\n'+(L[oa+2]||''),ctx); }
const ou=L.findIndex(l=>l.startsWith('Object.assign(ULT_SCALE')); if(ou>=0) vm.runInContext(L[ou],ctx);
const kitsMore=block('Object.assign(KITS, {'); if(kitsMore){ for(let t=0;t<12;t++){ try{ vm.runInContext(kitsMore,ctx); break; }catch(e){ const m=/^(\w+) is not defined/.exec(e.message); if(m){ ctx[m[1]]=1; continue; } console.log('  (could not run the second KITS block: '+e.message.slice(0,80)+')'); break; } } }   /* numeric constants the kits name (only their text matters here) */
const fixer=block('(function spellTextCC(){'); if(fixer){ vm.runInContext('var SPELL_TEXT_CC=[];\n'+fixer,ctx); }
const C=ctx;
console.log('spell text 1202 root='+root);
// hero keys -> ult type
const HT={}; { const re=/^\s+([a-z]+)\s*:\s*\{name:'([^']+)'.*?ability:'([a-zA-Z]+)'/; for(const l of L){ const m=re.exec(l); if(m&&!HT[m[1]]) HT[m[1]]={name:m[2],ability:m[3]}; } }
const keys=Object.keys(HT).filter(k=>C.KITS&&C.KITS[k]);
const S=x=>+(+x).toFixed(2);
// 1. every quoted control time
{ console.log('-- quoted control times = the fight');
  if(fixer) ok(C.SPELL_TEXT_CC.length>0&&C.SPELL_TEXT_CC.every(x=>x.ok),'every SPELL_TEXT_CC phrase was found and filled from the fight table ('+C.SPELL_TEXT_CC.filter(x=>!x.ok).map(x=>x.where).join(', ')+')');
  else ok(false,'SPELL_TEXT_CC exists');
  const shown=(k)=>{ const t=HT[k]; const d=Object.assign({},C.ULT_DEF[t.ability]||{},(C.HERO_ULT_ART&&C.HERO_ULT_ART[k])||{}); if(k==='veyr'&&t.ability==='eventhorizon') Object.assign(d,{silence:0,slow:2/0.7,ccFixed:['slow']}); return d; };
  /* times the fight code sets itself (not through the table), checked by hand in doEffect */
  const OWN={ 'vulmar|ult|1':1.0 /* worldweight: _liftStun = slamStun 1.0 straight onto stunned (Phil set 1 s) */, 'grosk|ult|5':null /* "for 5 seconds" is the plant, not a control */,
              'rivet|blue|1.4':1.4 /* case slow: ccDur(2) */ };
  const want={stun:'stun',stunned:'stun',stuns:'stun',stunning:'stun',stops:'stun',freezes:'freeze',freeze:'freeze',silenced:'silence',silences:'silence',rooted:'root',slowed:'slow',slowing:'slow',slows:'slow',taunt:'tauntDur'};
  let n=0;
  const check=(k,slot,text,o)=>{ if(!text) return; const re=/(stun\w*|stops|freez\w*|silenc\w*|rooted|slow\w*|taunt\w*)[^.;:]{0,60}?(\d+(?:\.\d+)?)\s*(?:s\b|second)/gi; let m;
    while((m=re.exec(text))){ n++; const word=m[1].toLowerCase(), val=+m[2]; const kind=want[word]||(/^stun/.test(word)?'stun':/^freez/.test(word)?'freeze':/^silenc/.test(word)?'silence':/^slow/.test(word)?'slow':/^taunt/.test(word)?'tauntDur':null);
      const own=OWN[k+'|'+slot+'|'+val]; if(own===null) continue;
      let real=own!=null?own:(o&&o[kind]?C.ccSecFor(o,kind):null);
      if(word==='silenced'&&k==='vesper'&&slot==='ult') real=C.ccSecFor(o,'silence');
      if(word==='rooted'&&o&&o.root) real=C.ccSecFor(o,'root');
      if(k==='lumi') real=C.ccDur(1);   /* the hush tick: ccDur(1 x passMul) */
      ok(real!=null&&Math.abs(S(real)-val)<0.011,k+' '+slot+': "'+m[0].replace(/\s+/g,' ')+'" = the fight\'s '+(real==null?'(no control in the data)':S(real)+' s')); } };
  for(const k of keys){ const t=HT[k];
    check(k,'ult',(C.HERO_ULT_DESC&&C.HERO_ULT_DESC[k])||(C.ULT_DESC&&C.ULT_DESC[t.ability]),shown(k));
    for(const sl of ['green','blue']){ const a=C.KITS[k][sl]; if(!a) continue; check(k,sl,a.desc||(C.KIT_DESC&&C.KIT_DESC[a.type]),a); } }
  check('lumi','passive',C.PASS_DESC&&C.PASS_DESC.hush,{silence:1});
  ok(n>=8,'the scan found the quoted control times ('+n+')'); }
// 2. the effects the texts left out
{ console.log('-- effects named');
  const kd=(k,sl)=>{ const a=C.KITS[k]&&C.KITS[k][sl]; return a?(a.desc||C.KIT_DESC[a.type]||''):''; };
  const ud=k=>(C.HERO_ULT_DESC&&C.HERO_ULT_DESC[k])||C.ULT_DESC[HT[k].ability]||'';
  ok(/taunt/i.test(kd('grosk','blue')),'Grosk Hammer Fists names the taunt');
  ok(/slow/i.test(kd('maren','green')),'Maren Tide Pool names the slow');
  ok(/stun/i.test(kd('korvux','green')),'Korvux Comet Dash names the stun');
  ok(/stun/i.test(kd('pellucid','blue')),'Pellucid Infernal Clinch names the stun');
  ok(/stun/i.test(kd('joss','green')),'Joss Radiant Hammer names the stun');
  ok(/damag/i.test(kd('vesper','green')),'Vesper Errata names its damage');
  ok(/slow/i.test(kd('mirelle','blue')),'Mirelle Soporific Bouquet names the slow');
  ok(/damag/i.test(kd('orryn','blue'))&&/slows everything/i.test(kd('orryn','blue')),'Orryn Spiral Current names its damage and slow');
  ok(!/two enemies/i.test(kd('vaelora','green'))&&/every enemy in its path/i.test(kd('vaelora','green')),'Vaelora Featherfang: every enemy in its path, not two (the pierce is uncapped)');
  ok(/stun/i.test(ud('zahri')),'Zahri ult names the stun');
  ok(/freeze/i.test(ud('vaelora')),'Vaelora ult names the freeze chance');
  ok(/shield/i.test(ud('askel'))&&/stun/i.test(ud('askel')),'Askel ult names the shield and the stun at the impact'); }
// 3. scaling entries
{ console.log('-- every damage / heal ratio says what it grows from');
  const miss=new Set(); for(const k of keys) for(const sl of ['green','blue']){ const a=C.KITS[k][sl]; if(!a) continue; if((a.mul||a.dps)&&!(a.type in C.KIT_SCALE)) miss.add(a.type+' ('+k+')'); }
  ok(miss.size===0,'no hero kit type with a ratio is missing from KIT_SCALE ('+[...miss].join(', ')+')');
  for(const u of ['rewind','quietwings','plumage']) ok(u in C.ULT_SCALE,'ULT_SCALE has '+u); }
// 4. not real - unchanged
{ console.log('-- the findings that were not real');
  ok(C.KITS.oakmir&&C.KITS.oakmir.purple&&C.KITS.oakmir.purple.pass==='deeproots','Oakmir passive is Deep Roots (Kimi A: "Twin Fonts" - not real)');
  const aa=C.HERO_ULT_ART&&C.HERO_ULT_ART.askel; ok(aa&&aa.allyShield===0.12&&aa.knockAside===2*40,'Askel ult carries allyShield 0.12 + knockAside 2 m (Kimi A: "not in the code" - not real)');
  const hl=L.find(l=>/^\s*hush: lv=>/.test(l)); ok(!!hl&&/0\.7\*skillMul/.test(hl),'Lumi levelled Hush text reads 0.7 s (Kimi A - not real)'); }
console.log(`spell text 1202: ${checks-fails}/${checks} checks passed, ${fails} failed`);
if(fails) process.exitCode=1;
