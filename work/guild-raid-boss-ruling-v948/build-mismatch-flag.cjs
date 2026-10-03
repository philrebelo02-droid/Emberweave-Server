'use strict';
const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
a(!fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'));const parent=fs.readFileSync(path.join(__dirname,'private-server-player-damage.js'),'utf8');a.equal(hash(parent),'4f66439ee5c0ca10e35ff1b4eec3aefda3c9824c7ce48760d8274a3624ce2d69');
const before='        dmg=Math.min(dmg, r.hp);',after=`        // PRIVATE first-flag bookkeeping ONLY: valid numeric disagreement, never engine failure.
        // Appended to the staged actor and committed atomically with the exact settlement receipt.
        // Case3/review4 consumer contract and full history/quota handling remain OPEN; DO NOT INSTALL.
        if(incident?.kind==='raid-damage-mismatch'){
          actor.raidMismatchFlags=Array.isArray(actor.raidMismatchFlags)?actor.raidMismatchFlags:[];
          actor.raidMismatchFlags.push({...incident,t:Date.now(),requestId:reqId,packetHash,
            stage:'guild-raid:'+a.bossKey+':tier:'+a.tier});
        }
        dmg=Math.min(dmg, r.hp);`;
a.equal(parent.split(before).length,2);const output=parent.replace(before,after);a.equal(output.replace(after,before),parent);new vm.Script(output);const file=path.join(__dirname,'private-server-mismatch-flag.js');a(!fs.existsSync(file));fs.writeFileSync(file,output);const cert={atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),parentSHA256:hash(parent),sourceSHA256:hash(output),helperSHA256:hash(fs.readFileSync(__filename)),limits:'PRIVATE first mismatch flag append only; no case3/review4 consumers, history/quota qualification, combat/balance/deploy approval. Staged actor commit; no Brain or feedback sink changes.'};fs.writeFileSync(path.join(__dirname,'mismatch-flag-build.json'),JSON.stringify(cert,null,2));console.log(JSON.stringify(cert));
