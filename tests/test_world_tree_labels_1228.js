// v1228 (Phil 30 Oct 2026: "also the timer is gone" / "the world tree text needs to get off the tree" / "does the tree seem off center?"):
// the World Tree timer is never hidden by the castle/mine label cutoff and sits just under the drawn tree's root tips (from META.tree,
// not a fixed 51.98 %); the "World Tree" name sits above the tree's frame; the tree stands between the four painted ponds.
// Asserts, exits non-zero.
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'),R=require('../world-realm.js');
const html=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8'),cd=fs.readFileSync(path.join(root,'assets','ui','world-tree-countdown.js'),'utf8');
let pass=0;const ok=(c,m)=>{assert(c,m);pass++;};
ok(/#wzoneInner\.wm-nolab \.wnode:not\(#worldTreeCountdown\) \.wlab\{display:none;\}/.test(html),'the label cutoff exempts the World Tree timer');
ok(!/#wzoneInner\.wm-nolab \.wnode \.wlab\{display:none/.test(html),'no rule hides every .wnode label any more');
ok(!/51\.98/.test(cd),'the timer has no fixed 51.98 % position');
const win={EmberweaveRealm:R};const ctx=vm.createContext({window:win});vm.runInContext(cd,ctx);
const a=win.EmberweaveWorldTreeCountdown.treeAnchor(),T=R.META.tree,G=R.GEO;
const rootTips=G.Y0+(T.cy-T.sideCells/2+T.sideCells*845/1254)*G.CELL;
ok(Math.abs(a.x-T.cx*G.CELL)<1e-9,'the timer is centred on the tree: '+a.x);
ok(a.y>rootTips&&a.y-rootTips<=1*G.CELL,'the timer sits just under the root tips ('+a.y.toFixed(3)+' vs '+rootTips.toFixed(3)+')');
ok(/onTree=key==='worldtree'/.test(html)&&/\(TT\.cy-TT\.sideCells\/2\)\*GRID_CELL/.test(html)&&/translate\(-50%,\$\{onTree\?'-100%':'-50%'\}\)/.test(html),'the World Tree name sits above the frame top');
const ponds=require('../server/world-oasis-layout.json'),mx=ponds.reduce((s,o)=>s+o.cx,0)/4,my=ponds.reduce((s,o)=>s+o.cy,0)/4;
ok(Math.abs(T.cx-mx)<=0.5&&Math.abs(T.cy-my)<=0.5,'the tree is in the middle of the four ponds');
const [x0,y0,x1,y1]=T.core;ok(x1-x0+1===18&&y1-y0+1===18,'the core is 18 x 18');
for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){if(R.landZone(x,y)!=='worldtree'||R.isOasis(x,y))assert.fail('core cell '+x+','+y+' off the island or on a pond');}pass++;
console.log('test_world_tree_labels_1228.js: '+pass+' checks passed');
