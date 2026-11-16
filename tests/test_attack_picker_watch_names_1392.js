// v1392 - Soul Eater 16 Nov (via Phil: "build both and push together" / "please make the Attack button at the top"):
//  1. the castle menu lists Attack (and Group Attack) first, Info after;
//  2. a war attack opens the hero picker with the wall line preselected (openMarchSelect(a,c,wallOrderedSquad())), never startMarch blind;
//  3. the Watch Tower's server view carries the target's display name (defName, via opts.nameOf) and, on the player's OWN marches only,
//     the heroes sent (heroIds); guild mates' rows carry no hero ids.
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'), page=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; };
// 1) menu order
const mi=page.indexOf("opts.push(['attack',"), ii=page.indexOf("opts.push(['info',uiIcon('info')");
ok(mi>0&&ii>0&&mi<ii,'the castle menu pushes Attack before Info');
// 2) war attack -> picker with the wall line
ok(/openMarchSelect\(a,c,wallOrderedSquad\(\)\); return; \}/.test(page),'a war attack opens the hero picker with the wall line');
ok(!/startMarch\(a,c,squad\); return; \}/.test(page),'the blind startMarch(a,c,squad) is gone');
ok(/function openMarchSelect\(ctype,c,pre\)/.test(page)&&/const first=\(Array\.isArray\(pre\)&&pre\.length\)\?pre:G\.team;/.test(page),'the picker preselects pre, else the team');
// 3) the Watch Tower server view
const W=require(path.join(root,'server','world-watch-state.js'));
const now=1800000000000, mk=(id,defId,heroIds)=>({id,kind:'attack',defId,heroIds,depart:now-60000,arriveAt:now+60000,homeAt:now+120000});
const me={id:'u1',name:'SOUL EATER',guildId:'g1',worldCityMarches:[mk('m1','bot_tefron_52',['vael','vex'])]};
const mate={id:'u2',name:'Mate',guildId:'g1',worldCityMarches:[mk('m2','u3',['lumi'])]};
const db={users:{u1:me,u2:mate,u3:{id:'u3',name:'Corin Emberheart'}},guilds:{g1:{members:['u1','u2']}}};
const names={bot_tefron_52:'Ashe Stormcaller',u3:'Corin Emberheart'};
const snap=W.snapshot(db,me,now,{nameOf:id=>names[id]||null});
const mine=snap.mates.find(x=>x.you).marches[0], theirs=snap.mates.find(x=>!x.you).marches[0];
ok(mine.defName==='Ashe Stormcaller','own march: the bot target shows its map name ('+mine.defName+')');
ok(theirs.defName==='Corin Emberheart','a mate\'s march: the player target shows its name');
ok(JSON.stringify(mine.heroIds)==='["vael","vex"]','own march lists its heroes');
ok(theirs.heroIds===undefined,'a mate\'s march carries no hero ids');
const snap0=W.snapshot(db,me,now);
ok(snap0.mates.find(x=>x.you).marches[0].defName===undefined,'without nameOf nothing is added (old callers unchanged)');
// client renders defName and own heroes
ok(/t\('watch\.city',\{id:m\.defName\|\|m\.defId\|\|'target'\}\)/.test(page),'the client shows defName before the id');
ok(/if\(w\.you&&Array\.isArray\(m\.heroIds\)/.test(page),'the client lists heroes on your own marches only');
// the server route passes nameOf
const srv=fs.readFileSync(path.join(root,'server.js'),'utf8');
ok(/WORLD_WATCH_STATE\.snapshot\(DB,me,Date\.now\(\),\{nameOf:/.test(srv),'the watch route passes nameOf');
console.log('PASS test_attack_picker_watch_names_1392: '+pass+' checks');
