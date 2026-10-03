'use strict';
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert');
const p='C:/Users/Home/Downloads/ew-audit/emberweave-heroes.html',text=fs.readFileSync(p,'utf8');
const branch=text.split(/\r?\n/).find(x=>x.includes('if(tgt.pass&&tgt.pass.stormdodge'));
assert(branch,'Actual Static Veil branch not found');
function run(code){let fired=0;const tgt={pass:{stormdodge:true},_stormT:1,_castT:1,x:0,y:0,anim:{passive:{n:48,fps:24}}};
const context={tgt,brnd:()=>0,floatTexts:[],firePassiveClip:o=>{fired++;o._passFired=true;}};
const dodged=vm.runInNewContext('(function(){\n'+code+'\n;return "not-dodged";})()',context);
return {dodged:dodged===undefined,floatTextCount:context.floatTexts.length,passiveFired:fired,eligibleIdleFiller:!tgt._passFired&&!!tgt.anim.passive};}
const actual=run(branch);assert(actual.dodged);assert.strictEqual(actual.passiveFired,0);assert(actual.eligibleIdleFiller);
const control=run(branch.replace(' return;', ' firePassiveClip(tgt); return;'));
assert.strictEqual(control.passiveFired,1);assert.strictEqual(control.eligibleIdleFiller,false);
const out={scope:'Executed actual extracted Static Veil branch with forced successful dodge and stubbed rendering callback; not full battle/priority proof.',clientSHA256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),source:branch,actual,control};
fs.writeFileSync(__filename.replace('.cjs','.evidence.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
