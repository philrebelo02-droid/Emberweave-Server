const {load,spec}=require('./lib.js'); const L=load();
for(const P of [{level:5,stars:3,glyphRank:0,skillLv:[1,1,1,1]},{level:60,stars:4,glyphRank:6,skillLv:[40,40,40,40]}]){
 const snaps=L.host.snapFromSpecs(['hollow','konwu','vulmar','aureth','hurne','veyr','kharos'].map(k=>spec(k,P)));
 for(const s of snaps) console.log(P.level, s.key, 'rank',s.rank,'hp',Math.round(s.maxHp),'dmg',Math.round(s.dmg),'ap',Math.round(s.apow||0), 'grn',!!s.greenAb,'blu',!!s.blueAb, Object.keys(s).length);
}
