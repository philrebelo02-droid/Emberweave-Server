// Rebuilds talents-tree-element.js (which painted kit each talent tree uses) from the confirmed table ChatGPT delivers:
//   node tools/build_talent_tree_elements.js "E:/Emberweave Archive/4 Projects/Open Projects/TALENT UI ART 16NOV2026/TREE TYPES.json"
// The JSON is { heroKey: { treeId: "Fire"|"Ice"|"Water"|"Nature"|"Light"|"Dark"|"Lightning"|"Neutral" } }. Unknown heroes / trees / types stop the build;
// a hero whose three trees are all one type is listed (Phil: "1 character doesnt have the same tab for 3") but kept.
'use strict';
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..'), src=process.argv[2];
if(!src){ console.error('usage: node tools/build_talent_tree_elements.js <TREE TYPES.json>'); process.exit(2); }
const EL=['Dark','Fire','Ice','Light','Lightning','Nature','Neutral','Water'], D=require(path.join(root,'talents-data.js')), J=JSON.parse(fs.readFileSync(src,'utf8'));
const bad=[], same=[], lines=[];
for(const k of Object.keys(J)){ const h=D.heroes[k]; if(!h){ bad.push('no hero '+k); continue; }
  const ids=h.trees.map(t=>t.id);
  for(const id of Object.keys(J[k])){ if(!ids.includes(id)) bad.push(k+'/'+id+': no such tree'); if(!EL.includes(J[k][id])) bad.push(k+'/'+id+': '+J[k][id]+' is not a kit'); }
  if(ids.every(id=>J[k][id])&&new Set(ids.map(id=>J[k][id])).size===1) same.push(k);
  lines.push('  '+JSON.stringify(k)+':{'+ids.filter(id=>J[k][id]).map(id=>JSON.stringify(id)+':'+JSON.stringify(J[k][id])).join(',')+'}'); }
if(bad.length){ console.error(bad.join('\n')); process.exit(1); }
const out=`/* TALENT TREE COLOURS (16 Nov 2026). Phil: "each talent TAB specifically gets it own color scheme based on the spec" - and a hero's three tree tabs
   are never all the same colour. heroKey -> treeId -> one of the eight painted kits in assets/img/ui/talents/<Element>/:
   Fire, Ice, Water, Nature, Light, Dark, Lightning, Neutral. A tree with no entry takes the hero's element (AFF_ELEMENT in the page), then Neutral.
   The page only reads this table to pick the art; nothing in a fight or in the rules uses it.
   Built by tools/build_talent_tree_elements.js from ${path.basename(src)}. */
(function(root){
const TALENT_TREE_ELEMENT={
${lines.join(',\n')}
};
if(typeof module!=='undefined'&&module.exports) module.exports=TALENT_TREE_ELEMENT; else root.TALENT_TREE_ELEMENT=TALENT_TREE_ELEMENT;
})(typeof window!=='undefined'?window:globalThis);
`;
fs.writeFileSync(path.join(root,'talents-tree-element.js'),out);
console.log('talents-tree-element.js: '+lines.length+' heroes'+(same.length?'; all three trees one type: '+same.join(', '):''));
