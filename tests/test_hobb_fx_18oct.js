'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert');
const root=path.resolve(__dirname,'..'),src=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');
const h=require('../server/sim-host.js').load(path.join(root,'emberweave-heroes.html')),run=s=>vm.runInContext(s,h.ctx);
const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/hobb_fx_18oct.json'),'utf8'));let pass=0;
const ck=(s,v)=>{assert(v,s);console.log('ok '+s);pass++};const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
ck('all three approved effects represented',rows.length===3&&new Set(rows.map(r=>r.key)).size===3);
for(const r of rows){const d=run(`JSON.parse(JSON.stringify(FX2_DEF.${r.key}))`),v=run(`JSON.parse(JSON.stringify(FX16_ART.hobb${r.key.split('_')[1]}))`),bytes=fs.readFileSync(path.join(root,d.u.split('?')[0]));
 ck(r.key+' approved source matches receipt',sha(fs.readFileSync(r.source))===r.sourceSha256);
 ck(r.key+' final sheet dimensions, alpha and receipt',sha(bytes)===r.sha256&&1+bytes.readUIntLE(24,3)===d.fw*d.cols&&1+bytes.readUIntLE(27,3)===d.fh*d.rows&&Math.max(d.fw*d.cols,d.fh*d.rows)<=2048&&bytes.length<4e6);
 ck(r.key+' full source cells retained at original speed',r.sourceFrames[0]===0&&r.sourceFrames.at(-1)===r.sourceFrameCount-1&&Math.abs(d.n/d.fps2-r.sourceFrameCount/r.sourceFps)<1e-9);
 ck(r.key+' expected route once',v.mode===r.view.mode&&v.once&&d.spawn>=0);
}
ck('green press, blue pot crush, ult radius match their contact policy',run("FX2_DEF.hobb_green.spawn===0&&FX2_DEF.hobb_blue.spawn===16&&FX16_ART.hobbult.R===ULT_DEF.aoeStun.radius"));
ck('trimmed burst aligns contact40 within one FX frame',run('Math.abs((3.2-FX2_DEF.hobb_ult.startSec)-BATTLE_ANIM.hobb.ult.contact/BATTLE_ANIM.hobb.ult.fps)<1/FX2_DEF.hobb_ult.fps2'));
const base=cp.execFileSync('git',['show','HEAD:emberweave-heroes.html'],{cwd:root,maxBuffer:64<<20}).toString();
// Keep the baseline beside its unchanged dependency scripts for the replay host.
const file=path.join(root,'.hobb-fx-baseline-'+process.pid+'.html');fs.writeFileSync(file,base);
try{const b=require('../server/sim-host.js').load(file),br=s=>vm.runInContext(s,b.ctx);
 const normalize=s=>JSON.stringify(JSON.parse(s),(k,v)=>k==='ownFx'?undefined:v);
 ck('hero stats and kit mechanics unchanged',normalize(run('JSON.stringify([HERO_TYPES.hobb,KITS.hobb,HERO_ULT_ART.hobb,ULT_DEF.aoeStun,BATTLE_ANIM.hobb])'))===normalize(br('JSON.stringify([HERO_TYPES.hobb,KITS.hobb,HERO_ULT_ART.hobb,ULT_DEF.aoeStun,BATTLE_ANIM.hobb])')));
}finally{fs.unlinkSync(file)}
run(`window.__frames=[];fx2SetFrame=(s,d,f)=>window.__frames.push(f);_fx22Fx16Side=()=>{};window.HOBB_FULL_FX=false;`);
const playback=full=>run(`(()=>{window.HOBB_FULL_FX=${full};window.__frames=[];const o={d:FX2_DEF.hobb_ult,u:{alive:true},vk:'hobbult',ok:true,s:{material:{}},ts:0};let end=0;for(let i=0;i<500;i++){o.t=i/60*FX_RT;if(_fx22Fx16Tick(o)<0){end=i/60;break;}}return {first:window.__frames[0],last:window.__frames.at(-1),end};})()`);
const a=playback(false),b=playback(true);
ck('A skips only the agreed head and runs through final cell at full speed',a.first===18&&a.last===72&&Math.abs(a.end-(rows.find(r=>r.key==='hobb_ult').meta.dur-1.53))<1/30);
ck('B flag preserves the whole effect through final cell at full speed',b.first===0&&b.last===72&&Math.abs(b.end-6.0416667)<1/30);
for(const m of src.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
new vm.Script(fs.readFileSync(path.join(root,'assets/ui/skill-preview-stage.js'),'utf8'));ck('all game and skill preview scripts parse',true);
console.log('PASS '+pass+' checks');
