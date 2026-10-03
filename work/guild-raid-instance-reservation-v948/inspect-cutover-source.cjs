'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const base=__dirname,client=fs.readFileSync(path.join(base,'private-client-instance-reservation.html'),'utf8');
assert.equal(sha(client),'28ec2c6d66f33b9d730d3b1d224992e1a1205070affaf23f71be19637ff45283');
const sections=[
 ['hybrid','M.hybrid=(()=>','M.directory=(()=>'],
 ['facade','M.facade=(()=>','M.bootstrap=(()=>']
];
const inspected=sections.map(([name,start,end])=>{const b=client.indexOf(start),e=client.indexOf(end,b);assert(b>=0&&e>b);return {name,sha256:sha(client.slice(b,e)),firstLine:client.slice(0,b).split('\n').length,lastLine:client.slice(0,e).split('\n').length-1}});
assert(client.includes("const key=r=>'codex_private_raid_slot_v3_'+encodeURIComponent(r.accountId)+'_'+r.id;"));
assert(client.includes('const writers=new Map(),resumedAttempts=new Map()'));
assert(client.includes('No automatic marker eviction; quota/retention design remains unresolved.'));
assert(client.includes("typeof window.EW_RAID_LEGACY_QUIESCENCE_PROOF==='function'&&await window.EW_RAID_LEGACY_QUIESCENCE_PROOF(scope)===true"));
const design=fs.readFileSync(path.join(base,'cutover-retention-design.json'),'utf8'),d=JSON.parse(design);
assert.equal(d.status,'PROPOSED_CONTRACT_ONLY_NOT_IMPLEMENTED_TESTED_APPROVED_OR_SHIPPED');assert.equal(d.clientSHA256,sha(client));
const now=new Date(),atET=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now);
const output={atET,status:'STATIC_EXACT_SOURCE_INSPECTION_ONLY_NO_NEW_BEHAVIOR_TEST_OR_APPROVAL',clientSHA256:sha(client),designSHA256:sha(design),inspectorSHA256:sha(fs.readFileSync(__filename)),inspected,observations:['Unique slot key lacks durable generation','Writer lease maps are runtime-local','Marker eviction explicitly unimplemented','Production bridge requires external strict Boolean true provider'],limits:'Exact source/shape inspection only. No implementation, all-writer proof, backup/restore, compaction, native or HTTP test execution. Proposed design choices remain joint review questions.'};
fs.writeFileSync(path.join(base,'cutover-source-inspection.json'),JSON.stringify(output,null,2));console.log(JSON.stringify(output));
