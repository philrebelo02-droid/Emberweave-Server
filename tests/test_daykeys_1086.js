// v1086 - scan 7 (day boundaries): the game day starts 09:00 ET (v1065).
//  #1 the Temple module's DEFAULT day (the client uses the default; the server sets nyDayKey) is the game day, so 00:00-09:00 ET
//     the client no longer shows the free prayer as ready / the cheapest gold step;
//  #2 the Vault fragment rotation turns with the game day; #3 the Vault's nextResetAt is the next 09:00 ET (was midnight ET).
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'), src=fs.readFileSync(path.join(root,process.env.AUD_SERVER||'server.js'),'utf8');
let pass=0,missed=[]; const ok=(c,m)=>{ if(process.env.AUD_SERVER&&!c){ missed.push(m); return; } assert(c,m); pass++; console.log('  ✓ '+m); };
const gameDay=t=>new Date(t-9*3600000).toLocaleDateString('en-CA',{timeZone:'America/New_York'});
// #1 the module default, at a fixed instant 03:00 ET (calendar day != game day)
const at=Date.parse('2026-10-09T03:00:00-04:00');
const code=fs.readFileSync(path.join(root,'server/temple-of-ash.js'),'utf8');
const RealDate=Date; class FakeDate extends RealDate{ constructor(...a){ super(...(a.length?a:[at])); } static now(){ return at; } }
const sb={Date:FakeDate,module:{exports:{}},console,Math,JSON,Object,Array,Number,String,Intl};
sb.exports=sb.module.exports; sb.window=sb; sb.globalThis=sb;
try{ vm.runInNewContext(code,sb); }catch(e){}
const T=sb.module.exports&&sb.module.exports.freeRitualAvailable?sb.module.exports:(sb.TempleOfAsh||null);
const st={freeRitualDay:gameDay(at),_freeClaimedDay:gameDay(at)};   // claimed today (game day 2026-10-08 at 03:00 ET on the 9th)
ok(gameDay(at)==='2026-10-08','fixture: 03:00 ET on 9 Oct is still game day 8 Oct');
ok(T&&T.freeRitualAvailable(st)===false,'#1 the client\'s Temple module does not offer a free prayer already used today (at 03:00 ET)');
// #2 / #3 static + computed with the server's own functions
ok(/function vaultDayIndex\(\)\{ return Math\.floor\(Date\.parse\(nyDayKey\(\)\+'T00:00:00Z'\)\/86400000\); \}/.test(src),'#2 the Vault rotation is indexed by the game day');
const grab=n=>{ const i=src.indexOf(n); return i<0?'':src.slice(i,src.indexOf('\n',i)); };
const fmt=src.slice(src.indexOf('const _etFmt'),src.indexOf(';',src.indexOf('const _etFmt'))+1);
const eo=src.slice(src.indexOf('function etOffsetMs'),src.indexOf('\n',src.indexOf('return',src.indexOf('function etOffsetMs'))));
const ctx={}; try{ vm.runInNewContext(fmt+'\n'+eo+'\n'+grab('function nyDayKey')+'\n'+grab('function dungeonNextReset')+'\nthis.n=dungeonNextReset;',ctx); }catch(e){ ctx.err=String(e); }
const nr=ctx.n?ctx.n():0, hm=nr?new Date(nr).toLocaleTimeString('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit'}):'';
ok(hm==='09:00'&&nr>Date.now()&&nr-Date.now()<=24*3600000,'#3 the Vault nextResetAt is the next 09:00 ET ('+hm+', in '+(nr?((nr-Date.now())/3600000).toFixed(1):'?')+' h)'+(ctx.err?' '+ctx.err:''));
ok(/<script src="\/server\/temple-of-ash\.js\?v=r1(08[6-9]|09\d|[1-9]\d\d)"><\/script>/.test(fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8')),'the client loads the new Temple module (asset version bumped)');
if(missed.length){ missed.forEach(m=>console.error('FAIL',m)); process.exitCode=1; }
console.log('test_daykeys_1086.js: '+pass+' checks passed, '+missed.length+' failed');
