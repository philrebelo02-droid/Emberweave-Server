'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),file=path.join(root,'emberweave-heroes.html'),source=fs.readFileSync(file,'utf8');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const parent=cp.execFileSync('git',['show','bbbc3a662a4f106153abafafec691cc6d70149a0:emberweave-heroes.html'],{cwd:root,maxBuffer:24*1024*1024}).toString();
function damageFn(text){const from=text.indexOf('function raidDamageDone(){'),to=text.indexOf('\nasync function vaultDevJump',from);assert(from>0&&to>from);return text.slice(from,to);}
function damage(text,hp){const ctx={units:[{team:'enemy',_raidBoss:true,_raidStartHp:hp,_raidDmgTaken:hp,alive:false,hp:0}]};vm.createContext(ctx);return vm.runInContext(damageFn(text)+'\nraidDamageDone()',ctx);}
assert.notEqual(damage(parent,2147483648),2147483648,'unchanged actual-main natural control truncates observed damage');
let checks=0;const values=[1,401000,2147483647,2147483648,4294967296,9999999999,Number.MAX_SAFE_INTEGER];
for(const hp of values){assert.equal(damage(source,hp),hp);checks++;}
const pool='Math.max(1,Number.isFinite(B.hp)?Math.trunc(B.hp):0)';assert.equal(source.split(pool).length-1,4,'four actual bootstrap/replay pool conversions');
for(const hp of values){assert.equal(vm.runInNewContext(pool,{B:{hp}}),hp);checks++;}
for(const [label,needle,min] of [['damage','Math.max(0,Number.isFinite(r.dmg)?Math.trunc(r.dmg):0)',0],['hp','Math.max(0,Number.isFinite(r.raid.hp)?Math.trunc(r.raid.hp):0)',0],['max','Math.max(1,Number.isFinite(r.raid.max)?Math.trunc(r.raid.max):0)',1]]){assert(source.includes(needle));for(const n of [...values,NaN,Infinity,-1,1.9]){const r={dmg:n,raid:{hp:n,max:n}},out=vm.runInNewContext(needle,{r});assert.equal(out,Math.max(min,Number.isFinite(n)?Math.trunc(n):0),label);checks++;}}
let scripts=0;for(const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/\bsrc\s*=|application\/ld\+json/.test(match[1]))continue;new vm.Script(match[2]);scripts++;}
const result={atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),sourceSHA256:hash(source),helperSHA256:hash(fs.readFileSync(__filename)),checks,scripts,naturalControl:{base:'bbbc3a662a4f106153abafafec691cc6d70149a0',input:2147483648,parentDamage:damage(parent,2147483648),candidateDamage:damage(source,2147483648)},limits:'Extracted actual damage function, numeric bootstrap/result expressions and all inline script parse only. No witnessed fight, natural tier reachability, quit/retry/recovery/full client integration/balance/deployment qualification.'};fs.writeFileSync(path.join(__dirname,'guild-client-numeric.evidence.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
