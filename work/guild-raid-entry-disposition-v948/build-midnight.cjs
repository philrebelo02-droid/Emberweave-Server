'use strict';const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict'),c=require('node:crypto');
let out=fs.readFileSync(path.join(__dirname,'model-bound.cjs'),'utf8');a.equal(c.createHash('sha256').update(out).digest('hex'),'e95dad106736691f264b22215814ba55df36b5e37babb5279707a0ea8725ef8b');
const change=(old,next)=>{a.equal(out.split(old).length,2);out=out.replace(old,next)};
change("   if(x.period<period)return {status:200,terminal:{v:1,intent:x,kind:'period-closed',spent:'unknown',lateStartRefused:true}};\n   if(u.guildId!==x.guildId)return {status:403,held:true};\n",'');
change("   // Never evict current-period dispositions.","   if(x.period<period)return {status:200,terminal:{v:1,intent:x,kind:'period-closed',spent:'unknown',lateStartRefused:true}};\n   if(u.guildId!==x.guildId)return {status:403,held:true};\n   // Never evict current-period dispositions.");
change('const keep=rows.filter(r=>r.intent.period===period);','const keep=rows.filter(r=>r.intent.period===period||r.reply.accepted);');
new(require('node:vm').Script)(out);fs.writeFileSync(path.join(__dirname,'model-midnight.cjs'),out);console.log(c.createHash('sha256').update(out).digest('hex'));
