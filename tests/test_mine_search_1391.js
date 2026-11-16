// v1391 - mine search (Soul Eater 15 Nov; Phil 16 Nov: "a mine search of mines within 30 minutes march and with level filter and type")
// and mineral names on tap. Extracts the page's own functions (no browser) and checks:
//  - mineSearchRows keeps only mines within 30 minutes' march (marchOutMs), of the chosen type and level, with stock left, nearest first;
//  - mnResName gives the translated name, falling back to the RES name;
//  - resIconHtml marks the icon with data-resk (the tap target); the page wires openMineSearch to a #mapMineFind button.
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const page=fs.readFileSync(path.join(__dirname,'..','emberweave-heroes.html'),'utf8');
const grab=name=>{ const i=page.indexOf('function '+name+'('); assert(i>=0,'missing '+name); let d=0,j=page.indexOf('{',i);
  for(;j<page.length;j++){ if(page[j]==='{')d++; else if(page[j]==='}'){ d--; if(!d) break; } } return page.slice(i,j+1); };
let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; };
const ctx={ RES:[['iron','','Emberite','#c9d1d9'],['crystal','','Voidglass','#7fe3ff'],['silver','','Starsilver','#e6e6f0'],['coal','','Cinderwood','#8b98a9']],
  MINE_ICONS:{iron:'/i.png'}, MINE_IMGS:{}, mnResIcon:k=>k, ewT:(k)=>({'res.iron':'Hierro'})[k]||k,
  MINES:[], worldMines(){ return ctx.MINES; }, marchOutMs(_t,x,y){ return Math.round(Math.hypot(x-50,y-50)*60000); } };
vm.createContext(ctx);
vm.runInContext('const MINE_SEARCH_MAX_MS=30*60000;'+grab('mineSearchRows')+grab('mnResName')+grab('resIconHtml')+';this.mineSearchRows=mineSearchRows;this.mnResName=mnResName;this.resIconHtml=resIconHtml;',ctx);
const M=(id,res,level,x,y,left)=>({id,res,level,x,y,left});
ctx.MINES=[ M('a','iron',1,55,50,100), M('b','iron',3,60,50,100), M('c','crystal',1,52,50,100), M('d','iron',1,90,50,100),   // d: 40 min away
            M('e','iron',1,51,50,0), M('f','coal',2,70,50,100), M('g','wood',1,50,51,100) ];                                // e: empty; g: unknown type
const ids=f=>ctx.mineSearchRows(f).map(r=>r.m.id).join('');
ok(ids({res:'',lv:0})==='cabf','any type/level: within 30 min, stock left, known types, nearest first ('+ids({res:'',lv:0})+')');
ok(ids({res:'iron',lv:0})==='ab','type filter ('+ids({res:'iron',lv:0})+')');
ok(ids({res:'iron',lv:3})==='b','type + level filter ('+ids({res:'iron',lv:3})+')');
ok(ids({res:'silver',lv:0})==='','no match is an empty list');
ok(ctx.mineSearchRows({res:'',lv:0}).every(r=>r.ms<=30*60000),'every row is within 30 minutes');
ok(ctx.mnResName('iron')==='Hierro'&&ctx.mnResName('coal')==='Cinderwood'&&ctx.mnResName('zzz')==='zzz','mnResName: translated, falls back to the RES name');
ok(/data-resk="iron"/.test(ctx.resIconHtml('iron',15)),'resIconHtml marks the icon for the tap');
ok(/id="mapMineFind"/.test(page)&&/#mapMineFind'\)\.onclick=openMineSearch/.test(page),'the map bar has the mine search button');
ok(/closest\('\.pill'\)/.test(page)&&/data-resk/.test(page),'a tap on a resource pill names the mineral');
console.log('PASS test_mine_search_1391: '+pass+' checks');
