'use strict';const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict'),c=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'model.cjs'),'utf8');a.equal(c.createHash('sha256').update(source).digest('hex'),'4b1a9ab3518bd79a2364126d56bf990a07347161aaffdccc45c967a20d2ab1c2');
let out=source;const change=(old,next)=>{a.equal(out.split(old).length,2);out=out.replace(old,next)};
change('return clone(x)}',"return {accountId:x.accountId,guildId:x.guildId,heroIds:clone(x.heroIds),period:x.period,requestId:x.requestId}}" );
change('function create(store,{period,maxRecords=8}={}){','function create(store,{period,maxRecords=8,context}={}){');
change(" async function decide(input,mode){", " if(typeof context!=='function')throw Error('Authenticated principal required');\n const captured=clone(context());if(!captured||typeof captured.accountId!=='string'||!captured.accountId||!Number.isSafeInteger(captured.epoch))throw Error('Authenticated principal required');\n const current=()=>{const now=context();return !!now&&now.accountId===captured.accountId&&now.epoch===captured.epoch};\n async function decide(input,mode){");
change("  return store.atomic(async db=>{", "  if(x.accountId!==captured.accountId||!current())return {status:403,held:true};\n  const result=await store.atomic(async db=>{\n   if(!current())return {status:403,held:true};");
change("  });\n }", "  });\n  if(!current())throw Error('Stale authenticated session after commit');return result;\n }");
new(require('node:vm').Script)(out);fs.writeFileSync(path.join(__dirname,'model-bound.cjs'),out);console.log(c.createHash('sha256').update(out).digest('hex'));
