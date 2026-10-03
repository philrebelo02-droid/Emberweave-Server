'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),a=require('node:assert/strict');
if(fs.existsSync('C:/Users/Home/AppData/Local/Emberweave/shutdown-requested.json'))throw Error('Shutdown');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
const source=read('../guild-raid-cleanup-lock-v942/payload/combined/emberweave-heroes.html');
a.equal(hash(source),'0f7ee8d2e850bebca11f736b291dc29d814d8b520564a576b0a27de03415b758','Exact private HTML baseline');
const begin=source.indexOf('let RAID_START_PENDING=null,RAID_SETTLEMENT=null;'),end=source.indexOf('/* The damage this fight has done to the raid boss:',begin);a(begin>0&&end>begin);a.equal(source.indexOf('let RAID_START_PENDING=null,RAID_SETTLEMENT=null;',begin+1),-1);
const block=source.slice(begin,end),renderBegin=block.indexOf('      if(resultStale(ep))return;'),renderEnd=block.indexOf(' },800);raidJournalWrite(pending,RB);pending.retry();',renderBegin);a(renderBegin>0&&renderEnd>renderBegin);
const render='function raidRenderConfirmed(r,RB,ep){\n'+block.slice(renderBegin,renderEnd)+'\n}\n';
const inputs={hybrid:'hybrid-adapter.cjs',directory:'../guild-raid-discovery-design-v942/native-directory.cjs',facade:'composition-facade.cjs',bootstrap:'bootstrap.cjs',presentation:'presentation.cjs',transport:'../guild-raid-response-binding-v942/transport.cjs',entry:'../guild-raid-response-binding-v942/validator.cjs',fresh:'fresh-entry-validator.cjs',settlement:'../guild-raid-settlement-binding-v942/validator.cjs'};
const hashes={},parts=[];for(const [name,file]of Object.entries(inputs)){const raw=read(file);a(!raw.includes('</script>'));hashes[name]=hash(raw);parts.push('M.'+name+'=(()=>{const module={exports:{}},require=n=>{if(n!==\'./hybrid-adapter.cjs\')throw Error(\'Unexpected dependency\');return M.hybrid};\n'+raw+'\nreturn module.exports})();');}
const bundle='const EW_RAID_V3_MODULES=(()=>{const M={};\n'+parts.join('\n')+'\nreturn M})();\n',hooks=read('html-hooks.js');
const replacement=bundle+hooks+'\n'+render,newSource=source.slice(0,begin)+replacement+source.slice(end);
const scripts=[...newSource.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(x=>x.trim());for(const script of scripts)new vm.Script(script);
a(!newSource.includes('function raidJournalWrite('));a(newSource.includes('function raidStartAccepted(st,raidInstanceId,raidEntryRequestId)'));
// Outside the single guarded Guild block, every original byte is preserved.
a.equal(newSource.slice(0,begin),source.slice(0,begin));a.equal(newSource.slice(begin+replacement.length),source.slice(end));
fs.writeFileSync(path.join(__dirname,'private-bootstrap-heroes.html'),newSource);
fs.writeFileSync(path.join(__dirname,'html-build-certificate.json'),JSON.stringify({at:new Date().toISOString(),status:'PRIVATE_FULLHTML_BUILT_PARSE_ONLY_NOT_BROWSER_NOT_SHIPPED',sourceHash:hash(source),outputHash:hash(newSource),inputs:hashes,hooksHash:hash(hooks),guardedOriginalBlockHash:hash(block),unchangedOutsideGuard:true,parsedInlineScripts:scripts.length,limits:'Runtime/browser HTTP/DOM unverified. Default legacy quiescence gate false, old unresolved slots held, no silent migration. Native revised storage/permissions/quota/retention and full integration/release package OPEN. Uses historic private HTML baseline, not current live merge approval.'},null,2));console.log('PASS exact-source guarded fullHTML build/parse; outside Guild block byte-identical; default cutover HELD');
