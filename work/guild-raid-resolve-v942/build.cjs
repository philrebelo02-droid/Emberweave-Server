'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
assert(!fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'));
const prior=path.join(__dirname,'../guild-raid-start-v942/payload/combined'),source=fs.readFileSync(path.join(prior,'server.js'),'utf8');
assert.equal(hash(source),'784bcf366ee53c6a5130c69ef85482b5941dc19c4dd690841786d34a6aef17de');
const a=source.indexOf("    if(p==='/api/guild/raid/resolve' && req.method==='POST'){"),z=source.indexOf("    if(p==='/api/guild/raid/assault-old')",a);assert(a>=0&&z>a);
const old=source.slice(a,z);let next=old;
function change(o,n){assert.equal(next.split(o).length,2,o);next=next.replace(o,n);}
change("      const out=idem(me.id+':graidres:'+reqId,()=>{",`      const key=me.id+':graidres:'+reqId,attemptId=String(b.attemptId||''),prior=DB.idem?.[key];
      if(prior){
        if(prior.guildId!==g.id||prior.attemptId!==attemptId)return send(res,409,{ok:false,error:'Raid receipt does not match this guild and attempt.'});
        if(Date.now()<prior.t)return send(res,409,{ok:false,error:'Request clock precedes receipt.'});
        return send(res,200,{...structuredClone(prior.resp),raid:raidView(g),...(prior.resp?.ok?{ledger:ledgerView(structuredClone(me))}:{})});
      }
      const actor=structuredClone(me),guilds=structuredClone(DB.guilds),guild=guilds[g.id],staged={...DB,users:{...DB.users,[me.id]:actor},guilds};
      if(_worldSettlementPlanning)throw Error('Nested raid planning');
      let out;_worldSettlementPlanning={db:staged,diagnostics:[]};
      try{out=(()=>{`);
next=next.replaceAll('ensureRaid(g)','ensureRaid(guild)').replaceAll('raidView(g)','raidView(guild)');
// The preplanning receipt branch must project the live current guild, not a later draft.
next=next.replace('raid:raidView(guild),...(prior.resp','raid:raidView(g),...(prior.resp');
next=next.replaceAll('g.log','guild.log').replaceAll('g.exp','guild.exp').replaceAll('g.level','guild.level');
next=next.replaceAll('ledgerTeamPower(me)','ledgerTeamPower(actor)').replaceAll('ensureLedger(me)','ensureLedger(actor)').replaceAll('creditGold(me,','creditGold(actor,').replaceAll('creditGems(me,','creditGems(actor,').replaceAll('ledTx(me,','ledTx(actor,').replaceAll('ledgerView(me)','ledgerView(actor)');
change("if(Date.now()-(a.startedAt||0) > RAID_SESSION_MS) { writeDB();", "if(Date.now()-(a.startedAt||0) > RAID_SESSION_MS) {");
change('        writeDB();\n','');
change(`      });
      return send(res,200,out); }`, `      })();}finally{_worldSettlementPlanning=null;}
      // Unknown attempt is a read-only refusal, not a saved receipt or migration.
      if(!out?.ok&&!out?.expired)return send(res,200,out);
      const receipts={...(DB.idem||{}),[key]:{t:Date.now(),guildId:g.id,attemptId,resp:structuredClone(out)}};
      const committed=durableUserCommit(me,actor,receipts,'guild-management',[],{guilds});
      if(!committed.ok)return send(res,503,{ok:false,error:committed.error||'Raid save failed. Retry the same request.'});
      return send(res,200,out); }`);
const output=source.slice(0,a)+next+source.slice(z),dest=path.join(__dirname,'payload/combined/server.js');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,output,{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'spans.json'),JSON.stringify({base:hash(source),output:hash(output),old,next},null,2));console.log(hash(output));
