// v1367 (Phil 11 Nov 2026: "Yes do that"; tester: Back from a stage opened by a glyph source "takes you back to the main screen, not to the
// hero's window"). Runs the page's real g2SrcGo / campBackLabel / campReturnGo with stubs. CONTROL: v1365 has no return trip.
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process');
const ROOT=path.join(__dirname,'..'); let P=0,F=0; const ck=(n,c,x)=>{ if(c){P++;console.log('  ok   '+n);} else {F++;console.log('  FAIL '+n+(x?' - '+x:''));} };
const src=fs.readFileSync(path.join(ROOT,'emberweave-heroes.html'),'utf8');
const a=src.indexOf('function g2SrcGo('), b=src.indexOf("try{ document.addEventListener('click',e=>{ const bb=", a);
ck('return trip code present', a>0&&b>a);
const span={attrs:{'data-i18n':'nav.base'},textContent:'Base',removeAttribute(k){delete this.attrs[k];},setAttribute(k,v){this.attrs[k]=v;}};
const calls=[]; const ctx={ RUNE2:{build:{slot:2,stack:[[0,1]]}}, detailHero:'vael', state:'heroes', heroTab:'stats', HERO_TYPES:{vael:{name:'Vael'}},
  document:{ querySelector:s=>s==='#campaign>.backbtn'?{querySelector:()=>span}:null, getElementById:id=>id==='heroes'?{}:null },
  ewT:k=>k==='nav.base'?'Base':k, portalLockMsg:()=>'', portalChapterLockMsg:()=>'', bannerMsg(){}, hudIcon(){return '';}, g2RenderOverlays(){},
  show:n=>{calls.push('show:'+n); ctx.state=n;}, openStageModal:()=>calls.push('stage'), closeStageModal:()=>calls.push('closeStage'),
  popoutScreen:n=>calls.push('pop:'+n), g2buildOpen:async s=>{ calls.push('build:'+s); ctx.RUNE2.build={slot:s,stack:[]}; }, renderHeroDetail(){}, setTimeout:()=>0,
  PORTAL:'normal', campViewCh:0, campViewUser:false };
vm.createContext(ctx); vm.runInContext(src.slice(a,b)+';this.go=g2SrcGo;this.lab=campBackLabel;this.ret=campReturnGo;this.CR=()=>CAMP_RETURN;',ctx);
ctx.go('3-4','normal');
ck('a glyph source jump remembers the hero, the screen under it, the glyph slot and the open tree', JSON.stringify(ctx.CR())==='{"hero":"vael","under":"heroes","slot":2,"stack":[[0,1]]}', JSON.stringify(ctx.CR()));
ctx.lab(); ck('the campaign Back button names the hero', span.textContent==='Vael'&&!span.attrs['data-i18n']);
(async()=>{ await ctx.ret();
  ck('Back closes the stage window, reopens the hero window on the glyph tab and the build at the same glyph', calls.includes('closeStage')&&calls.includes('pop:heroDetail')&&calls.includes('build:2')&&ctx.heroTab==='glyphs'&&ctx.detailHero==='vael', calls.join(','));
  ck('the tree comes back where it was', JSON.stringify(ctx.RUNE2.build.stack)==='[[0,1]]');
  ck('after the return the button is Base again', ctx.CR()===null&&span.textContent==='Base'&&span.attrs['data-i18n']==='nav.base');
  ck('going Home clears a pending return', /if\(name==='home'&&typeof CAMP_RETURN!=='undefined'&&CAMP_RETURN\)\{ CAMP_RETURN=null;/.test(src));
  ck('after a sweep, the stage window's own button names the hero and goes straight back (Phil: "when you are sent to a stage to sweep for the glyphs")', src.indexOf("if(typeof CAMP_RETURN!=='undefined'&&CAMP_RETURN){ closeStageModal(); campReturnGo(); return; }")>0 && /id=\"smClose\">\$\{\(typeof CAMP_RETURN!=='undefined'&&CAMP_RETURN&&HERO_TYPES\[CAMP_RETURN.hero\]\)\?'◀ '/.test(src));
  const old=cp.execSync('git show 7e49f874:emberweave-heroes.html',{cwd:ROOT,maxBuffer:64<<20}).toString();
  ck('CONTROL: v1365 had no return trip', old.indexOf('CAMP_RETURN')<0);
  console.log('test_camp_return_1367.js: '+P+' passed, '+F+' failed'); process.exit(F?1:0); })();
