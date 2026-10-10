// Phil 9 Oct 2026: "no more emojis in this game" / "every emoji art will be replaced by art". RATCHET: the emoji count in the
// game's code may only go DOWN. When a release removes emojis, lower MAX to the new count (target 0 before pre-beta).
const fs=require('fs'),path=require('path'),assert=require('assert');
const MAX=291;   // v1100 (hero fragments = the hero's card, the 20 approved icons, mine/vault/forge/class/suit art; was 365 at v1098) // v1098 (approved UI / HUD / status icon art across every screen; was 1405 at v1095)
const files=['emberweave-heroes.html','server.js',...fs.readdirSync(path.join(__dirname,'..','server')).filter(f=>/\.js$/.test(f)).map(f=>'server/'+f)];
const pat=/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F2FF}]/gu;
let n=0; const per={};
for(const f of files){ const s=fs.readFileSync(path.join(__dirname,'..',f),'utf8'); const c=(s.match(pat)||[]).length; if(c){ per[f]=c; n+=c; } }
console.log('emojis in game code: '+n+' (max '+MAX+')', JSON.stringify(per));
assert(n<=MAX,'the emoji count went UP to '+n+' (max '+MAX+') - use art icons, never new emojis');
console.log('test_emoji_ratchet.js: pass');
