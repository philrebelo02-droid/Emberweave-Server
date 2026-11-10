// v1330 (10 Nov 2026 bug sweep): three small fixes, checked in the source. EW_ROOT points this at another tree for a control run.
const fs=require('fs'), path=require('path'), assert=require('assert');
const root=process.env.EW_ROOT||path.join(__dirname,'..');
const srv=fs.readFileSync(path.join(root,'server.js'),'utf8'), cli=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
assert(/\(me\.coins\|0\)\+n>ECON_CAP\.arenaCoins\) return \{ok:false,error:'You are at the Arena Coin limit\.'\}/.test(srv),'Arena Coins at the limit are refused before the spend');
assert(/function guildShopSlots\(\)\{ return Math\.min\(GUILD_SHOP\.length, 4\+\(guildLevel\(\)-1\)\*2\); \}/.test(cli),'Guild shop slot count stops at the items that exist');
assert(/p==='\/api\/arena\/opponent'\)\{ if\(!me\)return send\(res,401,\{error:'auth'\}\); if\(rateLimited\(req,'arenaopp:'\+me\.id,60,60000\)\)/.test(srv),'single opponent route is throttled');
console.log('PASS sweep fixes 1330');
