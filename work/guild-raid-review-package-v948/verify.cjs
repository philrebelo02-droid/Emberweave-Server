'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),a=require('node:assert/strict');
const pins={'private-client-entry-closure.html':'c4f330ca4ae0df11f56caa2fab3db6d6483adcaddb0a970c02953ae8516ff115','private-server-period-closure.js':'7d2cb9f199382ea77a31ed36bfead8fc03808c9559a40ed5b18bb17c5ef5dbe9'};
function verify(dir,manifest){a.equal(manifest.kind,'private-review-evidence');a.equal(manifest.deployApproved,false);a.equal(manifest.installable,false);a.equal(manifest.baseCommit,'bbbc3a662a4f106153abafafec691cc6d70149a0');a(Array.isArray(manifest.files)&&manifest.files.length===8);let total=0;const names=new Set();
 for(const f of manifest.files){a(typeof f.name==='string'&&/^[a-z0-9-]+\.(?:html|js|json)$/.test(f.name),'Flat bounded filenames required');a(!names.has(f.name));names.add(f.name);const bytes=fs.readFileSync(path.join(dir,f.name)),sha=crypto.createHash('sha256').update(bytes).digest('hex');a.equal(sha,f.sha256);a.equal(bytes.length,f.bytes);if(pins[f.name])a.equal(sha,pins[f.name]);total+=bytes.length;}
 for(const name of Object.keys(pins))a(names.has(name));a(total<10000000,'Bounded review package exceeds10MB');a.equal(total,manifest.totalBytes);
 const html=fs.readFileSync(path.join(dir,'private-client-entry-closure.html'),'utf8'),scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].filter(x=>x[1].trim());for(const [i,s]of scripts.entries())new vm.Script(s[1],{filename:'inline-'+i});a.equal(scripts.length,3);new vm.Script(fs.readFileSync(path.join(dir,'private-server-period-closure.js'),'utf8'),{filename:'private-server'});
 return {files:manifest.files.length,totalBytes:total,inlineScriptsParsed:scripts.length,serverParsed:true,deployApproved:false,installable:false};}
module.exports={verify};
if(require.main===module){const dir=__dirname,result=verify(dir,JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')));console.log(JSON.stringify(result));}
